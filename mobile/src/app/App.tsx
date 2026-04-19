import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  SafeAreaProvider,
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from '../features/auth/context/AuthContext';
import { listSchedules } from '../features/calendar/api/schedulesApi';
import { syncLocalScheduleReminders } from '../features/calendar/localReminders';
import {
  buildNotificationSyncRange,
  buildReminderFetchRange,
  buildScheduleReminderKey,
  extractScheduleDateKey,
  findDueScheduleReminder,
  formatReminderTimeLabel,
  getReminderLabelKey,
} from '../features/calendar/reminders';
import { AuthScreen } from '../features/auth/screens/AuthScreen';
import { CalendarScreen } from '../features/calendar/screens/CalendarScreen';
import { DiscoverScreen } from '../features/discover/screens/DiscoverScreen';
import {
  extractDiscoverUrlFromAppLink,
  type DiscoverIncomingLinkRequest,
} from '../features/discover/linking';
import { MyScreen } from '../features/my/screens/MyScreen';
import { PlacesScreen } from '../features/places/screens/PlacesScreen';
import type { SavedPlace } from '../features/places/types';
import { LanguageProvider, useLanguage } from '../shared/i18n/LanguageContext';
import { colors } from '../shared/theme/colors';

type TabKey = 'calendar' | 'search' | 'saved' | 'discover' | 'my';
type CalendarRequestedViewMode = 'month' | 'day';
type CalendarDraftRequest = {
  key: number;
  placeId: string | null;
  title: string | null;
};

const TAB_BAR_CONTENT_INSET = 88;

function App(): React.JSX.Element {
  return (
    <SafeAreaProvider>
      <LanguageProvider>
        <AuthProvider>
          <AppRoot />
        </AuthProvider>
      </LanguageProvider>
    </SafeAreaProvider>
  );
}

