import { useState } from 'react';
import { AlertTriangle, Calculator, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import api from '../api/api';
import { getErrorKey } from '../api/errorMessage';

/**
 * Рассылка по базе — пока только «покажи, что будет».
 *
 * Кнопки «отправить» здесь нет, и это не забывчивость: рассылка тратит
 * деньги салона и попадает в телефоны живых людей. Сперва должен
 * появиться правдивый ответ на вопрос «кому уйдёт и сколько спишется»,
 * и салон должен привыкнуть его видеть. Кнопка придёт после — и станет
 * под этими же числами, а не вместо них.
 *
 * Считает сервер, а не экран. Своей арифметики здесь нет ни одной
 * нарочно: списывать будет сервер, и если бы экран считал сам, однажды
 * он показал бы одно, а со счёта ушло бы другое.
 *
 * Отсев показан поимённо. «Из 340 уйдёт 112» без объяснения, куда
 * делись остальные, — это не предупреждение, а загадка.
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
  text: string;
  sample: { id: string; name: string; phone: string }[];
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

function BroadcastPanel({ salonId, enabled }: BroadcastPanelProps) {
  const { t } = useTranslation();

  const [audience, setAudience] = useState<Audience>('lapsed');
  const [months, setMonths] = useState('6');
  const [includeNeverVisited, setIncludeNeverVisited] = useState(false);
  const [text, setText] = useState('');

  const [preview, setPreview] = useState<Preview | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [errorKey, setErrorKey] = useState('');

  async function calculate() {
    setIsBusy(true);
    setErrorKey('');

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

  const skippedLines = preview
    ? SKIP_KEYS.map((key) => ({ key, value: preview.skipped[key] })).filter(
        (line) => line.value > 0,
      )
    : [];

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
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '11px 20px',
          border: 'none',
          borderRadius: 13,
          background: 'var(--app-gold)',
          color: '#1a1119',
          cursor: isBusy ? 'wait' : 'pointer',
          fontSize: 14,
          fontWeight: 700,
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
          <div style={{ marginBottom: 12 }}>
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

            {enabled
              ? t('sms.broadcast.noSendYet')
              : t('sms.broadcast.smsOff')}
          </p>
        </div>
      ) : null}
    </section>
  );
}

export default BroadcastPanel;
