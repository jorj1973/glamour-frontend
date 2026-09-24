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
import { READY_LANGUAGES } from '../i18n/languages';

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

/** Сколько строк списка видно до нажатия «показать ещё». */
const VISIBLE_FEATURES = 5;

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

  /**
   * Цена со второй оплаты. Пусто — цена одна и та же всегда.
   *
   * Акция действует на первую оплату, какой бы срок ни выбрали, и одна
   * на салон: взять год выгоднее, потому что скидка накроет двенадцать
   * месяцев, а не один.
   */
  regularPrice?: string | null;

  /** Кому тариф: салону или независимому мастеру. */
  audience?: string;

  /** Тариф не выбирают кнопкой — о нём договариваются. */
  byRequest?: boolean;

  /** Сколько клиенток помещается в базу. Пусто — без предела. */
  maxClients?: number | null;

  /**
   * Что этот тариф дарит за оплату года. `null` — ничего: акции нет,
   * она кончилась, или оплата месячная.
   *
   * Считает сервер. Дни у тарифов разные, и правило «своё число тарифа
   * главнее общего числа акции» живёт там же, где начисление.
   * Посчитанное здесь однажды разойдётся с тем, что начислит оплата.
   */
  annualGift?: AnnualGift | null;
};

/**
 * Подарок за оплату года — то, что площадка обещает вслух.
 *
 * Счётчик мест приходит с сервера, а не считается здесь: число
 * оставшихся мест меняет не эта страница, а чужая оплата, и знать его
 * может только тот, кто её отметил.
 */
