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

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      // На странице сброса пароля 401 ожидаем: пользователь ещё не вошёл.
      // Перезагрузка здесь зациклила бы форму.
      // Публичные страницы: у гостя сессии нет по определению,
      // и 401 здесь ожидаем. Выбрасывать его на главную нельзя —
      // иначе он не дойдёт до формы регистрации.
      const isPublicPage =
        window.location.pathname.startsWith('/reset-password') ||
        window.location.hash.startsWith('#reset-password') ||
        window.location.hash.startsWith('#book') ||
        window.location.hash.startsWith('#master/') ||
        window.location.hash.startsWith('#register');

      // Токен стираем всегда: просроченный или чужой только мешает.
      localStorage.removeItem(TOKEN_STORAGE_KEY);

      // А вот уводить на главную можно только с закрытых страниц.
      // На публичных 401 ожидаем — там человек продолжает свой путь.
      if (!isPublicPage) {
        window.location.assign(`${window.location.origin}/`);
      }
    }

    return Promise.reject(error);
  },
);

export default api;
