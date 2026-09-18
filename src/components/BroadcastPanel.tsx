import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  Calculator,
  Check,
  History,
  Send,
  Users,
  X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import api from '../api/api';
import { getErrorKey } from '../api/errorMessage';

/**
 * Рассылка по базе.
 *
 * Три шага, и между ними нельзя проскочить: посчитать → согласиться →
 * отправить. Кнопка отправки не показывается, пока не посчитано; шаг
 * согласия повторяет оба числа словами, а не подтверждает молча.
 *
 * Отправляя, экран называет те числа, которые показывал. Сервер считает
 * заново и сверяет: за минуту между подсчётом и нажатием могла прийти
 * клиентка, кто-то мог попросить не писать, со счёта могли уйти
 * сообщения на напоминания. Разошлись — отправки не будет, и экран
 * скажет, что именно изменилось.
 *
 * Своей арифметики здесь нет ни одной нарочно: списывает сервер, и если
 * бы экран считал сам, однажды он показал бы одно, а ушло бы другое.
 *
 * Любая правка после подсчёта сбрасывает подсчёт. Иначе можно было бы
 * посчитать короткий текст, дописать абзац и отправить по старой цене.
 */

type Audience = 'lapsed' | 'recent';

type Preview = {
  audience: Audience;
  months: number;
  includeNeverVisited: boolean;
  inBase: number;
  people: number;
  skipped: {
    otherPeriod: number;
    neverVisited: number;
    noPhone: number;
    blocked: number;
    duplicate: number;
  };
  segments: number;
  messages: number;
  left: number;
  enough: boolean;
  shortBy: number;
  /** Разрешает ли тариф откладывать отправку. */
  canSchedule: boolean;
  text: string;
  sample: { id: string; name: string; phone: string }[];
};

type Broadcast = {
  id: string;
  status: 'scheduled' | 'sending' | 'done' | 'interrupted' | 'cancelled';
  /** Когда назначена. Пусто — уходила сразу. */
  scheduledAt: string | null;
  text: string;
  plannedPeople: number;
  plannedMessages: number;
  sentPeople: number;
  failedPeople: number;
  createdAt: string;
};

type BroadcastPanelProps = {
  salonId: string;
  /** Отправка сообщений у салона включена. */
  enabled: boolean;
};

const SKIP_KEYS = [
  'otherPeriod',
  'neverVisited',
  'noPhone',
  'blocked',
  'duplicate',
] as const;

/**
 * Отказ сервера — в понятную фразу.
 *
 * Эти четыре причины приходят кодами нарочно: каждая значит своё, и
 * общее «не получилось» отняло бы у человека единственную подсказку,
 * что делать дальше.
 */
function refusalKey(error: unknown): string {
  const response = (
    error as {
      response?: { data?: { message?: string | string[] } };
    }
  )?.response;

  const raw = response?.data?.message;
  const message = Array.isArray(raw) ? raw.join(' ') : (raw ?? '');

  const known: Record<string, string> = {
    BROADCAST_NOTHING_TO_SEND: 'sms.broadcast.err.nothingToSend',
    BROADCAST_PEOPLE_CHANGED: 'sms.broadcast.err.peopleChanged',
    BROADCAST_MESSAGES_CHANGED: 'sms.broadcast.err.messagesChanged',
    BROADCAST_NOT_ENOUGH: 'sms.broadcast.err.notEnough',
    BROADCAST_SCHEDULE_NOT_A_DATE: 'sms.broadcast.err.notADate',
    BROADCAST_SCHEDULE_TOO_SOON: 'sms.broadcast.err.tooSoon',
    BROADCAST_SCHEDULE_TOO_FAR: 'sms.broadcast.err.tooFar',
    BROADCAST_NOT_CANCELLABLE: 'sms.broadcast.err.notCancellable',
    BROADCAST_SCHEDULE_NOT_IN_PLAN: 'sms.broadcast.err.notInPlan',
  };

  return known[message] ?? getErrorKey(error);
}

/**
 * Состояние рассылки — в слово.
 *
 * Три слова написаны ещё для немедленной отправки и лежат в словаре
 * без приставки `state`. Заводить им двойников ради стройности имён
 * значило бы держать в словаре две одинаковые фразы, которые однажды
 * разойдутся при правке одной из них.
 */
