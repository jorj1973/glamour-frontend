import { useEffect, useState } from 'react';
import { UserRound, Save, Sparkles, User, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../api/api';
import AppLayout from '../components/AppLayout';
import MasterCredentials from '../components/MasterCredentials';
import ActionButton, { type ActionState } from '../components/ActionButton';
import { getErrorKey } from '../api/errorMessage';

type MasterProfile = {
  id: string;
  userId?: string;
  firstName?: string | null;
  lastName?: string | null;
  profession?: string | null;
  specialization?: string | null;
  photoUrl?: string | null;
  bio?: string | null;

  /** Описание по языкам: клиент читает на своём. */
  professionRo?: string | null;
  professionRu?: string | null;
  professionEn?: string | null;
  specializationRo?: string | null;
  specializationRu?: string | null;
  specializationEn?: string | null;
  bioRo?: string | null;
  bioRu?: string | null;
  bioEn?: string | null;
  experienceYears?: number | null;
  careerStartYear?: number | null;
  city?: string | null;
  country?: string | null;
  acceptsOnlineBooking?: boolean;
  acceptsNewClients?: boolean;
  isPublic?: boolean;
};

const BIO_MAX = 3000;
const CURRENT_YEAR = new Date().getFullYear();

function MasterProfilePage() {
  const { t, i18n } = useTranslation();
  const [isLoading, setIsLoading] = useState(true);
  const [saveState, setSaveState] = useState<ActionState>('idle');
  const [saveHint, setSaveHint] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [profession, setProfession] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const [bio, setBio] = useState('');

  /** Описание по языкам: клиент читает на своём. */
  const [professionRo, setProfessionRo] = useState('');
  const [professionRu, setProfessionRu] = useState('');
  const [professionEn, setProfessionEn] = useState('');

  const [specializationRo, setSpecializationRo] = useState('');
  const [specializationRu, setSpecializationRu] = useState('');
  const [specializationEn, setSpecializationEn] = useState('');

  const [bioRo, setBioRo] = useState('');
  const [bioRu, setBioRu] = useState('');
  const [bioEn, setBioEn] = useState('');

  /**
   * Описание на выбранном языке.
   *
   * Читаем и пишем в то поле, которое соответствует языку
   * интерфейса: клиент увидит описание на своём.
   */
  const language = i18n.language;

  const currentBio = language.startsWith('ro')
    ? bioRo
    : language.startsWith('en')
      ? bioEn
      : bioRu;

  const currentProfession = language.startsWith('ro')
    ? professionRo
    : language.startsWith('en')
      ? professionEn
      : professionRu;

  const currentSpecialization = language.startsWith('ro')
    ? specializationRo
    : language.startsWith('en')
      ? specializationEn
      : specializationRu;

  function setCurrentProfession(value: string) {
    if (language.startsWith('ro')) {
      setProfessionRo(value);
    } else if (language.startsWith('en')) {
      setProfessionEn(value);
    } else {
      setProfessionRu(value);
    }

    // Основное поле держим в согласии: на него смотрят места,
    // где перевода ещё нет.
    setProfession(value);
  }

  function setCurrentSpecialization(value: string) {
    if (language.startsWith('ro')) {
      setSpecializationRo(value);
    } else if (language.startsWith('en')) {
      setSpecializationEn(value);
    } else {
      setSpecializationRu(value);
    }

    setSpecialization(value);
  }

  function setCurrentBio(value: string) {
    if (language.startsWith('ro')) {
      setBioRo(value);
    } else if (language.startsWith('en')) {
      setBioEn(value);
    } else {
      setBioRu(value);
    }

    // Основное поле держим в согласии с текущим языком:
    // на него смотрят места, где перевода ещё нет.
    setBio(value);
  }

  const [careerStartYear, setCareerStartYear] = useState('');
  const [city, setCity] = useState('');
  const [acceptsOnlineBooking, setAcceptsOnlineBooking] = useState(true);
  const [acceptsNewClients, setAcceptsNewClients] = useState(true);
  const [isPublic, setIsPublic] = useState(true);

  const parsedStartYear = Number(careerStartYear);
  const computedExperience =
    careerStartYear.trim() !== '' &&
    Number.isFinite(parsedStartYear) &&
    parsedStartYear >= 1950 &&
    parsedStartYear <= CURRENT_YEAR
      ? CURRENT_YEAR - parsedStartYear
      : null;

  useEffect(() => { void loadProfile(); }, []);

  async function loadProfile() {
    setIsLoading(true);
    try {
      const res = await api.get<MasterProfile>('/masters/me');
      const p = res.data;
      setFirstName(p.firstName ?? '');
      setLastName(p.lastName ?? '');
      setProfession(p.profession ?? '');
      setSpecialization(p.specialization ?? '');
      setPhotoUrl(p.photoUrl ?? null);
      setBio(p.bio ?? '');
      setProfessionRo(p.professionRo ?? '');
      setProfessionRu(p.professionRu ?? '');
      setProfessionEn(p.professionEn ?? '');

      setSpecializationRo(p.specializationRo ?? '');
      setSpecializationRu(p.specializationRu ?? '');
      setSpecializationEn(p.specializationEn ?? '');

      setBioRo(p.bioRo ?? '');
      setBioRu(p.bioRu ?? '');
      setBioEn(p.bioEn ?? '');
      setCareerStartYear(p.careerStartYear != null ? String(p.careerStartYear) : '');
      setCity(p.city ?? '');
      setAcceptsOnlineBooking(p.acceptsOnlineBooking ?? true);
      setAcceptsNewClients(p.acceptsNewClients ?? true);
      setIsPublic(p.isPublic ?? true);
    } catch {
      setErrorMsg(t('common.loadError'));
    } finally {
      setIsLoading(false);
    }
  }

  /**
   * Отправляет фотографию сразу, не дожидаясь сохранения формы:
   * мастер должен увидеть, что снимок принят.
   */
  async function uploadPhoto(file: File) {
    setIsUploading(true);
    setErrorMsg('');

    try {
      const form = new FormData();

      form.append('file', file);

      const res = await api.post<{ photoUrl: string }>(
        '/master-portfolio/photo',
        form,
      );

      setPhotoUrl(res.data.photoUrl);
    } catch (error) {
      setErrorMsg(t(getErrorKey(error)));
    } finally {
      setIsUploading(false);
    }
  }

  async function removePhoto() {
    setIsUploading(true);

    try {
      await api.delete('/master-portfolio/photo');
      setPhotoUrl(null);
    } catch (error) {
      setErrorMsg(t(getErrorKey(error)));
    } finally {
      setIsUploading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaveState('loading');
    setSaveHint('');
    setErrorMsg('');
    try {
      const startYear = careerStartYear.trim() === '' ? null : Number(careerStartYear);
      await api.patch('/masters/me', {
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
        profession: profession.trim() || null,
        specialization: specialization.trim() || null,
        bio: bio.trim() || null,
        // Незаполненный перевод заменяем основным описанием:
        // пустой профиль хуже, чем текст на чужом языке.
        professionRo: professionRo.trim() || profession.trim() || null,
        professionRu: professionRu.trim() || profession.trim() || null,
        professionEn: professionEn.trim() || profession.trim() || null,

        specializationRo: specializationRo.trim() || specialization.trim() || null,
        specializationRu: specializationRu.trim() || specialization.trim() || null,
        specializationEn: specializationEn.trim() || specialization.trim() || null,

        bioRo: bioRo.trim() || bio.trim() || null,
        bioRu: bioRu.trim() || bio.trim() || null,
        bioEn: bioEn.trim() || bio.trim() || null,
        careerStartYear: startYear != null && Number.isFinite(startYear) ? startYear : null,
        city: city.trim() || null,
        acceptsOnlineBooking,
        acceptsNewClients,
        isPublic,
      });
      setSaveState('success');
      setSaveHint(t('myProfile.savedHint'));
      setTimeout(() => setSaveState('idle'), 4000);
    } catch (error) {
      setSaveState('error');
      setSaveHint(t(getErrorKey(error)));
      setTimeout(() => setSaveState('idle'), 6000);
    }
  }

  const inputStyle = { padding: '11px 14px', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 13, background: 'rgba(255,255,255,0.06)', color: 'var(--app-text)', fontSize: 14, outline: 'none' };
  const labelStyle = { display: 'flex', flexDirection: 'column' as const, gap: 6, fontSize: 13, color: 'var(--app-text)' };
  const toggleRowStyle = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' };

  return (
    <AppLayout>
      <main className="dashboard-page">
        <header className="dashboard-header">
          <div>
            <h1>{t('myProfile.title')}</h1>
            <p className="dashboard-subtitle">{t('myProfile.subtitle')}</p>
          </div>
        </header>

        {errorMsg && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 15px', borderRadius: 13, marginBottom: 16, fontSize: 13, fontWeight: 700, border: '1px solid rgba(255,96,128,0.25)', background: 'rgba(255,96,128,0.1)', color: 'var(--app-accent-strong)' }}>
            <X size={15} />{errorMsg}
          </div>
        )}

        {isLoading ? (
          <p className="dashboard-status">{t('common.loading')}</p>
        ) : (
          <>
          {/* Фотография не обязательна, но клиент по ней узнаёт
              мастера при первом визите — об этом говорим прямо. */}
          <article className="dashboard-panel" style={{ marginBottom: 20, padding: 20 }}>
            <p style={{ margin: 0, color: 'var(--app-text)', fontSize: 15, fontWeight: 700 }}>
              {t('myProfile.photoTitle')}
            </p>

            <p style={{ margin: '6px 0 16px', color: 'var(--app-text-muted)', fontSize: 13, lineHeight: 1.55 }}>
              {t('myProfile.photoHint')}
            </p>

            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              {photoUrl ? (
                <img
                  src={photoUrl}
                  alt={t('myProfile.photoTitle')}
                  style={{ width: 92, height: 92, borderRadius: 20, objectFit: 'cover', border: '1px solid var(--app-border)' }}
                />
              ) : (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 92,
                    height: 92,
                    borderRadius: 20,
                    border: '1px dashed var(--app-border)',
                    background: 'var(--app-input)',
                    color: 'var(--app-text-muted)',
                  }}
                >
                  <UserRound size={30} />
                </span>
              )}

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <label
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: 44,
                    padding: '0 20px',
                    borderRadius: 13,
                    border: '1px solid var(--app-accent)',
                    background: 'transparent',
                    color: 'var(--app-accent-text)',
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: isUploading ? 'default' : 'pointer',
                    opacity: isUploading ? 0.6 : 1,
                  }}
                >
                  {isUploading ? t('common.loading') : t(photoUrl ? 'myProfile.photoReplace' : 'myProfile.photoUpload')}

                  <input
                    type="file"
                    accept="image/*"
                    disabled={isUploading}
                    onChange={(e) => {
                      const file = e.target.files?.[0];

                      if (file) {
                        void uploadPhoto(file);
                      }

                      e.target.value = '';
                    }}
                    style={{ display: 'none' }}
                  />
                </label>

                {photoUrl && (
                  <button
                    type="button"
                    onClick={() => void removePhoto()}
                    disabled={isUploading}
                    style={{
                      minHeight: 44,
                      padding: '0 20px',
                      borderRadius: 13,
                      border: '1px solid var(--app-border)',
                      background: 'transparent',
                      color: 'var(--app-text-muted)',
                      fontSize: 14,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {t('myProfile.photoRemove')}
                  </button>
                )}
              </div>
            </div>
          </article>

          <form onSubmit={handleSave}>
            <section className="dashboard-columns">
              <article className="dashboard-panel">
                <div className="panel-heading">
                  <div>
                    <p className="panel-kicker">{t('myProfile.basicsTitle').toUpperCase()}</p>
                    <h2>{t('myProfile.basicsTitle')}</h2>
                  </div>
                  <User size={22} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <label style={labelStyle}>
                    {t('myProfile.firstName')}
                    <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} maxLength={100} style={inputStyle} />
                  </label>
                  <label style={labelStyle}>
                    {t('myProfile.lastName')}
                    <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} maxLength={100} style={inputStyle} />
                  </label>
                  <label style={labelStyle}>
                    {t('myProfile.profession')}
                    <input type="text" value={currentProfession} onChange={(e) => setCurrentProfession(e.target.value)} placeholder={t('myProfile.professionPlaceholder')} maxLength={150} style={inputStyle} />
                  </label>
                  <label style={labelStyle}>
                    {t('myProfile.specialization')}
                    <input type="text" value={currentSpecialization} onChange={(e) => setCurrentSpecialization(e.target.value)} placeholder={t('myProfile.specializationPlaceholder')} maxLength={150} style={inputStyle} />
                  </label>
                  <label style={labelStyle}>
                    {t('myProfile.careerStartYear')}
                    <input
                      type="number"
                      min={1950}
                      max={CURRENT_YEAR}
                      placeholder="2015"
                      value={careerStartYear}
                      onChange={(e) => setCareerStartYear(e.target.value)}
                      style={inputStyle}
                    />
                    {computedExperience != null && (
                      <span style={{ fontSize: 12, color: 'var(--app-text-muted)' }}>
                        {t('myProfile.experienceHint', { count: computedExperience })}
                      </span>
                    )}
                  </label>
                  <label style={labelStyle}>
                    {t('myProfile.city')}
                    <input type="text" value={city} onChange={(e) => setCity(e.target.value)} maxLength={100} style={inputStyle} />
                  </label>
                </div>
              </article>

              <article className="dashboard-panel">
                <div className="panel-heading">
                  <div>
                    <p className="panel-kicker">{t('myProfile.visibilityTitle').toUpperCase()}</p>
                    <h2>{t('myProfile.visibilityTitle')}</h2>
                  </div>
                  <Sparkles size={22} />
                </div>
                <p style={{ color: 'var(--app-text-muted)', fontSize: 13, lineHeight: 1.6, marginBottom: 8 }}>{t('myProfile.visibilitySubtitle')}</p>
                <div style={toggleRowStyle}>
                  <span style={{ fontSize: 13, color: 'var(--app-text)' }}>{t('myProfile.isPublic')}</span>
                  <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} style={{ width: 20, height: 20, accentColor: 'var(--app-accent)', cursor: 'pointer' }} />
                </div>
                <div style={toggleRowStyle}>
                  <span style={{ fontSize: 13, color: 'var(--app-text)' }}>{t('myProfile.acceptsOnlineBooking')}</span>
                  <input type="checkbox" checked={acceptsOnlineBooking} onChange={(e) => setAcceptsOnlineBooking(e.target.checked)} style={{ width: 20, height: 20, accentColor: 'var(--app-accent)', cursor: 'pointer' }} />
                </div>
                <div style={{ ...toggleRowStyle, borderBottom: 0 }}>
                  <span style={{ fontSize: 13, color: 'var(--app-text)' }}>{t('myProfile.acceptsNewClients')}</span>
                  <input type="checkbox" checked={acceptsNewClients} onChange={(e) => setAcceptsNewClients(e.target.checked)} style={{ width: 20, height: 20, accentColor: 'var(--app-accent)', cursor: 'pointer' }} />
                </div>
              </article>
            </section>

            <article className="dashboard-panel" style={{ marginTop: 16 }}>
              <div className="panel-heading">
                <div>
                  <p className="panel-kicker">{t('myProfile.bioTitle').toUpperCase()}</p>
                  <h2>{t('myProfile.bioTitle')}</h2>
                </div>
                <Sparkles size={22} />
              </div>
              <p style={{ color: 'var(--app-text-muted)', fontSize: 13, marginBottom: 12 }}>{t('myProfile.bioSubtitle')}</p>
              {/* Язык поля задаёт главный переключатель: отдельный
                  внутри формы был бы вторым и сбивал. */}
              <textarea
                value={currentBio}
                onChange={(e) => setCurrentBio(e.target.value)}
                placeholder={t('myProfile.bioPlaceholder')}
                maxLength={BIO_MAX}
                rows={8}
                style={{ width: '100%', padding: '11px 14px', border: '1px solid var(--app-border)', borderRadius: 13, background: 'var(--app-input)', color: 'var(--app-text)', fontSize: 13, outline: 'none', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6 }}
              />
              <p style={{ color: '#555', fontSize: 11, marginTop: 4 }}>{currentBio.length}/{BIO_MAX}</p>

            </article>

            {/* Дипломы сохраняются отдельно, но стоят перед кнопкой:
                иначе кажется, что она не относится к нижнему блоку. */}
            <MasterCredentials />

            <div style={{ marginTop: 20 }}>
              <ActionButton
                type="submit"
                state={saveState}
                label={t('payment.saveButton')}
                loadingLabel={t('payment.saving')}
                successLabel={t('success.saved')}
                errorLabel={t('payment.saveButton')}
                hint={saveHint}
                icon={<Save size={17} />}
              />
            </div>
          </form>
          </>
        )}
      </main>
    </AppLayout>
  );
}

export default MasterProfilePage;
