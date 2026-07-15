import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Building2,
  CheckCircle2,
  CircleDollarSign,
  ClipboardCopy,
  ClipboardList,
  Clock3,
  LayoutDashboard,
  Link2,
  LogOut,
  Mail,
  Phone,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Store,
  Users,
  XCircle,
} from 'lucide-react';

import api from '../api/api';

type SalonStatus =
  | 'trial'
  | 'active'
  | 'past_due'
  | 'suspended'
  | 'cancelled'
  | string;

type PlatformOverview = {
  salons: {
    total: number;
    trial: number;
    active: number;
    pastDue: number;
    suspended: number;
    cancelled: number;
  };
  users: {
    total: number;
    active: number;
    inactive: number;
  };
  memberships: {
    active: number;
  };
  billing: {
    available: boolean;
    reason?: string;
  };
};

type PlatformSalon = {
  id: string;
  name: string;
  slug: string;
  email: string | null;
  phone: string | null;
  timezone: string | null;
  currency: string | null;
  status: SalonStatus;
  legalName: string | null;
  defaultLanguage: string | null;
  trialEndsAt: string | null;
  createdAt: string;
  updatedAt: string;
  owner: {
    id: string | null;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    phone: string | null;
  } | null;
  memberCount: number;
  subscription: null;
  paymentStatus: null;
};

type LoadState = 'loading' | 'ready' | 'error';

type InvitationCreateResponse = {
  id: string;
  status: string;
  invitedEmail: string | null;
  invitedPhone: string | null;
  salonNameHint: string | null;
  expiresAt: string;
  createdAt: string;
  inviteUrl: string;
  security: {
    tokenReturnedOnce: boolean;
    tokenStoredAsHash: boolean;
  };
};

type InvitationFormState = {
  invitedEmail: string;
  invitedPhone: string;
  salonNameHint: string;
  expiresInDays: string;
  internalNote: string;
};

type PlatformApplication = {
  id: string;
  status: string;
  submittedAt: string | null;
  createdAt: string;
  invitedEmail: string | null;
  invitedPhone: string | null;
  salonNameHint: string | null;
  internalNote: string | null;
  owner: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    preferredLanguage: string;
    timezone: string;
    isActive: boolean;
  } | null;
  salon: {
    id: string;
    name: string;
    legalName: string | null;
    email: string | null;
    phone: string | null;
    timezone: string;
    currency: string;
    status: string;
  } | null;
  plan: {
    id: string;
    code: string;
    name: string;
    description: string | null;
    price: string;
    currency: string;
    billingPeriod: string;
    trialDays: number;
  } | null;
  subscription: {
    id: string;
    status: string;
    paymentStatus: string;
  } | null;
};

const INITIAL_INVITATION_FORM: InvitationFormState = {
  invitedEmail: '',
  invitedPhone: '',
  salonNameHint: '',
  expiresInDays: '7',
  internalNote: '',
};

function getStatusLabel(status: SalonStatus) {
  switch (status) {
    case 'trial':
      return 'Пробный период';

    case 'active':
      return 'Активен';

    case 'past_due':
      return 'Есть задолженность';

    case 'suspended':
      return 'Приостановлен';

    case 'cancelled':
      return 'Отменён';

    case 'pending_approval':
      return 'Ожидает одобрения';

    case 'rejected':
      return 'Отклонён';

    default:
      return status || 'Не указан';
  }
}

function getStatusClassName(status: SalonStatus) {
  switch (status) {
    case 'active':
      return 'platform-status platform-status-active';

    case 'trial':
      return 'platform-status platform-status-trial';

    case 'past_due':
      return 'platform-status platform-status-warning';

    case 'pending_approval':
      return 'platform-status platform-status-warning';

    case 'suspended':
    case 'cancelled':
    case 'rejected':
      return 'platform-status platform-status-danger';

    default:
      return 'platform-status';
  }
}

