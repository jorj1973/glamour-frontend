import api from './api';

/** Личный диалог или тематическая комната. */
export type ChatRoomKind = 'direct' | 'topic';

/** Строка списка бесед. */
export type ChatRoomSummary = {
  id: string;
  kind: ChatRoomKind;
  title: string;
  /** У комнаты — ключ темы: название переводится по нему. */
  topicKey: string | null;
  companionUserId: string | null;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  unread: number;
};

export type ChatMessage = {
  id: string;
  roomId: string;
  authorUserId: string;
  text: string | null;
  imageUrl: string | null;
  audioUrl: string | null;
  audioSeconds: number | null;
  /** Сгорает после первого прослушивания — выбор отправителя. */
  playOnce: boolean;
  playedAt: string | null;
  /** На какое сообщение это отвечает. */
  replyToId: string | null;
  editedAt: string | null;
  createdAt: string;
};

/** Короткая выжимка сообщения, на которое отвечают. */
export type ChatReplyPreview = {
  id: string;
  authorUserId: string;
  text: string | null;
  kind: 'text' | 'image' | 'audio';
};

/** Сколько раз поставили смайлик и есть ли среди них мой. */
export type ChatReaction = {
  emoji: string;
  count: number;
  mine: boolean;
};

/**
 * Открыт ли человеку чат и в каком салоне.
 *
 * Пункт меню показываем только тем, кому чат открыт: иначе половина
 * людей нажимает и получает отказ.
 */
export type ChatAvailability = {
  enabled: boolean;
  salonId: string | null;
};

export async function fetchChatAvailability(): Promise<ChatAvailability> {
  const res = await api.get<ChatAvailability>('/chat/availability');

  return res.data;
}

export async function fetchChatRooms(): Promise<ChatRoomSummary[]> {
  const res = await api.get<ChatRoomSummary[]>('/chat/rooms');

  return res.data;
}

/** Кем приходится собеседник. */
export type ChatCompanionKind = 'master' | 'client' | 'colleague';

/** Человек, которому разрешено написать. */
export type ChatCompanion = {
  userId: string;
  salonId: string;
  name: string;
  kind: ChatCompanionKind;
};

/**
 * С кем можно завести разговор.
 *
 * Без этого списка начать беседу удавалось только с карточки
 * мастера: экран общения открывался пустым и никуда не вёл.
 */
export async function fetchChatCompanions(): Promise<ChatCompanion[]> {
  const res = await api.get<ChatCompanion[]>('/chat/companions');

  return res.data;
}

/**
 * Открыть диалог.
 *
 * Собеседника указывают учётной записью или профилем мастера:
 * публичная карточка знает только профиль, и раскрывать учётную
 * запись в открытом ответе ради одной кнопки не нужно.
 */
export async function openDirectRoom(payload: {
  salonId: string;
  userId?: string;
  masterProfileId?: string;
}): Promise<string> {
  const res = await api.post<{ roomId: string }>(
    '/chat/rooms/direct',
    payload,
  );

  return res.data.roomId;
}

/**
 * Сообщения и отметка прочтения собеседника.
 *
 * Отметка приходит вместе с лентой, а не отдельным запросом: лента
 * и так перечитывается каждые три секунды, и второй запрос рядом
 * с первым — это удвоенная нагрузка ради одного поля.
 */
export type ChatMessagesPage = {
  messages: ChatMessage[];
  /** До какого времени собеседник всё прочитал. */
  companionLastReadAt: string | null;
  /** Цитируемые сообщения по их же опознанию. */
  replies: Record<string, ChatReplyPreview>;
  /** Реакции по опознанию сообщения. */
  reactions: Record<string, ChatReaction[]>;
  /** Кто смотрит — по нему отличаем своё сообщение от чужого. */
  viewerUserId: string;
  /** Имена авторов: в комнате подписываем каждое сообщение. */
  authors: Record<string, string>;
};

/** Тема салона и участие в ней. */
export type ChatTopic = {
  key: string;
  title: string;
  salonId: string;
  roomId: string | null;
  members: number;
  joined: boolean;
};

/** Найденное сообщение. */
export type ChatSearchHit = {
  messageId: string;
  roomId: string;
  roomTitle: string;
  text: string;
  createdAt: string;
};

export async function fetchChatMessages(
  roomId: string,
  before?: string,
): Promise<ChatMessagesPage> {
  const res = await api.get<ChatMessagesPage | ChatMessage[]>(
    '/chat/rooms/' + roomId + '/messages',
    before ? { params: { before } } : undefined,
  );

  // Прежний сервер отдавал просто список. Пока он не обновлён,
  // переписка должна работать — без отметки прочтения, но работать.
  // Прежний сервер отдавал просто список, а следующий — без цитат
  // и реакций. Пока он не обновлён, переписка должна работать.
  if (Array.isArray(res.data)) {
    return {
      messages: res.data,
      companionLastReadAt: null,
      replies: {},
      reactions: {},
      viewerUserId: '',
      authors: {},
    };
  }

  return {
    ...res.data,
    replies: res.data.replies ?? {},
    reactions: res.data.reactions ?? {},
    viewerUserId: res.data.viewerUserId ?? '',
    authors: res.data.authors ?? {},
  };
}

