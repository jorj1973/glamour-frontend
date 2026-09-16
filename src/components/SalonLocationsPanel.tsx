import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Building2, Check, Plus } from 'lucide-react';

import api from '../api/api';

/**
 * Филиалы салона на странице «О салоне».
 *
 * Список всегда начинается с самого салона: его адрес правится в форме
 * выше, и здесь он показан только чтобы счёт по тарифу был понятен.
 * Тариф пишет «Филиалы: 3» — это три адреса вместе с салоном, и человек
 * должен видеть, что первый уже занят.
 *
 * Панель стоит отдельным блоком после формы салона, а не внутри неё:
 * у каждого филиала своё сохранение, а форма внутри формы — не форма.
 *
 * Чего здесь нет, честно: часов работы филиала и выбора филиала при
 * записи. Сегодня филиал — адрес и телефон, видимые в кабинете.
 */

type Point = {
  id: string;
  name: string;
  phone: string | null;
  country: string | null;
  city: string | null;
  address: string | null;
  addressNote: string | null;
  googleMapsUrl: string | null;
  isActive: boolean;
  isSalon: boolean;
};

type View = {
  limit: number | null;
  used: number;
  points: Point[];
};

type Draft = {
  name: string;
  phone: string;
  city: string;
  address: string;
  addressNote: string;
  googleMapsUrl: string;
};

const EMPTY_DRAFT: Draft = {
  name: '',
  phone: '',
  city: '',
  address: '',
  addressNote: '',
  googleMapsUrl: '',
};

function draftOf(point: Point): Draft {
  return {
    name: point.name,
    phone: point.phone ?? '',
    city: point.city ?? '',
    address: point.address ?? '',
    addressNote: point.addressNote ?? '',
    googleMapsUrl: point.googleMapsUrl ?? '',
  };
}

/** Сообщение сервера человеку, а не «Ошибка». */
function serverMessage(error: unknown, fallback: string): string {
  const data = (
    error as { response?: { data?: { message?: unknown; code?: unknown } } }
  )?.response?.data;

  const message = data?.message;

  if (Array.isArray(message)) {
    return message.join(', ');
  }

  if (typeof message === 'string' && message) {
    return message;
  }

  return fallback;
}

