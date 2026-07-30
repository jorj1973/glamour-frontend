import { useState } from 'react';
import type { FormEvent } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  Mail,
  RotateCcw,
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

type MessageType = 'error' | 'success' | null;

function LoginPage({
  onLoginSuccess,
}: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] =
    useState<MessageType>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] =
    useState(false);
  const [isPasswordResetMode, setIsPasswordResetMode] =
    useState(false);
  const [isResetRequestSent, setIsResetRequestSent] =
    useState(false);

  function clearMessage() {
    setMessage('');
    setMessageType(null);
  }

  async function handleLoginSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    clearMessage();

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      setMessage(
        'Введите email и пароль своей учётной записи.',
      );
      setMessageType('error');
      return;
    }

    setIsLoading(true);

    try {
      const response = await api.post<LoginResponse>(
        '/auth/login',
        {
          email: normalizedEmail,
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
      setMessageType('error');
    } finally {
      setIsLoading(false);
    }
  }

  async function handlePasswordResetSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    clearMessage();

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setMessage('Введите email своей учётной записи.');
      setMessageType('error');
      return;
    }

    setIsLoading(true);

    try {
      await api.post('/auth/forgot-password', {
        email: normalizedEmail,
      });

      setEmail(normalizedEmail);
      setIsResetRequestSent(true);
      setMessage(
        'Если учётная запись с таким email существует, письмо со ссылкой для восстановления пароля отправлено.',
      );
      setMessageType('success');
    } catch {
      setMessage(
        'Не удалось отправить запрос. Попробуйте ещё раз позднее.',
      );
      setMessageType('error');
    } finally {
      setIsLoading(false);
    }
  }

  function openPasswordReset() {
    setPassword('');
    setIsPasswordVisible(false);
    setIsResetRequestSent(false);
    clearMessage();
    setIsPasswordResetMode(true);
  }

  function returnToLogin() {
    setPassword('');
    setIsPasswordVisible(false);
    setIsResetRequestSent(false);
    clearMessage();
    setIsPasswordResetMode(false);
  }

  function retryPasswordReset() {
    setIsResetRequestSent(false);
    clearMessage();
  }

  if (isPasswordResetMode) {
    return (
      <main className="login-page">
        <section
          className="login-card"
          aria-labelledby="password-reset-title"
        >
          <p className="dashboard-eyebrow">
            GLAMOUR Salon Studio
          </p>

          <h1 id="password-reset-title">
            Восстановление пароля
          </h1>

          {!isResetRequestSent ? (
            <>
              <p className="login-subtitle">
                Укажите email своей учётной записи. Мы
                отправим ссылку для создания нового пароля.
              </p>

              <form
                onSubmit={handlePasswordResetSubmit}
                className="login-form"
                noValidate
              >
                <label htmlFor="reset-email">Email</label>

                <div className="login-field">
                  <Mail size={18} aria-hidden="true" />

                  <input
                    id="reset-email"
                    type="email"
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      clearMessage();
                    }}
                    autoComplete="email"
                    inputMode="email"
                    maxLength={320}
                    placeholder="name@example.com"
                    disabled={isLoading}
                    required
                    autoFocus
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="login-button"
                >
                  {isLoading ? (
                    <>
                      <LoaderCircle
                        size={18}
                        className="login-spinner"
                        aria-hidden="true"
                      />
                      Отправка…
                    </>
                  ) : (
                    'Отправить ссылку'
                  )}
                </button>
              </form>
            </>
          ) : (
            <div className="login-reset-success">
              <CheckCircle2
                size={42}
                aria-hidden="true"
              />

              <h2>Проверьте почту</h2>

              <p>
                Инструкция по восстановлению пароля
                отправлена на:
              </p>

              <strong>{email}</strong>

              <p className="login-reset-hint">
                Проверьте также папки «Спам» и
                «Нежелательная почта».
              </p>

              <button
                type="button"
                onClick={retryPasswordReset}
                className="login-secondary-button"
              >
                <RotateCcw size={16} aria-hidden="true" />
                Указать другой email
              </button>
            </div>
          )}

          {message ? (
            <p
              role={messageType === 'error' ? 'alert' : 'status'}
              aria-live="polite"
              className={`login-message ${
                messageType === 'success'
                  ? 'login-message-success'
                  : 'login-message-error'
              }`}
            >
              {message}
            </p>
          ) : null}

          <button
            type="button"
            onClick={returnToLogin}
            disabled={isLoading}
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
      <section
        className="login-card"
        aria-labelledby="login-title"
      >
        <p className="dashboard-eyebrow">
          GLAMOUR Salon Studio
        </p>

        <h1 id="login-title">Вход в систему</h1>

        <p className="login-subtitle">
          Используйте свою учётную запись для доступа к
          панели управления.
        </p>

        <form
          onSubmit={handleLoginSubmit}
          className="login-form"
          noValidate
        >
          <label htmlFor="email">Email</label>

          <div className="login-field">
            <Mail size={18} aria-hidden="true" />

            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                clearMessage();
              }}
              autoComplete="email"
              inputMode="email"
              maxLength={320}
              placeholder="name@example.com"
              disabled={isLoading}
              required
              autoFocus
            />
          </div>

          <label htmlFor="password">Пароль</label>

          <div className="login-field">
            <LockKeyhole size={18} aria-hidden="true" />

            <input
              id="password"
              type={
                isPasswordVisible ? 'text' : 'password'
              }
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                clearMessage();
              }}
              autoComplete="current-password"
              placeholder="Введите пароль"
              disabled={isLoading}
              required
            />

            <button
              type="button"
              className="login-password-toggle"
              onClick={() =>
                setIsPasswordVisible((current) => !current)
              }
              disabled={isLoading}
              aria-label={
                isPasswordVisible
                  ? 'Скрыть пароль'
                  : 'Показать пароль'
              }
              aria-pressed={isPasswordVisible}
            >
              {isPasswordVisible ? (
                <EyeOff size={18} aria-hidden="true" />
              ) : (
                <Eye size={18} aria-hidden="true" />
              )}
            </button>
          </div>

          <button
            type="button"
            onClick={openPasswordReset}
            disabled={isLoading}
            className="login-forgot-button"
          >
            Забыли пароль?
          </button>

          <button
            type="submit"
            disabled={isLoading}
            className="login-button"
          >
            {isLoading ? (
              <>
                <LoaderCircle
                  size={18}
                  className="login-spinner"
                  aria-hidden="true"
                />
                Выполняется вход…
              </>
            ) : (
              'Войти'
            )}
          </button>
        </form>

        {message ? (
          <p
            role="alert"
            aria-live="polite"
            className="login-message login-message-error"
          >
            {message}
          </p>
        ) : null}
      </section>
    </main>
  );
}

export default LoginPage;
