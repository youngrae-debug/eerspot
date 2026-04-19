import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { listSchedules } from '../../calendar/api/schedulesApi';
import { useAuth } from '../../auth/context/AuthContext';
import {
  listPlaceCollections,
  listPlaces,
} from '../../places/api/placesApi';
import { useLanguage } from '../../../shared/i18n/LanguageContext';
import { colors } from '../../../shared/theme/colors';
import { journalTokens } from '../../../shared/theme/journalTokens';

type MyScreenProps = {
  email: string;
  onSignOut: () => Promise<void>;
};

type ProfileSummary = {
  collectionCount: number;
  favoriteCount: number;
  savedPlaceCount: number;
  upcomingReminderCount: number;
  upcomingScheduleCount: number;
};

const EMPTY_SUMMARY: ProfileSummary = {
  collectionCount: 0,
  favoriteCount: 0,
  savedPlaceCount: 0,
  upcomingReminderCount: 0,
  upcomingScheduleCount: 0,
};

export function MyScreen({
  email,
  onSignOut,
}: MyScreenProps): React.JSX.Element {
  const { authorizedRequest } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const [didLoad, setDidLoad] = useState(false);
  const [summary, setSummary] = useState<ProfileSummary>(EMPTY_SUMMARY);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (didLoad) {
      return;
    }

    setDidLoad(true);

    let isMounted = true;

    const loadSummary = async () => {
      setLoadingSummary(true);
      setSummaryError(null);

      try {
        const [placesData, collectionsData, schedulesData] = await Promise.all([
          listPlaces(authorizedRequest),
          listPlaceCollections(authorizedRequest),
          listSchedules(authorizedRequest, buildSummaryFetchRange()),
        ]);

        if (!isMounted) {
          return;
        }

        const now = Date.now();
        const upcomingSchedules = schedulesData.items.filter(schedule => {
          return (
            new Date(schedule.scheduledAt).getTime() >= now &&
            schedule.visitStatus !== 'skipped'
          );
        });

        setSummary({
          collectionCount: collectionsData.items.length,
          favoriteCount: placesData.items.filter(place => place.isFavorite).length,
          savedPlaceCount: placesData.items.length,
          upcomingReminderCount: upcomingSchedules.filter(schedule => {
            return schedule.reminderMinutesBefore !== null;
          }).length,
          upcomingScheduleCount: upcomingSchedules.length,
        });
      } catch (caughtError) {
        if (!isMounted) {
          return;
        }

        setSummaryError(extractErrorMessage(caughtError, t('my_summary_error')));
      } finally {
        if (isMounted) {
          setLoadingSummary(false);
        }
      }
    };

    loadSummary().catch(() => undefined);

    return () => {
      isMounted = false;
    };
  }, [authorizedRequest, didLoad, t]);

  const emailLocalPart = useMemo(() => {
    return email.split('@')[0] || email;
  }, [email]);
  const profileInitial = useMemo(() => {
    return email.trim().charAt(0).toUpperCase() || 'E';
  }, [email]);
  const summaryCards = [
    {
      key: 'saved',
      label: t('my_summary_saved_places'),
      value: summary.savedPlaceCount,
    },
    {
      key: 'collections',
      label: t('my_summary_collections'),
      value: summary.collectionCount,
    },
    {
      key: 'favorites',
      label: t('my_summary_favorites'),
      value: summary.favoriteCount,
    },
    {
      key: 'upcoming',
      label: t('my_summary_upcoming'),
      value: summary.upcomingScheduleCount,
    },
  ];

  const handleSignOut = async () => {
    if (signingOut) {
      return;
    }

    setSigningOut(true);

    try {
      await onSignOut();
    } finally {
      setSigningOut(false);
    }
  };

  const confirmSignOut = () => {
    if (signingOut) {
      return;
    }

    Alert.alert(
      t('my_sign_out_confirm_title'),
      t('my_sign_out_confirm_message'),
      [
        {
          style: 'cancel',
          text: t('my_action_cancel'),
        },
        {
          style: 'destructive',
          text: t('my_sign_out'),
          onPress: () => {
            handleSignOut().catch(() => undefined);
          },
        },
      ],
    );
  };

  const reminderCountLabel =
    summary.upcomingReminderCount === 0
      ? t('my_notifications_none')
      : t('my_notifications_count', {
          count: summary.upcomingReminderCount,
        });
  const localNotificationLabel =
    Platform.OS === 'ios'
      ? t('my_notifications_local_ios')
      : t('my_notifications_local_device');

  return (
    <View style={styles.container}>
      <View style={styles.heroCard}>
        <View style={styles.heroTopRow}>
          <View style={styles.identityRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarLabel}>{profileInitial}</Text>
            </View>
            <View style={styles.identityCopy}>
              <Text style={styles.eyebrow}>{t('tab_my')}</Text>
              <Text numberOfLines={1} style={styles.heroTitle}>
                {emailLocalPart}
              </Text>
              <Text numberOfLines={1} style={styles.email}>
                {email}
              </Text>
            </View>
          </View>
          <View style={styles.planBadge}>
            <Text style={styles.planBadgeLabel}>{t('my_profile_plan_free')}</Text>
          </View>
        </View>

        <Text style={styles.heroDescription}>{t('my_profile_description')}</Text>

        <View style={styles.heroMetaRow}>
          <ProfileMetaCard
            label={t('my_sync_status_title')}
            value={t('my_sync_status_value')}
          />
          <ProfileMetaCard
            label={t('my_backup_last_backup_title')}
            value={t('my_profile_backup_never')}
          />
        </View>
      </View>

      <View style={styles.summaryGrid}>
        {summaryCards.map(card => (
          <View key={card.key} style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>{card.label}</Text>
            {loadingSummary ? (
              <ActivityIndicator color={colors.accent} size="small" />
            ) : (
              <Text
                style={styles.summaryValue}
                testID={`my-summary-value-${card.key}`}
              >
                {card.value}
              </Text>
            )}
          </View>
        ))}
      </View>

      {summaryError ? (
        <Text style={styles.feedbackText}>{summaryError}</Text>
      ) : null}

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>{t('my_language_title')}</Text>
        <View style={styles.languageRow}>
          <LanguageButton
            active={language === 'en'}
            label={t('my_language_en')}
            onPress={() => setLanguage('en')}
          />
          <LanguageButton
            active={language === 'ko'}
            label={t('my_language_ko')}
            onPress={() => setLanguage('ko')}
          />
          <LanguageButton
            active={language === 'ja'}
            label={t('my_language_ja')}
            onPress={() => setLanguage('ja')}
          />
        </View>
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>{t('my_notifications_title')}</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>{t('my_notifications_in_app_title')}</Text>
          <Text style={styles.infoValue}>{reminderCountLabel}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>{t('my_notifications_local_title')}</Text>
          <Text style={styles.infoValue}>{localNotificationLabel}</Text>
        </View>
        <Text style={styles.sectionDescription}>
          {t('my_notifications_description')}
        </Text>
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>{t('my_backup_title')}</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>{t('my_sync_status_title')}</Text>
          <Text style={styles.infoValue}>{t('my_sync_status_value')}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>{t('my_backup_last_backup_title')}</Text>
          <Text style={styles.infoValue}>{t('my_profile_backup_never')}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>{t('my_backup_plan_title')}</Text>
          <Text style={styles.infoValue}>{t('my_profile_plan_free')}</Text>
        </View>
        <Text style={styles.sectionDescription}>{t('my_backup_description')}</Text>
      </View>

      <Pressable
        disabled={signingOut}
        onPress={() => {
          confirmSignOut();
        }}
        style={[
          styles.signOutButton,
          signingOut ? styles.buttonDisabledSurface : null,
        ]}
        testID="my-sign-out-button"
      >
        {signingOut ? (
          <ActivityIndicator color={colors.surfaceElevated} size="small" />
        ) : (
          <Text style={styles.signOutButtonLabel}>{t('my_sign_out')}</Text>
        )}
      </Pressable>
    </View>
  );
}

