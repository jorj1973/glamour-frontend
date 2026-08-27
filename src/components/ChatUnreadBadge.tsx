import { useEffect, useState } from 'react';

import { fetchChatUnreadCount } from '../api/chat';

/** Как часто пересчитываем непрочитанное. */
const POLL_MS = 20000;

/**
 * Счётчик непрочитанных рядом с пунктом меню «Общение».
 *
 * У салона и мастера нет колокольчика в этом ряду, и о новом
 * сообщении они узнавали, только зайдя внутрь. Пункт меню без числа
 * не отличается от прочитанного, и его перестают открывать.
 */
function ChatUnreadBadge() {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let alive = true;

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

    void refresh();

    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        void refresh();
      }
    }, POLL_MS);

    /**
     * Возврат к вкладке пересчитывает сразу.
     *
     * Иначе человек, вернувшийся к отложенному телефону, до двадцати
     * секунд видит вчерашнее число — и решает, что нового нет.
     */
    function onVisible() {
      if (document.visibilityState === 'visible') {
        void refresh();
      }
    }

    document.addEventListener('visibilitychange', onVisible);

    return () => {
      alive = false;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  if (unread <= 0) {
    return null;
  }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 20,
        height: 20,
        padding: '0 6px',
        marginLeft: 'auto',
        flexShrink: 0,
        borderRadius: 10,
        background: 'var(--app-accent)',
        color: '#17151c',
        fontSize: 11,
        fontWeight: 700,
      }}
    >
      {unread > 99 ? '99+' : unread}
    </span>
  );
}

export default ChatUnreadBadge;
