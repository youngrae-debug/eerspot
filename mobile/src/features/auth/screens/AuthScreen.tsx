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
import { useAuth } from '../context/AuthContext';

export function AuthScreen(): React.JSX.Element {
  const { error, isSubmitting, signIn } = useAuth();
  const { t } = useLanguage();
  const [email, setEmail] = useState('user@example.com');
  const [password, setPassword] = useState('Secret123!');

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
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
          style={[styles.submitButton, isSubmitting ? styles.buttonDisabled : null]}>
          {isSubmitting ? (
            <ActivityIndicator color={colors.surfaceElevated} />
          ) : (
            <Text style={styles.submitLabel}>{t('auth_login')}</Text>
          )}
        </Pressable>
      </View>
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
    flex: 1,
    justifyContent: 'center',
    paddingTop: 56,
  },
  card: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderRadius: 32,
    borderWidth: 1,
    gap: 24,
    paddingHorizontal: 22,
    paddingVertical: 28,
  },
  brand: {
    color: colors.textPrimary,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.7,
    textAlign: 'center',
  },
  form: {
    gap: 20,
  },
  field: {
    gap: 10,
  },
  label: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  input: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderRadius: 20,
    borderWidth: 1,
    color: colors.textPrimary,
    fontSize: 15,
    minHeight: 58,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  errorText: {
    color: colors.danger,
    fontSize: 14,
    lineHeight: 21,
  },
  submitButton: {
    alignItems: 'center',
    backgroundColor: colors.textPrimary,
    borderRadius: 14,
    justifyContent: 'center',
    minHeight: 58,
    paddingHorizontal: 18,
  },
  submitLabel: {
    color: colors.surfaceElevated,
    fontSize: 16,
    fontWeight: '800',
  },
  buttonDisabled: {
    opacity: 0.55,
  },
});
