import { useEffect, useState } from 'react';
import { CreditCard, Gift, Wallet } from 'lucide-react';
import api from '../api/api';
import AppLayout from '../components/AppLayout';

type Payment = {
    id: string;
    appointmentId: string;
    clientUserId: string;
    masterProfileId: string;
    amount: string;
    status: string;
    paymentMethod: string;
    transactionId: string | null;
    note: string | null;
    createdAt: string;
    updatedAt: string;
};

type PaymentsDashboard = {
    revenueToday: number;
    revenueMonth: number;
    cashToday: number;
    cardToday: number;
    onlineToday: number;
    giftCardToday: number;
    pendingPayments: number;
    paidPayments: number;
    refundedPayments: number;
    failedPayments: number;
    averageTicket: number;
    paymentsCount: number;
    topPaymentMethod: string | null;
    recentPayments: Payment[];
};

function FinancePage() {
    const [data, setData] = useState<PaymentsDashboard | null>(null);
    const [message, setMessage] = useState('Загрузка финансов...');

    useEffect(() => {
        async function loadFinance() {
            try {
                const response = await api.get<PaymentsDashboard>('/payments/dashboard');
                setData(response.data);
                setMessage('');
            } catch {
                setMessage('Не удалось загрузить финансы.');
            }
        }

        loadFinance();
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
            label: 'Средний чек',
            value: `${data.averageTicket} MDL`,
            icon: <Wallet size={22} />,
        },
        {
            label: 'Всего платежей',
            value: data.paymentsCount,
            icon: <CreditCard size={22} />,
        },
        {
            label: 'Наличные сегодня',
            value: `${data.cashToday} MDL`,
            icon: <Wallet size={22} />,
        },
        {
            label: 'Картой сегодня',
            value: `${data.cardToday} MDL`,
            icon: <CreditCard size={22} />,
        },
        {
            label: 'Онлайн сегодня',
            value: `${data.onlineToday} MDL`,
            icon: <CreditCard size={22} />,
        },
        {
            label: 'Сертификаты сегодня',
            value: `${data.giftCardToday} MDL`,
            icon: <Gift size={22} />,
        },
    ];

    return (
        <AppLayout>
            <main className="dashboard-page">
                <header className="dashboard-header">
                    <div>
                        <p className="dashboard-eyebrow">ФИНАНСЫ</p>
                        <h1>Финансовая панель</h1>
                        <p className="dashboard-subtitle">
                            Выручка, платежи, средний чек и последние финансовые операции.
                        </p>
                    </div>

                    <div className="dashboard-period">
                        <span>Период</span>
                        <strong>Сегодня / месяц</strong>
                    </div>
                </header>

                <section className="metrics-grid" aria-label="Финансовые показатели">
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
                                <p className="panel-kicker">СТАТУСЫ</p>
                                <h2>Платежи</h2>
                            </div>
                            <CreditCard size={22} />
                        </div>

                        <div className="ranking-list">
                            <div className="ranking-row">
                                <span className="ranking-number">✓</span>
                                <div className="ranking-main">
                                    <strong>Оплачено</strong>
                                    <span>Успешные платежи</span>
                                </div>
                                <div className="ranking-value">
                                    <strong>{data.paidPayments}</strong>
                                    <span>paid</span>
                                </div>
                            </div>

                            <div className="ranking-row">
                                <span className="ranking-number">•</span>
                                <div className="ranking-main">
                                    <strong>Ожидают оплаты</strong>
                                    <span>Платежи в ожидании</span>
                                </div>
                                <div className="ranking-value">
                                    <strong>{data.pendingPayments}</strong>
                                    <span>pending</span>
                                </div>
                            </div>

                            <div className="ranking-row">
                                <span className="ranking-number">↩</span>
                                <div className="ranking-main">
                                    <strong>Возвраты</strong>
                                    <span>Возвращённые платежи</span>
                                </div>
                                <div className="ranking-value">
                                    <strong>{data.refundedPayments}</strong>
                                    <span>refunded</span>
                                </div>
                            </div>

                            <div className="ranking-row">
                                <span className="ranking-number">!</span>
                                <div className="ranking-main">
                                    <strong>Ошибки</strong>
                                    <span>Неуспешные платежи</span>
                                </div>
                                <div className="ranking-value">
                                    <strong>{data.failedPayments}</strong>
                                    <span>failed</span>
                                </div>
                            </div>
                        </div>
                    </article>

                    <article className="dashboard-panel">
                        <div className="panel-heading">
                            <div>
                                <p className="panel-kicker">ПОСЛЕДНИЕ</p>
                                <h2>Операции</h2>
                            </div>
                            <Wallet size={22} />
                        </div>

                        {data.recentPayments.length === 0 ? (
                            <p className="empty-state">Пока нет платежей.</p>
                        ) : (
                            <div className="ranking-list">
                                {data.recentPayments.map((payment, index) => (
                                    <div className="ranking-row" key={payment.id}>
                                        <span className="ranking-number">{index + 1}</span>

                                        <div className="ranking-main">
                                            <strong>{Number(payment.amount).toFixed(2)} MDL</strong>
                                            <span>
                                                {payment.paymentMethod} · {payment.status}
                                            </span>
                                            {payment.note ? <span>{payment.note}</span> : null}
                                        </div>

                                        <div className="ranking-value">
                                            <strong>
                                                {new Date(payment.createdAt).toLocaleDateString('ru-RU')}
                                            </strong>
                                            <span>{payment.id.slice(0, 8)}</span>
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

export default FinancePage;