import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { getErrorKey } from '../api/errorMessage';
import { fetchChatCompanions, openDirectRoom } from '../api/chat';
import type { ChatCompanion } from '../api/chat';

type Props = {
  onClose: () => void;
  /** Беседа заведена — открыть её. */
  onOpened: (roomId: string) => void;
};

/**
 * Выбор собеседника.
 *
 * Раньше беседу можно было начать только с карточки мастера, и экран
 * общения у нового человека открывался пустым: список бесед, которых
 * нет, и подпись, куда идти. Теперь начать разговор можно отсюда.
 *
 * Список приходит с сервера уже отфильтрованным по правилам: клиент
 * видит мастеров, у которых был, мастер — своих клиентов и коллег.
 */
function ChatCompanionPicker({ onClose, onOpened }: Props) {
  const { t } = useTranslation();

  const [people, setPeople] = useState<ChatCompanion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    let alive = true;

    void fetchChatCompanions()
      .then((list) => {
        if (alive) {
          setPeople(list);
        }
      })
      .catch((error) => {
        if (alive) {
          setErrorMsg(t(getErrorKey(error)));
        }
      })
      .finally(() => {
        if (alive) {
          setIsLoading(false);
        }
      });

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function open(person: ChatCompanion) {
    if (openingId) {
      return;
    }

    setOpeningId(person.userId);
    setErrorMsg('');

    try {
      const roomId = await openDirectRoom({
        salonId: person.salonId,
        userId: person.userId,
      });

      onOpened(roomId);
    } catch (error) {
      setErrorMsg(t(getErrorKey(error)));
      setOpeningId(null);
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
        zIndex: 95,
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
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 20,
          borderRadius: '20px 20px 0 0',
          background: 'var(--app-panel)',
          border: '1px solid var(--app-border)',
          borderBottom: 0,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            marginBottom: 14,
          }}
        >
          <strong style={{ color: 'var(--app-text)', fontSize: 17 }}>
            {t('chat.newTitle')}
          </strong>

          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 38,
              height: 38,
              border: '1px solid var(--app-border)',
              borderRadius: 12,
              background: 'transparent',
              color: 'var(--app-text-muted)',
              cursor: 'pointer',
            }}
          >
            <X size={17} />
          </button>
        </div>

        {errorMsg && (
          <p
            style={{
              color: 'var(--app-accent-warm)',
              fontSize: 13,
              fontWeight: 700,
              margin: '0 0 12px',
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
          ) : people.length === 0 ? (
            <p
              style={{
                color: 'var(--app-text-muted)',
                fontSize: 13,
                lineHeight: 1.6,
                padding: '20px 0',
              }}
            >
              {t('chat.noCompanions')}
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {people.map((person) => (
                <button
                  key={person.userId}
                  type="button"
                  disabled={Boolean(openingId)}
                  onClick={() => void open(person)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    width: '100%',
                    minHeight: 60,
                    padding: '10px 13px',
                    border: '1px solid var(--app-border)',
                    borderRadius: 15,
                    background: 'transparent',
                    textAlign: 'left',
                    cursor: openingId ? 'default' : 'pointer',
                    opacity: openingId && openingId !== person.userId ? 0.5 : 1,
                  }}
                >
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 40,
                      height: 40,
                      flexShrink: 0,
                      borderRadius: '50%',
                      background: 'rgba(var(--app-accent-rgb), 0.16)',
                      color: 'var(--app-accent-text)',
                      fontSize: 15,
                      fontWeight: 700,
                    }}
                  >
                    {(person.name || '?').trim().charAt(0).toUpperCase()}
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
                      {person.name}
                    </span>

                    <span
                      style={{
                        display: 'block',
                        color: 'var(--app-text-muted)',
                        fontSize: 12,
                        marginTop: 3,
                      }}
                    >
                      {t('chat.kind.' + person.kind)}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ChatCompanionPicker;
