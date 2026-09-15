import { useState } from 'react';
import { Check, Plus } from 'lucide-react';

import api from '../../api/api';

/**
 * Новый тариф — раздел кабинета владельца площадки.
 *
 * Отдельной панелью, а не внутри редактора тарифов, нарочно: редактор
 * работает с выбранным тарифом и его историей цен, и вписывать в него
 * создание значило бы трогать работающее ради нового. Здесь же форма
 * короткая и ничего чужого не знает.
 *
 * Пара «месячный и годовой» заводится двумя заходами. Это два тарифа с
 * разными ценами, и цену годового называет человек, а не умножение:
 * годовой обычно дешевле двенадцати месячных, и насколько — решение, а
 * не арифметика. Связывает их одно слово в поле «группа».
 */

type Form = {
  code: string;
  planGroupCode: string;
  name: string;
  description: string;
  price: string;
  billingPeriod: 'monthly' | 'yearly';
  trialDays: string;
  maxMasters: string;
  maxAdministrators: string;
  maxLocations: string;
  sortOrder: string;
};

const EMPTY: Form = {
  code: '',
  planGroupCode: '',
  name: '',
  description: '',
  price: '',
  billingPeriod: 'monthly',
  trialDays: '7',
  maxMasters: '',
  maxAdministrators: '',
  maxLocations: '',
  sortOrder: '0',
};

/** Пусто — значит без ограничения, а не ноль. */
function limit(value: string): number | undefined {
  const trimmed = value.trim();

  if (!trimmed) {
    return undefined;
  }

  const parsed = Number(trimmed);

  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : undefined;
}

type Props = {
  /** Страница перечитывает тарифы сама — панель только говорит, что пора. */
  onCreated: () => void;
};

function NewPlanPanel({ onCreated }: Props) {
  const [form, setForm] = useState<Form>(EMPTY);
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [doneMsg, setDoneMsg] = useState('');

  function set(field: keyof Form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function submit() {
    const price = Number(form.price.replace(',', '.'));

    if (!form.code.trim() || !form.planGroupCode.trim() || !form.name.trim()) {
      setErrorMsg('Код, группа и название обязательны');
      return;
    }

    if (!Number.isFinite(price) || price < 0) {
      setErrorMsg('Цена должна быть числом');
      return;
    }

    setIsSaving(true);
    setErrorMsg('');

    try {
      await api.post('/platform-admin/plans', {
        code: form.code.trim(),
        planGroupCode: form.planGroupCode.trim(),
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        price,
        billingPeriod: form.billingPeriod,
        trialDays: limit(form.trialDays),
        maxMasters: limit(form.maxMasters),
        maxAdministrators: limit(form.maxAdministrators),
        maxLocations: limit(form.maxLocations),
        sortOrder: limit(form.sortOrder),
      });

      setDoneMsg('Тариф заведён: ' + form.name.trim());
      setForm(EMPTY);
      setIsOpen(false);
      onCreated();
    } catch (error) {
      const data = (error as { response?: { data?: { message?: unknown } } })
        ?.response?.data;

      const message = data?.message;

      setErrorMsg(
        Array.isArray(message)
          ? message.join(', ')
          : typeof message === 'string' && message
            ? message
            : 'Не удалось завести тариф',
      );
    } finally {
      setIsSaving(false);
    }
  }

  const panelStyle = {
    padding: '20px 18px',
    border: '1px solid var(--app-border)',
    borderRadius: 18,
    background: 'var(--app-panel)',
    marginBottom: 22,
  } as const;

  const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 12,
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

  const field = (
    label: string,
    key: keyof Form,
    hint?: string,
    mode?: 'numeric',
  ) => (
    <div>
      <label style={labelStyle}>{label}</label>

      <input
        style={inputStyle}
        value={form[key]}
        inputMode={mode}
        placeholder={hint}
        onChange={(event) => set(key, event.target.value)}
      />
    </div>
  );

  return (
    <section style={panelStyle}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <Plus size={18} color="var(--app-accent)" />

          <strong style={{ color: 'var(--app-text)', fontSize: 16 }}>
            Новый тариф
          </strong>
        </div>

        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          style={{
            minHeight: 36,
            padding: '0 14px',
            border: '1px solid var(--app-border)',
            borderRadius: 11,
            background: 'transparent',
            color: 'var(--app-text)',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          {isOpen ? 'Свернуть' : 'Завести тариф'}
        </button>
      </div>

      {doneMsg ? (
        <p
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginTop: 12,
            color: 'var(--app-accent)',
            fontSize: 13,
          }}
        >
          <Check size={15} />
          {doneMsg}
        </p>
      ) : null}

      {isOpen ? (
        <>
          <p
            style={{
              margin: '14px 0 16px',
              maxWidth: 680,
              color: 'var(--app-text-muted)',
              fontSize: 13,
              lineHeight: 1.55,
            }}
          >
            Месячный и годовой варианты заводятся по отдельности и
            связываются одинаковым словом в поле «группа». Пустое
            ограничение значит «без предела», а не ноль.
          </p>

          <p
            style={{
              margin: '0 0 16px',
              maxWidth: 680,
              color: 'var(--app-text-muted)',
              fontSize: 13,
              lineHeight: 1.55,
            }}
          >
            Сколько сообщений даёт тариф — назначается в разделе «СМС»:
            это число живёт там, и заводить ему второе место здесь
            значило бы получить два разных ответа. У нового тарифа оно
            ноль, пока не поставлено.
          </p>

          <div
            style={{
              display: 'grid',
              gap: 12,
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            }}
          >
            {field('КОД', 'code', 'master_monthly')}
            {field('ГРУППА', 'planGroupCode', 'master')}
            {field('НАЗВАНИЕ', 'name', 'Мастер')}
            {field('ЦЕНА, MDL', 'price', '150', 'numeric')}

            <div>
              <label style={labelStyle}>ЧАСТОТА</label>

              <select
                style={inputStyle}
                value={form.billingPeriod}
                onChange={(event) =>
                  set(
                    'billingPeriod',
                    event.target.value === 'yearly' ? 'yearly' : 'monthly',
                  )
                }
              >
                <option value="monthly">Месячный</option>
                <option value="yearly">Годовой</option>
              </select>
            </div>

            {field('ПРОБНЫХ ДНЕЙ', 'trialDays', '7', 'numeric')}
            {field('МАСТЕРОВ', 'maxMasters', 'без предела', 'numeric')}
            {field('АДМИНИСТРАТОРОВ', 'maxAdministrators', '1', 'numeric')}
            {field('АДРЕСОВ', 'maxLocations', '1', 'numeric')}
            {field('ПОРЯДОК', 'sortOrder', '0', 'numeric')}
            {field('ОПИСАНИЕ', 'description', 'необязательно')}
          </div>

          {errorMsg ? (
            <p
              style={{
                margin: '14px 0 0',
                color: 'var(--app-danger)',
                fontSize: 13,
              }}
            >
              {errorMsg}
            </p>
          ) : null}

          <button
            type="button"
            onClick={() => void submit()}
            disabled={isSaving}
            style={{
              marginTop: 16,
              minHeight: 44,
              padding: '0 18px',
              border: 'none',
              borderRadius: 12,
              background: 'var(--app-accent)',
              color: '#fff',
              fontSize: 14,
              fontWeight: 700,
              cursor: isSaving ? 'default' : 'pointer',
              opacity: isSaving ? 0.7 : 1,
            }}
          >
            {isSaving ? 'Сохраняется…' : 'Завести тариф'}
          </button>
        </>
      ) : null}
    </section>
  );
}

export default NewPlanPanel;