export async function sendChatMessage(
  roomId: string,
  body: {
    text?: string;
    imageUrl?: string;
    audioUrl?: string;
    audioSeconds?: number;
    playOnce?: boolean;
    replyToId?: string;
  },
): Promise<ChatMessage> {
  const res = await api.post<ChatMessage>(
    '/chat/rooms/' + roomId + '/messages',
    body,
  );

  return res.data;
}

/**
 * Отправить вложение и получить ссылку на него.
 *
 * Отдельным шагом от сообщения: файл едет с телефона по мобильной
 * сети и может идти секунды, а текст должен уходить сразу.
 */
export async function uploadChatAttachment(
  roomId: string,
  file: File,
): Promise<{ url: string; kind: 'image' | 'audio' }> {
  const form = new FormData();

  form.append('file', file);

  const res = await api.post<{ url: string; kind: 'image' | 'audio' }>(
    '/chat/rooms/' + roomId + '/attachment',
    form,
    {
      /**
       * Заголовок ставит браузер, а не мы.
       *
       * К multipart он дописывает границу между частями, и без неё
       * сервер не разберёт форму. Свой заголовок эту границу затрёт,
       * поэтому здесь мы его именно убираем.
       */
      headers: { 'Content-Type': undefined },
    },
  );

  return res.data;
}

/**
 * Поставить или снять реакцию.
 *
 * Одна на человека и сообщение: другой смайлик заменяет прежний,
 * тот же — снимает.
 */
export async function reactToMessage(
  messageId: string,
  emoji: string,
): Promise<void> {
  await api.post('/chat/messages/' + messageId + '/reaction', { emoji });
}

/* ─────────── Темы и поиск ─────────── */

export async function fetchChatTopics(): Promise<ChatTopic[]> {
  const res = await api.get<ChatTopic[]>('/chat/topics');

  return res.data;
}

/** Вступить в тему: комната заводится при первом вступившем. */
export async function joinChatTopic(key: string): Promise<string> {
  const res = await api.post<{ roomId: string }>(
    '/chat/topics/' + key + '/join',
    {},
  );

  return res.data.roomId;
}

export async function leaveChatRoom(roomId: string): Promise<void> {
  await api.post('/chat/rooms/' + roomId + '/leave', {});
}

export async function searchChat(query: string): Promise<ChatSearchHit[]> {
  const res = await api.get<ChatSearchHit[]>('/chat/search', {
    params: { query },
  });

  return res.data;
}

/** Одноразовое голосовое дослушали — сервер стирает файл. */
export async function markAudioPlayed(messageId: string): Promise<void> {
  await api.post('/chat/messages/' + messageId + '/played', {});
}

export async function markChatRoomRead(roomId: string): Promise<void> {
  await api.post('/chat/rooms/' + roomId + '/read', {});
}

export async function fetchChatUnreadCount(): Promise<number> {
  const res = await api.get<{ count: number }>('/chat/unread-count');

  return res.data.count;
}

export async function editChatMessage(
  messageId: string,
  text: string,
): Promise<ChatMessage> {
  const res = await api.patch<ChatMessage>('/chat/messages/' + messageId, {
    text,
  });

  return res.data;
}

export async function deleteChatMessage(messageId: string): Promise<void> {
  await api.delete('/chat/messages/' + messageId);
}

export async function reportChatMessage(
  messageId: string,
  reason?: string,
): Promise<void> {
  await api.post('/chat/messages/' + messageId + '/report', { reason });
}

/**
 * Беседа, которую нужно открыть сразу после перехода на экран чата.
 *
 * Кнопка «Написать» стоит на карточке мастера — на другом экране.
 * Через хранилище вкладки, а не через адрес: адрес разбирает
 * маршрутизатор, и лишний параметр в нём легко потерять при переходе.
 */
const PENDING_ROOM_KEY = 'glamour.chat.openRoom';

export function rememberRoomToOpen(roomId: string): void {
  try {
    sessionStorage.setItem(PENDING_ROOM_KEY, roomId);
  } catch {
    // Приватный режим может запретить запись — тогда чат просто
    // откроется на списке бесед.
  }
}

export function takeRoomToOpen(): string | null {
  try {
    const roomId = sessionStorage.getItem(PENDING_ROOM_KEY);

    sessionStorage.removeItem(PENDING_ROOM_KEY);

    return roomId;
  } catch {
    return null;
  }
}
