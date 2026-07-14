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
  const [salon, setSalon] = useState<SalonSummary | null>(null);
  const [branding, setBranding] = useState<SalonBranding | null>(null);
  const [status, setStatus] = useState(
    'Загрузка настроек персонализации…',
  );
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
            'Для вашей учётной записи не найден доступный салон.',
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
          'Не удалось загрузить настройки персонализации.',
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
      return 'Разрешены только изображения PNG, JPEG и WebP.';
    }

    const maximumSize =
      imageType === 'logo'
        ? MAX_LOGO_SIZE_BYTES
        : MAX_COVER_SIZE_BYTES;

    if (file.size > maximumSize) {
      return imageType === 'logo'
        ? 'Размер логотипа не должен превышать 2 МБ.'
        : 'Размер обложки не должен превышать 5 МБ.';
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
      setStatus(
        imageType === 'logo'
          ? 'Логотип успешно загружен.'
          : 'Обложка успешно загружена.',
      );
    } catch {
      setStatus(
        imageType === 'logo'
          ? 'Не удалось загрузить логотип.'
          : 'Не удалось загрузить обложку.',
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
      setStatus(
        imageType === 'logo'
          ? 'Логотип удалён.'
          : 'Обложка удалена.',
      );
    } catch {
      setStatus(
        imageType === 'logo'
          ? 'Не удалось удалить логотип.'
          : 'Не удалось удалить обложку.',
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
      setStatus('Настройки успешно сохранены.');
    } catch {
      setStatus('Не удалось сохранить настройки.');
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
            <p className="dashboard-eyebrow">
              ОФОРМЛЕНИЕ САЛОНА
            </p>
            <h1>Персонализация</h1>
            <p className="dashboard-subtitle">
              Настройте название, приветствие, изображения,
              цвета и внешний вид приложения вашего салона.
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
                  <span>ОСНОВНЫЕ ДАННЫЕ</span>
                  <h2>Название и приветствие</h2>
                </div>
              </div>

              <div className="branding-fields">
                <label>
                  Название салона
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
                  Приветственный текст
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
                  <span>ИЗОБРАЖЕНИЯ</span>
                  <h2>Логотип и обложка</h2>
                </div>
                <Image size={22} />
              </div>

              <div className="branding-image-grid">
                <div className="branding-image-control">
                  <div className="branding-image-title">
                    <strong>Логотип</strong>
                    <span>PNG, JPEG или WebP, до 2 МБ</span>
                  </div>

                  <div className="branding-image-preview logo">
                    {branding.logoUrl ? (
                      <img
                        src={branding.logoUrl}
                        alt="Логотип салона"
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
                        ? 'Заменить'
                        : 'Выбрать файл'}
                    </button>

                    {branding.logoUrl && (
                      <button
                        type="button"
                        className="branding-image-delete"
                        disabled={activeImageAction !== null}
                        onClick={() => deleteImage('logo')}
                      >
                        <Trash2 size={18} />
                        Удалить
                      </button>
                    )}
                  </div>
                </div>

                <div className="branding-image-control">
                  <div className="branding-image-title">
                    <strong>Обложка</strong>
                    <span>PNG, JPEG или WebP, до 5 МБ</span>
                  </div>

                  <div className="branding-image-preview cover">
                    {branding.coverImageUrl ? (
                      <img
                        src={branding.coverImageUrl}
                        alt="Обложка салона"
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
                        ? 'Заменить'
                        : 'Выбрать файл'}
                    </button>

                    {branding.coverImageUrl && (
                      <button
                        type="button"
                        className="branding-image-delete"
                        disabled={activeImageAction !== null}
                        onClick={() => deleteImage('cover')}
                      >
                        <Trash2 size={18} />
                        Удалить
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </section>

            <section className="branding-card">
              <div className="branding-card-heading">
                <div>
                  <span>ЦВЕТОВАЯ СХЕМА</span>
                  <h2>Фирменные цвета</h2>
                </div>
                <Palette size={22} />
              </div>

              <div className="color-grid">
                {[
                  ['primaryColor', 'Основной цвет'],
                  ['accentColor', 'Акцентный цвет'],
                  ['backgroundColor', 'Цвет фона'],
                  ['textColor', 'Цвет текста'],
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
                  <span>ТЕМА</span>
                  <h2>Режим отображения</h2>
                </div>
              </div>

              <div className="theme-options">
                {[
                  {
                    value: 'light' as ThemeMode,
                    label: 'Светлая',
                    icon: <Sun size={20} />,
                  },
                  {
                    value: 'dark' as ThemeMode,
                    label: 'Тёмная',
                    icon: <Moon size={20} />,
                  },
                  {
                    value: 'system' as ThemeMode,
                    label: 'Системная',
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
                  Показывать надпись «Powered by Glamour»
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
                  ? 'Сохранение…'
                  : 'Сохранить настройки'}
              </button>
            </div>
          </div>

          <aside className="branding-preview">
            <div className="branding-preview-label">
              ПРЕДПРОСМОТР
            </div>

            <div
              className="preview-phone"
              style={{
                backgroundColor: branding.backgroundColor,
                color: branding.textColor,
              }}
            >
              <div className="preview-topbar">
                <span
                  style={{ color: branding.accentColor }}
                >
                  GLAMOUR
                </span>
                <span>•••</span>
              </div>

              {branding.coverImageUrl ? (
                <img
                  className="preview-cover"
                  src={branding.coverImageUrl}
                  alt="Обложка салона"
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
                    alt="Логотип салона"
                  />
                )}

                <h3>
                  {branding.displayName ||
                    salon?.name ||
                    'Ваш салон'}
                </h3>

                <p>
                  {branding.welcomeText ||
                    'Приветственный текст салона'}
                </p>

                <button
                  type="button"
                  style={{
                    backgroundColor:
                      branding.accentColor,
                    color: branding.textColor,
                  }}
                >
                  Записаться
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
