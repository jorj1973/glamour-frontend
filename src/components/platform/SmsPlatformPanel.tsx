import { useEffect, useState } from 'react';
import { Check, Save, Smartphone, X } from 'lucide-react';
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
  createdAt: string;
};

type Payment = Partial<Record<Lang, string>>;

/**
 * Заявки на оплату SMS — раздел владельца площадки.
 *
 * Салон выбирает пакет и переводит деньги, указав номер заявки.
 * Здесь ты сверяешь номер с банковской выпиской и нажимаешь
 * «зачислено» — сообщения появляются у салона в ту же секунду.
 *
 * Пока платёжной интеграции нет, это единственное место, где
 * деньги превращаются в сообщения. Отсюда и строгость: ни одна
 * заявка не подтверждается сама.
 */
function SmsPlatformPanel() {
  const { t } = useTranslation();

  const [orders, setOrders] = useState<Order[]>([]);
  const [payment, setPayment] = useState<Payment>({});
  const [lang, setLang] = useState<Lang>('ru');
  const [note, setNote] = useState('');

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
      const [ordersRes, paymentRes] = await Promise.all([
        api.get<Order[]>('/platform-admin/sms/orders'),
        api.get<Payment | null>('/platform-admin/sms/payment'),
      ]);

      setOrders(ordersRes.data);
      setPayment(paymentRes.data ?? {});
    } catch (error) {
      setErrorMsg(t(getErrorKey(error)));
    } finally {
      setIsLoading(false);
    }
  }

  async function resolve(order: Order, action: 'confirm' | 'cancel') {
    setBusy(order.id + action);
    setErrorMsg('');
    setDoneMsg('');

    try {
      await api.patch(
        '/platform-admin/sms/orders/' + order.id + '/' + action,
        { note: note.trim() || undefined },
      );

      setDoneMsg(
        t(action === 'confirm' ? 'smsAdmin.confirmed' : 'smsAdmin.cancelled', {
          reference: order.reference,
        }),
      );

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

  const panelStyle = {
    padding: '20px 18px',
    border: '1px solid var(--app-border)',
    borderRadius: 18,
    background: 'var(--app-panel)',
    marginBottom: 22,
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
          {/* ── Заявки ── */}
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
              {orders.map((order) => (
                <div
                  key={order.id}
                  style={{
                    padding: '16px 18px',
                    border: '1px solid rgba(255,208,139,0.3)',
                    borderRadius: 14,
                    background: 'rgba(255,208,139,0.06)',
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
                        color: '#ffd08b',
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
                      {order.masterProfileId ? ' · ' + t('smsAdmin.master') : ''}
                    </span>

                    <span
                      style={{
                        display: 'block',
                        marginTop: 3,
                        color: 'var(--app-text-muted)',
                        fontSize: 13,
                      }}
                    >
                      {order.messages} SMS · {Number(order.price).toFixed(2)}{' '}
                      {t('smsAdmin.mdl')} ·{' '}
                      {new Date(order.createdAt).toLocaleString()}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => void resolve(order, 'confirm')}
                      disabled={busy !== ''}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 7,
                        minHeight: 42,
                        padding: '0 18px',
                        border: 0,
                        borderRadius: 12,
                        background: 'var(--app-accent)',
                        color: '#17151c',
                        fontSize: 13,
                        fontWeight: 700,
                        fontFamily: 'inherit',
                        cursor: 'pointer',
                        opacity: busy === order.id + 'confirm' ? 0.6 : 1,
                      }}
                    >
                      <Check size={15} />
                      {t('smsAdmin.confirm')}
                    </button>

                    <button
                      type="button"
                      onClick={() => void resolve(order, 'cancel')}
                      disabled={busy !== ''}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 7,
                        minHeight: 42,
                        padding: '0 16px',
                        border: '1px solid var(--app-border)',
                        borderRadius: 12,
                        background: 'transparent',
                        color: 'var(--app-text-muted)',
                        fontSize: 13,
                        fontWeight: 700,
                        fontFamily: 'inherit',
                        cursor: 'pointer',
                      }}
                    >
                      <X size={15} />
                      {t('smsAdmin.cancel')}
                    </button>
                  </div>
                </div>
              ))}

              <input
                type="text"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder={t('smsAdmin.notePlaceholder')}
                style={{
                  width: '100%',
                  minHeight: 42,
                  padding: '9px 12px',
                  borderRadius: 11,
                  border: '1px solid var(--app-border)',
                  background: 'var(--app-input)',
                  color: 'var(--app-text)',
                  fontSize: 13,
                  fontFamily: 'inherit',
                }}
              />
            </div>
          )}

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
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                minHeight: 44,
                marginTop: 12,
                padding: '0 20px',
                border: 0,
                borderRadius: 13,
                background: 'var(--app-accent)',
                color: '#17151c',
                fontSize: 14,
                fontWeight: 700,
                fontFamily: 'inherit',
                cursor: 'pointer',
                opacity: busy === 'payment' ? 0.6 : 1,
              }}
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

export default SmsPlatformPanel;
