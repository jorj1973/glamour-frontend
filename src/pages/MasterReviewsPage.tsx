import { useEffect, useState } from 'react';
import { Send } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../api/api';
import { getErrorKey } from '../api/errorMessage';
import AppLayout from '../components/AppLayout';
import StarRating from '../components/StarRating';
import RatingSummary from '../components/RatingSummary';
import AppReviewForm from '../components/AppReviewForm';
import SalonStaffReviewForm from '../components/SalonStaffReviewForm';

type ReviewItem = {
  id: string;
  salonId: string;
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

/** Отзывы о мастере — свои, во всех салонах, с возможностью ответить. */
function MasterReviewsPage() {
  const { t } = useTranslation();

  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const [openReplyId, setOpenReplyId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setIsLoading(true);
    setErrorMsg('');

    try {
      const res = await api.get<ReviewItem[]>('/reviews/mine-as-master');
      setReviews(res.data);
    } catch (error) {
      setErrorMsg(t(getErrorKey(error)));
    } finally {
      setIsLoading(false);
    }
  }

  function openReply(review: ReviewItem) {
    setOpenReplyId(review.id);
    setReplyText(review.masterReply ?? '');
  }

  async function submitReply(review: ReviewItem) {
    setIsSaving(true);
    setErrorMsg('');

    try {
      await api.patch(
        `/reviews/${review.id}/reply`,
        { masterReply: replyText },
        { params: { salonId: review.salonId } },
      );

      setOpenReplyId(null);
      await load();
    } catch (error) {
      setErrorMsg(t(getErrorKey(error)));
    } finally {
      setIsSaving(false);
    }
  }

  function formatDate(value: string) {
    return new Date(value).toLocaleDateString(undefined, {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  }

  const averageRating =
    reviews.length > 0
      ? (
          reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
        ).toFixed(1)
      : null;

  if (isLoading) {
    return (
      <AppLayout>
        <main className="dashboard-page">
          <p className="dashboard-status">{t('common.loading')}</p>
        </main>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <main className="dashboard-page">
        <header className="dashboard-header">
          <div>
            <h1>{t('nav.reviews')}</h1>
            <p className="dashboard-subtitle">{t('reviews.masterSubtitle')}</p>
          </div>

          {averageRating && (
            <div className="dashboard-period">
              <span>{t('reviews.averageRating')}</span>
              <strong>{averageRating} ★</strong>
            </div>
          )}
        </header>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 20 }}>
          {reviews.length > 0 && (
            <RatingSummary ratings={reviews.map((review) => review.rating)} />
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
                color: 'var(--app-danger-soft)',
              }}
            >
              {errorMsg}
            </div>
          )}

          {reviews.length === 0 ? (
            <p className="dashboard-status">{t('reviews.masterEmpty')}</p>
          ) : (
            reviews.map((review) => (
              <div key={review.id} style={cardStyle}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <StarRating value={review.rating} />

                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: 'var(--app-text-muted)', fontSize: 12 }}>
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
                      {t(review.isPublic ? 'reviews.statusPublished' : 'reviews.statusPending')}
                    </span>
                  </span>
                </div>

                {review.comment && (
                  <p style={{ color: 'var(--app-text)', fontSize: 13, marginTop: 8, lineHeight: 1.5 }}>
                    {review.comment}
                  </p>
                )}

                {review.masterReply && openReplyId !== review.id && (
                  <div
                    style={{
                      marginTop: 10,
                      padding: '10px 12px',
                      borderRadius: 11,
                      background: 'rgba(var(--app-accent-rgb), 0.06)',
                    }}
                  >
                    <p style={{ color: 'var(--app-accent-text)', fontSize: 11, fontWeight: 800, marginBottom: 4 }}>
                      {t('reviews.masterReplyLabel')}
                    </p>
                    <p style={{ color: 'var(--app-text)', fontSize: 13, lineHeight: 1.5 }}>
                      {review.masterReply}
                    </p>
                  </div>
                )}

                {openReplyId === review.id ? (
                  <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      rows={3}
                      placeholder={t('reviews.replyPlaceholder')}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 12,
                        border: '1px solid var(--app-border)',
                        background: 'var(--app-input)',
                        color: 'var(--app-text)',
                        fontSize: 13,
                        resize: 'vertical',
                      }}
                    />

                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        disabled={isSaving || !replyText.trim()}
                        onClick={() => void submitReply(review)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          minHeight: 38,
                          padding: '0 14px',
                          border: 0,
                          borderRadius: 11,
                          background: 'var(--app-accent)',
                          color: '#17151c',
                          fontSize: 13,
                          fontWeight: 700,
                          cursor: 'pointer',
                          opacity: isSaving ? 0.7 : 1,
                        }}
                      >
                        <Send size={14} />
                        {t('reviews.submit')}
                      </button>

                      <button
                        type="button"
                        onClick={() => setOpenReplyId(null)}
                        style={{
                          minHeight: 38,
                          padding: '0 14px',
                          border: '1px solid var(--app-border)',
                          borderRadius: 11,
                          background: 'transparent',
                          color: 'var(--app-text-muted)',
                          fontSize: 13,
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {t('common.cancel')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => openReply(review)}
                    style={{
                      marginTop: 12,
                      minHeight: 36,
                      padding: '0 14px',
                      border: '1px solid rgba(var(--app-accent-rgb), 0.3)',
                      borderRadius: 11,
                      background: 'rgba(var(--app-accent-rgb), 0.08)',
                      color: 'var(--app-accent-text)',
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {review.masterReply ? t('reviews.editReply') : t('reviews.reply')}
                  </button>
                )}
              </div>
            ))
          )}

          <SalonStaffReviewForm />

          <AppReviewForm />
        </div>
      </main>
    </AppLayout>
  );
}

export default MasterReviewsPage;
