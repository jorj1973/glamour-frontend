import { Star } from 'lucide-react';

type Props = {
  value: number;
  onChange?: (value: number) => void;
  size?: number;
};

/**
 * Звёзды рейтинга: только для чтения без onChange, интерактивные — с ним.
 *
 * Один компонент на обе роли, чтобы отображение отзыва и форма его
 * создания выглядели одинаково — иначе рейтинг в форме и в списке
 * визуально расходятся.
 */
function StarRating({ value, onChange, size = 18 }: Props) {
  const isInteractive = Boolean(onChange);

  return (
    <div style={{ display: 'inline-flex', gap: 3 }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={!isInteractive}
          onClick={() => onChange?.(star)}
          aria-label={`${star}`}
          style={{
            display: 'inline-flex',
            padding: 0,
            border: 0,
            background: 'transparent',
            cursor: isInteractive ? 'pointer' : 'default',
          }}
        >
          <Star
            size={size}
            fill={star <= value ? '#ffb020' : 'transparent'}
            color={star <= value ? '#ffb020' : 'var(--app-text-muted)'}
          />
        </button>
      ))}
    </div>
  );
}

export default StarRating;
