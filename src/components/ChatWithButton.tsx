import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { MessageCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { getErrorKey } from '../api/errorMessage';
import {
  fetchChatAvailability,
  openDirectRoom,
  rememberRoomToOpen,
} from '../api/chat';
import type { ChatAvailability } from '../api/chat';

/** Адрес экрана общения. */
const CHAT_HASH = '#chat';

/**
 * Один запрос доступности на всю страницу.
 *
 * Кнопка стоит на каждой карточке мастера, а ответ для всех
 * одинаковый: без общего обещания список из десяти мастеров
 * послал бы десять одинаковых запросов.
 */
let availabilityPromise: Promise<ChatAvailability> | null = null;

function loadAvailability(): Promise<ChatAvailability> {
  const pending: Promise<ChatAvailability> =
    availabilityPromise ??
    fetchChatAvailability().catch(() => ({
      enabled: false,
      salonId: null,
    }));

  availabilityPromise = pending;

  return pending;
}

type Props = {
  /** Профиль мастера — то, что знает публичная карточка. */
  masterProfileId?: string;
  /** Учётная запись собеседника, когда она известна. */
  userId?: string;
  /** Салон, внутри которого идёт разговор. */
  salonId?: string | null;
  /** Растянуть на всю ширину — для колонки кнопок на карточке. */
  block?: boolean;
  /** Мелкая — для ряда действий под записью, рядом с «Перенести». */
  small?: boolean;
  /** Дополнение к оформлению — отступ на месте вставки. */
  style?: CSSProperties;
};

/**
 * Кнопка «Написать».
 *
 * Показываем только там, где общение включено и разрешено: кнопка,
 * которая на нажатие отвечает отказом, хуже отсутствующей.
 */
function ChatWithButton({
  masterProfileId,
  userId,
  salonId,
  block = false,
  small = false,
  style,
}: Props) {
  const { t } = useTranslation();

  const [availability, setAvailability] = useState<ChatAvailability | null>(
    null,
  );
  const [isOpening, setIsOpening] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    let alive = true;

    void loadAvailability().then((value) => {
      if (alive) {
        setAvailability(value);
      }
    });

    return () => {
      alive = false;
    };
  }, []);

  const roomSalonId = salonId ?? availability?.salonId ?? null;

  if (!availability?.enabled || !roomSalonId) {
    return null;
  }

  if (!userId && !masterProfileId) {
    return null;
  }

  async function open() {
    if (!roomSalonId || isOpening) {
      return;
    }

    setIsOpening(true);
    setErrorMsg('');

    try {
      const roomId = await openDirectRoom({
        salonId: roomSalonId,
        userId,
        masterProfileId,
      });

      rememberRoomToOpen(roomId);
      window.location.hash = CHAT_HASH;
    } catch (error) {
      setErrorMsg(t(getErrorKey(error)));
    } finally {
      setIsOpening(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => void open()}
        disabled={isOpening}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: small ? 6 : 7,
          width: block ? '100%' : undefined,
          minHeight: small ? 34 : 44,
          padding: small ? '0 12px' : '0 15px',
          border: '1px solid var(--app-border)',
          borderRadius: small ? 10 : 13,
          background: 'transparent',
          color: 'var(--app-text)',
          fontSize: small ? 12 : 14,
          fontWeight: 700,
          whiteSpace: 'nowrap',
          cursor: isOpening ? 'default' : 'pointer',
          opacity: isOpening ? 0.6 : 1,
          ...style,
        }}
      >
        <MessageCircle size={small ? 13 : 16} color="var(--app-accent)" />
        {t('chat.write')}
      </button>

      {errorMsg && (
        <p
          style={{
            color: 'var(--app-accent-warm)',
            fontSize: 12,
            lineHeight: 1.5,
            marginTop: 6,
          }}
        >
          {errorMsg}
        </p>
      )}
    </>
  );
}

export default ChatWithButton;
