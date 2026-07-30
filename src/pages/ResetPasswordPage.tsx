import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { LockKeyhole } from 'lucide-react';
import api from '../api/api';

function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] =
    useState('');
  const [message, setMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const token = useMemo(() => {
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
        'Ссылка восстановления недействительна: отсутствует токен.',
      );
      return;
    }

    if (password.length < 10) {
      setMessage(
        'Пароль должен содержать не менее 10 символов.',
      );
      return;
    }

    if (!/[a-z]/.test(password)) {
      setMessage(
        'Пароль должен содержать строчную латинскую букву.',
      );
      return;
    }

    if (!/[A-Z]/.test(password)) {
      setMessage(
        'Пароль должен содержать заглавную латинскую букву.',
      );
      return;
    }

    if (!/[0-9]/.test(password)) {
      setMessage('Пароль должен содержать цифру.');
      return;
    }

    if (password !== confirmPassword) {
      setMessage('Введённые пароли не совпадают.');
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
        'Пароль успешно изменён. Теперь вы можете войти в систему.',
      );
    } catch {
      setMessage(
        'Не удалось изменить пароль. Ссылка могла истечь или уже была использована.',
      );
    } finally {
      setIsLoading(false);
    }
  }

  function openLogin() {
    window.location.assign(
      `${window.location.origin}${window.location.pathname}`,
    );
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <p className="dashboard-eyebrow">
          GLAMOUR Salon Studio
        </p>

        <h1>Новый пароль</h1>

        <p className="login-subtitle">
          Создайте новый пароль для своей учётной записи.
        </p>

        {!isSuccess ? (
          <form
            onSubmit={handleSubmit}
            className="login-form"
          >
            <label htmlFor="new-password">
              Новый пароль
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
              Повторите пароль
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
                ? 'Сохранение…'
                : 'Установить новый пароль'}
            </button>
          </form>
        ) : (
          <button
            type="button"
            className="login-button"
            onClick={openLogin}
          >
            Перейти ко входу
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
