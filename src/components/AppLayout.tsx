import {
  useCallback,
  useEffect,
  useState,
} from 'react';
import {
  BarChart3,
  Building2,
  CalendarDays,
  CreditCard,
  Palette,
  Scissors,
  Sparkles,
  UserRound,
  Users,
} from 'lucide-react';

import api from '../api/api';

type AppLayoutProps = {
  children: React.ReactNode;
};

type WorkspaceMode = 'platform' | 'salon' | 'master';

type SalonSummary = {
  id: string;
  name: string;
};

type SalonBranding = {
  displayName: string | null;
  logoUrl: string | null;
};

type AuthSessionResponse = {
  authenticated: boolean;
  platformRole: 'platform_owner' | null;
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

const BRANDING_UPDATED_EVENT =
  'glamour-branding-updated';

const WORKSPACE_MODE_KEY =
  'glamour_workspace_mode';

const SALON_MANAGEMENT_ROLES = new Set([
  'salon_owner',
  'owner',
  'admin',
  'administrator',
  'reception',
]);

function getSavedWorkspaceMode(): WorkspaceMode {
  const savedMode = localStorage.getItem(
    WORKSPACE_MODE_KEY,
  );

  if (
    savedMode === 'platform' ||
    savedMode === 'salon' ||
    savedMode === 'master'
  ) {
    return savedMode;
  }

  return 'salon';
}

function AppLayout({ children }: AppLayoutProps) {
  const [currentHash, setCurrentHash] = useState(
    window.location.hash,
  );

  const [workspaceMode, setWorkspaceMode] =
    useState<WorkspaceMode>(getSavedWorkspaceMode);

  const [salonName, setSalonName] =
    useState('Salon Studio');

  const [logoUrl, setLogoUrl] =
    useState<string | null>(null);

  const [canOpenPlatform, setCanOpenPlatform] =
    useState(false);

  const [canOpenSalon, setCanOpenSalon] =
    useState(false);

  const [canOpenMaster, setCanOpenMaster] =
    useState(false);

  const loadSalonBranding = useCallback(async () => {
    try {
      const salonsResponse =
        await api.get<SalonSummary[]>('/salons/my');

      const currentSalon = salonsResponse.data[0];

      if (!currentSalon) {
        setSalonName('Salon Studio');
        setLogoUrl(null);
        return;
      }

      const brandingResponse =
        await api.get<SalonBranding>(
          `/salons/${currentSalon.id}/branding`,
        );

      setSalonName(
        brandingResponse.data.displayName?.trim() ||
          currentSalon.name ||
          'Salon Studio',
      );

      setLogoUrl(brandingResponse.data.logoUrl);
    } catch {
      setSalonName('Salon Studio');
      setLogoUrl(null);
    }
  }, []);

  const loadWorkspaceAccess =
    useCallback(async () => {
      try {
        const response =
          await api.get<AuthSessionResponse>(
            '/auth/session',
          );

        const activeMemberships =
          response.data.salonMemberships.filter(
            (membership) =>
              membership.status === 'active',
          );

        const roles = activeMemberships.flatMap(
          (membership) =>
            membership.roles.map((role) => role.role),
        );

        const hasSalonAccess = roles.some((role) =>
          SALON_MANAGEMENT_ROLES.has(role),
        );

        const hasMasterAccess =
          roles.includes('master');

        const hasPlatformAccess =
          response.data.platformRole ===
          'platform_owner';

        setCanOpenPlatform(hasPlatformAccess);
        setCanOpenSalon(hasSalonAccess);
        setCanOpenMaster(hasMasterAccess);

        const savedMode = getSavedWorkspaceMode();

        if (
          savedMode === 'platform' &&
          !hasPlatformAccess
        ) {
          const fallbackMode: WorkspaceMode =
            hasSalonAccess
              ? 'salon'
              : hasMasterAccess
                ? 'master'
                : 'salon';

          localStorage.setItem(
            WORKSPACE_MODE_KEY,
            fallbackMode,
          );

          setWorkspaceMode(fallbackMode);
        }

        if (
          savedMode === 'salon' &&
          !hasSalonAccess &&
          hasMasterAccess
        ) {
          localStorage.setItem(
            WORKSPACE_MODE_KEY,
            'master',
          );

          setWorkspaceMode('master');
        }

        if (
          savedMode === 'master' &&
          !hasMasterAccess &&
          hasSalonAccess
        ) {
          localStorage.setItem(
            WORKSPACE_MODE_KEY,
            'salon',
          );

          setWorkspaceMode('salon');
        }
      } catch {
        setCanOpenPlatform(false);
        setCanOpenSalon(
          workspaceMode === 'salon',
        );
        setCanOpenMaster(
          workspaceMode === 'master',
        );
      }
    }, [workspaceMode]);

  useEffect(() => {
    function handleHashChange() {
      setCurrentHash(window.location.hash);
    }

    function handleBrandingUpdated() {
      void loadSalonBranding();
    }

    window.addEventListener(
      'hashchange',
      handleHashChange,
    );

    window.addEventListener(
      BRANDING_UPDATED_EVENT,
      handleBrandingUpdated,
    );

    const initialLoadTimer = window.setTimeout(
      () => {
        void loadSalonBranding();
        void loadWorkspaceAccess();
      },
      0,
    );

    return () => {
      window.clearTimeout(initialLoadTimer);

      window.removeEventListener(
        'hashchange',
        handleHashChange,
      );

      window.removeEventListener(
        BRANDING_UPDATED_EVENT,
        handleBrandingUpdated,
      );
    };
  }, [
    loadSalonBranding,
    loadWorkspaceAccess,
  ]);

  function switchWorkspace(
    nextMode: WorkspaceMode,
  ) {
    if (
      (nextMode === 'platform' &&
        !canOpenPlatform) ||
      (nextMode === 'salon' && !canOpenSalon) ||
      (nextMode === 'master' && !canOpenMaster)
    ) {
      return;
    }

    localStorage.setItem(
      WORKSPACE_MODE_KEY,
      nextMode,
    );

    setWorkspaceMode(nextMode);
    window.location.hash = '';
    window.location.reload();
  }

  const isMasterWorkspace =
    workspaceMode === 'master';

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          {logoUrl ? (
            <img
              className="sidebar-brand-logo"
              src={logoUrl}
              alt={`Логотип ${salonName}`}
            />
          ) : (
            <span>GLAMOUR</span>
          )}

          <strong>{salonName}</strong>
        </div>

        <section
          className="workspace-switcher"
          aria-label="Выбор рабочего пространства"
        >
          <span className="workspace-switcher-label">
            Рабочее пространство
          </span>

          <div className="workspace-switcher-options">
            {canOpenPlatform ? (
              <button
                type="button"
                className={
                  workspaceMode === 'platform'
                    ? 'workspace-switcher-button active'
                    : 'workspace-switcher-button'
                }
                onClick={() =>
                  switchWorkspace('platform')
                }
              >
                <BarChart3
                  size={17}
                  aria-hidden="true"
                />
                <span>Платформа</span>
              </button>
            ) : null}

            {canOpenSalon ? (
              <button
                type="button"
                className={
                  workspaceMode === 'salon'
                    ? 'workspace-switcher-button active'
                    : 'workspace-switcher-button'
                }
                onClick={() =>
                  switchWorkspace('salon')
                }
              >
                <Building2
                  size={17}
                  aria-hidden="true"
                />
                <span>Салон</span>
              </button>
            ) : null}

            {canOpenMaster ? (
              <button
                type="button"
                className={
                  workspaceMode === 'master'
                    ? 'workspace-switcher-button active'
                    : 'workspace-switcher-button'
                }
                onClick={() =>
                  switchWorkspace('master')
                }
              >
                <UserRound
                  size={17}
                  aria-hidden="true"
                />
                <span>Мой кабинет мастера</span>
              </button>
            ) : null}
          </div>
        </section>

        <nav className="sidebar-nav">
          <a
            className={
              currentHash === '' ||
              currentHash === '#'
                ? 'active'
                : ''
            }
            href="#"
          >
            <BarChart3 size={18} />
            Dashboard
          </a>

          {isMasterWorkspace ? (
            <>
              <a
                className={
                  currentHash === '#appointments'
                    ? 'active'
                    : ''
                }
                href="#appointments"
              >
                <CalendarDays size={18} />
                Мои записи
              </a>

              <a
                className={
                  currentHash === '#clients'
                    ? 'active'
                    : ''
                }
                href="#clients"
              >
                <Users size={18} />
                Мои клиенты
              </a>

              <a
                className={
                  currentHash === '#services'
                    ? 'active'
                    : ''
                }
                href="#services"
              >
                <Sparkles size={18} />
                Мои услуги
              </a>

              <a
                className={
                  currentHash === '#finance'
                    ? 'active'
                    : ''
                }
                href="#finance"
              >
                <CreditCard size={18} />
                Мои доходы
              </a>
            </>
          ) : (
            <>
              <a
                className={
                  currentHash === '#appointments'
                    ? 'active'
                    : ''
                }
                href="#appointments"
              >
                <CalendarDays size={18} />
                Записи
              </a>

              <a
                className={
                  currentHash === '#clients'
                    ? 'active'
                    : ''
                }
                href="#clients"
              >
                <Users size={18} />
                Клиенты
              </a>

              <a
                className={
                  currentHash === '#masters'
                    ? 'active'
                    : ''
                }
                href="#masters"
              >
                <Scissors size={18} />
                Мастера
              </a>

              <a
                className={
                  currentHash === '#services'
                    ? 'active'
                    : ''
                }
                href="#services"
              >
                <Sparkles size={18} />
                Услуги
              </a>

              <a
                className={
                  currentHash === '#finance'
                    ? 'active'
                    : ''
                }
                href="#finance"
              >
                <CreditCard size={18} />
                Финансы
              </a>

              <a
                className={
                  currentHash === '#branding'
                    ? 'active'
                    : ''
                }
                href="#branding"
              >
                <Palette size={18} />
                Персонализация
              </a>
            </>
          )}
        </nav>
      </aside>

      <div className="app-content">
        {children}
      </div>
    </div>
  );
}

export default AppLayout;
