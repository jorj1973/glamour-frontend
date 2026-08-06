import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Edit2,
  Plus,
  Search,
  Scissors,
  Sparkles,
  Trash2,
  X,
  Zap,
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

type Service = {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  basePrice: number;
  isActive: boolean;
};

type MasterService = {
  id: string;
  salonId: string;
  masterProfileId: string;
  serviceId: string;
  price: number;
  minPrice: number | null;
  maxPrice: number | null;
  durationMinutes: number;
  bufferBeforeMinutes: number | null;
  bufferAfterMinutes: number | null;
  customTitle: string | null;
  customDescription: string | null;
  isActive: boolean;
  isPublic: boolean;
  onlineBookingEnabled: boolean;
  requiresDeposit: boolean;
  depositAmount: number | null;
  requiresConsultation: boolean;
  tags: string[] | null;
};

type AddMode = 'catalog' | 'custom' | null;

const WORKSPACE_MODE_KEY = 'glamour_workspace_mode';
const CURRENT_SALON_ID_KEY = 'glamour_current_salon_id';

function getWorkspaceMode(): WorkspaceMode {
  const mode = localStorage.getItem(WORKSPACE_MODE_KEY);
  if (mode === 'platform' || mode === 'salon' || mode === 'master') return mode;
  return 'salon';
}

// ─── Маленький компонент переключателя ───────────────────────────────────────
function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', color: '#d7ced8', fontSize: 13 }}>
      <span
        onClick={() => onChange(!checked)}
        style={{
          display: 'inline-flex',
          width: 40,
          height: 22,
          borderRadius: 11,
          background: checked ? '#d682b8' : 'rgba(255,255,255,0.12)',
          position: 'relative',
          transition: 'background 0.2s',
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        <span style={{
          position: 'absolute',
          top: 3,
          left: checked ? 21 : 3,
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: '#fff',
          transition: 'left 0.2s',
        }} />
      </span>
      {label}
    </label>
  );
}

