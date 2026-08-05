import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Mail, Phone, RefreshCw, Search, User, Users, X } from 'lucide-react';
import api from '../api/api';
import AppLayout from '../components/AppLayout';

type WorkspaceMode = 'platform' | 'salon' | 'master';
type SalonSummary = { id: string; name: string; membershipRole?: string | null; membershipRoles?: string[]; membershipStatus?: string | null; };
type Client = { id: string; firstName: string; lastName: string; email: string; phone?: string; createdAt?: string; isActive?: boolean; totalAppointments?: number; totalSpent?: number; lastVisit?: string; };

const WORKSPACE_MODE_KEY = 'glamour_workspace_mode';
const CURRENT_SALON_ID_KEY = 'glamour_current_salon_id';

function getWorkspaceMode(): WorkspaceMode {
  const mode = localStorage.getItem(WORKSPACE_MODE_KEY);
  if (mode === 'platform' || mode === 'salon' || mode === 'master') return mode;
  return 'salon';
}

function getInitials(firstName: string, lastName: string) {
  return `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`.toUpperCase();
}

function ClientsPage() {
  const workspaceMode = getWorkspaceMode();
  const isMasterWorkspace = workspaceMode === 'master';
  const [salon, setSalon] = useState<SalonSummary | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [message, setMessage] = useState('Загрузка клиентов...');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function loadSalon(): Promise<SalonSummary | null> {
    const res = await api.get<SalonSummary[]>('/salons/my');
    if (res.data.length === 0) return null;
    if (!isMasterWorkspace) return res.data[0] ?? null;
    const masterSalons = res.data.filter((s) => s.membershipStatus === 'active' && (s.membershipRoles?.includes('master') || s.membershipRole === 'master'));
    if (masterSalons.length === 0) return null;
    const savedId = localStorage.getItem(CURRENT_SALON_ID_KEY);
    const found = savedId ? masterSalons.find((s) => s.id === savedId) : undefined;
    return found ?? masterSalons[0];
  }

  async function loadClients(salonId: string) {
    setIsLoading(true);
    try {
      if (isMasterWorkspace) {
        // Для мастера — клиенты из client-history
        const res = await api.get<Client[]>('/client-history/my-clients', { params: { salonId } });
        setClients(res.data);
        setMessage(res.data.length === 0 ? '' : '');
      } else {
        // Для салона — все клиенты с ролью client
        const res = await api.get<Client[]>('/users', { params: { salonId } });
        const clientsOnly = res.data.filter((u: any) => u.role === 'client');
        setClients(clientsOnly);
      }
      setMessage('');
    } catch {
      setMessage(isMasterWorkspace ? 'Клиентская история пока недоступна.' : 'Не удалось загрузить клиентов.');
      setClients([]);
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
        await loadClients(s.id);
      } catch {
        if (!cancelled) setMessage('Не удалось загрузить данные.');
      }
    }
    void init();
    return () => { cancelled = true; };
  }, [isMasterWorkspace]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) =>
      `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) ||
      (c.email ?? '').toLowerCase().includes(q) ||
      (c.phone ?? '').toLowerCase().includes(q),
    );
  }, [clients, search]);

  function formatDate(iso?: string) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  return (
    <AppLayout>
      <main className="dashboard-page">
        <header className="dashboard-header">
          <div>
            <p className="dashboard-eyebrow">{isMasterWorkspace ? 'МОИ КЛИЕНТЫ' : 'КЛИЕНТЫ'}</p>
            <h1>{isMasterWorkspace ? 'Мои клиенты' : 'Клиенты салона'}</h1>
            <p className="dashboard-subtitle">
              {isMasterWorkspace ? 'Клиенты которые записывались к вам — история визитов.' : 'Все зарегистрированные клиенты салона.'}
            </p>
          </div>
          <div className="dashboard-period">
            <span>Всего клиентов</span>
            <strong>{clients.length}</strong>
          </div>
        </header>

        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <button type="button" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, minHeight: 40, padding: '0 14px', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, background: 'rgba(255,255,255,0.05)', color: '#d7ced8', fontSize: 13, fontWeight: 700, cursor: 'pointer' }} onClick={() => salon && loadClients(salon.id)} disabled={isLoading}>
            <RefreshCw size={15} style={isLoading ? { animation: 'spin 1s linear infinite' } : {}} /> Обновить
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 13, background: 'rgba(255,255,255,0.05)', marginBottom: 16 }}>
          <Search size={16} style={{ color: '#efb6d8', flexShrink: 0 }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Поиск по имени, email, телефону..." style={{ flex: 1, border: 0, outline: 0, background: 'transparent', color: '#fff7fc', fontSize: 13 }} />
          {search && <button type="button" style={{ display: 'flex', border: 0, background: 'transparent', color: '#9d949f', cursor: 'pointer' }} onClick={() => setSearch('')}><X size={14} /></button>}
        </div>

        {message && !clients.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '48px 20px', color: '#9d949f', textAlign: 'center' }}>
            <Users size={40} style={{ color: '#d682b8', opacity: 0.4 }} />
            <p>{message}</p>
            {isMasterWorkspace && <p style={{ fontSize: 13 }}>Клиенты появятся здесь после первых записей.</p>}
          </div>
        ) : (
          <section className="dashboard-panel">
            <div className="panel-heading">
              <div><p className="panel-kicker">БАЗА КЛИЕНТОВ</p><h2>{filtered.length} клиентов</h2></div>
              <Users size={22} />
            </div>

            {filtered.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '48px 20px', color: '#9d949f', textAlign: 'center' }}>
                <Users size={40} style={{ color: '#d682b8', opacity: 0.4 }} />
                <p>{search ? 'Клиенты не найдены.' : 'Клиентов пока нет.'}</p>
              </div>
            ) : (
              <div>
                {filtered.map((client, index) => {
                  const isExpanded = expandedId === client.id;
                  const fullName = `${client.firstName} ${client.lastName}`.trim();
                  const initials = getInitials(client.firstName, client.lastName);
                  return (
                    <div key={client.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '14px 16px', background: isExpanded ? 'rgba(214,130,184,0.04)' : 'transparent' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }} onClick={() => setExpandedId(isExpanded ? null : client.id)}>
                        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: '50%', background: 'rgba(214,130,184,0.12)', color: '#efb6d8', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{index + 1}</span>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: '50%', background: 'rgba(214,130,184,0.16)', color: '#efb6d8', fontSize: 14, fontWeight: 700, flexShrink: 0 }}>{initials || <User size={16} />}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <strong style={{ color: '#fff7fc', fontSize: 14, display: 'block' }}>{fullName || 'Без имени'}</strong>
                          <div style={{ display: 'flex', gap: 12, marginTop: 4, flexWrap: 'wrap' }}>
                            {client.email && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#9d949f', fontSize: 12 }}><Mail size={11} />{client.email}</span>}
                            {client.phone && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#9d949f', fontSize: 12 }}><Phone size={11} />{client.phone}</span>}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
                          {client.totalSpent != null && <div style={{ textAlign: 'right' }}><strong style={{ color: '#d682b8', fontSize: 14 }}>{client.totalSpent} MDL</strong><div style={{ color: '#9d949f', fontSize: 11 }}>потрачено</div></div>}
                          {client.totalAppointments != null && <div style={{ textAlign: 'right' }}><strong style={{ color: '#fff7fc', fontSize: 14 }}>{client.totalAppointments}</strong><div style={{ color: '#9d949f', fontSize: 11 }}>визитов</div></div>}
                          <span style={{ color: '#9d949f', fontSize: 14 }}>{isExpanded ? '▲' : '▼'}</span>
                        </div>
                      </div>
                      {isExpanded && (
                        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8, marginBottom: 12 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', fontSize: 12, color: '#9d949f' }}><span>Клиент с</span><strong>{formatDate(client.createdAt)}</strong></div>
                            {client.lastVisit && <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', fontSize: 12, color: '#9d949f' }}><span>Последний визит</span><strong>{formatDate(client.lastVisit)}</strong></div>}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', fontSize: 12, color: '#9d949f' }}><span>Статус</span><strong style={{ color: client.isActive !== false ? '#8ee5b5' : '#ffb6c6' }}>{client.isActive !== false ? 'Активен' : 'Неактивен'}</strong></div>
                          </div>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {client.email && <a href={`mailto:${client.email}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 34, padding: '0 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#d7ced8', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}><Mail size={13} />Письмо</a>}
                            {client.phone && <a href={`tel:${client.phone}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 34, padding: '0 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#d7ced8', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}><Phone size={13} />Звонок</a>}
                            <button type="button" onClick={() => { window.location.hash = '#appointments'; }} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 34, padding: '0 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#d7ced8', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}><CalendarDays size={13} />Записи</button>
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

export default ClientsPage;
