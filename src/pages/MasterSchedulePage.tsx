import { useEffect, useState } from 'react';
import { CalendarDays, Check, Clock, Save, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../api/api';
import AppLayout from '../components/AppLayout';

type SalonSummary = {
  id: string;
  name: string;
  membershipRole?: string | null;
  membershipRoles?: string[];
  membershipStatus?: string | null;
};

type WorkSchedule = {
  id: string;
  masterProfileId: string;
  dayOfWeek: string | null;
  specificDate: string | null;
  type: string;
  startTime: string | null;
  endTime: string | null;
  breakStartTime: string | null;
  breakEndTime: string | null;
  isWorkingDay: boolean;
  isActive: boolean;
};

type DayRow = {
  dayOfWeek: string;
  id: string | null;
  isWorkingDay: boolean;
  startTime: string;
  endTime: string;
  breakStartTime: string;
  breakEndTime: string;
};

const CURRENT_SALON_ID_KEY = 'glamour_current_salon_id';

const DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];

function emptyRow(day: string): DayRow {
  return {
    dayOfWeek: day,
    id: null,
    isWorkingDay: day !== 'saturday' && day !== 'sunday',
    startTime: '09:00',
    endTime: '18:00',
    breakStartTime: '',
    breakEndTime: '',
  };
}

function trimTime(value: string | null): string {
  if (!value) return '';
  return value.slice(0, 5);
}

