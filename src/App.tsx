import { useEffect, useState } from 'react';
import api from './api/api';
import LoginPage from './pages/LoginPage';
import SalonRegistrationPage from './pages/SalonRegistrationPage';
import PublicMasterRegistrationPage from './pages/PublicMasterRegistrationPage';
import PublicBookingPage from './pages/PublicBookingPage';
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
import MasterProfilePage from './pages/MasterProfilePage';
import MasterSchedulePage from './pages/MasterSchedulePage';
import MasterCalendarPage from './pages/MasterCalendarPage';
import PromotionLinksPage from './pages/PromotionLinksPage';
import PublicMasterPage from './pages/PublicMasterPage';
import ClientCabinetPage from './pages/ClientCabinetPage';
import LoyaltyPage from './pages/LoyaltyPage';
import SalonInfoPage from './pages/SalonInfoPage';
import SalonReviewsPage from './pages/SalonReviewsPage';
import MasterReviewsPage from './pages/MasterReviewsPage';
import ChatPage from './pages/ChatPage';

import './App.css';
import './mobile.css';

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

  const [userRole, setUserRole] = useState<string>('');

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
        setUserRole(response.data.user?.role ?? '');

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

  // Сброс пароля ловим и по пути (/reset-password?token=...),
  // и по хешу (#reset-password?token=...).
  // Путь надёжнее: почтовые клиенты теряют фрагмент после # при редиректе.
  if (
    currentPage.startsWith('#reset-password') ||
    window.location.pathname.startsWith('/reset-password')
  ) {
    return <ResetPasswordPage />;
  }

  // Постоянная витрина мастера: адрес не меняется,
  // содержимое обновляется вслед за «Обо мне».
  if (currentPage.startsWith('#master/')) {
    return <PublicMasterPage />;
  }

  if (currentPage.startsWith('#register?')) {
    return <SalonRegistrationPage />;
  }

  if (
    currentPage === '#book' ||
    currentPage.startsWith('#book?')
  ) {
    return <PublicBookingPage />;
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

  // Общение одинаково для салона, мастера и клиента, поэтому
  // ловим адрес до развилки: клиент до разбора адреса ниже
  // просто не доходит — его сразу уводят в кабинет.
  if (currentPage === '#chat') {
    return <ChatPage />;
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

      case '#loyalty':
        return <LoyaltyPage />;
      case '#payment-settings':
        return <MasterPaymentPage />;
      case '#my-profile':
        return <MasterProfilePage />;
      case '#schedule':
        return <MasterCalendarPage />;
      case '#schedule-template':
        return <MasterSchedulePage />;
      case '#reviews':
        return <MasterReviewsPage />;

      default:
        return <MasterDashboardPage />;
    }
  }

  // Клиент не имеет отношения к кабинету салона: у него свой раздел
  // со своими записями. Раньше он проваливался в интерфейс салона.
  if (userRole === 'client') {
    return <ClientCabinetPage />;
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

      case '#salon-info':
      return <SalonInfoPage />;

    case '#reviews':
      return <SalonReviewsPage />;

    case '#branding':
      return <BrandingPage />;

    default:
      return <OwnerDashboardPage />;
  }
}

export default App;
