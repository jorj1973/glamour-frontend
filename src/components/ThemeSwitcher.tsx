import { useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { applyTheme, getStoredTheme, type ThemeMode } from '../theme';

/**
 * Переключатель темы: два значка рядом, как у языков.
 *
 * Личная настройка каждого — один работает при свете, другой
 * вечером, и это не зависит от брендинга салона.
 */
function ThemeSwitcher() {
  const [mode, setMode] = useState<ThemeMode>(getStoredTheme);

  function choose(next: ThemeMode) {
    setMode(next);
    applyTheme(next);
  }

  const options: Array<{ value: ThemeMode; icon: React.ReactNode }> = [
    { value: 'light', icon: <Sun size={14} /> },
    { value: 'dark', icon: <Moon size={14} /> },
  ];

  return (
    <div
      style={{
        display: 'inline-flex',
        alignSelf: 'flex-start',
        alignItems: 'center',
        gap: 3,
        padding: 3,
        borderRadius: 13,
        border: '1px solid var(--app-border, rgba(255,255,255,0.1))',
        background: 'var(--app-input, rgba(255,255,255,0.05))',
        flexShrink: 0,
      }}
    >
      {options.map((option) => {
        const isActive = mode === option.value;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => choose(option.value)}
            aria-label={option.value}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: 32,
              height: 28,
              border: 0,
              borderRadius: 9,
              background: isActive ? 'var(--app-accent)' : 'transparent',
              color: isActive ? '#17151c' : 'var(--app-text-muted)',
              cursor: 'pointer',
            }}
          >
            {option.icon}
          </button>
        );
      })}
    </div>
  );
}

export default ThemeSwitcher;
