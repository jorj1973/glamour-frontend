import { useState } from 'react';
import {
  Copy,
  CornerUpLeft,
  Download,
  Flag,
  Pencil,
  Trash2,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { ChatMessage, ChatReaction } from '../api/chat';

/**
 * Быстрые реакции.
 *
 * Шесть штук, как в привычных мессенджерах: ряд должен помещаться
 * в ширину экрана телефона и читаться, не пролистываясь.
 */
const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

type Props = {
  message: ChatMessage;
  /** Своё сообщение: его можно изменить и удалить, но не обжаловать. */
  mine: boolean;
  /** Реакции на это сообщение — чтобы отметить уже поставленную. */
  reactions: ChatReaction[];
  onClose: () => void;
  onReply: () => void;
  onReact: (emoji: string) => void;
  onEdit: () => void;
  onDelete: () => void;
  onReport: () => void;
};

/** Имя файла из ссылки — для сохранения на устройство. */
function fileNameOf(url: string): string {
  const tail = url.split('/').pop();

  return tail && tail.length > 0 ? tail : 'glamour';
}

/**
 * Что можно сделать с сообщением.
 *
 * Список узкий и плотный: прошлый занимал треть экрана и закрывал
 * саму переписку, из-за чего было непонятно, к чему он относится.
 *
 * «Копировать» здесь обязательный: чтобы удержание открывало это меню,
 * пришлось отключить обычное выделение текста в пузыре — иначе iPhone
 * начинает выделять слова. Без этого пункта из сообщения нельзя было бы
 * забрать адрес или телефон.
 */
function ChatMessageActions({
  message,
  mine,
  reactions,
  onClose,
  onReply,
  onReact,
  onEdit,
  onDelete,
  onReport,
}: Props) {
  const { t } = useTranslation();

  const [copied, setCopied] = useState(false);

  const fileUrl = message.imageUrl ?? message.audioUrl;
  const myReaction = reactions.find((item) => item.mine)?.emoji ?? null;

  async function copyText() {
    if (!message.text) {
      return;
    }

    try {
      await navigator.clipboard.writeText(message.text);
      setCopied(true);

      // Закрываем не сразу: человек должен увидеть, что получилось.
      setTimeout(onClose, 600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 96,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        background: 'rgba(0, 0, 0, 0.45)',
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          width: '100%',
          maxWidth: 260,
        }}
      >
        {/* Ряд быстрых реакций — над меню, как принято */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2,
            padding: 6,
            borderRadius: 22,
            border: '1px solid var(--app-border)',
            background: 'var(--app-panel)',
            boxShadow: '0 12px 32px var(--app-shadow)',
          }}
        >
          {QUICK_REACTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => onReact(emoji)}
              aria-label={emoji}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 34,
                height: 34,
                border: 0,
                borderRadius: '50%',
                background:
                  myReaction === emoji
                    ? 'rgba(var(--app-accent-rgb), 0.22)'
                    : 'transparent',
                fontSize: 19,
                lineHeight: 1,
                cursor: 'pointer',
              }}
            >
              {emoji}
            </button>
          ))}
        </div>

        {/* Сами действия */}
        <div
          style={{
            overflow: 'hidden',
            borderRadius: 14,
            border: '1px solid var(--app-border)',
            background: 'var(--app-panel)',
            boxShadow: '0 12px 32px var(--app-shadow)',
          }}
        >
          <button type="button" onClick={onReply} style={row}>
            <CornerUpLeft size={16} color="var(--app-accent)" />
            {t('chat.reply')}
          </button>

          {message.text && (
            <button type="button" onClick={() => void copyText()} style={row}>
              <Copy size={16} color="var(--app-accent)" />
              {copied ? t('chat.copied') : t('chat.copy')}
            </button>
          )}

          {fileUrl && (
            <a
              href={fileUrl}
              download={fileNameOf(fileUrl)}
              onClick={onClose}
              style={{ ...row, textDecoration: 'none' }}
            >
              <Download size={16} color="var(--app-accent)" />
              {t('chat.save')}
            </a>
          )}

          {mine && message.text && (
            <button type="button" onClick={onEdit} style={row}>
              <Pencil size={16} color="var(--app-accent)" />
              {t('chat.edit')}
            </button>
          )}

          {mine ? (
            <button
              type="button"
              onClick={onDelete}
              style={{ ...row, color: 'var(--app-accent-warm)', border: 0 }}
            >
              <Trash2 size={16} />
              {t('chat.delete')}
            </button>
          ) : (
            <button
              type="button"
              onClick={onReport}
              style={{ ...row, border: 0 }}
            >
              <Flag size={16} color="var(--app-accent-warm)" />
              {t('chat.report')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Строка меню: разделитель снизу, последняя его снимает. */
const row = {
  display: 'flex',
  alignItems: 'center',
  gap: 11,
  width: '100%',
  minHeight: 44,
  padding: '0 14px',
  border: 0,
  borderBottom: '1px solid var(--app-border)',
  background: 'transparent',
  color: 'var(--app-text)',
  fontSize: 14,
  fontWeight: 600,
  textAlign: 'left' as const,
  cursor: 'pointer',
};

export default ChatMessageActions;
