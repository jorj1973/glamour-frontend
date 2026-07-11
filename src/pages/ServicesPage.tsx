import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Scissors, Trash2 } from 'lucide-react';
import api from '../api/api';
import AppLayout from '../components/AppLayout';

type Service = {
    id: string;
    name: string;
    description: string | null;
    durationMinutes: number;
    basePrice: number;
    isActive: boolean;
};

function ServicesPage() {
    const [services, setServices] = useState<Service[]>([]);
    const [message, setMessage] = useState('Загрузка услуг...');
    const [search, setSearch] = useState('');
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [durationMinutes, setDurationMinutes] = useState('60');
    const [basePrice, setBasePrice] = useState('300');
    const [isSubmitting, setIsSubmitting] = useState(false);

    async function loadServices() {
        try {
            const response = await api.get<Service[]>('/services');
            setServices(response.data);
            setMessage('');
        } catch {
            setMessage('Не удалось загрузить услуги.');
        }
    }

    useEffect(() => {
        loadServices();
    }, []);

    const filteredServices = useMemo(() => {
        const normalizedSearch = search.trim().toLowerCase();

        if (!normalizedSearch) {
            return services;
        }

        return services.filter((service) => {
            return (
                service.name.toLowerCase().includes(normalizedSearch) ||
                (service.description || '').toLowerCase().includes(normalizedSearch)
            );
        });
    }, [services, search]);

    async function handleCreateService(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setIsSubmitting(true);

        try {
            await api.post('/services', {
                name,
                description,
                durationMinutes: Number(durationMinutes),
                basePrice: Number(basePrice),
                isActive: true,
            });

            setName('');
            setDescription('');
            setDurationMinutes('60');
            setBasePrice('300');

            await loadServices();
        } catch {
            setMessage('Не удалось создать услугу.');
        } finally {
            setIsSubmitting(false);
        }
    }

    async function handleDeactivateService(id: string) {
        try {
            await api.patch(`/services/${id}/deactivate`);
            await loadServices();
        } catch {
            setMessage('Не удалось отключить услугу.');
        }
    }

    return (
        <AppLayout>
            <main className="dashboard-page">
                <header className="dashboard-header">
                    <div>
                        <p className="dashboard-eyebrow">УСЛУГИ</p>
                        <h1>Каталог услуг</h1>
                        <p className="dashboard-subtitle">
                            Основные услуги салона. Администратор может добавлять новые услуги и отключать неактуальные.
                        </p>
                    </div>

                    <div className="dashboard-period">
                        <span>Активных услуг</span>
                        <strong>{services.filter((service) => service.isActive).length}</strong>
                    </div>
                </header>

                <section className="dashboard-columns">
                    <article className="dashboard-panel">
                        <div className="panel-heading">
                            <div>
                                <p className="panel-kicker">ДОБАВИТЬ</p>
                                <h2>Новая услуга</h2>
                            </div>
                            <Plus size={22} />
                        </div>

                        <form className="service-form" onSubmit={handleCreateService}>
                            <label>
                                Название услуги
                                <input
                                    value={name}
                                    onChange={(event) => setName(event.target.value)}
                                    placeholder="Например: Укладка волос"
                                    required
                                />
                            </label>

                            <label>
                                Описание
                                <textarea
                                    value={description}
                                    onChange={(event) => setDescription(event.target.value)}
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
                                        onChange={(event) => setDurationMinutes(event.target.value)}
                                        required
                                    />
                                </label>

                                <label>
                                    Базовая цена, MDL
                                    <input
                                        type="number"
                                        min="0"
                                        value={basePrice}
                                        onChange={(event) => setBasePrice(event.target.value)}
                                        required
                                    />
                                </label>
                            </div>

                            <button
                                type="submit"
                                className="primary-action"
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? 'Сохраняем...' : 'Добавить услугу'}
                            </button>
                        </form>
                    </article>

                    <article className="dashboard-panel">
                        <div className="panel-heading">
                            <div>
                                <p className="panel-kicker">ПОИСК</p>
                                <h2>Фильтр услуг</h2>
                            </div>
                            <Search size={22} />
                        </div>

                        <div className="service-search">
                            <Search size={18} />
                            <input
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                placeholder="Найти услугу..."
                            />
                        </div>

                        {message ? (
                            <p className="dashboard-status">{message}</p>
                        ) : (
                            <p className="empty-state">
                                Найдено услуг: {filteredServices.length}
                            </p>
                        )}
                    </article>
                </section>

                <section className="dashboard-panel services-panel">
                    <div className="panel-heading">
                        <div>
                            <p className="panel-kicker">КАТАЛОГ</p>
                            <h2>{filteredServices.length} услуг</h2>
                        </div>

                        <Scissors size={22} />
                    </div>

                    <div className="ranking-list">
                        {filteredServices.map((service) => (
                            <div className="ranking-row" key={service.id}>
                                <span className="ranking-number">
                                    {service.isActive ? '✓' : '×'}
                                </span>

                                <div className="ranking-main">
                                    <strong>{service.name}</strong>
                                    <span>{service.description || 'Описание не указано'}</span>
                                    <span>
                                        Статус: {service.isActive ? 'активна' : 'отключена'}
                                    </span>
                                </div>

                                <div className="ranking-value">
                                    <strong>{Number(service.basePrice).toFixed(2)} MDL</strong>
                                    <span>{service.durationMinutes} мин</span>

                                    {service.isActive ? (
                                        <button
                                            type="button"
                                            className="danger-action"
                                            onClick={() => handleDeactivateService(service.id)}
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