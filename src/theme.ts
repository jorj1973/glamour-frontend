export type ThemeMode = 'light' | 'dark' | 'system';

const THEME_STORAGE_KEY = 'glamour_theme_mode';

function resolveTheme(themeMode: ThemeMode): 'light' | 'dark' {
  if (themeMode !== 'system') {
    return themeMode;
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

export function applyTheme(themeMode: ThemeMode) {
  const resolvedTheme = resolveTheme(themeMode);

  document.documentElement.dataset.theme = resolvedTheme;
  document.documentElement.dataset.themeMode = themeMode;

  localStorage.setItem(THEME_STORAGE_KEY, themeMode);
}

export function getStoredTheme(): ThemeMode {
  const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);

  if (
    storedTheme === 'light' ||
    storedTheme === 'dark' ||
    storedTheme === 'system'
  ) {
    return storedTheme;
  }

  return 'dark';
}

export function watchSystemTheme() {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

  const handleChange = () => {
    const currentMode =
      document.documentElement.dataset.themeMode as ThemeMode | undefined;

    if (currentMode === 'system') {
      applyTheme('system');
    }
  };

  mediaQuery.addEventListener('change', handleChange);

  return () => {
    mediaQuery.removeEventListener('change', handleChange);
  };
}
