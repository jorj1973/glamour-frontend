import { useEffect, useState } from 'react';
import { Award, BadgeCheck, MessageSquareText, UserRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import StarRating from './StarRating';
import RatingSummary from './RatingSummary';
import ChatWithButton from './ChatWithButton';

/**
 * Значение на языке клиента.
 *
 * Если перевода нет, показываем основное: строка на чужом
 * языке лучше пустоты в карточке мастера.
 */
function pick(
  base: string | null | undefined,
  ro: string | null | undefined,
  ru: string | null | undefined,
  en: string | null | undefined,
  language: string,
): string {
  if (language.startsWith('ro')) return ro?.trim() || base || '';
  if (language.startsWith('en')) return en?.trim() || base || '';
  if (language.startsWith('ru')) return ru?.trim() || base || '';

  return base || '';
}
import api from '../api/api';

type PublicCredential = {
  id: string;
  title: string;
  issuer: string | null;
  issuedYear: number | null;
  isVerified: boolean;
  previewUrl: string | null;
};

type PublicPortfolioItem = {
  id: string;
  imageUrl: string;
  caption: string | null;
};

type PublicReviewItem = {
  id: string;
  rating: number;
  comment: string | null;
  masterReply: string | null;
  createdAt: string;
};

export type PublicMasterProfile = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  photoUrl: string | null;
  profession: string | null;
  professionRo?: string | null;
  professionRu?: string | null;
  professionEn?: string | null;
  bioRo?: string | null;
  bioRu?: string | null;
  bioEn?: string | null;
  specialization: string | null;
  bio: string | null;
  city: string | null;
  experienceYears: number | null;
  bookingCode: string | null;
  credentials: PublicCredential[];
  portfolio: PublicPortfolioItem[];
};

type Props = {
  masterProfileId: string;
  compact?: boolean;
};

/**
 * Публичная карточка мастера: то, что видит клиент.
 *
 * Источник данных тот же, что у страницы «Обо мне», но отдаётся
 * через /public/masters/:id/profile — без оригиналов дипломов
 * и без служебных полей.
 */
