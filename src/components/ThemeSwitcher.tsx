import { useState } from 'react';
import type { ReactNode } from 'react';
import { Moon, Sun } from 'lucide-react';

import { applyTheme, getStoredTheme, type ThemeMode } from '../theme';

import { headerPill, headerSegment } from './headerControls';

/**
 * Переключатель темы: два значка рядом, как у языков.
 *
 * Личная настройка каждого — один работает при свете, другой
 * вечером, и это не зависит от брендинга салона.
 *
 * Размеры общие с остальной шапкой: раньше они стояли здесь своими
 * числами, и пилюля выходила на восемь пикселей ниже соседних кнопок.
 */
function ThemeSwitcher() {
  const [mode, setMode] = useState<ThemeMode>(getStoredTheme);

  function choose(next: ThemeMode) {
    setMode(next);
    applyTheme(next);
  }

  const options: Array<{ value: ThemeMode; icon: ReactNode }> = [
    { value: 'light', icon: <Sun size={16} /> },
    { value: 'dark', icon: <Moon size={16} /> },
  ];

  return (
    <div style={{ ...headerPill, alignSelf: 'flex-start' }}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => choose(option.value)}
          aria-label={option.value}
          style={headerSegment(mode === option.value)}
        >
          {option.icon}
        </button>
      ))}
    </div>
  );
}

export default ThemeSwitcher;
