import { useEffect, useState } from 'react';
import {
  Check,
  ClipboardCopy,
  ExternalLink,
  Link2,
  Plus,
  RefreshCw,
  Share2,
  Store,
  X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../api/api';
import AppLayout from '../components/AppLayout';
import { LinkQrButton } from '../components/LinkQrCode';

type WorkspaceMode = 'platform' | 'salon' | 'master';

type SalonSummary = {
  id: string;
  name: string;
  membershipRole?: string | null;
  membershipRoles?: string[];
  membershipStatus?: string | null;
};

type PromotionLink = {
  id: string;
  salonId: string;
  ownerType: string;
  targetType: string;
  code: string;
  customSlug: string | null;
  title: string;
  campaignName: string | null;
  trafficSource: string | null;
  isPrimary: boolean;
  isActive: boolean;
  expiresAt: string | null;
  createdAt: string;
};

const WORKSPACE_MODE_KEY = 'glamour_workspace_mode';
const CURRENT_SALON_ID_KEY = 'glamour_current_salon_id';

/**
 * Подпись ссылки по её назначению.
 *
 * Название из базы задаётся при создании и остаётся на том
 * языке, на котором его завели. Подпись по назначению
 * переводится вместе с остальным приложением.
 */
function linkTitle(targetType: string, t: (key: string) => string): string {
  switch (targetType) {
    case 'master_registration':
      return t('links.titleMasterRegistration');

    case 'master':
      return t('links.titleMaster');

    case 'salon':
      return t('links.titleSalon');

    case 'service':
      return t('links.titleService');

    case 'promotion':
      return t('links.titlePromotion');

    default:
      return t('links.titleBooking');
  }
}

function getWorkspaceMode(): WorkspaceMode {
  const mode = localStorage.getItem(WORKSPACE_MODE_KEY);

  if (mode === 'platform' || mode === 'salon' || mode === 'master') {
    return mode;
  }

  return 'salon';
}

/**
 * Формирует публичный URL в зависимости от назначения promotion link.
 *
 * ВАЖНО:
 * master_registration — только регистрация мастера.
 *
 * salon / master / service / booking / promotion —
 * публичный клиентский booking flow.
 */
function getLinkUrl(link: PromotionLink): string {
  const identifier = link.customSlug?.trim() || link.code?.trim() || '';

  if (!identifier) {
    return window.location.origin;
  }

  const encodedIdentifier = encodeURIComponent(identifier);

  switch (link.targetType) {
    case 'master_registration':
      return `${window.location.origin}/#master-register?identifier=${encodedIdentifier}`;

    // Короткая форма без вопросительного знака: мессенджеры и почтовые
    // клиенты режут адрес именно по нему, и до салона доезжала половина
    // ссылки. Прежняя форма продолжает открываться — уже напечатанные
    // визитки и разосланные письма не должны перестать работать.
    case 'salon':
    case 'master':
    case 'service':
    case 'booking':
    case 'promotion':
      return `${window.location.origin}/#salon/${encodedIdentifier}`;

    default:
      return `${window.location.origin}/#salon/${encodedIdentifier}`;
  }
}

const SOURCES = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'telegram', label: 'Telegram' },
  { value: 'google', label: 'Google' },
  { value: 'offline', label: 'Offline' },
  { value: 'other', label: 'Other' },
];

