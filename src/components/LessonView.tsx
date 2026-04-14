import React, { useState, useEffect } from 'react';
import { Lesson } from '@/data/courseData';
import { useProgress } from '@/contexts/ProgressContext';
import { api, getUploadUrl } from '@/api/client';
import { Button } from '@/components/ui/button';
import { 
  ChevronDown, 
  ChevronLeft, 
  ChevronRight,
  Play, 
  CheckCircle2,
  ListChecks,
  BookOpen,
  Video,
  ExternalLink,
  Sparkles,
  FileText,
  Lock
} from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { AIQuiz } from './AIQuiz';
import { CourseViewMode } from '@/hooks/useCourseViewMode';
import { useImpersonation } from '@/contexts/ImpersonationContext';

interface LessonViewProps {
  lesson: Lesson;
  onBack: () => void;
  onNavigateToLesson: (lessonId: number) => void;
  isLessonPublished: (lessonId: number) => boolean;
  canAccessLesson: (lessonId: number) => boolean;
  getLessonLockReason: (lessonId: number) => 'unpublished' | 'previous_quiz_incomplete' | null;
  courseViewMode?: CourseViewMode;
}

interface LessonContent {
  custom_description: string | null;
  video_urls: string[];
  video_titles?: string[];
  video_preview_urls?: string[];
  pdf_urls: string[];
  additional_materials: string | null;
  ai_prompt?: string | null;
  ai_prompt_is_override?: boolean;
}

