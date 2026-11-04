import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import de from './de.js';
import en from './en.js';
import hi from './hi.js';

const dictionaries = { de, en, hi };

export const LANGUAGES = [
  { code: 'de', label: 'Deutsch' },
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी' },
];

const LOCALES = { de: 'de-DE', en: 'en-GB', hi: 'hi-IN' };
const STORAGE_KEY = 'srj.lang';

function lookup(lang, key) {
  const find = (dict) => key.split('.').reduce((node, part) => node?.[part], dict);
  return find(dictionaries[lang]) ?? find(dictionaries.en) ?? key;
}

// translate('de', 'customers.branches', { count: 2 }) -> "2 Filialen"
export function translate(lang, key, vars) {
  let text = lookup(lang, key);
  if (typeof text !== 'string') return key;
  if (vars) text = text.replace(/\{(\w+)\}/g, (match, name) => (vars[name] ?? match));
  return text;
}

function storedLang() {
  try {
    const lang = localStorage.getItem(STORAGE_KEY);
    return dictionaries[lang] ? lang : null;
  } catch {
    return null;
  }
}

const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(() => storedLang() || 'de');

  const setLang = useCallback((next) => {
    if (!dictionaries[next]) return;
    setLangState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private mode or storage blocked: the choice just won't be remembered.
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const value = useMemo(() => {
    const t = (key, vars) => translate(lang, key, vars);
    return {
      lang,
      setLang,
      t,
      // Translate an API error code, falling back to a generic message.
      te: (code) => (lookup(lang, `errors.${code}`) !== `errors.${code}` ? t(`errors.${code}`) : t('errors.server_error')),
      formatDate: (iso, withTime = true) =>
        iso
          ? new Date(iso).toLocaleString(LOCALES[lang], withTime ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' })
          : '',
    };
  }, [lang, setLang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export const useI18n = () => useContext(I18nContext);
