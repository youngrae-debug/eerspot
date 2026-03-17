import React from 'react';
import { Text } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';

import { MyScreen } from '../src/features/my/screens/MyScreen';
import {
  LanguageProvider,
  useLanguage,
} from '../src/shared/i18n/LanguageContext';
import type { Language } from '../src/shared/i18n/messages';

type Controls = {
  setLanguage: (language: Language) => void;
};

function LanguageHarness({
  onReady,
}: {
  onReady: (controls: Controls) => void;
}): React.JSX.Element {
  const { setLanguage } = useLanguage();

  React.useEffect(() => {
    onReady({ setLanguage });
  }, [onReady, setLanguage]);

  return <MyScreen email="test@example.com" onSignOut={async () => undefined} />;
}

function extractTextContent(children: React.ReactNode): string {
  if (typeof children === 'string') {
    return children;
  }

  if (typeof children === 'number') {
    return String(children);
  }

  if (Array.isArray(children)) {
    return children.map(extractTextContent).join('');
  }

  return '';
}

function getAllTexts(
  root: ReactTestRenderer.ReactTestInstance,
): string[] {
  return root.findAllByType(Text).map(textNode => {
    return extractTextContent(textNode.props.children);
  });
}

test('switches My screen copy across English, Korean, and Japanese', async () => {
  let instance!: ReactTestRenderer.ReactTestRenderer;
  let controls!: Controls;

  await ReactTestRenderer.act(() => {
    instance = ReactTestRenderer.create(
      <LanguageProvider>
        <LanguageHarness
          onReady={nextControls => {
            controls = nextControls;
          }}
        />
      </LanguageProvider>,
    );
  });

  expect(getAllTexts(instance.root)).toContain('Language');
  expect(getAllTexts(instance.root)).toContain('Backup');

  await ReactTestRenderer.act(() => {
    controls.setLanguage('ko');
  });

  expect(getAllTexts(instance.root)).toContain('언어');
  expect(getAllTexts(instance.root)).toContain('백업');

  await ReactTestRenderer.act(() => {
    controls.setLanguage('ja');
  });

  expect(getAllTexts(instance.root)).toContain('言語');
  expect(getAllTexts(instance.root)).toContain('バックアップ');
});
