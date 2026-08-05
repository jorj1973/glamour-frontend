import { useEffect, useState } from 'react';
import {
  BarChart3,
  CalendarDays,
  CreditCard,
  Gift,
  Link2,
  Percent,
  RefreshCw,
  Scissors,
  Star,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import api from '../api/api';
import AppLayout from '../components/AppLayout';

type SalonSummary = { id: string; name: string; };

type TopMaster = {
  masterProfileId: string;
  profession: string;
  salonName: string;
  paymentsCount: number;
  revenue: number;
};

type TopService = {
  serviceId: string;
  name: string;
  durationMinutes: number;
  basePrice: number;
  bookingsCount: number;
  paymentsCount: number;
  revenue: number;
};

type Appointment = {
  id: string;
  startTime: string;
  endTime: string;
  status: string;
  clientName?: string;
  masterName?: string;
  serviceName?: string;
};

type DashboardData = {
  revenueToday: number;
  revenueMonth: number;
  appointmentsToday: number;
  clientsTotal: number;
  activeGiftCards: number;
  activePromoCodes: number;
  loyaltyClients: number;
  paymentsCount: number;
  averageTicket: number;
  topMasters: TopMaster[];
  topServices: TopService[];
};

const STATUS_COLOR: Record<string, string> = {
  pending: '#ffd08b',
  confirmed: '#a8c9ff',
  completed: '#8ee5b5',
  cancelled: '#ffb6c6',
};

const STATUS_LABEL: Record<string, string> = {
  pending: 'Ожидает',
  confirmed: 'Подтверждена',
  completed: 'Завершена',
  cancelled: 'Отменена',
};

function OwnerDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [salon, setSalon] = useState<SalonSummary | null>(null);
  const [upcoming, setUpcoming] = useState<Appointment[]>([]);
  const [message, setMessage] = useState('Загрузка данных панели управления…');
  const [isLoading, setIsLoading] = useState(false);

  async function loadDashboard() {
    setIsLoading(true);
    try {
      const salonsRes = await api.get<SalonSummary[]>('/salons/my');
      const currentSalon = salonsRes.data[0];
      if (!currentSalon) { setMessage('Для учётной записи не найден активный салон.'); return; }
      setSalon(currentSalon);

      const [dashRes, apptRes] = await Promise.allSettled([
        api.get<DashboardData>('/dashboard/owner', { params: { salonId: currentSalon.id } }),
        api.get<Appointment[]>('/appointments', { params: { salonId: currentSalon.id, limit: 5 } }),
      ]);

      if (dashRes.status === 'fulfilled') {
        setData(dashRes.value.data);
        setMessage('');
      } else {
        setMessage('Не удалось загрузить данные панели управления.');
      }

      if (apptRes.status === 'fulfilled') {
        setUpcoming(apptRes.value.data.slice(0, 5));
      }
    } catch {
      setMessage('Не удалось загрузить данные.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => { void loadDashboard(); }, []);

  if (message && !data) {
    return (
      <AppLayout>
        <main className="dashboard-page">
          <p className="dashboard-status">{message}</p>
        </main>
      </AppLayout>
    );
  }

  if (!data) return null;

  const metrics = [
    { label: 'Доход сегодня', value: `${data.revenueToday} MDL`, icon: <Wallet size={22} />, color: '#d682b8' },
    { label: 'Доход за месяц', value: `${data.revenueMonth} MDL`, icon: <TrendingUp size={22} />, color: '#d682b8' },
    { label: 'Записей сегодня', value: data.appointmentsToday, icon: <CalendarDays size={22} />, color: '#a8c9ff' },
    { label: 'Клиентов всего', value: data.clientsTotal, icon: <Users size={22} />, color: '#a8c9ff' },
    { label: 'Средний чек', value: `${data.averageTicket} MDL`, icon: <CreditCard size={22} />, color: '#8ee5b5' },
    { label: 'Сертификатов', value: data.activeGiftCards, icon: <Gift size={22} />, color: '#ffd08b' },
    { label: 'Промокодов', value: data.activePromoCodes, icon: <Percent size={22} />, color: '#ffd08b' },
    { label: 'Loyalty-клиентов', value: data.loyaltyClients, icon: <Star size={22} />, color: '#efb6d8' },
  ];

  return (
    <AppLayout>
      <main className="dashboard-page">
        {/* Header */}
        <header className="dashboard-header">
          <div>
            <p className="dashboard-eyebrow">GLAMOUR SALON STUDIO</p>
            <h1>Панель владельца</h1>
            <p className="dashboard-subtitle">
              Финансовые показатели, клиенты и ключевая активность салона.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <div className="dashboard-period">
              <span>Салон</span>
              <strong>{salon?.name ?? '—'}</strong>
            </div>
            <button
              type="button"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, minHeight: 46, padding: '0 14px', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 14, background: 'rgba(255,255,255,0.05)', color: '#d7ced8', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              onClick={() => void loadDashboard()}
              disabled={isLoading}
            >
              <RefreshCw size={15} style={isLoading ? { animation: 'spin 1s linear infinite' } : {}} />
              Обновить
            </button>
          </div>
        </header>

        {/* Метрики */}
        <section className="metrics-grid" aria-label="Ключевые показатели">
          {metrics.map((metric) => (
            <article className="metric-card" key={metric.label}>
              <div className="metric-icon" style={{ color: metric.color }}>{metric.icon}</div>
              <p>{metric.label}</p>
              <strong>{metric.value}</strong>
            </article>
          ))}
        </section>

        {/* Быстрые действия */}
        <section className="dashboard-panel" style={{ marginBottom: 24 }}>
          <div className="panel-heading">
            <div><p className="panel-kicker">УПРАВЛЕНИЕ</p><h2>Быстрые действия</h2></div>
            <BarChart3 size={22} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
            {[
              { label: 'Записи', icon: <CalendarDays size={18} />, hash: '#appointments' },
              { label: 'Клиенты', icon: <Users size={18} />, hash: '#clients' },
              { label: 'Мастера', icon: <Scissors size={18} />, hash: '#masters' },
              { label: 'Услуги', icon: <Scissors size={18} />, hash: '#services' },
              { label: 'Финансы', icon: <Wallet size={18} />, hash: '#finance' },
              { label: 'Ссылки', icon: <Link2 size={18} />, hash: '#promotion-links' },
            ].map((item) => (
              <button
                key={item.hash}
                type="button"
                onClick={() => { window.location.hash = item.hash; }}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, background: 'rgba(255,255,255,0.04)', color: '#d7ced8', fontSize: 13, fontWeight: 700, cursor: 'pointer', textAlign: 'left' }}
              >
                <span style={{ color: '#d682b8' }}>{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>
        </section>

        <section className="dashboard-columns">
          {/* Ближайшие записи */}
          <article className="dashboard-panel">
            <div className="panel-heading">
              <div><p className="panel-kicker">РАСПИСАНИЕ</p><h2>Ближайшие записи</h2></div>
              <CalendarDays size={22} />
            </div>
            {upcoming.length === 0 ? (
              <p className="empty-state">Записей пока нет.</p>
            ) : (
              <div className="ranking-list">
                {upcoming.map((apt) => (
                  <div className="ranking-row" key={apt.id}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 42, padding: '4px 8px', borderRadius: 10, background: 'rgba(255,255,255,0.04)' }}>
                      <strong style={{ color: '#fff7fc', fontSize: 13 }}>
                        {new Date(apt.startTime).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit' })}
                      </strong>
                      <span style={{ color: '#9d949f', fontSize: 11 }}>
                        {new Date(apt.startTime).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="ranking-main">
                      <strong>{apt.clientName ?? 'Клиент'}</strong>
                      <span>{apt.masterName ?? ''} · {apt.serviceName ?? 'Услуга'}</span>
                    </div>
                    <div className="ranking-value">
                      <span style={{ color: STATUS_COLOR[apt.status] ?? '#b9b0bb', fontSize: 12, fontWeight: 700 }}>
                        {STATUS_LABEL[apt.status] ?? apt.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ marginTop: 14 }}>
              <a href="#appointments" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#d7ced8', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
                <CalendarDays size={14} /> Все записи
              </a>
            </div>
          </article>

          {/* Топ мастера */}
          <article className="dashboard-panel">
            <div className="panel-heading">
              <div><p className="panel-kicker">ВЫРУЧКА</p><h2>Топ мастера</h2></div>
              <Scissors size={22} />
            </div>
            {data.topMasters.length === 0 ? (
              <p className="empty-state">Пока нет данных по мастерам.</p>
            ) : (
              <div className="ranking-list">
                {data.topMasters.map((master, index) => (
                  <div className="ranking-row" key={master.masterProfileId}>
                    <span className="ranking-number">{index + 1}</span>
                    <div className="ranking-main">
                      <strong>{master.profession}</strong>
                      <span>{master.salonName}</span>
                    </div>
                    <div className="ranking-value">
                      <strong style={{ color: '#d682b8' }}>{master.revenue} MDL</strong>
                      <span>{master.paymentsCount} платежей</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </article>
        </section>

        {/* Топ услуг */}
        <article className="dashboard-panel" style={{ marginTop: 24 }}>
          <div className="panel-heading">
            <div><p className="panel-kicker">ПОПУЛЯРНЫЕ</p><h2>Топ услуг</h2></div>
            <TrendingUp size={22} />
          </div>
          {data.topServices.length === 0 ? (
            <p className="empty-state">Пока нет данных по услугам.</p>
          ) : (
            <div className="ranking-list">
              {data.topServices.map((service, index) => (
                <div className="ranking-row" key={service.serviceId}>
                  <span className="ranking-number">{index + 1}</span>
                  <div className="ranking-main">
                    <strong>{service.name}</strong>
                    <span>{service.durationMinutes} мин · базовая цена {service.basePrice} MDL</span>
                  </div>
                  <div className="ranking-value">
                    <strong style={{ color: '#d682b8' }}>{service.revenue} MDL</strong>
                    <span>{service.bookingsCount} записей</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>
      </main>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </AppLayout>
  );
}

export default OwnerDashboardPage;
