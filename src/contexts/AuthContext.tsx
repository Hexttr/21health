import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api, setToken } from '@/api/client';

export interface AppUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'student';
}

interface AuthContextType {
  user: AppUser | null;
  session: { user: AppUser } | null;
  isLoading: boolean;
  isAdmin: boolean;
  isSessionReady: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, name: string, invitationCode: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  isAuthenticated: boolean;
  validateInvitationCode: (code: string) => Promise<{ valid: boolean; codeId?: string; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSessionReady, setIsSessionReady] = useState(false);

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
      setToken(res.token);
      setUser(res.user);
      setIsAdmin(res.user.role === 'admin');
      setIsSessionReady(true);
      return { error: null };
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Ошибка входа' };
    }
  };

  const validateInvitationCode = async (code: string) => {
    try {
      const res = await api<{ valid: boolean; codeId?: string; error?: string }>('/auth/validate-code', {
        method: 'POST',
        body: { code },
      });
      return res.valid ? { valid: true, codeId: res.codeId } : { valid: false, error: res.error };
    } catch {
      return { valid: false, error: 'Ошибка проверки кода' };
    }
  };

  const signUp = async (email: string, password: string, name: string, invitationCode: string) => {
    const codeValidation = await validateInvitationCode(invitationCode);
    if (!codeValidation.valid) {
      return { error: codeValidation.error || 'Недействительный пригласительный код' };
    }
    try {
      const res = await api<{ token: string; user: AppUser }>('/auth/signup', {
        method: 'POST',
        body: { email, password, name, invitationCode: invitationCode.trim().toUpperCase() },
      });
      setToken(res.token);
      setUser(res.user);
      setIsAdmin(res.user.role === 'admin');
      setIsSessionReady(true);
      return { error: null };
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Ошибка регистрации' };
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
        signOut,
        isAuthenticated: !!user,
        validateInvitationCode,
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
      signOut: async () => {},
      isAuthenticated: false,
      validateInvitationCode: async () => ({ valid: false, error: 'Auth not ready' }),
    } as AuthContextType;
  }
  return context;
}
