import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Send, Loader2, Sparkles, Trash2, Bot, MessageSquare, Upload, FileText, History, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { useChatContext } from '@/contexts/ChatContext';
import { AIModel, ModelSelector } from '@/components/ModelSelector';
import { useBalance } from '@/contexts/BalanceContext';
import { BalanceWidget } from '@/components/BalanceWidget';
import { ChatAttachment, ChatAttachmentPanel } from '@/components/ChatAttachmentPanel';
import { AIConversationList } from '@/components/AIConversationList';
import { AIResponseContent } from '@/components/AIResponseContent';
import { useIsMobile } from '@/hooks/use-mobile';
import { getAIToolBadge, getAIToolByProvider, getAIToolByTitle } from '@/lib/ai-tools';
import { showPersistentAiError } from '@/lib/ai-error-utils';
import {
  deriveConversationTitle,
  loadConversationStore,
  saveConversationStore,
  type ChatConversationRecord,
  type ChatMessageRecord,
} from '@/lib/ai-conversations';

type Message = {
  role: 'user';
  content: string;
  sourceImages?: string[];
  sourceAttachments?: ChatAttachment[];
} | {
  role: 'assistant';
  content: string;
  contextImages?: string[];
  contextAttachments?: ChatAttachment[];
};

interface AIChatPageProps {
  modelName: string;
  modelIcon: string;
  modelColor: string;
  providerName?: string;
  starterPrompts?: string[];
}

const getModelPath = (modelName: string) => modelName.toLowerCase();

const getModelIconPath = (modelName: string) => {
  const name = modelName.toLowerCase();
  if (name.includes('chatgpt')) return '/icons/chatgpt.png';
  if (name.includes('claude')) return '/icons/claude.png';
  if (name.includes('gemini')) return '/icons/gemini.png';
  return null;
};

function getAttachmentMeta(attachment: ChatAttachment, includeSize = false): string {
  const parts: string[] = [];
  if (includeSize) {
    parts.push(`${Math.max(1, Math.round(attachment.fileSize / 1024))} KB`);
  }
  if (attachment.pageCount) parts.push(`${attachment.pageCount} стр.`);
  if (attachment.sheetCount) parts.push(`${attachment.sheetCount} лист.`);
  if (attachment.slideCount) parts.push(`${attachment.slideCount} слайд.`);
  return parts.join(' · ');
}

function deserializeMessages(stored: ChatMessageRecord[]): Message[] {
  return stored.map((message) => (
    message.role === 'user'
      ? {
          role: 'user',
          content: message.content,
          sourceAttachments: message.sourceAttachments,
        }
      : {
          role: 'assistant',
          content: message.content,
          contextAttachments: message.contextAttachments,
        }
  ));
}

function serializeMessages(messages: Message[]): ChatMessageRecord[] {
  return messages.map((message) => (
    message.role === 'user'
      ? {
          role: 'user',
          content: message.content,
          sourceAttachments: message.sourceAttachments,
        }
      : {
          role: 'assistant',
          content: message.content,
          contextAttachments: message.contextAttachments,
        }
  ));
}

