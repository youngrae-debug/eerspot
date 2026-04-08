import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useLanguage } from '../../../shared/i18n/LanguageContext';
import { colors } from '../../../shared/theme/colors';
import { journalTokens } from '../../../shared/theme/journalTokens';
import { useAuth } from '../context/AuthContext';

export function AuthScreen(): React.JSX.Element {
  const { error, isSubmitting, signIn } = useAuth();
  const { t } = useLanguage();
  const [email, setEmail] = useState('user@example.com');
  const [password, setPassword] = useState('Secret123!');

  return (
    <View style={styles.screen}>
      <Text style={styles.brand}>{t('auth_brand')}</Text>

      <View style={styles.form}>
        <Field
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          label={t('auth_email')}
          onChangeText={setEmail}
          placeholder={t('auth_email_placeholder')}
          value={email}
        />

        <Field
          autoCapitalize="none"
          autoCorrect={false}
          label={t('auth_password')}
          onChangeText={setPassword}
          placeholder={t('auth_password_placeholder_login')}
          secureTextEntry
          value={password}
        />
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Pressable
        disabled={isSubmitting}
        onPress={() => {
          signIn(email, password).catch(() => undefined);
        }}
        style={[
          styles.submitButton,
          isSubmitting ? styles.buttonDisabled : null,
        ]}
      >
        {isSubmitting ? (
          <ActivityIndicator color={journalTokens.color.inverseText} />
        ) : (
          <Text style={styles.submitLabel}>{t('auth_login')}</Text>
        )}
      </Pressable>
    </View>
  );
}

type FieldProps = {
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoCorrect?: boolean;
  keyboardType?: 'default' | 'email-address';
  label: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  secureTextEntry?: boolean;
  value: string;
};

function Field({
  autoCapitalize = 'none',
  autoCorrect = false,
  keyboardType = 'default',
  label,
  onChangeText,
  placeholder,
  secureTextEntry = false,
  value,
}: FieldProps): React.JSX.Element {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        keyboardType={keyboardType}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        secureTextEntry={secureTextEntry}
        style={styles.input}
        value={value}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    gap: 28,
  },
  brand: {
    color: journalTokens.color.textStrong,
    fontSize: 24,
    fontWeight: '600',
    letterSpacing: -0.5,
  },
  form: {
    gap: 18,
  },
  field: {
    gap: 8,
  },
  label: {
    color: journalTokens.color.textMuted,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: 'transparent',
    borderBottomColor: journalTokens.color.rule,
    borderBottomWidth: StyleSheet.hairlineWidth,
    color: journalTokens.color.textPrimary,
    fontSize: 15,
    minHeight: 48,
    paddingHorizontal: 0,
    paddingVertical: 10,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    lineHeight: 18,
  },
  submitButton: {
    alignItems: 'center',
    backgroundColor: journalTokens.color.accent,
    borderRadius: journalTokens.radius.soft,
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: 18,
  },
  submitLabel: {
    color: journalTokens.color.inverseText,
    fontSize: 14,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.55,
  },
});
