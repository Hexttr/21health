import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api, setToken } from '@/api/client';

export interface AppUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'student' | 'ai_user';
  phone?: string | null;
  phoneVerifiedAt?: string | null;
}

interface SignUpParams {
  email: string;
  password: string;
  name: string;
  accessCode?: string;
  phone?: string;
}

interface AuthContextType {
  user: AppUser | null;
  session: { user: AppUser } | null;
  isLoading: boolean;
  isAdmin: boolean;
  isSessionReady: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (params: SignUpParams) => Promise<{ error: string | null }>;
  completeSocialAuth: (ticket: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  isAuthenticated: boolean;
  validateAccessCode: (code: string) => Promise<{ valid: boolean; codeId?: string; codeType?: 'invitation' | 'referral'; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSessionReady, setIsSessionReady] = useState(false);

  const applyAuthenticatedSession = (token: string, nextUser: AppUser) => {
    setToken(token);
    setUser(nextUser);
    setIsAdmin(nextUser.role === 'admin');
    setIsSessionReady(true);
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setIsLoading(false);
      setIsSessionReady(true);
      return;
    }
    api<{ user: AppUser }>('/auth/me')
      .then(({ user: u }) => {
        setUser(u);
        setIsAdmin(u.role === 'admin');
      })
      .catch(() => {
        setToken(null);
      })
      .finally(() => {
        setIsLoading(false);
        setIsSessionReady(true);
      });
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const res = await api<{ token: string; user: AppUser }>('/auth/signin', {
        method: 'POST',
        body: { email, password },
      });
      applyAuthenticatedSession(res.token, res.user);
      return { error: null };
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Ошибка входа' };
    }
  };

  const validateAccessCode = async (code: string) => {
    try {
      const res = await api<{ valid: boolean; codeId?: string; codeType?: 'invitation' | 'referral'; error?: string }>('/auth/validate-code', {
        method: 'POST',
        body: { code },
      });
      return res.valid
        ? { valid: true, codeId: res.codeId, codeType: res.codeType }
        : { valid: false, error: res.error };
    } catch {
      return { valid: false, error: 'Ошибка проверки кода' };
    }
  };

  const signUp = async ({ email, password, name, accessCode = '', phone }: SignUpParams) => {
    const normalizedAccessCode = accessCode.trim().toUpperCase();

    if (normalizedAccessCode) {
      const codeValidation = await validateAccessCode(normalizedAccessCode);
      if (!codeValidation.valid) {
        return { error: codeValidation.error || 'Недействительный код' };
      }
    }

    try {
      const res = await api<{ token: string; user: AppUser }>('/auth/signup', {
        method: 'POST',
        body: {
          email,
          password,
          name,
          accessCode: normalizedAccessCode || undefined,
          phone: phone?.trim() || undefined,
        },
      });
      applyAuthenticatedSession(res.token, res.user);
      return { error: null };
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Ошибка регистрации' };
    }
  };

  const completeSocialAuth = async (ticket: string) => {
    try {
      const res = await api<{ token: string; user: AppUser }>(`/auth/social/complete?ticket=${encodeURIComponent(ticket)}`);
      applyAuthenticatedSession(res.token, res.user);
      return { error: null };
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Ошибка входа через соцсеть' };
    }
  };

  const signOut = async () => {
    setToken(null);
    setUser(null);
    setIsAdmin(false);
  };

  const session = user ? { user } : null;

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isLoading,
        isAdmin,
        isSessionReady,
        signIn,
        signUp,
        completeSocialAuth,
        signOut,
        isAuthenticated: !!user,
        validateAccessCode,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    return {
      user: null,
      session: null,
      isLoading: true,
      isAdmin: false,
      isSessionReady: false,
      signIn: async () => ({ error: 'Auth not ready' as string | null }),
      signUp: async () => ({ error: 'Auth not ready' as string | null }),
      completeSocialAuth: async () => ({ error: 'Auth not ready' as string | null }),
      signOut: async () => {},
      isAuthenticated: false,
      validateAccessCode: async () => ({ valid: false, error: 'Auth not ready' }),
    } as AuthContextType;
  }
  return context;
}
