import { useEffect, useState } from 'react';
import { Check, Gift, UserPlus } from 'lucide-react';

import api from '../../api/api';

/**
 * Заявки на подключение — раздел кабинета владельца площадки.
 *
 * Сюда падает то, что человек написал на странице по ссылке
 * приглашения. Это не регистрация: дверь в продукт остаётся здесь, и
 * каждую заявку владелец разбирает сам — потому и экран.
 *
 * Главная колонка — «кто привёл». Без неё вся лестница бонусов была бы
 * числом в базе: начисляет её сервер, а разговаривать с человеком
 * всё равно приходится тому, кто здесь смотрит.
 *
 * Текст по-русски прямо в разметке, без словаря, — как в соседних
 * панелях этого кабинета: экран одного человека.
 */

type Lead = {
  id: string;
  code: string | null;
  referredByUserId: string | null;
  referrerName: string | null;
  name: string;
  phone: string;
  kind: 'salon' | 'master';
  salonName: string | null;
  city: string | null;
  note: string | null;
  status: 'new' | 'invited' | 'joined' | 'rejected';
  salonId: string | null;
  paidAt: string | null;
  bonusAwardedAt: string | null;
  bonusMessages: number;
  welcomeAwardedAt: string | null;
  welcomeMessages: number;
  bonusPendingReason: string | null;
  createdAt: string;
};

type Tier = {
  from: number;
  messages: number;
  step?: number;
  until?: number;
};

type Settings = {
  bonusLadder: Tier[] | null;
  welcomeMessages: number;
  enabled: boolean;
};

const STATUS_LABEL: Record<Lead['status'], string> = {
  new: 'Новая',
  invited: 'Приглашение выдано',
  joined: 'Подключился',
  rejected: 'Отказ',
};

const NEXT_STATUS: { value: Lead['status']; label: string }[] = [
  { value: 'invited', label: 'Выдал приглашение' },
  { value: 'joined', label: 'Подключился' },
  { value: 'rejected', label: 'Отказ' },
];

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

/** Лестница словами: «1–5 по 60, с 6 по 100 (+10 до 10), с 11 по 200». */
function ladderText(tiers: Tier[] | null): string {
  if (!tiers || tiers.length === 0) {
    return 'по умолчанию';
  }

  return tiers
    .slice()
    .sort((left, right) => left.from - right.from)
    .map((tier) => {
      const head = 'с ' + String(tier.from) + '-го — ' + String(tier.messages);

      if (!tier.step) {
        return head;
      }

      return (
        head +
        ' (+' +
        String(tier.step) +
        (tier.until ? ' до ' + String(tier.until) + '-го' : '') +
        ')'
      );
    })
    .join(', ');
}

