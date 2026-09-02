import { useEffect, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  Check,
  Gift,
  Info,
  Lock,
  Smartphone,
  Wallet,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import AppLayout from '../components/AppLayout';
import api from '../api/api';
import { getErrorKey } from '../api/errorMessage';

type Packet = {
  id: string;
  messages: number;
  price: string;
  sortOrder: number;
  active: boolean;
};

type Overview = {
  /** В чьём кабинете открыт раздел. */
  scope: 'salon' | 'master';
  /**
   * Есть ли у этого человека собственный счёт.
   *
   * У наёмного мастера — нет: за его записи платит салон, и экран
   * должен сказать это словами, а не показать нули.
   */
  ownAccount: boolean;
  enabled: boolean;
  allowanceLeft: number;
  monthlyAllowance: number;
  purchasedLeft: number;
  left: number;
  moneyBalance: string;
  autoTopUp: boolean;
  autoThreshold: number;
  autoPacketId: string | null;
  duplicateToRegistered: boolean;
  needWeek: number;
  needTomorrow: number;
  wouldHaveSent: number;
  packets: Packet[];
  /** Кому салон может подарить сообщения. У мастера пусто. */
  giftTargets: GiftTarget[];
};

type GiftTarget = {
  masterProfileId: string;
  name: string;
  left: number;
};

type SentMessage = {
  id: string;
  createdAt: string;
  phone: string;
  kind: string;
  segments: number;
  status: string;
  error: string | null;
};

type Salon = { id: string; name: string };

/** Сколько строк журнала показываем сразу. */
const HISTORY_LIMIT = 25;

/**
 * В чьём кабинете мы находимся.
 *
 * Приложение уже знает это само — оно и рисует разное меню. Незачем
 * гадать по ролям: человек, который и владелец, и мастер, просто
 * переключает рабочее место, как привык.
 */
function currentScope(): 'salon' | 'master' {
  try {
    return localStorage.getItem('glamour_workspace_mode') === 'master'
      ? 'master'
      : 'salon';
  } catch {
    return 'salon';
  }
}

/**
 * Раздел SMS в кабинете салона.
 *
 * Здесь владелец решает, тратить ли деньги на сообщения, и здесь же
 * видит, куда они ушли. Экран устроен вокруг одного вопроса: хватит
 * ли остатка на тех, кто уже записан. Не «мало» или «много», а
 * ровно на тех людей, чьи имена уже стоят в календаре.
 */
function SmsPage() {
  const { t } = useTranslation();

  const [salon, setSalon] = useState<Salon | null>(null);
  const [data, setData] = useState<Overview | null>(null);
  const [messages, setMessages] = useState<SentMessage[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  /** Кому и сколько дарим. */
  const [giftTo, setGiftTo] = useState('');
  const [giftAmount, setGiftAmount] = useState('20');

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setIsLoading(true);
    setErrorMsg('');

    try {
      const salonsRes = await api.get<Salon[]>('/salons/my');
      const current = salonsRes.data[0] ?? null;

      setSalon(current);

      if (!current) {
        return;
      }

      await refresh(current.id);
    } catch (error) {
      setErrorMsg(t(getErrorKey(error)));
    } finally {
      setIsLoading(false);
    }
  }

  async function refresh(salonId: string) {
    const scope = currentScope();

    const [overviewRes, messagesRes] = await Promise.all([
      api.get<Overview>('/sms/overview', { params: { salonId, scope } }),
      api.get<SentMessage[]>('/sms/messages', {
        params: { salonId, scope, limit: HISTORY_LIMIT },
      }),
    ]);

    setData(overviewRes.data);
    setMessages(messagesRes.data);
  }

  async function act(name: string, run: () => Promise<void>) {
    if (!salon) {
      return;
    }

    setBusy(name);
    setErrorMsg('');

    try {
      await run();
      await refresh(salon.id);
    } catch (error) {
      setErrorMsg(t(getErrorKey(error)));
    } finally {
      setBusy('');
    }
  }

  function setEnabled(enabled: boolean) {
    void act('enabled', async () => {
      await api.patch(
        '/sms/enabled',
        { enabled },
        { params: { salonId: salon?.id, scope: currentScope() } },
      );
    });
  }

  function setOptions(patch: Record<string, unknown>) {
    void act('options', async () => {
      await api.patch('/sms/options', patch, {
        params: { salonId: salon?.id, scope: currentScope() },
      });
    });
  }

  function gift() {
    const amount = Number(giftAmount) || 0;

    if (!giftTo || amount <= 0) {
      return;
    }

    void act('gift', async () => {
      await api.post(
        '/sms/gift',
        { masterProfileId: giftTo, amount },
        { params: { salonId: salon?.id, scope: currentScope() } },
      );
    });
  }

  function buy(packetId: string) {
    void act('buy:' + packetId, async () => {
      await api.post(
        '/sms/buy',
        { packetId },
        { params: { salonId: salon?.id, scope: currentScope() } },
      );
    });
  }

  /* ─────────── Оформление ─────────── */

  const panelStyle = {
    padding: '22px 20px',
    border: '1px solid var(--app-border)',
    borderRadius: 18,
    background: 'var(--app-panel)',
    marginBottom: 18,
  } as const;

  const kickerStyle = {
    margin: '0 0 8px',
    color: 'var(--app-accent)',
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.16em',
  } as const;

  const money = Number(data?.moneyBalance ?? 0);

  /** Хватает ли остатка на тех, кто уже записан на неделю вперёд. */
  const shortBy = data ? Math.max(data.needWeek - data.left, 0) : 0;

  return (
    <AppLayout>
      <main style={{ padding: '22px 18px 40px', textAlign: 'left' }}>
        <p style={kickerStyle}>{t('sms.kicker')}</p>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 18,
            flexWrap: 'wrap',
          }}
        >
          <Smartphone size={22} color="var(--app-accent)" />

          <h1
            style={{
              margin: 0,
              color: 'var(--app-text)',
              fontSize: 26,
              letterSpacing: '-0.02em',
            }}
          >
            {t('sms.title')}
          </h1>

          {data && (
            <span
              style={{
                padding: '6px 13px',
                borderRadius: 999,
                border:
                  '1px solid ' +
                  (data.enabled ? 'rgba(142,229,181,0.32)' : 'var(--app-border)'),
                background: data.enabled
                  ? 'rgba(142,229,181,0.1)'
                  : 'transparent',
                color: data.enabled ? '#8ee5b5' : 'var(--app-text-muted)',
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              {data.enabled ? t('sms.on.badge') : t('sms.off.badge')}
            </span>
          )}
        </div>

        {errorMsg && (
          <p
            style={{
              margin: '0 0 14px',
              color: '#ffb6c6',
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            {errorMsg}
          </p>
        )}

        {isLoading && (
          <p style={{ color: 'var(--app-text-muted)', fontSize: 14 }}>…</p>
        )}

        {!isLoading && !salon && (
          <p style={{ color: 'var(--app-text-muted)', fontSize: 14 }}>
            {t('sms.noSalon')}
          </p>
        )}

        {/* ── Наёмный мастер: своего счёта нет, и это нормально ── */}
        {!isLoading && data && !data.ownAccount && (
          <section style={panelStyle}>
            <div
              style={{
                display: 'flex',
                gap: 13,
                alignItems: 'flex-start',
              }}
            >
              <Info
                size={19}
                color="var(--app-accent)"
                style={{ flexShrink: 0, marginTop: 2 }}
              />

              <div>
                <strong style={{ color: 'var(--app-text)', fontSize: 16 }}>
                  {t('sms.staff.title')}
                </strong>

                <p
                  style={{
                    margin: '8px 0 0',
                    maxWidth: 620,
                    color: 'var(--app-text-muted)',
                    fontSize: 14,
                    lineHeight: 1.6,
                  }}
                >
                  {t('sms.staff.note')}
                </p>
              </div>
            </div>
          </section>
        )}

        {!isLoading && data && data.ownAccount && (
          <>
            {/* ── Не включено: свой собственный счёт за прошлый месяц ── */}
            {!data.enabled && (
              <section style={panelStyle}>
                <p
                  style={{
                    margin: '0 0 16px',
                    maxWidth: 620,
                    color: 'var(--app-text-muted)',
                    fontSize: 14,
                    lineHeight: 1.6,
                  }}
                >
                  {t('sms.off.intro')}
                </p>

                <div
                  style={{
                    padding: '20px 22px',
                    border: '1px solid rgba(209,127,176,0.3)',
                    borderRadius: 16,
                    background: 'rgba(209,127,176,0.07)',
                    marginBottom: 18,
                  }}
                >
                  <p
                    style={{
                      margin: '0 0 8px',
                      color: 'var(--app-text-muted)',
                      fontSize: 14,
                    }}
                  >
                    {t('sms.off.shadowLead')}
                  </p>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      gap: 12,
                      flexWrap: 'wrap',
                    }}
                  >
                    <strong
                      style={{
                        color: 'var(--app-text)',
                        fontSize: 38,
                        lineHeight: 1,
                        letterSpacing: '-0.04em',
                      }}
                    >
                      {data.wouldHaveSent}
                    </strong>

                    <span
                      style={{
                        color: 'var(--app-accent)',
                        fontSize: 16,
                        fontWeight: 600,
                      }}
                    >
                      {t('sms.off.shadowUnit')}
                    </span>
                  </div>

                  <p
                    style={{
                      margin: '10px 0 0',
                      maxWidth: 580,
                      color: 'var(--app-text-muted)',
                      fontSize: 13,
                      lineHeight: 1.6,
                    }}
                  >
                    {t('sms.off.shadowNote')}
                  </p>
                </div>

                <Terms allowance={data.monthlyAllowance} />

                <p
                  style={{
                    margin: '16px 0',
                    maxWidth: 640,
                    color: 'var(--app-text-muted)',
                    fontSize: 12,
                    lineHeight: 1.6,
                  }}
                >
                  {t('sms.consent')}
                </p>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    flexWrap: 'wrap',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setEnabled(true)}
                    disabled={busy !== ''}
                    style={primaryButton(busy === 'enabled')}
                  >
                    <Check size={16} />
                    {t('sms.off.enable')}
                  </button>

                  <span
                    style={{
                      color: 'var(--app-text-muted)',
                      fontSize: 13,
                      lineHeight: 1.5,
                    }}
                  >
                    {t('sms.off.enableHint', { n: data.monthlyAllowance })}
                  </span>
                </div>
              </section>
            )}

            {/* ── Включено: остатки и проверка по календарю ── */}
            {data.enabled && (
              <section style={panelStyle}>
                {shortBy > 0 && (
                  <div
                    style={{
                      display: 'flex',
                      gap: 13,
                      alignItems: 'flex-start',
                      padding: '16px 18px',
                      border: '1px solid rgba(255,182,198,0.34)',
                      borderRadius: 14,
                      background: 'rgba(255,182,198,0.08)',
                      marginBottom: 18,
                    }}
                  >
                    <AlertTriangle
                      size={19}
                      color="#ffb6c6"
                      style={{ flexShrink: 0, marginTop: 2 }}
                    />

                    <div>
                      <strong
                        style={{ color: 'var(--app-text)', fontSize: 15 }}
                      >
                        {t('sms.on.short', { n: shortBy })}
                      </strong>

                      <p
                        style={{
                          margin: '6px 0 0',
                          color: 'var(--app-text-muted)',
                          fontSize: 13,
                          lineHeight: 1.6,
                        }}
                      >
                        {t('sms.on.shortNote', {
                          need: data.needWeek,
                          left: data.left,
                        })}
                      </p>
                    </div>
                  </div>
                )}

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                    gap: 14,
                    marginBottom: 16,
                  }}
                >
                  <Card
                    label={t('sms.on.left')}
                    value={String(data.left)}
                    note={t('sms.on.leftNote', {
                      allowance: data.allowanceLeft,
                      purchased: data.purchasedLeft,
                    })}
                    accent
                  />

                  <Card
                    label={t('sms.on.needWeek')}
                    value={String(data.needWeek)}
                    note={
                      shortBy > 0
                        ? t('sms.on.needWeekShort')
                        : t('sms.on.needWeekOk')
                    }
                  />

                  <Card
                    label={t('sms.money.balance')}
                    value={money.toFixed(2) + ' ' + t('sms.money.mdl')}
                    note={t('sms.money.balanceNote')}
                  />
                </div>

                <label
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                    marginBottom: 16,
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={data.duplicateToRegistered}
                    onChange={(event) =>
                      setOptions({ duplicateToRegistered: event.target.checked })
                    }
                    disabled={busy !== ''}
                    style={{ marginTop: 3, accentColor: 'var(--app-accent)' }}
                  />

                  <span>
                    <strong style={{ color: 'var(--app-text)', fontSize: 14 }}>
                      {t('sms.on.duplicate')}
                    </strong>

                    <span
                      style={{
                        display: 'block',
                        marginTop: 3,
                        color: 'var(--app-text-muted)',
                        fontSize: 13,
                        lineHeight: 1.55,
                      }}
                    >
                      {t('sms.on.duplicateNote')}
                    </span>
                  </span>
                </label>


                <button
                  type="button"
                  onClick={() => setEnabled(false)}
                  disabled={busy !== ''}
                  style={ghostButton()}
                >
                  {t('sms.on.disable')}
                </button>
              </section>
            )}

            {/* ── Деньги и пакеты ── */}
            {data.enabled && (
              <section style={panelStyle}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 9,
                    marginBottom: 6,
                  }}
                >
                  <Wallet size={18} color="var(--app-accent)" />

                  <strong style={{ color: 'var(--app-text)', fontSize: 16 }}>
                    {t('sms.money.title')}
                  </strong>
                </div>

                <p
                  style={{
                    margin: '0 0 16px',
                    color: 'var(--app-text-muted)',
                    fontSize: 13,
                    lineHeight: 1.6,
                  }}
                >
                  {t('sms.money.hint')}
                </p>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
                    gap: 12,
                    marginBottom: 16,
                  }}
                >
                  {data.packets.map((packet) => {
                    const per = Number(packet.price) / packet.messages;
                    const enough = money >= Number(packet.price);

                    return (
                      <div
                        key={packet.id}
                        style={{
                          padding: '18px 16px',
                          border: '1px solid var(--app-border)',
                          borderRadius: 15,
                          background: 'var(--app-input)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 7,
                        }}
                      >
                        <strong
                          style={{
                            color: 'var(--app-text)',
                            fontSize: 24,
                            letterSpacing: '-0.03em',
                          }}
                        >
                          {packet.messages}
                        </strong>

                        <span
                          style={{
                            color: 'var(--app-text-muted)',
                            fontSize: 13,
                          }}
                        >
                          {t('sms.money.messages')}
                        </span>

                        <strong
                          style={{
                            marginTop: 4,
                            color: 'var(--app-text)',
                            fontSize: 17,
                          }}
                        >
                          {Number(packet.price).toFixed(2)}{' '}
                          {t('sms.money.mdl')}
                        </strong>

                        <span
                          style={{ color: 'var(--app-text-muted)', fontSize: 12 }}
                        >
                          {t('sms.money.per', { price: per.toFixed(2) })}
                        </span>

                        <button
                          type="button"
                          onClick={() => buy(packet.id)}
                          disabled={busy !== '' || !enough}
                          style={{
                            ...primaryButton(busy === 'buy:' + packet.id),
                            marginTop: 8,
                            minHeight: 40,
                            fontSize: 13,
                            opacity: enough ? 1 : 0.45,
                          }}
                        >
                          {enough ? t('sms.money.buy') : t('sms.money.notEnough')}
                        </button>
                      </div>
                    );
                  })}
                </div>

                <AutoTopUp
                  data={data}
                  busy={busy !== ''}
                  onChange={setOptions}
                />

                <div
                  style={{
                    display: 'flex',
                    gap: 11,
                    alignItems: 'flex-start',
                    marginTop: 16,
                  }}
                >
                  <Info
                    size={16}
                    color="var(--app-text-muted)"
                    style={{ flexShrink: 0, marginTop: 2 }}
                  />

                  <p
                    style={{
                      margin: 0,
                      maxWidth: 640,
                      color: 'var(--app-text-muted)',
                      fontSize: 12,
                      lineHeight: 1.6,
                    }}
                  >
                    {t('sms.money.note')}
                  </p>
                </div>
              </section>
            )}

            {/* ── Подарок своим независимым мастерам ── */}
            {data.scope === 'salon' && data.giftTargets.length > 0 && (
              <section style={panelStyle}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 9,
                    marginBottom: 6,
                  }}
                >
                  <Gift size={18} color="var(--app-accent)" />

                  <strong style={{ color: 'var(--app-text)', fontSize: 16 }}>
                    {t('sms.gift.title')}
                  </strong>
                </div>

                <p
                  style={{
                    margin: '0 0 16px',
                    maxWidth: 640,
                    color: 'var(--app-text-muted)',
                    fontSize: 13,
                    lineHeight: 1.6,
                  }}
                >
                  {t('sms.gift.hint')}
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
                    <span
                      style={{
                        display: 'block',
                        marginBottom: 6,
                        color: 'var(--app-text-muted)',
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      {t('sms.gift.who')}
                    </span>

                    <select
                      value={giftTo}
                      onChange={(event) => setGiftTo(event.target.value)}
                      disabled={busy !== ''}
                      style={{
                        minHeight: 44,
                        minWidth: 220,
                        padding: '0 12px',
                        borderRadius: 12,
                        border: '1px solid var(--app-border)',
                        background: 'var(--app-input)',
                        color: 'var(--app-text)',
                        fontSize: 14,
                        fontFamily: 'inherit',
                      }}
                    >
                      <option value="">—</option>

                      {data.giftTargets.map((target) => (
                        <option
                          key={target.masterProfileId}
                          value={target.masterProfileId}
                        >
                          {target.name} · {target.left}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label style={{ display: 'block' }}>
                    <span
                      style={{
                        display: 'block',
                        marginBottom: 6,
                        color: 'var(--app-text-muted)',
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      {t('sms.gift.amount')}
                    </span>

                    <input
                      type="number"
                      min={1}
                      max={10000}
                      value={giftAmount}
                      onChange={(event) => setGiftAmount(event.target.value)}
                      disabled={busy !== ''}
                      style={{
                        width: 110,
                        minHeight: 44,
                        padding: '0 12px',
                        borderRadius: 12,
                        border: '1px solid var(--app-border)',
                        background: 'var(--app-input)',
                        color: 'var(--app-text)',
                        fontSize: 14,
                        fontWeight: 700,
                        fontFamily: 'inherit',
                      }}
                    />
                  </label>

                  <button
                    type="button"
                    onClick={gift}
                    disabled={busy !== '' || !giftTo}
                    style={{
                      ...primaryButton(busy === 'gift'),
                      opacity: giftTo ? (busy === 'gift' ? 0.6 : 1) : 0.45,
                    }}
                  >
                    <Gift size={16} />
                    {t('sms.gift.send')}
                  </button>
                </div>

                <p
                  style={{
                    margin: '14px 0 0',
                    maxWidth: 640,
                    color: 'var(--app-text-muted)',
                    fontSize: 12,
                    lineHeight: 1.6,
                  }}
                >
                  {t('sms.gift.note')}
                </p>
              </section>
            )}

            {/* ── Условия видны и после включения ── */}
            {data.enabled && (
              <section style={panelStyle}>
                <Terms allowance={data.monthlyAllowance} />
              </section>
            )}

            {/* ── Журнал ── */}
            <section style={panelStyle}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  gap: 16,
                  marginBottom: 14,
                }}
              >
                <strong style={{ color: 'var(--app-text)', fontSize: 16 }}>
                  {t('sms.history.title')}
                </strong>

                <span
                  style={{ color: 'var(--app-text-muted)', fontSize: 12 }}
                >
                  {t('sms.history.kept')}
                </span>
              </div>

              {messages.length === 0 ? (
                <p
                  style={{
                    margin: 0,
                    color: 'var(--app-text-muted)',
                    fontSize: 13,
                  }}
                >
                  {t('sms.history.empty')}
                </p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table
                    style={{
                      width: '100%',
                      minWidth: 560,
                      borderCollapse: 'collapse',
                      fontSize: 13,
                    }}
                  >
                    <thead>
                      <tr>
                        <Th>{t('sms.history.when')}</Th>
                        <Th>{t('sms.history.to')}</Th>
                        <Th>{t('sms.history.why')}</Th>
                        <Th align="right">{t('sms.history.segments')}</Th>
                        <Th>{t('sms.history.status')}</Th>
                      </tr>
                    </thead>

                    <tbody>
                      {messages.map((row) => (
                        <tr key={row.id}>
                          <Td muted>
                            {new Date(row.createdAt).toLocaleString()}
                          </Td>
                          <Td>{row.phone}</Td>
                          <Td muted>{t('sms.kinds.' + row.kind, row.kind)}</Td>
                          <Td align="right">{row.segments}</Td>
                          <Td
                            color={
                              row.status === 'sent'
                                ? '#8ee5b5'
                                : row.status === 'failed'
                                  ? '#ffb6c6'
                                  : 'var(--app-text-muted)'
                            }
                          >
                            {t('sms.status.' + row.status, row.status)}
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <p
                style={{
                  margin: '12px 0 0',
                  color: 'var(--app-text-muted)',
                  fontSize: 12,
                }}
              >
                {t('sms.history.notCharged')}
              </p>
            </section>
          </>
        )}
      </main>
    </AppLayout>
  );
}

/* ─────────── Мелкие части ─────────── */

/**
 * Условия.
 *
 * Показываются и до включения, и после. До — чтобы человек решал
 * осознанно; после — потому что через месяц он уже не помнит, что
 * читал, а спор о том, почему списалось два сообщения вместо одного,
 * случится именно тогда.
 */
function Terms({ allowance }: { allowance: number }) {
  const { t } = useTranslation();

  const rows = [
    { title: t('sms.terms.price'), note: t('sms.terms.priceNote') },
    {
      title: t('sms.terms.allowance', { n: allowance }),
      note: t('sms.terms.allowanceNote'),
    },
    { title: t('sms.terms.stop'), note: t('sms.terms.stopNote') },
    { title: t('sms.terms.owner'), note: t('sms.terms.ownerNote') },
  ];

  return (
    <div
      style={{
        padding: '18px 20px',
        border: '1px solid var(--app-border)',
        borderRadius: 16,
        background: 'var(--app-input)',
      }}
    >
      <p
        style={{
          margin: '0 0 14px',
          color: 'var(--app-accent)',
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: '0.16em',
        }}
      >
        {t('sms.terms.title')}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {rows.map((row) => (
          <div
            key={row.title}
            style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}
          >
            <Lock
              size={16}
              color="var(--app-accent)"
              style={{ flexShrink: 0, marginTop: 3 }}
            />

            <div>
              <strong style={{ color: 'var(--app-text)', fontSize: 14 }}>
                {row.title}
              </strong>

              <span
                style={{
                  display: 'block',
                  marginTop: 3,
                  color: 'var(--app-text-muted)',
                  fontSize: 13,
                  lineHeight: 1.55,
                }}
              >
                {row.note}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Автопополнение: порог и пакет. */
function AutoTopUp({
  data,
  busy,
  onChange,
}: {
  data: Overview;
  busy: boolean;
  onChange: (patch: Record<string, unknown>) => void;
}) {
  const { t } = useTranslation();

  return (
    <div
      style={{
        padding: '18px 20px',
        border: '1px solid var(--app-border)',
        borderRadius: 16,
        background: 'var(--app-input)',
      }}
    >
      <label
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 10,
          cursor: 'pointer',
        }}
      >
        <input
          type="checkbox"
          checked={data.autoTopUp}
          onChange={(event) => onChange({ autoTopUp: event.target.checked })}
          disabled={busy}
          style={{ marginTop: 3, accentColor: 'var(--app-accent)' }}
        />

        <span>
          <strong style={{ color: 'var(--app-text)', fontSize: 15 }}>
            {t('sms.auto.title')}
          </strong>

          <span
            style={{
              display: 'block',
              marginTop: 3,
              color: 'var(--app-text-muted)',
              fontSize: 13,
              lineHeight: 1.55,
            }}
          >
            {t('sms.auto.hint')}
          </span>
        </span>
      </label>

      {data.autoTopUp && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexWrap: 'wrap',
            marginTop: 14,
            paddingLeft: 28,
          }}
        >
          <span style={{ color: 'var(--app-text-muted)', fontSize: 13 }}>
            {t('sms.auto.when')}
          </span>

          <input
            type="number"
            min={0}
            max={5000}
            value={data.autoThreshold}
            onChange={(event) =>
              onChange({ autoThreshold: Number(event.target.value) || 0 })
            }
            disabled={busy}
            style={{
              width: 90,
              minHeight: 40,
              padding: '0 11px',
              borderRadius: 11,
              border: '1px solid var(--app-border)',
              background: 'var(--app-panel)',
              color: 'var(--app-text)',
              fontSize: 13,
              fontWeight: 700,
              fontFamily: 'inherit',
            }}
          />

          <span style={{ color: 'var(--app-text-muted)', fontSize: 13 }}>
            {t('sms.auto.buy')}
          </span>

          <select
            value={data.autoPacketId ?? ''}
            onChange={(event) => onChange({ autoPacketId: event.target.value })}
            disabled={busy}
            style={{
              minHeight: 40,
              padding: '0 11px',
              borderRadius: 11,
              border: '1px solid var(--app-border)',
              background: 'var(--app-panel)',
              color: 'var(--app-text)',
              fontSize: 13,
              fontWeight: 700,
              fontFamily: 'inherit',
            }}
          >
            <option value="">—</option>

            {data.packets.map((packet) => (
              <option key={packet.id} value={packet.id}>
                {packet.messages} — {Number(packet.price).toFixed(2)}{' '}
                {t('sms.money.mdl')}
              </option>
            ))}
          </select>
        </div>
      )}

      <p
        style={{
          margin: '12px 0 0',
          paddingLeft: 28,
          color: 'var(--app-text-muted)',
          fontSize: 12,
          lineHeight: 1.6,
        }}
      >
        {t('sms.auto.note')}
      </p>
    </div>
  );
}

/** Плитка с числом. */
function Card({
  label,
  value,
  note,
  accent,
}: {
  label: string;
  value: string;
  note: string;
  accent?: boolean;
}) {
  return (
    <div
      style={{
        padding: '18px 20px',
        border: accent
          ? '1px solid rgba(209,127,176,0.3)'
          : '1px solid var(--app-border)',
        borderRadius: 16,
        background: accent ? 'rgba(209,127,176,0.07)' : 'var(--app-input)',
      }}
    >
      <p
        style={{
          margin: '0 0 10px',
          color: 'var(--app-text-muted)',
          fontSize: 13,
        }}
      >
        {label}
      </p>

      <strong
        style={{
          color: 'var(--app-text)',
          fontSize: 32,
          lineHeight: 1,
          letterSpacing: '-0.04em',
        }}
      >
        {value}
      </strong>

      <p
        style={{
          margin: '10px 0 0',
          color: 'var(--app-text-muted)',
          fontSize: 12,
          lineHeight: 1.5,
        }}
      >
        {note}
      </p>
    </div>
  );
}

function Th({
  children,
  align,
}: {
  children: ReactNode;
  align?: 'right';
}) {
  return (
    <th
      style={{
        padding: '0 10px 9px 0',
        borderBottom: '1px solid var(--app-border)',
        color: 'var(--app-text-muted)',
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.1em',
        textAlign: align ?? 'left',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align,
  muted,
  color,
}: {
  children: ReactNode;
  align?: 'right';
  muted?: boolean;
  color?: string;
}) {
  return (
    <td
      style={{
        padding: '9px 10px 9px 0',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        color: color ?? (muted ? 'var(--app-text-muted)' : 'var(--app-text)'),
        textAlign: align ?? 'left',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </td>
  );
}

function primaryButton(isBusy: boolean) {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 46,
    padding: '0 22px',
    border: 0,
    borderRadius: 13,
    background: 'var(--app-accent)',
    color: '#17151c',
    fontSize: 14,
    fontWeight: 700,
    fontFamily: 'inherit',
    cursor: isBusy ? 'default' : 'pointer',
    opacity: isBusy ? 0.6 : 1,
  } as const;
}

function ghostButton() {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    minHeight: 44,
    padding: '0 20px',
    borderRadius: 13,
    border: '1px solid var(--app-border)',
    background: 'transparent',
    color: 'var(--app-text-muted)',
    fontSize: 13,
    fontWeight: 700,
    fontFamily: 'inherit',
    cursor: 'pointer',
  } as const;
}

export default SmsPage;
