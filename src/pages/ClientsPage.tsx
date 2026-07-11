import { useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import api from '../api/api';
import AppLayout from '../components/AppLayout';

type Client = {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
};

function ClientsPage() {
    const [clients, setClients] = useState<Client[]>([]);
    const [message, setMessage] = useState('Загрузка клиентов...');

    useEffect(() => {
        async function loadClients() {
            try {
                const response = await api.get<Client[]>('/users');
                setClients(response.data);
                setMessage('');
            } catch {
                setMessage('Не удалось загрузить клиентов.');
            }
        }

        loadClients();
    }, []);

    return (
        <AppLayout>
            <main className="dashboard-page">
                <header className="dashboard-header">
                    <div>
                        <p className="dashboard-eyebrow">КЛИЕНТЫ</p>
                        <h1>Клиенты салона</h1>
                        <p className="dashboard-subtitle">
                            Все зарегистрированные клиенты GLAMOUR Salon Studio.
                        </p>
                    </div>
                </header>

                {message ? (
                    <p className="dashboard-status">{message}</p>
                ) : (
                    <section className="dashboard-panel">
                        <div className="panel-heading">
                            <div>
                                <p className="panel-kicker">СПИСОК</p>
                                <h2>{clients.length} клиентов</h2>
                            </div>

                            <Users size={22} />
                        </div>

                        <div className="ranking-list">
                            {clients.map((client, index) => (
                                <div className="ranking-row" key={client.id}>
                                    <span className="ranking-number">{index + 1}</span>

                                    <div className="ranking-main">
                                        <strong>
                                            {client.firstName} {client.lastName}
                                        </strong>

                                        <span>{client.email}</span>
                                    </div>

                                    <div className="ranking-value">
                                        <strong>{client.phone}</strong>
                                        <span>{client.id.slice(0, 8)}</span>
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

export default ClientsPage;