export function AIChatPage({ modelName, modelIcon, modelColor, providerName, starterPrompts }: AIChatPageProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<AIModel | null>(null);
  const [sourceImages, setSourceImages] = useState<string[]>([]);
  const [sourceAttachments, setSourceAttachments] = useState<ChatAttachment[]>([]);
  const [conversations, setConversations] = useState<ChatConversationRecord[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const skipConversationSyncRef = useRef(false);
  const activeRequestRef = useRef<AbortController | null>(null);
  const shouldStickToBottomRef = useRef(true);
  const chatContext = useChatContext();
  const { refreshBalance } = useBalance();
  const isMobile = useIsMobile();
  const canAttachImages = Boolean(selectedModel?.supportsImageInput);
  const canAttachDocuments = Boolean(selectedModel?.supportsDocumentInput);
  const toolConfig = getAIToolByProvider(providerName) || getAIToolByTitle(modelName);
  const initialPrompts = starterPrompts || [
    'Как использовать ИИ в моей работе?',
    'Объясни мне промпт-инжиниринг',
    'Помоги написать промпт',
  ];
  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === activeConversationId) || null,
    [activeConversationId, conversations]
  );
  const toolMetaLine = useMemo(() => {
    const parts: string[] = [];
    if (toolConfig) {
      parts.push(toolConfig.access === 'free' ? 'Бесплатно' : 'Платно');
    }
    if (canAttachDocuments) parts.push('Документы');
    if (canAttachImages) parts.push('Изображения');
    return parts.join(' · ');
  }, [canAttachDocuments, canAttachImages, toolConfig]);
  const attachmentSummary = useMemo(() => {
    const parts: string[] = [];
    if (sourceImages.length > 0) {
      parts.push(`${sourceImages.length} изображ.`);
    }
    if (sourceAttachments.length > 0) {
      parts.push(`${sourceAttachments.length} докум.`);
    }
    return parts.join(' · ');
  }, [sourceAttachments.length, sourceImages.length]);

  useEffect(() => {
    if (!canAttachImages && sourceImages.length > 0) {
      setSourceImages([]);
    }
  }, [canAttachImages, sourceImages.length]);

  useEffect(() => {
    if (!canAttachDocuments && sourceAttachments.length > 0) {
      setSourceAttachments([]);
    }
  }, [canAttachDocuments, sourceAttachments.length]);

  useEffect(() => {
    if (!shouldStickToBottomRef.current || !messagesEndRef.current) return;
    messagesEndRef.current.scrollIntoView({ behavior: isLoading ? 'auto' : 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    skipConversationSyncRef.current = true;
    const store = loadConversationStore(modelName);
    setConversations(store.conversations);
    setActiveConversationId(store.activeConversationId);

    const initialConversation = store.conversations.find((conversation) => conversation.id === store.activeConversationId) || null;
    setMessages(initialConversation ? deserializeMessages(initialConversation.messages) : []);
    setSourceImages([]);
    setSourceAttachments([]);
  }, [modelName]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      saveConversationStore(modelName, {
        activeConversationId,
        conversations,
      });
    }, 200);

    return () => window.clearTimeout(timeoutId);
  }, [activeConversationId, conversations, modelName]);

  useEffect(() => {
    if (!activeConversationId) return;
    if (skipConversationSyncRef.current) {
      skipConversationSyncRef.current = false;
      return;
    }

    const serialized = serializeMessages(messages);
    setConversations((prev) => {
      if (serialized.length === 0) {
        return prev.filter((conversation) => conversation.id !== activeConversationId);
      }

      const existing = prev.find((conversation) => conversation.id === activeConversationId);
      const now = new Date().toISOString();
      const nextConversation: ChatConversationRecord = existing
        ? {
            ...existing,
            title: existing.messages.length === 0 ? deriveConversationTitle(serialized) : existing.title,
            messages: serialized,
            updatedAt: now,
          }
        : {
            id: activeConversationId,
            title: deriveConversationTitle(serialized),
            createdAt: now,
            updatedAt: now,
            messages: serialized,
          };

      return [nextConversation, ...prev.filter((conversation) => conversation.id !== activeConversationId)]
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    });
  }, [activeConversationId, messages]);

  const clearChat = useCallback(() => {
    if (activeConversationId) {
      setConversations((prev) => prev.filter((conversation) => conversation.id !== activeConversationId));
      setActiveConversationId(null);
    }
    skipConversationSyncRef.current = true;
    shouldStickToBottomRef.current = true;
    setMessages([]);
    setSourceImages([]);
    setSourceAttachments([]);
    toast.success(activeConversationId ? 'Диалог удалён' : 'Чат очищен');
  }, [activeConversationId]);

  useEffect(() => {
    const modelPath = getModelPath(modelName);
    chatContext?.registerClearHandler(modelPath, clearChat);
    return () => chatContext?.unregisterClearHandler(modelPath);
  }, [chatContext, modelName, clearChat]);

  useEffect(() => (
    () => {
      activeRequestRef.current?.abort();
      activeRequestRef.current = null;
    }
  ), []);

  const startNewChat = useCallback(() => {
    skipConversationSyncRef.current = true;
    shouldStickToBottomRef.current = true;
    setActiveConversationId(null);
    setMessages([]);
    setSourceImages([]);
    setSourceAttachments([]);
    setInput('');
    setHistoryOpen(false);
  }, []);

  const selectConversation = useCallback((conversationId: string) => {
    const conversation = conversations.find((item) => item.id === conversationId);
    if (!conversation) return;
    skipConversationSyncRef.current = true;
    shouldStickToBottomRef.current = true;
    setActiveConversationId(conversationId);
    setMessages(deserializeMessages(conversation.messages));
    setSourceImages([]);
    setSourceAttachments([]);
    setHistoryOpen(false);
  }, [conversations]);

  const deleteConversation = useCallback((conversationId: string) => {
    setConversations((prev) => prev.filter((conversation) => conversation.id !== conversationId));
    if (conversationId === activeConversationId) {
      const nextConversation = conversations.find((conversation) => conversation.id !== conversationId) || null;
      skipConversationSyncRef.current = true;
      shouldStickToBottomRef.current = true;
      setActiveConversationId(nextConversation?.id || null);
      setMessages(nextConversation ? deserializeMessages(nextConversation.messages) : []);
      setSourceImages([]);
      setSourceAttachments([]);
    }
    toast.success('Диалог удалён');
  }, [activeConversationId, conversations]);

  const handleMessagesScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const element = event.currentTarget;
    const distanceToBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
    shouldStickToBottomRef.current = distanceToBottom < 140;
  }, []);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    let conversationId = activeConversationId;
    if (!conversationId) {
      conversationId = crypto.randomUUID();
      setActiveConversationId(conversationId);
      setConversations((prev) => [
        {
          id: conversationId!,
          title: deriveConversationTitle([{ role: 'user', content: input.trim() }]),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          messages: [],
        },
        ...prev,
      ]);
    }

    const userMessage: Message = {
      role: 'user',
      content: input.trim(),
      ...(sourceImages.length > 0 && { sourceImages: [...sourceImages] }),
      ...(sourceAttachments.length > 0 && { sourceAttachments: [...sourceAttachments] }),
    };
    const newMessages = [...messages, userMessage];

    skipConversationSyncRef.current = false;
    shouldStickToBottomRef.current = true;
    setMessages(newMessages);
    setInput('');
    setSourceImages([]);
    setSourceAttachments([]);
    setIsLoading(true);

    let assistantContent = '';
    let streamError = '';

    try {
      const controller = new AbortController();
      activeRequestRef.current = controller;
      const token = localStorage.getItem('token');
      const apiUrl = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? '/api' : 'http://localhost:3001/api');
      const response = await fetch(`${apiUrl}/ai/chat`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({
          modelId: selectedModelId,
          messages: newMessages.map((message) => ({
            role: message.role,
            content: message.content,
            images: message.role === 'user' ? message.sourceImages : undefined,
            attachmentIds: message.role === 'user' ? message.sourceAttachments?.map((attachment) => attachment.id) : undefined,
          })),
        }),
      });

      if (response.status === 429) { showPersistentAiError('Превышен лимит запросов. Попробуйте позже.'); setIsLoading(false); return; }
      if (response.status === 402) { showPersistentAiError('Необходимо пополнить баланс.'); setIsLoading(false); return; }
      if (response.status === 401) { showPersistentAiError('Войдите в аккаунт для использования чата'); setIsLoading(false); return; }
      if (response.status === 404) { showPersistentAiError('Сервер не найден. Убедитесь, что backend запущен.'); setIsLoading(false); return; }

      if (!response.ok || !response.body) {
        const errData = await response.json().catch(() => ({}));
        const errMsg = typeof errData?.error === 'string' ? errData.error : errData?.error?.message || `Ошибка ${response.status}`;
        showPersistentAiError(errMsg);
        setIsLoading(false);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';

      setMessages([...newMessages, {
        role: 'assistant',
        content: '',
        contextImages: userMessage.sourceImages,
        contextAttachments: userMessage.sourceAttachments,
      }]);

      let streamDone = false;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') {
            streamDone = true;
            break;
          }

          try {
            const parsed = JSON.parse(jsonStr);
            if (typeof parsed.error === 'string' && parsed.error.trim()) {
              streamError = parsed.error.trim();
              streamDone = true;
              break;
            }
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantContent += content;
              setMessages(prev => {
                const lastMessage = prev[prev.length - 1];
                if (lastMessage?.role === 'assistant') {
                  return [...prev.slice(0, -1), { ...lastMessage, content: assistantContent }];
                }
                return prev;
              });
            }
          } catch {
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
        if (streamDone) break;
      }

      if (streamError) {
        showPersistentAiError(streamError);
        if (!assistantContent.trim()) {
          setMessages(newMessages);
        }
        return;
      }

      if (!assistantContent.trim()) {
        showPersistentAiError('Модель не вернула текстовый ответ. Попробуйте другую модель или повторите запрос.');
        setMessages(newMessages);
        return;
      }

      setTimeout(() => refreshBalance(), 500);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        setMessages(newMessages);
        return;
      }
      console.error('AI chat error:', error);
      showPersistentAiError('Ошибка при отправке сообщения');
      setMessages(newMessages);
    } finally {
      activeRequestRef.current = null;
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
  };

  return (
    <div className="flex h-full min-h-0 min-[0px]:min-h-[100dvh] md:min-h-0 bg-[linear-gradient(180deg,hsl(248_34%_95%)_0%,hsl(248_34%_92%)_100%)]">
      <aside className="glass-card hidden xl:flex xl:w-80 xl:flex-col xl:border-r xl:border-border/40">
        <AIConversationList
          title={modelName}
          conversations={conversations}
          activeConversationId={activeConversationId}
          onNewChat={startNewChat}
          onSelectConversation={selectConversation}
          onDeleteConversation={deleteConversation}
        />
      </aside>

      <div className="mesh-bg flex min-w-0 flex-1 flex-col bg-[linear-gradient(180deg,hsl(248_30%_94%)_0%,hsl(248_30%_91%)_100%)]">
        <header className="sticky top-0 z-20 border-b border-border/40 bg-background/80 backdrop-blur-xl">
          <div className="mx-auto max-w-6xl px-3 py-2.5 md:flex md:h-16 md:items-center md:justify-between md:gap-4 md:px-4 md:py-0">
            <div className="flex min-w-0 items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-3">
                <SidebarTrigger className="xl:hidden text-muted-foreground hover:text-foreground transition-colors" />
                <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-2xl border border-border/50 bg-card shadow-soft">
                  {getModelIconPath(modelName) ? (
                    <img src={getModelIconPath(modelName)!} alt="" className="h-7 w-7 object-contain" />
                  ) : (
                    <span className="text-xl">{modelIcon}</span>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="truncate font-serif text-base font-semibold text-foreground md:text-lg">{modelName}</div>
                  <div className="truncate text-[11px] text-muted-foreground md:hidden">
                    {activeConversation?.title || toolMetaLine || 'Новый диалог'}
                  </div>
                  <div className="hidden flex-wrap items-center gap-2 text-xs text-muted-foreground md:flex">
                    <span className="truncate">{activeConversation?.title || 'Новый диалог'}</span>
                    {toolConfig && (
                      <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${getAIToolBadge(toolConfig.access)}`}>
                        {toolConfig.access === 'free' ? 'free' : 'paid'}
                      </span>
                    )}
                    {canAttachDocuments && (
                      <span className="inline-flex items-center rounded-full border border-violet-500/20 bg-violet-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-700">
                        docs
                      </span>
                    )}
                    {canAttachImages && (
                      <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                        image
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 md:hidden">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={startNewChat}
                  className="h-9 w-9 rounded-xl border-border/50 bg-background/75"
                  title="Новый чат"
                >
                  <Plus className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setHistoryOpen(true)}
                  className="h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground"
                  title="История диалогов"
                >
                  <History className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="hidden items-center gap-2 md:flex">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setHistoryOpen(true)}
                className="xl:hidden rounded-xl text-muted-foreground hover:text-foreground"
                title="История диалогов"
              >
                <History className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={startNewChat} className="rounded-xl gap-2">
                <Plus className="h-4 w-4" />
                Новый чат
              </Button>
              {messages.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearChat}
                  className="rounded-xl gap-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="hidden md:inline">Удалить чат</span>
                </Button>
              )}
              <BalanceWidget compact />
            </div>
          </div>
        </header>

        <div ref={scrollContainerRef} onScroll={handleMessagesScroll} className="flex-1 overflow-y-auto">
          <div className="mx-auto flex min-h-full max-w-6xl flex-col px-3 py-4 md:px-4 md:py-7">
            {messages.length === 0 ? (
              <div className="flex min-h-[40vh] flex-col items-center justify-center text-center animate-fade-in-up md:min-h-[58vh]">
                <div className="mb-4 flex h-16 w-16 items-center justify-center overflow-hidden rounded-3xl border border-border/50 bg-card shadow-large md:mb-6 md:h-20 md:w-20">
                  {getModelIconPath(modelName) ? (
                    <img src={getModelIconPath(modelName)!} alt="" className="h-11 w-11 object-contain md:h-14 md:w-14" />
                  ) : (
                    <div className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${modelColor}`}>
                      <Sparkles className="h-8 w-8 text-white md:h-10 md:w-10" />
                    </div>
                  )}
                </div>
                <h2 className="mb-2 font-serif text-2xl font-semibold text-foreground md:mb-3 md:text-3xl">
                  Начните диалог с {modelName}
                </h2>
                {!!toolMetaLine && (
                  <p className="mb-3 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground md:hidden">
                    {toolMetaLine}
                  </p>
                )}
                <div className="mb-4 hidden flex-wrap items-center justify-center gap-2 md:flex">
                  {toolConfig && (
                    <span className={`inline-flex items-center rounded-full border px-2 py-1 text-[11px] font-semibold uppercase tracking-wide ${getAIToolBadge(toolConfig.access)}`}>
                      {toolConfig.access === 'free' ? 'Бесплатно' : 'Платно'}
                    </span>
                  )}
                  {canAttachDocuments && (
                    <span className="inline-flex items-center rounded-full border border-violet-500/20 bg-violet-500/10 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-violet-700">
                      Анализ документов
                    </span>
                  )}
                  {canAttachImages && (
                    <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-primary">
                      Анализ изображений
                    </span>
                  )}
                </div>
                <p className="max-w-xl text-balance text-sm leading-6 text-muted-foreground md:leading-7">
                  {canAttachImages && canAttachDocuments
                    ? 'Задайте вопрос, приложите документ, таблицу, презентацию или скрин и получите аккуратно оформленный разбор.'
                    : canAttachDocuments
                      ? 'Задайте вопрос и приложите документ, таблицу или презентацию для анализа.'
                      : canAttachImages
                        ? 'Задайте вопрос, приложите скрин или фото и попросите модель разобрать материал.'
                        : 'Задайте любой вопрос, попросите помочь с задачей или обсудите тему урока.'}
                </p>
                <div className="mt-6 grid w-full max-w-2xl gap-2.5 md:mt-10 md:gap-3 md:grid-cols-2">
                  {initialPrompts.map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => {
                        setInput(suggestion);
                        inputRef.current?.focus();
                      }}
                      className="ai-shell-surface rounded-2xl px-4 py-3 text-left text-sm font-medium text-foreground transition-all duration-200 hover:border-primary/30 hover:bg-background md:card-hover md:py-4"
                    >
                      <span className="mr-2 text-primary">→</span>
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-5 md:space-y-10">
                {messages.map((message, index) => (
                  <div
                    key={index}
                    className={message.role === 'user' ? 'flex justify-end' : 'flex justify-start'}
                  >
                    {message.role === 'assistant' && (
                      <div className="flex w-full max-w-4xl gap-3 md:gap-4">
                        <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border/50 bg-card shadow-soft md:h-10 md:w-10">
                          {getModelIconPath(modelName) ? (
                            <img src={getModelIconPath(modelName)!} alt="" className="h-4.5 w-4.5 object-contain md:h-5 md:w-5" />
                          ) : (
                            <div className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${modelColor}`}>
                              <Bot className="h-4 w-4 text-white" />
                            </div>
                          )}
                        </div>

                        <article className="ai-reading-surface min-w-0 flex-1 rounded-[24px] px-4 py-4 md:rounded-[30px] md:px-7 md:py-6">
                          <div className="mb-3 flex items-center gap-2 border-b border-border/40 pb-2.5 md:mb-4 md:gap-3 md:pb-3">
                            <div className="ai-kicker">Ответ {modelName}</div>
                            <div className="hidden h-1 w-1 rounded-full bg-muted-foreground/35 md:block" />
                            <div className="hidden text-xs text-muted-foreground md:block">Структурированный разбор</div>
                          </div>

                          {((message.contextAttachments && message.contextAttachments.length > 0) || (message.contextImages && message.contextImages.length > 0)) && (
                            <div className="mb-4 space-y-2.5 border-b border-border/35 pb-4 md:mb-5 md:space-y-3 md:pb-5">
                              <div className="ai-kicker">Контекст запроса</div>

                              {message.contextAttachments && message.contextAttachments.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                  {message.contextAttachments.map((attachment) => (
                                    <div key={attachment.id} className="ai-context-chip max-w-full">
                                      <FileText className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" />
                                      <div className="min-w-0">
                                        <div className="truncate text-xs font-medium text-foreground">{attachment.originalName}</div>
                                        <div className="text-[11px] leading-4.5 text-muted-foreground md:leading-5">
                                          {getAttachmentMeta(attachment)}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {message.contextImages && message.contextImages.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                  {message.contextImages.slice(0, 6).map((url, imageIndex) => (
                                    <div key={`${url}-${imageIndex}`} className="rounded-2xl border border-border/50 bg-background/90 p-1 shadow-xs">
                                      <img src={url} alt="" className="h-12 w-12 rounded-xl object-cover md:h-14 md:w-14" />
                                    </div>
                                  ))}
                                  {message.contextImages.length > 6 && (
                                    <div className="inline-flex items-center rounded-xl border border-border/50 bg-background/90 px-3 py-2 text-xs text-muted-foreground shadow-xs">
                                      +{message.contextImages.length - 6} изображ.
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}

                          <AIResponseContent content={message.content} />
                        </article>
                      </div>
                    )}

                    {message.role === 'user' && (
                      <div className="ml-auto flex max-w-[92%] items-end gap-2 md:max-w-[min(40rem,88%)] md:gap-3">
                        <div className="rounded-[24px] border border-white/20 gradient-hero px-4 py-3 text-primary-foreground shadow-soft md:rounded-[28px] md:py-3.5">
                          <div className="space-y-2.5 md:space-y-3">
                            {message.sourceAttachments && message.sourceAttachments.length > 0 && (
                              <div className="flex flex-wrap gap-2">
                                {message.sourceAttachments.map((attachment) => (
                                  <div key={attachment.id} className="inline-flex max-w-full items-start gap-2 rounded-xl border border-white/20 bg-white/10 px-3 py-2">
                                    <FileText className="mt-0.5 h-4 w-4 shrink-0" />
                                    <div className="min-w-0">
                                      <div className="truncate text-xs font-medium">{attachment.originalName}</div>
                                      <div className="text-[11px] opacity-80">
                                        {getAttachmentMeta(attachment, true)}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                            {message.sourceImages && message.sourceImages.length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {message.sourceImages.slice(0, 6).map((url, imageIndex) => (
                                  <img key={`${url}-${imageIndex}`} src={url} alt="" className="h-11 w-11 rounded-xl border border-white/30 object-cover md:h-12 md:w-12" />
                                ))}
                                {message.sourceImages.length > 6 && <span className="self-center text-xs opacity-80">+{message.sourceImages.length - 6}</span>}
                              </div>
                            )}
                            <p className="whitespace-pre-wrap text-[14px] leading-6 md:leading-7">{message.content}</p>
                          </div>
                        </div>

                        <div className="hidden mt-1 md:flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-border/50 bg-background/90 shadow-soft">
                          <MessageSquare className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
                  <div className="flex justify-start">
                    <div className="flex w-full max-w-4xl gap-3 md:gap-4">
                      <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border/50 bg-card shadow-soft md:h-10 md:w-10">
                        {getModelIconPath(modelName) ? (
                          <img src={getModelIconPath(modelName)!} alt="" className="h-4.5 w-4.5 object-contain md:h-5 md:w-5" />
                        ) : (
                          <div className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${modelColor}`}>
                            <Bot className="h-4 w-4 text-white" />
                          </div>
                        )}
                      </div>
                      <div className="ai-reading-surface max-w-xl rounded-[24px] px-5 py-4 md:px-6 md:py-5">
                        <div className="mb-3 ai-kicker">Ответ {modelName}</div>
                        <div className="flex items-center gap-1.5">
                          <span className="h-2 w-2 animate-bounce rounded-full bg-primary" style={{ animationDelay: '0ms' }} />
                          <span className="h-2 w-2 animate-bounce rounded-full bg-primary" style={{ animationDelay: '150ms' }} />
                          <span className="h-2 w-2 animate-bounce rounded-full bg-primary" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-border/35 bg-background/80 px-3 py-3 backdrop-blur-xl md:px-4 md:py-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] md:pb-4">
          <div className="mx-auto max-w-6xl">
            {canAttachImages || canAttachDocuments ? (
              <ChatAttachmentPanel
                images={sourceImages}
                onImagesChange={setSourceImages}
                attachments={sourceAttachments}
                onAttachmentsChange={setSourceAttachments}
                canAttachImages={canAttachImages}
                canAttachDocuments={canAttachDocuments}
                disabled={isLoading}
                footer={(
                  <>
                    <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-border/40 pt-2.5 md:hidden">
                      <ModelSelector
                        type="text"
                        selectedModelId={selectedModelId}
                        onSelect={setSelectedModelId}
                        onModelChange={setSelectedModel}
                        providerName={providerName}
                        className="max-w-[70%]"
                      />
                      <p className="truncate text-[11px] text-muted-foreground">
                        {attachmentSummary || toolMetaLine || 'Модель'}
                      </p>
                    </div>
                    <div className="mt-3 hidden flex-wrap items-center justify-between gap-2 border-t border-border/40 pt-3 md:flex">
                      <ModelSelector
                        type="text"
                        selectedModelId={selectedModelId}
                        onSelect={setSelectedModelId}
                        onModelChange={setSelectedModel}
                        providerName={providerName}
                      />
                      <p className="text-xs text-muted-foreground/80">
                        Enter — отправить, Shift+Enter — новая строка, drag&drop — вложить файл
                      </p>
                    </div>
                  </>
                )}
                className="glass-card rounded-[24px] p-3 shadow-soft md:rounded-[30px] md:p-4"
              >
                {({ openFilePicker, isUploadingDocuments }) => (
                  <div className="flex items-end gap-2.5 md:gap-3">
                    <Button
                      onClick={openFilePicker}
                      variant="outline"
                      size="icon"
                      className="h-[46px] w-[46px] shrink-0 rounded-2xl border-border/60 bg-background/90 hover:border-primary/40 hover:bg-primary/5 md:h-[50px] md:w-[50px]"
                      disabled={isLoading || isUploadingDocuments}
                      title="Прикрепить файл"
                    >
                      <Upload className="h-[17px] w-[17px] md:h-[18px] md:w-[18px]" />
                    </Button>
                    <div className="chat-input-wrap relative flex-1">
                      <textarea
                        ref={inputRef}
                        value={input}
                        onChange={handleInput}
                        onKeyDown={handleKeyDown}
                        placeholder={activeConversation ? 'Продолжить диалог...' : `Написать ${modelName}...`}
                        rows={1}
                        className="min-h-[46px] max-h-32 w-full resize-none rounded-[20px] border border-border/60 bg-background/80 px-4 py-3 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground focus:border-primary/40 focus:bg-background focus:ring-4 focus:ring-primary/10 md:min-h-[50px] md:max-h-40 md:rounded-[22px] md:py-3.5"
                        disabled={isLoading || isUploadingDocuments}
                        autoComplete="off"
                        style={{ height: isMobile ? '46px' : '50px' }}
                      />
                    </div>
                    <Button
                      onClick={sendMessage}
                      disabled={!input.trim() || isLoading || isUploadingDocuments}
                      size="icon"
                      className="h-[46px] w-[46px] min-w-[46px] shrink-0 rounded-2xl gradient-hero shadow-soft transition-all hover:opacity-90 disabled:opacity-50 disabled:shadow-none md:h-[50px] md:w-[50px] md:min-w-[50px]"
                    >
                      {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                    </Button>
                  </div>
                )}
              </ChatAttachmentPanel>
            ) : (
              <div className="glass-card rounded-[24px] p-3 shadow-soft md:rounded-[30px] md:p-4">
                <div className="flex items-end gap-2.5 md:gap-3">
                  <div className="chat-input-wrap relative flex-1">
                    <textarea
                      ref={inputRef}
                      value={input}
                      onChange={handleInput}
                      onKeyDown={handleKeyDown}
                      placeholder={activeConversation ? 'Продолжить диалог...' : `Написать ${modelName}...`}
                      rows={1}
                      className="min-h-[46px] max-h-32 w-full resize-none rounded-[20px] border border-border/60 bg-background/80 px-4 py-3 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground focus:border-primary/40 focus:bg-background focus:ring-4 focus:ring-primary/10 md:min-h-[50px] md:max-h-40 md:rounded-[22px] md:py-3.5"
                      disabled={isLoading}
                      autoComplete="off"
                      style={{ height: isMobile ? '46px' : '50px' }}
                    />
                  </div>
                  <Button
                    onClick={sendMessage}
                    disabled={!input.trim() || isLoading}
                    size="icon"
                    className="h-[46px] w-[46px] min-w-[46px] shrink-0 rounded-2xl gradient-hero shadow-soft transition-all hover:opacity-90 disabled:opacity-50 disabled:shadow-none md:h-[50px] md:w-[50px] md:min-w-[50px]"
                  >
                    {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                  </Button>
                </div>
                <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-border/40 pt-2.5 md:hidden">
                  <ModelSelector
                    type="text"
                    selectedModelId={selectedModelId}
                    onSelect={setSelectedModelId}
                    onModelChange={setSelectedModel}
                    providerName={providerName}
                    className="max-w-[70%]"
                  />
                  <p className="truncate text-[11px] text-muted-foreground">{toolMetaLine || 'Модель'}</p>
                </div>
                <div className="mt-3 hidden flex-wrap items-center justify-between gap-2 border-t border-border/40 pt-3 md:flex">
                  <ModelSelector
                    type="text"
                    selectedModelId={selectedModelId}
                    onSelect={setSelectedModelId}
                    onModelChange={setSelectedModel}
                    providerName={providerName}
                  />
                  <p className="text-xs text-muted-foreground/80">
                    Enter — отправить, Shift+Enter — новая строка
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
        <SheetContent
          side={isMobile ? 'bottom' : 'left'}
          className={isMobile ? 'h-[84dvh] rounded-t-[28px] p-0' : 'w-[90vw] max-w-sm p-0'}
        >
          <AIConversationList
            title={modelName}
            conversations={conversations}
            activeConversationId={activeConversationId}
            onNewChat={startNewChat}
            onSelectConversation={selectConversation}
            onDeleteConversation={deleteConversation}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}
