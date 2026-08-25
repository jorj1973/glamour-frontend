import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import MasterPublicCard from '../components/MasterPublicCard';
import LanguageSwitcher from '../components/LanguageSwitcher';

/**
 * Постоянная публичная страница мастера: #master/<masterProfileId>
 *
 * Ссылка не меняется, а содержимое обновляется само —
 * мастер добавил сертификат или новые работы в «Обо мне»,
 * и клиент увидит их по той же ссылке.
 */
function PublicMasterPage() {
  const { t } = useTranslation();
  const [masterProfileId, setMasterProfileId] = useState('');

  useEffect(() => {
    function readHash() {
      const hash = window.location.hash;
      const match = hash.match(/^#master\/([0-9a-fA-F-]{36})/);
      setMasterProfileId(match ? match[1] : '');
    }

    readHash();
    window.addEventListener('hashchange', readHash);

    return () => window.removeEventListener('hashchange', readHash);
  }, []);

  return (
    <main
      style={{
        minHeight: '100vh',
        padding: '24px 16px 48px',
        background: 'var(--app-bg)',
      }}
    >
      <div style={{ maxWidth: 620, margin: '0 auto' }}>
        {/* Карточка открывается на весь экран, без бокового меню:
            без этой кнопки из неё некуда уйти. По прямой ссылке
            из поиска возвращаться некуда, поэтому кнопки нет. */}
        {window.history.length > 1 && (
          <button
            type="button"
            onClick={() => window.history.back()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              minHeight: 44,
              marginBottom: 12,
              padding: '0 4px',
              border: 0,
              background: 'transparent',
              color: 'var(--app-text-muted)',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <ArrowLeft size={17} />
            {t('booking.back')}
          </button>
        )}

        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: 24,
          }}
        >
          <p
            style={{
              color: 'var(--app-accent-muted)',
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: '0.18em',
            }}
          >
            GLAMOUR
          </p>

          <LanguageSwitcher />
        </header>

        {masterProfileId ? (
          <>
            <div
              style={{
                padding: 20,
                border: '1px solid rgba(var(--app-overlay-rgb), 0.09)',
                borderRadius: 20,
                background: 'rgba(var(--app-overlay-rgb), 0.04)',
              }}
            >
              <MasterPublicCard masterProfileId={masterProfileId} />
            </div>

          </>
        ) : (
          <p style={{ color: 'var(--app-text-muted, var(--app-text-muted))', fontSize: 14 }}>
            {t('common.loadError')}
          </p>
        )}
      </div>
    </main>
  );
}

export default PublicMasterPage;
