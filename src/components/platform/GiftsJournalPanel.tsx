import { useEffect, useState } from 'react';
import { Gift, MessageSquare, CalendarPlus, AlertTriangle } from 'lucide-react';

import api from '../../api/api';

/**
 * Что раздали — журнал подарков и бонусов площадки.
 *
 * Экран сделан не для работы, а для памяти. Через два года вопрос «а
 * что мы вообще раздавали и кому» будет задан, и ответить на него
 * должна запись. Строки отсюда не удаляются никогда — ни рукой, ни
 * временем.
 *
 * Поэтому здесь нет ни одной кнопки. Журнал, в котором можно что-то
 * поправить, перестаёт быть журналом.
 *
 * Итог наверху — три числа, ради которых сюда чаще всего и заходят:
 * сколько подарков, сколько сообщений, сколько дней. Считаются они
 * здесь, из тех же строк, что и показаны: число, посчитанное отдельно
 * от списка, однажды разойдётся со списком.
 */

type Redemption = {
  id: string;
  promotionId: string;
  promotionName: string | null;
  target: {
    kind: 'salon' | 'master' | 'unknown';
    id: string | null;
    name: string | null;
  };
  gift: {
    days: number;
    messages: number;
  };
  /** Ложь — обещали, но не легло. Такую строку видно отдельно. */
  delivered: boolean;
  byUserName: string | null;
  createdAt: string;
};

const KIND_LABEL: Record<Redemption['target']['kind'], string> = {
  salon: 'Салон',
  master: 'Мастер',
  unknown: 'Непонятно кто',
};

function formatDate(value: string): string {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
}

function GiftsJournalPanel() {
  const [rows, setRows] = useState<Redemption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setIsLoading(true);

    try {
      const response = await api.get<Redemption[]>(
        '/platform-admin/promotion-redemptions',
      );

      setRows(response.data);
      setErrorMsg('');
    } catch {
      setErrorMsg('Не удалось загрузить журнал');
    } finally {
      setIsLoading(false);
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

  const totalMessages = rows.reduce((sum, row) => sum + row.gift.messages, 0);
  const totalDays = rows.reduce((sum, row) => sum + row.gift.days, 0);
  const undelivered = rows.filter((row) => !row.delivered).length;

  return (
    <div style={panelStyle}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 6,
        }}
      >
        <Gift size={19} color="var(--app-accent)" aria-hidden="true" />

        <h2 style={{ margin: 0, fontSize: 19 }}>Что раздали</h2>
      </div>

      <p
        style={{
          margin: '0 0 16px',
          color: 'var(--app-text-muted)',
          fontSize: 13,
          lineHeight: 1.6,
        }}
      >
        Каждый подарок и каждый бонус, выданный площадкой, — с первого
        дня. Строки отсюда не пропадают: этот список и есть память о том,
        что мы обещали и кому исполнили.
      </p>

      {errorMsg ? (
        <p style={{ margin: '0 0 12px', color: '#dc2626', fontSize: 13 }}>
          {errorMsg}
        </p>
      ) : null}

      {isLoading ? (
        <p style={{ margin: 0, color: 'var(--app-text-muted)', fontSize: 13 }}>
          Загружаем…
        </p>
      ) : null}

      {!isLoading && rows.length === 0 ? (
        <p style={{ margin: 0, color: 'var(--app-text-muted)', fontSize: 13 }}>
          Пока ничего не раздавали. Первая строка появится здесь сама — в
          ту секунду, когда кто-нибудь оплатит год.
        </p>
      ) : null}

      {rows.length > 0 ? (
        <>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 18,
              marginBottom: 16,
              padding: '12px 14px',
              border: '1px solid var(--app-border)',
              borderRadius: 14,
            }}
          >
            <div>
              <div
                style={{
                  color: 'var(--app-text-muted)',
                  fontSize: 11,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                }}
              >
                Подарков
              </div>

              <strong style={{ fontSize: 20 }}>{rows.length}</strong>
            </div>

            {totalMessages > 0 ? (
              <div>
                <div
                  style={{
                    color: 'var(--app-text-muted)',
                    fontSize: 11,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                  }}
                >
                  Сообщений
                </div>

                <strong style={{ fontSize: 20 }}>{totalMessages}</strong>
              </div>
            ) : null}

            {totalDays > 0 ? (
              <div>
                <div
                  style={{
                    color: 'var(--app-text-muted)',
                    fontSize: 11,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                  }}
                >
                  Дней
                </div>

                <strong style={{ fontSize: 20 }}>{totalDays}</strong>
              </div>
            ) : null}

            {undelivered > 0 ? (
              <div>
                <div
                  style={{
                    color: '#dc2626',
                    fontSize: 11,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                  }}
                >
                  Не легло
                </div>

                <strong style={{ fontSize: 20, color: '#dc2626' }}>
                  {undelivered}
                </strong>
              </div>
            ) : null}
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={headStyle}>Когда</th>
                  <th style={headStyle}>Кому</th>
                  <th style={headStyle}>Что досталось</th>
                  <th style={headStyle}>По какой акции</th>
                  <th style={headStyle}>Кто отметил</th>
                </tr>
              </thead>

              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td style={{ ...cellStyle, whiteSpace: 'nowrap' }}>
                      {formatDate(row.createdAt)}
                    </td>

                    <td style={cellStyle}>
                      <strong>{row.target.name ?? 'Без названия'}</strong>

                      <div
                        style={{
                          color: 'var(--app-text-muted)',
                          fontSize: 12,
                        }}
                      >
                        {KIND_LABEL[row.target.kind]}
                      </div>
                    </td>

                    <td style={cellStyle}>
                      {row.gift.messages > 0 ? (
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            marginRight: 10,
                          }}
                        >
                          <MessageSquare size={13} aria-hidden="true" />
                          {row.gift.messages}
                        </div>
                      ) : null}

                      {row.gift.days > 0 ? (
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                          }}
                        >
                          <CalendarPlus size={13} aria-hidden="true" />
                          {row.gift.days} дн.
                        </div>
                      ) : null}

                      {/*
                        Обещали, а не легло. Молчать об этом нельзя:
                        место в акции занято, салон ждёт подарка, и
                        закрыть это может только рука.
                      */}
                      {!row.delivered ? (
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            color: '#dc2626',
                            fontWeight: 700,
                          }}
                        >
                          <AlertTriangle size={13} aria-hidden="true" />
                          не легло
                        </div>
                      ) : null}
                    </td>

                    <td style={cellStyle}>
                      {row.promotionName ?? 'Акция удалена'}
                    </td>

                    <td style={cellStyle}>
                      {row.byUserName ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  );
}

export default GiftsJournalPanel;
