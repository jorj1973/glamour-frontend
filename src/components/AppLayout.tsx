import { useEffect, useState } from 'react';
import {
    BarChart3,
    CalendarDays,
    CreditCard,
    Scissors,
    Sparkles,
    Users,
} from 'lucide-react';

type AppLayoutProps = {
    children: React.ReactNode;
};

function AppLayout({ children }: AppLayoutProps) {
    const [currentHash, setCurrentHash] = useState(window.location.hash);

    useEffect(() => {
        function handleHashChange() {
            setCurrentHash(window.location.hash);
        }

        window.addEventListener('hashchange', handleHashChange);

        return () => {
            window.removeEventListener('hashchange', handleHashChange);
        };
    }, []);

    return (
        <div className="app-shell">
            <aside className="sidebar">
                <div className="sidebar-brand">
                    <span>GLAMOUR</span>
                    <strong>Salon Studio</strong>
                </div>

                <nav className="sidebar-nav">
                    <a
                        className={
                            currentHash !== '#appointments' &&
                                currentHash !== '#clients' &&
                                currentHash !== '#masters' &&
                                currentHash !== '#services' &&
                                currentHash !== '#finance'
                                ? 'active'
                                : ''
                        }
                        href="#"
                    >
                        <BarChart3 size={18} />
                        Dashboard
                    </a>

                    <a
                        className={currentHash === '#appointments' ? 'active' : ''}
                        href="#appointments"
                    >
                        <CalendarDays size={18} />
                        Записи
                    </a>

                    <a
                        className={currentHash === '#clients' ? 'active' : ''}
                        href="#clients"
                    >
                        <Users size={18} />
                        Клиенты
                    </a>

                    <a
                        className={currentHash === '#masters' ? 'active' : ''}
                        href="#masters"
                    >
                        <Scissors size={18} />
                        Мастера
                    </a>

                    <a
                        className={currentHash === '#services' ? 'active' : ''}
                        href="#services"
                    >
                        <Sparkles size={18} />
                        Услуги
                    </a>

                    <a
                        className={currentHash === '#finance' ? 'active' : ''}
                        href="#finance"
                    >
                        <CreditCard size={18} />
                        Финансы
                    </a>
                </nav>
            </aside>

            <div className="app-content">
                {children}
            </div>
        </div>
    );
}

export default AppLayout;