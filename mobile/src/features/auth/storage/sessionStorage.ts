import * as Keychain from 'react-native-keychain';

import type { StoredAuthSession } from '../types';

const SESSION_SERVICE = 'com.eerspot.auth.session';
const SESSION_USERNAME = 'session';

export async function loadStoredSession(): Promise<StoredAuthSession | null> {
  const credentials = await Keychain.getGenericPassword({
    service: SESSION_SERVICE,
  });

  if (!credentials) {
    return null;
  }

  try {
    return JSON.parse(credentials.password) as StoredAuthSession;
  } catch {
    await clearStoredSession();
    return null;
  }
}

export async function saveStoredSession(session: StoredAuthSession): Promise<void> {
  await Keychain.setGenericPassword(
    SESSION_USERNAME,
    JSON.stringify(session),
    {
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      service: SESSION_SERVICE,
    },
  );
}

export async function clearStoredSession(): Promise<void> {
  await Keychain.resetGenericPassword({
    service: SESSION_SERVICE,
  });
}
