import { useEffect, useState } from 'react';
import { Building2, Check, EyeOff } from 'lucide-react';
import api from '../../api/api';
import StarRating from '../StarRating';

type StaffReviewItem = {
  id: string;
  salonId: string;
  authorUserId: string;
  rating: number;
  comment: string | null;
  isPublic: boolean;
  createdAt: string;
};

type SalonSummary = { id: string; name: string };

/**
 * Модерация отзывов мастеров о салонах.
 *
 * Здесь решает владелец платформы, а не владелец салона: салон не должен
 * прятать критику о себе, иначе такие отзывы бесполезны для мастеров,
 * которые выбирают место работы.
 */
function SalonStaffReviewsModeration() {
  const [reviews, setReviews] = useState<StaffReviewItem[]>([]);
  const [salonNames, setSalonNames] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setIsLoading(true);

    try {
      const res = await api.get<StaffReviewItem[]>('/salon-staff-reviews/manage');
      setReviews(res.data);

      try {
        const salonsRes = await api.get<SalonSummary[]>('/platform-admin/salons');
        const names: Record<string, string> = {};

        for (const salon of salonsRes.data) {
          names[salon.id] = salon.name;
        }

        setSalonNames(names);
      } catch {
        setSalonNames({});
      }
    } catch {
      setReviews([]);
    } finally {
      setIsLoading(false);
    }
  }

  async function moderate(id: string, isPublic: boolean) {
    setBusyId(id);

    try {
      await api.patch(`/salon-staff-reviews/${id}/moderate`, { isPublic });
      await load();
    } finally {
      setBusyId(null);
    }
  }

  function formatDate(value: string) {
    return new Date(value).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  }

  if (isLoading) {
    return null;
  }

  const pending = reviews.filter((r) => !r.isPublic);
  const published = reviews.filter((r) => r.isPublic);

  return (
    <section className="platform-salons-panel">
      <div className="platform-panel-heading">
        <div>
          <p className="panel-kicker">ОТЗЫВЫ МАСТЕРОВ О САЛОНАХ</p>
          <h2>
            <Building2
              size={18}
              aria-hidden="true"
              style={{ verticalAlign: 'middle', marginRight: 8 }}
            />
            Салон как место работы
          </h2>
          <p>На модерации: {pending.length} · опубликовано: {published.length}</p>
        </div>
      </div>

      {reviews.length === 0 ? (
        <p style={{ color: 'var(--pf-text-muted, rgba(255,255,255,0.6))', padding: '12px 0' }}>
          Мастера пока не оставляли отзывов о салонах.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
          {[...pending, ...published].map((review) => (
            <div
              key={review.id}
              style={{
                padding: 16,
                borderRadius: 16,
                border: '1px solid var(--pf-border, rgba(255,255,255,0.1))',
                background: 'var(--pf-panel, rgba(255,255,255,0.04))',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <StarRating value={review.rating} />

                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: 'var(--pf-text-muted, rgba(255,255,255,0.6))', fontSize: 12 }}>
                    {formatDate(review.createdAt)}
                  </span>

                  <span
                    style={{
                      padding: '3px 10px',
                      borderRadius: 999,
                      fontSize: 11,
                      fontWeight: 700,
                      color: review.isPublic ? '#4dd08b' : '#f0b45e',
                      border: `1px solid ${review.isPublic ? '#4dd08b' : '#f0b45e'}40`,
                    }}
                  >
                    {review.isPublic ? 'Опубликован' : 'На проверке'}
                  </span>
                </span>
              </div>

              {salonNames[review.salonId] && (
                <p style={{ color: 'var(--pf-accent, #d17fb0)', fontSize: 12, fontWeight: 700, marginTop: 6 }}>
                  {salonNames[review.salonId]}
                </p>
              )}

              {review.comment && (
                <p style={{ color: 'var(--pf-text, #fff)', fontSize: 13, marginTop: 8, lineHeight: 1.5 }}>
                  {review.comment}
                </p>
              )}

              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                {!review.isPublic ? (
                  <button
                    type="button"
                    disabled={busyId === review.id}
                    onClick={() => void moderate(review.id, true)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      minHeight: 38,
                      padding: '0 14px',
                      border: 0,
                      borderRadius: 11,
                      background: '#4dd08b',
                      color: '#17151c',
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: 'pointer',
                      opacity: busyId === review.id ? 0.7 : 1,
                    }}
                  >
                    <Check size={14} />
                    Опубликовать
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={busyId === review.id}
                    onClick={() => void moderate(review.id, false)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      minHeight: 38,
                      padding: '0 14px',
                      border: '1px solid var(--pf-border, rgba(255,255,255,0.15))',
                      borderRadius: 11,
                      background: 'transparent',
                      color: 'var(--pf-text-muted, rgba(255,255,255,0.6))',
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: 'pointer',
                      opacity: busyId === review.id ? 0.7 : 1,
                    }}
                  >
                    <EyeOff size={14} />
                    Скрыть
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default SalonStaffReviewsModeration;
