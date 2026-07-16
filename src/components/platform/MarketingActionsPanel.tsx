import {
  BadgePercent,
  CalendarDays,
  Gift,
  History,
  Megaphone,
  Pencil,
  Plus,
  Puzzle,
  UsersRound,
} from "lucide-react";

export type PlatformSubscriptionPlan = {
  id: string;
  code: string;
  planGroupCode: string;
  name: string;
  description: string | null;
  price: string;
  currency: string;
  billingPeriod: "monthly" | "yearly";
  trialDays: number;
  annualBonusDays: number;
  referralBonusDays: number;
  priceVersion: number;
  effectiveFrom: string;
  maxMasters: number | null;
  maxAdministrators: number | null;
  maxLocations: number | null;
  features: string[];
  sortOrder: number;
  isActive: boolean;
  isFeatured: boolean;
  historyCount: number;
};

type MarketingActionsPanelProps = {
  plans: PlatformSubscriptionPlan[];
  isLoading: boolean;
  errorMessage: string;
  onReload: () => void;
  onConfigurePlan: (
    monthly: PlatformSubscriptionPlan | null,
    yearly: PlatformSubscriptionPlan | null,
  ) => void;
};

type PlanGroup = {
  code: string;
  name: string;
  monthly: PlatformSubscriptionPlan | null;
  yearly: PlatformSubscriptionPlan | null;
};

