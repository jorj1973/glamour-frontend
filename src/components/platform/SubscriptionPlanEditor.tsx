import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  History,
  RefreshCw,
  Save,
  X,
} from "lucide-react";

import axios from "axios";

import api from "../../api/api";
import type { PlatformSubscriptionPlan } from "./MarketingActionsPanel";

type SubscriptionPlanEditorProps = {
  monthlyPlan: PlatformSubscriptionPlan | null;
  yearlyPlan: PlatformSubscriptionPlan | null;
  onClose: () => void;
  onUpdated: (plan: PlatformSubscriptionPlan) => void;
};

type PlanFormState = {
  price: string;
  trialDays: string;
  annualBonusDays: string;
  referralBonusDays: string;
  maxMasters: string;
  maxAdministrators: string;
  maxLocations: string;
  isActive: boolean;
  isFeatured: boolean;
  changeReason: string;
};

type UpdatePlanResponse = {
  message: string;
  pricingVersionCreated: boolean;
  plan: PlatformSubscriptionPlan;
};

type ApiErrorResponse = {
  message?: string | string[];
};

type PlanHistoryEntry = {
  id: string;
  planId: string;
  version: number;
  price: string;
  currency: string;
  billingPeriod: "monthly" | "yearly";
  annualBonusDays: number;
  referralBonusDays: number;
  trialDays: number;
  effectiveFrom: string;
  createdByUserId: string | null;
  changeReason: string;
  createdAt: string;
};

type PlanHistoryResponse = {
  plan: {
    id: string;
    code: string;
    planGroupCode: string;
    name: string;
    billingPeriod: "monthly" | "yearly";
    currentVersion: number;
  };
  history: PlanHistoryEntry[];
};

type HistoryLoadState = "idle" | "loading" | "ready" | "error";

function formatHistoryDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Дата не указана";
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatHistoryPrice(value: string, currency: string): string {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return `${value} ${currency}`;
  }

  return (
    new Intl.NumberFormat("ru-RU", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(numberValue) + ` ${currency}`
  );
}

function nullableLimitToInput(value: number | null): string {
  return value === null ? "" : String(value);
}

function createFormState(plan: PlatformSubscriptionPlan): PlanFormState {
  return {
    price: plan.price,
    trialDays: String(plan.trialDays),
    annualBonusDays: String(plan.annualBonusDays),
    referralBonusDays: String(plan.referralBonusDays),
    maxMasters: nullableLimitToInput(plan.maxMasters),
    maxAdministrators: nullableLimitToInput(plan.maxAdministrators),
    maxLocations: nullableLimitToInput(plan.maxLocations),
    isActive: plan.isActive,
    isFeatured: plan.isFeatured,
    changeReason: "",
  };
}

function parseRequiredNonNegativeInteger(value: string, label: string): number {
  const normalizedValue = value.trim();

  if (!/^\d+$/.test(normalizedValue)) {
    throw new Error(`${label}: укажите целое число от 0 и выше.`);
  }

  const numberValue = Number(normalizedValue);

  if (!Number.isSafeInteger(numberValue)) {
    throw new Error(`${label}: указано слишком большое значение.`);
  }

  return numberValue;
}

function parseNullablePositiveInteger(
  value: string,
  label: string,
): number | null {
  const normalizedValue = value.trim();

  if (!normalizedValue) {
    return null;
  }

  if (!/^[1-9]\d*$/.test(normalizedValue)) {
    throw new Error(
      `${label}: укажите целое число от 1 или оставьте поле пустым для отсутствия лимита.`,
    );
  }

  const numberValue = Number(normalizedValue);

  if (!Number.isSafeInteger(numberValue)) {
    throw new Error(`${label}: указано слишком большое значение.`);
  }

  return numberValue;
}

function validatePrice(value: string): string {
  const normalizedValue = value.trim().replace(",", ".");

  if (!/^\d+(\.\d{1,2})?$/.test(normalizedValue)) {
    throw new Error(
      "Цена должна быть положительным числом, максимум с двумя знаками после запятой.",
    );
  }

  const numberValue = Number(normalizedValue);

  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    throw new Error("Цена должна быть больше нуля.");
  }

  return normalizedValue;
}

function resolveInitialPlan(
  monthlyPlan: PlatformSubscriptionPlan | null,
  yearlyPlan: PlatformSubscriptionPlan | null,
): PlatformSubscriptionPlan {
  const initialPlan = monthlyPlan ?? yearlyPlan;

  if (!initialPlan) {
    throw new Error("Subscription plan group has no billing variants");
  }

  return initialPlan;
}

