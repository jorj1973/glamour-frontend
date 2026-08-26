import { useEffect, useState } from 'react';
import { CalendarDays, Clock, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../api/api';
import { getErrorKey } from '../api/errorMessage';

type Slot = { startTime: string; endTime: string };

type Props = {
  appointment: {
    id: string;
    masterProfileId: string;
    startTime: string;
    endTime: string;
  };
  onClose: () => void;
  onDone: () => void;
  /**
   * Салон и мастер переносят запись в любое время: ограничение
   * в два часа придумано против поздних отмен клиентом, а не
   * против работы администратора.
   */
  allowLate?: boolean;
};

/** За сколько часов до визита перенос ещё разрешён. */
const RESCHEDULE_HOURS = 2;

/** На сколько дней вперёд предлагаем выбрать дату. */
const DAYS_AHEAD = 30;

function toDateInput(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');

  return year + '-' + month + '-' + day;
}

/**
 * Перенос записи клиентом.
 *
 * Раньше клиент мог только отменить: если время не подходило, запись
 * пропадала совсем, хотя человек был готов прийти в другой день.
 *
 * Длительность берём из самой записи, а не из услуги: мастер мог
 * изменить её вручную, и переносить нужно ровно столько времени,
 * сколько занято сейчас.
 */
function RescheduleDialog({
  appointment,
  onClose,
  onDone,
  allowLate = false,
}: Props) {
  const { t } = useTranslation();

  const today = new Date();

  const [date, setDate] = useState(toDateInput(today));
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selected, setSelected] = useState<Slot | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const durationMinutes = Math.max(
    5,
    Math.round(
      (new Date(appointment.endTime).getTime() -
        new Date(appointment.startTime).getTime()) /
        60000,
    ),
  );

  const maxDate = toDateInput(
    new Date(today.getTime() + DAYS_AHEAD * 86400000),
  );

  useEffect(() => {
    void loadSlots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  async function loadSlots() {
    setIsLoading(true);
    setSelected(null);
    setErrorMsg('');

    try {
      const res = await api.post<Slot[]>('/appointments/available-slots', {
        masterProfileId: appointment.masterProfileId,
        date,
        slotMinutes: durationMinutes,
      });

      // Прошедшее время показывать нельзя: в списке на сегодня
      // иначе окажутся часы, которые уже прошли.
      const now = Date.now();

      setSlots(
        res.data.filter((slot) => new Date(slot.startTime).getTime() > now),
      );
    } catch (error) {
      setSlots([]);
      setErrorMsg(t(getErrorKey(error)));
    } finally {
      setIsLoading(false);
    }
  }

  async function submit() {
    if (!selected) {
      return;
    }

    setIsSaving(true);
    setErrorMsg('');

    try {
      await api.patch('/appointments/' + appointment.id + '/reschedule', {
        startTime: selected.startTime,
        endTime: selected.endTime,
      });

      onDone();
    } catch (error) {
      setErrorMsg(t(getErrorKey(error)));
    } finally {
      setIsSaving(false);
    }
  }

  function formatTime(value: string) {
    return new Date(value).toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  const hoursLeft =
    (new Date(appointment.startTime).getTime() - Date.now()) / 3600000;

  const isTooLate = !allowLate && hoursLeft < RESCHEDULE_HOURS;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 90,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.55)',
        padding: 0,
      }}
      onClick={onClose}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 520,
          maxHeight: '86vh',
          overflowY: 'auto',
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
            marginBottom: 6,
          }}
        >
          <strong style={{ color: 'var(--app-text)', fontSize: 17 }}>
            {t('reschedule.title')}
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

        {isTooLate ? (
          <p
            style={{
              color: 'var(--app-accent-warm)',
              fontSize: 14,
              lineHeight: 1.55,
              marginTop: 10,
            }}
          >
            {t('reschedule.tooLate', { hours: RESCHEDULE_HOURS })}
          </p>
        ) : (
          <>
            <p
              style={{
                color: 'var(--app-text-muted)',
                fontSize: 13,
                lineHeight: 1.55,
                marginBottom: 16,
              }}
            >
              {t('reschedule.hint')}
            </p>

            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 9,
                color: 'var(--app-text-muted)',
                fontSize: 12,
                fontWeight: 700,
                marginBottom: 8,
              }}
            >
              <CalendarDays size={14} color="var(--app-accent)" />
              {t('reschedule.pickDate')}
            </label>

            <input
              type="date"
              value={date}
              min={toDateInput(today)}
              max={maxDate}
              onChange={(event) => setDate(event.target.value)}
              style={{
                width: '100%',
                minHeight: 46,
                padding: '0 12px',
                borderRadius: 13,
                border: '1px solid var(--app-border)',
                background: 'var(--app-input)',
                color: 'var(--app-text)',
                fontSize: 15,
              }}
            />

            <p
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                color: 'var(--app-text-muted)',
                fontSize: 12,
                fontWeight: 700,
                margin: '18px 0 8px',
              }}
            >
              <Clock size={14} color="var(--app-accent)" />
              {t('reschedule.pickTime')}
            </p>

            {isLoading ? (
              <p style={{ color: 'var(--app-text-muted)', fontSize: 13 }}>
                {t('common.loading')}
              </p>
            ) : slots.length === 0 ? (
              <p style={{ color: 'var(--app-text-muted)', fontSize: 13, lineHeight: 1.55 }}>
                {t('reschedule.noSlots')}
              </p>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(84px, 1fr))',
                  gap: 8,
                }}
              >
                {slots.map((slot) => {
                  const isActive = selected?.startTime === slot.startTime;

                  return (
                    <button
                      key={slot.startTime}
                      type="button"
                      onClick={() => setSelected(slot)}
                      style={{
                        minHeight: 44,
                        borderRadius: 12,
                        border: isActive
                          ? '1px solid var(--app-accent)'
                          : '1px solid var(--app-border)',
                        background: isActive
                          ? 'rgba(var(--app-accent-rgb), 0.14)'
                          : 'transparent',
                        color: isActive
                          ? 'var(--app-accent)'
                          : 'var(--app-text)',
                        fontSize: 14,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {formatTime(slot.startTime)}
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}

        {errorMsg && (
          <p
            style={{
              marginTop: 14,
              color: 'var(--app-accent-warm)',
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            {errorMsg}
          </p>
        )}

        <div style={{ display: 'flex', gap: 9, marginTop: 20 }}>
          {!isTooLate && (
            <button
              type="button"
              disabled={!selected || isSaving}
              onClick={() => void submit()}
              style={{
                flex: 1,
                minHeight: 48,
                border: 0,
                borderRadius: 14,
                background: 'var(--app-accent)',
                color: '#17151c',
                fontSize: 15,
                fontWeight: 700,
                cursor: selected && !isSaving ? 'pointer' : 'default',
                opacity: selected && !isSaving ? 1 : 0.5,
              }}
            >
              {t('reschedule.confirm')}
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            style={{
              flex: isTooLate ? 1 : 0,
              minWidth: 110,
              minHeight: 48,
              border: '1px solid var(--app-border)',
              borderRadius: 14,
              background: 'transparent',
              color: 'var(--app-text-muted)',
              fontSize: 15,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default RescheduleDialog;
