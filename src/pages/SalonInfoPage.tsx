import { useEffect, useState } from 'react';
import { Clock, Info, MapPin, Navigation, Save } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../api/api';
import { getErrorKey } from '../api/errorMessage';
import AppLayout from '../components/AppLayout';
import ActionButton, { type ActionState } from '../components/ActionButton';

type WorkingHours = Record<string, { from: string; to: string } | null>;

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const CURRENT_SALON_ID_KEY = 'glamour_current_salon_id';

/** Данные салона: адрес, контакты, часы работы. Клиент видит их в кабинете. */
function SalonInfoPage() {
  const { t, i18n } = useTranslation();

  const [isLoading, setIsLoading] = useState(true);
  const [saveState, setSaveState] = useState<ActionState>('idle');
  const [saveHint, setSaveHint] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const [name, setName] = useState('');
  /** Описание на трёх языках: его читает клиент, а клиенты разные. */
  const [descRo, setDescRo] = useState('');
  const [descRu, setDescRu] = useState('');
  const [descEn, setDescEn] = useState('');
  // Язык описания задаёт главный переключатель под меню:
  // отдельный внутри формы был бы вторым и сбивал.
  const descLang = i18n.language.startsWith('ru')
    ? 'ru'
    : i18n.language.startsWith('en')
      ? 'en'
      : 'ro';
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [addressNote, setAddressNote] = useState('');
  const [googleMapsUrl, setGoogleMapsUrl] = useState('');

  /** Примечание по языкам: язык задаёт главный переключатель. */
  const [noteRo, setNoteRo] = useState('');
  const [noteRu, setNoteRu] = useState('');
  const [noteEn, setNoteEn] = useState('');

  const currentNote =
    descLang === 'ro' ? noteRo : descLang === 'ru' ? noteRu : noteEn;

  function setCurrentNote(value: string) {
    if (descLang === 'ro') {
      setNoteRo(value);
    } else if (descLang === 'ru') {
      setNoteRu(value);
    } else {
      setNoteEn(value);
    }

    // Основное поле держим в согласии: на него смотрят места,
    // где перевода ещё нет.
    setAddressNote(value);
  }
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [instagramUrl, setInstagramUrl] = useState('');
  const [hours, setHours] = useState<WorkingHours>({});

  const salonId = localStorage.getItem(CURRENT_SALON_ID_KEY) ?? '';

  useEffect(() => { void load(); }, []);

  async function load() {
    setIsLoading(true);

    try {
      const res = await api.get(`/public/salons/${salonId}`);
      const s = res.data;

      setName(s.name ?? '');
      setDescRo(s.descriptionRo ?? '');
      setDescRu(s.descriptionRu ?? '');
      setDescEn(s.descriptionEn ?? '');
      setCountry(s.country ?? 'Moldova');
      setCity(s.city ?? '');
      setAddress(s.address ?? '');
      setAddressNote(s.addressNote ?? '');
      setGoogleMapsUrl(s.googleMapsUrl ?? '');
      setNoteRo(s.addressNoteRo ?? '');
      setNoteRu(s.addressNoteRu ?? '');
      setNoteEn(s.addressNoteEn ?? '');
      setPhone(s.phone ?? '');
      setEmail(s.email ?? '');
      setInstagramUrl(s.instagramUrl ?? '');
      setHours(s.workingHours ?? {});
    } catch (error) {
      setErrorMsg(t(getErrorKey(error)));
    } finally {
      setIsLoading(false);
    }
  }

  function setDay(day: string, field: 'from' | 'to', value: string) {
    setHours((prev) => ({
      ...prev,
      [day]: { from: '09:00', to: '18:00', ...(prev[day] ?? {}), [field]: value },
    }));
  }

  function toggleDay(day: string) {
    setHours((prev) => ({
      ...prev,
      [day]: prev[day] ? null : { from: '09:00', to: '18:00' },
    }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaveState('loading');
    setSaveHint('');

    try {
      await api.patch(`/salons/${salonId}`, {
        name: name.trim() || undefined,
        descriptionRo: descRo.trim() || undefined,
        descriptionRu: descRu.trim() || undefined,
        descriptionEn: descEn.trim() || undefined,
        country: country.trim() || undefined,
        city: city.trim() || undefined,
        address: address.trim() || undefined,
        addressNote: addressNote.trim() || undefined,
        googleMapsUrl: googleMapsUrl.trim() || undefined,
        addressNoteRo: noteRo.trim() || addressNote.trim() || undefined,
        addressNoteRu: noteRu.trim() || addressNote.trim() || undefined,
        addressNoteEn: noteEn.trim() || addressNote.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        instagramUrl: instagramUrl.trim() || undefined,
        workingHours: hours,
      });

      setSaveState('success');
      setSaveHint(t('success.saved'));

      // Название салона показано в шапке и переключателе — они
      // грузятся один раз при входе, поэтому обновляем страницу.
      setTimeout(() => window.location.reload(), 900);
    } catch (error) {
      setSaveState('error');
      setSaveHint(t(getErrorKey(error)));
      setTimeout(() => setSaveState('idle'), 6000);
    }
  }

  const inputStyle = {
    padding: '11px 14px',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 13,
    background: 'rgba(255,255,255,0.06)',
    color: 'var(--app-text)',
    fontSize: 14,
    outline: 'none',
  };

  const labelStyle = {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 6,
    fontSize: 13,
    color: 'var(--app-text)',
  };

  return (
    <AppLayout>
      <main className="dashboard-page">
        <header className="dashboard-header centered-header">
          <div>
            <h1>{t('salonInfo.title')}</h1>
            <p className="dashboard-subtitle">{t('salonInfo.subtitle')}</p>
          </div>
        </header>

        {errorMsg && (
          <div style={{ padding: '11px 15px', borderRadius: 13, marginBottom: 16, fontSize: 13, fontWeight: 700, border: '1px solid rgba(255,96,128,0.25)', background: 'rgba(255,96,128,0.1)', color: 'var(--app-accent-strong)' }}>
            {errorMsg}
          </div>
        )}

        {isLoading ? (
          <p className="dashboard-status">{t('common.loading')}</p>
        ) : (
          <form onSubmit={handleSave}>
            <section className="dashboard-columns">
              <article className="dashboard-panel">
                <div className="panel-heading">
                  <div>
                    <p className="panel-kicker">{t('salonInfo.contacts').toUpperCase()}</p>
                    <h2>{t('salonInfo.contacts')}</h2>
                  </div>
                  <Info size={22} />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <label style={labelStyle}>
                    {t('salonInfo.name')}
                    <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
                  </label>

                  <div style={labelStyle}>
                    {t('salonInfo.description')}

                    <textarea
                      value={descLang === 'ro' ? descRo : descLang === 'ru' ? descRu : descEn}
                      onChange={(e) => {
                        if (descLang === 'ro') setDescRo(e.target.value);
                        else if (descLang === 'ru') setDescRu(e.target.value);
                        else setDescEn(e.target.value);
                      }}
                      rows={8}
                      style={{ ...inputStyle, resize: 'vertical' }}
                    />

                    <span style={{ color: 'var(--app-text-muted, #6d656f)', fontSize: 12 }}>
                      {t('salonInfo.descriptionHint')}
                    </span>
                  </div>

                  <label style={labelStyle}>
                    {t('salonInfo.phone')}
                    <input value={phone} onChange={(e) => setPhone(e.target.value)}
                      placeholder="+373..." style={inputStyle} />
                  </label>

                  <label style={labelStyle}>
                    Email
                    <input value={email} onChange={(e) => setEmail(e.target.value)}
                      type="email" style={inputStyle} />
                  </label>

                  <label style={labelStyle}>
                    Instagram
                    <input value={instagramUrl} onChange={(e) => setInstagramUrl(e.target.value)}
                      placeholder="https://instagram.com/..." style={inputStyle} />
                  </label>
                </div>
              </article>

              <article className="dashboard-panel">
                <div className="panel-heading">
                  <div>
                    <p className="panel-kicker">{t('salonInfo.address').toUpperCase()}</p>
                    <h2>{t('salonInfo.address')}</h2>
                  </div>
                  <MapPin size={22} />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <label style={labelStyle}>
                    {t('salonInfo.country')}
                    <input value={country} onChange={(e) => setCountry(e.target.value)} style={inputStyle} />
                  </label>

                  <label style={labelStyle}>
                    {t('salonInfo.city')}
                    <input value={city} onChange={(e) => setCity(e.target.value)} style={inputStyle} />
                  </label>

                  <label style={labelStyle}>
                    {t('salonInfo.street')}
                    <input value={address} onChange={(e) => setAddress(e.target.value)}
                      placeholder={t('salonInfo.streetPlaceholder')} style={inputStyle} />
                  </label>

                  <label style={labelStyle}>
                    {t('salonInfo.note')}
                    <input value={currentNote} onChange={(e) => setCurrentNote(e.target.value)}
                      placeholder={t('salonInfo.notePlaceholder')} style={inputStyle} />
                  </label>

                  <label style={labelStyle}>
                    {t('salonInfo.googleMapsUrl')}
                    <input value={googleMapsUrl} onChange={(e) => setGoogleMapsUrl(e.target.value)}
                      placeholder={t('salonInfo.googleMapsUrlPlaceholder')} style={inputStyle} />
                    <span style={{ color: 'var(--app-text-muted, #6d656f)', fontSize: 12 }}>
                      {t('salonInfo.googleMapsUrlHint')}
                    </span>
                  </label>

                  {(googleMapsUrl.trim() || country.trim() || city.trim() || address.trim()) && (
                    <a
                      href={
                        googleMapsUrl.trim() ||
                        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                          [address, city, country].filter((part) => part.trim()).join(', '),
                        )}`
                      }
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        width: 'fit-content',
                        fontSize: 12,
                        fontWeight: 700,
                        color: 'var(--app-accent)',
                        textDecoration: 'none',
                      }}
                    >
                      <Navigation size={13} />
                      {t('salonInfo.previewOnMap')}
                    </a>
                  )}
                </div>
              </article>
            </section>

            <article className="dashboard-panel" style={{ marginTop: 16 }}>
              <div className="panel-heading">
                <div>
                  <p className="panel-kicker">{t('salonInfo.hours').toUpperCase()}</p>
                  <h2>{t('salonInfo.hours')}</h2>
                </div>
                <Clock size={22} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {DAYS.map((day) => {
                  const value = hours[day];

                  return (
                    <div key={day} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 120, cursor: 'pointer' }}>
                        <input type="checkbox" checked={Boolean(value)}
                          onChange={() => toggleDay(day)}
                          style={{ width: 18, height: 18, accentColor: 'var(--app-accent)' }} />
                        <span style={{ color: 'var(--app-text)', fontSize: 13 }}>
                          {t('salonInfo.day.' + day)}
                        </span>
                      </label>

                      {value ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <input type="time" value={value.from}
                            onChange={(e) => setDay(day, 'from', e.target.value)}
                            style={{ ...inputStyle, padding: '8px 10px' }} />
                          <span style={{ color: 'var(--app-text-muted, #6d656f)' }}>—</span>
                          <input type="time" value={value.to}
                            onChange={(e) => setDay(day, 'to', e.target.value)}
                            style={{ ...inputStyle, padding: '8px 10px' }} />
                        </div>
                      ) : (
                        <span style={{ color: 'var(--app-text-muted, #6d656f)', fontSize: 13 }}>
                          {t('salonInfo.closed')}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </article>

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
        )}
      </main>
    </AppLayout>
  );
}

export default SalonInfoPage;
