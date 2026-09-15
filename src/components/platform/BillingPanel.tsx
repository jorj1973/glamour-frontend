import { useEffect, useState } from 'react';
import { CircleDollarSign, Check, X } from 'lucide-react';

import api from '../../api/api';

/**
 * Деньги площадки — раздел кабинета владельца.
 *
 * На этом месте до 15 сентября 2026 года стояла полоса «Подписки и
 * платежи ещё не подключены». Она не врала: подписка умела только
 * родиться. При одобрении заявки ей ставили `trial` на семь дней, и
 * дальше не происходило ничего и никогда — ни одна строка кода не
 * переводила её в `active`, ни одна задача не следила за сроком.
 * Пробный период не кончался, оплата нигде не оставляла следа.
 *
 * Здесь три вещи, и все три — про один вопрос «кто платит»: сколько
 * пришло за месяц, в каком состоянии каждая подписка и чем закончилась
 * каждая оплата.
 *
 * Текст по-русски прямо в разметке, без словаря. Это осознанно: кабинет
 * площадки — экран одного человека, и словарь на три языка стоил бы
 * дороже, чем даёт. Соседние панели этого кабинета написаны так же.
 */

type SubscriptionRow = {
  salonId: string;
  salonName: string;
  planName: string | null;
  planPrice: string | null;
  billingPeriod: string | null;
  status: string;
  paymentStatus: string;
  trialEndsAt: string | null;
  currentPeriodEndsAt: string | null;
  nextPaymentDueAt: string | null;
  daysLeft: number | null;
  lastPaidAt: string | null;
  lastAmount: string | null;
};

type PaymentRow = {
  id: string;
  salonId: string;
  amount: string;
  currency: string;
  kind: string;
  method: string;
  paidAt: string;
  periodStartedAt: string;
  periodEndsAt: string;
  note: string | null;
};

type Income = {
  from: string;
  to: string;
  count: number;
  total: string;
};

const STATUS_LABEL: Record<string, string> = {
  pending_approval: 'Ждёт одобрения',
  trial: 'Пробный период',
  active: 'Оплачено',
  past_due: 'Просрочено',
  suspended: 'Только чтение',
  cancelled: 'Отменена',
  expired: 'Истекла',
};

const METHOD_LABEL: Record<string, string> = {
  cash: 'наличными',
  transfer: 'переводом',
  card: 'картой',
  other: 'иначе',
};

