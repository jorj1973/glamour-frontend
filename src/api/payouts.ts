import api from './api';

export type StatementRow = {
    paymentId: string;
    paidAt: string;
    serviceName: string | null;
    amount: number;
    percent: number | null;
    masterShare: number | null;
    salonShare: number | null;
    paymentMethod: string;
};

export type StatementTotals = {
    count: number;
    amount: number;
    masterShare: number;
    salonShare: number;
    withoutPercent: number;
};

export type MasterStatement = {
    masterProfileId: string;
    masterName: string;
    weekStart: string;
    weekEnd: string;
    rows: StatementRow[];
    totals: StatementTotals;
};

/** Понедельник той недели, в которую попала дата, как YYYY-MM-DD. */
export function mondayOf(date: Date): string {
    const monday = new Date(date);

    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));

    return isoDate(monday);
}

export function shiftWeek(weekStart: string, direction: -1 | 1): string {
    const [year, month, day] = weekStart.split('-').map(Number);
    const date = new Date(year, month - 1, day);

    date.setDate(date.getDate() + direction * 7);

    return isoDate(date);
}

function isoDate(date: Date): string {
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');

    return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * Ведомость файлом.
 *
 * Ссылкой это не скачать: маршрут под токеном, а токен в заголовке.
 * Поэтому файл берётся обычным запросом и отдаётся браузеру как Blob.
 */
export async function downloadStatement(
    salonId: string,
    weekStart: string,
    masterProfileId: string | null,
): Promise<void> {
    const response = await api.get<Blob>('/payouts/week.csv', {
        params: {
            salonId,
            weekStart,
            ...(masterProfileId ? { masterProfileId } : {}),
        },
        responseType: 'blob',
    });

    const url = URL.createObjectURL(
        new Blob([response.data], { type: 'text/csv;charset=utf-8' }),
    );

    const link = document.createElement('a');

    link.href = url;
    link.download = masterProfileId
        ? `payout-${weekStart}.csv`
        : `payouts-${weekStart}.csv`;

    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}
