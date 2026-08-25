import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { LockKeyhole } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../api/api';

function ResetPasswordPage() {
  const { t } = useTranslation();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] =
    useState('');
  const [message, setMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const token = useMemo(() => {
    // Токен ищем сначала в хеше (#reset-password?token=...),
    // затем в строке запроса (?token=...) — для старых писем.
    const hash = window.location.hash;
    const queryStart = hash.indexOf('?');

    if (queryStart !== -1) {
      const hashParams = new URLSearchParams(
        hash.slice(queryStart + 1),
      );

      const fromHash = hashParams.get('token')?.trim();

      if (fromHash) {
        return fromHash;
      }
    }

    const searchParams = new URLSearchParams(
      window.location.search,
    );

    return searchParams.get('token')?.trim() ?? '';
  }, []);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setMessage('');

    if (!token) {
      setMessage(
        t('reset.noToken'),
      );
      return;
    }

    if (password.length < 10) {
      setMessage(
        t('reset.minLength'),
      );
      return;
    }

    if (!/[a-z]/.test(password)) {
      setMessage(
        t('reset.needLower'),
      );
      return;
    }

    if (!/[A-Z]/.test(password)) {
      setMessage(
        t('reset.needUpper'),
      );
      return;
    }

    if (!/[0-9]/.test(password)) {
      setMessage(t('reset.needDigit'));
      return;
    }

    if (password !== confirmPassword) {
      setMessage(t('reset.mismatch'));
      return;
    }

    setIsLoading(true);

    try {
      await api.post('/auth/reset-password', {
        token,
        password,
      });

      setPassword('');
      setConfirmPassword('');
      setIsSuccess(true);
      setMessage(
        t('reset.success'),
      );
    } catch {
      setMessage(
        t('reset.failed'),
      );
    } finally {
      setIsLoading(false);
    }
  }

  function openLogin() {
    // Уводим на корень: pathname здесь /reset-password,
    // и возврат на него снова открыл бы форму смены пароля.
    window.location.assign(
      `${window.location.origin}/`,
    );
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <p className="dashboard-eyebrow">
          GLAMOUR Salon Studio
        </p>

        <h1>{t('reset.title')}</h1>

        <p className="login-subtitle">
          {t('reset.subtitle')}
        </p>

        {!isSuccess ? (
          <form
            onSubmit={handleSubmit}
            className="login-form"
          >
            <label htmlFor="new-password">
              {t('reset.newPassword')}
            </label>

            <div className="login-field">
              <LockKeyhole
                size={18}
                aria-hidden="true"
              />

              <input
                id="new-password"
                type="password"
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
                autoComplete="new-password"
                minLength={10}
                maxLength={128}
                required
              />
            </div>

            <label htmlFor="confirm-password">
              {t('reset.repeatPassword')}
            </label>

            <div className="login-field">
              <LockKeyhole
                size={18}
                aria-hidden="true"
              />

              <input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(event) =>
                  setConfirmPassword(event.target.value)
                }
                autoComplete="new-password"
                minLength={10}
                maxLength={128}
                required
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || !token}
              className="login-button"
            >
              {isLoading
                ? t('common.saving')
                : t('reset.setPassword')}
            </button>
          </form>
        ) : (
          <button
            type="button"
            className="login-button"
            onClick={openLogin}
          >
            {t('reset.goToLogin')}
          </button>
        )}

        {message ? (
          <p role="status" className="login-message">
            {message}
          </p>
        ) : null}
      </section>
    </main>
  );
}

export default ResetPasswordPage;
