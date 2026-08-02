import { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Search,
  Scissors,
  Trash2,
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
  isActive: boolean;
};

const WORKSPACE_MODE_KEY = 'glamour_workspace_mode';
const CURRENT_SALON_ID_KEY = 'glamour_current_salon_id';

function getWorkspaceMode(): WorkspaceMode {
  const mode = localStorage.getItem(WORKSPACE_MODE_KEY);

  if (
    mode === 'platform' ||
    mode === 'salon' ||
    mode === 'master'
  ) {
    return mode;
  }

  return 'salon';
}

function ServicesPage() {
  const workspaceMode = getWorkspaceMode();
  const isMasterWorkspace = workspaceMode === 'master';

  const [salon, setSalon] =
    useState<SalonSummary | null>(null);

  const [services, setServices] =
    useState<Service[]>([]);

  const [masterServices, setMasterServices] =
    useState<MasterService[]>([]);

  const [message, setMessage] = useState(
    isMasterWorkspace
      ? 'Загрузка ваших услуг...'
      : 'Загрузка услуг...',
  );

  const [search, setSearch] = useState('');

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [durationMinutes, setDurationMinutes] =
    useState('60');
  const [basePrice, setBasePrice] = useState('300');

  const [selectedServiceId, setSelectedServiceId] =
    useState('');

  const [masterPrice, setMasterPrice] = useState('');
  const [masterDurationMinutes, setMasterDurationMinutes] =
    useState('');

  const [bufferBeforeMinutes, setBufferBeforeMinutes] =
    useState('0');

  const [bufferAfterMinutes, setBufferAfterMinutes] =
    useState('0');

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  async function loadSalon(): Promise<SalonSummary | null> {
    const response =
      await api.get<SalonSummary[]>('/salons/my');

    const availableSalons = response.data;

    if (availableSalons.length === 0) {
      return null;
    }

    if (!isMasterWorkspace) {
      return availableSalons[0] ?? null;
    }

    const masterSalons = availableSalons.filter(
      (availableSalon) =>
        availableSalon.membershipStatus === 'active' &&
        (
          availableSalon.membershipRoles?.includes(
            'master',
          ) ||
          availableSalon.membershipRole === 'master'
        ),
    );

    if (masterSalons.length === 0) {
      return null;
    }

    const savedCurrentSalonId =
      localStorage.getItem(CURRENT_SALON_ID_KEY);

    const savedSalon = savedCurrentSalonId
      ? masterSalons.find(
          (availableSalon) =>
            availableSalon.id === savedCurrentSalonId,
        )
      : undefined;

    const currentSalon =
      savedSalon ?? masterSalons[0];

    localStorage.setItem(
      CURRENT_SALON_ID_KEY,
      currentSalon.id,
    );

    return currentSalon;
  }

  async function loadSalonServices(
    salonId: string,
  ): Promise<void> {
    const response = await api.get<Service[]>(
      '/services',
      {
        params: {
          salonId,
        },
      },
    );

    setServices(response.data);
  }

  async function loadMasterServices(
    salonId: string,
  ): Promise<void> {
    const [catalogResponse, myServicesResponse] =
      await Promise.all([
        api.get<Service[]>(
          '/masters/me/available-services',
          {
            params: {
              salonId,
            },
          },
        ),
        api.get<MasterService[]>(
          '/masters/me/services',
          {
            params: {
              salonId,
            },
          },
        ),
      ]);

    setServices(catalogResponse.data);
    setMasterServices(myServicesResponse.data);
  }

  async function reloadData(
    salonId: string,
  ): Promise<void> {
    if (isMasterWorkspace) {
      await loadMasterServices(salonId);
    } else {
      await loadSalonServices(salonId);
    }
  }

  useEffect(() => {
    let isCancelled = false;

    async function loadData() {
      try {
        const currentSalon = await loadSalon();

        if (isCancelled) {
          return;
        }

        setSalon(currentSalon);

        if (!currentSalon) {
          setServices([]);
          setMasterServices([]);
          setMessage(
            'Для вашей учётной записи не найден доступный салон.',
          );
          return;
        }

        if (isMasterWorkspace) {
          const [catalogResponse, myServicesResponse] =
            await Promise.all([
              api.get<Service[]>(
                '/masters/me/available-services',
                {
                  params: {
                    salonId: currentSalon.id,
                  },
                },
              ),
              api.get<MasterService[]>(
                '/masters/me/services',
                {
                  params: {
                    salonId: currentSalon.id,
                  },
                },
              ),
            ]);

          if (isCancelled) {
            return;
          }

          setServices(catalogResponse.data);
          setMasterServices(myServicesResponse.data);
        } else {
          const response = await api.get<Service[]>(
            '/services',
            {
              params: {
                salonId: currentSalon.id,
              },
            },
          );

          if (isCancelled) {
            return;
          }

          setServices(response.data);
        }

        setMessage('');
      } catch {
        if (!isCancelled) {
          setMessage(
            isMasterWorkspace
              ? 'Не удалось загрузить услуги мастера.'
              : 'Не удалось загрузить услуги.',
          );
        }
      }
    }

    void loadData();

    return () => {
      isCancelled = true;
    };
  }, [isMasterWorkspace]);

  const serviceById = useMemo(() => {
    return new Map(
      services.map((service) => [
        service.id,
        service,
      ]),
    );
  }, [services]);

  const masterServiceByServiceId = useMemo(() => {
    return new Map(
      masterServices.map((masterService) => [
        masterService.serviceId,
        masterService,
      ]),
    );
  }, [masterServices]);

  const filteredServices = useMemo(() => {
    const normalizedSearch =
      search.trim().toLowerCase();

    if (!normalizedSearch) {
      return services;
    }

    return services.filter((service) => {
      return (
        service.name
          .toLowerCase()
          .includes(normalizedSearch) ||
        (service.description || '')
          .toLowerCase()
          .includes(normalizedSearch)
      );
    });
  }, [services, search]);

  const filteredMasterServices = useMemo(() => {
    const normalizedSearch =
      search.trim().toLowerCase();

    if (!normalizedSearch) {
      return masterServices;
    }

    return masterServices.filter((masterService) => {
      const service =
        serviceById.get(masterService.serviceId);

      if (!service) {
        return false;
      }

      return (
        service.name
          .toLowerCase()
          .includes(normalizedSearch) ||
        (service.description || '')
          .toLowerCase()
          .includes(normalizedSearch)
      );
    });
  }, [masterServices, search, serviceById]);

  function handleMasterServiceSelection(
    serviceId: string,
  ) {
    setSelectedServiceId(serviceId);

    const service = serviceById.get(serviceId);
    const existingMasterService =
      masterServiceByServiceId.get(serviceId);

    if (existingMasterService) {
      setMasterPrice(
        String(Number(existingMasterService.price)),
      );

      setMasterDurationMinutes(
        String(existingMasterService.durationMinutes),
      );

      setBufferBeforeMinutes(
        String(
          existingMasterService.bufferBeforeMinutes ??
            0,
        ),
      );

      setBufferAfterMinutes(
        String(
          existingMasterService.bufferAfterMinutes ??
            0,
        ),
      );

      return;
    }

    if (service) {
      setMasterPrice(
        String(Number(service.basePrice)),
      );

      setMasterDurationMinutes(
        String(service.durationMinutes),
      );
    } else {
      setMasterPrice('');
      setMasterDurationMinutes('');
    }

    setBufferBeforeMinutes('0');
    setBufferAfterMinutes('0');
  }

  async function handleCreateService(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!salon) {
      setMessage('Салон не выбран.');
      return;
    }

    setIsSubmitting(true);

    try {
      await api.post(
        '/services',
        {
          name,
          description,
          durationMinutes: Number(durationMinutes),
          basePrice: Number(basePrice),
          isActive: true,
        },
        {
          params: {
            salonId: salon.id,
          },
        },
      );

      setName('');
      setDescription('');
      setDurationMinutes('60');
      setBasePrice('300');

      await reloadData(salon.id);
      setMessage('');
    } catch {
      setMessage('Не удалось создать услугу.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSaveMasterService(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!salon || !selectedServiceId) {
      setMessage('Выберите услугу.');
      return;
    }

    setIsSubmitting(true);

    try {
      await api.post(
        '/masters/me/services',
        {
          serviceId: selectedServiceId,
          price: Number(masterPrice),
          durationMinutes: Number(
            masterDurationMinutes,
          ),
          bufferBeforeMinutes: Number(
            bufferBeforeMinutes,
          ),
          bufferAfterMinutes: Number(
            bufferAfterMinutes,
          ),
        },
        {
          params: {
            salonId: salon.id,
          },
        },
      );

      await reloadData(salon.id);

      setSelectedServiceId('');
      setMasterPrice('');
      setMasterDurationMinutes('');
      setBufferBeforeMinutes('0');
      setBufferAfterMinutes('0');

      setMessage('');
    } catch {
      setMessage(
        'Не удалось сохранить услугу мастера.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeactivateService(
    id: string,
  ) {
    if (!salon) {
      return;
    }

    try {
      await api.patch(
        `/services/${id}/deactivate`,
        undefined,
        {
          params: {
            salonId: salon.id,
          },
        },
      );

      await reloadData(salon.id);
      setMessage('');
    } catch {
      setMessage('Не удалось отключить услугу.');
    }
  }

  async function handleDeactivateMasterService(
    id: string,
  ) {
    if (!salon) {
      return;
    }

    try {
      await api.patch(
        `/masters/me/services/${id}/deactivate`,
        undefined,
        {
          params: {
            salonId: salon.id,
          },
        },
      );

      await reloadData(salon.id);
      setMessage('');
    } catch {
      setMessage(
        'Не удалось отключить вашу услугу.',
      );
    }
  }

  async function handleRemoveMasterService(
    id: string,
  ) {
    if (!salon) {
      return;
    }

    try {
      await api.delete(
        `/masters/me/services/${id}`,
        {
          params: {
            salonId: salon.id,
          },
        },
      );

      await reloadData(salon.id);
      setMessage('');
    } catch {
      setMessage(
        'Не удалось удалить вашу услугу.',
      );
    }
  }

  if (isMasterWorkspace) {
    return (
      <AppLayout>
        <main className="dashboard-page">
          <header className="dashboard-header">
            <div>
              <p className="dashboard-eyebrow">
                МОИ УСЛУГИ
              </p>

              <h1>Услуги мастера</h1>

              <p className="dashboard-subtitle">
                Выберите услуги из каталога салона и
                настройте свою цену, длительность и
                интервалы между записями.
              </p>
            </div>

            <div className="dashboard-period">
              <span>Активных услуг</span>
              <strong>
                {
                  masterServices.filter(
                    (service) => service.isActive,
                  ).length
                }
              </strong>
            </div>
          </header>

          <section className="dashboard-columns">
            <article className="dashboard-panel">
              <div className="panel-heading">
                <div>
                  <p className="panel-kicker">
                    ДОБАВИТЬ / ИЗМЕНИТЬ
                  </p>
                  <h2>Моя услуга</h2>
                </div>

                <Plus size={22} />
              </div>

              <form
                className="service-form"
                onSubmit={handleSaveMasterService}
              >
                <label>
                  Услуга салона
                  <select
                    value={selectedServiceId}
                    onChange={(event) =>
                      handleMasterServiceSelection(
                        event.target.value,
                      )
                    }
                    required
                  >
                    <option value="">
                      Выберите услугу
                    </option>

                    {services.map((service) => (
                      <option
                        key={service.id}
                        value={service.id}
                      >
                        {service.name}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="service-form-grid">
                  <label>
                    Моя цена, MDL
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={masterPrice}
                      onChange={(event) =>
                        setMasterPrice(
                          event.target.value,
                        )
                      }
                      required
                    />
                  </label>

                  <label>
                    Время, мин
                    <input
                      type="number"
                      min="5"
                      max="1440"
                      value={masterDurationMinutes}
                      onChange={(event) =>
                        setMasterDurationMinutes(
                          event.target.value,
                        )
                      }
                      required
                    />
                  </label>

                  <label>
                    Буфер до, мин
                    <input
                      type="number"
                      min="0"
                      max="240"
                      value={bufferBeforeMinutes}
                      onChange={(event) =>
                        setBufferBeforeMinutes(
                          event.target.value,
                        )
                      }
                      required
                    />
                  </label>

                  <label>
                    Буфер после, мин
                    <input
                      type="number"
                      min="0"
                      max="240"
                      value={bufferAfterMinutes}
                      onChange={(event) =>
                        setBufferAfterMinutes(
                          event.target.value,
                        )
                      }
                      required
                    />
                  </label>
                </div>

                <button
                  type="submit"
                  className="primary-action"
                  disabled={isSubmitting}
                >
                  {isSubmitting
                    ? 'Сохраняем...'
                    : 'Сохранить услугу'}
                </button>
              </form>
            </article>

            <article className="dashboard-panel">
              <div className="panel-heading">
                <div>
                  <p className="panel-kicker">
                    ПОИСК
                  </p>
                  <h2>Мои услуги</h2>
                </div>

                <Search size={22} />
              </div>

              <div className="service-search">
                <Search size={18} />

                <input
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                  placeholder="Найти услугу..."
                />
              </div>

              {message ? (
                <p className="dashboard-status">
                  {message}
                </p>
              ) : (
                <p className="empty-state">
                  Найдено услуг:{' '}
                  {filteredMasterServices.length}
                </p>
              )}
            </article>
          </section>

          <section className="dashboard-panel services-panel">
            <div className="panel-heading">
              <div>
                <p className="panel-kicker">
                  МОЙ ПЕРЕЧЕНЬ
                </p>

                <h2>
                  {filteredMasterServices.length}{' '}
                  услуг
                </h2>
              </div>

              <Scissors size={22} />
            </div>

            <div className="ranking-list">
              {filteredMasterServices.map(
                (masterService) => {
                  const service = serviceById.get(
                    masterService.serviceId,
                  );

                  return (
                    <div
                      className="ranking-row"
                      key={masterService.id}
                    >
                      <span className="ranking-number">
                        {masterService.isActive
                          ? '✓'
                          : '×'}
                      </span>

                      <div className="ranking-main">
                        <strong>
                          {service?.name ??
                            'Услуга'}
                        </strong>

                        <span>
                          {service?.description ||
                            'Описание не указано'}
                        </span>

                        <span>
                          Статус:{' '}
                          {masterService.isActive
                            ? 'активна'
                            : 'отключена'}
                        </span>
                      </div>

                      <div className="ranking-value">
                        <strong>
                          {Number(
                            masterService.price,
                          ).toFixed(2)}{' '}
                          MDL
                        </strong>

                        <span>
                          {
                            masterService.durationMinutes
                          }{' '}
                          мин
                        </span>

                        {masterService.isActive ? (
                          <button
                            type="button"
                            className="danger-action"
                            onClick={() =>
                              handleDeactivateMasterService(
                                masterService.id,
                              )
                            }
                          >
                            Отключить
                          </button>
                        ) : null}

                        <button
                          type="button"
                          className="danger-action"
                          onClick={() =>
                            handleRemoveMasterService(
                              masterService.id,
                            )
                          }
                        >
                          <Trash2 size={15} />
                          Удалить
                        </button>
                      </div>
                    </div>
                  );
                },
              )}
            </div>
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
            <p className="dashboard-eyebrow">
              УСЛУГИ
            </p>

            <h1>Каталог услуг</h1>

            <p className="dashboard-subtitle">
              Основные услуги салона. Администратор
              может добавлять новые услуги и отключать
              неактуальные.
            </p>
          </div>

          <div className="dashboard-period">
            <span>Активных услуг</span>
            <strong>
              {
                services.filter(
                  (service) => service.isActive,
                ).length
              }
            </strong>
          </div>
        </header>

        <section className="dashboard-columns">
          <article className="dashboard-panel">
            <div className="panel-heading">
              <div>
                <p className="panel-kicker">
                  ДОБАВИТЬ
                </p>
                <h2>Новая услуга</h2>
              </div>

              <Plus size={22} />
            </div>

            <form
              className="service-form"
              onSubmit={handleCreateService}
            >
              <label>
                Название услуги
                <input
                  value={name}
                  onChange={(event) =>
                    setName(event.target.value)
                  }
                  placeholder="Например: Укладка волос"
                  required
                />
              </label>

              <label>
                Описание
                <textarea
                  value={description}
                  onChange={(event) =>
                    setDescription(
                      event.target.value,
                    )
                  }
                  placeholder="Краткое описание услуги"
                />
              </label>

              <div className="service-form-grid">
                <label>
                  Время, мин
                  <input
                    type="number"
                    min="5"
                    value={durationMinutes}
                    onChange={(event) =>
                      setDurationMinutes(
                        event.target.value,
                      )
                    }
                    required
                  />
                </label>

                <label>
                  Базовая цена, MDL
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={basePrice}
                    onChange={(event) =>
                      setBasePrice(
                        event.target.value,
                      )
                    }
                    required
                  />
                </label>
              </div>

              <button
                type="submit"
                className="primary-action"
                disabled={isSubmitting}
              >
                {isSubmitting
                  ? 'Сохраняем...'
                  : 'Добавить услугу'}
              </button>
            </form>
          </article>

          <article className="dashboard-panel">
            <div className="panel-heading">
              <div>
                <p className="panel-kicker">
                  ПОИСК
                </p>
                <h2>Фильтр услуг</h2>
              </div>

              <Search size={22} />
            </div>

            <div className="service-search">
              <Search size={18} />

              <input
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Найти услугу..."
              />
            </div>

            {message ? (
              <p className="dashboard-status">
                {message}
              </p>
            ) : (
              <p className="empty-state">
                Найдено услуг:{' '}
                {filteredServices.length}
              </p>
            )}
          </article>
        </section>

        <section className="dashboard-panel services-panel">
          <div className="panel-heading">
            <div>
              <p className="panel-kicker">
                КАТАЛОГ
              </p>

              <h2>
                {filteredServices.length} услуг
              </h2>
            </div>

            <Scissors size={22} />
          </div>

          <div className="ranking-list">
            {filteredServices.map((service) => (
              <div
                className="ranking-row"
                key={service.id}
              >
                <span className="ranking-number">
                  {service.isActive ? '✓' : '×'}
                </span>

                <div className="ranking-main">
                  <strong>{service.name}</strong>

                  <span>
                    {service.description ||
                      'Описание не указано'}
                  </span>

                  <span>
                    Статус:{' '}
                    {service.isActive
                      ? 'активна'
                      : 'отключена'}
                  </span>
                </div>

                <div className="ranking-value">
                  <strong>
                    {Number(
                      service.basePrice,
                    ).toFixed(2)}{' '}
                    MDL
                  </strong>

                  <span>
                    {service.durationMinutes} мин
                  </span>

                  {service.isActive ? (
                    <button
                      type="button"
                      className="danger-action"
                      onClick={() =>
                        handleDeactivateService(
                          service.id,
                        )
                      }
                    >
                      <Trash2 size={15} />
                      Отключить
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </AppLayout>
  );
}

export default ServicesPage;
