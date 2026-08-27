import { useEffect, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { fetchChatAvailability, fetchChatUnreadCount } from '../api/chat';

import { HEADER_ICON_SIZE, headerIconButton } from './headerControls';

/** Адрес экрана общения. */
const CHAT_HASH = '#chat';

/** Как часто обновляем счётчик непрочитанного. */
const POLL_MS = 30000;

/**
 * Вход в общение — для шапки кабинета клиента.
 *
 * У клиента нет бокового меню: его кабинет — отдельный экран со
 * своими вкладками. Поэтому вход в чат живёт в той же строке, что
 * язык, тема и колокольчик.
 */
function ChatOpenButton() {
  const { t } = useTranslation();

  const [isEnabled, setIsEnabled] = useState(false);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setInterval> | null = null;

    async function refresh() {
      try {
        const count = await fetchChatUnreadCount();

        if (alive) {
          setUnread(count);
        }
      } catch {
        // Счётчик не критичен: обновится следующим кругом.
      }
    }

    async function start() {
      try {
        const availability = await fetchChatAvailability();

        if (!alive || !availability.enabled) {
          return;
        }

        setIsEnabled(true);

        await refresh();

        timer = setInterval(() => {
          if (document.visibilityState === 'visible') {
            void refresh();
          }
        }, POLL_MS);

        document.addEventListener('visibilitychange', onVisible);
      } catch {
        // Чат недоступен — кнопки не будет.
      }
    }

    /**
     * Возврат к вкладке пересчитывает сразу.
     *
     * Иначе человек, вернувшийся к отложенному телефону, до полуминуты
     * видит вчерашнее число — и решает, что нового нет.
     */
    function onVisible() {
      if (document.visibilityState === 'visible') {
        void refresh();
      }
    }

    void start();

    return () => {
      alive = false;

      if (timer) {
        clearInterval(timer);
      }

      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  if (!isEnabled) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={() => {
        window.location.hash = CHAT_HASH;
      }}
      aria-label={t('nav.chat')}
      /**
       * Коробка общая со всей шапкой: языки, тема, колокольчик и
       * выход берут её оттуда же. Пока размеры стояли в каждом файле
       * своими числами, ряд разъезжался.
       *
       * Цвет по тому же правилу, что у колокольчика: обычный, пока всё
       * прочитано, и цветной, когда есть новое.
       */
      style={{
        ...headerIconButton,
        color: unread > 0 ? 'var(--app-accent)' : 'var(--app-text)',
      }}
    >
      <MessageCircle size={HEADER_ICON_SIZE} />

      {unread > 0 && (
        <span
          style={{
            position: 'absolute',
            top: -4,
            right: -4,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: 17,
            height: 17,
            padding: '0 4px',
            borderRadius: 9,
            background: 'var(--app-accent)',
            color: '#17151c',
            fontSize: 10,
            fontWeight: 700,
          }}
        >
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </button>
  );
}

export default ChatOpenButton;