function formatDate(value: string | null) {
  if (!value) {
    return 'Не указана';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Не указана';
  }

  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

function getOwnerName(salon: PlatformSalon) {
  const firstName = salon.owner?.firstName?.trim() || '';
  const lastName = salon.owner?.lastName?.trim() || '';
  const fullName = `${firstName} ${lastName}`.trim();

  return fullName || 'Владелец не назначен';
}

function getApplicationOwnerName(
  application: PlatformApplication,
) {
  const firstName =
    application.owner?.firstName?.trim() || '';
  const lastName =
    application.owner?.lastName?.trim() || '';
  const fullName = `${firstName} ${lastName}`.trim();

  return fullName || 'Имя не указано';
}

function PlatformOwnerPage() {
  const [overview, setOverview] =
    useState<PlatformOverview | null>(null);

  const [salons, setSalons] = useState<PlatformSalon[]>([]);
  const [applications, setApplications] =
    useState<PlatformApplication[]>([]);

  const [loadState, setLoadState] =
    useState<LoadState>('loading');

  const [searchQuery, setSearchQuery] = useState('');

  const [applicationActionId, setApplicationActionId] =
    useState<string | null>(null);

  const [applicationMessage, setApplicationMessage] =
    useState('');

  const [applicationError, setApplicationError] =
    useState('');

  const [rejectReasonById, setRejectReasonById] =
    useState<Record<string, string>>({});

  const [invitationForm, setInvitationForm] =
    useState<InvitationFormState>(
      INITIAL_INVITATION_FORM,
    );

  const [isInvitationSubmitting, setIsInvitationSubmitting] =
    useState(false);

  const [invitationError, setInvitationError] =
    useState('');

  const [createdInvitation, setCreatedInvitation] =
    useState<InvitationCreateResponse | null>(null);

  const [copyStatus, setCopyStatus] = useState<
    'idle' | 'copied' | 'error'
  >('idle');

  const loadPlatformData = useCallback(async () => {
    setLoadState('loading');

    try {
      const [
        overviewResponse,
        salonsResponse,
        applicationsResponse,
      ] = await Promise.all([
        api.get<PlatformOverview>(
          '/platform-admin/overview',
        ),
        api.get<PlatformSalon[]>(
          '/platform-admin/salons',
        ),
        api.get<PlatformApplication[]>(
          '/platform-admin/applications',
        ),
      ]);

      setOverview(overviewResponse.data);
      setSalons(salonsResponse.data);
      setApplications(applicationsResponse.data);
      setLoadState('ready');
    } catch {
      setLoadState('error');
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadPlatformData();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [loadPlatformData]);

  const filteredSalons = useMemo(() => {
    const normalizedQuery = searchQuery
      .trim()
      .toLocaleLowerCase('ru-RU');

    if (!normalizedQuery) {
      return salons;
    }

    return salons.filter((salon) => {
      const searchableValues = [
        salon.name,
        salon.slug,
        salon.email,
        salon.phone,
        salon.legalName,
        salon.owner?.firstName,
        salon.owner?.lastName,
        salon.owner?.email,
        salon.owner?.phone,
      ];

      return searchableValues.some((value) =>
        value
          ?.toLocaleLowerCase('ru-RU')
          .includes(normalizedQuery),
      );
    });
  }, [salons, searchQuery]);

  function updateInvitationField(
    field: keyof InvitationFormState,
    value: string,
  ) {
    setInvitationForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleInvitationSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setInvitationError('');
    setCreatedInvitation(null);
    setCopyStatus('idle');
    setIsInvitationSubmitting(true);

    const invitedEmail =
      invitationForm.invitedEmail.trim().toLowerCase();

    const invitedPhone =
      invitationForm.invitedPhone.trim();

    const salonNameHint =
      invitationForm.salonNameHint.trim();

    const internalNote =
      invitationForm.internalNote.trim();

    const expiresInDays = Number(
      invitationForm.expiresInDays,
    );

    const payload: {
      invitedEmail?: string;
      invitedPhone?: string;
      salonNameHint?: string;
      internalNote?: string;
      expiresInDays: number;
    } = {
      expiresInDays,
    };

    if (invitedEmail) {
      payload.invitedEmail = invitedEmail;
    }

    if (invitedPhone) {
      payload.invitedPhone = invitedPhone;
    }

    if (salonNameHint) {
      payload.salonNameHint = salonNameHint;
    }

    if (internalNote) {
      payload.internalNote = internalNote;
    }

    try {
      const response =
        await api.post<InvitationCreateResponse>(
          '/platform-admin/invitations',
          payload,
        );

      setCreatedInvitation(response.data);
      setInvitationForm(INITIAL_INVITATION_FORM);
    } catch {
      setInvitationError(
        'Не удалось создать приглашение. Проверьте введённые данные и повторите попытку.',
      );
    } finally {
      setIsInvitationSubmitting(false);
    }
  }

  function updateRejectReason(
    applicationId: string,
    value: string,
  ) {
    setRejectReasonById((current) => ({
      ...current,
      [applicationId]: value,
    }));
  }

  async function approveApplication(
    applicationId: string,
  ) {
    setApplicationActionId(applicationId);
    setApplicationMessage('');
    setApplicationError('');

    try {
      await api.patch(
        `/platform-admin/applications/${applicationId}/approve`,
      );

      setApplicationMessage(
        'Заявка одобрена. Пробный период салона запущен.',
      );

      await loadPlatformData();
    } catch {
      setApplicationError(
        'Не удалось одобрить заявку. Обновите данные и повторите попытку.',
      );
    } finally {
      setApplicationActionId(null);
    }
  }

  async function rejectApplication(
    applicationId: string,
  ) {
    const reason =
      rejectReasonById[applicationId]?.trim() || '';

    if (reason.length < 3) {
      setApplicationMessage('');
      setApplicationError(
        'Укажите причину отклонения длиной не менее трёх символов.',
      );
      return;
    }

    setApplicationActionId(applicationId);
    setApplicationMessage('');
    setApplicationError('');

    try {
      await api.patch(
        `/platform-admin/applications/${applicationId}/reject`,
        {
          reason,
        },
      );

      setApplicationMessage('Заявка отклонена.');

      setRejectReasonById((current) => {
        const next = { ...current };
        delete next[applicationId];
        return next;
      });

      await loadPlatformData();
    } catch {
      setApplicationError(
        'Не удалось отклонить заявку. Обновите данные и повторите попытку.',
      );
    } finally {
      setApplicationActionId(null);
    }
  }

  async function copyInvitationUrl() {
    const inviteUrl = createdInvitation?.inviteUrl;

    if (!inviteUrl) {
      return;
    }

    setCopyStatus('idle');

    try {
      if (
        navigator.clipboard &&
        window.isSecureContext
      ) {
        await navigator.clipboard.writeText(inviteUrl);
      } else {
        const textarea =
          document.createElement('textarea');

        textarea.value = inviteUrl;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        textarea.style.pointerEvents = 'none';

        document.body.appendChild(textarea);
        textarea.select();

        const copied =
          document.execCommand('copy');

        document.body.removeChild(textarea);

        if (!copied) {
          throw new Error('Copy command failed');
        }
      }

      setCopyStatus('copied');
    } catch {
      setCopyStatus('error');
    }
  }

  function handleLogout() {
    localStorage.removeItem('glamour_access_token');
    window.location.hash = '';
    window.location.reload();
  }

  return (
    <div className="platform-shell">
      <aside className="platform-sidebar">
        <div className="platform-brand">
          <div className="platform-brand-icon">
            <ShieldCheck size={24} aria-hidden="true" />
          </div>

          <div>
            <span>GLAMOUR</span>
            <strong>Platform Admin</strong>
          </div>
        </div>

        <nav className="platform-navigation">
          <a className="active" href="#platform">
            <LayoutDashboard size={18} aria-hidden="true" />
            Обзор платформы
          </a>

          <a href="#platform-applications">
            <ClipboardList size={18} aria-hidden="true" />
            Заявки
            {applications.length > 0 ? (
              <span className="platform-navigation-count">
                {applications.length}
              </span>
            ) : null}
          </a>

          <a href="#platform-invitations">
            <Link2 size={18} aria-hidden="true" />
            Приглашения
          </a>

          <a href="#platform-salons">
            <Store size={18} aria-hidden="true" />
            Салоны
          </a>
        </nav>

        <div className="platform-sidebar-footer">
          <p>Защищённый кабинет</p>
          <strong>Владелец платформы</strong>

          <button
            type="button"
            className="platform-logout-button"
            onClick={handleLogout}
          >
            <LogOut size={17} aria-hidden="true" />
            Выйти
          </button>
        </div>
      </aside>

      <main className="platform-main">
        <header className="platform-header">
          <div>
            <p className="dashboard-eyebrow">
              GLAMOUR PLATFORM
            </p>

            <h1>Управление платформой</h1>

            <p className="platform-header-description">
              Салоны, пользователи, подписки и состояние
              системы в одном защищённом кабинете.
            </p>
          </div>

          <button
            type="button"
            className="platform-refresh-button"
            onClick={() => void loadPlatformData()}
            disabled={loadState === 'loading'}
          >
            <RefreshCw
              size={17}
              aria-hidden="true"
              className={
                loadState === 'loading'
                  ? 'platform-refresh-icon-loading'
                  : ''
              }
            />

            Обновить
          </button>
        </header>

        {loadState === 'error' ? (
          <section className="platform-error-panel">
            <h2>Не удалось загрузить данные</h2>

            <p>
              Проверьте соединение с backend и повторите
              запрос.
            </p>

            <button
              type="button"
              className="primary-action"
              onClick={() => void loadPlatformData()}
            >
              Повторить
            </button>
          </section>
        ) : null}

        {loadState !== 'error' ? (
          <>
            <section className="platform-metrics">
              <article className="platform-metric-card">
                <div className="platform-metric-icon">
                  <Building2 size={21} aria-hidden="true" />
                </div>

                <p>Всего салонов</p>

                <strong>
                  {overview?.salons.total ?? '—'}
                </strong>

                <span>
                  Активных: {overview?.salons.active ?? '—'}
                </span>
              </article>

              <article className="platform-metric-card">
                <div className="platform-metric-icon">
                  <Users size={21} aria-hidden="true" />
                </div>

                <p>Пользователи</p>

                <strong>
                  {overview?.users.total ?? '—'}
                </strong>

                <span>
                  Активных: {overview?.users.active ?? '—'}
                </span>
              </article>

              <article className="platform-metric-card">
                <div className="platform-metric-icon">
                  <ShieldCheck size={21} aria-hidden="true" />
                </div>

                <p>Участники салонов</p>

                <strong>
                  {overview?.memberships.active ?? '—'}
                </strong>

                <span>Активные членства</span>
              </article>

              <article className="platform-metric-card">
                <div className="platform-metric-icon">
                  <CircleDollarSign
                    size={21}
                    aria-hidden="true"
                  />
                </div>

                <p>Биллинг</p>

                <strong>
                  {overview?.billing.available
                    ? 'Активен'
                    : 'Не подключён'}
                </strong>

                <span>
                  {overview?.billing.available
                    ? 'Данные доступны'
                    : 'Ожидает настройки'}
                </span>
              </article>
            </section>

            <section className="platform-status-grid">
              <article>
                <span>Пробный период</span>
                <strong>
                  {overview?.salons.trial ?? '—'}
                </strong>
              </article>

              <article>
                <span>Активные</span>
                <strong>
                  {overview?.salons.active ?? '—'}
                </strong>
              </article>

              <article>
                <span>Задолженность</span>
                <strong>
                  {overview?.salons.pastDue ?? '—'}
                </strong>
              </article>

              <article>
                <span>Приостановлены</span>
                <strong>
                  {overview?.salons.suspended ?? '—'}
                </strong>
              </article>

              <article>
                <span>Отменены</span>
                <strong>
                  {overview?.salons.cancelled ?? '—'}
                </strong>
              </article>
            </section>

            <section
              id="platform-applications"
              className="platform-applications-panel"
            >
              <div className="platform-panel-heading">
                <div>
                  <p className="panel-kicker">
                    ЗАЯВКИ НА ПОДКЛЮЧЕНИЕ
                  </p>

                  <h2>Ожидают вашего решения</h2>

                  <p>
                    Новых заявок: {applications.length}
                  </p>
                </div>
              </div>

              {applicationMessage ? (
                <div
                  className="platform-application-message"
                  role="status"
                >
                  <CheckCircle2
                    size={19}
                    aria-hidden="true"
                  />

                  {applicationMessage}
                </div>
              ) : null}

              {applicationError ? (
                <div
                  className="platform-application-error"
                  role="alert"
                >
                  <XCircle size={19} aria-hidden="true" />

                  {applicationError}
                </div>
              ) : null}

              {loadState === 'loading' ? (
                <div className="platform-table-status">
                  Загружаются заявки…
                </div>
              ) : null}

              {loadState === 'ready' &&
              applications.length === 0 ? (
                <div className="platform-applications-empty">
                  <ClipboardList
                    size={30}
                    aria-hidden="true"
                  />

                  <strong>Новых заявок нет</strong>

                  <p>
                    После заполнения регистрации новым
                    салоном его заявка появится здесь.
                  </p>
                </div>
              ) : null}

              {loadState === 'ready' &&
              applications.length > 0 ? (
                <div className="platform-applications-list">
                  {applications.map((application) => {
                    const isProcessing =
                      applicationActionId === application.id;

                    return (
                      <article
                        key={application.id}
                        className="platform-application-card"
                      >
                        <div className="platform-application-main">
                          <div className="platform-application-title">
                            <div className="platform-salon-avatar">
                              <Store
                                size={18}
                                aria-hidden="true"
                              />
                            </div>

                            <div>
                              <h3>
                                {application.salon?.name ||
                                  application.salonNameHint ||
                                  'Новый салон'}
                              </h3>

                              <span className="platform-status platform-status-warning">
                                Ожидает одобрения
                              </span>
                            </div>
                          </div>

                          <div className="platform-application-details">
                            <div>
                              <span>Владелец</span>
                              <strong>
                                {getApplicationOwnerName(
                                  application,
                                )}
                              </strong>
                              <small>
                                {application.owner?.email ||
                                  application.invitedEmail ||
                                  'Email не указан'}
                              </small>
                              <small>
                                {application.owner?.phone ||
                                  application.invitedPhone ||
                                  'Телефон не указан'}
                              </small>
                            </div>

                            <div>
                              <span>Тариф</span>
                              <strong>
                                {application.plan?.name ||
                                  'Не указан'}
                              </strong>
                              <small>
                                {application.plan
                                  ? `${application.plan.price} ${application.plan.currency}`
                                  : 'Стоимость не указана'}
                              </small>
                              <small>
                                Trial:{' '}
                                {application.plan?.trialDays ??
                                  '—'}{' '}
                                дней
                              </small>
                            </div>

                            <div>
                              <span>Заявка подана</span>
                              <strong>
                                {formatDate(
                                  application.submittedAt,
                                )}
                              </strong>
                              <small>
                                <Clock3
                                  size={13}
                                  aria-hidden="true"
                                />
                                Trial ещё не запущен
                              </small>
                            </div>
                          </div>

                          {application.internalNote ? (
                            <div className="platform-application-note">
                              <span>Внутренняя заметка</span>
                              <p>
                                {application.internalNote}
                              </p>
                            </div>
                          ) : null}
                        </div>

                        <div className="platform-application-actions">
                          <button
                            type="button"
                            className="platform-approve-button"
                            disabled={
                              applicationActionId !== null
                            }
                            onClick={() =>
                              void approveApplication(
                                application.id,
                              )
                            }
                          >
                            <CheckCircle2
                              size={17}
                              aria-hidden="true"
                            />

                            {isProcessing
                              ? 'Обработка…'
                              : 'Одобрить и запустить trial'}
                          </button>

                          <label>
                            <span>Причина отклонения</span>

                            <textarea
                              value={
                                rejectReasonById[
                                  application.id
                                ] || ''
                              }
                              onChange={(event) =>
                                updateRejectReason(
                                  application.id,
                                  event.target.value,
                                )
                              }
                              placeholder="Например: недостаточно данных"
                              maxLength={500}
                              rows={3}
                              disabled={
                                applicationActionId !== null
                              }
                            />
                          </label>

                          <button
                            type="button"
                            className="platform-reject-button"
                            disabled={
                              applicationActionId !== null
                            }
                            onClick={() =>
                              void rejectApplication(
                                application.id,
                              )
                            }
                          >
                            <XCircle
                              size={17}
                              aria-hidden="true"
                            />

                            {isProcessing
                              ? 'Обработка…'
                              : 'Отклонить заявку'}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : null}
            </section>

            <section
              id="platform-invitations"
              className="platform-invitations-panel"
            >
              <div className="platform-panel-heading">
                <div>
                  <p className="panel-kicker">
                    ПРИГЛАШЕНИЯ
                  </p>

                  <h2>Создать ссылку для нового салона</h2>

                  <p>
                    Ссылка действует ограниченное время и
                    может быть использована только один раз.
                  </p>
                </div>
              </div>

              <div className="platform-invitation-layout">
                <form
                  className="platform-invitation-form"
                  onSubmit={handleInvitationSubmit}
                >
                  <div className="platform-form-grid">
                    <label>
                      <span>Email владельца</span>

                      <div className="platform-form-field">
                        <Mail
                          size={17}
                          aria-hidden="true"
                        />

                        <input
                          type="email"
                          value={
                            invitationForm.invitedEmail
                          }
                          onChange={(event) =>
                            updateInvitationField(
                              'invitedEmail',
                              event.target.value,
                            )
                          }
                          placeholder="owner@example.com"
                          autoComplete="off"
                        />
                      </div>
                    </label>

                    <label>
                      <span>Телефон владельца</span>

                      <div className="platform-form-field">
                        <Phone
                          size={17}
                          aria-hidden="true"
                        />

                        <input
                          type="tel"
                          value={
                            invitationForm.invitedPhone
                          }
                          onChange={(event) =>
                            updateInvitationField(
                              'invitedPhone',
                              event.target.value,
                            )
                          }
                          placeholder="+37360123456"
                          autoComplete="off"
                        />
                      </div>
                    </label>

                    <label>
                      <span>Название салона</span>

                      <div className="platform-form-field">
                        <Store
                          size={17}
                          aria-hidden="true"
                        />

                        <input
                          type="text"
                          value={
                            invitationForm.salonNameHint
                          }
                          onChange={(event) =>
                            updateInvitationField(
                              'salonNameHint',
                              event.target.value,
                            )
                          }
                          placeholder="Название будущего салона"
                          maxLength={150}
                        />
                      </div>
                    </label>

                    <label>
                      <span>Срок действия</span>

                      <select
                        value={
                          invitationForm.expiresInDays
                        }
                        onChange={(event) =>
                          updateInvitationField(
                            'expiresInDays',
                            event.target.value,
                          )
                        }
                      >
                        <option value="1">1 день</option>
                        <option value="3">3 дня</option>
                        <option value="7">7 дней</option>
                        <option value="14">14 дней</option>
                        <option value="30">30 дней</option>
                      </select>
                    </label>
                  </div>

                  <label className="platform-form-note">
                    <span>Внутренняя заметка</span>

                    <textarea
                      value={
                        invitationForm.internalNote
                      }
                      onChange={(event) =>
                        updateInvitationField(
                          'internalNote',
                          event.target.value,
                        )
                      }
                      placeholder="Заметка видна только владельцу платформы"
                      maxLength={500}
                      rows={3}
                    />
                  </label>

                  {invitationError ? (
                    <p
                      className="platform-invitation-error"
                      role="alert"
                    >
                      {invitationError}
                    </p>
                  ) : null}

                  <button
                    type="submit"
                    className="platform-create-invitation-button"
                    disabled={isInvitationSubmitting}
                  >
                    <Plus size={18} aria-hidden="true" />

                    {isInvitationSubmitting
                      ? 'Создание ссылки…'
                      : 'Создать приглашение'}
                  </button>
                </form>

                <aside className="platform-invitation-result">
                  {createdInvitation ? (
                    <>
                      <div className="platform-result-success">
                        <CheckCircle2
                          size={21}
                          aria-hidden="true"
                        />

                        <div>
                          <strong>
                            Приглашение создано
                          </strong>

                          <span>
                            Действует до{' '}
                            {formatDate(
                              createdInvitation.expiresAt,
                            )}
                          </span>
                        </div>
                      </div>

                      <label>
                        Одноразовая ссылка
                      </label>

                      <div className="platform-invite-url">
                        <input
                          type="text"
                          value={
                            createdInvitation.inviteUrl
                          }
                          readOnly
                          onFocus={(event) =>
                            event.currentTarget.select()
                          }
                        />

                        <button
                          type="button"
                          onClick={() =>
                            void copyInvitationUrl()
                          }
                        >
                          <ClipboardCopy
                            size={17}
                            aria-hidden="true"
                          />

                          Копировать
                        </button>
                      </div>

                      {copyStatus === 'copied' ? (
                        <p className="platform-copy-success">
                          Ссылка скопирована.
                        </p>
                      ) : null}

                      {copyStatus === 'error' ? (
                        <p className="platform-invitation-error">
                          Не удалось скопировать автоматически.
                          Выделите ссылку и скопируйте её
                          вручную.
                        </p>
                      ) : null}

                      <p className="platform-security-note">
                        Токен хранится в базе только в виде
                        хеша. Полная ссылка показывается один
                        раз после создания.
                      </p>
                    </>
                  ) : (
                    <div className="platform-result-placeholder">
                      <Link2
                        size={28}
                        aria-hidden="true"
                      />

                      <strong>
                        Здесь появится ссылка
                      </strong>

                      <p>
                        После создания сразу скопируйте и
                        отправьте её владельцу салона.
                      </p>
                    </div>
                  )}
                </aside>
              </div>
            </section>

            <section
              id="platform-salons"
              className="platform-salons-panel"
            >
              <div className="platform-panel-heading">
                <div>
                  <p className="panel-kicker">
                    САЛОНЫ ПЛАТФОРМЫ
                  </p>

                  <h2>Все зарегистрированные салоны</h2>

                  <p>
                    Найдено: {filteredSalons.length}
                  </p>
                </div>

                <label className="platform-search">
                  <Search size={18} aria-hidden="true" />

                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(event) =>
                      setSearchQuery(event.target.value)
                    }
                    placeholder="Название, email или владелец"
                    aria-label="Поиск салонов"
                  />
                </label>
              </div>

              {loadState === 'loading' ? (
                <div className="platform-table-status">
                  Загружаются данные салонов…
                </div>
              ) : null}

              {loadState === 'ready' &&
              filteredSalons.length === 0 ? (
                <div className="platform-table-status">
                  Салоны не найдены.
                </div>
              ) : null}

              {loadState === 'ready' &&
              filteredSalons.length > 0 ? (
                <div className="platform-table-wrapper">
                  <table className="platform-table">
                    <thead>
                      <tr>
                        <th>Салон</th>
                        <th>Владелец</th>
                        <th>Статус</th>
                        <th>Участники</th>
                        <th>Подписка</th>
                        <th>Создан</th>
                      </tr>
                    </thead>

                    <tbody>
                      {filteredSalons.map((salon) => (
                        <tr key={salon.id}>
                          <td>
                            <div className="platform-salon-cell">
                              <div className="platform-salon-avatar">
                                <Store
                                  size={18}
                                  aria-hidden="true"
                                />
                              </div>

                              <div>
                                <strong>{salon.name}</strong>
                                <span>
                                  {salon.email ||
                                    salon.phone ||
                                    salon.slug}
                                </span>
                              </div>
                            </div>
                          </td>

                          <td>
                            <div className="platform-owner-cell">
                              <strong>
                                {getOwnerName(salon)}
                              </strong>

                              <span>
                                {salon.owner?.email ||
                                  salon.owner?.phone ||
                                  'Контакты не указаны'}
                              </span>
                            </div>
                          </td>

                          <td>
                            <span
                              className={getStatusClassName(
                                salon.status,
                              )}
                            >
                              {getStatusLabel(salon.status)}
                            </span>
                          </td>

                          <td>{salon.memberCount}</td>

                          <td>
                            <span className="platform-muted-value">
                              {salon.subscription
                                ? 'Подключена'
                                : 'Не подключена'}
                            </span>
                          </td>

                          <td>
                            {formatDate(salon.createdAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </section>

            {!overview?.billing.available &&
            overview?.billing.reason ? (
              <section className="platform-billing-notice">
                <CircleDollarSign
                  size={20}
                  aria-hidden="true"
                />

                <div>
                  <strong>
                    Подписки и платежи ещё не подключены
                  </strong>

                  <p>{overview.billing.reason}</p>
                </div>
              </section>
            ) : null}
          </>
        ) : null}
      </main>
    </div>
  );
}

export default PlatformOwnerPage;
