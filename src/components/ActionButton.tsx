import { Check, X } from 'lucide-react';

export type ActionState = 'idle' | 'loading' | 'success' | 'error';

type ActionButtonProps = {
  state: ActionState;
  label: string;
  loadingLabel?: string;
  successLabel?: string;
  errorLabel?: string;
  hint?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  type?: 'button' | 'submit';
  size?: 'normal' | 'small';
  onClick?: () => void;
};

const COLORS = {
  idle: 'var(--app-accent)',
  loading: 'var(--app-accent)',
  success: '#4dd08b',
  error: '#ff6080',
};

/**
 * Единая кнопка действия для всего приложения.
 *
 * Зелёная при успехе, красная при ошибке, с пояснением под ней.
 * Логика одна на все страницы, чтобы поведение не расходилось.
 */
function ActionButton({
  state,
  label,
  loadingLabel,
  successLabel,
  errorLabel,
  hint,
  icon,
  disabled,
  type = 'button',
  size = 'normal',
  onClick,
}: ActionButtonProps) {
  const isSmall = size === 'small';

  const currentLabel =
    state === 'loading'
      ? (loadingLabel ?? label)
      : state === 'success'
        ? (successLabel ?? label)
        : state === 'error'
          ? (errorLabel ?? label)
          : label;

  const currentIcon =
    state === 'success' ? (
      <Check size={isSmall ? 14 : 17} />
    ) : state === 'error' ? (
      <X size={isSmall ? 14 : 17} />
    ) : (
      icon
    );

  const isDisabled = disabled || state === 'loading';

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 6 }}>
      <button
        type={type}
        onClick={onClick}
        disabled={isDisabled}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: isSmall ? 6 : 8,
          minHeight: isSmall ? 38 : 48,
          minWidth: isSmall ? 0 : 190,
          padding: isSmall ? '0 14px' : '0 24px',
          border: 0,
          borderRadius: isSmall ? 11 : 14,
          background: COLORS[state],
          color: '#17151c',
          fontSize: isSmall ? 12 : 14,
          fontWeight: 700,
          cursor: isDisabled ? 'default' : 'pointer',
          opacity: state === 'loading' ? 0.75 : 1,
          transition: 'background 0.25s ease',
        }}
      >
        {currentIcon}
        {currentLabel}
      </button>

      {hint && (state === 'success' || state === 'error') && (
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            lineHeight: 1.4,
            maxWidth: 320,
            color: state === 'success' ? '#9ae9bd' : 'var(--app-danger)',
          }}
        >
          {hint}
        </span>
      )}
    </div>
  );
}

export default ActionButton;
