import {
  Building2,
  Check,
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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';

import api from '../api/api';
import LanguageSwitcher from '../components/LanguageSwitcher';
import PublicFooter from '../components/PublicFooter';
import ThemeSwitcher from '../components/ThemeSwitcher';

/**
 * Регистрация салона по ссылке.
 *
 * Здесь человек впервые видит нас изнутри, и до 17 сентября 2026 видел
 * страницу, говорящую на двух языках сразу: названия и описания тарифов
 * приходили с сервера по-румынски, а всё вокруг них было вшито
 * по-русски — «ШАГ 1 ИЗ 2», «в месяц», «Выбрать тариф». Для Молдовы это
 * хуже, чем если бы всё было по-русски: видно, что переводили наспех.
 *
 * Причина была не в словаре, а в одной недостающей букве: страница не
 * говорила серверу, на каком языке она открыта, и сервер отдавал язык
 * по умолчанию. Теперь язык едет с каждым запросом, а сама страница
 * взята из словаря целиком. Переключатель языка стоит в шапке: сюда
 * приходят по ссылке из переписки, и выбирать язык человеку придётся
 * до всякого входа.
 *
 * Второе здесь — карточки. Тариф в двух сроках оплаты приходит с
 * сервера двумя записями, и страница честно печатала шесть карточек:
 * «Start», «Start», «Business», «Business»… Человек читал два
 * одинаковых имени подряд и не понимал, чем они отличаются, пока не
 * добирался до цены. Теперь карточек столько, сколько тарифов, а срок
 * оплаты — переключатель над ними.
 */

type RegistrationStep = 'loading' | 'invalid' | 'plan' | 'details' | 'submitted';

type BillingPeriod = 'monthly' | 'yearly';

type PublicPlan = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  price: string;
  currency: string;
  billingPeriod: BillingPeriod | string;
  trialDays: number;
  maxMasters: number | null;
  maxAdministrators: number | null;
  maxLocations: number | null;
  smsAllowance: number;
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

/**
 * Один тариф в двух сроках оплаты.
 *
 * Ключ берётся из кода тарифа — `start_monthly` и `start_yearly` суть
 * один «Start». Имя для этого не годится: оно переведено, и в румынском
 * словаре может звучать иначе, чем в русском.
 */
type PlanFamily = {
  key: string;
  monthly: PublicPlan | null;
  yearly: PublicPlan | null;
};

function groupPlans(plans: PublicPlan[]): PlanFamily[] {
  const families: PlanFamily[] = [];

  for (const plan of plans) {
    const key = plan.code.replace(/_(monthly|yearly)$/, '') || plan.code;

    let family = families.find((item) => item.key === key);

    if (!family) {
      family = {
        key,
        monthly: null,
        yearly: null,
      };

      families.push(family);
    }

    if (plan.billingPeriod === 'yearly') {
      family.yearly = plan;
    } else {
      family.monthly = plan;
    }
  }

  return families;
}

/**
 * Тариф для выбранного срока — или единственный, какой есть.
 *
 * Тариф может продаваться только помесячно или только на год. Такой не
 * должен пропадать со страницы из-за положения переключателя.
 */
function planOfPeriod(
  family: PlanFamily,
  period: BillingPeriod,
): PublicPlan | null {
  if (period === 'yearly') {
    return family.yearly ?? family.monthly;
  }

  return family.monthly ?? family.yearly;
}

/**
 * Что входит в тариф — целиком, вместе со ступенями ниже.
 *
 * Сперва карточка Business показывала только свою надстройку, а над ней
 * стояло «Всё из Start, и сверх того». Владелец посмотрел и сказал: под
 * этим заголовком должно быть всё, а не отсылка. Он прав: человек читает
 * одну карточку, а не три, и «всё из Start» ему ничего не говорит, пока
 * он не вернулся глазами к соседней колонке.
 *
 * Поэтому список собирается снизу вверх: сперва строки самого дешёвого
 * тарифа, потом следующего, потом этого. Строки идут в одном порядке во
 * всех колонках — так видно, где одна длиннее другой.
 *
 * Годовой добавляет своё последней строкой — подарок сообщениями. Он
 * берётся как разница между годовым списком и месячным: то, чего в
 * месячном нет. Иначе на карточке Business сошлись бы два подарка сразу,
 * двести от Start и пятьсот своих.
 */
function cumulativeFeatures(
  families: PlanFamily[],
  index: number,
  period: BillingPeriod,
): string[] {
  const lines: string[] = [];

  for (let step = 0; step <= index; step += 1) {
    const base = families[step].monthly ?? families[step].yearly;

    if (!base) {
      continue;
    }

    for (const line of getPlanFeatures(base)) {
      if (!lines.includes(line)) {
        lines.push(line);
      }
    }
  }

  if (period === 'yearly') {
    const yearly = families[index].yearly;
    const monthly = families[index].monthly;

    if (yearly) {
      const monthlyLines = monthly ? getPlanFeatures(monthly) : [];

      for (const line of getPlanFeatures(yearly)) {
        if (!monthlyLines.includes(line) && !lines.includes(line)) {
          lines.push(line);
        }
      }
    }
  }

  return lines;
}

function getPlanFeatures(plan: PublicPlan): string[] {
  if (Array.isArray(plan.features)) {
    return plan.features
      .filter((feature): feature is string => typeof feature === 'string')
      .slice(0, 12);
  }

  return [];
}

const PERIOD_SWITCH = {
  display: 'inline-flex',
  gap: 4,
  padding: 4,
  borderRadius: 999,
  border: '1px solid rgba(157, 109, 27, 0.28)',
  background: 'rgba(255, 255, 255, 0.72)',
} as const;

function periodButton(isActive: boolean) {
  return {
    minHeight: 40,
    padding: '0 20px',
    border: 'none',
    borderRadius: 999,
    background: isActive ? '#d17fb0' : 'transparent',
    color: isActive ? '#ffffff' : '#756b77',
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
  } as const;
}

function SalonRegistrationPage() {
  const { t, i18n } = useTranslation();

  const lang = i18n.language?.slice(0, 2) || 'ro';

  const token = useMemo(() => getInviteToken(), []);

  const [step, setStep] = useState<RegistrationStep>('loading');

  const [invitation, setInvitation] = useState<
    PublicInvitationResponse['invitation'] | null
  >(null);

  const [plans, setPlans] = useState<PublicPlan[]>([]);

  const [period, setPeriod] = useState<BillingPeriod>('monthly');

  const [selectedPlan, setSelectedPlan] = useState<PublicPlan | null>(null);

  const [form, setForm] = useState<RegistrationFormState>(INITIAL_FORM);

  const [isSubmitting, setIsSubmitting] = useState(false);

  /**
   * Ошибка хранится ключом, а не готовой строкой.
   *
   * Иначе сообщение, показанное по-русски, так и осталось бы русским
   * после переключения языка — и, что хуже, `t` попал бы в зависимости
   * загрузки: каждый его новый вид дёргал бы сервер заново.
   */
  const [errorKey, setErrorKey] = useState('');

  const [registrationResult, setRegistrationResult] =
    useState<RegistrationResponse | null>(null);

  const [showPassword, setShowPassword] = useState(false);

  const stepRef = useRef<RegistrationStep>('loading');

  useEffect(() => {
    stepRef.current = step;
  }, [step]);

  function formatDate(value: string): string {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return t('reg.dateUnknown');
    }

    return new Intl.DateTimeFormat(lang, {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(date);
  }

  function billingLabel(planPeriod: string): string {
    return planPeriod === 'yearly' ? t('reg.perYear') : t('reg.perMonth');
  }

  /**
   * Состав тарифа одной строкой, собранный из его же чисел.
   *
   * Прежде карточка печатала три отдельные строки — «До 5 мастеров»,
   * «До 1 администраторов», «До 1 филиалов». Тот же состав повторялся
   * потом словами в списке возможностей: один вопрос отвечали в двух
   * местах, и второй ответ вдобавок не склонялся.
   *
   * Склонение теперь не наше дело: числительные знает i18next, и знает
   * их для трёх языков сразу. Прежняя таблица «мастер / мастера /
   * мастеров» жила прямо в этом файле и молча ошибалась на румынском,
   * где после двадцати появляется «de»: не «20 maeștri», а «20 de
   * maeștri».
   */
  function planComposition(plan: PublicPlan): string {
    const parts: string[] = [];

    parts.push(
      plan.maxMasters
        ? t('reg.composition.masters', { count: plan.maxMasters })
        : t('reg.composition.mastersUnlimited'),
    );

    if (plan.maxLocations) {
      parts.push(t('reg.composition.locations', { count: plan.maxLocations }));
    }

    if (plan.maxAdministrators) {
      parts.push(
        t('reg.composition.admins', { count: plan.maxAdministrators }),
      );
    }

    if (plan.smsAllowance) {
      parts.push(t('reg.composition.sms', { count: plan.smsAllowance }));
    }

    return parts.join(' · ');
  }

  const loadInvitation = useCallback(async () => {
    if (token.length !== 43 || !/^[A-Za-z0-9_-]+$/.test(token)) {
      setErrorKey('reg.invalidLink');
      setStep('invalid');
      return;
    }

    setErrorKey('');
    setStep('loading');

    try {
      const response = await api.post<PublicInvitationResponse>(
        '/platform-registration/invitation?lang=' + encodeURIComponent(lang),
        {
          token,
        },
      );

      setInvitation(response.data.invitation);
      setPlans(response.data.plans);

      const existingPlan =
        response.data.plans.find(
          (plan) => plan.id === response.data.invitation.selectedPlanId,
        ) || null;

      if (existingPlan) {
        setSelectedPlan(existingPlan);
        setPeriod(existingPlan.billingPeriod === 'yearly' ? 'yearly' : 'monthly');
        setStep('details');
      } else {
        setStep('plan');
      }

      if (response.data.invitation.salonNameHint) {
        setForm((current) => ({
          ...current,
          salonName: response.data.invitation.salonNameHint || '',
        }));
      }
    } catch {
      setErrorKey('reg.invitationUnusable');
      setStep('invalid');
    }
  }, [token, lang]);

  /**
   * Перезагрузка при смене языка — но не поверх заполненной формы.
   *
   * Названия и описания тарифов приходят с сервера, поэтому язык
   * страницы без нового запроса сменится только наполовину. Человека,
   * который уже вписывает свои данные, такой запрос отбросил бы к
   * началу: его анкету мы не трогаем.
   */
  useEffect(() => {
    if (stepRef.current === 'details' || stepRef.current === 'submitted') {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void loadInvitation();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [loadInvitation]);

  const families = useMemo(() => groupPlans(plans), [plans]);

  const hasBothPeriods = useMemo(
    () => families.some((family) => family.monthly && family.yearly),
    [families],
  );

  function updateField(field: keyof RegistrationFormState, value: string) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function choosePlan(plan: PublicPlan) {
    setIsSubmitting(true);
    setErrorKey('');

    try {
      const response = await api.post<SelectPlanResponse>(
        '/platform-registration/select-plan?lang=' + encodeURIComponent(lang),
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
      setErrorKey('reg.planFailed');
    } finally {
      setIsSubmitting(false);
    }
  }

  function returnToPlans() {
    setErrorKey('');
    setStep('plan');
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }

  function validateForm(): string | null {
    if (form.password !== form.confirmPassword) {
      return 'reg.errors.passwordMismatch';
    }

    if (form.password.length < 10) {
      return 'reg.errors.passwordShort';
    }

    if (
      !/[a-z]/.test(form.password) ||
      !/[A-Z]/.test(form.password) ||
      !/\d/.test(form.password)
    ) {
      return 'reg.errors.passwordWeak';
    }

    if (!/^\+[1-9]\d{7,14}$/.test(form.phone.trim())) {
      return 'reg.errors.ownerPhone';
    }

    if (
      form.salonPhone.trim() &&
      !/^\+[1-9]\d{7,14}$/.test(form.salonPhone.trim())
    ) {
      return 'reg.errors.salonPhone';
    }

    return null;
  }

  async function submitRegistration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validationError = validateForm();

    if (validationError) {
      setErrorKey(validationError);
      return;
    }

    if (!selectedPlan) {
      setErrorKey('reg.errors.noPlan');
      setStep('plan');
      return;
    }

    setIsSubmitting(true);
    setErrorKey('');

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
      payload.salonEmail = form.salonEmail.trim().toLowerCase();
    }

    if (form.salonPhone.trim()) {
      payload.salonPhone = form.salonPhone.trim();
    }

    try {
      const response = await api.post<RegistrationResponse>(
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
      setErrorKey('reg.errors.submitFailed');
    } finally {
      setIsSubmitting(false);
    }
  }

  function openLogin() {
    window.location.hash = '';
  }

  return (
    <main className="registration-page registration-page-salon">
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

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              flexWrap: 'wrap',
            }}
          >
            {/*
              Тема и язык — рядом, как в кабинете. Сюда приходят по
              ссылке из переписки, ещё без входа: и то и другое человеку
              придётся выбирать здесь, а не в настройках, которых у него
              пока нет.
            */}
            <ThemeSwitcher />

            <LanguageSwitcher />

            <button
              type="button"
              className="registration-login-link"
              onClick={openLogin}
            >
              {t('reg.alreadyRegistered')}
            </button>
          </div>
        </header>

        {step === 'loading' ? (
          <section className="registration-state-card">
            <div className="registration-state-icon">
              <Clock3 size={28} aria-hidden="true" />
            </div>

            <h1>{t('reg.loadingTitle')}</h1>

            <p>{t('reg.loadingText')}</p>
          </section>
        ) : null}

        {step === 'invalid' ? (
          <section className="registration-state-card">
            <div className="registration-state-icon registration-state-icon-error">
              <ShieldCheck size={29} aria-hidden="true" />
            </div>

            <p className="registration-eyebrow">{t('reg.invalidEyebrow')}</p>

            <h1>{t('reg.invalidTitle')}</h1>

            <p>{errorKey ? t(errorKey) : null}</p>

            <button
              type="button"
              className="registration-primary-button"
              onClick={openLogin}
            >
              {t('reg.goToLogin')}
            </button>
          </section>
        ) : null}

        {step === 'submitted' ? (
          <section className="registration-state-card">
            <div className="registration-state-icon registration-state-icon-success">
              <CheckCircle2 size={30} aria-hidden="true" />
            </div>

            <p className="registration-eyebrow">{t('reg.sentEyebrow')}</p>

            <h1>{t('reg.sentTitle')}</h1>

            <p>
              {registrationResult?.salon.name
                ? t('reg.sentTextNamed', {
                    salon: registrationResult.salon.name,
                  })
                : t('reg.sentTextPlain')}
            </p>

            <div className="registration-waiting-details">
              <div>
                <span>{t('reg.statusLabel')}</span>
                <strong>{t('reg.statusWaiting')}</strong>
              </div>

              <div>
                <span>{t('reg.chosenPlan')}</span>
                <strong>
                  {registrationResult?.selectedPlan.name ||
                    selectedPlan?.name ||
                    t('reg.chosen')}
                </strong>
              </div>

              <div>
                <span>{t('reg.trialLabel')}</span>
                <strong>{t('reg.trialAfterApproval')}</strong>
              </div>
            </div>

            <p className="registration-security-message">
              {t('reg.sentSecurity')}
            </p>

            <button
              type="button"
              className="registration-primary-button"
              onClick={openLogin}
            >
              {t('reg.goToLogin')}
            </button>
          </section>
        ) : null}

        {step === 'plan' ? (
          <>
            <section className="registration-intro">
              <p className="registration-eyebrow">{t('reg.step1')}</p>

              <h1>{t('reg.planTitle')}</h1>

              <p>{t('reg.planNote')}</p>

              {invitation ? (
                <div className="registration-invitation-summary">
                  <ShieldCheck size={18} aria-hidden="true" />

                  <span>
                    {t('reg.validUntil')}{' '}
                    <strong>
                      {formatDate(invitation.expiresAt)}
                    </strong>
                  </span>

                  {invitation.salonNameHint ? (
                    <span>
                      {t('reg.salonLabel')}{' '}
                      <strong>{invitation.salonNameHint}</strong>
                    </span>
                  ) : null}
                </div>
              ) : null}
            </section>

            {errorKey ? (
              <div className="registration-error" role="alert">
                {t(errorKey)}
              </div>
            ) : null}

            {plans.length === 0 ? (
              <section className="registration-state-card">
                <h2>{t('reg.noPlansTitle')}</h2>

                <p>{t('reg.noPlansText')}</p>
              </section>
            ) : (
              <>
                {/*
                  Срок оплаты — переключатель, а не второй ряд карточек.
                  Шесть карточек, из которых три отличались от соседки
                  только ценой и одинаково назывались, человек читал как
                  ошибку — и был прав.
                */}
                {hasBothPeriods ? (
                  <div
                    style={{
                      marginBottom: 22,
                      textAlign: 'center',
                    }}
                  >
                    <div style={PERIOD_SWITCH}>
                      <button
                        type="button"
                        onClick={() => setPeriod('monthly')}
                        style={periodButton(period === 'monthly')}
                      >
                        {t('reg.periodMonthly')}
                      </button>

                      <button
                        type="button"
                        onClick={() => setPeriod('yearly')}
                        style={periodButton(period === 'yearly')}
                      >
                        {t('reg.periodYearly')}
                      </button>
                    </div>

                    {/*
                      Выгода года сказана один раз, под переключателем, а
                      не на каждой карточке: она у всех тарифов одна и та
                      же, и трижды повторённая превращается в шум.
                    */}
                    {period === 'yearly' ? (
                      <p
                        style={{
                          margin: '12px 0 0',
                          color: 'var(--pf-text-muted)',
                          fontSize: 13,
                        }}
                      >
                        {t('reg.yearlyHint')}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                <section className="registration-plans">
                  {families.map((family, index) => {
                    const plan = planOfPeriod(family, period);

                    if (!plan) {
                      return null;
                    }

                    const features = cumulativeFeatures(families, index, period);

                    return (
                      <article
                        key={family.key}
                        className={
                          plan.isFeatured
                            ? 'registration-plan-card registration-plan-featured'
                            : 'registration-plan-card'
                        }
                      >
                        <div className="registration-plan-heading">
                          {/*
                            Отметка «Рекомендуемый» стоит над именем, в
                            общем потоке. Приколотая к правому углу, она
                            лежала на имени буквами и сдвигала его с
                            середины — одна карточка из трёх выходила
                            криво.
                          */}
                          {plan.isFeatured ? (
                            <span className="registration-plan-badge">
                              {t('reg.featured')}
                            </span>
                          ) : null}

                          <h2>{plan.name}</h2>

                          {/*
                            Над ценой — приветствие и осторожное
                            приглашение, одно и то же на всех карточках.
                            Прежде здесь стояло описание тарифа, и оно
                            обманывало: человек читал его как состав, а
                            состав был ниже.
                          */}
                          <p className="registration-plan-greeting">
                            {t('reg.plan.greeting')}
                          </p>
                        </div>

                        {/*
                          Цена без «в месяц»: на что она — уже сказал
                          переключатель над карточками, и повторять это
                          трижды значит отвечать на один вопрос в четырёх
                          местах сразу.
                        */}
                        <div className="registration-plan-price">
                          <strong>{plan.price}</strong>

                          <span>{plan.currency}</span>
                        </div>

                        <div className="registration-trial">
                          <Clock3 size={16} aria-hidden="true" />

                          {t('reg.trialDays', { count: plan.trialDays })}
                        </div>

                        {/*
                          Кнопка стоит сразу под ценой, а список — ниже, за
                          чертой. Так собраны карточки, на которые владелец
                          показал как на образец: сперва решение, потом
                          подробности для тех, кому их нужно.
                        */}
                        <button
                          type="button"
                          className="registration-primary-button"
                          disabled={isSubmitting}
                          onClick={() => void choosePlan(plan)}
                        >
                          {isSubmitting
                            ? t('reg.savingChoice')
                            : t('reg.choosePlan')}
                        </button>

                        <p className="registration-plan-cta">
                          {t('reg.plan.cta', { plan: plan.name })}
                        </p>

                        {/*
                          Состав ушёл из отдельной рамки в первую строку
                          списка. Рамка отвечала на тот же вопрос, что и
                          список под ней, — «что я получу», — и потому
                          разрывала его надвое.
                        */}
                        <p className="registration-plan-includes">
                          {t('reg.plan.includes')}
                        </p>

                        <ul>
                          <li>
                            <Check size={15} aria-hidden="true" />

                            <span>{planComposition(plan)}</span>
                          </li>

                          {features.map((feature) => (
                            <li key={feature}>
                              <Check size={15} aria-hidden="true" />

                              <span>{feature}</span>
                            </li>
                          ))}
                        </ul>
                      </article>
                    );
                  })}
                </section>
              </>
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
                <ChevronLeft size={18} aria-hidden="true" />
                {t('reg.changePlan')}
              </button>

              <p className="registration-eyebrow">{t('reg.step2')}</p>

              <h1>{t('reg.detailsTitle')}</h1>

              <p>{t('reg.detailsNote')}</p>

              <div className="registration-selected-plan">
                <div>
                  <span>{t('reg.chosenPlan')}</span>
                  <strong>{selectedPlan.name}</strong>
                </div>

                <div>
                  <span>{t('reg.priceLabel')}</span>
                  <strong>
                    {selectedPlan.price} {selectedPlan.currency}{' '}
                    {billingLabel(selectedPlan.billingPeriod)}
                  </strong>
                </div>

                <div>
                  <span>{t('reg.trialLabel')}</span>
                  <strong>
                    {t('reg.trialDaysAfterApproval', {
                      count: selectedPlan.trialDays,
                    })}
                  </strong>
                </div>
              </div>
            </section>

            <form className="registration-form" onSubmit={submitRegistration}>
              <section className="registration-form-card">
                <div className="registration-form-heading">
                  <div className="registration-section-icon">
                    <UserRound size={20} aria-hidden="true" />
                  </div>

                  <div>
                    <h2>{t('reg.ownerSection')}</h2>
                    <p>{t('reg.ownerSectionNote')}</p>
                  </div>
                </div>

                <div className="registration-form-grid">
                  <label>
                    <span>{t('reg.firstName')}</span>
                    <input
                      type="text"
                      value={form.firstName}
                      onChange={(event) =>
                        updateField('firstName', event.target.value)
                      }
                      maxLength={80}
                      autoComplete="given-name"
                      required
                    />
                  </label>

                  <label>
                    <span>{t('reg.lastName')}</span>
                    <input
                      type="text"
                      value={form.lastName}
                      onChange={(event) =>
                        updateField('lastName', event.target.value)
                      }
                      maxLength={80}
                      autoComplete="family-name"
                      required
                    />
                  </label>

                  <label>
                    <span>{t('reg.loginEmail')}</span>
                    <div className="registration-input-icon">
                      <Mail size={17} aria-hidden="true" />

                      <input
                        type="email"
                        value={form.email}
                        onChange={(event) =>
                          updateField('email', event.target.value)
                        }
                        maxLength={254}
                        autoComplete="email"
                        required
                      />
                    </div>
                  </label>

                  <label>
                    <span>{t('reg.ownerPhone')}</span>
                    <div className="registration-input-icon">
                      <Phone size={17} aria-hidden="true" />

                      <input
                        type="tel"
                        value={form.phone}
                        onChange={(event) =>
                          updateField('phone', event.target.value)
                        }
                        placeholder="+37360123456"
                        autoComplete="tel"
                        required
                      />
                    </div>
                  </label>

                  <label>
                    <span>{t('reg.password')}</span>
                    <div className="registration-input-icon">
                      <LockKeyhole size={17} aria-hidden="true" />

                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={form.password}
                        onChange={(event) =>
                          updateField('password', event.target.value)
                        }
                        minLength={10}
                        maxLength={128}
                        autoComplete="new-password"
                        required
                      />

                      <button
                        type="button"
                        className="registration-password-toggle"
                        onClick={() => setShowPassword((current) => !current)}
                        aria-label={
                          showPassword
                            ? t('reg.hidePassword')
                            : t('reg.showPassword')
                        }
                      >
                        {showPassword ? (
                          <EyeOff size={17} aria-hidden="true" />
                        ) : (
                          <Eye size={17} aria-hidden="true" />
                        )}
                      </button>
                    </div>

                    <small>{t('reg.passwordHint')}</small>
                  </label>

                  <label>
                    <span>{t('reg.passwordRepeat')}</span>
                    <div className="registration-input-icon">
                      <LockKeyhole size={17} aria-hidden="true" />

                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={form.confirmPassword}
                        onChange={(event) =>
                          updateField('confirmPassword', event.target.value)
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
                    <Building2 size={20} aria-hidden="true" />
                  </div>

                  <div>
                    <h2>{t('reg.salonSection')}</h2>
                    <p>{t('reg.salonSectionNote')}</p>
                  </div>
                </div>

                <div className="registration-form-grid">
                  <label>
                    <span>{t('reg.salonName')}</span>
                    <input
                      type="text"
                      value={form.salonName}
                      onChange={(event) =>
                        updateField('salonName', event.target.value)
                      }
                      minLength={2}
                      maxLength={150}
                      required
                    />
                  </label>

                  <label>
                    <span>{t('reg.legalName')}</span>
                    <input
                      type="text"
                      value={form.legalName}
                      onChange={(event) =>
                        updateField('legalName', event.target.value)
                      }
                      maxLength={200}
                    />
                  </label>

                  <label>
                    <span>{t('reg.salonEmail')}</span>
                    <div className="registration-input-icon">
                      <Mail size={17} aria-hidden="true" />

                      <input
                        type="email"
                        value={form.salonEmail}
                        onChange={(event) =>
                          updateField('salonEmail', event.target.value)
                        }
                        maxLength={254}
                      />
                    </div>
                  </label>

                  <label>
                    <span>{t('reg.salonPhone')}</span>
                    <div className="registration-input-icon">
                      <Phone size={17} aria-hidden="true" />

                      <input
                        type="tel"
                        value={form.salonPhone}
                        onChange={(event) =>
                          updateField('salonPhone', event.target.value)
                        }
                        placeholder="+37360123456"
                      />
                    </div>
                  </label>

                  <label>
                    <span>{t('reg.timezone')}</span>
                    <div className="registration-input-icon">
                      <MapPin size={17} aria-hidden="true" />

                      <select
                        value={form.timezone}
                        onChange={(event) =>
                          updateField('timezone', event.target.value)
                        }
                        required
                      >
                        <option value="Europe/Chisinau">Europe/Chisinau</option>
                        <option value="Europe/Bucharest">
                          Europe/Bucharest
                        </option>
                        <option value="Europe/Kyiv">Europe/Kyiv</option>
                        <option value="Europe/Moscow">Europe/Moscow</option>
                      </select>
                    </div>
                  </label>

                  <label>
                    <span>{t('reg.interfaceLanguage')}</span>
                    <select
                      value={form.preferredLanguage}
                      onChange={(event) =>
                        updateField('preferredLanguage', event.target.value)
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

              {invitation?.invitedEmail || invitation?.invitedPhone ? (
                <div className="registration-identity-note">
                  <ShieldCheck size={19} aria-hidden="true" />

                  <div>
                    <strong>{t('reg.identityTitle')}</strong>

                    <p>
                      {invitation.invitedEmail
                        ? `${t('reg.identityEmail')} ${invitation.invitedEmail}. `
                        : ''}
                      {invitation.invitedPhone
                        ? `${t('reg.identityPhone')} ${invitation.invitedPhone}.`
                        : ''}
                    </p>
                  </div>
                </div>
              ) : null}

              {errorKey ? (
                <div className="registration-error" role="alert">
                  {t(errorKey)}
                </div>
              ) : null}

              <button
                type="submit"
                className="registration-submit-button"
                disabled={isSubmitting}
              >
                <ShieldCheck size={19} aria-hidden="true" />

                {isSubmitting ? t('reg.sending') : t('reg.submit')}
              </button>

              <p className="registration-submit-note">{t('reg.submitNote')}</p>
            </form>
          </>
        ) : null}

        <PublicFooter />
      </section>
    </main>
  );
}

function getInviteToken(): string {
  const hash = window.location.hash;

  if (!hash.startsWith('#register?')) {
    return '';
  }

  const query = hash.slice(hash.indexOf('?') + 1);
  const params = new URLSearchParams(query);

  return params.get('invite')?.trim() || '';
}

export default SalonRegistrationPage;
