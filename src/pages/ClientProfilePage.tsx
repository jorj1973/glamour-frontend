import { useEffect, useState } from 'react';
import { Save, UserRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../api/api';
import { getErrorKey } from '../api/errorMessage';
import ActionButton, { type ActionState } from '../components/ActionButton';

type SessionUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
};

/** Профиль клиента: свои данные и их изменение. */
function ClientProfilePage() {
  const { t } = useTranslation();

  const [isLoading, setIsLoading] = useState(true);
  const [saveState, setSaveState] = useState<ActionState>('idle');
  const [saveHint, setSaveHint] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  useEffect(() => { void load(); }, []);

  async function load() {
    setIsLoading(true);

    try {
      const res = await api.get<{ user: SessionUser }>('/auth/session');
      const u = res.data.user;

      setFirstName(u.firstName ?? '');
      setLastName(u.lastName ?? '');
      setEmail(u.email ?? '');
      setPhone(u.phone ?? '');
    } catch (error) {
      setErrorMsg(t(getErrorKey(error)));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();

    if (phone.trim() && !/^\+[1-9]\d{7,14}$/.test(phone.trim())) {
      setSaveState('error');
      setSaveHint(t('booking.phoneHint'));
      setTimeout(() => setSaveState('idle'), 6000);
      return;
    }

    setSaveState('loading');
    setSaveHint('');

    try {
      await api.patch('/users/me', {
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
      });

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
    border: '1px solid rgba(var(--app-overlay-rgb), 0.12)',
    borderRadius: 13,
    background: 'rgba(var(--app-overlay-rgb), 0.06)',
    color: 'var(--app-text, var(--app-text))',
    fontSize: 14,
    outline: 'none',
  };

  const labelStyle = {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 6,
    fontSize: 13,
    color: 'var(--app-text, var(--app-text))',
  };

  if (isLoading) {
    return <p style={{ color: 'var(--app-text-muted, var(--app-text-muted))', fontSize: 14 }}>{t('common.loading')}</p>;
  }

  const initials = `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase();

  return (
    <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {errorMsg && (
        <div style={{ padding: '11px 15px', borderRadius: 13, fontSize: 13, fontWeight: 700, border: '1px solid rgba(255,96,128,0.25)', background: 'rgba(255,96,128,0.1)', color: 'var(--app-accent-warm)' }}>
          {errorMsg}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 62,
            height: 62,
            borderRadius: 20,
            background: 'rgba(var(--app-accent-rgb), 0.14)',
            color: 'var(--app-accent-text)',
            fontSize: 20,
            fontWeight: 800,
          }}
        >
          {initials || <UserRound size={26} />}
        </span>

        <div style={{ minWidth: 0 }}>
          <strong style={{ color: 'var(--app-text, var(--app-text))', fontSize: 17 }}>
            {`${firstName} ${lastName}`.trim() || t('clientProfile.noName')}
          </strong>
          <p style={{ color: 'var(--app-text-muted, var(--app-text-muted))', fontSize: 13 }}>{email}</p>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          padding: 18,
          borderRadius: 18,
          border: '1px solid rgba(var(--app-overlay-rgb), 0.09)',
          background: 'rgba(var(--app-overlay-rgb), 0.04)',
        }}
      >
        <label style={labelStyle}>
          {t('booking.firstName')}
          <input value={firstName} onChange={(e) => setFirstName(e.target.value)}
            maxLength={80} style={inputStyle} />
        </label>

        <label style={labelStyle}>
          {t('booking.lastName')}
          <input value={lastName} onChange={(e) => setLastName(e.target.value)}
            maxLength={80} style={inputStyle} />
        </label>

        <label style={labelStyle}>
          {t('booking.phone')}
          <input value={phone} onChange={(e) => setPhone(e.target.value)}
            inputMode="tel" placeholder="+373..." style={inputStyle} />
          <span style={{ color: 'var(--app-text-muted, var(--app-text-dim5))', fontSize: 12 }}>
            {t('booking.phoneHint')}
          </span>
        </label>

        <label style={labelStyle}>
          Email
          <input value={email} onChange={(e) => setEmail(e.target.value)}
            type="email" maxLength={254} style={inputStyle} />
          <span style={{ color: 'var(--app-text-muted, var(--app-text-dim5))', fontSize: 12 }}>
            {t('clientProfile.emailHint')}
          </span>
        </label>
      </div>

      <div>
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
  );
}

export default ClientProfilePage;
