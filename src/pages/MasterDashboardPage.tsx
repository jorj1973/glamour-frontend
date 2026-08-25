import { useEffect, useState } from 'react';
import {
  CalendarDays,
  Check,
  ClipboardCopy,
  Clock3,
  ExternalLink,
  Link2,
  QrCode,
  Scissors,
  Share2,
  Star,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../api/api';
import WelcomeDialog from '../components/WelcomeDialog';
import AppLayout from '../components/AppLayout';

type SalonSummary = {
  id: string;
  name: string;
  slug?: string;
  membershipRole?: string;
  membershipStatus?: string;
};

// Имена полей соответствуют ответу GET /dashboard/master/me.
// Прежний тип описывал несуществующие поля, из-за чего
// на дашборде показывались нули.
/**
 * Цвет полосы по проценту: красный — почти пусто,
 * жёлтый — половина, зелёный — заполнено.
 */
function healthColor(percent: number): string {
  if (percent < 40) return '#ff6b8a';
  if (percent < 70) return '#ffb020';
  if (percent < 100) return '#8ee5b5';

  return '#4dd08b';
}

type MasterStats = {
  masterProfileId: string;
  todayAppointments: number;
  upcomingAppointments: unknown[];
  todayRevenue: number;
  monthRevenue: number;
  clientsCount: number;
  paymentsCount: number;
  averageRating: number | null;

  /** Заполненность профиля: процент и список пунктов. */
  profileHealth?: {
    percent: number;
    items: {
      key: string;
      weight: number;
      done: boolean;
      blocking: boolean;
    }[];
  };
};

type Appointment = {
  id: string;
  startTime: string;
  endTime: string;
  status: string;
  clientName?: string;
  serviceName?: string;
};

type PromotionLink = {
  id?: string;
  code?: string;
  slug?: string | null;
  url?: string;
  publicUrl?: string;
  registrationUrl?: string;
};

const CURRENT_SALON_ID_KEY = 'glamour_current_salon_id';

function getPromoUrl(data: PromotionLink, baseUrl: string): string {
  const identifier = data.slug?.trim() || data.code?.trim() || '';
  if (identifier) {
    return `${baseUrl}/#book?identifier=${encodeURIComponent(identifier)}`;
  }
  return data.publicUrl ?? data.registrationUrl ?? data.url ?? '';
}

function MasterDashboardPage() {
  const { t, i18n } = useTranslation();
  const dateLocale = i18n.language?.startsWith('ro') ? 'ro-RO' : i18n.language?.startsWith('en') ? 'en-GB' : 'ru-RU';
  const [salon, setSalon] = useState<SalonSummary | null>(null);
  const [stats, setStats] = useState<MasterStats | null>(null);
  const [upcoming, setUpcoming] = useState<Appointment[]>([]);
  const [promoUrl, setPromoUrl] = useState('');
  const [promoLoading, setPromoLoading] = useState(false);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle');
  const [isLoading, setIsLoading] = useState(true);

  // Slug форма
  const [slugInput, setSlugInput] = useState('');
  const [slugSaving, setSlugSaving] = useState(false);
  const [slugError, setSlugError] = useState('');
  const [slugSuccess, setSlugSuccess] = useState('');
  const [currentSlug, setCurrentSlug] = useState('');

  const baseUrl = window.location.origin;

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    setIsLoading(true);
    try {
      const salonsRes = await api.get<SalonSummary[]>('/salons/my');
      const masterSalons = salonsRes.data.filter((s) => s.membershipStatus === 'active');
      const savedId = localStorage.getItem(CURRENT_SALON_ID_KEY);
      const currentSalon = (savedId ? masterSalons.find((s) => s.id === savedId) : undefined) ?? masterSalons[0] ?? null;
      setSalon(currentSalon);
      if (!currentSalon) return;
      await Promise.allSettled([
        loadStats(currentSalon.id),
        loadUpcoming(currentSalon.id),
        loadPromoLink(currentSalon.id),
      ]);
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }

  async function loadStats(salonId: string) {
    try {
      const res = await api.get<MasterStats>('/dashboard/master/me', { params: { salonId } });
      setStats(res.data);
    } catch { /* недоступно */ }
  }

  async function loadUpcoming(salonId: string) {
    try {
      const res = await api.get<Appointment[]>('/appointments', {
        params: { salonId, status: 'confirmed,pending', limit: 5 },
      });
      setUpcoming(res.data.slice(0, 5));
    } catch { setUpcoming([]); }
  }

  async function loadPromoLink(salonId: string) {
    setPromoLoading(true);
    try {
      // Сначала ищем существующие ссылки мастера
      const existing = await api.get<PromotionLink[]>(`/promotion-links/salon/${salonId}`);
      const masterLink = existing.data.find((l) => (l as any).ownerType === 'master' && ((l as any).targetType === 'master' || (l as any).targetType === 'booking'));
      if (masterLink) {
        const url = getPromoUrl(masterLink, baseUrl);
        setPromoUrl(url);
        if (masterLink.slug) {
          setCurrentSlug(masterLink.slug);
          setSlugInput(masterLink.slug);
        }
        return;
      }
      // Персональной ссылки ещё нет — мастер создаёт её, задав slug ниже.
      setPromoUrl('');
    } catch {
      setPromoUrl('');
    } finally {
      setPromoLoading(false);
    }
  }

  async function saveSlug() {
    if (!salon) return;
    const slug = slugInput.trim().toLowerCase();

    if (!slug) { setSlugError(t('promotion.enterSlug')); return; }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      setSlugError(t('promotion.slugFormat'));
      return;
    }
    if (slug.length < 3) { setSlugError(t('promotion.slugMin')); return; }
    if (slug.length > 50) { setSlugError(t('promotion.slugMax')); return; }

    setSlugSaving(true);
    setSlugError('');
    setSlugSuccess('');

    try {
      // Получаем masterProfileId
      const sessionRes = await api.get<any>('/auth/session');
      const currentUserId = sessionRes.data?.user?.id;
      const mastersRes = await api.get<any[]>('/masters', { params: { salonId: salon.id } });
      const myProfile = mastersRes.data.find((m: any) => m.userId === currentUserId) ?? mastersRes.data[0];

      await api.post('/promotion-links', {
        salonId: salon.id,
        ownerType: 'master',
        targetType: 'master',
        masterProfileId: myProfile?.id,
        targetId: myProfile?.id,
        title: `Запись к мастеру`,
        customSlug: slug,
        isActive: true,
      });

      setCurrentSlug(slug);
      setPromoUrl(`${baseUrl}/#book?identifier=${encodeURIComponent(slug)}`);
      setSlugSuccess(t('promotion.linkSaved'));
      setTimeout(() => setSlugSuccess(''), 3000);
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? '';
      if (msg.includes('already in use') || msg.includes('slug')) {
        setSlugError(t('promotion.slugTaken'));
      } else {
        setSlugError(t('promotion.slugSaveError'));
      }
    } finally {
      setSlugSaving(false);
    }
  }

  async function copyPromoUrl() {
    if (!promoUrl) return;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(promoUrl);
      } else {
        const ta = document.createElement('textarea');
        ta.value = promoUrl;
        ta.style.cssText = 'position:fixed;opacity:0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopyStatus('copied');
      setTimeout(() => setCopyStatus('idle'), 2500);
    } catch { /* ignore */ }
  }

  function shareVia(platform: string) {
    if (!promoUrl) return;
    const urls: Record<string, string> = {
      whatsapp: `https://wa.me/?text=${encodeURIComponent(t('promotion.shareText') + ': ' + promoUrl)}`,
      telegram: `https://t.me/share/url?url=${encodeURIComponent(promoUrl)}&text=${encodeURIComponent(t('promotion.shareText'))}`,
    };
    window.open(urls[platform], '_blank');
  }

  function formatDuration(start: string, end: string) {
    return Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000) + ' ' + t('services.min');
  }

  const statusColor: Record<string, string> = {
    pending: '#ffd08b', confirmed: '#a8c9ff', completed: '#8ee5b5', cancelled: 'var(--app-accent-strong)',
  };
  const statusLabel: Record<string, string> = {
    pending: t('appointments.status.pending'), confirmed: t('appointments.status.confirmed'), completed: t('appointments.status.completed'), cancelled: t('appointments.status.cancelled'),
  };

  // Шаги, которые уже сделаны, отмечаем — чтобы не звать
  // человека туда, где он уже был.
  const welcomeDone = (stats?.profileHealth?.items ?? [])
    .filter((item) => item.done)
    .map((item) => (item.key === 'photo' ? 'profile' : item.key));

  return (
    <AppLayout>
      <WelcomeDialog role="master" doneKeys={welcomeDone} />

      <main className="dashboard-page">
        <header className="dashboard-header">
          <div>
            <h1>{t("dashboard.masterTitle")}</h1>
            <p className="dashboard-subtitle">{t("dashboard.masterSubtitle")}</p>
          </div>
          <div className="dashboard-period">
            <span>{t("dashboard.salon")}</span>
            <strong>{salon?.name ?? '—'}</strong>
          </div>
        </header>

        {/* Заполненность профиля.
            Мастер без услуг или графика не появляется на странице
            записи, но в кабинете это ничем не показано: записей
            нет, причина не видна. */}
        {stats?.profileHealth && stats.profileHealth.percent < 100 && (
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
                {t('health.title')}
              </strong>

              <span
                style={{
                  color: healthColor(stats.profileHealth.percent),
                  fontSize: 20,
                  fontWeight: 800,
                }}
              >
                {stats.profileHealth.percent}%
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
                  width: stats.profileHealth.percent + '%',
                  height: '100%',
                  borderRadius: 999,
                  background: healthColor(stats.profileHealth.percent),
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
              {stats.profileHealth.items
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

                    {t('health.' + item.key)}

                    {item.blocking && (
                      <em
                        style={{
                          color: '#ff6b8a',
                          fontSize: 12,
                          fontStyle: 'normal',
                        }}
                      >
                        {t('health.blocking')}
                      </em>
                    )}
                  </li>
                ))}
            </ul>
          </section>
        )}
        {/* Метрики */}
        <section className="metrics-grid" aria-label={t('dashboard.personalMetrics')}>
          {[
            // Имена полей приведены к тому, что реально отдаёт бэкенд:
            // раньше фронтенд искал appointmentsToday вместо todayAppointments
            // и молча показывал нули из-за ?? 0.
            { label: t('dashboard.appointmentsToday'), value: stats?.todayAppointments ?? 0, icon: <CalendarDays size={22} /> },
            { label: t('dashboard.upcoming'), value: stats?.upcomingAppointments?.length ?? 0, icon: <Clock3 size={22} /> },
            { label: t('clients.myTitle'), value: stats?.clientsCount ?? 0, icon: <Users size={22} /> },
            { label: t('dashboard.revenueToday'), value: `${stats?.todayRevenue ?? 0} MDL`, icon: <Wallet size={22} /> },
            { label: t('dashboard.revenueMonth'), value: `${stats?.monthRevenue ?? 0} MDL`, icon: <TrendingUp size={22} /> },
            { label: t('dashboard.rating'), value: stats?.averageRating != null ? `${stats.averageRating.toFixed(1)} ★` : '—', icon: <Star size={22} /> },
          ].map((m) => (
            <article className="metric-card" key={m.label}>
              <div className="metric-icon">{m.icon}</div>
              <p>{m.label}</p>
              <strong>{isLoading ? '...' : m.value}</strong>
            </article>
          ))}
        </section>

        <section className="dashboard-columns">
          {/* Ближайшие записи */}
          <article className="dashboard-panel">
            <div className="panel-heading">
              <div><p className="panel-kicker">{t('appointments.schedule').toUpperCase()}</p><h2>{t("dashboard.upcomingAppointments")}</h2></div>
              <CalendarDays size={22} />
            </div>
            {upcoming.length === 0 ? (
              <div style={{ padding: '28px 0', textAlign: 'center' }}>
                <p className="empty-state">{t("dashboard.noAppointments")}</p>
                <p style={{ color: 'var(--app-text-muted)', fontSize: 13, marginTop: 8 }}>{t('dashboard.shareLinkHint')}</p>
              </div>
            ) : (
              <div className="ranking-list">
                {upcoming.map((apt) => (
                  <div className="ranking-row" key={apt.id}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minWidth: 42, padding: '4px 8px', borderRadius: 10, background: 'rgba(255,255,255,0.04)' }}>
                      <strong style={{ color: 'var(--app-text)', fontSize: 13 }}>{new Date(apt.startTime).toLocaleString(dateLocale, { day: '2-digit', month: '2-digit' })}</strong>
                      <span style={{ color: 'var(--app-text-muted)', fontSize: 11 }}>{new Date(apt.startTime).toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div className="ranking-main">
                      <strong>{apt.clientName ?? t('appointments.client')}</strong>
                      <span>{apt.serviceName ?? t('services.service')} · {formatDuration(apt.startTime, apt.endTime)}</span>
                    </div>
                    <div className="ranking-value">
                      <span style={{ color: statusColor[apt.status] ?? 'var(--app-text-muted)', fontSize: 12, fontWeight: 700 }}>{statusLabel[apt.status] ?? apt.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ marginTop: 16 }}>
              <a href="#appointments" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'var(--app-text)', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
                <CalendarDays size={14} /> {t('dashboard.allAppointments')}
              </a>
            </div>
          </article>

          {/* Быстрые действия */}
          <article className="dashboard-panel">
            <div className="panel-heading">
              <div><p className="panel-kicker">{t('services.myCabinet').toUpperCase()}</p><h2>{t("dashboard.quickActions")}</h2></div>
              <Scissors size={22} />
            </div>
            <div className="ranking-list">
              {[
                { icon: <Scissors size={14} />, title: t('services.myTitle'), desc: t('dashboard.qaServicesDesc'), hash: '#services' },
                { icon: <CalendarDays size={14} />, title: t('appointments.myTitle'), desc: t('dashboard.qaAppointmentsDesc'), hash: '#appointments' },
                { icon: <Users size={14} />, title: t('clients.myTitle'), desc: t('dashboard.qaClientsDesc'), hash: '#clients' },
                { icon: <Wallet size={14} />, title: t('finance.myTitle'), desc: t('dashboard.qaIncomeDesc'), hash: '#finance' },
              ].map((item) => (
                <div key={item.hash} className="ranking-row" style={{ cursor: 'pointer' }} onClick={() => { window.location.hash = item.hash; }}>
                  <span className="ranking-number">{item.icon}</span>
                  <div className="ranking-main">
                    <strong>{item.title}</strong>
                    <span>{item.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </article>
        </section>

        {/* Персональная ссылка */}
        <article className="dashboard-panel" style={{ marginTop: 24 }}>
          <div className="panel-heading">
            <div><p className="panel-kicker">{t('promotion.myPromotion').toUpperCase()}</p><h2>{t("promotion.title")}</h2></div>
            <Share2 size={22} />
          </div>

          <p style={{ color: 'var(--app-text-muted)', fontSize: 14, lineHeight: 1.6, marginBottom: 20 }}>
            {t('promotion.subtitle')}
          </p>

          {/* Форма выбора slug */}
          <div style={{ marginBottom: 24, padding: '18px 20px', borderRadius: 16, border: '1px solid rgba(var(--app-accent-rgb), 0.2)', background: 'rgba(var(--app-accent-rgb), 0.05)' }}>
            <p style={{ color: 'var(--app-accent-strong)', fontSize: 12, fontWeight: 800, letterSpacing: '0.1em', marginBottom: 10 }}>{t('promotion.myAddress')}</p>
            <p style={{ color: 'var(--app-text-muted)', fontSize: 13, marginBottom: 14 }}>
              {t('promotion.slugHintFull')} <strong style={{ color: 'var(--app-accent-strong)' }}>maria-scissors</strong> {t('common.or')} <strong style={{ color: 'var(--app-accent-strong)' }}>ivan-onuta</strong>
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 0, border: '1px solid rgba(255,255,255,0.15)', borderRadius: 13, overflow: 'hidden', background: 'rgba(255,255,255,0.06)' }}>
                  <span style={{ padding: '11px 12px', color: 'var(--app-text-muted)', fontSize: 13, borderRight: '1px solid rgba(255,255,255,0.08)', whiteSpace: 'nowrap', flexShrink: 0 }}>glamour/</span>
                  <input
                    type="text"
                    value={slugInput}
                    onChange={(e) => {
                      setSlugInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
                      setSlugError('');
                    }}
                    placeholder={t('promotion.slugPlaceholder')}
                    style={{ flex: 1, minWidth: 0, padding: '11px 13px', border: 0, outline: 0, background: 'transparent', color: 'var(--app-text)', fontSize: 13 }}
                  />
                </div>
                {slugError && <p style={{ color: 'var(--app-accent-strong)', fontSize: 12, marginTop: 6 }}>{slugError}</p>}
                {slugSuccess && <p style={{ color: '#8ee5b5', fontSize: 12, marginTop: 6 }}>{slugSuccess}</p>}
              </div>
              <button
                type="button"
                onClick={() => void saveSlug()}
                disabled={slugSaving || !slugInput.trim()}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 7, minHeight: 46, padding: '0 18px', border: 0, borderRadius: 13, background: 'var(--app-accent)', color: '#17151c', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: slugSaving ? 0.6 : 1 }}
              >
                {slugSaving ? t('common.saving') : currentSlug ? t('promotion.update') : t('promotion.save')}
              </button>
            </div>
            {currentSlug && (
              <p style={{ marginTop: 10, color: 'var(--app-text-muted)', fontSize: 12 }}>
                {t('promotion.currentSlug')}: <strong style={{ color: 'var(--app-accent-strong)' }}>{currentSlug}</strong>
              </p>
            )}
          </div>

          {/* URL и кнопки */}
          {promoLoading ? (
            <div style={{ color: 'var(--app-text-muted)', fontSize: 14, padding: '16px 0' }}>
              <Link2 size={18} style={{ display: 'inline', marginRight: 8 }} /> {t('promotion.loadingLink')}
            </div>
          ) : promoUrl ? (
            <>
              <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                <input
                  type="text"
                  value={promoUrl}
                  readOnly
                  onFocus={(e) => e.currentTarget.select()}
                  style={{ flex: 1, minWidth: 200, padding: '11px 14px', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 13, background: 'rgba(255,255,255,0.06)', color: 'var(--app-text)', fontSize: 13, outline: 'none' }}
                />
                <button
                  type="button"
                  onClick={() => void copyPromoUrl()}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 7, minHeight: 46, padding: '0 18px', border: 0, borderRadius: 13, background: copyStatus === 'copied' ? 'rgba(77,208,139,0.2)' : 'var(--app-accent)', color: copyStatus === 'copied' ? '#8ee5b5' : '#17151c', fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}
                >
                  {copyStatus === 'copied' ? <Check size={16} /> : <ClipboardCopy size={16} />}
                  {copyStatus === 'copied' ? t('links.copied') + '!' : t('links.copy')}
                </button>
              </div>

              <div style={{ marginBottom: 16 }}>
                <p style={{ color: 'var(--app-text-muted)', fontSize: 12, marginBottom: 10, fontWeight: 700, letterSpacing: '0.08em' }}>{t('promotion.shareTitle')}</p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button type="button" onClick={() => shareVia('whatsapp')} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, minHeight: 42, padding: '0 16px', border: '1px solid rgba(37,211,102,0.3)', borderRadius: 12, background: 'rgba(37,211,102,0.1)', color: '#4de06e', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                    WhatsApp
                  </button>
                  <button type="button" onClick={() => shareVia('telegram')} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, minHeight: 42, padding: '0 16px', border: '1px solid rgba(41,182,246,0.3)', borderRadius: 12, background: 'rgba(41,182,246,0.1)', color: '#67c8f7', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                    Telegram
                  </button>
                  <a href={promoUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, minHeight: 42, padding: '0 16px', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, background: 'rgba(255,255,255,0.05)', color: 'var(--app-text)', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
                    <ExternalLink size={14} /> {t('common.open')}
                  </a>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px', borderRadius: 14, border: '1px solid rgba(var(--app-accent-rgb), 0.15)', background: 'rgba(var(--app-accent-rgb), 0.06)' }}>
                <QrCode size={22} style={{ color: 'var(--app-accent-strong)', flexShrink: 0, marginTop: 2 }} />
                <div>
                  <strong style={{ color: 'var(--app-text)', fontSize: 13 }}>{t("promotion.qrTitle")}</strong>
                  <p style={{ color: 'var(--app-text-muted)', fontSize: 12, marginTop: 4, lineHeight: 1.5 }}>
                    {t('promotion.qrSubtitle')} {t('promotion.qrGenerate')}{' '}
                    <a href="https://qrcode-monkey.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--app-accent-strong)' }}>qrcode-monkey.com</a>
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div style={{ color: 'var(--app-text-muted)', fontSize: 14 }}>{t('promotion.saveSlugFirst')}</div>
          )}
        </article>
      </main>
    </AppLayout>
  );
}

export default MasterDashboardPage;
