import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Mail, Phone, RefreshCw, Search, User, Users, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../api/api';
import { getErrorKey } from '../api/errorMessage';
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
  const { t, i18n } = useTranslation();
  const dateLocale = i18n.language?.startsWith('ro') ? 'ro-RO' : i18n.language?.startsWith('en') ? 'en-GB' : 'ru-RU';
  const isMasterWorkspace = workspaceMode === 'master';
  const [salon, setSalon] = useState<SalonSummary | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [message, setMessage] = useState(t('clients.loading'));
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  /**
   * Баланс баллов раскрытого клиента.
   * Загружается при раскрытии, а не для всего списка:
   * иначе на каждого клиента уходил бы отдельный запрос.
   */
  const [balance, setBalance] = useState<{ points: number; valueInCurrency: number } | null>(null);
  const [redeemPoints, setRedeemPoints] = useState('');
  const [isRedeeming, setIsRedeeming] = useState(false);

  async function loadBalance(clientId: string) {
    setBalance(null);
    setRedeemPoints('');

    try {
      const res = await api.get<{ points: number; valueInCurrency: number }>(
        `/loyalty/balance/${clientId}`,
        { params: { salonId: salon?.id } },
      );
      setBalance(res.data);
    } catch {
      setBalance(null);
    }
  }

  async function handleRedeem(clientId: string) {
    const amount = Number(redeemPoints);

    if (!amount || amount <= 0) {
      return;
    }

    setIsRedeeming(true);

    try {
      await api.post(
        '/loyalty/redeem',
        { clientUserId: clientId, points: amount },
        { params: { salonId: salon?.id } },
      );

      await loadBalance(clientId);
      setRedeemPoints('');
    } catch (error) {
      setMessage(t(getErrorKey(error)));
    } finally {
      setIsRedeeming(false);
    }
  }

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
      setMessage(isMasterWorkspace ? t('clients.historyUnavailable') : t('clients.loadClientsError'));
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
        if (!s) { setMessage(t('clients.salonNotFound')); return; }
        await loadClients(s.id);
      } catch {
        if (!cancelled) setMessage(t('clients.loadDataError'));
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
    return new Date(iso).toLocaleDateString(dateLocale, { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  return (
    <AppLayout>
      <main className="dashboard-page">
        <header className="dashboard-header centered-header">
          <div>
            <h1>{isMasterWorkspace ? t('clients.myTitle') : t('clients.title')}</h1>
            <p className="dashboard-subtitle">
              {isMasterWorkspace ? t('clients.mySubtitle') : t('clients.subtitle')}
            </p>
          </div>
          <div className="dashboard-period">
            <span>{t("clients.totalClients")}</span>
            <strong>{clients.length}</strong>
          </div>
        </header>

        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <button type="button" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, minHeight: 40, padding: '0 14px', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, background: 'rgba(255,255,255,0.05)', color: 'var(--app-text)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }} onClick={() => salon && loadClients(salon.id)} disabled={isLoading}>
            <RefreshCw size={15} style={isLoading ? { animation: 'spin 1s linear infinite' } : {}} /> {t('clients.refresh')}
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 13, background: 'rgba(255,255,255,0.05)', marginBottom: 16 }}>
          <Search size={16} style={{ color: 'var(--app-accent-strong)', flexShrink: 0 }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("clients.searchPlaceholder")} style={{ flex: 1, border: 0, outline: 0, background: 'transparent', color: 'var(--app-text)', fontSize: 13 }} />
          {search && <button type="button" style={{ display: 'flex', border: 0, background: 'transparent', color: 'var(--app-text-muted)', cursor: 'pointer' }} onClick={() => setSearch('')}><X size={14} /></button>}
        </div>

        {message && !clients.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '48px 20px', color: 'var(--app-text-muted)', textAlign: 'center' }}>
            <Users size={40} style={{ color: 'var(--app-accent)', opacity: 0.4 }} />
            <p>{message}</p>
            {isMasterWorkspace && <p style={{ fontSize: 13 }}>{t("clients.appointmentsHistory")}</p>}
          </div>
        ) : (
          <section className="dashboard-panel">
            <div className="panel-heading">
              <div><p className="panel-kicker">{t("clients.baseClients").toUpperCase()}</p><h2>{t('clients.count', { count: filtered.length })}</h2></div>
              <Users size={22} />
            </div>

            {filtered.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '48px 20px', color: 'var(--app-text-muted)', textAlign: 'center' }}>
                <Users size={40} style={{ color: 'var(--app-accent)', opacity: 0.4 }} />
                <p>{search ? t('clients.noResults') : t('clients.noClientsYet')}</p>
              </div>
            ) : (
              <div>
                {filtered.map((client, index) => {
                  const isExpanded = expandedId === client.id;
                  const fullName = `${client.firstName} ${client.lastName}`.trim();
                  const initials = getInitials(client.firstName, client.lastName);
                  return (
                    <div key={client.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '14px 16px', background: isExpanded ? 'rgba(var(--app-accent-rgb), 0.04)' : 'transparent' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }} onClick={() => {
                        const next = isExpanded ? null : client.id;
                        setExpandedId(next);
                        if (next) void loadBalance(next);
                      }}>
                        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: '50%', background: 'rgba(var(--app-accent-rgb), 0.12)', color: 'var(--app-accent-strong)', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{index + 1}</span>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: '50%', background: 'rgba(var(--app-accent-rgb), 0.16)', color: 'var(--app-accent-strong)', fontSize: 14, fontWeight: 700, flexShrink: 0 }}>{initials || <User size={16} />}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <strong style={{ color: 'var(--app-text)', fontSize: 14, display: 'block' }}>{fullName || t('clients.noName')}</strong>
                          <div style={{ display: 'flex', gap: 12, marginTop: 4, flexWrap: 'wrap' }}>
                            {!!client.email && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--app-text-muted)', fontSize: 12 }}><Mail size={11} />{client.email}</span>}
                            {client.phone && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--app-text-muted)', fontSize: 12 }}><Phone size={11} />{client.phone}</span>}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
                          {client.totalSpent != null && <div style={{ textAlign: 'right' }}><strong style={{ color: 'var(--app-accent)', fontSize: 14 }}>{client.totalSpent} MDL</strong><div style={{ color: 'var(--app-text-muted)', fontSize: 11 }}>{t("clients.spent")}</div></div>}
                          {client.totalAppointments != null && <div style={{ textAlign: 'right' }}><strong style={{ color: 'var(--app-text)', fontSize: 14 }}>{client.totalAppointments}</strong><div style={{ color: 'var(--app-text-muted)', fontSize: 11 }}>{t("clients.visits")}</div></div>}
                          <span style={{ color: 'var(--app-text-muted)', fontSize: 14 }}>{isExpanded ? '▲' : '▼'}</span>
                        </div>
                      </div>
                      {isExpanded && (
                        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8, marginBottom: 12 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', fontSize: 12, color: 'var(--app-text-muted)' }}><span>{t("clients.clientSince")}</span><strong>{formatDate(client.createdAt)}</strong></div>
                            {client.lastVisit && <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', fontSize: 12, color: 'var(--app-text-muted)' }}><span>{t("clients.lastVisit")}</span><strong>{formatDate(client.lastVisit)}</strong></div>}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', fontSize: 12, color: 'var(--app-text-muted)' }}><span>{t("clients.status")}</span><strong style={{ color: client.isActive !== false ? '#8ee5b5' : 'var(--app-accent-strong)' }}>{client.isActive !== false ? t('clients.active') : t('clients.inactive')}</strong></div>
                          </div>
                          {/* Баллы: копятся сами, списывает мастер при расчёте.
                              Тратить необязательно — решает клиент. */}
                          {balance && (
                            <div
                              style={{
                                marginBottom: 12,
                                padding: 12,
                                borderRadius: 12,
                                border: '1px solid rgba(var(--app-accent-rgb), 0.22)',
                                background: 'rgba(var(--app-accent-rgb), 0.06)',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
                                <strong style={{ color: 'var(--app-accent)', fontSize: 18 }}>
                                  {balance.points}
                                </strong>
                                <span style={{ color: 'var(--app-text-muted)', fontSize: 12 }}>
                                  {t('loyalty.pointsLabel')} · {balance.valueInCurrency} MDL
                                </span>
                              </div>

                              {balance.points > 0 && (
                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                  <input
                                    type="number"
                                    min="1"
                                    max={balance.points}
                                    value={redeemPoints}
                                    onChange={(e) => setRedeemPoints(e.target.value)}
                                    placeholder={t('loyalty.redeemPlaceholder')}
                                    style={{
                                      flex: '1 1 120px',
                                      padding: '9px 12px',
                                      border: '1px solid rgba(255,255,255,0.12)',
                                      borderRadius: 10,
                                      background: 'rgba(255,255,255,0.06)',
                                      color: 'var(--app-text)',
                                      fontSize: 13,
                                    }}
                                  />

                                  <button
                                    type="button"
                                    disabled={isRedeeming || !redeemPoints}
                                    onClick={() => void handleRedeem(client.id)}
                                    style={{
                                      minHeight: 38,
                                      padding: '0 16px',
                                      border: 0,
                                      borderRadius: 10,
                                      background: 'var(--app-accent)',
                                      color: '#17151c',
                                      fontSize: 12,
                                      fontWeight: 700,
                                      cursor: 'pointer',
                                      opacity: isRedeeming || !redeemPoints ? 0.5 : 1,
                                    }}
                                  >
                                    {t('loyalty.redeemButton')}
                                  </button>
                                </div>
                              )}
                            </div>
                          )}

                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {client.email && <a href={`mailto:${client.email}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 34, padding: '0 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'var(--app-text)', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}><Mail size={13} />{t("clients.sendEmail")}</a>}
                            {client.phone && <a href={`tel:${client.phone}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 34, padding: '0 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'var(--app-text)', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}><Phone size={13} />{t("clients.call")}</a>}
                            <button type="button" onClick={() => { window.location.hash = '#appointments'; }} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 34, padding: '0 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'var(--app-text)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}><CalendarDays size={13} />{t('clients.appointments')}</button>
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
