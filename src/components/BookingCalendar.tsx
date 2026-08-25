import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import api from '../api/api';

/** На сколько месяцев вперёд можно листать. */
const MONTHS_AHEAD = 3;

type CalendarDay = {
    date: string;
    isWorkingDay: boolean;
    loadPercent: number;
    loadStatus: 'free' | 'busy' | 'full';
};

type Props = {
    masterProfileId: string;
    value: string;
    onChange: (date: string) => void;
};

/** Язык для названий месяцев и дней. */
function dateLocale(lang: string): string {
    if (lang.startsWith('ro')) return 'ro-RO';
    if (lang.startsWith('en')) return 'en-GB';

    return 'ru-RU';
}

function toKey(year: number, month: number, day: number): string {
    return (
        year +
        '-' +
        String(month).padStart(2, '0') +
        '-' +
        String(day).padStart(2, '0')
    );
}

/**
 * Цвет дня по загруженности.
 *
 * Свободный день не выделяем: пестрота мешает разглядеть занятые.
 * Чем плотнее записан день, тем насыщеннее оранжевый; полный —
 * красный и не нажимается.
 */
function dayColors(day: CalendarDay, isSelected: boolean) {
    if (isSelected) {
        return {
            background: 'var(--app-accent)',
            color: 'var(--app-on-accent, #241200)',
            border: '1px solid var(--app-accent)',
        };
    }

    if (!day.isWorkingDay) {
        return {
            background: 'transparent',
            color: 'var(--app-text-muted)',
            border: '1px solid transparent',
        };
    }

    if (day.loadStatus === 'full') {
        return {
            background: 'rgba(255, 96, 128, 0.14)',
            color: '#c2415e',
            border: '1px solid rgba(255, 96, 128, 0.3)',
        };
    }

    if (day.loadStatus === 'busy') {
        // Плотность оттенка растёт вместе с загруженностью:
        // 60% и 84% должны отличаться на глаз.
        const strength = 0.1 + ((day.loadPercent - 60) / 25) * 0.22;

        return {
            background: 'rgba(240, 160, 40, ' + strength.toFixed(2) + ')',
            color: 'var(--app-text)',
            border: '1px solid rgba(240, 160, 40, 0.35)',
        };
    }

    return {
        background: 'rgba(var(--app-accent-rgb), 0.16)',
        color: 'var(--app-text)',
        border: '1px solid rgba(var(--app-accent-rgb), 0.4)',
    };
}

