import {
    AlertCircle,
    ArrowRight,
    Check,
    CheckCircle2,
    Eye,
    EyeOff,
    Languages,
    LoaderCircle,
    LockKeyhole,
    Mail,
    Phone,
    Scissors,
    ShieldCheck,
    UserRound,
} from 'lucide-react';
import {
    type ChangeEvent,
    type FormEvent,
    useEffect,
    useMemo,
    useState,
} from 'react';
import axios from 'axios';
import {
    completeMasterRegistration,
    resolveMasterRegistration,
    type ResolveRegistrationResponse,
} from '../api/masterRegistration';

type SupportedLanguage = 'ru' | 'ro' | 'en';

type RegistrationForm = {
    firstName: string;
    lastName: string;
    phone: string;
    email: string;
    password: string;
    confirmPassword: string;
    preferredLanguage: SupportedLanguage;
    acceptTerms: boolean;
};

type RegistrationErrors = Partial<Record<keyof RegistrationForm, string>>;

type PageStatus =
    | 'resolving'
    | 'ready'
    | 'submitting'
    | 'success'
    | 'invalid-link'
    | 'error';

const initialForm: RegistrationForm = {
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    password: '',
    confirmPassword: '',
    preferredLanguage: 'ru',
    acceptTerms: false,
};

const languageOptions: Array<{
    value: SupportedLanguage;
    label: string;
}> = [
        { value: 'ru', label: 'Русский' },
        { value: 'ro', label: 'Română' },
        { value: 'en', label: 'English' },
    ];

function getHashSearchParams(): URLSearchParams {
    const hash = window.location.hash;
    const queryIndex = hash.indexOf('?');

    if (queryIndex === -1) {
        return new URLSearchParams();
    }

    return new URLSearchParams(hash.slice(queryIndex + 1));
}

function getRegistrationIdentifier(): string {
    const searchParams = getHashSearchParams();

    return (
        searchParams.get('invite') ??
        searchParams.get('identifier') ??
        searchParams.get('code') ??
        ''
    ).trim();
}

