/**
 * Служебный скрипт для установки на телефон.
 *
 * Намеренно простой: только отдаёт запросы дальше в сеть.
 * Настоящее кеширование добавим позже — сейчас важнее, чтобы
 * приложение всегда показывало свежие данные, а не старые
 * из кеша. Записи и баллы меняются постоянно.
 */
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', () => {
  // Ничего не перехватываем — браузер работает как обычно.
});


/**
 * Приём push-уведомлений.
 *
 * Текст приходит готовым: собрать его на устройстве нельзя —
 * переводы живут в приложении, а скрипт работает отдельно.
 */
self.addEventListener('push', (event) => {
  if (!event.data) {
    return;
  }

  let payload;

  try {
    payload = event.data.json();
  } catch (error) {
    payload = { title: 'GLAMOUR', body: event.data.text() };
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || 'GLAMOUR', {
      body: payload.body || '',
      icon: '/icon-192.png',
      badge: '/badge-96.png',
      data: { url: payload.url || '/' },
      // Уведомления об одной записи не должны множиться.
      tag: payload.tag || undefined,
    }),
  );
});

/**
 * Переход по нажатию.
 *
 * Если приложение уже открыто, переводим существующее окно:
 * второе окно поверх первого сбивает с толку.
 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windows) => {
        for (const window of windows) {
          if ('focus' in window) {
            window.navigate(url);

            return window.focus();
          }
        }

        return self.clients.openWindow(url);
      }),
  );
});
