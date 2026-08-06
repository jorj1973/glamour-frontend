import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  ClipboardCopy,
  Link2,
  RefreshCw,
  Scissors,
  Search,
  Star,
  User,
  UserPlus,
  X,
} from 'lucide-react';
import api from '../api/api';
import AppLayout from '../components/AppLayout';

type Master = {
  id: string;
  userId?: string;
  photoUrl?: string | null;
  profession?: string | null;
  bio?: string | null;
  experienceYears?: number | null;
  city?: string | null;
  salonName?: string | null;
  isPublic?: boolean;
  averageRating?: number | null;
  firstName?: string | null;
  lastName?: string | null;
  cooperationType?: string | null;
  membershipStatus?: string | null;
};

type SalonSummary = {
  id: string;
  name: string;
  slug: string;
  membershipRole: string;
  membershipStatus: string;
};

type PromotionLinkResponse = {
  id?: string;
  code?: string;
  slug?: string | null;
  url?: string;
  link?: string;
  shortUrl?: string;
  publicUrl?: string;
  registrationUrl?: string;
  inviteUrl?: string;
  active?: boolean;
  isActive?: boolean;
  expiresAt?: string | null;
};

function getRegistrationUrl(data: PromotionLinkResponse): string {
  const identifier =
    typeof data.slug === 'string' && data.slug.trim() ? data.slug.trim()
    : typeof data.code === 'string' && data.code.trim() ? data.code.trim()
    : '';
  if (identifier) {
    return `${window.location.origin}/#master-register?identifier=${encodeURIComponent(identifier)}`;
  }
  const possibleUrl = data.registrationUrl ?? data.publicUrl ?? data.shortUrl ?? data.inviteUrl ?? data.url ?? data.link;
  return typeof possibleUrl === 'string' && possibleUrl.trim() ? possibleUrl.trim() : '';
}

function getInitials(master: Master): string {
  const first = master.firstName?.[0] ?? '';
  const last = master.lastName?.[0] ?? '';
  return (first + last).toUpperCase() || (master.profession?.[0]?.toUpperCase() ?? '?');
}

