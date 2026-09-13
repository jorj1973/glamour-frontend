import { useEffect, useState } from 'react';
import { Download, RefreshCw, Wallet } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import api from '../api/api';
import AppLayout from '../components/AppLayout';
import StatementTable from '../components/StatementTable';
import { downloadStatement, mondayOf, shiftWeek } from '../api/payouts';
import type { MasterStatement } from '../api/payouts';

type SalonSummary = { id: string; name: string };
type MyProfile = { id: string };

type MyTerms = {
    cooperationType: 'staff' | 'independent' | null;
    percent: number | null;
    services: { masterServiceId: string; title: string; percent: number }[];
};

/**
 * Моя ведомость — кабинет мастера.
 *
 * Те же строки и те же суммы, что видит владелец. Мастер не обязан
 * верить салону на слово: в этом весь смысл — и, если владелец салона
 * прав насчёт своего рынка, ровно это и удерживает мастера.
 */
function MyPayoutPage() {
    const { t } = useTranslation();

    const [salon, setSalon] = useState<SalonSummary | null>(null);
    const [profileId, setProfileId] = useState<string | null>(null);
    const [weekStart, setWeekStart] = useState(mondayOf(new Date()));
    const [statement, setStatement] = useState<MasterStatement | null>(null);
    const [terms, setTerms] = useState<MyTerms | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [message, setMessage] = useState('');

    async function load(week = weekStart) {
        setIsLoading(true);
        setMessage('');

        try {
            const [salonsResponse, profileResponse] = await Promise.all([
                api.get<SalonSummary[]>('/salons/my'),
                api.get<MyProfile>('/masters/me'),
            ]);

            const current = salonsResponse.data[0] ?? null;

            setSalon(current);
            setProfileId(profileResponse.data?.id ?? null);

            if (!current || !profileResponse.data?.id) {
                setMessage(t('payouts.noSalon'));

                return;
            }

            const [response, termsResponse] = await Promise.all([
                api.get<MasterStatement>('/payouts/week', {
                    params: {
                        salonId: current.id,
                        masterProfileId: profileResponse.data.id,
                        weekStart: week,
                    },
                }),
                api.get<MyTerms>('/payouts/my-terms', {
                    params: { salonId: current.id },
                }),
            ]);

            setStatement(response.data);
            setTerms(termsResponse.data);
        } catch {
            setMessage(t('payouts.noAccess'));
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
        void load(next);
    }

    return (
        <AppLayout>
            <main className="dashboard-page">
                <header className="dashboard-header">
                    <div>
                        <h1>{t('payouts.myTitle')}</h1>
                        <p className="dashboard-subtitle">
                            {t('payouts.mySubtitle')}
                        </p>
                    </div>
                </header>

                {/* Мастер обязан знать, на чём он работает, не спрашивая
                    владельца. Это первое, что он видит на странице. */}
                {terms && (
                    <div
                        style={{
                            padding: '13px 16px',
                            borderRadius: 14,
                            marginBottom: 16,
                            border: '1px solid rgba(var(--app-ink-rgb),0.1)',
                            background: 'rgba(var(--app-ink-rgb),0.04)',
                            color: 'var(--app-text)',
                            fontSize: 13,
                        }}
                    >
                        <strong>
                            {terms.cooperationType === 'independent'
                                ? t('payouts.termsIndependent')
                                : terms.percent === null
                                  ? t('payouts.termsNotSet')
                                  : t('payouts.termsStaff', {
                                        percent: terms.percent,
                                    })}
                        </strong>

                        {terms.services.length > 0 && (
                            <div
                                style={{
                                    marginTop: 6,
                                    color: 'var(--app-text-muted)',
                                    fontSize: 12,
                                }}
                            >
                                {t('payouts.termsExceptions')}:{' '}
                                {terms.services
                                    .map(
                                        (service) =>
                                            `${service.title} — ${service.percent}%`,
                                    )
                                    .join(', ')}
                            </div>
                        )}
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
                    <button
                        type="button"
                        className="week-button"
                        onClick={() => changeWeek(-1)}
                    >
                        ←
                    </button>
                    <strong style={{ color: 'var(--app-text)', fontSize: 14 }}>
                        {statement
                            ? `${statement.weekStart} — ${statement.weekEnd}`
                            : '…'}
                    </strong>
                    <button
                        type="button"
                        className="week-button"
                        onClick={() => changeWeek(1)}
                    >
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
                            salon &&
                            profileId &&
                            void downloadStatement(salon.id, weekStart, profileId)
                        }
                        disabled={!statement}
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

                    {isLoading && (
                        <p className="dashboard-status">{t('common.loading')}</p>
                    )}

                    {!isLoading && message && (
                        <div className="empty-state">
                            <Wallet size={26} />
                            <p>{message}</p>
                            <span>{t('payouts.noAccessHint')}</span>
                        </div>
                    )}

                    {!isLoading && !message && statement && (
                        <StatementTable statement={statement} />
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

export default MyPayoutPage;
