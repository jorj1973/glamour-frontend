import { useEffect, useState } from 'react';
import { Building2, Check, Phone } from 'lucide-react';

import api from '../../api/api';

/**
 * Заявки на Enterprise — раздел кабинета владельца площадки.
 *
 * Сюда падает то, что написала сеть салонов на странице `#enterprise`.
 * Это не регистрация и не выбор тарифа: цена сети считается голосом, и
 * заявка — начало разговора.
 *
 * Два числа — адреса и мастера — стоят первыми в строке нарочно: по ним
 * видно, о чём разговор, не открывая ничего.
 *
 * Статус двигает рука. Программа не знает, состоялся ли разговор, и
 * притворяться, будто знает, не должна.
 *
 * Текст по-русски прямо в разметке, без словаря, — как в соседних
 * панелях этого кабинета: экран одного человека.
 */

type EnterpriseRequest = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  salonName: string;
  city: string | null;
  locations: number;
  masters: number;
  note: string | null;
  status: 'new' | 'answered' | 'joined' | 'rejected';
  createdAt: string;
};

const STATUS_LABEL: Record<EnterpriseRequest['status'], string> = {
  new: 'Ждёт ответа',
  answered: 'Ответил',
  joined: 'Подключили',
  rejected: 'Не наш случай',
};

const NEXT_STATUS: { value: EnterpriseRequest['status']; label: string }[] = [
  { value: 'answered', label: 'Ответил' },
  { value: 'joined', label: 'Подключили' },
  { value: 'rejected', label: 'Не наш случай' },
];

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

function EnterprisePanel() {
  const [requests, setRequests] = useState<EnterpriseRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setIsLoading(true);

    try {
      const response = await api.get<EnterpriseRequest[]>(
        '/platform-admin/enterprise-requests',
      );

      setRequests(response.data);
      setErrorMsg('');
    } catch {
      setErrorMsg('Не удалось загрузить заявки');
    } finally {
      setIsLoading(false);
    }
  }

  async function setStatus(
    request: EnterpriseRequest,
    status: EnterpriseRequest['status'],
  ) {
    setBusyId(request.id);

    try {
      await api.patch('/platform-admin/enterprise-requests/' + request.id, {
        status,
      });

      await load();
    } catch {
      setErrorMsg('Не удалось изменить заявку');
    } finally {
      setBusyId(null);
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

  const waiting = requests.filter((request) => request.status === 'new').length;

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
        <Building2 size={19} color="var(--app-accent)" aria-hidden="true" />

        <h2 style={{ margin: 0, fontSize: 19 }}>Заявки Enterprise</h2>
      </div>

      <p
        style={{
          margin: '0 0 16px',
          color: 'var(--app-text-muted)',
          fontSize: 13,
          lineHeight: 1.6,
        }}
      >
        Сети салонов, которые написали со страницы Enterprise. Цену считаешь
        ты — программа только принесла заявку.
        {waiting > 0 ? ' Ждут ответа: ' + String(waiting) + '.' : ''}
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

      {!isLoading && requests.length === 0 ? (
        <p style={{ margin: 0, color: 'var(--app-text-muted)', fontSize: 13 }}>
          Заявок пока нет. Они появятся здесь, как только сеть напишет со
          страницы Enterprise.
        </p>
      ) : null}

      {requests.length > 0 ? (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={headStyle}>Сеть</th>
                <th style={headStyle}>Адреса</th>
                <th style={headStyle}>Мастера</th>
                <th style={headStyle}>Кто пишет</th>
                <th style={headStyle}>Связь</th>
                <th style={headStyle}>Пришла</th>
                <th style={headStyle}>Состояние</th>
              </tr>
            </thead>

            <tbody>
              {requests.map((request) => (
                <tr key={request.id}>
                  <td style={cellStyle}>
                    <strong>{request.salonName}</strong>

                    {request.city ? (
                      <div
                        style={{
                          color: 'var(--app-text-muted)',
                          fontSize: 12,
                        }}
                      >
                        {request.city}
                      </div>
                    ) : null}

                    {request.note ? (
                      <div
                        style={{
                          marginTop: 4,
                          color: 'var(--app-text-muted)',
                          fontSize: 12,
                          lineHeight: 1.5,
                        }}
                      >
                        {request.note}
                      </div>
                    ) : null}
                  </td>

                  <td style={{ ...cellStyle, fontWeight: 700 }}>
                    {request.locations}
                  </td>

                  <td style={{ ...cellStyle, fontWeight: 700 }}>
                    {request.masters}
                  </td>

                  <td style={cellStyle}>{request.name}</td>

                  <td style={cellStyle}>
                    <a
                      href={'tel:' + request.phone}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        color: 'var(--app-text)',
                        textDecoration: 'none',
                      }}
                    >
                      <Phone size={14} aria-hidden="true" />
                      {request.phone}
                    </a>

                    {request.email ? (
                      <div style={{ marginTop: 4 }}>
                        <a
                          href={'mailto:' + request.email}
                          style={{
                            color: 'var(--app-text-muted)',
                            fontSize: 12,
                            textDecoration: 'none',
                          }}
                        >
                          {request.email}
                        </a>
                      </div>
                    ) : null}
                  </td>

                  <td style={{ ...cellStyle, whiteSpace: 'nowrap' }}>
                    {formatDate(request.createdAt)}
                  </td>

                  <td style={cellStyle}>
                    <div
                      style={{
                        marginBottom: 6,
                        color:
                          request.status === 'new'
                            ? 'var(--app-accent)'
                            : 'var(--app-text-muted)',
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      {STATUS_LABEL[request.status]}
                    </div>

                    <div
                      style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}
                    >
                      {NEXT_STATUS.filter(
                        (next) => next.value !== request.status,
                      ).map((next) => (
                        <button
                          key={next.value}
                          type="button"
                          disabled={busyId === request.id}
                          onClick={() => void setStatus(request, next.value)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            padding: '5px 9px',
                            border: '1px solid var(--app-border)',
                            borderRadius: 9,
                            background: 'transparent',
                            color: 'var(--app-text-muted)',
                            cursor:
                              busyId === request.id ? 'wait' : 'pointer',
                            fontSize: 11,
                            fontWeight: 700,
                          }}
                        >
                          <Check size={12} aria-hidden="true" />
                          {next.label}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

export default EnterprisePanel;
