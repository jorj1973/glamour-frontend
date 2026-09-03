import { useEffect, useState } from 'react';
import { Check, Flag, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import api from '../../api/api';
import { getErrorKey } from '../../api/errorMessage';

type ChatReportStatus = 'open' | 'resolved' | 'dismissed';

type ChatReportItem = {
  id: string;
  status: ChatReportStatus;
  reason: string | null;
  text: string | null;
  imageUrl: string | null;
  reporterName: string;
  authorName: string;
  createdAt: string;
  handledAt: string | null;
};

/**
 * Жалобы на сообщения — раздел кабинета владельца платформы.
 *
 * Кнопка «Пожаловаться» работала с первого дня, а смотреть жалобы
 * было негде: они просто копились в базе. Кнопка, за которой ничего
 * нет, хуже отсутствующей — человек считает, что его услышали.
 *
 * Разбор идёт по копии сообщения, снятой в момент жалобы. Живую
 * переписку здесь не открыть: уговор был, что чужое не читает никто,
 * и владелец площадки — тоже никто в этом смысле. Копия при этом
 * переживает удаление сообщения автором, иначе жалоба стиралась бы
 * ровно тем, на кого её написали.
 */
function ChatReportsPanel() {
  const { t } = useTranslation();

  const [reports, setReports] = useState<ChatReportItem[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    void load(showAll);
  }, [showAll]);

  async function load(all: boolean) {
    setIsLoading(true);
    setErrorMsg('');

    try {
      const res = await api.get<ChatReportItem[]>(
        '/platform-admin/chat-reports',
        { params: { status: all ? 'all' : 'open' } },
      );

      setReports(res.data);
    } catch (error) {
      setErrorMsg(t(getErrorKey(error)));
    } finally {
      setIsLoading(false);
    }
  }

  async function resolve(
    report: ChatReportItem,
    status: 'resolved' | 'dismissed',
  ) {
    setBusyId(report.id);
    setErrorMsg('');

    try {
      const res = await api.patch<ChatReportItem>(
        '/platform-admin/chat-reports/' + report.id,
        { status },
      );

      const updated = res.data;

      /**
       * В списке открытых разобранной жалобе делать нечего.
       *
       * Оставить её там со сменившейся плашкой — значит собрать
       * экран, который никогда не пустеет, и по которому уже не
       * видно, осталось ли что-то неразобранное.
       */
      setReports((list) =>
        showAll
          ? list.map((item) => (item.id === updated.id ? updated : item))
          : list.filter((item) => item.id !== updated.id),
      );
    } catch (error) {
      setErrorMsg(t(getErrorKey(error)));
    } finally {
      setBusyId(null);
    }
  }

  function formatMoment(value: string) {
    return new Date(value).toLocaleString(undefined, {
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function statusLabel(status: ChatReportStatus) {
    if (status === 'resolved') {
      return t('chatReports.statusResolved');
    }

    if (status === 'dismissed') {
      return t('chatReports.statusDismissed');
    }

    return t('chatReports.statusOpen');
  }

  function renderReport(report: ChatReportItem) {
    const isBusy = busyId === report.id;
    const isOpen = report.status === 'open';

    return (
      <div
        key={report.id}
        style={{
          padding: '14px 15px',
          border: '1px solid var(--app-border)',
          borderRadius: 15,
          background: 'var(--app-panel)',
          opacity: isBusy ? 0.5 : 1,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 9,
            marginBottom: 9,
          }}
        >
          <span
            style={{
              padding: '3px 9px',
              borderRadius: 8,
              background: isOpen
                ? 'var(--app-accent)'
                : 'var(--app-input)',
              color: isOpen ? '#17151c' : 'var(--app-text-muted)',
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: 0.4,
            }}
          >
            {statusLabel(report.status)}
          </span>

          <span
            style={{
              color: 'var(--app-text-muted)',
              fontSize: 12,
            }}
          >
            {formatMoment(report.createdAt)}
          </span>
        </div>

        <p
          style={{
            margin: '0 0 10px',
            color: 'var(--app-text-muted)',
            fontSize: 12,
            lineHeight: 1.55,
          }}
        >
          {t('chatReports.reporter')}: <b>{report.reporterName || '—'}</b>
          {' · '}
          {t('chatReports.author')}: <b>{report.authorName || '—'}</b>
        </p>

        {/*
          Копия сообщения. Отступ слева с полосой — чтобы её нельзя
          было спутать с пояснением жалобщика: это разные голоса.
        */}
        {(report.text || report.imageUrl) && (
          <div
            style={{
              padding: '9px 12px',
              borderLeft: '3px solid var(--app-accent)',
              borderRadius: '0 10px 10px 0',
              background: 'var(--app-input)',
              marginBottom: 10,
            }}
          >
            {report.text && (
              <p
                style={{
                  margin: 0,
                  color: 'var(--app-text)',
                  fontSize: 13,
                  lineHeight: 1.55,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {report.text}
              </p>
            )}

            {report.imageUrl && (
              <a
                href={report.imageUrl}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'inline-block',
                  marginTop: report.text ? 8 : 0,
                }}
              >
                <img
                  src={report.imageUrl}
                  alt=""
                  style={{
                    display: 'block',
                    maxWidth: 180,
                    maxHeight: 180,
                    borderRadius: 10,
                  }}
                />
              </a>
            )}
          </div>
        )}

        <p
          style={{
            margin: '0 0 12px',
            color: 'var(--app-text)',
            fontSize: 13,
            lineHeight: 1.55,
            wordBreak: 'break-word',
          }}
        >
          {report.reason || t('chatReports.noReason')}
        </p>

        {isOpen && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              disabled={isBusy}
              onClick={() => void resolve(report, 'resolved')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                minHeight: 38,
                padding: '0 15px',
                border: 0,
                borderRadius: 12,
                background: 'var(--app-accent)',
                color: '#17151c',
                fontSize: 13,
                fontWeight: 700,
                cursor: isBusy ? 'default' : 'pointer',
              }}
            >
              <Check size={15} />
              {t('chatReports.resolve')}
            </button>

            <button
              type="button"
              disabled={isBusy}
              onClick={() => void resolve(report, 'dismissed')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                minHeight: 38,
                padding: '0 15px',
                border: '1px solid var(--app-border)',
                borderRadius: 12,
                background: 'transparent',
                color: 'var(--app-text-muted)',
                fontSize: 13,
                fontWeight: 700,
                cursor: isBusy ? 'default' : 'pointer',
              }}
            >
              <X size={15} />
              {t('chatReports.dismiss')}
            </button>
          </div>
        )}
      </div>
    );
  }

  const openCount = reports.filter((item) => item.status === 'open').length;

  return (
    <section
      style={{
        padding: '20px 18px',
        border: '1px solid var(--app-border)',
        borderRadius: 18,
        background: 'var(--app-panel)',
        marginBottom: 22,
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
        <Flag size={18} color="var(--app-accent)" />

        <strong style={{ color: 'var(--app-text)', fontSize: 16 }}>
          {t('chatReports.title')}
        </strong>

        {openCount > 0 && (
          <span
            style={{
              minWidth: 22,
              padding: '2px 7px',
              borderRadius: 11,
              background: 'var(--app-accent)',
              color: '#17151c',
              fontSize: 11,
              fontWeight: 800,
              textAlign: 'center',
            }}
          >
            {openCount}
          </span>
        )}
      </div>

      <p
        style={{
          color: 'var(--app-text-muted)',
          fontSize: 13,
          lineHeight: 1.55,
          margin: '0 0 14px',
        }}
      >
        {t('chatReports.hint')}
      </p>

      <button
        type="button"
        onClick={() => setShowAll((value) => !value)}
        style={{
          minHeight: 38,
          padding: '0 15px',
          border: '1px solid var(--app-border)',
          borderRadius: 12,
          background: 'transparent',
          color: 'var(--app-text-muted)',
          fontSize: 13,
          fontWeight: 700,
          cursor: 'pointer',
          marginBottom: 14,
        }}
      >
        {showAll ? t('chatReports.showOpen') : t('chatReports.showAll')}
      </button>

      {errorMsg && (
        <p
          style={{
            color: 'var(--app-danger-soft)',
            fontSize: 13,
            fontWeight: 700,
            margin: '0 0 12px',
          }}
        >
          {errorMsg}
        </p>
      )}

      {isLoading ? (
        <p
          style={{
            color: 'var(--app-text-muted)',
            fontSize: 13,
            lineHeight: 1.55,
            margin: 0,
          }}
        >
          …
        </p>
      ) : reports.length === 0 ? (
        <p
          style={{
            color: 'var(--app-text-muted)',
            fontSize: 13,
            lineHeight: 1.55,
            margin: 0,
          }}
        >
          {t('chatReports.empty')}
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {reports.map(renderReport)}
        </div>
      )}
    </section>
  );
}

export default ChatReportsPanel;
