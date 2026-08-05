import { useEffect, useState } from 'react';
import api from './api/api';
import LoginPage from './pages/LoginPage';
import SalonRegistrationPage from './pages/SalonRegistrationPage';
import PublicMasterRegistrationPage from './pages/PublicMasterRegistrationPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import PlatformOwnerPage from './pages/PlatformOwnerPage';
import OwnerDashboardPage from './pages/OwnerDashboardPage';
import MasterDashboardPage from './pages/MasterDashboardPage';
import AppointmentsPage from './pages/AppointmentsPage';
import ClientsPage from './pages/ClientsPage';
import MastersPage from './pages/MastersPage';
import ServicesPage from './pages/ServicesPage';
import FinancePage from './pages/FinancePage';
import BrandingPage from './pages/BrandingPage';
import MasterPaymentPage from './pages/MasterPaymentPage';
import PromotionLinksPage from './pages/PromotionLinksPage';
import './App.css';

type PlatformRole = 'platform_owner' | null;

type LoginSession = {
  platformRole: PlatformRole;
};

type AuthSessionResponse = {
  authenticated: boolean;
  platformRole: PlatformRole;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
    platformRole: PlatformRole;
  };
  salonMemberships: Array<{
    id: string;
    salonId: string;
    status: string;
    roles: Array<{
      id: string;
      role: string;
      cooperationType: string | null;
      isPrimaryWorkplace: boolean;
      acceptsBookingsAtSalon: boolean;
    }>;
  }>;
};

const TOKEN_STORAGE_KEY = 'glamour_access_token';
const WORKSPACE_MODE_KEY = 'glamour_workspace_mode';
const CURRENT_SALON_ID_KEY = 'glamour_current_salon_id';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(
    Boolean(localStorage.getItem(TOKEN_STORAGE_KEY)),
  );

  const [platformRole, setPlatformRole] =
    useState<PlatformRole>(null);

  const [isSessionLoading, setIsSessionLoading] = useState(
    Boolean(localStorage.getItem(TOKEN_STORAGE_KEY)),
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
      setIsSessionLoading(false);
      return;
    }

    let isCancelled = false;

    async function loadSession() {
      setIsSessionLoading(true);

      try {
        const response =
          await api.get<AuthSessionResponse>('/auth/session');

        if (isCancelled) {
          return;
        }

        setPlatformRole(response.data.platformRole);

        const savedWorkspaceMode =
          localStorage.getItem(WORKSPACE_MODE_KEY);

        if (
          response.data.platformRole !== 'platform_owner' &&
          savedWorkspaceMode !== 'salon' &&
          savedWorkspaceMode !== 'master'
        ) {
          localStorage.setItem(WORKSPACE_MODE_KEY, 'salon');
        }

        const masterMemberships =
          response.data.salonMemberships.filter(
            (membership) =>
              membership.status === 'active' &&
              membership.roles.some(
                (role) => role.role === 'master',
              ),
          );

        const savedCurrentSalonId =
          localStorage.getItem(CURRENT_SALON_ID_KEY);

        const savedMasterMembership =
          savedCurrentSalonId
            ? masterMemberships.find(
                (membership) =>
                  membership.salonId ===
                  savedCurrentSalonId,
              )
            : undefined;

        if (!savedMasterMembership) {
          const primaryMasterMembership =
            masterMemberships.find(
              (membership) =>
                membership.roles.some(
                  (role) =>
                    role.role === 'master' &&
                    role.isPrimaryWorkplace,
                ),
            );

          const fallbackMasterMembership =
            primaryMasterMembership ??
            masterMemberships[0];

          if (fallbackMasterMembership) {
            localStorage.setItem(
              CURRENT_SALON_ID_KEY,
              fallbackMasterMembership.salonId,
            );
          } else {
            localStorage.removeItem(
              CURRENT_SALON_ID_KEY,
            );
          }
        }
      } catch {
        if (isCancelled) {
          return;
        }

        setPlatformRole(null);

        if (!localStorage.getItem(TOKEN_STORAGE_KEY)) {
          setIsAuthenticated(false);
        }
      } finally {
        if (!isCancelled) {
          setIsSessionLoading(false);
        }
      }
    }

    void loadSession();

    return () => {
      isCancelled = true;
    };
  }, [isAuthenticated]);

  function handleLoginSuccess(session: LoginSession) {
    setPlatformRole(session.platformRole);
    setIsAuthenticated(true);

    if (session.platformRole === 'platform_owner') {
      localStorage.setItem(WORKSPACE_MODE_KEY, 'platform');
    } else {
      localStorage.setItem(WORKSPACE_MODE_KEY, 'salon');
    }
  }

  if (currentPage.startsWith('#reset-password')) {
    return <ResetPasswordPage />;
  }

  if (currentPage.startsWith('#register?')) {
    return <SalonRegistrationPage />;
  }

  if (
    currentPage === '#master-register' ||
    currentPage.startsWith('#master-register?') ||
    currentPage === '#register-master' ||
    currentPage.startsWith('#register-master?') ||
    currentPage === '#master-registration' ||
    currentPage.startsWith('#master-registration?')
  ) {
    return <PublicMasterRegistrationPage />;
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

  if (workspaceMode === 'master') {
    switch (currentPage) {
      case '#appointments':
        return <AppointmentsPage />;

      case '#clients':
        return <ClientsPage />;

      case '#services':
        return <ServicesPage />;

      case '#finance':
        return <FinancePage />;

      case '#payment-settings':
        return <MasterPaymentPage />;

      default:
        return <MasterDashboardPage />;
    }
  }

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

    case '#promotion-links':
        return <PromotionLinksPage />;

      case '#branding':
      return <BrandingPage />;

    default:
      return <OwnerDashboardPage />;
  }
}

export default App;
