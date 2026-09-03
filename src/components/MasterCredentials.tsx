import { useEffect, useRef, useState } from 'react';
import { Award, FileText, Image as ImageIcon, Plus, Trash2, Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../api/api';
import ActionButton, { type ActionState } from './ActionButton';
import { getErrorKey } from '../api/errorMessage';

type Credential = {
  id: string;
  type: string;
  title: string;
  issuer: string | null;
  issuedYear: number | null;
  fileUrl: string | null;
  isPublic: boolean;
  isVerified: boolean;
};

type PortfolioItem = {
  id: string;
  imageUrl: string;
  caption: string | null;
};

const CURRENT_YEAR = new Date().getFullYear();

function MasterCredentials() {
  const { t } = useTranslation();

  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const [newTitle, setNewTitle] = useState('');
  const [newIssuer, setNewIssuer] = useState('');
  const [newYear, setNewYear] = useState('');
  const [addState, setAddState] = useState<ActionState>('idle');
  const [addHint, setAddHint] = useState('');
  const [photoState, setPhotoState] = useState<ActionState>('idle');
  const [photoHint, setPhotoHint] = useState('');

  const [uploadingId, setUploadingId] = useState<string | null>(null);

  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});
  const photoInput = useRef<HTMLInputElement | null>(null);

  useEffect(() => { void loadAll(); }, []);

  async function loadAll() {
    setIsLoading(true);
    try {
      const [credRes, portRes] = await Promise.all([
        api.get<Credential[]>('/master-portfolio/credentials'),
        api.get<PortfolioItem[]>('/master-portfolio/items'),
      ]);
      setCredentials(credRes.data);
      setPortfolio(portRes.data);
    } catch (error) {
      setErrorMsg(t(getErrorKey(error)));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleAddCredential() {
    if (!newTitle.trim()) return;
    setAddState('loading');
    setAddHint('');
    try {
      const year = newYear.trim() === '' ? undefined : Number(newYear);
      const res = await api.post<Credential>('/master-portfolio/credentials', {
        title: newTitle.trim(),
        issuer: newIssuer.trim() || null,
        ...(year && Number.isFinite(year) ? { issuedYear: year } : {}),
      });
      setCredentials((prev) => [...prev, res.data]);
      setNewTitle('');
      setNewIssuer('');
      setNewYear('');
      setAddState('success');
      setAddHint(t('success.added'));
      setTimeout(() => setAddState('idle'), 3000);
    } catch (error) {
      setAddState('error');
      setAddHint(t(getErrorKey(error)));
      setTimeout(() => setAddState('idle'), 6000);
    }
  }

  async function handleUploadFile(id: string, file: File) {
    setUploadingId(id);
    setErrorMsg('');
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await api.post<Credential>(
        `/master-portfolio/credentials/${id}/file`,
        form,
      );
      setCredentials((prev) => prev.map((c) => (c.id === id ? res.data : c)));
    } catch (error) {
      setErrorMsg(t(getErrorKey(error)));
    } finally {
      setUploadingId(null);
    }
  }

  async function handleTogglePublic(item: Credential) {
    try {
      const res = await api.patch<Credential>(
        `/master-portfolio/credentials/${item.id}`,
        { isPublic: !item.isPublic },
      );
      setCredentials((prev) => prev.map((c) => (c.id === item.id ? res.data : c)));
    } catch (error) {
      setErrorMsg(t(getErrorKey(error)));
    }
  }

  async function handleDeleteCredential(id: string) {
    if (!window.confirm(t('credentials.confirmDelete'))) return;
    try {
      await api.delete(`/master-portfolio/credentials/${id}`);
      setCredentials((prev) => prev.filter((c) => c.id !== id));
    } catch (error) {
      setErrorMsg(t(getErrorKey(error)));
    }
  }

  async function handleAddPhoto(file: File) {
    setPhotoState('loading');
    setPhotoHint('');
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await api.post<PortfolioItem>('/master-portfolio/items', form);
      setPortfolio((prev) => [res.data, ...prev]);
      setPhotoState('success');
      setPhotoHint(t('success.uploaded'));
      setTimeout(() => setPhotoState('idle'), 3000);
    } catch (error) {
      setPhotoState('error');
      setPhotoHint(t(getErrorKey(error)));
      setTimeout(() => setPhotoState('idle'), 6000);
    }
  }

  async function handleDeletePhoto(id: string) {
    if (!window.confirm(t('credentials.confirmDelete'))) return;
    try {
      await api.delete(`/master-portfolio/items/${id}`);
      setPortfolio((prev) => prev.filter((p) => p.id !== id));
    } catch (error) {
      setErrorMsg(t(getErrorKey(error)));
    }
  }

  const inputStyle = { padding: '10px 13px', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, background: 'rgba(255,255,255,0.06)', color: 'var(--app-text)', fontSize: 13, outline: 'none' };
  const smallButton = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, background: 'rgba(255,255,255,0.05)', color: 'var(--app-text)', fontSize: 12, fontWeight: 600, cursor: 'pointer' };

  if (isLoading) {
    return <p className="dashboard-status">{t('common.loading')}</p>;
  }

  return (
    <>
      {errorMsg && (
        <div style={{ padding: '11px 15px', borderRadius: 13, marginTop: 16, fontSize: 13, fontWeight: 700, border: '1px solid rgba(255,96,128,0.25)', background: 'rgba(255,96,128,0.1)', color: 'var(--app-danger)' }}>
          {errorMsg}
        </div>
      )}

      <article className="dashboard-panel" style={{ marginTop: 16 }}>
        <div className="panel-heading">
          <div>
            <p className="panel-kicker">{t('credentials.title').toUpperCase()}</p>
            <h2>{t('credentials.title')}</h2>
          </div>
          <Award size={22} />
        </div>
        <p style={{ color: 'var(--app-text-muted)', fontSize: 13, marginBottom: 14, lineHeight: 1.6 }}>
          {t('credentials.subtitle')}
        </p>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
          <input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder={t('credentials.titlePlaceholder')} maxLength={200} style={{ ...inputStyle, flex: '2 1 200px' }} />
          <input type="text" value={newIssuer} onChange={(e) => setNewIssuer(e.target.value)} placeholder={t('credentials.issuerPlaceholder')} maxLength={200} style={{ ...inputStyle, flex: '2 1 160px' }} />
          <input type="number" value={newYear} onChange={(e) => setNewYear(e.target.value)} placeholder={String(CURRENT_YEAR - 5)} min={1950} max={CURRENT_YEAR} style={{ ...inputStyle, flex: '0 1 100px' }} />
          <ActionButton
            state={addState}
            label={t('credentials.add')}
            loadingLabel={t('credentials.uploading')}
            successLabel={t('success.added')}
            errorLabel={t('credentials.add')}
            hint={addHint}
            icon={<Plus size={15} />}
            disabled={!newTitle.trim()}
            onClick={() => void handleAddCredential()}
          />
        </div>

        {credentials.length === 0 ? (
          <p style={{ color: '#6d656f', fontSize: 13 }}>{t('credentials.empty')}</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {credentials.map((item) => (
              <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '12px 14px', borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <FileText size={18} color={item.fileUrl ? '#9ae9bd' : '#6d656f'} />
                <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                  <p style={{ color: 'var(--app-text)', fontSize: 13, fontWeight: 700 }}>{item.title}</p>
                  <p style={{ color: 'var(--app-text-muted)', fontSize: 12 }}>
                    {[item.issuer, item.issuedYear].filter(Boolean).join(' · ') || t('credentials.noDetails')}
                  </p>
                </div>

                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--app-text)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={item.isPublic} onChange={() => void handleTogglePublic(item)} style={{ width: 16, height: 16, accentColor: 'var(--app-accent)', cursor: 'pointer' }} />
                  {t('credentials.showToClients')}
                </label>

                <input
                  ref={(el) => { fileInputs.current[item.id] = el; }}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,application/pdf"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleUploadFile(item.id, file);
                    e.target.value = '';
                  }}
                />
                <button type="button" onClick={() => fileInputs.current[item.id]?.click()} disabled={uploadingId === item.id} style={smallButton}>
                  <Upload size={14} />
                  {uploadingId === item.id ? t('credentials.uploading') : item.fileUrl ? t('credentials.replaceFile') : t('credentials.addFile')}
                </button>

                <button type="button" onClick={() => void handleDeleteCredential(item.id)} style={{ ...smallButton, color: 'var(--app-danger)', borderColor: 'rgba(255,96,128,0.2)' }}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </article>

      <article className="dashboard-panel" style={{ marginTop: 16 }}>
        <div className="panel-heading">
          <div>
            <p className="panel-kicker">{t('portfolio.title').toUpperCase()}</p>
            <h2>{t('portfolio.title')}</h2>
          </div>
          <ImageIcon size={22} />
        </div>
        <p style={{ color: 'var(--app-text-muted)', fontSize: 13, marginBottom: 14, lineHeight: 1.6 }}>
          {t('portfolio.subtitle')}
        </p>

        <input
          ref={photoInput}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleAddPhoto(file);
            e.target.value = '';
          }}
        />
        <div style={{ marginBottom: 16 }}>
          <ActionButton
            state={photoState}
            label={t('portfolio.addPhoto')}
            loadingLabel={t('credentials.uploading')}
            successLabel={t('success.uploaded')}
            errorLabel={t('portfolio.addPhoto')}
            hint={photoHint}
            icon={<Upload size={15} />}
            onClick={() => photoInput.current?.click()}
          />
        </div>

        {portfolio.length === 0 ? (
          <p style={{ color: '#6d656f', fontSize: 13 }}>{t('portfolio.empty')}</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
            {portfolio.map((item) => (
              <div key={item.id} style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
                <img src={item.imageUrl} alt={item.caption ?? ''} style={{ width: '100%', height: 140, objectFit: 'cover', display: 'block' }} />
                <button type="button" onClick={() => void handleDeletePhoto(item.id)} style={{ position: 'absolute', top: 6, right: 6, display: 'inline-flex', padding: 6, border: 0, borderRadius: 8, background: 'rgba(23,21,28,0.75)', color: 'var(--app-danger)', cursor: 'pointer' }}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </article>
    </>
  );
}

export default MasterCredentials;
