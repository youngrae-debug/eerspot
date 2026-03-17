import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { messages, type Language, type MessageKey } from './messages';
import { loadStoredLanguage, saveStoredLanguage } from './languageStorage';

type TranslateParams = Record<string, number | string>;

type LanguageContextValue = {
  language: Language;
  setLanguage: (nextLanguage: Language) => void;
  t: (key: MessageKey, params?: TranslateParams) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

type Props = {
  children: React.ReactNode;
};

export function LanguageProvider({ children }: Props): React.JSX.Element {
  const [language, setLanguageState] = useState<Language>('en');

  useEffect(() => {
    let isMounted = true;

    loadStoredLanguage()
      .then(storedLanguage => {
        if (isMounted && storedLanguage) {
          setLanguageState(storedLanguage);
        }
      })
      .catch(() => undefined);

    return () => {
      isMounted = false;
    };
  }, []);

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      setLanguage: nextLanguage => {
        setLanguageState(nextLanguage);
        saveStoredLanguage(nextLanguage).catch(() => undefined);
      },
      t: (key, params) => interpolate(messages[language][key], params),
    }),
    [language],
  );

  return (
    <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);

  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }

  return context;
}

function interpolate(
  template: string,
  params: TranslateParams | undefined,
): string {
  if (!params) {
    return template;
  }

  return Object.entries(params).reduce((nextValue, [key, value]) => {
    return nextValue.replaceAll(`{${key}}`, String(value));
  }, template);
}
