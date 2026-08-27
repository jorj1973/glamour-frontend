import { useTranslation } from 'react-i18next';

import { headerPill, headerSegment } from './headerControls';

const LANGUAGES = [
  { code: 'ru', label: 'RU' },
  { code: 'ro', label: 'RO' },
  { code: 'en', label: 'EN' },
];

/**
 * Выбор языка.
 *
 * Размеры и оформление берём из общего описания шапки: раньше они
 * стояли здесь своими числами и разъезжались с соседями. Заодно ушли
 * жёстко прописанные белые полупрозрачные цвета — на светлой теме
 * коробка из них была белым по белому и попросту не появлялась.
 */
function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const current = i18n.language?.slice(0, 2) ?? 'ru';

  function changeLanguage(code: string) {
    void i18n.changeLanguage(code);
    localStorage.setItem('glamour_language', code);
  }

  return (
    <div style={{ ...headerPill, alignSelf: 'flex-start' }}>
      {LANGUAGES.map((lang) => (
        <button
          key={lang.code}
          type="button"
          onClick={() => changeLanguage(lang.code)}
          style={headerSegment(current === lang.code)}
        >
          {lang.label}
        </button>
      ))}
    </div>
  );
}

export default LanguageSwitcher;
