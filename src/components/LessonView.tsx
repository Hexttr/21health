import React, { useState, useEffect } from 'react';
import { Lesson, getWeekByLessonId } from '@/data/courseData';
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

interface LessonViewProps {
  lesson: Lesson;
  onBack: () => void;
  onNavigateToLesson: (lessonId: number) => void;
  isLessonPublished: (lessonId: number) => boolean;
}

interface LessonContent {
  custom_description: string | null;
  video_urls: string[];
  pdf_urls: string[];
  additional_materials: string | null;
}

export function LessonView({ lesson, onBack, onNavigateToLesson, isLessonPublished }: LessonViewProps) {
  const { isLessonCompleted, markLessonComplete, isQuizCompleted } = useProgress();
  const [isDescriptionOpen, setIsDescriptionOpen] = useState(true);
  const [showQuiz, setShowQuiz] = useState(false);
  const [lessonContent, setLessonContent] = useState<LessonContent | null>(null);
  
  const completed = isLessonCompleted(lesson.id);
  const quizDone = isQuizCompleted(lesson.id);
  const week = getWeekByLessonId(lesson.id);
  const isPublished = isLessonPublished(lesson.id);

  useEffect(() => {
    if (isPublished) {
      loadLessonContent();
    }
  }, [lesson.id, isPublished]);

  const loadLessonContent = async () => {
    try {
      const data = await api<{ customDescription: string | null; videoUrls: string[]; pdfUrls: string[]; additionalMaterials: string | null }>(`/lessons/${lesson.id}`);
      setLessonContent({
        custom_description: data.customDescription,
        video_urls: data.videoUrls || [],
        pdf_urls: data.pdfUrls || [],
        additional_materials: data.additionalMaterials
      });
    } catch {
      // Lesson content may not exist yet
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

  const handleMarkComplete = async () => {
    await markLessonComplete(lesson.id);
  };

  // If lesson is not published, show locked state
  if (!isPublished) {
    return (
      <div className="animate-fade-in-up">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors focus-ring rounded-lg px-2 py-1 -ml-2"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="text-sm font-medium">Назад</span>
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
              Этот урок ещё не опубликован. Пожалуйста, вернитесь позже или выберите другой урок.
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
          <span className="text-sm font-medium">Назад</span>
        </button>

        {/* Lesson navigation */}
        <div className="flex items-center gap-2">
          {lesson.id > 1 && isLessonPublished(lesson.id - 1) && (
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
          {lesson.id < 21 && isLessonPublished(lesson.id + 1) && (
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
              День {lesson.day}
            </span>
            {week && (
              <span className="text-sm text-muted-foreground bg-secondary/50 px-3 py-1 rounded-lg">
                Неделя {week.id}
              </span>
            )}
            {completed && (
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-success bg-success-soft px-3 py-1 rounded-lg">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Пройден
              </span>
            )}
            {quizDone && (
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent bg-accent-soft px-3 py-1 rounded-lg">
                <Sparkles className="w-3.5 h-3.5" />
                Тест сдан
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
            <div className="space-y-4">
              {lessonContent.video_urls.map((url, index) => {
                const embedUrl = getVideoEmbedUrl(url);
                if (embedUrl) {
                  return (
                    <div key={index} className="aspect-video rounded-2xl overflow-hidden border border-border/50 bg-muted">
                      <iframe
                        src={embedUrl}
                        className="w-full h-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  );
                }
                return (
                  <a
                    key={index}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-4 rounded-xl bg-secondary/50 hover:bg-secondary border border-border/50 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4 text-primary" />
                    <span className="font-medium">Открыть видео {index + 1}</span>
                  </a>
                );
              })}
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

          {/* Additional Materials */}
          {lessonContent?.additional_materials && (
            <div className="mt-4 p-5 rounded-xl bg-accent/5 border border-accent/20">
              <h3 className="font-medium text-foreground mb-2 flex items-center gap-2">
                <FileText className="w-4 h-4 text-accent" />
                Дополнительные материалы
              </h3>
              <p className="text-muted-foreground whitespace-pre-line">
                {lessonContent.additional_materials}
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
                  const fileName = decodeURIComponent(url.split('/').pop() || `Презентация ${index + 1}`);
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
            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
              <ListChecks className="w-5 h-5 text-accent" />
            </div>
            <h2 className="font-serif text-lg font-semibold text-foreground">
              Практическое задание
            </h2>
          </div>
          <div className="p-5 rounded-xl bg-secondary/30 border border-border/50">
            <p className="text-foreground whitespace-pre-line leading-relaxed">
              {lesson.task}
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
      {lesson.id < 21 && isLessonPublished(lesson.id + 1) && (
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            variant="outline"
            size="lg"
            onClick={() => onNavigateToLesson(lesson.id + 1)}
            className="flex-1 h-14 rounded-xl font-semibold text-base border-border/50 hover:bg-secondary/50"
          >
            Следующий урок
            <ChevronRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      )}
    </div>
  );
}