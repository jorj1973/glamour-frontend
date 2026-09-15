import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LifeBuoy, Mail, MessageCircle, Phone, Send } from 'lucide-react';

import api from '../api/api';
import AppLayout from '../components/AppLayout';

/**
 * Поддержка: связь с тем, кто делает программу.
 *
 * Сделано без собственного чата и без нового хранилища, и это
 * осознанно. Чат внутри продукта привязан к салону — комнаты без салона
 * сегодня не существует, а заводить её ради поддержки значит открывать
 * дыру в разграничении арендаторов. Письмо в никуда не лучше: пока
 * почтовый ящик не проверен, человек напишет и не получит ответа.
 *
 * Поэтому здесь то, что работает наверняка: кнопки, которые открывают
 * уже установленный мессенджер и подставляют в сообщение то, чего
 * человек сам не напишет, — кто он, какой салон и с какого экрана
 * пришёл. Без этого сообщение «у меня не работает» бесполезно обоим.
 */

/**
 * Куда писать в поддержку.
 *
 * Пока это личные контакты владельца продукта: поддержка — он сам.
 * Когда появится служба, значения переедут в настройки платформы и
 * будут приходить с сервера; здесь останется одно место для правки.
 */
const SUPPORT = {
  phone: '+37369713700',
  telegram: 'jorj73',
  email: 'salonglamoursor@gmail.com',
};

type Who = {
  name: string;
  email: string;
  salon: string;
};

function buildMessage(who: Who, problem: string, t: (key: string) => string) {
  const lines = [
    t('support.messageHead'),
    '',
    `${t('support.fieldName')}: ${who.name || '—'}`,
    `${t('support.fieldEmail')}: ${who.email || '—'}`,
    `${t('support.fieldSalon')}: ${who.salon || '—'}`,
    '',
    problem.trim() || t('support.messageTail'),
  ];

  return lines.join('\n');
}

function SupportPage() {
  const { t } = useTranslation();

  const [who, setWho] = useState<Who>({ name: '', email: '', salon: '' });
  const [problem, setProblem] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const session = await api.get<Record<string, unknown>>('/auth/session');
        const user = (session.data?.user ?? {}) as Record<string, string>;

        let salon = '';

        try {
          const salons = await api.get<{ name: string }[]>('/salons/my');
          salon = salons.data?.[0]?.name ?? '';
        } catch {
          // Салон не обязателен: без него сообщение просто короче.
        }

        if (cancelled) {
          return;
        }

        setWho({
          name: [user.firstName, user.lastName].filter(Boolean).join(' ').trim(),
          email: user.email ?? '',
          salon,
        });
      } catch {
        // Не вышло — человек допишет сам.
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const text = buildMessage(who, problem, t);
  const encoded = encodeURIComponent(text);

  const cardStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    padding: '0 18px',
    borderRadius: 14,
    border: '1px solid rgba(var(--app-ink-rgb),0.12)',
    background: 'rgba(var(--app-ink-rgb),0.04)',
    color: 'var(--app-text)',
    fontSize: 15,
    fontWeight: 700,
    textDecoration: 'none',
  } as const;

  return (
    <AppLayout>
      <div style={{ maxWidth: 640 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 6,
          }}
        >
          <LifeBuoy size={26} color="var(--app-accent)" />
          <h1 style={{ margin: 0 }}>{t('support.title')}</h1>
        </div>

        <p style={{ color: 'var(--app-text-muted)', marginTop: 0 }}>
          {t('support.subtitle')}
        </p>

        <label
          style={{
            display: 'block',
            marginTop: 20,
            marginBottom: 8,
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: '0.06em',
            color: 'var(--app-text-muted)',
          }}
        >
          {t('support.problemLabel')}
        </label>

        <textarea
          value={problem}
          onChange={(event) => setProblem(event.target.value)}
          placeholder={t('support.problemPlaceholder')}
          rows={4}
          style={{
            width: '100%',
            padding: 14,
            borderRadius: 14,
            border: '1px solid rgba(var(--app-ink-rgb),0.12)',
            background: 'var(--app-input)',
            color: 'var(--app-text)',
            fontSize: 15,
            fontFamily: 'inherit',
            resize: 'vertical',
          }}
        />

        <p
          style={{
            color: 'var(--app-text-muted)',
            fontSize: 13,
            margin: '10px 0 18px',
          }}
        >
          {t('support.contextNote')}
        </p>

        <div style={{ display: 'grid', gap: 10 }}>
          <a
            style={cardStyle}
            href={`https://wa.me/${SUPPORT.phone.replace(/\D/g, '')}?text=${encoded}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <MessageCircle size={20} color="var(--app-accent)" />
            WhatsApp
          </a>

          <a
            style={cardStyle}
            href={`viber://chat?number=${encodeURIComponent(SUPPORT.phone)}`}
          >
            <Phone size={20} color="var(--app-accent)" />
            Viber
          </a>

          <a
            style={cardStyle}
            href={`https://t.me/${SUPPORT.telegram}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Send size={20} color="var(--app-accent)" />
            Telegram
          </a>

          <a
            style={cardStyle}
            href={`mailto:${SUPPORT.email}?subject=${encodeURIComponent(
              t('support.mailSubject'),
            )}&body=${encoded}`}
          >
            <Mail size={20} color="var(--app-accent)" />
            {t('support.byMail')}
          </a>
        </div>

        <p
          style={{
            color: 'var(--app-text-muted)',
            fontSize: 13,
            marginTop: 20,
          }}
        >
          {t('support.hours')}
        </p>
      </div>
    </AppLayout>
  );
}

export default SupportPage;
