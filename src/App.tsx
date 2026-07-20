import { useEffect, useState } from 'react';
import api from './api/api';
import LoginPage from './pages/LoginPage';
import SalonRegistrationPage from './pages/SalonRegistrationPage';
import PlatformOwnerPage from './pages/PlatformOwnerPage';
import OwnerDashboardPage from './pages/OwnerDashboardPage';
import AppointmentsPage from './pages/AppointmentsPage';
import ClientsPage from './pages/ClientsPage';
import MastersPage from './pages/MastersPage';
import ServicesPage from './pages/ServicesPage';
import FinancePage from './pages/FinancePage';
import BrandingPage from './pages/BrandingPage';
import './App.css';

type PlatformRole = 'platform_owner' | null;

type LoginSession = {
  platformRole: PlatformRole;
};

const WORKSPACE_MODE_KEY = 'glamour_workspace_mode';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(
    Boolean(localStorage.getItem('glamour_access_token')),
  );

  const [platformRole, setPlatformRole] =
    useState<PlatformRole>(null);

  const [isSessionLoading, setIsSessionLoading] = useState(
    Boolean(localStorage.getItem('glamour_access_token')),
  );

  const [currentPage, setCurrentPage] = useState(
    window.location.hash,
  );

  useEffect(() => {
    function handleHashChange() {
      setCurrentPage(window.location.hash);
    }

    window.addEventListener('hashchange', handleHashChange);

    return () => {
      window.removeEventListener(
        'hashchange',
        handleHashChange,
      );
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    let isCancelled = false;

    async function detectPlatformRole() {
      setIsSessionLoading(true);

      try {
        await api.get('/platform-admin/overview');

        if (!isCancelled) {
          setPlatformRole('platform_owner');
        }
      } catch {
        if (!isCancelled) {
          setPlatformRole(null);
        }
      } finally {
        if (!isCancelled) {
          setIsSessionLoading(false);
        }
      }
    }

    void detectPlatformRole();

    return () => {
      isCancelled = true;
    };
  }, [isAuthenticated]);

  function handleLoginSuccess(session: LoginSession) {
    setPlatformRole(session.platformRole);
    setIsAuthenticated(true);

    if (session.platformRole === 'platform_owner') {
      localStorage.setItem(WORKSPACE_MODE_KEY, 'platform');
    }
  }

  if (currentPage.startsWith('#register?')) {
    return <SalonRegistrationPage />;
  }

  if (!isAuthenticated) {
    return (
      <LoginPage onLoginSuccess={handleLoginSuccess} />
    );
  }

  if (isSessionLoading) {
    return (
      <main className="login-page">
        <section className="login-card">
          <p className="dashboard-eyebrow">
            GLAMOUR Salon Studio
          </p>

          <h1>Проверка доступа</h1>

          <p className="login-subtitle">
            Загружается информация об учётной записи…
          </p>
        </section>
      </main>
    );
  }

  const workspaceMode =
    localStorage.getItem(WORKSPACE_MODE_KEY);

  const isSalonWorkspace =
    platformRole !== 'platform_owner' ||
    workspaceMode === 'salon';

  if (
    platformRole === 'platform_owner' &&
    !isSalonWorkspace
  ) {
    return <PlatformOwnerPage />;
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

    case '#branding':
      return <BrandingPage />;

    default:
      return <OwnerDashboardPage />;
  }
}

export default App;
