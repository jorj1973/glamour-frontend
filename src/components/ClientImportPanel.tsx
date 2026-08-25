import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, FileUp, Trash2, TriangleAlert, Users } from 'lucide-react';

import api from '../api/api';

type ParsedRow = {
    rowNumber: number;
    firstName: string;
    lastName: string | null;
    phone: string | null;
    email: string | null;
};

type RejectedRow = {
    rowNumber: number;
    reason: string;
    raw: string;
};

type ParseResult = {
    rows: ParsedRow[];
    rejected: RejectedRow[];
    duplicatesInFile: number;
};

type ImportedClient = {
    id: string;
    firstName: string;
    lastName: string | null;
    phone: string | null;
    email: string | null;
    invitesSent: number;
};

type Props = {
    salonId: string;
};

function ClientImportPanel({ salonId }: Props) {
    const { t } = useTranslation();

    const fileRef = useRef<HTMLInputElement>(null);

    const [preview, setPreview] = useState<ParseResult | null>(null);
    const [pending, setPending] = useState<ImportedClient[]>([]);
    const [isBusy, setIsBusy] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [doneMsg, setDoneMsg] = useState('');
    const [isOpen, setIsOpen] = useState(false);

    async function loadPending() {
        try {
            const res = await api.get<ImportedClient[]>('/client-import', {
                params: { salonId },
            });

            setPending(res.data);
        } catch {
            setPending([]);
        }
    }

    useEffect(() => {
        void loadPending();
    }, [salonId]);

    /**
     * Разбирает файл, ничего не сохраняя: салон сначала видит,
     * что получилось, и только потом решает.
     */
    async function handleFile(file: File) {
        setIsBusy(true);
        setErrorMsg('');
        setDoneMsg('');
        setPreview(null);

        try {
            const form = new FormData();

            form.append('file', file);

            const res = await api.post<ParseResult>(
                '/client-import/preview',
                form,
            );

            setPreview(res.data);
        } catch {
            setErrorMsg(t('clientImport.parseError'));
        } finally {
            setIsBusy(false);
        }
    }

    async function confirmImport() {
        if (!preview || preview.rows.length === 0) {
            return;
        }

        setIsBusy(true);
        setErrorMsg('');

        try {
            const res = await api.post<{ added: number; skipped: number }>(
                '/client-import/confirm',
                { rows: preview.rows },
                { params: { salonId } },
            );

            setDoneMsg(
                t('clientImport.done', {
                    added: res.data.added,
                    skipped: res.data.skipped,
                }),
            );

            setPreview(null);

            await loadPending();
        } catch {
            setErrorMsg(t('clientImport.saveError'));
        } finally {
            setIsBusy(false);
        }
    }

    async function removeOne(id: string) {
        try {
            await api.delete('/client-import/' + id);

            setPending((prev) => prev.filter((item) => item.id !== id));
        } catch {
            setErrorMsg(t('clientImport.deleteError'));
        }
    }

    const boxStyle = {
        padding: 20,
        borderRadius: 18,
        border: '1px solid var(--app-border)',
        background: 'var(--app-panel)',
        marginBottom: 20,
    };

    if (!isOpen) {
        return (
            <section style={boxStyle}>
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 14,
                        flexWrap: 'wrap',
                    }}
                >
                    <div style={{ flex: 1, minWidth: 220 }}>
                        <p
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                margin: 0,
                                color: 'var(--app-text)',
                                fontSize: 15,
                                fontWeight: 700,
                            }}
                        >
                            <Users size={17} color="var(--app-accent)" />
                            {t('clientImport.title')}
                        </p>

                        <p
                            style={{
                                margin: '6px 0 0',
                                color: 'var(--app-text-muted)',
                                fontSize: 13,
                                lineHeight: 1.55,
                            }}
                        >
                            {pending.length > 0
                                ? t('clientImport.pendingCount', {
                                      count: pending.length,
                                  })
                                : t('clientImport.subtitle')}
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={() => setIsOpen(true)}
                        style={{
                            minHeight: 44,
                            padding: '0 22px',
                            borderRadius: 13,
                            border: '1px solid var(--app-accent)',
                            background: 'transparent',
                            color: 'var(--app-accent)',
                            fontSize: 14,
                            fontWeight: 700,
                            cursor: 'pointer',
                        }}
                    >
                        {t('clientImport.open')}
                    </button>
                </div>
            </section>
        );
    }

    return (
        <section style={boxStyle}>
            <div
                style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    justifyContent: 'space-between',
                    gap: 12,
                    marginBottom: 14,
                }}
            >
                <p
                    style={{
                        margin: 0,
                        color: 'var(--app-text)',
                        fontSize: 15,
                        fontWeight: 700,
                    }}
                >
                    {t('clientImport.title')}
                </p>

                <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    style={{
                        border: 0,
                        background: 'transparent',
                        color: 'var(--app-text-muted)',
                        fontSize: 13,
                        cursor: 'pointer',
                    }}
                >
                    {t('clientImport.collapse')}
                </button>
            </div>

            <p
                style={{
                    margin: '0 0 16px',
                    color: 'var(--app-text-muted)',
                    fontSize: 13,
                    lineHeight: 1.6,
                }}
            >
                {t('clientImport.hint')}
            </p>

            {errorMsg && (
                <div
                    style={{
                        padding: '11px 15px',
                        borderRadius: 13,
                        marginBottom: 14,
                        border: '1px solid rgba(255, 96, 128, 0.3)',
                        background: 'rgba(255, 96, 128, 0.1)',
                        color: '#c2415e',
                        fontSize: 13,
                        fontWeight: 700,
                    }}
                >
                    {errorMsg}
                </div>
            )}

            {doneMsg && (
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '11px 15px',
                        borderRadius: 13,
                        marginBottom: 14,
                        border: '1px solid rgba(77, 208, 139, 0.3)',
                        background: 'rgba(77, 208, 139, 0.1)',
                        color: '#3f9c6b',
                        fontSize: 13,
                        fontWeight: 700,
                    }}
                >
                    <CheckCircle2 size={15} />
                    {doneMsg}
                </div>
            )}

            {!preview && (
                <>
                    <button
                        type="button"
                        onClick={() => fileRef.current?.click()}
                        disabled={isBusy}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 9,
                            minHeight: 46,
                            padding: '0 24px',
                            borderRadius: 13,
                            border: 0,
                            background: 'var(--app-accent)',
                            color: 'var(--app-bg)',
                            fontSize: 14,
                            fontWeight: 800,
                            cursor: isBusy ? 'default' : 'pointer',
                            opacity: isBusy ? 0.6 : 1,
                        }}
                    >
                        <FileUp size={17} />
                        {isBusy
                            ? t('common.loading')
                            : t('clientImport.chooseFile')}
                    </button>

                    <input
                        ref={fileRef}
                        type="file"
                        accept=".csv,.txt,text/csv,text/plain"
                        onChange={(e) => {
                            const file = e.target.files?.[0];

                            if (file) {
                                void handleFile(file);
                            }

                            e.target.value = '';
                        }}
                        style={{ display: 'none' }}
                    />
                </>
            )}

            {preview && (
                <div>
                    <p
                        style={{
                            margin: '0 0 12px',
                            color: 'var(--app-text)',
                            fontSize: 14,
                            fontWeight: 700,
                        }}
                    >
                        {t('clientImport.found', {
                            count: preview.rows.length,
                        })}
                    </p>

                    {(preview.rejected.length > 0 ||
                        preview.duplicatesInFile > 0) && (
                        <p
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 7,
                                margin: '0 0 12px',
                                color: '#b8801f',
                                fontSize: 13,
                            }}
                        >
                            <TriangleAlert size={14} />
                            {t('clientImport.skipped', {
                                rejected: preview.rejected.length,
                                duplicates: preview.duplicatesInFile,
                            })}
                        </p>
                    )}

                    {/* Первые пять строк: салон сверяет, что столбцы
                        распознались верно, и не грузит вслепую. */}
                    <div
                        style={{
                            marginBottom: 16,
                            borderRadius: 13,
                            border: '1px solid var(--app-border)',
                            overflow: 'hidden',
                        }}
                    >
                        {preview.rows.slice(0, 5).map((row) => (
                            <div
                                key={row.rowNumber}
                                style={{
                                    display: 'flex',
                                    gap: 14,
                                    padding: '10px 14px',
                                    borderBottom:
                                        '1px solid var(--app-border)',
                                    fontSize: 13,
                                    flexWrap: 'wrap',
                                }}
                            >
                                <strong
                                    style={{
                                        color: 'var(--app-text)',
                                        minWidth: 120,
                                    }}
                                >
                                    {row.firstName} {row.lastName ?? ''}
                                </strong>

                                <span style={{ color: 'var(--app-text-muted)' }}>
                                    {row.phone ?? '—'}
                                </span>

                                <span style={{ color: 'var(--app-text-muted)' }}>
                                    {row.email ?? '—'}
                                </span>
                            </div>
                        ))}
                    </div>

                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button
                            type="button"
                            onClick={() => void confirmImport()}
                            disabled={isBusy}
                            style={{
                                minHeight: 46,
                                padding: '0 26px',
                                borderRadius: 13,
                                border: 0,
                                background: 'var(--app-accent)',
                                color: 'var(--app-bg)',
                                fontSize: 14,
                                fontWeight: 800,
                                cursor: 'pointer',
                            }}
                        >
                            {t('clientImport.confirm')}
                        </button>

                        <button
                            type="button"
                            onClick={() => setPreview(null)}
                            style={{
                                minHeight: 46,
                                padding: '0 22px',
                                borderRadius: 13,
                                border: '1px solid var(--app-border)',
                                background: 'transparent',
                                color: 'var(--app-text-muted)',
                                fontSize: 14,
                                fontWeight: 700,
                                cursor: 'pointer',
                            }}
                        >
                            {t('clientImport.cancel')}
                        </button>
                    </div>
                </div>
            )}

            {pending.length > 0 && !preview && (
                <div style={{ marginTop: 22 }}>
                    <p
                        style={{
                            margin: '0 0 10px',
                            color: 'var(--app-text-muted)',
                            fontSize: 12,
                            fontWeight: 800,
                            letterSpacing: '0.12em',
                            textTransform: 'uppercase',
                        }}
                    >
                        {t('clientImport.pendingTitle')}
                    </p>

                    <div style={{ display: 'grid', gap: 7 }}>
                        {pending.slice(0, 20).map((item) => (
                            <div
                                key={item.id}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 12,
                                    padding: '10px 14px',
                                    borderRadius: 12,
                                    border: '1px solid var(--app-border)',
                                    fontSize: 13,
                                }}
                            >
                                <strong
                                    style={{
                                        flex: 1,
                                        minWidth: 0,
                                        color: 'var(--app-text)',
                                    }}
                                >
                                    {item.firstName} {item.lastName ?? ''}
                                </strong>

                                <span style={{ color: 'var(--app-text-muted)' }}>
                                    {item.phone ?? item.email ?? '—'}
                                </span>

                                <button
                                    type="button"
                                    onClick={() => void removeOne(item.id)}
                                    aria-label={t('clientImport.remove')}
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        width: 32,
                                        height: 32,
                                        border: 0,
                                        borderRadius: 9,
                                        background: 'transparent',
                                        color: 'var(--app-text-muted)',
                                        cursor: 'pointer',
                                    }}
                                >
                                    <Trash2 size={15} />
                                </button>
                            </div>
                        ))}
                    </div>

                    {pending.length > 20 && (
                        <p
                            style={{
                                margin: '10px 0 0',
                                color: 'var(--app-text-muted)',
                                fontSize: 12,
                            }}
                        >
                            {t('clientImport.andMore', {
                                count: pending.length - 20,
                            })}
                        </p>
                    )}
                </div>
            )}
        </section>
    );
}

export default ClientImportPanel;
