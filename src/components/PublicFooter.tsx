import { useTranslation } from 'react-i18next';

import { COMPANY } from '../legal/company';
import { legalLinks } from '../legal/texts';

/**
 * Подвал публичных страниц.
 *
 * Три ссылки и год. Оферта и политика данных должны быть видны там, где
 * человек соглашается: на странице по ссылке и в регистрации. Спрятать
 * их в кабинете значит показать после того, как согласились.
 *
 * Ссылки обычные, хешем: приложение слушает `hashchange` и само
 * переключает страницу, а человек может открыть их в новой вкладке —
 * что с оферты и делают.
 */
function PublicFooter() {
  const { i18n } = useTranslation();

  const lang = i18n.language?.slice(0, 2) || 'ro';
  const links = legalLinks(lang);

  const items = [
    { hash: '#terms', label: links.terms },
    { hash: '#privacy', label: links.privacy },
    { hash: '#contacts', label: links.contacts },
  ];

  return (
    <footer
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '10px 18px',
        margin: '46px auto 0',
        padding: '18px 0 0',
        borderTop: '1px solid var(--app-border)',
        color: 'var(--app-text-muted)',
        fontSize: 13,
      }}
    >
      {items.map((item) => (
        <a
          key={item.hash}
          href={item.hash}
          style={{
            color: 'var(--app-text-muted)',
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          {item.label}
        </a>
      ))}

      <span>
        © {new Date().getFullYear()} {COMPANY.brand}
      </span>
    </footer>
  );
}

export default PublicFooter;
