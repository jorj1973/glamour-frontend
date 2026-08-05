import { useTranslation } from 'react-i18next';

const LANGUAGES = [
  { code: 'ru', label: 'RU' },
  { code: 'ro', label: 'RO' },
  { code: 'en', label: 'EN' },
];

function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const current = i18n.language?.slice(0, 2) ?? 'ru';

  function changeLanguage(code: string) {
    void i18n.changeLanguage(code);
    localStorage.setItem('glamour_language', code);
  }

  return (
    <div style={{
      display: 'flex',
      gap: 4,
      padding: '6px 8px',
      borderRadius: 12,
      background: 'rgba(255,255,255,0.05)',
      border: '1px solid rgba(255,255,255,0.08)',
    }}>
      {LANGUAGES.map((lang) => (
        <button
          key={lang.code}
          type="button"
          onClick={() => changeLanguage(lang.code)}
          style={{
            padding: '4px 8px',
            borderRadius: 8,
            border: 'none',
            background: current === lang.code ? '#d682b8' : 'transparent',
            color: current === lang.code ? '#17151c' : '#9d949f',
            fontSize: 11,
            fontWeight: 700,
            cursor: 'pointer',
            letterSpacing: '0.05em',
            transition: 'all 0.2s',
          }}
        >
          {lang.label}
        </button>
      ))}
    </div>
  );
}

export default LanguageSwitcher;