function SubscriptionPlanEditor({
  monthlyPlan,
  yearlyPlan,
  onClose,
  onUpdated,
}: SubscriptionPlanEditorProps) {
  const initialPlan = resolveInitialPlan(monthlyPlan, yearlyPlan);

  const [activePeriod, setActivePeriod] = useState<"monthly" | "yearly">(
    monthlyPlan ? "monthly" : "yearly",
  );

  const activePlan = activePeriod === "monthly" ? monthlyPlan : yearlyPlan;

  const plan = activePlan ?? initialPlan;

  const [form, setForm] = useState<PlanFormState>(createFormState(initialPlan));

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");

  const [successMessage, setSuccessMessage] = useState("");

  const [history, setHistory] = useState<PlanHistoryEntry[]>([]);

  const [historyLoadState, setHistoryLoadState] =
    useState<HistoryLoadState>("idle");

  const [historyError, setHistoryError] = useState("");

  const loadHistory = useCallback(async () => {
    setHistoryLoadState("loading");
    setHistoryError("");

    try {
      const response = await api.get<PlanHistoryResponse>(
        `/platform-admin/plans/${plan.id}/history`,
      );

      setHistory(response.data.history);
      setHistoryLoadState("ready");
    } catch (error) {
      const fallbackMessage = "Не удалось загрузить историю изменений тарифа.";

      if (axios.isAxiosError<ApiErrorResponse>(error)) {
        const responseMessage = error.response?.data?.message;

        if (Array.isArray(responseMessage)) {
          setHistoryError(responseMessage.join(" "));
        } else {
          setHistoryError(responseMessage || fallbackMessage);
        }
      } else {
        setHistoryError(fallbackMessage);
      }

      setHistoryLoadState("error");
    }
  }, [plan.id]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadHistory();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [loadHistory]);

  function updateField(field: keyof PlanFormState, value: string | boolean) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function selectPeriod(period: "monthly" | "yearly") {
    const nextPlan = period === "monthly" ? monthlyPlan : yearlyPlan;

    if (!nextPlan || isSubmitting) {
      return;
    }

    setActivePeriod(period);
    setForm(createFormState(nextPlan));
    setErrorMessage("");
    setSuccessMessage("");
    setHistory([]);
    setHistoryLoadState("idle");
    setHistoryError("");
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setErrorMessage("");
    setSuccessMessage("");

    const changeReason = form.changeReason.trim();

    if (changeReason.length < 3) {
      setErrorMessage(
        "Укажите причину изменения длиной не менее трёх символов.",
      );
      return;
    }

    try {
      const price = validatePrice(form.price);

      const trialDays = parseRequiredNonNegativeInteger(
        form.trialDays,
        "Пробный период",
      );

      const annualBonusDays = parseRequiredNonNegativeInteger(
        form.annualBonusDays,
        "Годовой бонус",
      );

      const referralBonusDays = parseRequiredNonNegativeInteger(
        form.referralBonusDays,
        "Реферальный бонус",
      );

      if (plan.billingPeriod === "monthly" && annualBonusDays !== 0) {
        throw new Error(
          "Для ежемесячного тарифа годовой бонус должен быть равен нулю.",
        );
      }

      const maxMasters = parseNullablePositiveInteger(
        form.maxMasters,
        "Лимит мастеров",
      );

      const maxAdministrators = parseNullablePositiveInteger(
        form.maxAdministrators,
        "Лимит администраторов",
      );

      const maxLocations = parseNullablePositiveInteger(
        form.maxLocations,
        "Лимит филиалов",
      );

      setIsSubmitting(true);

      const response = await api.patch<UpdatePlanResponse>(
        `/platform-admin/plans/${plan.id}`,
        {
          price,
          trialDays,
          annualBonusDays,
          referralBonusDays,
          maxMasters,
          maxAdministrators,
          maxLocations,
          isActive: form.isActive,
          isFeatured: form.isFeatured,
          changeReason,
        },
      );

      setForm({
        ...createFormState(response.data.plan),
        changeReason: "",
      });

      setSuccessMessage(
        response.data.pricingVersionCreated
          ? `Тариф сохранён. Создана новая версия цены v${response.data.plan.priceVersion}.`
          : "Тариф сохранён без создания новой версии цены.",
      );

      onUpdated(response.data.plan);

      if (response.data.pricingVersionCreated) {
        await loadHistory();
      }
    } catch (error) {
      const fallbackMessage =
        "Не удалось сохранить тариф. Проверьте данные и повторите попытку.";

      if (axios.isAxiosError<ApiErrorResponse>(error)) {
        const responseMessage = error.response?.data?.message;

        if (Array.isArray(responseMessage)) {
          setErrorMessage(responseMessage.join(" "));
        } else {
          setErrorMessage(responseMessage || fallbackMessage);
        }
      } else if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage(fallbackMessage);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section
      className="platform-plan-editor"
      aria-labelledby="platform-plan-editor-title"
    >
      <div className="platform-plan-editor-header">
        <div>
          <p className="panel-kicker">РЕДАКТОР ТАРИФА</p>

          <h2 id="platform-plan-editor-title">Настройка тарифа {plan.name}</h2>

          <p>Выберите период оплаты и настройте его условия.</p>
        </div>

        <button
          type="button"
          className="platform-plan-editor-close"
          onClick={onClose}
          aria-label="Закрыть редактор тарифа"
        >
          <X size={19} aria-hidden="true" />
        </button>
      </div>

      <form className="platform-plan-editor-form" onSubmit={handleSubmit}>
        <div
          className="platform-plan-period-switch"
          role="group"
          aria-label="Период оплаты тарифа"
        >
          <button
            type="button"
            className={activePeriod === "monthly" ? "active" : ""}
            onClick={() => selectPeriod("monthly")}
            disabled={!monthlyPlan || isSubmitting}
          >
            Ежемесячный
          </button>

          <button
            type="button"
            className={activePeriod === "yearly" ? "active" : ""}
            onClick={() => selectPeriod("yearly")}
            disabled={!yearlyPlan || isSubmitting}
          >
            Годовой
          </button>
        </div>

        <div className="platform-plan-period-summary">
          <strong>
            {activePeriod === "monthly"
              ? "Ежемесячная оплата"
              : "Годовая оплата"}
          </strong>

          <span>Версия цены v{plan.priceVersion}</span>
        </div>

        <div className="platform-plan-editor-grid">
          <label>
            <span>Цена, {plan.currency}</span>

            <input
              type="text"
              inputMode="decimal"
              value={form.price}
              onChange={(event) => updateField("price", event.target.value)}
              disabled={isSubmitting}
            />
          </label>

          <label>
            <span>Пробный период, дней</span>

            <input
              type="number"
              min="0"
              step="1"
              value={form.trialDays}
              onChange={(event) => updateField("trialDays", event.target.value)}
              disabled={isSubmitting}
            />
          </label>

          <label>
            <span>Годовой бонус, дней</span>

            <input
              type="number"
              min="0"
              step="1"
              value={form.annualBonusDays}
              onChange={(event) =>
                updateField("annualBonusDays", event.target.value)
              }
              disabled={isSubmitting || plan.billingPeriod === "monthly"}
            />

            {plan.billingPeriod === "monthly" ? (
              <small>Для ежемесячного варианта всегда 0.</small>
            ) : null}
          </label>

          <label>
            <span>Реферальный бонус, дней</span>

            <input
              type="number"
              min="0"
              step="1"
              value={form.referralBonusDays}
              onChange={(event) =>
                updateField("referralBonusDays", event.target.value)
              }
              disabled={isSubmitting}
            />
          </label>

          <label>
            <span>Максимум мастеров</span>

            <input
              type="number"
              min="1"
              step="1"
              value={form.maxMasters}
              onChange={(event) =>
                updateField("maxMasters", event.target.value)
              }
              placeholder="Без лимита"
              disabled={isSubmitting}
            />
          </label>

          <label>
            <span>Максимум администраторов</span>

            <input
              type="number"
              min="1"
              step="1"
              value={form.maxAdministrators}
              onChange={(event) =>
                updateField("maxAdministrators", event.target.value)
              }
              placeholder="Без лимита"
              disabled={isSubmitting}
            />
          </label>

          <label>
            <span>Максимум филиалов</span>

            <input
              type="number"
              min="1"
              step="1"
              value={form.maxLocations}
              onChange={(event) =>
                updateField("maxLocations", event.target.value)
              }
              placeholder="Без лимита"
              disabled={isSubmitting}
            />
          </label>
        </div>

        <div className="platform-plan-editor-switches">
          <label>
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(event) =>
                updateField("isActive", event.target.checked)
              }
              disabled={isSubmitting}
            />

            <span>
              <strong>Тариф активен</strong>
              <small>Доступен для новых регистраций.</small>
            </span>
          </label>

          <label>
            <input
              type="checkbox"
              checked={form.isFeatured}
              onChange={(event) =>
                updateField("isFeatured", event.target.checked)
              }
              disabled={isSubmitting}
            />

            <span>
              <strong>Рекомендуемый тариф</strong>
              <small>Показывается как приоритетный вариант.</small>
            </span>
          </label>
        </div>

        <label className="platform-plan-editor-reason">
          <span>Причина изменения</span>

          <textarea
            value={form.changeReason}
            onChange={(event) =>
              updateField("changeReason", event.target.value)
            }
            placeholder="Например: обновление стоимости с 1 августа"
            maxLength={500}
            rows={3}
            disabled={isSubmitting}
          />

          <small>Причина сохраняется в защищённой истории изменений.</small>
        </label>

        {errorMessage ? (
          <div className="platform-plan-editor-error" role="alert">
            <AlertTriangle size={18} aria-hidden="true" />

            {errorMessage}
          </div>
        ) : null}

        {successMessage ? (
          <div className="platform-plan-editor-success" role="status">
            <CheckCircle2 size={18} aria-hidden="true" />

            {successMessage}
          </div>
        ) : null}

        <section
          className="platform-plan-history"
          aria-labelledby="platform-plan-history-title"
        >
          <div className="platform-plan-history-header">
            <div>
              <div className="platform-plan-history-title">
                <History size={19} aria-hidden="true" />

                <h3 id="platform-plan-history-title">История изменения цены</h3>
              </div>

              <p>
                {plan.billingPeriod === "monthly"
                  ? "Ежемесячный вариант"
                  : "Годовой вариант"}{" "}
                · текущая версия v{plan.priceVersion}
              </p>
            </div>

            <button
              type="button"
              className="platform-plan-history-refresh"
              onClick={() => void loadHistory()}
              disabled={historyLoadState === "loading"}
            >
              <RefreshCw
                size={16}
                aria-hidden="true"
                className={
                  historyLoadState === "loading"
                    ? "platform-plan-history-refreshing"
                    : ""
                }
              />
              Обновить
            </button>
          </div>

          {historyLoadState === "loading" ? (
            <div className="platform-plan-history-status">
              Загружается история…
            </div>
          ) : null}

          {historyLoadState === "error" ? (
            <div className="platform-plan-history-error" role="alert">
              <AlertTriangle size={18} aria-hidden="true" />

              {historyError}
            </div>
          ) : null}

          {historyLoadState === "ready" && history.length === 0 ? (
            <div className="platform-plan-history-status">
              История изменений пока отсутствует.
            </div>
          ) : null}

          {historyLoadState === "ready" && history.length > 0 ? (
            <div className="platform-plan-history-list">
              {history.map((entry) => (
                <article key={entry.id} className="platform-plan-history-item">
                  <div className="platform-plan-history-version">
                    <strong>v{entry.version}</strong>

                    <span>
                      {formatHistoryPrice(entry.price, entry.currency)}
                    </span>
                  </div>

                  <div className="platform-plan-history-content">
                    <div className="platform-plan-history-meta">
                      <span>
                        <Clock3 size={14} aria-hidden="true" />

                        {formatHistoryDate(entry.createdAt)}
                      </span>

                      <span>Trial: {entry.trialDays} дней</span>

                      <span>
                        Реферальный бонус: {entry.referralBonusDays} дней
                      </span>

                      {entry.billingPeriod === "yearly" ? (
                        <span>Годовой бонус: {entry.annualBonusDays} дней</span>
                      ) : null}
                    </div>

                    <p>{entry.changeReason}</p>

                    <small>
                      {entry.createdByUserId
                        ? "Изменено владельцем платформы"
                        : "Системная запись"}
                    </small>
                  </div>
                </article>
              ))}
            </div>
          ) : null}
        </section>

        <div className="platform-plan-editor-actions">
          <button
            type="button"
            className="platform-plan-editor-cancel"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Отмена
          </button>

          <button
            type="submit"
            className="platform-plan-editor-save"
            disabled={isSubmitting}
          >
            <Save size={17} aria-hidden="true" />

            {isSubmitting ? "Сохранение…" : "Сохранить тариф"}
          </button>
        </div>
      </form>
    </section>
  );
}

export default SubscriptionPlanEditor;
