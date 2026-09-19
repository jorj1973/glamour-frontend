import axios, { AxiosError } from 'axios';

const TOKEN_STORAGE_KEY = 'glamour_access_token';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
});

const LANGUAGE_STORAGE_KEY = 'glamour_language';

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Язык добавляется ко всем GET-запросам автоматически:
  // названия услуг вводит салон, словарь i18next их не переводит,
  // поэтому бэкенд подставляет нужное поле по этому параметру.
  const lang = localStorage.getItem(LANGUAGE_STORAGE_KEY);

  // Раньше язык уходил только с GET. Регистрация салона ходит
  // через POST, и тарифы приезжали не на том языке, на котором
  // человек читает страницу.
  if (lang) {
    config.params = { ...(config.params ?? {}), lang };
  }

  return config;
});

/**
 * Адреса, открытые без учётной записи.
 *
 * Держим их одним списком и рядом с проверкой: раньше он был вписан
 * прямо в перехватчик строчками, и стоило завести новый публичный адрес,
 * как про него забывали. Так и вышло с коротким `#salon/`: человек шёл
 * по ссылке салона, ошибался паролем, сервер отвечал 401 — и его
 * выбрасывало на главную вместе со всем выбором.
 *
 * Держится в согласии с разбором адреса в App.tsx. Меняешь там —
 * меняй и здесь.
 */
const PUBLIC_PATHS = [
  '/reset-password',
  '/salon/',
  '/master/',
  '/try',
];

const PUBLIC_HASHES = [
  '#reset-password',
  '#salon/',
  '#book',
  '#master/',
  '#master-register',
  '#master-registration',
  '#register-master',
  '#register',
];

function isPublicPage(): boolean {
  const path = window.location.pathname;
  const hash = window.location.hash;

  if (PUBLIC_PATHS.some((prefix) => path.startsWith(prefix))) {
    return true;
  }

  return PUBLIC_HASHES.some((prefix) => hash.startsWith(prefix));
}

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Токен стираем всегда: просроченный или чужой только мешает.
      localStorage.removeItem(TOKEN_STORAGE_KEY);

      // А уводить на главную можно только с закрытых страниц.
      // На публичных 401 ожидаем — у гостя сессии нет по определению,
      // и он продолжает свой путь, а не начинает его заново.
      if (!isPublicPage()) {
        window.location.assign(`${window.location.origin}/`);
      }
    }

    return Promise.reject(error);
  },
);

export default api;