function formatDate(value: string | null): string {
  if (!value) {
    return '—';
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
}

/** Человеческая подпись к числу дней: без неё «-8» ничего не говорит. */
function dueText(row: SubscriptionRow): string {
  if (row.daysLeft === null) {
    return 'срок не назначен';
  }

  if (row.daysLeft < 0) {
    return 'просрочено на ' + String(-row.daysLeft) + ' дн.';
  }

  if (row.daysLeft === 0) {
    return 'сегодня последний день';
  }

  return 'осталось ' + String(row.daysLeft) + ' дн.';
}

function today(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  return String(now.getFullYear()) + '-' + month + '-' + day;
}

function BillingPanel() {
  const [rows, setRows] = useState<SubscriptionRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [income, setIncome] = useState<Income | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [doneMsg, setDoneMsg] = useState('');

  const [openFor, setOpenFor] = useState<SubscriptionRow | null>(null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('transfer');
  const [paidAt, setPaidAt] = useState(today());
  const [note, setNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setIsLoading(true);

    try {
      const [subs, money, journal] = await Promise.all([
        api.get<SubscriptionRow[]>('/platform-admin/billing/subscriptions'),
        api.get<Income>('/platform-admin/billing/income'),
        api.get<PaymentRow[]>('/platform-admin/billing/payments'),
      ]);

      setRows(subs.data);
      setIncome(money.data);
      setPayments(journal.data.slice(0, 20));
      setErrorMsg('');
    } catch {
      setErrorMsg('Не удалось загрузить деньги площадки');
    } finally {
      setIsLoading(false);
    }
  }

  function openForm(row: SubscriptionRow) {
    setOpenFor(row);
    setAmount(row.planPrice ?? '');
    setMethod('transfer');
    setPaidAt(today());
    setNote('');
    setErrorMsg('');
    setDoneMsg('');
  }

  async function submit() {
    if (!openFor) {
      return;
    }

    const value = Number(amount);

    if (!Number.isFinite(value) || value <= 0) {
      setErrorMsg('Сумма должна быть больше нуля');
      return;
    }

    setIsSaving(true);

    try {
      await api.post('/platform-admin/billing/payments', {
        salonId: openFor.salonId,
        amount: value,
        method,
        // Дата без времени — значит полдень: так отметка не уедет на
        // предыдущие сутки из-за часового пояса браузера.
        paidAt: new Date(paidAt + 'T12:00:00').toISOString(),
        note: note.trim() ? note.trim() : undefined,
      });

      setDoneMsg('Оплата отмечена: ' + openFor.salonName);
      setOpenFor(null);
      setErrorMsg('');

      await load();
    } catch {
      setErrorMsg('Не удалось отметить оплату');
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

  const cellStyle = {
    padding: '10px 8px',
    borderBottom: '1px solid rgba(var(--app-ink-rgb),0.08)',
    color: 'var(--app-text)',
    fontSize: 13,
    textAlign: 'left',
  } as const;

  const headStyle = {
    ...cellStyle,
    color: 'var(--app-text-muted)',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
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

  return (
    <section style={panelStyle}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 9,
          marginBottom: 6,
        }}
      >
        <CircleDollarSign size={18} color="var(--app-accent)" />

        <strong style={{ color: 'var(--app-text)', fontSize: 16 }}>
          Подписки и оплаты
        </strong>
      </div>

      <p
        style={{
          margin: '0 0 16px',
          maxWidth: 680,
          color: 'var(--app-text-muted)',
          fontSize: 13,
          lineHeight: 1.55,
        }}
      >
        Кто платит, у кого кончается срок и что пришло за месяц. Отметка
        оплаты двигает срок подписки вперёд: за пробным периодом или за
        прошлым оплаченным, без разрыва.
      </p>

      {income ? (
        <div
          style={{
            display: 'flex',
            gap: 22,
            flexWrap: 'wrap',
            padding: '12px 14px',
            marginBottom: 16,
            borderRadius: 14,
            background: 'rgba(var(--app-ink-rgb),0.04)',
          }}
        >
          <div>
            <p style={labelStyle}>ПРИШЛО В ЭТОМ МЕСЯЦЕ</p>

            <strong style={{ color: 'var(--app-text)', fontSize: 20 }}>
              {Number(income.total).toFixed(2)} MDL
            </strong>
          </div>

          <div>
            <p style={labelStyle}>ОПЛАТ</p>

            <strong style={{ color: 'var(--app-text)', fontSize: 20 }}>
              {income.count}
            </strong>
          </div>
        </div>
      ) : null}

      {errorMsg ? (
        <p style={{ color: 'var(--app-danger)', fontSize: 13 }}>{errorMsg}</p>
      ) : null}

      {doneMsg ? (
        <p
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            color: 'var(--app-accent)',
            fontSize: 13,
          }}
        >
          <Check size={15} />
          {doneMsg}
        </p>
      ) : null}

      {isLoading ? (
        <p style={{ color: 'var(--app-text-muted)', fontSize: 13 }}>
          Загружается…
        </p>
      ) : rows.length === 0 ? (
        <p style={{ color: 'var(--app-text-muted)', fontSize: 13 }}>
          Подписок пока нет.
        </p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={headStyle}>Салон</th>
                <th style={headStyle}>Тариф</th>
                <th style={headStyle}>Состояние</th>
                <th style={headStyle}>Срок</th>
                <th style={headStyle}>Последняя оплата</th>
                <th style={headStyle} />
              </tr>
            </thead>

            <tbody>
              {rows.map((row) => (
                <tr key={row.salonId}>
                  <td style={cellStyle}>{row.salonName}</td>

                  <td style={cellStyle}>
                    {row.planName ?? '—'}
                    {row.planPrice ? (
                      <span style={{ color: 'var(--app-text-muted)' }}>
                        {' · ' + Number(row.planPrice).toFixed(0) + ' MDL'}
                      </span>
                    ) : null}
                  </td>

                  <td style={cellStyle}>
                    {STATUS_LABEL[row.status] ?? row.status}
                  </td>

                  <td
                    style={{
                      ...cellStyle,
                      color:
                        row.daysLeft !== null && row.daysLeft < 0
                          ? 'var(--app-danger)'
                          : 'var(--app-text)',
                    }}
                  >
                    {formatDate(
                      row.nextPaymentDueAt ??
                        row.currentPeriodEndsAt ??
                        row.trialEndsAt,
                    )}

                    <span
                      style={{
                        display: 'block',
                        color: 'var(--app-text-muted)',
                        fontSize: 12,
                      }}
                    >
                      {dueText(row)}
                    </span>
                  </td>

                  <td style={cellStyle}>
                    {row.lastPaidAt
                      ? formatDate(row.lastPaidAt) +
                        ' · ' +
                        Number(row.lastAmount ?? 0).toFixed(0) +
                        ' MDL'
                      : '—'}
                  </td>

                  <td style={cellStyle}>
                    <button
                      type="button"
                      onClick={() => openForm(row)}
                      style={{
                        minHeight: 34,
                        padding: '0 12px',
                        border: '1px solid var(--app-border)',
                        borderRadius: 11,
                        background: 'transparent',
                        color: 'var(--app-text)',
                        fontSize: 12,
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                        cursor: 'pointer',
                      }}
                    >
                      Отметить оплату
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {openFor ? (
        <div
          style={{
            marginTop: 18,
            padding: '16px 14px',
            border: '1px solid var(--app-border)',
            borderRadius: 14,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 12,
            }}
          >
            <strong style={{ color: 'var(--app-text)', fontSize: 14 }}>
              {'Оплата: ' + openFor.salonName}
            </strong>

            <button
              type="button"
              onClick={() => setOpenFor(null)}
              aria-label="Закрыть"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 32,
                height: 32,
                border: '1px solid var(--app-border)',
                borderRadius: 10,
                background: 'transparent',
                color: 'var(--app-text-muted)',
                cursor: 'pointer',
              }}
            >
              <X size={15} />
            </button>
          </div>

          <div
            style={{
              display: 'grid',
              gap: 12,
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            }}
          >
            <div>
              <label style={labelStyle}>СУММА, MDL</label>

              <input
                style={inputStyle}
                value={amount}
                inputMode="decimal"
                onChange={(event) => setAmount(event.target.value)}
              />
            </div>

            <div>
              <label style={labelStyle}>КОГДА ЗАПЛАТИЛИ</label>

              <input
                style={inputStyle}
                type="date"
                value={paidAt}
                onChange={(event) => setPaidAt(event.target.value)}
              />
            </div>

            <div>
              <label style={labelStyle}>КАК</label>

              <select
                style={inputStyle}
                value={method}
                onChange={(event) => setMethod(event.target.value)}
              >
                <option value="transfer">Переводом</option>
                <option value="cash">Наличными</option>
                <option value="card">Картой</option>
                <option value="other">Иначе</option>
              </select>
            </div>

            <div>
              <label style={labelStyle}>ПРИМЕЧАНИЕ</label>

              <input
                style={inputStyle}
                value={note}
                placeholder="необязательно"
                onChange={(event) => setNote(event.target.value)}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={() => void submit()}
            disabled={isSaving}
            style={{
              marginTop: 14,
              minHeight: 42,
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
            {isSaving ? 'Сохраняется…' : 'Отметить оплату'}
          </button>
        </div>
      ) : null}

      {payments.length > 0 ? (
        <div style={{ marginTop: 22 }}>
          <p style={labelStyle}>ПОСЛЕДНИЕ ОПЛАТЫ</p>

          {payments.map((payment) => (
            <p
              key={payment.id}
              style={{
                margin: '0 0 6px',
                color: 'var(--app-text-muted)',
                fontSize: 13,
              }}
            >
              {formatDate(payment.paidAt) +
                ' · ' +
                Number(payment.amount).toFixed(2) +
                ' ' +
                payment.currency +
                ' · ' +
                (METHOD_LABEL[payment.method] ?? payment.method) +
                ' · за ' +
                formatDate(payment.periodStartedAt) +
                ' — ' +
                formatDate(payment.periodEndsAt) +
                (payment.kind === 'refund' ? ' · возврат' : '') +
                (payment.note ? ' · ' + payment.note : '')}
            </p>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export default BillingPanel;
