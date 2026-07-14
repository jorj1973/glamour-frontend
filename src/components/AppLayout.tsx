import { useCallback, useEffect, useState } from 'react';
import {
  BarChart3,
  CalendarDays,
  CreditCard,
  Palette,
  Scissors,
  Sparkles,
  Users,
} from 'lucide-react';

import api from '../api/api';

type AppLayoutProps = {
  children: React.ReactNode;
};

type SalonSummary = {
  id: string;
  name: string;
};

type SalonBranding = {
  displayName: string | null;
  logoUrl: string | null;
};

const BRANDING_UPDATED_EVENT = 'glamour-branding-updated';

function AppLayout({ children }: AppLayoutProps) {
  const [currentHash, setCurrentHash] = useState(window.location.hash);
  const [salonName, setSalonName] = useState('Salon Studio');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  const loadSalonBranding = useCallback(async () => {
    try {
      const salonsResponse =
        await api.get<SalonSummary[]>('/salons/my');

      const currentSalon = salonsResponse.data[0];

      if (!currentSalon) {
        setSalonName('Salon Studio');
        setLogoUrl(null);
        return;
      }

      const brandingResponse = await api.get<SalonBranding>(
        `/salons/${currentSalon.id}/branding`,
      );

      setSalonName(
        brandingResponse.data.displayName?.trim() ||
          currentSalon.name ||
          'Salon Studio',
      );

      setLogoUrl(brandingResponse.data.logoUrl);
    } catch {
      setSalonName('Salon Studio');
      setLogoUrl(null);
    }
  }, []);

  useEffect(() => {
    function handleHashChange() {
      setCurrentHash(window.location.hash);
    }

    function handleBrandingUpdated() {
      void loadSalonBranding();
    }

    window.addEventListener('hashchange', handleHashChange);
    window.addEventListener(
      BRANDING_UPDATED_EVENT,
      handleBrandingUpdated,
    );

    const initialLoadTimer = window.setTimeout(() => {
      void loadSalonBranding();
    }, 0);

    return () => {
      window.clearTimeout(initialLoadTimer);

      window.removeEventListener(
        'hashchange',
        handleHashChange,
      );
      window.removeEventListener(
        BRANDING_UPDATED_EVENT,
        handleBrandingUpdated,
      );
    };
  }, [loadSalonBranding]);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          {logoUrl ? (
            <img
              className="sidebar-brand-logo"
              src={logoUrl}
              alt={`Логотип ${salonName}`}
            />
          ) : (
            <span>GLAMOUR</span>
          )}

          <strong>{salonName}</strong>
        </div>

        <nav className="sidebar-nav">
          <a
            className={
              currentHash !== '#appointments' &&
              currentHash !== '#clients' &&
              currentHash !== '#masters' &&
              currentHash !== '#services' &&
              currentHash !== '#finance' &&
              currentHash !== '#branding'
                ? 'active'
                : ''
            }
            href="#"
          >
            <BarChart3 size={18} />
            Dashboard
          </a>

          <a
            className={
              currentHash === '#appointments' ? 'active' : ''
            }
            href="#appointments"
          >
            <CalendarDays size={18} />
            Записи
          </a>

          <a
            className={
              currentHash === '#clients' ? 'active' : ''
            }
            href="#clients"
          >
            <Users size={18} />
            Клиенты
          </a>

          <a
            className={
              currentHash === '#masters' ? 'active' : ''
            }
            href="#masters"
          >
            <Scissors size={18} />
            Мастера
          </a>

          <a
            className={
              currentHash === '#services' ? 'active' : ''
            }
            href="#services"
          >
            <Sparkles size={18} />
            Услуги
          </a>

          <a
            className={
              currentHash === '#finance' ? 'active' : ''
            }
            href="#finance"
          >
            <CreditCard size={18} />
            Финансы
          </a>

          <a
            className={
              currentHash === '#branding' ? 'active' : ''
            }
            href="#branding"
          >
            <Palette size={18} />
            Персонализация
          </a>
        </nav>
      </aside>

      <div className="app-content">{children}</div>
    </div>
  );
}

export default AppLayout;