function MastersPage() {
  const [masters, setMasters] = useState<Master[]>([]);
  const [salon, setSalon] = useState<SalonSummary | null>(null);
  const [message, setMessage] = useState('Загрузка команды салона...');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isRegistrationPanelOpen, setIsRegistrationPanelOpen] = useState(false);
  const [registrationUrl, setRegistrationUrl] = useState('');
  const [isLinkLoading, setIsLinkLoading] = useState(false);
  const [linkError, setLinkError] = useState('');
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');

  async function loadData() {
    setIsLoading(true);
    try {
      const salonsResponse = await api.get<SalonSummary[]>('/salons/my');
      const currentSalon = salonsResponse.data[0] ?? null;
      setSalon(currentSalon);
      if (!currentSalon) { setMessage('Салон не найден.'); return; }
      const mastersResponse = await api.get<Master[]>('/masters', { params: { salonId: currentSalon.id } });
      setMasters(mastersResponse.data);
      setMessage('');
    } catch {
      setMessage('Не удалось загрузить данные команды салона.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function loadPermanentRegistrationLink() {
    if (!salon || isLinkLoading) return;
    setLinkError('');
    setCopyStatus('idle');
    setIsLinkLoading(true);
    try {
      const response = await api.post<PromotionLinkResponse>(`/promotion-links/salon/${salon.id}/master-registration`);
      const permanentUrl = getRegistrationUrl(response.data);
      if (!permanentUrl) throw new Error('URL missing');
      setRegistrationUrl(permanentUrl);
    } catch {
      setLinkError('Не удалось получить ссылку. Повторите попытку.');
    } finally {
      setIsLinkLoading(false);
    }
  }

  function openRegistrationPanel() {
    setIsRegistrationPanelOpen(true);
    setLinkError('');
    setCopyStatus('idle');
    if (!registrationUrl) void loadPermanentRegistrationLink();
  }

  async function copyRegistrationUrl() {
    if (!registrationUrl) return;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(registrationUrl);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = registrationUrl;
        textarea.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        const copied = document.execCommand('copy');
        document.body.removeChild(textarea);
        if (!copied) throw new Error('Copy failed');
      }
      setCopyStatus('copied');
    } catch {
      setCopyStatus('error');
    }
  }

  const canManage = salon?.membershipRole === 'salon_owner' || salon?.membershipRole === 'admin' || salon?.membershipRole === 'owner' || salon?.membershipRole === 'administrator';

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return masters;
    return masters.filter((m) =>
      (m.profession ?? '').toLowerCase().includes(q) ||
      (m.firstName ?? '').toLowerCase().includes(q) ||
      (m.lastName ?? '').toLowerCase().includes(q) ||
      (m.city ?? '').toLowerCase().includes(q),
    );
  }, [masters, search]);


  return (
    <AppLayout>
      <main className="dashboard-page">
        <header className="dashboard-header">
          <div>
            <p className="dashboard-eyebrow">МАСТЕРА</p>
            <h1>Команда салона</h1>
            <p className="dashboard-subtitle">Все мастера зарегистрированные в системе — управление командой и приглашения.</p>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div className="dashboard-period" style={{ minWidth: 110 }}>
              <span>Всего мастеров</span>
              <strong>{masters.length}</strong>
            </div>
            {canManage && (
              <button
                type="button"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 46, padding: '0 18px', border: 0, borderRadius: 14, background: '#d682b8', color: '#17151c', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                onClick={isRegistrationPanelOpen ? () => setIsRegistrationPanelOpen(false) : openRegistrationPanel}
              >
                {isRegistrationPanelOpen ? <X size={17} /> : <UserPlus size={17} />}
                {isRegistrationPanelOpen ? 'Закрыть' : 'Пригласить мастера'}
              </button>
            )}
          </div>
        </header>

        {/* Панель приглашения */}
        {isRegistrationPanelOpen && canManage && (
          <section className="platform-invitations-panel" style={{ marginBottom: 24 }}>
            <div className="platform-panel-heading">
              <div>
                <p className="panel-kicker">РЕГИСТРАЦИЯ МАСТЕРОВ</p>
                <h2>Постоянная ссылка салона</h2>
                <p>Отправьте эту ссылку будущему мастеру. Он самостоятельно заполнит данные и зарегистрируется в вашем салоне.</p>
              </div>
            </div>
            <div className="platform-invitation-layout">
              <div className="platform-invitation-form">
                <div className="platform-result-success">
                  <CheckCircle2 size={21} />
                  <div>
                    <strong>Одна ссылка для всех мастеров</strong>
                    <span>Ссылка не имеет срока действия и используется многократно.</span>
                  </div>
                </div>
                <p className="platform-security-note">Мастер сам вводит свои данные при регистрации — вам ничего заранее вводить не нужно.</p>
              </div>
              <aside className="platform-invitation-result">
                {isLinkLoading && (
                  <div className="platform-result-placeholder">
                    <Link2 size={28} />
                    <strong>Получаем ссылку...</strong>
                    <p>Подождите несколько секунд.</p>
                  </div>
                )}
                {!isLinkLoading && linkError && (
                  <div className="platform-result-placeholder">
                    <strong>Ссылка не получена</strong>
                    <p className="platform-invitation-error">{linkError}</p>
                    <button type="button" className="platform-create-invitation-button" onClick={() => void loadPermanentRegistrationLink()}>
                      Повторить
                    </button>
                  </div>
                )}
                {!isLinkLoading && !linkError && registrationUrl && (
                  <>
                    <label>Постоянная регистрационная ссылка</label>
                    <div className="platform-invite-url">
                      <input type="text" value={registrationUrl} readOnly onFocus={(e) => e.currentTarget.select()} />
                      <button type="button" onClick={() => void copyRegistrationUrl()}>
                        <ClipboardCopy size={17} /> Копировать
                      </button>
                    </div>
                    {copyStatus === 'copied' && <p className="platform-copy-success">Ссылка скопирована!</p>}
                    {copyStatus === 'error' && <p className="platform-invitation-error">Не удалось скопировать. Скопируйте вручную.</p>}
                    <p className="platform-security-note">При повторном открытии возвращается та же ссылка.</p>
                  </>
                )}
              </aside>
            </div>
          </section>
        )}

        {/* Кнопка обновления и поиск */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="button" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, minHeight: 40, padding: '0 14px', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, background: 'rgba(255,255,255,0.05)', color: '#d7ced8', fontSize: 13, fontWeight: 700, cursor: 'pointer' }} onClick={() => void loadData()} disabled={isLoading}>
            <RefreshCw size={15} style={isLoading ? { animation: 'spin 1s linear infinite' } : {}} /> Обновить
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 13, background: 'rgba(255,255,255,0.05)', marginBottom: 16 }}>
          <Search size={16} style={{ color: '#efb6d8', flexShrink: 0 }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Поиск по имени, профессии, городу..." style={{ flex: 1, border: 0, outline: 0, background: 'transparent', color: '#fff7fc', fontSize: 13 }} />
          {search && <button type="button" style={{ display: 'flex', border: 0, background: 'transparent', color: '#9d949f', cursor: 'pointer' }} onClick={() => setSearch('')}><X size={14} /></button>}
        </div>

        {/* Список мастеров */}
        {message && !masters.length ? (
          <p className="dashboard-status">{message}</p>
        ) : (
          <section className="dashboard-panel">
            <div className="panel-heading">
              <div><p className="panel-kicker">КОМАНДА</p><h2>{filtered.length} мастеров</h2></div>
              <Scissors size={22} />
            </div>

            {filtered.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '48px 20px', color: '#9d949f', textAlign: 'center' }}>
                <Scissors size={40} style={{ color: '#d682b8', opacity: 0.4 }} />
                <p>{search ? 'Мастера не найдены.' : 'В системе пока нет мастеров.'}</p>
                {!search && canManage && (
                  <button type="button" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, minHeight: 40, padding: '0 16px', border: 0, borderRadius: 12, background: '#d682b8', color: '#17151c', fontSize: 13, fontWeight: 700, cursor: 'pointer' }} onClick={openRegistrationPanel}>
                    <UserPlus size={15} /> Пригласить первого мастера
                  </button>
                )}
              </div>
            ) : (
              <div>
                {filtered.map((master, index) => {
                  const isExpanded = expandedId === master.id;
                  const rating = typeof master.averageRating === 'number' ? master.averageRating.toFixed(1) : null;
                  const initials = getInitials(master);
                  const fullName = [master.firstName, master.lastName].filter(Boolean).join(' ');

                  return (
                    <div key={master.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '14px 16px', background: isExpanded ? 'rgba(214,130,184,0.04)' : 'transparent' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }} onClick={() => setExpandedId(isExpanded ? null : master.id)}>
                        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: '50%', background: 'rgba(214,130,184,0.12)', color: '#efb6d8', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{index + 1}</span>

                        {master.photoUrl ? (
                          <img src={master.photoUrl} alt={initials} style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '2px solid rgba(214,130,184,0.3)' }} />
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 44, height: 44, borderRadius: '50%', background: 'rgba(214,130,184,0.16)', color: '#efb6d8', fontSize: 15, fontWeight: 700, flexShrink: 0 }}>
                            {initials || <User size={18} />}
                          </div>
                        )}

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <strong style={{ color: '#fff7fc', fontSize: 14 }}>{fullName || master.profession || 'Мастер'}</strong>
                            {master.cooperationType === 'INDEPENDENT' && (
                              <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: 'rgba(114,167,255,0.12)', color: '#a8c9ff' }}>независимый</span>
                            )}
                            {master.isPublic && (
                              <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: 'rgba(77,208,139,0.12)', color: '#8ee5b5' }}>публичный</span>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: 12, marginTop: 4, flexWrap: 'wrap' }}>
                            {master.profession && fullName && (
                              <span style={{ color: '#9d949f', fontSize: 12 }}>{master.profession}</span>
                            )}
                            {master.city && (
                              <span style={{ color: '#9d949f', fontSize: 12 }}>📍 {master.city}</span>
                            )}
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
                          {rating && (
                            <div style={{ textAlign: 'right' }}>
                              <strong style={{ color: '#d682b8', fontSize: 14, display: 'flex', alignItems: 'center', gap: 4 }}>
                                <Star size={13} />{rating}
                              </strong>
                              <div style={{ color: '#9d949f', fontSize: 11 }}>рейтинг</div>
                            </div>
                          )}
                          {typeof master.experienceYears === 'number' && (
                            <div style={{ textAlign: 'right' }}>
                              <strong style={{ color: '#fff7fc', fontSize: 14 }}>{master.experienceYears}</strong>
                              <div style={{ color: '#9d949f', fontSize: 11 }}>лет опыта</div>
                            </div>
                          )}
                          <span style={{ color: '#9d949f', fontSize: 14 }}>{isExpanded ? '▲' : '▼'}</span>
                        </div>
                      </div>

                      {isExpanded && (
                        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                          {master.bio && (
                            <p style={{ color: '#c9beca', fontSize: 13, lineHeight: 1.6, marginBottom: 12 }}>{master.bio}</p>
                          )}
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', fontSize: 12, color: '#9d949f' }}>
                              <span>Профессия</span><strong>{master.profession ?? '—'}</strong>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', fontSize: 12, color: '#9d949f' }}>
                              <span>Город</span><strong>{master.city ?? '—'}</strong>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', fontSize: 12, color: '#9d949f' }}>
                              <span>Опыт</span><strong>{master.experienceYears != null ? `${master.experienceYears} лет` : '—'}</strong>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', fontSize: 12, color: '#9d949f' }}>
                              <span>Рейтинг</span><strong style={{ color: '#d682b8' }}>{rating ? `${rating} ★` : '—'}</strong>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', fontSize: 12, color: '#9d949f' }}>
                              <span>Профиль</span><strong style={{ color: master.isPublic ? '#8ee5b5' : '#ffb6c6' }}>{master.isPublic ? 'Публичный' : 'Скрытый'}</strong>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', fontSize: 12, color: '#9d949f' }}>
                              <span>Тип</span><strong>{master.cooperationType === 'INDEPENDENT' ? 'независимый' : 'Штатный'}</strong>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </main>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </AppLayout>
  );
}

export default MastersPage;
