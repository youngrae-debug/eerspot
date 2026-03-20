import { Platform } from 'react-native';

const defaultApiHost =
  Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://127.0.0.1:3000';

export const env = {
  apiBaseUrl: `${defaultApiHost}/api/v1`,
  appEnv: 'dev',
  mapProvider: 'kakao',
  discoverEnabled: false,
} as const;