function formatMoney(value: string, currency: string): string {
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

function formatLimit(value: number | null, unlimitedLabel: string): string {
  return value === null ? unlimitedLabel : String(value);
}

function groupPlans(plans: PlatformSubscriptionPlan[]): PlanGroup[] {
  const groups = new Map<string, PlanGroup>();

  for (const plan of plans) {
    const current = groups.get(plan.planGroupCode) ?? {
      code: plan.planGroupCode,
      name: plan.name,
      monthly: null,
      yearly: null,
    };

    current.name = plan.name;

    if (plan.billingPeriod === "monthly") {
      current.monthly = plan;
    } else {
      current.yearly = plan;
    }

    groups.set(plan.planGroupCode, current);
  }

  return [...groups.values()].sort((left, right) => {
    const leftOrder = left.monthly?.sortOrder ?? left.yearly?.sortOrder ?? 0;

    const rightOrder = right.monthly?.sortOrder ?? right.yearly?.sortOrder ?? 0;

    return leftOrder - rightOrder;
  });
}

function MarketingActionsPanel({
  plans,
  isLoading,
  errorMessage,
  onReload,
  onConfigurePlan,
}: MarketingActionsPanelProps) {
  const planGroups = groupPlans(plans);

  return (
    <section id="platform-marketing" className="platform-marketing-panel">
      <div className="platform-panel-heading">
        <div>
          <p className="panel-kicker">МАРКЕТИНГ И АКЦИИ</p>

          <h2>Конструктор условий</h2>

          <p>
            Собирайте тарифы, бонусы и акции из отдельных правил, как из блоков.
          </p>
        </div>

        <button
          type="button"
          className="platform-marketing-create-button"
          disabled
          title="Конструктор правил будет подключён следующим этапом"
        >
          <Plus size={17} aria-hidden="true" />
          Создать условие
        </button>
      </div>

      <div className="platform-marketing-builder-grid">
        <article className="platform-marketing-builder-card platform-marketing-builder-card-active">
          <div className="platform-marketing-builder-icon">
            <BadgePercent size={21} aria-hidden="true" />
          </div>

          <div>
            <span>Блок 1</span>
            <strong>Тарифы</strong>
            <p>Цена, trial, лимиты, годовой и реферальный бонус.</p>
          </div>

          <span className="platform-marketing-card-status">Подключено</span>
        </article>

        <article className="platform-marketing-builder-card">
          <div className="platform-marketing-builder-icon">
            <UsersRound size={21} aria-hidden="true" />
          </div>

          <div>
            <span>Блок 2</span>
            <strong>Реферальные программы</strong>
            <p>
              Условия приглашения, событие начисления и количество бонусных
              дней.
            </p>
          </div>

          <span className="platform-marketing-card-status">Следующий этап</span>
        </article>

        <article className="platform-marketing-builder-card">
          <div className="platform-marketing-builder-icon">
            <Gift size={21} aria-hidden="true" />
          </div>

          <div>
            <span>Блок 3</span>
            <strong>Акции и бонусы</strong>
            <p>
              Первые N салонов, дополнительные дни, промокоды и сезонные
              предложения.
            </p>
          </div>

          <span className="platform-marketing-card-status">Подготовлено</span>
        </article>

        <article className="platform-marketing-builder-card">
          <div className="platform-marketing-builder-icon">
            <History size={21} aria-hidden="true" />
          </div>

          <div>
            <span>Блок 4</span>
            <strong>История изменений</strong>
            <p>Кто, когда и почему изменил цену или условие программы.</p>
          </div>

          <span className="platform-marketing-card-status">
            Для тарифов работает
          </span>
        </article>
      </div>

      <div className="platform-marketing-flow">
        <div>
          <Puzzle size={18} aria-hidden="true" />
          <span>Событие</span>
        </div>

        <span>+</span>

        <div>
          <CalendarDays size={18} aria-hidden="true" />
          <span>Условия</span>
        </div>

        <span>+</span>

        <div>
          <Gift size={18} aria-hidden="true" />
          <span>Награда</span>
        </div>

        <span>=</span>

        <div>
          <Megaphone size={18} aria-hidden="true" />
          <span>Готовая акция</span>
        </div>
      </div>

      <div className="platform-marketing-plans-heading">
        <div>
          <h3>Действующие тарифы</h3>

          <p>Месячный и годовой варианты объединены в одну карточку.</p>
        </div>

        <button
          type="button"
          className="platform-marketing-reload-button"
          onClick={onReload}
          disabled={isLoading}
        >
          Обновить тарифы
        </button>
      </div>

      {isLoading ? (
        <div className="platform-table-status">Загружаются тарифы…</div>
      ) : null}

      {errorMessage ? (
        <div className="platform-marketing-error" role="alert">
          {errorMessage}
        </div>
      ) : null}

      {!isLoading && !errorMessage && planGroups.length === 0 ? (
        <div className="platform-table-status">Тарифы не найдены.</div>
      ) : null}

      {!isLoading && planGroups.length > 0 ? (
        <div className="platform-plan-cards">
          {planGroups.map((group) => {
            const basePlan = group.monthly ?? group.yearly;

            if (!basePlan) {
              return null;
            }

            return (
              <article
                key={group.code}
                className={
                  basePlan.isFeatured
                    ? "platform-plan-card platform-plan-card-featured"
                    : "platform-plan-card"
                }
              >
                <div className="platform-plan-card-header">
                  <div>
                    <span>{group.code}</span>
                    <h3>{group.name}</h3>
                  </div>

                  <span
                    className={
                      basePlan.isActive
                        ? "platform-status platform-status-active"
                        : "platform-status platform-status-danger"
                    }
                  >
                    {basePlan.isActive ? "Активен" : "Отключён"}
                  </span>
                </div>

                {basePlan.isFeatured ? (
                  <div className="platform-plan-featured-label">
                    Рекомендуемый тариф
                  </div>
                ) : null}

                <div className="platform-plan-prices">
                  <div>
                    <span>Ежемесячно</span>
                    <strong>
                      {group.monthly
                        ? formatMoney(
                            group.monthly.price,
                            group.monthly.currency,
                          )
                        : "Не настроено"}
                    </strong>
                  </div>

                  <div>
                    <span>За 12 месяцев</span>
                    <strong>
                      {group.yearly
                        ? formatMoney(group.yearly.price, group.yearly.currency)
                        : "Не настроено"}
                    </strong>

                    <small>
                      {group.yearly?.annualBonusDays
                        ? `+ ${group.yearly.annualBonusDays} бонусных дней`
                        : "Без годового бонуса"}
                    </small>
                  </div>
                </div>

                <dl className="platform-plan-details">
                  <div>
                    <dt>Пробный период</dt>
                    <dd>{basePlan.trialDays} дней</dd>
                  </div>

                  <div>
                    <dt>Реферальный бонус</dt>
                    <dd>{basePlan.referralBonusDays} дней</dd>
                  </div>

                  <div>
                    <dt>Мастера</dt>
                    <dd>{formatLimit(basePlan.maxMasters, "Без лимита")}</dd>
                  </div>

                  <div>
                    <dt>Администраторы</dt>
                    <dd>
                      {formatLimit(basePlan.maxAdministrators, "Без лимита")}
                    </dd>
                  </div>

                  <div>
                    <dt>Филиалы</dt>
                    <dd>{formatLimit(basePlan.maxLocations, "Без лимита")}</dd>
                  </div>

                  <div>
                    <dt>Версия цены</dt>
                    <dd>v{basePlan.priceVersion}</dd>
                  </div>
                </dl>

                <div className="platform-plan-actions">
                  <button
                    type="button"
                    onClick={() => onConfigurePlan(group.monthly, group.yearly)}
                  >
                    <Pencil size={16} aria-hidden="true" />
                    Настроить тариф
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

export default MarketingActionsPanel;
