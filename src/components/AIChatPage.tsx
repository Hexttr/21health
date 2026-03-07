import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Send, Loader2, Sparkles, Trash2, Bot, MessageSquare, Upload, FileText, History, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useChatContext } from '@/contexts/ChatContext';
import { AIModel, ModelSelector } from '@/components/ModelSelector';
import { useBalance } from '@/contexts/BalanceContext';
import { BalanceWidget } from '@/components/BalanceWidget';
import { ChatAttachment, ChatAttachmentPanel } from '@/components/ChatAttachmentPanel';
import { AIConversationList } from '@/components/AIConversationList';
import { AIResponseContent } from '@/components/AIResponseContent';
import { getAIToolBadge, getAIToolByProvider, getAIToolByTitle } from '@/lib/ai-tools';
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
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const skipConversationSyncRef = useRef(false);
  const chatContext = useChatContext();
  const { refreshBalance } = useBalance();
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
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
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

  const startNewChat = useCallback(() => {
    skipConversationSyncRef.current = true;
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
      setActiveConversationId(nextConversation?.id || null);
      setMessages(nextConversation ? deserializeMessages(nextConversation.messages) : []);
      setSourceImages([]);
      setSourceAttachments([]);
    }
    toast.success('Диалог удалён');
  }, [activeConversationId, conversations]);

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
    setMessages(newMessages);
    setInput('');
    setSourceImages([]);
    setSourceAttachments([]);
    setIsLoading(true);

    let assistantContent = '';

    try {
      const token = localStorage.getItem('token');
      const apiUrl = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? '/api' : 'http://localhost:3001/api');
      const response = await fetch(`${apiUrl}/ai/chat`, {
        method: 'POST',
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

      if (response.status === 429) { toast.error('Превышен лимит запросов. Попробуйте позже.'); setIsLoading(false); return; }
      if (response.status === 402) { toast.error('Необходимо пополнить баланс.'); setIsLoading(false); return; }
      if (response.status === 401) { toast.error('Войдите в аккаунт для использования чата'); setIsLoading(false); return; }
      if (response.status === 404) { toast.error('Сервер не найден. Убедитесь, что backend запущен.'); setIsLoading(false); return; }

      if (!response.ok || !response.body) {
        const errData = await response.json().catch(() => ({}));
        const errMsg = typeof errData?.error === 'string' ? errData.error : errData?.error?.message || `Ошибка ${response.status}`;
        toast.error(errMsg);
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
      setTimeout(() => refreshBalance(), 500);
    } catch (error) {
      console.error('AI chat error:', error);
      toast.error('Ошибка при отправке сообщения');
      setMessages(newMessages);
    } finally {
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
    <div className="gradient-surface mesh-bg flex h-full min-h-0">
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

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-border/40 bg-background/72 backdrop-blur-xl">
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
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
                <div className="truncate font-serif text-lg font-semibold text-foreground">{modelName}</div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
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

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setHistoryOpen(true)}
                className="xl:hidden rounded-xl text-muted-foreground hover:text-foreground"
                title="История диалогов"
              >
                <History className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={startNewChat} className="hidden sm:inline-flex rounded-xl gap-2">
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

        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto flex min-h-full max-w-6xl flex-col px-4 py-7">
            {messages.length === 0 ? (
              <div className="flex min-h-[58vh] flex-col items-center justify-center text-center animate-fade-in-up">
                <div className="mb-6 flex h-20 w-20 items-center justify-center overflow-hidden rounded-3xl border border-border/50 bg-card shadow-large">
                  {getModelIconPath(modelName) ? (
                    <img src={getModelIconPath(modelName)!} alt="" className="h-14 w-14 object-contain" />
                  ) : (
                    <div className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${modelColor}`}>
                      <Sparkles className="h-10 w-10 text-white" />
                    </div>
                  )}
                </div>
                <h2 className="mb-3 font-serif text-3xl font-semibold text-foreground">
                  Начните диалог с {modelName}
                </h2>
                <div className="mb-4 flex flex-wrap items-center justify-center gap-2">
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
                <p className="max-w-xl text-balance text-sm leading-7 text-muted-foreground">
                  {canAttachImages && canAttachDocuments
                    ? 'Задайте вопрос, приложите документ, таблицу, презентацию или скрин и получите аккуратно оформленный разбор.'
                    : canAttachDocuments
                      ? 'Задайте вопрос и приложите документ, таблицу или презентацию для анализа.'
                      : canAttachImages
                        ? 'Задайте вопрос, приложите скрин или фото и попросите модель разобрать материал.'
                        : 'Задайте любой вопрос, попросите помочь с задачей или обсудите тему урока.'}
                </p>
                <div className="mt-10 grid w-full max-w-2xl gap-3 md:grid-cols-2">
                  {initialPrompts.map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => {
                        setInput(suggestion);
                        inputRef.current?.focus();
                      }}
                      className="ai-shell-surface card-hover rounded-2xl px-4 py-4 text-left text-sm font-medium text-foreground transition-all duration-200 hover:border-primary/30 hover:bg-background"
                    >
                      <span className="mr-2 text-primary">→</span>
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-8 md:space-y-10">
                {messages.map((message, index) => (
                  <div
                    key={index}
                    className={message.role === 'user' ? 'flex justify-end' : 'flex justify-start'}
                  >
                    {message.role === 'assistant' && (
                      <div className="flex w-full max-w-4xl gap-4">
                        <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border/50 bg-card shadow-soft">
                          {getModelIconPath(modelName) ? (
                            <img src={getModelIconPath(modelName)!} alt="" className="h-5 w-5 object-contain" />
                          ) : (
                            <div className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${modelColor}`}>
                              <Bot className="h-4 w-4 text-white" />
                            </div>
                          )}
                        </div>

                        <article className="ai-reading-surface min-w-0 flex-1 px-5 py-5 md:px-7 md:py-6">
                          <div className="mb-4 flex items-center gap-3 border-b border-border/40 pb-3">
                            <div className="ai-kicker">Ответ {modelName}</div>
                            <div className="h-1 w-1 rounded-full bg-muted-foreground/35" />
                            <div className="text-xs text-muted-foreground">Структурированный разбор</div>
                          </div>

                          {((message.contextAttachments && message.contextAttachments.length > 0) || (message.contextImages && message.contextImages.length > 0)) && (
                            <div className="mb-5 space-y-3 border-b border-border/35 pb-5">
                              <div className="ai-kicker">Контекст запроса</div>

                              {message.contextAttachments && message.contextAttachments.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                  {message.contextAttachments.map((attachment) => (
                                    <div key={attachment.id} className="ai-context-chip max-w-full">
                                      <FileText className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" />
                                      <div className="min-w-0">
                                        <div className="truncate text-xs font-medium text-foreground">{attachment.originalName}</div>
                                        <div className="text-[11px] leading-5 text-muted-foreground">
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
                                      <img src={url} alt="" className="h-14 w-14 rounded-xl object-cover" />
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
                      <div className="ml-auto flex max-w-[min(40rem,88%)] items-end gap-3">
                        <div className="rounded-[28px] border border-white/20 gradient-hero px-4 py-3.5 text-primary-foreground shadow-soft">
                          <div className="space-y-3">
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
                                  <img key={`${url}-${imageIndex}`} src={url} alt="" className="h-12 w-12 rounded-xl border border-white/30 object-cover" />
                                ))}
                                {message.sourceImages.length > 6 && <span className="self-center text-xs opacity-80">+{message.sourceImages.length - 6}</span>}
                              </div>
                            )}
                            <p className="whitespace-pre-wrap text-[14px] leading-7">{message.content}</p>
                          </div>
                        </div>

                        <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-border/50 bg-background/90 shadow-soft">
                          <MessageSquare className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
                  <div className="flex justify-start">
                    <div className="flex w-full max-w-4xl gap-4">
                      <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border/50 bg-card shadow-soft">
                        {getModelIconPath(modelName) ? (
                          <img src={getModelIconPath(modelName)!} alt="" className="h-5 w-5 object-contain" />
                        ) : (
                          <div className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${modelColor}`}>
                            <Bot className="h-4 w-4 text-white" />
                          </div>
                        )}
                      </div>
                      <div className="ai-reading-surface max-w-xl px-6 py-5">
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

        <div className="border-t border-border/35 bg-background/78 px-4 py-4 backdrop-blur-xl">
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
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border/40 pt-3">
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
                )}
                className="glass-card rounded-[30px] p-4 shadow-soft"
              >
                {({ openFilePicker, isUploadingDocuments }) => (
                  <div className="flex items-end gap-3">
                    <Button
                      onClick={openFilePicker}
                      variant="outline"
                      size="icon"
                      className="h-[50px] w-[50px] shrink-0 rounded-2xl border-border/60 bg-background/90 hover:border-primary/40 hover:bg-primary/5"
                      disabled={isLoading || isUploadingDocuments}
                      title="Прикрепить файл"
                    >
                      <Upload className="h-[18px] w-[18px]" />
                    </Button>
                    <div className="chat-input-wrap relative flex-1">
                      <textarea
                        ref={inputRef}
                        value={input}
                        onChange={handleInput}
                        onKeyDown={handleKeyDown}
                        placeholder={activeConversation ? 'Продолжить диалог...' : `Написать ${modelName}...`}
                        rows={1}
                        className="min-h-[50px] max-h-40 w-full resize-none rounded-[22px] border border-border/60 bg-background/80 px-4 py-3.5 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground focus:border-primary/40 focus:bg-background focus:ring-4 focus:ring-primary/10"
                        disabled={isLoading || isUploadingDocuments}
                        autoComplete="off"
                        style={{ height: '50px' }}
                      />
                    </div>
                    <Button
                      onClick={sendMessage}
                      disabled={!input.trim() || isLoading || isUploadingDocuments}
                      size="icon"
                      className="h-[50px] w-[50px] min-w-[50px] shrink-0 rounded-2xl gradient-hero shadow-soft transition-all hover:opacity-90 disabled:opacity-50 disabled:shadow-none"
                    >
                      {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                    </Button>
                  </div>
                )}
              </ChatAttachmentPanel>
            ) : (
              <div className="glass-card rounded-[30px] p-4 shadow-soft">
                <div className="flex items-end gap-3">
                  <div className="chat-input-wrap relative flex-1">
                    <textarea
                      ref={inputRef}
                      value={input}
                      onChange={handleInput}
                      onKeyDown={handleKeyDown}
                      placeholder={activeConversation ? 'Продолжить диалог...' : `Написать ${modelName}...`}
                      rows={1}
                      className="min-h-[50px] max-h-40 w-full resize-none rounded-[22px] border border-border/60 bg-background/80 px-4 py-3.5 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground focus:border-primary/40 focus:bg-background focus:ring-4 focus:ring-primary/10"
                      disabled={isLoading}
                      autoComplete="off"
                      style={{ height: '50px' }}
                    />
                  </div>
                  <Button
                    onClick={sendMessage}
                    disabled={!input.trim() || isLoading}
                    size="icon"
                    className="h-[50px] w-[50px] min-w-[50px] shrink-0 rounded-2xl gradient-hero shadow-soft transition-all hover:opacity-90 disabled:opacity-50 disabled:shadow-none"
                  >
                    {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                  </Button>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border/40 pt-3">
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
        <SheetContent side="left" className="w-[90vw] max-w-sm p-0">
          <SheetHeader className="px-4 pt-6">
            <SheetTitle>Диалоги</SheetTitle>
            <SheetDescription>{modelName}</SheetDescription>
          </SheetHeader>
          <div className="h-[calc(100%-72px)]">
            <AIConversationList
              title={modelName}
              conversations={conversations}
              activeConversationId={activeConversationId}
              onNewChat={startNewChat}
              onSelectConversation={selectConversation}
              onDeleteConversation={deleteConversation}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
