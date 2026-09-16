import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  ClipboardCopy,
  Link2,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UserRound,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import api from '../api/api';
import { onPointChanged, readCurrentPoint } from '../current-point';
import AppLayout from '../components/AppLayout';

type SalonSummary = {
  id: string;
  name: string;
  membershipRole?: string | null;
  membershipRoles?: string[];
  membershipStatus?: string | null;
};

type Administrator = {
  userId: string;
  membershipId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  isActive: boolean;
  startedAt: string | null;

  /** Зал, которым он распоряжается. Пусто — весь салон. */
  locationId: string | null;
};

/** Филиал салона: первый в списке — сам салон. */
type Point = {
  id: string;
  name: string;
  isActive: boolean;
  isSalon: boolean;
};

type AdministratorsResponse = {
  items: Administrator[];
  limit: number | null;
};

type PromotionLinkResponse = {
  code: string;
  customSlug: string | null;
};

function getRegistrationUrl(link: PromotionLinkResponse): string {
  const identifier = link.customSlug || link.code;

  return `${window.location.origin}/#master-registration?invite=${encodeURIComponent(identifier)}`;
}

/**
 * Администраторы салона — место ресепшн.
 *
 * После ADR-005 записи независимых мастеров в салоне ведёт только эта
 * роль: владелец видит «Занято» и ничего больше. Поэтому страница —
 * владельца, и только его: администратор себе равных не заводит.
 */
