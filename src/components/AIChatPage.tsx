import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Bot, Send, Loader2, Sparkles, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import { useIsMobile } from '@/hooks/use-mobile';

type Message = {
  role: 'user' | 'assistant';
  content: string;
};

interface AIChatPageProps {
  model: string;
  modelName: string;
  modelIcon: string;
  modelColor: string;
}

// LocalStorage key for chat history
const getChatStorageKey = (modelName: string) => `ai-chat-${modelName.toLowerCase()}`;

export function AIChatPage({ model, modelName, modelIcon, modelColor }: AIChatPageProps) {
  const isMobile = useIsMobile();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  // Load messages from localStorage on mount
  useEffect(() => {
    const storageKey = getChatStorageKey(modelName);
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setMessages(parsed);
        }
      } catch (e) {
        console.warn('Failed to parse saved chat:', e);
      }
    }
  }, [modelName]);

  // Save messages to localStorage when they change
  useEffect(() => {
    if (messages.length > 0) {
      const storageKey = getChatStorageKey(modelName);
      localStorage.setItem(storageKey, JSON.stringify(messages));
    }
  }, [messages, modelName]);

  // Clear chat history
  const clearChat = useCallback(() => {
    const storageKey = getChatStorageKey(modelName);
    localStorage.removeItem(storageKey);
    setMessages([]);
    toast.success('Чат очищен');
  }, [modelName]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: input.trim() };
    const newMessages = [...messages, userMessage];
    
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    let assistantContent = '';

    try {
      const token = localStorage.getItem('token');
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
      const response = await fetch(`${apiUrl}/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({ messages: newMessages, model }),
      });

      if (response.status === 429) {
        toast.error('Превышен лимит запросов. Попробуйте позже.');
        setIsLoading(false);
        return;
      }

      if (response.status === 402) {
        toast.error('Необходимо пополнить баланс.');
        setIsLoading(false);
        return;
      }

      if (!response.ok || !response.body) {
        throw new Error('Failed to start stream');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';

      // Add assistant message placeholder
      setMessages([...newMessages, { role: 'assistant', content: '' }]);

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
          if (jsonStr === '[DONE]') break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantContent += content;
              setMessages(prev => {
                const lastMessage = prev[prev.length - 1];
                if (lastMessage?.role === 'assistant') {
                  return [
                    ...prev.slice(0, -1),
                    { ...lastMessage, content: assistantContent },
                  ];
                }
                return prev;
              });
            }
          } catch {
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }
    } catch (error) {
      console.error('AI chat error:', error);
      toast.error('Ошибка при отправке сообщения');
      setMessages(newMessages);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="min-h-screen bg-background mesh-bg">
      <div className="h-screen flex flex-col">
        {/* Header */}
        <header className="flex-shrink-0 border-b border-border/50 bg-card/80 backdrop-blur-sm p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${modelColor} flex items-center justify-center`}>
                <span className="text-xl">{modelIcon}</span>
              </div>
              <div>
                <h1 className="font-serif text-xl font-semibold text-foreground">
                  {modelName}
                </h1>
                <p className="text-sm text-muted-foreground">
                  Чат с искусственным интеллектом
                </p>
              </div>
            </div>
            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearChat}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Очистить
              </Button>
            )}
          </div>
        </header>

        {/* Chat Content */}
        <div className="flex-1 flex flex-col min-h-0 p-4">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto pr-2 md:pr-4 min-h-0 scroll-smooth">
            <div className="space-y-4 pb-4">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[40vh] md:h-[50vh] text-center">
                  <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${modelColor} flex items-center justify-center mb-4`}>
                    <Sparkles className="w-8 h-8 text-white" />
                  </div>
                  <h2 className="text-lg font-semibold text-foreground mb-2">
                    Начните диалог с {modelName}
                  </h2>
                  <p className="text-muted-foreground max-w-sm">
                    Задайте любой вопрос или попросите помочь с задачей
                  </p>
                </div>
              ) : (
                messages.map((message, index) => (
                  <div
                    key={index}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] md:max-w-[80%] rounded-2xl px-4 py-3 ${
                        message.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-card border border-border/50'
                      }`}
                    >
                      {message.role === 'assistant' ? (
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                          <ReactMarkdown>{message.content}</ReactMarkdown>
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap">{message.content}</p>
                      )}
                    </div>
                  </div>
                ))
              )}
              {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
                <div className="flex justify-start">
                  <div className="bg-card border border-border/50 rounded-2xl px-4 py-3">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input - use simple Input for better mobile keyboard handling */}
          <div className="flex-shrink-0 pt-4 border-t border-border/50">
            <div className="flex gap-3">
              <Input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder={`Напишите сообщение...`}
                className="h-[52px] text-base"
                disabled={isLoading}
                autoComplete="off"
                enterKeyHint="send"
              />
              <Button
                onClick={sendMessage}
                disabled={!input.trim() || isLoading}
                size="icon"
                className="h-[52px] w-[52px] min-w-[52px] shrink-0"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
