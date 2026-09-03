import { useEffect, useState } from 'react';
import {
  ArrowDownLeft,
  Check,
  Clock,
  CreditCard,
  Gift,
  RefreshCw,
  TrendingUp,
  Wallet,
  X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../api/api';
import { getErrorKey } from '../api/errorMessage';
import AppLayout from '../components/AppLayout';

type WorkspaceMode = 'platform' | 'salon' | 'master';

type SalonSummary = {
  id: string;
  name: string;
  membershipRole?: string | null;
  membershipRoles?: string[];
  membershipStatus?: string | null;
};

type Payment = {
  id: string;
  appointmentId: string;
  clientUserId: string;
  masterProfileId: string;
  amount: string;
  status: string;
  paymentMethod: string;
  transactionId: string | null;
  note: string | null;
  createdAt: string;
};

type PaymentsDashboard = {
  revenueToday: number;
  revenueMonth: number;
  cashToday: number;
  cardToday: number;
  onlineToday: number;
  giftCardToday: number;
  pendingPayments: number;
  paidPayments: number;
  refundedPayments: number;
  failedPayments: number;
  averageTicket: number;
  paymentsCount: number;
  topPaymentMethod: string | null;
  recentPayments: Payment[];
};

const WORKSPACE_MODE_KEY = 'glamour_workspace_mode';
const CURRENT_SALON_ID_KEY = 'glamour_current_salon_id';

function getWorkspaceMode(): WorkspaceMode {
  const mode = localStorage.getItem(WORKSPACE_MODE_KEY);
  if (mode === 'platform' || mode === 'salon' || mode === 'master') return mode;
  return 'salon';
}

function getStatusConfig(t: (key: string) => string): Record<string, { label: string; color: string; icon: React.ReactNode }> {
  return {
    paid: { label: t('finance.paid'), color: '#8ee5b5', icon: <Check size={13} /> },
    pending: { label: t('finance.pending'), color: '#ffd08b', icon: <Clock size={13} /> },
    refunded: { label: t('finance.refunded'), color: '#a8c9ff', icon: <ArrowDownLeft size={13} /> },
    failed: { label: t('finance.failed'), color: 'var(--app-accent-strong)', icon: <X size={13} /> },
  };
}

function getMethodLabels(t: (key: string) => string): Record<string, string> {
  return {
    cash: t('finance.cash'),
    card: t('finance.card'),
    online: t('finance.online'),
    gift_card: t('finance.gift_card'),
    mia: t('finance.mia'),
  };
}

function FinancePage() {
  const workspaceMode = getWorkspaceMode();
  const { t, i18n } = useTranslation();
  const STATUS_CONFIG = getStatusConfig(t);
  const METHOD_LABELS = getMethodLabels(t);
  const dateLocale = i18n.language?.startsWith('ro') ? 'ro-RO' : i18n.language?.startsWith('en') ? 'en-GB' : 'ru-RU';
  const isMasterWorkspace = workspaceMode === 'master';

  const [salon, setSalon] = useState<SalonSummary | null>(null);
  const [data, setData] = useState<PaymentsDashboard | null>(null);
  const [message, setMessage] = useState(t('finance.loading'));
  const [isLoading, setIsLoading] = useState(false);

  async function loadSalon(): Promise<SalonSummary | null> {
    const res = await api.get<SalonSummary[]>('/salons/my');
    if (res.data.length === 0) return null;
    if (!isMasterWorkspace) return res.data[0] ?? null;
    const masterSalons = res.data.filter(
      (s) => s.membershipStatus === 'active' &&
        (s.membershipRoles?.includes('master') || s.membershipRole === 'master'),
    );
    if (masterSalons.length === 0) return null;
    const savedId = localStorage.getItem(CURRENT_SALON_ID_KEY);
    const found = savedId ? masterSalons.find((s) => s.id === savedId) : undefined;
    return found ?? masterSalons[0];
  }

  async function loadFinance(salonId: string) {
    setIsLoading(true);
    try {
      // Запасной вызов общего эндпоинта убран: мастер получал 404,
      // молча проваливался на /payments/dashboard и видел выручку
      // всего салона вместо своей.
      const endpoint = isMasterWorkspace
        ? '/payments/dashboard/master/me'
        : '/payments/dashboard';

      const res = await api.get<PaymentsDashboard>(endpoint, { params: { salonId } });
      setData(res.data);
      setMessage('');
    } catch (error) {
      setMessage(t(getErrorKey(error)));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        const s = await loadSalon();
        if (cancelled) return;
        setSalon(s);
        if (!s) { setMessage(t('finance.salonNotFound')); return; }
        await loadFinance(s.id);
      } catch {
        if (!cancelled) setMessage(t('finance.dataError'));
      }
    }
    void init();
    return () => { cancelled = true; };
  }, [isMasterWorkspace]);

  return (
    <AppLayout>
      <main className="dashboard-page">
        <header className="dashboard-header centered-header">
          <div>
            <h1>{isMasterWorkspace ? t('finance.myTitle') : t('finance.title')}</h1>
            <p className="dashboard-subtitle">
              {isMasterWorkspace
                ? t('finance.mySubtitle')
                : t('finance.subtitle')}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div className="dashboard-period">
              <span>{t("dashboard.period")}</span>
              <strong>{t("dashboard.currentMonth")}</strong>
            </div>
            <button
              type="button"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, minHeight: 46, padding: '0 14px', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 14, background: 'rgba(255,255,255,0.05)', color: 'var(--app-text)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              onClick={() => salon && loadFinance(salon.id)}
              disabled={isLoading}
            >
              <RefreshCw size={15} style={isLoading ? { animation: 'spin 1s linear infinite' } : {}} />
              {t('finance.refresh')}
            </button>
          </div>
        </header>

        {message && !data ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '60px 20px', color: 'var(--app-text-muted)', textAlign: 'center' }}>
            <CreditCard size={40} style={{ color: 'var(--app-accent-text)', opacity: 0.4 }} />
            <p>{message}</p>
            <p style={{ fontSize: 13 }}>{t("finance.noData")}</p>
          </div>
        ) : data ? (
          <>
            {/* Метрики */}
            <section className="metrics-grid" aria-label={t('finance.financialMetrics')}>
              {[
                { label: t('finance.revenueToday'), value: `${data.revenueToday} MDL`, icon: <Wallet size={22} /> },
                { label: t('finance.revenueMonth'), value: `${data.revenueMonth} MDL`, icon: <TrendingUp size={22} /> },
                { label: t('finance.averageTicket'), value: `${data.averageTicket} MDL`, icon: <CreditCard size={22} /> },
                { label: t('finance.totalPayments'), value: data.paymentsCount, icon: <CreditCard size={22} /> },
                { label: t('finance.cashToday'), value: `${data.cashToday} MDL`, icon: <Wallet size={22} /> },
                { label: t('finance.cardToday'), value: `${data.cardToday} MDL`, icon: <CreditCard size={22} /> },
                { label: t('finance.onlineToday'), value: `${data.onlineToday} MDL`, icon: <CreditCard size={22} /> },
                { label: t('finance.certificates'), value: `${data.giftCardToday} MDL`, icon: <Gift size={22} /> },
              ].map((m) => (
                <article className="metric-card" key={m.label}>
                  <div className="metric-icon">{m.icon}</div>
                  <p>{m.label}</p>
                  <strong>{m.value}</strong>
                </article>
              ))}
            </section>

            <section className="dashboard-columns">
              {/* Статусы платежей */}
              <article className="dashboard-panel">
                <div className="panel-heading">
                  <div><p className="panel-kicker">{t("finance.statuses").toUpperCase()}</p><h2>{t("finance.title")}</h2></div>
                  <CreditCard size={22} />
                </div>

                <div className="ranking-list">
                  {[
                    { key: 'paid', count: data.paidPayments },
                    { key: 'pending', count: data.pendingPayments },
                    { key: 'refunded', count: data.refundedPayments },
                    { key: 'failed', count: data.failedPayments },
                  ].map((item) => {
                    const cfg = STATUS_CONFIG[item.key];
                    return (
                      <div className="ranking-row" key={item.key}>
                        <span className="ranking-number" style={{ color: cfg.color }}>{cfg.icon}</span>
                        <div className="ranking-main">
                          <strong>{cfg.label}</strong>
                        </div>
                        <div className="ranking-value">
                          <strong style={{ color: cfg.color, fontSize: 18 }}>{item.count}</strong>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {data.topPaymentMethod && (
                  <div style={{ marginTop: 16, padding: '12px 14px', borderRadius: 12, background: 'rgba(var(--app-accent-rgb), 0.08)', border: '1px solid rgba(var(--app-accent-rgb), 0.15)' }}>
                    <p style={{ color: 'var(--app-text-muted)', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', marginBottom: 4 }}>{t('finance.topMethod')}</p>
                    <strong style={{ color: 'var(--app-accent-strong)', fontSize: 14 }}>
                      {METHOD_LABELS[data.topPaymentMethod] ?? data.topPaymentMethod}
                    </strong>
                  </div>
                )}
              </article>

              {/* Последние операции */}
              <article className="dashboard-panel">
                <div className="panel-heading">
                  <div><p className="panel-kicker">{t("finance.recentOps").toUpperCase()}</p><h2>{t("finance.history")}</h2></div>
                  <Wallet size={22} />
                </div>

                {data.recentPayments.length === 0 ? (
                  <div style={{ padding: '32px 0', textAlign: 'center' }}>
                    <p className="empty-state">{t("finance.noPayments")}</p>
                  </div>
                ) : (
                  <div className="ranking-list">
                    {data.recentPayments.map((payment, index) => {
                      const cfg = STATUS_CONFIG[payment.status] ?? { label: payment.status, color: 'var(--app-text-muted)', icon: null };
                      return (
                        <div className="ranking-row" key={payment.id}>
                          <span className="ranking-number">{index + 1}</span>
                          <div className="ranking-main">
                            <strong style={{ color: 'var(--app-text)', fontSize: 15 }}>
                              {Number(payment.amount).toFixed(0)} MDL
                            </strong>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span>{METHOD_LABELS[payment.paymentMethod] ?? payment.paymentMethod}</span>
                              <span style={{ color: cfg.color, fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                {cfg.icon}{cfg.label}
                              </span>
                            </span>
                            {payment.note && <span style={{ color: 'var(--app-text-muted)', fontSize: 12 }}>{payment.note}</span>}
                          </div>
                          <div className="ranking-value">
                            <strong style={{ fontSize: 12 }}>
                              {new Date(payment.createdAt).toLocaleDateString(dateLocale, { day: '2-digit', month: '2-digit' })}
                            </strong>
                            <span style={{ fontSize: 11 }}>
                              {new Date(payment.createdAt).toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </article>
            </section>
          </>
        ) : null}
      </main>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </AppLayout>
  );
}

export default FinancePage;