function MasterSchedulePage() {
  const { t } = useTranslation();
  const [salon, setSalon] = useState<SalonSummary | null>(null);
  const [masterProfileId, setMasterProfileId] = useState('');
  const [rows, setRows] = useState<DayRow[]>(DAYS.map(emptyRow));
  const [isLoading, setIsLoading] = useState(true);
  const [savingDay, setSavingDay] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    void init();
  }, []);

  async function init() {
    setIsLoading(true);
    try {
      const salonsRes = await api.get<SalonSummary[]>('/salons/my');
      const masterSalons = salonsRes.data.filter(
        (s) => s.membershipStatus === 'active' &&
          (s.membershipRoles?.includes('master') || s.membershipRole === 'master'),
      );
      const savedId = localStorage.getItem(CURRENT_SALON_ID_KEY);
      const current = (savedId ? masterSalons.find((s) => s.id === savedId) : undefined) ?? masterSalons[0] ?? null;
      setSalon(current);
      if (!current) { setErrorMsg(t('schedule.salonNotFound')); return; }

      const sessionRes = await api.get<any>('/auth/session');
      const currentUserId = sessionRes.data?.user?.id;
      const mastersRes = await api.get<any[]>('/masters', { params: { salonId: current.id } });
      const myProfile = mastersRes.data.find((m: any) => m.userId === currentUserId) ?? mastersRes.data[0];
      if (!myProfile) { setErrorMsg(t('schedule.profileNotFound')); return; }
      setMasterProfileId(myProfile.id);

      await loadSchedule(myProfile.id);
    } catch {
      setErrorMsg(t('schedule.loadError'));
    } finally {
      setIsLoading(false);
    }
  }

  async function loadSchedule(profileId: string) {
    try {
      const res = await api.get<WorkSchedule[]>(`/masters/work-schedule/${profileId}`);
      const regular = res.data.filter((s) => s.type === 'regular' && s.dayOfWeek);
      setRows(DAYS.map((day) => {
        const found = regular.find((s) => s.dayOfWeek === day);
        if (!found) return emptyRow(day);
        return {
          dayOfWeek: day,
          id: found.id,
          isWorkingDay: found.isWorkingDay,
          startTime: trimTime(found.startTime) || '09:00',
          endTime: trimTime(found.endTime) || '18:00',
          breakStartTime: trimTime(found.breakStartTime),
          breakEndTime: trimTime(found.breakEndTime),
        };
      }));
    } catch {
      setRows(DAYS.map(emptyRow));
    }
  }

  function updateRow(day: string, patch: Partial<DayRow>) {
    setRows((current) => current.map((r) => (r.dayOfWeek === day ? { ...r, ...patch } : r)));
  }

  function showSuccess(msg: string) {
    setSuccessMsg(msg);
    setErrorMsg('');
    setTimeout(() => setSuccessMsg(''), 3000);
  }

  async function saveDay(row: DayRow) {
    if (!masterProfileId) return;
    setSavingDay(row.dayOfWeek);
    setErrorMsg('');
    try {
      const payload: Record<string, unknown> = {
        masterProfileId,
        dayOfWeek: row.dayOfWeek,
        type: 'regular',
        isWorkingDay: row.isWorkingDay,
        isActive: true,
      };
      if (row.isWorkingDay) {
        payload.startTime = row.startTime;
        payload.endTime = row.endTime;
        if (row.breakStartTime && row.breakEndTime) {
          payload.breakStartTime = row.breakStartTime;
          payload.breakEndTime = row.breakEndTime;
        }
      }

      if (row.id) {
        await api.patch(`/masters/work-schedule/${row.id}`, payload);
      } else {
        const res = await api.post<WorkSchedule>('/masters/work-schedule', payload);
        updateRow(row.dayOfWeek, { id: res.data.id });
      }
      showSuccess(t('schedule.saved'));
    } catch {
      setErrorMsg(t('schedule.saveError'));
    } finally {
      setSavingDay(null);
    }
  }

  async function saveAll() {
    for (const row of rows) {
      await saveDay(row);
    }
  }

  const workingCount = rows.filter((r) => r.isWorkingDay).length;

  return (
    <AppLayout>
      <main className="dashboard-page">
        <header className="dashboard-header">
          <div>
            <h1>{t('schedule.title')}</h1>
            <p className="dashboard-subtitle">{t('schedule.subtitle')}</p>
          </div>
          <div className="dashboard-period">
            <span>{t('schedule.workingDays')}</span>
            <strong>{workingCount}</strong>
          </div>
        </header>

        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <a href="#schedule" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, minHeight: 40, padding: '0 14px', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, background: 'rgba(255,255,255,0.05)', color: 'var(--app-text)', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
            <CalendarDays size={14} /> {t('calendar.backToCalendar')}
          </a>
        </div>

        {successMsg && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 15px', borderRadius: 13, marginBottom: 16, fontSize: 13, fontWeight: 700, border: '1px solid rgba(77,208,139,0.25)', background: 'rgba(77,208,139,0.1)', color: '#9ae9bd' }}>
            <Check size={15} />{successMsg}
          </div>
        )}
        {errorMsg && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 15px', borderRadius: 13, marginBottom: 16, fontSize: 13, fontWeight: 700, border: '1px solid rgba(255,96,128,0.25)', background: 'rgba(255,96,128,0.1)', color: 'var(--app-danger)' }}>
            <X size={15} />{errorMsg}
          </div>
        )}

        <section className="dashboard-panel">
          <div className="panel-heading">
            <div>
              <p className="panel-kicker">{t('schedule.weekly').toUpperCase()}</p>
              <h2>{salon?.name ?? '—'}</h2>
            </div>
            <CalendarDays size={22} />
          </div>

          {isLoading ? (
            <p className="dashboard-status">{t('schedule.loading')}</p>
          ) : (
            <div>
              {rows.map((row) => (
                <div key={row.dayOfWeek} style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: row.isWorkingDay ? 'transparent' : 'rgba(255,255,255,0.015)', opacity: row.isWorkingDay ? 1 : 0.65 }}>
                  <div style={{ minWidth: 130 }}>
                    <strong style={{ color: 'var(--app-text)', fontSize: 14 }}>{t('schedule.days.' + row.dayOfWeek)}</strong>
                  </div>

                  <label style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer', color: 'var(--app-text)', fontSize: 13, minWidth: 130 }}>
                    <span
                      onClick={() => updateRow(row.dayOfWeek, { isWorkingDay: !row.isWorkingDay })}
                      style={{ display: 'inline-flex', width: 40, height: 22, borderRadius: 11, background: row.isWorkingDay ? 'var(--app-accent)' : 'rgba(255,255,255,0.12)', position: 'relative', transition: 'background 0.2s', cursor: 'pointer', flexShrink: 0 }}
                    >
                      <span style={{ position: 'absolute', top: 3, left: row.isWorkingDay ? 21 : 3, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
                    </span>
                    {row.isWorkingDay ? t('schedule.working') : t('schedule.dayOff')}
                  </label>

                  {row.isWorkingDay && (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Clock size={14} style={{ color: 'var(--app-danger)' }} />
                        <input type="time" value={row.startTime} onChange={(e) => updateRow(row.dayOfWeek, { startTime: e.target.value })} style={inputStyle} />
                        <span style={{ color: 'var(--app-text-muted)' }}>—</span>
                        <input type="time" value={row.endTime} onChange={(e) => updateRow(row.dayOfWeek, { endTime: e.target.value })} style={inputStyle} />
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ color: 'var(--app-text-muted)', fontSize: 12 }}>{t('schedule.break')}</span>
                        <input type="time" value={row.breakStartTime} onChange={(e) => updateRow(row.dayOfWeek, { breakStartTime: e.target.value })} style={inputStyle} />
                        <span style={{ color: 'var(--app-text-muted)' }}>—</span>
                        <input type="time" value={row.breakEndTime} onChange={(e) => updateRow(row.dayOfWeek, { breakEndTime: e.target.value })} style={inputStyle} />
                      </div>
                    </>
                  )}

                  <button
                    type="button"
                    onClick={() => void saveDay(row)}
                    disabled={savingDay !== null}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 34, padding: '0 12px', borderRadius: 10, border: '1px solid rgba(var(--app-accent-rgb), 0.25)', background: 'rgba(var(--app-accent-rgb), 0.1)', color: 'var(--app-danger)', fontSize: 12, fontWeight: 700, cursor: 'pointer', marginLeft: 'auto' }}
                  >
                    <Save size={13} />
                    {savingDay === row.dayOfWeek ? t('common.saving') : t('common.save')}
                  </button>
                </div>
              ))}

              <div style={{ padding: '16px' }}>
                <button type="button" className="primary-action" onClick={() => void saveAll()} disabled={savingDay !== null}>
                  <Save size={15} /> {t('schedule.saveAll')}
                </button>
              </div>
            </div>
          )}
        </section>
      </main>
    </AppLayout>
  );
}

const inputStyle: React.CSSProperties = {
  padding: '7px 10px',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 10,
  background: 'rgba(255,255,255,0.06)',
  color: 'var(--app-text)',
  fontSize: 13,
};

export default MasterSchedulePage;
