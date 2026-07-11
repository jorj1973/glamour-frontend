import { useEffect, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import api from '../api/api';
import AppLayout from '../components/AppLayout';

type Appointment = {
    id: string;
    clientUserId: string;
    masterProfileId: string;
    masterServiceId: string;
    startTime: string;
    endTime: string;
    status: string;
    clientComment?: string;
    internalNote?: string;
    createdAt: string;
};

function AppointmentsPage() {
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [message, setMessage] = useState('Загрузка записей…');

    useEffect(() => {
        async function loadAppointments() {
            try {
                const response = await api.get<Appointment[]>('/appointments');
                setAppointments(response.data);
                setMessage('');
            } catch {
                setMessage('Не удалось загрузить записи.');
            }
        }

        loadAppointments();
    }, []);

    return (
        <AppLayout>
            <main className="dashboard-page">
                <header className="dashboard-header">
                    <div>
                        <p className="dashboard-eyebrow">ЗАПИСИ</p>
                        <h1>Записи клиентов</h1>
                        <p className="dashboard-subtitle">
                            Список записей салона, статусы и время посещения.
                        </p>
                    </div>
                </header>

                {message ? (
                    <p className="dashboard-status">{message}</p>
                ) : (
                    <section className="dashboard-panel">
                        <div className="panel-heading">
                            <div>
                                <p className="panel-kicker">ВСЕ ЗАПИСИ</p>
                                <h2>{appointments.length} записей</h2>
                            </div>
                            <CalendarDays size={22} />
                        </div>

                        <div className="ranking-list">
                            {appointments.map((appointment) => (
                                <div className="ranking-row" key={appointment.id}>
                                    <span className="ranking-number">•</span>

                                    <div className="ranking-main">
                                        <strong>{appointment.status}</strong>
                                        <span>
                                            {new Date(appointment.startTime).toLocaleString('ru-RU')} —{' '}
                                            {new Date(appointment.endTime).toLocaleTimeString('ru-RU')}
                                        </span>
                                        {appointment.clientComment ? (
                                            <span>{appointment.clientComment}</span>
                                        ) : null}
                                    </div>

                                    <div className="ranking-value">
                                        <strong>ID</strong>
                                        <span>{appointment.id.slice(0, 8)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}
            </main>
        </AppLayout>
    );
}

export default AppointmentsPage;