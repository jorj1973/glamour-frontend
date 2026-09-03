import { useEffect, useMemo, useState } from 'react';
import BookingGreeting from '../components/BookingGreeting';
import BookingCalendar from '../components/BookingCalendar';
import {
    isPushSupported,
    pushPermission,
    subscribeToPush,
} from '../api/push';
import {
    ArrowLeft,
    CalendarDays,
    Check,
    Clock3,
    LoaderCircle,
    Scissors,
    UserRound,
} from 'lucide-react';

import { useTranslation } from 'react-i18next';

import api from '../api/api';
import MasterPublicCard from '../components/MasterPublicCard';
import LanguageSwitcher from '../components/LanguageSwitcher';
import ThemeSwitcher from '../components/ThemeSwitcher';

const TOKEN_STORAGE_KEY = 'glamour_access_token';
const VISITOR_TOKEN_STORAGE_KEY = 'glamour_promotion_visitor_token';

type BookingStep =
    | 'loading'
    | 'service'
    | 'master'
    | 'time'
    | 'auth'
    | 'confirm'
    | 'success'
    | 'error';

type SalonInfo = {
    id: string;
    name: string;
    logoUrl: string | null;
};

type ResolvePromotionLinkResponse = {
    visitId: string;
    visitorToken: string;
    salonId: string;
    title: string;
    targetType: string;
    targetId: string | null;
    customSlug: string | null;
    salon: SalonInfo;
};

type ServiceItem = {
    id: string;
    salonId: string;
    name: string;
    description: string | null;
    durationMinutes: number;
    basePrice: number | string;
    isActive: boolean;

    /** Названия по языкам. Салон заполняет их в своём кабинете. */
    nameRo?: string | null;
    nameRu?: string | null;
    nameEn?: string | null;
};

/**
 * Название услуги на выбранном языке.
 *
 * Если перевода нет, возвращаем общее название: пустая строка
 * в списке услуг хуже, чем название на чужом языке.
 */
function serviceName(
    service: { name: string; nameRo?: string | null; nameRu?: string | null; nameEn?: string | null },
    language: string,
): string {
    if (language.startsWith('ro')) {
        return service.nameRo?.trim() || service.name;
    }

    if (language.startsWith('en')) {
        return service.nameEn?.trim() || service.name;
    }

    if (language.startsWith('ru')) {
        return service.nameRu?.trim() || service.name;
    }

    return service.name;
}

type MasterService = {
    id: string;
    masterProfileId: string;
    serviceId: string;
    price?: number | string | null;
    minPrice?: number | string | null;
    maxPrice?: number | string | null;
    durationMinutes?: number | null;
    customTitle?: string | null;
    isActive?: boolean;
    isPublic?: boolean;
    onlineBookingEnabled?: boolean;
};

type MasterItem = {
    id: string;
    userId?: string;
    salonId?: string;
    firstName?: string;
    lastName?: string;
    displayName?: string;
    name?: string;
    avatarUrl?: string | null;
    isActive?: boolean;
    services?: MasterService[];
    user?: {
        id?: string;
        firstName?: string;
        lastName?: string;
    };
};

/**
 * Язык формата дат. Без него браузер показывает месяцы
 * на своём языке: у румынского клиента выходило «21 авг.».
 */
function getDateLocale(lang?: string) {
    if (lang?.startsWith('ro')) return 'ro-RO';
    if (lang?.startsWith('en')) return 'en-GB';
    return 'ru-RU';
}

/** Ближайший день со свободным временем. */
type NextDay = {
    date: string;
    slotsCount: number;
    firstSlot: string;
};

type AvailableSlot = {
    startTime: string;
    endTime: string;
};

type RegisterClientResponse = {
    message: string;
    accessToken: string;
    user: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
        phone: string;
        role: string;
        timezone: string;
        isActive: boolean;
    };
};

type LoginResponse = {
    accessToken: string;
    user?: {
        id: string;
    };
};

function getIdentifier(): string {
    const hash = window.location.hash;
    const questionMarkIndex = hash.indexOf('?');

    if (questionMarkIndex === -1) {
        return '';
    }

    const query = hash.slice(questionMarkIndex + 1);
    const params = new URLSearchParams(query);

    return params.get('identifier')?.trim() ?? '';
}

function formatPrice(value: number | string): string {
    const numericValue = Number(value);

    if (!Number.isFinite(numericValue)) {
        return String(value);
    }

    return new Intl.NumberFormat('ro-MD', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    }).format(numericValue);
}

function getMasterName(master: MasterItem): string {
    if (master.displayName?.trim()) {
        return master.displayName.trim();
    }

    if (master.name?.trim()) {
        return master.name.trim();
    }

    const firstName =
        master.firstName?.trim() ||
        master.user?.firstName?.trim() ||
        '';

    const lastName =
        master.lastName?.trim() ||
        master.user?.lastName?.trim() ||
        '';

    const fullName = `${firstName} ${lastName}`.trim();

    return fullName || '—';
}

function getDateInputValue(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
}

