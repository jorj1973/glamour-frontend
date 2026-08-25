import { useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Gift,
  Pencil,
  Plus,
  RefreshCw,
  Ticket,
  UsersRound,
  X,
} from "lucide-react";

import axios from "axios";

import api from "../../api/api";
import type { PlatformPromotion, PlatformPromotionType } from "./MarketingActionsPanel";

export type PromotionSalonOption = {
  id: string;
  name: string;
};

type PromotionsBoardProps = {
  promotions: PlatformPromotion[];
  salons: PromotionSalonOption[];
  isLoading: boolean;
  errorMessage: string;
  onClose: () => void;
  onReload: () => void;
  onPromotionCreated: (promotion: PlatformPromotion) => void;
  onPromotionUpdated: (promotion: PlatformPromotion) => void;
};

type PromotionFormState = {
  name: string;
  description: string;
  type: PlatformPromotionType;
  promoCode: string;
  bonusDays: string;
  maxRedemptions: string;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
};

type ApiErrorResponse = {
  message?: string | string[];
};

const EMPTY_FORM: PromotionFormState = {
  name: "",
  description: "",
  type: "first_n_salons",
  promoCode: "",
  bonusDays: "14",
  maxRedemptions: "",
  startsAt: "",
  endsAt: "",
  isActive: true,
};

const TYPE_OPTIONS: {
  value: PlatformPromotionType;
  label: string;
  hint: string;
  icon: typeof UsersRound;
}[] = [
  {
    value: "first_n_salons",
    label: "Первые N салонов",
    hint: "Бонус достаётся только первым N салонам, которым вы его выдадите.",
    icon: UsersRound,
  },
  {
    value: "promo_code",
    label: "Промокод",
    hint: "Салон называет код — вы находите акцию по нему и выдаёте бонус.",
    icon: Ticket,
  },
  {
    value: "seasonal",
    label: "Сезонное предложение",
    hint: "Действует только в указанные даты.",
    icon: CalendarDays,
  },
];

function formToEditState(promotion: PlatformPromotion): PromotionFormState {
  return {
    name: promotion.name,
    description: promotion.description ?? "",
    type: promotion.type,
    promoCode: promotion.promoCode ?? "",
    bonusDays: String(promotion.bonusDays),
    maxRedemptions:
      promotion.maxRedemptions === null ? "" : String(promotion.maxRedemptions),
    startsAt: promotion.startsAt ? promotion.startsAt.slice(0, 10) : "",
    endsAt: promotion.endsAt ? promotion.endsAt.slice(0, 10) : "",
    isActive: promotion.isActive,
  };
}

function parseRequiredPositiveInteger(value: string, label: string): number {
  const normalizedValue = value.trim();

  if (!/^\d+$/.test(normalizedValue) || Number(normalizedValue) < 1) {
    throw new Error(`${label}: укажите целое число от 1 и выше.`);
  }

  const numberValue = Number(normalizedValue);

  if (!Number.isSafeInteger(numberValue)) {
    throw new Error(`${label}: указано слишком большое значение.`);
  }

  return numberValue;
}

function parseOptionalPositiveInteger(
  value: string,
  label: string,
): number | null {
  const normalizedValue = value.trim();

  if (!normalizedValue) {
    return null;
  }

  return parseRequiredPositiveInteger(normalizedValue, label);
}

function extractErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError<ApiErrorResponse>(error)) {
    const responseMessage = error.response?.data?.message;

    if (Array.isArray(responseMessage)) {
      return responseMessage.join(" ");
    }

    return responseMessage || fallback;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}

function formatDate(value: string | null): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function getPromotionStatus(promotion: PlatformPromotion): {
  label: string;
  className: string;
} {
  const now = new Date();

  if (!promotion.isActive) {
    return { label: "Отключена", className: "platform-status platform-status-danger" };
  }

  if (promotion.endsAt && new Date(promotion.endsAt) < now) {
    return { label: "Истекла", className: "platform-status platform-status-danger" };
  }

  if (promotion.startsAt && new Date(promotion.startsAt) > now) {
    return { label: "Ещё не началась", className: "platform-status" };
  }

  if (
    promotion.maxRedemptions !== null &&
    promotion.redeemedCount >= promotion.maxRedemptions
  ) {
    return { label: "Мест не осталось", className: "platform-status platform-status-danger" };
  }

  return { label: "Активна", className: "platform-status platform-status-active" };
}

function getTypeLabel(type: PlatformPromotionType): string {
  return TYPE_OPTIONS.find((option) => option.value === type)?.label ?? type;
}

