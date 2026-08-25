import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css';
import { applyTheme, getStoredTheme, watchSystemTheme } from './theme'
import './i18n'
import './i18n';
import App from './App.tsx'

applyTheme(getStoredTheme());
watchSystemTheme();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Установка на домашний экран: без служебного скрипта браузер
// не считает приложение устанавливаемым и не покажет предложение.
// Работает только по защищённому соединению — поэтому и нужен домен.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => {
      // Установка не критична: приложение работает и без неё.
    });
  });
}
