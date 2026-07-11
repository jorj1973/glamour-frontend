import { useEffect, useState } from 'react';
import {
    CalendarDays,
    CreditCard,
    Gift,
    Percent,
    Scissors,
    Users,
    Wallet,
} from 'lucide-react';
import api from '../api/api';
import AppLayout from '../components/AppLayout';

type TopMaster = {
    masterProfileId: string;
    profession: string;
    salonName: string;
    paymentsCount: number;
    revenue: number;
};

type TopService = {
    serviceId: string;
    name: string;
    durationMinutes: number;
    basePrice: number;
    bookingsCount: number;
    paymentsCount: number;
    revenue: number;
};

type DashboardData = {
    revenueToday: number;
    revenueMonth: number;
    appointmentsToday: number;
    clientsTotal: number;
    activeGiftCards: number;
    activePromoCodes: number;
    loyaltyClients: number;
    paymentsCount: number;
    averageTicket: number;
    topMasters: TopMaster[];
    topServices: TopService[];
};

function OwnerDashboardPage() {
    const [data, setData] = useState<DashboardData | null>(null);
    const [message, setMessage] = useState('Загрузка данных панели управления…');

    useEffect(() => {
        async function loadDashboard() {
            try {
                const response = await api.get<DashboardData>('/dashboard/owner');
                setData(response.data);
                setMessage('');
            } catch {
                setMessage('Не удалось загрузить данные панели управления.');
            }
        }

        loadDashboard();
    }, []);

    if (message) {
        return (
            <AppLayout>
                <main className="dashboard-page">
                    <p className="dashboard-status">{message}</p>
                </main>
            </AppLayout>
        );
    }

    if (!data) {
        return null;
    }

    const metrics = [
        {
            label: 'Доход сегодня',
            value: `${data.revenueToday} MDL`,
            icon: <Wallet size={22} />,
        },
        {
            label: 'Доход за месяц',
            value: `${data.revenueMonth} MDL`,
            icon: <CreditCard size={22} />,
        },
        {
            label: 'Записей сегодня',
            value: data.appointmentsToday,
            icon: <CalendarDays size={22} />,
        },
        {
            label: 'Клиентов всего',
            value: data.clientsTotal,
            icon: <Users size={22} />,
        },
        {
            label: 'Средний чек',
            value: `${data.averageTicket} MDL`,
            icon: <Wallet size={22} />,
        },
        {
            label: 'Активных сертификатов',
            value: data.activeGiftCards,
            icon: <Gift size={22} />,
        },
        {
            label: 'Активных промокодов',
            value: data.activePromoCodes,
            icon: <Percent size={22} />,
        },
        {
            label: 'Loyalty-клиентов',
            value: data.loyaltyClients,
            icon: <Users size={22} />,
        },
    ];

    return (
        <AppLayout>
            <main className="dashboard-page">
                <header className="dashboard-header">
                    <div>
                        <p className="dashboard-eyebrow">GLAMOUR SALON STUDIO</p>
                        <h1>Панель владельца</h1>
                        <p className="dashboard-subtitle">
                            Финансовые показатели, клиенты и ключевая активность салона.
                        </p>
                    </div>

                    <div className="dashboard-period">
                        <span>Период</span>
                        <strong>Текущий месяц</strong>
                    </div>
                </header>

                <section className="metrics-grid" aria-label="Ключевые показатели">
                    {metrics.map((metric) => (
                        <article className="metric-card" key={metric.label}>
                            <div className="metric-icon">{metric.icon}</div>
                            <p>{metric.label}</p>
                            <strong>{metric.value}</strong>
                        </article>
                    ))}
                </section>

                <section className="dashboard-columns">
                    <article className="dashboard-panel">
                        <div className="panel-heading">
                            <div>
                                <p className="panel-kicker">ВЫРУЧКА</p>
                                <h2>Топ мастера</h2>
                            </div>
                            <Scissors size={22} />
                        </div>

                        {data.topMasters.length === 0 ? (
                            <p className="empty-state">Пока нет данных по мастерам.</p>
                        ) : (
                            <div className="ranking-list">
                                {data.topMasters.map((master, index) => (
                                    <div className="ranking-row" key={master.masterProfileId}>
                                        <span className="ranking-number">{index + 1}</span>

                                        <div className="ranking-main">
                                            <strong>{master.profession}</strong>
                                            <span>{master.salonName}</span>
                                        </div>

                                        <div className="ranking-value">
                                            <strong>{master.revenue} MDL</strong>
                                            <span>{master.paymentsCount} платёж</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </article>

                    <article className="dashboard-panel">
                        <div className="panel-heading">
                            <div>
                                <p className="panel-kicker">УСЛУГИ</p>
                                <h2>Топ услуг</h2>
                            </div>
                            <Scissors size={22} />
                        </div>

                        {data.topServices.length === 0 ? (
                            <p className="empty-state">Пока нет данных по услугам.</p>
                        ) : (
                            <div className="ranking-list">
                                {data.topServices.map((service, index) => (
                                    <div className="ranking-row" key={service.serviceId}>
                                        <span className="ranking-number">{index + 1}</span>

                                        <div className="ranking-main">
                                            <strong>{service.name}</strong>
                                            <span>
                                                {service.durationMinutes} мин · базовая цена{' '}
                                                {service.basePrice} MDL
                                            </span>
                                        </div>

                                        <div className="ranking-value">
                                            <strong>{service.revenue} MDL</strong>
                                            <span>{service.bookingsCount} записи</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </article>
                </section>
            </main>
        </AppLayout>
    );
}

export default OwnerDashboardPage;