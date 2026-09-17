import {
  useCallback,
  useEffect,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { MessageCircle,
  Smartphone,
} from 'lucide-react';
import ChatUnreadBadge from './ChatUnreadBadge';
import {
  readCurrentPoint,
  writeCurrentPoint,
} from '../current-point';
import {
  BarChart3,
  Building2,
  CalendarDays,
  CreditCard,
  Info,
  Palette,
  Scissors,
  ScrollText,
  Wallet,
  ShieldCheck,
  Sparkles,
  UserRound,
  Users,
  ChevronLeft,
  Link2,
  Menu,
  Star,
  CalendarRange,
  CalendarCheck,
  Gift,
  ChevronDown,
  Briefcase,
  LifeBuoy,
  HeartHandshake,
  BadgeCheck,
  MessagesSquare,
} from 'lucide-react';

import api from '../api/api';
import LanguageSwitcher from './LanguageSwitcher';
import NotificationBell from './NotificationBell';
import SubscriptionAlarm from './SubscriptionAlarm';
import ThemeSwitcher from '../components/ThemeSwitcher';

/**
 * Разделы кабинета мастера, собранные в группы.
 *
 * Их было тринадцать в один список. Мастер, которая всю жизнь считала в
 * тетради, открывала стену из тринадцати пунктов и закрывала приложение.
 * Возможности не урезаны — сгруппированы: пять входов, внутри всё то же.
 *
 * Группа «Связь» сегодня почти пустая. Так и задумано: в неё лягут
 * каналы уведомлений и поддержка, и место для них уже есть.
 */
const MASTER_GROUPS: {
  key: string;
  label: string;
  items: { hash: string; label: string; icon: React.ReactNode }[];
}[] = [
  {
    key: 'work',
    label: 'nav.groupWork',
    items: [
      {
        hash: '#appointments',
        label: 'nav.myAppointments',
        icon: <CalendarDays size={19} />,
      },
      {
        hash: '#schedule',
        label: 'nav.mySchedule',
        icon: <CalendarRange size={19} />,
      },
      {
        hash: '#schedule-template',
        label: 'nav.scheduleTemplate',
        icon: <CalendarCheck size={19} />,
      },
      {
        hash: '#services',
        label: 'nav.myServices',
        icon: <Sparkles size={19} />,
      },
    ],
  },
  {
    key: 'clients',
    label: 'nav.groupClients',
    items: [
      { hash: '#clients', label: 'nav.myClients', icon: <Users size={19} /> },
      { hash: '#loyalty', label: 'nav.loyalty', icon: <Gift size={19} /> },
      { hash: '#reviews', label: 'nav.reviews', icon: <Star size={19} /> },
    ],
  },
  {
    key: 'money',
    label: 'nav.groupMoney',
    items: [
      { hash: '#finance', label: 'nav.myFinance', icon: <Wallet size={19} /> },
      {
        hash: '#my-payout',
        label: 'nav.myPayout',
        icon: <ScrollText size={19} />,
      },
      {
        hash: '#payment-settings',
        label: 'nav.myPayment',
        icon: <CreditCard size={19} />,
      },
    ],
  },
  {
    key: 'profile',
    label: 'nav.groupProfile',
    items: [
      {
        hash: '#my-profile',
        label: 'nav.myProfile',
        icon: <UserRound size={19} />,
      },
    ],
  },
  {
    key: 'comms',
    label: 'nav.groupComms',
    items: [
      { hash: '#chat', label: 'nav.chat', icon: <MessageCircle size={19} /> },
      {
        hash: '#promotion-links',
        label: 'nav.links',
        icon: <Link2 size={19} />,
      },
      { hash: '#sms', label: 'nav.sms', icon: <Smartphone size={19} /> },
      {
        hash: '#support',
        label: 'nav.support',
        icon: <LifeBuoy size={19} />,
      },
    ],
  },
];

/**
 * Разделы кабинета салона, собранные в группы — тем же способом, что и у
 * мастера.
 *
 * `ownerOnly` повторяет прежние условия: администратор не видит деньги,
 * оформление, SMS, состав администраторов и данные салона. Группа, в
 * которой ему не осталось ни одного пункта, не показывается вовсе.
 */
const SALON_GROUPS: {
  key: string;
  label: string;
  items: {
    hash: string;
    label: string;
    icon: React.ReactNode;
    ownerOnly?: true;
  }[];
}[] = [
  {
    key: 'work',
    label: 'nav.groupWork',
    items: [
      {
        hash: '#appointments',
        label: 'nav.appointments',
        icon: <CalendarDays size={19} />,
      },
      { hash: '#masters', label: 'nav.masters', icon: <Scissors size={19} /> },
      {
        hash: '#services',
        label: 'nav.services',
        icon: <Sparkles size={19} />,
      },
    ],
  },
  {
    key: 'clients',
    label: 'nav.groupClients',
    items: [
      { hash: '#clients', label: 'nav.clients', icon: <Users size={19} /> },
      { hash: '#reviews', label: 'nav.reviews', icon: <Star size={19} /> },
    ],
  },
  {
    key: 'money',
    label: 'nav.groupMoney',
    items: [
      {
        hash: '#finance',
        label: 'nav.finance',
        icon: <CreditCard size={19} />,
        ownerOnly: true,
      },
      {
        hash: '#payouts',
        label: 'nav.payouts',
        icon: <Wallet size={19} />,
        ownerOnly: true,
      },
    ],
  },
  {
    key: 'salon',
    label: 'nav.groupSalon',
    items: [
      {
        hash: '#salon-info',
        label: 'nav.salonInfo',
        icon: <Info size={19} />,
        ownerOnly: true,
      },
      {
        hash: '#branding',
        label: 'nav.branding',
        icon: <Palette size={19} />,
        ownerOnly: true,
      },
      {
        hash: '#administrators',
        label: 'nav.administrators',
        icon: <ShieldCheck size={19} />,
        ownerOnly: true,
      },
      {
        hash: '#action-log',
        label: 'nav.actionLog',
        icon: <ScrollText size={19} />,
      },
    ],
  },
  {
    key: 'comms',
    label: 'nav.groupComms',
    items: [
      { hash: '#chat', label: 'nav.chat', icon: <MessageCircle size={19} /> },
      { hash: '#promotion-links', label: 'nav.links', icon: <Link2 size={19} /> },
      {
        hash: '#sms',
        label: 'nav.sms',
        icon: <Smartphone size={19} />,
        ownerOnly: true,
      },
      { hash: '#support', label: 'nav.support', icon: <LifeBuoy size={19} /> },
    ],
  },
];

const SALON_GROUP_ICON: Record<string, React.ReactNode> = {
  work: <Briefcase size={20} />,
  clients: <HeartHandshake size={20} />,
  money: <Wallet size={20} />,
  salon: <Building2 size={20} />,
  comms: <MessagesSquare size={20} />,
};

const MASTER_GROUP_ICON: Record<string, React.ReactNode> = {
  work: <Briefcase size={20} />,
  clients: <HeartHandshake size={20} />,
  money: <Wallet size={20} />,
  profile: <BadgeCheck size={20} />,
  comms: <MessagesSquare size={20} />,
};

/** Группа, в которой лежит открытый раздел: она и раскрыта при заходе. */
function groupOfHash(
  hash: string,
  groups: { key: string; items: { hash: string }[] }[],
): string {
  const group = groups.find((item) =>
    item.items.some((link) => link.hash === hash),
  );

  return group ? group.key : '';
}

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

// Роли, дающие доступ к управлению салоном.
//
// Значения обязаны совпадать с тем, что реально хранит база:
// salon_memberships_role_enum = ('salon_owner','admin','master','client'),
// users_role_enum = ('platform_owner','owner','admin','master','client').
// Раньше здесь были ещё 'administrator' и 'reception' — таких значений
// enum не допускает, поэтому они никогда не совпадали ни с чем и создавали
// ложное впечатление, что в системе есть роль администратора стойки.
const SALON_MANAGEMENT_ROLES = new Set([
  'salon_owner',
  'owner',
  'admin',
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
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Кнопка «Назад» имеет смысл только если внутри приложения
  // уже был переход — иначе она уведёт с сайта.
  const canGoBack = window.history.length > 1;

  const [currentHash, setCurrentHash] = useState(
    window.location.hash,
  );

  /** Какую группу меню мастер раскрыл руками; 'none' — закрыл все. */
  const [openGroup, setOpenGroup] = useState('');

  const [workspaceMode, setWorkspaceMode] =
    useState<WorkspaceMode>(getSavedWorkspaceMode);

  /** Заполненность салона: 100 означает «подсвечивать не нужно». */
  const [salonPercent, setSalonPercent] = useState(100);

  const [salonName, setSalonName] =
    useState('Salon Studio');

  const [logoUrl, setLogoUrl] =
    useState<string | null>(null);

  const [canOpenPlatform, setCanOpenPlatform] =
    useState(false);

  /**
   * Владелец салона, а не любой управляющий: места администраторов —
   * его дело, администратор себе равных не заводит (ADR-005).
   */
  const [isSalonOwner, setIsSalonOwner] = useState(false);
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

  /**
   * Точки салона и выбранная. Держатся здесь, а не на каждом экране:
   * точка — это «где я», и она не должна сбрасываться при переходе.
   */
  const [points, setPoints] = useState<
    { id: string; name: string; isActive: boolean; isSalon: boolean }[]
  >([]);

  const [currentPointId, setCurrentPointId] = useState(readCurrentPoint);

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

      // Владелец не узнает, что раздел не заполнен, пока сам
      // туда не зайдёт. Подсвечиваем пункт меню.
      try {
        const healthResponse = await api.get<{
          salonHealth?: { percent: number };
        }>('/dashboard/owner', {
          params: {
            salonId: currentSalon.id,
          },
        });

        setSalonPercent(healthResponse.data.salonHealth?.percent ?? 100);
      } catch {
        // Мастер не имеет доступа к сводке владельца — это нормально.
        setSalonPercent(100);
      }

      try {
        const pointsResponse = await api.get<{
          points: {
            id: string;
            name: string;
            isActive: boolean;
            isSalon: boolean;
          }[];
        }>(`/salons/${currentSalon.id}/locations`);

        setPoints(
          pointsResponse.data.points.filter((point) => point.isActive),
        );
      } catch {
        // Мастеру этот список не нужен, а салон без филиалов и
        // переключать нечему.
        setPoints([]);
      }

      setLogoUrl(brandingResponse.data.logoUrl);
    } catch {
      setSalonName('Salon Studio');
      setLogoUrl(null);
    }
  }, []);

  /**
   * Страницы владельца салона. Администратору их не показываем, и если он
   * попал туда по адресу — возвращаем к записям, а не к пустому экрану с
   * ошибкой от сервера.
   */
  useEffect(() => {
    const ownerOnly = new Set([
      '#finance',
      '#salon-info',
      '#branding',
      '#sms',
      '#administrators',
    ]);

    if (
      workspaceMode === 'salon' &&
      !isSalonOwner &&
      canOpenSalon &&
      ownerOnly.has(currentHash)
    ) {
      window.location.hash = '#appointments';
    }
  }, [currentHash, isSalonOwner, canOpenSalon, workspaceMode]);

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
        setIsSalonOwner(roles.includes('salon_owner'));
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
    <div className={isMenuOpen ? 'app-shell sidebar-open' : 'app-shell'}>
      {/* Плавающий колокольчик: виден на всех страницах,
          включая телефон, где меню скрыто. */}
      <NotificationBell />

      {/* Срок подписки. Владелец и администратор видят всё, мастер —
          только полосу: у него кабинет открыт при клиентке. */}
      {currentSalonId ? (
        <SubscriptionAlarm
          salonId={currentSalonId}
          canPay={canOpenSalon}
        />
      ) : null}

      <button
        type="button"
        className="mobile-menu-button"
        aria-label="Menu"
        onClick={() => setIsMenuOpen((open) => !open)}
      >
        <Menu size={20} />
      </button>

      {canGoBack && (
        <button
          type="button"
          className="mobile-back-button"
          aria-label="Back"
          onClick={() => window.history.back()}
        >
          <ChevronLeft size={20} />
        </button>
      )}

      {isMenuOpen && (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Close menu"
          onClick={() => setIsMenuOpen(false)}
        />
      )}

      {/*
        Меню на телефоне закрывается не от любого прикосновения, а только
        когда выбран пункт.

        Прежде здесь стояло `onClick={() => setIsMenuOpen(false)}` на всей
        колонке — на всей, без разбора. Но раздел «Работа» это не переход,
        а кнопка, раскрывающая свои пункты: тот же щелчок раскрывал их и
        тут же закрывал колонку, так что пункты показывались за закрытой
        дверью. На телефоне до «Мои записи» нельзя было добраться вовсе —
        меню исчезало на полпути. Переключатели салона и филиала гасли так
        же, не успев сработать.

        Ссылка — единственное, что действительно уводит со страницы.
        По ней и закрываем; всё остальное внутри меню оставляет его на
        месте.
      */}
      <aside
        className="sidebar"
        onClick={(event) => {
          const target = event.target as Element | null;

          if (target?.closest?.('a[href]')) {
            setIsMenuOpen(false);
          }
        }}
      >
        <div className="sidebar-brand">
          {logoUrl ? (
            <img
              className="sidebar-brand-logo"
              src={logoUrl}
              alt={salonName}
            />
          ) : (
            <span>GLAMOUR</span>
          )}

          <strong>{salonName}</strong>

          {/* Салон видит своё название и логотип, платформа остаётся
              узнаваемой: клиент понимает, каким приложением пользуется. */}
          <span
            style={{
              display: 'block',
              marginTop: 4,
              color: 'var(--app-text-muted)',
              fontSize: 10,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            {t('nav.poweredBy')}
          </span>
        </div>

        <section
          className="workspace-switcher"
          aria-label={t('nav.workspace')}
        >
          <span className="workspace-switcher-label">
            {t('nav.workspace')}
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

        {/* Переход между точками салона.
            Стоит рядом с выбором салона у мастера и работает так же:
            выбранное держится на всех экранах кабинета, а не только на
            том, где нажали. У салона с одним адресом переключателя нет —
            переходить некуда. */}
        {!isMasterWorkspace && points.length > 1 ? (
          <section
            className="workspace-switcher"
            aria-label={t('nav.currentPoint')}
          >
            <span className="workspace-switcher-label">
              {t('nav.currentPoint')}
            </span>

            <select
              className="workspace-salon-select"
              value={currentPointId}
              onChange={(event) => {
                setCurrentPointId(event.target.value);
                writeCurrentPoint(event.target.value);
              }}
              aria-label={t('nav.currentPoint')}
            >
              <option value="">{t('nav.allPoints')}</option>

              {points.map((point) => (
                <option
                  key={point.id}
                  value={point.isSalon ? 'salon' : point.id}
                >
                  {point.name}
                </option>
              ))}
            </select>
          </section>
        ) : null}

        {isMasterWorkspace &&
        masterSalons.length > 0 ? (
          <section
            className="workspace-switcher"
            aria-label={t('nav.currentSalon')}
          >
            <span className="workspace-switcher-label">
              {t('nav.currentSalon')}
            </span>

            <select
              className="workspace-salon-select"
              value={currentSalonId}
              onChange={(event) =>
                switchMasterSalon(
                  event.target.value,
                )
              }
              aria-label={t('nav.currentSalon')}
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
              {MASTER_GROUPS.map((group) => {
                // Группа из одного пункта — лишний щелчок и лишний
                // уровень: показываем сам пункт.
                if (group.items.length === 1) {
                  const only = group.items[0];

                  return (
                    <a
                      key={group.key}
                      className={
                        currentHash === only.hash ? 'active' : ''
                      }
                      href={only.hash}
                    >
                      {only.icon}
                      {t(only.label)}
                    </a>
                  );
                }

                const opened =
                  (openGroup || groupOfHash(currentHash, MASTER_GROUPS)) ===
                  group.key;

                return (
                  <div
                    key={group.key}
                    className={
                      opened
                        ? 'sidebar-group open'
                        : 'sidebar-group'
                    }
                  >
                    <button
                      type="button"
                      aria-expanded={opened}
                      onClick={() =>
                        setOpenGroup(
                          opened ? 'none' : group.key,
                        )
                      }
                    >
                      {MASTER_GROUP_ICON[group.key]}
                      {t(group.label)}
                      <ChevronDown
                        size={16}
                        className="sidebar-group-chevron"
                      />
                    </button>

                    {opened ? (
                      <div className="sidebar-group-items">
                        {group.items.map((item) => (
                          <a
                            key={item.hash}
                            className={
                              currentHash === item.hash
                                ? 'active'
                                : ''
                            }
                            href={item.hash}
                          >
                            {item.icon}
                            {t(item.label)}

                            {item.hash === '#chat' ? (
                              <ChatUnreadBadge />
                            ) : null}
                          </a>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </>
          ) : (
            <>
              {SALON_GROUPS.map((group) => {
                const items = group.items.filter(
                  (item) => !item.ownerOnly || isSalonOwner,
                );

                if (items.length === 0) {
                  return null;
                }

                // То же правило, что у мастера: один пункт — не группа.
                // У администратора так схлопывается «Салон», где ему
                // остаётся только журнал действий.
                if (items.length === 1) {
                  const only = items[0];

                  return (
                    <a
                      key={group.key}
                      className={
                        currentHash === only.hash ? 'active' : ''
                      }
                      href={only.hash}
                    >
                      {only.icon}
                      {t(only.label)}
                    </a>
                  );
                }

                const opened =
                  (openGroup ||
                    groupOfHash(currentHash, SALON_GROUPS)) === group.key;

                return (
                  <div
                    key={group.key}
                    className={
                      opened
                        ? 'sidebar-group open'
                        : 'sidebar-group'
                    }
                  >
                    <button
                      type="button"
                      aria-expanded={opened}
                      onClick={() =>
                        setOpenGroup(
                          opened ? 'none' : group.key,
                        )
                      }
                    >
                      {SALON_GROUP_ICON[group.key]}
                      {t(group.label)}
                      <ChevronDown
                        size={16}
                        className="sidebar-group-chevron"
                      />
                    </button>

                    {opened ? (
                      <div className="sidebar-group-items">
                        {items.map((item) => (
                          <a
                            key={item.hash}
                            className={
                              currentHash === item.hash
                                ? 'active'
                                : ''
                            }
                            href={item.hash}
                            style={
                              item.hash === '#salon-info' &&
                              salonPercent < 70
                                ? {
                                    color:
                                      salonPercent < 40
                                        ? '#ff6b8a'
                                        : '#ffb020',
                                    fontWeight: 700,
                                  }
                                : undefined
                            }
                          >
                            {item.icon}
                            {t(item.label)}

                            {item.hash === '#chat' ? (
                              <ChatUnreadBadge />
                            ) : null}

                            {/* Точка заметнее цвета текста: пункт меню
                                мелкий, один оттенок легко пропустить. */}
                            {item.hash === '#salon-info' &&
                            salonPercent < 70 ? (
                              <span
                                style={{
                                  width: 7,
                                  height: 7,
                                  borderRadius: '50%',
                                  background:
                                    salonPercent < 40
                                      ? '#ff6b8a'
                                      : '#ffb020',
                                  marginLeft: 'auto',
                                  flexShrink: 0,
                                }}
                              />
                            ) : null}
                          </a>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </>
          )}

          {/* «Общение» теперь внутри группы «Связь» — и у мастера, и у
              салона, вместе со счётчиком непрочитанного. */}
        </nav>
        <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(var(--app-ink-rgb),0.07)', marginTop: 'auto' }}>
          <LanguageSwitcher />

                    <div style={{ height: 10 }} />

                    <ThemeSwitcher />
        </div>
      </aside>

      <div className="app-content">
        {children}
      </div>

      {/* Нижняя панель: частые разделы под большим пальцем. */}
      <nav className="mobile-tabbar">
        {(workspaceMode === 'master'
          ? [
              { hash: '#schedule', icon: <CalendarDays size={19} />, label: t('nav.mySchedule') },
              { hash: '#appointments', icon: <Sparkles size={19} />, label: t('nav.myAppointments') },
              { hash: '#clients', icon: <Users size={19} />, label: t('nav.myClients') },
              { hash: '#finance', icon: <CreditCard size={19} />, label: t('nav.myFinance') },
            ]
          : [
              { hash: '#appointments', icon: <CalendarDays size={19} />, label: t('nav.appointments') },
              { hash: '#clients', icon: <Users size={19} />, label: t('nav.clients') },
              { hash: '#masters', icon: <Scissors size={19} />, label: t('nav.masters') },
              // Ресепшн не ходит в деньги салона — у него там услуги.
              isSalonOwner
                ? { hash: '#finance', icon: <CreditCard size={19} />, label: t('nav.finance') }
                : { hash: '#services', icon: <Sparkles size={19} />, label: t('nav.services') },
            ]
        ).map((item) => (
          <a
            key={item.hash}
            href={item.hash}
            className={currentHash === item.hash ? 'active' : ''}
          >
            {item.icon}
            {item.label}
          </a>
        ))}
      </nav>
    </div>
  );
}

export default AppLayout;