// ─── Главный компонент ────────────────────────────────────────────────────────
function ServicesPage() {
  const workspaceMode = getWorkspaceMode();
  const isMasterWorkspace = workspaceMode === 'master';

  const [salon, setSalon] = useState<SalonSummary | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [masterServices, setMasterServices] = useState<MasterService[]>([]);
  const [message, setMessage] = useState(isMasterWorkspace ? 'Загрузка ваших услуг...' : 'Загрузка услуг...');
  const [search, setSearch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // ── Режим добавления (только мастер) ──────────────────────────────────────
  const [addMode, setAddMode] = useState<AddMode>(null);
  const [expandedServiceId, setExpandedServiceId] = useState<string | null>(null);

  // ── Форма: выбор из каталога ───────────────────────────────────────────────
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [masterPrice, setMasterPrice] = useState('');
  const [masterDuration, setMasterDuration] = useState('');
  const [bufferBefore, setBufferBefore] = useState('0');
  const [bufferAfter, setBufferAfter] = useState('0');
  const [catalogOnlineBooking, setCatalogOnlineBooking] = useState(true);
  const [catalogPublic, setCatalogPublic] = useState(true);
  const [catalogDeposit, setCatalogDeposit] = useState(false);
  const [catalogDepositAmount, setCatalogDepositAmount] = useState('');
  const [catalogConsultation, setCatalogConsultation] = useState(false);

  // ── Форма: своя услуга ─────────────────────────────────────────────────────
  const [customTitle, setCustomTitle] = useState('');
  const [customDescription, setCustomDescription] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [customDuration, setCustomDuration] = useState('60');
  const [customBufferBefore, setCustomBufferBefore] = useState('0');
  const [customBufferAfter, setCustomBufferAfter] = useState('0');
  const [customOnlineBooking, setCustomOnlineBooking] = useState(true);
  const [customPublic, setCustomPublic] = useState(true);
  const [customDeposit, setCustomDeposit] = useState(false);
  const [customDepositAmount, setCustomDepositAmount] = useState('');
  const [customConsultation, setCustomConsultation] = useState(false);
  const [customTags, setCustomTags] = useState('');

  // ── Форма: каталог салона (owner/admin) ────────────────────────────────────
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('60');
  const [basePrice, setBasePrice] = useState('300');

  // ── Загрузка данных ────────────────────────────────────────────────────────
  async function loadSalon(): Promise<SalonSummary | null> {
    const response = await api.get<SalonSummary[]>('/salons/my');
    const available = response.data;
    if (available.length === 0) return null;
    if (!isMasterWorkspace) return available[0] ?? null;

    const masterSalons = available.filter(
      (s) => s.membershipStatus === 'active' &&
        (s.membershipRoles?.includes('master') || s.membershipRole === 'master'),
    );
    if (masterSalons.length === 0) return null;

    const savedId = localStorage.getItem(CURRENT_SALON_ID_KEY);
    const found = savedId ? masterSalons.find((s) => s.id === savedId) : undefined;
    const current = found ?? masterSalons[0];
    localStorage.setItem(CURRENT_SALON_ID_KEY, current.id);
    return current;
  }

  async function reloadData(salonId: string) {
    if (isMasterWorkspace) {
      const [cat, my] = await Promise.all([
        api.get<Service[]>('/masters/me/available-services', { params: { salonId } }),
        api.get<MasterService[]>('/masters/me/services', { params: { salonId } }),
      ]);
      setServices(cat.data);
      setMasterServices(my.data);
    } else {
      const res = await api.get<Service[]>('/services', { params: { salonId } });
      setServices(res.data);
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
        await reloadData(s.id);
        setMessage('');
      } catch {
        if (!cancelled) setMessage(isMasterWorkspace ? 'Не удалось загрузить услуги мастера.' : 'Не удалось загрузить услуги.');
      }
    }
    void init();
    return () => { cancelled = true; };
  }, [isMasterWorkspace]);

  // ── Мемо ─────────────────────────────────────────────────────────────────
  const serviceById = useMemo(
    () => new Map(services.map((s) => [s.id, s])),
    [services],
  );

  const masterServiceByServiceId = useMemo(
    () => new Map(masterServices.map((ms) => [ms.serviceId, ms])),
    [masterServices],
  );

  const filteredServices = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return services;
    return services.filter((s) =>
      s.name.toLowerCase().includes(q) || (s.description ?? '').toLowerCase().includes(q),
    );
  }, [services, search]);

  const filteredMasterServices = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return masterServices;
    return masterServices.filter((ms) => {
      const svc = serviceById.get(ms.serviceId);
      const title = ms.customTitle ?? svc?.name ?? '';
      return title.toLowerCase().includes(q);
    });
  }, [masterServices, search, serviceById]);

  // ── Уведомления ──────────────────────────────────────────────────────────
  function showSuccess(msg: string) {
    setSuccessMessage(msg);
    setErrorMessage('');
    setTimeout(() => setSuccessMessage(''), 3500);
  }

  function showError(msg: string) {
    setErrorMessage(msg);
    setSuccessMessage('');
  }

  // ── Выбор услуги из каталога для формы мастера ───────────────────────────
  function handleCatalogSelect(serviceId: string) {
    setSelectedServiceId(serviceId);
    const svc = serviceById.get(serviceId);
    const existing = masterServiceByServiceId.get(serviceId);
    if (existing) {
      setMasterPrice(String(existing.price));
      setMasterDuration(String(existing.durationMinutes));
      setBufferBefore(String(existing.bufferBeforeMinutes ?? 0));
      setBufferAfter(String(existing.bufferAfterMinutes ?? 0));
      setCatalogOnlineBooking(existing.onlineBookingEnabled);
      setCatalogPublic(existing.isPublic);
      setCatalogDeposit(existing.requiresDeposit);
      setCatalogDepositAmount(String(existing.depositAmount ?? ''));
      setCatalogConsultation(existing.requiresConsultation);
    } else if (svc) {
      setMasterPrice(String(svc.basePrice));
      setMasterDuration(String(svc.durationMinutes));
      setBufferBefore('0');
      setBufferAfter('0');
      setCatalogOnlineBooking(true);
      setCatalogPublic(true);
      setCatalogDeposit(false);
      setCatalogDepositAmount('');
      setCatalogConsultation(false);
    }
  }

  // ── Сохранить услугу из каталога ─────────────────────────────────────────
  async function handleSaveCatalogService(e: React.FormEvent) {
    e.preventDefault();
    if (!salon || !selectedServiceId) { showError('Выберите услугу.'); return; }
    setIsSubmitting(true);
    try {
      await api.post('/masters/me/services', {
        serviceId: selectedServiceId,
        price: Number(masterPrice),
        durationMinutes: Number(masterDuration),
        bufferBeforeMinutes: Number(bufferBefore),
        bufferAfterMinutes: Number(bufferAfter),
        onlineBookingEnabled: catalogOnlineBooking,
        isPublic: catalogPublic,
        requiresDeposit: catalogDeposit,
        depositAmount: catalogDeposit ? Number(catalogDepositAmount) : null,
        requiresConsultation: catalogConsultation,
      }, { params: { salonId: salon.id } });
      await reloadData(salon.id);
      setAddMode(null);
      setSelectedServiceId('');
      showSuccess('Услуга добавлена в ваш список!');
    } catch {
      showError('Не удалось сохранить услугу.');
    } finally {
      setIsSubmitting(false);
    }
  }

  // ── Создать свою услугу ───────────────────────────────────────────────────
  async function handleSaveCustomService(e: React.FormEvent) {
    e.preventDefault();
    if (!salon) { showError('Салон не найден.'); return; }
    if (!customTitle.trim()) { showError('Введите название услуги.'); return; }
    setIsSubmitting(true);
    try {
      // Backend создаёт Service + MasterService автоматически
      await api.post('/masters/me/services/custom', {
        customTitle: customTitle.trim(),
        customDescription: customDescription.trim() || null,
        price: Number(customPrice),
        durationMinutes: Number(customDuration),
        bufferBeforeMinutes: Number(customBufferBefore),
        bufferAfterMinutes: Number(customBufferAfter),
        onlineBookingEnabled: customOnlineBooking,
        isPublic: customPublic,
        requiresDeposit: customDeposit,
        depositAmount: customDeposit ? Number(customDepositAmount) : null,
        requiresConsultation: customConsultation,
        tags: customTags.trim()
          ? customTags.split(',').map((t) => t.trim()).filter(Boolean)
          : null,
      }, { params: { salonId: salon.id } });
      await reloadData(salon.id);
      setAddMode(null);
      setCustomTitle('');
      setCustomDescription('');
      setCustomPrice('');
      setCustomDuration('60');
      setCustomBufferBefore('0');
      setCustomBufferAfter('0');
      setCustomTags('');
      showSuccess('Ваша услуга создана!');
    } catch {
      showError('Не удалось создать услугу. Убедитесь что backend поддерживает этот endpoint.');
    } finally {
      setIsSubmitting(false);
    }
  }

  // ── Действия с мастер-услугой ─────────────────────────────────────────────
  async function handleToggleMasterService(id: string, isActive: boolean) {
    if (!salon) return;
    try {
      await api.patch(
        `/masters/me/services/${id}/${isActive ? 'deactivate' : 'activate'}`,
        undefined,
        { params: { salonId: salon.id } },
      );
      await reloadData(salon.id);
      showSuccess(isActive ? 'Услуга отключена.' : 'Услуга активирована.');
    } catch {
      showError('Не удалось изменить статус услуги.');
    }
  }

  async function handleRemoveMasterService(id: string) {
    if (!salon) return;
    if (!confirm('Удалить услугу из вашего списка?')) return;
    try {
      await api.delete(`/masters/me/services/${id}`, { params: { salonId: salon.id } });
      await reloadData(salon.id);
      showSuccess('Услуга удалена.');
    } catch {
      showError('Не удалось удалить услугу.');
    }
  }

  // ── Действия с услугами салона ────────────────────────────────────────────
  async function handleCreateSalonService(e: React.FormEvent) {
    e.preventDefault();
    if (!salon) { showError('Салон не найден.'); return; }
    setIsSubmitting(true);
    try {
      await api.post('/services', {
        name,
        description: description.trim() || null,
        durationMinutes: Number(durationMinutes),
        basePrice: Number(basePrice),
        isActive: true,
      }, { params: { salonId: salon.id } });
      setName('');
      setDescription('');
      setDurationMinutes('60');
      setBasePrice('300');
      await reloadData(salon.id);
      showSuccess('Услуга добавлена в каталог!');
    } catch {
      showError('Не удалось создать услугу.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeactivateSalonService(id: string) {
    if (!salon) return;
    try {
      await api.patch(`/services/${id}/deactivate`, undefined, { params: { salonId: salon.id } });
      await reloadData(salon.id);
      showSuccess('Услуга отключена.');
    } catch {
      showError('Не удалось отключить услугу.');
    }
  }

  // ── Общий лоадер ─────────────────────────────────────────────────────────
  if (message && !salon) {
    return (
      <AppLayout>
        <main className="dashboard-page">
          <p className="dashboard-status">{message}</p>
        </main>
      </AppLayout>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // МАСТЕР — кабинет
  // ══════════════════════════════════════════════════════════════════════════
  if (isMasterWorkspace) {
    const activeCount = masterServices.filter((ms) => ms.isActive).length;

    return (
      <AppLayout>
        <main className="dashboard-page">
          {/* Header */}
          <header className="dashboard-header">
            <div>
              <p className="dashboard-eyebrow">МОЙ КАБИНЕТ</p>
              <h1>Мои услуги</h1>
              <p className="dashboard-subtitle">
                Управляйте своим прайс-листом. Выбирайте услуги из каталога
                или создавайте собственные с индивидуальными условиями.
              </p>
            </div>
            <div className="dashboard-period">
              <span>Активных</span>
              <strong>{activeCount}</strong>
            </div>
          </header>

          {/* Уведомления */}
          {successMessage && (
            <div style={styles.alert('success')}>
              <Check size={16} />{successMessage}
            </div>
          )}
          {errorMessage && (
            <div style={styles.alert('error')}>
              <X size={16} />{errorMessage}
            </div>
          )}

          {/* Кнопки добавления */}
          {addMode === null && (
            <div style={styles.addButtons}>
              <button
                type="button"
                style={styles.addBtn('catalog')}
                onClick={() => setAddMode('catalog')}
              >
                <Scissors size={18} />
                <div>
                  <strong>Выбрать из каталога</strong>
                  <span>Услуги вашего салона</span>
                </div>
              </button>

              <button
                type="button"
                style={styles.addBtn('custom')}
                onClick={() => setAddMode('custom')}
              >
                <Sparkles size={18} />
                <div>
                  <strong>Создать свою услугу</strong>
                  <span>Полностью ваши условия</span>
                </div>
              </button>
            </div>
          )}

          {/* ── Форма: из каталога ── */}
          {addMode === 'catalog' && (
            <article className="dashboard-panel" style={{ marginBottom: 24 }}>
              <div className="panel-heading">
                <div>
                  <p className="panel-kicker">ИЗ КАТАЛОГА САЛОНА</p>
                  <h2>Добавить услугу</h2>
                </div>
                <button type="button" style={styles.closeBtn} onClick={() => setAddMode(null)}>
                  <X size={20} />
                </button>
              </div>

              <form className="service-form" onSubmit={handleSaveCatalogService}>
                <label>
                  Услуга салона
                  <select
                    value={selectedServiceId}
                    onChange={(e) => handleCatalogSelect(e.target.value)}
                    required
                    style={styles.select}
                  >
                    <option value="">— Выберите услугу —</option>
                    {services.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} · {s.durationMinutes} мин · {s.basePrice} MDL
                        {masterServiceByServiceId.has(s.id) ? ' ✓' : ''}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="service-form-grid">
                  <label>
                    Моя цена, MDL
                    <input type="number" min="0" step="0.01" value={masterPrice}
                      onChange={(e) => setMasterPrice(e.target.value)} required />
                  </label>
                  <label>
                    Длительность, мин
                    <input type="number" min="5" max="1440" value={masterDuration}
                      onChange={(e) => setMasterDuration(e.target.value)} required />
                  </label>
                  <label>
                    Буфер до, мин
                    <input type="number" min="0" max="240" value={bufferBefore}
                      onChange={(e) => setBufferBefore(e.target.value)} />
                  </label>
                  <label>
                    Буфер после, мин
                    <input type="number" min="0" max="240" value={bufferAfter}
                      onChange={(e) => setBufferAfter(e.target.value)} />
                  </label>
                </div>

                {catalogDeposit && (
                  <label>
                    Сумма депозита, MDL
                    <input type="number" min="0" step="0.01" value={catalogDepositAmount}
                      onChange={(e) => setCatalogDepositAmount(e.target.value)} />
                  </label>
                )}

                <div style={styles.togglesGrid}>
                  <Toggle checked={catalogOnlineBooking} onChange={setCatalogOnlineBooking} label="Онлайн-запись" />
                  <Toggle checked={catalogPublic} onChange={setCatalogPublic} label="Публичная" />
                  <Toggle checked={catalogDeposit} onChange={setCatalogDeposit} label="Требует депозит" />
                  <Toggle checked={catalogConsultation} onChange={setCatalogConsultation} label="Консультация" />
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                  <button type="submit" className="primary-action" style={{ flex: 1 }} disabled={isSubmitting}>
                    {isSubmitting ? 'Сохраняем...' : 'Сохранить'}
                  </button>
                  <button type="button" className="danger-action" onClick={() => setAddMode(null)}>
                    Отмена
                  </button>
                </div>
              </form>
            </article>
          )}

          {/* ── Форма: своя услуга ── */}
          {addMode === 'custom' && (
            <article className="dashboard-panel" style={{ marginBottom: 24 }}>
              <div className="panel-heading">
                <div>
                  <p className="panel-kicker">МОЯ АВТОРСКАЯ УСЛУГА</p>
                  <h2>Создать услугу</h2>
                </div>
                <button type="button" style={styles.closeBtn} onClick={() => setAddMode(null)}>
                  <X size={20} />
                </button>
              </div>

              <form className="service-form" onSubmit={handleSaveCustomService}>
                <label>
                  Название *
                  <input value={customTitle} onChange={(e) => setCustomTitle(e.target.value)}
                    placeholder="Например: Авторская укладка" required />
                </label>

                <label>
                  Описание
                  <textarea value={customDescription} onChange={(e) => setCustomDescription(e.target.value)}
                    placeholder="Что входит в услугу, особенности..." />
                </label>

                <div className="service-form-grid">
                  <label>
                    Цена, MDL *
                    <input type="number" min="0" step="0.01" value={customPrice}
                      onChange={(e) => setCustomPrice(e.target.value)} required />
                  </label>
                  <label>
                    Длительность, мин *
                    <input type="number" min="5" max="1440" value={customDuration}
                      onChange={(e) => setCustomDuration(e.target.value)} required />
                  </label>
                  <label>
                    Буфер до, мин
                    <input type="number" min="0" max="240" value={customBufferBefore}
                      onChange={(e) => setCustomBufferBefore(e.target.value)} />
                  </label>
                  <label>
                    Буфер после, мин
                    <input type="number" min="0" max="240" value={customBufferAfter}
                      onChange={(e) => setCustomBufferAfter(e.target.value)} />
                  </label>
                </div>

                <label>
                  Теги (через запятую)
                  <input value={customTags} onChange={(e) => setCustomTags(e.target.value)}
                    placeholder="Например: волосы, укладка, свадьба" />
                </label>

                {customDeposit && (
                  <label>
                    Сумма депозита, MDL
                    <input type="number" min="0" step="0.01" value={customDepositAmount}
                      onChange={(e) => setCustomDepositAmount(e.target.value)} />
                  </label>
                )}

                <div style={styles.togglesGrid}>
                  <Toggle checked={customOnlineBooking} onChange={setCustomOnlineBooking} label="Онлайн-запись" />
                  <Toggle checked={customPublic} onChange={setCustomPublic} label="Публичная" />
                  <Toggle checked={customDeposit} onChange={setCustomDeposit} label="Требует депозит" />
                  <Toggle checked={customConsultation} onChange={setCustomConsultation} label="Консультация" />
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                  <button type="submit" className="primary-action" style={{ flex: 1 }} disabled={isSubmitting}>
                    {isSubmitting ? 'Создаём...' : 'Создать свою услугу'}
                  </button>
                  <button type="button" className="danger-action" onClick={() => setAddMode(null)}>
                    Отмена
                  </button>
                </div>
              </form>
            </article>
          )}

          {/* Поиск */}
          <div style={styles.searchBar}>
            <Search size={17} style={{ color: '#efb6d8', flexShrink: 0 }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по названию..."
              style={styles.searchInput}
            />
            {search && (
              <button type="button" style={styles.clearBtn} onClick={() => setSearch('')}>
                <X size={15} />
              </button>
            )}
          </div>

          {/* Список услуг мастера */}
          <section className="dashboard-panel services-panel">
            <div className="panel-heading">
              <div>
                <p className="panel-kicker">МОЙ ПРАЙС-ЛИСТ</p>
                <h2>{filteredMasterServices.length} услуг</h2>
              </div>
              <Scissors size={22} />
            </div>

            {filteredMasterServices.length === 0 ? (
              <div style={styles.emptyState}>
                <Scissors size={40} style={{ color: '#d682b8', opacity: 0.5 }} />
                <p>У вас пока нет услуг.</p>
                <p style={{ fontSize: 13, color: '#888' }}>
                  Нажмите «Выбрать из каталога» или «Создать свою услугу» выше.
                </p>
              </div>
            ) : (
              <div className="ranking-list">
                {filteredMasterServices.map((ms) => {
                  const svc = serviceById.get(ms.serviceId);
                  const title = ms.customTitle ?? svc?.name ?? 'Услуга';
                  const desc = ms.customDescription ?? svc?.description;
                  const isExpanded = expandedServiceId === ms.id;
                  const isCustom = ms.customTitle != null;

                  return (
                    <div key={ms.id} style={styles.serviceCard(ms.isActive)}>
                      {/* Верхняя строка */}
                      <div style={styles.serviceCardRow}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                          <span style={styles.statusDot(ms.isActive)} />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                              <strong style={{ color: '#fff7fc', fontSize: 15 }}>{title}</strong>
                              {isCustom && (
                                <span style={styles.badge('custom')}>
                                  <Zap size={11} /> авторская
                                </span>
                              )}
                              {ms.onlineBookingEnabled && (
                                <span style={styles.badge('online')}>онлайн</span>
                              )}
                              {!ms.isActive && (
                                <span style={styles.badge('inactive')}>отключена</span>
                              )}
                            </div>
                            {desc && (
                              <p style={{ color: '#9d949f', fontSize: 12, margin: '3px 0 0', lineHeight: 1.4 }}>
                                {desc}
                              </p>
                            )}
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
                          <div style={{ textAlign: 'right' }}>
                            <strong style={{ color: '#d682b8', fontSize: 16 }}>
                              {Number(ms.price).toFixed(0)} MDL
                            </strong>
                            <div style={{ color: '#9d949f', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                              <Clock size={11} /> {ms.durationMinutes} мин
                            </div>
                          </div>

                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              type="button"
                              style={styles.iconBtn}
                              title={isExpanded ? 'Свернуть' : 'Подробнее'}
                              onClick={() => setExpandedServiceId(isExpanded ? null : ms.id)}
                            >
                              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>
                            <button
                              type="button"
                              style={styles.iconBtn}
                              title={ms.isActive ? 'Отключить' : 'Включить'}
                              onClick={() => handleToggleMasterService(ms.id, ms.isActive)}
                            >
                              {ms.isActive ? <X size={16} /> : <Check size={16} />}
                            </button>
                            <button
                              type="button"
                              style={{ ...styles.iconBtn, color: '#ff6080' }}
                              title="Удалить"
                              onClick={() => handleRemoveMasterService(ms.id)}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Детали (раскрываются) */}
                      {isExpanded && (
                        <div style={styles.expandedDetails}>
                          <div style={styles.detailGrid}>
                            <div style={styles.detailItem}>
                              <span>Буфер до</span>
                              <strong>{ms.bufferBeforeMinutes ?? 0} мин</strong>
                            </div>
                            <div style={styles.detailItem}>
                              <span>Буфер после</span>
                              <strong>{ms.bufferAfterMinutes ?? 0} мин</strong>
                            </div>
                            <div style={styles.detailItem}>
                              <span>Публичная</span>
                              <strong>{ms.isPublic ? 'Да' : 'Нет'}</strong>
                            </div>
                            <div style={styles.detailItem}>
                              <span>Депозит</span>
                              <strong>
                                {ms.requiresDeposit
                                  ? `${ms.depositAmount ?? '?'} MDL`
                                  : 'Нет'}
                              </strong>
                            </div>
                            <div style={styles.detailItem}>
                              <span>Консультация</span>
                              <strong>{ms.requiresConsultation ? 'Да' : 'Нет'}</strong>
                            </div>
                            {ms.tags && ms.tags.length > 0 && (
                              <div style={{ ...styles.detailItem, gridColumn: '1 / -1' }}>
                                <span>Теги</span>
                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                  {ms.tags.map((tag) => (
                                    <span key={tag} style={styles.tag}>{tag}</span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                          <button
                            type="button"
                            style={styles.editBtn}
                            onClick={() => {
                              // Открываем форму редактирования из каталога
                              handleCatalogSelect(ms.serviceId);
                              setAddMode('catalog');
                              setExpandedServiceId(null);
                            }}
                          >
                            <Edit2 size={14} /> Редактировать
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </main>
      </AppLayout>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ВЛАДЕЛЕЦ / АДМИНИСТРАТОР — каталог услуг салона
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <AppLayout>
      <main className="dashboard-page">
        <header className="dashboard-header">
          <div>
            <p className="dashboard-eyebrow">УСЛУГИ</p>
            <h1>Каталог услуг</h1>
            <p className="dashboard-subtitle">
              Основные услуги салона. Мастера могут подключать их к своему прайсу
              с индивидуальными ценами и условиями.
            </p>
          </div>
          <div className="dashboard-period">
            <span>Активных услуг</span>
            <strong>{services.filter((s) => s.isActive).length}</strong>
          </div>
        </header>

        {successMessage && (
          <div style={styles.alert('success')}><Check size={16} />{successMessage}</div>
        )}
        {errorMessage && (
          <div style={styles.alert('error')}><X size={16} />{errorMessage}</div>
        )}

        <section className="dashboard-columns">
          {/* Форма создания */}
          <article className="dashboard-panel">
            <div className="panel-heading">
              <div>
                <p className="panel-kicker">ДОБАВИТЬ</p>
                <h2>Новая услуга</h2>
              </div>
              <Plus size={22} />
            </div>

            <form className="service-form" onSubmit={handleCreateSalonService}>
              <label>
                Название *
                <input value={name} onChange={(e) => setName(e.target.value)}
                  placeholder="Например: Укладка волос" required />
              </label>
              <label>
                Описание
                <textarea value={description} onChange={(e) => setDescription(e.target.value)}
                  placeholder="Краткое описание услуги" />
              </label>
              <div className="service-form-grid">
                <label>
                  Длительность, мин
                  <input type="number" min="5" value={durationMinutes}
                    onChange={(e) => setDurationMinutes(e.target.value)} required />
                </label>
                <label>
                  Базовая цена, MDL
                  <input type="number" min="0" step="0.01" value={basePrice}
                    onChange={(e) => setBasePrice(e.target.value)} required />
                </label>
              </div>
              <button type="submit" className="primary-action" disabled={isSubmitting}>
                {isSubmitting ? 'Добавляем...' : 'Добавить услугу'}
              </button>
            </form>
          </article>

          {/* Поиск */}
          <article className="dashboard-panel">
            <div className="panel-heading">
              <div>
                <p className="panel-kicker">ПОИСК</p>
                <h2>Фильтр</h2>
              </div>
              <Search size={22} />
            </div>

            <div className="service-search">
              <Search size={18} />
              <input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Найти услугу..." />
            </div>

            <p className="empty-state" style={{ marginTop: 16 }}>
              Найдено: {filteredServices.length} услуг
            </p>
          </article>
        </section>

        {/* Каталог */}
        <section className="dashboard-panel services-panel">
          <div className="panel-heading">
            <div>
              <p className="panel-kicker">КАТАЛОГ</p>
              <h2>{filteredServices.length} услуг</h2>
            </div>
            <Scissors size={22} />
          </div>

          {filteredServices.length === 0 ? (
            <div style={styles.emptyState}>
              <Scissors size={40} style={{ color: '#d682b8', opacity: 0.5 }} />
              <p>Услуги ещё не добавлены.</p>
            </div>
          ) : (
            <div className="ranking-list">
              {filteredServices.map((service, i) => (
                <div className="ranking-row" key={service.id}>
                  <span className="ranking-number">{i + 1}</span>

                  <div className="ranking-main">
                    <strong>{service.name}</strong>
                    <span>{service.description ?? 'Описание не указано'}</span>
                    <span style={{ color: service.isActive ? '#8ee5b5' : '#ff8a8a', fontSize: 12 }}>
                      {service.isActive ? '● Активна' : '● Отключена'}
                    </span>
                  </div>

                  <div className="ranking-value">
                    <strong>{Number(service.basePrice).toFixed(0)} MDL</strong>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Clock size={12} /> {service.durationMinutes} мин
                    </span>
                    {service.isActive && (
                      <button
                        type="button"
                        className="danger-action"
                        onClick={() => handleDeactivateSalonService(service.id)}
                      >
                        <Trash2 size={14} /> Отключить
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </AppLayout>
  );
}

// ─── Инлайн-стили ─────────────────────────────────────────────────────────────
const styles = {
  alert: (type: 'success' | 'error') => ({
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '12px 16px',
    borderRadius: 14,
    marginBottom: 16,
    fontSize: 13,
    fontWeight: 700,
    border: `1px solid ${type === 'success' ? 'rgba(77,208,139,0.25)' : 'rgba(255,96,128,0.25)'}`,
    background: type === 'success' ? 'rgba(77,208,139,0.1)' : 'rgba(255,96,128,0.1)',
    color: type === 'success' ? '#9ae9bd' : '#ffb6c6',
  } as React.CSSProperties),

  addButtons: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 16,
    marginBottom: 24,
  } as React.CSSProperties,

  addBtn: (type: 'catalog' | 'custom') => ({
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    padding: '18px 20px',
    border: `1px solid ${type === 'catalog' ? 'rgba(214,130,184,0.3)' : 'rgba(114,167,255,0.3)'}`,
    borderRadius: 18,
    background: type === 'catalog' ? 'rgba(214,130,184,0.08)' : 'rgba(114,167,255,0.08)',
    color: '#fff7fc',
    cursor: 'pointer',
    textAlign: 'left' as const,
    transition: 'all 0.2s',
  } as React.CSSProperties),

  closeBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 36,
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 10,
    background: 'rgba(255,255,255,0.05)',
    color: '#b9b0bb',
    cursor: 'pointer',
  } as React.CSSProperties,

  select: {
    width: '100%',
    padding: '11px 13px',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 13,
    background: 'rgba(255,255,255,0.06)',
    color: '#fff7fc',
    fontSize: 14,
  } as React.CSSProperties,

  togglesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 12,
    padding: '16px',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 14,
    background: 'rgba(255,255,255,0.03)',
  } as React.CSSProperties,

  searchBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 14px',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 14,
    background: 'rgba(255,255,255,0.05)',
    marginBottom: 16,
  } as React.CSSProperties,

  searchInput: {
    flex: 1,
    border: 0,
    outline: 0,
    background: 'transparent',
    color: '#fff7fc',
    fontSize: 14,
  } as React.CSSProperties,

  clearBtn: {
    display: 'flex',
    border: 0,
    background: 'transparent',
    color: '#9d949f',
    cursor: 'pointer',
  } as React.CSSProperties,

  emptyState: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: 10,
    padding: '40px 20px',
    color: '#9d949f',
    textAlign: 'center' as const,
  },

  serviceCard: (isActive: boolean) => ({
    border: `1px solid ${isActive ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.05)'}`,
    borderRadius: 16,
    padding: '16px 18px',
    marginBottom: 10,
    background: isActive ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.015)',
    opacity: isActive ? 1 : 0.7,
  } as React.CSSProperties),

  serviceCardRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    justifyContent: 'space-between',
  } as React.CSSProperties,

  statusDot: (isActive: boolean) => ({
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: isActive ? '#8ee5b5' : '#ff8a8a',
    flexShrink: 0,
    marginTop: 6,
  } as React.CSSProperties),

  badge: (type: 'custom' | 'online' | 'inactive') => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '2px 8px',
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 700,
    background: type === 'custom'
      ? 'rgba(114,167,255,0.15)'
      : type === 'online'
        ? 'rgba(77,208,139,0.12)'
        : 'rgba(255,96,128,0.12)',
    color: type === 'custom'
      ? '#a8c9ff'
      : type === 'online'
        ? '#8ee5b5'
        : '#ffb6c6',
  } as React.CSSProperties),

  iconBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 9,
    background: 'rgba(255,255,255,0.05)',
    color: '#b9b0bb',
    cursor: 'pointer',
  } as React.CSSProperties,

  expandedDetails: {
    marginTop: 14,
    paddingTop: 14,
    borderTop: '1px solid rgba(255,255,255,0.07)',
  } as React.CSSProperties,

  detailGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
    gap: 10,
    marginBottom: 12,
  } as React.CSSProperties,

  detailItem: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 3,
    padding: '10px 12px',
    borderRadius: 10,
    background: 'rgba(255,255,255,0.04)',
    fontSize: 12,
    color: '#9d949f',
  },

  tag: {
    padding: '3px 8px',
    borderRadius: 999,
    background: 'rgba(214,130,184,0.12)',
    color: '#efb6d8',
    fontSize: 11,
  } as React.CSSProperties,

  editBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '7px 14px',
    border: '1px solid rgba(214,130,184,0.25)',
    borderRadius: 10,
    background: 'rgba(214,130,184,0.1)',
    color: '#efb6d8',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
  } as React.CSSProperties,
};

export default ServicesPage;
