import { useTranslation } from 'react-i18next';

import type { MasterStatement, StatementRow } from '../api/payouts';

type Props = {
  statement: MasterStatement;

  /** Дан — колонка «деньги взял» становится переключателем. */
  onToggleCollector?: (row: StatementRow) => void;
  busyPaymentId?: string | null;
};

const money = (value: number | null) =>
  value === null ? '—' : value.toFixed(2);

function formatDay(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const day = `${date.getDate()}`.padStart(2, '0');
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const hours = `${date.getHours()}`.padStart(2, '0');
  const minutes = `${date.getMinutes()}`.padStart(2, '0');

  return `${day}.${month} ${hours}:${minutes}`;
}

/**
 * Ведомость мастера за неделю — одна и та же таблица в обоих кабинетах.
 *
 * Владелец и мастер обязаны видеть буквально одно и то же: в этом весь
 * смысл ведомости. Два разных вида — два разных повода для спора.
 */
function StatementTable({
  statement,
  onToggleCollector,
  busyPaymentId,
}: Props) {
  const { t } = useTranslation();

  if (statement.rows.length === 0) {
    return (
      <p style={{ color: 'var(--app-text-muted)', fontSize: 13 }}>
        {t('payouts.noVisits')}
      </p>
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table
        style={{
          width: '100%',
          minWidth: 520,
          borderCollapse: 'collapse',
          fontSize: 13,
        }}
      >
        <thead>
          <tr style={{ color: 'var(--app-text-muted)', fontSize: 12 }}>
            <th style={cellStyle('left')}>{t('payouts.date')}</th>
            <th style={cellStyle('left')}>{t('payouts.service')}</th>
            <th style={cellStyle('right')}>{t('payouts.paid')}</th>
            <th style={cellStyle('right')}>%</th>
            <th style={cellStyle('right')}>{t('payouts.toMaster')}</th>
            <th style={cellStyle('right')}>{t('payouts.toSalon')}</th>
            <th style={cellStyle('left')}>{t('payouts.collectedBy')}</th>
          </tr>
        </thead>

        <tbody>
          {statement.rows.map((row) => (
            <tr
              key={row.paymentId}
              style={{
                color: 'var(--app-text)',
                borderTop: '1px solid rgba(var(--app-ink-rgb),0.06)',
              }}
            >
              <td style={cellStyle('left')}>{formatDay(row.paidAt)}</td>
              <td style={cellStyle('left')}>{row.serviceName ?? '—'}</td>
              <td style={cellStyle('right')}>{money(row.amount)}</td>
              <td style={cellStyle('right')}>
                {row.percent === null ? '—' : row.percent}
              </td>
              <td style={cellStyle('right')}>{money(row.masterShare)}</td>
              <td style={cellStyle('right')}>{money(row.salonShare)}</td>
              <td style={cellStyle('left')}>
                {onToggleCollector ? (
                  <button
                    type="button"
                    className="collector-chip"
                    disabled={busyPaymentId === row.paymentId}
                    onClick={() => onToggleCollector(row)}
                    title={t('payouts.collectedByHint')}
                  >
                    {row.collectedBy === 'master'
                      ? t('payouts.byMaster')
                      : t('payouts.bySalon')}
                  </button>
                ) : (
                  <span style={{ color: 'var(--app-text-muted)' }}>
                    {row.collectedBy === 'master'
                      ? t('payouts.byMaster')
                      : t('payouts.bySalon')}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>

        <tfoot>
          <tr
            style={{
              color: 'var(--app-text)',
              fontWeight: 700,
              borderTop: '1px solid rgba(var(--app-ink-rgb),0.16)',
            }}
          >
            <td style={cellStyle('left')} colSpan={2}>
              {t('payouts.total')}
            </td>
            <td style={cellStyle('right')}>{money(statement.totals.amount)}</td>
            <td style={cellStyle('right')} />
            <td style={cellStyle('right')}>
              {money(statement.totals.masterShare)}
            </td>
            <td style={cellStyle('right')}>
              {money(statement.totals.salonShare)}
            </td>
            <td style={cellStyle('left')} />
          </tr>
        </tfoot>
      </table>

      {statement.totals.withoutPercent > 0 && (
        <p style={{ color: 'var(--app-danger)', fontSize: 12, marginTop: 8 }}>
          {t('payouts.withoutPercent', {
            count: statement.totals.withoutPercent,
          })}
        </p>
      )}

      <SettlementSummary statement={statement} />

      <style>{`
        .collector-chip {
          padding: 3px 9px;
          border: 1px solid rgba(var(--app-ink-rgb),0.14);
          border-radius: 8px;
          background: rgba(var(--app-ink-rgb),0.05);
          color: var(--app-text);
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
        }
        .collector-chip:disabled { opacity: 0.5; cursor: default; }
      `}</style>
    </div>
  );
}

/**
 * Итог недели одной строкой.
 *
 * Всё, что выше, объясняет, откуда взялось число. Здесь само число — и
 * ради него ведомость открывают в конце недели. Оба кабинета показывают
 * его одинаково: разный вид — это второй повод для спора.
 */
function SettlementSummary({ statement }: { statement: MasterStatement }) {
  const { t } = useTranslation();

  const { totals, settlement } = statement;
  const balance = totals.balance;

  const line =
    balance > 0
      ? t('payouts.salonPays', { amount: balance.toFixed(2) })
      : balance < 0
        ? t('payouts.masterPays', { amount: Math.abs(balance).toFixed(2) })
        : t('payouts.even');

  return (
    <div
      style={{
        marginTop: 14,
        padding: '12px 14px',
        borderRadius: 13,
        border: '1px solid rgba(var(--app-ink-rgb),0.1)',
        background: 'rgba(var(--app-ink-rgb),0.04)',
      }}
    >
      <div
        style={{
          color: 'var(--app-text-muted)',
          fontSize: 12,
          marginBottom: 6,
        }}
      >
        {t('payouts.bySalon')}: {totals.collectedBySalon.toFixed(2)} ·{' '}
        {t('payouts.byMaster')}: {totals.collectedByMaster.toFixed(2)}
      </div>

      <div
        style={{ color: 'var(--app-text)', fontSize: 15, fontWeight: 700 }}
      >
        {line}
      </div>

      <div
        style={{
          marginTop: 6,
          color: settlement ? 'var(--app-text-muted)' : 'var(--app-danger)',
          fontSize: 12,
        }}
      >
        {settlement
          ? t('payouts.settledOn', {
              date: new Date(settlement.settledAt).toLocaleDateString(),
              amount: Math.abs(settlement.balance).toFixed(2),
            })
          : t('payouts.notSettled')}
      </div>
    </div>
  );
}

function cellStyle(align: 'left' | 'right') {
  return {
    padding: '9px 8px',
    textAlign: align,
    whiteSpace: 'nowrap' as const,
  };
}

export default StatementTable;