function PromotionForm({
  initialState,
  promotionId,
  onCancel,
  onSaved,
}: {
  initialState: PromotionFormState;
  promotionId: string | null;
  onCancel: () => void;
  onSaved: (promotion: PlatformPromotion, wasCreated: boolean) => void;
}) {
  const isEditing = promotionId !== null;

  const [form, setForm] = useState<PromotionFormState>(initialState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  function updateField(
    field: keyof PromotionFormState,
    value: string | boolean,
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setErrorMessage("");
    setSuccessMessage("");

    try {
      const name = form.name.trim();

      if (name.length < 2) {
        throw new Error("Название: минимум 2 символа.");
      }

      const bonusDays = parseRequiredPositiveInteger(
        form.bonusDays,
        "Бонусные дни",
      );

      const maxRedemptions = parseOptionalPositiveInteger(
        form.maxRedemptions,
        "Количество мест",
      );

      if (form.type === "first_n_salons" && maxRedemptions === null) {
        throw new Error(
          "Для «Первых N салонов» укажите количество мест.",
        );
      }

      const promoCode = form.promoCode.trim();

      if (form.type === "promo_code" && promoCode.length < 3) {
        throw new Error("Укажите промокод длиной не менее 3 символов.");
      }

      if (form.type === "seasonal" && !form.startsAt && !form.endsAt) {
        throw new Error(
          "Для сезонного предложения укажите дату начала или окончания.",
        );
      }

      const payload = {
        name,
        description: form.description.trim() || null,
        type: form.type,
        promoCode: form.type === "promo_code" ? promoCode : null,
        bonusDays,
        maxRedemptions,
        startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
        endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
        isActive: form.isActive,
      };

      setIsSubmitting(true);

      if (isEditing && promotionId) {
        const { type: _type, ...updatePayload } = payload;

        void _type;

        const response = await api.patch<PlatformPromotion>(
          `/platform-admin/promotions/${promotionId}`,
          updatePayload,
        );

        setSuccessMessage("Акция сохранена.");
        onSaved(response.data, false);
      } else {
        const response = await api.post<PlatformPromotion>(
          "/platform-admin/promotions",
          payload,
        );

        setSuccessMessage("Акция создана.");
        setForm({ ...EMPTY_FORM });
        onSaved(response.data, true);
      }
    } catch (error) {
      setErrorMessage(
        extractErrorMessage(error, "Не удалось сохранить акцию."),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="platform-plan-editor-form" onSubmit={handleSubmit}>
      <div
        className="platform-promotion-type-switch"
        role="group"
        aria-label="Тип акции"
      >
        {TYPE_OPTIONS.map((option) => {
          const Icon = option.icon;

          return (
            <button
              key={option.value}
              type="button"
              className={form.type === option.value ? "active" : ""}
              onClick={() => updateField("type", option.value)}
              disabled={isSubmitting || isEditing}
              title={isEditing ? "Тип акции нельзя изменить после создания" : undefined}
            >
              <Icon size={16} aria-hidden="true" />
              {option.label}
            </button>
          );
        })}
      </div>

      <p className="platform-promotion-type-hint">
        {TYPE_OPTIONS.find((option) => option.value === form.type)?.hint}
      </p>

      <div className="platform-plan-editor-grid">
        <label>
          <span>Название</span>

          <input
            type="text"
            value={form.name}
            onChange={(event) => updateField("name", event.target.value)}
            disabled={isSubmitting}
            maxLength={120}
          />
        </label>

        <label>
          <span>Бонусные дни</span>

          <input
            type="number"
            min="1"
            step="1"
            value={form.bonusDays}
            onChange={(event) => updateField("bonusDays", event.target.value)}
            disabled={isSubmitting}
          />
        </label>

        {form.type === "promo_code" ? (
          <label>
            <span>Промокод</span>

            <input
              type="text"
              value={form.promoCode}
              onChange={(event) =>
                updateField("promoCode", event.target.value.toUpperCase())
              }
              disabled={isSubmitting}
              placeholder="AUTUMN2026"
              maxLength={40}
            />
          </label>
        ) : null}

        <label>
          <span>
            {form.type === "first_n_salons"
              ? "Количество мест (N)"
              : "Ограничить число выдач"}
          </span>

          <input
            type="number"
            min="1"
            step="1"
            value={form.maxRedemptions}
            onChange={(event) =>
              updateField("maxRedemptions", event.target.value)
            }
            disabled={isSubmitting}
            placeholder={
              form.type === "first_n_salons" ? "" : "Без ограничения"
            }
          />
        </label>

        <label>
          <span>Начало действия</span>

          <input
            type="date"
            value={form.startsAt}
            onChange={(event) => updateField("startsAt", event.target.value)}
            disabled={isSubmitting}
          />
        </label>

        <label>
          <span>Окончание действия</span>

          <input
            type="date"
            value={form.endsAt}
            onChange={(event) => updateField("endsAt", event.target.value)}
            disabled={isSubmitting}
          />
        </label>
      </div>

      <label className="platform-plan-editor-reason">
        <span>Описание (необязательно)</span>

        <textarea
          value={form.description}
          onChange={(event) => updateField("description", event.target.value)}
          maxLength={500}
          rows={2}
          disabled={isSubmitting}
        />
      </label>

      <div className="platform-plan-editor-switches">
        <label>
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(event) => updateField("isActive", event.target.checked)}
            disabled={isSubmitting}
          />

          <span>
            <strong>Акция активна</strong>
            <small>Можно будет выдавать салонам сразу после сохранения.</small>
          </span>
        </label>
      </div>

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
          onClick={onCancel}
          disabled={isSubmitting}
        >
          {isEditing ? "Отмена" : "Очистить"}
        </button>

        <button
          type="submit"
          className="platform-plan-editor-save"
          disabled={isSubmitting}
        >
          <Plus size={17} aria-hidden="true" />
          {isSubmitting
            ? "Сохранение…"
            : isEditing
              ? "Сохранить акцию"
              : "Создать акцию"}
        </button>
      </div>
    </form>
  );
}

function PromotionCard({
  promotion,
  salons,
  onUpdated,
  onEdit,
}: {
  promotion: PlatformPromotion;
  salons: PromotionSalonOption[];
  onUpdated: (promotion: PlatformPromotion) => void;
  onEdit: () => void;
}) {
  const [selectedSalonId, setSelectedSalonId] = useState("");
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [redeemError, setRedeemError] = useState("");
  const [redeemSuccess, setRedeemSuccess] = useState("");

  const status = getPromotionStatus(promotion);

  async function handleToggleActive() {
    try {
      const response = await api.patch<PlatformPromotion>(
        `/platform-admin/promotions/${promotion.id}`,
        {
          isActive: !promotion.isActive,
        },
      );

      onUpdated(response.data);
    } catch (error) {
      setRedeemError(extractErrorMessage(error, "Не удалось изменить статус акции."));
    }
  }

  async function handleRedeem() {
    if (!selectedSalonId) {
      setRedeemError("Выберите салон.");
      return;
    }

    setRedeemError("");
    setRedeemSuccess("");
    setIsRedeeming(true);

    try {
      const response = await api.post<{
        promotion: PlatformPromotion;
      }>(`/platform-admin/promotions/${promotion.id}/redeem`, {
        salonId: selectedSalonId,
      });

      onUpdated(response.data.promotion);
      setRedeemSuccess("Бонус начислен салону.");
      setSelectedSalonId("");
    } catch (error) {
      setRedeemError(extractErrorMessage(error, "Не удалось выдать бонус."));
    } finally {
      setIsRedeeming(false);
    }
  }

  return (
    <article className="platform-plan-card platform-promotion-card">
      <div className="platform-plan-card-header">
        <div>
          <span>{getTypeLabel(promotion.type)}</span>
          <h3>{promotion.name}</h3>
        </div>

        <span className={status.className}>{status.label}</span>
      </div>

      {promotion.description ? <p>{promotion.description}</p> : null}

      <dl className="platform-plan-details">
        <div>
          <dt>Бонус</dt>
          <dd>+{promotion.bonusDays} дней</dd>
        </div>

        {promotion.promoCode ? (
          <div>
            <dt>Промокод</dt>
            <dd>{promotion.promoCode}</dd>
          </div>
        ) : null}

        <div>
          <dt>Выдано</dt>
          <dd>
            {promotion.redeemedCount}
            {promotion.maxRedemptions !== null
              ? ` из ${promotion.maxRedemptions}`
              : ""}
          </dd>
        </div>

        {promotion.startsAt || promotion.endsAt ? (
          <div>
            <dt>Период</dt>
            <dd>
              {formatDate(promotion.startsAt)} — {formatDate(promotion.endsAt)}
            </dd>
          </div>
        ) : null}
      </dl>

      <div className="platform-promotion-redeem-row">
        <select
          value={selectedSalonId}
          onChange={(event) => setSelectedSalonId(event.target.value)}
          disabled={isRedeeming}
        >
          <option value="">Выбрать салон…</option>

          {salons.map((salon) => (
            <option key={salon.id} value={salon.id}>
              {salon.name}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => void handleRedeem()}
          disabled={isRedeeming || !selectedSalonId}
        >
          <Gift size={16} aria-hidden="true" />
          {isRedeeming ? "Выдаём…" : "Выдать бонус"}
        </button>
      </div>

      {redeemError ? (
        <div className="platform-plan-editor-error" role="alert">
          <AlertTriangle size={16} aria-hidden="true" />
          {redeemError}
        </div>
      ) : null}

      {redeemSuccess ? (
        <div className="platform-plan-editor-success" role="status">
          <CheckCircle2 size={16} aria-hidden="true" />
          {redeemSuccess}
        </div>
      ) : null}

      <div className="platform-plan-actions">
        <button type="button" onClick={onEdit}>
          <Pencil size={16} aria-hidden="true" />
          Изменить
        </button>

        <button type="button" onClick={() => void handleToggleActive()}>
          {promotion.isActive ? "Отключить" : "Включить"}
        </button>
      </div>
    </article>
  );
}

function PromotionsBoard({
  promotions,
  salons,
  isLoading,
  errorMessage,
  onClose,
  onReload,
  onPromotionCreated,
  onPromotionUpdated,
}: PromotionsBoardProps) {
  const [editingPromotion, setEditingPromotion] =
    useState<PlatformPromotion | null>(null);

  const [formKey, setFormKey] = useState(0);

  return (
    <section
      className="platform-plan-editor platform-promotions-board"
      aria-labelledby="platform-promotions-board-title"
    >
      <div className="platform-plan-editor-header">
        <div>
          <p className="panel-kicker">БЛОК 3 · АКЦИИ И БОНУСЫ</p>

          <h2 id="platform-promotions-board-title">
            {editingPromotion ? `Изменить «${editingPromotion.name}»` : "Новая акция"}
          </h2>

          <p>Событие + условия + награда — и акцию можно выдавать салонам.</p>
        </div>

        <button
          type="button"
          className="platform-plan-editor-close"
          onClick={onClose}
          aria-label="Закрыть конструктор акций"
        >
          <X size={19} aria-hidden="true" />
        </button>
      </div>

      <PromotionForm
        key={editingPromotion?.id ?? `new-${formKey}`}
        initialState={
          editingPromotion ? formToEditState(editingPromotion) : { ...EMPTY_FORM }
        }
        promotionId={editingPromotion?.id ?? null}
        onCancel={() => {
          setEditingPromotion(null);
          setFormKey((value) => value + 1);
        }}
        onSaved={(promotion, wasCreated) => {
          if (wasCreated) {
            onPromotionCreated(promotion);
            setFormKey((value) => value + 1);
          } else {
            onPromotionUpdated(promotion);
            setEditingPromotion(promotion);
          }
        }}
      />

      <section className="platform-plan-history">
        <div className="platform-plan-history-header">
          <div>
            <div className="platform-plan-history-title">
              <Gift size={19} aria-hidden="true" />
              <h3>Существующие акции</h3>
            </div>

            <p>Всего: {promotions.length}</p>
          </div>

          <button
            type="button"
            className="platform-plan-history-refresh"
            onClick={onReload}
            disabled={isLoading}
          >
            <RefreshCw
              size={16}
              aria-hidden="true"
              className={isLoading ? "platform-plan-history-refreshing" : ""}
            />
            Обновить
          </button>
        </div>

        {isLoading ? (
          <div className="platform-plan-history-status">Загружаются акции…</div>
        ) : null}

        {errorMessage ? (
          <div className="platform-plan-history-error" role="alert">
            <AlertTriangle size={18} aria-hidden="true" />
            {errorMessage}
          </div>
        ) : null}

        {!isLoading && promotions.length === 0 ? (
          <div className="platform-plan-history-status">
            Акций пока нет — заполните форму выше.
          </div>
        ) : null}

        {!isLoading && promotions.length > 0 ? (
          <div className="platform-plan-cards platform-promotion-cards">
            {promotions.map((promotion) => (
              <PromotionCard
                key={promotion.id}
                promotion={promotion}
                salons={salons}
                onUpdated={onPromotionUpdated}
                onEdit={() => setEditingPromotion(promotion)}
              />
            ))}
          </div>
        ) : null}
      </section>
    </section>
  );
}

export default PromotionsBoard;
