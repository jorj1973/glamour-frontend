import { useEffect, useState } from 'react';
import LoginPage from './pages/LoginPage';
import OwnerDashboardPage from './pages/OwnerDashboardPage';
import AppointmentsPage from './pages/AppointmentsPage';
import ClientsPage from './pages/ClientsPage';
import MastersPage from './pages/MastersPage';
import ServicesPage from './pages/ServicesPage';
import FinancePage from './pages/FinancePage';
import './App.css';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(
    Boolean(localStorage.getItem('glamour_access_token')),
  );

  const [currentPage, setCurrentPage] = useState(window.location.hash);

  useEffect(() => {
    function handleHashChange() {
      setCurrentPage(window.location.hash);
    }

    window.addEventListener('hashchange', handleHashChange);

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  if (!isAuthenticated) {
    return <LoginPage onLoginSuccess={() => setIsAuthenticated(true)} />;
  }

  switch (currentPage) {
    case '#appointments':
      return <AppointmentsPage />;

    case '#clients':
      return <ClientsPage />;

    case '#masters':
      return <MastersPage />;

    case '#services':
      return <ServicesPage />;

    case '#finance':
      return <FinancePage />;

    default:
      return <OwnerDashboardPage />;
  }
}

export default App;