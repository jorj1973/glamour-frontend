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
import api from '../api/api';
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

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  paid: { label: 'Оплачено', color: '#8ee5b5', icon: <Check size={13} /> },
  pending: { label: 'Ожидает', color: '#ffd08b', icon: <Clock size={13} /> },
  refunded: { label: 'Возврат', color: '#a8c9ff', icon: <ArrowDownLeft size={13} /> },
  failed: { label: 'Ошибка', color: '#ffb6c6', icon: <X size={13} /> },
};

const METHOD_LABELS: Record<string, string> = {
  cash: 'Наличные',
  card: 'Карта',
  online: 'Онлайн',
  gift_card: 'Сертификат',
  mia: 'MIA Pay',
};

function FinancePage() {
  const workspaceMode = getWorkspaceMode();
  const isMasterWorkspace = workspaceMode === 'master';

  const [salon, setSalon] = useState<SalonSummary | null>(null);
  const [data, setData] = useState<PaymentsDashboard | null>(null);
  const [message, setMessage] = useState('Загрузка финансов...');
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
      const endpoint = isMasterWorkspace ? '/payments/dashboard/master' : '/payments/dashboard';
      const res = await api.get<PaymentsDashboard>(endpoint, { params: { salonId } });
      setData(res.data);
      setMessage('');
    } catch {
      // Попробуем общий endpoint
      try {
        const res = await api.get<PaymentsDashboard>('/payments/dashboard', { params: { salonId } });
        setData(res.data);
        setMessage('');
      } catch {
        setMessage('Не удалось загрузить финансовые данные.');
      }
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
        if (!s) { setMessage('Салон не найден.'); return; }
        await loadFinance(s.id);
      } catch {
        if (!cancelled) setMessage('Не удалось загрузить данные.');
      }
    }
    void init();
    return () => { cancelled = true; };
  }, [isMasterWorkspace]);

  return (
    <AppLayout>
      <main className="dashboard-page">
        <header className="dashboard-header">
          <div>
            <p className="dashboard-eyebrow">{isMasterWorkspace ? 'МОИ ДОХОДЫ' : 'ФИНАНСЫ'}</p>
            <h1>{isMasterWorkspace ? 'Мои доходы' : 'Финансовая панель'}</h1>
            <p className="dashboard-subtitle">
              {isMasterWorkspace
                ? 'Ваша выручка, платежи и финансовая статистика.'
                : 'Выручка салона, платежи, средний чек и последние операции.'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div className="dashboard-period">
              <span>Период</span>
              <strong>Сегодня / месяц</strong>
            </div>
            <button
              type="button"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, minHeight: 46, padding: '0 14px', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 14, background: 'rgba(255,255,255,0.05)', color: '#d7ced8', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              onClick={() => salon && loadFinance(salon.id)}
              disabled={isLoading}
            >
              <RefreshCw size={15} style={isLoading ? { animation: 'spin 1s linear infinite' } : {}} />
              Обновить
            </button>
          </div>
        </header>

        {message && !data ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '60px 20px', color: '#9d949f', textAlign: 'center' }}>
            <CreditCard size={40} style={{ color: '#d682b8', opacity: 0.4 }} />
            <p>{message}</p>
            <p style={{ fontSize: 13 }}>Финансовые данные появятся после первых платежей.</p>
          </div>
        ) : data ? (
          <>
            {/* Метрики */}
            <section className="metrics-grid" aria-label="Финансовые показатели">
              {[
                { label: 'Доход сегодня', value: `${data.revenueToday} MDL`, icon: <Wallet size={22} /> },
                { label: 'Доход за месяц', value: `${data.revenueMonth} MDL`, icon: <TrendingUp size={22} /> },
                { label: 'Средний чек', value: `${data.averageTicket} MDL`, icon: <CreditCard size={22} /> },
                { label: 'Всего платежей', value: data.paymentsCount, icon: <CreditCard size={22} /> },
                { label: 'Наличные сегодня', value: `${data.cashToday} MDL`, icon: <Wallet size={22} /> },
                { label: 'Картой сегодня', value: `${data.cardToday} MDL`, icon: <CreditCard size={22} /> },
                { label: 'Онлайн сегодня', value: `${data.onlineToday} MDL`, icon: <CreditCard size={22} /> },
                { label: 'Сертификаты', value: `${data.giftCardToday} MDL`, icon: <Gift size={22} /> },
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
                  <div><p className="panel-kicker">СТАТУСЫ</p><h2>Платежи</h2></div>
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
                  <div style={{ marginTop: 16, padding: '12px 14px', borderRadius: 12, background: 'rgba(214,130,184,0.08)', border: '1px solid rgba(214,130,184,0.15)' }}>
                    <p style={{ color: '#9d949f', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', marginBottom: 4 }}>ПОПУЛЯРНЫЙ СПОСОБ ОПЛАТЫ</p>
                    <strong style={{ color: '#efb6d8', fontSize: 14 }}>
                      {METHOD_LABELS[data.topPaymentMethod] ?? data.topPaymentMethod}
                    </strong>
                  </div>
                )}
              </article>

              {/* Последние операции */}
              <article className="dashboard-panel">
                <div className="panel-heading">
                  <div><p className="panel-kicker">ПОСЛЕДНИЕ ОПЕРАЦИИ</p><h2>История</h2></div>
                  <Wallet size={22} />
                </div>

                {data.recentPayments.length === 0 ? (
                  <div style={{ padding: '32px 0', textAlign: 'center' }}>
                    <p className="empty-state">Платежей пока нет.</p>
                  </div>
                ) : (
                  <div className="ranking-list">
                    {data.recentPayments.map((payment, index) => {
                      const cfg = STATUS_CONFIG[payment.status] ?? { label: payment.status, color: '#b9b0bb', icon: null };
                      return (
                        <div className="ranking-row" key={payment.id}>
                          <span className="ranking-number">{index + 1}</span>
                          <div className="ranking-main">
                            <strong style={{ color: '#fff7fc', fontSize: 15 }}>
                              {Number(payment.amount).toFixed(0)} MDL
                            </strong>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span>{METHOD_LABELS[payment.paymentMethod] ?? payment.paymentMethod}</span>
                              <span style={{ color: cfg.color, fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                {cfg.icon}{cfg.label}
                              </span>
                            </span>
                            {payment.note && <span style={{ color: '#9d949f', fontSize: 12 }}>{payment.note}</span>}
                          </div>
                          <div className="ranking-value">
                            <strong style={{ fontSize: 12 }}>
                              {new Date(payment.createdAt).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}
                            </strong>
                            <span style={{ fontSize: 11 }}>
                              {new Date(payment.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
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
