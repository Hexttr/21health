import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';

interface ImpersonatedUser {
  user_id: string;
  name: string;
  email: string;
}

interface ImpersonationContextType {
  impersonatedUser: ImpersonatedUser | null;
  startImpersonation: (user: ImpersonatedUser) => void;
  stopImpersonation: () => void;
  isImpersonating: boolean;
  getEffectiveUserId: (realUserId: string | undefined) => string | undefined;
}

const ImpersonationContext = createContext<ImpersonationContextType | undefined>(undefined);

export function ImpersonationProvider({ children }: { children: ReactNode }) {
  const [impersonatedUser, setImpersonatedUser] = useState<ImpersonatedUser | null>(null);

  const startImpersonation = useCallback((user: ImpersonatedUser) => {
    console.log('Starting impersonation:', user);
    setImpersonatedUser(user);
  }, []);

  const stopImpersonation = useCallback(() => {
    console.log('Stopping impersonation');
    setImpersonatedUser(null);
  }, []);

  const getEffectiveUserId = useCallback((realUserId: string | undefined) => {
    return impersonatedUser?.user_id ?? realUserId;
  }, [impersonatedUser]);

  return (
    <ImpersonationContext.Provider value={{
      impersonatedUser,
      startImpersonation,
      stopImpersonation,
      isImpersonating: !!impersonatedUser,
      getEffectiveUserId
    }}>
      {children}
    </ImpersonationContext.Provider>
  );
}

export function useImpersonation() {
  const context = useContext(ImpersonationContext);
  if (context === undefined) {
    throw new Error('useImpersonation must be used within an ImpersonationProvider');
  }
  return context;
}
