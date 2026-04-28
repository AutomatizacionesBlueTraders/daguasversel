import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { api, tokenStorage, getApiError } from '@/lib/api';

export type AppRole = 'admin' | 'usuario' | 'tecnico';

export interface AuthUser {
  id: number;
  email: string;
  nombre: string;
  telefono: string | null;
  rol: AppRole;
  activo: boolean;
  debe_cambiar_password: boolean;
  email_verificado: boolean;
  ultimo_login: string | null;
  created_at: string;
}

interface SignInResult {
  ok: boolean;
  errorCode?: string;
  errorMessage?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  mustChangePassword: boolean;
  isAdmin: boolean;
  role: AppRole | null;
  signIn: (email: string, password: string) => Promise<SignInResult>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMe = useCallback(async () => {
    try {
      const r = await api.get<AuthUser>('/auth/me');
      setUser(r.data);
    } catch {
      tokenStorage.clear();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const token = tokenStorage.get('accessToken');
    if (!token) {
      setLoading(false);
      return;
    }
    void fetchMe();
  }, [fetchMe]);

  const signIn = useCallback(async (email: string, password: string): Promise<SignInResult> => {
    try {
      const r = await api.post<{ user: AuthUser; accessToken: string; refreshToken: string }>(
        '/auth/login',
        { email, password }
      );
      tokenStorage.set('accessToken', r.data.accessToken);
      tokenStorage.set('refreshToken', r.data.refreshToken);
      setUser(r.data.user);
      return { ok: true };
    } catch (err) {
      const payload = getApiError(err);
      return {
        ok: false,
        errorCode: payload?.code,
        errorMessage: payload?.error || 'Credenciales inválidas',
      };
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // stateless: ignorar
    }
    tokenStorage.clear();
    setUser(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!tokenStorage.get('accessToken')) return;
    await fetchMe();
  }, [fetchMe]);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        mustChangePassword: !!user?.debe_cambiar_password,
        isAdmin: user?.rol === 'admin',
        role: user?.rol ?? null,
        signIn,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
