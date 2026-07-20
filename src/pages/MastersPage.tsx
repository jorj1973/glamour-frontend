import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  ClipboardCopy,
  Link2,
  Scissors,
  UserPlus,
  X,
} from 'lucide-react';

import api from '../api/api';
import AppLayout from '../components/AppLayout';

type Master = {
  id: string;
  userId?: string;
  photoUrl?: string | null;
  profession?: string | null;
  bio?: string | null;
  experienceYears?: number | null;
  city?: string | null;
  salonName?: string | null;
  isPublic?: boolean;
  averageRating?: number | null;
};

type SalonSummary = {
  id: string;
  name: string;
  slug: string;
  membershipRole: string;
  membershipStatus: string;
};

type PromotionLinkResponse = {
  id?: string;
  code?: string;
  slug?: string | null;
  url?: string;
  link?: string;
  shortUrl?: string;
  publicUrl?: string;
  registrationUrl?: string;
  inviteUrl?: string;
  active?: boolean;
  isActive?: boolean;
  expiresAt?: string | null;
};

function getRegistrationUrl(
  data: PromotionLinkResponse,
): string {
  const possibleUrl =
    data.registrationUrl ??
    data.publicUrl ??
    data.shortUrl ??
    data.inviteUrl ??
    data.url ??
    data.link;

  if (typeof possibleUrl === 'string' && possibleUrl.trim()) {
    return possibleUrl.trim();
  }

  if (typeof data.slug === 'string' && data.slug.trim()) {
    return `${window.location.origin}/p/${data.slug.trim()}`;
  }

  if (typeof data.code === 'string' && data.code.trim()) {
    return `${window.location.origin}/p/${data.code.trim()}`;
  }

  return '';
}

