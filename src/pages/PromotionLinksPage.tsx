import { useEffect, useState } from 'react';
import {
  Check,
  ClipboardCopy,
  ExternalLink,
  Link2,
  Plus,
  QrCode,
  RefreshCw,
  Share2,
  Store,
  X,
} from 'lucide-react';
import api from '../api/api';
import AppLayout from '../components/AppLayout';

type WorkspaceMode = 'platform' | 'salon' | 'master';
type SalonSummary = { id: string; name: string; membershipRole?: string | null; membershipRoles?: string[]; membershipStatus?: string | null; };
type PromotionLink = { id: string; salonId: string; ownerType: string; targetType: string; code: string; customSlug: string | null; title: string; campaignName: string | null; trafficSource: string | null; isPrimary: boolean; isActive: boolean; expiresAt: string | null; createdAt: string; };

const WORKSPACE_MODE_KEY = 'glamour_workspace_mode';
const CURRENT_SALON_ID_KEY = 'glamour_current_salon_id';

function getWorkspaceMode(): WorkspaceMode {
  const mode = localStorage.getItem(WORKSPACE_MODE_KEY);
  if (mode === 'platform' || mode === 'salon' || mode === 'master') return mode;
  return 'salon';
}

function getLinkUrl(link: PromotionLink): string {
  const identifier = link.customSlug?.trim() || link.code?.trim() || '';
  return `${window.location.origin}/#master-register?identifier=${encodeURIComponent(identifier)}`;
}

const SOURCES = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'telegram', label: 'Telegram' },
  { value: 'google', label: 'Google' },
  { value: 'offline', label: 'Офлайн реклама' },
  { value: 'other', label: 'Другое' },
];

