import { useEffect, useState } from 'react';
import { Send, Smartphone } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../api/api';
import { getErrorKey } from '../api/errorMessage';
import StarRating from './StarRating';

type AppReviewItem = {
  id: string;
  rating: number;
  comment: string | null;
  isPublic: boolean;
  createdAt: string;
};

const cardStyle: React.CSSProperties = {
  padding: 16,
  borderRadius: 16,
  border: '1px solid rgba(var(--app-overlay-rgb), 0.09)',
  background: 'rgba(var(--app-overlay-rgb), 0.04)',
};

/**
 * Отзыв о самом приложении.
 *
 * Один компонент на все кабинеты: клиент, мастер и владелец салона
 * пишут о GlamourApp одинаково, а бэкенд принимает отзыв от любого
 * авторизованного пользователя. Дублировать форму в трёх страницах
 * значило бы расходиться в тексте и правилах при первой же правке.
 */
function AppReviewForm() {
  const { t } = useTranslation();

  const [myReviews, setMyReviews] = useState<AppReviewItem[]>([]);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [hint, setHint] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    try {
      const res = await api.get<AppReviewItem[]>('/app-reviews/my');
      setMyReviews(res.data);
    } catch {
      setMyReviews([]);
    }
  }

  async function submit() {
    setIsSaving(true);
    setHint('');
    setErrorMsg('');

    try {
      await api.post('/app-reviews', {
        rating,
        comment: comment.trim() || undefined,
      });

      setComment('');
      setRating(5);
      setHint(t('reviews.appReviewSent'));
      await load();
    } catch (error) {
      setErrorMsg(t(getErrorKey(error)));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <p
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          color: 'var(--app-accent-muted)',
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: '0.14em',
        }}
      >
        <Smartphone size={13} />
        {t('reviews.aboutApp').toUpperCase()}
      </p>

      <div style={cardStyle}>
        <p style={{ color: 'var(--app-text-muted)', fontSize: 13, lineHeight: 1.55 }}>
          {t('reviews.aboutAppHint')}
        </p>

        <p
          style={{
            color: 'var(--app-text-muted)',
            fontSize: 13,
            lineHeight: 1.55,
            marginTop: 6,
            marginBottom: 12,
          }}
        >
          {t('reviews.constructiveHint')}
        </p>

        <StarRating value={rating} onChange={setRating} size={22} />

        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          placeholder={t('reviews.commentOptional')}
          style={{
            marginTop: 10,
            width: '100%',
            padding: '10px 12px',
            borderRadius: 12,
            border: '1px solid var(--app-border)',
            background: 'var(--app-input)',
            color: 'var(--app-text)',
            fontSize: 13,
            resize: 'vertical',
          }}
        />

        <button
          type="button"
          disabled={isSaving}
          onClick={() => void submit()}
          style={{
            marginTop: 10,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            minHeight: 40,
            padding: '0 16px',
            border: 0,
            borderRadius: 11,
            background: 'var(--app-accent)',
            color: '#17151c',
            fontSize: 13,
            fontWeight: 700,
            cursor: isSaving ? 'default' : 'pointer',
            opacity: isSaving ? 0.7 : 1,
          }}
        >
          <Send size={14} />
          {t('reviews.submit')}
        </button>

        {hint && (
          <p style={{ color: '#4dd08b', fontSize: 12, fontWeight: 700, marginTop: 8 }}>
            {hint}
          </p>
        )}

        {errorMsg && (
          <p style={{ color: 'var(--app-danger-soft)', fontSize: 12, fontWeight: 700, marginTop: 8 }}>
            {errorMsg}
          </p>
        )}
      </div>

      {myReviews.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {myReviews.map((review) => (
            <div key={review.id} style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <StarRating value={review.rating} />

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
              </div>

              {review.comment && (
                <p style={{ color: 'var(--app-text)', fontSize: 13, marginTop: 8, lineHeight: 1.5 }}>
                  {review.comment}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default AppReviewForm;
