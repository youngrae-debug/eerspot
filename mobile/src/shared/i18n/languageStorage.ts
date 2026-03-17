import * as Keychain from 'react-native-keychain';

import type { Language } from './messages';

const LANGUAGE_SERVICE = 'com.eerspot.preferences.language';
const LANGUAGE_USERNAME = 'language';

export async function loadStoredLanguage(): Promise<Language | null> {
  const credentials = await Keychain.getGenericPassword({
    service: LANGUAGE_SERVICE,
  });

  if (!credentials) {
    return null;
  }

  if (isLanguage(credentials.password)) {
    return credentials.password;
  }

  await Keychain.resetGenericPassword({
    service: LANGUAGE_SERVICE,
  });

  return null;
}

export async function saveStoredLanguage(language: Language): Promise<void> {
  await Keychain.setGenericPassword(LANGUAGE_USERNAME, language, {
    accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    service: LANGUAGE_SERVICE,
  });
}

function isLanguage(value: string): value is Language {
  return value === 'en' || value === 'ko' || value === 'ja';
}