type ProfileMetaCardProps = {
  label: string;
  value: string;
};

function ProfileMetaCard({
  label,
  value,
}: ProfileMetaCardProps): React.JSX.Element {
  return (
    <View style={styles.heroMetaCard}>
      <Text style={styles.heroMetaLabel}>{label}</Text>
      <Text style={styles.heroMetaValue}>{value}</Text>
    </View>
  );
}

type LanguageButtonProps = {
  active: boolean;
  label: string;
  onPress: () => void;
};

function LanguageButton({
  active,
  label,
  onPress,
}: LanguageButtonProps): React.JSX.Element {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.languageButton,
        active ? styles.languageButtonActive : null,
      ]}
    >
      <Text
        style={[
          styles.languageButtonLabel,
          active ? styles.languageButtonLabelActive : null,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function buildSummaryFetchRange(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(now);
  const to = new Date(now);

  from.setMonth(from.getMonth() - 6);
  to.setMonth(to.getMonth() + 6);

  return {
    from: from.toISOString(),
    to: to.toISOString(),
  };
}

function extractErrorMessage(
  caughtError: unknown,
  fallbackMessage: string,
): string {
  if (caughtError instanceof Error && caughtError.message) {
    return caughtError.message;
  }

  return fallbackMessage;
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  heroCard: {
    backgroundColor: journalTokens.color.pageSurface,
    borderColor: journalTokens.color.rule,
    borderRadius: journalTokens.radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 16,
    padding: 18,
  },
  heroTopRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  identityRow: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 14,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: journalTokens.color.accentSoft,
    borderRadius: 24,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  avatarLabel: {
    color: journalTokens.color.textStrong,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.6,
    lineHeight: 26,
  },
  identityCopy: {
    flex: 1,
    gap: 2,
  },
  eyebrow: {
    color: journalTokens.color.textMuted,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.4,
    lineHeight: 16,
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: journalTokens.color.textStrong,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.7,
    lineHeight: 28,
  },
  email: {
    color: journalTokens.color.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  planBadge: {
    backgroundColor: journalTokens.color.pageBackground,
    borderColor: journalTokens.color.rule,
    borderRadius: journalTokens.radius.round,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 30,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  planBadgeLabel: {
    color: journalTokens.color.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  heroDescription: {
    color: journalTokens.color.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  heroMetaRow: {
    flexDirection: 'row',
    gap: 10,
  },
  heroMetaCard: {
    backgroundColor: journalTokens.color.pageBackground,
    borderColor: journalTokens.color.rule,
    borderRadius: journalTokens.radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  heroMetaLabel: {
    color: journalTokens.color.textMuted,
    fontSize: 12,
    lineHeight: 16,
  },
  heroMetaValue: {
    color: journalTokens.color.textStrong,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  summaryCard: {
    backgroundColor: journalTokens.color.pageSurface,
    borderColor: journalTokens.color.rule,
    borderRadius: journalTokens.radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    flexBasis: '48%',
    gap: 10,
    minHeight: 96,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  summaryLabel: {
    color: journalTokens.color.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  summaryValue: {
    color: journalTokens.color.textStrong,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.8,
    lineHeight: 34,
  },
  feedbackText: {
    color: colors.danger,
    fontSize: 13,
    lineHeight: 18,
  },
  sectionCard: {
    backgroundColor: journalTokens.color.pageSurface,
    borderColor: journalTokens.color.rule,
    borderRadius: journalTokens.radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 14,
    padding: 18,
  },
  sectionTitle: {
    color: journalTokens.color.textStrong,
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
  },
  sectionDescription: {
    color: journalTokens.color.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  languageRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  languageButton: {
    alignItems: 'center',
    backgroundColor: journalTokens.color.pageBackground,
    borderColor: journalTokens.color.ruleStrong,
    borderRadius: journalTokens.radius.round,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    minHeight: 38,
    minWidth: 84,
    paddingHorizontal: 14,
  },
  languageButtonActive: {
    backgroundColor: journalTokens.color.accentSoft,
    borderColor: journalTokens.color.accent,
  },
  languageButtonLabel: {
    color: journalTokens.color.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  languageButtonLabelActive: {
    color: journalTokens.color.textStrong,
  },
  infoRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  infoLabel: {
    color: journalTokens.color.textSecondary,
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  infoValue: {
    color: journalTokens.color.textStrong,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    textAlign: 'right',
  },
  signOutButton: {
    alignItems: 'center',
    backgroundColor: colors.danger,
    borderRadius: journalTokens.radius.round,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 18,
  },
  signOutButtonLabel: {
    color: colors.surfaceElevated,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
  },
  buttonDisabledSurface: {
    opacity: 0.5,
  },
});
