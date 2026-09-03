import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import WelcomeDialog from '../components/WelcomeDialog';
import AppLayout from '../components/AppLayout';

type SalonSummary = { id: string; name: string; };
type TopMaster = { masterProfileId: string; profession: string; salonName: string; paymentsCount: number; revenue: number; };
type TopService = { serviceId: string; name: string; durationMinutes: number; basePrice: number; bookingsCount: number; paymentsCount: number; revenue: number; };
type Appointment = { id: string; startTime: string; endTime: string; status: string; clientName?: string; masterName?: string; serviceName?: string; };
type DashboardData = { revenueToday: number; revenueMonth: number; appointmentsToday: number; clientsTotal: number; activeGiftCards: number; activePromoCodes: number; loyaltyClients: number; paymentsCount: number; averageTicket: number; topMasters: TopMaster[]; topServices: TopService[]; salonHealth?: SalonHealth; };

/** Заполненность профиля салона: процент и список пунктов. */
type SalonHealth = {
  percent: number;
  items: { key: string; weight: number; done: boolean; blocking: boolean }[];
};

/**
 * Цвет по проценту: плавный переход от красного через
 * оранжевый к зелёному. Ступени были бы грубее — на полосе
 * разница между 45% и 65% должна быть видна.
 */
function healthColor(percent: number): string {
  const hue = Math.round((percent / 100) * 130);

  return 'hsl(' + hue + ', 70%, 55%)';
}

const STATUS_COLOR: Record<string, string> = { pending: '#ffd08b', confirmed: '#a8c9ff', completed: '#8ee5b5', cancelled: 'var(--app-accent-strong)' };

function OwnerDashboardPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<DashboardData | null>(null);
  const [salon, setSalon] = useState<SalonSummary | null>(null);
  const [upcoming, setUpcoming] = useState<Appointment[]>([]);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  async function loadDashboard() {
    setIsLoading(true);
    try {
      const salonsRes = await api.get<SalonSummary[]>('/salons/my');
      const currentSalon = salonsRes.data[0];
      if (!currentSalon) { setMessage(t('dashboard.noSalon')); return; }
      setSalon(currentSalon);
      const [dashRes, apptRes] = await Promise.allSettled([
        api.get<DashboardData>('/dashboard/owner', { params: { salonId: currentSalon.id } }),
        api.get<Appointment[]>('/appointments', { params: { salonId: currentSalon.id, limit: 5 } }),
      ]);
      if (dashRes.status === 'fulfilled') { setData(dashRes.value.data); setMessage(''); }
      else setMessage(t('common.loadError'));
      if (apptRes.status === 'fulfilled') setUpcoming(apptRes.value.data.slice(0, 5));
    } catch { setMessage(t('common.loadError')); }
    finally { setIsLoading(false); }
  }

  useEffect(() => { void loadDashboard(); }, []);

  if (message && !data) return <AppLayout><main className="dashboard-page"><p className="dashboard-status">{message}</p></main></AppLayout>;
  if (!data) return null;

  const metrics = [
    { label: t('dashboard.revenueToday'), value: `${data.revenueToday} MDL`, icon: <Wallet size={22} /> },
    { label: t('dashboard.revenueMonth'), value: `${data.revenueMonth} MDL`, icon: <TrendingUp size={22} /> },
    { label: t('dashboard.appointmentsToday'), value: data.appointmentsToday, icon: <CalendarDays size={22} /> },
    { label: t('dashboard.clientsTotal'), value: data.clientsTotal, icon: <Users size={22} /> },
    { label: t('dashboard.averageTicket'), value: `${data.averageTicket} MDL`, icon: <CreditCard size={22} /> },
    { label: t('dashboard.certificates'), value: data.activeGiftCards, icon: <Gift size={22} /> },
    { label: t('dashboard.promoCodes'), value: data.activePromoCodes, icon: <Percent size={22} /> },
    { label: t('dashboard.loyaltyClients'), value: data.loyaltyClients, icon: <Star size={22} /> },
  ];

  const quickActions = [
    { label: t('nav.appointments'), icon: <CalendarDays size={18} />, hash: '#appointments' },
    { label: t('nav.clients'), icon: <Users size={18} />, hash: '#clients' },
    { label: t('nav.masters'), icon: <Scissors size={18} />, hash: '#masters' },
    { label: t('nav.services'), icon: <Scissors size={18} />, hash: '#services' },
    { label: t('nav.finance'), icon: <Wallet size={18} />, hash: '#finance' },
    { label: t('nav.links'), icon: <Link2 size={18} />, hash: '#promotion-links' },
  ];

  const statusLabels: Record<string, string> = {
    pending: t('appointments.status.pending'),
    confirmed: t('appointments.status.confirmed'),
    completed: t('appointments.status.completed'),
    cancelled: t('appointments.status.cancelled'),
  };

  return (
    <AppLayout>
      <WelcomeDialog
        role="salon"
        doneKeys={(data?.salonHealth?.items ?? [])
          .filter((item) => item.done)
          .map((item) =>
            item.key === 'services'
              ? 'salonServices'
              : item.key === 'masters'
                ? 'salonMasters'
                : 'salonInfo',
          )}
      />

      <main className="dashboard-page">
        <header className="dashboard-header">
          <div>
            <h1>{t('dashboard.ownerTitle')}</h1>
            <p className="dashboard-subtitle">{t('dashboard.ownerSubtitle')}</p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div className="dashboard-period">
              <span>{t('dashboard.salon')}</span>
              <strong>{salon?.name ?? '—'}</strong>
            </div>
            <button type="button" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, minHeight: 46, padding: '0 14px', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 14, background: 'rgba(255,255,255,0.05)', color: 'var(--app-text)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }} onClick={() => void loadDashboard()} disabled={isLoading}>
              <RefreshCw size={15} style={isLoading ? { animation: 'spin 1s linear infinite' } : {}} />
              {t('common.refresh')}
            </button>
          </div>
        </header>

        {/* Заполненность салона.
            Без услуг и мастеров клиенту не на что записаться,
            но в кабинете это ничем не показано. */}
        {data?.salonHealth && data.salonHealth.percent < 100 && (
          <section
            style={{
              padding: 18,
              marginBottom: 20,
              borderRadius: 16,
              border: '1px solid var(--app-border)',
              background: 'var(--app-panel)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                gap: 12,
                marginBottom: 10,
              }}
            >
              <strong style={{ color: 'var(--app-text)', fontSize: 15 }}>
                {t('health.salonTitle')}
              </strong>

              <span
                style={{
                  color: healthColor(data.salonHealth.percent),
                  fontSize: 20,
                  fontWeight: 800,
                }}
              >
                {data.salonHealth.percent}%
              </span>
            </div>

            <div
              style={{
                height: 10,
                borderRadius: 999,
                background: 'var(--app-input)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: data.salonHealth.percent + '%',
                  height: '100%',
                  borderRadius: 999,
                  background: healthColor(data.salonHealth.percent),
                  transition: 'width 0.4s',
                }}
              />
            </div>

            <ul
              style={{
                margin: '14px 0 0',
                padding: 0,
                listStyle: 'none',
                display: 'grid',
                gap: 7,
              }}
            >
              {data.salonHealth.items
                .filter((item) => !item.done)
                .map((item) => (
                  <li
                    key={item.key}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      color: 'var(--app-text-muted)',
                      fontSize: 13,
                    }}
                  >
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: item.blocking ? '#ff6b8a' : 'var(--app-text-muted)',
                        flexShrink: 0,
                      }}
                    />

                    {t('health.salon.' + item.key)}

                    {item.blocking && (
                      <em
                        style={{
                          color: '#ff6b8a',
                          fontSize: 12,
                          fontStyle: 'normal',
                        }}
                      >
                        {t('health.blockingSalon')}
                      </em>
                    )}
                  </li>
                ))}
            </ul>
          </section>
        )}
        <section className="metrics-grid">
          {metrics.map((m) => (
            <article className="metric-card" key={m.label}>
              <div className="metric-icon">{m.icon}</div>
              <p>{m.label}</p>
              <strong>{m.value}</strong>
            </article>
          ))}
        </section>

        <section className="dashboard-panel" style={{ marginBottom: 24 }}>
          <div className="panel-heading">
            <div><p className="panel-kicker">{t('dashboard.quickActions').toUpperCase()}</p><h2>{t('dashboard.quickActions')}</h2></div>
            <BarChart3 size={22} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
            {quickActions.map((item) => (
              <button key={item.hash} type="button" onClick={() => { window.location.hash = item.hash; }} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, background: 'rgba(255,255,255,0.04)', color: 'var(--app-text)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                <span style={{ color: 'var(--app-accent-text)' }}>{item.icon}</span>{item.label}
              </button>
            ))}
          </div>
        </section>

        <section className="dashboard-columns">
          <article className="dashboard-panel">
            <div className="panel-heading">
              <div><p className="panel-kicker">{t('appointments.schedule').toUpperCase()}</p><h2>{t('dashboard.upcomingAppointments')}</h2></div>
              <CalendarDays size={22} />
            </div>
            {upcoming.length === 0 ? <p className="empty-state">{t('dashboard.noAppointments')}</p> : (
              <div className="ranking-list">
                {upcoming.map((apt) => (
                  <div className="ranking-row" key={apt.id}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 42, padding: '4px 8px', borderRadius: 10, background: 'rgba(255,255,255,0.04)' }}>
                      <strong style={{ color: 'var(--app-text)', fontSize: 13 }}>{new Date(apt.startTime).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit' })}</strong>
                      <span style={{ color: 'var(--app-text-muted)', fontSize: 11 }}>{new Date(apt.startTime).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div className="ranking-main">
                      <strong>{apt.clientName ?? t('appointments.client')}</strong>
                      <span>{apt.masterName ?? ''} · {apt.serviceName ?? t('appointments.service')}</span>
                    </div>
                    <div className="ranking-value">
                      <span style={{ color: STATUS_COLOR[apt.status] ?? 'var(--app-text-muted)', fontSize: 12, fontWeight: 700 }}>{statusLabels[apt.status] ?? apt.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ marginTop: 14 }}>
              <a href="#appointments" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'var(--app-text)', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
                <CalendarDays size={14} /> {t('nav.appointments')}
              </a>
            </div>
          </article>

          <article className="dashboard-panel">
            <div className="panel-heading">
              <div><p className="panel-kicker">{t('dashboard.topMasters').toUpperCase()}</p><h2>{t('dashboard.topMasters')}</h2></div>
              <Scissors size={22} />
            </div>
            {data.topMasters.length === 0 ? <p className="empty-state">{t('dashboard.noMastersData')}</p> : (
              <div className="ranking-list">
                {data.topMasters.map((master, i) => (
                  <div className="ranking-row" key={master.masterProfileId}>
                    <span className="ranking-number">{i + 1}</span>
                    <div className="ranking-main"><strong>{master.profession}</strong><span>{master.salonName}</span></div>
                    <div className="ranking-value"><strong style={{ color: 'var(--app-accent-text)' }}>{master.revenue} MDL</strong><span>{master.paymentsCount}</span></div>
                  </div>
                ))}
              </div>
            )}
          </article>
        </section>

        <article className="dashboard-panel" style={{ marginTop: 24 }}>
          <div className="panel-heading">
            <div><p className="panel-kicker">{t('dashboard.topServices').toUpperCase()}</p><h2>{t('dashboard.topServices')}</h2></div>
            <TrendingUp size={22} />
          </div>
          {data.topServices.length === 0 ? <p className="empty-state">{t('dashboard.noServicesData')}</p> : (
            <div className="ranking-list">
              {data.topServices.map((s, i) => (
                <div className="ranking-row" key={s.serviceId}>
                  <span className="ranking-number">{i + 1}</span>
                  <div className="ranking-main"><strong>{s.name}</strong><span>{s.durationMinutes} {t('services.duration')} · {s.basePrice} MDL</span></div>
                  <div className="ranking-value"><strong style={{ color: 'var(--app-accent-text)' }}>{s.revenue} MDL</strong><span>{s.bookingsCount}</span></div>
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
