import { useEffect, useState } from 'react';
import { CalendarDays, Check, ChevronLeft, ChevronRight, Clock, Plus, Save, Trash2, User, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../api/api';
import AppLayout from '../components/AppLayout';

type SalonSummary = {
  id: string;
  name: string;
  membershipRole?: string | null;
  membershipRoles?: string[];
  membershipStatus?: string | null;
  cooperationType?: string | null;
};

type CalendarDay = {
  date: string;
  status: string;
  ruleId: string | null;
  type: string | null;
  startTime: string | null;
  endTime: string | null;
  breakStartTime: string | null;
  breakEndTime: string | null;
  note: string | null;
  isWorkingDay: boolean;
  busyMinutes?: number;
  totalMinutes?: number;
  loadPercent?: number;
  loadStatus?: 'free' | 'busy' | 'full';
};

type DayAppointment = {
  id: string;
  startTime: string;
  endTime: string;
  status: string;
  isGuest?: boolean;
  guestName?: string | null;
  guestPhone?: string | null;
  clientName?: string | null;
  serviceName?: string | null;
  masterServiceId?: string;
};

type MyService = {
  id: string;
  customTitle: string | null;
  serviceId: string;
  price: number | string;
  durationMinutes: number;
  isActive: boolean;
};

const CURRENT_SALON_ID_KEY = 'glamour_current_salon_id';

const STATUS_COLORS: Record<string, { bg: string; border: string; color: string }> = {
  working:     { bg: 'rgba(var(--app-accent-rgb), 0.16)', border: 'rgba(var(--app-accent-rgb), 0.45)', color: 'var(--app-accent-strong)' },
  exception:   { bg: 'rgba(255,208,139,0.14)', border: 'rgba(255,208,139,0.4)',  color: '#ffd08b' },
  vacation:    { bg: 'rgba(114,167,255,0.14)', border: 'rgba(114,167,255,0.4)',  color: '#a8c9ff' },
  sick_leave:  { bg: 'rgba(255,96,128,0.12)',  border: 'rgba(255,96,128,0.35)',  color: 'var(--app-accent-strong)' },
  day_off:     { bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.08)', color: 'var(--app-text-muted)' },
  blocked:     { bg: 'rgba(255,255,255,0.06)', border: 'var(--app-toggle-track)', color: 'var(--app-text-muted)' },
  not_working: { bg: 'rgba(255,255,255,0.02)', border: 'rgba(255,255,255,0.06)', color: '#6f6870' },
};

/**
 * Загруженность рабочего дня.
 *
 * Мастер открывает календарь и сразу видит, где ещё есть место.
 * Три состояния вместо двух: короткие окна между записями формально
 * свободны, но втиснуть туда услугу уже нельзя.
 */
const LOAD_COLORS: Record<string, { bg: string; border: string; color: string }> = {
  busy: { bg: 'rgba(255,208,139,0.10)', border: 'rgba(255,208,139,0.32)', color: '#ffd08b' },
  full: { bg: 'rgba(255,96,128,0.10)',  border: 'rgba(255,96,128,0.34)',  color: 'var(--app-accent-strong)' },
};

function getDateLocale(lang?: string) {
  if (lang?.startsWith('ro')) return 'ro-RO';
  if (lang?.startsWith('en')) return 'en-GB';
  return 'ru-RU';
}

function trimTime(v: string | null): string {
  return v ? v.slice(0, 5) : '';
}

function MasterCalendarPage() {
  const { t, i18n } = useTranslation();
  const dateLocale = getDateLocale(i18n.language);

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);


  const [masterProfileId, setMasterProfileId] = useState('');
  const [days, setDays] = useState<CalendarDay[]>([]);
  const [selected, setSelected] = useState<CalendarDay | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  /**
   * Календарь правит конкретные даты, поэтому по умолчанию
   * создаётся исключение. Тип regular здесь недоступен: он
   * создаёт правило на каждую такую дату недели, и отметка
   * одного дня превращалась в вечное «каждый вторник».
   * Еженедельный режим задаётся на странице «Мой график».
   */
  const [formType, setFormType] = useState('exception');
  const [formRange, setFormRange] = useState(false);
  const [formEndDate, setFormEndDate] = useState('');
  const [formWorking, setFormWorking] = useState(true);
  const [formStart, setFormStart] = useState('09:00');
  const [formEnd, setFormEnd] = useState('18:00');
  const [formBreakStart, setFormBreakStart] = useState('');
  const [formBreakEnd, setFormBreakEnd] = useState('');

  const [salonId, setSalonId] = useState('');
  const [dayAppointments, setDayAppointments] = useState<DayAppointment[]>([]);
  const [myServices, setMyServices] = useState<MyService[]>([]);
  const [slotForm, setSlotForm] = useState<string | null>(null);
  const [bookServiceId, setBookServiceId] = useState('');
  const [bookGuestName, setBookGuestName] = useState('');
  const [bookGuestPhone, setBookGuestPhone] = useState('');
  const [bookNote, setBookNote] = useState('');
  const [isBooking, setIsBooking] = useState(false);
  const [openAppt, setOpenAppt] = useState<string | null>(null);
  const [moveTime, setMoveTime] = useState('');
  const [moveDate, setMoveDate] = useState('');
  const [isActing, setIsActing] = useState(false);
  // Штатный мастер не создаёт записи вручную — звонки принимает администратор.
  const [canBookManually, setCanBookManually] = useState(false);

  useEffect(() => { void init(); }, []);
  useEffect(() => { if (masterProfileId) void loadCalendar(masterProfileId, year, month); }, [masterProfileId, year, month]);

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

      if (!current) { setErrorMsg(t('schedule.salonNotFound')); setIsLoading(false); return; }

      const sessionRes = await api.get<any>('/auth/session');
      const currentUserId = sessionRes.data?.user?.id;
      const mastersRes = await api.get<any[]>('/masters', { params: { salonId: current.id } });
      const myProfile = mastersRes.data.find((m: any) => m.userId === currentUserId) ?? mastersRes.data[0];
      if (!myProfile) { setErrorMsg(t('schedule.profileNotFound')); setIsLoading(false); return; }
      setMasterProfileId(myProfile.id);
      setSalonId(current.id);
      setCanBookManually(
        current.cooperationType?.toLowerCase() === 'independent',
      );

      try {
        const svcRes = await api.get<MyService[]>('/masters/me/services', { params: { salonId: current.id } });
        setMyServices(svcRes.data.filter((x) => x.isActive));
      } catch { setMyServices([]); }
    } catch {
      setErrorMsg(t('schedule.loadError'));
      setIsLoading(false);
    }
  }

  async function loadCalendar(profileId: string, y: number, m: number) {
    setIsLoading(true);
    try {
      const res = await api.get<CalendarDay[]>(`/masters/calendar/${profileId}`, { params: { year: y, month: m } });
      setDays(res.data);
    } catch {
      setErrorMsg(t('calendar.loadError'));
      setDays([]);
    } finally {
      setIsLoading(false);
    }
  }

  async function loadDayAppointments(date: string) {
    if (!salonId) return;
    try {
      const res = await api.get<DayAppointment[]>('/appointments/my', { params: { salonId } });
      setDayAppointments(res.data.filter((a) => a.startTime.slice(0, 10) === date && a.status !== 'cancelled'));
    } catch {
      setDayAppointments([]);
    }
  }

  function openDay(day: CalendarDay) {
    setSelected(day);
    setSlotForm(null);
    setErrorMsg('');
    void loadDayAppointments(day.date);
    // Если день пришёл из недельного шаблона, в календаре
    // правим его как исключение на эту дату.
    setFormType(day.type === 'regular' ? 'exception' : (day.type ?? 'exception'));
    setFormRange(false);
    setFormEndDate('');
    setFormWorking(day.isWorkingDay);
    setFormStart(trimTime(day.startTime) || '09:00');
    setFormEnd(trimTime(day.endTime) || '18:00');
    setFormBreakStart(trimTime(day.breakStartTime));
    setFormBreakEnd(trimTime(day.breakEndTime));
  }

  function showSuccess(msg: string) {
    setSuccessMsg(msg);
    setErrorMsg('');
    setTimeout(() => setSuccessMsg(''), 3000);
  }

  async function saveDay() {
    if (!selected || !masterProfileId) return;
    setIsSaving(true);
    setErrorMsg('');
    try {
      const payload: Record<string, unknown> = {
        masterProfileId,
        type: formType,
        isWorkingDay: formType === 'regular' || formType === 'exception' ? formWorking : false,
        isActive: true,
        priority: 10,
      };

      // Отпуск и больничный редко длятся один день. Период уходит
      // как startDate/endDate — на бэкенде isRuleForDate проверяет
      // попадание даты в промежуток. Одиночный день по-прежнему
      // сохраняется как specificDate.
      if (formRange && formEndDate && formEndDate > selected.date) {
        payload.startDate = selected.date;
        payload.endDate = formEndDate;
      } else {
        payload.specificDate = selected.date;
      }
      if (payload.isWorkingDay) {
        payload.startTime = formStart;
        payload.endTime = formEnd;
        if (formBreakStart && formBreakEnd) {
          payload.breakStartTime = formBreakStart;
          payload.breakEndTime = formBreakEnd;
        }
      }

      // Правило типа regular принадлежит недельному шаблону:
      // PATCH переписал бы «каждый понедельник» в больничный и
      // уничтожил шаблон. Для дня из шаблона создаём новое правило.
      const isTemplateRule = selected.type === 'regular';

      if (selected.ruleId && !isTemplateRule) {
        await api.patch(`/masters/work-schedule/${selected.ruleId}`, payload);
      } else {
        await api.post('/masters/work-schedule', payload);
      }
      await loadCalendar(masterProfileId, year, month);
      setSelected(null);
      showSuccess(t('calendar.daySaved'));
    } catch {
      setErrorMsg(t('calendar.saveError'));
    } finally {
      setIsSaving(false);
    }
  }

  async function resetDay() {
    // Возврат к шаблону имеет смысл только для исключения.
    // Для дня из шаблона удаление стёрло бы сам шаблон —
    // «каждый понедельник» исчез бы из всех месяцев.
    if (!selected?.ruleId || !masterProfileId) return;
    if (selected.type === 'regular') { setSelected(null); return; }
    setIsSaving(true);
    try {
      await api.delete(`/masters/work-schedule/${selected.ruleId}`);
      await loadCalendar(masterProfileId, year, month);
      setSelected(null);
      showSuccess(t('calendar.dayReset'));
    } catch {
      setErrorMsg(t('calendar.resetError'));
    } finally {
      setIsSaving(false);
    }
  }

  function buildSlots(day: CalendarDay) {
    if (!day.isWorkingDay || !day.startTime || !day.endTime) return [];
    const toMin = (v: string) => {
      const [h, m] = v.slice(0, 5).split(':').map(Number);
      return h * 60 + m;
    };
    const fromMin = (v: number) =>
      String(Math.floor(v / 60)).padStart(2, '0') + ':' + String(v % 60).padStart(2, '0');

    const start = toMin(day.startTime);
    const end = toMin(day.endTime);
    const bStart = day.breakStartTime ? toMin(day.breakStartTime) : null;
    const bEnd = day.breakEndTime ? toMin(day.breakEndTime) : null;

    const busy = dayAppointments.map((a) => {
      const sd = new Date(a.startTime);
      const ed = new Date(a.endTime);
      return {
        from: sd.getHours() * 60 + sd.getMinutes(),
        to: ed.getHours() * 60 + ed.getMinutes(),
        appointment: a,
      };
    }).sort((x, y) => x.from - y.from);

    const rows: Array<{ kind: 'free' | 'busy' | 'break'; from: number; to: number; appointment?: DayAppointment }> = [];
    let cursor = start;

    while (cursor < end) {
      const hit = busy.find((b) => cursor >= b.from && cursor < b.to);
      if (hit) {
        rows.push({ kind: 'busy', from: hit.from, to: hit.to, appointment: hit.appointment });
        cursor = hit.to;
        continue;
      }
      if (bStart !== null && bEnd !== null && cursor >= bStart && cursor < bEnd) {
        rows.push({ kind: 'break', from: bStart, to: bEnd });
        cursor = bEnd;
        continue;
      }
      rows.push({ kind: 'free', from: cursor, to: cursor + 15 });
      cursor += 15;
    }

    return rows.map((r) => ({ ...r, label: fromMin(r.from), labelTo: fromMin(r.to) }));
  }

  function openSlotForm(time: string) {
    setSlotForm(time);
    setBookServiceId(myServices[0]?.id ?? '');
    setBookGuestName('');
    setBookGuestPhone('');
    setBookNote('');
    setErrorMsg('');
  }

  async function createBooking() {
    if (!selected || !salonId || !bookServiceId || !slotForm) return;
    if (!bookGuestName.trim()) { setErrorMsg(t('daySlots.nameRequired')); return; }

    const svc = myServices.find((x) => x.id === bookServiceId);
    if (!svc) { setErrorMsg(t('daySlots.serviceRequired')); return; }

    setIsBooking(true);
    setErrorMsg('');
    try {
      const [h, m] = slotForm.split(':').map(Number);
      const startDate = new Date(selected.date + 'T00:00:00');
      startDate.setHours(h, m, 0, 0);
      const endDate = new Date(startDate.getTime() + svc.durationMinutes * 60000);

      await api.post('/appointments', {
        salonId,
        masterProfileId,
        masterServiceId: svc.id,
        startTime: startDate.toISOString(),
        endTime: endDate.toISOString(),
        isGuest: true,
        guestName: bookGuestName.trim(),
        guestPhone: bookGuestPhone.trim() || undefined,
        clientComment: bookNote.trim() || undefined,
      }, { params: { salonId } });

      await loadDayAppointments(selected.date);
      setSlotForm(null);
      showSuccess(t('daySlots.booked'));
    } catch {
      setErrorMsg(t('daySlots.bookError'));
    } finally {
      setIsBooking(false);
    }
  }

  async function cancelAppointment(id: string) {
    if (!confirm(t('daySlots.confirmCancel'))) return;
    setIsActing(true);
    setErrorMsg('');
    try {
      await api.patch(`/appointments/${id}/cancel`, undefined, { params: { salonId } });
      if (selected) await loadDayAppointments(selected.date);
      setOpenAppt(null);
      showSuccess(t('daySlots.cancelled'));
    } catch {
      setErrorMsg(t('daySlots.cancelError'));
    } finally {
      setIsActing(false);
    }
  }

  async function rescheduleAppointment(a: DayAppointment) {
    if (!selected || !moveTime || !moveDate) { setErrorMsg(t('daySlots.pickNewTime')); return; }
    setIsActing(true);
    setErrorMsg('');
    try {
      const durationMs = new Date(a.endTime).getTime() - new Date(a.startTime).getTime();
      const [h, m] = moveTime.split(':').map(Number);
      const start = new Date(moveDate + 'T00:00:00');
      start.setHours(h, m, 0, 0);
      const end = new Date(start.getTime() + durationMs);

      await api.patch(`/appointments/${a.id}/reschedule`, {
        startTime: start.toISOString(),
        endTime: end.toISOString(),
      }, { params: { salonId } });

      const movedToAnotherDay = moveDate !== selected.date;

      await loadDayAppointments(selected.date);
      if (movedToAnotherDay) await loadCalendar(masterProfileId, year, month);

      setOpenAppt(null);
      setMoveTime('');
      setMoveDate('');

      showSuccess(
        movedToAnotherDay
          ? t('daySlots.movedTo', {
              date: new Date(moveDate).toLocaleDateString(dateLocale, { day: 'numeric', month: 'long' }),
              time: moveTime,
            })
          : t('daySlots.moved'),
      );
    } catch (err: any) {
      const raw = err?.response?.data?.message ?? '';
      if (typeof raw === 'string' && raw.includes('outside working hours')) {
        setErrorMsg(t('daySlots.outsideHours'));
      } else if (typeof raw === 'string' && (raw.includes('not working') || raw.includes('Master is not'))) {
        setErrorMsg(t('daySlots.notWorkingDay'));
      } else if (typeof raw === 'string' && (raw.includes('overlap') || raw.includes('busy') || raw.includes('conflict'))) {
        setErrorMsg(t('daySlots.timeTaken'));
      } else {
        setErrorMsg(t('daySlots.moveError'));
      }
    } finally {
      setIsActing(false);
    }
  }

  function shiftMonth(delta: number) {
    let m = month + delta;
    let y = year;
    if (m < 1) { m = 12; y -= 1; }
    if (m > 12) { m = 1; y += 1; }
    setMonth(m);
    setYear(y);
    setSelected(null);
  }

  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString(dateLocale, { month: 'long', year: 'numeric' });
  const firstWeekday = (new Date(year, month - 1, 1).getDay() + 6) % 7;
  const workingCount = days.filter((d) => d.isWorkingDay).length;
  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <AppLayout>
      <main className="dashboard-page">
        <header className="dashboard-header">
          <div>
            <h1>{t('calendar.title')}</h1>
            <p className="dashboard-subtitle">{t('calendar.subtitle')}</p>
          </div>
          <div className="dashboard-period">
            <span>{t('calendar.workingThisMonth')}</span>
            <strong>{workingCount}</strong>
          </div>
        </header>

        {successMsg && (
          <div style={alertStyle('success')}><Check size={15} />{successMsg}</div>
        )}
        {errorMsg && (
          <div style={alertStyle('error')}><X size={15} />{errorMsg}</div>
        )}

        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <a href="#schedule-template" style={linkBtnStyle}>
            <Clock size={14} /> {t('calendar.weeklyTemplate')}
          </a>
        </div>

        <section className="dashboard-panel">
          <div className="panel-heading">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button type="button" onClick={() => shiftMonth(-1)} style={navBtnStyle}><ChevronLeft size={18} /></button>
              <h2 style={{ margin: 0, textTransform: 'capitalize', minWidth: 'clamp(120px, 40vw, 190px)', textAlign: 'center', fontSize: 'clamp(15px, 4vw, 20px)' }}>{monthLabel}</h2>
              <button type="button" onClick={() => shiftMonth(1)} style={navBtnStyle}><ChevronRight size={18} /></button>
            </div>
            <CalendarDays size={22} />
          </div>

          {isLoading ? (
            <p className="dashboard-status">{t('calendar.loading')}</p>
          ) : (
            <div style={{ padding: '8px 16px 20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 'clamp(3px, 1vw, 8px)', marginBottom: 10 }}>
                {['mon','tue','wed','thu','fri','sat','sun'].map((d) => (
                  <div key={d} style={{ textAlign: 'center', color: 'var(--app-text-muted)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {t('calendar.short.' + d)}
                  </div>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 'clamp(3px, 1vw, 8px)' }}>
                {Array.from({ length: firstWeekday }).map((_, i) => <div key={'e' + i} />)}

                {days.map((day) => {
                  // Загруженность перекрывает обычный цвет рабочего дня:
                  // мастеру важнее видеть занятость, чем тип правила.
                  const base = STATUS_COLORS[day.status] ?? STATUS_COLORS.not_working;

                  const c =
                    day.isWorkingDay && day.loadStatus && day.loadStatus !== 'free'
                      ? LOAD_COLORS[day.loadStatus]
                      : base;
                  const dayNum = Number(day.date.slice(8, 10));
                  const isToday = day.date === todayStr;
                  const isSelected = selected?.date === day.date;
                  return (
                    <button
                      key={day.date}
                      type="button"
                      onClick={() => openDay(day)}
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        gap: 3, minHeight: 68, padding: '8px 4px', cursor: 'pointer',
                        border: `1px solid ${isSelected ? 'var(--app-accent)' : c.border}`,
                        borderRadius: 12, background: c.bg, color: c.color,
                        outline: isToday ? '2px solid rgba(255,255,255,0.25)' : 'none',
                        outlineOffset: -2,
                      }}
                    >
                      <strong style={{ fontSize: 15, color: 'var(--app-text)' }}>{dayNum}</strong>
                      {day.isWorkingDay && day.loadPercent != null && day.loadPercent > 0 && (
                        <span style={{ fontSize: 9, opacity: 0.75, marginTop: 1 }}>
                          {day.loadPercent}%
                        </span>
                      )}

                      {day.isWorkingDay && day.startTime ? (
                        <span style={{ fontSize: 'clamp(8px, 2.2vw, 10px)', lineHeight: 1.25, textAlign: 'center', overflowWrap: 'anywhere', hyphens: 'auto', maxWidth: '100%' }}>{trimTime(day.startTime)}–{trimTime(day.endTime)}</span>
                      ) : (
                        <span style={{ fontSize: 'clamp(8px, 2.2vw, 10px)', lineHeight: 1.25, textAlign: 'center', overflowWrap: 'anywhere', hyphens: 'auto', maxWidth: '100%' }}>{t('calendar.status.' + day.status)}</span>
                      )}
                      {day.ruleId && day.type !== 'regular' && (
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: c.color }} />
                      )}
                    </button>
                  );
                })}
              </div>

              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 16, fontSize: 12, color: 'var(--app-text-muted)' }}>
                {['working','day_off','vacation','not_working'].map((s) => (
                  <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 12, height: 12, borderRadius: 4, background: STATUS_COLORS[s].bg, border: `1px solid ${STATUS_COLORS[s].border}` }} />
                    {t('calendar.status.' + s)}
                  </span>
                ))}
              </div>

              <p style={{ marginTop: 14, fontSize: 12, color: '#6f6870' }}>{t('calendar.hint')}</p>
            </div>
          )}
        </section>

        {selected && (
          <section className="dashboard-panel" style={{ marginTop: 24 }}>
            <div className="panel-heading">
              <div>
                <p className="panel-kicker">{t('calendar.dayEditor').toUpperCase()}</p>
                <h2>{new Date(selected.date).toLocaleDateString(dateLocale, { weekday: 'long', day: 'numeric', month: 'long' })}</h2>
              </div>
              <button type="button" style={navBtnStyle} onClick={() => setSelected(null)}><X size={18} /></button>
            </div>

            <div style={{ padding: '4px 16px 20px' }}>
              <label style={labelStyle}>
                {t('calendar.dayType')}
                <select value={formType} onChange={(e) => setFormType(e.target.value)} style={selectStyle}>
                  <option value="exception">{t('calendar.types.exception')}</option>
                  <option value="day_off">{t('calendar.types.day_off')}</option>
                  <option value="vacation">{t('calendar.types.vacation')}</option>
                  <option value="sick_leave">{t('calendar.types.sick_leave')}</option>
                  <option value="blocked_time">{t('calendar.types.blocked_time')}</option>
                </select>
              </label>

              {(formType === 'vacation' || formType === 'sick_leave' || formType === 'blocked_time') && (
                <div style={{ margin: '14px 0' }}>
                  <label onClick={() => setFormRange(!formRange)} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', color: 'var(--app-text)', fontSize: 13 }}>
                    <span
                      style={{ display: 'inline-flex', width: 40, height: 22, borderRadius: 11, background: formRange ? 'var(--app-accent)' : 'var(--app-toggle-track)', position: 'relative', cursor: 'pointer', flexShrink: 0 }}
                    >
                      <span style={{ position: 'absolute', top: 3, left: formRange ? 21 : 3, width: 16, height: 16, borderRadius: '50%', background: 'var(--app-toggle-knob)', transition: 'left 0.2s' }} />
                    </span>
                    {t('calendar.severalDays')}
                  </label>

                  {formRange && (
                    <label style={{ ...labelStyle, marginTop: 12 }}>
                      {t('calendar.untilDate')}
                      <input
                        type="date"
                        value={formEndDate}
                        min={selected.date}
                        onChange={(e) => setFormEndDate(e.target.value)}
                        style={selectStyle}
                      />
                    </label>
                  )}
                </div>
              )}
              {(formType === 'regular' || formType === 'exception') && (
                <>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', color: 'var(--app-text)', fontSize: 13, margin: '14px 0' }}>
                    <span
                      onClick={() => setFormWorking(!formWorking)}
                      style={{ display: 'inline-flex', width: 40, height: 22, borderRadius: 11, background: formWorking ? 'var(--app-accent)' : 'var(--app-toggle-track)', position: 'relative', cursor: 'pointer', flexShrink: 0 }}
                    >
                      <span style={{ position: 'absolute', top: 3, left: formWorking ? 21 : 3, width: 16, height: 16, borderRadius: '50%', background: 'var(--app-toggle-knob)', transition: 'left 0.2s' }} />
                    </span>
                    {formWorking ? t('schedule.working') : t('schedule.dayOff')}
                  </label>

                  {formWorking && (
                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                      <label style={labelStyle}>
                        {t('calendar.workHours')}
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <input type="time" value={formStart} onChange={(e) => setFormStart(e.target.value)} style={timeStyle} />
                          <span style={{ color: 'var(--app-text-muted)' }}>—</span>
                          <input type="time" value={formEnd} onChange={(e) => setFormEnd(e.target.value)} style={timeStyle} />
                        </span>
                      </label>

                      <label style={labelStyle}>
                        {t('schedule.break')}
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <input type="time" value={formBreakStart} onChange={(e) => setFormBreakStart(e.target.value)} style={timeStyle} />
                          <span style={{ color: 'var(--app-text-muted)' }}>—</span>
                          <input type="time" value={formBreakEnd} onChange={(e) => setFormBreakEnd(e.target.value)} style={timeStyle} />
                        </span>
                      </label>
                    </div>
                  )}
                </>
              )}

              {selected.isWorkingDay && (
                <div style={{ marginTop: 22, paddingTop: 18, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                  <p style={{ color: 'var(--app-accent-strong)', fontSize: 12, fontWeight: 800, letterSpacing: '0.1em', marginBottom: 12 }}>
                    {t('daySlots.title').toUpperCase()}
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {buildSlots(selected).map((row) => {
                      if (row.kind === 'busy') {
                        const a = row.appointment as DayAppointment;
                        const who = a.isGuest ? (a.guestName || t('daySlots.guest')) : (a.clientName || t('appointments.client'));
                        const isOpen = openAppt === a.id;
                        return (
                          <div key={row.label}>
                            <button
                              type="button"
                              onClick={() => { setOpenAppt(isOpen ? null : a.id); setMoveTime(row.label); setMoveDate(selected.date); setErrorMsg(''); }}
                              style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '12px 14px', borderRadius: 12, border: `1px solid ${isOpen ? 'var(--app-accent)' : 'rgba(var(--app-accent-rgb), 0.3)'}`, background: 'rgba(var(--app-accent-rgb), 0.1)', cursor: 'pointer', textAlign: 'left' }}
                            >
                              <strong style={{ color: 'var(--app-accent-strong)', fontSize: 13, minWidth: 96 }}>{row.label}–{row.labelTo}</strong>
                              <User size={14} style={{ color: 'var(--app-accent-strong)' }} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <strong style={{ color: 'var(--app-text)', fontSize: 13 }}>{who}</strong>
                                {a.guestPhone && <span style={{ color: 'var(--app-text-muted)', fontSize: 12, marginLeft: 8 }}>{a.guestPhone}</span>}
                              </div>
                              <span style={{ color: 'var(--app-text-muted)', fontSize: 12 }}>{isOpen ? '▲' : '▼'}</span>
                            </button>

                            {isOpen && (
                              <div style={{ margin: '8px 0 4px', padding: '16px', borderRadius: 14, border: '1px solid rgba(var(--app-accent-rgb), 0.25)', background: 'rgba(var(--app-accent-rgb), 0.06)' }}>
                                <p style={{ color: 'var(--app-text-muted)', fontSize: 12, margin: '0 0 12px' }}>
                                  {t('daySlots.currentTime')}: <strong style={{ color: 'var(--app-accent-strong)' }}>{row.label}–{row.labelTo}</strong>
                                </p>

                                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                                  <label style={labelStyle}>
                                    {t('daySlots.newDate')}
                                    <input type="date" value={moveDate} onChange={(e) => setMoveDate(e.target.value)} style={timeStyle} />
                                  </label>

                                  <label style={labelStyle}>
                                    {t('daySlots.newTime')}
                                    <input type="time" step={900} value={moveTime} onChange={(e) => setMoveTime(e.target.value)} style={timeStyle} />
                                  </label>

                                  <button
                                    type="button"
                                    className="primary-action"
                                    onClick={() => void rescheduleAppointment(a)}
                                    disabled={isActing || (moveTime === row.label && moveDate === selected.date)}
                                  >
                                    <Clock size={14} /> {(moveTime === row.label && moveDate === selected.date) ? t('daySlots.changeTimeFirst') : t('daySlots.move')}
                                  </button>

                                  <button type="button" className="danger-action" onClick={() => void cancelAppointment(a.id)} disabled={isActing}>
                                    <X size={14} /> {t('daySlots.cancel')}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      }

                      if (row.kind === 'break') {
                        return (
                          <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 12, border: '1px dashed var(--app-toggle-track)', background: 'rgba(255,255,255,0.02)', color: '#6f6870' }}>
                            <strong style={{ fontSize: 13, minWidth: 96 }}>{row.label}–{row.labelTo}</strong>
                            <span style={{ fontSize: 12 }}>{t('schedule.break')}</span>
                          </div>
                        );
                      }

                      if (!canBookManually) {
                        return (
                          <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 12, border: '1px solid rgba(77,208,139,0.25)', background: 'rgba(77,208,139,0.08)', color: '#8ee5b5' }}>
                            <strong style={{ fontSize: 13, minWidth: 96, color: 'var(--app-text)' }}>{row.label}</strong>
                            <span style={{ fontSize: 12 }}>{t('daySlots.free')}</span>
                          </div>
                        );
                      }

                      return (
                        <div key={row.label}>
                          <button
                            type="button"
                            onClick={() => openSlotForm(row.label)}
                            style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '10px 14px', borderRadius: 12, border: '1px solid rgba(77,208,139,0.25)', background: slotForm === row.label ? 'rgba(var(--app-accent-rgb), 0.12)' : 'rgba(77,208,139,0.08)', color: '#8ee5b5', cursor: 'pointer', textAlign: 'left' }}
                          >
                            <strong style={{ fontSize: 13, minWidth: 96, color: 'var(--app-text)' }}>{row.label}</strong>
                            <Plus size={13} style={{ color: 'var(--app-accent-strong)' }} />
                            <span style={{ fontSize: 12 }}>{t('daySlots.free')}</span>
                          </button>

                          {slotForm === row.label && (
                            <div style={{ margin: '8px 0 4px', padding: '16px', borderRadius: 14, border: '1px solid rgba(var(--app-accent-rgb), 0.25)', background: 'rgba(var(--app-accent-rgb), 0.06)' }}>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
                                <label style={labelStyle}>
                                  {t('daySlots.service')}
                                  <select value={bookServiceId} onChange={(e) => setBookServiceId(e.target.value)} style={selectStyle}>
                                    {myServices.map((x) => (
                                      <option key={x.id} value={x.id}>
                                        {x.customTitle ?? t('services.service')} · {x.durationMinutes} {t('services.min')} · {x.price} MDL
                                      </option>
                                    ))}
                                  </select>
                                </label>

                                <label style={labelStyle}>
                                  {t('daySlots.clientName')}
                                  <input value={bookGuestName} onChange={(e) => setBookGuestName(e.target.value)} placeholder={t('daySlots.namePlaceholder')} style={timeStyle} />
                                </label>

                                <label style={labelStyle}>
                                  {t('daySlots.phone')}
                                  <input value={bookGuestPhone} onChange={(e) => setBookGuestPhone(e.target.value)} placeholder="+373..." style={timeStyle} />
                                </label>

                                <label style={labelStyle}>
                                  {t('daySlots.note')}
                                  <input value={bookNote} onChange={(e) => setBookNote(e.target.value)} style={timeStyle} />
                                </label>
                              </div>

                              <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
                                <button type="button" className="primary-action" onClick={() => void createBooking()} disabled={isBooking}>
                                  <Check size={14} /> {isBooking ? t('common.saving') : t('daySlots.book')}
                                </button>
                                <button type="button" className="danger-action" onClick={() => setSlotForm(null)}>
                                  {t('common.cancel')}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {buildSlots(selected).length === 0 && (
                    <p style={{ color: '#6f6870', fontSize: 13 }}>{t('daySlots.noHours')}</p>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
                <button type="button" className="primary-action" onClick={() => void saveDay()} disabled={isSaving}>
                  <Save size={15} /> {isSaving ? t('common.saving') : t('common.save')}
                </button>
                {selected.ruleId && (
                  <button type="button" className="danger-action" onClick={() => void resetDay()} disabled={isSaving}>
                    <Trash2 size={14} /> {t('calendar.resetDay')}
                  </button>
                )}
              </div>
            </div>
          </section>
        )}
      </main>
    </AppLayout>
  );
}

function alertStyle(type: 'success' | 'error'): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '11px 15px', borderRadius: 13, marginBottom: 16,
    fontSize: 13, fontWeight: 700,
    border: `1px solid ${type === 'success' ? 'rgba(77,208,139,0.25)' : 'rgba(255,96,128,0.25)'}`,
    background: type === 'success' ? 'rgba(77,208,139,0.1)' : 'rgba(255,96,128,0.1)',
    color: type === 'success' ? '#9ae9bd' : 'var(--app-accent-strong)',
  };
}

const navBtnStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  width: 36, height: 36, border: '1px solid var(--app-toggle-track)',
  borderRadius: 10, background: 'rgba(255,255,255,0.05)',
  color: 'var(--app-text)', cursor: 'pointer',
};

const linkBtnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 7,
  minHeight: 40, padding: '0 14px',
  border: '1px solid var(--app-toggle-track)', borderRadius: 12,
  background: 'rgba(255,255,255,0.05)', color: 'var(--app-text)',
  fontSize: 13, fontWeight: 700, textDecoration: 'none',
};

const labelStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 7,
  color: 'var(--app-text-muted)', fontSize: 13,
};

const selectStyle: React.CSSProperties = {
  padding: '11px 13px', border: '1px solid var(--app-toggle-track)',
  borderRadius: 13, background: 'rgba(255,255,255,0.06)',
  color: 'var(--app-text)', fontSize: 14, minWidth: 220,
};

const timeStyle: React.CSSProperties = {
  padding: '9px 12px', border: '1px solid var(--app-toggle-track)',
  borderRadius: 11, background: 'rgba(255,255,255,0.06)',
  color: 'var(--app-text)', fontSize: 13,
};

export default MasterCalendarPage;
