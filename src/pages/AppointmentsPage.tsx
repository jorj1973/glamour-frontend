import { useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  CalendarDays,
  Check,
  CheckCircle,
  Clock,
  Filter,
  MessageSquare,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  User,
  X,
  XCircle,
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
  cooperationType?: string | null;
};

import RescheduleDialog from '../components/RescheduleDialog';
import ChatWithButton from '../components/ChatWithButton';

type Appointment = {
  id: string;
  clientUserId: string;
  masterProfileId: string;
  masterServiceId: string;
  salonId: string;
  startTime: string;
  endTime: string;
  status: string;
  clientComment?: string;
  internalNote?: string;
  price?: number;
  clientName?: string;
  clientPhone?: string | null;
  clientEmail?: string | null;
  masterName?: string;
  serviceName?: string;
  createdAt: string;
};

type NewAppointmentForm = {
  masterProfileId: string;
  masterServiceId: string;
  startTime: string;
  clientComment: string;
};

type Master = {
  id: string;
  userId: string;
  profession: string;
  firstName?: string;
  lastName?: string;
};

type MasterService = {
  id: string;
  masterProfileId: string;
  customTitle?: string;
  price: number;
  durationMinutes: number;
  isActive: boolean;
};

const WORKSPACE_MODE_KEY = 'glamour_workspace_mode';
const CURRENT_SALON_ID_KEY = 'glamour_current_salon_id';

function getStatusConfig(t: (key: string) => string): Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> {
  return {
    pending: { label: t('appointments.status.pending'), color: '#ffd08b', bg: 'rgba(255,190,92,0.12)', icon: <Clock size={13} /> },
    confirmed: { label: t('appointments.status.confirmed'), color: '#a8c9ff', bg: 'rgba(114,167,255,0.12)', icon: <Check size={13} /> },
    completed: { label: t('appointments.status.completed'), color: '#8ee5b5', bg: 'rgba(77,208,139,0.12)', icon: <CheckCircle size={13} /> },
    cancelled: { label: t('appointments.status.cancelled'), color: 'var(--app-accent-strong)', bg: 'rgba(255,96,128,0.12)', icon: <XCircle size={13} /> },
    no_show: { label: t('appointments.status.no_show'), color: '#c9beca', bg: 'rgba(255,255,255,0.08)', icon: <X size={13} /> },
  };
}

function getWorkspaceMode(): WorkspaceMode {
  const mode = localStorage.getItem(WORKSPACE_MODE_KEY);
  if (mode === 'platform' || mode === 'salon' || mode === 'master') return mode;
  return 'salon';
}

function StatusBadge({ status }: { status: string }) {
  const { t: tBadge } = useTranslation();
  const cfg = getStatusConfig(tBadge)[status] ?? { label: status, color: 'var(--app-text-muted)', bg: 'rgba(255,255,255,0.08)', icon: null };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700,
      color: cfg.color, background: cfg.bg,
    }}>
      {cfg.icon}{cfg.label}
    </span>
  );
}