type AnnualGift = {
  /** Сколько сообщений в подарок. */
  messages: number;
  /** Сколько дней сверх срока. Обычно 0. */
  bonusDays: number;
  /** Сколько подарков осталось. `null` — без предела. */
  seatsLeft: number | null;
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
  /** Промокод. Пусто — у человека его нет, и это обычное дело. */
  promoCode: string;
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
  promoCode: '',
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
 * Что даёт именно этот тариф — и ничего сверх того.
 *
 * До 18 сентября 2026 список собирался снизу вверх: в Premium стояли и
 * его строки, и все строки Business, и все строки Start. Владелец
 * посмотрел на три готовые карточки и сказал прямо: они кажутся
 * одинаковыми. Так и было. Девять строк из десяти в них совпадали, а
 * то единственное, чем тарифы правда отличаются — мастера, адреса,
 * администраторы, сообщения, — лежало мелким серым шрифтом в стороне.
 *
 * Теперь наоборот. Заголовок говорит «всё, что в Start, и», а под ним
 * стоит только надстройка: повторять сказанное соседней колонкой не
 * нужно, на то и заголовок. Числа при этом переехали в список первой
 * строкой и написаны светлее прочих — главное стоит первым и видно
 * глазом, а не читается через лупу.
 *
 * Годовой добавляет своё последней строкой: то, чего нет в месячном.
 * Так на карточке Business не сходятся два подарка сразу — двести
 * сообщений от Start и пятьсот своих.
 */
function ownFeatures(family: PlanFamily, period: BillingPeriod): string[] {
  const base = family.monthly ?? family.yearly;
  const lines = base ? [...getPlanFeatures(base)] : [];

  if (period === 'yearly' && family.yearly) {
    const monthlyLines = family.monthly ? getPlanFeatures(family.monthly) : [];

    for (const line of getPlanFeatures(family.yearly)) {
      if (!monthlyLines.includes(line) && !lines.includes(line)) {
        lines.push(line);
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

/** Перевод, как его отдаёт `useTranslation`. */
type Translate = ReturnType<typeof useTranslation>['t'];

/**
 * Обещание площадки — одно на всю страницу.
 *
 * Акция одна, и остаток мест у всех карточек один и тот же, поэтому
 * берём его у первого тарифа, который что-то обещает. Самих чисел
 * подарка здесь нет: они у тарифов разные и стоят на карточках.
 */
function sharedGift(plans: PublicPlan[]): AnnualGift | null {
  for (const plan of plans) {
    if (plan.annualGift) {
      return plan.annualGift;
    }
  }

  return null;
}

/** Строка над списком: подарок есть, и вот сколько мест осталось. */
function giftHeader(t: Translate, plans: PublicPlan[]) {
  const gift = sharedGift(plans);

  if (!gift) {
    return null;
  }

  const seats =
    gift.seatsLeft === null
      ? ''
      : ' ' + t('reg.giftSeats', { count: gift.seatsLeft });

  return (
    <p
      style={{
        margin: '8px 0 0',
        color: 'var(--pf-accent-text)',
        fontSize: 13,
        fontWeight: 600,
      }}
    >
      {t('reg.giftHeader') + seats}
    </p>
  );
}

/**
 * Что дарит этот тариф.
 *
 * Подарок бывает из двух частей — сообщения и дни, — и каждая часть
 * склоняется по-своему. Поэтому строка не склеивается из двух готовых
 * предложений, а собирается из частей: рамка отдельно, части отдельно.
 * Языку, где «и» стоит не там, где в русском, иначе не помочь.
 *
 * Дарить нечего — строки нет. Пустое обещание хуже отсутствующего.
 */
function giftOnPlan(t: Translate, gift?: AnnualGift | null) {
  if (!gift) {
    return null;
  }

  const parts: string[] = [];

  if (gift.messages > 0) {
    parts.push(t('reg.giftMessages', { count: gift.messages }));
  }

  if (gift.bonusDays > 0) {
    parts.push(t('reg.giftDays', { count: gift.bonusDays }));
  }

  if (parts.length === 0) {
    return null;
  }

  const whole =
    parts.length > 1
      ? t('reg.giftBoth', { first: parts[0], second: parts[1] })
      : parts[0];

  return (
    <p
      style={{
        margin: '0 0 14px',
        color: 'var(--pf-accent-text)',
        fontSize: 13,
        fontWeight: 600,
      }}
    >
      {t('reg.giftOnPlan', { gift: whole })}
    </p>
  );
}

/**
 * Отформатировать число как показана цена рядом: столько же знаков
 * после запятой. Зачёркнутая «12 × помесячно» должна выглядеть как
 * годовая цена, а не «12000» против «10000.00».
 */
function formatMoney(value: string | number): string {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return String(value);
  }

  const hasCents = Math.round(amount * 100) % 100 !== 0;
  const fixed = hasCents ? amount.toFixed(2) : String(Math.round(amount));
  const [whole, cents] = fixed.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0');

  return cents ? grouped + '.' + cents : grouped;
}

/**
 * Честная выгода года: годовой тариф против двенадцати помесячных.
 *
 * `was` — сколько человек заплатил бы, платя каждый месяц: настоящая
 * сумма, а не выдуманное «было». `free` — сколько месяцев в подарок,
 * и только когда это целое число: «два месяца бесплатно» при полутора
 * месяцах было бы обманом. `off` — та же выгода в процентах, про запас.
 *
 * Нет пары помесячно/год, помесячная цена ноль или год не дешевле —
 * возвращаем null, и карточка молчит.
 */
function yearlyAnchor(
  family: PlanFamily,
): { was: number; free: number | null; off: number } | null {
  const monthly = planOfPeriod(family, 'monthly');
  const yearly = planOfPeriod(family, 'yearly');

  if (!monthly || !yearly) {
    return null;
  }

  const monthlyPrice = Number(monthly.price);
  const yearlyPrice = Number(yearly.price);

  if (
    !Number.isFinite(monthlyPrice) ||
    !Number.isFinite(yearlyPrice) ||
    monthlyPrice <= 0
  ) {
    return null;
  }

  const was = monthlyPrice * 12;
  const saving = was - yearlyPrice;

  if (saving <= 0) {
    return null;
  }

  const exact = saving / monthlyPrice;
  const rounded = Math.round(exact);
  const free =
    Math.abs(exact - rounded) < 0.02 && rounded >= 1 ? rounded : null;

  return {
    was,
    free,
    off: Math.round((saving / was) * 100),
  };
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

  /**
   * Какие карточки раскрыты целиком.
   *
   * Сложенный список — не кокетство: у Premium их четырнадцать, и
   * стена из четырнадцати строк не читается вовсе. Первые пять видно
   * всегда: спрятать всё значило бы прятать сам товар.
   */
  const [openPlans, setOpenPlans] = useState<Record<string, boolean>>({});

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
   * Числа тарифа — каждое своей строкой.
   *
   * Сперва они стояли тремя строками списка, потом склеились в одну
   * через точки, потом переехали первой строкой в «Что входит». Теперь
   * снова врозь, и на этот раз по делу: владелец смотрел на готовую
   * карточку и сказал, что склейка читается как одна длинная фраза, а
   * каждое число — отдельное обещание, и галочка нужна каждому.
   *
   * Склонение не наше дело: числительные знает i18next, и знает их для
   * трёх языков сразу. Прежняя таблица «мастер / мастера / мастеров»
   * жила прямо в этом файле и молча ошибалась на румынском, где после
   * двадцати появляется «de»: не «20 maeștri», а «20 de maeștri».
   *
   * К строке сообщений привязана приписка про пакеты. «25 в месяц»
   * читается как потолок, из-за которого человек берёт тариф дороже,
   * чем ему нужен, — или не берёт никакого.
   */
  function planNumbers(
    plan: PublicPlan,
  ): { id: string; text: string; note?: string }[] {
    const rows: { id: string; text: string; note?: string }[] = [];

    rows.push({
      id: 'masters',
      text: plan.maxMasters
        ? t('reg.composition.masters', { count: plan.maxMasters })
        : t('reg.composition.mastersUnlimited'),
    });

    if (plan.maxLocations) {
      rows.push({
        id: 'locations',
        text: t('reg.composition.locations', { count: plan.maxLocations }),
      });
    }

    if (plan.maxAdministrators) {
      rows.push({
        id: 'admins',
        text: t('reg.composition.admins', { count: plan.maxAdministrators }),
      });
    }

    if (plan.smsAllowance) {
      rows.push({
        id: 'sms',
        text: t('reg.composition.sms', { count: plan.smsAllowance }),
        note: t('reg.plan.topUp'),
      });
    }

    return rows;
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
      promoCode?: string;
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

    /**
     * Код уходит прописными: в базе он записан так, а человек наберёт
     * как придётся. Пустое поле не отправляется вовсе — пустой код это
     * не код, а его отсутствие.
     */
    if (form.promoCode.trim()) {
      payload.promoCode = form.promoCode.trim().toUpperCase();
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
    } catch (error) {
      /**
       * Неизвестный промокод называется своим именем.
       *
       * Общее «не получилось» заставило бы человека гадать, что не
       * так: почта, телефон, пароль? А не так одна буква в коде, и он
       * может её поправить сам.
       */
      const message = (
        error as { response?: { data?: { message?: unknown } } }
      )?.response?.data?.message;

      setErrorKey(
        message === 'PROMO_CODE_UNKNOWN'
          ? 'reg.promoUnknown'
          : 'reg.errors.submitFailed',
      );
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

                    {/*
                      Здесь только то, что общее для всей страницы: что
                      подарок есть и сколько мест осталось. Сами числа
                      стоят на карточках — дни у тарифов разные, и одной
                      строкой на всех правду не сказать.

                      Счётчик мест при обещании, а не внизу страницы:
                      обещание без остатка мест звучит бессрочно, а оно
                      не бессрочно.

                      Строки нет вовсе, когда акции нет, — вместо «мест
                      не осталось». Кто пришёл сегодня, не должен читать
                      про то, что раздали без него.
                    */}
                    {period === 'yearly' ? giftHeader(t, plans) : null}
                  </div>
                ) : null}

                <section className="registration-plans">
                  {families.map((family, index) => {
                    const plan = planOfPeriod(family, period);

                    if (!plan) {
                      return null;
                    }

                    const features = ownFeatures(family, period);

                    // Ступень ниже — её имя стоит в заголовке списка:
                    // «Start + …». Сам список полон, но заголовок
                    // показывает, что этот тариф начинается там, где
                    // кончается предыдущий.
                    const previous =
                      index > 0 ? planOfPeriod(families[index - 1], period) : null;

                    // Якорь цены — только на годовой карточке и только
                    // когда год реально дешевле двенадцати помесячных.
                    const anchor =
                      period === 'yearly' ? yearlyAnchor(family) : null;

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
                          {/*
                            Отметка стоит на всех трёх карточках, но на
                            двух она невидима. Иначе выделенная карточка
                            выше соседок на её высоту, и цены в ряду
                            разъезжаются: у Business пятьсот пятьдесят
                            оказывается ниже трёхсот пятидесяти у Start.
                          */}
                          <span
                            className="registration-plan-badge"
                            style={
                              plan.isFeatured
                                ? undefined
                                : { visibility: 'hidden' }
                            }
                          >
                            {t('reg.featured')}
                          </span>

                          <h2>{plan.name}</h2>

                          {/*
                            Под именем — кому этот тариф. Одной строкой и
                            про человека, а не про возможности.
                            
                            Описание уже стояло здесь однажды и было
                            убрано: оно обманывало, потому что состав
                            лежал далеко внизу и описание читали как
                            состав. Теперь состав стоит прямо под ним,
                            отдельным блоком, и путать их не с чем.
                          */}
                          <p className="registration-plan-greeting">
                            {plan.description || t('reg.plan.greeting')}
                          </p>
                        </div>

                        {/*
                          Цена без «в месяц»: на что она — уже сказал
                          переключатель над карточками, и повторять это
                          трижды значит отвечать на один вопрос в четырёх
                          местах сразу.
                        */}
                        {/*
                          У тарифа по договорённости цены нет, и выдумать
                          её нельзя: она зависит от того, сколько у сети
                          адресов и мастеров. Вместо числа — честная
                          строка, вместо выбора — разговор.
                        */}
                        <div className="registration-plan-pricezone">
                          {plan.byRequest ? (
                          <p className="registration-plan-byrequest">
                            {t('reg.byRequestPrice')}
                          </p>
                        ) : (
                          <>
                            <div className="registration-plan-price">
                              {anchor ? (
                                <s className="registration-plan-was">
                                  {formatMoney(anchor.was)} {plan.currency}
                                </s>
                              ) : null}

                              <strong>{formatMoney(plan.price)}</strong>

                              <span>{plan.currency}</span>
                            </div>

                            {/*
                              Строка выгоды стоит на всех карточках, даже
                              пустая: своей высоты, чтобы кнопки на всех
                              тарифах встали в один ряд. Число — только при
                              целом числе месяцев: полтора месяца обещать
                              нельзя, а на Debut выгоды нет вовсе.
                            */}
                            <p className="registration-plan-free">
                              {anchor && anchor.free !== null
                                ? t('reg.freeMonths', { count: anchor.free })
                                : '\u00A0'}
                            </p>

                            {/*
                              Вторая цена — не мелкий шрифт ради приличия,
                              а обещание: по ней мы действительно берём со
                              второй оплаты. Нет второй цены — строки нет.
                            */}
                            {plan.regularPrice ? (
                              <p className="registration-plan-regular">
                                {t('reg.thenPrice', {
                                  price: plan.regularPrice,
                                  currency: plan.currency,
                                })}
                              </p>
                            ) : null}

                            <div className="registration-trial">
                              <Clock3 size={16} aria-hidden="true" />

                              {t('reg.trialDays', { count: plan.trialDays })}
                            </div>
                          </>
                        )}
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
                          disabled={isSubmitting && !plan.byRequest}
                          onClick={() =>
                            plan.byRequest
                              ? (window.location.hash = '#enterprise')
                              : void choosePlan(plan)
                          }
                        >
                          {plan.byRequest
                            ? t('reg.discuss')
                            : isSubmitting
                              ? t('reg.savingChoice')
                              : anchor
                                ? `${t('reg.choosePlan')} · −${anchor.off}%`
                                : t('reg.choosePlan')}
                        </button>

                        {/*
                          Подарок — под кнопкой, а не над ней: так решения
                          на всех карточках стоят в один ряд, а подарок
                          остаётся доводом сразу под выбором. Пусто — акции
                          нет, кончилась или оплата месячная.
                        */}
                        {giftOnPlan(t, plan.annualGift)}

                        <p className="registration-plan-cta">
                          {plan.byRequest
                            ? t('reg.plan.ctaByRequest')
                            : t('reg.plan.cta', { plan: plan.name })}
                        </p>

                        <p className="registration-plan-includes">
                          {previous
                            ? t('reg.plan.includesPlus', {
                                plan: previous.name,
                              })
                            : t('reg.plan.includes')}
                        </p>

                        {/*
                          Видны первые пять, остальное — по нажатию.

                          Это осталось ради Start: своих строк у него
                          десять, и стена из десяти не читается. У
                          Business и Premium своих строк три и одна —
                          там кнопка не появляется вовсе, и это верно:
                          прятать нечего.
                        */}
                        <ul>
                          {/*
                            Числа тарифа — сверху, каждое своей строкой и
                            со своей галочкой: это отдельные обещания, а
                            не одна длинная фраза. Написаны светлее
                            прочих, потому что это и есть разница между
                            тарифами; всё, что ниже черты, есть у всех.
                          */}
                          {planNumbers(plan).map((row, place, rows) => (
                            <li
                              key={row.id}
                              className={
                                place === rows.length - 1
                                  ? 'registration-plan-key registration-plan-edge'
                                  : 'registration-plan-key'
                              }
                            >
                              <Check size={15} aria-hidden="true" />

                              <span>
                                {row.text}

                                {row.note ? <small>{row.note}</small> : null}
                              </span>
                            </li>
                          ))}

                          {(openPlans[plan.id]
                            ? features
                            : features.slice(0, VISIBLE_FEATURES)
                          ).map((feature) => (
                            <li key={feature}>
                              <Check size={15} aria-hidden="true" />

                              <span>{feature}</span>
                            </li>
                          ))}
                        </ul>

                        {features.length > VISIBLE_FEATURES ? (
                          <button
                            type="button"
                            className="registration-plan-more"
                            onClick={() =>
                              setOpenPlans((current) => ({
                                ...current,
                                [plan.id]: !current[plan.id],
                              }))
                            }
                          >
                            {openPlans[plan.id]
                              ? t('reg.plan.hideAll')
                              : t('reg.plan.showAll', {
                                  count: features.length - VISIBLE_FEATURES,
                                })}
                          </button>
                        ) : null}
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

                  {/*
                    Промокод — необязательное поле, и выглядеть оно
                    должно так же, как прочие необязательные. Звёздочки
                    и рамки вокруг него сделали бы вид, что без кода
                    регистрация неполная.
                  */}
                  <label>
                    <span>{t('reg.promoCode')}</span>
                    <input
                      type="text"
                      value={form.promoCode}
                      onChange={(event) =>
                        updateField('promoCode', event.target.value)
                      }
                      maxLength={40}
                      autoCapitalize="characters"
                      autoComplete="off"
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
                      {READY_LANGUAGES.map((one) => (
                        <option key={one.code} value={one.code}>
                          {one.name}
                        </option>
                      ))}
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
