import { useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  Plus,
  Save,
  Tags,
  Trash2,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import api from '../../api/api';
import { getErrorKey } from '../../api/errorMessage';

const LANGS = ['ru', 'ro', 'en'] as const;

type Lang = (typeof LANGS)[number];

type Block = {
  name: string;
  description: string;
  features: string[];
};

type PlanTexts = Record<Lang, Block>;

type Plan = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  billingPeriod: string;
  price: string;
  currency: string;
  features: string[];
  texts: Partial<Record<Lang, Partial<Block>>> | null;
};

const EMPTY: Block = { name: '', description: '', features: [] };

/**
 * Тексты тарифов — раздел кабинета владельца площадки.
 *
 * Редактор цен рядом умеет деньги, лимиты и сроки, но не буквы:
 * названия, описания и списки возможностей в его форму не выведены,
 * и поменять их можно было только миграцией. Для текста, который
 * переписывается после каждого второго разговора с салоном, это
 * негодный способ.
 *
 * Три языка редактируются здесь же, вкладками. Продукт продаёт себя
 * двуязычностью — значит страница тарифов не имеет права быть
 * одноязычной.
 */
function PlanTextsPanel() {
  const { t } = useTranslation();

  const [plans, setPlans] = useState<Plan[]>([]);
  const [planId, setPlanId] = useState<string>('');
  const [lang, setLang] = useState<Lang>('ru');
  const [draft, setDraft] = useState<PlanTexts | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [doneMsg, setDoneMsg] = useState('');

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setIsLoading(true);
    setErrorMsg('');

    try {
      const res = await api.get<Plan[]>('/platform-admin/plans');

      setPlans(res.data);

      if (res.data.length > 0) {
        select(res.data[0]);
      }
    } catch (error) {
      setErrorMsg(t(getErrorKey(error)));
    } finally {
      setIsLoading(false);
    }
  }

  /**
   * Черновик собираем из колонки texts, а чего в ней нет — берём
   * из старых полей. Так тариф, до которого ещё не дошли руки,
   * открывается заполненным, а не пустым.
   */
  function select(plan: Plan) {
    setPlanId(plan.id);
    setDoneMsg('');

    const built = {} as PlanTexts;

    for (const code of LANGS) {
      const block = plan.texts?.[code];

      built[code] = {
        name: block?.name ?? (code === 'ru' ? plan.name : ''),
        description:
          block?.description ?? (code === 'ru' ? (plan.description ?? '') : ''),
        features:
          block?.features ?? (code === 'ru' ? [...(plan.features ?? [])] : []),
      };
    }

    setDraft(built);
  }

  function edit(patch: Partial<Block>) {
    setDraft((current) =>
      current ? { ...current, [lang]: { ...current[lang], ...patch } } : current,
    );
    setDoneMsg('');
  }

  function editFeature(index: number, value: string) {
    if (!draft) {
      return;
    }

    const next = [...draft[lang].features];
    next[index] = value;
    edit({ features: next });
  }

  function addFeature() {
    if (!draft) {
      return;
    }

    edit({ features: [...draft[lang].features, ''] });
  }

  function removeFeature(index: number) {
    if (!draft) {
      return;
    }

    edit({ features: draft[lang].features.filter((_, i) => i !== index) });
  }

  /**
   * Порядок в списке — это и есть главная работа этого экрана.
   * Первым читают верхний пункт, поэтому переставлять строки нужно
   * так же легко, как их писать.
   */
  function moveFeature(index: number, delta: number) {
    if (!draft) {
      return;
    }

    const next = [...draft[lang].features];
    const target = index + delta;

    if (target < 0 || target >= next.length) {
      return;
    }

    [next[index], next[target]] = [next[target], next[index]];
    edit({ features: next });
  }

  async function save() {
    if (!draft || !planId) {
      return;
    }

    setIsSaving(true);
    setErrorMsg('');
    setDoneMsg('');

    // Пустые строки не отправляем: пустой пункт в списке выглядит
    // как недоделанная работа, а появляется он от одного лишнего нажатия.
    const cleaned = {} as PlanTexts;

    for (const code of LANGS) {
      cleaned[code] = {
        name: draft[code].name.trim(),
        description: draft[code].description.trim(),
        features: draft[code].features
          .map((line) => line.trim())
          .filter(Boolean),
      };
    }

    try {
      await api.patch('/platform-admin/plans/' + planId, {
        texts: cleaned,
        changeReason: t('planTexts.reason'),
      });

      setDoneMsg(t('planTexts.saved'));

      await load();
    } catch (error) {
      setErrorMsg(t(getErrorKey(error)));
    } finally {
      setIsSaving(false);
    }
  }

  const block = draft?.[lang] ?? EMPTY;
  const plan = plans.find((item) => item.id === planId) ?? null;

  const inputStyle = {
    width: '100%',
    minHeight: 42,
    padding: '9px 12px',
    borderRadius: 11,
    border: '1px solid var(--app-border)',
    background: 'var(--app-input)',
    color: 'var(--app-text)',
    fontSize: 14,
    fontFamily: 'inherit',
  } as const;

  const labelStyle = {
    display: 'block',
    marginBottom: 6,
    color: 'var(--app-text-muted)',
    fontSize: 12,
    fontWeight: 700,
  } as const;

  return (
    <section
      style={{
        padding: '20px 18px',
        border: '1px solid var(--app-border)',
        borderRadius: 18,
        background: 'var(--app-panel)',
        marginBottom: 22,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 9,
          marginBottom: 6,
        }}
      >
        <Tags size={18} color="var(--app-accent)" />

        <strong style={{ color: 'var(--app-text)', fontSize: 16 }}>
          {t('planTexts.title')}
        </strong>
      </div>

      <p
        style={{
          color: 'var(--app-text-muted)',
          fontSize: 13,
          lineHeight: 1.55,
          margin: '0 0 16px',
        }}
      >
        {t('planTexts.hint')}
      </p>

      {isLoading ? (
        <p style={{ color: 'var(--app-text-muted)', fontSize: 13, margin: 0 }}>
          …
        </p>
      ) : (
        <>
          {/* Выбор тарифа */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 7,
              marginBottom: 12,
            }}
          >
            {plans.map((item) => {
              const isCurrent = item.id === planId;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => select(item)}
                  style={{
                    padding: '7px 13px',
                    borderRadius: 11,
                    border: isCurrent
                      ? '1px solid var(--app-accent)'
                      : '1px solid var(--app-border)',
                    background: isCurrent
                      ? 'var(--app-accent)'
                      : 'transparent',
                    color: isCurrent ? '#17151c' : 'var(--app-text-muted)',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {item.name}
                  <span style={{ opacity: 0.75, fontWeight: 500 }}>
                    {' · '}
                    {item.billingPeriod === 'yearly'
                      ? t('planTexts.yearly')
                      : t('planTexts.monthly')}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Выбор языка */}
          <div style={{ display: 'flex', gap: 7, marginBottom: 16 }}>
            {LANGS.map((code) => {
              const isCurrent = code === lang;
              const filled = Boolean(draft?.[code]?.features.length);

              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => setLang(code)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '7px 15px',
                    borderRadius: 11,
                    border: isCurrent
                      ? '1px solid var(--app-accent)'
                      : '1px solid var(--app-border)',
                    background: 'transparent',
                    color: isCurrent
                      ? 'var(--app-accent)'
                      : 'var(--app-text-muted)',
                    fontSize: 13,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                  }}
                >
                  {code}
                  {/* Точка показывает, что язык заполнен: без неё
                      забытый румынский обнаруживается только салоном. */}
                  <span
                    aria-hidden="true"
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: filled
                        ? 'var(--app-accent)'
                        : 'var(--app-text-muted)',
                      opacity: filled ? 1 : 0.4,
                    }}
                  />
                </button>
              );
            })}
          </div>

          {/* Название и описание */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle} htmlFor="plan-name">
              {t('planTexts.name')}
            </label>

            <input
              id="plan-name"
              value={block.name}
              onChange={(event) => edit({ name: event.target.value })}
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: 18 }}>
            <label style={labelStyle} htmlFor="plan-description">
              {t('planTexts.description')}
            </label>

            <textarea
              id="plan-description"
              value={block.description}
              onChange={(event) => edit({ description: event.target.value })}
              rows={2}
              style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
            />
          </div>

          {/* Список возможностей */}
          <label style={labelStyle}>{t('planTexts.features')}</label>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 7,
              marginBottom: 12,
            }}
          >
            {block.features.map((line, index) => (
              <div
                key={index}
                style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}
              >
                <span
                  style={{
                    minWidth: 22,
                    paddingTop: 11,
                    color: 'var(--app-text-muted)',
                    fontSize: 12,
                    fontWeight: 700,
                    textAlign: 'right',
                  }}
                >
                  {index + 1}
                </span>

                <textarea
                  value={line}
                  onChange={(event) => editFeature(index, event.target.value)}
                  rows={2}
                  style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.45 }}
                />

                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <IconButton
                    label={t('planTexts.up')}
                    disabled={index === 0}
                    onClick={() => moveFeature(index, -1)}
                  >
                    <ArrowUp size={14} />
                  </IconButton>

                  <IconButton
                    label={t('planTexts.down')}
                    disabled={index === block.features.length - 1}
                    onClick={() => moveFeature(index, 1)}
                  >
                    <ArrowDown size={14} />
                  </IconButton>

                  <IconButton
                    label={t('common.delete')}
                    onClick={() => removeFeature(index)}
                  >
                    <Trash2 size={14} />
                  </IconButton>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addFeature}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              minHeight: 38,
              padding: '0 14px',
              border: '1px solid var(--app-border)',
              borderRadius: 12,
              background: 'transparent',
              color: 'var(--app-text-muted)',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              marginBottom: 18,
            }}
          >
            <Plus size={15} />
            {t('planTexts.add')}
          </button>

          {errorMsg && (
            <p
              style={{
                color: 'var(--app-accent-warm)',
                fontSize: 13,
                fontWeight: 700,
                margin: '0 0 12px',
              }}
            >
              {errorMsg}
            </p>
          )}

          {doneMsg && (
            <p
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                color: 'var(--app-accent-text)',
                fontSize: 13,
                fontWeight: 700,
                margin: '0 0 12px',
              }}
            >
              <Check size={15} />
              {doneMsg}
            </p>
          )}

          <div
            style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}
          >
            <button
              type="button"
              onClick={() => void save()}
              disabled={isSaving || !plan}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                minHeight: 44,
                padding: '0 20px',
                border: 0,
                borderRadius: 13,
                background: 'var(--app-accent)',
                color: '#17151c',
                fontSize: 14,
                fontWeight: 700,
                cursor: isSaving ? 'default' : 'pointer',
                opacity: isSaving ? 0.6 : 1,
              }}
            >
              <Save size={16} />
              {t('planTexts.save')}
            </button>

            <span
              style={{
                color: 'var(--app-text-muted)',
                fontSize: 12,
                lineHeight: 1.45,
              }}
            >
              {t('planTexts.savesAll')}
            </span>
          </div>
        </>
      )}
    </section>
  );
}

/** Маленькая кнопка со значком — их тут три на каждую строку. */
function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 28,
        height: 22,
        padding: 0,
        border: '1px solid var(--app-border)',
        borderRadius: 7,
        background: 'transparent',
        color: 'var(--app-text-muted)',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.35 : 1,
      }}
    >
      {children}
    </button>
  );
}

export default PlanTextsPanel;
