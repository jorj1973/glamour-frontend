import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';

const TOKEN_STORAGE_KEY = 'glamour_access_token';

let socket: Socket | null = null;

/**
 * Живое соединение с перепиской.
 *
 * Одно на всё приложение: соединение — дорогая вещь, и заводить его
 * на каждый экран значит держать их пять там, где хватает одного.
 *
 * Опрос при этом никуда не девается. Соединение может не подняться
 * вовсе — в некоторых мобильных и рабочих сетях его режут, — и тогда
 * переписка должна работать по-прежнему, пусть и с задержкой.
 */
export function getChatSocket(): Socket | null {
  if (!localStorage.getItem(TOKEN_STORAGE_KEY)) {
    return null;
  }

  if (!socket) {
    socket = io({
      path: '/socket.io',

      /**
       * Токен читаем на каждой попытке, а не один раз.
       *
       * Он живёт недолго и обновляется по ходу работы: если запомнить
       * его при первом соединении, после первого же разрыва человек
       * входил бы с просроченным и оставался без связи.
       */
      auth: (callback: (data: { token: string }) => void) => {
        callback({ token: localStorage.getItem(TOKEN_STORAGE_KEY) ?? '' });
      },

      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
    });
  }

  return socket;
}

/** Разорвать соединение — при выходе из учётной записи. */
export function closeChatSocket(): void {
  socket?.disconnect();
  socket = null;
}

/** Подключено ли сейчас: по этому решаем, как часто опрашивать. */
export function isSocketLive(): boolean {
  return Boolean(socket?.connected);
}
