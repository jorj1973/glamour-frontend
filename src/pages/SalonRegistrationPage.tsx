import {
  Building2,
  CheckCircle2,
  ChevronLeft,
  Clock3,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Sparkles,
  UserRound,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { FormEvent } from 'react';

import api from '../api/api';

type RegistrationStep =
  | 'loading'
  | 'invalid'
  | 'plan'
  | 'details'
  | 'submitted';

type PublicPlan = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  price: string;
  currency: string;
  billingPeriod: 'monthly' | 'yearly' | string;
  trialDays: number;
  maxMasters: number | null;
  maxAdministrators: number | null;
  maxLocations: number | null;
  features: unknown;
  isFeatured: boolean;
};

type PublicInvitationResponse = {
  invitation: {
    status: string;
    expiresAt: string;
    salonNameHint: string | null;
    invitedEmail: string | null;
    invitedPhone: string | null;
    selectedPlanId: string | null;
  };
  plans: PublicPlan[];
};

type SelectPlanResponse = {
  invitation: {
    status: string;
    expiresAt: string;
    selectedPlanId: string;
    planSelectedAt: string;
  };
  selectedPlan: PublicPlan;
};

type RegistrationResponse = {
  message: string;
  applicationStatus: string;
  nextStep: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    isActive: boolean;
  };
  salon: {
    id: string;
    name: string;
    status: string;
  };
  subscription: {
    id: string;
    status: string;
    trialStartedAt: string | null;
    trialEndsAt: string | null;
  };
  selectedPlan: PublicPlan;
};

type RegistrationFormState = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  salonName: string;
  legalName: string;
  salonEmail: string;
  salonPhone: string;
  timezone: string;
  preferredLanguage: 'ru' | 'ro' | 'en';
};

const INITIAL_FORM: RegistrationFormState = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  password: '',
  confirmPassword: '',
  salonName: '',
  legalName: '',
  salonEmail: '',
  salonPhone: '',
  timezone: 'Europe/Chisinau',
  preferredLanguage: 'ru',
};

function getInviteToken(): string {
  const hash = window.location.hash;

  if (!hash.startsWith('#register?')) {
    return '';
  }

  const query = hash.slice(hash.indexOf('?') + 1);
  const params = new URLSearchParams(query);

  return params.get('invite')?.trim() || '';
}

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'не указана';
  }

  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function getBillingLabel(period: string): string {
  return period === 'yearly' ? 'в год' : 'в месяц';
}

function getPlanFeatures(plan: PublicPlan): string[] {
  if (Array.isArray(plan.features)) {
    return plan.features
      .filter(
        (feature): feature is string =>
          typeof feature === 'string',
      )
      .slice(0, 8);
  }

  return [];
}

