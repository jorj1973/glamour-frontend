import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import {
  ArrowLeft,
  Check,
  CheckCheck,
  Flag,
  Pencil,
  Send,
  Smile,
  Trash2,
  X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { getErrorKey } from '../api/errorMessage';
import {
  deleteChatMessage,
  editChatMessage,
  fetchChatMessages,
  markChatRoomRead,
  reportChatMessage,
  sendChatMessage,
} from '../api/chat';
import type { ChatMessage, ChatRoomSummary } from '../api/chat';

import EmojiPicker from './EmojiPicker';

/**
 * Как часто перечитываем беседу.
 *
 * Обычный опрос, а не постоянное соединение: держать сокет ради
 * переписки, где пишут несколько раз в день, дороже, чем раз
 * в три секунды спросить. Живое соединение сделаем, когда станет
 * тесно, и переделывать придётся только этот файл.
 */
const POLL_MS = 3000;

type Props = {
  room: ChatRoomSummary;
  onBack: () => void;
  /** Обновить список бесед: счётчики непрочитанного изменились. */
  onChanged: () => void;
};

function ChatConversation({ room, onBack, onChanged }: Props) {
  const { t } = useTranslation();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  /** До какого времени собеседник всё прочитал. */
  const [companionReadAt, setCompanionReadAt] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const lastIdRef = useRef<string | null>(null);

  /**
   * Чьё сообщение — считаем по собеседнику, а не по себе.
   *
   * В диалоге двое, поэтому «не собеседник — значит я». Так экран
   * не зависит от того, где лежит опознание вошедшего.
   */
  function isMine(message: ChatMessage): boolean {
    return message.authorUserId !== room.companionUserId;
  }

  /**
   * Прочитано ли собеседником моё сообщение.
   *
   * Сравниваем со временем его последнего прочтения: отдельной
   * отметки на каждое сообщение нет и не нужно — в диалоге читают
   * подряд, и одного времени хватает на всю ленту.
   */
  function isSeen(message: ChatMessage): boolean {
    if (!companionReadAt) {
      return false;
    }

    return (
      new Date(message.createdAt).getTime() <=
      new Date(companionReadAt).getTime()
    );
  }

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        const page = await fetchChatMessages(room.id);

        if (!alive) {
          return;
        }

        const list = page.messages;

        setMessages(list);
        setCompanionReadAt(page.companionLastReadAt);
        setErrorMsg('');

        const newestId = list.length ? list[list.length - 1].id : null;

        if (newestId !== lastIdRef.current) {
          lastIdRef.current = newestId;

          bottomRef.current?.scrollIntoView({ block: 'end' });

          // Отметку прочтения ставим только когда что-то изменилось:
          // иначе это лишний запрос каждые три секунды.
          await markChatRoomRead(room.id).catch(() => undefined);
          onChanged();
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

    void load();

    const timer = setInterval(() => {
      // Вкладку в фоне не опрашиваем: телефон, забытый на этом
      // экране, иначе весь день будит сеть.
      if (document.visibilityState === 'visible') {
        void load();
      }
    }, POLL_MS);

    return () => {
      alive = false;
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.id]);

  async function submit() {
    const text = draft.trim();

    if (!text || isSending) {
      return;
    }

    setIsSending(true);
    setErrorMsg('');

    try {
      if (editingId) {
        await editChatMessage(editingId, text);
        setEditingId(null);
      } else {
        await sendChatMessage(room.id, { text });
      }

      setDraft('');
      setShowEmoji(false);

      const page = await fetchChatMessages(room.id);
      const list = page.messages;

      setMessages(list);
      setCompanionReadAt(page.companionLastReadAt);
      lastIdRef.current = list.length ? list[list.length - 1].id : null;
      bottomRef.current?.scrollIntoView({ block: 'end' });
      onChanged();
    } catch (error) {
      setErrorMsg(t(getErrorKey(error)));
    } finally {
      setIsSending(false);
    }
  }

  async function remove(messageId: string) {
    if (!window.confirm(t('chat.deleteConfirm'))) {
      return;
    }

    try {
      await deleteChatMessage(messageId);
      setMessages((list) => list.filter((item) => item.id !== messageId));
      setActiveId(null);
      onChanged();
    } catch (error) {
      setErrorMsg(t(getErrorKey(error)));
    }
  }

  async function report(messageId: string) {
    const reason = window.prompt(t('chat.reportReason'));

    if (reason === null) {
      return;
    }

    try {
      await reportChatMessage(messageId, reason.trim() || undefined);
      setActiveId(null);
      window.alert(t('chat.reportSent'));
    } catch (error) {
      setErrorMsg(t(getErrorKey(error)));
    }
  }

  function startEdit(message: ChatMessage) {
    setEditingId(message.id);
    setDraft(message.text ?? '');
    setActiveId(null);
  }

  function formatTime(value: string) {
    return new Date(value).toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function formatDay(value: string) {
    return new Date(value).toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'long',
    });
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
      }}
    >
      {/* Шапка беседы */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '0 0 14px',
          borderBottom: '1px solid var(--app-border)',
          marginBottom: 12,
        }}
      >
        <button
          type="button"
          onClick={onBack}
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
          style={{
            color: 'var(--app-text)',
            fontSize: 16,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {room.title || t('chat.untitled')}
        </strong>
      </div>

      {/* Лента сообщений */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          paddingBottom: 8,
        }}
      >
        {isLoading ? (
          <p style={{ color: 'var(--app-text-muted)', fontSize: 13 }}>
            {t('common.loading')}
          </p>
        ) : messages.length === 0 ? (
          <p
            style={{
              color: 'var(--app-text-muted)',
              fontSize: 13,
              lineHeight: 1.55,
              margin: 'auto 0',
              textAlign: 'center',
            }}
          >
            {t('chat.emptyRoom')}
          </p>
        ) : (
          messages.map((message, index) => {
            const mine = isMine(message);

            const previous = index > 0 ? messages[index - 1] : null;

            const isNewDay =
              !previous ||
              new Date(previous.createdAt).toDateString() !==
                new Date(message.createdAt).toDateString();

            return (
              <div key={message.id}>
                {isNewDay && (
                  <p
                    style={{
                      textAlign: 'center',
                      color: 'var(--app-text-muted)',
                      fontSize: 11,
                      fontWeight: 700,
                      margin: '10px 0 12px',
                    }}
                  >
                    {formatDay(message.createdAt)}
                  </p>
                )}

                <div
                  style={{
                    display: 'flex',
                    justifyContent: mine ? 'flex-end' : 'flex-start',
                  }}
                >
                  <div style={{ maxWidth: '82%' }}>
                    <div
                      onClick={() =>
                        setActiveId(activeId === message.id ? null : message.id)
                      }
                      style={{
                        padding: '9px 12px',
                        borderRadius: mine
                          ? '15px 15px 4px 15px'
                          : '15px 15px 15px 4px',
                        border: mine
                          ? '1px solid transparent'
                          : '1px solid var(--app-border)',
                        background: mine
                          ? 'rgba(var(--app-accent-rgb), 0.16)'
                          : 'var(--app-panel)',
                        color: 'var(--app-text)',
                        fontSize: 14,
                        lineHeight: 1.5,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        cursor: 'pointer',
                      }}
                    >
                      {message.imageUrl && (
                        <img
                          src={message.imageUrl}
                          alt=""
                          style={{
                            display: 'block',
                            maxWidth: '100%',
                            borderRadius: 10,
                            marginBottom: message.text ? 7 : 0,
                          }}
                        />
                      )}

                      {message.text}
                    </div>

                    <p
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: mine ? 'flex-end' : 'flex-start',
                        gap: 5,
                        color: 'var(--app-text-muted)',
                        fontSize: 11,
                        margin: '3px 4px 0',
                      }}
                    >
                      {formatTime(message.createdAt)}
                      {message.editedAt && <span>· {t('chat.edited')}</span>}

                      {/* Одна галочка — ушло, две — собеседник открыл
                          беседу и дочитал до этого сообщения. */}
                      {mine &&
                        (isSeen(message) ? (
                          <CheckCheck
                            size={14}
                            color="var(--app-accent)"
                            aria-label={t('chat.seen')}
                          />
                        ) : (
                          <Check size={13} aria-label={t('chat.sent')} />
                        ))}
                    </p>

                    {activeId === message.id && (
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: mine ? 'flex-end' : 'flex-start',
                          gap: 6,
                          marginTop: 5,
                        }}
                      >
                        {mine ? (
                          <>
                            <button
                              type="button"
                              onClick={() => startEdit(message)}
                              style={actionStyle}
                            >
                              <Pencil size={12} /> {t('chat.edit')}
                            </button>

                            <button
                              type="button"
                              onClick={() => void remove(message.id)}
                              style={actionStyle}
                            >
                              <Trash2 size={12} /> {t('chat.delete')}
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void report(message.id)}
                            style={actionStyle}
                          >
                            <Flag size={12} /> {t('chat.report')}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}

        <div ref={bottomRef} />
      </div>

      {errorMsg && (
        <p
          style={{
            color: 'var(--app-accent-warm)',
            fontSize: 12,
            fontWeight: 700,
            margin: '0 0 8px',
          }}
        >
          {errorMsg}
        </p>
      )}

      {showEmoji && (
        <div style={{ marginBottom: 8 }}>
          <EmojiPicker onPick={(emoji) => setDraft((value) => value + emoji)} />
        </div>
      )}

      {editingId && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            padding: '7px 11px',
            marginBottom: 7,
            borderRadius: 11,
            background: 'rgba(var(--app-accent-rgb), 0.12)',
            color: 'var(--app-accent)',
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          {t('chat.editing')}

          <button
            type="button"
            onClick={() => {
              setEditingId(null);
              setDraft('');
            }}
            aria-label={t('common.cancel')}
            style={{
              display: 'inline-flex',
              border: 0,
              background: 'transparent',
              color: 'inherit',
              cursor: 'pointer',
            }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Поле ввода */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 7,
          paddingTop: 4,
        }}
      >
        <button
          type="button"
          onClick={() => setShowEmoji((value) => !value)}
          aria-label={t('chat.emoji')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 44,
            height: 44,
            flexShrink: 0,
            border: '1px solid var(--app-border)',
            borderRadius: 13,
            background: 'transparent',
            color: showEmoji ? 'var(--app-accent)' : 'var(--app-text-muted)',
            cursor: 'pointer',
          }}
        >
          <Smile size={19} />
        </button>

        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            // Enter отправляет, Shift+Enter переносит строку —
            // на телефоне переносят редко, а отправляют постоянно.
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              void submit();
            }
          }}
          rows={1}
          maxLength={4000}
          placeholder={t('chat.placeholder')}
          style={{
            flex: 1,
            minHeight: 44,
            maxHeight: 120,
            padding: '11px 13px',
            borderRadius: 13,
            border: '1px solid var(--app-border)',
            background: 'var(--app-input)',
            color: 'var(--app-text)',
            fontSize: 15,
            lineHeight: 1.4,
            resize: 'none',
            fontFamily: 'inherit',
          }}
        />

        <button
          type="button"
          onClick={() => void submit()}
          disabled={!draft.trim() || isSending}
          aria-label={t('chat.send')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 44,
            height: 44,
            flexShrink: 0,
            border: 0,
            borderRadius: 13,
            background: 'var(--app-accent)',
            color: '#17151c',
            cursor: draft.trim() && !isSending ? 'pointer' : 'default',
            opacity: draft.trim() && !isSending ? 1 : 0.5,
          }}
        >
          {editingId ? <Check size={19} /> : <Send size={18} />}
        </button>
      </div>
    </div>
  );
}

const actionStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  minHeight: 30,
  padding: '0 10px',
  border: '1px solid var(--app-border)',
  borderRadius: 10,
  background: 'transparent',
  color: 'var(--app-text-muted)',
  fontSize: 11,
  fontWeight: 700,
  cursor: 'pointer',
};

export default ChatConversation;
