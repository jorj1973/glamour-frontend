import axios, { AxiosError } from 'axios';

const TOKEN_STORAGE_KEY = 'glamour_access_token';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
    headers: {
        'Content-Type': 'application/json',
    },
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem(TOKEN_STORAGE_KEY);

    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
});

api.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
        if (error.response?.status === 401) {
            localStorage.removeItem(TOKEN_STORAGE_KEY);

            if (window.location.hash !== '') {
                window.location.hash = '';
            }

            window.location.reload();
        }

        return Promise.reject(error);
    },
);

export default api;