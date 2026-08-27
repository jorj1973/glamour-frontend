import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, MessageCircle, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { getErrorKey } from '../api/errorMessage';
import {
  fetchChatAvailability,
  fetchChatRooms,
  takeRoomToOpen,
} from '../api/chat';
import type { ChatRoomSummary } from '../api/chat';
import ChatCompanionPicker from '../components/ChatCompanionPicker';
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
  const [isPicking, setIsPicking] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  /** Сколько экрана заняла клавиатура. */
  const [keyboardInset, setKeyboardInset] = useState(0);

  useEffect(() => {
    const viewport = window.visualViewport;

    if (!viewport) {
      return;
    }

    /**
     * Клавиатура на iOS не сдвигает закреплённый слой: поле ввода
     * уезжает под неё, и человек печатает вслепую. Меряем, сколько
     * экрана она заняла, и на столько же поднимаем низ окна.
     */
    function update() {
      if (!viewport) {
        return;
      }

      const hidden = window.innerHeight - viewport.height - viewport.offsetTop;

      setKeyboardInset(Math.max(0, Math.round(hidden)));
    }

    update();

    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);

    return () => {
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
    };
  }, []);

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
    /**
     * Экран общения закреплён к виду, а не стоит в потоке страницы.
     *
     * В mobile.css у html и body задан overflow-x: hidden — страница
     * из-за него становится собственным контейнером прокрутки. Экран
     * чата единственный, кто рисуется вне обычной обёртки и при этом
     * сам держит высоту с прокручиваемой лентой внутри; на iOS такая
     * пара схлопывала внутреннюю высоту в ноль, и от чата оставался
     * тёмный фон да полоска поля ввода.
     *
     * Закрепление снимает зависимость от правил страницы целиком —
     * и это же обычное устройство любого полноэкранного разговора.
     */
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: keyboardInset,
        zIndex: 70,
        display: 'flex',
        flexDirection: 'column',
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 14px)',
        paddingLeft: 16,
        paddingRight: 16,
        // Под клавиатурой полосы жеста не видно — отступ под неё
        // держим только пока её действительно видно.
        paddingBottom:
          keyboardInset > 0
            ? 14
            : 'calc(env(safe-area-inset-bottom, 0px) + 14px)',
        background: 'var(--app-bg)',
        color: 'var(--app-text)',
        boxSizing: 'border-box',
        overscrollBehavior: 'contain',
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

              <strong
                style={{ flex: 1, color: 'var(--app-text)', fontSize: 17 }}
              >
                {t('chat.title')}
              </strong>

              {/* Начать разговор можно отсюда, а не только с карточки
                  мастера: иначе экран открывается пустым и никуда
                  не ведёт. */}
              <button
                type="button"
                onClick={() => setIsPicking(true)}
                aria-label={t('chat.newTitle')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 7,
                  minHeight: 40,
                  padding: '0 15px',
                  flexShrink: 0,
                  border: 0,
                  borderRadius: 13,
                  background: 'var(--app-accent)',
                  color: '#17151c',
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <Plus size={16} />
                {t('chat.new')}
              </button>
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

                  <button
                    type="button"
                    onClick={() => setIsPicking(true)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      minHeight: 46,
                      padding: '0 20px',
                      marginTop: 4,
                      border: 0,
                      borderRadius: 14,
                      background: 'var(--app-accent)',
                      color: '#17151c',
                      fontSize: 15,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    <Plus size={17} />
                    {t('chat.new')}
                  </button>
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

      {isPicking && (
        <ChatCompanionPicker
          onClose={() => setIsPicking(false)}
          onOpened={(roomId) => {
            setIsPicking(false);
            setOpenRoomId(roomId);
            void reloadRooms();
          }}
        />
      )}
    </div>
  );
}

export default ChatPage;
