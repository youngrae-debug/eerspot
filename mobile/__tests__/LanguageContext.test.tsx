import React from 'react';
import { Text } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';

import {
  LanguageProvider,
  useLanguage,
} from '../src/shared/i18n/LanguageContext';
import type { Language } from '../src/shared/i18n/messages';

const Keychain = jest.requireMock('react-native-keychain') as {
  ACCESSIBLE: {
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: string;
  };
  getGenericPassword: jest.Mock;
  setGenericPassword: jest.Mock;
};

type Controls = {
  setLanguage: (language: Language) => void;
};

function LanguageProbe({
  onReady,
}: {
  onReady: (controls: Controls) => void;
}): React.JSX.Element {
  const { language, setLanguage } = useLanguage();

  React.useEffect(() => {
    onReady({ setLanguage });
  }, [onReady, setLanguage]);

  return <Text>{language}</Text>;
}

afterEach(() => {
  Keychain.getGenericPassword.mockReset();
  Keychain.setGenericPassword.mockReset();
  Keychain.getGenericPassword.mockResolvedValue(false);
  Keychain.setGenericPassword.mockResolvedValue(true);
});

test('hydrates the stored language and persists updates', async () => {
  let instance!: ReactTestRenderer.ReactTestRenderer;
  let controls!: Controls;

  Keychain.getGenericPassword.mockResolvedValue({
    password: 'ko',
    username: 'language',
  });

  await ReactTestRenderer.act(async () => {
    instance = ReactTestRenderer.create(
      <LanguageProvider>
        <LanguageProbe
          onReady={nextControls => {
            controls = nextControls;
          }}
        />
      </LanguageProvider>,
    );
  });

  await ReactTestRenderer.act(async () => {
    await Promise.resolve();
  });

  expect(instance.root.findByType(Text).props.children).toBe('ko');

  await ReactTestRenderer.act(async () => {
    controls.setLanguage('ja');
    await Promise.resolve();
  });

  expect(instance.root.findByType(Text).props.children).toBe('ja');
  expect(Keychain.setGenericPassword).toHaveBeenCalledWith('language', 'ja', {
    accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    service: 'com.eerspot.preferences.language',
  });
});
