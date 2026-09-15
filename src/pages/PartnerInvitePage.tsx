import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Gift, Sparkles } from 'lucide-react';

import api from '../api/api';
import LanguageSwitcher from '../components/LanguageSwitcher';

/**
 * Страница по ссылке приглашения.
 *
 * Сюда попадает человек, которому про GLAMOUR рассказал кто-то живой.
 * Поэтому страница написана не как реклама, а как продолжение того
 * разговора: коротко, по делу и с именем того, кто прислал.
 *
 * Имени владельца площадки здесь нет нарочно — так решил он сам. Текст
 * поэтому говорит «мы», а не «я».
 *
 * Она ничего не открывает. Заявка отсюда — просьба о подключении, а не
 * регистрация: дверь в продукт остаётся у владельца площадки, и об этом
 * сказано прямо, чтобы человек не ждал письма с паролем.
 *
 * Размер подарка приходит с сервера вместе с именем пригласившего.
 * Написать здесь «сорок сообщений» значило бы завести второй ответ на
 * вопрос, на который уже отвечает настройка, — ту самую болезнь, от
 * которой в этом продукте четыре сторожа.
 */

type Referrer = {
  name: string;
  welcomeMessages: number;
};

type Kind = 'salon' | 'master';

function readCode(): string {
  const hash = window.location.hash;
  const at = hash.indexOf('?');

  if (at < 0) {
    return '';
  }

  return (new URLSearchParams(hash.slice(at + 1)).get('ref') ?? '').trim();
}