function MastersPage() {
  const [masters, setMasters] = useState<Master[]>([]);
  const [salon, setSalon] =
    useState<SalonSummary | null>(null);

  const [message, setMessage] = useState(
    'Загрузка команды салона...',
  );

  const [isRegistrationPanelOpen, setIsRegistrationPanelOpen] =
    useState(false);

  const [registrationUrl, setRegistrationUrl] =
    useState('');

  const [isLinkLoading, setIsLinkLoading] =
    useState(false);

  const [linkError, setLinkError] =
    useState('');

  const [copyStatus, setCopyStatus] =
    useState<'idle' | 'copied' | 'error'>('idle');

  useEffect(() => {
    let isCancelled = false;

    async function loadData() {
      try {
        const [mastersResponse, salonsResponse] =
          await Promise.all([
            api.get<Master[]>('/masters'),
            api.get<SalonSummary[]>('/salons/my'),
          ]);

        if (isCancelled) {
          return;
        }

        setMasters(mastersResponse.data);

        const currentSalon =
          salonsResponse.data[0] ?? null;

        setSalon(currentSalon);

        if (!currentSalon) {
          setMessage(
            'Для вашей учётной записи не найден доступный салон.',
          );
          return;
        }

        setMessage('');
      } catch {
        if (!isCancelled) {
          setMessage(
            'Не удалось загрузить данные команды салона.',
          );
        }
      }
    }

    void loadData();

    return () => {
      isCancelled = true;
    };
  }, []);

  const canManageMasterRegistration =
    salon?.membershipRole === 'salon_owner' ||
    salon?.membershipRole === 'admin';

  async function loadPermanentRegistrationLink() {
    if (
      !salon ||
      !canManageMasterRegistration ||
      isLinkLoading
    ) {
      return;
    }

    setLinkError('');
    setCopyStatus('idle');
    setIsLinkLoading(true);

    try {
      const response =
        await api.post<PromotionLinkResponse>(
          `/promotion-links/salon/${salon.id}/master-registration`,
        );

      const permanentUrl =
        getRegistrationUrl(response.data);

      if (!permanentUrl) {
        throw new Error(
          'Registration URL is missing in response',
        );
      }

      setRegistrationUrl(permanentUrl);
    } catch {
      setLinkError(
        'Не удалось получить постоянную ссылку регистрации мастеров. Повторите попытку.',
      );
    } finally {
      setIsLinkLoading(false);
    }
  }

  function openRegistrationPanel() {
    setIsRegistrationPanelOpen(true);
    setLinkError('');
    setCopyStatus('idle');

    if (!registrationUrl) {
      void loadPermanentRegistrationLink();
    }
  }

  function closeRegistrationPanel() {
    if (isLinkLoading) {
      return;
    }

    setIsRegistrationPanelOpen(false);
    setLinkError('');
    setCopyStatus('idle');
  }

  async function copyRegistrationUrl() {
    if (!registrationUrl) {
      return;
    }

    setCopyStatus('idle');

    try {
      if (
        navigator.clipboard &&
        window.isSecureContext
      ) {
        await navigator.clipboard.writeText(
          registrationUrl,
        );
      } else {
        const textarea =
          document.createElement('textarea');

        textarea.value = registrationUrl;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        textarea.style.pointerEvents = 'none';

        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();

        const copied =
          document.execCommand('copy');

        document.body.removeChild(textarea);

        if (!copied) {
          throw new Error('Copy failed');
        }
      }

      setCopyStatus('copied');
    } catch {
      setCopyStatus('error');
    }
  }

  return (
    <AppLayout>
      <main className="dashboard-page">
        <header className="dashboard-header">
          <div>
            <p className="dashboard-eyebrow">
              МАСТЕРА
            </p>

            <h1>Команда салона</h1>

            <p className="dashboard-subtitle">
              Все мастера, зарегистрированные в системе.
            </p>
          </div>

          {canManageMasterRegistration ? (
            <button
              type="button"
              className="platform-create-invitation-button"
              onClick={
                isRegistrationPanelOpen
                  ? closeRegistrationPanel
                  : openRegistrationPanel
              }
              disabled={isLinkLoading}
            >
              {isRegistrationPanelOpen ? (
                <X size={18} aria-hidden="true" />
              ) : (
                <UserPlus
                  size={18}
                  aria-hidden="true"
                />
              )}

              {isRegistrationPanelOpen
                ? 'Закрыть'
                : 'Пригласить мастера'}
            </button>
          ) : null}
        </header>

        {isRegistrationPanelOpen &&
        canManageMasterRegistration ? (
          <section className="platform-invitations-panel">
            <div className="platform-panel-heading">
              <div>
                <p className="panel-kicker">
                  РЕГИСТРАЦИЯ МАСТЕРОВ
                </p>

                <h2>
                  Постоянная ссылка салона
                </h2>

                <p>
                  Отправьте эту ссылку будущему мастеру.
                  После перехода он самостоятельно заполнит
                  свои данные и зарегистрируется в вашем
                  салоне.
                </p>
              </div>
            </div>

            <div className="platform-invitation-layout">
              <div className="platform-invitation-form">
                <div className="platform-result-success">
                  <CheckCircle2
                    size={21}
                    aria-hidden="true"
                  />

                  <div>
                    <strong>
                      Одна ссылка для всех мастеров
                    </strong>

                    <span>
                      Ссылка не имеет срока действия и
                      используется многократно.
                    </span>
                  </div>
                </div>

                <p className="platform-security-note">
                  Вам не нужно заранее вводить email,
                  телефон или другие данные мастера.
                  Каждый мастер указывает их самостоятельно
                  во время регистрации.
                </p>
              </div>

              <aside className="platform-invitation-result">
                {isLinkLoading ? (
                  <div className="platform-result-placeholder">
                    <Link2
                      size={28}
                      aria-hidden="true"
                    />

                    <strong>
                      Получаем ссылку
                    </strong>

                    <p>
                      Подождите несколько секунд.
                    </p>
                  </div>
                ) : null}

                {!isLinkLoading && linkError ? (
                  <div className="platform-result-placeholder">
                    <Link2
                      size={28}
                      aria-hidden="true"
                    />

                    <strong>
                      Ссылка не получена
                    </strong>

                    <p
                      className="platform-invitation-error"
                      role="alert"
                    >
                      {linkError}
                    </p>

                    <button
                      type="button"
                      className="platform-create-invitation-button"
                      onClick={() =>
                        void loadPermanentRegistrationLink()
                      }
                    >
                      Получить ссылку повторно
                    </button>
                  </div>
                ) : null}

                {!isLinkLoading &&
                !linkError &&
                registrationUrl ? (
                  <>
                    <label>
                      Постоянная регистрационная ссылка
                    </label>

                    <div className="platform-invite-url">
                      <input
                        type="text"
                        value={registrationUrl}
                        readOnly
                        onFocus={(event) =>
                          event.currentTarget.select()
                        }
                      />

                      <button
                        type="button"
                        onClick={() =>
                          void copyRegistrationUrl()
                        }
                      >
                        <ClipboardCopy
                          size={17}
                          aria-hidden="true"
                        />

                        Копировать
                      </button>
                    </div>

                    {copyStatus === 'copied' ? (
                      <p className="platform-copy-success">
                        Ссылка скопирована.
                      </p>
                    ) : null}

                    {copyStatus === 'error' ? (
                      <p className="platform-invitation-error">
                        Не удалось скопировать ссылку
                        автоматически. Выделите её и
                        скопируйте вручную.
                      </p>
                    ) : null}

                    <p className="platform-security-note">
                      При повторном открытии система
                      возвращает ту же активную ссылку
                      салона, а не создаёт новое
                      одноразовое приглашение.
                    </p>
                  </>
                ) : null}
              </aside>
            </div>
          </section>
        ) : null}

        {message ? (
          <p className="dashboard-status">
            {message}
          </p>
        ) : (
          <section className="dashboard-panel">
            <div className="panel-heading">
              <div>
                <p className="panel-kicker">
                  КОМАНДА
                </p>

                <h2>
                  {masters.length} мастеров
                </h2>
              </div>

              <Scissors size={22} />
            </div>

            {masters.length === 0 ? (
              <p className="dashboard-status">
                В системе пока нет зарегистрированных
                мастеров.
              </p>
            ) : (
              <div className="ranking-list">
                {masters.map((master, index) => {
                  const rating =
                    typeof master.averageRating ===
                    'number'
                      ? `${master.averageRating.toFixed(
                          1,
                        )} ★`
                      : 'Нет рейтинга';

                  const experience =
                    typeof master.experienceYears ===
                    'number'
                      ? `${master.experienceYears} лет опыта`
                      : 'Опыт не указан';

                  return (
                    <div
                      className="ranking-row"
                      key={master.id}
                    >
                      <span className="ranking-number">
                        {index + 1}
                      </span>

                      <div className="ranking-main">
                        <strong>
                          {master.profession ||
                            'Профессия не указана'}
                        </strong>

                        <span>
                          {master.salonName ||
                            'Салон не указан'}
                        </span>

                        {master.city ? (
                          <span>
                            {master.city}
                          </span>
                        ) : null}
                      </div>

                      <div className="ranking-value">
                        <strong>{rating}</strong>
                        <span>{experience}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </main>
    </AppLayout>
  );
}

export default MastersPage;
