import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { api } from '@/api/client';
import { useAuth } from '@/contexts/AuthContext';
import { CourseViewMode } from './useCourseViewMode';
import { useImpersonation } from '@/contexts/ImpersonationContext';

interface LessonVisibilityRow {
  lessonId: number;
  isPublished?: boolean | null;
}

export function usePublishedLessons(viewMode: CourseViewMode = 'student') {
  const { isSessionReady } = useAuth();
  const { impersonatedUser, isImpersonating } = useImpersonation();
  
  // ALL useState hooks FIRST (critical for HMR stability)
  const [visibleLessons, setVisibleLessons] = useState<Set<number>>(new Set());
  const [publishedLessons, setPublishedLessons] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  
  // Then refs (don't affect hook order for HMR)
  const isFetchingRef = useRef(false);
  const hasFetchedRef = useRef(false);
  const mountedRef = useRef(true);

  const loadPublishedLessons = useCallback(async (force = false) => {
    // Skip if already fetching
    if (isFetchingRef.current) {
      console.log('[PublishedLessons] Already fetching, skipping');
      return;
    }
    
    // Skip if already loaded (unless forced)
    if (!force && hasFetchedRef.current) {
      console.log('[PublishedLessons] Already loaded, skipping (use force=true to reload)');
      setLoading(false);
      return;
    }

    isFetchingRef.current = true;
    setLoading(true);
    console.log('[PublishedLessons] Starting fetch, force:', force, 'timestamp:', Date.now());
    
    try {
      const params = new URLSearchParams();
      if (viewMode === 'all') {
        params.set('viewMode', 'all');
      }
      if (isImpersonating && impersonatedUser?.user_id) {
        params.set('userId', impersonatedUser.user_id);
      }
      const query = params.toString() ? `?${params.toString()}` : '';
      const data = await api<LessonVisibilityRow[]>(`/lessons${query}`);

      if (!mountedRef.current) {
        console.log('[PublishedLessons] Component unmounted, ignoring response');
        return;
      }

      console.log('[PublishedLessons] Loaded:', data?.length || 0, 'published lessons');
      
      const nextVisibleLessons = new Set((data || []).map(item => item.lessonId));
      const nextPublishedLessons = new Set((data || []).filter(item => item.isPublished).map(item => item.lessonId));
      console.log('[PublishedLessons] Setting lessons:', Array.from(nextVisibleLessons));
      
      setVisibleLessons(nextVisibleLessons);
      setPublishedLessons(nextPublishedLessons);
      hasFetchedRef.current = true;
      setLoading(false);
      isFetchingRef.current = false;
    } catch (err: any) {
      console.error('[PublishedLessons] Error:', err?.message || err);
      if (mountedRef.current) {
        setLoading(false);
        isFetchingRef.current = false;
      }
    }
  }, [impersonatedUser?.user_id, isImpersonating, viewMode]);

  // Load only when session is ready - ALWAYS force fetch on mount to bypass cache
  useEffect(() => {
    mountedRef.current = true;
    
    if (!isSessionReady) {
      console.log('[PublishedLessons] Waiting for session to be ready...');
      return;
    }
    
    console.log('[PublishedLessons] Session ready, initiating load');
    // Always force on initial load to bypass any stale cache
    loadPublishedLessons(true);
    
    return () => {
      mountedRef.current = false;
    };
  }, [isSessionReady, loadPublishedLessons, viewMode]);

  // Memoized check function - depends on publishedLessons state
  const isLessonPublished = useCallback((lessonId: number): boolean => {
    const result = publishedLessons.has(lessonId);
    // Debug log only for lesson 1 to reduce noise
    if (lessonId === 1) {
      console.log('[PublishedLessons] isLessonPublished(1):', result, 'set size:', publishedLessons.size);
    }
    return result;
  }, [publishedLessons]);

  const isLessonVisible = useCallback((lessonId: number): boolean => {
    return visibleLessons.has(lessonId);
  }, [visibleLessons]);

  const refreshPublishedLessons = useCallback(async () => {
    console.log('[PublishedLessons] Manual refresh requested');
    hasFetchedRef.current = false;
    isFetchingRef.current = false;
    await loadPublishedLessons(true);
  }, [loadPublishedLessons]);

  const publishedLessonIds = useMemo(
    () => Array.from(publishedLessons).sort((a, b) => a - b),
    [publishedLessons]
  );

  const visibleLessonIds = useMemo(
    () => Array.from(visibleLessons).sort((a, b) => a - b),
    [visibleLessons]
  );

  return { 
    isLessonVisible,
    isLessonPublished, 
    publishedLessonIds,
    visibleLessonIds,
    loading, 
    refreshPublishedLessons, 
    publishedCount: publishedLessons.size,
    visibleCount: visibleLessons.size,
  };
}
