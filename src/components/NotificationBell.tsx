import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bell, CalendarDays, Check, MessageSquare, UserPlus } from 'lucide-react';

import api from '../api/api';
import {
    isPushSupported,
    pushPermission,
    subscribeToPush,
} from '../api/push';

type Notification = {
    id: string;
    type: string;
    title: string;
    message: string;
    isRead: boolean;
    createdAt: string;
    data: Record<string, string> | null;
};

/** Значок по виду уведомления: глазом быстрее, чем читать. */
function iconFor(type: string) {
    if (type.startsWith('appointment')) {
        return <CalendarDays size={15} />;
    }

    if (type.startsWith('review')) {
        return <MessageSquare size={15} />;
    }

    return <UserPlus size={15} />;
}

function dateLocale(lang: string): string {
    if (lang.startsWith('ro')) return 'ro-RO';
    if (lang.startsWith('en')) return 'en-GB';

    return 'ru-RU';
}

function NotificationBell() {
    const { t, i18n } = useTranslation();

    const [items, setItems] = useState<Notification[]>([]);
    const [unread, setUnread] = useState(0);
    const [isOpen, setIsOpen] = useState(false);

    const boxRef = useRef<HTMLDivElement>(null);

    const [testMsg, setTestMsg] = useState('');

    /**
     * Пробное уведомление.
     *
     * Если разрешения ещё нет, спрашиваем здесь: человек сам
     * нажал, значит момент подходящий.
     */
    async function sendTest() {
        setTestMsg('');

        if (pushPermission() !== 'granted') {
            const ok = await subscribeToPush();

            if (!ok) {
                setTestMsg(t('notifications.testDenied'));

                return;
            }
        }

        try {
            await api.post('/push/test');
            setTestMsg(t('notifications.testSent'));
        } catch {
            setTestMsg(t('notifications.testFailed'));
        }
    }

    async function loadCount() {
        try {
            const res = await api.get<{ count: number }>(
                '/notifications/my/unread-count',
            );

            setUnread(res.data.count);
        } catch {
            setUnread(0);
        }
    }

    async function loadItems() {
        try {
            const res = await api.get<Notification[]>('/notifications/my');

            setItems(res.data);
        } catch {
            setItems([]);
        }
    }

    /**
     * Самовосстановление подписки.
     *
     * Разрешение браузер выдаёт один раз и помнит навсегда, а вот
     * подписка на сервере может пропасть — например, после смены
     * ключей отправки. Тогда телефон считает себя подписанным,
     * сервер о нём не знает, и уведомления молчат без единой ошибки.
     *
     * Поэтому при каждом запуске подписываемся заново: старая
     * подписка отменяется, новая уходит на сервер.
     */
    useEffect(() => {
        if (isPushSupported() && pushPermission() === 'granted') {
            void subscribeToPush();
        }
    }, []);

    useEffect(() => {
        void loadCount();

        // Раз в минуту: чаще незачем, реже — новости приходят с
        // опозданием, и человек узнаёт о записи из другого места.
        const timer = setInterval(() => void loadCount(), 60000);

        return () => clearInterval(timer);
    }, []);

    // Закрываем при нажатии вне списка: иначе он висит и мешает.
    useEffect(() => {
        if (!isOpen) {
            return;
        }

        function handleOutside(event: MouseEvent) {
            if (
                boxRef.current &&
                !boxRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false);
            }
        }

        document.addEventListener('mousedown', handleOutside);

        return () => document.removeEventListener('mousedown', handleOutside);
    }, [isOpen]);

    async function toggle() {
        const next = !isOpen;

        setIsOpen(next);

        if (next) {
            await loadItems();

            if (unread > 0) {
                try {
                    await api.patch('/notifications/my/read-all');

                    setUnread(0);
                } catch {
                    // Не страшно: счётчик обновится при следующей проверке.
                }
            }
        }
    }

    /**
     * Текст на языке читающего.
     *
     * Старые записи хранят готовый текст по-русски: у них нет
     * ключа, показываем как есть — иначе они пропали бы вовсе.
     */
    function textFor(item: Notification): { title: string; message: string } {
        const key = item.data?.key;

        if (!key) {
            return { title: item.title, message: item.message };
        }

        return {
            title: t('notifications.' + key + '.title', item.title),
            message: t('notifications.' + key + '.message', {
                defaultValue: item.message,
                ...item.data,
            }),
        };
    }

    const locale = dateLocale(i18n.language);

    return (
        <>
        {/* Покачивание нужно, чтобы новость заметили: колокольчик
            в углу легко пропустить взглядом. */}
        <style>{`
@keyframes glamour-bell-swing {
  0%, 60%, 100% { transform: rotate(0deg); }
  70% { transform: rotate(-11deg); }
  80% { transform: rotate(9deg); }
  90% { transform: rotate(-5deg); }
}
`}</style>

        <div
            ref={boxRef}
            style={{
                position: 'fixed',
                // Ниже строки состояния телефона и кнопки меню:
                // иначе колокольчик перекрывает их.
                top: 'calc(env(safe-area-inset-top, 0px) + 10px)',
                right: 16,
                zIndex: 600,
            }}
        >
            <button
                type="button"
                onClick={() => void toggle()}
                aria-label={t('notifications.title')}
                style={{
                    position: 'relative',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    border: unread > 0
                        ? '1px solid #e05a76'
                        : '1px solid var(--app-border)',
                    background: unread > 0
                        ? 'rgba(224, 90, 118, 0.12)'
                        : 'var(--app-panel)',
                    color: unread > 0 ? '#e05a76' : 'var(--app-text)',
                    cursor: 'pointer',
                    boxShadow: '0 6px 20px var(--app-shadow)',
                    animation: unread > 0
                        ? 'glamour-bell-swing 1.4s ease-in-out infinite'
                        : undefined,
                }}
            >
                <Bell size={18} />

                {unread > 0 && (
                    <span
                        style={{
                            position: 'absolute',
                            top: -5,
                            right: -5,
                            minWidth: 19,
                            height: 19,
                            padding: '0 5px',
                            borderRadius: 10,
                            background: '#e05a76',
                            color: '#fff',
                            fontSize: 11,
                            fontWeight: 800,
                            lineHeight: '19px',
                            textAlign: 'center',
                        }}
                    >
                        {unread > 99 ? '99+' : unread}
                    </span>
                )}
            </button>

            {isOpen && (
                <div
                    style={{
                        position: 'absolute',
                        top: 48,
                        right: 0,
                        zIndex: 500,
                        width: 'min(88vw, 360px)',
                        maxHeight: 420,
                        overflowY: 'auto',
                        borderRadius: 16,
                        border: '1px solid var(--app-border)',
                        background: 'var(--app-panel)',
                        boxShadow: '0 20px 50px var(--app-shadow)',
                    }}
                >
                    <p
                        style={{
                            margin: 0,
                            padding: '14px 16px',
                            borderBottom: '1px solid var(--app-border)',
                            color: 'var(--app-text)',
                            fontSize: 14,
                            fontWeight: 700,
                        }}
                    >
                        {t('notifications.title')}
                    </p>

                    {isPushSupported() && (
                        <div
                            style={{
                                padding: '12px 16px',
                                borderBottom: '1px solid var(--app-border)',
                            }}
                        >
                            <button
                                type="button"
                                onClick={() => void sendTest()}
                                style={{
                                    width: '100%',
                                    minHeight: 38,
                                    borderRadius: 11,
                                    border: '1px solid var(--app-accent)',
                                    background: 'transparent',
                                    color: 'var(--app-accent)',
                                    fontSize: 13,
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                }}
                            >
                                {t('notifications.testButton')}
                            </button>

                            {testMsg && (
                                <p
                                    style={{
                                        margin: '8px 0 0',
                                        color: 'var(--app-text-muted)',
                                        fontSize: 12,
                                        textAlign: 'center',
                                    }}
                                >
                                    {testMsg}
                                </p>
                            )}
                        </div>
                    )}

                    {items.length === 0 ? (
                        <p
                            style={{
                                margin: 0,
                                padding: '22px 16px',
                                color: 'var(--app-text-muted)',
                                fontSize: 13,
                                textAlign: 'center',
                            }}
                        >
                            {t('notifications.empty')}
                        </p>
                    ) : (
                        items.map((item) => {
                            const text = textFor(item);

                            return (
                                <div
                                    key={item.id}
                                    style={{
                                        display: 'flex',
                                        gap: 11,
                                        padding: '13px 16px',
                                        borderBottom:
                                            '1px solid var(--app-border)',
                                        background: item.isRead
                                            ? 'transparent'
                                            : 'rgba(var(--app-accent-rgb), 0.07)',
                                    }}
                                >
                                    <span
                                        style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            width: 30,
                                            height: 30,
                                            borderRadius: 10,
                                            background:
                                                'rgba(var(--app-accent-rgb), 0.14)',
                                            color: 'var(--app-accent)',
                                            flexShrink: 0,
                                        }}
                                    >
                                        {iconFor(item.type)}
                                    </span>

                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <strong
                                            style={{
                                                display: 'block',
                                                color: 'var(--app-text)',
                                                fontSize: 13.5,
                                                marginBottom: 3,
                                            }}
                                        >
                                            {text.title}
                                        </strong>

                                        <span
                                            style={{
                                                display: 'block',
                                                color: 'var(--app-text-muted)',
                                                fontSize: 12.5,
                                                lineHeight: 1.5,
                                            }}
                                        >
                                            {text.message}
                                        </span>

                                        <span
                                            style={{
                                                display: 'block',
                                                marginTop: 5,
                                                color: 'var(--app-text-muted)',
                                                fontSize: 11,
                                            }}
                                        >
                                            {new Date(
                                                item.createdAt,
                                            ).toLocaleString(locale, {
                                                day: 'numeric',
                                                month: 'short',
                                                hour: '2-digit',
                                                minute: '2-digit',
                                            })}
                                        </span>
                                    </div>

                                    {item.isRead && (
                                        <Check
                                            size={14}
                                            color="var(--app-text-muted)"
                                        />
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            )}
        </div>
        </>
    );
}

export default NotificationBell;