function AppRoot(): React.JSX.Element {
  const { session, signOut, status } = useAuth();
  const discoverLinkRequestKeyRef = useRef(0);
  const [discoverLinkRequest, setDiscoverLinkRequest] =
    useState<DiscoverIncomingLinkRequest | null>(null);

  useEffect(() => {
    let isMounted = true;

    const queueIncomingDiscoverLink = (appUrl: string | null) => {
      if (!appUrl || !isMounted) {
        return;
      }

      const discoverUrl = extractDiscoverUrlFromAppLink(appUrl);

      if (!discoverUrl) {
        return;
      }

      discoverLinkRequestKeyRef.current += 1;
      setDiscoverLinkRequest({
        key: discoverLinkRequestKeyRef.current,
        url: discoverUrl,
      });
    };

    Linking.getInitialURL()
      .then(queueIncomingDiscoverLink)
      .catch(() => undefined);

    const subscription = Linking.addEventListener('url', event => {
      queueIncomingDiscoverLink(event.url);
    });

    return () => {
      isMounted = false;
      subscription.remove();
    };
  }, []);

  if (status === 'booting') {
    return <BootSplash />;
  }

  if (status === 'anonymous' || !session) {
    return (
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <StatusBar
          barStyle="dark-content"
          backgroundColor={colors.background}
        />
        <View style={styles.authOnlyContainer}>
          <AuthScreen />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <AuthenticatedApp
      discoverLinkRequest={discoverLinkRequest}
      email={session.user.email}
      onDiscoverLinkHandled={requestKey => {
        setDiscoverLinkRequest(currentRequest => {
          if (!currentRequest || currentRequest.key !== requestKey) {
            return currentRequest;
          }

          return null;
        });
      }}
      onSignOut={signOut}
    />
  );
}

type AuthenticatedAppProps = {
  discoverLinkRequest: DiscoverIncomingLinkRequest | null;
  email: string;
  onDiscoverLinkHandled: (requestKey: number) => void;
  onSignOut: () => Promise<void>;
};

function AuthenticatedApp({
  discoverLinkRequest,
  email,
  onDiscoverLinkHandled,
  onSignOut,
}: AuthenticatedAppProps): React.JSX.Element {
  const { authorizedRequest } = useAuth();
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const calendarDraftRequestKeyRef = useRef(0);
  const [activeTab, setActiveTab] = useState<TabKey>('calendar');
  const [calendarFocusRequestKey, setCalendarFocusRequestKey] = useState(0);
  const [calendarRefreshKey, setCalendarRefreshKey] = useState(0);
  const [calendarRequestedDateKey, setCalendarRequestedDateKey] = useState<
    string | null
  >(null);
  const [calendarRequestedViewMode, setCalendarRequestedViewMode] =
    useState<CalendarRequestedViewMode>('month');
  const [calendarDraftRequest, setCalendarDraftRequest] =
    useState<CalendarDraftRequest | null>(null);
  const [reminderRefreshKey, setReminderRefreshKey] = useState(0);
  const [dueScheduleReminder, setDueScheduleReminder] = useState<Awaited<
    ReturnType<typeof listSchedules>
  >['items'][number] | null>(null);
  const seenReminderKeysRef = useRef<Set<string>>(new Set());
  const tabs = [
    {
      key: 'calendar' as const,
      label: t('tab_calendar'),
    },
    {
      key: 'search' as const,
      label: t('tab_search'),
    },
    {
      key: 'saved' as const,
      label: t('tab_saved'),
    },
    {
      key: 'discover' as const,
      label: t('tab_discover'),
    },
    {
      key: 'my' as const,
      label: t('tab_my'),
    },
  ];

  useEffect(() => {
    if (!discoverLinkRequest) {
      return;
    }

    setActiveTab('discover');
  }, [discoverLinkRequest]);

  const handleTabPress = (tabKey: TabKey) => {
    if (tabKey === 'calendar') {
      setCalendarRequestedDateKey(null);
      setCalendarRequestedViewMode('month');
      setCalendarDraftRequest(null);
      setActiveTab('calendar');
      setCalendarFocusRequestKey(current => current + 1);
      return;
    }

    setCalendarDraftRequest(null);
    setActiveTab(tabKey);
  };

  const handleDiscoverScheduleCreated = (dateKey: string) => {
    setCalendarRequestedDateKey(dateKey);
    setCalendarRequestedViewMode('day');
    setCalendarDraftRequest(null);
    setCalendarRefreshKey(current => current + 1);
    setReminderRefreshKey(current => current + 1);
    setActiveTab('calendar');
    setCalendarFocusRequestKey(current => current + 1);
  };

  const handleCreateScheduleForSavedPlace = (place: SavedPlace) => {
    const today = new Date();
    const dateKey = extractScheduleDateKey(today.toISOString());

    calendarDraftRequestKeyRef.current += 1;
    setCalendarRequestedDateKey(dateKey);
    setCalendarRequestedViewMode('day');
    setCalendarDraftRequest({
      key: calendarDraftRequestKeyRef.current,
      placeId: place.id,
      title: t('search_place_schedule_default_title', {
        place: place.name,
      }),
    });
    setActiveTab('calendar');
    setCalendarFocusRequestKey(current => current + 1);
  };

  useEffect(() => {
    let isMounted = true;

    const refreshDueReminder = async () => {
      try {
        const schedulesData = await listSchedules(
          authorizedRequest,
          buildReminderFetchRange(new Date()),
        );

        if (!isMounted) {
          return;
        }

        setDueScheduleReminder(
          findDueScheduleReminder(
            schedulesData.items,
            new Date(),
            seenReminderKeysRef.current,
          ),
        );
      } catch {
        if (isMounted) {
          setDueScheduleReminder(null);
        }
      }
    };

    refreshDueReminder().catch(() => undefined);

    const intervalId = setInterval(() => {
      refreshDueReminder().catch(() => undefined);
    }, 60 * 1000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [authorizedRequest, reminderRefreshKey]);

  useEffect(() => {
    let isMounted = true;

    const syncNativeReminders = async () => {
      try {
        const schedulesData = await listSchedules(
          authorizedRequest,
          buildNotificationSyncRange(new Date()),
        );

        if (!isMounted) {
          return;
        }

        await syncLocalScheduleReminders(schedulesData.items, t);
      } catch {
        // Keep the in-app reminder banner working even if native sync fails.
      }
    };

    syncNativeReminders().catch(() => undefined);

    return () => {
      isMounted = false;
    };
  }, [authorizedRequest, reminderRefreshKey, t]);

  const handleDismissReminder = () => {
    if (!dueScheduleReminder) {
      return;
    }

    seenReminderKeysRef.current.add(buildScheduleReminderKey(dueScheduleReminder));
    setDueScheduleReminder(null);
  };

  const handleOpenReminder = () => {
    if (!dueScheduleReminder) {
      return;
    }

    seenReminderKeysRef.current.add(buildScheduleReminderKey(dueScheduleReminder));
    setCalendarRequestedDateKey(
      extractScheduleDateKey(dueScheduleReminder.scheduledAt),
    );
    setCalendarRequestedViewMode('day');
    setCalendarDraftRequest(null);
    setActiveTab('calendar');
    setCalendarFocusRequestKey(current => current + 1);
    setDueScheduleReminder(null);
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <View style={styles.authenticatedContainer}>
        {dueScheduleReminder ? (
          <View style={styles.reminderBanner}>
            <View style={styles.reminderBannerCopy}>
              <Text style={styles.reminderBannerTitle}>
                {t('calendar_reminder_banner_title')}
              </Text>
              <Text style={styles.reminderBannerMessage}>
                {t('calendar_reminder_banner_message', {
                  title: dueScheduleReminder.title,
                  time: formatReminderTimeLabel(dueScheduleReminder.scheduledAt),
                  offsetLabel: t(
                    getReminderLabelKey(
                      dueScheduleReminder.reminderMinutesBefore,
                    ),
                  ),
                })}
              </Text>
            </View>
            <View style={styles.reminderBannerActions}>
              <Pressable
                onPress={handleDismissReminder}
                style={styles.reminderDismissButton}
                testID="app-reminder-dismiss"
              >
                <Text style={styles.reminderDismissButtonLabel}>
                  {t('calendar_reminder_banner_dismiss')}
                </Text>
              </Pressable>
              <Pressable
                onPress={handleOpenReminder}
                style={styles.reminderOpenButton}
                testID="app-reminder-open"
              >
                <Text style={styles.reminderOpenButtonLabel}>
                  {t('calendar_reminder_banner_open')}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {activeTab === 'calendar' ? (
          <CalendarScreen
            bottomInset={TAB_BAR_CONTENT_INSET + insets.bottom}
            dataRefreshKey={calendarRefreshKey}
            draftRequest={calendarDraftRequest}
            focusRequestKey={calendarFocusRequestKey}
            onSchedulesChanged={() => {
              setReminderRefreshKey(current => current + 1);
            }}
            requestedDateKey={calendarRequestedDateKey}
            requestedViewMode={calendarRequestedViewMode}
          />
        ) : (
          <ScrollView
            contentContainerStyle={[
              styles.authenticatedContentContainer,
              {
                paddingBottom: TAB_BAR_CONTENT_INSET + insets.bottom,
              },
            ]}
            showsVerticalScrollIndicator={false}
          >
            {activeTab === 'search' ? <PlacesScreen mode="search" /> : null}
            {activeTab === 'saved' ? (
              <PlacesScreen
                mode="saved"
                onCreateScheduleForPlace={handleCreateScheduleForSavedPlace}
              />
            ) : null}
            {activeTab === 'discover' ? (
              <DiscoverScreen
                incomingLinkRequest={discoverLinkRequest}
                onIncomingLinkHandled={onDiscoverLinkHandled}
                onScheduleCreated={handleDiscoverScheduleCreated}
              />
            ) : null}
            {activeTab === 'my' ? (
              <MyScreen email={email} onSignOut={onSignOut} />
            ) : null}
          </ScrollView>
        )}

        <View
          style={[
            styles.bottomTabBar,
            {
              paddingBottom: Math.max(insets.bottom, 12),
            },
          ]}
        >
          {tabs.map(tab => {
            const isActive = tab.key === activeTab;

            return (
              <Pressable
                key={tab.key}
                onPress={() => handleTabPress(tab.key)}
                style={styles.bottomTabButton}
              >
                <TabGlyph tabKey={tab.key} active={isActive} />
                <Text
                  style={[
                    styles.bottomTabLabel,
                    isActive ? styles.bottomTabLabelActive : null,
                  ]}
                >
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </SafeAreaView>
  );
}

function BootSplash(): React.JSX.Element {
  const { t } = useLanguage();

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <View style={styles.bootContainer}>
        <ActivityIndicator color={colors.accent} size="large" />
        <Text style={styles.bootText}>{t('app_restoring')}</Text>
      </View>
    </SafeAreaView>
  );
}

type TabGlyphProps = {
  active: boolean;
  tabKey: TabKey;
};

function TabGlyph({ active, tabKey }: TabGlyphProps): React.JSX.Element {
  if (tabKey === 'calendar') {
    return (
      <View style={[styles.calendarGlyph, active ? styles.glyphActive : null]}>
        <View style={styles.calendarGlyphTop} />
      </View>
    );
  }

  if (tabKey === 'search') {
    return (
      <View style={styles.searchGlyphWrap}>
        <View
          style={[styles.searchGlyph, active ? styles.glyphActive : null]}
        />
        <View
          style={[
            styles.searchGlyphHandle,
            active ? styles.searchGlyphHandleActive : null,
          ]}
        />
      </View>
    );
  }

  if (tabKey === 'saved') {
    return (
      <View style={styles.savedGlyphWrap}>
        <View
          style={[styles.savedGlyphBody, active ? styles.glyphActive : null]}
        />
        <View
          style={[styles.savedGlyphCut, active ? styles.savedGlyphCutActive : null]}
        />
      </View>
    );
  }

  if (tabKey === 'my') {
    return (
      <View style={styles.discoverGlyphWrap}>
        <View
          style={[styles.discoverGlyphHead, active ? styles.glyphActive : null]}
        />
        <View
          style={[styles.myGlyphBody, active ? styles.glyphActive : null]}
        />
      </View>
    );
  }

  return (
    <View style={styles.discoverGlyphWrap}>
      <View
        style={[styles.discoverGlyphHead, active ? styles.glyphActive : null]}
      />
      <View
        style={[styles.discoverGlyphBody, active ? styles.glyphActive : null]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 24,
    gap: 24,
  },
  header: {
    gap: 10,
  },
  headerTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  eyebrow: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  bootContainer: {
    alignItems: 'center',
    flex: 1,
    gap: 14,
    justifyContent: 'center',
  },
  bootText: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  authOnlyContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  authenticatedContainer: {
    flex: 1,
  },
  reminderBanner: {
    backgroundColor: '#EFE7DA',
    borderBottomColor: colors.divider,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 12,
  },
  reminderBannerCopy: {
    gap: 4,
  },
  reminderBannerTitle: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  reminderBannerMessage: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  reminderBannerActions: {
    flexDirection: 'row',
    gap: 10,
  },
  reminderDismissButton: {
    alignItems: 'center',
    borderColor: colors.borderStrong,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 34,
    paddingHorizontal: 14,
  },
  reminderDismissButtonLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  reminderOpenButton: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: 999,
    justifyContent: 'center',
    minHeight: 34,
    paddingHorizontal: 14,
  },
  reminderOpenButtonLabel: {
    color: colors.background,
    fontSize: 12,
    fontWeight: '600',
  },
  authenticatedContentContainer: {
    gap: 28,
    paddingHorizontal: 26,
    paddingTop: 22,
  },
  bottomTabBar: {
    backgroundColor: colors.background,
    borderTopColor: colors.divider,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    left: 0,
    paddingHorizontal: 8,
    paddingTop: 8,
    position: 'absolute',
    right: 0,
    bottom: 0,
  },
  bottomTabButton: {
    alignItems: 'center',
    flex: 1,
    gap: 5,
    minHeight: 56,
    justifyContent: 'center',
  },
  bottomTabLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  bottomTabLabelActive: {
    color: colors.textPrimary,
  },
  calendarGlyph: {
    borderColor: colors.textMuted,
    borderRadius: 4,
    borderWidth: 1.5,
    height: 16,
    width: 16,
  },
  calendarGlyphTop: {
    borderBottomColor: colors.textMuted,
    borderBottomWidth: 1.5,
    marginTop: 4,
  },
  searchGlyphWrap: {
    height: 18,
    width: 18,
  },
  searchGlyph: {
    borderColor: colors.textMuted,
    borderRadius: 999,
    borderWidth: 1.5,
    height: 12,
    width: 12,
  },
  searchGlyphHandle: {
    backgroundColor: colors.textMuted,
    borderRadius: 999,
    height: 1.5,
    position: 'absolute',
    right: 1,
    bottom: 2,
    transform: [{ rotate: '45deg' }],
    width: 7,
  },
  searchGlyphHandleActive: {
    backgroundColor: colors.textPrimary,
  },
  savedGlyphWrap: {
    alignItems: 'center',
    height: 18,
    justifyContent: 'center',
    width: 18,
  },
  savedGlyphBody: {
    borderColor: colors.textMuted,
    borderRadius: 3,
    borderWidth: 1.5,
    height: 16,
    width: 12,
  },
  savedGlyphCut: {
    backgroundColor: colors.background,
    borderLeftColor: colors.textMuted,
    borderTopColor: colors.textMuted,
    borderTopWidth: 1.5,
    borderLeftWidth: 1.5,
    height: 5,
    position: 'absolute',
    transform: [{ rotate: '-45deg' }],
    width: 5,
    bottom: 1,
  },
  savedGlyphCutActive: {
    borderLeftColor: colors.textPrimary,
    borderTopColor: colors.textPrimary,
  },
  discoverGlyphWrap: {
    alignItems: 'center',
    gap: 2,
    height: 18,
    justifyContent: 'center',
    width: 18,
  },
  discoverGlyphHead: {
    borderColor: colors.textMuted,
    borderRadius: 999,
    borderWidth: 1.5,
    height: 7,
    width: 7,
  },
  discoverGlyphBody: {
    borderColor: colors.textMuted,
    borderRadius: 999,
    borderWidth: 1.5,
    height: 7,
    width: 12,
  },
  myGlyphBody: {
    borderColor: colors.textMuted,
    borderRadius: 999,
    borderWidth: 1.5,
    height: 7,
    width: 10,
  },
  glyphActive: {
    borderColor: colors.textPrimary,
  },
});

export default App;
