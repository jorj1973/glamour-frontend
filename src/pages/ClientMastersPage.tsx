import { useEffect, useState } from 'react';
import { ChevronRight, UserRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../api/api';
import { getErrorKey } from '../api/errorMessage';

type SalonMaster = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  photoUrl: string | null;
  profession: string | null;
  specialization: string | null;
};

type ClientMaster = {
  masterProfileId: string;
  salonId: string;
  masterName: string;
  masterPhotoUrl: string | null;
};

/**
 * Мастера, у которых клиент уже был.
 *
 * Берём из того же источника, что и реферальные ссылки:
 * там уже собраны все мастера клиента с именами и фото.
 */
function ClientMastersPage() {
  const { t } = useTranslation();

  const [masters, setMasters] = useState<ClientMaster[]>([]);

  /**
   * Остальные мастера салона: клиент видит, к кому ещё можно
   * записаться, а не только тех, у кого уже был.
   */
  const [others, setOthers] = useState<SalonMaster[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => { void load(); }, []);

  async function load() {
    setIsLoading(true);

    try {
      const res = await api.get<ClientMaster[]>('/promotion-links/my-client-links');
      setMasters(res.data);

      const mineIds = new Set(res.data.map((m) => m.masterProfileId));
      const salonIds = [...new Set(res.data.map((m) => m.salonId))];

      const rest: SalonMaster[] = [];

      for (const salonId of salonIds) {
        try {
          const listRes = await api.get<SalonMaster[]>(
            `/public/masters/by-salon/${salonId}`,
          );

          for (const item of listRes.data) {
            if (!mineIds.has(item.id)) {
              rest.push(item);
            }
          }
        } catch {
          // Салон мог быть недоступен — пропускаем.
        }
      }

      setOthers(rest);
    } catch (error) {
      setErrorMsg(t(getErrorKey(error)));
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading) {
    return <p style={{ color: 'var(--app-text-muted, var(--app-text-muted))', fontSize: 14 }}>{t('common.loading')}</p>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {errorMsg && (
        <div style={{ padding: '11px 15px', borderRadius: 13, fontSize: 13, fontWeight: 700, border: '1px solid rgba(255,96,128,0.25)', background: 'rgba(255,96,128,0.1)', color: 'var(--app-accent-warm)' }}>
          {errorMsg}
        </div>
      )}

      {masters.length === 0 ? (
        <p style={{ color: 'var(--app-text-muted, var(--app-text-dim5))', fontSize: 14, lineHeight: 1.6 }}>
          {t('clientMasters.empty')}
        </p>
      ) : (
        masters.map((master) => (
          <a
            key={master.masterProfileId}
            href={`#master/${master.masterProfileId}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: 14,
              borderRadius: 16,
              border: '1px solid rgba(var(--app-overlay-rgb), 0.09)',
              background: 'rgba(var(--app-overlay-rgb), 0.04)',
              color: 'var(--app-text, var(--app-text))',
              textDecoration: 'none',
              minHeight: 44,
            }}
          >
            {master.masterPhotoUrl ? (
              <img
                src={master.masterPhotoUrl}
                alt={master.masterName}
                style={{ width: 46, height: 46, borderRadius: 15, objectFit: 'cover', flexShrink: 0 }}
              />
            ) : (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 46,
                  height: 46,
                  borderRadius: 15,
                  background: 'rgba(var(--app-accent-rgb), 0.14)',
                  flexShrink: 0,
                }}
              >
                <UserRound size={22} color="var(--app-accent)" />
              </span>
            )}

            <div style={{ flex: 1, minWidth: 0 }}>
              <strong style={{ fontSize: 15 }}>{master.masterName}</strong>
              <p style={{ color: 'var(--app-text-muted, var(--app-text-muted))', fontSize: 12, marginTop: 2 }}>
                {t('clientMasters.viewProfile')}
              </p>
            </div>

            <ChevronRight size={18} color="var(--app-text-dim5)" />
          </a>
        ))
      )}

      {/* Остальные мастера салона: клиент может попробовать нового,
          например когда его мастер занят или нужна другая услуга. */}
      {others.length > 0 && (
        <>
          <p style={{ color: 'var(--app-text-muted, var(--app-text-dim5))', fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', marginTop: 10 }}>
            {t('clientMasters.othersTitle').toUpperCase()}
          </p>

          {others.map((master) => (
            <a
              key={master.id}
              href={`#master/${master.id}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: 14,
                borderRadius: 16,
                border: '1px solid rgba(var(--app-overlay-rgb), 0.06)',
                background: 'transparent',
                color: 'var(--app-text, var(--app-text))',
                textDecoration: 'none',
                minHeight: 44,
              }}
            >
              {master.photoUrl ? (
                <img
                  src={master.photoUrl}
                  alt={`${master.firstName ?? ''} ${master.lastName ?? ''}`}
                  style={{ width: 46, height: 46, borderRadius: 15, objectFit: 'cover', flexShrink: 0 }}
                />
              ) : (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 46,
                    height: 46,
                    borderRadius: 15,
                    background: 'rgba(var(--app-overlay-rgb), 0.05)',
                    flexShrink: 0,
                  }}
                >
                  <UserRound size={22} color="var(--app-text-dim5)" />
                </span>
              )}

              <div style={{ flex: 1, minWidth: 0 }}>
                <strong style={{ fontSize: 15 }}>
                  {[master.firstName, master.lastName].filter(Boolean).join(' ')}
                </strong>
                <p style={{ color: 'var(--app-text-muted, var(--app-text-muted))', fontSize: 12, marginTop: 2 }}>
                  {master.profession || t('clientMasters.viewProfile')}
                </p>
              </div>

              <ChevronRight size={18} color="var(--app-text-dim5)" />
            </a>
          ))}
        </>
      )}
    </div>
  );
}

export default ClientMastersPage;
