import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useLanguage } from '../../../shared/i18n/LanguageContext';
import { colors } from '../../../shared/theme/colors';

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
      <View style={styles.panel}>
        <View style={styles.profileRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarMark}>e</Text>
          </View>

          <View style={styles.profileCopy}>
            <View style={styles.profileHeaderRow}>
              <Text style={styles.brand}>eerspot</Text>
              <Pressable
                onPress={() => {
                  onSignOut().catch(() => undefined);
                }}>
                <Text style={styles.signOutLabel}>{t('my_sign_out')}</Text>
              </Pressable>
            </View>
            <Text style={styles.email}>{email}</Text>
          </View>
        </View>
      </View>

      <View style={styles.panel}>
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
        <View style={styles.divider} />
        <Text style={styles.sectionTitle}>{t('my_backup_title')}</Text>
        <Text style={styles.sectionDescription}>{t('my_sync_status_value')}</Text>
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
      style={[styles.languageButton, active ? styles.languageButtonActive : null]}>
      <Text
        style={[
          styles.languageButtonLabel,
          active ? styles.languageButtonLabelActive : null,
        ]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 20,
  },
  panel: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderRadius: 30,
    borderWidth: 1,
    gap: 18,
    paddingHorizontal: 18,
    paddingVertical: 20,
  },
  profileRow: {
    flexDirection: 'row',
    gap: 16,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.divider,
    borderRadius: 999,
    borderWidth: 1,
    height: 88,
    justifyContent: 'center',
    width: 88,
  },
  avatarMark: {
    color: colors.textMuted,
    fontSize: 24,
    fontWeight: '700',
  },
  profileCopy: {
    flex: 1,
    gap: 4,
    justifyContent: 'center',
  },
  profileHeaderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  brand: {
    color: colors.textPrimary,
    fontSize: 25,
    fontWeight: '800',
    letterSpacing: -0.7,
  },
  signOutLabel: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: '700',
  },
  email: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 19,
    fontWeight: '700',
    letterSpacing: -0.3,
    lineHeight: 24,
  },
  sectionDescription: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
  },
  languageRow: {
    flexDirection: 'row',
    gap: 12,
  },
  divider: {
    backgroundColor: colors.divider,
    height: 1,
  },
  languageButton: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 72,
    paddingHorizontal: 10,
  },
  languageButtonActive: {
    backgroundColor: colors.textPrimary,
    borderColor: colors.textPrimary,
  },
  languageButtonLabel: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
  languageButtonLabelActive: {
    color: colors.surfaceElevated,
  },
});