function PartnerInvitePage() {
  const { t } = useTranslation();

  const [code] = useState(readCode);
  const [referrer, setReferrer] = useState<Referrer | null>(null);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [kind, setKind] = useState<Kind>('salon');
  const [salonName, setSalonName] = useState('');
  const [city, setCity] = useState('');
  const [note, setNote] = useState('');

  const [isSending, setIsSending] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!code) {
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        const res = await api.get<Referrer>(
          '/referrals/by/' + encodeURIComponent(code),
        );

        if (!cancelled) {
          setReferrer(res.data);
        }
      } catch {
        // Код мог устареть или быть набран с ошибкой. Ломать страницу
        // из-за этого нельзя: заявку примем и без него.
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [code]);

  async function submit() {
    if (name.trim().length < 2 || phone.trim().length < 5) {
      setErrorMsg(t('invite.required'));
      return;
    }

    setIsSending(true);
    setErrorMsg('');

    try {
      await api.post('/referrals/lead', {
        code: code || undefined,
        name: name.trim(),
        phone: phone.trim(),
        kind,
        salonName: salonName.trim() || undefined,
        city: city.trim() || undefined,
        note: note.trim() || undefined,
      });

      setIsSent(true);
    } catch {
      setErrorMsg(t('invite.failed'));
    } finally {
      setIsSending(false);
    }
  }

  const changes = [t('invite.c1'), t('invite.c2'), t('invite.c3'), t('invite.c4')];

  const inputStyle = {
    width: '100%',
    padding: '12px 14px',
    borderRadius: 13,
    border: '1px solid var(--app-border)',
    background: 'var(--app-input)',
    color: 'var(--app-text)',
    fontSize: 15,
    fontFamily: 'inherit',
  } as const;

  const labelStyle = {
    display: 'block',
    marginBottom: 6,
    color: 'var(--app-text-muted)',
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.05em',
  } as const;

  const blockTitle = {
    margin: '0 0 10px',
    fontSize: 17,
    letterSpacing: '-0.01em',
  } as const;

  const paragraph = {
    margin: '0 0 14px',
    color: 'var(--app-text-muted)',
    fontSize: 15,
    lineHeight: 1.65,
  } as const;

  return (
    <main
      style={{
        minHeight: '100vh',
        padding: '26px 18px 60px',
        background: 'var(--app-bg)',
        color: 'var(--app-text)',
      }}
    >
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 26,
          }}
        >
          <strong style={{ fontSize: 15, letterSpacing: '0.16em' }}>
            GLAMOUR
          </strong>

          <LanguageSwitcher />
        </div>

        {referrer ? (
          <p
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              margin: '0 0 16px',
              padding: '7px 13px',
              borderRadius: 999,
              background: 'rgba(var(--app-ink-rgb),0.06)',
              color: 'var(--app-text-muted)',
              fontSize: 13,
            }}
          >
            <Sparkles size={15} color="var(--app-accent)" />
            {t('invite.invitedBy', { name: referrer.name })}
          </p>
        ) : null}

        {/* Заголовок — обещание, а не приветствие. Знакомство идёт
            следующей строкой, обычным размером: крупно поставленное
            «здравствуйте» занимает место обещания и ничего не обещает. */}
        <h1
          style={{
            margin: '0 0 16px',
            fontSize: 'clamp(24px, 4.6vw, 34px)',
            lineHeight: 1.2,
            letterSpacing: '-0.03em',
          }}
        >
          {t('invite.title')}
        </h1>

        <p style={{ ...paragraph, color: 'var(--app-text)' }}>
          {t('invite.feeling')}
        </p>

        <p style={{ ...paragraph, marginBottom: 30 }}>{t('invite.why')}</p>

        <h2 style={blockTitle}>{t('invite.changesTitle')}</h2>

        <div style={{ display: 'grid', gap: 12, marginBottom: 30 }}>
          {changes.map((line) => (
            <section
              key={line}
              style={{
                padding: '14px 16px',
                border: '1px solid var(--app-border)',
                borderRadius: 14,
                background: 'var(--app-panel)',
                color: 'var(--app-text)',
                fontSize: 15,
                lineHeight: 1.6,
              }}
            >
              {line}
            </section>
          ))}
        </div>

        <h2 style={blockTitle}>{t('invite.nowTitle')}</h2>

        <p style={{ ...paragraph, marginBottom: 30 }}>{t('invite.now')}</p>

        <h2 style={blockTitle}>{t('invite.riskTitle')}</h2>

        <p style={{ ...paragraph, marginBottom: 30 }}>{t('invite.risk')}</p>

        {referrer && referrer.welcomeMessages > 0 ? (
          <section
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
              padding: '15px 16px',
              marginBottom: 30,
              borderRadius: 14,
              background: 'rgba(var(--app-ink-rgb),0.05)',
            }}
          >
            <Gift size={20} color="var(--app-accent)" />

            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6 }}>
              {t('invite.gift', { count: referrer.welcomeMessages })}
            </p>
          </section>
        ) : null}

        {isSent ? (
          <section
            style={{
              padding: '24px 18px',
              border: '1px solid var(--app-border)',
              borderRadius: 16,
              textAlign: 'center',
            }}
          >
            <Check size={26} color="var(--app-accent)" />

            <h2 style={{ margin: '10px 0 8px', fontSize: 20 }}>
              {t('invite.sentTitle')}
            </h2>

            <p
              style={{
                margin: 0,
                color: 'var(--app-text-muted)',
                fontSize: 15,
                lineHeight: 1.6,
              }}
            >
              {t('invite.sentText')}
            </p>
          </section>
        ) : (
          <section
            style={{
              padding: '20px 18px',
              border: '1px solid var(--app-border)',
              borderRadius: 16,
              background: 'var(--app-panel)',
            }}
          >
            <h2 style={{ margin: '0 0 8px', fontSize: 20 }}>
              {t('invite.formTitle')}
            </h2>

            <p
              style={{
                margin: '0 0 18px',
                color: 'var(--app-text-muted)',
                fontSize: 14,
                lineHeight: 1.6,
              }}
            >
              {t('invite.formHint')}
            </p>

            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {(['salon', 'master'] as Kind[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setKind(value)}
                  style={{
                    flex: 1,
                    minHeight: 44,
                    borderRadius: 12,
                    border:
                      kind === value
                        ? '1px solid var(--app-accent)'
                        : '1px solid var(--app-border)',
                    background:
                      kind === value
                        ? 'rgba(var(--app-ink-rgb),0.06)'
                        : 'transparent',
                    color: 'var(--app-text)',
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {value === 'salon'
                    ? t('invite.kindSalon')
                    : t('invite.kindMaster')}
                </button>
              ))}
            </div>

            <div style={{ display: 'grid', gap: 14 }}>
              <div>
                <label style={labelStyle}>{t('invite.name')}</label>

                <input
                  style={inputStyle}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </div>

              <div>
                <label style={labelStyle}>{t('invite.phone')}</label>

                <input
                  style={inputStyle}
                  value={phone}
                  inputMode="tel"
                  onChange={(event) => setPhone(event.target.value)}
                />
              </div>

              <div>
                <label style={labelStyle}>
                  {kind === 'salon'
                    ? t('invite.salonName')
                    : t('invite.masterWhere')}
                </label>

                <input
                  style={inputStyle}
                  value={salonName}
                  onChange={(event) => setSalonName(event.target.value)}
                />
              </div>

              <div>
                <label style={labelStyle}>{t('invite.city')}</label>

                <input
                  style={inputStyle}
                  value={city}
                  onChange={(event) => setCity(event.target.value)}
                />
              </div>

              <div>
                <label style={labelStyle}>{t('invite.note')}</label>

                <textarea
                  style={{ ...inputStyle, resize: 'vertical' }}
                  rows={3}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                />
              </div>
            </div>

            {errorMsg ? (
              <p
                style={{
                  margin: '14px 0 0',
                  color: 'var(--app-danger)',
                  fontSize: 14,
                }}
              >
                {errorMsg}
              </p>
            ) : null}

            <button
              type="button"
              onClick={() => void submit()}
              disabled={isSending}
              style={{
                width: '100%',
                marginTop: 18,
                minHeight: 50,
                border: 'none',
                borderRadius: 14,
                background: 'var(--app-accent)',
                color: '#fff',
                fontSize: 16,
                fontWeight: 700,
                cursor: isSending ? 'default' : 'pointer',
                opacity: isSending ? 0.7 : 1,
              }}
            >
              {isSending ? t('invite.sending') : t('invite.send')}
            </button>
          </section>
        )}
      </div>
    </main>
  );
}

export default PartnerInvitePage;
