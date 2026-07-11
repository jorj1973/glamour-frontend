import { useEffect, useState } from 'react';
import { Scissors } from 'lucide-react';
import api from '../api/api';
import AppLayout from '../components/AppLayout';

type Master = {
    id: string;
    userId?: string;
    photoUrl?: string | null;
    profession?: string | null;
    bio?: string | null;
    experienceYears?: number | null;
    city?: string | null;
    salonName?: string | null;
    isPublic?: boolean;
    averageRating?: number | null;
};

function MastersPage() {
    const [masters, setMasters] = useState<Master[]>([]);
    const [message, setMessage] = useState('Загрузка мастеров...');

    useEffect(() => {
        async function loadMasters() {
            try {
                const response = await api.get<Master[]>('/masters');
                setMasters(response.data);
                setMessage('');
            } catch {
                setMessage('Не удалось загрузить список мастеров.');
            }
        }

        loadMasters();
    }, []);

    return (
        <AppLayout>
            <main className="dashboard-page">
                <header className="dashboard-header">
                    <div>
                        <p className="dashboard-eyebrow">МАСТЕРА</p>
                        <h1>Команда салона</h1>
                        <p className="dashboard-subtitle">
                            Все мастера, зарегистрированные в системе.
                        </p>
                    </div>
                </header>

                {message ? (
                    <p className="dashboard-status">{message}</p>
                ) : (
                    <section className="dashboard-panel">
                        <div className="panel-heading">
                            <div>
                                <p className="panel-kicker">КОМАНДА</p>
                                <h2>{masters.length} мастеров</h2>
                            </div>

                            <Scissors size={22} />
                        </div>

                        <div className="ranking-list">
                            {masters.map((master, index) => {
                                const rating =
                                    typeof master.averageRating === 'number'
                                        ? `${master.averageRating.toFixed(1)} ★`
                                        : 'Нет рейтинга';

                                const experience =
                                    typeof master.experienceYears === 'number'
                                        ? `${master.experienceYears} лет опыта`
                                        : 'Опыт не указан';

                                return (
                                    <div className="ranking-row" key={master.id}>
                                        <span className="ranking-number">{index + 1}</span>

                                        <div className="ranking-main">
                                            <strong>{master.profession || 'Профессия не указана'}</strong>
                                            <span>{master.salonName || 'Салон не указан'}</span>
                                            {master.city ? <span>{master.city}</span> : null}
                                        </div>

                                        <div className="ranking-value">
                                            <strong>{rating}</strong>
                                            <span>{experience}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                )}
            </main>
        </AppLayout>
    );
}

export default MastersPage;