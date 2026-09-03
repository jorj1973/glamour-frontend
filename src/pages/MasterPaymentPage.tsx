import { useEffect, useState } from 'react';
import { CreditCard, Phone, Save, Wallet, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../api/api';
import AppLayout from '../components/AppLayout';
import ActionButton, { type ActionState } from '../components/ActionButton';
import { getErrorKey } from '../api/errorMessage';

type SalonSummary = { id: string; name: string; membershipStatus?: string | null; membershipRole?: string | null; membershipRoles?: string[]; };
type MasterProfile = { id: string; userId?: string; miaPhone?: string | null; ibanNumber?: string | null; cardNumber?: string | null; paymentNote?: string | null; paymentNoteRo?: string | null; paymentNoteRu?: string | null; paymentNoteEn?: string | null; };

const CURRENT_SALON_ID_KEY = 'glamour_current_salon_id';

function MasterPaymentPage() {
  const { t, i18n } = useTranslation();
  const [salon, setSalon] = useState<SalonSummary | null>(null);
  const [profile, setProfile] = useState<MasterProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [saveState, setSaveState] = useState<ActionState>('idle');
  const [saveHint, setSaveHint] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [miaPhone, setMiaPhone] = useState('');
  const [ibanNumber, setIbanNumber] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [paymentNote, setPaymentNote] = useState('');

  /** Примечание по языкам: клиент читает на своём. */
  const [paymentNoteRo, setPaymentNoteRo] = useState('');
  const [paymentNoteRu, setPaymentNoteRu] = useState('');
  const [paymentNoteEn, setPaymentNoteEn] = useState('');

  const language = i18n.language;

  const currentNote = language.startsWith('ro')
    ? paymentNoteRo
    : language.startsWith('en')
      ? paymentNoteEn
      : paymentNoteRu;

  /**
   * Пишем в поле выбранного языка. Основное держим в согласии:
   * на него смотрят места, где перевода ещё нет.
   */
  function setCurrentNote(value: string) {
    if (language.startsWith('ro')) {
      setPaymentNoteRo(value);
    } else if (language.startsWith('en')) {
      setPaymentNoteEn(value);
    } else {
      setPaymentNoteRu(value);
    }

    setPaymentNote(value);
  }

  useEffect(() => { void loadData(); }, []);

  async function loadData() {
    setIsLoading(true);
    try {
      const salonsRes = await api.get<SalonSummary[]>('/salons/my');
      const masterSalons = salonsRes.data.filter((s) => s.membershipStatus === 'active');
      const savedId = localStorage.getItem(CURRENT_SALON_ID_KEY);
      const currentSalon = (savedId ? masterSalons.find((s) => s.id === savedId) : undefined) ?? masterSalons[0] ?? null;
      setSalon(currentSalon);
      if (!currentSalon) return;
      // Раньше профиль искали в общем списке и при промахе брали
      // mastersRes.data[0] — первого попавшегося мастера.
      // Реквизиты могли сохраниться чужому человеку.
      const meRes = await api.get<MasterProfile>('/masters/me');
      const myProfile = meRes.data;
      if (myProfile) {
        setProfile(myProfile);
        setMiaPhone(myProfile.miaPhone ?? '');
        setIbanNumber(myProfile.ibanNumber ?? '');
        setCardNumber(myProfile.cardNumber ?? '');
        setPaymentNote(myProfile.paymentNote ?? '');
        setPaymentNoteRo(myProfile.paymentNoteRo ?? '');
        setPaymentNoteRu(myProfile.paymentNoteRu ?? '');
        setPaymentNoteEn(myProfile.paymentNoteEn ?? '');
      }
    } catch {
      setErrorMsg(t('common.loadError'));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setSaveState('loading');
    setSaveHint('');
    setErrorMsg('');
    try {
      await api.patch('/masters/me', {
        miaPhone: miaPhone.trim() || null,
        ibanNumber: ibanNumber.trim() || null,
        cardNumber: cardNumber.trim() || null,
        paymentNote: paymentNote.trim() || null,
        paymentNoteRo: paymentNoteRo.trim() || paymentNote.trim() || null,
        paymentNoteRu: paymentNoteRu.trim() || paymentNote.trim() || null,
        paymentNoteEn: paymentNoteEn.trim() || paymentNote.trim() || null,
      });
      setSaveState('success');
      setSaveHint(t('payment.saved'));
      setTimeout(() => setSaveState('idle'), 4000);
    } catch (error) {
      setSaveState('error');
      setSaveHint(t(getErrorKey(error)));
      setTimeout(() => setSaveState('idle'), 6000);
    }
  }

  const inputStyle = { padding: '11px 14px', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 13, background: 'rgba(255,255,255,0.06)', color: 'var(--app-text)', fontSize: 14, outline: 'none' };
  const labelStyle = { display: 'flex', flexDirection: 'column' as const, gap: 6, fontSize: 13, color: 'var(--app-text)' };

  return (
    <AppLayout>
      <main className="dashboard-page">
        <header className="dashboard-header">
          <div>
            <h1>{t('payment.title')}</h1>
            <p className="dashboard-subtitle">{t('payment.subtitle')}</p>
          </div>
          <div className="dashboard-period">
            <span>{t('dashboard.salon')}</span>
            <strong>{salon?.name ?? '—'}</strong>
          </div>
        </header>

        {errorMsg && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 15px', borderRadius: 13, marginBottom: 16, fontSize: 13, fontWeight: 700, border: '1px solid rgba(255,96,128,0.25)', background: 'rgba(255,96,128,0.1)', color: 'var(--app-danger)' }}>
            <X size={15} />{errorMsg}
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
                    <p className="panel-kicker">{t('payment.miaTitle').toUpperCase()}</p>
                    <h2>{t('payment.miaTitle')}</h2>
                  </div>
                  <Phone size={22} />
                </div>
                <p style={{ color: 'var(--app-text-muted)', fontSize: 13, lineHeight: 1.6, marginBottom: 16 }}>{t('payment.miaSubtitle')}</p>
                <label style={labelStyle}>
                  {t('payment.miaPhone')}
                  <input type="tel" value={miaPhone} onChange={(e) => setMiaPhone(e.target.value)} placeholder="+37369000000" style={inputStyle} />
                </label>
                <div style={{ marginTop: 14, padding: '12px 14px', borderRadius: 12, background: 'rgba(var(--app-accent-rgb), 0.06)', border: '1px solid rgba(var(--app-accent-rgb), 0.15)' }}>
                  <p style={{ color: 'var(--app-danger)', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>{t('payment.howItWorks')}</p>
                  <p style={{ color: 'var(--app-text-muted)', fontSize: 12, lineHeight: 1.5 }}>{t('payment.miaDesc')}</p>
                </div>
              </article>

              <article className="dashboard-panel">
                <div className="panel-heading">
                  <div>
                    <p className="panel-kicker">{t('payment.cardTitle').toUpperCase()}</p>
                    <h2>{t('payment.cardTitle')}</h2>
                  </div>
                  <CreditCard size={22} />
                </div>
                <p style={{ color: 'var(--app-text-muted)', fontSize: 13, lineHeight: 1.6, marginBottom: 16 }}>{t('payment.cardSubtitle')}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <label style={labelStyle}>
                    {t('payment.cardNumber')}
                    <input type="text" value={cardNumber} onChange={(e) => setCardNumber(e.target.value)} placeholder="1234 5678 9012 3456" maxLength={20} style={inputStyle} />
                  </label>
                  <label style={labelStyle}>
                    {t('payment.iban')}
                    <input type="text" value={ibanNumber} onChange={(e) => setIbanNumber(e.target.value.toUpperCase())} placeholder="MD24AG000225100013104168" maxLength={34} style={inputStyle} />
                  </label>
                </div>
              </article>
            </section>

            <article className="dashboard-panel" style={{ marginTop: 16 }}>
              <div className="panel-heading">
                <div>
                  <p className="panel-kicker">{t('payment.noteTitle').toUpperCase()}</p>
                  <h2>{t('payment.noteTitle')}</h2>
                </div>
                <Wallet size={22} />
              </div>
              <p style={{ color: 'var(--app-text-muted)', fontSize: 13, marginBottom: 12 }}>{t('payment.noteSubtitle')}</p>
              <textarea value={currentNote} onChange={(e) => setCurrentNote(e.target.value)} placeholder={t('payment.notePlaceholder')} maxLength={200} rows={3} style={{ width: '100%', padding: '11px 14px', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 13, background: 'rgba(255,255,255,0.06)', color: 'var(--app-text)', fontSize: 13, outline: 'none', resize: 'vertical', fontFamily: 'inherit' }} />
              <p style={{ color: '#555', fontSize: 11, marginTop: 4 }}>{currentNote.length}/200</p>
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

export default MasterPaymentPage;
