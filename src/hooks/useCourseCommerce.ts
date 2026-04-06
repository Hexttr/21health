import { useCallback, useEffect, useState } from 'react';
import { api } from '@/api/client';
import { useAuth } from '@/contexts/AuthContext';
import { useImpersonation } from '@/contexts/ImpersonationContext';

export interface CourseProduct {
  id: string;
  code: string;
  title: string;
  description: string;
  durationDays: number;
  grantedLessons: number;
  priceRub: string;
  upgradePriceRub?: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface CourseAccessState {
  role: 'admin' | 'student_14' | 'student_21' | 'ai_user';
  courseCode: string | null;
  courseTitle: string | null;
  grantedLessons: number;
  hasCourseAccess: boolean;
  canUpgradeTo21: boolean;
}

export function useCourseCommerce() {
  const { isSessionReady, isAuthenticated } = useAuth();
  const { impersonatedUser, isImpersonating } = useImpersonation();
  const [courses, setCourses] = useState<CourseProduct[]>([]);
  const [access, setAccess] = useState<CourseAccessState | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!isSessionReady || !isAuthenticated) {
      setLoading(false);
      setCourses([]);
      setAccess(null);
      return;
    }

    setLoading(true);
    try {
      const accessQuery = isImpersonating && impersonatedUser?.user_id
        ? `?userId=${encodeURIComponent(impersonatedUser.user_id)}`
        : '';
      const [courseRows, accessRow] = await Promise.all([
        api<CourseProduct[]>('/courses'),
        api<CourseAccessState>(`/course-access${accessQuery}`),
      ]);
      setCourses(courseRows);
      setAccess(accessRow);
    } catch (error) {
      console.error('[CourseCommerce] Error:', error);
    } finally {
      setLoading(false);
    }
  }, [impersonatedUser?.user_id, isAuthenticated, isImpersonating, isSessionReady]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    courses,
    access,
    loading,
    refresh,
  };
}
