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
import api from '../api/api';
import AppLayout from '../components/AppLayout';

type SalonSummary = {
  id: string;
  name: string;
  slug?: string;
  membershipRole?: string;
  membershipStatus?: string;
};

type MasterStats = {
  appointmentsToday: number;
  appointmentsMonth: number;
  clientsTotal: number;
  revenueToday: number;
  revenueMonth: number;
  averageRating: number | null;
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
    return `${baseUrl}/#master-register?identifier=${encodeURIComponent(identifier)}`;
  }
  return data.publicUrl ?? data.registrationUrl ?? data.url ?? '';
}

function MasterDashboardPage() {
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
      const res = await api.get<MasterStats>('/dashboard/master', { params: { salonId } });
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
      const masterLink = existing.data.find((l) => (l as any).ownerType === 'master' && (l as any).targetType === 'booking');
      if (masterLink) {
        const url = getPromoUrl(masterLink, baseUrl);
        setPromoUrl(url);
        if (masterLink.slug) {
          setCurrentSlug(masterLink.slug);
          setSlugInput(masterLink.slug);
        }
        return;
      }
      // Если нет — создаём дефолтную
      const res = await api.post<PromotionLink>(`/promotion-links/salon/${salonId}/master-registration`);
      const url = getPromoUrl(res.data, baseUrl);
      setPromoUrl(url);
      if (res.data.slug) {
        setCurrentSlug(res.data.slug);
        setSlugInput(res.data.slug);
      }
    } catch {
      setPromoUrl('');
    } finally {
      setPromoLoading(false);
    }
  }

  async function saveSlug() {
    if (!salon) return;
    const slug = slugInput.trim().toLowerCase();

    if (!slug) { setSlugError('Введите slug.'); return; }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      setSlugError('Только строчные латинские буквы, цифры и дефисы. Например: ivan-onuta');
      return;
    }
    if (slug.length < 3) { setSlugError('Минимум 3 символа.'); return; }
    if (slug.length > 50) { setSlugError('Максимум 50 символов.'); return; }

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
      setPromoUrl(`${baseUrl}/#master-register?identifier=${encodeURIComponent(slug)}`);
      setSlugSuccess('Ссылка сохранена!');
      setTimeout(() => setSlugSuccess(''), 3000);
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? '';
      if (msg.includes('already in use') || msg.includes('slug')) {
        setSlugError('Этот slug уже занят. Выберите другой.');
      } else {
        setSlugError('Не удалось сохранить. Попробуйте другой slug.');
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
      whatsapp: `https://wa.me/?text=${encodeURIComponent(`Запишитесь ко мне онлайн: ${promoUrl}`)}`,
      telegram: `https://t.me/share/url?url=${encodeURIComponent(promoUrl)}&text=${encodeURIComponent('Запишитесь ко мне онлайн!')}`,
    };
    window.open(urls[platform], '_blank');
  }

  function formatDuration(start: string, end: string) {
    return Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000) + ' мин';
  }

  const statusColor: Record<string, string> = {
    pending: '#ffd08b', confirmed: '#a8c9ff', completed: '#8ee5b5', cancelled: '#ffb6c6',
  };
  const statusLabel: Record<string, string> = {
    pending: 'Ожидает', confirmed: 'Подтверждена', completed: 'Завершена', cancelled: 'Отменена',
  };

  return (
    <AppLayout>
      <main className="dashboard-page">
        <header className="dashboard-header">
          <div>
            <p className="dashboard-eyebrow">МОЙ КАБИНЕТ</p>
            <h1>Кабинет мастера</h1>
            <p className="dashboard-subtitle">Личное расписание, клиенты, доходы и инструменты продвижения.</p>
          </div>
          <div className="dashboard-period">
            <span>Салон</span>
            <strong>{salon?.name ?? '—'}</strong>
          </div>
        </header>

        {/* Метрики */}
        <section className="metrics-grid" aria-label="Личные показатели">
          {[
            { label: 'Записей сегодня', value: stats?.appointmentsToday ?? 0, icon: <CalendarDays size={22} /> },
            { label: 'Записей за месяц', value: stats?.appointmentsMonth ?? 0, icon: <Clock3 size={22} /> },
            { label: 'Мои клиенты', value: stats?.clientsTotal ?? 0, icon: <Users size={22} /> },
            { label: 'Доход сегодня', value: `${stats?.revenueToday ?? 0} MDL`, icon: <Wallet size={22} /> },
            { label: 'Доход за месяц', value: `${stats?.revenueMonth ?? 0} MDL`, icon: <TrendingUp size={22} /> },
            { label: 'Рейтинг', value: stats?.averageRating != null ? `${stats.averageRating.toFixed(1)} ★` : '—', icon: <Star size={22} /> },
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
              <div><p className="panel-kicker">РАСПИСАНИЕ</p><h2>Ближайшие записи</h2></div>
              <CalendarDays size={22} />
            </div>
            {upcoming.length === 0 ? (
              <div style={{ padding: '28px 0', textAlign: 'center' }}>
                <p className="empty-state">Ближайших записей пока нет.</p>
                <p style={{ color: '#9d949f', fontSize: 13, marginTop: 8 }}>Поделитесь ссылкой чтобы клиенты записывались онлайн.</p>
              </div>
            ) : (
              <div className="ranking-list">
                {upcoming.map((apt) => (
                  <div className="ranking-row" key={apt.id}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minWidth: 42, padding: '4px 8px', borderRadius: 10, background: 'rgba(255,255,255,0.04)' }}>
                      <strong style={{ color: '#fff7fc', fontSize: 13 }}>{new Date(apt.startTime).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit' })}</strong>
                      <span style={{ color: '#9d949f', fontSize: 11 }}>{new Date(apt.startTime).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div className="ranking-main">
                      <strong>{apt.clientName ?? 'Клиент'}</strong>
                      <span>{apt.serviceName ?? 'Услуга'} · {formatDuration(apt.startTime, apt.endTime)}</span>
                    </div>
                    <div className="ranking-value">
                      <span style={{ color: statusColor[apt.status] ?? '#b9b0bb', fontSize: 12, fontWeight: 700 }}>{statusLabel[apt.status] ?? apt.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ marginTop: 16 }}>
              <a href="#appointments" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#d7ced8', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
                <CalendarDays size={14} /> Все записи
              </a>
            </div>
          </article>

          {/* Быстрые действия */}
          <article className="dashboard-panel">
            <div className="panel-heading">
              <div><p className="panel-kicker">МОЙ КАБИНЕТ</p><h2>Быстрые действия</h2></div>
              <Scissors size={22} />
            </div>
            <div className="ranking-list">
              {[
                { icon: <Scissors size={14} />, title: 'Мои услуги', desc: 'Управление прайс-листом и ценами', hash: '#services' },
                { icon: <CalendarDays size={14} />, title: 'Мои записи', desc: 'Расписание и история', hash: '#appointments' },
                { icon: <Users size={14} />, title: 'Мои клиенты', desc: 'База клиентов и история', hash: '#clients' },
                { icon: <Wallet size={14} />, title: 'Мои доходы', desc: 'Финансовая статистика', hash: '#finance' },
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
            <div><p className="panel-kicker">МОЁ ПРОДВИЖЕНИЕ</p><h2>Персональная ссылка</h2></div>
            <Share2 size={22} />
          </div>

          <p style={{ color: '#b9b0bb', fontSize: 14, lineHeight: 1.6, marginBottom: 20 }}>
            Поделитесь этой ссылкой в Instagram, TikTok, WhatsApp — клиенты смогут записаться к вам напрямую онлайн.
          </p>

          {/* Форма выбора slug */}
          <div style={{ marginBottom: 24, padding: '18px 20px', borderRadius: 16, border: '1px solid rgba(214,130,184,0.2)', background: 'rgba(214,130,184,0.05)' }}>
            <p style={{ color: '#efb6d8', fontSize: 12, fontWeight: 800, letterSpacing: '0.1em', marginBottom: 10 }}>МОЙ ПЕРСОНАЛЬНЫЙ АДРЕС</p>
            <p style={{ color: '#9d949f', fontSize: 13, marginBottom: 14 }}>
              Выберите короткое имя для вашей ссылки. Только латинские буквы, цифры и дефис. Например: <strong style={{ color: '#efb6d8' }}>maria-scissors</strong> или <strong style={{ color: '#efb6d8' }}>ivan-onuta</strong>
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 0, border: '1px solid rgba(255,255,255,0.15)', borderRadius: 13, overflow: 'hidden', background: 'rgba(255,255,255,0.06)' }}>
                  <span style={{ padding: '11px 12px', color: '#9d949f', fontSize: 13, borderRight: '1px solid rgba(255,255,255,0.08)', whiteSpace: 'nowrap', flexShrink: 0 }}>glamour/</span>
                  <input
                    type="text"
                    value={slugInput}
                    onChange={(e) => {
                      setSlugInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
                      setSlugError('');
                    }}
                    placeholder="ваш-slug"
                    style={{ flex: 1, minWidth: 0, padding: '11px 13px', border: 0, outline: 0, background: 'transparent', color: '#fff7fc', fontSize: 13 }}
                  />
                </div>
                {slugError && <p style={{ color: '#ffb6c6', fontSize: 12, marginTop: 6 }}>{slugError}</p>}
                {slugSuccess && <p style={{ color: '#8ee5b5', fontSize: 12, marginTop: 6 }}>{slugSuccess}</p>}
              </div>
              <button
                type="button"
                onClick={() => void saveSlug()}
                disabled={slugSaving || !slugInput.trim()}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 7, minHeight: 46, padding: '0 18px', border: 0, borderRadius: 13, background: '#d682b8', color: '#17151c', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: slugSaving ? 0.6 : 1 }}
              >
                {slugSaving ? 'Сохраняем...' : currentSlug ? 'Обновить' : 'Сохранить'}
              </button>
            </div>
            {currentSlug && (
              <p style={{ marginTop: 10, color: '#9d949f', fontSize: 12 }}>
                Текущий slug: <strong style={{ color: '#efb6d8' }}>{currentSlug}</strong>
              </p>
            )}
          </div>

          {/* URL и кнопки */}
          {promoLoading ? (
            <div style={{ color: '#9d949f', fontSize: 14, padding: '16px 0' }}>
              <Link2 size={18} style={{ display: 'inline', marginRight: 8 }} /> Загружаем вашу ссылку...
            </div>
          ) : promoUrl ? (
            <>
              <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                <input
                  type="text"
                  value={promoUrl}
                  readOnly
                  onFocus={(e) => e.currentTarget.select()}
                  style={{ flex: 1, minWidth: 200, padding: '11px 14px', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 13, background: 'rgba(255,255,255,0.06)', color: '#fff7fc', fontSize: 13, outline: 'none' }}
                />
                <button
                  type="button"
                  onClick={() => void copyPromoUrl()}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 7, minHeight: 46, padding: '0 18px', border: 0, borderRadius: 13, background: copyStatus === 'copied' ? 'rgba(77,208,139,0.2)' : '#d682b8', color: copyStatus === 'copied' ? '#8ee5b5' : '#17151c', fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}
                >
                  {copyStatus === 'copied' ? <Check size={16} /> : <ClipboardCopy size={16} />}
                  {copyStatus === 'copied' ? 'Скопировано!' : 'Копировать'}
                </button>
              </div>

              <div style={{ marginBottom: 16 }}>
                <p style={{ color: '#9d949f', fontSize: 12, marginBottom: 10, fontWeight: 700, letterSpacing: '0.08em' }}>ПОДЕЛИТЬСЯ</p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button type="button" onClick={() => shareVia('whatsapp')} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, minHeight: 42, padding: '0 16px', border: '1px solid rgba(37,211,102,0.3)', borderRadius: 12, background: 'rgba(37,211,102,0.1)', color: '#4de06e', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                    WhatsApp
                  </button>
                  <button type="button" onClick={() => shareVia('telegram')} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, minHeight: 42, padding: '0 16px', border: '1px solid rgba(41,182,246,0.3)', borderRadius: 12, background: 'rgba(41,182,246,0.1)', color: '#67c8f7', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                    Telegram
                  </button>
                  <a href={promoUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, minHeight: 42, padding: '0 16px', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, background: 'rgba(255,255,255,0.05)', color: '#d7ced8', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
                    <ExternalLink size={14} /> Открыть
                  </a>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px', borderRadius: 14, border: '1px solid rgba(214,130,184,0.15)', background: 'rgba(214,130,184,0.06)' }}>
                <QrCode size={22} style={{ color: '#efb6d8', flexShrink: 0, marginTop: 2 }} />
                <div>
                  <strong style={{ color: '#fff7fc', fontSize: 13 }}>QR-код для офлайн продвижения</strong>
                  <p style={{ color: '#9d949f', fontSize: 12, marginTop: 4, lineHeight: 1.5 }}>
                    Разместите QR-код на визитке, зеркале или рабочем месте. Сгенерируйте бесплатно на{' '}
                    <a href="https://qrcode-monkey.com" target="_blank" rel="noopener noreferrer" style={{ color: '#efb6d8' }}>qrcode-monkey.com</a>
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div style={{ color: '#9d949f', fontSize: 14 }}>Сначала сохраните ваш slug выше.</div>
          )}
        </article>
      </main>
    </AppLayout>
  );
}

export default MasterDashboardPage;
