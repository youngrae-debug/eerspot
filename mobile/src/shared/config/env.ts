import { NativeModules, Platform } from 'react-native';

function resolveDevHost(): string {
  const fallbackHost = Platform.OS === 'android' ? '10.0.2.2' : '127.0.0.1';
  const scriptURL = NativeModules.SourceCode?.scriptURL;

  if (typeof scriptURL !== 'string') {
    return fallbackHost;
  }

  try {
    const bundleHost = new URL(scriptURL).hostname;

    if (!bundleHost) {
      return fallbackHost;
    }

    if (
      Platform.OS === 'android' &&
      (bundleHost === 'localhost' || bundleHost === '127.0.0.1')
    ) {
      return '10.0.2.2';
    }

    return bundleHost;
  } catch {
    return fallbackHost;
  }
}

const defaultApiHost = `http://${resolveDevHost()}:3000`;

export const env = {
  apiBaseUrl: `${defaultApiHost}/api/v1`,
  appEnv: 'dev',
  authBypassEnabled: false,
  mapProvider: 'kakao',
  discoverEnabled: false,
} as const;
