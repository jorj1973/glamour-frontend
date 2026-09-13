import { useEffect, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Download,
  Percent,
  RefreshCw,
  Users,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import api from '../api/api';
import AppLayout from '../components/AppLayout';
import StatementTable from '../components/StatementTable';
import { downloadStatement, mondayOf, shiftWeek } from '../api/payouts';
import type { MasterStatement } from '../api/payouts';

type SalonSummary = { id: string; name: string };

type PercentRow = {
  masterProfileId: string;
  masterName: string;
  cooperationType: 'staff' | 'independent' | null;
  percent: number | null;
};

type ServicePercentRow = {
  masterServiceId: string;
  title: string;
  percent: number | null;
};

type SalonStatementLine = {
  masterProfileId: string;
  masterName: string;
  totals: {
    count: number;
    amount: number;
    masterShare: number;
    salonShare: number;
    withoutPercent: number;
  };
};

type SalonStatement = {
  weekStart: string;
  weekEnd: string;
  lines: SalonStatementLine[];
  totals: SalonStatementLine['totals'];
};

const money = (value: number) => value.toFixed(2);

/**
 * Расчёт с мастерами — кабинет владельца.
 *
 * Здесь живут обе половины: процент, о котором договорились, и ведомость
 * за неделю по этому проценту. Одно без другого бессмысленно — число без
 * ведомости никто не проверит, ведомость без числа не посчитается.
 */
function PayoutsPage() {
  const { t } = useTranslation();

  const [salon, setSalon] = useState<SalonSummary | null>(null);
  const [weekStart, setWeekStart] = useState(mondayOf(new Date()));
  const [percents, setPercents] = useState<PercentRow[]>([]);
  const [statement, setStatement] = useState<SalonStatement | null>(null);
  const [openMaster, setOpenMaster] = useState<string | null>(null);
  const [masterStatement, setMasterStatement] =
    useState<MasterStatement | null>(null);
  const [services, setServices] = useState<ServicePercentRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);

  async function loadAll(salonId: string, week: string) {
    const [percentsResponse, statementResponse] = await Promise.all([
      api.get<PercentRow[]>('/payouts/percents', { params: { salonId } }),
      api.get<SalonStatement>('/payouts/week', {
        params: { salonId, weekStart: week },
      }),
    ]);

    setPercents(percentsResponse.data);
    setStatement(statementResponse.data);
  }

  async function load(week = weekStart) {
    setIsLoading(true);
    setMessage('');

    try {
      const current = salon ?? (await api.get<SalonSummary[]>('/salons/my')).data[0] ?? null;

      setSalon(current);

      if (!current) {
        setMessage(t('common.loadError'));

        return;
      }

      await loadAll(current.id, week);
    } catch {
      setMessage(t('common.loadError'));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function changeWeek(direction: -1 | 1) {
    const next = shiftWeek(weekStart, direction);

    setWeekStart(next);
    setOpenMaster(null);
    setMasterStatement(null);
    void load(next);
  }

  async function saveMasterPercent(row: PercentRow, raw: string) {
    if (!salon) {
      return;
    }

    const value = raw.trim() === '' ? null : Number(raw);

    if (value !== null && (!Number.isFinite(value) || value < 0 || value > 100)) {
      setMessage(t('payouts.percentRange'));

      return;
    }

    setSavingId(row.masterProfileId);
    setMessage('');

    try {
      await api.put('/payouts/percent/master', {
        salonId: salon.id,
        masterProfileId: row.masterProfileId,
        percent: value,
      });

      await loadAll(salon.id, weekStart);
    } catch {
      setMessage(t('payouts.saveError'));
    } finally {
      setSavingId(null);
    }
  }

  async function saveServicePercent(row: ServicePercentRow, raw: string) {
    if (!salon) {
      return;
    }

    const value = raw.trim() === '' ? null : Number(raw);

    if (value !== null && (!Number.isFinite(value) || value < 0 || value > 100)) {
      setMessage(t('payouts.percentRange'));

      return;
    }

    setSavingId(row.masterServiceId);

    try {
      await api.put('/payouts/percent/service', {
        salonId: salon.id,
        masterServiceId: row.masterServiceId,
        percent: value,
      });

      if (openMaster) {
        await openMasterDetails(openMaster, true);
      }
    } catch {
      setMessage(t('payouts.saveError'));
    } finally {
      setSavingId(null);
    }
  }

  async function openMasterDetails(masterProfileId: string, keepOpen = false) {
    if (!salon) {
      return;
    }

    if (!keepOpen && openMaster === masterProfileId) {
      setOpenMaster(null);
      setMasterStatement(null);

      return;
    }

    setOpenMaster(masterProfileId);

    try {
      const [statementResponse, servicesResponse] = await Promise.all([
        api.get<MasterStatement>('/payouts/week', {
          params: { salonId: salon.id, masterProfileId, weekStart },
        }),
        api.get<ServicePercentRow[]>('/payouts/percents/services', {
          params: { salonId: salon.id, masterProfileId },
        }),
      ]);

      setMasterStatement(statementResponse.data);
      setServices(servicesResponse.data);
    } catch {
      setMessage(t('common.loadError'));
    }
  }

  const percentByMaster = new Map(
    percents.map((row) => [row.masterProfileId, row]),
  );

  return (
    <AppLayout>
      <main className="dashboard-page">
        <header className="dashboard-header">
          <div>
            <h1>{t('payouts.title')}</h1>
            <p className="dashboard-subtitle">{t('payouts.subtitle')}</p>
          </div>
        </header>

        {message && (
          <div
            style={{
              padding: '11px 15px',
              borderRadius: 13,
              marginBottom: 16,
              fontSize: 13,
              fontWeight: 700,
              border: '1px solid rgba(255,96,128,0.25)',
              background: 'rgba(255,96,128,0.1)',
              color: 'var(--app-danger)',
            }}
          >
            {message}
          </div>
        )}

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexWrap: 'wrap',
            marginBottom: 16,
          }}
        >
          <button type="button" className="week-button" onClick={() => changeWeek(-1)}>
            ←
          </button>
          <strong style={{ color: 'var(--app-text)', fontSize: 14 }}>
            {statement ? `${statement.weekStart} — ${statement.weekEnd}` : '…'}
          </strong>
          <button type="button" className="week-button" onClick={() => changeWeek(1)}>
            →
          </button>

          <button
            type="button"
            className="week-button"
            onClick={() => void load()}
            disabled={isLoading}
          >
            <RefreshCw size={14} /> {t('masters.refresh')}
          </button>

          <button
            type="button"
            className="week-button"
            onClick={() =>
              salon && void downloadStatement(salon.id, weekStart, null)
            }
          >
            <Download size={14} /> {t('payouts.download')}
          </button>
        </div>

        <section className="dashboard-panel">
          <div className="panel-heading">
            <div>
              <p className="panel-kicker">{t('payouts.kicker')}</p>
              <h2>{t('payouts.weekTitle')}</h2>
            </div>
          </div>

          {isLoading && <p className="dashboard-status">{t('common.loading')}</p>}

          {!isLoading && percents.length === 0 && (
            <div className="empty-state">
              <Users size={26} />
              <p>{t('payouts.noMasters')}</p>
              <span>{t('payouts.noMastersHint')}</span>
            </div>
          )}

          {/* Салон, где все мастера независимые: экран не пустой, но и
              задавать нечего — объясняем, а не молчим. */}
          {!isLoading &&
            percents.length > 0 &&
            percents.every((row) => row.cooperationType !== 'staff') && (
              <p
                style={{
                  color: 'var(--app-text-muted)',
                  fontSize: 13,
                  margin: '0 0 14px',
                }}
              >
                {t('payouts.allIndependent')}
              </p>
            )}

          {!isLoading &&
            percents.map((row) => {
              const line = statement?.lines.find(
                (item) => item.masterProfileId === row.masterProfileId,
              );
              const isOpen = openMaster === row.masterProfileId;

              return (
                <div
                  key={row.masterProfileId}
                  style={{
                    padding: '14px 0',
                    borderBottom: '1px solid rgba(var(--app-ink-rgb),0.06)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      flexWrap: 'wrap',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => void openMasterDetails(row.masterProfileId)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        flex: 1,
                        minWidth: 180,
                        border: 0,
                        background: 'none',
                        color: 'var(--app-text)',
                        fontSize: 14,
                        fontWeight: 700,
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      {isOpen ? (
                        <ChevronDown size={16} />
                      ) : (
                        <ChevronRight size={16} />
                      )}
                      {row.masterName}
                    </button>

                    {row.cooperationType === 'staff' ? (
                      <label
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          color: 'var(--app-text-muted)',
                          fontSize: 12,
                        }}
                      >
                        <Percent size={14} />
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={0.5}
                          defaultValue={row.percent ?? ''}
                          placeholder={t('payouts.notAgreed')}
                          disabled={savingId === row.masterProfileId}
                          onBlur={(event) =>
                            void saveMasterPercent(
                              row,
                              event.currentTarget.value,
                            )
                          }
                          style={{
                            width: 90,
                            minHeight: 36,
                            padding: '0 10px',
                            border: '1px solid rgba(var(--app-ink-rgb),0.16)',
                            borderRadius: 10,
                            background: 'var(--app-surface)',
                            color: 'var(--app-text)',
                            fontSize: 13,
                          }}
                        />
                      </label>
                    ) : (
                      <span
                        title={t('payouts.independentHint')}
                        style={{
                          padding: '5px 10px',
                          borderRadius: 9,
                          background: 'rgba(var(--app-ink-rgb),0.06)',
                          color: 'var(--app-text-muted)',
                          fontSize: 12,
                          fontWeight: 700,
                        }}
                      >
                        {t('payouts.independent')}
                      </span>
                    )}

                    <div
                      style={{
                        minWidth: 190,
                        textAlign: 'right',
                        color: 'var(--app-text-muted)',
                        fontSize: 12,
                      }}
                    >
                      {line
                        ? `${t('payouts.toMaster')} ${money(line.totals.masterShare)} · ${t('payouts.toSalon')} ${money(line.totals.salonShare)}`
                        : t('payouts.noVisits')}
                    </div>
                  </div>

                  {isOpen && (
                    <div style={{ paddingTop: 14 }}>
                      <p
                        style={{
                          color: 'var(--app-text-muted)',
                          fontSize: 12,
                          margin: '0 0 8px',
                        }}
                      >
                        {t('payouts.serviceExceptions')}
                      </p>

                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: 8,
                          marginBottom: 16,
                        }}
                      >
                        {services.map((service) => (
                          <label
                            key={service.masterServiceId}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '6px 10px',
                              border:
                                '1px solid rgba(var(--app-ink-rgb),0.12)',
                              borderRadius: 10,
                              color: 'var(--app-text)',
                              fontSize: 12,
                            }}
                          >
                            {service.title}
                            <input
                              type="number"
                              min={0}
                              max={100}
                              step={0.5}
                              defaultValue={service.percent ?? ''}
                              placeholder={String(
                                percentByMaster.get(row.masterProfileId)
                                  ?.percent ?? '—',
                              )}
                              disabled={savingId === service.masterServiceId}
                              onBlur={(event) =>
                                void saveServicePercent(
                                  service,
                                  event.currentTarget.value,
                                )
                              }
                              style={{
                                width: 70,
                                minHeight: 30,
                                padding: '0 8px',
                                border:
                                  '1px solid rgba(var(--app-ink-rgb),0.16)',
                                borderRadius: 8,
                                background: 'var(--app-surface)',
                                color: 'var(--app-text)',
                                fontSize: 12,
                              }}
                            />
                          </label>
                        ))}
                      </div>

                      {masterStatement && (
                        <>
                          <StatementTable statement={masterStatement} />
                          <button
                            type="button"
                            className="week-button"
                            style={{ marginTop: 12 }}
                            onClick={() =>
                              salon &&
                              void downloadStatement(
                                salon.id,
                                weekStart,
                                row.masterProfileId,
                              )
                            }
                          >
                            <Download size={14} /> {t('payouts.downloadMaster')}
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

          {statement && statement.lines.length > 0 && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 8,
                paddingTop: 14,
                color: 'var(--app-text)',
                fontSize: 14,
                fontWeight: 700,
              }}
            >
              <span>{t('payouts.total')}</span>
              <span>
                {t('payouts.toMaster')} {money(statement.totals.masterShare)} ·{' '}
                {t('payouts.toSalon')} {money(statement.totals.salonShare)}
              </span>
            </div>
          )}

          {statement && statement.totals.withoutPercent > 0 && (
            <p
              style={{
                marginTop: 10,
                color: 'var(--app-danger)',
                fontSize: 12,
              }}
            >
              {t('payouts.withoutPercent', {
                count: statement.totals.withoutPercent,
              })}
            </p>
          )}
        </section>
      </main>

      <style>{`
        .week-button {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          min-height: 38px;
          padding: 0 13px;
          border: 1px solid rgba(var(--app-ink-rgb),0.12);
          border-radius: 11px;
          background: rgba(var(--app-ink-rgb),0.05);
          color: var(--app-text);
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
        }
      `}</style>
    </AppLayout>
  );
}

export default PayoutsPage;
