import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Building2,
  CircleDollarSign,
  LayoutDashboard,
  LogOut,
  RefreshCw,
  Search,
  ShieldCheck,
  Store,
  Users,
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

    case 'suspended':
    case 'cancelled':
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

function PlatformOwnerPage() {
  const [overview, setOverview] =
    useState<PlatformOverview | null>(null);

  const [salons, setSalons] = useState<PlatformSalon[]>([]);
  const [loadState, setLoadState] =
    useState<LoadState>('loading');

  const [searchQuery, setSearchQuery] = useState('');

  const loadPlatformData = useCallback(async () => {
    setLoadState('loading');

    try {
      const [overviewResponse, salonsResponse] =
        await Promise.all([
          api.get<PlatformOverview>(
            '/platform-admin/overview',
          ),
          api.get<PlatformSalon[]>(
            '/platform-admin/salons',
          ),
        ]);

      setOverview(overviewResponse.data);
      setSalons(salonsResponse.data);
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
