import { useState } from 'react';
import type { FormEvent } from 'react';
import {
  ArrowLeft,
  LockKeyhole,
  Mail,
} from 'lucide-react';
import api from '../api/api';

type PlatformRole = 'platform_owner' | null;

type LoginResponse = {
  accessToken: string;
  platformRole?: PlatformRole;
};

type LoginPageProps = {
  onLoginSuccess: (session: {
    platformRole: PlatformRole;
  }) => void;
};

function LoginPage({
  onLoginSuccess,
}: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isPasswordResetMode, setIsPasswordResetMode] =
    useState(false);
  const [isResetRequestSent, setIsResetRequestSent] =
    useState(false);

  async function handleLoginSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setMessage('');
    setIsLoading(true);

    try {
      const response = await api.post<LoginResponse>(
        '/auth/login',
        {
          email,
          password,
        },
      );

      localStorage.setItem(
        'glamour_access_token',
        response.data.accessToken,
      );

      onLoginSuccess({
        platformRole:
          response.data.platformRole === 'platform_owner'
            ? 'platform_owner'
            : null,
      });
    } catch {
      setMessage(
        'Не удалось войти. Проверьте email и пароль.',
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handlePasswordResetSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setMessage('');
    setIsLoading(true);

    try {
      await api.post('/auth/forgot-password', {
        email: email.trim(),
      });

      setIsResetRequestSent(true);
      setMessage(
        'Если учётная запись с таким email существует, письмо для восстановления пароля отправлено.',
      );
    } catch {
      setMessage(
        'Не удалось отправить запрос. Попробуйте ещё раз позднее.',
      );
    } finally {
      setIsLoading(false);
    }
  }

  function openPasswordReset() {
    setPassword('');
    setMessage('');
    setIsResetRequestSent(false);
    setIsPasswordResetMode(true);
  }

  function returnToLogin() {
    setMessage('');
    setIsResetRequestSent(false);
    setIsPasswordResetMode(false);
  }

  if (isPasswordResetMode) {
    return (
      <main className="login-page">
        <section className="login-card">
          <p className="dashboard-eyebrow">
            GLAMOUR Salon Studio
          </p>

          <h1>Восстановление пароля</h1>

          <p className="login-subtitle">
            Укажите email своей учётной записи. Мы
            отправим ссылку для создания нового пароля.
          </p>

          {!isResetRequestSent ? (
            <form
              onSubmit={handlePasswordResetSubmit}
              className="login-form"
            >
              <label htmlFor="reset-email">Email</label>

              <div className="login-field">
                <Mail size={18} aria-hidden="true" />

                <input
                  id="reset-email"
                  type="email"
                  value={email}
                  onChange={(event) =>
                    setEmail(event.target.value)
                  }
                  autoComplete="email"
                  maxLength={320}
                  required
                  autoFocus
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="login-button"
              >
                {isLoading
                  ? 'Отправка…'
                  : 'Отправить ссылку'}
              </button>
            </form>
          ) : null}

          {message ? (
            <p role="status" className="login-message">
              {message}
            </p>
          ) : null}

          <button
            type="button"
            onClick={returnToLogin}
            className="login-forgot-button"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            Вернуться ко входу
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <p className="dashboard-eyebrow">
          GLAMOUR Salon Studio
        </p>

        <h1>Вход в систему</h1>

        <p className="login-subtitle">
          Используйте свою учётную запись для доступа
          к панели управления.
        </p>

        <form
          onSubmit={handleLoginSubmit}
          className="login-form"
        >
          <label htmlFor="email">Email</label>

          <div className="login-field">
            <Mail size={18} aria-hidden="true" />

            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              autoComplete="email"
              required
            />
          </div>

          <label htmlFor="password">Пароль</label>

          <div className="login-field">
            <LockKeyhole
              size={18}
              aria-hidden="true"
            />

            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              autoComplete="current-password"
              required
            />
          </div>

          <button
            type="button"
            onClick={openPasswordReset}
            className="login-forgot-button"
          >
            Забыли пароль?
          </button>

          <button
            type="submit"
            disabled={isLoading}
            className="login-button"
          >
            {isLoading
              ? 'Выполняется вход…'
              : 'Войти'}
          </button>
        </form>

        {message ? (
          <p role="status" className="login-message">
            {message}
          </p>
        ) : null}
      </section>
    </main>
  );
}

export default LoginPage;
