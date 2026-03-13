import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { useImpersonation } from './ImpersonationContext';
import { api } from '@/api/client';

interface LessonProgress {
  lessonId: number;
  completed: boolean;
  quizCompleted: boolean;
  completedAt?: string;
}

interface ProgressContextType {
  progress: LessonProgress[];
  isLoading: boolean;
  markQuizComplete: (lessonId: number) => Promise<void>;
  isLessonCompleted: (lessonId: number) => boolean;
  isQuizCompleted: (lessonId: number) => boolean;
  hasLessonProgress: (lessonId: number) => boolean;
  getCompletedCount: () => number;
  getProgressPercentage: () => number;
  refreshProgress: () => Promise<void>;
}

const ProgressContext = createContext<ProgressContextType | undefined>(undefined);

const TOTAL_LESSONS = 21;

export function ProgressProvider({ children }: { children: ReactNode }) {
  const { user, isSessionReady } = useAuth();
  const { impersonatedUser, isImpersonating } = useImpersonation();
  const [progress, setProgress] = useState<LessonProgress[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const lastFetchedUserIdRef = useRef<string | null>(null);
  const fetchVersionRef = useRef(0);

  // Use impersonated user if admin is impersonating, otherwise use real user
  const effectiveUserId = isImpersonating ? impersonatedUser?.user_id : user?.id;

  const fetchProgress = useCallback(async (userId: string, force = false) => {
    // Skip if we already have data for this user (unless forced)
    if (!force && hasLoadedOnce && lastFetchedUserIdRef.current === userId) {
      setIsLoading(false);
      return;
    }

    const currentVersion = ++fetchVersionRef.current;
    setIsLoading(true);
    console.log('[Progress] Fetching progress for user:', userId);

    try {
      const url = isImpersonating && impersonatedUser ? `/progress?userId=${impersonatedUser.user_id}` : '/progress';
      const data = await api<Array<{ lessonId?: number; lesson_id?: number; completed?: boolean | null; quiz_completed?: boolean | null; quizCompleted?: boolean | null; completed_at?: string | null; completedAt?: string | null }>>(url);

      if (fetchVersionRef.current !== currentVersion) return;

      console.log('[Progress] Loaded:', data?.length || 0, 'progress records');

      const progressData = (data || []).map(p => ({
        lessonId: p.lessonId ?? p.lesson_id ?? 0,
        completed: p.completed ?? false,
        quizCompleted: p.quizCompleted ?? p.quiz_completed ?? false,
        completedAt: p.completedAt ?? p.completed_at ?? undefined
      })).filter(p => p.lessonId > 0);
      
      setProgress(progressData);
      lastFetchedUserIdRef.current = userId;
      setHasLoadedOnce(true);
      setIsLoading(false);
    } catch (err: any) {
      console.error('[Progress] Error:', err?.message || err);
      if (fetchVersionRef.current === currentVersion) {
        setIsLoading(false);
      }
    }
  }, [hasLoadedOnce, isImpersonating, impersonatedUser]);

  // Force refresh function for external use
  const refreshProgress = useCallback(async () => {
    if (effectiveUserId) {
      await fetchProgress(effectiveUserId, true);
    }
  }, [fetchProgress, effectiveUserId]);

  // Fetch progress only when session is ready AND we have a user (no delay needed - initialize() handles it)
  useEffect(() => {
    if (!isSessionReady) {
      console.log('[Progress] Waiting for session to be ready...');
      return;
    }
    
    if (effectiveUserId) {
      console.log('[Progress] Session ready, fetching progress for:', effectiveUserId);
      fetchProgress(effectiveUserId, true);
    } else {
      setProgress([]);
      lastFetchedUserIdRef.current = null;
      setIsLoading(false);
    }
  }, [isSessionReady, effectiveUserId, fetchProgress]);

  // Clear progress when user logs out (effectiveUserId becomes null)
  useEffect(() => {
    if (!effectiveUserId) {
      setProgress([]);
      lastFetchedUserIdRef.current = null;
    }
  }, [effectiveUserId]);

  const markQuizComplete = async (lessonId: number) => {
    if (!user) {
      console.error('markQuizComplete: No user logged in');
      return;
    }
    try {
      await api('/progress', { method: 'PUT', body: { lessonId, quizCompleted: true, completed: true } });
      await fetchProgress(user.id, true);
    } catch (error) {
      console.error('markQuizComplete: Failed to save progress', error);
      throw error;
    }
  };

  const isLessonCompleted = (lessonId: number) => {
    return progress.find(p => p.lessonId === lessonId)?.quizCompleted ?? false;
  };

  const isQuizCompleted = (lessonId: number) => {
    return progress.find(p => p.lessonId === lessonId)?.quizCompleted ?? false;
  };

  const hasLessonProgress = (lessonId: number) => {
    return progress.some(p => p.lessonId === lessonId);
  };

  const getCompletedCount = () => {
    return progress.filter(p => p.quizCompleted).length;
  };

  const getProgressPercentage = () => {
    return Math.round((getCompletedCount() / TOTAL_LESSONS) * 100);
  };

  return (
    <ProgressContext.Provider value={{
      progress,
      isLoading,
      markQuizComplete,
      isLessonCompleted,
      isQuizCompleted,
      hasLessonProgress,
      getCompletedCount,
      getProgressPercentage,
      refreshProgress,
    }}>
      {children}
    </ProgressContext.Provider>
  );
}

export function useProgress() {
  const context = useContext(ProgressContext);
  if (context === undefined) {
    throw new Error('useProgress must be used within a ProgressProvider');
  }
  return context;
}