function LeadsPanel() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [doneMsg, setDoneMsg] = useState('');
  const [welcome, setWelcome] = useState('');

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setIsLoading(true);

    try {
      const [list, config] = await Promise.all([
        api.get<Lead[]>('/platform-admin/referrals/leads'),
        api.get<Settings>('/platform-admin/referrals/settings'),
      ]);

      setLeads(list.data);
      setSettings(config.data);
      setWelcome(String(config.data.welcomeMessages));
      setErrorMsg('');
    } catch {
      setErrorMsg('Не удалось загрузить заявки');
    } finally {
      setIsLoading(false);
    }
  }

  async function setStatus(lead: Lead, status: Lead['status']) {
    setBusyId(lead.id);
    setDoneMsg('');

    try {
      await api.patch('/platform-admin/referrals/leads/' + lead.id, {
        status,
      });

      await load();
    } catch {
      setErrorMsg('Не удалось изменить заявку');
    } finally {
      setBusyId(null);
    }
  }

  async function saveSettings(patch: Partial<Settings>) {
    try {
      await api.patch('/platform-admin/referrals/settings', patch);

      setDoneMsg('Сохранено');

      await load();
    } catch {
      setErrorMsg('Не удалось сохранить настройку');
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
    verticalAlign: 'top',
  } as const;

  const headStyle = {
    ...cellStyle,
    color: 'var(--app-text-muted)',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
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
        <UserPlus size={18} color="var(--app-accent)" />

        <strong style={{ color: 'var(--app-text)', fontSize: 16 }}>
          Заявки на подключение
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
        Кто написал со страницы по ссылке и кто его привёл. Бонус
        начисляется сам в момент первой оплаты приведённого салона —
        отмечать его здесь не нужно.
      </p>

      <div
        style={{
          display: 'flex',
          gap: 18,
          flexWrap: 'wrap',
          alignItems: 'flex-end',
          padding: '12px 14px',
          marginBottom: 18,
          borderRadius: 14,
          background: 'rgba(var(--app-ink-rgb),0.04)',
        }}
      >
        <div>
          <p style={labelStyle}>ЛЕСТНИЦА БОНУСА</p>

          <span style={{ color: 'var(--app-text)', fontSize: 13 }}>
            {ladderText(settings?.bonusLadder ?? null)}
          </span>
        </div>

        <div>
          <p style={labelStyle}>ПОДАРОК ПРИШЕДШЕМУ</p>

          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={welcome}
              inputMode="numeric"
              onChange={(event) => setWelcome(event.target.value)}
              style={{
                width: 90,
                padding: '8px 10px',
                borderRadius: 10,
                border: '1px solid var(--app-border)',
                background: 'var(--app-input)',
                color: 'var(--app-text)',
                fontSize: 14,
              }}
            />

            <button
              type="button"
              onClick={() =>
                void saveSettings({ welcomeMessages: Number(welcome) })
              }
              style={{
                minHeight: 36,
                padding: '0 12px',
                border: '1px solid var(--app-border)',
                borderRadius: 10,
                background: 'transparent',
                color: 'var(--app-text)',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Сохранить
            </button>
          </div>
        </div>

        <div>
          <p style={labelStyle}>ПРИЁМ ЗАЯВОК</p>

          <button
            type="button"
            onClick={() =>
              void saveSettings({ enabled: !(settings?.enabled ?? true) })
            }
            style={{
              minHeight: 36,
              padding: '0 14px',
              border: '1px solid var(--app-border)',
              borderRadius: 10,
              background: 'transparent',
              color: settings?.enabled
                ? 'var(--app-text)'
                : 'var(--app-danger)',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {settings?.enabled ? 'Открыт' : 'Закрыт'}
          </button>
        </div>
      </div>

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
      ) : leads.length === 0 ? (
        <p style={{ color: 'var(--app-text-muted)', fontSize: 13 }}>
          Заявок пока нет.
        </p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={headStyle}>Кто</th>
                <th style={headStyle}>Телефон</th>
                <th style={headStyle}>Кто привёл</th>
                <th style={headStyle}>Состояние</th>
                <th style={headStyle}>Бонус</th>
                <th style={headStyle} />
              </tr>
            </thead>

            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id}>
                  <td style={cellStyle}>
                    {lead.name}

                    <span
                      style={{
                        display: 'block',
                        color: 'var(--app-text-muted)',
                        fontSize: 12,
                      }}
                    >
                      {(lead.kind === 'salon' ? 'салон' : 'мастер') +
                        (lead.salonName ? ' · ' + lead.salonName : '') +
                        (lead.city ? ' · ' + lead.city : '') +
                        ' · ' +
                        formatDate(lead.createdAt)}
                    </span>

                    {lead.note ? (
                      <span
                        style={{
                          display: 'block',
                          marginTop: 4,
                          color: 'var(--app-text-muted)',
                          fontSize: 12,
                          fontStyle: 'italic',
                        }}
                      >
                        {lead.note}
                      </span>
                    ) : null}
                  </td>

                  <td style={cellStyle}>{lead.phone}</td>

                  <td style={cellStyle}>
                    {lead.referrerName ?? 'сам'}

                    {lead.code ? (
                      <span
                        style={{
                          display: 'block',
                          color: 'var(--app-text-muted)',
                          fontSize: 12,
                        }}
                      >
                        {lead.code}
                      </span>
                    ) : null}
                  </td>

                  <td style={cellStyle}>{STATUS_LABEL[lead.status]}</td>

                  <td style={cellStyle}>
                    {lead.bonusAwardedAt ? (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                        }}
                      >
                        <Gift size={13} color="var(--app-accent)" />
                        {String(lead.bonusMessages) + ' + ' + String(lead.welcomeMessages)}
                      </span>
                    ) : lead.bonusPendingReason ? (
                      <span style={{ color: 'var(--app-danger)' }}>
                        {lead.bonusPendingReason}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>

                  <td style={cellStyle}>
                    <div
                      style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}
                    >
                      {NEXT_STATUS.filter(
                        (option) => option.value !== lead.status,
                      ).map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          disabled={busyId === lead.id}
                          onClick={() => void setStatus(lead, option.value)}
                          style={{
                            minHeight: 30,
                            padding: '0 10px',
                            border: '1px solid var(--app-border)',
                            borderRadius: 9,
                            background: 'transparent',
                            color: 'var(--app-text-muted)',
                            fontSize: 11,
                            fontWeight: 700,
                            whiteSpace: 'nowrap',
                            cursor: 'pointer',
                          }}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default LeadsPanel;
