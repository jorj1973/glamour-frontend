import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import api from '../api/api';
import {
  fetchChatRooms,
  openSupportRoom,
  type ChatRoomSummary,
} from '../api/chat';
import AppLayout from '../components/AppLayout';
import ChatConversation from '../components/ChatConversation';

/**
 * Поддержка: переписка с тем, кто делает программу.
 *
 * Это обычная беседа внутри продукта, а не письмо и не мессенджер.
 * Человеку не надо выбирать собеседника, выходить из приложения и
 * объяснять, кто он: на той стороне владелец платформы, а салон и имя
 * видны из самой комнаты.
 *
 * Своего чата страница не пишет — берёт тот, что уже есть
 * (`ChatConversation`). Значит здесь сразу и вложения, и голосовые, и
 * счётчик непрочитанного, и уведомление с push на телефон, потому что
 * всё это уже работает для остальных бесед.
 */
function SupportPage() {
  const { t } = useTranslation();

  const [room, setRoom] = useState<ChatRoomSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const load = useCallback(async () => {
    try {
      const salons = await api.get<{ id: string }[]>('/salons/my');
      const salonId = salons.data?.[0]?.id;

      if (!salonId) {
        setErrorMsg(t('support.noSalon'));
        return;
      }

      const roomId = await openSupportRoom(salonId);
      const rooms = await fetchChatRooms();
      const mine = rooms.find((item) => item.id === roomId);

      if (!mine) {
        setErrorMsg(t('support.failed'));
        return;
      }

      setRoom(mine);
      setErrorMsg('');
    } catch {
      setErrorMsg(t('support.failed'));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <AppLayout>
      <main className="dashboard-page">
        {/* Заголовок здесь скромнее, чем на других страницах: под ним
            сразу переписка, и крупная шапка её придавливала. */}
        <header
          style={{
            textAlign: 'center',
            margin: '0 auto 18px',
            maxWidth: 520,
          }}
        >
          <h1 style={{ fontSize: 24, margin: '0 0 6px' }}>
            {t('support.title')}
          </h1>

          <p
            style={{
              color: 'var(--app-text-muted)',
              fontSize: 14,
              margin: 0,
            }}
          >
            {t('support.subtitle')}
          </p>
        </header>

        {isLoading ? (
          <p className="dashboard-status">{t('common.loading')}</p>
        ) : errorMsg ? (
          <p className="dashboard-status">{errorMsg}</p>
        ) : room ? (
          <ChatConversation
            room={room}
            /* Выходить некуда: это единственная беседа на странице. */
            onBack={() => undefined}
            onChanged={() => {
              void load();
            }}
          />
        ) : null}
      </main>
    </AppLayout>
  );
}

export default SupportPage;