function PromotionLinksPage() {
  const workspaceMode = getWorkspaceMode();
  const isMasterWorkspace = workspaceMode === 'master';
  const [salon, setSalon] = useState<SalonSummary | null>(null);
  const [links, setLinks] = useState<PromotionLink[]>([]);
  const [message, setMessage] = useState('Загрузка ссылок...');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formCampaign, setFormCampaign] = useState('');
  const [formSource, setFormSource] = useState('instagram');

  async function loadSalon(): Promise<SalonSummary | null> {
    const res = await api.get<SalonSummary[]>('/salons/my');
    if (res.data.length === 0) return null;
    if (!isMasterWorkspace) return res.data[0] ?? null;
    const masterSalons = res.data.filter((s) => s.membershipStatus === 'active' && (s.membershipRoles?.includes('master') || s.membershipRole === 'master'));
    if (masterSalons.length === 0) return null;
    const savedId = localStorage.getItem(CURRENT_SALON_ID_KEY);
    const found = savedId ? masterSalons.find((s) => s.id === savedId) : undefined;
    return found ?? masterSalons[0];
  }

  async function loadLinks(salonId: string) {
    setIsLoading(true);
    try {
      const res = await api.get<PromotionLink[]>(`/promotion-links/salon/${salonId}`);
      setLinks(res.data);
      setMessage('');
    } catch {
      setMessage('Не удалось загрузить ссылки.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        const s = await loadSalon();
        if (cancelled) return;
        setSalon(s);
        if (!s) { setMessage('Салон не найден.'); return; }
        await loadLinks(s.id);
      } catch {
        if (!cancelled) setMessage('Не удалось загрузить данные.');
      }
    }
    void init();
    return () => { cancelled = true; };
  }, [isMasterWorkspace]);

  async function copyLink(link: PromotionLink) {
    const url = getLinkUrl(link);
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(url);
      } else {
        const ta = document.createElement('textarea');
        ta.value = url; ta.style.cssText = 'position:fixed;opacity:0';
        document.body.appendChild(ta); ta.select();
        document.execCommand('copy'); document.body.removeChild(ta);
      }
      setCopiedId(link.id);
      setTimeout(() => setCopiedId(null), 2500);
    } catch { /* ignore */ }
  }

  function shareVia(platform: string, link: PromotionLink) {
    const url = getLinkUrl(link);
    const text = encodeURIComponent('Запишитесь онлайн: ' + url);
    const urls: Record<string, string> = {
      whatsapp: `https://wa.me/?text=${text}`,
      telegram: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent('Запишитесь онлайн!')}`,
    };
    if (urls[platform]) window.open(urls[platform], '_blank');
  }

  async function handleCreateLink(e: React.FormEvent) {
    e.preventDefault();
    if (!salon || !formTitle.trim()) { setErrorMsg('Введите название ссылки.'); return; }
    if (formSlug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(formSlug)) {
      setErrorMsg('Slug: только строчные латинские буквы, цифры и дефисы.');
      return;
    }
    setIsSubmitting(true);
    setErrorMsg('');
    try {
      await api.post('/promotion-links', {
        salonId: salon.id,
        ownerType: 'salon',
        targetType: 'salon',
        targetId: salon.id,
        title: formTitle.trim(),
        customSlug: formSlug.trim() || undefined,
        campaignName: formCampaign.trim() || undefined,
        trafficSource: formSource || undefined,
        isActive: true,
      });
      await loadLinks(salon.id);
      setShowForm(false);
      setFormTitle(''); setFormSlug(''); setFormCampaign(''); setFormSource('instagram');
      setSuccessMsg('Ссылка создана!');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? '';
      if (msg.includes('slug')) setErrorMsg('Этот slug уже занят.');
      else setErrorMsg('Не удалось создать ссылку.');
    } finally {
      setIsSubmitting(false);
    }
  }

  const clientLinks = links.filter((l) => l.ownerType === 'salon' && l.targetType === 'salon');
  const registrationLinks = links.filter((l) => l.targetType === 'master_registration');
  const masterLinks = links.filter((l) => l.ownerType === 'master');

  return (
    <AppLayout>
      <main className="dashboard-page">
        <header className="dashboard-header">
          <div>
            <p className="dashboard-eyebrow">ПРОДВИЖЕНИЕ</p>
            <h1>Ссылки для соцсетей</h1>
            <p className="dashboard-subtitle">
              Создавайте персональные ссылки для Instagram, TikTok, WhatsApp и других каналов.
              Каждая ссылка отслеживает откуда пришли клиенты.
            </p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" style={{ display: "inline-flex", alignItems: "center", gap: 7, minHeight: 46, padding: "0 18px", border: 0, borderRadius: 14, background: "#d682b8", color: "#17151c", fontSize: 13, fontWeight: 700, cursor: "pointer" }} onClick={() => setShowForm(!showForm)}>
              <Plus size={17} /> Новая ссылка
            </button>
            <button type="button" style={{ display: "inline-flex", alignItems: "center", gap: 7, minHeight: 46, padding: "0 14px", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14, background: "rgba(255,255,255,0.05)", color: "#d7ced8", fontSize: 13, fontWeight: 700, cursor: "pointer" }} onClick={() => salon && loadLinks(salon.id)} disabled={isLoading}>
              <RefreshCw size={15} style={isLoading ? { animation: "spin 1s linear infinite" } : {}} /> Обновить
            </button>
          </div>
        </header>

        {successMsg && <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 15px", borderRadius: 13, marginBottom: 16, fontSize: 13, fontWeight: 700, border: "1px solid rgba(77,208,139,0.25)", background: "rgba(77,208,139,0.1)", color: "#9ae9bd" }}><Check size={15} />{successMsg}</div>}
        {errorMsg && <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 15px", borderRadius: 13, marginBottom: 16, fontSize: 13, fontWeight: 700, border: "1px solid rgba(255,96,128,0.25)", background: "rgba(255,96,128,0.1)", color: "#ffb6c6" }}><X size={15} />{errorMsg}</div>}

        {showForm && (
          <article className="dashboard-panel" style={{ marginBottom: 24 }}>
            <div className="panel-heading">
              <div><p className="panel-kicker">НОВАЯ ССЫЛКА</p><h2>Создать ссылку для продвижения</h2></div>
              <button type="button" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, background: "rgba(255,255,255,0.05)", color: "#b9b0bb", cursor: "pointer" }} onClick={() => setShowForm(false)}><X size={18} /></button>
            </div>
            <form className="service-form" onSubmit={handleCreateLink}>
              <label>Название ссылки *<input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder="Например: Instagram Лето 2026" required /></label>
              <div className="service-form-grid">
                <label>Slug (необязательно)<input value={formSlug} onChange={(e) => setFormSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} placeholder="salon-instagram" /></label>
                <label>Источник трафика
                  <select value={formSource} onChange={(e) => setFormSource(e.target.value)} style={{ padding: "11px 13px", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 13, background: "rgba(255,255,255,0.06)", color: "#fff7fc", fontSize: 14 }}>
                    {SOURCES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </label>
              </div>
              <label>Название кампании<input value={formCampaign} onChange={(e) => setFormCampaign(e.target.value)} placeholder="Летняя акция" /></label>
              <div style={{ display: "flex", gap: 10 }}>
                <button type="submit" className="primary-action" style={{ flex: 1 }} disabled={isSubmitting}>{isSubmitting ? "Создаём..." : "Создать ссылку"}</button>
                <button type="button" className="danger-action" onClick={() => setShowForm(false)}>Отмена</button>
              </div>
            </form>
          </article>
        )}

        {message && !links.length ? (
          <p className="dashboard-status">{message}</p>
        ) : (
          <>
            <section className="dashboard-panel" style={{ marginBottom: 24 }}>
              <div className="panel-heading">
                <div><p className="panel-kicker">ДЛЯ КЛИЕНТОВ</p><h2>{clientLinks.length} ссылок</h2></div>
                <Store size={22} />
              </div>
              {clientLinks.length === 0 ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "40px 20px", color: "#9d949f", textAlign: "center" }}>
                  <Link2 size={36} style={{ color: "#d682b8", opacity: 0.4 }} />
                  <p>Ссылок для салона пока нет.</p>
                  <button type="button" style={{ display: "inline-flex", alignItems: "center", gap: 7, minHeight: 40, padding: "0 16px", border: 0, borderRadius: 12, background: "#d682b8", color: "#17151c", fontSize: 13, fontWeight: 700, cursor: "pointer" }} onClick={() => setShowForm(true)}><Plus size={15} /> Создать первую ссылку</button>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {clientLinks.map((link) => (
                    <div key={link.id} style={{ padding: "16px 18px", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, background: link.isActive ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.01)", opacity: link.isActive ? 1 : 0.6 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                            <strong style={{ color: "#fff7fc", fontSize: 14 }}>{link.title}</strong>
                            {link.isPrimary && <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: "rgba(214,130,184,0.15)", color: "#efb6d8" }}>основная</span>}
                            {link.trafficSource && <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: 11, background: "rgba(255,255,255,0.08)", color: "#9d949f" }}>{link.trafficSource}</span>}
                            {!link.isActive && <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: 11, background: "rgba(255,96,128,0.12)", color: "#ffb6c6" }}>отключена</span>}
                          </div>
                          <div style={{ padding: "8px 12px", borderRadius: 10, background: "rgba(255,255,255,0.04)", fontFamily: "monospace", fontSize: 12, color: "#9d949f", wordBreak: "break-all" }}>
                            {getLinkUrl(link)}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                          <button type="button" onClick={() => copyLink(link)} style={{ display: "inline-flex", alignItems: "center", gap: 6, minHeight: 36, padding: "0 12px", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, background: copiedId === link.id ? "rgba(77,208,139,0.1)" : "rgba(255,255,255,0.05)", color: copiedId === link.id ? "#8ee5b5" : "#d7ced8", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                            {copiedId === link.id ? <Check size={14} /> : <ClipboardCopy size={14} />}
                            {copiedId === link.id ? "Скопировано" : "Копировать"}
                          </button>
                          <a href={getLinkUrl(link)} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, background: "rgba(255,255,255,0.05)", color: "#d7ced8", textDecoration: "none" }}><ExternalLink size={14} /></a>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                        <p style={{ color: "#9d949f", fontSize: 12, margin: 0, flex: 1 }}>Поделиться:</p>
                        <button type="button" onClick={() => shareVia('whatsapp', link)} style={{ display: "inline-flex", alignItems: "center", gap: 6, minHeight: 32, padding: "0 12px", border: "1px solid rgba(37,211,102,0.25)", borderRadius: 10, background: "rgba(37,211,102,0.08)", color: "#4de06e", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>WhatsApp</button>
                        <button type="button" onClick={() => shareVia('telegram', link)} style={{ display: "inline-flex", alignItems: "center", gap: 6, minHeight: 32, padding: "0 12px", border: "1px solid rgba(41,182,246,0.25)", borderRadius: 10, background: "rgba(41,182,246,0.08)", color: "#67c8f7", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Telegram</button>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 12px", border: "1px solid rgba(214,130,184,0.15)", borderRadius: 10, background: "rgba(214,130,184,0.06)", color: "#efb6d8", fontSize: 12 }}>
                          <QrCode size={13} /> QR: <a href="https://qrcode-monkey.com" target="_blank" rel="noopener noreferrer" style={{ color: "#efb6d8" }}>qrcode-monkey.com</a>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {registrationLinks.length > 0 && (
              <section className="dashboard-panel" style={{ marginBottom: 24 }}>
                <div className="panel-heading">
                  <div><p className="panel-kicker">РЕГИСТРАЦИЯ МАСТЕРОВ</p><h2>Ссылки для приглашения мастеров</h2></div>
                </div>
                <p style={{ color: "#9d949f", fontSize: 13, marginBottom: 12 }}>Отправьте эту ссылку новому мастеру — он зарегистрируется в вашем салоне самостоятельно.</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {registrationLinks.map((link) => (
                    <div key={link.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", border: "1px solid rgba(255,208,139,0.2)", borderRadius: 14, background: "rgba(255,208,139,0.04)" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <strong style={{ color: "#fff7fc", fontSize: 13 }}>{link.title}</strong>
                        <div style={{ color: "#9d949f", fontSize: 12, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{getLinkUrl(link)}</div>
                      </div>
                      <button type="button" onClick={() => copyLink(link)} style={{ display: "inline-flex", alignItems: "center", gap: 6, minHeight: 34, padding: "0 12px", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, background: "rgba(255,255,255,0.05)", color: "#d7ced8", fontSize: 12, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
                        {copiedId === link.id ? <Check size={13} /> : <ClipboardCopy size={13} />}
                        {copiedId === link.id ? "Скопировано" : "Копировать"}
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {masterLinks.length > 0 && (
              <section className="dashboard-panel">
                <div className="panel-heading">
                  <div><p className="panel-kicker">ССЫЛКИ МАСТЕРОВ</p><h2>{masterLinks.length} ссылок</h2></div>
                  <Share2 size={22} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {masterLinks.map((link) => (
                    <div key={link.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, background: "rgba(255,255,255,0.02)" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <strong style={{ color: "#fff7fc", fontSize: 13 }}>{link.title}</strong>
                        <div style={{ color: "#9d949f", fontSize: 12, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{getLinkUrl(link)}</div>
                      </div>
                      <button type="button" onClick={() => copyLink(link)} style={{ display: "inline-flex", alignItems: "center", gap: 6, minHeight: 34, padding: "0 12px", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, background: "rgba(255,255,255,0.05)", color: "#d7ced8", fontSize: 12, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
                        {copiedId === link.id ? <Check size={13} /> : <ClipboardCopy size={13} />}
                        {copiedId === link.id ? "Скопировано" : "Копировать"}
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>
      <style>{"@keyframes spin { to { transform: rotate(360deg); } }"}</style>
    </AppLayout>
  );
}

export default PromotionLinksPage;