function SalonLocationsPanel({ salonId }: { salonId: string }) {
  const { t } = useTranslation();

  const [view, setView] = useState<View | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [isAdding, setIsAdding] = useState(false);
  const [newDraft, setNewDraft] = useState<Draft>(EMPTY_DRAFT);
  const [busyId, setBusyId] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [doneMsg, setDoneMsg] = useState('');

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [salonId]);

  async function load() {
    if (!salonId) {
      return;
    }

    try {
      const res = await api.get<View>('/salons/' + salonId + '/locations');

      setView(res.data);

      const next: Record<string, Draft> = {};

      for (const point of res.data.points) {
        if (!point.isSalon) {
          next[point.id] = draftOf(point);
        }
      }

      setDrafts(next);
    } catch (error) {
      setErrorMsg(serverMessage(error, t('salonInfo.locations.loadFailed')));
    }
  }

  function setDraft(id: string, field: keyof Draft, value: string) {
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  }

  /** Пустое поле означает «стереть»: сервер ждёт строку, не undefined. */
  function bodyOf(draft: Draft) {
    return {
      name: draft.name.trim(),
      phone: draft.phone.trim() || undefined,
      city: draft.city.trim() || undefined,
      address: draft.address.trim() || undefined,
      addressNote: draft.addressNote.trim() || undefined,
      googleMapsUrl: draft.googleMapsUrl.trim() || undefined,
    };
  }

  async function save(id: string) {
    const draft = drafts[id];

    if (!draft || draft.name.trim().length < 2) {
      setErrorMsg(t('salonInfo.locations.needName'));
      return;
    }

    setBusyId(id);
    setErrorMsg('');
    setDoneMsg('');

    try {
      await api.patch('/salons/' + salonId + '/locations/' + id, bodyOf(draft));

      setDoneMsg(t('salonInfo.locations.saved'));
      await load();
    } catch (error) {
      setErrorMsg(serverMessage(error, t('salonInfo.locations.saveFailed')));
    } finally {
      setBusyId('');
    }
  }

  async function setActive(id: string, isActive: boolean) {
    setBusyId(id);
    setErrorMsg('');
    setDoneMsg('');

    try {
      await api.patch('/salons/' + salonId + '/locations/' + id, { isActive });

      await load();
    } catch (error) {
      setErrorMsg(serverMessage(error, t('salonInfo.locations.saveFailed')));
    } finally {
      setBusyId('');
    }
  }

  async function add() {
    if (newDraft.name.trim().length < 2) {
      setErrorMsg(t('salonInfo.locations.needName'));
      return;
    }

    setBusyId('new');
    setErrorMsg('');
    setDoneMsg('');

    try {
      await api.post('/salons/' + salonId + '/locations', bodyOf(newDraft));

      setNewDraft(EMPTY_DRAFT);
      setIsAdding(false);
      setDoneMsg(t('salonInfo.locations.added'));
      await load();
    } catch (error) {
      setErrorMsg(serverMessage(error, t('salonInfo.locations.addFailed')));
    } finally {
      setBusyId('');
    }
  }

  const inputStyle = {
    padding: '11px 14px',
    border: '1px solid rgba(var(--app-ink-rgb),0.12)',
    borderRadius: 13,
    background: 'rgba(var(--app-ink-rgb),0.06)',
    color: 'var(--app-text)',
    fontSize: 14,
    outline: 'none',
    width: '100%',
    fontFamily: 'inherit',
  } as const;

  const labelStyle = {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 6,
    fontSize: 13,
    color: 'var(--app-text)',
  } as const;

  const buttonStyle = {
    minHeight: 40,
    padding: '0 16px',
    borderRadius: 12,
    border: '1px solid rgba(var(--app-ink-rgb),0.14)',
    background: 'transparent',
    color: 'var(--app-text)',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
  } as const;

  const fields = (draft: Draft, onChange: (f: keyof Draft, v: string) => void) => (
    <div
      style={{
        display: 'grid',
        gap: 12,
        gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
      }}
    >
      <label style={labelStyle}>
        {t('salonInfo.locations.name')}
        <input
          style={inputStyle}
          value={draft.name}
          onChange={(event) => onChange('name', event.target.value)}
        />
      </label>

      <label style={labelStyle}>
        {t('salonInfo.phone')}
        <input
          style={inputStyle}
          value={draft.phone}
          placeholder="+373..."
          onChange={(event) => onChange('phone', event.target.value)}
        />
      </label>

      <label style={labelStyle}>
        {t('salonInfo.city')}
        <input
          style={inputStyle}
          value={draft.city}
          onChange={(event) => onChange('city', event.target.value)}
        />
      </label>

      <label style={labelStyle}>
        {t('salonInfo.street')}
        <input
          style={inputStyle}
          value={draft.address}
          placeholder={t('salonInfo.streetPlaceholder')}
          onChange={(event) => onChange('address', event.target.value)}
        />
      </label>

      <label style={labelStyle}>
        {t('salonInfo.note')}
        <input
          style={inputStyle}
          value={draft.addressNote}
          placeholder={t('salonInfo.notePlaceholder')}
          onChange={(event) => onChange('addressNote', event.target.value)}
        />
      </label>

      <label style={labelStyle}>
        {t('salonInfo.googleMapsUrl')}
        <input
          style={inputStyle}
          value={draft.googleMapsUrl}
          placeholder={t('salonInfo.googleMapsUrlPlaceholder')}
          onChange={(event) => onChange('googleMapsUrl', event.target.value)}
        />
      </label>
    </div>
  );

  const limit = view?.limit ?? null;
  const used = view?.used ?? 0;
  const isFull = limit !== null && used >= limit;

  return (
    <article className="dashboard-panel" style={{ marginTop: 16 }}>
      <div className="panel-heading">
        <div>
          <p className="panel-kicker">
            {t('salonInfo.locations.title').toUpperCase()}
          </p>

          <h2>{t('salonInfo.locations.title')}</h2>
        </div>

        <Building2 size={22} />
      </div>

      <p
        style={{
          margin: '0 0 6px',
          color: 'var(--app-text-muted, #6d656f)',
          fontSize: 13,
          lineHeight: 1.6,
        }}
      >
        {limit === null
          ? t('salonInfo.locations.usedUnlimited', { used })
          : t('salonInfo.locations.used', { used, limit })}
      </p>

      <p
        style={{
          margin: '0 0 16px',
          color: 'var(--app-text-muted, #6d656f)',
          fontSize: 13,
          lineHeight: 1.6,
        }}
      >
        {t('salonInfo.locations.notYet')}
      </p>

      {errorMsg ? (
        <p
          style={{
            margin: '0 0 14px',
            color: 'var(--app-danger)',
            fontSize: 13,
          }}
        >
          {errorMsg}
        </p>
      ) : null}

      {doneMsg ? (
        <p
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            margin: '0 0 14px',
            color: 'var(--app-accent-text)',
            fontSize: 13,
          }}
        >
          <Check size={15} />
          {doneMsg}
        </p>
      ) : null}

      <div style={{ display: 'grid', gap: 14 }}>
        {(view?.points ?? []).map((point) =>
          point.isSalon ? (
            <section
              key={point.id}
              style={{
                padding: '14px 16px',
                border: '1px solid rgba(var(--app-ink-rgb),0.12)',
                borderRadius: 14,
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: 14,
                  fontWeight: 700,
                  color: 'var(--app-text)',
                }}
              >
                {point.name}
                <span
                  style={{
                    marginLeft: 8,
                    padding: '2px 8px',
                    borderRadius: 999,
                    background: 'rgba(var(--app-ink-rgb),0.08)',
                    fontSize: 11,
                    fontWeight: 700,
                    color: 'var(--app-text-muted, #6d656f)',
                  }}
                >
                  {t('salonInfo.locations.mainPoint')}
                </span>
              </p>

              <p
                style={{
                  margin: '6px 0 0',
                  color: 'var(--app-text-muted, #6d656f)',
                  fontSize: 13,
                  lineHeight: 1.6,
                }}
              >
                {[point.city, point.address].filter(Boolean).join(', ') ||
                  t('salonInfo.locations.noAddress')}
              </p>

              <p
                style={{
                  margin: '6px 0 0',
                  color: 'var(--app-text-muted, #6d656f)',
                  fontSize: 12,
                }}
              >
                {t('salonInfo.locations.mainHint')}
              </p>
            </section>
          ) : (
            <section
              key={point.id}
              style={{
                padding: '16px',
                border: '1px solid rgba(var(--app-ink-rgb),0.12)',
                borderRadius: 14,
                opacity: point.isActive ? 1 : 0.6,
              }}
            >
              {!point.isActive ? (
                <p
                  style={{
                    margin: '0 0 12px',
                    color: 'var(--app-text-muted, #6d656f)',
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {t('salonInfo.locations.off')}
                </p>
              ) : null}

              {drafts[point.id]
                ? fields(drafts[point.id], (field, value) =>
                    setDraft(point.id, field, value),
                  )
                : null}

              <div
                style={{
                  display: 'flex',
                  gap: 10,
                  marginTop: 14,
                  flexWrap: 'wrap',
                }}
              >
                <button
                  type="button"
                  onClick={() => void save(point.id)}
                  disabled={busyId === point.id}
                  style={{
                    ...buttonStyle,
                    border: 'none',
                    background: 'var(--app-accent)',
                    color: '#fff',
                  }}
                >
                  {busyId === point.id
                    ? t('common.saving')
                    : t('common.save')}
                </button>

                <button
                  type="button"
                  onClick={() => void setActive(point.id, !point.isActive)}
                  disabled={busyId === point.id}
                  style={buttonStyle}
                >
                  {point.isActive
                    ? t('salonInfo.locations.disable')
                    : t('salonInfo.locations.enable')}
                </button>
              </div>
            </section>
          ),
        )}
      </div>

      {isAdding ? (
        <section
          style={{
            marginTop: 14,
            padding: '16px',
            border: '1px solid rgba(var(--app-ink-rgb),0.12)',
            borderRadius: 14,
          }}
        >
          {fields(newDraft, (field, value) =>
            setNewDraft((prev) => ({ ...prev, [field]: value })),
          )}

          <div
            style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}
          >
            <button
              type="button"
              onClick={() => void add()}
              disabled={busyId === 'new'}
              style={{
                ...buttonStyle,
                border: 'none',
                background: 'var(--app-accent)',
                color: '#fff',
              }}
            >
              {busyId === 'new'
                ? t('common.saving')
                : t('salonInfo.locations.add')}
            </button>

            <button
              type="button"
              onClick={() => {
                setIsAdding(false);
                setNewDraft(EMPTY_DRAFT);
              }}
              style={buttonStyle}
            >
              {t('common.cancel')}
            </button>
          </div>
        </section>
      ) : isFull ? (
        <p
          style={{
            margin: '16px 0 0',
            color: 'var(--app-text-muted, #6d656f)',
            fontSize: 13,
            lineHeight: 1.6,
          }}
        >
          {t('salonInfo.locations.full', { limit })}
        </p>
      ) : (
        <button
          type="button"
          onClick={() => setIsAdding(true)}
          style={{
            ...buttonStyle,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7,
            marginTop: 16,
          }}
        >
          <Plus size={16} />
          {t('salonInfo.locations.add')}
        </button>
      )}
    </article>
  );
}

export default SalonLocationsPanel;
