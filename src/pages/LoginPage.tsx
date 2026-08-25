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
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
        t('login.enterCredentials'),
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
        t('login.failed'),
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
      setMessage(t('login.enterEmail'));
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
        t('login.resetSent'),
      );
      setMessageType('success');
    } catch {
      setMessage(
        t('login.resetFailed'),
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
            {t('login.resetTitle')}
          </h1>

          {!isResetRequestSent ? (
            <>
              <p className="login-subtitle">
                {t('login.resetSubtitle')}
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
                      {t('login.sending')}
                    </>
                  ) : (
                    t('login.sendLink')
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

              <h2>{t('login.checkEmail')}</h2>

              <p>
                {t('login.instructionSentTo')}
              </p>

              <strong>{email}</strong>

              <p className="login-reset-hint">
                {t('login.checkSpam')}
              </p>

              <button
                type="button"
                onClick={retryPasswordReset}
                className="login-secondary-button"
              >
                <RotateCcw size={16} aria-hidden="true" />
                {t('login.otherEmail')}
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
            {t('login.backToLogin')}
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

        <h1 id="login-title">{t('login.title')}</h1>

        <p className="login-subtitle">
          {t('login.subtitle')}
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

          <label htmlFor="password">{t('login.password')}</label>

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
              placeholder={t('login.passwordPlaceholder')}
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
                  ? t('login.hidePassword')
                  : t('login.showPassword')
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
            {t('login.forgot')}
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
                {t('login.signingIn')}
              </>
            ) : (
              t('login.signIn')
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
