import React from 'react';
import { Lesson } from '@/data/courseData';
import { useProgress } from '@/contexts/ProgressContext';
import { CheckCircle2, Play, ChevronRight, Sparkles, Lock } from 'lucide-react';

interface LessonCardProps {
  lesson: Lesson;
  onClick: () => void;
  style?: React.CSSProperties;
  isAccessible?: boolean;
  lockReason?: 'unpublished' | 'previous_quiz_incomplete' | null;
  isDataLoading?: boolean;
}

export function LessonCard({
  lesson,
  onClick,
  style,
  isAccessible = false,
  lockReason = null,
  isDataLoading = false,
}: LessonCardProps) {
  const { isLessonCompleted, isQuizCompleted, isLoading: isProgressLoading } = useProgress();
  
  const completed = !isProgressLoading && isLessonCompleted(lesson.id);
  const quizDone = !isProgressLoading && isQuizCompleted(lesson.id);
  // Don't show as locked while data is loading
  const isLocked = !isDataLoading && !isAccessible;
  const lockLabel = lockReason === 'previous_quiz_incomplete'
    ? 'Сначала предыдущий урок'
    : 'Скоро';

  return (
    <button
      onClick={isLocked ? undefined : onClick}
      style={style}
      disabled={isLocked}
      className={`
        w-full p-4 rounded-xl border text-left transition-all duration-200 animate-fade-in
        flex items-center gap-4 group focus-ring
        ${isLocked 
          ? 'bg-muted/30 border-border/30 cursor-not-allowed opacity-60'
          : completed 
            ? 'bg-success-soft border-success/20 hover:border-success/40' 
            : 'bg-secondary/30 border-border/50 hover:bg-secondary/50 hover:border-primary/30'
        }
      `}
    >
      {/* Day number / Status */}
      <div className={`
        relative w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0
        transition-all duration-300
        ${isLocked 
          ? 'bg-muted/50 text-muted-foreground'
          : completed 
            ? 'bg-success text-success-foreground' 
            : 'bg-muted group-hover:bg-primary group-hover:shadow-glow'
        }
      `}>
        {isLocked ? (
          <Lock className="w-5 h-5" />
        ) : completed ? (
          <CheckCircle2 className="w-5 h-5" />
        ) : (
          <>
            <span className="font-serif font-semibold text-lg text-foreground group-hover:text-primary-foreground transition-colors">
              {lesson.id}
            </span>
            {/* Play overlay on hover */}
            <div className="absolute inset-0 rounded-xl bg-primary flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Play className="w-4 h-4 text-primary-foreground ml-0.5" />
            </div>
          </>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
          <span className={`
            text-xs font-semibold px-2.5 py-0.5 rounded-md
            ${isLocked
              ? 'bg-muted/50 text-muted-foreground'
              : completed 
                ? 'bg-success/20 text-success' 
                : 'bg-primary/10 text-primary'
            }
          `}>
            День {lesson.id}
          </span>
          {isLocked && (
            <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-md">
              <Lock className="w-3 h-3" />
              {lockLabel}
            </span>
          )}
          {!isLocked && quizDone && (
            <span className="flex items-center gap-1 text-xs font-medium text-accent bg-accent/10 px-2 py-0.5 rounded-md">
              <Sparkles className="w-3 h-3" />
              Тест пройден
            </span>
          )}
        </div>
        <h3 className={`font-medium line-clamp-1 transition-colors ${isLocked ? 'text-muted-foreground' : 'text-foreground group-hover:text-primary'}`}>
          {lesson.title}
        </h3>
      </div>

      {/* Arrow */}
      <ChevronRight className={`w-5 h-5 flex-shrink-0 transition-all ${isLocked ? 'text-muted-foreground/50' : 'text-muted-foreground group-hover:text-primary group-hover:translate-x-1'}`} />
    </button>
  );
}