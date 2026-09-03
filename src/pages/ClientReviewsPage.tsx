import { useEffect, useState } from 'react';
import { MessageSquareText, Send } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../api/api';
import { getErrorKey } from '../api/errorMessage';
import StarRating from '../components/StarRating';
import AppReviewForm from '../components/AppReviewForm';

type ClientAppointment = {
  id: string;
  salonId: string;
  masterProfileId: string;
  startTime: string;
  status: string;
  masterName: string | null;
  serviceName: string | null;
};

type ReviewItem = {
  id: string;
  appointmentId: string;
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

/**
 * Отзывы клиента: о завершённых визитах (салон + мастер сразу,
 * так как визит всегда у конкретного мастера в конкретном салоне)
 * и отдельно — о самом приложении.
 */
function ClientReviewsPage() {
  const { t } = useTranslation();

  const [appointments, setAppointments] = useState<ClientAppointment[]>([]);
  const [myReviews, setMyReviews] = useState<ReviewItem[]>([]);
  const [clientUserId, setClientUserId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const [openAppointmentId, setOpenAppointmentId] = useState<string | null>(
    null,
  );
  const [draftRating, setDraftRating] = useState(5);
  const [draftComment, setDraftComment] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setIsLoading(true);

    try {
      const [sessionRes, appointmentsRes, reviewsRes] = await Promise.all([
        api.get<{ user: { id: string } }>('/auth/session'),
        api.get<ClientAppointment[]>('/appointments/client/my'),
        api.get<ReviewItem[]>('/reviews/my'),
      ]);

      setClientUserId(sessionRes.data.user.id);
      setAppointments(appointmentsRes.data);
      setMyReviews(reviewsRes.data);
    } catch (error) {
      setErrorMsg(t(getErrorKey(error)));
    } finally {
      setIsLoading(false);
    }
  }

  const reviewedAppointmentIds = new Set(
    myReviews.map((review) => review.appointmentId),
  );

  const eligibleAppointments = appointments.filter(
    (item) =>
      item.status === 'completed' && !reviewedAppointmentIds.has(item.id),
  );

  function openForm(appointmentId: string) {
    setOpenAppointmentId(appointmentId);
    setDraftRating(5);
    setDraftComment('');
  }

  async function submitReview(item: ClientAppointment) {
    setIsSaving(true);
    setErrorMsg('');

    try {
      await api.post(`/reviews?salonId=${item.salonId}`, {
        appointmentId: item.id,
        clientUserId,
        masterProfileId: item.masterProfileId,
        rating: draftRating,
        comment: draftComment.trim() || undefined,
      });

      setOpenAppointmentId(null);
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

  if (isLoading) {
    return (
      <p style={{ color: 'var(--app-text-muted)', fontSize: 14 }}>
        {t('common.loading')}
      </p>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
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

      <p
        style={{
          color: 'var(--app-text-muted)',
          fontSize: 13,
          lineHeight: 1.55,
        }}
      >
        {t('reviews.constructiveHint')}
      </p>

      {eligibleAppointments.length > 0 && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p
            style={{
              color: 'var(--app-accent-muted)',
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: '0.14em',
            }}
          >
            {t('reviews.canReview').toUpperCase()}
          </p>

          {eligibleAppointments.map((item) => (
            <div key={item.id} style={cardStyle}>
              <p style={{ color: 'var(--app-text)', fontSize: 14, fontWeight: 700 }}>
                {formatDate(item.startTime)}
                {item.masterName ? ` · ${item.masterName}` : ''}
              </p>

              {item.serviceName && (
                <p style={{ color: 'var(--app-text-muted)', fontSize: 13, marginTop: 4 }}>
                  {item.serviceName}
                </p>
              )}

              {openAppointmentId === item.id ? (
                <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <StarRating value={draftRating} onChange={setDraftRating} size={22} />

                  <textarea
                    value={draftComment}
                    onChange={(e) => setDraftComment(e.target.value)}
                    rows={3}
                    placeholder={t('reviews.commentOptional')}
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
                      disabled={isSaving}
                      onClick={() => void submitReview(item)}
                      style={{
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

                    <button
                      type="button"
                      onClick={() => setOpenAppointmentId(null)}
                      style={{
                        minHeight: 40,
                        padding: '0 16px',
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
                  onClick={() => openForm(item.id)}
                  style={{
                    marginTop: 12,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    minHeight: 38,
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
                  <MessageSquareText size={14} />
                  {t('reviews.writeReview')}
                </button>
              )}
            </div>
          ))}
        </section>
      )}

      <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p
          style={{
            color: 'var(--app-accent-muted)',
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: '0.14em',
          }}
        >
          {t('reviews.myReviews').toUpperCase()}
        </p>

        {myReviews.length === 0 ? (
          <p style={{ color: 'var(--app-text-muted)', fontSize: 13 }}>
            {t('reviews.myReviewsEmpty')}
          </p>
        ) : (
          myReviews.map((review) => (
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

              {review.masterReply && (
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
            </div>
          ))
        )}
      </section>

      <AppReviewForm />
    </div>
  );
}

export default ClientReviewsPage;