function MasterPublicCard({ masterProfileId, compact = false }: Props) {
  const { t, i18n } = useTranslation();
  const [profile, setProfile] = useState<PublicMasterProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [reviews, setReviews] = useState<PublicReviewItem[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      try {
        const res = await api.get<PublicMasterProfile>(
          `/public/masters/${masterProfileId}/profile`,
        );
        if (!cancelled) setProfile(res.data);
      } catch {
        if (!cancelled) setProfile(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    async function loadReviews() {
      try {
        const res = await api.get<PublicReviewItem[]>(
          `/reviews/master/${masterProfileId}`,
        );
        if (!cancelled) setReviews(res.data);
      } catch {
        if (!cancelled) setReviews([]);
      }
    }

    void load();
    void loadReviews();

    return () => {
      cancelled = true;
    };
  }, [masterProfileId]);

  if (isLoading || !profile) {
    return null;
  }

  const name = [profile.firstName, profile.lastName]
    .filter(Boolean)
    .join(' ')
    .trim();

  const publicCredentials = profile.credentials;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {profile.photoUrl ? (
          <img
            src={profile.photoUrl}
            alt={name}
            style={{ width: 56, height: 56, borderRadius: 18, objectFit: 'cover' }}
          />
        ) : (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 56,
              height: 56,
              borderRadius: 18,
              background: 'rgba(var(--app-accent-rgb), 0.14)',
            }}
          >
            <UserRound size={26} color="var(--app-accent)" />
          </div>
        )}

        <div style={{ minWidth: 0 }}>
          <strong style={{ color: 'var(--app-text)', fontSize: 15 }}>{name}</strong>
          {profile.profession && (
            <p style={{ color: 'var(--app-text-muted)', fontSize: 13 }}>{pick(profile.profession, profile.professionRo, profile.professionRu, profile.professionEn, i18n.language)}</p>
          )}
          {profile.experienceYears != null && profile.experienceYears > 0 && (
            <p style={{ color: 'var(--app-accent)', fontSize: 12, fontWeight: 600 }}>
              {t('myProfile.experienceHint', { count: profile.experienceYears })}
            </p>
          )}
        </div>
      </div>

      {!compact && profile.bio && (
        <p style={{ color: 'var(--app-text-muted)', fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-line' }}>
          {pick(profile.bio, profile.bioRo, profile.bioRu, profile.bioEn, i18n.language)}
        </p>
      )}

      {profile.portfolio.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: compact
              ? 'repeat(auto-fill, minmax(72px, 1fr))'
              : 'repeat(auto-fill, minmax(120px, 1fr))',
            gap: 8,
          }}
        >
          {(compact ? profile.portfolio.slice(0, 4) : profile.portfolio).map((item) => (
            <img
              key={item.id}
              src={item.imageUrl}
              alt={item.caption ?? ''}
              loading="lazy"
              style={{
                width: '100%',
                height: compact ? 72 : 120,
                objectFit: 'cover',
                borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            />
          ))}
        </div>
      )}

      {publicCredentials.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <p style={{ color: 'var(--app-accent)', fontSize: 11, fontWeight: 800, letterSpacing: '0.14em' }}>
            {t('credentials.title').toUpperCase()}
          </p>

          {(compact ? publicCredentials.slice(0, 3) : publicCredentials).map((item) => (
            <div
              key={item.id}
              style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}
            >
              <Award size={16} color="var(--app-accent)" style={{ flexShrink: 0, marginTop: 2 }} />

              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ color: 'var(--app-text)', fontSize: 13, fontWeight: 600 }}>
                  {item.title}
                  {item.isVerified && (
                    <BadgeCheck
                      size={14}
                      color="#4dd08b"
                      style={{ display: 'inline', marginLeft: 5, verticalAlign: 'text-bottom' }}
                    />
                  )}
                </p>

                {(item.issuer || item.issuedYear) && (
                  <p style={{ color: 'var(--app-text-muted)', fontSize: 12 }}>
                    {[item.issuer, item.issuedYear].filter(Boolean).join(' · ')}
                  </p>
                )}

                {!compact && item.previewUrl && (
                  <img
                    src={item.previewUrl}
                    alt={item.title}
                    loading="lazy"
                    onContextMenu={(e) => e.preventDefault()}
                    draggable={false}
                    style={{
                      width: '100%',
                      maxWidth: 260,
                      marginTop: 6,
                      borderRadius: 10,
                      border: '1px solid rgba(255,255,255,0.08)',
                      pointerEvents: 'none',
                      userSelect: 'none',
                    }}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {reviews.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <p style={{ color: 'var(--app-accent)', fontSize: 11, fontWeight: 800, letterSpacing: '0.14em' }}>
            {t('reviews.title').toUpperCase()}
          </p>

          <RatingSummary
            ratings={reviews.map((review) => review.rating)}
            compact={compact}
          />

          {(compact ? reviews.slice(0, 2) : reviews)
            .filter((review) => review.comment || review.masterReply)
            .map((review) => (
            <div
              key={review.id}
              style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}
            >
              <MessageSquareText size={15} color="var(--app-accent)" style={{ flexShrink: 0, marginTop: 2 }} />

              <div style={{ minWidth: 0, flex: 1 }}>
                <StarRating value={review.rating} size={13} />
                {review.comment && (
                  <p style={{ color: 'var(--app-text-muted)', fontSize: 13, marginTop: 4, lineHeight: 1.5 }}>
                    {review.comment}
                  </p>
                )}
                {review.masterReply && (
                  <p style={{ color: 'var(--app-text)', fontSize: 12, marginTop: 4, lineHeight: 1.5 }}>
                    <strong style={{ color: 'var(--app-accent)' }}>{t('reviews.masterReplyLabel')}: </strong>
                    {review.masterReply}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {!compact && profile.bookingCode && (
        <a
          href={'#book?identifier=' + profile.bookingCode}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 52,
            marginTop: 6,
            borderRadius: 16,
            background: 'var(--app-accent)',
            color: '#17151c',
            fontSize: 15,
            fontWeight: 700,
            textDecoration: 'none',
          }}
        >
          {t('booking.title')}
        </a>
      )}

      {/* Кнопка сама решает, показываться ли: чат включён
          не всем салонам, и писать можно не всем подряд. */}
      {!compact && <ChatWithButton masterProfileId={profile.id} block />}
    </div>
  );
}

export default MasterPublicCard;
