import {
  useCallback,
  useEffect,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
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
  Link2,
} from 'lucide-react';

import api from '../api/api';
import LanguageSwitcher from './LanguageSwitcher';

type AppLayoutProps = {
  children: React.ReactNode;
};

type WorkspaceMode = 'platform' | 'salon' | 'master';

type SalonSummary = {
  id: string;
  name: string;
  membershipRole?: string | null;
  membershipRoles?: string[];
  membershipStatus?: string | null;
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

const CURRENT_SALON_ID_KEY =
  'glamour_current_salon_id';

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
  const { t } = useTranslation();
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

  const [masterSalons, setMasterSalons] =
    useState<SalonSummary[]>([]);

  const [currentSalonId, setCurrentSalonId] =
    useState(
      () =>
        localStorage.getItem(
          CURRENT_SALON_ID_KEY,
        ) ?? '',
    );

  const loadSalonBranding = useCallback(async () => {
    try {
      const salonsResponse =
        await api.get<SalonSummary[]>('/salons/my');

      const savedCurrentSalonId =
        localStorage.getItem(CURRENT_SALON_ID_KEY);

      const currentSalon =
        (savedCurrentSalonId
          ? salonsResponse.data.find(
              (salon) =>
                salon.id === savedCurrentSalonId,
            )
          : undefined) ??
        salonsResponse.data[0];

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

        const salonsResponse =
          await api.get<SalonSummary[]>('/salons/my');

        const availableMasterSalons =
          salonsResponse.data.filter(
            (salon) =>
              salon.membershipStatus === 'active' &&
              (
                salon.membershipRoles?.includes(
                  'master',
                ) ||
                salon.membershipRole === 'master'
              ),
          );

        setMasterSalons(availableMasterSalons);

        const savedCurrentSalonId =
          localStorage.getItem(
            CURRENT_SALON_ID_KEY,
          );

        const savedMasterSalon =
          savedCurrentSalonId
            ? availableMasterSalons.find(
                (salon) =>
                  salon.id === savedCurrentSalonId,
              )
            : undefined;

        const primaryMasterMembership =
          activeMemberships.find(
            (membership) =>
              membership.roles.some(
                (role) =>
                  role.role === 'master' &&
                  role.isPrimaryWorkplace,
              ),
          );

        const primaryMasterSalon =
          primaryMasterMembership
            ? availableMasterSalons.find(
                (salon) =>
                  salon.id ===
                  primaryMasterMembership.salonId,
              )
            : undefined;

        const resolvedMasterSalon =
          savedMasterSalon ??
          primaryMasterSalon ??
          availableMasterSalons[0];

        if (resolvedMasterSalon) {
          localStorage.setItem(
            CURRENT_SALON_ID_KEY,
            resolvedMasterSalon.id,
          );

          setCurrentSalonId(
            resolvedMasterSalon.id,
          );
        } else {
          localStorage.removeItem(
            CURRENT_SALON_ID_KEY,
          );

          setCurrentSalonId('');
        }

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

  function switchMasterSalon(
    nextSalonId: string,
  ) {
    if (
      !nextSalonId ||
      !masterSalons.some(
        (salon) => salon.id === nextSalonId,
      )
    ) {
      return;
    }

    localStorage.setItem(
      CURRENT_SALON_ID_KEY,
      nextSalonId,
    );

    setCurrentSalonId(nextSalonId);

    window.location.reload();
  }

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
                <span>{t('nav.platform')}</span>
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
                <span>{t('nav.salon')}</span>
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
                <span>{t('nav.masterCabinet')}</span>
              </button>
            ) : null}
          </div>
        </section>

        {isMasterWorkspace &&
        masterSalons.length > 0 ? (
          <section
            className="workspace-switcher"
            aria-label="Выбор салона мастера"
          >
            <span className="workspace-switcher-label">
              Текущий салон
            </span>

            <select
              className="workspace-salon-select"
              value={currentSalonId}
              onChange={(event) =>
                switchMasterSalon(
                  event.target.value,
                )
              }
              aria-label="Текущий салон мастера"
            >
              {masterSalons.map((salon) => (
                <option
                  key={salon.id}
                  value={salon.id}
                >
                  {salon.name}
                </option>
              ))}
            </select>
          </section>
        ) : null}

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
            {t('nav.dashboard')}
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
                {t('nav.myAppointments')}
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
                {t('nav.myClients')}
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
                {t('nav.myServices')}
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
                {t('nav.myFinance')}
              </a>
              <a
                className={
                  currentHash === '#payment-settings'
                    ? 'sidebar-nav-link active'
                    : 'sidebar-nav-link'
                }
                href="#payment-settings"
              >
                <CreditCard size={18} />
                {t('nav.myPayment')}
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
                {t('nav.appointments')}
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
                {t('nav.clients')}
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
                {t('nav.masters')}
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
                {t('nav.services')}
              </a>
              <a
                className={
                  currentHash === '#promotion-links'
                    ? 'sidebar-nav-link active'
                    : 'sidebar-nav-link'
                }
                href="#promotion-links"
              >
                <Link2 size={18} />
                {t('nav.links')}
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
                {t('nav.finance')}
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
                {t('nav.branding')}
              </a>
            </>
          )}
        </nav>
        <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.07)', marginTop: 'auto' }}>
          <LanguageSwitcher />
        </div>
      </aside>

      <div className="app-content">
        {children}
      </div>
    </div>
  );
}

export default AppLayout;
