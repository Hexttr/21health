import type { ChatAttachment } from '@/components/ChatAttachmentPanel';

export type ChatMessageRecord = {
  role: 'user' | 'assistant';
  content: string;
  sourceAttachments?: ChatAttachment[];
  contextAttachments?: ChatAttachment[];
};

export type ChatConversationRecord = {
  id: string;
  title: string;
  updatedAt: string;
  createdAt: string;
  messages: ChatMessageRecord[];
};

type ConversationStore = {
  activeConversationId: string | null;
  conversations: ChatConversationRecord[];
};

function getStorageKey(modelName: string): string {
  return `ai-conversations-${modelName.toLowerCase()}`;
}

export function loadConversationStore(modelName: string): ConversationStore {
  const raw = localStorage.getItem(getStorageKey(modelName));
  if (!raw) {
    return { activeConversationId: null, conversations: [] };
  }

  try {
    const parsed = JSON.parse(raw) as Partial<ConversationStore>;
    return {
      activeConversationId: typeof parsed.activeConversationId === 'string' ? parsed.activeConversationId : null,
      conversations: Array.isArray(parsed.conversations) ? parsed.conversations : [],
    };
  } catch {
    return { activeConversationId: null, conversations: [] };
  }
}

export function saveConversationStore(modelName: string, store: ConversationStore): void {
  localStorage.setItem(getStorageKey(modelName), JSON.stringify(store));
}

export function deriveConversationTitle(messages: ChatMessageRecord[]): string {
  const firstUserMessage = messages.find((message) => message.role === 'user' && message.content.trim());
  if (!firstUserMessage) return 'Новый чат';

  const normalized = firstUserMessage.content.replace(/\s+/g, ' ').trim();
  if (normalized.length <= 42) return normalized;
  return `${normalized.slice(0, 42).trim()}...`;
}

export function buildConversationPreview(messages: ChatMessageRecord[]): string {
  const lastMessage = [...messages].reverse().find((message) => message.content.trim());
  if (!lastMessage) return 'Пока без сообщений';
  const normalized = lastMessage.content.replace(/\s+/g, ' ').trim();
  if (normalized.length <= 88) return normalized;
  return `${normalized.slice(0, 88).trim()}...`;
}