export function LessonView({
  lesson,
  onBack,
  onNavigateToLesson,
  isLessonPublished,
  canAccessLesson,
  getLessonLockReason,
  courseViewMode = 'student',
}: LessonViewProps) {
  const { isLessonCompleted, isQuizCompleted } = useProgress();
  const { impersonatedUser, isImpersonating } = useImpersonation();
  const [isDescriptionOpen, setIsDescriptionOpen] = useState(true);
  const [showQuiz, setShowQuiz] = useState(false);
  const [lessonContent, setLessonContent] = useState<LessonContent | null>(null);
  const [lessonContentError, setLessonContentError] = useState<string | null>(null);
  const [selectedVideoIndex, setSelectedVideoIndex] = useState<number | null>(null);
  const [isPlayerVisible, setIsPlayerVisible] = useState(false);
  const [playerReadyToShow, setPlayerReadyToShow] = useState(false);
  const closeTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = React.useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  useEffect(() => {
    if (selectedVideoIndex !== null) {
      setPlayerReadyToShow(false);
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = requestAnimationFrame(() => {
          setPlayerReadyToShow(true);
          rafRef.current = null;
        });
      });
    } else {
      setPlayerReadyToShow(false);
    }
  }, [selectedVideoIndex]);

  const openPlayer = (index: number) => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setSelectedVideoIndex(index);
    setIsPlayerVisible(true);
  };

  const closePlayer = () => {
    setIsPlayerVisible(false);
    closeTimeoutRef.current = setTimeout(() => {
      setSelectedVideoIndex(null);
      closeTimeoutRef.current = null;
    }, 380);
  };
  
  const completed = isLessonCompleted(lesson.id);
  const quizDone = isQuizCompleted(lesson.id);
  const isPublished = isLessonPublished(lesson.id);
  const isAccessible = canAccessLesson(lesson.id);
  const lockReason = getLessonLockReason(lesson.id);

  useEffect(() => {
    if (isAccessible) {
      loadLessonContent();
    }
  }, [lesson.id, isAccessible, courseViewMode, impersonatedUser?.user_id, isImpersonating]);

  const loadLessonContent = async () => {
    try {
      setLessonContentError(null);
      const params = new URLSearchParams();
      if (courseViewMode === 'all') {
        params.set('viewMode', 'all');
      }
      if (isImpersonating && impersonatedUser?.user_id) {
        params.set('userId', impersonatedUser.user_id);
      }
      const query = params.toString() ? `?${params.toString()}` : '';
      const data = await api<{ customDescription: string | null; videoUrls: string[]; videoTitles?: string[]; videoPreviewUrls?: string[]; pdfUrls: string[]; additionalMaterials: string | null; aiPrompt?: string | null; aiPromptIsOverride?: boolean }>(`/lessons/${lesson.id}${query}`);
      setLessonContent({
        custom_description: data.customDescription,
        video_urls: data.videoUrls || [],
        video_titles: data.videoTitles || [],
        video_preview_urls: data.videoPreviewUrls || [],
        pdf_urls: data.pdfUrls || [],
        additional_materials: data.additionalMaterials,
        ai_prompt: data.aiPrompt || null,
        ai_prompt_is_override: data.aiPromptIsOverride === true,
      });
    } catch (error) {
      setLessonContent(null);
      setLessonContentError(error instanceof Error ? error.message : 'Не удалось загрузить материалы урока');
    }
  };

  const getVideoEmbedUrl = (url: string): string | null => {
    const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\s]+)/);
    if (ytMatch) {
      return `https://www.youtube.com/embed/${ytMatch[1]}`;
    }
    
    const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
    if (vimeoMatch) {
      return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
    }

    return null;
  };

  if (!isAccessible) {
    const lockMessage = lockReason === 'previous_quiz_incomplete'
      ? 'Сначала завершите AI-тест по предыдущему уроку, и следующий урок откроется автоматически.'
      : 'Этот урок ещё не опубликован. Пожалуйста, вернитесь позже или выберите другой урок.';

    return (
      <div className="animate-fade-in-up">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors focus-ring rounded-lg px-2 py-1 -ml-2"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="text-sm font-medium">К урокам</span>
          </button>
        </div>

        <div className="bg-card rounded-2xl sm:rounded-3xl border border-border/50 shadow-soft overflow-hidden">
          <div className="p-8 sm:p-12 text-center">
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-muted/50 flex items-center justify-center">
              <Lock className="w-10 h-10 text-muted-foreground" />
            </div>
            <h1 className="font-serif text-display-sm text-foreground mb-4">
              Урок недоступен
            </h1>
            <p className="text-muted-foreground max-w-md mx-auto mb-6">
              {lockMessage}
            </p>
            <Button onClick={onBack} className="rounded-xl">
              <ChevronLeft className="w-4 h-4 mr-2" />
              Вернуться к курсу
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (lessonContentError) {
    return (
      <div className="animate-fade-in-up">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors focus-ring rounded-lg px-2 py-1 -ml-2"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="text-sm font-medium">К урокам</span>
          </button>
        </div>

        <div className="bg-card rounded-2xl sm:rounded-3xl border border-border/50 shadow-soft overflow-hidden">
          <div className="p-8 sm:p-12 text-center">
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-muted/50 flex items-center justify-center">
              <Lock className="w-10 h-10 text-muted-foreground" />
            </div>
            <h1 className="font-serif text-display-sm text-foreground mb-4">
              Урок временно недоступен
            </h1>
            <p className="text-muted-foreground max-w-md mx-auto mb-6">
              {lessonContentError}
            </p>
            <Button onClick={onBack} className="rounded-xl">
              <ChevronLeft className="w-4 h-4 mr-2" />
              Вернуться к курсу
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up">
      {/* Navigation */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors focus-ring rounded-lg px-2 py-1 -ml-2"
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="text-sm font-medium">К урокам</span>
        </button>

        {/* Lesson navigation */}
        <div className="flex items-center gap-2">
          {lesson.id > 1 && canAccessLesson(lesson.id - 1) && (
            <button
              onClick={() => onNavigateToLesson(lesson.id - 1)}
              className="p-2 rounded-lg hover:bg-secondary/50 transition-colors focus-ring"
            >
              <ChevronLeft className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
          <span className="text-sm text-muted-foreground font-medium px-2">
            {lesson.id} / 21
          </span>
          {lesson.id < 21 && canAccessLesson(lesson.id + 1) && (
            <button
              onClick={() => onNavigateToLesson(lesson.id + 1)}
              className="p-2 rounded-lg hover:bg-secondary/50 transition-colors focus-ring"
            >
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      {/* Header Card */}
      <div className="bg-card rounded-2xl sm:rounded-3xl border border-border/50 shadow-soft overflow-hidden mb-6">
        <div className="p-6 sm:p-8">
          {/* Badges */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary bg-primary/10 px-3 py-1 rounded-lg">
              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              День {lesson.id}
            </span>
            {completed && (
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-success bg-success-soft px-3 py-1 rounded-lg">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Пройден
              </span>
            )}
          </div>

          <h1 className="font-serif text-display-sm text-foreground mb-4">
            {lesson.title}
          </h1>

          <p className="text-muted-foreground leading-relaxed max-w-2xl">
            {lesson.description}
          </p>
        </div>
      </div>

      {/* Video Section */}
      <div className="bg-card rounded-2xl sm:rounded-3xl border border-border/50 shadow-soft overflow-hidden mb-6">
        <div className="p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Video className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="font-serif text-lg font-semibold text-foreground">
                Видеоурок
              </h2>
              <p className="text-sm text-muted-foreground">~15 минут</p>
            </div>
          </div>
          
          {lessonContent?.video_urls && lessonContent.video_urls.length > 0 ? (
            <div className="space-y-5">
              <div className="relative overflow-hidden">
                {/* Cards grid - animates out when player opens */}
                <div
                  className={`grid gap-4 sm:grid-cols-2 lg:grid-cols-3 transition-[opacity,transform] duration-350 ease-smooth motion-reduce:duration-0 ${
                    isPlayerVisible ? 'opacity-0 scale-[0.97] pointer-events-none absolute inset-0' : 'opacity-100 scale-100'
                  }`}
                  style={{ transformOrigin: 'center top' }}
                >
                {lessonContent.video_urls.map((url, index) => {
                  const embedUrl = getVideoEmbedUrl(url);
                  const previewUrl = lessonContent.video_preview_urls?.[index];
                  const title = lessonContent.video_titles?.[index]?.trim() || lesson.videoTopics[index] || `Видео ${index + 1}`;
                  const isSelected = selectedVideoIndex === index;
                  return (
                    <button
                      key={index}
                      type="button"
                      onClick={() => embedUrl && (isSelected ? closePlayer() : openPlayer(index))}
                      className={`group text-left rounded-2xl overflow-hidden border-2 transition-all focus-ring ${
                        isSelected ? 'ring-2 ring-primary border-primary shadow-lg' : 'border-border hover:border-primary/60 hover:shadow-md'
                      }`}
                    >
                      <div className="aspect-video bg-muted relative">
                        {previewUrl ? (
                          <img src={getUploadUrl(previewUrl)} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="absolute inset-0 bg-gradient-to-br from-secondary/50 to-muted" />
                        )}
                        <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-colors">
                          <div className="w-14 h-14 rounded-full bg-primary/90 flex items-center justify-center shadow-lg ring-2 ring-white/90 group-hover:scale-110 transition-transform opacity-90 group-hover:opacity-100">
                            <Play className="w-6 h-6 text-primary-foreground ml-1" fill="currentColor" />
                          </div>
                        </div>
                      </div>
                      <div className="p-3 sm:p-4 bg-card">
                        <p className="text-sm font-medium text-foreground line-clamp-2">{title}</p>
                        {embedUrl ? (
                          <span className="text-xs text-muted-foreground mt-1 block">Нажмите, чтобы смотреть</span>
                        ) : (
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1.5 text-xs text-primary mt-1 hover:underline"
                          >
                            <ExternalLink className="w-3 h-3" />
                            Открыть ссылку
                          </a>
                        )}
                      </div>
                    </button>
                  );
                })}
                </div>
                {/* Player overlay - animates in when opened */}
                {selectedVideoIndex !== null && (() => {
                  const url = lessonContent!.video_urls[selectedVideoIndex];
                  const embedUrl = getVideoEmbedUrl(url);
                  if (!embedUrl) return null;
                  return (
                    <div
                      className={`flex flex-col rounded-2xl overflow-hidden border-2 border-border bg-muted shadow-lg transition-[opacity,transform] duration-350 ease-smooth motion-reduce:duration-0 ${
                        isPlayerVisible && playerReadyToShow
                          ? 'opacity-100 scale-100 relative'
                          : 'opacity-0 scale-[0.97] pointer-events-none absolute inset-0'
                      }`}
                      style={{ transformOrigin: 'center top' }}
                    >
                      <div className="flex items-center justify-between px-4 py-2.5 bg-secondary/50 border-b border-border/50 flex-shrink-0">
                        <span className="font-medium text-sm text-foreground min-w-0 truncate pr-3">
                          {lessonContent.video_titles?.[selectedVideoIndex]?.trim() || lesson.videoTopics[selectedVideoIndex] || `Видео ${selectedVideoIndex + 1}`}
                        </span>
                        <button
                          type="button"
                          onClick={closePlayer}
                          className="px-3 py-1.5 rounded-lg text-sm font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors flex-shrink-0"
                        >
                          Назад
                        </button>
                      </div>
                      <div className="flex-1 min-h-0 aspect-video">
                        <iframe
                          src={embedUrl}
                          className="w-full h-full"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          ) : (
            <div className="aspect-video bg-gradient-to-br from-secondary/50 to-muted rounded-2xl flex items-center justify-center border border-border/50 group cursor-pointer hover:border-primary/30 transition-all">
              <div className="text-center">
                <div className="w-20 h-20 mx-auto mb-5 rounded-2xl gradient-hero flex items-center justify-center shadow-glow group-hover:scale-105 transition-transform">
                  <Play className="w-8 h-8 text-primary-foreground ml-1" />
                </div>
                <p className="text-foreground font-medium mb-1">Видео скоро появится</p>
                <p className="text-sm text-muted-foreground">Администратор добавит видео к этому уроку</p>
              </div>
            </div>
          )}

          {/* Topics */}
          <div className="mt-6 p-5 rounded-xl bg-secondary/30 border border-border/50">
            <h3 className="font-medium text-foreground mb-4 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-primary" />
              Темы урока
            </h3>
            <ul className="space-y-3">
              {lesson.videoTopics.map((topic, index) => (
                <li key={index} className="flex items-start gap-3 text-muted-foreground">
                  <span className="w-6 h-6 rounded-lg bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center flex-shrink-0 mt-0.5">
                    {index + 1}
                  </span>
                  <span className="leading-relaxed">{topic}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Custom Description */}
          {lessonContent?.custom_description && (
            <div className="mt-4 p-5 rounded-xl bg-primary/5 border border-primary/10">
              <p className="text-foreground leading-relaxed">
                {lessonContent.custom_description}
              </p>
            </div>
          )}

          {/* PDF Presentations */}
          {lessonContent?.pdf_urls && lessonContent.pdf_urls.length > 0 && (
            <div className="mt-4 p-5 rounded-xl bg-primary/5 border border-primary/20">
              <h3 className="font-medium text-foreground mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                Презентации
              </h3>
              <div className="space-y-2">
                {lessonContent.pdf_urls.map((url, index) => {
                  const rawName = decodeURIComponent(url.split('/').pop() || `Презентация ${index + 1}`);
                  const fileName = rawName.replace(/-\d+\.pdf$/i, '.pdf');
                  return (
                    <a
                      key={index}
                      href={getUploadUrl(url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 rounded-lg bg-background hover:bg-secondary/50 border border-border/50 transition-colors group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <FileText className="w-4 h-4 text-primary" />
                      </div>
                      <span className="flex-1 font-medium text-sm truncate">{fileName}</span>
                      <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    </a>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Task Section */}
      <div className="bg-card rounded-2xl sm:rounded-3xl border border-border/50 shadow-soft overflow-hidden mb-6">
        <div className="p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <ListChecks className="w-5 h-5 text-primary" />
            </div>
            <h2 className="font-serif text-lg font-semibold text-foreground">
              Практическое задание
            </h2>
          </div>
          <div className="p-5 rounded-xl bg-secondary/30 border border-border/50">
            <p className="text-foreground whitespace-pre-line leading-relaxed">
              {lessonContent?.additional_materials?.trim() || lesson.task}
            </p>
          </div>
        </div>
      </div>

      {/* AI Quiz Section */}
      {showQuiz ? (
        <div className="mb-6">
          <AIQuiz 
            lesson={lesson} 
            onClose={() => setShowQuiz(false)}
            courseViewMode={courseViewMode}
          />
        </div>
      ) : (
        <div className="mb-6">
          <button
            onClick={() => setShowQuiz(true)}
            className={`
              w-full p-5 rounded-2xl border-2 border-dashed transition-all duration-300 group
              ${quizDone 
                ? 'border-accent/30 hover:border-accent/50 hover:bg-accent/5' 
                : 'border-primary/30 hover:border-primary/50 hover:bg-primary/5'
              }
            `}
          >
            <div className="flex items-center justify-center gap-3">
              <div className={`
                w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110
                ${quizDone ? 'bg-accent/10' : 'bg-primary/10'}
              `}>
                <Sparkles className={`w-5 h-5 ${quizDone ? 'text-accent' : 'text-primary'}`} />
              </div>
              <div className="text-left">
                <p className="font-medium text-foreground">
                  {quizDone ? 'Пройти AI-тест ещё раз' : 'Пройти AI-тест по теме'}
                </p>
                <p className="text-sm text-muted-foreground">
                  Персонализированные вопросы от искусственного интеллекта
                </p>
              </div>
            </div>
          </button>
        </div>
      )}

      {/* Actions */}
      {lesson.id < 21 && canAccessLesson(lesson.id + 1) && (
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            variant="outline"
            size="lg"
            onClick={() => onNavigateToLesson(lesson.id + 1)}
            className="flex-1 h-14 rounded-xl font-semibold text-base border-2 border-primary/40 hover:border-primary hover:bg-primary/10"
          >
            Следующий урок
            <ChevronRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      )}
    </div>
  );
}