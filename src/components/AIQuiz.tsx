import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Lesson } from '@/data/courseData';
import { useProgress } from '@/contexts/ProgressContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sparkles, Send, Loader2, CheckCircle2, X, Bot, Target } from 'lucide-react';
import { api } from '@/api/client';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';
import { CourseViewMode } from '@/hooks/useCourseViewMode';

interface AIQuizProps {
  lesson: Lesson;
  onClose: () => void;
  courseViewMode?: CourseViewMode;
}

interface Message {
  role: 'assistant' | 'user';
  content: string;
}

interface LearningCriterion {
  id: string;
  topic: string;
  description: string;
  passed: boolean;
}

interface LearningState {
  criteria: LearningCriterion[];
  current_criterion: string;
  all_passed?: boolean;
}

// Function to strip thinking tags from AI responses (kept for safety, but no longer needed with tool calling)
function cleanAIResponse(response: string): string {
  return response
    .replace(/<thinking>[\s\S]*?<\/thinking>\s*/gi, '')
    .trim();
}

// Limit server history per criterion context (not visual history)
const MAX_CRITERION_HISTORY = 4;

export function AIQuiz({ lesson, onClose, courseViewMode = 'student' }: AIQuizProps) {
  const { markQuizComplete } = useProgress();
  const isMobile = useIsMobile();
  const [messages, setMessages] = useState<Message[]>([]); // Visual history (what user sees)
  const [serverHistory, setServerHistory] = useState<Message[]>([]); // Context for AI (cleared per criterion)
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [customPrompt, setCustomPrompt] = useState<string | null>(null);
  const [customPromptIsOverride, setCustomPromptIsOverride] = useState(false);
  const [learningState, setLearningState] = useState<LearningState | null>(null);
  const [waitingLong, setWaitingLong] = useState(false);
  const waitingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCriterionRef = useRef<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  React.useEffect(() => {
    if (!isInitialized) {
      loadCustomPromptAndInitialize();
    }
  }, [isInitialized]);

  const loadCustomPromptAndInitialize = async (retryCount = 0) => {
    const MAX_RETRIES = 3;
    setIsLoading(true);
    console.log(`[AIQuiz] Initializing lesson ${lesson.id}, attempt ${retryCount + 1}/${MAX_RETRIES}`);
    
    try {
      // Load custom AI prompt from lesson_content
      let prompt: string | null = null;
      let promptIsOverride = false;
      try {
        const query = courseViewMode === 'all' ? '?viewMode=all' : '';
        const lessonData = await api<{ aiPrompt: string | null; aiPromptIsOverride?: boolean }>(`/lessons/${lesson.id}${query}`);
        prompt = lessonData?.aiPrompt || null;
        promptIsOverride = lessonData?.aiPromptIsOverride === true;
      } catch {
        // Lesson content may not exist
      }
      setCustomPrompt(prompt);
      setCustomPromptIsOverride(promptIsOverride);
      console.log(`[AIQuiz] Custom prompt loaded: ${prompt ? 'yes' : 'no'}`);

      // Initialize quiz - AI will create learning plan
      console.log('[AIQuiz] Calling ai-quiz...');
      const responseData = await api<{ response: string; learningState: unknown }>('/ai/quiz', {
        method: 'POST',
        body: {
          lessonTitle: lesson.title,
          lessonDescription: lesson.description,
          videoTopics: lesson.videoTopics,
          userAnswer: null,
          conversationHistory: [],
          customPrompt: prompt,
          customPromptIsOverride: promptIsOverride,
          learningState: null
        }
      });

      const aiResponse = cleanAIResponse(responseData?.response || 'Привет! Давайте начнём обучение.');
      const newState = responseData?.learningState;
      
      console.log(`[AIQuiz] Got ${newState?.criteria?.length || 0} criteria`);
      
      // Validate that we got a proper learning state with criteria
      if (!newState || !newState.criteria || newState.criteria.length === 0) {
        throw new Error('Invalid learning state received from AI');
      }
      
      setLearningState(newState);
      setMessages([{ role: 'assistant', content: aiResponse }]);
      // Initialize server history with just the first AI message
      setServerHistory([{ role: 'assistant', content: aiResponse }]);
      lastCriterionRef.current = newState.current_criterion;
      setIsInitialized(true);
      console.log('[AIQuiz] Initialization complete');
    } catch (error) {
      console.error(`[AIQuiz] Error initializing (attempt ${retryCount + 1}/${MAX_RETRIES}):`, error);
      
      // Retry if we haven't exceeded max retries
      if (retryCount < MAX_RETRIES - 1) {
        const delay = (retryCount + 1) * 2000; // 2s, 4s, 6s
        toast.info(`Повторная попытка через ${delay / 1000} сек...`);
        setTimeout(() => {
          loadCustomPromptAndInitialize(retryCount + 1);
        }, delay);
        return;
      }
      
      // All retries exhausted - show error with details
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error('[AIQuiz] All retries exhausted:', errorMsg);
      toast.error('Не удалось загрузить AI-тьютора');
      setMessages([{ 
        role: 'assistant', 
        content: `К сожалению, AI-тьютор временно недоступен (${errorMsg}). Попробуйте закрыть окно и открыть снова.` 
      }]);
      setIsInitialized(true);
    } finally {
      setIsLoading(false);
    }
  };

  // Store message for retries outside of handleSubmit
  const pendingMessageRef = React.useRef<string | null>(null);

  const handleSubmit = async (e: React.FormEvent, retryCount = 0, retryMessage?: string) => {
    e.preventDefault();
    const MAX_RETRIES = 3;
    
    // For retries, use stored message; for new submissions, use input
    const userMessage = retryMessage || input.trim();
    
    // Block only new submissions when loading, allow retries
    if (!userMessage || (isLoading && retryCount === 0)) return;

    const originalInput = input;
    
    // Only update UI on first attempt
    if (retryCount === 0) {
      pendingMessageRef.current = userMessage;
      setInput('');
      setMessages(prev => [...prev, { role: 'user' as const, content: userMessage }]);
    }
    
    setIsLoading(true);

    // Store current state for recovery
    const previousLearningState = learningState;
    const previousMessagesCount = messages.length; // Track message count before adding user message

    try {
      // Start "waiting long" timer after 8 seconds
      waitingTimerRef.current = setTimeout(() => setWaitingLong(true), 8000);
      
      // Use isolated server history (only current criterion context)
      const contextHistory = [...serverHistory.slice(-MAX_CRITERION_HISTORY), { role: 'user' as const, content: userMessage }];
      console.log(`[AIQuiz] Sending ${contextHistory.length} messages (criterion: ${learningState?.current_criterion}, retry: ${retryCount})`);
      
      const responseData = await api<{ response: string; learningState: unknown; allPassed?: boolean }>('/ai/quiz', {
        method: 'POST',
        body: {
          lessonTitle: lesson.title,
          lessonDescription: lesson.description,
          videoTopics: lesson.videoTopics,
          userAnswer: userMessage,
          conversationHistory: contextHistory,
          customPrompt,
          customPromptIsOverride,
          learningState
        }
      });

      const aiResponse = cleanAIResponse(responseData?.response || 'Продолжаем...');
      const newState = responseData?.learningState;
      const allPassed = responseData?.allPassed;
      
      // Only update learning state if we got valid data
      if (newState && newState.criteria && Array.isArray(newState.criteria)) {
        setLearningState(newState);
        
        // Check if criterion changed - if so, reset server history for new context
        const previousCriterion = lastCriterionRef.current;
        const newCriterion = newState.current_criterion;
        
        if (previousCriterion !== newCriterion) {
          // Criterion passed! Start fresh context with just the AI's response
          console.log(`[AIQuiz] Criterion passed: ${previousCriterion} → ${newCriterion}. Clearing context.`);
          setServerHistory([{ role: 'assistant', content: aiResponse }]);
          lastCriterionRef.current = newCriterion;
        } else {
          // Same criterion - add to history but keep it limited
          setServerHistory(prev => [
            ...prev.slice(-(MAX_CRITERION_HISTORY - 2)),
            { role: 'user', content: userMessage },
            { role: 'assistant', content: aiResponse }
          ]);
        }
      } else {
        console.warn('Invalid learning state received, keeping previous state');
        // Still update server history even if learning state is invalid
        setServerHistory(prev => [
          ...prev.slice(-(MAX_CRITERION_HISTORY - 2)),
          { role: 'user', content: userMessage },
          { role: 'assistant', content: aiResponse }
        ]);
      }
      
      // Always update visual history (what user sees)
      setMessages(prev => [...prev, { role: 'assistant', content: aiResponse }]);
      pendingMessageRef.current = null; // Clear pending message on success
      
      // Check if all criteria passed
      if (allPassed) {
        setIsComplete(true);
        try {
          await markQuizComplete(lesson.id, courseViewMode);
          toast.success('Поздравляем! Все критерии пройдены! 🎉');
        } catch (saveError) {
          console.error('Failed to save quiz completion:', saveError);
          toast.error('Урок пройден, но не удалось сохранить прогресс. Попробуйте обновить страницу.');
        }
      }
    } catch (error) {
      console.error(`Error in quiz (attempt ${retryCount + 1}/${MAX_RETRIES}):`, error);
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const isTimeout = errorMessage.includes('abort') || errorMessage.includes('timeout');
      const isNetworkError = errorMessage.includes('fetch') || errorMessage.includes('network');
      
      // Auto-retry on timeout or network errors
      if ((isTimeout || isNetworkError) && retryCount < MAX_RETRIES - 1) {
        const delay = (retryCount + 1) * 2000; // 2s, 4s, 6s
        toast.info(`Повторная попытка ${retryCount + 2}/${MAX_RETRIES}...`);
        
        // Clear timer before retry
        if (waitingTimerRef.current) {
          clearTimeout(waitingTimerRef.current);
          waitingTimerRef.current = null;
        }
        setWaitingLong(false);
        setIsLoading(false);
        
        setTimeout(() => {
          const syntheticEvent = { preventDefault: () => {} } as React.FormEvent;
          handleSubmit(syntheticEvent, retryCount + 1, pendingMessageRef.current || userMessage);
        }, delay);
        return;
      }
      
      // All retries exhausted or non-retriable error
      pendingMessageRef.current = null;
      
      if (isTimeout) {
        toast.error(`Не удалось отправить ответ после ${MAX_RETRIES} попыток. Проверьте соединение.`);
        setInput(originalInput);
        // Remove user message that was added
        setMessages(prev => prev.slice(0, previousMessagesCount));
      } else if (isNetworkError) {
        toast.error('Ошибка сети. Проверьте соединение и попробуйте снова.');
        setInput(originalInput);
        setMessages(prev => prev.slice(0, previousMessagesCount));
      } else {
        toast.error('Ошибка при отправке ответа. Попробуйте снова.');
        setMessages(prev => [...prev, { role: 'assistant', content: 'Произошла ошибка. Пожалуйста, попробуйте отправить ваш ответ ещё раз.' }]);
      }
      
      if (previousLearningState) {
        setLearningState(previousLearningState);
      }
    } finally {
      // Clear waiting timer and reset states
      if (waitingTimerRef.current) {
        clearTimeout(waitingTimerRef.current);
        waitingTimerRef.current = null;
      }
      setWaitingLong(false);
      setIsLoading(false);
    }
  };

  // Calculate progress based on passed criteria
  const passedCount = learningState?.criteria.filter(c => c.passed).length || 0;
  const totalCount = learningState?.criteria.length || 1;
  const progressPercent = (passedCount / totalCount) * 100;

  return (
    <div className="bg-card rounded-2xl sm:rounded-3xl border border-border/50 shadow-soft overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-5 sm:p-6 border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl gradient-hero flex items-center justify-center shadow-glow">
            <Sparkles className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h3 className="font-serif font-semibold text-foreground">AI-тьютор</h3>
            <p className="text-sm text-muted-foreground">Адаптивная проверка знаний</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="rounded-xl hover:bg-secondary/50">
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="p-5 sm:p-6">
        {/* Learning Criteria Progress */}
        {learningState && learningState.criteria.length > 0 && (
          <div className="mb-5 p-4 rounded-xl bg-secondary/30 border border-border/50">
            <div className="flex items-center gap-2 mb-3">
              <Target className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">Критерии обучения</span>
              <span className="ml-auto text-sm text-muted-foreground">
                {passedCount}/{totalCount}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {learningState.criteria.map((criterion) => (
                <div
                  key={criterion.id}
                  className={`
                    px-3 py-1.5 rounded-full text-xs font-medium transition-all
                    ${criterion.passed 
                      ? 'bg-success/20 text-success border border-success/30' 
                      : criterion.id === learningState.current_criterion
                        ? 'bg-primary/20 text-primary border border-primary/30 animate-pulse'
                        : 'bg-muted text-muted-foreground border border-border/50'
                    }
                  `}
                  title={criterion.description}
                >
                  {criterion.passed && <CheckCircle2 className="w-3 h-3 inline mr-1" />}
                  {criterion.topic}
                </div>
              ))}
            </div>
            {/* Progress bar */}
            <div className="mt-3 h-1.5 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-primary to-success transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="space-y-4 mb-5 max-h-[50vh] md:max-h-80 overflow-y-auto scroll-smooth">
          {messages.map((message, index) => (
            <div key={index} className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : ''}`}>
              {message.role === 'assistant' && (
                <div className="w-8 h-8 rounded-lg gradient-hero flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-primary-foreground" />
                </div>
              )}
              <div className={`max-w-[85%] p-4 rounded-2xl ${message.role === 'user' ? 'gradient-hero text-primary-foreground' : 'bg-secondary/50 border border-border/50'}`}>
                <div className="text-sm leading-relaxed prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0">
                  <ReactMarkdown>{message.role === 'assistant' ? cleanAIResponse(message.content) : message.content}</ReactMarkdown>
                </div>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-lg gradient-hero flex items-center justify-center">
                <Bot className="w-4 h-4 text-primary-foreground" />
              </div>
              <div className="bg-secondary/50 border border-border/50 p-4 rounded-2xl">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  {waitingLong && (
                    <span className="text-sm text-muted-foreground animate-pulse">
                      AI думает над ответом...
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input - use simple Input on mobile for better keyboard handling */}
        {!isComplete ? (
          <form onSubmit={handleSubmit} className="flex gap-3">
            <Input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Введите ваш ответ..."
              className="h-[52px] rounded-xl border-border/50 bg-secondary/30 focus:border-primary text-base"
              disabled={isLoading || !isInitialized}
              autoComplete="off"
              enterKeyHint="send"
            />
            <Button 
              type="submit" 
              size="icon" 
              disabled={isLoading || !input.trim()} 
              className="h-[52px] w-[52px] min-w-[52px] rounded-xl gradient-hero shadow-glow hover:opacity-90"
            >
              <Send className="w-5 h-5" />
            </Button>
          </form>
        ) : (
          <div className="flex items-center justify-center gap-3 p-5 rounded-xl bg-success-soft border border-success/20">
            <CheckCircle2 className="w-6 h-6 text-success" />
            <span className="font-semibold text-success">Все критерии пройдены! Отличная работа!</span>
          </div>
        )}
      </div>
    </div>
  );
}