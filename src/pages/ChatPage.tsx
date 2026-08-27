import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, MessageCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { getErrorKey } from '../api/errorMessage';
import {
  fetchChatAvailability,
  fetchChatRooms,
  takeRoomToOpen,
} from '../api/chat';
import type { ChatRoomSummary } from '../api/chat';
import ChatConversation from '../components/ChatConversation';

/** Как часто обновляем список бесед, пока он открыт. */
const POLL_MS = 15000;

/**
 * Общение.
 *
 * Список бесед и сама беседа — один экран, а не два адреса: так
 * возврат из беседы не выбрасывает из приложения на телефоне,
 * где «назад» — это системная кнопка.
 */
function ChatPage() {
  const { t } = useTranslation();

  const [rooms, setRooms] = useState<ChatRoomSummary[]>([]);
  const [openRoomId, setOpenRoomId] = useState<string | null>(null);
  const [isEnabled, setIsEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    let alive = true;

    // Кнопка «Написать» на карточке мастера уже завела беседу
    // и оставила её здесь — открываем сразу, без списка.
    const pending = takeRoomToOpen();

    if (pending) {
      setOpenRoomId(pending);
    }

    async function load() {
      try {
        const list = await fetchChatRooms();

        if (alive) {
          setRooms(list);
          setErrorMsg('');
        }
      } catch (error) {
        if (alive) {
          setErrorMsg(t(getErrorKey(error)));
        }
      } finally {
        if (alive) {
          setIsLoading(false);
        }
      }
    }

    void fetchChatAvailability()
      .then((availability) => {
        if (alive) {
          setIsEnabled(availability.enabled);
        }
      })
      .catch(() => undefined);

    void load();

    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        void load();
      }
    }, POLL_MS);

    return () => {
      alive = false;
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function reloadRooms(): Promise<ChatRoomSummary[] | null> {
    try {
      const list = await fetchChatRooms();

      setRooms(list);

      return list;
    } catch {
      // Список обновится следующим опросом.
      return null;
    }
  }

  const openRoom = openRoomId
    ? (rooms.find((room) => room.id === openRoomId) ?? null)
    : null;

  /**
   * Беседа, открытая с карточки мастера, в списке ещё не значится:
   * список успел загрузиться раньше, чем её завели. Перечитываем —
   * но по одному разу на беседу, иначе получится вечный круг.
   *
   * Без этого экран открылся бы без собеседника, а по нему беседа
   * решает, чьё сообщение чьё, — и все реплики оказались бы своими.
   */
  const refetchedForRef = useRef<string | null>(null);

  useEffect(() => {
    if (!openRoomId || openRoom) {
      return;
    }

    if (refetchedForRef.current === openRoomId) {
      return;
    }

    refetchedForRef.current = openRoomId;

    void reloadRooms().then((list) => {
      if (list && !list.some((room) => room.id === openRoomId)) {
        // Беседы нет и после перечитывания — возвращаемся к списку,
        // чтобы человек не смотрел в вечную загрузку.
        setOpenRoomId(null);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openRoomId, openRoom]);

  function formatWhen(value: string | null) {
    if (!value) {
      return '';
    }

    const date = new Date(value);
    const isToday = date.toDateString() === new Date().toDateString();

    return isToday
      ? date.toLocaleTimeString(undefined, {
          hour: '2-digit',
          minute: '2-digit',
        })
      : date.toLocaleDateString(undefined, {
          day: 'numeric',
          month: 'short',
        });
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        padding:
          'calc(env(safe-area-inset-top, 0px) + 14px) 16px ' +
          'calc(env(safe-area-inset-bottom, 0px) + 14px)',
        background: 'var(--app-bg)',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 720,
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          minHeight: 0,
        }}
      >
        {openRoom ? (
          <ChatConversation
            room={openRoom}
            onBack={() => {
              setOpenRoomId(null);
              void reloadRooms();
            }}
            onChanged={() => void reloadRooms()}
          />
        ) : openRoomId ? (
          <p style={{ color: 'var(--app-text-muted)', fontSize: 13 }}>
            {t('common.loading')}
          </p>
        ) : (
          <>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                paddingBottom: 14,
                borderBottom: '1px solid var(--app-border)',
                marginBottom: 14,
              }}
            >
              <button
                type="button"
                onClick={() => window.history.back()}
                aria-label={t('common.back')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 40,
                  height: 40,
                  flexShrink: 0,
                  border: '1px solid var(--app-border)',
                  borderRadius: 13,
                  background: 'transparent',
                  color: 'var(--app-text-muted)',
                  cursor: 'pointer',
                }}
              >
                <ArrowLeft size={18} />
              </button>

              <strong style={{ color: 'var(--app-text)', fontSize: 17 }}>
                {t('chat.title')}
              </strong>
            </div>

            {!isEnabled && (
              <p
                style={{
                  color: 'var(--app-text-muted)',
                  fontSize: 13,
                  lineHeight: 1.55,
                  marginBottom: 14,
                }}
              >
                {t('chat.disabled')}
              </p>
            )}

            {errorMsg && (
              <p
                style={{
                  color: 'var(--app-accent-warm)',
                  fontSize: 13,
                  fontWeight: 700,
                  marginBottom: 12,
                }}
              >
                {errorMsg}
              </p>
            )}

            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
              {isLoading ? (
                <p style={{ color: 'var(--app-text-muted)', fontSize: 13 }}>
                  {t('common.loading')}
                </p>
              ) : rooms.length === 0 ? (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 12,
                    padding: '48px 20px',
                    textAlign: 'center',
                  }}
                >
                  <MessageCircle size={34} color="var(--app-text-muted)" />

                  <p
                    style={{
                      color: 'var(--app-text-muted)',
                      fontSize: 13,
                      lineHeight: 1.6,
                      maxWidth: 320,
                    }}
                  >
                    {t('chat.emptyList')}
                  </p>
                </div>
              ) : (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  {rooms.map((room) => (
                    <button
                      key={room.id}
                      type="button"
                      onClick={() => setOpenRoomId(room.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        width: '100%',
                        minHeight: 66,
                        padding: '10px 13px',
                        border: '1px solid var(--app-border)',
                        borderRadius: 15,
                        background: 'var(--app-panel)',
                        textAlign: 'left',
                        cursor: 'pointer',
                      }}
                    >
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 42,
                          height: 42,
                          flexShrink: 0,
                          borderRadius: '50%',
                          background: 'rgba(var(--app-accent-rgb), 0.16)',
                          color: 'var(--app-accent)',
                          fontSize: 16,
                          fontWeight: 700,
                        }}
                      >
                        {(room.title || '?').trim().charAt(0).toUpperCase()}
                      </span>

                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span
                          style={{
                            display: 'block',
                            color: 'var(--app-text)',
                            fontSize: 14,
                            fontWeight: 700,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {room.title || t('chat.untitled')}
                        </span>

                        <span
                          style={{
                            display: 'block',
                            color: 'var(--app-text-muted)',
                            fontSize: 12,
                            marginTop: 3,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {room.lastMessagePreview || t('chat.noMessages')}
                        </span>
                      </span>

                      <span
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'flex-end',
                          gap: 5,
                          flexShrink: 0,
                        }}
                      >
                        <span
                          style={{
                            color: 'var(--app-text-muted)',
                            fontSize: 11,
                          }}
                        >
                          {formatWhen(room.lastMessageAt)}
                        </span>

                        {room.unread > 0 && (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              minWidth: 20,
                              height: 20,
                              padding: '0 6px',
                              borderRadius: 10,
                              background: 'var(--app-accent)',
                              color: '#17151c',
                              fontSize: 11,
                              fontWeight: 700,
                            }}
                          >
                            {room.unread > 99 ? '99+' : room.unread}
                          </span>
                        )}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default ChatPage;
