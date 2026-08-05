import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import ru from './ru.json';
import ro from './ro.json';
import en from './en.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { ru: { translation: ru }, ro: { translation: ro }, en: { translation: en } },
    fallbackLng: 'ru',
    supportedLngs: ['ru', 'ro', 'en'],
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'glamour_language',
      caches: ['localStorage'],
    },
  });

export default i18n;
