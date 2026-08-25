import { useEffect, useState } from 'react';
import { Gift, Percent, Save, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../api/api';
import { getErrorKey } from '../api/errorMessage';
import AppLayout from '../components/AppLayout';
import ActionButton, { type ActionState } from '../components/ActionButton';

type LoyaltySettings = {
  id: string;
  ownerType: string;
  pointsPerCurrencyUnit: number;
  earnPercent: number | string;
  referralBonusPoints: number;
  referralWelcomePoints: number;
  isActive: boolean;
};

const CURRENT_SALON_ID_KEY = 'glamour_current_salon_id';

function LoyaltyPage() {
  const { t } = useTranslation();

  const [isLoading, setIsLoading] = useState(true);
  const [saveState, setSaveState] = useState<ActionState>('idle');
  const [saveHint, setSaveHint] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const [pointsPerUnit, setPointsPerUnit] = useState('10');
  const [earnPercent, setEarnPercent] = useState('5');
  const [referralBonus, setReferralBonus] = useState('500');
  const [welcomeBonus, setWelcomeBonus] = useState('100');
  const [isActive, setIsActive] = useState(true);

  /** Сумма для проверки расчёта — меняется, пример пересчитывается сразу. */
  const [calcAmount, setCalcAmount] = useState('300');

  const salonId = localStorage.getItem(CURRENT_SALON_ID_KEY) ?? '';

  useEffect(() => { void load(); }, []);

  async function load() {
    setIsLoading(true);
    try {
      const res = await api.get<LoyaltySettings>('/loyalty/settings', {
        params: { salonId },
      });

      const s = res.data;
      setPointsPerUnit(String(s.pointsPerCurrencyUnit));
      setEarnPercent(String(Number(s.earnPercent)));
      setReferralBonus(String(s.referralBonusPoints));
      setWelcomeBonus(String(s.referralWelcomePoints));
      setIsActive(s.isActive);
    } catch (error) {
      setErrorMsg(t(getErrorKey(error)));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaveState('loading');
    setSaveHint('');

    try {
      await api.patch(
        '/loyalty/settings',
        {
          pointsPerCurrencyUnit: Number(pointsPerUnit) || 10,
          earnPercent: Number(earnPercent) || 0,
          referralBonusPoints: Number(referralBonus) || 0,
          referralWelcomePoints: Number(welcomeBonus) || 0,
          isActive,
        },
        { params: { salonId } },
      );

      setSaveState('success');
      setSaveHint(t('success.saved'));
      setTimeout(() => setSaveState('idle'), 4000);
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

  const hintStyle = { color: 'var(--app-text-muted, #6d656f)', fontSize: 12, lineHeight: 1.5 };

  // Сколько баллов получит клиент и во что они превратятся при списании.
  const amount = Number(calcAmount) || 0;
  const percent = Number(earnPercent) || 0;
  const rate = Number(pointsPerUnit) || 1;

  const pointsExample = Math.round(((amount * percent) / 100) * rate);
  const pointsValue = rate > 0 ? (pointsExample / rate).toFixed(2) : '0';

  return (
    <AppLayout>
      <main className="dashboard-page">
        <header className="dashboard-header centered-header">
          <div>
            <h1>{t('loyalty.title')}</h1>
            <p className="dashboard-subtitle">{t('loyalty.subtitle')}</p>
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
                    <p className="panel-kicker">{t('loyalty.earnTitle').toUpperCase()}</p>
                    <h2>{t('loyalty.earnTitle')}</h2>
                  </div>
                  <Percent size={22} />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <label style={labelStyle}>
                    {t('loyalty.pointsPerUnit')}
                    <input type="number" min="1" max="1000" value={pointsPerUnit}
                      onChange={(e) => setPointsPerUnit(e.target.value)} style={inputStyle} />
                    <span style={hintStyle}>{t('loyalty.pointsPerUnitHint')}</span>
                  </label>

                  <label style={labelStyle}>
                    {t('loyalty.earnPercent')}
                    <input type="number" min="0" max="100" step="0.5" value={earnPercent}
                      onChange={(e) => setEarnPercent(e.target.value)} style={inputStyle} />
                  </label>

                  <div
                    style={{
                      padding: 14,
                      borderRadius: 13,
                      border: '1px solid rgba(var(--app-accent-rgb), 0.2)',
                      background: 'rgba(var(--app-accent-rgb), 0.06)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                    }}
                  >
                    <label style={labelStyle}>
                      {t('loyalty.calcAmount')}
                      <input
                        type="number"
                        min="0"
                        step="10"
                        value={calcAmount}
                        onChange={(e) => setCalcAmount(e.target.value)}
                        style={inputStyle}
                      />
                    </label>

                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                      <span style={{ fontSize: 13, color: 'var(--app-text-muted)' }}>
                        {t('loyalty.calcPoints')}
                      </span>
                      <strong style={{ color: 'var(--app-accent)', fontSize: 15 }}>
                        {pointsExample}
                      </strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                      <span style={{ fontSize: 13, color: 'var(--app-text-muted)' }}>
                        {t('loyalty.calcValue')}
                      </span>
                      <strong style={{ color: '#9ae9bd', fontSize: 15 }}>
                        {pointsValue} MDL
                      </strong>
                    </div>

                    <p style={hintStyle}>{t('loyalty.calcHint')}</p>
                  </div>
                </div>
              </article>

              <article className="dashboard-panel">
                <div className="panel-heading">
                  <div>
                    <p className="panel-kicker">{t('loyalty.referralTitle').toUpperCase()}</p>
                    <h2>{t('loyalty.referralTitle')}</h2>
                  </div>
                  <Users size={22} />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <label style={labelStyle}>
                    {t('loyalty.referralBonus')}
                    <input type="number" min="0" value={referralBonus}
                      onChange={(e) => setReferralBonus(e.target.value)} style={inputStyle} />
                    <span style={hintStyle}>{t('loyalty.referralBonusHint')}</span>
                  </label>

                  <label style={labelStyle}>
                    {t('loyalty.welcomeBonus')}
                    <input type="number" min="0" value={welcomeBonus}
                      onChange={(e) => setWelcomeBonus(e.target.value)} style={inputStyle} />
                    <span style={hintStyle}>{t('loyalty.welcomeBonusHint')}</span>
                  </label>
                </div>
              </article>
            </section>

            <article className="dashboard-panel" style={{ marginTop: 16 }}>
              <div className="panel-heading">
                <div>
                  <p className="panel-kicker">{t('loyalty.statusTitle').toUpperCase()}</p>
                  <h2>{t('loyalty.statusTitle')}</h2>
                </div>
                <Gift size={22} />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 0' }}>
                <span style={{ fontSize: 13, color: 'var(--app-text)' }}>{t('loyalty.isActive')}</span>
                <input type="checkbox" checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  style={{ width: 22, height: 22, accentColor: 'var(--app-accent)', cursor: 'pointer' }} />
              </div>

              <p style={hintStyle}>{t('loyalty.isActiveHint')}</p>
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

export default LoyaltyPage;
