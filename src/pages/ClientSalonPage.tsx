import { useEffect, useState } from 'react';
import { Clock, Link2, Mail, MapPin, Navigation, Phone } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../api/api';
import { getErrorKey } from '../api/errorMessage';
import RatingSummary from '../components/RatingSummary';

type SalonInfo = {
  id: string;
  name: string;
  description: string | null;
  country: string | null;
  city: string | null;
  address: string | null;
  addressNote: string | null;
  googleMapsUrl: string | null;
  phone: string | null;
  email: string | null;
  instagramUrl: string | null;
  workingHours: Record<string, { from: string; to: string } | null> | null;
};

type ClientLink = { salonId: string; masterName: string };

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

/**
 * Салоны, в которых обслуживается клиент.
 *
 * Клиент не привязан к салону — он может ходить в разные,
 * поэтому показываем все, где у него были записи.
 */
function ClientSalonPage() {
  const { t } = useTranslation();

  const [salons, setSalons] = useState<SalonInfo[]>([]);
  /** Оценки по каждому салону — для сводного рейтинга с разбивкой. */
  const [salonRatings, setSalonRatings] = useState<Record<string, number[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => { void load(); }, []);

  async function load() {
    setIsLoading(true);

    try {
      const links = await api.get<ClientLink[]>('/promotion-links/my-client-links');
      const ids = [...new Set(links.data.map((l) => l.salonId))];

      const loaded: SalonInfo[] = [];
      const ratings: Record<string, number[]> = {};

      for (const id of ids) {
        try {
          const res = await api.get<SalonInfo>(`/public/salons/${id}`);
          loaded.push(res.data);
        } catch {
          // Салон мог быть удалён — пропускаем.
        }

        try {
          const reviewsRes = await api.get<{ rating: number }[]>('/reviews', {
            params: { salonId: id },
          });

          if (reviewsRes.data.length > 0) {
            ratings[id] = reviewsRes.data.map((review) => review.rating);
          }
        } catch {
          // Отзывов может не быть — не критично.
        }
      }

      setSalons(loaded);
      setSalonRatings(ratings);
    } catch (error) {
      setErrorMsg(t(getErrorKey(error)));
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading) {
    return <p style={{ color: 'var(--app-text-muted, var(--app-text-muted))', fontSize: 14 }}>{t('common.loading')}</p>;
  }

  const rowStyle = {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    color: 'var(--app-text-muted, var(--app-text-muted))',
    fontSize: 13,
    lineHeight: 1.5,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {errorMsg && (
        <div style={{ padding: '11px 15px', borderRadius: 13, fontSize: 13, fontWeight: 700, border: '1px solid rgba(255,96,128,0.25)', background: 'rgba(255,96,128,0.1)', color: 'var(--app-danger-soft)' }}>
          {errorMsg}
        </div>
      )}

      {salons.length === 0 ? (
        <p style={{ color: 'var(--app-text-muted, var(--app-text-dim5))', fontSize: 14, lineHeight: 1.6 }}>
          {t('clientSalon.empty')}
        </p>
      ) : (
        salons.map((salon) => {
          const fullAddress = [salon.city, salon.address]
            .filter(Boolean)
            .join(', ');

          // Для карт берём максимум данных, включая страну —
          // клиенту она не показывается, но так навигатор точнее.
          const mapQuery = [salon.address, salon.city, salon.country]
            .filter(Boolean)
            .join(', ');

          // Если владелец указал свою точную ссылку — используем её:
          // текстовый адрес не всегда даёт верную точку на карте.
          const googleMapsUrl = salon.googleMapsUrl
            ? salon.googleMapsUrl
            : mapQuery
              ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`
              : null;

          const wazeUrl = mapQuery
            ? `https://waze.com/ul?q=${encodeURIComponent(mapQuery)}&navigate=yes`
            : null;

          return (
            <article
              key={salon.id}
              style={{
                padding: 18,
                borderRadius: 18,
                border: '1px solid rgba(var(--app-overlay-rgb), 0.09)',
                background: 'rgba(var(--app-overlay-rgb), 0.04)',
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
              }}
            >
              <div>
                <strong style={{ color: 'var(--app-text, var(--app-text))', fontSize: 18 }}>
                  {salon.name}
                </strong>

                {salon.description && (
                  <p style={{ color: 'var(--app-text-muted, var(--app-text-muted))', fontSize: 13, marginTop: 6, lineHeight: 1.6 }}>
                    {salon.description}
                  </p>
                )}

                {salonRatings[salon.id] && (
                  <div style={{ marginTop: 12 }}>
                    <RatingSummary ratings={salonRatings[salon.id]} />
                  </div>
                )}
              </div>

              {fullAddress && (
                <div style={rowStyle}>
                  <MapPin size={15} color="var(--app-accent)" style={{ flexShrink: 0, marginTop: 2 }} />
                  <span>
                    {fullAddress}
                    {salon.addressNote && (
                      <span style={{ display: 'block', color: 'var(--app-text-muted, var(--app-text-dim5))', fontSize: 12, marginTop: 2 }}>
                        {salon.addressNote}
                      </span>
                    )}
                  </span>
                </div>
              )}

              {(googleMapsUrl || wazeUrl) && (
                <div style={{ display: 'flex', gap: 8, paddingLeft: 25, flexWrap: 'wrap' }}>
                  {googleMapsUrl && (
                    <a
                      href={googleMapsUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '7px 13px',
                        borderRadius: 999,
                        border: '1px solid rgba(var(--app-overlay-rgb), 0.16)',
                        background: 'rgba(var(--app-overlay-rgb), 0.06)',
                        color: 'var(--app-accent-text)',
                        fontSize: 12,
                        fontWeight: 700,
                        textDecoration: 'none',
                      }}
                    >
                      <Navigation size={13} />
                      Google Maps
                    </a>
                  )}

                  {wazeUrl && (
                    <a
                      href={wazeUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '7px 13px',
                        borderRadius: 999,
                        border: '1px solid rgba(var(--app-overlay-rgb), 0.16)',
                        background: 'rgba(var(--app-overlay-rgb), 0.06)',
                        color: 'var(--app-accent-text)',
                        fontSize: 12,
                        fontWeight: 700,
                        textDecoration: 'none',
                      }}
                    >
                      <Navigation size={13} />
                      Waze
                    </a>
                  )}
                </div>
              )}

              {salon.phone && (
                <a href={`tel:${salon.phone}`} style={{ ...rowStyle, textDecoration: 'none' }}>
                  <Phone size={15} color="var(--app-accent)" style={{ flexShrink: 0 }} />
                  <span>{salon.phone}</span>
                </a>
              )}

              {salon.email && (
                <a href={`mailto:${salon.email}`} style={{ ...rowStyle, textDecoration: 'none' }}>
                  <Mail size={15} color="var(--app-accent)" style={{ flexShrink: 0 }} />
                  <span>{salon.email}</span>
                </a>
              )}

              {salon.instagramUrl && (
                <a href={salon.instagramUrl} target="_blank" rel="noreferrer"
                  style={{ ...rowStyle, textDecoration: 'none' }}>
                  <Link2 size={15} color="var(--app-accent)" style={{ flexShrink: 0 }} />
                  <span>Instagram</span>
                </a>
              )}

              {salon.workingHours && (
                <div>
                  <div style={{ ...rowStyle, marginBottom: 8 }}>
                    <Clock size={15} color="var(--app-accent)" style={{ flexShrink: 0 }} />
                    <strong style={{ color: 'var(--app-text, var(--app-text))', fontSize: 13 }}>
                      {t('salonInfo.hours')}
                    </strong>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingLeft: 25 }}>
                    {DAYS.map((day) => {
                      const value = salon.workingHours?.[day];

                      return (
                        <div key={day} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12 }}>
                          <span style={{ color: 'var(--app-text-muted, var(--app-text-muted))' }}>
                            {t('salonInfo.day.' + day)}
                          </span>
                          <span style={{ color: value ? 'var(--app-text, var(--app-text))' : 'var(--app-text-muted, var(--app-text-dim5))' }}>
                            {value ? `${value.from} — ${value.to}` : t('salonInfo.closed')}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </article>
          );
        })
      )}
    </div>
  );
}

export default ClientSalonPage;
