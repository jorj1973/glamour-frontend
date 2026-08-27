import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import {
  ArrowLeft,
  Check,
  CheckCheck,
  Flame,
  ImagePlus,
  LogOut,
  Mic,
  MoreHorizontal,
  Send,
  Smile,
  Square,
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
  reactToMessage,
  reportChatMessage,
  sendChatMessage,
  uploadChatAttachment,
} from '../api/chat';
import type {
  ChatMessage,
  ChatReaction,
  ChatReplyPreview,
  ChatRoomSummary,
} from '../api/chat';
import {
  audioFileName,
  canRecordAudio,
  compressImage,
  formatDuration,
  pickAudioMime,
} from '../api/chatMedia';

import { getChatSocket, isSocketLive } from '../api/chatSocket';

import ChatAudioMessage from './ChatAudioMessage';
import ChatMessageActions from './ChatMessageActions';
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

/**
 * Как редко опрашивать, когда есть живое соединение.
 *
 * Совсем отключать опрос нельзя: соединение может тихо умереть —
 * телефон уснул, сеть сменилась, — и человек останется без
 * сообщений, ничего не заметив. Раз в полминуты это ловит.
 */
const POLL_LIVE_MS = 30000;

/** Сколько держать надпись «печатает…» после последнего знака. */
const TYPING_MS = 3500;

/** Предел записи: длиннее голосовые всё равно не слушают. */
const MAX_RECORD_SECONDS = 120;

/** Снимок, выбранный, но ещё не отправленный. */
type PendingPhoto = {
  id: string;
  file: File;
  previewUrl: string;
};

/** Запись, сделанная, но ещё не отправленная. */
type PendingVoice = {
  file: File;
  seconds: number;
  previewUrl: string;
};

type Props = {
  room: ChatRoomSummary;
  onBack: () => void;
  /** Обновить список бесед: счётчики непрочитанного изменились. */
  onChanged: () => void;
  /** Выйти из темы — только у комнат, у диалога выходить некуда. */
  onLeave?: () => void;
};

