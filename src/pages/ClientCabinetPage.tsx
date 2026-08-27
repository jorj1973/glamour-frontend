import { useEffect, useState } from 'react';
import { CalendarDays, Clock, LogOut, Scissors, UserRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../api/api';
import { getErrorKey } from '../api/errorMessage';
import LanguageSwitcher from '../components/LanguageSwitcher';
import ThemeSwitcher from '../components/ThemeSwitcher';
import WelcomeDialog from '../components/WelcomeDialog';
import PostponedList from '../components/PostponedList';
import {
  isPushSupported,
  pushPermission,
  subscribeToPush,
} from '../api/push';
import NotificationBell from '../components/NotificationBell';
import ChatOpenButton from '../components/ChatOpenButton';
import RescheduleDialog from '../components/RescheduleDialog';
import ClientLoyaltyPage from './ClientLoyaltyPage';
import ClientProfilePage from './ClientProfilePage';
import ClientMastersPage from './ClientMastersPage';
import ClientSalonPage from './ClientSalonPage';
import ClientReviewsPage from './ClientReviewsPage';

type ClientAppointment = {
  id: string;
  masterProfileId: string;
  startTime: string;
  endTime: string;
  status: string;
  masterName: string | null;
  masterPhone: string | null;
  serviceName: string | null;
  price: number | string | null;
};

const TOKEN_KEY = 'glamour_access_token';

const STATUS_COLORS: Record<string, string> = {
  pending: '#f0b45e',
  confirmed: '#7aa7ff',
  completed: '#4dd08b',
  cancelled: '#ff6080',
};

/**
 * Кабинет клиента: его записи во всех салонах.
 *
 * Клиент не привязан к салону — для него это просто «мои записи».
 */
function ClientCabinetPage() {
  const { t } = useTranslation();
  const [appointments, setAppointments] = useState<ClientAppointment[]>([]);
  /** Активный раздел кабинета. */
  const [tab, setTab] = useState<
    'appointments' | 'masters' | 'salon' | 'reviews' | 'loyalty' | 'profile'
  >('appointments');

  /** Подраздел вкладки записей: свои визиты или создание новой. */
  const [bookingTab, setBookingTab] = useState<'my' | 'postponed' | 'create'>(
    'my',
  );

  /** Запись, которую клиент сейчас переносит. */
  const [rescheduleItem, setRescheduleItem] =
    useState<ClientAppointment | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  /**
   * Самовосстановление подписки.
   *
   * Разрешение браузер помнит навсегда, а подписка на сервере может
   * пропасть — например, после смены ключей отправки. Тогда телефон
   * считает себя подписанным, сервер о нём не знает, и уведомления
   * молчат без единой ошибки.
   *
   * У клиента нет колокольчика, где это делается в других кабинетах,
   * поэтому подписываемся здесь.
   */
  useEffect(() => {
    if (isPushSupported() && pushPermission() === 'granted') {
      void subscribeToPush();
    }
  }, []);

  useEffect(() => { void load(); }, []);

  async function load() {
    setIsLoading(true);
    try {
      const res = await api.get<ClientAppointment[]>('/appointments/client/my');
      setAppointments(res.data);
    } catch (error) {
      setErrorMsg(t(getErrorKey(error)));
    } finally {
      setIsLoading(false);
    }
  }

  /**
   * Отмена записи клиентом.
   *
   * Поздняя отмена стоит половины баллов — предупреждаем до нажатия,
   * чтобы списание не стало неожиданностью.
   */
  async function handleCancel(item: ClientAppointment) {
    const hoursLeft =
      (new Date(item.startTime).getTime() - Date.now()) / 3600000;

    const message =
      hoursLeft < 2
        ? t('clientCabinet.cancelLateConfirm')
        : t('clientCabinet.cancelConfirm');

    if (!window.confirm(message)) {
      return;
    }

    try {
      await api.patch(`/appointments/client/${item.id}/cancel`);
      await load();
    } catch (error) {
      setErrorMsg(t(getErrorKey(error)));
    }
  }

  function handleLogout() {
    localStorage.removeItem(TOKEN_KEY);
    window.location.assign(`${window.location.origin}/`);
  }

  function formatDate(value: string) {
    const date = new Date(value);
    return date.toLocaleDateString(undefined, {
      day: '2-digit',
      month: 'long',
    });
  }

  function formatTime(value: string) {
    const date = new Date(value);
    return date.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  const now = Date.now();

  const upcoming = appointments.filter(
    (a) => new Date(a.startTime).getTime() >= now && a.status !== 'cancelled',
  );

  const past = appointments.filter(
    (a) => new Date(a.startTime).getTime() < now || a.status === 'cancelled',
  );

  function renderCard(item: ClientAppointment) {
    return (
      <div
        key={item.id}
        style={{
          padding: 16,
          borderRadius: 16,
          border: '1px solid rgba(var(--app-overlay-rgb), 0.09)',
          background: 'rgba(var(--app-overlay-rgb), 0.04)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span
            style={{
              padding: '3px 10px',
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 700,
              color: STATUS_COLORS[item.status] ?? 'var(--app-text-muted, var(--app-text-muted))',
              border: `1px solid ${STATUS_COLORS[item.status] ?? 'var(--app-text-muted, var(--app-text-muted))'}40`,
            }}
          >
            {t(`appointments.status.${item.status}`, item.status)}
          </span>
        </div>

        <p style={{ display: 'flex', alignItems: 'center', gap: 7, color: 'var(--app-text, var(--app-text))', fontSize: 15, fontWeight: 700 }}>
          <CalendarDays size={15} color="var(--app-accent)" />
          {formatDate(item.startTime)}, {formatTime(item.startTime)}
        </p>

        {item.serviceName && (
          <p style={{ display: 'flex', alignItems: 'center', gap: 7, color: 'var(--app-text-muted, var(--app-text-muted))', fontSize: 13, marginTop: 6 }}>
            <Scissors size={13} color="var(--app-accent)" />
            {item.serviceName}
          </p>
        )}

        {item.masterName && (
          <p style={{ display: 'flex', alignItems: 'center', gap: 7, color: 'var(--app-text-muted, var(--app-text-muted))', fontSize: 13, marginTop: 4 }}>
            <UserRound size={13} color="var(--app-accent)" />
            {item.masterName}
          </p>
        )}

        {item.price != null && (
          <p style={{ color: 'var(--app-accent)', fontSize: 14, fontWeight: 700, marginTop: 8 }}>
            {item.price} MDL
          </p>
        )}

        {new Date(item.startTime).getTime() > Date.now() &&
          item.status !== 'cancelled' && (
            <>
            <button
              type="button"
              onClick={() => setRescheduleItem(item)}
              style={{
                marginTop: 12,
                minHeight: 40,
                width: '100%',
                border: '1px solid rgba(var(--app-accent-rgb), 0.32)',
                borderRadius: 12,
                background: 'rgba(var(--app-accent-rgb), 0.1)',
                color: 'var(--app-accent)',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {t('clientCabinet.rescheduleButton')}
            </button>

            <button
              type="button"
              onClick={() => void handleCancel(item)}
              style={{
                marginTop: 12,
                minHeight: 40,
                width: '100%',
                border: '1px solid rgba(255,96,128,0.28)',
                borderRadius: 12,
                background: 'rgba(255,96,128,0.08)',
                color: 'var(--app-accent-warm)',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {t('clientCabinet.cancelButton')}
            </button>
            </>
          )}
      </div>
    );
  }

  return (
    <>
      <WelcomeDialog role="client" />

      {rescheduleItem && (
        <RescheduleDialog
          appointment={rescheduleItem}
          onClose={() => setRescheduleItem(null)}
          onDone={() => {
            setRescheduleItem(null);
            void load();
          }}
        />
      )}

    <main
      className="client-cabinet"
      style={{ minHeight: '100vh', padding: '24px 16px 48px', background: 'var(--app-bg)' }}
    >
      <div style={{ maxWidth: 620, margin: '0 auto' }}>
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: 22,
          }}
        >
          <p style={{ color: 'var(--app-accent-muted)', fontSize: 12, fontWeight: 800, letterSpacing: '0.18em' }}>
            GLAMOUR
          </p>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <LanguageSwitcher />
                    <ThemeSwitcher />

            <ChatOpenButton />

            <NotificationBell inline />

            <button
              type="button"
              onClick={handleLogout}
              aria-label="Logout"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 44,
                height: 44,
                border: '1px solid rgba(var(--app-overlay-rgb), 0.12)',
                borderRadius: 13,
                background: 'rgba(var(--app-overlay-rgb), 0.05)',
                color: 'var(--app-text, var(--app-text))',
                cursor: 'pointer',
              }}
            >
              <LogOut size={17} />
            </button>
          </div>
        </header>

        <h1 style={{ color: 'var(--app-text, var(--app-text))', fontSize: 28, marginBottom: 4 }}>
          {t('clientCabinet.title')}
        </h1>
        <p style={{ color: 'var(--app-text-muted, var(--app-text-muted))', fontSize: 14, marginBottom: 22 }}>
          {t('clientCabinet.subtitle')}
        </p>

        {/* Разделы кабинета. Клиент приходит с телефона,
            поэтому вкладки, а не боковое меню. */}
        <div
          style={{
            display: 'flex',
            gap: 6,
            marginBottom: 20,
            padding: 4,
            overflowX: 'auto',
            borderRadius: 14,
            background: 'rgba(var(--app-overlay-rgb), 0.05)',
          }}
        >
          {(
            ['appointments', 'masters', 'salon', 'reviews', 'loyalty', 'profile'] as const
          ).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              style={{
                flex: 1,
                minHeight: 42,
                border: 0,
                borderRadius: 11,
                background: tab === key ? 'var(--app-accent)' : 'transparent',
                color: tab === key ? 'var(--app-bg)' : 'var(--app-text-muted, var(--app-text-muted))',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {t('clientCabinet.tab.' + key)}
            </button>
          ))}
        </div>

        {tab === 'salon' ? (
          <ClientSalonPage />
        ) : tab === 'masters' ? (
          <ClientMastersPage />
        ) : tab === 'reviews' ? (
          <ClientReviewsPage />
        ) : tab === 'loyalty' ? (
          <ClientLoyaltyPage />
        ) : tab === 'profile' ? (
          <ClientProfilePage />
        ) : (
        <>

        {/* Подразделы: смотреть свои записи или создать новую. */}
        <div
          style={{
            display: 'flex',
            gap: 8,
            marginBottom: 20,
          }}
        >
          {(['my', 'postponed', 'create'] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setBookingTab(key)}
              style={{
                flex: 1,
                minHeight: 44,
                borderRadius: 13,
                border:
                  bookingTab === key
                    ? '1px solid var(--app-accent)'
                    : '1px solid var(--app-border)',
                background:
                  bookingTab === key
                    ? 'rgba(var(--app-accent-rgb), 0.12)'
                    : 'transparent',
                color:
                  bookingTab === key
                    ? 'var(--app-accent)'
                    : 'var(--app-text-muted)',
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {t(
                'clientCabinet.' +
                  (key === 'my'
                    ? 'myBookings'
                    : key === 'postponed'
                      ? 'postponedTab'
                      : 'createBooking'),
              )}
            </button>
          ))}
        </div>

        {bookingTab === 'postponed' ? (
          <PostponedList />
        ) : bookingTab === 'create' ? (
          <section
            style={{
              padding: 26,
              borderRadius: 18,
              border: '1px solid var(--app-border)',
              background: 'var(--app-panel)',
              textAlign: 'center',
            }}
          >
            <p
              style={{
                margin: 0,
                color: 'var(--app-text)',
                fontSize: 17,
                fontWeight: 700,
              }}
            >
              {t('clientCabinet.createTitle')}
            </p>

            <p
              style={{
                margin: '10px 0 20px',
                color: 'var(--app-text-muted)',
                fontSize: 14,
                lineHeight: 1.55,
              }}
            >
              {t('clientCabinet.createText')}
            </p>

            <a
              href={
                '/#book?identifier=' +
                encodeURIComponent(
                  localStorage.getItem('glamour_booking_link') ?? '',
                )
              }
              className="primary-action"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 46,
                padding: '0 26px',
                textDecoration: 'none',
              }}
            >
              {t('clientCabinet.createButton')}
            </a>
          </section>
        ) : (
        <>

        {errorMsg && (
          <div style={{ padding: '11px 15px', borderRadius: 13, marginBottom: 16, fontSize: 13, fontWeight: 700, border: '1px solid rgba(255,96,128,0.25)', background: 'rgba(255,96,128,0.1)', color: 'var(--app-accent-warm)' }}>
            {errorMsg}
          </div>
        )}

        {isLoading ? (
          <p style={{ color: 'var(--app-text-muted, var(--app-text-muted))' }}>{t('common.loading')}</p>
        ) : appointments.length === 0 ? (
          <p style={{ color: 'var(--app-text-muted, var(--app-text-dim5))', fontSize: 14 }}>
            {t('clientCabinet.empty')}
          </p>
        ) : (
          <>
            {upcoming.length > 0 && (
              <section style={{ marginBottom: 26 }}>
                <p style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--app-accent-muted)', fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', marginBottom: 12 }}>
                  <Clock size={13} />
                  {t('clientCabinet.upcoming').toUpperCase()}
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {upcoming.map(renderCard)}
                </div>
              </section>
            )}

            {past.length > 0 && (
              <section>
                <p style={{ color: 'var(--app-text-muted, var(--app-text-dim5))', fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', marginBottom: 12 }}>
                  {t('clientCabinet.history').toUpperCase()}
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, opacity: 0.72 }}>
                  {past.map(renderCard)}
                </div>
              </section>
            )}
          </>
        )}
        </>
        )}
        </>
        )}
      </div>
    </main>
    </>
  );
}

export default ClientCabinetPage;
