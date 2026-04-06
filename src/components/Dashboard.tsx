import React, { useState } from 'react';
import { courseData, getLessonById } from '@/data/courseData';
import { useAuth } from '@/contexts/AuthContext';
import { useProgress } from '@/contexts/ProgressContext';
import { usePublishedLessons } from '@/hooks/usePublishedLessons';
import { useCourseViewMode } from '@/hooks/useCourseViewMode';
import { useCourseCommerce } from '@/hooks/useCourseCommerce';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { WeekCard } from './WeekCard';
import { LessonView } from './LessonView';
import { PracticalMaterials } from './PracticalMaterials';
import { TestimonialsSection } from './TestimonialsSection';
import { 
  BookOpen, 
  Target, 
  Trophy,
  ArrowRight,
  Play,
  Sparkles,
  LogOut,
  RefreshCw,
  Shield,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useImpersonation } from '@/contexts/ImpersonationContext';
import { toast } from 'sonner';
import { api } from '@/api/client';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Dashboard() {
  const { user, signOut, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedLessonId, setSelectedLessonId] = useState<number | null>(null);
  const [isCreatingOrder, setIsCreatingOrder] = useState<string | null>(null);
  const {
    getCompletedCount,
    getProgressPercentage,
    isLessonCompleted,
    isQuizCompleted,
    hasLessonProgress,
    isLoading: isProgressLoading,
    refreshProgress,
  } = useProgress();
  const { viewMode, setViewMode } = useCourseViewMode();
  const { access, courses, refresh: refreshCourseAccess } = useCourseCommerce();
  const { impersonatedUser, isImpersonating, stopImpersonation } = useImpersonation();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const effectiveCourseViewMode = isImpersonating ? 'student' : viewMode;
  const isFullCourseMode = isAdmin && effectiveCourseViewMode === 'all';
  const {
    isLessonPublished,
    isLessonVisible,
    loading: isLessonsLoading,
    refreshPublishedLessons,
  } = usePublishedLessons(effectiveCourseViewMode);

  const completedCount = isProgressLoading ? 0 : getCompletedCount();
  const progressPercentage = isProgressLoading ? 0 : getProgressPercentage();
  const selectedLesson = selectedLessonId ? getLessonById(selectedLessonId) : null;
  const isDataLoading = isLessonsLoading || isProgressLoading;
  const grantedLessons = isFullCourseMode
    ? 21
    : access?.grantedLessons
      ?? (user?.role === 'student_21' ? 21 : user?.role === 'student_14' ? 14 : 0);
  const isPreviewOnly = !isFullCourseMode && user?.role === 'ai_user';

  const allLessons = courseData.flatMap(week => week.lessons);
  const course14 = courses.find((course) => course.code === 'course_14');
  const course21 = courses.find((course) => course.code === 'course_21');
  const isPartialAccess = !isPreviewOnly && grantedLessons > 0 && grantedLessons < 21;

  const canAccessLesson = (lessonId: number) => {
    if (isFullCourseMode) {
      return true;
    }

    if (isPreviewOnly) {
      return false;
    }

    if (grantedLessons > 0 && lessonId > grantedLessons) {
      return false;
    }

    if (!isLessonVisible(lessonId)) {
      return false;
    }

    if (isLessonCompleted(lessonId)) {
      return true;
    }

    if (!isLessonPublished(lessonId)) {
      return false;
    }

    if (hasLessonProgress(lessonId)) {
      return true;
    }

    if (lessonId === 1) {
      return true;
    }

    return isQuizCompleted(lessonId - 1);
  };

  const getLessonLockReason = (lessonId: number) => {
    if (isFullCourseMode) {
      return null;
    }

    if (isPreviewOnly) {
      return 'course_access_required';
    }

    if (grantedLessons > 0 && lessonId > grantedLessons) {
      return 'upgrade_required';
    }

    if (!isLessonVisible(lessonId) || !isLessonPublished(lessonId)) {
      return 'unpublished';
    }

    return canAccessLesson(lessonId) ? null : 'previous_quiz_incomplete';
  };

  const nextLesson = allLessons.find((lesson) => canAccessLesson(lesson.id) && !isLessonCompleted(lesson.id));
  const allCompleted = completedCount >= 21;

  const firstName = user?.name?.split(' ')[0] || 'Студент';

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([refreshProgress(), refreshPublishedLessons(), refreshCourseAccess()]);
      toast.success('Данные обновлены');
    } catch {
      toast.error('Ошибка обновления');
    } finally {
      setIsRefreshing(false);
    }
  };

  React.useEffect(() => {
    const paymentStatus = searchParams.get('coursePayment');
    if (paymentStatus === 'success') {
      toast.success('Оплата прошла успешно. Доступ к курсу обновлен.');
      refreshCourseAccess();
      setSearchParams({}, { replace: true });
    } else if (paymentStatus === 'failed') {
      toast.error('Платеж не завершен. Попробуйте еще раз.');
      setSearchParams({}, { replace: true });
    }
  }, [refreshCourseAccess, searchParams, setSearchParams]);

  const handlePurchaseCourse = async (courseCode: string) => {
    setIsCreatingOrder(courseCode);
    try {
      const data = await api<{ paymentUrl: string }>('/course-orders', {
        method: 'POST',
        body: { courseCode },
      });
      window.location.href = data.paymentUrl;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Не удалось создать заказ');
    } finally {
      setIsCreatingOrder(null);
    }
  };

  if (selectedLesson) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: 'hsl(248deg 100% 94.56%)' }}>
        {/* Minimal top bar for lesson view (mobile only) */}
        <div className="md:hidden sticky top-0 z-40 flex items-center gap-3 px-4 sm:px-6 h-14 bg-card/80 backdrop-blur-xl border-b border-border/50">
          <SidebarTrigger className="text-muted-foreground hover:text-foreground transition-colors" />
          <span className="font-semibold text-foreground text-sm">
            <span className="text-primary">21DAY</span> — День {selectedLesson.day}
          </span>
        </div>
        <div className="container mx-auto px-4 py-6 max-w-3xl min-[1920px]:max-w-[80%]">
          <LessonView
            lesson={selectedLesson}
            onBack={() => setSelectedLessonId(null)}
            onNavigateToLesson={(id) => {
              if (canAccessLesson(id)) {
                setSelectedLessonId(id);
              }
            }}
            isLessonPublished={isLessonPublished}
            canAccessLesson={canAccessLesson}
            getLessonLockReason={getLessonLockReason}
            courseViewMode={effectiveCourseViewMode}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen mesh-bg" style={{ backgroundColor: 'hsl(248deg 100% 94.56%)' }}>
      {/* ── Impersonation banner ── */}
      {isImpersonating && (
        <div className="bg-amber-500 text-amber-950 px-4 py-2 flex items-center justify-center gap-3">
          <span className="text-sm font-medium">
            👁 Просмотр от имени: <strong>{impersonatedUser?.name}</strong>
          </span>
          <Button variant="ghost" size="sm" onClick={stopImpersonation}
            className="ml-2 h-7 px-2 bg-amber-600/30 hover:bg-amber-600/50 text-amber-950 rounded-lg">
            Выйти
          </Button>
        </div>
      )}

      {/* ── Slim top bar (mobile only; desktop: no header) ── */}
      <div className="md:hidden sticky top-0 z-40 flex items-center justify-between px-4 sm:px-6 h-14 bg-background/90 backdrop-blur-xl border-b border-border/40">
        <SidebarTrigger className="text-muted-foreground hover:text-foreground transition-colors" />

        <div className="flex items-center gap-2">
          <Button
            variant="ghost" size="icon"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-secondary/70 transition-colors">
                <div className="w-7 h-7 rounded-lg gradient-hero flex items-center justify-center shadow-glow">
                  <span className="text-xs font-bold text-white">{firstName.charAt(0).toUpperCase()}</span>
                </div>
                <span className="hidden sm:block text-sm font-medium text-foreground">{firstName}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 rounded-xl">
              <div className="px-3 py-2">
                <p className="text-sm font-semibold text-foreground">{user?.name || firstName}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signOut} className="cursor-pointer text-destructive focus:text-destructive gap-2">
                <LogOut className="w-4 h-4" />
                Выйти
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <main className="container mx-auto px-4 py-6 sm:py-8 max-w-4xl min-[1920px]:max-w-[80%]">
        {isAdmin && !isImpersonating && (
          <section className="mb-6 animate-fade-in-up">
            <div className="rounded-2xl border border-border/60 bg-card/95 p-4 shadow-soft">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                    <Shield className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="font-medium text-foreground">Режим просмотра курса</h2>
                    <p className="text-sm text-muted-foreground">
                      Можно смотреть курс по своему прогрессу или открыть все уроки сразу как администратор.
                    </p>
                  </div>
                </div>
                <div className="inline-flex rounded-xl border border-border/60 bg-background/80 p-1">
                  <button
                    type="button"
                    onClick={() => setViewMode('student')}
                    className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      effectiveCourseViewMode === 'student'
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Как ученик
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('all')}
                    className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      effectiveCourseViewMode === 'all'
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Весь курс
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ════════════════════════════════════════
            HERO — inspired by the 21day landing
        ════════════════════════════════════════ */}
        <section className="relative overflow-hidden rounded-3xl mb-8 sm:mb-10 animate-fade-in-up">
          {/* Gradient background */}
          <div className="gradient-hero absolute inset-0" />

          {/* Decorative blobs */}
          <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-white/10 blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
          <div className="absolute bottom-0 left-1/3 w-64 h-64 rounded-full bg-white/10 blur-2xl translate-y-1/3 pointer-events-none" />

          {/* Decorative grid dots */}
          <div className="absolute inset-0 pointer-events-none" style={{
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.12) 1px, transparent 1px)',
            backgroundSize: '32px 32px'
          }} />

          <div className="relative px-6 sm:px-10 py-10 sm:py-14">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/15 border border-white/25 backdrop-blur-sm mb-6">
              <Sparkles className="w-3.5 h-3.5 text-white" />
              <span className="text-xs font-semibold text-white tracking-wide">
                Добро пожаловать, {firstName}!
              </span>
            </div>

            <div className="max-w-xl">
              <h1 className="font-extrabold text-4xl max-[360px]:text-[1.85rem] sm:text-5xl text-white leading-[1.1] mb-4 tracking-tight" style={{ fontFamily: 'Outfit, sans-serif' }}>
                Освойте{' '}
                <span className="text-white/90 underline decoration-white/30 underline-offset-4">
                  искусственный интеллект
                </span>
                {' '}за 21 день
              </h1>

              <p className="text-white/75 text-base sm:text-lg leading-relaxed mb-8 max-w-xl">
                {isPreviewOnly
                  ? 'Вы видите полную программу курса. Названия уроков открыты для просмотра, а сами уроки, AI-тесты и практические материалы активируются после покупки.'
                  : isPartialAccess
                    ? `У вас открыт тариф на ${grantedLessons} ${grantedLessons === 14 ? 'дней' : 'уроков'}. Можно продолжать обучение и при необходимости сделать апгрейд до полного курса.`
                    : 'Практический курс для помогающих специалистов. 15 минут в день — и вы автоматизируете рутину, увеличите охваты и освободите время для клиентов.'}
              </p>

              {isPreviewOnly ? (
                <div className="flex flex-col gap-4">
                  <button
                    onClick={() => navigate('/course-access')}
                    className="group inline-flex items-center justify-center gap-3 bg-white text-primary font-bold px-7 py-3.5 rounded-2xl shadow-lg hover:shadow-xl hover:scale-[1.03] transition-all duration-300 text-base"
                  >
                    Получить доступ к курсу
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </button>
                  <div className="flex flex-wrap gap-2 text-sm text-white/85">
                    {course14 && <span className="rounded-full border border-white/20 bg-white/12 px-3 py-1">14 дней — {Number(course14.priceRub).toLocaleString('ru-RU')} ₽</span>}
                    {course21 && <span className="rounded-full border border-white/20 bg-white/12 px-3 py-1">21 день — {Number(course21.priceRub).toLocaleString('ru-RU')} ₽</span>}
                  </div>
                </div>
              ) : nextLesson ? (
                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  <button
                    onClick={() => setSelectedLessonId(nextLesson.id)}
                    className="group inline-flex items-center gap-3 bg-white text-primary font-bold px-7 py-3.5 rounded-2xl shadow-lg hover:shadow-xl hover:scale-[1.03] transition-all duration-300 text-base"
                  >
                    <Play className="w-4.5 h-4.5 fill-primary" style={{ width: '18px', height: '18px' }} />
                    {completedCount === 0 ? 'Начать обучение' : 'Продолжить'}
                    <span className="font-normal text-primary/70">— День {nextLesson.day}</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </button>
                  {isPartialAccess && course21 && (
                    <button
                      onClick={() => handlePurchaseCourse(course21.code)}
                      disabled={isCreatingOrder !== null || !access?.canUpgradeTo21}
                      className="inline-flex items-center justify-center gap-3 rounded-2xl border border-white/30 bg-white/15 px-7 py-3.5 text-base font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/20 disabled:opacity-70"
                    >
                      {isCreatingOrder === course21.code ? 'Создаем заказ...' : `Апгрейд до 21 дней — ${Number(course21.upgradePriceRub || 0).toLocaleString('ru-RU')} ₽`}
                    </button>
                  )}
                </div>
              ) : allCompleted ? (
                <div className="inline-flex items-center gap-3 bg-white/20 border border-white/30 text-white font-semibold px-7 py-3.5 rounded-2xl backdrop-blur-sm">
                  <Trophy className="w-5 h-5" />
                  Все уроки пройдены! 🎉
                </div>
              ) : (
                <div className="inline-flex items-center gap-3 bg-white/20 border border-white/30 text-white font-semibold px-7 py-3.5 rounded-2xl backdrop-blur-sm">
                  <Sparkles className="w-5 h-5" />
                  Уроки скоро появятся
                </div>
              )}
            </div>
          </div>

          {/* ── Stats strip at bottom of hero (like landing page) ── */}
          <div className="relative border-t border-white/15 px-6 sm:px-10 py-5 grid grid-cols-4 gap-2">
            {[
              { value: `${completedCount}`, sup: '/21', label: 'Пройдено' },
              { value: '21', sup: '', label: 'День практики' },
              { value: grantedLessons > 0 ? `${grantedLessons}` : '0', sup: '/21', label: isPreviewOnly ? 'Доступно после покупки' : 'Доступно сейчас' },
              { value: isPreviewOnly ? '2' : '15', sup: isPreviewOnly ? ' тарифа' : ' мин', label: isPreviewOnly ? 'Формата курса' : 'В день' },
            ].map((stat, i) => (
              <div key={i} className="text-center">
                <p className="text-xl sm:text-2xl font-extrabold text-white leading-none" style={{ fontFamily: 'Outfit, sans-serif' }}>
                  {stat.value}<span className="text-white/60 text-sm font-semibold">{stat.sup}</span>
                </p>
                <p className="text-white/55 text-[11px] sm:text-xs font-medium mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Progress bar card ── */}
        {completedCount > 0 && (
          <section className="mb-8 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
            <div className="bg-card rounded-2xl border border-border/50 shadow-soft px-6 py-4 flex items-center gap-5">
              <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Target className="w-5.5 h-5.5 text-primary" style={{ width: '22px', height: '22px' }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-semibold text-foreground">Общий прогресс курса</span>
                  <span className="text-sm font-bold text-primary">{progressPercentage}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full gradient-hero rounded-full transition-all duration-700 ease-out"
                    style={{ width: `${progressPercentage}%` }}
                  />
                </div>
              </div>
              <div className="flex-shrink-0 text-right hidden sm:block">
                <p className="text-2xl font-extrabold text-foreground leading-none" style={{ fontFamily: 'Outfit, sans-serif' }}>{completedCount}</p>
                <p className="text-xs text-muted-foreground font-medium">из 21</p>
              </div>
            </div>
          </section>
        )}

        {/* ── Course Content ── */}
        <section className="animate-fade-in-up" style={{ animationDelay: '150ms' }}>
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <BookOpen className="text-primary" style={{ width: '16px', height: '16px' }} />
            </div>
            <h2 className="font-serif text-xl sm:text-2xl font-semibold text-foreground">
              Программа курса
            </h2>
            <div className="flex-1 h-px bg-gradient-to-r from-border to-transparent" />
          </div>

          <div className="space-y-3 sm:space-y-4">
            {courseData.map((week, index) => (
              <WeekCard
                key={week.id}
                week={week}
                onSelectLesson={setSelectedLessonId}
                defaultOpen={false}
                isLessonPublished={isLessonPublished}
                canAccessLesson={canAccessLesson}
                getLessonLockReason={getLessonLockReason}
                isDataLoading={isDataLoading}
              />
            ))}
          </div>
        </section>

        {/* ── Practical Materials ── */}
        <section className="mt-10 sm:mt-12 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Play className="text-primary" style={{ width: '16px', height: '16px' }} />
            </div>
            <h2 className="font-serif text-xl sm:text-2xl font-semibold text-foreground">
              Практические материалы
            </h2>
            <div className="flex-1 h-px bg-gradient-to-r from-border to-transparent" />
          </div>
          <PracticalMaterials />
        </section>

        <TestimonialsSection
          variant="dashboard"
          className="mt-10 sm:mt-12"
        />

        <div className="h-8" />
      </main>
    </div>
  );
}
