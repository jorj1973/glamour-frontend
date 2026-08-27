import { useState } from 'react';
import { Copy, Download, Flag, Pencil, Trash2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { ChatMessage } from '../api/chat';

type Props = {
  message: ChatMessage;
  /** Своё сообщение: его можно изменить и удалить, но не обжаловать. */
  mine: boolean;
  onClose: () => void;
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
 * Снизу, а не рядом с пузырём: на телефоне до нижней половины экрана
 * дотягивается большой палец, а список у самого сообщения приходится
 * ловить, и половина попаданий уходит мимо.
 *
 * «Копировать» здесь обязательный: чтобы удержание открывало это меню,
 * пришлось отключить обычное выделение текста в пузыре — иначе iPhone
 * начинает выделять слова. Без этого пункта из сообщения нельзя было бы
 * забрать адрес или телефон.
 */
function ChatMessageActions({
  message,
  mine,
  onClose,
  onEdit,
  onDelete,
  onReport,
}: Props) {
  const { t } = useTranslation();

  const [copied, setCopied] = useState(false);

  const fileUrl = message.imageUrl ?? message.audioUrl;

  async function copyText() {
    if (!message.text) {
      return;
    }

    try {
      await navigator.clipboard.writeText(message.text);
      setCopied(true);

      // Закрываем не сразу: человек должен увидеть, что получилось.
      setTimeout(onClose, 700);
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
        alignItems: 'flex-end',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.55)',
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 520,
          padding: 16,
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
          borderRadius: '20px 20px 0 0',
          background: 'var(--app-panel)',
          border: '1px solid var(--app-border)',
          borderBottom: 0,
        }}
      >
        {message.text && (
          <p
            style={{
              margin: '0 0 12px',
              color: 'var(--app-text-muted)',
              fontSize: 13,
              lineHeight: 1.5,
              maxHeight: 66,
              overflow: 'hidden',
            }}
          >
            {message.text}
          </p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {message.text && (
            <button type="button" onClick={() => void copyText()} style={row}>
              <Copy size={17} color="var(--app-accent)" />
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
              <Download size={17} color="var(--app-accent)" />
              {t('chat.save')}
            </a>
          )}

          {mine && message.text && (
            <button type="button" onClick={onEdit} style={row}>
              <Pencil size={17} color="var(--app-accent)" />
              {t('chat.edit')}
            </button>
          )}

          {mine ? (
            <button
              type="button"
              onClick={onDelete}
              style={{ ...row, color: 'var(--app-accent-warm)' }}
            >
              <Trash2 size={17} />
              {t('chat.delete')}
            </button>
          ) : (
            <button type="button" onClick={onReport} style={row}>
              <Flag size={17} color="var(--app-accent-warm)" />
              {t('chat.report')}
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            style={{
              ...row,
              justifyContent: 'center',
              marginTop: 6,
              color: 'var(--app-text-muted)',
            }}
          >
            <X size={16} />
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
}

const row = {
  display: 'flex',
  alignItems: 'center',
  gap: 11,
  width: '100%',
  minHeight: 50,
  padding: '0 15px',
  border: '1px solid var(--app-border)',
  borderRadius: 13,
  background: 'transparent',
  color: 'var(--app-text)',
  fontSize: 15,
  fontWeight: 700,
  textAlign: 'left' as const,
  cursor: 'pointer',
};

export default ChatMessageActions;