function AdministratorsPage() {
  const { t } = useTranslation();

  const [salon, setSalon] = useState<SalonSummary | null>(null);
  const [administrators, setAdministrators] = useState<Administrator[]>([]);
  const [points, setPoints] = useState<Point[]>([]);
  /**
   * Кабинет, в котором стоит владелец. Он и решает, чьи администраторы
   * на экране: выпадающего списка «весь салон или филиал» нет — он был
   * вторым способом отвечать на тот же вопрос.
   */
  const [cabinet, setCabinet] = useState(readCurrentPoint);

  useEffect(() => onPointChanged(() => setCabinet(readCurrentPoint())), []);

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cabinet]);
  const [limit, setLimit] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const [inviteUrl, setInviteUrl] = useState('');
  const [isInviteLoading, setIsInviteLoading] = useState(false);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>(
    'idle',
  );
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);

  const seatsLeft =
    limit === null ? null : Math.max(0, limit - administrators.length);

  async function loadData() {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const salonsResponse = await api.get<SalonSummary[]>('/salons/my');
      const current = salonsResponse.data[0] ?? null;

      setSalon(current);

      if (!current) {
        setMessage(t('common.loadError'));

        return;
      }

      try {
        const pointsResponse = await api.get<{ points: Point[] }>(
          `/salons/${current.id}/locations`,
        );

        setPoints(pointsResponse.data.points.filter((point) => point.isActive));
      } catch {
        // Филиалов может не быть — тогда и ставить некуда.
      }

      const branchId = cabinet && cabinet !== 'salon' ? cabinet : '';

      const response = await api.get<AdministratorsResponse>(
        `/salons/${current.id}/administrators`,
        { params: branchId ? { locationId: branchId } : {} },
      );

      setAdministrators(response.data.items);
      setLimit(response.data.limit);
      setMessage('');
    } catch {
      setMessage(t('common.loadError'));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function createInvite() {
    if (!salon || isInviteLoading) {
      return;
    }

    setIsInviteLoading(true);
    setErrorMsg('');
    setCopyStatus('idle');

    try {
      const response = await api.post<PromotionLinkResponse>(
        `/promotion-links/salon/${salon.id}/admin-registration`,
      );

      setInviteUrl(getRegistrationUrl(response.data));
    } catch {
      setErrorMsg(t('administrators.linkError'));
    } finally {
      setIsInviteLoading(false);
    }
  }

  async function copyInviteUrl() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopyStatus('copied');
      setTimeout(() => setCopyStatus('idle'), 3000);
    } catch {
      setCopyStatus('error');
    }
  }

  async function removeAdministrator(userId: string) {
    if (!salon) {
      return;
    }

    setRemovingUserId(userId);
    setErrorMsg('');

    try {
      await api.delete(`/salons/${salon.id}/administrators/${userId}`);
      await loadData();
    } catch {
      setErrorMsg(t('administrators.removeError'));
    } finally {
      setRemovingUserId(null);
    }
  }

  return (
    <AppLayout>
      <main className="dashboard-page">
        <header className="dashboard-header">
          <div>
            <h1>{t('administrators.title')}</h1>
            <p className="dashboard-subtitle">{t('administrators.subtitle')}</p>

            {/* Чей это список. Кабинет решает, кого показывать, поэтому
                он должен быть назван — иначе владелец сети не поймёт,
                почему администратор пропал со страницы. */}
            {points.length > 1 && (
              <p
                style={{
                  marginTop: 6,
                  color: 'var(--app-text-muted)',
                  fontSize: 13,
                }}
              >
                {t('administrators.ofCabinet', {
                  name:
                    points.find((point) =>
                      cabinet && cabinet !== 'salon'
                        ? point.id === cabinet
                        : point.isSalon,
                    )?.name ?? '—',
                })}
              </p>
            )}
          </div>
        </header>

        {errorMsg && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '11px 15px',
              borderRadius: 13,
              marginBottom: 16,
              fontSize: 13,
              fontWeight: 700,
              border: '1px solid rgba(255,96,128,0.25)',
              background: 'rgba(255,96,128,0.1)',
              color: 'var(--app-danger)',
            }}
          >
            {errorMsg}
          </div>
        )}

        <section className="platform-invitations-panel" style={{ marginBottom: 24 }}>
          <div className="platform-panel-heading">
            <div>
              <p className="panel-kicker">{t('administrators.kicker')}</p>
              <h2>{t('administrators.inviteTitle')}</h2>
              <p>{t('administrators.inviteDescription')}</p>
            </div>
          </div>

          <div className="platform-invitation-layout">
            <div className="platform-invitation-form">
              <div className="platform-result-success">
                <CheckCircle2 size={21} />
                <div>
                  <strong>{t('administrators.whatTheySee')}</strong>
                  <span>{t('administrators.whatTheyDoNotSee')}</span>
                </div>
              </div>

              <p className="platform-security-note">
                {limit === null
                  ? t('administrators.noLimit')
                  : t('administrators.seatsLeft', {
                      left: seatsLeft ?? 0,
                      limit,
                    })}
              </p>

              <button
                type="button"
                className="platform-create-invitation-button"
                onClick={() => void createInvite()}
                disabled={isInviteLoading || seatsLeft === 0}
              >
                <ShieldCheck size={17} /> {t('administrators.createInvite')}
              </button>
            </div>

            <aside className="platform-invitation-result">
              {isInviteLoading && (
                <div className="platform-result-placeholder">
                  <Link2 size={28} />
                  <strong>{t('administrators.gettingLink')}</strong>
                </div>
              )}

              {!isInviteLoading && inviteUrl && (
                <>
                  <label>{t('administrators.inviteLink')}</label>
                  <div className="platform-invite-url">
                    <input
                      type="text"
                      value={inviteUrl}
                      readOnly
                      onFocus={(event) => event.currentTarget.select()}
                    />
                    <button type="button" onClick={() => void copyInviteUrl()}>
                      <ClipboardCopy size={17} /> {t('links.copy')}
                    </button>
                  </div>

                  {copyStatus === 'copied' && (
                    <p className="platform-copy-success">
                      {t('links.copied')}!
                    </p>
                  )}

                  <p className="platform-security-note">
                    {t('administrators.linkNote')}
                  </p>
                </>
              )}

              {!isInviteLoading && !inviteUrl && (
                <div className="platform-result-placeholder">
                  <Link2 size={28} />
                  <strong>{t('administrators.noLinkYet')}</strong>
                  <p>{t('administrators.noLinkYetHint')}</p>
                </div>
              )}
            </aside>
          </div>
        </section>

        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <button
            type="button"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              minHeight: 40,
              padding: '0 14px',
              border: '1px solid rgba(var(--app-ink-rgb),0.12)',
              borderRadius: 12,
              background: 'rgba(var(--app-ink-rgb),0.05)',
              color: 'var(--app-text)',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
            }}
            onClick={() => void loadData()}
            disabled={isLoading}
          >
            <RefreshCw
              size={15}
              style={isLoading ? { animation: 'spin 1s linear infinite' } : {}}
            />{' '}
            {t('masters.refresh')}
          </button>
        </div>

        <section className="dashboard-panel">
          <div className="panel-heading">
            <div>
              <p className="panel-kicker">{t('administrators.listKicker')}</p>
              <h2>{t('administrators.listTitle')}</h2>
            </div>
          </div>

          {isLoading && <p className="dashboard-status">{t('common.loading')}</p>}

          {!isLoading && message && (
            <p className="dashboard-status">{message}</p>
          )}

          {!isLoading && !message && administrators.length === 0 && (
            <div className="empty-state">
              <UserRound size={26} />
              <p>{t('administrators.empty')}</p>
              <span>{t('administrators.emptyHint')}</span>
            </div>
          )}

          {!isLoading && administrators.length > 0 && (
            <div
              style={{ display: 'flex', flexDirection: 'column', gap: 0 }}
            >
              {administrators.map((administrator) => (
                <div
                  key={administrator.userId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    flexWrap: 'wrap',
                    padding: '14px 0',
                    borderBottom: '1px solid rgba(var(--app-ink-rgb),0.06)',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <strong
                      style={{ color: 'var(--app-text)', fontSize: 14 }}
                    >
                      {administrator.firstName} {administrator.lastName}
                    </strong>
                    <div
                      style={{
                        color: 'var(--app-text-muted)',
                        fontSize: 12,
                        marginTop: 3,
                      }}
                    >
                      {administrator.email} · {administrator.phone}
                    </div>
                  </div>

                  <button
                    type="button"
                    className="danger-action"
                    onClick={() =>
                      void removeAdministrator(administrator.userId)
                    }
                    disabled={removingUserId === administrator.userId}
                  >
                    <Trash2 size={14} /> {t('administrators.remove')}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </AppLayout>
  );
}

export default AdministratorsPage;
