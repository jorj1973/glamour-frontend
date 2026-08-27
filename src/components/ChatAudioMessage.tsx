import { useEffect, useRef, useState } from 'react';
import { Flame, Pause, Play } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { formatDuration } from '../api/chatMedia';
import { markAudioPlayed } from '../api/chat';
import type { ChatMessage } from '../api/chat';

type Props = {
  message: ChatMessage;
  /** Своё сообщение — рисуем в цветах отправителя. */
  mine: boolean;
  /** Одноразовое сгорело — обновить ленту. */
  onBurned: () => void;
};

/**
 * Голосовое сообщение.
 *
 * Свой проигрыватель, а не голый элемент браузера: у него в каждом
 * браузере свой вид и своя ширина, и в ленте сообщений это выглядит
 * как заплатка. Здесь нужно немногое — кнопка, полоса и время.
 */
function ChatAudioMessage({ message, mine, onBurned }: Props) {
  const { t } = useTranslation();

  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);

  const total = message.audioSeconds ?? 0;

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  /**
   * Одноразовое уже прослушано: файла нет, остался только след.
   *
   * Показываем его, а не прячем сообщение совсем — иначе из
   * разговора будто пропал кусок без объяснения.
   */
  if (message.playOnce && !message.audioUrl) {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          color: 'var(--app-text-muted)',
          fontSize: 13,
          fontStyle: 'italic',
        }}
      >
        <Flame size={15} />
        {t('chat.audioBurned')}
      </span>
    );
  }

  async function toggle() {
    const element = audioRef.current;

    if (!element) {
      return;
    }

    if (isPlaying) {
      element.pause();
      return;
    }

    try {
      await element.play();
    } catch {
      // Браузер может отказать без действия человека — но нажатие
      // и есть действие, поэтому сюда попадаем только при поломке.
    }
  }

  async function handleEnded() {
    setIsPlaying(false);
    setPosition(0);

    if (!message.playOnce || mine) {
      return;
    }

    try {
      await markAudioPlayed(message.id);
      onBurned();
    } catch {
      // Не отметилось — отметится при следующем прослушивании.
    }
  }

  const progress = total > 0 ? Math.min(1, position / total) : 0;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 11,
        minWidth: 190,
      }}
    >
      <audio
        ref={audioRef}
        src={message.audioUrl ?? undefined}
        preload="none"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={(event) =>
          setPosition(event.currentTarget.currentTime)
        }
        onEnded={() => void handleEnded()}
      />

      <button
        type="button"
        onClick={() => void toggle()}
        aria-label={isPlaying ? t('chat.pause') : t('chat.play')}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 36,
          height: 36,
          flexShrink: 0,
          border: 0,
          borderRadius: '50%',
          background: 'var(--app-accent)',
          color: '#17151c',
          cursor: 'pointer',
        }}
      >
        {isPlaying ? <Pause size={16} /> : <Play size={16} />}
      </button>

      <span style={{ flex: 1, minWidth: 0 }}>
        <span
          style={{
            display: 'block',
            height: 4,
            borderRadius: 2,
            background: mine
              ? 'rgba(var(--app-accent-rgb), 0.35)'
              : 'var(--app-border)',
            overflow: 'hidden',
          }}
        >
          <span
            style={{
              display: 'block',
              width: progress * 100 + '%',
              height: '100%',
              background: 'var(--app-accent)',
            }}
          />
        </span>

        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginTop: 5,
            color: 'var(--app-text-muted)',
            fontSize: 11,
          }}
        >
          {formatDuration(isPlaying || position > 0 ? position : total)}

          {message.playOnce && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
                color: 'var(--app-accent)',
                fontWeight: 700,
              }}
            >
              <Flame size={11} />
              {t('chat.onceShort')}
            </span>
          )}
        </span>
      </span>
    </span>
  );
}

export default ChatAudioMessage;