function ChatConversation({ room, onBack, onChanged, onLeave }: Props) {
  const { t } = useTranslation();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  /** Сообщение, для которого открыто меню действий. */
  const [actionsFor, setActionsFor] = useState<ChatMessage | null>(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  /** До какого времени собеседник всё прочитал. */
  const [companionReadAt, setCompanionReadAt] = useState<string | null>(null);

  /** Цитируемые сообщения и реакции — приходят вместе с лентой. */
  const [replies, setReplies] = useState<Record<string, ChatReplyPreview>>({});
  const [reactions, setReactions] = useState<Record<string, ChatReaction[]>>(
    {},
  );

  /** Сообщение, на которое сейчас отвечают. */
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);

  /** Кто смотрит и как зовут авторов — приходят вместе с лентой. */
  const [viewerUserId, setViewerUserId] = useState('');
  const [authors, setAuthors] = useState<Record<string, string>>({});

  /** Собеседник печатает прямо сейчас. */
  const [typing, setTyping] = useState(false);

  /**
   * Прикреплённое, но не отправленное.
   *
   * Раньше снимок уходил прямо из окна выбора, а запись — по остановке.
   * Так нельзя: человек ставит галочку в галерее, чтобы отметить кадр,
   * а не чтобы его немедленно отослать. Сначала прикрепляем, потом
   * смотрим, что прикрепили, и только потом отправляем.
   */
  const [photos, setPhotos] = useState<PendingPhoto[]>([]);
  const [voice, setVoice] = useState<PendingVoice | null>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [playOnce, setPlayOnce] = useState(false);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const lastIdRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const secondsRef = useRef(0);
  const keepOnStopRef = useRef(true);
  const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingSentAtRef = useRef(0);
  const lastPollRef = useRef(0);
  const typingHideRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Удержание открывает меню действий.
   *
   * Своего события для этого в браузере нет, поэтому считаем сами:
   * палец опустился — заводим отсчёт, поднялся или поехал — отменяем.
   * Без отмены по движению меню выскакивало бы при каждой прокрутке.
   */
  function startPress(message: ChatMessage) {
    cancelPress();

    pressTimerRef.current = setTimeout(() => {
      setActionsFor(message);
    }, 480);
  }

  function cancelPress() {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  }

  /**
   * Чьё сообщение — считаем по собеседнику, а не по себе.
   *
   * В диалоге двое, поэтому «не собеседник — значит я». Так экран
   * не зависит от того, где лежит опознание вошедшего.
   */
  function isMine(message: ChatMessage): boolean {
    if (viewerUserId) {
      return message.authorUserId === viewerUserId;
    }

    // Пока лента не пришла — считаем по-старому, от собеседника.
    // В комнате это неверно, но там ещё и рисовать нечего.
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

  async function reload() {
    const page = await fetchChatMessages(room.id);

    setMessages(page.messages);
    setCompanionReadAt(page.companionLastReadAt);
    setReplies(page.replies);
    setReactions(page.reactions);
    setViewerUserId(page.viewerUserId);
    setAuthors(page.authors);

    lastIdRef.current = page.messages.length
      ? page.messages[page.messages.length - 1].id
      : null;

    bottomRef.current?.scrollIntoView({ block: 'end' });
    onChanged();
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
        setReplies(page.replies);
        setReactions(page.reactions);
        setViewerUserId(page.viewerUserId);
        setAuthors(page.authors);
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

    /**
     * Опрос остаётся, но при живом соединении становится редким.
     *
     * Он теперь не способ узнавать новости, а страховка: соединение
     * может тихо умереть — телефон уснул, сеть сменилась, — и без
     * страховки человек остался бы без сообщений, ничего не заметив.
     */
    const timer = setInterval(() => {
      if (document.visibilityState !== 'visible') {
        return;
      }

      const now = Date.now();
      const gap = isSocketLive() ? POLL_LIVE_MS : POLL_MS;

      if (now - lastPollRef.current >= gap) {
        lastPollRef.current = now;
        void load();
      }
    }, POLL_MS);

    /* ── Живое соединение ── */

    const socket = getChatSocket();

    function onRoomEvent(payload: { roomId?: string }) {
      if (payload?.roomId === room.id) {
        lastPollRef.current = Date.now();
        void load();
      }
    }

    function onTyping(payload: { roomId?: string; userId?: string }) {
      if (payload?.roomId !== room.id || payload.userId === viewerUserId) {
        return;
      }

      setTyping(true);

      if (typingHideRef.current) {
        clearTimeout(typingHideRef.current);
      }

      typingHideRef.current = setTimeout(() => setTyping(false), TYPING_MS);
    }

    if (socket) {
      // Беседа могла завестись уже после соединения — подписываемся.
      socket.emit('chat:join', { roomId: room.id });

      socket.on('chat:message', onRoomEvent);
      socket.on('chat:changed', onRoomEvent);
      socket.on('chat:read', onRoomEvent);
      socket.on('chat:typing', onTyping);
    }

    return () => {
      alive = false;
      clearInterval(timer);

      if (typingHideRef.current) {
        clearTimeout(typingHideRef.current);
      }

      socket?.off('chat:message', onRoomEvent);
      socket?.off('chat:changed', onRoomEvent);
      socket?.off('chat:read', onRoomEvent);
      socket?.off('chat:typing', onTyping);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.id, viewerUserId]);

  /** Уход с экрана обрывает запись — иначе микрофон останется занят. */
  useEffect(() => {
    return () => {
      releaseRecorder();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ─────────── Прикреплённое ─────────── */

  async function attachPhotos(files: File[]) {
    setErrorMsg('');

    const prepared: PendingPhoto[] = [];

    for (const file of files) {
      const compressed = await compressImage(file);

      prepared.push({
        id: compressed.name + ':' + prepared.length + ':' + compressed.size,
        file: compressed,
        previewUrl: URL.createObjectURL(compressed),
      });
    }

    setPhotos((list) => [...list, ...prepared]);
  }

  function removePhoto(id: string) {
    setPhotos((list) => {
      const gone = list.find((item) => item.id === id);

      if (gone) {
        URL.revokeObjectURL(gone.previewUrl);
      }

      return list.filter((item) => item.id !== id);
    });
  }

  function removeVoice() {
    setVoice((current) => {
      if (current) {
        URL.revokeObjectURL(current.previewUrl);
      }

      return null;
    });

    setPlayOnce(false);
  }

  /* ─────────── Отправка ─────────── */

  const hasAttachments = photos.length > 0 || voice !== null;
  const canSend = Boolean(draft.trim()) || hasAttachments;

  async function submit() {
    if (isSending) {
      return;
    }

    const text = draft.trim();

    if (editingId) {
      if (!text) {
        return;
      }

      setIsSending(true);
      setErrorMsg('');

      try {
        await editChatMessage(editingId, text);
        setEditingId(null);
        setDraft('');
        await reload();
      } catch (error) {
        setErrorMsg(t(getErrorKey(error)));
      } finally {
        setIsSending(false);
      }

      return;
    }

    if (!canSend) {
      return;
    }

    setIsSending(true);
    setErrorMsg('');

    try {
      // Снимки идут отдельными сообщениями, подпись — к первому:
      // так их можно открывать по одному, а подпись не потеряется.
      let caption = text;

      for (const photo of photos) {
        const uploaded = await uploadChatAttachment(room.id, photo.file);

        await sendChatMessage(room.id, {
          imageUrl: uploaded.url,
          text: caption || undefined,
          replyToId: replyTo?.id,
        });

        caption = '';
      }

      if (voice) {
        const uploaded = await uploadChatAttachment(room.id, voice.file);

        await sendChatMessage(room.id, {
          audioUrl: uploaded.url,
          audioSeconds: voice.seconds,
          playOnce,
          replyToId: replyTo?.id,
        });
      }

      if (caption) {
        await sendChatMessage(room.id, {
          text: caption,
          replyToId: replyTo?.id,
        });
      }

      photos.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));

      if (voice) {
        URL.revokeObjectURL(voice.previewUrl);
      }

      setPhotos([]);
      setVoice(null);
      setPlayOnce(false);
      setDraft('');
      setShowEmoji(false);
      setReplyTo(null);

      await reload();
    } catch (error) {
      setErrorMsg(t(getErrorKey(error)));
    } finally {
      setIsSending(false);
    }
  }

  /* ─────────── Запись ─────────── */

  function releaseRecorder() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
    chunksRef.current = [];
  }

  async function startRecording() {
    if (isRecording || isSending) {
      return;
    }

    if (!canRecordAudio()) {
      setErrorMsg(t('chat.noRecorder'));
      return;
    }

    setErrorMsg('');
    removeVoice();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = pickAudioMime();

      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined,
      );

      streamRef.current = stream;
      recorderRef.current = recorder;
      chunksRef.current = [];
      secondsRef.current = 0;
      keepOnStopRef.current = true;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const chunks = chunksRef.current;
        const seconds = secondsRef.current;
        const keep = keepOnStopRef.current;
        const type = recorder.mimeType || mimeType || 'audio/webm';

        releaseRecorder();
        setIsRecording(false);
        setRecordSeconds(0);

        // Меньше секунды — это случайное касание, а не сообщение.
        if (!keep || chunks.length === 0 || seconds < 1) {
          return;
        }

        const blob = new Blob(chunks, { type });
        const file = new File([blob], audioFileName(type), { type });

        setVoice({
          file,
          seconds: Math.min(MAX_RECORD_SECONDS, Math.max(1, seconds)),
          previewUrl: URL.createObjectURL(blob),
        });
      };

      recorder.start();

      setIsRecording(true);
      setRecordSeconds(0);

      timerRef.current = setInterval(() => {
        secondsRef.current += 1;
        setRecordSeconds(secondsRef.current);

        if (secondsRef.current >= MAX_RECORD_SECONDS) {
          stopRecording(true);
        }
      }, 1000);
    } catch {
      releaseRecorder();
      setIsRecording(false);
      setErrorMsg(t('chat.micDenied'));
    }
  }

  function stopRecording(keep: boolean) {
    keepOnStopRef.current = keep;

    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop();
      return;
    }

    releaseRecorder();
    setIsRecording(false);
    setRecordSeconds(0);
  }

  /**
   * Сообщить собеседнику, что идёт набор.
   *
   * Не чаще раза в две секунды: событие ничего не хранит и живёт
   * секунды, но отправлять его на каждую букву — это поток из сотни
   * сообщений на одну фразу.
   */
  function notifyTyping() {
    const now = Date.now();

    if (now - typingSentAtRef.current < 2000) {
      return;
    }

    typingSentAtRef.current = now;
    getChatSocket()?.emit('chat:typing', { roomId: room.id });
  }

  /* ─────────── Действия над сообщением ─────────── */

  async function react(messageId: string, emoji: string) {
    setActionsFor(null);

    try {
      await reactToMessage(messageId, emoji);
      await reload();
    } catch (error) {
      setErrorMsg(t(getErrorKey(error)));
    }
  }

  async function remove(messageId: string) {
    if (!window.confirm(t('chat.deleteConfirm'))) {
      return;
    }

    try {
      await deleteChatMessage(messageId);
      setMessages((list) => list.filter((item) => item.id !== messageId));
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
      window.alert(t('chat.reportSent'));
    } catch (error) {
      setErrorMsg(t(getErrorKey(error)));
    }
  }

  function startEdit(message: ChatMessage) {
    setEditingId(message.id);
    setDraft(message.text ?? '');
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
            flex: 1,
            minWidth: 0,
            color: 'var(--app-text)',
            fontSize: 16,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {room.topicKey
            ? '# ' + t('chat.topics.' + room.topicKey, room.title)
            : room.title || t('chat.untitled')}
        </strong>

        {/* Выход живёт внутри комнаты: снаружи его искать негде,
            а уходят обычно уже изнутри. */}
        {room.kind === 'topic' && onLeave && (
          <button
            type="button"
            onClick={() => {
              if (window.confirm(t('chat.topicLeaveConfirm'))) {
                onLeave();
              }
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              minHeight: 34,
              padding: '0 11px',
              flexShrink: 0,
              border: '1px solid var(--app-border)',
              borderRadius: 11,
              background: 'transparent',
              color: 'var(--app-text-muted)',
              fontSize: 12,
              fontWeight: 700,
              whiteSpace: 'nowrap',
              cursor: 'pointer',
            }}
          >
            <LogOut size={13} />
            {t('chat.topicLeave')}
          </button>
        )}
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
                    {/* В комнате собеседников много: без имени
                        непонятно, кто это сказал. В личном диалоге
                        оно лишнее — там их двое. */}
                    {!mine && room.kind === 'topic' && (
                      <span
                        style={{
                          display: 'block',
                          marginBottom: 3,
                          color: 'var(--app-accent)',
                          fontSize: 11.5,
                          fontWeight: 700,
                        }}
                      >
                        {authors[message.authorUserId] ?? ''}
                      </span>
                    )}
                    <div
                      onTouchStart={() => startPress(message)}
                      onTouchEnd={cancelPress}
                      onTouchMove={cancelPress}
                      onTouchCancel={cancelPress}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        setActionsFor(message);
                      }}
                      style={{
                        // Своё выделение и своё меню телефона здесь
                        // выключены: иначе удержание начинает выделять
                        // слова и открывать чужой список вместо нашего.
                        // Взамен в меню есть «Копировать».
                        WebkitTouchCallout: 'none',
                        WebkitUserSelect: 'none',
                        userSelect: 'none',
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
                      {/* Цитата: к чему относится сообщение */}
                      {message.replyToId && replies[message.replyToId] && (
                        <span
                          style={{
                            display: 'block',
                            padding: '6px 9px',
                            marginBottom: 7,
                            borderLeft: '3px solid var(--app-accent)',
                            borderRadius: '4px 9px 9px 4px',
                            background: 'rgba(var(--app-accent-rgb), 0.09)',
                            color: 'var(--app-text-muted)',
                            fontSize: 12.5,
                            lineHeight: 1.45,
                            maxHeight: 54,
                            overflow: 'hidden',
                          }}
                        >
                          {quoteOf(replies[message.replyToId], t)}
                        </span>
                      )}

                      {message.imageUrl && (
                        <a
                          href={message.imageUrl}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <img
                            src={message.imageUrl}
                            alt=""
                            loading="lazy"
                            style={{
                              display: 'block',
                              maxWidth: '100%',
                              maxHeight: 320,
                              borderRadius: 10,
                              marginBottom: message.text ? 7 : 0,
                            }}
                          />
                        </a>
                      )}

                      {(message.audioUrl || message.playOnce) && (
                        <span
                          onClick={(event) => event.stopPropagation()}
                          style={{
                            display: 'block',
                            marginBottom: message.text ? 7 : 0,
                          }}
                        >
                          <ChatAudioMessage
                            message={message}
                            mine={mine}
                            onBurned={() => void reload()}
                          />
                        </span>
                      )}

                      {message.text}
                    </div>

                    {(reactions[message.id]?.length ?? 0) > 0 && (
                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          justifyContent: mine ? 'flex-end' : 'flex-start',
                          gap: 4,
                          marginTop: 4,
                        }}
                      >
                        {reactions[message.id].map((item) => (
                          <button
                            key={item.emoji}
                            type="button"
                            onClick={() => void react(message.id, item.emoji)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              minHeight: 26,
                              padding: '0 8px',
                              border: item.mine
                                ? '1px solid var(--app-accent)'
                                : '1px solid var(--app-border)',
                              borderRadius: 13,
                              background: item.mine
                                ? 'rgba(var(--app-accent-rgb), 0.14)'
                                : 'var(--app-panel)',
                              color: 'var(--app-text-muted)',
                              fontSize: 13,
                              cursor: 'pointer',
                            }}
                          >
                            {item.emoji}
                            {item.count > 1 && (
                              <span style={{ fontSize: 11, fontWeight: 700 }}>
                                {item.count}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}

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

                      {/*
                        Своя кнопка действий у каждого сообщения.
                        Нажатие по самому пузырю тоже открывает их, но
                        снимок по нажатию раскрывается, а проигрыватель
                        играет — и в сообщении, где кроме вложения
                        ничего нет, нажать становится некуда. Тогда
                        своё же сообщение нельзя ни изменить, ни убрать.
                      */}
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setActionsFor(message);
                        }}
                        aria-label={t('chat.actions')}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 26,
                          height: 22,
                          padding: 0,
                          border: 0,
                          borderRadius: 7,
                          background: 'transparent',
                          color: 'var(--app-text-muted)',
                          cursor: 'pointer',
                        }}
                      >
                        <MoreHorizontal size={15} />
                      </button>
                    </p>

                  </div>
                </div>
              </div>
            );
          })
        )}

        {typing && (
          <p
            style={{
              margin: '2px 4px 0',
              color: 'var(--app-text-muted)',
              fontSize: 12,
              fontStyle: 'italic',
            }}
          >
            {t('chat.typing')}
          </p>
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

      {showEmoji && !isRecording && (
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

      {replyTo && !isRecording && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '8px 11px',
            marginBottom: 7,
            borderLeft: '3px solid var(--app-accent)',
            borderRadius: '4px 12px 12px 4px',
            background: 'rgba(var(--app-accent-rgb), 0.1)',
          }}
        >
          <span style={{ flex: 1, minWidth: 0 }}>
            <span
              style={{
                display: 'block',
                color: 'var(--app-accent)',
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              {t('chat.replyTo')}
            </span>

            <span
              style={{
                display: 'block',
                marginTop: 2,
                color: 'var(--app-text-muted)',
                fontSize: 12.5,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {quoteOf(
                {
                  id: replyTo.id,
                  authorUserId: replyTo.authorUserId,
                  text: replyTo.text,
                  kind:
                    replyTo.audioUrl || replyTo.playOnce
                      ? 'audio'
                      : replyTo.imageUrl
                        ? 'image'
                        : 'text',
                },
                t,
              )}
            </span>
          </span>

          <button
            type="button"
            onClick={() => setReplyTo(null)}
            aria-label={t('common.cancel')}
            style={{
              display: 'inline-flex',
              flexShrink: 0,
              border: 0,
              background: 'transparent',
              color: 'var(--app-text-muted)',
              cursor: 'pointer',
            }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Прикреплённое: видно до отправки, каждое можно убрать */}
      {hasAttachments && !isRecording && (
        <div
          style={{
            padding: '10px 12px',
            marginBottom: 8,
            border: '1px solid var(--app-border)',
            borderRadius: 14,
            background: 'var(--app-panel)',
          }}
        >
          <p
            style={{
              margin: '0 0 8px',
              color: 'var(--app-text-muted)',
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            {t('chat.attached')}
          </p>

          {photos.length > 0 && (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 8,
                marginBottom: voice ? 10 : 0,
              }}
            >
              {photos.map((photo) => (
                <span
                  key={photo.id}
                  style={{ position: 'relative', display: 'inline-flex' }}
                >
                  <img
                    src={photo.previewUrl}
                    alt=""
                    style={{
                      width: 68,
                      height: 68,
                      objectFit: 'cover',
                      borderRadius: 11,
                      border: '1px solid var(--app-border)',
                    }}
                  />

                  <button
                    type="button"
                    onClick={() => removePhoto(photo.id)}
                    aria-label={t('chat.removeAttachment')}
                    style={{
                      position: 'absolute',
                      top: -6,
                      right: -6,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 22,
                      height: 22,
                      border: 0,
                      borderRadius: '50%',
                      background: 'var(--app-accent)',
                      color: '#17151c',
                      cursor: 'pointer',
                    }}
                  >
                    <X size={13} />
                  </button>
                </span>
              ))}
            </div>
          )}

          {voice && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 9,
              }}
            >
              {/* Обычный проигрыватель браузера: до отправки важнее
                  всего, чтобы человек сразу понял, как переслушать. */}
              <audio
                src={voice.previewUrl}
                controls
                preload="metadata"
                style={{ height: 38, maxWidth: '100%' }}
              />

              <button
                type="button"
                onClick={() => setPlayOnce((value) => !value)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  minHeight: 34,
                  padding: '0 11px',
                  border: playOnce
                    ? '1px solid var(--app-accent)'
                    : '1px solid var(--app-border)',
                  borderRadius: 11,
                  background: playOnce
                    ? 'rgba(var(--app-accent-rgb), 0.14)'
                    : 'transparent',
                  color: playOnce
                    ? 'var(--app-accent)'
                    : 'var(--app-text-muted)',
                  fontSize: 12,
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                }}
              >
                <Flame size={13} />
                {t('chat.once')}
              </button>

              <button
                type="button"
                onClick={removeVoice}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  minHeight: 34,
                  padding: '0 11px',
                  border: '1px solid var(--app-border)',
                  borderRadius: 11,
                  background: 'transparent',
                  color: 'var(--app-text-muted)',
                  fontSize: 12,
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                }}
              >
                <Trash2 size={13} />
                {t('chat.delete')}
              </button>
            </div>
          )}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={(event) => {
          const chosen: File[] = event.target.files
            ? Array.from(event.target.files)
            : [];

          // Сбрасываем сразу: иначе повторный выбор того же файла
          // не вызовет события, и ничего не произойдёт.
          event.target.value = '';

          if (chosen.length > 0) {
            void attachPhotos(chosen);
          }
        }}
      />

      {actionsFor && (
        <ChatMessageActions
          message={actionsFor}
          mine={isMine(actionsFor)}
          reactions={reactions[actionsFor.id] ?? []}
          onClose={() => setActionsFor(null)}
          onReply={() => {
            setReplyTo(actionsFor);
            setActionsFor(null);
          }}
          onReact={(emoji) => void react(actionsFor.id, emoji)}
          onEdit={() => {
            startEdit(actionsFor);
            setActionsFor(null);
          }}
          onDelete={() => {
            const target = actionsFor;
            setActionsFor(null);
            void remove(target.id);
          }}
          onReport={() => {
            const target = actionsFor;
            setActionsFor(null);
            void report(target.id);
          }}
        />
      )}

      {isRecording ? (
        /* Полоса записи: подписи словами, а не одни значки */
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 9,
            minHeight: 44,
          }}
        >
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              color: 'var(--app-text)',
              fontSize: 14,
              fontWeight: 700,
            }}
          >
            <span
              style={{
                width: 11,
                height: 11,
                borderRadius: '50%',
                background: 'var(--app-accent-warm)',
              }}
            />
            {t('chat.recording')}
          </span>

          <span
            style={{
              color: 'var(--app-text-muted)',
              fontSize: 14,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {formatDuration(recordSeconds) +
              ' / ' +
              formatDuration(MAX_RECORD_SECONDS)}
          </span>

          <button
            type="button"
            onClick={() => stopRecording(false)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              minHeight: 44,
              padding: '0 14px',
              marginLeft: 'auto',
              border: '1px solid var(--app-border)',
              borderRadius: 13,
              background: 'transparent',
              color: 'var(--app-text-muted)',
              fontSize: 14,
              fontWeight: 700,
              whiteSpace: 'nowrap',
              cursor: 'pointer',
            }}
          >
            <X size={16} />
            {t('common.cancel')}
          </button>

          <button
            type="button"
            onClick={() => stopRecording(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              minHeight: 44,
              padding: '0 16px',
              border: 0,
              borderRadius: 13,
              background: 'var(--app-accent)',
              color: '#17151c',
              fontSize: 14,
              fontWeight: 700,
              whiteSpace: 'nowrap',
              cursor: 'pointer',
            }}
          >
            <Square size={15} />
            {t('chat.stop')}
          </button>
        </div>
      ) : (
        /* Поле ввода */
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
            style={roundButton(showEmoji)}
          >
            <Smile size={19} />
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isSending}
            aria-label={t('chat.photo')}
            style={roundButton(false, isSending)}
          >
            <ImagePlus size={19} />
          </button>

          <button
            type="button"
            onClick={() => void startRecording()}
            disabled={isSending}
            aria-label={t('chat.record')}
            style={roundButton(false, isSending)}
          >
            <Mic size={19} />
          </button>

          <textarea
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              notifyTyping();
            }}
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
            placeholder={
              hasAttachments ? t('chat.captionHint') : t('chat.placeholder')
            }
            style={{
              flex: 1,
              minWidth: 0,
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
            disabled={!canSend || isSending}
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
              cursor: canSend && !isSending ? 'pointer' : 'default',
              opacity: canSend && !isSending ? 1 : 0.45,
            }}
          >
            {editingId ? <Check size={19} /> : <Send size={18} />}
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Что показать в цитате.
 *
 * У вложения текста может не быть вовсе — тогда вместо пустоты
 * пишем, что именно цитируют.
 */
function quoteOf(
  preview: ChatReplyPreview,
  t: (key: string) => string,
): string {
  if (preview.text) {
    return preview.text;
  }

  if (preview.kind === 'audio') {
    return '🎤 ' + t('chat.voice');
  }

  if (preview.kind === 'image') {
    return '📷 ' + t('chat.photo');
  }

  return t('chat.deletedQuote');
}

function roundButton(isActive: boolean, isBusy = false): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
    height: 44,
    flexShrink: 0,
    border: '1px solid var(--app-border)',
    borderRadius: 13,
    background: 'transparent',
    color: isActive ? 'var(--app-accent)' : 'var(--app-text-muted)',
    cursor: isBusy ? 'default' : 'pointer',
    opacity: isBusy ? 0.5 : 1,
  };
}

export default ChatConversation;
