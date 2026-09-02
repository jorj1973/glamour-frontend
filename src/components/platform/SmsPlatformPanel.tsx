import { useEffect, useState } from 'react';
import { Check, Gift, Plus, Save, Smartphone, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import api from '../../api/api';
import { getErrorKey } from '../../api/errorMessage';

const LANGS = ['ru', 'ro', 'en'] as const;

type Lang = (typeof LANGS)[number];

type Order = {
  id: string;
  reference: string;
  salonId: string | null;
  masterProfileId: string | null;
  salonName: string | null;
  masterName: string | null;
  messages: number;
  price: string;
  status: 'pending' | 'paid' | 'cancelled';
  note: string | null;
  confirmedAt: string | null;
  createdAt: string;
};

type Payment = Partial<Record<Lang, string>>;

/** Запас против обязательств. */
type Stock = {
  bought: number;
  sent: number;
  left: number;
  liability: number;
  gap: number;
  granted: number;
  gifted: number;
  revenue: number;
  byCurrency: { currency: string; messages: string; cost: string }[];
  recent: {
    id: string;
    messages: number;
    cost: string;
    currency: string;
    provider: string | null;
    createdAt: string;
  }[];
};

/** Кому площадка может подарить сообщения. */
type Target = {
  salonId: string | null;
  masterProfileId: string | null;
  name: string;
  left: number;
};

/** Ключ для списка: у салона и мастера идентификаторы из разных таблиц. */
function keyOf(target: Target): string {
  return target.salonId ? 's:' + target.salonId : 'm:' + target.masterProfileId;
}

/** Что сейчас спрашиваем по конкретной заявке. */
type Asking = { id: string; action: 'confirm' | 'cancel' } | null;

/**
 * Заявки на оплату SMS — раздел владельца площадки.
 *
 * Салон переводит деньги, указав номер заявки. Здесь ты сверяешь
 * номер с банковской выпиской и подтверждаешь — сообщения появляются
 * у салона в ту же секунду.
 *
 * Подтверждение необратимо: отданные сообщения обратной кнопкой
 * не забрать. Поэтому нажатие не срабатывает сразу, а превращает
 * строку в вопрос, и обе прежние кнопки при этом прячутся — чтобы
 * рядом никогда не стояло двух действий, между которыми можно
 * промахнуться.
 *
 * По той же причине подтверждающая кнопка называет последствие
 * («зачислить 500»), а не говорит «Да»: одинаковое «Да» под двумя
 * разными вопросами — ловушка, а отступ всегда зовётся «Назад»
 * и не значит ничего другого.
 */
function SmsPlatformPanel() {
  const { t } = useTranslation();

  const [orders, setOrders] = useState<Order[]>([]);
  const [recent, setRecent] = useState<Order[]>([]);
  const [payment, setPayment] = useState<Payment>({});
  const [lang, setLang] = useState<Lang>('ru');

  const [asking, setAsking] = useState<Asking>(null);
  const [note, setNote] = useState('');

  /**
   * Подарок от площадки.
   *
   * Спрашивает перед отправкой и показывает результат после, а выбор
   * получателя сбрасывает: иначе кнопка сразу выглядит готовой
   * к новому нажатию, и непонятно, сработала ли предыдущая.
   */
  const [stock, setStock] = useState<Stock | null>(null);
  const [buyMessages, setBuyMessages] = useState('1000');
  const [buyCost, setBuyCost] = useState('300');
  const [buyCurrency, setBuyCurrency] = useState('MDL');
  const [buyProvider, setBuyProvider] = useState('sms.md');

  const [targets, setTargets] = useState<Target[]>([]);
  const [giftTo, setGiftTo] = useState('');
  const [giftAmount, setGiftAmount] = useState('50');
  const [giftNote, setGiftNote] = useState('');
  const [giftAsking, setGiftAsking] = useState(false);
  const [giftDone, setGiftDone] = useState('');

  const [isLoading, setIsLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [doneMsg, setDoneMsg] = useState('');

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setIsLoading(true);
    setErrorMsg('');

    try {
      const [ordersRes, paymentRes, targetsRes, stockRes] = await Promise.all([
        api.get<Order[]>('/platform-admin/sms/orders'),
        api.get<Payment | null>('/platform-admin/sms/payment'),
        api.get<Target[]>('/platform-admin/sms/gift-targets'),
        api.get<Stock>('/platform-admin/sms/stock'),
      ]);

      setOrders(ordersRes.data);
      setPayment(paymentRes.data ?? {});
      setTargets(targetsRes.data);
      setStock(stockRes.data);
    } catch (error) {
      setErrorMsg(t(getErrorKey(error)));
    } finally {
      setIsLoading(false);
    }
  }

  async function resolve(order: Order, action: 'confirm' | 'cancel') {
    setBusy(order.id);
    setErrorMsg('');
    setDoneMsg('');

    try {
      const res = await api.patch<Order>(
        '/platform-admin/sms/orders/' + order.id + '/' + action,
        { note: note.trim() || undefined },
      );

      /**
       * Обработанная заявка не исчезает молча, а переезжает в список
       * недавних. Иначе единственным следом решения остаётся память,
       * а на деньгах её не хватает.
       */
      setRecent([{ ...order, ...res.data }, ...recent].slice(0, 10));

      setDoneMsg(
        t(action === 'confirm' ? 'smsAdmin.confirmed' : 'smsAdmin.cancelled', {
          reference: order.reference,
        }),
      );

      setAsking(null);
      setNote('');

      await load();
    } catch (error) {
      setErrorMsg(t(getErrorKey(error)));
    } finally {
      setBusy('');
    }
  }

  async function savePayment() {
    setBusy('payment');
    setErrorMsg('');
    setDoneMsg('');

    try {
      await api.patch('/platform-admin/sms/payment', payment);

      setDoneMsg(t('smsAdmin.saved'));
    } catch (error) {
      setErrorMsg(t(getErrorKey(error)));
    } finally {
      setBusy('');
    }
  }

  async function addStock() {
    const messages = Number(buyMessages) || 0;
    const cost = Number(buyCost) || 0;

    if (messages <= 0) {
      return;
    }

    setBusy('stock');
    setErrorMsg('');
    setDoneMsg('');

    try {
      await api.post('/platform-admin/sms/stock', {
        messages,
        cost,
        currency: buyCurrency,
        provider: buyProvider.trim() || undefined,
      });

      setDoneMsg(t('smsAdmin.stockAdded', { messages }));

      await load();
    } catch (error) {
      setErrorMsg(t(getErrorKey(error)));
    } finally {
      setBusy('');
    }
  }

  async function gift() {
    const target = targets.find((item) => keyOf(item) === giftTo);
    const amount = Number(giftAmount) || 0;

    if (!target || amount <= 0) {
      return;
    }

    setBusy('gift');
    setErrorMsg('');
    setDoneMsg('');

    try {
      await api.post('/platform-admin/sms/gift', {
        salonId: target.salonId ?? undefined,
        masterProfileId: target.masterProfileId ?? undefined,
        amount,
        note: giftNote.trim() || undefined,
      });

      setGiftDone(t('smsAdmin.giftDone', { amount, name: target.name }));

      /** Сброс выбора: повторить случайно нельзя. */
      setGiftTo('');
      setGiftNote('');
      setGiftAsking(false);

      await load();
    } catch (error) {
      setErrorMsg(t(getErrorKey(error)));
    } finally {
      setBusy('');
    }
  }

  function ask(order: Order, action: 'confirm' | 'cancel') {
    setAsking({ id: order.id, action });
    setNote('');
    setDoneMsg('');
    setErrorMsg('');
  }

  /* ─────────── Оформление ─────────── */

  const panelStyle = {
    padding: '20px 18px',
    border: '1px solid var(--app-border)',
    borderRadius: 18,
    background: 'var(--app-panel)',
    marginBottom: 22,
  } as const;

  const labelStyle = {
    display: 'block',
    marginBottom: 6,
    color: 'var(--app-text-muted)',
    fontSize: 12,
    fontWeight: 700,
  } as const;

  const inputStyle = {
    width: '100%',
    minHeight: 42,
    padding: '9px 12px',
    borderRadius: 11,
    border: '1px solid var(--app-border)',
    background: 'var(--app-input)',
    color: 'var(--app-text)',
    fontSize: 13,
    fontFamily: 'inherit',
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
        <Smartphone size={18} color="var(--app-accent)" />

        <strong style={{ color: 'var(--app-text)', fontSize: 16 }}>
          {t('smsAdmin.title')}
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
        {t('smsAdmin.hint')}
      </p>

      {errorMsg && (
        <p
          style={{
            margin: '0 0 12px',
            color: '#ffb6c6',
            fontSize: 13,
            fontWeight: 700,
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
            margin: '0 0 12px',
            color: '#8ee5b5',
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          <Check size={15} />
          {doneMsg}
        </p>
      )}

      {isLoading ? (
        <p style={{ color: 'var(--app-text-muted)', fontSize: 13, margin: 0 }}>
          …
        </p>
      ) : (
        <>
          {/* ── Склад: запас против обязательств ── */}
          {stock && (
            <div style={{ marginBottom: 20 }}>
              <div
                style={{
                  padding: '18px 20px',
                  borderRadius: 16,
                  border:
                    '1px solid ' +
                    (stock.gap < 0
                      ? 'rgba(255,182,198,0.4)'
                      : stock.gap < stock.liability * 0.2
                        ? 'rgba(255,208,139,0.4)'
                        : 'rgba(142,229,181,0.36)'),
                  background:
                    stock.gap < 0
                      ? 'rgba(255,182,198,0.08)'
                      : stock.gap < stock.liability * 0.2
                        ? 'rgba(255,208,139,0.07)'
                        : 'rgba(142,229,181,0.07)',
                  marginBottom: 14,
                }}
              >
                <p
                  style={{
                    margin: '0 0 8px',
                    color: 'var(--app-text-muted)',
                    fontSize: 13,
                  }}
                >
                  {stock.gap < 0
                    ? t('smsAdmin.gapBad')
                    : t('smsAdmin.gapGood')}
                </p>

                <strong
                  style={{
                    color:
                      stock.gap < 0
                        ? '#ffb6c6'
                        : stock.gap < stock.liability * 0.2
                          ? '#ffd08b'
                          : '#8ee5b5',
                    fontSize: 34,
                    lineHeight: 1,
                    letterSpacing: '-0.03em',
                  }}
                >
                  {stock.gap > 0 ? '+' : ''}
                  {stock.gap}
                </strong>

                <p
                  style={{
                    margin: '10px 0 0',
                    maxWidth: 620,
                    color: 'var(--app-text-muted)',
                    fontSize: 13,
                    lineHeight: 1.6,
                  }}
                >
                  {t('smsAdmin.gapNote', {
                    left: stock.left,
                    liability: stock.liability,
                  })}
                </p>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns:
                    'repeat(auto-fit, minmax(150px, 1fr))',
                  gap: 12,
                  marginBottom: 14,
                }}
              >
                <Tile label={t('smsAdmin.bought')} value={stock.bought} />
                <Tile label={t('smsAdmin.sent')} value={stock.sent} />
                <Tile label={t('smsAdmin.liability')} value={stock.liability} />
                <Tile label={t('smsAdmin.gifted')} value={stock.gifted} />
              </div>

              {stock.byCurrency.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  {stock.byCurrency.map((row) => {
                    const per =
                      Number(row.messages) > 0
                        ? Number(row.cost) / Number(row.messages)
                        : 0;

                    return (
                      <p
                        key={row.currency}
                        style={{
                          margin: '0 0 5px',
                          color: 'var(--app-text-muted)',
                          fontSize: 13,
                        }}
                      >
                        {t('smsAdmin.costLine', {
                          messages: row.messages,
                          cost: Number(row.cost).toFixed(2),
                          currency: row.currency,
                          per: per.toFixed(4),
                        })}
                      </p>
                    );
                  })}
                </div>
              )}

              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-end',
                  gap: 10,
                  flexWrap: 'wrap',
                }}
              >
                <label style={{ display: 'block' }}>
                  <span style={labelStyle}>{t('smsAdmin.buyMessages')}</span>
                  <input
                    type="number"
                    min={1}
                    value={buyMessages}
                    onChange={(e) => setBuyMessages(e.target.value)}
                    disabled={busy !== ''}
                    style={{ ...inputStyle, width: 120, fontWeight: 700 }}
                  />
                </label>

                <label style={{ display: 'block' }}>
                  <span style={labelStyle}>{t('smsAdmin.buyCost')}</span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={buyCost}
                    onChange={(e) => setBuyCost(e.target.value)}
                    disabled={busy !== ''}
                    style={{ ...inputStyle, width: 120, fontWeight: 700 }}
                  />
                </label>

                <label style={{ display: 'block' }}>
                  <span style={labelStyle}>{t('smsAdmin.buyCurrency')}</span>
                  <select
                    value={buyCurrency}
                    onChange={(e) => setBuyCurrency(e.target.value)}
                    disabled={busy !== ''}
                    style={{ ...inputStyle, width: 100 }}
                  >
                    <option value="MDL">MDL</option>
                    <option value="EUR">EUR</option>
                    <option value="USD">USD</option>
                  </select>
                </label>

                <label style={{ display: 'block' }}>
                  <span style={labelStyle}>{t('smsAdmin.buyProvider')}</span>
                  <input
                    type="text"
                    value={buyProvider}
                    onChange={(e) => setBuyProvider(e.target.value)}
                    disabled={busy !== ''}
                    style={{ ...inputStyle, width: 160 }}
                  />
                </label>

                <button
                  type="button"
                  onClick={() => void addStock()}
                  disabled={busy !== ''}
                  style={accentButton(busy === 'stock')}
                >
                  <Plus size={15} />
                  {t('smsAdmin.buyAdd')}
                </button>
              </div>

              {stock.recent.length > 0 && (
                <p
                  style={{
                    margin: '12px 0 0',
                    color: 'var(--app-text-muted)',
                    fontSize: 12,
                    lineHeight: 1.6,
                  }}
                >
                  {t('smsAdmin.lastBuy', {
                    messages: stock.recent[0].messages,
                    cost: Number(stock.recent[0].cost).toFixed(2),
                    currency: stock.recent[0].currency,
                    provider: stock.recent[0].provider ?? '—',
                    when: new Date(
                      stock.recent[0].createdAt,
                    ).toLocaleDateString(),
                  })}
                </p>
              )}
            </div>
          )}

          {/* ── Ждут решения ── */}
          {orders.length === 0 ? (
            <p
              style={{
                margin: '0 0 20px',
                color: 'var(--app-text-muted)',
                fontSize: 13,
              }}
            >
              {t('smsAdmin.empty')}
            </p>
          ) : (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                marginBottom: 18,
              }}
            >
              {orders.map((order) => {
                const question =
                  asking && asking.id === order.id ? asking.action : null;

                return (
                  <div
                    key={order.id}
                    style={{
                      padding: '16px 18px',
                      border:
                        '1px solid ' +
                        (question === 'cancel'
                          ? 'rgba(255,182,198,0.34)'
                          : question === 'confirm'
                            ? 'var(--app-accent)'
                            : 'rgba(255,208,139,0.3)'),
                      borderRadius: 14,
                      background:
                        question === 'cancel'
                          ? 'rgba(255,182,198,0.07)'
                          : question === 'confirm'
                            ? 'rgba(209,127,176,0.08)'
                            : 'rgba(255,208,139,0.06)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 16,
                        flexWrap: 'wrap',
                      }}
                    >
                      <div>
                        <strong
                          style={{
                            display: 'block',
                            color: question ? 'var(--app-text)' : '#ffd08b',
                            fontSize: 18,
                            letterSpacing: '0.03em',
                          }}
                        >
                          {order.reference}
                        </strong>

                        <span
                          style={{
                            display: 'block',
                            marginTop: 4,
                            color: 'var(--app-text)',
                            fontSize: 14,
                          }}
                        >
                          {order.salonName ?? order.masterName ?? '—'}
                          {order.masterProfileId
                            ? ' · ' + t('smsAdmin.master')
                            : ''}
                        </span>

                        <span
                          style={{
                            display: 'block',
                            marginTop: 3,
                            color: 'var(--app-text-muted)',
                            fontSize: 13,
                          }}
                        >
                          {order.messages} SMS ·{' '}
                          {Number(order.price).toFixed(2)} {t('smsAdmin.mdl')} ·{' '}
                          {new Date(order.createdAt).toLocaleString()}
                        </span>
                      </div>

                      {/* Пока вопроса нет — два обычных действия. */}
                      {!question && (
                        <div
                          style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}
                        >
                          <button
                            type="button"
                            onClick={() => ask(order, 'confirm')}
                            disabled={busy !== ''}
                            style={accentButton(false)}
                          >
                            <Check size={15} />
                            {t('smsAdmin.confirm')}
                          </button>

                          <button
                            type="button"
                            onClick={() => ask(order, 'cancel')}
                            disabled={busy !== ''}
                            style={plainButton()}
                          >
                            <X size={15} />
                            {t('smsAdmin.cancel')}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Вопрос: прежние кнопки спрятаны, выходов ровно два. */}
                    {question && (
                      <div style={{ marginTop: 14 }}>
                        <p
                          style={{
                            margin: '0 0 12px',
                            color: 'var(--app-text)',
                            fontSize: 14,
                            lineHeight: 1.6,
                            fontWeight: 700,
                          }}
                        >
                          {question === 'confirm'
                            ? t('smsAdmin.askConfirm', {
                                price: Number(order.price).toFixed(2),
                                reference: order.reference,
                              })
                            : t('smsAdmin.askCancel', {
                                reference: order.reference,
                              })}
                        </p>

                        <input
                          type="text"
                          value={note}
                          onChange={(event) => setNote(event.target.value)}
                          placeholder={t('smsAdmin.notePlaceholder')}
                          style={{ ...inputStyle, marginBottom: 12 }}
                        />

                        <div
                          style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}
                        >
                          <button
                            type="button"
                            onClick={() => void resolve(order, question)}
                            disabled={busy !== ''}
                            style={
                              question === 'confirm'
                                ? accentButton(busy === order.id)
                                : dangerButton(busy === order.id)
                            }
                          >
                            {question === 'confirm'
                              ? t('smsAdmin.yesConfirm', {
                                  messages: order.messages,
                                })
                              : t('smsAdmin.yesCancel')}
                          </button>

                          <button
                            type="button"
                            onClick={() => setAsking(null)}
                            disabled={busy !== ''}
                            style={plainButton()}
                          >
                            {t('smsAdmin.back')}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Недавно обработанные ── */}
          {recent.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <strong
                style={{
                  display: 'block',
                  marginBottom: 10,
                  color: 'var(--app-text)',
                  fontSize: 14,
                }}
              >
                {t('smsAdmin.recent')}
              </strong>

              {recent.map((order) => (
                <div
                  key={order.id}
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: 12,
                    flexWrap: 'wrap',
                    padding: '9px 0',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                  }}
                >
                  <strong
                    style={{
                      color:
                        order.status === 'paid'
                          ? '#8ee5b5'
                          : 'var(--app-text-muted)',
                      fontSize: 14,
                      letterSpacing: '0.03em',
                    }}
                  >
                    {order.reference}
                  </strong>

                  <span style={{ color: 'var(--app-text)', fontSize: 13 }}>
                    {order.status === 'paid'
                      ? t('smsAdmin.wasCredited', { messages: order.messages })
                      : t('smsAdmin.wasCancelled')}
                  </span>

                  {order.note && (
                    <span
                      style={{ color: 'var(--app-text-muted)', fontSize: 12 }}
                    >
                      {order.note}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── Подарок от площадки ── */}
          <div
            style={{
              paddingTop: 18,
              marginBottom: 18,
              borderTop: '1px solid var(--app-border)',
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
              <Gift size={17} color="var(--app-accent)" />

              <strong style={{ color: 'var(--app-text)', fontSize: 15 }}>
                {t('smsAdmin.giftTitle')}
              </strong>
            </div>

            <p
              style={{
                margin: '0 0 14px',
                maxWidth: 680,
                color: 'var(--app-text-muted)',
                fontSize: 13,
                lineHeight: 1.55,
              }}
            >
              {t('smsAdmin.giftHint')}
            </p>

            <div
              style={{
                display: 'flex',
                alignItems: 'flex-end',
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              <label style={{ display: 'block' }}>
                <span style={labelStyle}>{t('smsAdmin.giftWho')}</span>

                <select
                  value={giftTo}
                  onChange={(event) => setGiftTo(event.target.value)}
                  disabled={busy !== '' || giftAsking}
                  style={{ ...inputStyle, minWidth: 240 }}
                >
                  <option value="">—</option>

                  {targets.map((target) => (
                    <option key={keyOf(target)} value={keyOf(target)}>
                      {target.name} · {target.left}
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ display: 'block' }}>
                <span style={labelStyle}>{t('smsAdmin.giftAmount')}</span>

                <input
                  type="number"
                  min={1}
                  max={10000}
                  value={giftAmount}
                  onChange={(event) => setGiftAmount(event.target.value)}
                  disabled={busy !== '' || giftAsking}
                  style={{ ...inputStyle, width: 110, fontWeight: 700 }}
                />
              </label>

              {!giftAsking && (
                <button
                  type="button"
                  onClick={() => {
                    setGiftDone('');
                    setGiftAsking(true);
                  }}
                  disabled={busy !== '' || !giftTo}
                  style={{
                    ...accentButton(false),
                    opacity: giftTo ? 1 : 0.45,
                  }}
                >
                  <Gift size={15} />
                  {t('smsAdmin.giftSend')}
                </button>
              )}
            </div>

            {/* Вопрос: подарок назад не забрать. */}
            {giftAsking && (
              <div
                style={{
                  marginTop: 14,
                  padding: '16px 18px',
                  border: '1px solid var(--app-accent)',
                  borderRadius: 14,
                  background: 'rgba(209,127,176,0.08)',
                }}
              >
                <p
                  style={{
                    margin: '0 0 12px',
                    color: 'var(--app-text)',
                    fontSize: 14,
                    lineHeight: 1.6,
                    fontWeight: 700,
                  }}
                >
                  {t('smsAdmin.giftAsk', {
                    name:
                      targets.find((item) => keyOf(item) === giftTo)?.name ?? '',
                    amount: Number(giftAmount) || 0,
                  })}
                </p>

                <input
                  type="text"
                  value={giftNote}
                  onChange={(event) => setGiftNote(event.target.value)}
                  placeholder={t('smsAdmin.giftNotePlaceholder')}
                  style={{ ...inputStyle, marginBottom: 12 }}
                />

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => void gift()}
                    disabled={busy !== ''}
                    style={accentButton(busy === 'gift')}
                  >
                    <Gift size={15} />
                    {t('smsAdmin.giftYes', { amount: Number(giftAmount) || 0 })}
                  </button>

                  <button
                    type="button"
                    onClick={() => setGiftAsking(false)}
                    disabled={busy !== ''}
                    style={plainButton()}
                  >
                    {t('smsAdmin.back')}
                  </button>
                </div>
              </div>
            )}

            {giftDone && (
              <p
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  margin: '14px 0 0',
                  color: '#8ee5b5',
                  fontSize: 14,
                  fontWeight: 700,
                }}
              >
                <Check size={16} />
                {giftDone}
              </p>
            )}
          </div>

          {/* ── Реквизиты ── */}
          <div
            style={{
              paddingTop: 18,
              borderTop: '1px solid var(--app-border)',
            }}
          >
            <strong
              style={{
                display: 'block',
                marginBottom: 6,
                color: 'var(--app-text)',
                fontSize: 15,
              }}
            >
              {t('smsAdmin.payment')}
            </strong>

            <p
              style={{
                margin: '0 0 12px',
                maxWidth: 680,
                color: 'var(--app-text-muted)',
                fontSize: 13,
                lineHeight: 1.55,
              }}
            >
              {t('smsAdmin.paymentHint')}
            </p>

            <div style={{ display: 'flex', gap: 7, marginBottom: 12 }}>
              {LANGS.map((code) => {
                const isCurrent = code === lang;
                const filled = Boolean(payment[code]?.trim());

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
                      fontFamily: 'inherit',
                      cursor: 'pointer',
                    }}
                  >
                    {code}

                    {/* Точка показывает, что язык заполнен: без неё
                        забытый румынский обнаружится только салоном. */}
                    <span
                      aria-hidden="true"
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: filled
                          ? 'var(--app-accent)'
                          : 'var(--app-border)',
                      }}
                    />
                  </button>
                );
              })}
            </div>

            <textarea
              value={payment[lang] ?? ''}
              onChange={(event) =>
                setPayment({ ...payment, [lang]: event.target.value })
              }
              rows={6}
              placeholder={t('smsAdmin.paymentPlaceholder')}
              style={{
                width: '100%',
                padding: '11px 13px',
                borderRadius: 12,
                border: '1px solid var(--app-border)',
                background: 'var(--app-input)',
                color: 'var(--app-text)',
                fontSize: 14,
                lineHeight: 1.55,
                fontFamily: 'inherit',
                resize: 'vertical',
              }}
            />

            <button
              type="button"
              onClick={() => void savePayment()}
              disabled={busy !== ''}
              style={{ ...accentButton(busy === 'payment'), marginTop: 12 }}
            >
              <Save size={16} />
              {t('smsAdmin.save')}
            </button>
          </div>
        </>
      )}
    </section>
  );
}

/** Плитка с числом. */
function Tile({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        padding: '14px 16px',
        border: '1px solid var(--app-border)',
        borderRadius: 14,
        background: 'var(--app-input)',
      }}
    >
      <p
        style={{
          margin: '0 0 7px',
          color: 'var(--app-text-muted)',
          fontSize: 12,
        }}
      >
        {label}
      </p>

      <strong
        style={{
          color: 'var(--app-text)',
          fontSize: 22,
          letterSpacing: '-0.03em',
        }}
      >
        {value}
      </strong>
    </div>
  );
}

