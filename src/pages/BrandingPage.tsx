import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import {
  Check,
  Image,
  ImagePlus,
  LoaderCircle,
  Monitor,
  Moon,
  Palette,
  Save,
  Sun,
  Trash2,
} from 'lucide-react';

import { useTranslation } from 'react-i18next';
import api from '../api/api';
import AppLayout from '../components/AppLayout';
import { applyTheme } from '../theme';

type ThemeMode = 'light' | 'dark' | 'system';
type BrandingImageType = 'logo' | 'cover';

type SalonSummary = {
  id: string;
  name: string;
  slug: string;
  membershipRole: string;
  membershipStatus: string;
};

type SalonBranding = {
  id: string;
  salonId: string;
  displayName: string | null;
  welcomeText: string | null;
  logoUrl: string | null;
  faviconUrl: string | null;
  coverImageUrl: string | null;
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  themeMode: ThemeMode;
  showPoweredByGlamour: boolean;
  isBrandingEnabled: boolean;
};

const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
];

const MAX_LOGO_SIZE_BYTES = 2 * 1024 * 1024;
const MAX_COVER_SIZE_BYTES = 5 * 1024 * 1024;

function BrandingPage() {
  const { t } = useTranslation();
  const [salon, setSalon] = useState<SalonSummary | null>(null);
  const [branding, setBranding] = useState<SalonBranding | null>(null);
  const [status, setStatus] = useState(t('branding.loading'));
  const [isSaving, setIsSaving] = useState(false);
  const [activeImageAction, setActiveImageAction] =
    useState<BrandingImageType | null>(null);

  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const salonsResponse =
          await api.get<SalonSummary[]>('/salons/my');
        const currentSalon = salonsResponse.data[0];

        if (!currentSalon) {
          setStatus(
            t('branding.noSalon'),
          );
          return;
        }

        setSalon(currentSalon);

        const brandingResponse = await api.get<SalonBranding>(
          `/salons/${currentSalon.id}/branding`,
        );

        setBranding(brandingResponse.data);
        applyTheme(brandingResponse.data.themeMode);
        setStatus('');
      } catch {
        setStatus(
          t('branding.loadError'),
        );
      }
    }

    loadData();
  }, []);

  function updateField<K extends keyof SalonBranding>(
    field: K,
    value: SalonBranding[K],
  ) {
    setBranding((current) =>
      current
        ? {
            ...current,
            [field]: value,
          }
        : current,
    );
  }

  function validateImage(
    imageType: BrandingImageType,
    file: File,
  ): string | null {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return t('branding.imageFormat');
    }

    const maximumSize =
      imageType === 'logo'
        ? MAX_LOGO_SIZE_BYTES
        : MAX_COVER_SIZE_BYTES;

    if (file.size > maximumSize) {
      return imageType === 'logo'
        ? t('branding.logoTooBig')
        : t('branding.coverTooBig');
    }

    return null;
  }

  async function uploadImage(
    imageType: BrandingImageType,
    file: File,
  ) {
    if (!salon) {
      return;
    }

    const validationError = validateImage(imageType, file);

    if (validationError) {
      setStatus(validationError);
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    setActiveImageAction(imageType);
    setStatus('');

    try {
      const response = await api.post<SalonBranding>(
        `/salons/${salon.id}/branding/${imageType}`,
        formData,
      );

      setBranding(response.data);
      window.dispatchEvent(
        new Event('glamour-branding-updated'),
      );
      setStatus(
        imageType === 'logo'
          ? t('branding.logo') + ' ' + t('common.success')
          : t('branding.cover') + ' ' + t('common.success'),
      );
    } catch {
      setStatus(
        imageType === 'logo'
          ? t('branding.logoUploadError')
          : t('branding.coverUploadError'),
      );
    } finally {
      setActiveImageAction(null);
    }
  }

  async function handleImageChange(
    imageType: BrandingImageType,
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];

    event.target.value = '';

    if (!file) {
      return;
    }

    await uploadImage(imageType, file);
  }

  async function deleteImage(imageType: BrandingImageType) {
    if (!salon) {
      return;
    }

    setActiveImageAction(imageType);
    setStatus('');

    try {
      const response = await api.delete<SalonBranding>(
        `/salons/${salon.id}/branding/${imageType}`,
      );

      setBranding(response.data);
      window.dispatchEvent(
        new Event('glamour-branding-updated'),
      );
      setStatus(
        imageType === 'logo'
          ? t('branding.logo') + ' ' + t('common.deleted')
          : t('branding.cover') + ' ' + t('common.deleted'),
      );
    } catch {
      setStatus(
        imageType === 'logo'
          ? t('branding.logoDeleteError')
          : t('branding.coverDeleteError'),
      );
    } finally {
      setActiveImageAction(null);
    }
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!salon || !branding) {
      return;
    }

    setIsSaving(true);
    setStatus('');

    try {
      const response = await api.patch<SalonBranding>(
        `/salons/${salon.id}/branding`,
        {
          displayName: branding.displayName || null,
          welcomeText: branding.welcomeText || null,
          faviconUrl: branding.faviconUrl || null,
          primaryColor: branding.primaryColor,
          accentColor: branding.accentColor,
          backgroundColor: branding.backgroundColor,
          textColor: branding.textColor,
          themeMode: branding.themeMode,
          showPoweredByGlamour:
            branding.showPoweredByGlamour,
          isBrandingEnabled: branding.isBrandingEnabled,
        },
      );

      setBranding(response.data);
      applyTheme(response.data.themeMode);
      window.dispatchEvent(
        new Event('glamour-branding-updated'),
      );
      setStatus(t('branding.saved'));
    } catch {
      setStatus(t('branding.saveError'));
    } finally {
      setIsSaving(false);
    }
  }

  if (!branding) {
    return (
      <AppLayout>
        <main className="branding-page">
          <p className="dashboard-status">{status}</p>
        </main>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <main className="branding-page">
        <header className="dashboard-header">
          <div>
            <h1>{t("branding.title")}</h1>
            <p className="dashboard-subtitle">
              {t('branding.subtitle')}
            </p>
          </div>

          <div className="branding-header-icon">
            <Palette size={26} />
          </div>
        </header>

        <form
          className="branding-layout"
          onSubmit={handleSubmit}
        >
          <div className="branding-settings">
            <section className="branding-card">
              <div className="branding-card-heading">
                <div>
                  <span>{t("branding.basicData").toUpperCase()}</span>
                  <h2>{t("branding.basicData")}</h2>
                </div>
              </div>

              <div className="branding-fields">
                <label>
                  {t('branding.salonName')}
                  <input
                    type="text"
                    maxLength={180}
                    value={branding.displayName ?? ''}
                    onChange={(event) =>
                      updateField(
                        'displayName',
                        event.target.value,
                      )
                    }
                  />
                </label>

                <label>
                  {t('branding.welcomeText')}
                  <textarea
                    maxLength={300}
                    value={branding.welcomeText ?? ''}
                    onChange={(event) =>
                      updateField(
                        'welcomeText',
                        event.target.value,
                      )
                    }
                  />
                </label>
              </div>
            </section>

            <section className="branding-card">
              <div className="branding-card-heading">
                <div>
                  <span>{t("branding.images").toUpperCase()}</span>
                  <h2>{t("branding.images")}</h2>
                </div>
                <Image size={22} />
              </div>

              <div className="branding-image-grid">
                <div className="branding-image-control">
                  <div className="branding-image-title">
                    <strong>{t("branding.logo")}</strong>
                    <span>{t('branding.logoHint')}</span>
                  </div>

                  <div className="branding-image-preview logo">
                    {branding.logoUrl ? (
                      <img
                        src={branding.logoUrl}
                        alt={t('branding.logo')}
                      />
                    ) : (
                      <ImagePlus size={28} />
                    )}
                  </div>

                  <input
                    ref={logoInputRef}
                    className="branding-file-input"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(event) =>
                      handleImageChange('logo', event)
                    }
                  />

                  <div className="branding-image-actions">
                    <button
                      type="button"
                      className="branding-image-button"
                      disabled={activeImageAction !== null}
                      onClick={() =>
                        logoInputRef.current?.click()
                      }
                    >
                      {activeImageAction === 'logo' ? (
                        <LoaderCircle
                          className="branding-spinner"
                          size={18}
                        />
                      ) : (
                        <ImagePlus size={18} />
                      )}
                      {branding.logoUrl
                        ? t('common.edit')
                        : t('branding.chooseFile')}
                    </button>

                    {branding.logoUrl && (
                      <button
                        type="button"
                        className="branding-image-delete"
                        disabled={activeImageAction !== null}
                        onClick={() => deleteImage('logo')}
                      >
                        <Trash2 size={18} />
                        {t('common.delete')}
                      </button>
                    )}
                  </div>
                </div>

                <div className="branding-image-control">
                  <div className="branding-image-title">
                    <strong>{t("branding.cover")}</strong>
                    <span>{t('branding.coverHint')}</span>
                  </div>

                  <div className="branding-image-preview cover">
                    {branding.coverImageUrl ? (
                      <img
                        src={branding.coverImageUrl}
                        alt={t('branding.cover')}
                      />
                    ) : (
                      <ImagePlus size={28} />
                    )}
                  </div>

                  <input
                    ref={coverInputRef}
                    className="branding-file-input"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(event) =>
                      handleImageChange('cover', event)
                    }
                  />

                  <div className="branding-image-actions">
                    <button
                      type="button"
                      className="branding-image-button"
                      disabled={activeImageAction !== null}
                      onClick={() =>
                        coverInputRef.current?.click()
                      }
                    >
                      {activeImageAction === 'cover' ? (
                        <LoaderCircle
                          className="branding-spinner"
                          size={18}
                        />
                      ) : (
                        <ImagePlus size={18} />
                      )}
                      {branding.coverImageUrl
                        ? t('common.edit')
                        : t('branding.chooseFile')}
                    </button>

                    {branding.coverImageUrl && (
                      <button
                        type="button"
                        className="branding-image-delete"
                        disabled={activeImageAction !== null}
                        onClick={() => deleteImage('cover')}
                      >
                        <Trash2 size={18} />
                        {t('common.delete')}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </section>

            <section className="branding-card">
              <div className="branding-card-heading">
                <div>
                  <span>{t("branding.colors").toUpperCase()}</span>
                  <h2>{t("branding.colors")}</h2>
                </div>
                <Palette size={22} />
              </div>

              <div className="color-grid">
                {[
                  ['primaryColor', t('branding.primaryColor')],
                  ['accentColor', t('branding.accentColor')],
                  ['backgroundColor', t('branding.backgroundColor')],
                  ['textColor', t('branding.textColor')],
                ].map(([field, label]) => {
                  const key = field as
                    | 'primaryColor'
                    | 'accentColor'
                    | 'backgroundColor'
                    | 'textColor';

                  return (
                    <label key={key}>
                      {label}
                      <div className="color-control">
                        <input
                          type="color"
                          value={branding[key]}
                          onChange={(event) =>
                            updateField(
                              key,
                              event.target.value,
                            )
                          }
                        />
                        <span>{branding[key]}</span>
                      </div>
                    </label>
                  );
                })}
              </div>
            </section>

            <section className="branding-card">
              <div className="branding-card-heading">
                <div>
                  <span>{t("branding.theme").toUpperCase()}</span>
                  <h2>{t("branding.theme")}</h2>
                </div>
              </div>

              <div className="theme-options">
                {[
                  {
                    value: 'light' as ThemeMode,
                    label: t('branding.light'),
                    icon: <Sun size={20} />,
                  },
                  {
                    value: 'dark' as ThemeMode,
                    label: t('branding.dark'),
                    icon: <Moon size={20} />,
                  },
                  {
                    value: 'system' as ThemeMode,
                    label: t('branding.system'),
                    icon: <Monitor size={20} />,
                  },
                ].map((option) => (
                  <button
                    key={option.value}
                    className={
                      branding.themeMode === option.value
                        ? 'theme-option active'
                        : 'theme-option'
                    }
                    type="button"
                    onClick={() => {
                      updateField(
                        'themeMode',
                        option.value,
                      );
                      applyTheme(option.value);
                    }}
                  >
                    {option.icon}
                    <span>{option.label}</span>
                    {branding.themeMode ===
                      option.value && <Check size={17} />}
                  </button>
                ))}
              </div>

              <label className="branding-switch">
                <input
                  type="checkbox"
                  checked={branding.showPoweredByGlamour}
                  onChange={(event) =>
                    updateField(
                      'showPoweredByGlamour',
                      event.target.checked,
                    )
                  }
                />
                <span>
                  {t('branding.showPoweredBy')}
                </span>
              </label>
            </section>

            <div className="branding-actions">
              {status && (
                <p className="branding-message">{status}</p>
              )}

              <button
                className="branding-save-button"
                type="submit"
                disabled={
                  isSaving || activeImageAction !== null
                }
              >
                <Save size={18} />
                {isSaving
                  ? t('common.saving')
                  : t('branding.saveButton')}
              </button>
            </div>
          </div>

          <aside className="branding-preview">
            <div className="branding-preview-label">
              {t('branding.preview').toUpperCase()}
            </div>

            <div
              className="preview-phone"
              style={{
                backgroundColor: branding.backgroundColor,
                color: branding.textColor,
              }}
            >
              <div className="preview-topbar">
                {/* Предпросмотр показывает название салона:
                    владелец настраивает свой вид и хочет видеть себя. */}
                <span
                  style={{ color: branding.accentColor }}
                >
                  {branding.displayName?.trim() || t('branding.previewName')}
                </span>
                <span>•••</span>
              </div>

              {branding.coverImageUrl ? (
                <img
                  className="preview-cover"
                  src={branding.coverImageUrl}
                  alt={t('branding.cover')}
                />
              ) : (
                <div
                  className="preview-cover-placeholder"
                  style={{
                    background: `linear-gradient(135deg, ${branding.primaryColor}, ${branding.accentColor})`,
                  }}
                >
                  <Palette size={32} />
                </div>
              )}

              <div className="preview-content">
                {branding.logoUrl && (
                  <img
                    className="preview-logo"
                    src={branding.logoUrl}
                    alt={t('branding.logo')}
                  />
                )}

                <h3>
                  {branding.displayName ||
                    salon?.name ||
                    t('branding.yourSalon')}
                </h3>

                <p>
                  {branding.welcomeText ||
                    t('branding.welcomeText')}
                </p>

                <button
                  type="button"
                  style={{
                    backgroundColor:
                      branding.accentColor,
                    color: branding.textColor,
                  }}
                >
                  {t('common.book')}
                </button>

                {branding.showPoweredByGlamour && (
                  <small>Powered by Glamour</small>
                )}
              </div>
            </div>
          </aside>
        </form>
      </main>
    </AppLayout>
  );
}

export default BrandingPage;
