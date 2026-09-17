import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Gift, Sparkles } from 'lucide-react';

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

  const [isSending, setIsSending] = useState(false);
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

  /**
   * Одна кнопка вместо анкеты.
   *
   * Прежде здесь стояла форма из шести полей, а после неё человек
   * заполнял ровно то же самое ещё раз — уже на регистрации. Две анкеты
   * подряд теряют больше людей, чем любая цена, и вторая из них была
   * наша собственная выдумка.
   *
   * Теперь код превращается в приглашение на сервере, и человек попадает
   * сразу на регистрацию. Адрес ссылки не изменился: салоны уже разослали
   * её, и ломать разосланное нельзя.
   */
  async function start() {
    if (!code) {
      setErrorMsg(t('invite.noCode'));

      return;
    }

    setIsSending(true);
    setErrorMsg('');

    try {
      const res = await api.post<{ token: string }>(
        '/platform-registration/by-referral',
        { code },
      );

      // Дальше обычная регистрация: та же форма, то же одобрение.
      window.location.hash =
        '#register?invite=' + encodeURIComponent(res.data.token);
    } catch {
      setErrorMsg(t('invite.startFailed'));
      setIsSending(false);
    }
  }

  const changes = [t('invite.c1'), t('invite.c2'), t('invite.c3'), t('invite.c4')];



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

        <section
          style={{
            padding: '20px 18px',
            border: '1px solid var(--app-border)',
            borderRadius: 16,
            background: 'var(--app-panel)',
            textAlign: 'center',
          }}
        >
          {errorMsg ? (
            <p
              style={{
                margin: '0 0 12px',
                color: '#dc2626',
                fontSize: 14,
                lineHeight: 1.6,
              }}
            >
              {errorMsg}
            </p>
          ) : null}

          <button
            type="button"
            disabled={!code || isSending}
            onClick={() => void start()}
            style={{
              width: '100%',
              minHeight: 50,
              border: 'none',
              borderRadius: 14,
              background: 'var(--app-accent)',
              color: '#fff',
              fontSize: 16,
              fontWeight: 700,
              cursor: !code || isSending ? 'default' : 'pointer',
              opacity: !code || isSending ? 0.7 : 1,
            }}
          >
            {isSending ? t('common.loading') : t('invite.start')}
          </button>

          {!code ? (
            <p
              style={{
                margin: '12px 0 0',
                color: 'var(--app-text-muted)',
                fontSize: 14,
                lineHeight: 1.6,
              }}
            >
              {t('invite.noCode')}
            </p>
          ) : null}
        </section>
      </div>
    </main>
  );
}

export default PartnerInvitePage;
