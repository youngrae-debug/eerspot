import React, { useState } from 'react';
import {
  ActivityIndicator,
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
import { AuthScreen } from '../features/auth/screens/AuthScreen';
import { CalendarScreen } from '../features/calendar/screens/CalendarScreen';
import { DiscoverScreen } from '../features/discover/screens/DiscoverScreen';
import { MyScreen } from '../features/my/screens/MyScreen';
import { PlacesScreen } from '../features/places/screens/PlacesScreen';
import { LanguageProvider, useLanguage } from '../shared/i18n/LanguageContext';
import { colors } from '../shared/theme/colors';

type TabKey = 'calendar' | 'places' | 'discover' | 'my';

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

  return <AuthenticatedApp email={session.user.email} onSignOut={signOut} />;
}

type AuthenticatedAppProps = {
  email: string;
  onSignOut: () => Promise<void>;
};

function AuthenticatedApp({
  email,
  onSignOut,
}: AuthenticatedAppProps): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<TabKey>('calendar');
  const [calendarFocusRequestKey, setCalendarFocusRequestKey] = useState(0);
  const [calendarRefreshKey, setCalendarRefreshKey] = useState(0);
  const [calendarRequestedDateKey, setCalendarRequestedDateKey] = useState<
    string | null
  >(null);
  const tabs = [
    {
      key: 'calendar' as const,
      label: t('tab_calendar'),
    },
    {
      key: 'places' as const,
      label: t('tab_search'),
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

  const handleTabPress = (tabKey: TabKey) => {
    if (tabKey === 'calendar') {
      setCalendarRequestedDateKey(null);
      setActiveTab('calendar');
      setCalendarFocusRequestKey(current => current + 1);
      return;
    }

    setActiveTab(tabKey);
  };

  const handleDiscoverScheduleCreated = (dateKey: string) => {
    setCalendarRequestedDateKey(dateKey);
    setCalendarRefreshKey(current => current + 1);
    setActiveTab('calendar');
    setCalendarFocusRequestKey(current => current + 1);
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <View style={styles.authenticatedContainer}>
        {activeTab === 'calendar' ? (
          <CalendarScreen
            bottomInset={TAB_BAR_CONTENT_INSET + insets.bottom}
            dataRefreshKey={calendarRefreshKey}
            focusRequestKey={calendarFocusRequestKey}
            requestedDateKey={calendarRequestedDateKey}
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
            {activeTab === 'places' ? <PlacesScreen /> : null}
            {activeTab === 'discover' ? (
              <DiscoverScreen
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

  if (tabKey === 'places') {
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
