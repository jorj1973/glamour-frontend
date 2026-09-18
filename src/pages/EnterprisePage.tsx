import { useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Building2,
  Check,
  CheckCircle2,
  ChevronLeft,
  Mail,
  MapPin,
  Phone,
  Sparkles,
  UserRound,
} from 'lucide-react';

import api from '../api/api';
import LanguageSwitcher from '../components/LanguageSwitcher';
import ThemeSwitcher from '../components/ThemeSwitcher';
import PublicFooter from '../components/PublicFooter';

/**
 * Enterprise: сеть салонов пишет, а не выбирает кнопкой.
 *
 * Тариф по договорённости — единственный, у которого нет цены на
 * карточке, и это честно: цена сети зависит от того, сколько у неё
 * адресов и мастеров, а такого прайса вперёд не напишешь.
 *
 * Страница обещает только то, что в руках владельца площадки уже
 * сегодня: своя цена, перенос базы руками, прямой номер, обучение
 * мастеров. Рекламы и статей здесь нет — сайта, на котором они могли бы
 * стоять, у нас пока нет, а обещать несуществующее мы за этот месяц
 * научились не делать.
 *
 * Форма спрашивает шесть вещей, из которых обязательны четыре. Два числа
 * — адреса и мастера — стоят первыми: по ним владелец площадки сразу
 * понимает, о чём разговор.
 */

type FormState = {
  name: string;
  phone: string;
  email: string;
  salonName: string;
  city: string;
  locations: string;
  masters: string;
  note: string;
};

const EMPTY: FormState = {
  name: '',
  phone: '',
  email: '',
  salonName: '',
  city: '',
  locations: '',
  masters: '',
  note: '',
};