/* ─────────── Кнопки ─────────── */

function accentButton(isBusy: boolean) {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 7,
    minHeight: 44,
    padding: '0 20px',
    border: 0,
    borderRadius: 12,
    background: 'var(--app-accent)',
    color: '#17151c',
    fontSize: 13,
    fontWeight: 700,
    fontFamily: 'inherit',
    cursor: isBusy ? 'default' : 'pointer',
    opacity: isBusy ? 0.6 : 1,
  } as const;
}

function dangerButton(isBusy: boolean) {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 7,
    minHeight: 44,
    padding: '0 20px',
    border: '1px solid rgba(255,182,198,0.5)',
    borderRadius: 12,
    background: 'rgba(255,182,198,0.12)',
    color: '#ffb6c6',
    fontSize: 13,
    fontWeight: 700,
    fontFamily: 'inherit',
    cursor: isBusy ? 'default' : 'pointer',
    opacity: isBusy ? 0.6 : 1,
  } as const;
}

function plainButton() {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 7,
    minHeight: 44,
    padding: '0 18px',
    border: '1px solid var(--app-border)',
    borderRadius: 12,
    background: 'transparent',
    color: 'var(--app-text-muted)',
    fontSize: 13,
    fontWeight: 700,
    fontFamily: 'inherit',
    cursor: 'pointer',
  } as const;
}

export default SmsPlatformPanel;
