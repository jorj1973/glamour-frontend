import { useTranslation } from 'react-i18next';
import StarRating from './StarRating';

type Props = {
  /** Оценки всех отзывов — по ним считаем и средний балл, и разбивку. */
  ratings: number[];
  compact?: boolean;
};

/**
 * Сводный рейтинг в привычном по Google и Booking виде:
 * крупный балл слева, разбивка по звёздам справа.
 *
 * Разбивка важнее среднего балла: 4.5 из десяти пятёрок и десяти
 * четвёрок — это не то же самое, что 4.5 из сплошных пятёрок и пары
 * единиц, а по одной цифре эти случаи не различить.
 */
function RatingSummary({ ratings, compact = false }: Props) {
  const { t } = useTranslation();

  if (ratings.length === 0) {
    return null;
  }

  const average = ratings.reduce((sum, value) => sum + value, 0) / ratings.length;

  const buckets = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: ratings.filter((value) => Math.round(value) === star).length,
  }));

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: compact ? 14 : 22,
        flexWrap: 'wrap',
        padding: compact ? 0 : 16,
        borderRadius: 16,
        border: compact ? 0 : '1px solid rgba(var(--app-overlay-rgb), 0.09)',
        background: compact ? 'transparent' : 'rgba(var(--app-overlay-rgb), 0.04)',
      }}
    >
      <div style={{ textAlign: 'center', minWidth: 92 }}>
        <p
          style={{
            color: 'var(--app-text)',
            fontSize: compact ? 30 : 40,
            fontWeight: 800,
            lineHeight: 1.05,
          }}
        >
          {average.toFixed(1)}
        </p>

        <div style={{ marginTop: 4 }}>
          <StarRating value={Math.round(average)} size={compact ? 13 : 15} />
        </div>

        <p style={{ color: 'var(--app-text-muted)', fontSize: 12, marginTop: 4 }}>
          {t('reviews.countLabel', { count: ratings.length })}
        </p>
      </div>

      <div style={{ flex: 1, minWidth: 150, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {buckets.map((bucket) => {
          const percent = Math.round((bucket.count / ratings.length) * 100);

          return (
            <div
              key={bucket.star}
              style={{ display: 'flex', alignItems: 'center', gap: 8 }}
            >
              <span
                style={{
                  color: 'var(--app-text-muted)',
                  fontSize: 11,
                  fontWeight: 700,
                  width: 12,
                  textAlign: 'right',
                }}
              >
                {bucket.star}
              </span>

              <span
                style={{
                  flex: 1,
                  height: 7,
                  borderRadius: 999,
                  background: 'rgba(var(--app-overlay-rgb), 0.1)',
                  overflow: 'hidden',
                }}
              >
                <span
                  style={{
                    display: 'block',
                    width: `${percent}%`,
                    height: '100%',
                    borderRadius: 999,
                    background: '#ffb020',
                  }}
                />
              </span>

              <span
                style={{
                  color: 'var(--app-text-muted)',
                  fontSize: 11,
                  width: 24,
                  textAlign: 'right',
                }}
              >
                {bucket.count}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default RatingSummary;