function normalizeName(value: string): string {
    return value
        .replace(/\s+/g, ' ')
        .replace(/[^\p{L}\p{M}' -]/gu, '')
        .slice(0, 100);
}

function normalizePhone(value: string): string {
    const cleaned = value.replace(/[^\d+()\-\s]/g, '');

    return cleaned.slice(0, 30);
}

function normalizeEmail(value: string): string {
    return value.trim().toLowerCase().slice(0, 254);
}

function isValidEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidPhone(value: string): boolean {
    const digits = value.replace(/\D/g, '');

    return digits.length >= 8 && digits.length <= 15;
}

function getPasswordStrength(password: string): number {
    let score = 0;

    if (password.length >= 8) {
        score += 1;
    }

    if (/[a-zа-яăâîșț]/i.test(password)) {
        score += 1;
    }

    if (/\d/.test(password)) {
        score += 1;
    }

    if (/[^a-zа-яăâîșț0-9]/i.test(password)) {
        score += 1;
    }

    return score;
}

function getPasswordStrengthLabel(score: number): string {
    if (score <= 1) {
        return 'Слабый пароль';
    }

    if (score === 2) {
        return 'Средний пароль';
    }

    if (score === 3) {
        return 'Хороший пароль';
    }

    return 'Надёжный пароль';
}

function getApiErrorMessage(error: unknown): string {
    if (!axios.isAxiosError(error)) {
        return 'Произошла непредвиденная ошибка. Попробуйте ещё раз.';
    }

    const responseData = error.response?.data as
        | {
            message?: string | string[];
            error?: string;
        }
        | undefined;

    if (Array.isArray(responseData?.message)) {
        return responseData.message.join(' ');
    }

    if (typeof responseData?.message === 'string') {
        return responseData.message;
    }

    if (typeof responseData?.error === 'string') {
        return responseData.error;
    }

    if (!error.response) {
        return 'Не удалось связаться с сервером. Проверьте подключение к интернету.';
    }

    if (error.response.status === 400) {
        return 'Проверьте правильность заполнения формы.';
    }

    if (error.response.status === 404) {
        return 'Ссылка регистрации не найдена или больше не действует.';
    }

    if (error.response.status === 409) {
        return 'Пользователь с таким телефоном или электронной почтой уже зарегистрирован.';
    }

    if (error.response.status === 429) {
        return 'Слишком много попыток. Подождите немного и попробуйте снова.';
    }

    return 'Не удалось завершить регистрацию. Попробуйте ещё раз.';
}

function PublicMasterRegistrationPage() {
    const [status, setStatus] = useState<PageStatus>('resolving');
    const [registrationData, setRegistrationData] =
        useState<ResolveRegistrationResponse | null>(null);
    const [form, setForm] = useState<RegistrationForm>(initialForm);
    const [errors, setErrors] = useState<RegistrationErrors>({});
    const [pageError, setPageError] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [registeredEmail, setRegisteredEmail] = useState('');

    const identifier = useMemo(getRegistrationIdentifier, []);
    const passwordStrength = useMemo(
        () => getPasswordStrength(form.password),
        [form.password],
    );

    useEffect(() => {
        let isMounted = true;

        async function resolveRegistrationLink() {
            if (!identifier) {
                setPageError(
                    'В адресе отсутствует код приглашения для регистрации мастера.',
                );
                setStatus('invalid-link');
                return;
            }

            try {
                setStatus('resolving');
                setPageError('');

                const searchParams = getHashSearchParams();

                const response = await resolveMasterRegistration(identifier, {
                    visitorToken:
                        localStorage.getItem('glamour_promotion_visitor_token') ??
                        undefined,
                    fingerprint:
                        navigator.userAgent.slice(0, 500) || undefined,
                    utmSource: searchParams.get('utm_source') ?? undefined,
                    utmMedium: searchParams.get('utm_medium') ?? undefined,
                    utmCampaign: searchParams.get('utm_campaign') ?? undefined,
                    utmContent: searchParams.get('utm_content') ?? undefined,
                    utmTerm: searchParams.get('utm_term') ?? undefined,
                });

                if (!isMounted) {
                    return;
                }

                if (!response.success || !response.visitId) {
                    setPageError(
                        'Ссылка регистрации не может быть использована.',
                    );
                    setStatus('invalid-link');
                    return;
                }

                setRegistrationData(response);
                setStatus('ready');
            } catch (error) {
                if (!isMounted) {
                    return;
                }

                setPageError(getApiErrorMessage(error));
                setStatus('invalid-link');
            }
        }

        void resolveRegistrationLink();

        return () => {
            isMounted = false;
        };
    }, [identifier]);

    function updateField<K extends keyof RegistrationForm>(
        field: K,
        value: RegistrationForm[K],
    ) {
        setForm((current) => ({
            ...current,
            [field]: value,
        }));

        if (errors[field]) {
            setErrors((current) => ({
                ...current,
                [field]: undefined,
            }));
        }

        if (pageError) {
            setPageError('');
        }
    }

    function handleTextChange(
        event: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
    ) {
        const { name, value } = event.target;
        const field = name as keyof RegistrationForm;

        if (field === 'firstName' || field === 'lastName') {
            updateField(field, normalizeName(value));
            return;
        }

        if (field === 'phone') {
            updateField('phone', normalizePhone(value));
            return;
        }

        if (field === 'email') {
            updateField('email', value.slice(0, 254));
            return;
        }

        if (field === 'preferredLanguage') {
            updateField(
                'preferredLanguage',
                value as SupportedLanguage,
            );
            return;
        }

        if (field === 'password' || field === 'confirmPassword') {
            updateField(field, value.slice(0, 128));
        }
    }
    function validateForm(): boolean {
        const nextErrors: RegistrationErrors = {};
        const firstName = form.firstName.trim();
        const lastName = form.lastName.trim();
        const phone = form.phone.trim();
        const email = normalizeEmail(form.email);

        if (firstName.length < 2) {
            nextErrors.firstName = 'Введите имя мастера.';
        }

        if (lastName.length < 2) {
            nextErrors.lastName = 'Введите фамилию мастера.';
        }

        if (!isValidPhone(phone)) {
            nextErrors.phone =
                'Введите корректный номер телефона: от 8 до 15 цифр.';
        }

        if (!isValidEmail(email)) {
            nextErrors.email = 'Введите корректный адрес электронной почты.';
        }

        if (form.password.length < 8) {
            nextErrors.password =
                'Пароль должен содержать не менее 8 символов.';
        } else if (!/[a-zа-яăâîșț]/i.test(form.password)) {
            nextErrors.password =
                'Добавьте в пароль хотя бы одну букву.';
        } else if (!/\d/.test(form.password)) {
            nextErrors.password =
                'Добавьте в пароль хотя бы одну цифру.';
        }

        if (form.confirmPassword !== form.password) {
            nextErrors.confirmPassword = 'Пароли не совпадают.';
        }

        if (!form.acceptTerms) {
            nextErrors.acceptTerms =
                'Для регистрации необходимо принять условия использования.';
        }

        setErrors(nextErrors);

        return Object.keys(nextErrors).length === 0;
    }

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (status === 'submitting' || !registrationData) {
            return;
        }

        setPageError('');

        if (!validateForm()) {
            return;
        }

        try {
            setStatus('submitting');

            const email = normalizeEmail(form.email);

            const response = await completeMasterRegistration(identifier, {
                visitId: registrationData.visitId,
                firstName: form.firstName.trim(),
                lastName: form.lastName.trim(),
                phone: form.phone.trim(),
                email,
                password: form.password,
                preferredLanguage: form.preferredLanguage,
            });

            setRegisteredEmail(response.user.email || email);
            setStatus('success');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (error) {
            setPageError(getApiErrorMessage(error));
            setStatus('ready');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }

    function handleLoginNavigation() {
        window.location.hash = '#login';
    }

    function renderBrandMark() {
        const salonLogo = registrationData?.salon.logoUrl;

        if (salonLogo) {
            return (
                <img
                    className="registration-brand-logo"
                    src={salonLogo}
                    alt={`Логотип салона ${registrationData.salon.name}`}
                    loading="eager"
                    referrerPolicy="no-referrer"
                />
            );
        }

        return (
            <div
                className="registration-brand-placeholder"
                aria-hidden="true"
            >
                <Scissors size={34} strokeWidth={1.8} />
            </div>
        );
    }

    if (status === 'resolving') {
        return (
            <main className="registration-page">
                <section
                    className="registration-status-card"
                    aria-live="polite"
                >
                    <div className="registration-status-icon">
                        <LoaderCircle
                            size={38}
                            className="registration-spinner"
                        />
                    </div>

                    <p className="registration-eyebrow">
                        GLAMOUR SALON STUDIO
                    </p>

                    <h1>Проверяем приглашение</h1>

                    <p>
                        Подождите несколько секунд. Мы проверяем ссылку и
                        загружаем данные салона.
                    </p>
                </section>
            </main>
        );
    }

    if (status === 'invalid-link' || status === 'error') {
        return (
            <main className="registration-page">
                <section
                    className="registration-status-card registration-status-card-error"
                    role="alert"
                >
                    <div className="registration-status-icon">
                        <AlertCircle size={40} />
                    </div>

                    <p className="registration-eyebrow">
                        GLAMOUR SALON STUDIO
                    </p>

                    <h1>Регистрация недоступна</h1>

                    <p>
                        {pageError ||
                            'Эта ссылка регистрации недействительна или больше не активна.'}
                    </p>

                    <div className="registration-status-actions">
                        <button
                            type="button"
                            className="registration-secondary-button"
                            onClick={() => window.location.reload()}
                        >
                            Проверить ещё раз
                        </button>

                        <button
                            type="button"
                            className="registration-primary-button"
                            onClick={handleLoginNavigation}
                        >
                            Перейти ко входу
                            <ArrowRight size={18} />
                        </button>
                    </div>
                </section>
            </main>
        );
    }

    if (status === 'success') {
        const salonName =
            registrationData?.salon.name || 'салоне';

        return (
            <main className="registration-page">
                <section
                    className="registration-status-card registration-status-card-success"
                    aria-live="polite"
                >
                    <div className="registration-success-badge">
                        <CheckCircle2 size={46} />
                    </div>

                    <p className="registration-eyebrow">
                        РЕГИСТРАЦИЯ ЗАВЕРШЕНА
                    </p>

                    <h1>Ваш аккаунт мастера создан</h1>

                    <p>
                        Вы успешно зарегистрированы в салоне{' '}
                        <strong>{salonName}</strong>. Теперь можно войти в
                        GLAMOUR Salon Studio и заполнить профиль мастера.
                    </p>

                    {registeredEmail && (
                        <div className="registration-success-email">
                            <Mail size={18} />
                            <span>{registeredEmail}</span>
                        </div>
                    )}

                    <div className="registration-success-steps">
                        <div>
                            <span>
                                <Check size={16} />
                            </span>
                            <p>Аккаунт пользователя создан</p>
                        </div>

                        <div>
                            <span>
                                <Check size={16} />
                            </span>
                            <p>Доступ к салону подключён</p>
                        </div>

                        <div>
                            <span>
                                <Check size={16} />
                            </span>
                            <p>Профиль мастера подготовлен</p>
                        </div>
                    </div>

                    <button
                        type="button"
                        className="registration-primary-button"
                        onClick={handleLoginNavigation}
                    >
                        Войти в аккаунт
                        <ArrowRight size={18} />
                    </button>
                </section>
            </main>
        );
    }

    return (
        <main className="registration-page">
            <div className="registration-shell">
                <aside className="registration-visual-panel">
                    <div className="registration-brand">
                        {renderBrandMark()}

                        <div>
                            <h2 className="registration-brand-title">
                                <span>GLAMOUR</span> Salon-Studio
                            </h2>
                        </div>
                    </div>

                    <div className="registration-visual-content">
                        <p className="registration-eyebrow">
                            ВАС ПРИГЛАСИЛИ В КОМАНДУ
                        </p>

                        <h1>
                            <span>GLAMOUR</span>
                            <small>Salon-Studio</small>
                        </h1>

                        <div
                            className="registration-title-divider"
                            aria-hidden="true"
                        >
                            <span />
                            <i />
                            <span />
                        </div>

                        <p className="registration-visual-description">
                            Создавайте красоту вместе с нами.
                        </p>

                        <div className="registration-benefits">
                            <div className="registration-benefit">
                                <span>
                                    <Scissors size={19} />
                                </span>
                                <div>
                                    <strong>Персональный профиль</strong>
                                    <p>
                                        Ваши услуги, цены, специализация и
                                        рабочая информация.
                                    </p>
                                </div>
                            </div>

                            <div className="registration-benefit">
                                <span>
                                    <UserRound size={19} />
                                </span>
                                <div>
                                    <strong>Удобная работа с клиентами</strong>
                                    <p>
                                        Записи, история посещений и важная
                                        информация всегда под рукой.
                                    </p>
                                </div>
                            </div>

                            <div className="registration-benefit">
                                <span>
                                    <ShieldCheck size={19} />
                                </span>
                                <div>
                                    <strong>Защищённый доступ</strong>
                                    <p>
                                        Данные аккаунта и права доступа
                                        контролируются системой безопасности.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="registration-visual-footer">
                        <LockKeyhole size={16} />
                        <span>
                            Защищённая регистрация по персональному приглашению
                        </span>
                    </div>
                </aside>

                <section className="registration-form-panel">
                    <div className="registration-form-container">
                        <header className="registration-form-header">
                            <p className="registration-eyebrow">
                                СОЗДАНИЕ АККАУНТА
                            </p>

                            <h2>Регистрация мастера</h2>

                            <p>
                                Заполните данные точно так, как они должны
                                отображаться в вашем рабочем профиле.
                            </p>
                        </header>

                        {pageError && (
                            <div
                                className="registration-alert"
                                role="alert"
                            >
                                <AlertCircle size={20} />
                                <span>{pageError}</span>
                            </div>
                        )}

                        <form
                            className="registration-form"
                            onSubmit={handleSubmit}
                            noValidate
                        >
                            <div className="registration-form-grid">
                                <div className="registration-field">
                                    <label htmlFor="firstName">
                                        Имя
                                        <span aria-hidden="true">*</span>
                                    </label>

                                    <div
                                        className={`registration-input-wrapper ${errors.firstName
                                            ? 'registration-input-wrapper-error'
                                            : ''
                                            }`}
                                    >
                                        <UserRound size={18} />

                                        <input
                                            id="firstName"
                                            name="firstName"
                                            type="text"
                                            autoComplete="given-name"
                                            value={form.firstName}
                                            onChange={handleTextChange}
                                            placeholder="Введите имя"
                                            maxLength={100}
                                            disabled={status === 'submitting'}
                                            aria-invalid={Boolean(
                                                errors.firstName,
                                            )}
                                            aria-describedby={
                                                errors.firstName
                                                    ? 'firstName-error'
                                                    : undefined
                                            }
                                        />
                                    </div>

                                    {errors.firstName && (
                                        <p
                                            id="firstName-error"
                                            className="registration-field-error"
                                        >
                                            {errors.firstName}
                                        </p>
                                    )}
                                </div>

                                <div className="registration-field">
                                    <label htmlFor="lastName">
                                        Фамилия
                                        <span aria-hidden="true">*</span>
                                    </label>

                                    <div
                                        className={`registration-input-wrapper ${errors.lastName
                                            ? 'registration-input-wrapper-error'
                                            : ''
                                            }`}
                                    >
                                        <UserRound size={18} />

                                        <input
                                            id="lastName"
                                            name="lastName"
                                            type="text"
                                            autoComplete="family-name"
                                            value={form.lastName}
                                            onChange={handleTextChange}
                                            placeholder="Введите фамилию"
                                            maxLength={100}
                                            disabled={status === 'submitting'}
                                            aria-invalid={Boolean(
                                                errors.lastName,
                                            )}
                                            aria-describedby={
                                                errors.lastName
                                                    ? 'lastName-error'
                                                    : undefined
                                            }
                                        />
                                    </div>

                                    {errors.lastName && (
                                        <p
                                            id="lastName-error"
                                            className="registration-field-error"
                                        >
                                            {errors.lastName}
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="registration-field">
                                <label htmlFor="phone">
                                    Номер телефона
                                    <span aria-hidden="true">*</span>
                                </label>

                                <div
                                    className={`registration-input-wrapper ${errors.phone
                                        ? 'registration-input-wrapper-error'
                                        : ''
                                        }`}
                                >
                                    <Phone size={18} />

                                    <input
                                        id="phone"
                                        name="phone"
                                        type="tel"
                                        inputMode="tel"
                                        autoComplete="tel"
                                        value={form.phone}
                                        onChange={handleTextChange}
                                        placeholder="+373 00 000 000"
                                        maxLength={30}
                                        disabled={status === 'submitting'}
                                        aria-invalid={Boolean(errors.phone)}
                                        aria-describedby={
                                            errors.phone
                                                ? 'phone-error'
                                                : 'phone-help'
                                        }
                                    />
                                </div>

                                {errors.phone ? (
                                    <p
                                        id="phone-error"
                                        className="registration-field-error"
                                    >
                                        {errors.phone}
                                    </p>
                                ) : (
                                    <p
                                        id="phone-help"
                                        className="registration-field-help"
                                    >
                                        Укажите номер, который будет
                                        использоваться для связи и входа.
                                    </p>
                                )}
                            </div>

                            <div className="registration-field">
                                <label htmlFor="email">
                                    Электронная почта
                                    <span aria-hidden="true">*</span>
                                </label>

                                <div
                                    className={`registration-input-wrapper ${errors.email
                                        ? 'registration-input-wrapper-error'
                                        : ''
                                        }`}
                                >
                                    <Mail size={18} />

                                    <input
                                        id="email"
                                        name="email"
                                        type="email"
                                        inputMode="email"
                                        autoComplete="email"
                                        value={form.email}
                                        onChange={handleTextChange}
                                        onBlur={() =>
                                            updateField(
                                                'email',
                                                normalizeEmail(form.email),
                                            )
                                        }
                                        placeholder="name@example.com"
                                        maxLength={254}
                                        disabled={status === 'submitting'}
                                        aria-invalid={Boolean(errors.email)}
                                        aria-describedby={
                                            errors.email
                                                ? 'email-error'
                                                : undefined
                                        }
                                    />
                                </div>

                                {errors.email && (
                                    <p
                                        id="email-error"
                                        className="registration-field-error"
                                    >
                                        {errors.email}
                                    </p>
                                )}
                            </div>

                            <div className="registration-field">
                                <label htmlFor="preferredLanguage">
                                    Язык интерфейса
                                </label>

                                <div className="registration-input-wrapper registration-select-wrapper">
                                    <Languages size={18} />

                                    <select
                                        id="preferredLanguage"
                                        name="preferredLanguage"
                                        value={form.preferredLanguage}
                                        onChange={handleTextChange}
                                        disabled={status === 'submitting'}
                                    >
                                        {languageOptions.map((language) => (
                                            <option
                                                key={language.value}
                                                value={language.value}
                                            >
                                                {language.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="registration-field">
                                <label htmlFor="password">
                                    Пароль
                                    <span aria-hidden="true">*</span>
                                </label>

                                <div
                                    className={`registration-input-wrapper ${errors.password
                                        ? 'registration-input-wrapper-error'
                                        : ''
                                        }`}
                                >
                                    <LockKeyhole size={18} />

                                    <input
                                        id="password"
                                        name="password"
                                        type={
                                            showPassword ? 'text' : 'password'
                                        }
                                        autoComplete="new-password"
                                        value={form.password}
                                        onChange={handleTextChange}
                                        placeholder="Не менее 8 символов"
                                        maxLength={128}
                                        disabled={status === 'submitting'}
                                        aria-invalid={Boolean(errors.password)}
                                        aria-describedby={
                                            errors.password
                                                ? 'password-error'
                                                : 'password-help'
                                        }
                                    />

                                    <button
                                        type="button"
                                        className="registration-password-toggle"
                                        onClick={() =>
                                            setShowPassword((current) => !current)
                                        }
                                        disabled={status === 'submitting'}
                                        aria-label={
                                            showPassword
                                                ? 'Скрыть пароль'
                                                : 'Показать пароль'
                                        }
                                    >
                                        {showPassword ? (
                                            <EyeOff size={18} />
                                        ) : (
                                            <Eye size={18} />
                                        )}
                                    </button>
                                </div>

                                {errors.password ? (
                                    <p
                                        id="password-error"
                                        className="registration-field-error"
                                    >
                                        {errors.password}
                                    </p>
                                ) : (
                                    <div
                                        id="password-help"
                                        className="registration-password-strength"
                                    >
                                        <div
                                            className="registration-password-bars"
                                            aria-hidden="true"
                                        >
                                            {[1, 2, 3, 4].map((level) => (
                                                <span
                                                    key={level}
                                                    className={
                                                        passwordStrength >= level
                                                            ? 'is-active'
                                                            : ''
                                                    }
                                                />
                                            ))}
                                        </div>

                                        <span>
                                            {form.password
                                                ? getPasswordStrengthLabel(
                                                    passwordStrength,
                                                )
                                                : 'Используйте буквы и цифры'}
                                        </span>
                                    </div>
                                )}
                            </div>

                            <div className="registration-field">
                                <label htmlFor="confirmPassword">
                                    Повторите пароль
                                    <span aria-hidden="true">*</span>
                                </label>

                                <div
                                    className={`registration-input-wrapper ${errors.confirmPassword
                                        ? 'registration-input-wrapper-error'
                                        : ''
                                        }`}
                                >
                                    <LockKeyhole size={18} />

                                    <input
                                        id="confirmPassword"
                                        name="confirmPassword"
                                        type={
                                            showConfirmPassword
                                                ? 'text'
                                                : 'password'
                                        }
                                        autoComplete="new-password"
                                        value={form.confirmPassword}
                                        onChange={handleTextChange}
                                        placeholder="Введите пароль ещё раз"
                                        maxLength={128}
                                        disabled={status === 'submitting'}
                                        aria-invalid={Boolean(
                                            errors.confirmPassword,
                                        )}
                                        aria-describedby={
                                            errors.confirmPassword
                                                ? 'confirmPassword-error'
                                                : undefined
                                        }
                                    />

                                    <button
                                        type="button"
                                        className="registration-password-toggle"
                                        onClick={() =>
                                            setShowConfirmPassword(
                                                (current) => !current,
                                            )
                                        }
                                        disabled={status === 'submitting'}
                                        aria-label={
                                            showConfirmPassword
                                                ? 'Скрыть повторный пароль'
                                                : 'Показать повторный пароль'
                                        }
                                    >
                                        {showConfirmPassword ? (
                                            <EyeOff size={18} />
                                        ) : (
                                            <Eye size={18} />
                                        )}
                                    </button>
                                </div>

                                {errors.confirmPassword && (
                                    <p
                                        id="confirmPassword-error"
                                        className="registration-field-error"
                                    >
                                        {errors.confirmPassword}
                                    </p>
                                )}
                            </div>
                            <div className="registration-checkbox-field">
                                <label className="registration-checkbox-label">
                                    <input
                                        type="checkbox"
                                        checked={form.acceptTerms}
                                        onChange={(event) =>
                                            updateField(
                                                'acceptTerms',
                                                event.target.checked,
                                            )
                                        }
                                        disabled={status === 'submitting'}
                                        aria-invalid={Boolean(
                                            errors.acceptTerms,
                                        )}
                                        aria-describedby={
                                            errors.acceptTerms
                                                ? 'acceptTerms-error'
                                                : undefined
                                        }
                                    />

                                    <span
                                        className="registration-checkbox-control"
                                        aria-hidden="true"
                                    >
                                        <Check size={14} />
                                    </span>

                                    <span>
                                        Я подтверждаю правильность указанных
                                        данных и принимаю условия использования
                                        GLAMOUR Salon Studio.
                                    </span>
                                </label>

                                {errors.acceptTerms && (
                                    <p
                                        id="acceptTerms-error"
                                        className="registration-field-error"
                                    >
                                        {errors.acceptTerms}
                                    </p>
                                )}
                            </div>

                            <button
                                type="submit"
                                className="registration-primary-button registration-submit-button"
                                disabled={status === 'submitting'}
                            >
                                {status === 'submitting' ? (
                                    <>
                                        <LoaderCircle
                                            size={19}
                                            className="registration-spinner"
                                        />
                                        Создаём аккаунт…
                                    </>
                                ) : (
                                    <>
                                        Зарегистрироваться
                                        <ArrowRight size={19} />
                                    </>
                                )}
                            </button>

                            <div className="registration-security-note">
                                <ShieldCheck size={18} />

                                <p>
                                    Регистрация выполняется по защищённой
                                    персональной ссылке. Доступ будет привязан
                                    только к указанному салону.
                                </p>
                            </div>

                            <p className="registration-login-link">
                                Уже есть аккаунт?{' '}
                                <button
                                    type="button"
                                    onClick={handleLoginNavigation}
                                    disabled={status === 'submitting'}
                                >
                                    Войти
                                </button>
                            </p>
                        </form>
                    </div>
                </section>
            </div>
        </main>
    );
}

export default PublicMasterRegistrationPage;                      