import { useEffect, useState } from 'react';
import { Check, EyeOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../api/api';
import { getErrorKey } from '../api/errorMessage';
import AppLayout from '../components/AppLayout';
import StarRating from '../components/StarRating';
import RatingSummary from '../components/RatingSummary';
import AppReviewForm from '../components/AppReviewForm';

type SalonSummary = { id: string; name: string };

type ReviewItem = {
  id: string;
  masterProfileId: string;
  rating: number;
  comment: string | null;
  masterReply: string | null;
  isPublic: boolean;
  createdAt: string;
};

const cardStyle: React.CSSProperties = {
  padding: 16,
  borderRadius: 16,
  border: '1px solid rgba(var(--app-overlay-rgb), 0.09)',
  background: 'rgba(var(--app-overlay-rgb), 0.04)',
};

/** Модерация отзывов владельцем: одобрить или скрыть. */
function SalonReviewsPage() {
  const { t } = useTranslation();

  const [salonId, setSalonId] = useState('');
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setIsLoading(true);
    setErrorMsg('');

    try {
      const salonsRes = await api.get<SalonSummary[]>('/salons/my');
      const salon = salonsRes.data[0];

      if (!salon) {
        setReviews([]);
        return;
      }

      setSalonId(salon.id);

      const reviewsRes = await api.get<ReviewItem[]>('/reviews/manage', {
        params: { salonId: salon.id },
      });

      setReviews(reviewsRes.data);
    } catch (error) {
      setErrorMsg(t(getErrorKey(error)));
    } finally {
      setIsLoading(false);
    }
  }

  async function moderate(reviewId: string, isPublic: boolean) {
    setBusyId(reviewId);
    setErrorMsg('');

    try {
      await api.patch(
        `/reviews/${reviewId}/moderate`,
        { isPublic },
        { params: { salonId } },
      );

      await load();
    } catch (error) {
      setErrorMsg(t(getErrorKey(error)));
    } finally {
      setBusyId(null);
    }
  }

  function formatDate(value: string) {
    return new Date(value).toLocaleDateString(undefined, {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  }

  if (isLoading) {
    return (
      <AppLayout>
        <main className="dashboard-page">
          <p className="dashboard-status">{t('common.loading')}</p>
        </main>
      </AppLayout>
    );
  }

  const pending = reviews.filter((r) => !r.isPublic);
  const published = reviews.filter((r) => r.isPublic);

  function renderReview(review: ReviewItem) {
    return (
      <div key={review.id} style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <StarRating value={review.rating} />

          <span style={{ color: 'var(--app-text-muted)', fontSize: 12 }}>
            {formatDate(review.createdAt)}
          </span>
        </div>

        {review.comment && (
          <p style={{ color: 'var(--app-text)', fontSize: 13, marginTop: 8, lineHeight: 1.5 }}>
            {review.comment}
          </p>
        )}

        {review.masterReply && (
          <div
            style={{
              marginTop: 10,
              padding: '10px 12px',
              borderRadius: 11,
              background: 'rgba(var(--app-accent-rgb), 0.06)',
            }}
          >
            <p style={{ color: 'var(--app-accent)', fontSize: 11, fontWeight: 800, marginBottom: 4 }}>
              {t('reviews.masterReplyLabel')}
            </p>
            <p style={{ color: 'var(--app-text)', fontSize: 13, lineHeight: 1.5 }}>
              {review.masterReply}
            </p>
          </div>
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
              {t('reviews.approve')}
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
                border: '1px solid var(--app-border)',
                borderRadius: 11,
                background: 'transparent',
                color: 'var(--app-text-muted)',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                opacity: busyId === review.id ? 0.7 : 1,
              }}
            >
              <EyeOff size={14} />
              {t('reviews.hide')}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <AppLayout>
      <main className="dashboard-page">
      <header className="dashboard-header">
        <div>
          <h1>{t('nav.reviews')}</h1>
          <p className="dashboard-subtitle">{t('reviews.salonSubtitle')}</p>
        </div>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 20 }}>

      {published.length > 0 && (
        <RatingSummary ratings={published.map((review) => review.rating)} />
      )}

      {errorMsg && (
        <div
          style={{
            padding: '11px 15px',
            borderRadius: 13,
            fontSize: 13,
            fontWeight: 700,
            border: '1px solid rgba(255,96,128,0.25)',
            background: 'rgba(255,96,128,0.1)',
            color: 'var(--app-accent-warm)',
          }}
        >
          {errorMsg}
        </div>
      )}

      {reviews.length === 0 ? (
        <p className="dashboard-status">{t('reviews.salonEmpty')}</p>
      ) : (
        <>
          {pending.length > 0 && (
            <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p
                style={{
                  color: '#f0b45e',
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: '0.14em',
                }}
              >
                {t('reviews.pending').toUpperCase()} ({pending.length})
              </p>

              {pending.map(renderReview)}
            </section>
          )}

          {published.length > 0 && (
            <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p
                style={{
                  color: 'var(--app-accent-muted)',
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: '0.14em',
                }}
              >
                {t('reviews.published').toUpperCase()} ({published.length})
              </p>

              {published.map(renderReview)}
            </section>
          )}
        </>
      )}

      <AppReviewForm />
      </div>
      </main>
    </AppLayout>
  );
}

export default SalonReviewsPage;
