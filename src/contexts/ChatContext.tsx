import React, { createContext, useCallback, useContext, useRef } from 'react';

type ClearHandler = () => void;

type ChatContextValue = {
  registerClearHandler: (modelPath: string, handler: ClearHandler) => void;
  unregisterClearHandler: (modelPath: string) => void;
  clearChat: (modelPath: string) => void;
};

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatContextProvider({ children }: { children: React.ReactNode }) {
  const handlersRef = useRef<Record<string, ClearHandler>>({});

  const registerClearHandler = useCallback((modelPath: string, handler: ClearHandler) => {
    handlersRef.current[modelPath] = handler;
  }, []);

  const unregisterClearHandler = useCallback((modelPath: string) => {
    delete handlersRef.current[modelPath];
  }, []);

  const clearChat = useCallback((modelPath: string) => {
    handlersRef.current[modelPath]?.();
  }, []);

  const value = React.useMemo(
    () => ({ registerClearHandler, unregisterClearHandler, clearChat }),
    [registerClearHandler, unregisterClearHandler, clearChat]
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChatContext() {
  const ctx = useContext(ChatContext);
  if (!ctx) return null;
  return ctx;
}