function statusKey(status: Broadcast['status']): string {
  const known: Record<Broadcast['status'], string> = {
    scheduled: 'sms.broadcast.state.scheduled',
    sending: 'sms.broadcast.sending',
    done: 'sms.broadcast.sent',
    interrupted: 'sms.broadcast.interrupted',
    cancelled: 'sms.broadcast.state.cancelled',
  };

  return known[status] ?? 'sms.broadcast.sending';
}

function BroadcastPanel({ salonId, enabled }: BroadcastPanelProps) {
  const { t, i18n } = useTranslation();

  /**
   * Время — глазами того, кто смотрит.
   *
   * Сервер хранит его в UTC, а салон живёт в Кишинёве и назначает на
   * «десять утра». Показывать здесь UTC значило бы спорить с
   * человеком о том, что он сам только что ввёл.
   */
  function formatWhen(value: string | null): string {
    if (!value) {
      return '';
    }

    const date = new Date(value);

    return Number.isNaN(date.getTime())
      ? ''
      : date.toLocaleString(i18n.language || 'ru', {
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        });
  }

  const [audience, setAudience] = useState<Audience>('lapsed');
  const [months, setMonths] = useState('6');
  const [includeNeverVisited, setIncludeNeverVisited] = useState(false);
  const [text, setText] = useState('');

  const [preview, setPreview] = useState<Preview | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [errorKey, setErrorKey] = useState('');

  const [isConfirming, setIsConfirming] = useState(false);
  const [broadcast, setBroadcast] = useState<Broadcast | null>(null);

  /** Отправить позже. Пусто — сейчас. */
  const [sendLater, setSendLater] = useState(false);
  const [sendAt, setSendAt] = useState('');

  const [history, setHistory] = useState<Broadcast[]>([]);

  const pollRef = useRef<number | null>(null);

  /**
   * Подсчёт устаревает от любой правки.
   *
   * Иначе можно посчитать короткий текст, дописать абзац и отправить
   * по старой цене. Сервер такую отправку всё равно не примет — но
   * человек не должен узнавать об этом от отказа.
   */
  useEffect(() => {
    setPreview(null);
    setIsConfirming(false);
  }, [audience, months, includeNeverVisited, text]);

  useEffect(() => {
    void loadHistory();

    return () => {
      if (pollRef.current) {
        window.clearInterval(pollRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [salonId]);

  async function loadHistory() {
    try {
      const response = await api.get<Broadcast[]>('/sms/broadcast/history', {
        params: { salonId },
      });

      setHistory(response.data);
    } catch {
      /** Журнал — не главное на экране: молча пусто лучше, чем крик. */
      setHistory([]);
    }
  }

  async function calculate() {
    setIsBusy(true);
    setErrorKey('');
    setBroadcast(null);

    try {
      const response = await api.post<Preview>(
        '/sms/broadcast/preview',
        {
          audience,
          months: Number(months) || 6,
          includeNeverVisited,
          text: text.trim(),
        },
        { params: { salonId } },
      );

      setPreview(response.data);
    } catch (error) {
      setPreview(null);
      setErrorKey(getErrorKey(error));
    } finally {
      setIsBusy(false);
    }
  }

  async function confirmSend() {
    if (!preview) {
      return;
    }

    setIsBusy(true);
    setErrorKey('');

    try {
      const response = await api.post<Broadcast>(
        '/sms/broadcast/send',
        {
          audience,
          months: Number(months) || 6,
          includeNeverVisited,
          text: text.trim(),
          confirmPeople: preview.people,
          confirmMessages: preview.messages,
          scheduledAt:
            sendLater && sendAt ? new Date(sendAt).toISOString() : null,
        },
        { params: { salonId } },
      );

      setBroadcast(response.data);
      setIsConfirming(false);
      setPreview(null);

      void loadHistory();

      /** Назначенную караулить нечего: она уйдёт ночью, без экрана. */
      if (response.data.status === 'sending') {
        watch(response.data.id);
      }
    } catch (error) {
      setIsConfirming(false);
      setErrorKey(refusalKey(error));
    } finally {
      setIsBusy(false);
    }
  }

  async function cancelScheduled(broadcastId: string) {
    setIsBusy(true);
    setErrorKey('');

    try {
      const response = await api.post<Broadcast>(
        '/sms/broadcast/' + broadcastId + '/cancel',
        {},
        { params: { salonId } },
      );

      setBroadcast(response.data);

      void loadHistory();
    } catch (error) {
      setErrorKey(refusalKey(error));
    } finally {
      setIsBusy(false);
    }
  }

  /** Следим за ходом, пока рассылка идёт. */
  function watch(broadcastId: string) {
    if (pollRef.current) {
      window.clearInterval(pollRef.current);
    }

    pollRef.current = window.setInterval(() => {
      void (async () => {
        try {
          const response = await api.get<Broadcast>(
            '/sms/broadcast/' + broadcastId,
            { params: { salonId } },
          );

          setBroadcast(response.data);

          if (response.data.status !== 'sending' && pollRef.current) {
            window.clearInterval(pollRef.current);
            pollRef.current = null;
          }
        } catch {
          if (pollRef.current) {
            window.clearInterval(pollRef.current);
            pollRef.current = null;
          }
        }
      })();
    }, 3000);
  }

  const panelStyle = {
    padding: '22px 20px',
    border: '1px solid var(--app-border)',
    borderRadius: 18,
    background: 'var(--app-panel)',
    marginBottom: 18,
  } as const;

  const fieldStyle = {
    width: '100%',
    padding: '11px 13px',
    border: '1px solid rgba(var(--app-ink-rgb),0.12)',
    borderRadius: 13,
    background: 'rgba(var(--app-ink-rgb),0.06)',
    color: 'var(--app-text)',
    fontSize: 14,
  } as const;

  const labelStyle = {
    display: 'block',
    color: 'var(--app-text-muted)',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
  } as const;

  function tabStyle(active: boolean) {
    return {
      padding: '9px 16px',
      border: '1px solid var(--app-border)',
      borderRadius: 999,
      background: active ? 'var(--app-gold)' : 'transparent',
      color: active ? '#1a1119' : 'var(--app-text-muted)',
      cursor: 'pointer',
      fontSize: 13,
      fontWeight: 700,
    } as const;
  }

  const actionStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '11px 20px',
    border: 'none',
    borderRadius: 13,
    background: 'var(--app-gold)',
    color: '#1a1119',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 700,
  } as const;

  const quietStyle = {
    ...actionStyle,
    border: '1px solid var(--app-border)',
    background: 'transparent',
    color: 'var(--app-text-muted)',
  } as const;

  const skippedLines = preview
    ? SKIP_KEYS.map((key) => ({ key, value: preview.skipped[key] })).filter(
        (line) => line.value > 0,
      )
    : [];

  const canSend =
    preview !== null && preview.people > 0 && preview.enough && enabled;

  return (
    <section style={panelStyle}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 6,
        }}
      >
        <Users size={19} color="var(--app-gold)" aria-hidden="true" />

        <strong style={{ color: 'var(--app-text)', fontSize: 16 }}>
          {t('sms.broadcast.title')}
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
        {t('sms.broadcast.lead')}
      </p>

      {/* ── Кому ── */}

      <div
        style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}
      >
        <button
          type="button"
          style={tabStyle(audience === 'lapsed')}
          onClick={() => setAudience('lapsed')}
        >
          {t('sms.broadcast.audienceLapsed')}
        </button>

        <button
          type="button"
          style={tabStyle(audience === 'recent')}
          onClick={() => setAudience('recent')}
        >
          {t('sms.broadcast.audienceRecent')}
        </button>
      </div>

      <label style={{ display: 'block', marginBottom: 14 }}>
        <span style={labelStyle}>
          {audience === 'lapsed'
            ? t('sms.broadcast.monthsLapsed')
            : t('sms.broadcast.monthsRecent')}
        </span>

        <input
          type="number"
          min="1"
          max="60"
          step="1"
          value={months}
          onChange={(event) => setMonths(event.target.value)}
          style={{ ...fieldStyle, marginTop: 5, maxWidth: 150 }}
        />
      </label>

      {/*
        Ни разу не бывшие — только по отдельной отметке и только в
        «давно не были». Их номера попали к нам из таблицы, а не из
        разговора, и писать им — решение другого веса.
      */}
      {audience === 'lapsed' ? (
        <label
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8,
            marginBottom: 14,
          }}
        >
          <input
            type="checkbox"
            checked={includeNeverVisited}
            onChange={(event) => setIncludeNeverVisited(event.target.checked)}
            style={{ marginTop: 3 }}
          />

          <span style={{ color: 'var(--app-text)', fontSize: 13 }}>
            {t('sms.broadcast.includeNever')}

            <span
              style={{
                display: 'block',
                color: 'var(--app-text-muted)',
                fontSize: 12,
              }}
            >
              {t('sms.broadcast.includeNeverNote')}
            </span>
          </span>
        </label>
      ) : null}

      {/* ── Что ── */}

      <label style={{ display: 'block', marginBottom: 14 }}>
        <span style={labelStyle}>{t('sms.broadcast.text')}</span>

        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          maxLength={480}
          rows={4}
          placeholder={t('sms.broadcast.textPlaceholder')}
          style={{ ...fieldStyle, marginTop: 5, resize: 'vertical' }}
        />
      </label>

      <button
        type="button"
        disabled={isBusy || text.trim().length < 5}
        onClick={() => void calculate()}
        style={{
          ...actionStyle,
          cursor: isBusy ? 'wait' : 'pointer',
          opacity: text.trim().length < 5 ? 0.5 : 1,
        }}
      >
        <Calculator size={16} aria-hidden="true" />
        {isBusy ? t('sms.broadcast.calculating') : t('sms.broadcast.calculate')}
      </button>

      {errorKey ? (
        <p style={{ margin: '12px 0 0', color: '#dc2626', fontSize: 13 }}>
          {t(errorKey)}
        </p>
      ) : null}

      {/* ── Как идёт ── */}

      {broadcast ? (
        <div
          style={{
            marginTop: 18,
            padding: '16px 14px',
            border: '1px solid var(--app-border)',
            borderRadius: 14,
          }}
        >
          <span style={labelStyle}>{t(statusKey(broadcast.status))}</span>

          {broadcast.status === 'scheduled' ? (
            <>
              <p
                style={{
                  margin: '6px 0 0',
                  color: 'var(--app-text)',
                  fontSize: 14,
                  lineHeight: 1.6,
                }}
              >
                {t('sms.broadcast.scheduledFor', {
                  when: formatWhen(broadcast.scheduledAt),
                  people: broadcast.plannedPeople,
                })}
              </p>

              <p
                style={{
                  margin: '6px 0 0',
                  color: 'var(--app-text-muted)',
                  fontSize: 12,
                  lineHeight: 1.6,
                }}
              >
                {t('sms.broadcast.frozenNote')}
              </p>

              <button
                type="button"
                disabled={isBusy}
                onClick={() => void cancelScheduled(broadcast.id)}
                style={{ ...quietStyle, marginTop: 10 }}
              >
                <X size={16} aria-hidden="true" />
                {t('sms.broadcast.cancel')}
              </button>
            </>
          ) : (
            <p
              style={{
                margin: '6px 0 0',
                color: 'var(--app-text)',
                fontSize: 14,
                lineHeight: 1.6,
              }}
            >
              {t('sms.broadcast.progress', {
                sent: broadcast.sentPeople,
                planned: broadcast.plannedPeople,
              })}

              {broadcast.failedPeople > 0
                ? ' · ' +
                  t('sms.broadcast.failed', { count: broadcast.failedPeople })
                : ''}
            </p>
          )}
        </div>
      ) : null}

      {/* ── Что будет ── */}

      {preview ? (
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
              flexWrap: 'wrap',
              gap: 24,
              marginBottom: 14,
            }}
          >
            <div>
              <span style={labelStyle}>{t('sms.broadcast.people')}</span>

              <strong
                style={{
                  display: 'block',
                  color: 'var(--app-text)',
                  fontSize: 26,
                }}
              >
                {preview.people}
              </strong>

              <span style={{ color: 'var(--app-text-muted)', fontSize: 12 }}>
                {t('sms.broadcast.inBase', { count: preview.inBase })}
              </span>
            </div>

            <div>
              <span style={labelStyle}>{t('sms.broadcast.messages')}</span>

              <strong
                style={{
                  display: 'block',
                  color: preview.enough ? 'var(--app-text)' : '#dc2626',
                  fontSize: 26,
                }}
              >
                {preview.messages}
              </strong>

              <span style={{ color: 'var(--app-text-muted)', fontSize: 12 }}>
                {t('sms.broadcast.segments', { count: preview.segments })}
              </span>
            </div>

            <div>
              <span style={labelStyle}>{t('sms.broadcast.left')}</span>

              <strong
                style={{
                  display: 'block',
                  color: 'var(--app-text)',
                  fontSize: 26,
                }}
              >
                {preview.left}
              </strong>

              <span
                style={{
                  color: preview.enough ? 'var(--app-text-muted)' : '#dc2626',
                  fontSize: 12,
                  fontWeight: preview.enough ? 400 : 700,
                }}
              >
                {preview.enough
                  ? t('sms.broadcast.enough')
                  : t('sms.broadcast.short', { count: preview.shortBy })}
              </span>
            </div>
          </div>

          {preview.people === 0 ? (
            <p
              style={{
                margin: '0 0 12px',
                color: 'var(--app-text-muted)',
                fontSize: 13,
                lineHeight: 1.6,
              }}
            >
              {t('sms.broadcast.noOne')}
            </p>
          ) : null}

          {skippedLines.length > 0 ? (
            <div style={{ marginBottom: 12 }}>
              <span style={labelStyle}>{t('sms.broadcast.skippedTitle')}</span>

              <ul
                style={{
                  margin: '6px 0 0',
                  paddingLeft: 18,
                  color: 'var(--app-text-muted)',
                  fontSize: 13,
                  lineHeight: 1.7,
                }}
              >
                {skippedLines.map((line) => (
                  <li key={line.key}>
                    {t('sms.broadcast.skipped.' + line.key)} — {line.value}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {preview.sample.length > 0 ? (
            <div style={{ marginBottom: 12 }}>
              <span style={labelStyle}>{t('sms.broadcast.sampleTitle')}</span>

              <ul
                style={{
                  margin: '6px 0 0',
                  paddingLeft: 18,
                  color: 'var(--app-text)',
                  fontSize: 13,
                  lineHeight: 1.7,
                }}
              >
                {preview.sample.map((person) => (
                  <li key={person.id}>
                    {person.name || t('sms.broadcast.noName')} · {person.phone}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/*
            Текст показан ровно тем, каким уйдёт: диакритика уже
            разложена. Салон должен увидеть «Va asteptam», а не «Vă
            așteptăm», — иначе цена на экране и цена на счету разойдутся.
          */}
          <div style={{ marginBottom: 14 }}>
            <span style={labelStyle}>{t('sms.broadcast.willSend')}</span>

            <p
              style={{
                margin: '6px 0 0',
                padding: '10px 12px',
                border: '1px dashed var(--app-border)',
                borderRadius: 12,
                color: 'var(--app-text)',
                fontSize: 13,
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
              }}
            >
              {preview.text}
            </p>
          </div>

          {/* ── Согласие ── */}

          {/*
            Отправить позже — после подсчёта, а не до: право на это
            даёт тариф, а про тариф сервер рассказывает вместе с
            числами. Спрашивать отдельно значило бы спрашивать дважды.
          */}
          {enabled && canSend ? (
            preview.canSchedule ? (
              <>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 8,
                    marginBottom: 10,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={sendLater}
                    onChange={(event) => setSendLater(event.target.checked)}
                    style={{ marginTop: 3 }}
                  />

                  <span style={{ color: 'var(--app-text)', fontSize: 13 }}>
                    {t('sms.broadcast.later')}
                  </span>
                </label>

                {sendLater ? (
                  <label style={{ display: 'block', marginBottom: 12 }}>
                    <span style={labelStyle}>
                      {t('sms.broadcast.laterWhen')}
                    </span>

                    <input
                      type="datetime-local"
                      value={sendAt}
                      onChange={(event) => setSendAt(event.target.value)}
                      style={{ ...fieldStyle, marginTop: 5, maxWidth: 260 }}
                    />
                  </label>
                ) : null}
              </>
            ) : (
              <p
                style={{
                  margin: '0 0 12px',
                  color: 'var(--app-text-muted)',
                  fontSize: 12,
                  lineHeight: 1.6,
                }}
              >
                {t('sms.broadcast.laterLocked')}
              </p>
            )
          ) : null}

          {!enabled ? (
            <p
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
                margin: 0,
                color: 'var(--app-text-muted)',
                fontSize: 13,
                lineHeight: 1.6,
              }}
            >
              <AlertTriangle size={15} aria-hidden="true" />
              {t('sms.broadcast.smsOff')}
            </p>
          ) : !canSend ? null : isConfirming ? (
            <div>
              <p
                style={{
                  margin: '0 0 10px',
                  color: 'var(--app-text)',
                  fontSize: 14,
                  fontWeight: 700,
                  lineHeight: 1.6,
                }}
              >
                {sendLater && sendAt
                  ? t('sms.broadcast.confirmAskLater', {
                      people: preview.people,
                      messages: preview.messages,
                      when: formatWhen(sendAt),
                    })
                  : t('sms.broadcast.confirmAsk', {
                      people: preview.people,
                      messages: preview.messages,
                    })}
              </p>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => void confirmSend()}
                  style={{
                    ...actionStyle,
                    cursor: isBusy ? 'wait' : 'pointer',
                  }}
                >
                  <Check size={16} aria-hidden="true" />
                  {sendLater && sendAt
                    ? t('sms.broadcast.confirmYesLater')
                    : t('sms.broadcast.confirmYes')}
                </button>

                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => setIsConfirming(false)}
                  style={quietStyle}
                >
                  <X size={16} aria-hidden="true" />
                  {t('sms.broadcast.confirmNo')}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsConfirming(true)}
              style={actionStyle}
            >
              {sendLater && sendAt ? (
                <CalendarClock size={16} aria-hidden="true" />
              ) : (
                <Send size={16} aria-hidden="true" />
              )}
              {sendLater && sendAt
                ? t('sms.broadcast.schedule')
                : t('sms.broadcast.send')}
            </button>
          )}
        </div>
      ) : null}

      {/*
        Журнал рассылок. Строки отсюда не пропадают — включая
        отменённые: «я же отменял» должно быть чем проверить.
      */}
      {history.length > 0 ? (
        <div style={{ marginTop: 18 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 8,
            }}
          >
            <History size={15} color="var(--app-text-muted)" aria-hidden="true" />

            <span style={labelStyle}>{t('sms.broadcast.historyTitle')}</span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {history.map((row) => (
                  <tr key={row.id}>
                    <td
                      style={{
                        padding: '8px 8px 8px 0',
                        borderBottom:
                          '1px solid rgba(var(--app-ink-rgb),0.08)',
                        color: 'var(--app-text-muted)',
                        fontSize: 12,
                        whiteSpace: 'nowrap',
                        verticalAlign: 'top',
                      }}
                    >
                      {formatWhen(row.scheduledAt ?? row.createdAt)}
                    </td>

                    <td
                      style={{
                        padding: '8px',
                        borderBottom:
                          '1px solid rgba(var(--app-ink-rgb),0.08)',
                        color: 'var(--app-text)',
                        fontSize: 13,
                        lineHeight: 1.5,
                      }}
                    >
                      {row.text}
                    </td>

                    <td
                      style={{
                        padding: '8px 0 8px 8px',
                        borderBottom:
                          '1px solid rgba(var(--app-ink-rgb),0.08)',
                        color: 'var(--app-text-muted)',
                        fontSize: 12,
                        whiteSpace: 'nowrap',
                        textAlign: 'right',
                        verticalAlign: 'top',
                      }}
                    >
                      {t(statusKey(row.status))}

                      <div>
                        {t('sms.broadcast.progress', {
                          sent: row.sentPeople,
                          planned: row.plannedPeople,
                        })}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default BroadcastPanel;