function PromotionLinksPage() {
  const workspaceMode = getWorkspaceMode();
  const { t } = useTranslation();

  const isMasterWorkspace = workspaceMode === 'master';

  const [salon, setSalon] = useState<SalonSummary | null>(null);
  const [links, setLinks] = useState<PromotionLink[]>([]);
  const [message, setMessage] = useState(t('links.loading'));
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [formTitle, setFormTitle] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formCampaign, setFormCampaign] = useState('');
  const [formSource, setFormSource] = useState('instagram');

  async function loadSalon(): Promise<SalonSummary | null> {
    const res = await api.get<SalonSummary[]>('/salons/my');

    if (res.data.length === 0) {
      return null;
    }

    if (!isMasterWorkspace) {
      return res.data[0] ?? null;
    }

    const masterSalons = res.data.filter(
      (s) =>
        s.membershipStatus === 'active' &&
        (s.membershipRoles?.includes('master') ||
          s.membershipRole === 'master'),
    );

    if (masterSalons.length === 0) {
      return null;
    }

    const savedId = localStorage.getItem(CURRENT_SALON_ID_KEY);

    const found = savedId
      ? masterSalons.find((s) => s.id === savedId)
      : undefined;

    return found ?? masterSalons[0];
  }

  async function loadLinks(salonId: string) {
    setIsLoading(true);

    try {
      const res = await api.get<PromotionLink[]>(
        `/promotion-links/salon/${salonId}`,
      );

      setLinks(res.data);
      setMessage('');
    } catch {
      setMessage(t('links.loadError'));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const s = await loadSalon();

        if (cancelled) {
          return;
        }

        setSalon(s);

        if (!s) {
          setMessage(t('links.salonNotFound'));
          return;
        }

        await loadLinks(s.id);
      } catch {
        if (!cancelled) {
          setMessage(t('links.dataError'));
        }
      }
    }

    void init();

    return () => {
      cancelled = true;
    };
  }, [isMasterWorkspace]);

  async function copyLink(link: PromotionLink) {
    const url = getLinkUrl(link);

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(url);
      } else {
        const ta = document.createElement('textarea');

        ta.value = url;
        ta.style.cssText = 'position:fixed;opacity:0';

        document.body.appendChild(ta);

        ta.select();

        document.execCommand('copy');

        document.body.removeChild(ta);
      }

      setCopiedId(link.id);

      setTimeout(() => {
        setCopiedId(null);
      }, 2500);
    } catch {
      // Clipboard API может быть недоступен в некоторых браузерах.
    }
  }

  function shareVia(platform: string, link: PromotionLink) {
    const url = getLinkUrl(link);

    const text = encodeURIComponent(t('links.shareText') + ': ' + url);

    const urls: Record<string, string> = {
      whatsapp: `https://wa.me/?text=${text}`,
      telegram: `https://t.me/share/url?url=${encodeURIComponent(
        url,
      )}&text=${encodeURIComponent(t('links.shareText'))}`,
    };

    if (urls[platform]) {
      window.open(urls[platform], '_blank');
    }
  }

  async function handleCreateLink(e: React.FormEvent) {
    e.preventDefault();

    if (!salon || !formTitle.trim()) {
      setErrorMsg(t('links.enterTitle'));
      return;
    }

    if (
      formSlug &&
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(formSlug)
    ) {
      setErrorMsg(
        t('links.slugFormatError'),
      );
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      await api.post('/promotion-links', {
        salonId: salon.id,
        ownerType: 'salon',
        targetType: 'salon',
        targetId: salon.id,
        title: formTitle.trim(),
        customSlug: formSlug.trim() || undefined,
        campaignName: formCampaign.trim() || undefined,
        trafficSource: formSource || undefined,
        isActive: true,
      });

      await loadLinks(salon.id);

      setShowForm(false);
      setFormTitle('');
      setFormSlug('');
      setFormCampaign('');
      setFormSource('instagram');

      setSuccessMsg(t('links.created'));

      setTimeout(() => {
        setSuccessMsg('');
      }, 3000);
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? '';

      if (msg.includes('slug')) {
        setErrorMsg(t('links.slugError'));
      } else {
        setErrorMsg(t('links.createError'));
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  const clientLinks = links.filter(
    (link) =>
      link.ownerType === 'salon' &&
      link.targetType === 'salon',
  );

  const registrationLinks = links.filter(
    (link) => link.targetType === 'master_registration',
  );

  const masterLinks = links.filter(
    (link) =>
      link.ownerType === 'master' &&
      link.targetType !== 'master_registration',
  );

  return (
    <AppLayout>
      <main className="dashboard-page">
        <header className="dashboard-header">
          <div>

            <h1>{t('links.title')}</h1>

            <p className="dashboard-subtitle">
              {t('links.subtitle')}
            </p>
          </div>

          <div
            style={{
              display: 'flex',
              gap: 10,
            }}
          >
            <button
              type="button"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                minHeight: 46,
                padding: '0 18px',
                border: 0,
                borderRadius: 14,
                background: 'var(--app-accent)',
                color: '#17151c',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
              }}
              onClick={() => setShowForm(!showForm)}
            >
              <Plus size={17} />
              {t('links.newLink')}
            </button>

            <button
              type="button"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                minHeight: 46,
                padding: '0 14px',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 14,
                background: 'rgba(255,255,255,0.05)',
                color: 'var(--app-text)',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
              }}
              onClick={() => salon && loadLinks(salon.id)}
              disabled={isLoading}
            >
              <RefreshCw
                size={15}
                style={
                  isLoading
                    ? { animation: 'spin 1s linear infinite' }
                    : {}
                }
              />
              {t('links.refresh')}
            </button>
          </div>
        </header>

        {successMsg && (
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
              border: '1px solid rgba(77,208,139,0.25)',
              background: 'rgba(77,208,139,0.1)',
              color: '#9ae9bd',
            }}
          >
            <Check size={15} />
            {successMsg}
          </div>
        )}

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
            <X size={15} />
            {errorMsg}
          </div>
        )}

        {showForm && (
          <article
            className="dashboard-panel"
            style={{ marginBottom: 24 }}
          >
            <div className="panel-heading">
              <div>
                <p className="panel-kicker">{t('links.newLink').toUpperCase()}</p>
                <h2>{t('links.createPanelTitle')}</h2>
              </div>

              <button
                type="button"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 34,
                  height: 34,
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 10,
                  background: 'rgba(255,255,255,0.05)',
                  color: 'var(--app-text-muted)',
                  cursor: 'pointer',
                }}
                onClick={() => setShowForm(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form
              className="service-form"
              onSubmit={handleCreateLink}
            >
              <label>
                {t('links.titleLabel')} *
                <input
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder={t('links.titlePlaceholder')}
                  required
                />
              </label>

              <div className="service-form-grid">
                <label>
                  {t('links.slug')}
                  <input
                    value={formSlug}
                    onChange={(e) =>
                      setFormSlug(
                        e.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9-]/g, ''),
                      )
                    }
                    placeholder="salon-instagram"
                  />
                </label>

                <label>
                  {t('links.source')}

                  <select
                    value={formSource}
                    onChange={(e) =>
                      setFormSource(e.target.value)
                    }
                    style={{
                      padding: '11px 13px',
                      border:
                        '1px solid rgba(255,255,255,0.12)',
                      borderRadius: 13,
                      background: 'rgba(255,255,255,0.06)',
                      color: 'var(--app-text)',
                      fontSize: 14,
                    }}
                  >
                    {SOURCES.map((source) => (
                      <option
                        key={source.value}
                        value={source.value}
                      >
                        {t('links.sources.' + source.value)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label>
                {t('links.campaign')}
                <input
                  value={formCampaign}
                  onChange={(e) =>
                    setFormCampaign(e.target.value)
                  }
                  placeholder={t('links.campaignPlaceholder')}
                />
              </label>

              <div
                style={{
                  display: 'flex',
                  gap: 10,
                }}
              >
                <button
                  type="submit"
                  className="primary-action"
                  style={{ flex: 1 }}
                  disabled={isSubmitting}
                >
                  {isSubmitting
                    ? t('common.creating')
                    : t('links.createButton')}
                </button>

                <button
                  type="button"
                  className="danger-action"
                  onClick={() => setShowForm(false)}
                >
                  {t('common.cancel')}
                </button>
              </div>
            </form>
          </article>
        )}

        {message && !links.length ? (
          <p className="dashboard-status">{message}</p>
        ) : (
          <>
              <section
                className="dashboard-panel"
                style={{ marginBottom: 24 }}
              >
              <div className="panel-heading">
                  <div>
                    <p className="panel-kicker">
                      {t('links.forClients')}
                    </p>

                    <h2>{t('links.count', { count: clientLinks.length })}</h2>
                  </div>

                <Store size={22} />
              </div>

              {clientLinks.length === 0 ? (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 12,
                      padding: '40px 20px',
                      color: 'var(--app-text-muted)',
                      textAlign: 'center',
                    }}
                  >
                    <Link2
                      size={36}
                      style={{
                        color: 'var(--app-accent-text)',
                        opacity: 0.4,
                      }}
                    />

                  <p>{t('links.noSalonLinks')}</p>

                    <button
                      type="button"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 7,
                        minHeight: 40,
                        padding: '0 16px',
                        border: 0,
                        borderRadius: 12,
                        background: 'var(--app-accent)',
                        color: '#17151c',
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                      onClick={() => setShowForm(true)}
                    >
                      <Plus size={15} />
                      {t('links.createFirst')}
                    </button>
                </div>
              ) : (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 12,
                      }}
                    >
                  {clientLinks.map((link) => (
                    <div
                      key={link.id}
                      style={{
                        padding: '16px 18px',
                        border:
                          '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 16,
                        background: link.isActive
                          ? 'rgba(255,255,255,0.03)'
                          : 'rgba(255,255,255,0.01)',
                        opacity: link.isActive ? 1 : 0.6,
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          gap: 12,
                          flexWrap: 'wrap',
                        }}
                      >
                        <div
                          style={{
                            flex: 1,
                            minWidth: 0,
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              flexWrap: 'wrap',
                              marginBottom: 6,
                            }}
                          >
                            <strong
                              style={{
                                color: 'var(--app-text)',
                                fontSize: 14,
                              }}
                            >
                              {linkTitle(link.targetType, t)}
                            </strong>

                            {link.isPrimary && (
                              <span
                                style={{
                                  padding: '2px 8px',
                                  borderRadius: 999,
                                  fontSize: 11,
                                  fontWeight: 700,
                                  background:
                                    'rgba(var(--app-accent-rgb), 0.15)',
                                  color: 'var(--app-danger)',
                                }}
                              >
                                {t('links.primary')}
                              </span>
                            )}

                            {link.trafficSource && (
                              <span
                                style={{
                                  padding: '2px 8px',
                                  borderRadius: 999,
                                  fontSize: 11,
                                  background:
                                    'rgba(255,255,255,0.08)',
                                  color: 'var(--app-text-muted)',
                                }}
                              >
                                {link.trafficSource}
                              </span>
                            )}

                            {!link.isActive && (
                              <span
                                style={{
                                  padding: '2px 8px',
                                  borderRadius: 999,
                                  fontSize: 11,
                                  background:
                                    'rgba(255,96,128,0.12)',
                                  color: 'var(--app-danger)',
                                }}
                              >
                                {t('links.disabled')}
                              </span>
                            )}
                          </div>

                          <div
                            style={{
                              padding: '8px 12px',
                              borderRadius: 10,
                              background:
                                'rgba(255,255,255,0.04)',
                              fontFamily: 'monospace',
                              fontSize: 12,
                              color: 'var(--app-text-muted)',
                              wordBreak: 'break-all',
                            }}
                          >
                            {getLinkUrl(link)}
                          </div>
                        </div>

                        <div
                          style={{
                            display: 'flex',
                            gap: 6,
                            flexShrink: 0,
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => copyLink(link)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              minHeight: 36,
                              padding: '0 12px',
                              border:
                                '1px solid rgba(255,255,255,0.1)',
                              borderRadius: 10,
                              background:
                                copiedId === link.id
                                  ? 'rgba(77,208,139,0.1)'
                                  : 'rgba(255,255,255,0.05)',
                              color:
                                copiedId === link.id
                                  ? '#8ee5b5'
                                  : 'var(--app-text)',
                              fontSize: 12,
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            {copiedId === link.id ? (
                              <Check size={14} />
                            ) : (
                              <ClipboardCopy size={14} />
                            )}

                            {copiedId === link.id
                              ? t('links.copied')
                              : t('links.copy')}
                          </button>

                          <a
                            href={getLinkUrl(link)}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: 36,
                              height: 36,
                              border:
                                '1px solid rgba(255,255,255,0.1)',
                              borderRadius: 10,
                              background:
                                'rgba(255,255,255,0.05)',
                              color: 'var(--app-text)',
                              textDecoration: 'none',
                            }}
                          >
                            <ExternalLink size={14} />
                          </a>
                        </div>
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          gap: 8,
                          marginTop: 12,
                          flexWrap: 'wrap',
                        }}
                      >
                        <p
                          style={{
                            color: 'var(--app-text-muted)',
                            fontSize: 12,
                            margin: 0,
                            flex: 1,
                          }}
                        >
                          {t('links.share')}
                        </p>

                        <button
                          type="button"
                          onClick={() =>
                            shareVia('whatsapp', link)
                          }
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            minHeight: 32,
                            padding: '0 12px',
                            border:
                              '1px solid rgba(37,211,102,0.25)',
                            borderRadius: 10,
                            background:
                              'rgba(37,211,102,0.08)',
                            color: '#4de06e',
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          WhatsApp
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            shareVia('telegram', link)
                          }
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            minHeight: 32,
                            padding: '0 12px',
                            border:
                              '1px solid rgba(41,182,246,0.25)',
                            borderRadius: 10,
                            background:
                              'rgba(41,182,246,0.08)',
                            color: '#67c8f7',
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          Telegram
                        </button>

                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '0 12px',
                            border:
                              '1px solid rgba(var(--app-accent-rgb), 0.15)',
                            borderRadius: 10,
                            background:
                              'rgba(var(--app-accent-rgb), 0.06)',
                            color: 'var(--app-danger)',
                            fontSize: 12,
                          }}
                        >
                          <LinkQrButton value={getLinkUrl(link)} bare />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {registrationLinks.length > 0 && (
                <section
                  className="dashboard-panel"
                  style={{ marginBottom: 24 }}
                >
                <div className="panel-heading">
                    <div>
                      <p className="panel-kicker">
                        {t('links.forMasterReg')}
                      </p>

                      <h2>{t('links.forMasterReg')}</h2>
                    </div>
                </div>

                  <p
                    style={{
                      color: 'var(--app-text-muted)',
                      fontSize: 13,
                      marginBottom: 12,
                    }}
                  >
                    {t('links.masterRegDesc')}
                  </p>

                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                    }}
                  >
                  {registrationLinks.map((link) => (
                    <div
                      key={link.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '12px 16px',
                        border:
                          '1px solid rgba(255,208,139,0.2)',
                        borderRadius: 14,
                        background:
                          'rgba(255,208,139,0.04)',
                      }}
                    >
                      <div
                        style={{
                          flex: 1,
                          minWidth: 0,
                        }}
                      >
                        <strong
                          style={{
                            color: 'var(--app-text)',
                            fontSize: 13,
                          }}
                        >
                          {linkTitle(link.targetType, t)}
                        </strong>

                        <div
                          style={{
                            color: 'var(--app-text-muted)',
                            fontSize: 12,
                            marginTop: 3,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {getLinkUrl(link)}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => copyLink(link)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          minHeight: 34,
                          padding: '0 12px',
                          border:
                            '1px solid rgba(255,255,255,0.1)',
                          borderRadius: 10,
                          background:
                            'rgba(255,255,255,0.05)',
                          color: 'var(--app-text)',
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: 'pointer',
                          flexShrink: 0,
                        }}
                      >
                        {copiedId === link.id ? (
                          <Check size={13} />
                        ) : (
                          <ClipboardCopy size={13} />
                        )}

                        {copiedId === link.id
                          ? t('links.copied')
                          : t('links.copy')}
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {masterLinks.length > 0 && (
              <section className="dashboard-panel">
                <div className="panel-heading">
                    <div>
                      <p className="panel-kicker">
                        {t('links.forMasters')}
                      </p>

                      <h2>{t('links.count', { count: masterLinks.length })}</h2>
                    </div>

                  <Share2 size={22} />
                </div>

                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                    }}
                  >
                  {masterLinks.map((link) => (
                    <div
                      key={link.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '12px 16px',
                        border:
                          '1px solid rgba(255,255,255,0.07)',
                        borderRadius: 14,
                        background:
                          'rgba(255,255,255,0.02)',
                      }}
                    >
                      <div
                        style={{
                          flex: 1,
                          minWidth: 0,
                        }}
                      >
                        <strong
                          style={{
                            color: 'var(--app-text)',
                            fontSize: 13,
                          }}
                        >
                          {linkTitle(link.targetType, t)}
                        </strong>

                        <div
                          style={{
                            color: 'var(--app-text-muted)',
                            fontSize: 12,
                            marginTop: 3,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {getLinkUrl(link)}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => copyLink(link)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          minHeight: 34,
                          padding: '0 12px',
                          border:
                            '1px solid rgba(255,255,255,0.1)',
                          borderRadius: 10,
                          background:
                            'rgba(255,255,255,0.05)',
                          color: 'var(--app-text)',
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: 'pointer',
                          flexShrink: 0,
                        }}
                      >
                        {copiedId === link.id ? (
                          <Check size={13} />
                        ) : (
                          <ClipboardCopy size={13} />
                        )}

                        {copiedId === link.id
                          ? t('links.copied')
                          : t('links.copy')}
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>

      <style>
        {'@keyframes spin { to { transform: rotate(360deg); } }'}
      </style>
    </AppLayout>
  );
}

export default PromotionLinksPage;