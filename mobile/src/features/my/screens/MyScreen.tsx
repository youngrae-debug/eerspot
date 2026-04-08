import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useLanguage } from '../../../shared/i18n/LanguageContext';
import { colors } from '../../../shared/theme/colors';
import { journalTokens } from '../../../shared/theme/journalTokens';

type MyScreenProps = {
  email: string;
  onSignOut: () => Promise<void>;
};

export function MyScreen({
  email,
  onSignOut,
}: MyScreenProps): React.JSX.Element {
  const { language, setLanguage, t } = useLanguage();

  return (
    <View style={styles.container}>
      <View style={styles.profileSection}>
        <View style={styles.profileHeaderRow}>
          <Text style={styles.brand}>eerspot</Text>
          <Pressable
            onPress={() => {
              onSignOut().catch(() => undefined);
            }}
          >
            <Text style={styles.signOutLabel}>{t('my_sign_out')}</Text>
          </Pressable>
        </View>
        <Text style={styles.email}>{email}</Text>
      </View>

      <View style={styles.section}>
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

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('my_backup_title')}</Text>
        <Text style={styles.sectionDescription}>
          {t('my_sync_status_value')}
        </Text>
      </View>
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

const styles = StyleSheet.create({
  container: {
    gap: 28,
  },
  profileSection: {
    gap: 6,
  },
  profileHeaderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  brand: {
    color: journalTokens.color.textStrong,
    fontSize: 24,
    fontWeight: '600',
    letterSpacing: -0.5,
  },
  signOutLabel: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '600',
  },
  email: {
    color: journalTokens.color.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  section: {
    borderTopColor: journalTokens.color.rule,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 14,
    paddingTop: 18,
  },
  sectionTitle: {
    color: journalTokens.color.textStrong,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
  },
  sectionDescription: {
    color: journalTokens.color.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  languageRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  languageButton: {
    alignItems: 'center',
    backgroundColor: journalTokens.color.pageSurface,
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
});
