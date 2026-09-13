import { useTranslation } from 'react-i18next';

import type { MasterStatement } from '../api/payouts';

type Props = {
  statement: MasterStatement;
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
function StatementTable({ statement }: Props) {
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
