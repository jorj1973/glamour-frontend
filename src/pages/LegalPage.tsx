import { ChevronLeft, Mail, MapPin, Phone, Send, Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import LanguageSwitcher from '../components/LanguageSwitcher';
import ThemeSwitcher from '../components/ThemeSwitcher';
import PublicFooter from '../components/PublicFooter';
import { COMPANY, hasCompanyDetails } from '../legal/company';
import { legalDocument, legalUi } from '../legal/texts';
import type { LegalKind } from '../legal/texts';

/**
 * Оферта, политика данных и контакты.
 *
 * Три документа одной страницей: разница между ними — только в тексте,
 * а рамка, шапка и подвал у всех одни. Отдельные страницы для каждого
 * означали бы три места, где потом забудут поправить одно и то же.
 *
 * Живут внутри приложения, а не на отдельном сайте: для человека это
 * один и тот же адрес, а нам не заводить вторую сборку ради трёх
 * текстов. Сайт понадобится для другого — чтобы нас находили в поиске.
 *
 * Реквизиты берутся из `legal/company.ts` и печатаются только те, что
 * заполнены. Пустых строк с выдуманным ИДНО тут не будет.
 */

function kindFromHash(): LegalKind {
  const hash = window.location.hash.split('?')[0];

  if (hash === '#privacy') {
    return 'privacy';
  }

  if (hash === '#contacts') {
    return 'contacts';
  }

  return 'terms';
}

function LegalPage() {
  const { i18n } = useTranslation();

  const lang = i18n.language?.slice(0, 2) || 'ro';

  const kind = kindFromHash();
  const document_ = legalDocument(lang, kind);
  const ui = legalUi(lang);

  const contacts: { icon: ReactNode; value: string; href?: string }[] = [];

  if (COMPANY.email) {
    contacts.push({
      icon: <Mail size={17} aria-hidden="true" />,
      value: COMPANY.email,
      href: 'mailto:' + COMPANY.email,
    });
  }

  if (COMPANY.phone) {
    contacts.push({
      icon: <Phone size={17} aria-hidden="true" />,
      value: COMPANY.phone,
      href: 'tel:' + COMPANY.phone.replace(/[^+\d]/g, ''),
    });
  }

  if (COMPANY.telegram) {
    contacts.push({
      icon: <Send size={17} aria-hidden="true" />,
      value: '@' + COMPANY.telegram,
      href: 'https://t.me/' + COMPANY.telegram,
    });
  }

  if (COMPANY.address) {
    contacts.push({
      icon: <MapPin size={17} aria-hidden="true" />,
      value: COMPANY.address,
    });
  }

  const paragraph = {
    margin: '0 0 12px',
    color: 'var(--pf-text-muted)',
    fontSize: 15,
    lineHeight: 1.7,
  } as const;

  return (
    <main className="registration-page registration-page-salon">
      <section className="registration-shell">
        <header className="registration-header">
          <div className="registration-brand">
            <div className="registration-brand-icon">
              <Sparkles size={24} aria-hidden="true" />
            </div>

            <div>
              <span>GLAMOUR</span>
              <strong>Salon Studio</strong>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              flexWrap: 'wrap',
            }}
          >
            <ThemeSwitcher />

            <LanguageSwitcher />
          </div>
        </header>

        <article
          style={{
            width: 'min(760px, 100%)',
            margin: '0 auto',
            textAlign: 'left',
          }}
        >
          <button
            type="button"
            className="registration-back-button"
            onClick={() => window.history.back()}
          >
            <ChevronLeft size={18} aria-hidden="true" />
            {ui.back}
          </button>

          <h1
            style={{
              margin: '0 0 10px',
              color: 'var(--pf-text)',
              fontSize: 'clamp(28px, 4vw, 40px)',
              letterSpacing: '-0.035em',
              lineHeight: 1.1,
            }}
          >
            {document_.title}
          </h1>

          <p
            style={{
              margin: '0 0 24px',
              color: 'var(--pf-text-muted)',
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}
          >
            {ui.updated}: {document_.updated}
          </p>

          <p style={{ ...paragraph, color: 'var(--pf-text)', fontSize: 16 }}>
            {document_.intro}
          </p>

          {kind === 'contacts' && hasCompanyDetails() ? (
            <section style={{ margin: '26px 0' }}>
              <h2
                style={{
                  margin: '0 0 12px',
                  color: 'var(--pf-text)',
                  fontSize: 19,
                }}
              >
                {ui.details}
              </h2>

              <div style={{ display: 'grid', gap: 10 }}>
                {contacts.map((contact) => (
                  <p
                    key={contact.value}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      margin: 0,
                      color: 'var(--pf-text)',
                      fontSize: 15,
                    }}
                  >
                    <span
                      style={{
                        display: 'inline-flex',
                        color: 'var(--pf-accent-text)',
                      }}
                    >
                      {contact.icon}
                    </span>

                    {contact.href ? (
                      <a
                        href={contact.href}
                        style={{
                          color: 'var(--pf-text)',
                          textDecoration: 'none',
                        }}
                      >
                        {contact.value}
                      </a>
                    ) : (
                      contact.value
                    )}
                  </p>
                ))}

                {COMPANY.legalName ? (
                  <p style={{ ...paragraph, margin: 0 }}>
                    {COMPANY.legalName}
                    {COMPANY.idno ? ', IDNO ' + COMPANY.idno : ''}
                  </p>
                ) : null}
              </div>
            </section>
          ) : null}

          {document_.sections.map((section) => (
            <section key={section.heading} style={{ marginTop: 26 }}>
              <h2
                style={{
                  margin: '0 0 10px',
                  color: 'var(--pf-text)',
                  fontSize: 19,
                  letterSpacing: '-0.015em',
                }}
              >
                {section.heading}
              </h2>

              {section.body.map((line) => (
                <p key={line} style={paragraph}>
                  {line}
                </p>
              ))}
            </section>
          ))}
        </article>

        <PublicFooter />
      </section>
    </main>
  );
}

export default LegalPage;