function PublicBookingPage() {
    const { t, i18n } = useTranslation();
    const identifier = useMemo(() => getIdentifier(), []);

    const [step, setStep] = useState<BookingStep>('loading');

    const [salon, setSalon] = useState<SalonInfo | null>(null);
    const [targetType, setTargetType] = useState('');
    const [targetId, setTargetId] = useState<string | null>(null);

    const [services, setServices] = useState<ServiceItem[]>([]);
    const [masters, setMasters] = useState<MasterItem[]>([]);
    const [slots, setSlots] = useState<AvailableSlot[]>([]);
    const [nextDays, setNextDays] = useState<NextDay[]>([]);

    /**
     * Показывать ли предложение включить напоминания.
     *
     * Прячем, если устройство не умеет или человек уже решил:
     * повторная просьба выглядит навязчиво.
     */
    const [pushAsked, setPushAsked] = useState(false);
    const [pushOn, setPushOn] = useState(false);

    // Кнопка кабинета имеет смысл только для тех, кто уже вошёл:
    // новому пользователю она обещает то, чего ещё нет.
    const hasAccount = Boolean(localStorage.getItem(TOKEN_STORAGE_KEY));

    // Есть ли куда вернуться: пришёл человек по ссылке извне
    // или переходом внутри приложения.
    const canGoBack = window.history.length > 1;

    const [selectedService, setSelectedService] =
        useState<ServiceItem | null>(null);

    const [selectedMaster, setSelectedMaster] =
        useState<MasterItem | null>(null);

    const [selectedSlot, setSelectedSlot] =
        useState<AvailableSlot | null>(null);

    const [selectedDate, setSelectedDate] = useState(
        getDateInputValue(new Date()),
    );

    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    const [authMode, setAuthMode] =
        useState<'register' | 'login'>('register');

    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    useEffect(() => {
        let cancelled = false;

        async function initialize() {
            if (!identifier) {
                setErrorMessage(t('booking.badLink'));
                setStep('error');
                return;
            }

            try {
                const visitorToken =
                    localStorage.getItem(VISITOR_TOKEN_STORAGE_KEY) ||
                    undefined;

                const resolveResponse =
                    await api.post<ResolvePromotionLinkResponse>(
                        `/public/promotion-links/${encodeURIComponent(
                            identifier,
                        )}/resolve`,
                        {
                            visitorToken,
                        },
                    );

                if (cancelled) {
                    return;
                }

                const resolved = resolveResponse.data;

                setSalon(resolved.salon);
                setTargetType(resolved.targetType);
                setTargetId(resolved.targetId);

                if (resolved.visitorToken) {
                    localStorage.setItem(
                        VISITOR_TOKEN_STORAGE_KEY,
                        resolved.visitorToken,
                    );
                }

                // Кабинету нужна ссылка, чтобы клиент мог записаться
                // заново. У каждого салона она своя, поэтому
                // запоминаем ту, по которой человек пришёл.
                localStorage.setItem('glamour_booking_link', identifier);

                const servicesResponse =
                    await api.get<ServiceItem[]>('/services/active', { params: { salonId: resolved.salonId } });

                if (cancelled) {
                    return;
                }

                const salonServices = servicesResponse.data.filter(
                    (service) =>
                        service.salonId === resolved.salonId &&
                        service.isActive !== false,
                );

                let initialServices = salonServices;

                if (
                    resolved.targetType === 'service' &&
                    resolved.targetId
                ) {
                    initialServices = salonServices.filter(
                        (service) => service.id === resolved.targetId,
                    );
                }

                setServices(initialServices);

                if (
                    resolved.targetType === 'service' &&
                    initialServices.length === 1
                ) {
                    const service = initialServices[0];

                    setSelectedService(service);

                    await loadMastersForService(
                        service,
                        resolved.salonId,
                        resolved.targetType,
                        resolved.targetId,
                    );

                    return;
                }

                setStep('service');
            } catch (error: any) {
                if (cancelled) {
                    return;
                }

                const message =
                    error?.response?.data?.message;

                setErrorMessage(
                    Array.isArray(message)
                        ? message.join(', ')
                        : message ||
                        t('booking.openLinkError'),
                );

                setStep('error');
            }
        }

        void initialize();

        return () => {
            cancelled = true;
        };
    }, [identifier]);

    async function loadMastersForService(
        service: ServiceItem,
        salonId = salon?.id,
        resolvedTargetType = targetType,
        resolvedTargetId = targetId,
    ) {
        if (!salonId) {
            setErrorMessage(t('booking.salonUnknown'));
            setStep('error');
            return;
        }

        setIsLoading(true);
        setErrorMessage('');

        try {
            const response = await api.get<any[]>(
                `/masters/by-service/${encodeURIComponent(service.id)}`,
                { params: { salonId } },
            );

            // Backend возвращает { masterService, masterProfile } — разворачиваем.
            const normalized: MasterItem[] = response.data.map((row: any) => {
                const profile = row.masterProfile ?? row;

                return {
                    ...profile,
                    id: profile.id,
                    salonId: row.masterService?.salonId ?? profile.salonId,
                    isActive: row.masterService?.isActive !== false,

                    // Сохраняем услугу мастера целиком: из неё берутся
                    // masterServiceId для записи и своя длительность слота.
                    // Раньше объект выбрасывался, оставались только два поля.
                    services: row.masterService
                        ? [row.masterService]
                        : (profile.services ?? []),
                };
            });

            let availableMasters = normalized.filter((master) => {
                if (
                    master.salonId &&
                    master.salonId !== salonId
                ) {
                    return false;
                }

                return master.isActive !== false;
            });

            if (
                resolvedTargetType === 'master' &&
                resolvedTargetId
            ) {
                availableMasters = availableMasters.filter(
                    (master) => master.id === resolvedTargetId,
                );
            }

            setMasters(availableMasters);

            if (
                resolvedTargetType === 'master' &&
                availableMasters.length === 1
            ) {
                setSelectedMaster(availableMasters[0]);
                setStep('time');
            } else {
                setStep('master');
            }
        } catch (error: any) {
            const message =
                error?.response?.data?.message;

            setErrorMessage(
                Array.isArray(message)
                    ? message.join(', ')
                    : message ||
                    t('booking.mastersError'),
            );
        } finally {
            setIsLoading(false);
        }
    }

    async function selectService(service: ServiceItem) {
        setSelectedService(service);
        setSelectedMaster(null);
        setSelectedSlot(null);
        setSlots([]);

        await loadMastersForService(service);
    }

    function selectMaster(master: MasterItem) {
        setSelectedMaster(master);
        setSelectedSlot(null);
        setSlots([]);
        setStep('time');
    }

    /**
     * Часы выбранного дня.
     *
     * Дату принимаем доводом: состояние обновляется не сразу,
     * и без этого запрос ушёл бы с прежним днём.
     */
    /**
     * Откладывает выбор: запоминаем всё, что клиент успел выбрать,
     * и возвращаем его назад. Запись не создаётся, время не держим.
     */
    function postponeBooking() {
        if (!selectedService || !selectedMaster || !selectedSlot) {
            return;
        }

        const saved = {
            serviceId: selectedService.id,
            serviceName: serviceName(selectedService, i18n.language),
            masterProfileId: selectedMaster.id,
            masterName: selectedMaster.name,
            date: selectedDate,
            startTime: selectedSlot.startTime,
            savedAt: new Date().toISOString(),
        };

        const raw = localStorage.getItem('glamour_postponed');
        const list = raw ? JSON.parse(raw) : [];

        // Повторный выбор того же времени не плодит записей.
        const without = list.filter(
            (item: { startTime: string }) =>
                item.startTime !== saved.startTime,
        );

        localStorage.setItem(
            'glamour_postponed',
            JSON.stringify([saved, ...without].slice(0, 10)),
        );

        window.location.href = '/';
    }

    async function loadSlots(dateOverride?: string) {
        const date = dateOverride ?? selectedDate;

        if (!selectedService || !selectedMaster) {
            return;
        }

        setIsLoading(true);
        setErrorMessage('');
        setSelectedSlot(null);
        setNextDays([]);

        try {
            const response = await api.post<AvailableSlot[]>(
                '/appointments/available-slots',
                {
                    // DTO принимает только masterProfileId, date и slotMinutes.
                    // serviceId отклонялся целиком из-за forbidNonWhitelisted,
                    // а slotMinutes не передавался вовсе.
                    masterProfileId: selectedMaster.id,
                    date,
                    // Мастер может задать свою длительность для услуги —
                    // она приоритетнее базовой длительности услуги салона.
                    slotMinutes:
                        selectedMaster.services?.find(
                            (s) => s.serviceId === selectedService.id,
                        )?.durationMinutes ?? selectedService.durationMinutes,
                },
            );

            setSlots(response.data);

            // Пустой день без объяснения заставляет клиента перебирать
            // календарь вручную. Показываем ближайшие свободные даты.
            if (response.data.length === 0) {
                const minutes =
                    selectedMaster.services?.find(
                        (s) => s.serviceId === selectedService.id,
                    )?.durationMinutes ?? selectedService.durationMinutes;

                try {
                    const nextResponse = await api.post<NextDay[]>(
                        '/appointments/next-available-days',
                        {
                            masterProfileId: selectedMaster.id,
                            slotMinutes: minutes,
                        },
                    );

                    setNextDays(nextResponse.data);
                } catch {
                    setNextDays([]);
                }
            }
        } catch (error: any) {
            const message =
                error?.response?.data?.message;

            setErrorMessage(
                Array.isArray(message)
                    ? message.join(', ')
                    : message ||
                    t('booking.slotsError'),
            );

            setSlots([]);
        } finally {
            setIsLoading(false);
        }
    }

    function continueAfterSlot(slot: AvailableSlot) {
        setSelectedSlot(slot);

        const accessToken =
            localStorage.getItem(TOKEN_STORAGE_KEY);

        if (accessToken) {
            setStep('confirm');
        } else {
            setStep('auth');
        }
    }

    async function registerClient() {
        // Проверяем до запроса: иначе клиент получит английскую
        // ошибку от сервера на последнем шаге записи.
        const pass = password.trim();

        if (
            pass.length < 10 ||
            !/[a-z]/.test(pass) ||
            !/[A-Z]/.test(pass) ||
            !/\d/.test(pass)
        ) {
            setErrorMessage(t('booking.passwordHint'));
            return;
        }

        if (!/^\+[1-9]\d{7,14}$/.test(phone.trim())) {
            setErrorMessage(t('booking.phoneHint'));
            return;
        }

        setIsLoading(true);
        setErrorMessage('');

        try {
            const response =
                await api.post<RegisterClientResponse>(
                    '/auth/register-client',
                    {
                        firstName: firstName.trim(),
                        lastName: lastName.trim(),
                        email: email.trim().toLowerCase(),
                        phone: phone.trim(),
                        password,
                        timezone: 'Europe/Chisinau',
                    },
                );

            localStorage.setItem(
                TOKEN_STORAGE_KEY,
                response.data.accessToken,
            );

            setStep('confirm');
        } catch (error: any) {
            const message =
                error?.response?.data?.message;

            setErrorMessage(
                Array.isArray(message)
                    ? message.join(', ')
                    : message ||
                    t('booking.registerError'),
            );
        } finally {
            setIsLoading(false);
        }
    }

    async function loginClient() {
        setIsLoading(true);
        setErrorMessage('');

        try {
            const response = await api.post<LoginResponse>(
                '/auth/login',
                {
                    email: email.trim().toLowerCase(),
                    password,
                },
            );

            localStorage.setItem(
                TOKEN_STORAGE_KEY,
                response.data.accessToken,
            );

            setStep('confirm');
        } catch (error: any) {
            const message =
                error?.response?.data?.message;

            setErrorMessage(
                Array.isArray(message)
                    ? message.join(', ')
                    : message ||
                    t('booking.loginError'),
            );
        } finally {
            setIsLoading(false);
        }
    }

    async function createAppointment() {
        if (
            !selectedService ||
            !selectedMaster ||
            !selectedSlot
        ) {
            return;
        }

        setIsLoading(true);
        setErrorMessage('');

        try {
            // У гостя сессии нет — это не ошибка, а нормальный путь:
            // регистрация идёт последним шагом, после выбора времени.
            let user: { id: string; role: string } | undefined;

            try {
                const sessionResponse =
                    await api.get<{
                        authenticated: boolean;
                        user: {
                            id: string;
                            role: string;
                        };
                    }>('/auth/session');

                user = sessionResponse.data.user;
            } catch {
                user = undefined;
            }

            if (!user?.id) {
                setStep('auth');
                setIsLoading(false);
                return;
            }

            // Вошедший не клиент (владелец, мастер, админ) — не тупик:
            // предлагаем войти клиентским аккаунтом или зарегистрироваться.
            if (user.role !== 'client') {
                setStep('auth');
                setErrorMessage(t('booking.clientOnly'));
                setIsLoading(false);
                return;
            }

            // DTO ждёт masterServiceId — услугу КОНКРЕТНОГО мастера
            // (у каждого своя цена и длительность), а не услугу салона.
            const masterService =
                selectedMaster.services?.find(
                    (s) => s.serviceId === selectedService.id,
                ) ?? selectedMaster.services?.[0];

            if (!masterService) {
                throw new Error(t('booking.serviceUnavailable'));
            }

            await api.post('/appointments', {
                salonId: salon?.id,
                masterProfileId: selectedMaster.id,
                masterServiceId: masterService.id,
                clientUserId: user.id,
                startTime: selectedSlot.startTime,
                endTime: selectedSlot.endTime,
                visitorToken:
                    localStorage.getItem(VISITOR_TOKEN_STORAGE_KEY) || undefined,
            });

            setStep('success');
        } catch (error: any) {
            const message =
                error?.response?.data?.message ||
                error?.message;

            setErrorMessage(
                Array.isArray(message)
                    ? message.join(', ')
                    : message ||
                    t('booking.createError'),
            );
        } finally {
            setIsLoading(false);
        }
    }

    function goBack() {
        setErrorMessage('');

        if (step === 'master') {
            setStep('service');
            return;
        }

        if (step === 'time') {
            setStep('master');
            return;
        }

        if (step === 'auth') {
            setStep('time');
            return;
        }

        if (step === 'confirm') {
            setStep('time');
        }
    }

    return (
        <main
            style={{
                minHeight: '100vh',
                background:
                    'var(--app-bg)',
                color: 'var(--app-text, var(--app-text))',
                padding: '32px 16px',
            }}
        >
            <section
                style={{
                    width: '100%',
                    maxWidth: 720,
                    margin: '0 auto',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
                    <LanguageSwitcher />
                    <ThemeSwitcher />

                    {/* Клиент с историей заходит не только записаться:
                        ему нужно посмотреть свои визиты и баллы.
                        Новому пользователю кнопка обещает кабинет,
                        которого ещё нет, поэтому показываем её
                        только вошедшим. */}
                    {canGoBack ? (
                    <button type="button" onClick={() => window.history.back()} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 44, padding: '0 16px', borderRadius: 13, border: '1px solid rgba(var(--app-overlay-rgb), 0.12)', background: 'rgba(var(--app-overlay-rgb), 0.05)', color: 'var(--app-text)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                        <ArrowLeft size={15} />
                        {t('booking.back')}
                    </button>
                    ) : hasAccount ? (
                    <a
                        href="/"
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            minHeight: 44,
                            padding: '0 16px',
                            borderRadius: 13,
                            border: '1px solid rgba(var(--app-overlay-rgb), 0.12)',
                            background: 'rgba(var(--app-overlay-rgb), 0.05)',
                            color: 'var(--app-text, var(--app-text))',
                            fontSize: 13,
                            fontWeight: 700,
                            textDecoration: 'none',
                        }}
                    >
                        <UserRound size={15} />
                        {t('booking.myCabinet')}
                    </a>
                    ) : null}
                </div>

                <header
                    style={{
                        textAlign: 'center',
                        marginBottom: 28,
                    }}
                >
                    {salon?.logoUrl && (
                        <img
                            src={salon.logoUrl}
                            alt={salon.name}
                            style={{
                                width: 72,
                                height: 72,
                                objectFit: 'cover',
                                borderRadius: 20,
                                marginBottom: 14,
                            }}
                        />
                    )}

                    <p
                        style={{
                            margin: '0 0 8px',
                            color: 'var(--app-accent-text)',
                            fontSize: 12,
                            fontWeight: 800,
                            letterSpacing: '0.14em',
                        }}
                    >
                        GLAMOUR
                    </p>

                    <h1
                        style={{
                            margin: 0,
                            fontSize: 30,
                        }}
                    >
                        {salon?.name || t('booking.title')}
                    </h1>

                    {salon && (
                        <p
                            style={{
                                margin: '8px 0 0',
                                color: 'var(--app-text-dim3)',
                            }}
                        >
                            {t('booking.subtitle')}
                        </p>
                    )}
                </header>

                <div
                    style={{
                        padding: 24,
                        border:
                            '1px solid rgba(var(--app-overlay-rgb), 0.09)',
                        borderRadius: 22,
                        background: 'rgba(var(--app-overlay-rgb), 0.045)',
                        boxShadow:
                            '0 24px 80px rgba(0,0,0,0.28)',
                    }}
                >
                    {step !== 'loading' &&
                        step !== 'service' &&
                        step !== 'success' &&
                        step !== 'error' && (
                            <button
                                type="button"
                                onClick={goBack}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 7,
                                    border: 0,
                                    background: 'transparent',
                                    color: 'var(--app-text-muted, var(--app-text-muted))',
                                    cursor: 'pointer',
                                    padding: 0,
                                    marginBottom: 20,
                                }}
                            >
                                <ArrowLeft size={16} />
                                {t('booking.back')}
                            </button>
                        )}

                    {errorMessage &&
                        step !== 'error' && (
                            <div
                                style={{
                                    padding: '11px 14px',
                                    marginBottom: 18,
                                    borderRadius: 12,
                                    background:
                                        'rgba(255,96,128,0.1)',
                                    border:
                                        '1px solid rgba(255,96,128,0.22)',
                                    color: 'var(--app-danger-soft)',
                                    fontSize: 13,
                                }}
                            >
                                {errorMessage}
                            </div>
                        )}

                    {step === 'loading' && (
                        <div
                            style={{
                                padding: 50,
                                textAlign: 'center',
                            }}
                        >
                            <LoaderCircle
                                size={30}
                                style={{
                                    animation:
                                        'public-booking-spin 1s linear infinite',
                                }}
                            />

                            <p>{t('booking.opening')}</p>
                        </div>
                    )}

                    {step === 'service' && (
                        <>
                            <BookingGreeting
                                text={t('booking.greeting')}
                                hint={t('booking.greetingHint')}
                            />

                            <h2>{t('booking.chooseService')}</h2>

                            {services.length === 0 ? (
                                <p style={{ color: 'var(--app-text-dim3)' }}>
                                    {t('booking.noServices')}
                                </p>
                            ) : (
                                <div
                                    style={{
                                        display: 'grid',
                                        gap: 12,
                                    }}
                                >
                                    {services.map((service) => (
                                        <button
                                            key={service.id}
                                            type="button"
                                            onClick={() =>
                                                void selectService(service)
                                            }
                                            style={{
                                                width: '100%',
                                                padding: 16,
                                                border:
                                                    '1px solid rgba(var(--app-overlay-rgb), 0.09)',
                                                borderRadius: 16,
                                                background:
                                                    'rgba(var(--app-overlay-rgb), 0.04)',
                                                color: 'var(--app-text, var(--app-text))',
                                                cursor: 'pointer',
                                                textAlign: 'left',
                                            }}
                                        >
                                            <div
                                                style={{
                                                    display: 'flex',
                                                    gap: 12,
                                                    alignItems: 'flex-start',
                                                }}
                                            >
                                                <Scissors
                                                    size={19}
                                                    color="var(--app-accent)"
                                                />

                                                <div style={{ flex: 1 }}>
                                                    <strong>
                                                        {serviceName(service, i18n.language)}
                                                    </strong>

                                                    {service.description && (
                                                        <p
                                                            style={{
                                                                color: 'var(--app-text-dim3)',
                                                                fontSize: 13,
                                                                margin: '6px 0',
                                                            }}
                                                        >
                                                            {service.description}
                                                        </p>
                                                    )}

                                                    <div
                                                        style={{
                                                            display: 'flex',
                                                            gap: 14,
                                                            color: 'var(--app-text-muted)',
                                                            fontSize: 12,
                                                        }}
                                                    >
                                                        <span>
                                                            {service.durationMinutes} {t('services.min')}
                                                        </span>

                                                        <span>
                                                            {formatPrice(
                                                                service.basePrice,
                                                            )}{' '}
                                                            MDL
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}


                        </>
                    )}

                    {step === 'master' && (
                        <>
                            <h2>{t('booking.chooseMaster')}</h2>

                            {isLoading ? (
                                <p>{t('booking.loading')}</p>
                            ) : masters.length === 0 ? (
                                <p style={{ color: 'var(--app-text-dim3)' }}>
                                    {t('booking.noMasters')}
                                </p>
                            ) : (
                                <div
                                    style={{
                                        display: 'grid',
                                        gap: 12,
                                    }}
                                >
                                    {masters.map((master) => (
                                        <div
                                            key={master.id}
                                            onClick={() => selectMaster(master)}
                                            style={{
                                                padding: 16,
                                                border:
                                                    '1px solid rgba(var(--app-overlay-rgb), 0.09)',
                                                borderRadius: 16,
                                                background:
                                                    'rgba(var(--app-overlay-rgb), 0.04)',
                                                color: 'var(--app-text, var(--app-text))',
                                                cursor: 'pointer',
                                                textAlign: 'left',
                                            }}
                                        >
                                            <MasterPublicCard
                                                masterProfileId={master.id}
                                                compact
                                            />

                                            <p
                                                style={{
                                                    marginTop: 12,
                                                    color: 'var(--app-accent-text)',
                                                    fontSize: 13,
                                                    fontWeight: 700,
                                                }}
                                            >
                                                {getMasterName(master)}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}

                    {step === 'time' && (
                        <>
                            <h2>{t('booking.chooseDateTime')}</h2>

                            {/* Календарь вместо поля с датой: клиент
                                видит, где есть места, и не упирается
                                в занятый день вслепую. */}
                            <div style={{ marginBottom: 16 }}>
                                {selectedMaster && (
                                    <BookingCalendar
                                        masterProfileId={selectedMaster.id}
                                        value={selectedDate}
                                        onChange={(date) => {
                                            setSelectedDate(date);
                                            setSlots([]);
                                            setSelectedSlot(null);

                                            // Нажатие на день — уже выбор:
                                            // отдельная кнопка была лишним шагом.
                                            void loadSlots(date);
                                        }}
                                    />
                                )}
                            </div>

                            {slots.length > 0 && (
                                <div
                                    style={{
                                        display: 'grid',
                                        gridTemplateColumns:
                                            'repeat(auto-fill, minmax(110px, 1fr))',
                                        gap: 9,
                                    }}
                                >
                                    {slots.map((slot) => (
                                        <button
                                            key={slot.startTime}
                                            type="button"
                                            onClick={() =>
                                                continueAfterSlot(slot)
                                            }
                                            style={{
                                                minHeight: 44,
                                                border:
                                                    '1px solid rgba(var(--app-accent-rgb), 0.3)',
                                                borderRadius: 12,
                                                background:
                                                    'rgba(var(--app-accent-rgb), 0.08)',
                                                color: 'var(--app-accent-soft)',
                                                cursor: 'pointer',
                                                fontWeight: 700,
                                            }}
                                        >
                                            {new Date(
                                                slot.startTime,
                                            ).toLocaleTimeString([], {
                                                hour: '2-digit',
                                                minute: '2-digit',
                                            })}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Пустой день без объяснения заставляет клиента
                                перебирать календарь. Показываем, когда мастер
                                свободен ближайшее время. */}
                            {slots.length === 0 && nextDays.length > 0 && (
                                <div
                                    style={{
                                        padding: 16,
                                        borderRadius: 16,
                                        border: '1px solid rgba(255,208,139,0.24)',
                                        background: 'rgba(255,208,139,0.06)',
                                    }}
                                >
                                    <p
                                        style={{
                                            color: '#ffd08b',
                                            fontSize: 13,
                                            fontWeight: 700,
                                            marginBottom: 4,
                                        }}
                                    >
                                        {t('booking.dayIsFull')}
                                    </p>

                                    <p
                                        style={{
                                            color: 'var(--app-text-muted, var(--app-text-muted))',
                                            fontSize: 12,
                                            marginBottom: 12,
                                        }}
                                    >
                                        {t('booking.pickAnotherDay')}
                                    </p>

                                    <div
                                        style={{
                                            display: 'grid',
                                            gridTemplateColumns:
                                                'repeat(auto-fill, minmax(130px, 1fr))',
                                            gap: 9,
                                        }}
                                    >
                                        {nextDays.map((day) => (
                                            <button
                                                key={day.date}
                                                type="button"
                                                onClick={() => {
                                                    setSelectedDate(day.date);
                                                    setNextDays([]);
                                                }}
                                                style={{
                                                    minHeight: 52,
                                                    padding: '8px 10px',
                                                    border: '1px solid rgba(var(--app-accent-rgb), 0.3)',
                                                    borderRadius: 12,
                                                    background: 'rgba(var(--app-accent-rgb), 0.08)',
                                                    color: 'var(--app-accent-soft)',
                                                    cursor: 'pointer',
                                                    fontWeight: 700,
                                                    fontSize: 13,
                                                    lineHeight: 1.3,
                                                }}
                                            >
                                                {new Date(day.date).toLocaleDateString(
                                                    getDateLocale(i18n.language),
                                                    { day: 'numeric', month: 'short' },
                                                )}

                                                <span
                                                    style={{
                                                        display: 'block',
                                                        color: 'var(--app-text-muted, var(--app-text-muted))',
                                                        fontSize: 11,
                                                        fontWeight: 500,
                                                        marginTop: 2,
                                                    }}
                                                >
                                                    {day.slotsCount} {t('booking.slotsShort')}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {step === 'auth' && (
                        <>
                            <h2>
                                {authMode === 'register'
                                    ? t('booking.yourData')
                                    : t('booking.signIn')}
                            </h2>

                            <div
                                style={{
                                    display: 'flex',
                                    gap: 8,
                                    marginBottom: 18,
                                }}
                            >
                                <button
                                    type="button"
                                    onClick={() =>
                                        setAuthMode('register')
                                    }
                                    style={{
                                        flex: 1,
                                        minHeight: 40,
                                        border:
                                            authMode === 'register'
                                                ? '1px solid var(--app-accent)'
                                                : '1px solid rgba(var(--app-overlay-rgb), 0.1)',
                                        borderRadius: 11,
                                        background:
                                            authMode === 'register'
                                                ? 'rgba(var(--app-accent-rgb), 0.12)'
                                                : 'transparent',
                                        color: 'var(--app-text, var(--app-text))',
                                        cursor: 'pointer',
                                    }}
                                >
                                    {t('booking.newClient')}
                                </button>

                                <button
                                    type="button"
                                    onClick={() =>
                                        setAuthMode('login')
                                    }
                                    style={{
                                        flex: 1,
                                        minHeight: 40,
                                        border:
                                            authMode === 'login'
                                                ? '1px solid var(--app-accent)'
                                                : '1px solid rgba(var(--app-overlay-rgb), 0.1)',
                                        borderRadius: 11,
                                        background:
                                            authMode === 'login'
                                                ? 'rgba(var(--app-accent-rgb), 0.12)'
                                                : 'transparent',
                                        color: 'var(--app-text, var(--app-text))',
                                        cursor: 'pointer',
                                    }}
                                >
                                    {t('booking.haveAccount')}
                                </button>
                            </div>

                            <div
                                style={{
                                    display: 'grid',
                                    gap: 12,
                                }}
                            >
                                {authMode === 'register' && (
                                    <>
                                        <input
                                            value={firstName}
                                            onChange={(event) =>
                                                setFirstName(
                                                    event.target.value,
                                                )
                                            }
                                            placeholder={t('booking.firstName')}
                                        />

                                        <input
                                            value={lastName}
                                            onChange={(event) =>
                                                setLastName(
                                                    event.target.value,
                                                )
                                            }
                                            placeholder={t('booking.lastName')}
                                        />

                                        <input
                                            value={phone}
                                            onChange={(event) =>
                                                setPhone(event.target.value)
                                            }
                                            placeholder="+373..."
                                            type="tel"
                                        />
                                    </>
                                )}

                                <input
                                    value={email}
                                    onChange={(event) =>
                                        setEmail(event.target.value)
                                    }
                                    placeholder="Email"
                                    type="email"
                                />

                                <input
                                    value={password}
                                    onChange={(event) =>
                                        setPassword(event.target.value)
                                    }
                                    placeholder={t('login.password')}
                                    type="password"
                                    minLength={10}
                                />

                                {authMode === 'register' && (
                                    <p
                                        style={{
                                            marginTop: -6,
                                            color:
                                                password.length > 0 &&
                                                password.length < 10
                                                    ? 'var(--app-danger-soft)'
                                                    : 'var(--app-text-muted, var(--app-text-muted))',
                                            fontSize: 12,
                                        }}
                                    >
                                        {t('booking.passwordHint')}
                                    </p>
                                )}

                                <button
                                    type="button"
                                    disabled={isLoading}
                                    onClick={() =>
                                        void (authMode === 'register'
                                            ? registerClient()
                                            : loginClient())
                                    }
                                    style={{
                                        minHeight: 48,
                                        border: 0,
                                        borderRadius: 13,
                                        background: 'var(--app-accent)',
                                        color: 'var(--app-bg)',
                                        fontWeight: 800,
                                        cursor: 'pointer',
                                    }}
                                >
                                    {isLoading
                                        ? t('booking.wait')
                                        : authMode === 'register'
                                            ? t('booking.registerContinue')
                                            : t('booking.loginContinue')}
                                </button>
                            </div>
                        </>
                    )}

                    {step === 'confirm' &&
                        selectedService &&
                        selectedMaster &&
                        selectedSlot && (
                            <>
                                <h2>{t('booking.confirmTitle')}</h2>

                                <div
                                    style={{
                                        display: 'grid',
                                        gap: 12,
                                        margin: '20px 0',
                                    }}
                                >
                                    <div
                                        style={{
                                            display: 'flex',
                                            gap: 10,
                                        }}
                                    >
                                        <Scissors
                                            size={18}
                                            color="var(--app-accent)"
                                        />
                                        <span>
                                            {serviceName(selectedService, i18n.language)}
                                        </span>
                                    </div>

                                    <div
                                        style={{
                                            display: 'flex',
                                            gap: 10,
                                        }}
                                    >
                                        <UserRound
                                            size={18}
                                            color="var(--app-accent)"
                                        />
                                        <span>
                                            {getMasterName(
                                                selectedMaster,
                                            )}
                                        </span>
                                    </div>

                                    <div
                                        style={{
                                            display: 'flex',
                                            gap: 10,
                                        }}
                                    >
                                        <CalendarDays
                                            size={18}
                                            color="var(--app-accent)"
                                        />
                                        <span>{selectedDate}</span>
                                    </div>

                                    <div
                                        style={{
                                            display: 'flex',
                                            gap: 10,
                                        }}
                                    >
                                        <Clock3
                                            size={18}
                                            color="var(--app-accent)"
                                        />
                                        <span>
                                            {new Date(
                                                selectedSlot.startTime,
                                            ).toLocaleTimeString([], {
                                                hour: '2-digit',
                                                minute: '2-digit',
                                            })}
                                        </span>
                                    </div>
                                </div>

                                <div
                                    style={{
                                        display: 'flex',
                                        gap: 8,
                                        padding: '0 4px',
                                    }}
                                >
                                    <button
                                        type="button"
                                        onClick={() =>
                                            void createAppointment()
                                        }
                                        disabled={isLoading}
                                        style={{
                                            flex: 1,
                                            minHeight: 50,
                                            border: 0,
                                            borderRadius: 14,
                                            background: 'var(--app-accent)',
                                            color: 'var(--app-bg)',
                                            fontWeight: 800,
                                            fontSize: 14,
                                            cursor: 'pointer',
                                        }}
                                    >
                                        {isLoading
                                            ? t('booking.creating')
                                            : t('booking.confirm')}
                                    </button>

                                    {/* Отсрочка не держит время: салону
                                        невыгодно, а клиенту честнее увидеть
                                        «занято», чем прийти зря. */}
                                    <button
                                        type="button"
                                        onClick={postponeBooking}
                                        disabled={isLoading}
                                        style={{
                                            flex: 1,
                                            minHeight: 50,
                                            borderRadius: 14,
                                            border: '1px solid var(--app-accent)',
                                            background: 'transparent',
                                            color: 'var(--app-accent-text)',
                                            fontWeight: 800,
                                            fontSize: 14,
                                            cursor: 'pointer',
                                        }}
                                    >
                                        {t('booking.postpone')}
                                    </button>
                                </div>
                            </>
                        )}

                    {step === 'success' && (
                        <div
                            style={{
                                textAlign: 'center',
                                padding: '34px 10px',
                            }}
                        >
                            <div
                                style={{
                                    width: 64,
                                    height: 64,
                                    margin: '0 auto 18px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    borderRadius: '50%',
                                    background:
                                        'rgba(77,208,139,0.12)',
                                    color: '#8ee5b5',
                                }}
                            >
                                <Check size={30} />
                            </div>

                            <h2>{t('booking.successTitle')}</h2>

                            <p
                                style={{
                                    color: 'var(--app-text-dim3)',
                                    lineHeight: 1.6,
                                }}
                            >
                                {t('booking.successText')}
                            </p>

                            {/* Напоминание перед визитом — главная польза
                                уведомлений, поэтому и просим о них здесь. */}
                            {isPushSupported() &&
                                pushPermission() === 'default' &&
                                !pushAsked && (
                                    <div
                                        style={{
                                            padding: '16px 18px',
                                            marginBottom: 18,
                                            borderRadius: 15,
                                            border: '1px solid rgba(var(--app-accent-rgb), 0.3)',
                                            background: 'rgba(var(--app-accent-rgb), 0.08)',
                                        }}
                                    >
                                        <p
                                            style={{
                                                margin: 0,
                                                color: 'var(--app-text)',
                                                fontSize: 14,
                                                lineHeight: 1.55,
                                            }}
                                        >
                                            {t('booking.pushOffer')}
                                        </p>

                                        <button
                                            type="button"
                                            onClick={async () => {
                                                const ok = await subscribeToPush();

                                                setPushOn(ok);
                                                setPushAsked(true);
                                            }}
                                            style={{
                                                width: '100%',
                                                minHeight: 44,
                                                marginTop: 12,
                                                borderRadius: 12,
                                                border: 0,
                                                background: 'var(--app-accent)',
                                                color: 'var(--app-bg)',
                                                fontSize: 14,
                                                fontWeight: 800,
                                                cursor: 'pointer',
                                            }}
                                        >
                                            {t('booking.pushEnable')}
                                        </button>
                                    </div>
                                )}

                            {pushOn && (
                                <p
                                    style={{
                                        margin: '0 0 18px',
                                        color: 'var(--app-accent-text)',
                                        fontSize: 13.5,
                                        fontWeight: 700,
                                    }}
                                >
                                    {t('booking.pushDone')}
                                </p>
                            )}

                            {/* Без этих кнопок экран успеха был тупиком:
                                клиент регистрировался и не знал, куда идти. */}
                            <div
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 10,
                                    marginTop: 24,
                                }}
                            >
                                <a
                                    href="/"
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        minHeight: 50,
                                        borderRadius: 15,
                                        background: 'var(--app-accent)',
                                        color: 'var(--app-bg)',
                                        fontSize: 14,
                                        fontWeight: 700,
                                        textDecoration: 'none',
                                    }}
                                >
                                    {t('clientCabinet.title')}
                                </a>

                                <button
                                    type="button"
                                    onClick={() => window.location.reload()}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        minHeight: 50,
                                        borderRadius: 15,
                                        border: '1px solid rgba(var(--app-overlay-rgb), 0.12)',
                                        background: 'rgba(var(--app-overlay-rgb), 0.05)',
                                        color: 'var(--app-text, var(--app-text))',
                                        fontSize: 14,
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                    }}
                                >
                                    {t('booking.bookAgain')}
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 'error' && (
                        <div
                            style={{
                                textAlign: 'center',
                                padding: '34px 10px',
                            }}
                        >
                            <h2>{t('booking.linkUnavailable')}</h2>

                            <p
                                style={{
                                    color: 'var(--app-danger-soft)',
                                    lineHeight: 1.6,
                                }}
                            >
                                {errorMessage}
                            </p>
                        </div>
                    )}
                </div>
            </section>

            <style>
                {`
          @keyframes public-booking-spin {
            to {
              transform: rotate(360deg);
            }
          }

          input {
            box-sizing: border-box;
            width: 100%;
            min-height: 46px;
            padding: 0 13px;
            border: 1px solid rgba(var(--app-overlay-rgb), 0.12);
            border-radius: 13px;
            background: rgba(var(--app-overlay-rgb), 0.06);
            color: var(--app-text);
            font-size: 14px;
            outline: none;
          }

          input:focus {
            border-color: rgba(var(--app-accent-rgb), 0.7);
          }

          input::placeholder {
            color: #817982;
          }
        `}
            </style>
        </main>
    );
}

export default PublicBookingPage;