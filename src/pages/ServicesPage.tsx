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
};

/**
 * Название услуги на языке пользователя.
 *
 * Если перевода нет, показываем основное: пустая строка
 * в списке хуже, чем название на чужом языке.
 */
function serviceName(
  service:
    | {
        name: string;
        nameRo?: string | null;
        nameRu?: string | null;
        nameEn?: string | null;
      }
    | undefined,
  language: string,
): string {
  if (!service) {
    return '';
  }

  if (language.startsWith('ro')) {
    return service.nameRo?.trim() || service.name;
  }

  if (language.startsWith('en')) {
    return service.nameEn?.trim() || service.name;
  }

  if (language.startsWith('ru')) {
    return service.nameRu?.trim() || service.name;
  }

  return service.name;
}

type Service = {
  id: string;
  name: string;

  /** Названия по языкам: салон заполняет их при добавлении. */
  nameRo?: string | null;
  nameRu?: string | null;
  nameEn?: string | null;
  description: string | null;
  durationMinutes: number;
  basePrice: number;
  isActive: boolean;
  /**
   * Заполнен у позиций из справочника платформы —
   * такой услуги в салоне ещё нет, она создастся при добавлении.
   */
  catalogId?: string | null;
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
    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', color: 'var(--app-text)', fontSize: 13 }}>
      <span
        onClick={() => onChange(!checked)}
        style={{
          display: 'inline-flex',
          width: 40,
          height: 22,
          borderRadius: 11,
          background: checked ? 'var(--app-accent)' : 'rgba(255,255,255,0.12)',
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

type CatalogItem = {
  id: string;
  category: string;
  nameRo: string;
  nameRu: string;
  nameEn: string;
  defaultDurationMinutes: number;
};

const CATEGORY_ORDER = [
  'hair',
  'nails',
  'brows',
  'permanent',
  'face',
  'depilation',
];

function ServicesPage() {
  const workspaceMode = getWorkspaceMode();
  const { t, i18n } = useTranslation();
  const isMasterWorkspace = workspaceMode === 'master';

  const [salon, setSalon] = useState<SalonSummary | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [masterServices, setMasterServices] = useState<MasterService[]>([]);
  const [message, setMessage] = useState(isMasterWorkspace ? t('services.loadingMy') : t('services.loading'));
  const [search, setSearch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const [addMode, setAddMode] = useState<AddMode>(null);
  const [expandedServiceId, setExpandedServiceId] = useState<string | null>(null);

  const [selectedServiceId, setSelectedServiceId] = useState('');

  /**
   * Отмеченные услуги. Галочка меняет состояние, «Сохранить»
   * применяет всё разом: отмеченные добавляются, снятые удаляются.
   */
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());

  /**
   * Услуга, открытая на редактирование прямо в карточке.
   * Форма разворачивается под кнопкой, без прыжков по странице.
   */
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState('');
  const [editDuration, setEditDuration] = useState('');
  const [editBufferBefore, setEditBufferBefore] = useState('0');
  const [editBufferAfter, setEditBufferAfter] = useState('0');
  const [editOnline, setEditOnline] = useState(true);
  const [editPublic, setEditPublic] = useState(true);

  function startEdit(ms: MasterService) {
    setEditingId(ms.id);
    setEditPrice(String(ms.price ?? ''));
    setEditDuration(String(ms.durationMinutes ?? ''));
    setEditBufferBefore(String(ms.bufferBeforeMinutes ?? 0));
    setEditBufferAfter(String(ms.bufferAfterMinutes ?? 0));
    setEditOnline(ms.onlineBookingEnabled);
    setEditPublic(ms.isPublic);
  }

  async function saveEdit(ms: MasterService) {
    if (!salon) {
      return;
    }

    setIsSubmitting(true);

    try {
      await api.patch(
        `/masters/me/services/${ms.id}`,
        {
          price: Number(editPrice) || 0,
          durationMinutes: Number(editDuration) || ms.durationMinutes,
          bufferBeforeMinutes: Number(editBufferBefore) || 0,
          bufferAfterMinutes: Number(editBufferAfter) || 0,
          onlineBookingEnabled: editOnline,
          isPublic: editPublic,
        },
        { params: { salonId: salon.id } },
      );

      await reloadData(salon.id);
      setEditingId(null);
      showSuccess(t('services.addedToList'));
    } catch (error) {
      showError(t(getErrorKey(error)));
    } finally {
      setIsSubmitting(false);
    }
  }
  const [masterPrice, setMasterPrice] = useState('');
  const [masterDuration, setMasterDuration] = useState('');
  const [bufferBefore, setBufferBefore] = useState('0');
  const [bufferAfter, setBufferAfter] = useState('0');
  const [catalogOnlineBooking, setCatalogOnlineBooking] = useState(true);
  const [catalogPublic, setCatalogPublic] = useState(true);
  const [catalogDeposit, setCatalogDeposit] = useState(false);
  const [catalogDepositAmount, setCatalogDepositAmount] = useState('');
  const [catalogConsultation, setCatalogConsultation] = useState(false);

  /** Названия услуги салона по языкам. */
  const [nameRo, setNameRo] = useState('');
  const [nameRu, setNameRu] = useState('');
  const [nameEn, setNameEn] = useState('');

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

  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [selectedCatalogId, setSelectedCatalogId] = useState('');

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('60');
  const [basePrice, setBasePrice] = useState('300');

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

      // Отмечаем то, что уже подключено, чтобы галочки отражали прайс.
      setCheckedIds(new Set(my.data.map((item) => item.serviceId)));
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
        if (!s) { setMessage(t('services.salonNotFound')); return; }
        await reloadData(s.id);
        setMessage('');
      } catch {
        if (!cancelled) setMessage(isMasterWorkspace ? t('services.loadMyError') : t('services.loadError'));
      }
    }
    void init();
    return () => { cancelled = true; };
  }, [isMasterWorkspace]);

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
      const title = ms.customTitle ?? serviceName(svc, i18n.language);
      return title.toLowerCase().includes(q);
    });
  }, [masterServices, search, serviceById]);

  function showSuccess(msg: string) {
    setSuccessMessage(msg);
    setErrorMessage('');
    setTimeout(() => setSuccessMessage(''), 3500);
  }

  function showError(msg: string) {
    setErrorMessage(msg);
    setSuccessMessage('');
  }

  function toggleService(serviceId: string) {
    setCheckedIds((prev) => {
      const next = new Set(prev);

      if (next.has(serviceId)) {
        next.delete(serviceId);
      } else {
        next.add(serviceId);
      }

      return next;
    });
  }

  /**
   * Применяет отметки: добавляет новые услуги, удаляет снятые.
   * Цена берётся из справочника, править её можно потом в своём прайсе.
   */
  async function handleApplyChecked() {
    if (!salon) {
      showError(t('services.salonNotFound'));
      return;
    }

    setIsSubmitting(true);

    try {
      const toAdd = services.filter(
        (s) => checkedIds.has(s.id) && !masterServiceByServiceId.has(s.id),
      );

      const toRemove = masterServices.filter(
        (ms) => !checkedIds.has(ms.serviceId),
      );

      for (const item of toAdd) {
        const isFromCatalog = Boolean(item.catalogId);

        await api.post(
          isFromCatalog ? '/masters/me/services/custom' : '/masters/me/services',
          {
            ...(isFromCatalog
              ? { catalogId: item.catalogId, customTitle: item.name }
              : { serviceId: item.id }),
            price: Number(item.basePrice) || 0,
            durationMinutes: item.durationMinutes,
          },
          { params: { salonId: salon.id } },
        );
      }

      for (const item of toRemove) {
        await api.delete(`/masters/me/services/${item.id}`, {
          params: { salonId: salon.id },
        });
      }

      await reloadData(salon.id);
      showSuccess(t('services.addedToList'));
    } catch (error) {
      showError(t(getErrorKey(error)));
    } finally {
      setIsSubmitting(false);
    }
  }

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

  async function handleSaveCatalogService(e: React.FormEvent) {
    e.preventDefault();
    if (!salon || !selectedServiceId) { showError(t('services.selectService')); return; }
    setIsSubmitting(true);
    try {
      // Услуги из справочника платформы приходят с заполненным catalogId
      // и ещё не существуют в салоне. Их отправляем на другой эндпоинт —
      // он создаёт услугу салона под капотом и подключает мастеру.
      const chosen = services.find((s) => s.id === selectedServiceId);
      const isFromCatalog = Boolean(chosen?.catalogId);

      await api.post(
        isFromCatalog ? '/masters/me/services/custom' : '/masters/me/services',
        {
        ...(isFromCatalog
          ? { catalogId: chosen?.catalogId, customTitle: chosen?.name }
          : { serviceId: selectedServiceId }),
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
      showSuccess(t('services.addedToList'));
    } catch {
      showError(t('services.saveError'));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSaveCustomService(e: React.FormEvent) {
    e.preventDefault();
    if (!salon) { showError(t('services.salonNotFound')); return; }
    if (!customTitle.trim()) { showError(t('services.enterTitle')); return; }
    setIsSubmitting(true);
    try {
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
          ? customTags.split(',').map((tg) => tg.trim()).filter(Boolean)
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
      showSuccess(t('services.customCreated'));
    } catch {
      showError(t('services.customCreateError'));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleToggleMasterService(id: string, isActive: boolean) {
    if (!salon) return;
    try {
      await api.patch(
        `/masters/me/services/${id}/${isActive ? 'deactivate' : 'activate'}`,
        undefined,
        { params: { salonId: salon.id } },
      );
      await reloadData(salon.id);
      showSuccess(isActive ? t('services.deactivated') : t('services.activated'));
    } catch {
      showError(t('services.statusError'));
    }
  }

  async function handleRemoveMasterService(id: string) {
    if (!salon) return;
    if (!confirm(t('services.confirmRemove'))) return;
    try {
      await api.delete(`/masters/me/services/${id}`, { params: { salonId: salon.id } });
      await reloadData(salon.id);
      showSuccess(t('services.removed'));
    } catch {
      showError(t('services.removeError'));
    }
  }

  /**
   * Справочник платформы: салон выбирает готовую услугу
   * с переводами на трёх языках вместо ручного ввода.
   */
  function applyCatalogItem(catalogId: string) {
    setSelectedCatalogId(catalogId);

    const item = catalog.find((c) => c.id === catalogId);

    if (!item) {
      return;
    }

    const lang = localStorage.getItem('glamour_language') ?? 'ro';

    setName(
      lang === 'ru' ? item.nameRu : lang === 'en' ? item.nameEn : item.nameRo,
    );
    setDurationMinutes(String(item.defaultDurationMinutes));
  }

  useEffect(() => {
    async function loadCatalog() {
      try {
        const res = await api.get<CatalogItem[]>('/services/catalog');
        setCatalog(res.data);
      } catch {
        setCatalog([]);
      }
    }

    void loadCatalog();
  }, []);

  async function handleCreateSalonService(e: React.FormEvent) {
    e.preventDefault();
    if (!salon) { showError(t('services.salonNotFound')); return; }
    setIsSubmitting(true);
    try {
      await api.post('/services', {
        name,
        // Незаполненный перевод заменяем основным названием:
        // пустая строка в списке хуже, чем чужой язык.
        nameRo: nameRo.trim() || name,
        nameRu: nameRu.trim() || name,
        nameEn: nameEn.trim() || name,
        description: description.trim() || null,
        durationMinutes: Number(durationMinutes),
        basePrice: Number(basePrice),
        isActive: true,
      }, { params: { salonId: salon.id } });
      setName('');
      setNameRo('');
      setNameRu('');
      setNameEn('');
      setDescription('');
      setDurationMinutes('60');
      setBasePrice('300');
      await reloadData(salon.id);
      showSuccess(t('services.addedToCatalog'));
    } catch {
      showError(t('services.createError'));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeactivateSalonService(id: string) {
    if (!salon) return;
    try {
      await api.patch(`/services/${id}/deactivate`, undefined, { params: { salonId: salon.id } });
      await reloadData(salon.id);
      showSuccess(t('services.deactivated'));
    } catch {
      showError(t('services.deactivateError'));
    }
  }

  if (message && !salon) {
    return (
      <AppLayout>
        <main className="dashboard-page">
          <p className="dashboard-status">{message}</p>
        </main>
      </AppLayout>
    );
  }

  if (isMasterWorkspace) {
    const activeCount = masterServices.filter((ms) => ms.isActive).length;

    return (
      <AppLayout>
        <main className="dashboard-page">
          <header className="dashboard-header">
            <div>
              <h1>{t('services.myTitle')}</h1>
              <p className="dashboard-subtitle">{t('services.mySubtitle')}</p>
            </div>
            <div className="dashboard-period">
              <span>{t('services.activeCount')}</span>
              <strong>{activeCount}</strong>
            </div>
          </header>

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

          {addMode === null && (
            <div style={styles.addButtons}>
              <button
                type="button"
                style={styles.addBtn('catalog')}
                onClick={() => setAddMode('catalog')}
              >
                <Scissors size={18} />
                <div>
                  <strong>{t('services.fromCatalog')}</strong>
                  <span>{t('services.fromCatalogDesc')}</span>
                </div>
              </button>

              <button
                type="button"
                style={styles.addBtn('custom')}
                onClick={() => setAddMode('custom')}
              >
                <Sparkles size={18} />
                <div>
                  <strong>{t('services.createOwn')}</strong>
                  <span>{t('services.createOwnDesc')}</span>
                </div>
              </button>
            </div>
          )}

          {addMode === 'catalog' && (
            <article className="dashboard-panel" style={{ marginBottom: 24 }}>
              <div className="panel-heading">
                <div>
                  <p className="panel-kicker">{t('services.fromSalonCatalog').toUpperCase()}</p>
                  <h2>{t('services.addService')}</h2>
                </div>
                <button type="button" style={styles.closeBtn} onClick={() => setAddMode(null)}>
                  <X size={20} />
                </button>
              </div>

              <form
                id="service-edit-form"
                className="service-form"
                onSubmit={handleSaveCatalogService}
              >
                {/* Единый список: отмеченные подсвечены, мастер видит
                    картину целиком, а не только доступное к добавлению. */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    maxHeight: 320,
                    overflowY: 'auto',
                    padding: 4,
                    border: '1px solid rgba(255,255,255,0.09)',
                    borderRadius: 14,
                  }}
                >
                  {services.map((s) => {
                    const isAdded = checkedIds.has(s.id);
                    const isSelected = selectedServiceId === s.id;

                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          toggleService(s.id);
                          handleCatalogSelect(s.id);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          padding: '10px 12px',
                          border: isSelected
                            ? '1px solid rgba(var(--app-accent-rgb), 0.5)'
                            : '1px solid transparent',
                          borderRadius: 11,
                          background: isAdded
                            ? 'rgba(77,208,139,0.09)'
                            : isSelected
                              ? 'rgba(var(--app-accent-rgb), 0.1)'
                              : 'transparent',
                          color: 'var(--app-text)',
                          cursor: 'pointer',
                          textAlign: 'left',
                          minHeight: 44,
                        }}
                      >
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 20,
                            height: 20,
                            flexShrink: 0,
                            borderRadius: 6,
                            border: isAdded
                              ? '1px solid #4dd08b'
                              : '1px solid rgba(255,255,255,0.25)',
                            background: isAdded ? '#4dd08b' : 'transparent',
                            color: '#17151c',
                            fontSize: 13,
                            fontWeight: 800,
                          }}
                        >
                          {isAdded ? '✓' : ''}
                        </span>

                        <span style={{ flex: 1, minWidth: 0, fontSize: 13 }}>
                          {serviceName(s, i18n.language)}
                        </span>

                        <span style={{ color: 'var(--app-text-muted)', fontSize: 12, flexShrink: 0 }}>
                          {s.durationMinutes} {t('services.min')}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div style={{ marginTop: 12 }}>
                  <button
                    type="button"
                    className="primary-action"
                    style={{ width: '100%' }}
                    disabled={isSubmitting}
                    onClick={() => void handleApplyChecked()}
                  >
                    {isSubmitting ? t('common.saving') : t('common.save')}
                  </button>
                </div>

                <div className="service-form-grid">
                  <label>
                    {t('services.myPrice')}
                    <input type="number" min="0" step="0.01" value={masterPrice}
                      onChange={(e) => setMasterPrice(e.target.value)} required />
                  </label>
                  <label>
                    {t('services.durationLabel')}
                    <input type="number" min="5" max="1440" value={masterDuration}
                      onChange={(e) => setMasterDuration(e.target.value)} required />
                  </label>
                  <label>
                    {t('services.bufferBefore')}
                    <input type="number" min="0" max="240" value={bufferBefore}
                      onChange={(e) => setBufferBefore(e.target.value)} />
                  </label>
                  <label>
                    {t('services.bufferAfter')}
                    <input type="number" min="0" max="240" value={bufferAfter}
                      onChange={(e) => setBufferAfter(e.target.value)} />
                  </label>
                </div>

                {catalogDeposit && (
                  <label>
                    {t('services.depositAmount')}
                    <input type="number" min="0" step="0.01" value={catalogDepositAmount}
                      onChange={(e) => setCatalogDepositAmount(e.target.value)} />
                  </label>
                )}

                <div style={styles.togglesGrid}>
                  <Toggle checked={catalogOnlineBooking} onChange={setCatalogOnlineBooking} label={t('services.onlineBooking')} />
                  <Toggle checked={catalogPublic} onChange={setCatalogPublic} label={t('services.publicService')} />
                  <Toggle checked={catalogDeposit} onChange={setCatalogDeposit} label={t('services.requiresDeposit')} />
                  <Toggle checked={catalogConsultation} onChange={setCatalogConsultation} label={t('services.consultation')} />
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                  <button type="submit" className="primary-action" style={{ flex: 1 }} disabled={isSubmitting}>
                    {isSubmitting ? t('common.saving') : t('common.save')}
                  </button>
                  <button type="button" className="danger-action" onClick={() => setAddMode(null)}>
                    {t('common.cancel')}
                  </button>
                </div>
              </form>
            </article>
          )}

          {addMode === 'custom' && (
            <article className="dashboard-panel" style={{ marginBottom: 24 }}>
              <div className="panel-heading">
                <div>
                  <p className="panel-kicker">{t('services.myCustomService').toUpperCase()}</p>
                  <h2>{t('services.createService')}</h2>
                </div>
                <button type="button" style={styles.closeBtn} onClick={() => setAddMode(null)}>
                  <X size={20} />
                </button>
              </div>

              <form className="service-form" onSubmit={handleSaveCustomService}>
                <label>
                  {t('services.nameRequired')}
                  <input value={customTitle} onChange={(e) => setCustomTitle(e.target.value)}
                    placeholder={t('services.customTitlePlaceholder')} required />
                </label>

                <label>
                  {t('services.description')}
                  <textarea value={customDescription} onChange={(e) => setCustomDescription(e.target.value)}
                    placeholder={t('services.customDescPlaceholder')} />
                </label>

                <div className="service-form-grid">
                  <label>
                    {t('services.priceRequired')}
                    <input type="number" min="0" step="0.01" value={customPrice}
                      onChange={(e) => setCustomPrice(e.target.value)} required />
                  </label>
                  <label>
                    {t('services.durationRequired')}
                    <input type="number" min="5" max="1440" value={customDuration}
                      onChange={(e) => setCustomDuration(e.target.value)} required />
                  </label>
                  <label>
                    {t('services.bufferBefore')}
                    <input type="number" min="0" max="240" value={customBufferBefore}
                      onChange={(e) => setCustomBufferBefore(e.target.value)} />
                  </label>
                  <label>
                    {t('services.bufferAfter')}
                    <input type="number" min="0" max="240" value={customBufferAfter}
                      onChange={(e) => setCustomBufferAfter(e.target.value)} />
                  </label>
                </div>

                <label>
                  {t('services.tags')}
                  <input value={customTags} onChange={(e) => setCustomTags(e.target.value)}
                    placeholder={t('services.tagsPlaceholder')} />
                </label>

                {customDeposit && (
                  <label>
                    {t('services.depositAmount')}
                    <input type="number" min="0" step="0.01" value={customDepositAmount}
                      onChange={(e) => setCustomDepositAmount(e.target.value)} />
                  </label>
                )}

                <div style={styles.togglesGrid}>
                  <Toggle checked={customOnlineBooking} onChange={setCustomOnlineBooking} label={t('services.onlineBooking')} />
                  <Toggle checked={customPublic} onChange={setCustomPublic} label={t('services.publicService')} />
                  <Toggle checked={customDeposit} onChange={setCustomDeposit} label={t('services.requiresDeposit')} />
                  <Toggle checked={customConsultation} onChange={setCustomConsultation} label={t('services.consultation')} />
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                  <button type="submit" className="primary-action" style={{ flex: 1 }} disabled={isSubmitting}>
                    {isSubmitting ? t('common.creating') : t('services.createOwn')}
                  </button>
                  <button type="button" className="danger-action" onClick={() => setAddMode(null)}>
                    {t('common.cancel')}
                  </button>
                </div>
              </form>
            </article>
          )}

          <div style={styles.searchBar}>
            <Search size={17} style={{ color: 'var(--app-accent-strong)', flexShrink: 0 }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('common.search') + '...'}
              style={styles.searchInput}
            />
            {search && (
              <button type="button" style={styles.clearBtn} onClick={() => setSearch('')}>
                <X size={15} />
              </button>
            )}
          </div>

          <section className="dashboard-panel services-panel">
            <div className="panel-heading">
              <div>
                <p className="panel-kicker">{t('services.myPriceList').toUpperCase()}</p>
                <h2>{t('services.count', { count: filteredMasterServices.length })}</h2>
              </div>
              <Scissors size={22} />
            </div>

            {filteredMasterServices.length === 0 ? (
              <div style={styles.emptyState}>
                <Scissors size={40} style={{ color: 'var(--app-accent)', opacity: 0.5 }} />
                <p>{t('services.noServices')}</p>
                <p style={{ fontSize: 13, color: '#888' }}>{t('services.emptyHint')}</p>
              </div>
            ) : (
              <div className="ranking-list">
                {filteredMasterServices.map((ms) => {
                  const svc = serviceById.get(ms.serviceId);
                  const title =
                    ms.customTitle ||
                    serviceName(svc, i18n.language) ||
                    t('services.service');
                  const desc = ms.customDescription ?? svc?.description;
                  const isExpanded = expandedServiceId === ms.id;
                  const isCustom = ms.customTitle != null;

                  return (
                    <div key={ms.id} style={styles.serviceCard(ms.isActive)}>
                      <div style={styles.serviceCardRow}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                          <span style={styles.statusDot(ms.isActive)} />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                              <strong style={{ color: 'var(--app-text)', fontSize: 15 }}>{title}</strong>
                              {isCustom && (
                                <span style={styles.badge('custom')}>
                                  <Zap size={11} /> {t('services.custom')}
                                </span>
                              )}
                              {ms.onlineBookingEnabled && (
                                <span style={styles.badge('online')}>{t('services.online')}</span>
                              )}
                              {!ms.isActive && (
                                <span style={styles.badge('inactive')}>{t('services.inactive')}</span>
                              )}
                            </div>
                            {desc && (
                              <p style={{ color: 'var(--app-text-muted)', fontSize: 12, margin: '3px 0 0', lineHeight: 1.4 }}>
                                {desc}
                              </p>
                            )}
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
                          <div style={{ textAlign: 'right' }}>
                            <strong style={{ color: 'var(--app-accent)', fontSize: 16 }}>
                              {Number(ms.price).toFixed(0)} MDL
                            </strong>
                            <div style={{ color: 'var(--app-text-muted)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                              <Clock size={11} /> {ms.durationMinutes} {t('services.min')}
                            </div>
                          </div>

                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              type="button"
                              style={styles.iconBtn}
                              title={isExpanded ? t('services.collapse') : t('services.details')}
                              onClick={() => setExpandedServiceId(isExpanded ? null : ms.id)}
                            >
                              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>
                            <button
                              type="button"
                              style={styles.iconBtn}
                              title={ms.isActive ? t('services.deactivate') : t('services.activate')}
                              onClick={() => handleToggleMasterService(ms.id, ms.isActive)}
                            >
                              {ms.isActive ? <X size={16} /> : <Check size={16} />}
                            </button>
                            <button
                              type="button"
                              style={{ ...styles.iconBtn, color: '#ff6080' }}
                              title={t('common.delete')}
                              onClick={() => handleRemoveMasterService(ms.id)}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      </div>

                      {isExpanded && (
                        <div style={styles.expandedDetails}>
                          <div style={styles.detailGrid}>
                            <div style={styles.detailItem}>
                              <span>{t('services.bufferBeforeShort')}</span>
                              <strong>{ms.bufferBeforeMinutes ?? 0} {t('services.min')}</strong>
                            </div>
                            <div style={styles.detailItem}>
                              <span>{t('services.bufferAfterShort')}</span>
                              <strong>{ms.bufferAfterMinutes ?? 0} {t('services.min')}</strong>
                            </div>
                            <div style={styles.detailItem}>
                              <span>{t('services.publicService')}</span>
                              <strong>{ms.isPublic ? t('common.yes') : t('common.no')}</strong>
                            </div>
                            <div style={styles.detailItem}>
                              <span>{t('services.deposit')}</span>
                              <strong>
                                {ms.requiresDeposit
                                  ? `${ms.depositAmount ?? '?'} MDL`
                                  : t('common.no')}
                              </strong>
                            </div>
                            <div style={styles.detailItem}>
                              <span>{t('services.consultation')}</span>
                              <strong>{ms.requiresConsultation ? t('common.yes') : t('common.no')}</strong>
                            </div>
                            {ms.tags && ms.tags.length > 0 && (
                              <div style={{ ...styles.detailItem, gridColumn: '1 / -1' }}>
                                <span>{t('services.tagsShort')}</span>
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
                              startEdit(ms);
                              return;
                              handleCatalogSelect(ms.serviceId);
                              setAddMode('catalog');
                              setExpandedServiceId(null);

                              // Форма редактирования находится выше списка.
                              // Без прокрутки нажатие выглядит как «ничего
                              // не произошло»: форма заполнилась вне экрана.
                              setTimeout(() => {
                                document
                                  .getElementById('service-edit-form')
                                  ?.scrollIntoView({
                                    behavior: 'smooth',
                                    block: 'start',
                                  });
                              }, 80);
                            }}
                          >
                            <Edit2 size={14} /> {t('common.edit')}
                          </button>

                          {/* Форма разворачивается прямо в карточке,
                              под кнопкой — без прыжков по странице. */}
                          {editingId === ms.id && (
                            <div
                              style={{
                                marginTop: 14,
                                padding: 14,
                                borderRadius: 14,
                                border: '1px solid rgba(var(--app-accent-rgb), 0.25)',
                                background: 'rgba(var(--app-accent-rgb), 0.05)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 12,
                              }}
                            >
                              <div
                                style={{
                                  display: 'grid',
                                  gridTemplateColumns:
                                    'repeat(auto-fit, minmax(120px, 1fr))',
                                  gap: 10,
                                }}
                              >
                                <label style={{ display: 'grid', gap: 5, fontSize: 12, color: 'var(--app-text-muted)' }}>
                                  {t('services.priceLabel')}
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={editPrice}
                                    onChange={(e) => setEditPrice(e.target.value)}
                                  />
                                </label>

                                <label style={{ display: 'grid', gap: 5, fontSize: 12, color: 'var(--app-text-muted)' }}>
                                  {t('services.durationLabel')}
                                  <input
                                    type="number"
                                    min="5"
                                    value={editDuration}
                                    onChange={(e) => setEditDuration(e.target.value)}
                                  />
                                </label>

                                <label style={{ display: 'grid', gap: 5, fontSize: 12, color: 'var(--app-text-muted)' }}>
                                  {t('services.bufferBefore')}
                                  <input
                                    type="number"
                                    min="0"
                                    value={editBufferBefore}
                                    onChange={(e) => setEditBufferBefore(e.target.value)}
                                  />
                                </label>

                                <label style={{ display: 'grid', gap: 5, fontSize: 12, color: 'var(--app-text-muted)' }}>
                                  {t('services.bufferAfter')}
                                  <input
                                    type="number"
                                    min="0"
                                    value={editBufferAfter}
                                    onChange={(e) => setEditBufferAfter(e.target.value)}
                                  />
                                </label>
                              </div>

                              <div style={styles.togglesGrid}>
                                <Toggle
                                  checked={editOnline}
                                  onChange={setEditOnline}
                                  label={t('services.onlineBooking')}
                                />
                                <Toggle
                                  checked={editPublic}
                                  onChange={setEditPublic}
                                  label={t('services.publicService')}
                                />
                              </div>

                              <div style={{ display: 'flex', gap: 10 }}>
                                <button
                                  type="button"
                                  className="primary-action"
                                  style={{ flex: 1 }}
                                  disabled={isSubmitting}
                                  onClick={() => void saveEdit(ms)}
                                >
                                  {isSubmitting ? t('common.saving') : t('common.save')}
                                </button>

                                <button
                                  type="button"
                                  style={styles.editBtn}
                                  onClick={() => setEditingId(null)}
                                >
                                  {t('common.cancel')}
                                </button>
                              </div>
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
        </main>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <main className="dashboard-page">
        <header className="dashboard-header">
          <div>
            <h1>{t('services.title')}</h1>
            <p className="dashboard-subtitle">{t('services.subtitle')}</p>
          </div>
          <div className="dashboard-period">
            <span>{t('services.activeServices')}</span>
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
          <article className="dashboard-panel">
            <div className="panel-heading">
              <div>
                <p className="panel-kicker">{t('services.add').toUpperCase()}</p>
                <h2>{t('services.addService')}</h2>
              </div>
              <Plus size={22} />
            </div>

            <form className="service-form" onSubmit={handleCreateSalonService}>
              {catalog.length > 0 && (
                <label>
                  {t('services.fromCatalog')}
                  <select
                    value={selectedCatalogId}
                    onChange={(e) => applyCatalogItem(e.target.value)}
                  >
                    <option value="">{t('services.customService')}</option>
                    {CATEGORY_ORDER.filter((cat) =>
                      catalog.some((c) => c.category === cat),
                    ).map((cat) => (
                      <optgroup key={cat} label={t('services.category.' + cat)}>
                        {catalog
                          .filter((c) => c.category === cat)
                          .map((c) => {
                            const lang =
                              localStorage.getItem('glamour_language') ?? 'ro';

                            return (
                              <option key={c.id} value={c.id}>
                                {lang === 'ru'
                                  ? c.nameRu
                                  : lang === 'en'
                                    ? c.nameEn
                                    : c.nameRo}
                              </option>
                            );
                          })}
                      </optgroup>
                    ))}
                  </select>
                </label>
              )}

              <label>
                {t('services.nameRequired')}
                <input value={name} onChange={(e) => setName(e.target.value)}
                  placeholder={t('services.namePlaceholder')} required />
              </label>

              {/* Клиент видит название на своём языке. Незаполненное
                  поле заменяется основным названием, но тогда румын
                  увидит русское, и наоборот. */}
              <label>
                {t('services.nameRo')}
                <input value={nameRo} onChange={(e) => setNameRo(e.target.value)}
                  placeholder={name || t('services.namePlaceholder')} />
              </label>

              <label>
                {t('services.nameRu')}
                <input value={nameRu} onChange={(e) => setNameRu(e.target.value)}
                  placeholder={name || t('services.namePlaceholder')} />
              </label>

              <label>
                {t('services.nameEn')}
                <input value={nameEn} onChange={(e) => setNameEn(e.target.value)}
                  placeholder={name || t('services.namePlaceholder')} />
              </label>
              <label>
                {t('services.description')}
                <textarea value={description} onChange={(e) => setDescription(e.target.value)}
                  placeholder={t('services.descPlaceholder')} />
              </label>
              <div className="service-form-grid">
                <label>
                  {t('services.durationLabel')}
                  <input type="number" min="5" value={durationMinutes}
                    onChange={(e) => setDurationMinutes(e.target.value)} required />
                </label>
                <label>
                  {t('services.priceLabel')}
                  <input type="number" min="0" step="0.01" value={basePrice}
                    onChange={(e) => setBasePrice(e.target.value)} required />
                </label>
              </div>
              <button type="submit" className="primary-action" disabled={isSubmitting}>
                {isSubmitting ? t('services.adding') : t('services.addService')}
              </button>
            </form>
          </article>

          <article className="dashboard-panel">
            <div className="panel-heading">
              <div>
                <p className="panel-kicker">{t('services.searchKicker').toUpperCase()}</p>
                <h2>{t('appointments.filter')}</h2>
              </div>
              <Search size={22} />
            </div>

            <div className="service-search">
              <Search size={18} />
              <input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder={t('common.search') + '...'} />
            </div>

            <p className="empty-state" style={{ marginTop: 16 }}>
              {t('services.found')}: {t('services.count', { count: filteredServices.length })}
            </p>
          </article>
        </section>

        <section className="dashboard-panel services-panel">
          <div className="panel-heading">
            <div>
              <p className="panel-kicker">{t('services.catalog').toUpperCase()}</p>
              <h2>{t('services.count', { count: filteredServices.length })}</h2>
            </div>
            <Scissors size={22} />
          </div>

          {filteredServices.length === 0 ? (
            <div style={styles.emptyState}>
              <Scissors size={40} style={{ color: 'var(--app-accent)', opacity: 0.5 }} />
              <p>{t('services.noServices')}</p>
            </div>
          ) : (
            <div className="ranking-list">
              {filteredServices.map((service, i) => (
                <div className="ranking-row" key={service.id}>
                  <span className="ranking-number">{i + 1}</span>

                  <div className="ranking-main">
                    <strong>{serviceName(service, i18n.language)}</strong>
                    <span>{service.description ?? t('services.noDescription')}</span>
                    <span style={{ color: service.isActive ? '#8ee5b5' : '#ff8a8a', fontSize: 12 }}>
                      {service.isActive ? '● ' + t('services.statusActive') : '● ' + t('services.statusInactive')}
                    </span>
                  </div>

                  <div className="ranking-value">
                    <strong>{Number(service.basePrice).toFixed(0)} MDL</strong>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Clock size={12} /> {service.durationMinutes} {t('services.min')}
                    </span>
                    {service.isActive && (
                      <button
                        type="button"
                        className="danger-action"
                        onClick={() => handleDeactivateSalonService(service.id)}
                      >
                        <Trash2 size={14} /> {t('services.deactivate')}
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
    color: type === 'success' ? '#9ae9bd' : 'var(--app-accent-strong)',
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
    border: `1px solid ${type === 'catalog' ? 'rgba(var(--app-accent-rgb), 0.3)' : 'rgba(114,167,255,0.3)'}`,
    borderRadius: 18,
    background: type === 'catalog' ? 'rgba(var(--app-accent-rgb), 0.08)' : 'rgba(114,167,255,0.08)',
    color: 'var(--app-text)',
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
    color: 'var(--app-text-muted)',
    cursor: 'pointer',
  } as React.CSSProperties,

  select: {
    width: '100%',
    padding: '11px 13px',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 13,
    background: 'rgba(255,255,255,0.06)',
    color: 'var(--app-text)',
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
    color: 'var(--app-text)',
    fontSize: 14,
  } as React.CSSProperties,

  clearBtn: {
    display: 'flex',
    border: 0,
    background: 'transparent',
    color: 'var(--app-text-muted)',
    cursor: 'pointer',
  } as React.CSSProperties,

  emptyState: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: 10,
    padding: '40px 20px',
    color: 'var(--app-text-muted)',
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
        : 'var(--app-accent-strong)',
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
    color: 'var(--app-text-muted)',
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
    color: 'var(--app-text-muted)',
  },

  tag: {
    padding: '3px 8px',
    borderRadius: 999,
    background: 'rgba(var(--app-accent-rgb), 0.12)',
    color: 'var(--app-accent-strong)',
    fontSize: 11,
  } as React.CSSProperties,

  editBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '7px 14px',
    border: '1px solid rgba(var(--app-accent-rgb), 0.25)',
    borderRadius: 10,
    background: 'rgba(var(--app-accent-rgb), 0.1)',
    color: 'var(--app-accent-strong)',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
  } as React.CSSProperties,
};

export default ServicesPage;