function AppointmentsPage() {
  const workspaceMode = getWorkspaceMode();
  const isMasterWorkspace = workspaceMode === 'master';
  const { t, i18n } = useTranslation();
  const STATUS_CONFIG = getStatusConfig(t);
  const dateLocale = i18n.language?.startsWith('ro') ? 'ro-RO' : i18n.language?.startsWith('en') ? 'en-GB' : 'ru-RU';

  const [salon, setSalon] = useState<SalonSummary | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [message, setMessage] = useState(t('appointments.loading'));
  const [search, setSearch] = useState('');
  /** Запись, которую сейчас переносят. */
  const [rescheduleItem, setRescheduleItem] = useState<Appointment | null>(
    null,
  );

  const [statusFilter, setStatusFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Форма новой записи
  const [masters, setMasters] = useState<Master[]>([]);
  const [masterServices, setMasterServices] = useState<MasterService[]>([]);
  const [form, setForm] = useState<NewAppointmentForm>({
    masterProfileId: '',
    masterServiceId: '',
    startTime: '',
    clientComment: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  async function loadAppointments(salonId: string) {
    setIsLoading(true);
    try {
      const endpoint = isMasterWorkspace ? '/appointments/my' : '/appointments';
      const res = await api.get<Appointment[]>(endpoint, { params: { salonId } });
      setAppointments(res.data);
      setMessage('');
    } catch {
      setMessage(t('common.loadError'));
    } finally {
      setIsLoading(false);
    }
  }

  async function loadMasters(salonId: string) {
    try {
      const res = await api.get<Master[]>('/masters', { params: { salonId } });
      setMasters(res.data);
    } catch {
      // ignore
    }
  }

  async function loadMasterServices(masterProfileId: string, salonId: string) {
    try {
      const res = await api.get<MasterService[]>(`/masters/${masterProfileId}/services`, { params: { salonId } });
      setMasterServices(res.data.filter((s) => s.isActive));
    } catch {
      setMasterServices([]);
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        const s = await loadSalon();
        if (cancelled) return;
        setSalon(s);
        if (!s) { setMessage(t('common.loadError')); return; }
        await Promise.all([
          loadAppointments(s.id),
          loadMasters(s.id),
        ]);
      } catch {
        if (!cancelled) setMessage(t('common.loadError'));
      }
    }
    void init();
    return () => { cancelled = true; };
  }, [isMasterWorkspace]);

  useEffect(() => {
    if (form.masterProfileId && salon) {
      void loadMasterServices(form.masterProfileId, salon.id);
    } else {
      setMasterServices([]);
    }
  }, [form.masterProfileId, salon]);

  function showSuccess(msg: string) {
    setSuccessMsg(msg);
    setErrorMsg('');
    setTimeout(() => setSuccessMsg(''), 3500);
  }

  function showError(msg: string) {
    setErrorMsg(msg);
    setSuccessMsg('');
  }

  /**
   * Мягкое удаление: запись скрывается, но остаётся в базе.
   * Только для владельца и админа — мастеру не даём, иначе
   * неудобная запись тихо исчезнет из его статистики.
   */
  async function handleDelete(id: string) {
    if (!window.confirm(t('appointments.confirmDelete'))) {
      return;
    }

    if (!salon) {
      return;
    }

    try {
      await api.delete(`/appointments/${id}`, {
        params: { salonId: salon.id },
      });

      setAppointments((prev) => prev.filter((item) => item.id !== id));
    } catch (error) {
      setErrorMsg(t(getErrorKey(error)));
    }
  }

  async function handleUpdateStatus(id: string, status: string) {
    if (!salon) return;
    try {
      await api.patch(`/appointments/${id}/status`, { status }, { params: { salonId: salon.id } });
      await loadAppointments(salon.id);
      showSuccess(t('appointments.statusUpdated'));
    } catch {
      showError(t('common.loadError'));
    }
  }

  async function handleCreateAppointment(e: React.FormEvent) {
    e.preventDefault();
    if (!salon) { showError(t('common.loadError')); return; }
    if (!form.masterProfileId || !form.masterServiceId || !form.startTime) {
      showError(t('appointments.fillRequired'));
      return;
    }
    setIsSubmitting(true);
    try {
      await api.post('/appointments', {
        masterProfileId: form.masterProfileId,
        masterServiceId: form.masterServiceId,
        startTime: new Date(form.startTime).toISOString(),
        clientComment: form.clientComment || undefined,
      }, { params: { salonId: salon.id } });
      await loadAppointments(salon.id);
      setShowForm(false);
      setForm({ masterProfileId: '', masterServiceId: '', startTime: '', clientComment: '' });
      showSuccess(t('appointments.created'));
    } catch {
      showError(t('common.loadError'));
    } finally {
      setIsSubmitting(false);
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return appointments.filter((a) => {
      const matchStatus = statusFilter === 'all' || a.status === statusFilter;
      const matchSearch = !q ||
        (a.clientName ?? '').toLowerCase().includes(q) ||
        (a.masterName ?? '').toLowerCase().includes(q) ||
        (a.serviceName ?? '').toLowerCase().includes(q) ||
        a.id.toLowerCase().includes(q);
      return matchStatus && matchSearch;
    });
  }, [appointments, search, statusFilter]);

  const counts = useMemo(() => {
    const result: Record<string, number> = { all: appointments.length };
    for (const a of appointments) {
      result[a.status] = (result[a.status] ?? 0) + 1;
    }
    return result;
  }, [appointments]);

  const todayCount = useMemo(() => {
    const today = new Date().toDateString();
    return appointments.filter((a) => new Date(a.startTime).toDateString() === today).length;
  }, [appointments]);

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString(dateLocale, {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  function formatDuration(start: string, end: string) {
    const diff = (new Date(end).getTime() - new Date(start).getTime()) / 60000;
    return `${diff} ${t('services.min')}`;
  }

  return (
    <AppLayout>
      <main className="dashboard-page">
        {/* Header */}
        <header className="dashboard-header centered-header">
          <div>
            <h1>{isMasterWorkspace ? t('appointments.myTitle') : t('appointments.title')}</h1>
            <p className="dashboard-subtitle">
              {isMasterWorkspace
                ? t('appointments.mySubtitle')
                : t('appointments.subtitle')}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div className="dashboard-period" style={{ minWidth: 120 }}>
              <span>{t("appointments.today")}</span>
              <strong>{todayCount}</strong>
            </div>
            <div className="dashboard-period" style={{ minWidth: 120 }}>
              <span>{t("appointments.total")}</span>
              <strong>{appointments.length}</strong>
            </div>
          </div>
        </header>

        {/* Уведомления */}
        {successMsg && (
          <div style={styles.alert('success')}><Check size={15} />{successMsg}</div>
        )}
        {errorMsg && (
          <div style={styles.alert('error')}><X size={15} />{errorMsg}</div>
        )}

        {/* Кнопки действий */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
          {!isMasterWorkspace && (
            <button type="button" style={styles.primaryBtn} onClick={() => setShowForm(!showForm)}>
              <Plus size={16} /> {t('appointments.newAppointment')}
            </button>
          )}
          <button
            type="button"
            style={styles.secondaryBtn}
            onClick={() => salon && loadAppointments(salon.id)}
            disabled={isLoading}
          >
            <RefreshCw size={15} style={isLoading ? { animation: 'spin 1s linear infinite' } : {}} />
            {t('appointments.refresh')}
          </button>
        </div>

        {/* Форма новой записи */}
        {showForm && !isMasterWorkspace && (
          <article className="dashboard-panel" style={{ marginBottom: 24 }}>
            <div className="panel-heading">
              <div>
                <p className="panel-kicker">{t('appointments.newAppointment').toUpperCase()}</p>
                <h2>{t('appointments.createTitle')}</h2>
              </div>
              <button type="button" style={styles.closeBtn} onClick={() => setShowForm(false)}>
                <X size={18} />
              </button>
            </div>
            <form className="service-form" onSubmit={handleCreateAppointment}>
              <div className="service-form-grid">
                <label>
                  {t('appointments.master')} *
                  <select
                    style={styles.select}
                    value={form.masterProfileId}
                    onChange={(e) => setForm({ ...form, masterProfileId: e.target.value, masterServiceId: '' })}
                    required
                  >
                    <option value="">{t('appointments.selectMaster')}</option>
                    {masters.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.firstName} {m.lastName} · {m.profession}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {t('appointments.serviceLabel')} *
                  <select
                    style={styles.select}
                    value={form.masterServiceId}
                    onChange={(e) => setForm({ ...form, masterServiceId: e.target.value })}
                    required
                    disabled={!form.masterProfileId}
                  >
                    <option value="">{t('services.selectPlaceholder')}</option>
                    {masterServices.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.customTitle ?? t('appointments.service')} · {s.durationMinutes} {t('services.min')} · {s.price} MDL
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {t('appointments.dateTime')} *
                  <input
                    type="datetime-local"
                    style={styles.input}
                    value={form.startTime}
                    onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                    required
                  />
                </label>
                <label>
                  {t('appointments.clientComment')}
                  <input
                    type="text"
                    style={styles.input}
                    value={form.clientComment}
                    onChange={(e) => setForm({ ...form, clientComment: e.target.value })}
                    placeholder={t('common.optional')}
                  />
                </label>
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
                <button type="submit" className="primary-action" style={{ flex: '1 1 160px', minHeight: 48 }} disabled={isSubmitting}>
                  {isSubmitting ? t('common.creating') : t('appointments.newAppointment')}
                </button>
                <button type="button" className="danger-action" onClick={() => setShowForm(false)}>
                  {t('common.cancel')}
                </button>
              </div>
            </form>
          </article>
        )}

        {rescheduleItem && (
          <RescheduleDialog
            appointment={rescheduleItem}
            allowLate
            onClose={() => setRescheduleItem(null)}
            onDone={() => {
              setRescheduleItem(null);
              if (salon) void loadAppointments(salon.id);
            }}
          />
        )}

        {/* Фильтры */}
        <div style={styles.filtersRow}>
          <div style={styles.searchBar}>
            <Search size={15} style={{ color: 'var(--app-accent-strong)', flexShrink: 0 }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("appointments.searchPlaceholder")}
              style={styles.searchInput}
            />
            {search && (
              <button type="button" style={styles.clearBtn} onClick={() => setSearch('')}>
                <X size={13} />
              </button>
            )}
          </div>

          <div style={styles.statusFilters}>
            <Filter size={15} style={{ color: 'var(--app-accent-strong)' }} />
            {['all', 'pending', 'confirmed', 'completed', 'cancelled'].map((s) => (
              <button
                key={s}
                type="button"
                style={styles.filterBtn(statusFilter === s)}
                onClick={() => setStatusFilter(s)}
              >
                {s === 'all' ? t('common.all') : STATUS_CONFIG[s]?.label ?? s}
                {counts[s] != null && (
                  <span style={styles.filterCount}>{counts[s]}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Список записей */}
        {message && !appointments.length ? (
          <p className="dashboard-status">{message}</p>
        ) : (
          <section className="dashboard-panel">
            <div className="panel-heading">
              <div>
                <p className="panel-kicker">{t("appointments.schedule").toUpperCase()}</p>
                <h2>{t('appointments.count', { count: filtered.length })}</h2>
              </div>
              <CalendarDays size={22} />
            </div>

            {filtered.length === 0 ? (
              <div style={styles.emptyState}>
                <Calendar size={40} style={{ color: 'var(--app-accent)', opacity: 0.4 }} />
                <p>{t("appointments.noResults")}</p>
                {search || statusFilter !== 'all' ? (
                  <button type="button" style={styles.secondaryBtn}
                    onClick={() => { setSearch(''); setStatusFilter('all'); }}>
                    {t('appointments.resetFilters')}
                  </button>
                ) : null}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {filtered.map((a) => {
                  const isExpanded = expandedId === a.id;
                  const isToday = new Date(a.startTime).toDateString() === new Date().toDateString();

                  return (
                    <div key={a.id} style={styles.appointmentCard(isToday)}>
                      {/* Основная строка */}
                      <div
                        style={styles.appointmentRow}
                        onClick={() => setExpandedId(isExpanded ? null : a.id)}
                      >
                        {/* Дата/время */}
                        <div style={styles.dateBlock}>
                          <strong style={{ color: 'var(--app-text)', fontSize: 14 }}>
                            {new Date(a.startTime).toLocaleString(dateLocale, { day: '2-digit', month: '2-digit' })}
                          </strong>
                          <span style={{ color: 'var(--app-text-muted)', fontSize: 12 }}>
                            {new Date(a.startTime).toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        {/* Инфо */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <StatusBadge status={a.status} />
                            {isToday && (
                              <span style={{ ...styles.filterCount, background: 'rgba(114,167,255,0.15)', color: '#a8c9ff' }}>
                                {t('appointments.todayBadge')}
                              </span>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: 14, marginTop: 6, flexWrap: 'wrap' }}>
                            {/* Имя первым: мастер смотрит список, чтобы понять,
                                кто придёт. Телефон нужен реже — только для звонка. */}
                            {a.clientName && (
                              <span style={styles.infoChip}>
                                <User size={12} /> {a.clientName}
                              </span>
                            )}

                            {a.clientPhone && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--app-text-muted)' }}>
                                <Phone size={12} /> {a.clientPhone}
                              </span>
                            )}
                            {a.masterName && (
                              <span style={styles.infoChip}>
                                ✂️ {a.masterName}
                              </span>
                            )}
                            {a.serviceName && (
                              <span style={styles.infoChip}>
                                {a.serviceName}
                              </span>
                            )}
                            <span style={styles.infoChip}>
                              <Clock size={12} /> {formatDuration(a.startTime, a.endTime)}
                            </span>
                          </div>
                        </div>

                        {/* Цена */}
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          {a.price != null && (
                            <strong style={{ color: 'var(--app-accent)', fontSize: 15 }}>{a.price} MDL</strong>
                          )}
                          <div style={{ color: 'var(--app-text-muted)', fontSize: 11, marginTop: 3 }}>
                            {isExpanded ? '▲' : '▼'}
                          </div>
                        </div>
                      </div>

                      {/* Детали */}
                      {isExpanded && (
                        <div style={styles.expandedBlock}>
                          <div style={styles.detailGrid}>
                            <div style={styles.detailItem}>
                              <span>{t('appointments.start')}</span>
                              <strong>{formatDate(a.startTime)}</strong>
                            </div>
                            <div style={styles.detailItem}>
                              <span>{t('appointments.end')}</span>
                              <strong>{formatDate(a.endTime)}</strong>
                            </div>
                            <div style={styles.detailItem}>
                              <span>{t('appointments.duration')}</span>
                              <strong>{formatDuration(a.startTime, a.endTime)}</strong>
                            </div>
                            <div style={styles.detailItem}>
                              <span>ID</span>
                              <strong style={{ fontSize: 11 }}>{a.id.slice(0, 12)}...</strong>
                            </div>
                          </div>

                          {a.clientComment && (
                            <div style={styles.commentBlock}>
                              <MessageSquare size={13} style={{ color: 'var(--app-accent-strong)' }} />
                              <span>{a.clientComment}</span>
                            </div>
                          )}

                          {/* Управление статусом */}
                          {!isMasterWorkspace && a.status !== 'completed' && a.status !== 'cancelled' && (
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                              {a.status === 'pending' && (
                                <button type="button" style={styles.actionBtn('confirm')}
                                  onClick={() => handleUpdateStatus(a.id, 'confirmed')}>
                                  <Check size={13} /> {t('appointments.confirm')}
                                </button>
                              )}
                              {a.status !== 'completed' && (
                                <button type="button" style={styles.actionBtn('complete')}
                                  onClick={() => handleUpdateStatus(a.id, 'completed')}>
                                  <CheckCircle size={13} /> {t('appointments.complete')}
                                </button>
                              )}
                              {a.status !== 'completed' && a.status !== 'cancelled' && (
                                <button type="button" style={styles.actionBtn('confirm')}
                                  onClick={() => setRescheduleItem(a)}>
                                  <CalendarDays size={13} /> {t('reschedule.action')}
                                </button>
                              )}

                              <button type="button" style={styles.actionBtn('cancel')}
                                onClick={() => handleUpdateStatus(a.id, 'cancelled')}>
                                <X size={13} /> {t('appointments.cancel')}
                              </button>

                              {/* Удаление — для ошибочных записей.
                                  Отменённая остаётся видимой, удалённая исчезает. */}
                              <button type="button" style={styles.actionBtn('cancel')}
                                onClick={() => void handleDelete(a.id)}>
                                <Trash2 size={13} /> {t('appointments.delete')}
                              </button>
                            </div>
                          )}

                          {/* Написать клиенту можно всегда — и после
                              завершённого визита, и после отмены.
                              Ряд выше к этому времени скрыт целиком,
                              а повод написать как раз тогда и есть. */}
                          {!isMasterWorkspace && (
                            <ChatWithButton
                              userId={a.clientUserId}
                              small
                              style={{ marginTop: 12 }}
                            />
                          )}

                          {isMasterWorkspace && (
                            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                              {a.status === 'pending' && (
                                <button type="button" style={styles.actionBtn('confirm')}
                                  onClick={() => handleUpdateStatus(a.id, 'confirmed')}>
                                  <Check size={13} /> {t('appointments.confirm')}
                                </button>
                              )}


                              {/* Завершение визита — основное действие мастера.
                                  При нём клиенту начисляются баллы за услугу. */}
                              {a.status !== 'completed' && a.status !== 'cancelled' && (
                                <button type="button" style={styles.actionBtn('complete')}
                                  onClick={() => handleUpdateStatus(a.id, 'completed')}>
                                  <CheckCircle size={13} /> {t('appointments.complete')}
                                </button>
                              )}

                              {a.status !== 'completed' && a.status !== 'cancelled' && (
                                <button type="button" style={styles.actionBtn('confirm')}
                                  onClick={() => setRescheduleItem(a)}>
                                  <CalendarDays size={13} /> {t('reschedule.action')}
                                </button>
                              )}

                              {/* Кнопка сама решает, показываться ли:
                                  чат открыт не всем салонам. */}
                              <ChatWithButton
                                userId={a.clientUserId}
                                small
                              />


                              {a.status === 'pending' && (
                                <button type="button" style={styles.actionBtn('cancel')}
                                  onClick={() => handleUpdateStatus(a.id, 'cancelled')}>
                                  <X size={13} /> {t('appointments.cancel')}
                                </button>
                              )}

                              {/* Независимый мастер арендует кресло и ведёт своё дело —
                                  его записи только его. Штатному нельзя: его выручка
                                  входит в отчёты салона. */}
                              {salon?.cooperationType === 'independent' && (
                                <button type="button" style={styles.actionBtn('cancel')}
                                  onClick={() => void handleDelete(a.id)}>
                                  <Trash2 size={13} /> {t('appointments.delete')}
                                </button>
                              )}
                            </div>
                          )}
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

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </AppLayout>
  );
}

const styles = {
  alert: (type: 'success' | 'error') => ({
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '11px 15px', borderRadius: 13, marginBottom: 16,
    fontSize: 13, fontWeight: 700,
    border: `1px solid ${type === 'success' ? 'rgba(77,208,139,0.25)' : 'rgba(255,96,128,0.25)'}`,
    background: type === 'success' ? 'rgba(77,208,139,0.1)' : 'rgba(255,96,128,0.1)',
    color: type === 'success' ? '#9ae9bd' : 'var(--app-accent-strong)',
  } as React.CSSProperties),

  primaryBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 7,
    minHeight: 42, padding: '0 16px', border: 0, borderRadius: 12,
    background: 'var(--app-accent)', color: '#17151c', fontSize: 13, fontWeight: 700, cursor: 'pointer',
  } as React.CSSProperties,

  secondaryBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 7,
    minHeight: 42, padding: '0 14px',
    border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12,
    background: 'rgba(255,255,255,0.05)', color: 'var(--app-text)',
    fontSize: 13, fontWeight: 700, cursor: 'pointer',
  } as React.CSSProperties,

  closeBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 34, height: 34, border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 10, background: 'rgba(255,255,255,0.05)',
    color: 'var(--app-text-muted)', cursor: 'pointer',
  } as React.CSSProperties,

  select: {
    width: '100%', padding: '11px 13px',
    border: '1px solid rgba(255,255,255,0.12)', borderRadius: 13,
    background: 'rgba(255,255,255,0.06)', color: 'var(--app-text)', fontSize: 14,
  } as React.CSSProperties,

  input: {
    width: '100%', padding: '11px 13px',
    border: '1px solid rgba(255,255,255,0.12)', borderRadius: 13,
    background: 'rgba(255,255,255,0.06)', color: 'var(--app-text)', fontSize: 14,
    outline: 'none',
  } as React.CSSProperties,

  filtersRow: {
    display: 'flex', gap: 12, marginBottom: 16,
    flexWrap: 'wrap' as const, alignItems: 'center',
  },

  searchBar: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '8px 13px', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 12, background: 'rgba(255,255,255,0.05)', flex: 1, minWidth: 200,
  } as React.CSSProperties,

  searchInput: {
    flex: 1, border: 0, outline: 0,
    background: 'transparent', color: 'var(--app-text)', fontSize: 13,
  } as React.CSSProperties,

  clearBtn: {
    display: 'flex', border: 0,
    background: 'transparent', color: 'var(--app-text-muted)', cursor: 'pointer',
  } as React.CSSProperties,

  statusFilters: {
    display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' as const,
  },

  filterBtn: (active: boolean) => ({
    display: 'inline-flex', alignItems: 'center', gap: 5,
    minHeight: 34, padding: '0 12px',
    border: `1px solid ${active ? 'rgba(var(--app-accent-rgb), 0.4)' : 'rgba(255,255,255,0.1)'}`,
    borderRadius: 10,
    background: active ? 'rgba(var(--app-accent-rgb), 0.14)' : 'rgba(255,255,255,0.04)',
    color: active ? 'var(--app-accent-strong)' : 'var(--app-text-muted)',
    fontSize: 12, fontWeight: 700, cursor: 'pointer',
  } as React.CSSProperties),

  filterCount: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    minWidth: 20, height: 18, padding: '0 5px', borderRadius: 999,
    background: 'rgba(255,255,255,0.1)', color: 'var(--app-text)', fontSize: 10, fontWeight: 700,
  } as React.CSSProperties,

  emptyState: {
    display: 'flex', flexDirection: 'column' as const,
    alignItems: 'center', gap: 10, padding: '40px 20px',
    color: 'var(--app-text-muted)', textAlign: 'center' as const,
  },

  appointmentCard: (isToday: boolean) => ({
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    borderLeft: isToday ? '3px solid rgba(114,167,255,0.5)' : '3px solid transparent',
    padding: '14px 16px',
    transition: 'background 0.15s',
  } as React.CSSProperties),

  appointmentRow: {
    display: 'flex', alignItems: 'flex-start', gap: 14, cursor: 'pointer',
  } as React.CSSProperties,

  dateBlock: {
    display: 'flex', flexDirection: 'column' as const,
    alignItems: 'center', gap: 2, minWidth: 42,
    padding: '6px 8px', borderRadius: 10,
    background: 'rgba(255,255,255,0.04)', flexShrink: 0,
  },

  infoChip: {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    color: 'var(--app-text-muted)', fontSize: 12,
  } as React.CSSProperties,

  expandedBlock: {
    marginTop: 12, paddingTop: 12,
    borderTop: '1px solid rgba(255,255,255,0.06)',
  } as React.CSSProperties,

  detailGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
    gap: 8, marginBottom: 10,
  } as React.CSSProperties,

  detailItem: {
    display: 'flex', flexDirection: 'column' as const, gap: 3,
    padding: '9px 11px', borderRadius: 9,
    background: 'rgba(255,255,255,0.04)', fontSize: 11, color: 'var(--app-text-muted)',
  },

  commentBlock: {
    display: 'flex', alignItems: 'flex-start', gap: 8,
    padding: '10px 12px', borderRadius: 10, marginTop: 8,
    background: 'rgba(var(--app-accent-rgb), 0.07)', color: 'var(--app-text)', fontSize: 13,
  } as React.CSSProperties,

  actionBtn: (type: 'confirm' | 'complete' | 'cancel') => ({
    display: 'inline-flex', alignItems: 'center', gap: 5,
    minHeight: 34, padding: '0 12px', borderRadius: 10,
    fontSize: 12, fontWeight: 700, cursor: 'pointer',
    border: type === 'cancel'
      ? '1px solid rgba(255,96,128,0.25)'
      : type === 'confirm'
        ? '1px solid rgba(114,167,255,0.25)'
        : '1px solid rgba(77,208,139,0.25)',
    background: type === 'cancel'
      ? 'rgba(255,96,128,0.1)'
      : type === 'confirm'
        ? 'rgba(114,167,255,0.1)'
        : 'rgba(77,208,139,0.1)',
    color: type === 'cancel' ? 'var(--app-accent-strong)' : type === 'confirm' ? '#a8c9ff' : '#8ee5b5',
  } as React.CSSProperties),
};

export default AppointmentsPage;
