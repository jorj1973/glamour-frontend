import api from '../api/api';

/**
 * Подписка на push-уведомления.
 *
 * Единственный бесплатный канал, доходящий мгновенно. Работает
 * только когда приложение установлено на домашний экран или
 * открыто в браузере с разрешением.
 */

/** Ключ приходит с сервера в виде строки, а нужен набором байт. */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

    const raw = window.atob(base64);
    const output = new Uint8Array(raw.length);

    for (let i = 0; i < raw.length; i += 1) {
        output[i] = raw.charCodeAt(i);
    }

    return output;
}

/** Поддерживает ли устройство push вообще. */
export function isPushSupported(): boolean {
    return (
        'serviceWorker' in navigator &&
        'PushManager' in window &&
        'Notification' in window
    );
}

/** Разрешил ли человек уведомления. */
export function pushPermission(): NotificationPermission {
    if (!('Notification' in window)) {
        return 'denied';
    }

    return Notification.permission;
}

/** Подписан ли на этом устройстве. */
export async function isSubscribed(): Promise<boolean> {
    if (!isPushSupported()) {
        return false;
    }

    try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();

        return Boolean(subscription);
    } catch {
        return false;
    }
}

/**
 * Подписывает устройство.
 *
 * Разрешение спрашиваем здесь, по нажатию: при первом заходе
 * человек откажет не читая, и вернуть его будет нельзя.
 */
export async function subscribeToPush(): Promise<boolean> {
    if (!isPushSupported()) {
        return false;
    }

    try {
        const permission = await Notification.requestPermission();

        if (permission !== 'granted') {
            return false;
        }

        const keyResponse = await api.get<{ key: string }>('/push/public-key');

        if (!keyResponse.data.key) {
            return false;
        }

        const registration = await navigator.serviceWorker.ready;

        const existing = await registration.pushManager.getSubscription();

        if (existing) {
            await existing.unsubscribe();
        }

        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(
                keyResponse.data.key,
            ) as BufferSource,
        });

        const raw = subscription.toJSON();

        await api.post('/push/subscribe', {
            endpoint: raw.endpoint,
            keys: raw.keys,
        });

        return true;
    } catch {
        return false;
    }
}

export async function unsubscribeFromPush(): Promise<void> {
    if (!isPushSupported()) {
        return;
    }

    try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();

        if (!subscription) {
            return;
        }

        await api.delete('/push/subscribe', {
            data: { endpoint: subscription.endpoint },
        });

        await subscription.unsubscribe();
    } catch {
        // Отписка не критична: сервер уберёт мёртвый адрес сам,
        // когда доставка не пройдёт.
    }
}
