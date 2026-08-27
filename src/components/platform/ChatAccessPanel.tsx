import { useEffect, useState } from 'react';
import { Check, MessageCircle, Search, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import api from '../../api/api';
import { getErrorKey } from '../../api/errorMessage';

type ChatAccessSalon = {
  salonId: string;
  name: string;
  email: string | null;
  phone: string | null;
  chatEnabled: boolean;
  people: number;
};

/**
 * Доступ к общению — раздел кабинета владельца платформы.
 *
 * Чат раздаём по одному салону: сначала смотрим, как им пользуются
 * живые люди, потом открываем остальным. Поэтому здесь не список из
 * сотни строк, а поиск по тому, что известно наверняка — по почте
 * или телефону, с которыми салон регистрировался.
 */
function ChatAccessPanel() {
  const { t } = useTranslation();

  const [query, setQuery] = useState('');
  const [found, setFound] = useState<ChatAccessSalon[] | null>(null);
  const [enabledSalons, setEnabledSalons] = useState<ChatAccessSalon[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [doneMsg, setDoneMsg] = useState('');

  useEffect(() => {
    void loadEnabled();
  }, []);

  async function loadEnabled() {
    try {
      const res = await api.get<ChatAccessSalon[]>(
        '/platform-admin/chat-access',
      );

      setEnabledSalons(res.data);
    } catch (error) {
      setErrorMsg(t(getErrorKey(error)));
    }
  }

  async function search() {
    const value = query.trim();

    if (value.length < 3) {
      setErrorMsg(t('chatAccess.tooShort'));
      return;
    }

    setIsSearching(true);
    setErrorMsg('');
    setDoneMsg('');

    try {
      const res = await api.get<ChatAccessSalon[]>(
        '/platform-admin/chat-access/search',
        { params: { query: value } },
      );

      setFound(res.data);
    } catch (error) {
      setFound(null);
      setErrorMsg(t(getErrorKey(error)));
    } finally {
      setIsSearching(false);
    }
  }

  async function toggle(salon: ChatAccessSalon) {
    const next = !salon.chatEnabled;

    // Открытие рассылает уведомления всему салону — письмами в том
    // числе. Такое лучше подтвердить, чем отменять потом.
    if (
      next &&
      !window.confirm(
        t('chatAccess.confirm', {
          salon: salon.name,
          people: salon.people,
        }),
      )
    ) {
      return;
    }

    setBusyId(salon.salonId);
    setErrorMsg('');
    setDoneMsg('');

    try {
      const res = await api.patch<ChatAccessSalon>(
        '/platform-admin/chat-access/' + salon.salonId,
        { enabled: next },
      );

      const updated = res.data;

      setFound((list) =>
        list
          ? list.map((item) =>
              item.salonId === updated.salonId ? updated : item,
            )
          : list,
      );

      await loadEnabled();

      setDoneMsg(
        next
          ? t('chatAccess.opened', {
              salon: updated.name,
              people: updated.people,
            })
          : t('chatAccess.closed', { salon: updated.name }),
      );
    } catch (error) {
      setErrorMsg(t(getErrorKey(error)));
    } finally {
      setBusyId(null);
    }
  }

  function renderSalon(salon: ChatAccessSalon) {
    const isBusy = busyId === salon.salonId;

    return (
      <div
        key={salon.salonId}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: '13px 15px',
          border: '1px solid var(--app-border)',
          borderRadius: 15,
          background: 'var(--app-panel)',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              margin: 0,
              color: 'var(--app-text)',
              fontSize: 14,
              fontWeight: 700,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {salon.name}
          </p>

          <p
            style={{
              margin: '4px 0 0',
              color: 'var(--app-text-muted)',
              fontSize: 12,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {[salon.email, salon.phone].filter(Boolean).join(' · ') || '—'}
          </p>

          <p
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              margin: '6px 0 0',
              color: 'var(--app-text-muted)',
              fontSize: 12,
            }}
          >
            <Users size={12} color="var(--app-accent)" />
            {t('chatAccess.people', { people: salon.people })}
          </p>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={salon.chatEnabled}
          aria-label={t('chatAccess.toggle')}
          disabled={isBusy}
          onClick={() => void toggle(salon)}
          style={{
            position: 'relative',
            flexShrink: 0,
            width: 52,
            height: 30,
            padding: 0,
            border: salon.chatEnabled
              ? '1px solid var(--app-accent)'
              : '1px solid var(--app-border)',
            borderRadius: 15,
            background: salon.chatEnabled
              ? 'var(--app-accent)'
              : 'transparent',
            cursor: isBusy ? 'default' : 'pointer',
            opacity: isBusy ? 0.5 : 1,
            transition: 'background 160ms ease',
          }}
        >
          <span
            style={{
              position: 'absolute',
              top: 3,
              left: salon.chatEnabled ? 25 : 3,
              width: 22,
              height: 22,
              borderRadius: '50%',
              background: salon.chatEnabled
                ? '#17151c'
                : 'var(--app-text-muted)',
              transition: 'left 160ms ease',
            }}
          />
        </button>
      </div>
    );
  }

  return (
    <section
      style={{
        padding: '20px 18px',
        border: '1px solid var(--app-border)',
        borderRadius: 18,
        background: 'var(--app-panel)',
        marginBottom: 22,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 9,
          marginBottom: 6,
        }}
      >
        <MessageCircle size={18} color="var(--app-accent)" />

        <strong style={{ color: 'var(--app-text)', fontSize: 16 }}>
          {t('chatAccess.title')}
        </strong>
      </div>

      <p
        style={{
          color: 'var(--app-text-muted)',
          fontSize: 13,
          lineHeight: 1.55,
          margin: '0 0 16px',
        }}
      >
        {t('chatAccess.hint')}
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              void search();
            }
          }}
          placeholder={t('chatAccess.placeholder')}
          style={{
            flex: 1,
            minHeight: 46,
            padding: '0 13px',
            borderRadius: 13,
            border: '1px solid var(--app-border)',
            background: 'var(--app-input)',
            color: 'var(--app-text)',
            fontSize: 15,
          }}
        />

        <button
          type="button"
          onClick={() => void search()}
          disabled={isSearching}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 7,
            minWidth: 46,
            minHeight: 46,
            padding: '0 16px',
            border: 0,
            borderRadius: 13,
            background: 'var(--app-accent)',
            color: '#17151c',
            fontSize: 14,
            fontWeight: 700,
            cursor: isSearching ? 'default' : 'pointer',
            opacity: isSearching ? 0.6 : 1,
          }}
        >
          <Search size={16} />
          {t('chatAccess.search')}
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

      {doneMsg && (
        <p
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            color: 'var(--app-accent)',
            fontSize: 13,
            fontWeight: 700,
            margin: '0 0 12px',
          }}
        >
          <Check size={15} />
          {doneMsg}
        </p>
      )}

      {found !== null && (
        <div style={{ marginBottom: 18 }}>
          <p
            style={{
              color: 'var(--app-text-muted)',
              fontSize: 12,
              fontWeight: 700,
              margin: '0 0 8px',
            }}
          >
            {t('chatAccess.results')}
          </p>

          {found.length === 0 ? (
            <p
              style={{
                color: 'var(--app-text-muted)',
                fontSize: 13,
                lineHeight: 1.55,
              }}
            >
              {t('chatAccess.nothing')}
            </p>
          ) : (
            <div
              style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
            >
              {found.map(renderSalon)}
            </div>
          )}
        </div>
      )}

      <p
        style={{
          color: 'var(--app-text-muted)',
          fontSize: 12,
          fontWeight: 700,
          margin: '0 0 8px',
        }}
      >
        {t('chatAccess.alreadyOpen')}
      </p>

      {enabledSalons.length === 0 ? (
        <p style={{ color: 'var(--app-text-muted)', fontSize: 13 }}>
          {t('chatAccess.noneOpen')}
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {enabledSalons.map(renderSalon)}
        </div>
      )}
    </section>
  );
}

export default ChatAccessPanel;
