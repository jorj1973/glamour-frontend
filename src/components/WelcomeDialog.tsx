import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarDays, Scissors, UserRound, X } from 'lucide-react';

const STORAGE_KEY = 'glamour_welcome_seen';

type WelcomeStep = {
  key: string;
  icon: React.ReactNode;
  done: boolean;
  href: string;
};

type Props = {
  /** Кому показываем: у каждой роли свои шаги и свой текст. */
  role: 'master' | 'salon' | 'client';

  /** Имя для обращения. Без него получается казённо. */
  firstName?: string;

  /** Что уже сделано — отмечаем галочкой, чтобы не звать зря. */
  doneKeys?: string[];
};

/**
 * Шаги по ролям. Порядок не случайный: сначала то, без чего
 * клиенты вообще не увидят человека, потом оформление.
 */
const STEPS: Record<Props['role'], { key: string; href: string }[]> = {
  master: [
    { key: 'services', href: '#services' },
    { key: 'schedule', href: '#schedule-template' },
    { key: 'profile', href: '#profile' },
  ],
  salon: [
    { key: 'salonInfo', href: '#salon-info' },
    { key: 'salonServices', href: '#services' },
    { key: 'salonMasters', href: '#masters' },
  ],
  client: [
    { key: 'appointments', href: '#appointments' },
    { key: 'masters', href: '#masters' },
  ],
};

const ICONS: Record<string, React.ReactNode> = {
  services: <Scissors size={18} />,
  schedule: <CalendarDays size={18} />,
  profile: <UserRound size={18} />,
  salonInfo: <UserRound size={18} />,
  salonServices: <Scissors size={18} />,
  salonMasters: <UserRound size={18} />,
  appointments: <CalendarDays size={18} />,
  masters: <UserRound size={18} />,
};

function WelcomeDialog({ role, firstName, doneKeys = [] }: Props) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Ключ с ролью: мастер, ставший владельцем салона,
    // должен увидеть приветствие и в новой роли.
    const seen = localStorage.getItem(STORAGE_KEY + '_' + role);

    if (!seen) {
      setIsOpen(true);
    }
  }, [role]);

  function close() {
    localStorage.setItem(STORAGE_KEY + '_' + role, '1');
    setIsOpen(false);
  }

  if (!isOpen) {
    return null;
  }

  const steps: WelcomeStep[] = STEPS[role].map((step) => ({
    key: step.key,
    href: step.href,
    icon: ICONS[step.key],
    done: doneKeys.includes(step.key),
  }));

  return (
    <div
      onClick={close}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        background: 'rgba(0, 0, 0, 0.55)',
        backdropFilter: 'blur(3px)',
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          position: 'relative',
          width: 'min(100%, 440px)',
          maxHeight: '86vh',
          overflowY: 'auto',
          padding: '30px 26px 26px',
          borderRadius: 22,
          border: '1px solid var(--app-border)',
          background: 'var(--app-panel)',
          boxShadow: '0 30px 80px rgba(0, 0, 0, 0.35)',
        }}
      >
        <button
          type="button"
          onClick={close}
          aria-label={t('welcome.close')}
          style={{
            position: 'absolute',
            top: 14,
            right: 14,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 32,
            height: 32,
            border: 0,
            borderRadius: 10,
            background: 'transparent',
            color: 'var(--app-text-muted)',
            cursor: 'pointer',
          }}
        >
          <X size={18} />
        </button>

        <p
          style={{
            margin: 0,
            color: 'var(--app-accent-text)',
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
          }}
        >
          {t('welcome.eyebrow')}
        </p>

        <h2
          style={{
            margin: '10px 0 0',
            color: 'var(--app-text)',
            fontSize: 24,
            lineHeight: 1.2,
          }}
        >
          {firstName
            ? t('welcome.' + role + '.titleNamed', { name: firstName })
            : t('welcome.' + role + '.title')}
        </h2>

        <p
          style={{
            margin: '12px 0 22px',
            color: 'var(--app-text)',
            fontSize: 14.5,
            lineHeight: 1.6,
          }}
        >
          {t('welcome.' + role + '.intro')}
        </p>

        <div style={{ display: 'grid', gap: 10 }}>
          {steps.map((step, index) => (
            <a
              key={step.key}
              href={step.href}
              onClick={close}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '13px 15px',
                borderRadius: 14,
                border: '1px solid var(--app-border)',
                background: step.done
                  ? 'transparent'
                  : 'rgba(var(--app-accent-rgb), 0.07)',
                color: 'var(--app-text)',
                textDecoration: 'none',
                opacity: step.done ? 0.8 : 1,
              }}
            >
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 36,
                  height: 36,
                  borderRadius: 11,
                  background: 'rgba(var(--app-accent-rgb), 0.14)',
                  color: 'var(--app-accent-text)',
                  flexShrink: 0,
                }}
              >
                {step.icon}
              </span>

              <span style={{ flex: 1, minWidth: 0 }}>
                <strong
                  style={{
                    display: 'block',
                    fontSize: 14,
                    marginBottom: 2,
                  }}
                >
                  {index + 1}. {t('welcome.' + role + '.' + step.key + '.title')}
                </strong>

                <span
                  style={{
                    display: 'block',
                    color: 'var(--app-text)',
                    fontSize: 13,
                    lineHeight: 1.5,
                  }}
                >
                  {t('welcome.' + role + '.' + step.key + '.text')}
                </span>
              </span>

              {step.done && (
                <span
                  style={{
                    color: 'var(--app-accent-text)',
                    fontSize: 16,
                    flexShrink: 0,
                  }}
                >
                  ✓
                </span>
              )}
            </a>
          ))}
        </div>

        <button
          type="button"
          onClick={close}
          className="primary-action"
          style={{ width: '100%', marginTop: 20 }}
        >
          {t('welcome.start')}
        </button>

        <p
          style={{
            margin: '14px 0 0',
            color: 'var(--app-text-muted)',
            fontSize: 12,
            textAlign: 'center',
          }}
        >
          {t('welcome.footer')}
        </p>
      </div>
    </div>
  );
}

export default WelcomeDialog;
