import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api, setToken } from '@/api/client';

export type AppRole =
  | 'admin'
  | 'tutor'
  | 'learner'
  | 'department_head'
  | 'mentor'
  | 'student';

export interface AppUser {
  id: string;
  email: string;
  name: string;
  role: AppRole;
  /** When present, all roles assigned to the user (LMS) */
  roles?: AppRole[];
}

interface SignUpParams {
  email: string;
  password: string;
  name: string;
}

interface AuthContextType {
  user: AppUser | null;
  session: { user: AppUser } | null;
  isLoading: boolean;
  isAdmin: boolean;
  /** admin или tutor — доступ к LMS-админке курсов */
  isLmsStaff: boolean;
  /** admin, tutor, руководитель подразделения, наставник — сводка LMS */
  canViewLmsAnalytics: boolean;
  isSessionReady: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (params: SignUpParams) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLmsStaff, setIsLmsStaff] = useState(false);
  const [canViewLmsAnalytics, setCanViewLmsAnalytics] = useState(false);
  const [isSessionReady, setIsSessionReady] = useState(false);

  const applyRoles = (nextUser: AppUser) => {
    const rs = nextUser.roles ?? [nextUser.role];
    setIsAdmin(rs.includes('admin'));
    setIsLmsStaff(rs.includes('admin') || rs.includes('tutor'));
    setCanViewLmsAnalytics(
      rs.includes('admin') ||
        rs.includes('tutor') ||
        rs.includes('department_head') ||
        rs.includes('mentor'),
    );
  };

  const applyAuthenticatedSession = (token: string, nextUser: AppUser) => {
    setToken(token);
    setUser(nextUser);
    applyRoles(nextUser);
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
        applyRoles(u);
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

  const signUp = async ({ email, password, name }: SignUpParams) => {

    try {
      const res = await api<{ token: string; user: AppUser }>('/auth/signup', {
        method: 'POST',
        body: {
          email,
          password,
          name,
        },
      });
      applyAuthenticatedSession(res.token, res.user);
      return { error: null };
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Ошибка регистрации' };
    }
  };

  const signOut = async () => {
    setToken(null);
    setUser(null);
    setIsAdmin(false);
    setIsLmsStaff(false);
    setCanViewLmsAnalytics(false);
  };

  const session = user ? { user } : null;

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isLoading,
        isAdmin,
        isLmsStaff,
        canViewLmsAnalytics,
        isSessionReady,
        signIn,
        signUp,
        signOut,
        isAuthenticated: !!user,
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
      isLmsStaff: false,
      canViewLmsAnalytics: false,
      isSessionReady: false,
      signIn: async () => ({ error: 'Auth not ready' as string | null }),
      signUp: async () => ({ error: 'Auth not ready' as string | null }),
      signOut: async () => {},
      isAuthenticated: false,
    } as AuthContextType;
  }
  return context;
}