function EnterprisePage() {
  const { t } = useTranslation();

  const [form, setForm] = useState<FormState>(EMPTY);
  const [isSending, setIsSending] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [errorKey, setErrorKey] = useState('');

  function update(field: keyof FormState, value: string) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function goBack() {
    window.location.hash = '#try';
  }

  /**
   * Числа уходят числами.
   *
   * Поле ввода отдаёт строку, а сервер проверяет целое: без этого
   * превращения заявка вернулась бы с отказом, в котором человек не
   * виноват.
   */
  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const locations = Number(form.locations);
    const masters = Number(form.masters);

    if (!Number.isInteger(locations) || locations < 1) {
      setErrorKey('reg.enterprise.badLocations');
      return;
    }

    if (!Number.isInteger(masters) || masters < 1) {
      setErrorKey('reg.enterprise.badMasters');
      return;
    }

    setIsSending(true);
    setErrorKey('');

    try {
      await api.post('/platform-registration/enterprise', {
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        salonName: form.salonName.trim(),
        city: form.city.trim(),
        locations,
        masters,
        note: form.note.trim(),
      });

      setIsSent(true);
      setForm(EMPTY);

      window.scrollTo({
        top: 0,
        behavior: 'smooth',
      });
    } catch {
      setErrorKey('reg.enterprise.failed');
    } finally {
      setIsSending(false);
    }
  }

  const promises = [
    t('reg.enterprise.promise1'),
    t('reg.enterprise.promise2'),
    t('reg.enterprise.promise3'),
    t('reg.enterprise.promise4'),
  ];

  return (
    <main className="registration-page registration-page-salon">
      <section className="registration-shell">
        <header className="registration-header">
          <div className="registration-brand">
            <div className="registration-brand-icon">
              <Sparkles size={24} aria-hidden="true" />
            </div>

            <div>
              <span>GLAMOUR</span>
              <strong>Salon Studio</strong>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              flexWrap: 'wrap',
            }}
          >
            <ThemeSwitcher />

            <LanguageSwitcher />
          </div>
        </header>

        {isSent ? (
          <section className="registration-state-card">
            <div className="registration-state-icon registration-state-icon-success">
              <CheckCircle2 size={30} aria-hidden="true" />
            </div>

            <p className="registration-eyebrow">
              {t('reg.enterprise.sentEyebrow')}
            </p>

            <h1>{t('reg.enterprise.sentTitle')}</h1>

            <p>{t('reg.enterprise.sentText')}</p>

            <button
              type="button"
              className="registration-primary-button"
              onClick={goBack}
            >
              {t('reg.enterprise.back')}
            </button>
          </section>
        ) : (
          <>
            <section className="registration-intro">
              <button
                type="button"
                className="registration-back-button"
                onClick={goBack}
              >
                <ChevronLeft size={18} aria-hidden="true" />
                {t('reg.enterprise.back')}
              </button>

              <p className="registration-eyebrow">Enterprise</p>

              <h1>{t('reg.enterprise.title')}</h1>

              <p>{t('reg.enterprise.lead')}</p>
            </section>

            <section
              className="registration-form-card"
              style={{
                padding: 26,
                marginBottom: 22,
                borderRadius: 22,
                textAlign: 'left',
              }}
            >
              <p
                style={{
                  margin: '0 0 14px',
                  color: 'var(--pf-accent-text)',
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                }}
              >
                {t('reg.enterprise.promisesTitle')}
              </p>

              <ul
                style={{
                  display: 'grid',
                  gap: 11,
                  margin: 0,
                  padding: 0,
                  listStyle: 'none',
                }}
              >
                {promises.map((line) => (
                  <li
                    key={line}
                    style={{
                      display: 'grid',
                      alignItems: 'start',
                      gap: 9,
                      gridTemplateColumns: '16px minmax(0, 1fr)',
                      color: 'var(--pf-text-muted)',
                      fontSize: 14,
                      lineHeight: 1.5,
                    }}
                  >
                    <Check
                      size={15}
                      aria-hidden="true"
                      style={{ marginTop: 3, color: 'var(--pf-accent-text)' }}
                    />

                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </section>

            <form className="registration-form" onSubmit={send}>
              <section className="registration-form-card">
                <div className="registration-form-heading">
                  <div className="registration-section-icon">
                    <Building2 size={20} aria-hidden="true" />
                  </div>

                  <div>
                    <h2>{t('reg.enterprise.networkSection')}</h2>
                    <p>{t('reg.enterprise.networkNote')}</p>
                  </div>
                </div>

                <div className="registration-form-grid">
                  <label>
                    <span>{t('reg.enterprise.locations')}</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={1000}
                      value={form.locations}
                      onChange={(event) =>
                        update('locations', event.target.value)
                      }
                      required
                    />
                  </label>

                  <label>
                    <span>{t('reg.enterprise.masters')}</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={10000}
                      value={form.masters}
                      onChange={(event) => update('masters', event.target.value)}
                      required
                    />
                  </label>

                  <label>
                    <span>{t('reg.enterprise.salonName')}</span>
                    <input
                      type="text"
                      value={form.salonName}
                      onChange={(event) =>
                        update('salonName', event.target.value)
                      }
                      minLength={2}
                      maxLength={150}
                      required
                    />
                  </label>

                  <label>
                    <span>{t('reg.enterprise.city')}</span>
                    <div className="registration-input-icon">
                      <MapPin size={17} aria-hidden="true" />

                      <input
                        type="text"
                        value={form.city}
                        onChange={(event) => update('city', event.target.value)}
                        maxLength={100}
                      />
                    </div>
                  </label>
                </div>
              </section>

              <section className="registration-form-card">
                <div className="registration-form-heading">
                  <div className="registration-section-icon">
                    <UserRound size={20} aria-hidden="true" />
                  </div>

                  <div>
                    <h2>{t('reg.enterprise.youSection')}</h2>
                    <p>{t('reg.enterprise.youNote')}</p>
                  </div>
                </div>

                <div className="registration-form-grid">
                  <label>
                    <span>{t('reg.enterprise.name')}</span>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(event) => update('name', event.target.value)}
                      minLength={2}
                      maxLength={120}
                      autoComplete="name"
                      required
                    />
                  </label>

                  <label>
                    <span>{t('reg.enterprise.phone')}</span>
                    <div className="registration-input-icon">
                      <Phone size={17} aria-hidden="true" />

                      <input
                        type="tel"
                        value={form.phone}
                        onChange={(event) => update('phone', event.target.value)}
                        placeholder="+37360123456"
                        autoComplete="tel"
                        required
                      />
                    </div>
                  </label>

                  <label>
                    <span>{t('reg.enterprise.email')}</span>
                    <div className="registration-input-icon">
                      <Mail size={17} aria-hidden="true" />

                      <input
                        type="email"
                        value={form.email}
                        onChange={(event) => update('email', event.target.value)}
                        maxLength={254}
                        autoComplete="email"
                      />
                    </div>
                  </label>

                  <label>
                    <span>{t('reg.enterprise.note')}</span>
                    <input
                      type="text"
                      value={form.note}
                      onChange={(event) => update('note', event.target.value)}
                      maxLength={2000}
                    />
                  </label>
                </div>
              </section>

              {errorKey ? (
                <div className="registration-error" role="alert">
                  {t(errorKey)}
                </div>
              ) : null}

              <button
                type="submit"
                className="registration-submit-button"
                disabled={isSending}
              >
                {isSending
                  ? t('reg.enterprise.sending')
                  : t('reg.enterprise.submit')}
              </button>

              <p className="registration-submit-note">
                {t('reg.enterprise.submitNote')}
              </p>
            </form>
          </>
        )}

        <PublicFooter />
      </section>
    </main>
  );
}

export default EnterprisePage;
