import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';

type PlaceholderScreenProps = {
  eyebrow: string;
  title: string;
  description: string;
  bullets: string[];
};

export function PlaceholderScreen({
  eyebrow,
  title,
  description,
  bullets,
}: PlaceholderScreenProps): React.JSX.Element {
  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>

      <View style={styles.list}>
        {bullets.map(bullet => (
          <View key={bullet} style={styles.listRow}>
            <View style={styles.dot} />
            <Text style={styles.bullet}>{bullet}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 30,
    paddingHorizontal: 18,
    paddingVertical: 20,
    gap: 12,
  },
  eyebrow: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.textPrimary,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.7,
    lineHeight: 34,
  },
  description: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 25,
  },
  list: {
    gap: 12,
    marginTop: 8,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 999,
    marginTop: 8,
    backgroundColor: colors.textMuted,
  },
  bullet: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 22,
  },
});
