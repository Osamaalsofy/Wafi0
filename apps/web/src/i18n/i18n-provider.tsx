'use client';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { messages, type Locale, type MessageKey } from './messages';

const localeStorageKey = 'wafi.locale';
const localeChangeEvent = 'wafi-locale-change';

function getLocaleSnapshot(): Locale {
  const saved = window.localStorage.getItem(localeStorageKey);
  return saved === 'ar-SA' || saved === 'en' ? saved : 'en';
}

function subscribeToLocale(onStoreChange: () => void) {
  window.addEventListener('storage', onStoreChange);
  window.addEventListener(localeChangeEvent, onStoreChange);
  return () => {
    window.removeEventListener('storage', onStoreChange);
    window.removeEventListener(localeChangeEvent, onStoreChange);
  };
}

const I18nContext = createContext<{
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey) => string;
}>({ locale: 'en', setLocale: () => undefined, t: (key) => messages.en[key] });
export function I18nProvider({ children }: { children: ReactNode }) {
  const locale = useSyncExternalStore(subscribeToLocale, getLocaleSnapshot, (): Locale => 'en');
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === 'ar-SA' ? 'rtl' : 'ltr';
  }, [locale]);
  const value = useMemo(
    () => ({
      locale,
      setLocale: (next: Locale) => {
        window.localStorage.setItem(localeStorageKey, next);
        window.dispatchEvent(new Event(localeChangeEvent));
      },
      t: (key: MessageKey) => messages[locale][key],
    }),
    [locale],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
export function useI18n() {
  return useContext(I18nContext);
}
