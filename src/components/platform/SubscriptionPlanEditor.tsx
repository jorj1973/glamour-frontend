import { useState } from "react";
import { AlertTriangle, CheckCircle2, Save, X } from "lucide-react";

import api from "../../api/api";
import type { PlatformSubscriptionPlan } from "./MarketingActionsPanel";

type SubscriptionPlanEditorProps = {
  plan: PlatformSubscriptionPlan;
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

function SubscriptionPlanEditor({
  plan,
  onClose,
  onUpdated,
}: SubscriptionPlanEditorProps) {
  const [form, setForm] = useState<PlanFormState>(createFormState(plan));

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");

  const [successMessage, setSuccessMessage] = useState("");

  function updateField(field: keyof PlanFormState, value: string | boolean) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
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
          limits: {
            maxMasters,
            maxAdministrators,
            maxLocations,
          },
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
    } catch (error) {
      const fallbackMessage =
        "Не удалось сохранить тариф. Проверьте данные и повторите попытку.";

      if (error instanceof Error) {
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

          <h2 id="platform-plan-editor-title">{plan.name}</h2>

          <p>
            {plan.billingPeriod === "monthly"
              ? "Ежемесячный вариант"
              : "Годовой вариант"}{" "}
            · версия цены v{plan.priceVersion}
          </p>
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
