import { useEffect, useState } from 'react';
import {
  Check,
  CreditCard,
  Phone,
  Save,
  Wallet,
  X,
} from 'lucide-react';
import api from '../api/api';
import AppLayout from '../components/AppLayout';

type SalonSummary = {
  id: string;
  name: string;
  membershipStatus?: string | null;
  membershipRole?: string | null;
  membershipRoles?: string[];
};

type MasterProfile = {
  id: string;
  userId?: string;
  miaPhone?: string | null;
  ibanNumber?: string | null;
  cardNumber?: string | null;
  paymentNote?: string | null;
};

const CURRENT_SALON_ID_KEY = 'glamour_current_salon_id';

function MasterPaymentPage() {
  const [salon, setSalon] = useState<SalonSummary | null>(null);
  const [profile, setProfile] = useState<MasterProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const [miaPhone, setMiaPhone] = useState('');
  const [ibanNumber, setIbanNumber] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [paymentNote, setPaymentNote] = useState('');

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    setIsLoading(true);
    try {
      const salonsRes = await api.get<SalonSummary[]>('/salons/my');
      const masterSalons = salonsRes.data.filter((s) => s.membershipStatus === 'active');
      const savedId = localStorage.getItem(CURRENT_SALON_ID_KEY);
      const currentSalon = (savedId ? masterSalons.find((s) => s.id === savedId) : undefined) ?? masterSalons[0] ?? null;
      setSalon(currentSalon);
      if (!currentSalon) return;

      const sessionRes = await api.get<any>('/auth/session');
      const currentUserId = sessionRes.data?.user?.id;

      const mastersRes = await api.get<MasterProfile[]>('/masters', { params: { salonId: currentSalon.id } });
      const myProfile = mastersRes.data.find((m: any) => m.userId === currentUserId) ?? mastersRes.data[0];

      if (myProfile) {
        setProfile(myProfile);
        setMiaPhone(myProfile.miaPhone ?? '');
        setIbanNumber(myProfile.ibanNumber ?? '');
        setCardNumber(myProfile.cardNumber ?? '');
        setPaymentNote(myProfile.paymentNote ?? '');
      }
    } catch {
      setErrorMsg('Не удалось загрузить данные.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!salon || !profile) return;
    setIsSaving(true);
    setSuccessMsg('');
    setErrorMsg('');
    try {
      await api.patch(
        `/masters/${profile.id}`,
        {
          miaPhone: miaPhone.trim() || null,
          ibanNumber: ibanNumber.trim() || null,
          cardNumber: cardNumber.trim() || null,
          paymentNote: paymentNote.trim() || null,
        },
        { params: { salonId: salon.id } },
      );
      setSuccessMsg('Реквизиты сохранены!');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch {
      setErrorMsg('Не удалось сохранить реквизиты.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <AppLayout>
      <main className="dashboard-page">
        <header className="dashboard-header">
          <div>
            <p className="dashboard-eyebrow">МОИ РЕКВИЗИТЫ</p>
            <h1>Способы получения оплаты</h1>
            <p className="dashboard-subtitle">
              Укажите реквизиты для получения оплаты от клиентов.
              Эти данные будут видны клиенту при записи.
            </p>
          </div>
          <div className="dashboard-period">
            <span>Салон</span>
            <strong>{salon?.name ?? '—'}</strong>
          </div>
        </header>

        {successMsg && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 15px', borderRadius: 13, marginBottom: 16, fontSize: 13, fontWeight: 700, border: '1px solid rgba(77,208,139,0.25)', background: 'rgba(77,208,139,0.1)', color: '#9ae9bd' }}>
            <Check size={15} />{successMsg}
          </div>
        )}
        {errorMsg && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 15px', borderRadius: 13, marginBottom: 16, fontSize: 13, fontWeight: 700, border: '1px solid rgba(255,96,128,0.25)', background: 'rgba(255,96,128,0.1)', color: '#ffb6c6' }}>
            <X size={15} />{errorMsg}
          </div>
        )}

        {isLoading ? (
          <p className="dashboard-status">Загрузка...</p>
        ) : (
          <form onSubmit={handleSave}>
            <section className="dashboard-columns">

              {/* MIA Pay */}
              <article className="dashboard-panel">
                <div className="panel-heading">
                  <div>
                    <p className="panel-kicker">МОЛДОВА</p>
                    <h2>MIA Pay</h2>
                  </div>
                  <Phone size={22} />
                </div>
                <p style={{ color: '#9d949f', fontSize: 13, lineHeight: 1.6, marginBottom: 16 }}>
                  Клиенты из Молдовы смогут оплатить по номеру телефона через приложение MIA.
                </p>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: '#d7ced8' }}>
                  Номер телефона MIA
                  <input
                    type="tel"
                    value={miaPhone}
                    onChange={(e) => setMiaPhone(e.target.value)}
                    placeholder="+37369000000"
                    style={{ padding: '11px 14px', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 13, background: 'rgba(255,255,255,0.06)', color: '#fff7fc', fontSize: 14, outline: 'none' }}
                  />
                </label>
                <div style={{ marginTop: 14, padding: '12px 14px', borderRadius: 12, background: 'rgba(214,130,184,0.06)', border: '1px solid rgba(214,130,184,0.15)' }}>
                  <p style={{ color: '#efb6d8', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>КАК ЭТО РАБОТАЕТ</p>
                  <p style={{ color: '#9d949f', fontSize: 12, lineHeight: 1.5 }}>
                    Клиент видит ваш номер при записи и отправляет оплату через MIA Pay на свём телефоне.
                  </p>
                </div>
              </article>

              {/* Карта */}
              <article className="dashboard-panel">
                <div className="panel-heading">
                  <div>
                    <p className="panel-kicker">МЕЖДУНАРОДНЫЕ</p>
                    <h2>Банковская карта</h2>
                  </div>
                  <CreditCard size={22} />
                </div>
                <p style={{ color: '#9d949f', fontSize: 13, lineHeight: 1.6, marginBottom: 16 }}>
                  Для иностранных клиентов или тех кто предпочитает карту. Укажите номер карты для перевода.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: '#d7ced8' }}>
                    Номер карты
                    <input
                      type="text"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value)}
                      placeholder="1234 5678 9012 3456"
                      maxLength={20}
                      style={{ padding: '11px 14px', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 13, background: 'rgba(255,255,255,0.06)', color: '#fff7fc', fontSize: 14, outline: 'none' }}
                    />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: '#d7ced8' }}>
                    IBAN (для банковских переводов)
                    <input
                      type="text"
                      value={ibanNumber}
                      onChange={(e) => setIbanNumber(e.target.value.toUpperCase())}
                      placeholder="MD24AG000225100013104168"
                      maxLength={34}
                      style={{ padding: '11px 14px', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 13, background: 'rgba(255,255,255,0.06)', color: '#fff7fc', fontSize: 14, outline: 'none' }}
                    />
                  </label>
                </div>
              </article>
            </section>

            {/* Примечание */}
            <article className="dashboard-panel" style={{ marginTop: 16 }}>
              <div className="panel-heading">
                <div>
                  <p className="panel-kicker">ДОПОЛНИТЕЛЬНО</p>
                  <h2>Примечание для клиента</h2>
                </div>
                <Wallet size={22} />
              </div>
              <p style={{ color: '#9d949f', fontSize: 13, marginBottom: 12 }}>
                Любая дополнительная информация об оплате которую клиент должен знать.
              </p>
              <textarea
                value={paymentNote}
                onChange={(e) => setPaymentNote(e.target.value)}
                placeholder="Например: Принимаю оплату наличными и через MIA. Депозит 50% при записи на окрашивание."
                maxLength={200}
                rows={3}
                style={{ width: '100%', padding: '11px 14px', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 13, background: 'rgba(255,255,255,0.06)', color: '#fff7fc', fontSize: 13, outline: 'none', resize: 'vertical', fontFamily: 'inherit' }}
              />
              <p style={{ color: '#555', fontSize: 11, marginTop: 4 }}>{paymentNote.length}/200</p>
            </article>

            <div style={{ marginTop: 20 }}>
              <button
                type="submit"
                disabled={isSaving}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 48, padding: '0 24px', border: 0, borderRadius: 14, background: '#d682b8', color: '#17151c', fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: isSaving ? 0.7 : 1 }}
              >
                <Save size={17} />
                {isSaving ? 'Сохраняем...' : 'Сохранить реквизиты'}
              </button>
            </div>
          </form>
        )}
      </main>
    </AppLayout>
  );
}

export default MasterPaymentPage;
