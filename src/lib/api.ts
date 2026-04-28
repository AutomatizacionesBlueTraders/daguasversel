import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const baseURL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api').replace(/\/$/, '');

export const api = axios.create({ baseURL });

function getTabKey(): string {
  if (typeof window === 'undefined') return '';
  if (!window.name) {
    window.name = `tab_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  }
  return window.name;
}

export const tokenStorage = {
  get: (key: string): string | null => {
    if (typeof window === 'undefined') return null;
    return sessionStorage.getItem(`${getTabKey()}::${key}`);
  },
  set: (key: string, value: string) => {
    sessionStorage.setItem(`${getTabKey()}::${key}`, value);
  },
  del: (key: string) => {
    sessionStorage.removeItem(`${getTabKey()}::${key}`);
  },
  clear: () => {
    tokenStorage.del('accessToken');
    tokenStorage.del('refreshToken');
  },
};

api.interceptors.request.use((config) => {
  const token = tokenStorage.get('accessToken');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshing: Promise<string | null> | null = null;

async function doRefresh(): Promise<string | null> {
  const refreshToken = tokenStorage.get('refreshToken');
  if (!refreshToken) return null;
  try {
    const r = await axios.post(`${baseURL}/auth/refresh`, { refreshToken });
    const accessToken = r.data?.accessToken as string | undefined;
    if (!accessToken) return null;
    tokenStorage.set('accessToken', accessToken);
    return accessToken;
  } catch {
    return null;
  }
}

api.interceptors.response.use(
  (r) => r,
  async (err: AxiosError) => {
    const original = err.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    if (!original || err.response?.status !== 401 || original._retry) {
      throw err;
    }
    original._retry = true;

    refreshing = refreshing || doRefresh();
    const newToken = await refreshing;
    refreshing = null;

    if (!newToken) {
      tokenStorage.clear();
      throw err;
    }
    if (original.headers) original.headers.Authorization = `Bearer ${newToken}`;
    return api(original);
  }
);

export interface ApiErrorPayload {
  error: string;
  code?: string;
  score?: number;
}

export function getApiError(err: unknown): ApiErrorPayload | null {
  if (axios.isAxiosError(err) && err.response?.data && typeof err.response.data === 'object') {
    return err.response.data as ApiErrorPayload;
  }
  return null;
}
