import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useLanguage } from '../../../shared/i18n/LanguageContext';
import { colors } from '../../../shared/theme/colors';

export function DiscoverScreen(): React.JSX.Element {
  const { t } = useLanguage();

  return (
    <View style={styles.panel}>
      <Text style={styles.title}>{t('discover_title')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderRadius: 30,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 220,
    paddingHorizontal: 18,
    paddingVertical: 20,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
});
