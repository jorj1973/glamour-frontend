import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import {
  Check,
  Image,
  Monitor,
  Moon,
  Palette,
  Save,
  Sun,
} from 'lucide-react';

import api from '../api/api';
import AppLayout from '../components/AppLayout';
import { applyTheme } from '../theme';

type ThemeMode = 'light' | 'dark' | 'system';

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

function BrandingPage() {
  const [salon, setSalon] = useState<SalonSummary | null>(null);
  const [branding, setBranding] = useState<SalonBranding | null>(null);
  const [status, setStatus] = useState('Загрузка настроек персонализации…');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const salonsResponse = await api.get<SalonSummary[]>('/salons/my');
        const currentSalon = salonsResponse.data[0];

        if (!currentSalon) {
          setStatus('Для вашей учётной записи не найден доступный салон.');
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
        setStatus('Не удалось загрузить настройки персонализации.');
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
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
          logoUrl: branding.logoUrl || null,
          faviconUrl: branding.faviconUrl || null,
          coverImageUrl: branding.coverImageUrl || null,
          primaryColor: branding.primaryColor,
          accentColor: branding.accentColor,
          backgroundColor: branding.backgroundColor,
          textColor: branding.textColor,
          themeMode: branding.themeMode,
          showPoweredByGlamour: branding.showPoweredByGlamour,
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
            <p className="dashboard-eyebrow">ОФОРМЛЕНИЕ САЛОНА</p>
            <h1>Персонализация</h1>
            <p className="dashboard-subtitle">
              Настройте название, приветствие, изображения, цвета и внешний вид
              приложения вашего салона.
            </p>
          </div>

          <div className="branding-header-icon">
            <Palette size={26} />
          </div>
        </header>

        <form className="branding-layout" onSubmit={handleSubmit}>
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
                      updateField('displayName', event.target.value)
                    }
                  />
                </label>

                <label>
                  Приветственный текст
                  <textarea
                    maxLength={300}
                    value={branding.welcomeText ?? ''}
                    onChange={(event) =>
                      updateField('welcomeText', event.target.value)
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

              <div className="branding-fields">
                <label>
                  URL логотипа
                  <input
                    type="url"
                    placeholder="https://..."
                    value={branding.logoUrl ?? ''}
                    onChange={(event) =>
                      updateField('logoUrl', event.target.value || null)
                    }
                  />
                </label>

                <label>
                  URL обложки
                  <input
                    type="url"
                    placeholder="https://..."
                    value={branding.coverImageUrl ?? ''}
                    onChange={(event) =>
                      updateField('coverImageUrl', event.target.value || null)
                    }
                  />
                </label>
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
                            updateField(key, event.target.value)
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
                      updateField('themeMode', option.value);
                      applyTheme(option.value);
                    }}
                  >
                    {option.icon}
                    <span>{option.label}</span>
                    {branding.themeMode === option.value && (
                      <Check size={17} />
                    )}
                  </button>
                ))}
              </div>

              <label className="branding-switch">
                <input
                  type="checkbox"
                  checked={branding.showPoweredByGlamour}
                  onChange={(event) =>
                    updateField('showPoweredByGlamour', event.target.checked)
                  }
                />
                <span>Показывать надпись «Powered by Glamour»</span>
              </label>
            </section>

            <div className="branding-actions">
              {status && <p className="branding-message">{status}</p>}

              <button
                className="branding-save-button"
                type="submit"
                disabled={isSaving}
              >
                <Save size={18} />
                {isSaving ? 'Сохранение…' : 'Сохранить настройки'}
              </button>
            </div>
          </div>

          <aside className="branding-preview">
            <div className="branding-preview-label">ПРЕДПРОСМОТР</div>

            <div
              className="preview-phone"
              style={{
                backgroundColor: branding.backgroundColor,
                color: branding.textColor,
              }}
            >
              <div className="preview-topbar">
                <span style={{ color: branding.accentColor }}>GLAMOUR</span>
                <span>•••</span>
              </div>

              {branding.coverImageUrl ? (
                <img
                  className="preview-cover"
                  src={branding.coverImageUrl}
                  alt=""
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
                    alt=""
                  />
                )}

                <h3>{branding.displayName || salon?.name || 'Ваш салон'}</h3>

                <p>
                  {branding.welcomeText || 'Приветственный текст салона'}
                </p>

                <button
                  type="button"
                  style={{
                    backgroundColor: branding.accentColor,
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
