import { useEffect, useState } from 'react';
import { Copy, Gift, UserRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../api/api';
import { getErrorKey } from '../api/errorMessage';

type ClientLink = {
  code: string;
  masterProfileId: string;
  salonId: string;
  masterName: string;
  masterPhotoUrl: string | null;
};

type Balance = {
  points: number;
  valueInCurrency: number;
};

/**
 * Баллы и рекомендации в кабинете клиента.
 *
 * Баллы принадлежат конкретному мастеру: он работает в нескольких
 * салонах, и клиентская база следует за ним. Поэтому у клиента
 * отдельный счёт и отдельная ссылка на каждого мастера.
 */
function ClientLoyaltyPage() {
  const { t } = useTranslation();

  const [links, setLinks] = useState<ClientLink[]>([]);
  const [balances, setBalances] = useState<Record<string, Balance>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [copiedCode, setCopiedCode] = useState('');

  useEffect(() => { void load(); }, []);

  async function load() {
    setIsLoading(true);

    try {
      const res = await api.get<ClientLink[]>('/promotion-links/my-client-links');
      setLinks(res.data);

      const map: Record<string, Balance> = {};

      for (const link of res.data) {
        try {
          const balanceRes = await api.get<Balance>(
            `/loyalty/my-balance/${link.masterProfileId}`,
            { params: { salonId: link.salonId } },
          );
          map[link.masterProfileId] = balanceRes.data;
        } catch {
          map[link.masterProfileId] = { points: 0, valueInCurrency: 0 };
        }
      }

      setBalances(map);
    } catch (error) {
      setErrorMsg(t(getErrorKey(error)));
    } finally {
      setIsLoading(false);
    }
  }

  function buildUrl(code: string) {
    return `${window.location.origin}/#book?identifier=${code}`;
  }

  async function copyLink(code: string) {
    try {
      await navigator.clipboard.writeText(buildUrl(code));
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(''), 2500);
    } catch {
      setErrorMsg(t('errors.unknown'));
    }
  }

  if (isLoading) {
    return <p style={{ color: 'var(--app-text-muted, var(--app-text-muted))', fontSize: 14 }}>{t('common.loading')}</p>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {errorMsg && (
        <div style={{ padding: '11px 15px', borderRadius: 13, fontSize: 13, fontWeight: 700, border: '1px solid rgba(255,96,128,0.25)', background: 'rgba(255,96,128,0.1)', color: 'var(--app-accent-warm)' }}>
          {errorMsg}
        </div>
      )}

      {links.length === 0 ? (
        <p style={{ color: 'var(--app-text-muted, var(--app-text-dim5))', fontSize: 14, lineHeight: 1.6 }}>
          {t('clientLoyalty.empty')}
        </p>
      ) : (
        <>
          {links.map((link) => {
            const balance = balances[link.masterProfileId];

            return (
              <article
                key={link.masterProfileId}
                style={{
                  padding: 18,
                  borderRadius: 18,
                  border: '1px solid rgba(var(--app-overlay-rgb), 0.09)',
                  background: 'rgba(var(--app-overlay-rgb), 0.04)',
                }}
              >
                <a
                  href={`#master/${link.masterProfileId}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    marginBottom: 14,
                    color: 'var(--app-text, var(--app-text))',
                    textDecoration: 'none',
                  }}
                >
                  {link.masterPhotoUrl ? (
                    <img
                      src={link.masterPhotoUrl}
                      alt={link.masterName}
                      style={{ width: 42, height: 42, borderRadius: 14, objectFit: 'cover' }}
                    />
                  ) : (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 42,
                        height: 42,
                        borderRadius: 14,
                        background: 'rgba(var(--app-accent-rgb), 0.14)',
                      }}
                    >
                      <UserRound size={20} color="var(--app-accent)" />
                    </span>
                  )}

                  <strong style={{ fontSize: 15 }}>{link.masterName}</strong>
                </a>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: 8,
                    marginBottom: 16,
                  }}
                >
                  <strong style={{ color: 'var(--app-accent-text)', fontSize: 26 }}>
                    {balance?.points ?? 0}
                  </strong>
                  <span style={{ color: 'var(--app-text-muted, var(--app-text-muted))', fontSize: 13 }}>
                    {t('loyalty.pointsLabel')} · {balance?.valueInCurrency ?? 0} MDL
                  </span>
                </div>

                <p style={{ color: 'var(--app-text-muted, var(--app-text-muted))', fontSize: 13, lineHeight: 1.6, marginBottom: 12 }}>
                  {t('clientLoyalty.linkHint', { name: link.masterName })}
                </p>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '10px 12px',
                    borderRadius: 12,
                    border: '1px solid rgba(var(--app-overlay-rgb), 0.1)',
                    background: 'rgba(var(--app-overlay-rgb), 0.05)',
                  }}
                >
                  <span
                    style={{
                      flex: 1,
                      minWidth: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      color: 'var(--app-text-muted, var(--app-text-muted))',
                      fontSize: 12,
                    }}
                  >
                    {buildUrl(link.code)}
                  </span>

                  <button
                    type="button"
                    onClick={() => void copyLink(link.code)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      minHeight: 36,
                      padding: '0 14px',
                      border: 0,
                      borderRadius: 10,
                      background: copiedCode === link.code ? '#4dd08b' : 'var(--app-accent)',
                      color: 'var(--app-bg)',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    <Copy size={13} />
                    {copiedCode === link.code
                      ? t('clientLoyalty.copied')
                      : t('clientLoyalty.copy')}
                  </button>
                </div>
              </article>
            );
          })}

          <p style={{ color: 'var(--app-text-muted, var(--app-text-dim5))', fontSize: 12, lineHeight: 1.6 }}>
            {t('clientLoyalty.separateNote')}
          </p>

          <article
            style={{
              padding: 18,
              borderRadius: 18,
              border: '1px dashed rgba(var(--app-overlay-rgb), 0.14)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Gift size={17} color="var(--app-accent)" />
              <strong style={{ color: 'var(--app-text, var(--app-text))', fontSize: 14 }}>
                {t('clientLoyalty.partnerTitle')}
              </strong>
            </div>

            <p style={{ color: 'var(--app-text-muted, var(--app-text-muted))', fontSize: 13, lineHeight: 1.6 }}>
              {t('clientLoyalty.partnerText')}
            </p>
          </article>
        </>
      )}
    </div>
  );
}

export default ClientLoyaltyPage;
