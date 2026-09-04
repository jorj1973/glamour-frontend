import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarDays, Scissors, Trash2, UserRound } from 'lucide-react';

import api from '../api/api';
import { bookingUrl, readLastSalon } from '../lastSalon';

const STORAGE_KEY = 'glamour_postponed';

type Postponed = {
    serviceId: string;
    serviceName: string;
    masterProfileId: string;
    masterName: string;
    date: string;
    startTime: string;
    savedAt: string;

    /** Занято ли выбранное время. Проверяем при открытии. */
    taken?: boolean;
};

/** Язык для дат. */
function dateLocale(lang: string): string {
    if (lang.startsWith('ro')) return 'ro-RO';
    if (lang.startsWith('en')) return 'en-GB';

    return 'ru-RU';
}

function read(): Postponed[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);

        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

function write(items: Postponed[]) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function PostponedList() {
    const { t, i18n } = useTranslation();

    // Куда возвращаться, чтобы завершить отложенную запись.
    // Раньше сюда подставлялся пустой код и человек попадал в тупик.
    const lastSalon = readLastSalon();

    const [items, setItems] = useState<Postponed[]>([]);
    const [notice, setNotice] = useState(false);

    useEffect(() => {
        const stored = read();

        // Прошедшее откладывать больше нечего.
        const actual = stored.filter(
            (item) => new Date(item.startTime).getTime() > Date.now(),
        );

        setItems(actual);

        if (actual.length !== stored.length) {
            write(actual);
        }

        /**
         * Проверяем, свободно ли ещё выбранное время.
         *
         * Отсрочка его не держит, поэтому клиент должен увидеть
         * занятость до того, как соберётся подтверждать.
         */
        async function check() {
            const checked = await Promise.all(
                actual.map(async (item) => {
                    try {
                        const response = await api.post<{ startTime: string }[]>(
                            '/appointments/available-slots',
                            {
                                masterProfileId: item.masterProfileId,
                                date: item.date,
                                slotMinutes: 30,
                            },
                        );

                        const free = response.data.some(
                            (slot) => slot.startTime === item.startTime,
                        );

                        return { ...item, taken: !free };
                    } catch {
                        return item;
                    }
                }),
            );

            setItems(checked);
        }

        if (actual.length > 0) {
            void check();
        }
    }, []);

    function remove(startTime: string) {
        const next = items.filter((item) => item.startTime !== startTime);

        setItems(next);
        write(next);
    }

    if (items.length === 0) {
        return (
            <p
                style={{
                    color: 'var(--app-text-muted)',
                    fontSize: 14,
                    lineHeight: 1.6,
                }}
            >
                {t('clientCabinet.postponedEmpty')}
            </p>
        );
    }

    const locale = dateLocale(i18n.language);

    return (
        <>
            {/* Мигание нужно, чтобы отложенное не забылось: время
                не держится, и чем дольше клиент тянет, тем выше
                вероятность его потерять. */}
            <style>{`
@keyframes glamour-postponed-pulse {
  from {
    border-color: rgba(255, 96, 128, 0.3);
    box-shadow: 0 0 0 0 rgba(255, 96, 128, 0);
  }

  to {
    border-color: rgba(255, 96, 128, 0.85);
    box-shadow: 0 0 0 3px rgba(255, 96, 128, 0.12);
  }
}
`}</style>

            <div style={{ display: 'grid', gap: 12 }}>
                {items.map((item) => (
                    <article
                        key={item.startTime}
                        style={{
                            position: 'relative',
                            padding: 16,
                            borderRadius: 16,
                            border: '1px solid rgba(255, 96, 128, 0.3)',
                            background: item.taken
                                ? 'rgba(255, 96, 128, 0.14)'
                                : 'var(--app-panel)',
                            animation: item.taken
                                ? undefined
                                : 'glamour-postponed-pulse 1.1s ease-in-out infinite alternate',
                        }}
                    >
                        <button
                            type="button"
                            onClick={() => remove(item.startTime)}
                            aria-label={t('clientCabinet.postponedDrop')}
                            style={{
                                position: 'absolute',
                                top: 12,
                                right: 12,
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: 32,
                                height: 32,
                                border: 0,
                                borderRadius: 10,
                                background: 'transparent',
                                color: 'var(--app-text-muted)',
                                cursor: 'pointer',
                            }}
                        >
                            <Trash2 size={16} />
                        </button>

                        <p
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 7,
                                margin: 0,
                                color: 'var(--app-text)',
                                fontSize: 15,
                                fontWeight: 700,
                            }}
                        >
                            <CalendarDays size={15} color="var(--app-accent)" />
                            {new Date(item.startTime).toLocaleDateString(locale, {
                                day: 'numeric',
                                month: 'long',
                            })}
                            , {new Date(item.startTime).toLocaleTimeString(locale, {
                                hour: '2-digit',
                                minute: '2-digit',
                            })}
                        </p>

                        <p
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 7,
                                margin: '8px 0 0',
                                color: 'var(--app-text-muted)',
                                fontSize: 13,
                            }}
                        >
                            <Scissors size={13} color="var(--app-accent)" />
                            {item.serviceName}
                        </p>

                        <p
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 7,
                                margin: '4px 0 0',
                                color: 'var(--app-text-muted)',
                                fontSize: 13,
                            }}
                        >
                            <UserRound size={13} color="var(--app-accent)" />
                            {item.masterName}
                        </p>

                        {item.taken ? (
                            <>
                                <p
                                    style={{
                                        margin: '14px 0 0',
                                        color: '#c2415e',
                                        fontSize: 13,
                                        fontWeight: 700,
                                    }}
                                >
                                    {t('clientCabinet.postponedTaken')}
                                </p>

                                <button
                                    type="button"
                                    onClick={() => setNotice(true)}
                                    style={{
                                        width: '100%',
                                        minHeight: 44,
                                        marginTop: 12,
                                        borderRadius: 13,
                                        border: '1px solid rgba(255, 96, 128, 0.45)',
                                        background: 'rgba(255, 96, 128, 0.12)',
                                        color: '#c2415e',
                                        fontSize: 14,
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                    }}
                                >
                                    {t('clientCabinet.postponedWhy')}
                                </button>
                            </>
                        ) : (
                            lastSalon ? (
                                <a
                                    href={bookingUrl(
                                        lastSalon.identifier,
                                    )}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        minHeight: 44,
                                        marginTop: 14,
                                        borderRadius: 13,
                                        background: 'var(--app-accent)',
                                        color: 'var(--app-bg)',
                                        fontSize: 14,
                                        fontWeight: 800,
                                        textDecoration: 'none',
                                    }}
                                >
                                    {t('clientCabinet.postponedFinish')}
                                </a>
                            ) : (
                                // Ссылку салона забыли — но пустой адрес
                                // вместо неё уводил в тупик, поэтому здесь
                                // подсказка, а не кнопка в никуда.
                                <p
                                    style={{
                                        margin: '14px 0 0',
                                        color: 'var(--app-text-muted)',
                                        fontSize: 13,
                                        lineHeight: 1.5,
                                    }}
                                >
                                    {t('clientCabinet.noLink')}
                                </p>
                            )
                        )}
                    </article>
                ))}
            </div>

            {notice && (
                <div
                    onClick={() => setNotice(false)}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 1000,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 20,
                        background: 'rgba(0, 0, 0, 0.6)',
                    }}
                >
                    <div
                        onClick={(event) => event.stopPropagation()}
                        style={{
                            width: 'min(100%, 420px)',
                            padding: '28px 24px',
                            borderRadius: 20,
                            border: '1px solid var(--app-border)',
                            background: 'var(--app-panel)',
                            textAlign: 'center',
                        }}
                    >
                        <p
                            style={{
                                margin: 0,
                                color: 'var(--app-text)',
                                fontSize: 18,
                                fontWeight: 800,
                            }}
                        >
                            {t('clientCabinet.noticeTitle')}
                        </p>

                        <p
                            style={{
                                margin: '12px 0 20px',
                                color: 'var(--app-text)',
                                fontSize: 14.5,
                                lineHeight: 1.6,
                            }}
                        >
                            {t('clientCabinet.noticeText')}
                        </p>

                        <button
                            type="button"
                            onClick={() => setNotice(false)}
                            className="primary-action"
                            style={{ width: '100%' }}
                        >
                            {t('clientCabinet.noticeClose')}
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}

export default PostponedList;