function BookingCalendar({ masterProfileId, value, onChange }: Props) {
    const { t, i18n } = useTranslation();

    const today = useMemo(() => new Date(), []);

    const [year, setYear] = useState(today.getFullYear());
    const [month, setMonth] = useState(today.getMonth() + 1);
    const [days, setDays] = useState<CalendarDay[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        let cancelled = false;

        async function load() {
            setIsLoading(true);

            try {
                const response = await api.get<CalendarDay[]>(
                    '/masters/public-calendar/' + masterProfileId,
                    { params: { year, month } },
                );

                if (!cancelled) {
                    setDays(response.data);
                }
            } catch {
                if (!cancelled) {
                    setDays([]);
                }
            } finally {
                if (!cancelled) {
                    setIsLoading(false);
                }
            }
        }

        void load();

        return () => {
            cancelled = true;
        };
    }, [masterProfileId, year, month]);

    const byDate = useMemo(() => {
        const map = new Map<string, CalendarDay>();

        for (const day of days) {
            map.set(day.date, day);
        }

        return map;
    }, [days]);

    /**
     * Пустые клетки перед первым числом, чтобы столбцы совпадали
     * с днями недели. Неделя начинается с понедельника.
     */
    const leading = useMemo(() => {
        const first = new Date(year, month - 1, 1).getDay();

        return (first + 6) % 7;
    }, [year, month]);

    const daysInMonth = useMemo(
        () => new Date(year, month, 0).getDate(),
        [year, month],
    );

    const locale = dateLocale(i18n.language);

    const monthLabel = new Date(year, month - 1, 1).toLocaleDateString(locale, {
        month: 'long',
        year: 'numeric',
    });

    const todayKey = toKey(
        today.getFullYear(),
        today.getMonth() + 1,
        today.getDate(),
    );

    const limit = new Date(
        today.getFullYear(),
        today.getMonth() + MONTHS_AHEAD,
        1,
    );

    const canGoBack =
        year > today.getFullYear() ||
        (year === today.getFullYear() && month > today.getMonth() + 1);

    const canGoForward =
        new Date(year, month - 1, 1).getTime() < limit.getTime();

    function shift(step: number) {
        const next = new Date(year, month - 1 + step, 1);

        setYear(next.getFullYear());
        setMonth(next.getMonth() + 1);
    }

    const weekdays = useMemo(() => {
        const result: string[] = [];

        // 5 января 2026 — понедельник, от него и берём названия.
        for (let i = 0; i < 7; i += 1) {
            result.push(
                new Date(2026, 0, 5 + i)
                    .toLocaleDateString(locale, { weekday: 'short' })
                    .replace('.', ''),
            );
        }

        return result;
    }, [locale]);

    return (
        <div
            style={{
                padding: 14,
                borderRadius: 16,
                border: '1px solid var(--app-border)',
                background: 'var(--app-panel)',
            }}
        >
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 12,
                }}
            >
                <button
                    type="button"
                    onClick={() => shift(-1)}
                    disabled={!canGoBack}
                    aria-label={t('booking.prevMonth')}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 38,
                        height: 38,
                        border: 0,
                        borderRadius: 11,
                        background: 'transparent',
                        color: canGoBack
                            ? 'var(--app-text)'
                            : 'var(--app-text-muted)',
                        opacity: canGoBack ? 1 : 0.35,
                        cursor: canGoBack ? 'pointer' : 'default',
                    }}
                >
                    <ChevronLeft size={19} />
                </button>

                <strong
                    style={{
                        color: 'var(--app-text)',
                        fontSize: 15,
                        textTransform: 'capitalize',
                    }}
                >
                    {monthLabel}
                </strong>

                <button
                    type="button"
                    onClick={() => shift(1)}
                    disabled={!canGoForward}
                    aria-label={t('booking.nextMonth')}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 38,
                        height: 38,
                        border: 0,
                        borderRadius: 11,
                        background: 'transparent',
                        color: canGoForward
                            ? 'var(--app-text)'
                            : 'var(--app-text-muted)',
                        opacity: canGoForward ? 1 : 0.35,
                        cursor: canGoForward ? 'pointer' : 'default',
                    }}
                >
                    <ChevronRight size={19} />
                </button>
            </div>

            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(7, 1fr)',
                    gap: 4,
                    marginBottom: 6,
                }}
            >
                {weekdays.map((label) => (
                    <span
                        key={label}
                        style={{
                            color: 'var(--app-text-muted)',
                            fontSize: 11,
                            fontWeight: 700,
                            textAlign: 'center',
                            textTransform: 'uppercase',
                        }}
                    >
                        {label}
                    </span>
                ))}
            </div>

            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(7, 1fr)',
                    gap: 4,
                    opacity: isLoading ? 0.5 : 1,
                    transition: 'opacity 0.2s ease',
                }}
            >
                {Array.from({ length: leading }).map((_, index) => (
                    <span key={'empty-' + index} />
                ))}

                {Array.from({ length: daysInMonth }).map((_, index) => {
                    const number = index + 1;
                    const key = toKey(year, month, number);
                    const day = byDate.get(key);

                    const isPast = key < todayKey;

                    // Закрытые дни показываем, но нажать нельзя:
                    // клиент видит, что день существует и занят,
                    // а не гадает, почему числа пропущены.
                    const isDisabled =
                        isPast ||
                        !day ||
                        !day.isWorkingDay ||
                        day.loadStatus === 'full';

                    const colors = dayColors(
                        day ?? {
                            date: key,
                            isWorkingDay: false,
                            loadPercent: 0,
                            loadStatus: 'free',
                        },
                        value === key,
                    );

                    return (
                        <button
                            key={key}
                            type="button"
                            disabled={isDisabled}
                            onClick={() => onChange(key)}
                            style={{
                                minHeight: 42,
                                borderRadius: 11,
                                fontSize: 14,
                                fontWeight: 700,
                                cursor: isDisabled ? 'default' : 'pointer',
                                opacity: isPast ? 0.25 : 1,
                                ...colors,
                            }}
                        >
                            {number}
                        </button>
                    );
                })}
            </div>

            {/* Пояснение к цветам: без него оранжевый и красный
                читаются как украшение, а не как занятость. */}
            <div
                style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 14,
                    marginTop: 14,
                    color: 'var(--app-text-muted)',
                    fontSize: 12,
                }}
            >
                {[
                    { color: 'var(--app-input)', key: 'legendFree' },
                    { color: 'rgba(240, 160, 40, 0.28)', key: 'legendBusy' },
                    { color: 'rgba(255, 96, 128, 0.24)', key: 'legendFull' },
                ].map((item) => (
                    <span
                        key={item.key}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                        }}
                    >
                        <span
                            style={{
                                width: 11,
                                height: 11,
                                borderRadius: 4,
                                background: item.color,
                                border: '1px solid var(--app-border)',
                            }}
                        />
                        {t('booking.' + item.key)}
                    </span>
                ))}
            </div>
        </div>
    );
}

export default BookingCalendar;