function SalonRegistrationPage() {
  const token = useMemo(() => getInviteToken(), []);

  const [step, setStep] =
    useState<RegistrationStep>('loading');

  const [invitation, setInvitation] =
    useState<PublicInvitationResponse['invitation'] | null>(
      null,
    );

  const [plans, setPlans] = useState<PublicPlan[]>([]);

  const [selectedPlan, setSelectedPlan] =
    useState<PublicPlan | null>(null);

  const [form, setForm] =
    useState<RegistrationFormState>(INITIAL_FORM);

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [errorMessage, setErrorMessage] = useState('');

  const [registrationResult, setRegistrationResult] =
    useState<RegistrationResponse | null>(null);

  const [showPassword, setShowPassword] =
    useState(false);

  const loadInvitation = useCallback(async () => {
    if (
      token.length !== 43 ||
      !/^[A-Za-z0-9_-]+$/.test(token)
    ) {
      setErrorMessage(
        'Ссылка приглашения имеет неправильный формат.',
      );
      setStep('invalid');
      return;
    }

    setErrorMessage('');
    setStep('loading');

    try {
      const response =
        await api.post<PublicInvitationResponse>(
          '/platform-registration/invitation',
          {
            token,
          },
        );

      setInvitation(response.data.invitation);
      setPlans(response.data.plans);

      const existingPlan =
        response.data.plans.find(
          (plan) =>
            plan.id ===
            response.data.invitation.selectedPlanId,
        ) || null;

      if (existingPlan) {
        setSelectedPlan(existingPlan);
        setStep('details');
      } else {
        setStep('plan');
      }

      if (response.data.invitation.salonNameHint) {
        setForm((current) => ({
          ...current,
          salonName:
            response.data.invitation.salonNameHint || '',
        }));
      }
    } catch {
      setErrorMessage(
        'Приглашение недействительно, уже использовано или срок его действия истёк.',
      );
      setStep('invalid');
    }
  }, [token]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadInvitation();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [loadInvitation]);

  function updateField(
    field: keyof RegistrationFormState,
    value: string,
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function choosePlan(plan: PublicPlan) {
    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const response =
        await api.post<SelectPlanResponse>(
          '/platform-registration/select-plan',
          {
            token,
            planId: plan.id,
          },
        );

      setSelectedPlan(response.data.selectedPlan);
      setStep('details');
      window.scrollTo({
        top: 0,
        behavior: 'smooth',
      });
    } catch {
      setErrorMessage(
        'Не удалось выбрать тариф. Обновите страницу и повторите попытку.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function returnToPlans() {
    setErrorMessage('');
    setStep('plan');
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }

  function validateForm(): string | null {
    if (form.password !== form.confirmPassword) {
      return 'Пароли не совпадают.';
    }

    if (form.password.length < 10) {
      return 'Пароль должен содержать минимум 10 символов.';
    }

    if (
      !/[a-z]/.test(form.password) ||
      !/[A-Z]/.test(form.password) ||
      !/\d/.test(form.password)
    ) {
      return 'Пароль должен содержать строчную и заглавную латинские буквы, а также цифру.';
    }

    if (!/^\+[1-9]\d{7,14}$/.test(form.phone.trim())) {
      return 'Телефон владельца укажите в международном формате, например +37360123456.';
    }

    if (
      form.salonPhone.trim() &&
      !/^\+[1-9]\d{7,14}$/.test(
        form.salonPhone.trim(),
      )
    ) {
      return 'Телефон салона укажите в международном формате.';
    }

    return null;
  }

  async function submitRegistration(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const validationError = validateForm();

    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    if (!selectedPlan) {
      setErrorMessage(
        'Сначала выберите тарифный план.',
      );
      setStep('plan');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    const payload: {
      token: string;
      firstName: string;
      lastName: string;
      email: string;
      phone: string;
      password: string;
      salonName: string;
      legalName?: string;
      salonEmail?: string;
      salonPhone?: string;
      timezone: string;
      preferredLanguage: 'ru' | 'ro' | 'en';
    } = {
      token,
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim().toLowerCase(),
      phone: form.phone.trim(),
      password: form.password,
      salonName: form.salonName.trim(),
      timezone: form.timezone.trim(),
      preferredLanguage: form.preferredLanguage,
    };

    if (form.legalName.trim()) {
      payload.legalName = form.legalName.trim();
    }

    if (form.salonEmail.trim()) {
      payload.salonEmail =
        form.salonEmail.trim().toLowerCase();
    }

    if (form.salonPhone.trim()) {
      payload.salonPhone =
        form.salonPhone.trim();
    }

    try {
      const response =
        await api.post<RegistrationResponse>(
          '/platform-registration/complete',
          payload,
        );

      setRegistrationResult(response.data);
      setForm(INITIAL_FORM);
      setStep('submitted');

      window.scrollTo({
        top: 0,
        behavior: 'smooth',
      });
    } catch {
      setErrorMessage(
        'Не удалось отправить заявку. Проверьте данные. Email или телефон уже могут быть зарегистрированы.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function openLogin() {
    window.location.hash = '';
  }

  return (
    <main className="registration-page">
      <section className="registration-shell">
        <header className="registration-header">
          <div className="registration-brand">
            <div className="registration-brand-icon">
              <Sparkles size={24} aria-hidden="true" />
            </div>

            <div>
              <span>GLAMOUR</span>
              <strong>Salon Studio</strong>
            </div>
          </div>

          <button
            type="button"
            className="registration-login-link"
            onClick={openLogin}
          >
            Уже зарегистрированы? Войти
          </button>
        </header>

        {step === 'loading' ? (
          <section className="registration-state-card">
            <div className="registration-state-icon">
              <Clock3 size={28} aria-hidden="true" />
            </div>

            <h1>Проверяем приглашение</h1>

            <p>
              Загружаем тарифы и данные для регистрации
              салона.
            </p>
          </section>
        ) : null}

        {step === 'invalid' ? (
          <section className="registration-state-card">
            <div className="registration-state-icon registration-state-icon-error">
              <ShieldCheck size={29} aria-hidden="true" />
            </div>

            <p className="registration-eyebrow">
              ПРИГЛАШЕНИЕ НЕДОСТУПНО
            </p>

            <h1>Регистрация по этой ссылке невозможна</h1>

            <p>{errorMessage}</p>

            <button
              type="button"
              className="registration-primary-button"
              onClick={openLogin}
            >
              Перейти ко входу
            </button>
          </section>
        ) : null}

        {step === 'submitted' ? (
          <section className="registration-state-card">
            <div className="registration-state-icon registration-state-icon-success">
              <CheckCircle2
                size={30}
                aria-hidden="true"
              />
            </div>

            <p className="registration-eyebrow">
              ЗАЯВКА ОТПРАВЛЕНА
            </p>

            <h1>Ожидайте одобрения владельца платформы</h1>

            <p>
              Данные салона{' '}
              <strong>
                {registrationResult?.salon.name ||
                  'успешно сохранены'}
              </strong>
              . Доступ и пробный период пока не запущены.
            </p>

            <div className="registration-waiting-details">
              <div>
                <span>Статус</span>
                <strong>Ожидает одобрения</strong>
              </div>

              <div>
                <span>Выбранный тариф</span>
                <strong>
                  {registrationResult?.selectedPlan.name ||
                    selectedPlan?.name ||
                    'Выбран'}
                </strong>
              </div>

              <div>
                <span>Пробный период</span>
                <strong>
                  Начнётся после одобрения
                </strong>
              </div>
            </div>

            <p className="registration-security-message">
              До одобрения вход в кабинет заблокирован.
              После активации используйте указанные при
              регистрации email и пароль.
            </p>

            <button
              type="button"
              className="registration-primary-button"
              onClick={openLogin}
            >
              Перейти ко входу
            </button>
          </section>
        ) : null}

        {step === 'plan' ? (
          <>
            <section className="registration-intro">
              <p className="registration-eyebrow">
                ШАГ 1 ИЗ 2
              </p>

              <h1>Выберите тариф для вашего салона</h1>

              <p>
                Пробный период начнётся только после
                проверки и одобрения заявки владельцем
                платформы.
              </p>

              {invitation ? (
                <div className="registration-invitation-summary">
                  <ShieldCheck
                    size={18}
                    aria-hidden="true"
                  />

                  <span>
                    Приглашение действительно до{' '}
                    <strong>
                      {formatDate(invitation.expiresAt)}
                    </strong>
                  </span>

                  {invitation.salonNameHint ? (
                    <span>
                      Салон:{' '}
                      <strong>
                        {invitation.salonNameHint}
                      </strong>
                    </span>
                  ) : null}
                </div>
              ) : null}
            </section>

            {errorMessage ? (
              <div
                className="registration-error"
                role="alert"
              >
                {errorMessage}
              </div>
            ) : null}

            {plans.length === 0 ? (
              <section className="registration-state-card">
                <h2>Тарифы временно недоступны</h2>

                <p>
                  Владелец платформы ещё не опубликовал
                  тарифные планы. Обратитесь к отправителю
                  приглашения.
                </p>
              </section>
            ) : (
              <section className="registration-plans">
                {plans.map((plan) => {
                  const features = getPlanFeatures(plan);

                  return (
                    <article
                      key={plan.id}
                      className={
                        plan.isFeatured
                          ? 'registration-plan-card registration-plan-featured'
                          : 'registration-plan-card'
                      }
                    >
                      {plan.isFeatured ? (
                        <span className="registration-plan-badge">
                          Рекомендуемый
                        </span>
                      ) : null}

                      <div className="registration-plan-heading">
                        <h2>{plan.name}</h2>

                        {plan.description ? (
                          <p>{plan.description}</p>
                        ) : null}
                      </div>

                      <div className="registration-plan-price">
                        <strong>{plan.price}</strong>

                        <span>
                          {plan.currency}{' '}
                          {getBillingLabel(
                            plan.billingPeriod,
                          )}
                        </span>
                      </div>

                      <div className="registration-trial">
                        <Clock3
                          size={16}
                          aria-hidden="true"
                        />

                        {plan.trialDays} дней бесплатного
                        периода
                      </div>

                      <ul>
                        {plan.maxMasters ? (
                          <li>
                            До {plan.maxMasters} мастеров
                          </li>
                        ) : null}

                        {plan.maxAdministrators ? (
                          <li>
                            До {plan.maxAdministrators}{' '}
                            администраторов
                          </li>
                        ) : null}

                        {plan.maxLocations ? (
                          <li>
                            До {plan.maxLocations} филиалов
                          </li>
                        ) : null}

                        {features.map((feature) => (
                          <li key={feature}>{feature}</li>
                        ))}
                      </ul>

                      <button
                        type="button"
                        className="registration-primary-button"
                        disabled={isSubmitting}
                        onClick={() =>
                          void choosePlan(plan)
                        }
                      >
                        {isSubmitting
                          ? 'Сохраняем выбор…'
                          : 'Выбрать тариф'}
                      </button>
                    </article>
                  );
                })}
              </section>
            )}
          </>
        ) : null}

        {step === 'details' && selectedPlan ? (
          <>
            <section className="registration-intro">
              <button
                type="button"
                className="registration-back-button"
                onClick={returnToPlans}
                disabled={isSubmitting}
              >
                <ChevronLeft
                  size={18}
                  aria-hidden="true"
                />
                Изменить тариф
              </button>

              <p className="registration-eyebrow">
                ШАГ 2 ИЗ 2
              </p>

              <h1>Заполните данные владельца и салона</h1>

              <p>
                После отправки заявка будет ожидать
                одобрения. Пробный период не расходуется во
                время проверки.
              </p>

              <div className="registration-selected-plan">
                <div>
                  <span>Выбранный тариф</span>
                  <strong>{selectedPlan.name}</strong>
                </div>

                <div>
                  <span>Стоимость</span>
                  <strong>
                    {selectedPlan.price}{' '}
                    {selectedPlan.currency}{' '}
                    {getBillingLabel(
                      selectedPlan.billingPeriod,
                    )}
                  </strong>
                </div>

                <div>
                  <span>Пробный период</span>
                  <strong>
                    {selectedPlan.trialDays} дней после
                    одобрения
                  </strong>
                </div>
              </div>
            </section>

            <form
              className="registration-form"
              onSubmit={submitRegistration}
            >
              <section className="registration-form-card">
                <div className="registration-form-heading">
                  <div className="registration-section-icon">
                    <UserRound
                      size={20}
                      aria-hidden="true"
                    />
                  </div>

                  <div>
                    <h2>Данные владельца</h2>
                    <p>
                      Эти данные будут использоваться для
                      входа в кабинет.
                    </p>
                  </div>
                </div>

                <div className="registration-form-grid">
                  <label>
                    <span>Имя *</span>
                    <input
                      type="text"
                      value={form.firstName}
                      onChange={(event) =>
                        updateField(
                          'firstName',
                          event.target.value,
                        )
                      }
                      maxLength={80}
                      autoComplete="given-name"
                      required
                    />
                  </label>

                  <label>
                    <span>Фамилия *</span>
                    <input
                      type="text"
                      value={form.lastName}
                      onChange={(event) =>
                        updateField(
                          'lastName',
                          event.target.value,
                        )
                      }
                      maxLength={80}
                      autoComplete="family-name"
                      required
                    />
                  </label>

                  <label>
                    <span>Email для входа *</span>
                    <div className="registration-input-icon">
                      <Mail
                        size={17}
                        aria-hidden="true"
                      />

                      <input
                        type="email"
                        value={form.email}
                        onChange={(event) =>
                          updateField(
                            'email',
                            event.target.value,
                          )
                        }
                        maxLength={254}
                        autoComplete="email"
                        required
                      />
                    </div>
                  </label>

                  <label>
                    <span>Телефон владельца *</span>
                    <div className="registration-input-icon">
                      <Phone
                        size={17}
                        aria-hidden="true"
                      />

                      <input
                        type="tel"
                        value={form.phone}
                        onChange={(event) =>
                          updateField(
                            'phone',
                            event.target.value,
                          )
                        }
                        placeholder="+37360123456"
                        autoComplete="tel"
                        required
                      />
                    </div>
                  </label>

                  <label>
                    <span>Пароль *</span>
                    <div className="registration-input-icon">
                      <LockKeyhole
                        size={17}
                        aria-hidden="true"
                      />

                      <input
                        type={
                          showPassword
                            ? 'text'
                            : 'password'
                        }
                        value={form.password}
                        onChange={(event) =>
                          updateField(
                            'password',
                            event.target.value,
                          )
                        }
                        minLength={10}
                        maxLength={128}
                        autoComplete="new-password"
                        required
                      />

                      <button
                        type="button"
                        className="registration-password-toggle"
                        onClick={() =>
                          setShowPassword(
                            (current) => !current,
                          )
                        }
                        aria-label={
                          showPassword
                            ? 'Скрыть пароль'
                            : 'Показать пароль'
                        }
                      >
                        {showPassword ? (
                          <EyeOff
                            size={17}
                            aria-hidden="true"
                          />
                        ) : (
                          <Eye
                            size={17}
                            aria-hidden="true"
                          />
                        )}
                      </button>
                    </div>

                    <small>
                      Не менее 10 символов, заглавная и
                      строчная латинские буквы, цифра.
                    </small>
                  </label>

                  <label>
                    <span>Повторите пароль *</span>
                    <div className="registration-input-icon">
                      <LockKeyhole
                        size={17}
                        aria-hidden="true"
                      />

                      <input
                        type={
                          showPassword
                            ? 'text'
                            : 'password'
                        }
                        value={form.confirmPassword}
                        onChange={(event) =>
                          updateField(
                            'confirmPassword',
                            event.target.value,
                          )
                        }
                        minLength={10}
                        maxLength={128}
                        autoComplete="new-password"
                        required
                      />
                    </div>
                  </label>
                </div>
              </section>

              <section className="registration-form-card">
                <div className="registration-form-heading">
                  <div className="registration-section-icon">
                    <Building2
                      size={20}
                      aria-hidden="true"
                    />
                  </div>

                  <div>
                    <h2>Данные салона</h2>
                    <p>
                      Основная информация для настройки
                      рабочего пространства.
                    </p>
                  </div>
                </div>

                <div className="registration-form-grid">
                  <label>
                    <span>Название салона *</span>
                    <input
                      type="text"
                      value={form.salonName}
                      onChange={(event) =>
                        updateField(
                          'salonName',
                          event.target.value,
                        )
                      }
                      minLength={2}
                      maxLength={150}
                      required
                    />
                  </label>

                  <label>
                    <span>Юридическое название</span>
                    <input
                      type="text"
                      value={form.legalName}
                      onChange={(event) =>
                        updateField(
                          'legalName',
                          event.target.value,
                        )
                      }
                      maxLength={200}
                    />
                  </label>

                  <label>
                    <span>Email салона</span>
                    <div className="registration-input-icon">
                      <Mail
                        size={17}
                        aria-hidden="true"
                      />

                      <input
                        type="email"
                        value={form.salonEmail}
                        onChange={(event) =>
                          updateField(
                            'salonEmail',
                            event.target.value,
                          )
                        }
                        maxLength={254}
                      />
                    </div>
                  </label>

                  <label>
                    <span>Телефон салона</span>
                    <div className="registration-input-icon">
                      <Phone
                        size={17}
                        aria-hidden="true"
                      />

                      <input
                        type="tel"
                        value={form.salonPhone}
                        onChange={(event) =>
                          updateField(
                            'salonPhone',
                            event.target.value,
                          )
                        }
                        placeholder="+37360123456"
                      />
                    </div>
                  </label>

                  <label>
                    <span>Часовой пояс *</span>
                    <div className="registration-input-icon">
                      <MapPin
                        size={17}
                        aria-hidden="true"
                      />

                      <select
                        value={form.timezone}
                        onChange={(event) =>
                          updateField(
                            'timezone',
                            event.target.value,
                          )
                        }
                        required
                      >
                        <option value="Europe/Chisinau">
                          Europe/Chisinau
                        </option>
                        <option value="Europe/Bucharest">
                          Europe/Bucharest
                        </option>
                        <option value="Europe/Kyiv">
                          Europe/Kyiv
                        </option>
                        <option value="Europe/Moscow">
                          Europe/Moscow
                        </option>
                      </select>
                    </div>
                  </label>

                  <label>
                    <span>Язык интерфейса *</span>
                    <select
                      value={form.preferredLanguage}
                      onChange={(event) =>
                        updateField(
                          'preferredLanguage',
                          event.target.value,
                        )
                      }
                      required
                    >
                      <option value="ru">Русский</option>
                      <option value="ro">Română</option>
                      <option value="en">English</option>
                    </select>
                  </label>
                </div>
              </section>

              {invitation?.invitedEmail ||
              invitation?.invitedPhone ? (
                <div className="registration-identity-note">
                  <ShieldCheck
                    size={19}
                    aria-hidden="true"
                  />

                  <div>
                    <strong>
                      Контакт должен совпадать с приглашением
                    </strong>

                    <p>
                      {invitation.invitedEmail
                        ? `Email: ${invitation.invitedEmail}. `
                        : ''}
                      {invitation.invitedPhone
                        ? `Телефон: ${invitation.invitedPhone}.`
                        : ''}
                    </p>
                  </div>
                </div>
              ) : null}

              {errorMessage ? (
                <div
                  className="registration-error"
                  role="alert"
                >
                  {errorMessage}
                </div>
              ) : null}

              <button
                type="submit"
                className="registration-submit-button"
                disabled={isSubmitting}
              >
                <ShieldCheck
                  size={19}
                  aria-hidden="true"
                />

                {isSubmitting
                  ? 'Отправляем заявку…'
                  : 'Отправить заявку на одобрение'}
              </button>

              <p className="registration-submit-note">
                После отправки учётная запись останется
                неактивной до одобрения владельцем
                платформы.
              </p>
            </form>
          </>
        ) : null}
      </section>
    </main>
  );
}

export default SalonRegistrationPage;
