import { useEffect, useState } from 'react';
import {
  Ban,
  CalendarClock,
  CreditCard,
  Gift,
  RefreshCw,
  ScrollText,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import api from '../api/api';
import AppLayout from '../components/AppLayout';

type SalonSummary = {
  id: string;
  name: string;
};

type ActionLogItem = {
  id: string;
  action: string;
  targetType: 'appointment' | 'payment' | 'gift_card';
  targetId: string | null;
  result: 'allowed' | 'refused';
  reason: string | null;
  actorUserId: string | null;
  actorRole: string | null;
  actorName: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
};

type ActionLogResponse = {
  items: ActionLogItem[];
  nextBefore: string | null;
};

const PAGE_SIZE = 40;

function iconFor(item: ActionLogItem) {
  if (item.result === 'refused') {
    return <Ban size={16} />;
  }

  if (item.targetType === 'payment') {
    return <CreditCard size={16} />;
  }

  if (item.targetType === 'gift_card') {
    return <Gift size={16} />;
  }

  return <CalendarClock size={16} />;
}

/** Время записи — в часовом поясе того, кто смотрит. */
function formatMoment(value: string, locale: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Подробности строки — одной строкой и только то, что понятно человеку:
 * время «откуда → куда», состояние «было → стало». Идентификаторы
 * остаются в данных и в интерфейс не выносятся.
 */
function describeDetails(
  item: ActionLogItem,
  locale: string,
  t: (key: string) => string,
): string {
  const details = item.details ?? {};
  const from = details.from;
  const to = details.to;

  if (typeof from === 'string' && typeof to === 'string') {
    const isTime = !Number.isNaN(new Date(from).getTime()) && from.includes('-');

    return isTime
      ? `${formatMoment(from, locale)} → ${formatMoment(to, locale)}`
      : `${t(`actionLog.status.${from}`)} → ${t(`actionLog.status.${to}`)}`;
  }

  if (typeof details.startTime === 'string') {
    return formatMoment(details.startTime, locale);
  }

  return '';
}

/**
 * Журнал действий салона.
 *
 * Отвечает на вопрос, на который до одиннадцатой партии ответа не было:
 * кто перенёс запись, кто её отменил, кто отметил оплату. Владелец видит
 * всё, администратор — всё, кроме денег салона: отказы и возвраты
 * остаются у владельца (решение владельца 2026-09-13).
 */
function ActionLogPage() {
  const { t, i18n } = useTranslation();

  const [salon, setSalon] = useState<SalonSummary | null>(null);
  const [items, setItems] = useState<ActionLogItem[]>([]);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [message, setMessage] = useState('');

  const locale = i18n.language || 'ro';

  async function loadFirstPage() {
    setIsLoading(true);
    setMessage('');

    try {
      const salonsResponse = await api.get<SalonSummary[]>('/salons/my');
      const current = salonsResponse.data[0] ?? null;

      setSalon(current);

      if (!current) {
        setMessage(t('common.loadError'));

        return;
      }

      const response = await api.get<ActionLogResponse>('/salon-action-log', {
        params: { salonId: current.id, limit: PAGE_SIZE },
      });

      setItems(response.data.items);
      setNextBefore(response.data.nextBefore);
    } catch {
      setMessage(t('common.loadError'));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadFirstPage();
  }, []);

  async function loadMore() {
    if (!salon || !nextBefore || isLoadingMore) {
      return;
    }

    setIsLoadingMore(true);

    try {
      const response = await api.get<ActionLogResponse>('/salon-action-log', {
        params: { salonId: salon.id, limit: PAGE_SIZE, before: nextBefore },
      });

      setItems((current) => [...current, ...response.data.items]);
      setNextBefore(response.data.nextBefore);
    } catch {
      setMessage(t('common.loadError'));
    } finally {
      setIsLoadingMore(false);
    }
  }

  return (
    <AppLayout>
      <main className="dashboard-page">
        <header className="dashboard-header">
          <div>
            <h1>{t('actionLog.title')}</h1>
            <p className="dashboard-subtitle">{t('actionLog.subtitle')}</p>
          </div>
        </header>

        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <button
            type="button"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              minHeight: 40,
              padding: '0 14px',
              border: '1px solid rgba(var(--app-ink-rgb),0.12)',
              borderRadius: 12,
              background: 'rgba(var(--app-ink-rgb),0.05)',
              color: 'var(--app-text)',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
            }}
            onClick={() => void loadFirstPage()}
            disabled={isLoading}
          >
            <RefreshCw
              size={15}
              style={isLoading ? { animation: 'spin 1s linear infinite' } : {}}
            />{' '}
            {t('masters.refresh')}
          </button>
        </div>

        <section className="dashboard-panel">
          <div className="panel-heading">
            <div>
              <p className="panel-kicker">{t('actionLog.kicker')}</p>
              <h2>{t('actionLog.listTitle')}</h2>
            </div>
          </div>

          {isLoading && (
            <p className="dashboard-status">{t('common.loading')}</p>
          )}

          {!isLoading && message && (
            <p className="dashboard-status">{message}</p>
          )}

          {!isLoading && !message && items.length === 0 && (
            <div className="empty-state">
              <ScrollText size={26} />
              <p>{t('actionLog.empty')}</p>
              <span>{t('actionLog.emptyHint')}</span>
            </div>
          )}

          {!isLoading && items.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {items.map((item) => {
                const detail = describeDetails(item, locale, (key) => String(t(key)));

                return (
                  <div
                    key={item.id}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 12,
                      padding: '13px 0',
                      borderBottom:
                        '1px solid rgba(var(--app-ink-rgb),0.06)',
                    }}
                  >
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 32,
                        height: 32,
                        flexShrink: 0,
                        borderRadius: 10,
                        background:
                          item.result === 'refused'
                            ? 'rgba(255,96,128,0.12)'
                            : 'rgba(var(--app-ink-rgb),0.06)',
                        color:
                          item.result === 'refused'
                            ? 'var(--app-danger)'
                            : 'var(--app-text-muted)',
                      }}
                    >
                      {iconFor(item)}
                    </span>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <strong style={{ color: 'var(--app-text)', fontSize: 14 }}>
                        {t(`actionLog.action.${item.action}`)}
                      </strong>

                      <div
                        style={{
                          color: 'var(--app-text-muted)',
                          fontSize: 12,
                          marginTop: 3,
                        }}
                      >
                        {item.actorName || t('actionLog.actor.system')}
                        {item.actorRole
                          ? ` · ${t(`actionLog.role.${item.actorRole}`)}`
                          : ''}
                        {detail ? ` · ${detail}` : ''}
                      </div>

                      {item.result === 'refused' && item.reason && (
                        <div
                          style={{
                            color: 'var(--app-danger)',
                            fontSize: 12,
                            marginTop: 3,
                          }}
                        >
                          {t('actionLog.refused')}: {item.reason}
                        </div>
                      )}
                    </div>

                    <span
                      style={{
                        color: 'var(--app-text-muted)',
                        fontSize: 12,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {formatMoment(item.createdAt, locale)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {!isLoading && nextBefore && (
            <button
              type="button"
              style={{
                marginTop: 16,
                minHeight: 40,
                padding: '0 16px',
                border: '1px solid rgba(var(--app-ink-rgb),0.12)',
                borderRadius: 12,
                background: 'rgba(var(--app-ink-rgb),0.05)',
                color: 'var(--app-text)',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
              }}
              onClick={() => void loadMore()}
              disabled={isLoadingMore}
            >
              {isLoadingMore ? t('common.loading') : t('actionLog.loadMore')}
            </button>
          )}
        </section>
      </main>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </AppLayout>
  );
}

export default ActionLogPage;
