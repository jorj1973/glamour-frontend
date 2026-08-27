import api from './api';

/** Личный диалог или тематическая комната. */
export type ChatRoomKind = 'direct' | 'topic';

/** Строка списка бесед. */
export type ChatRoomSummary = {
  id: string;
  kind: ChatRoomKind;
  title: string;
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
  editedAt: string | null;
  createdAt: string;
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
  return Array.isArray(res.data)
    ? { messages: res.data, companionLastReadAt: null }
    : res.data;
}

export async function sendChatMessage(
  roomId: string,
  body: { text?: string; imageUrl?: string },
): Promise<ChatMessage> {
  const res = await api.post<ChatMessage>(
    '/chat/rooms/' + roomId + '/messages',
    body,
  );

  return res.data;
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
