import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import ru from './ru.json';
import ro from './ro.json';
import en from './en.json';
import uk from './uk.json';
import pl from './pl.json';
import it from './it.json';
import es from './es.json';
import fr from './fr.json';

import { FALLBACK, LANGUAGE_CODES } from './languages';

/**
 * Пять новых словарей пока пустые.
 *
 * Язык подключается раньше, чем переводится: так перевод можно
 * выкатывать разделами, а не одним куском на неделю. Пустой словарь
 * никому не виден — в списке выбора стоят только те языки, у которых
 * в `languages.ts` стоит `ready`.
 *
 * Пустые файлы ничего не весят. Когда они наполнятся, восемь словарей
 * в одной сборке станут заметны на телефоне, и загрузку словаря надо
 * будет сделать по требованию — но это отдельная работа и отдельная
 * проверка, а не довесок к этой.
 */
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      ru: { translation: ru },
      ro: { translation: ro },
      en: { translation: en },
      uk: { translation: uk },
      pl: { translation: pl },
      it: { translation: it },
      es: { translation: es },
      fr: { translation: fr },
    },

    /**
     * Не одна строка, а цепочка: чем подменять непереведённое, зависит
     * от того, кто смотрит. Правило лежит в `languages.ts`.
     */
    fallbackLng: FALLBACK,

    supportedLngs: LANGUAGE_CODES,
    interpolation: {
      escapeValue: false,
    },

    /**
     * Язык берётся только из хранилища браузера, то есть из прошлого
     * выбора человека. Язык самого браузера нарочно не спрашиваем: пока
     * пять словарей пусты, украинец с украинским браузером попал бы на
     * язык без перевода. Вернуться к этому стоит, когда словари
     * заполнятся.
     */
    detection: {
      order: ['localStorage'],
      lookupLocalStorage: 'glamour_language',
      caches: ['localStorage'],
    },
  });

export default i18n;
