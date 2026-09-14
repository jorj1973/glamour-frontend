import api from './api';

/** Кто физически взял деньги у клиента. */
export type PaymentCollector = 'salon' | 'master';

export type StatementRow = {
    paymentId: string;
    paidAt: string;
    serviceName: string | null;
    amount: number;
    percent: number | null;
    masterShare: number | null;
    salonShare: number | null;
    paymentMethod: string;
    collectedBy: PaymentCollector;
};

export type StatementTotals = {
    count: number;
    amount: number;
    masterShare: number;
    salonShare: number;
    withoutPercent: number;
    collectedBySalon: number;
    collectedByMaster: number;
    salonOwesMaster: number;
    masterOwesSalon: number;

    /** Больше нуля — платит салон, меньше — платит мастер. */
    balance: number;
};

export type SettlementMark = {
    settledAt: string;
    salonOwesMaster: number;
    masterOwesSalon: number;
    balance: number;
    visits: number;
    settledByUserId: string | null;
    note: string | null;
};

export type MasterStatement = {
    masterProfileId: string;
    masterName: string;
    weekStart: string;
    weekEnd: string;
    rows: StatementRow[];
    totals: StatementTotals;
    settlement: SettlementMark | null;
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

/**
 * Кто взял деньги по визиту.
 *
 * Меняют владелец и сам мастер: наличные берут у кресла, и если это может
 * отметить только владелец, отметка не ставится вовсе. В журнале салона
 * остаётся, кто и когда её поменял.
 */
export async function setCollectedBy(
    salonId: string,
    paymentId: string,
    collectedBy: PaymentCollector,
): Promise<void> {
    await api.put('/payouts/collected-by', {
        salonId,
        paymentId,
        collectedBy,
    });
}

/** Закрыть неделю. Суммы считает сервер — здесь их нет намеренно. */
export async function settleWeek(
    salonId: string,
    masterProfileId: string,
    weekStart: string,
): Promise<SettlementMark> {
    const response = await api.post<SettlementMark>('/payouts/settle', {
        salonId,
        masterProfileId,
        weekStart,
    });

    return response.data;
}

export async function revokeSettlement(
    salonId: string,
    masterProfileId: string,
    weekStart: string,
): Promise<void> {
    await api.post('/payouts/settle/revoke', {
        salonId,
        masterProfileId,
        weekStart,
    });
}
