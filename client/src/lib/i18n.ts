import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import deCommon from '../locales/de/common.json';
import enCommon from '../locales/en/common.json';

export const defaultNS = 'common';
export const resources = {
  de: {
    common: deCommon,
  },
  en: {
    common: enCommon,
  },
} as const;

i18next
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    lng: undefined, // let language detector decide
    fallbackLng: 'de',
    debug: import.meta.env.DEV,
    resources,
    defaultNS,
    interpolation: {
      escapeValue: false, // not needed for react as it escapes by default
    },
  });

export default i18next;
