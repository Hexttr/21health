import React, { useState, useEffect } from 'react';
import { api, apiUpload, getUploadUrl } from '@/api/client';
import { courseData, getAllLessons } from '@/data/courseData';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { AdminPageLayout } from '@/components/AdminPageLayout';
import { useCourseViewMode } from '@/hooks/useCourseViewMode';
import { 
  Save, 
  Loader2, 
  Video, 
  Plus, 
  Trash2, 
  BookOpen,
  FileUp,
  FileText,
  X,
  CheckCircle2,
  Eye,
  EyeOff,
  ImagePlus,
  Shield,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';

interface LessonContent {
  id?: string;
  lesson_id: number;
  custom_description: string | null;
  video_urls: string[];
  video_titles: string[];
  video_preview_urls: string[];
  pdf_urls: string[];
  additional_materials: string | null;
  is_published: boolean;
  ai_prompt: string | null;
  ai_prompt_is_override: boolean;
}

export default function AdminLessons() {
  const { viewMode, setViewMode } = useCourseViewMode();
  const [selectedLessonId, setSelectedLessonId] = useState<number | null>(null);
  const [lessonContent, setLessonContent] = useState<LessonContent | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [uploadingPreviewIndex, setUploadingPreviewIndex] = useState<number | null>(null);

  const allLessons = getAllLessons();
  const selectedLesson = allLessons.find(l => l.id === selectedLessonId);

  useEffect(() => {
    if (selectedLessonId) {
      loadLessonContent(selectedLessonId);
    }
  }, [selectedLessonId]);

  const loadLessonContent = async (lessonId: number) => {
    setIsLoading(true);
    try {
      const data = await api<{ id: string; lessonId: number; customDescription: string | null; videoUrls: string[]; videoTitles?: string[]; videoPreviewUrls?: string[]; pdfUrls: string[]; additionalMaterials: string | null; isPublished: boolean; aiPrompt: string | null; aiPromptIsOverride?: boolean }>(`/lessons/${lessonId}?viewMode=all`);
      setLessonContent({
        id: data.id,
        lesson_id: data.lessonId,
        custom_description: data.customDescription,
        video_urls: data.videoUrls || [],
        video_titles: data.videoTitles || [],
        video_preview_urls: data.videoPreviewUrls || [],
        pdf_urls: data.pdfUrls || [],
        additional_materials: data.additionalMaterials,
        is_published: data.isPublished ?? true,
        ai_prompt: data.aiPrompt || null,
        ai_prompt_is_override: data.aiPromptIsOverride === true,
      });
    } catch {
      setLessonContent({
        lesson_id: lessonId,
        custom_description: null,
        video_urls: [],
        video_titles: [],
        video_preview_urls: [],
        pdf_urls: [],
        additional_materials: null,
        is_published: true,
        ai_prompt: null,
        ai_prompt_is_override: false,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const saveLessonContent = async () => {
    if (!lessonContent) return;
    setIsSaving(true);
    try {
      await api('/admin/lessons', {
        method: 'PUT',
        body: {
          lessonId: lessonContent.lesson_id,
          customDescription: lessonContent.custom_description,
          videoUrls: lessonContent.video_urls,
          videoTitles: lessonContent.video_titles,
          videoPreviewUrls: lessonContent.video_preview_urls,
          pdfUrls: lessonContent.pdf_urls,
          additionalMaterials: lessonContent.additional_materials,
          isPublished: lessonContent.is_published,
          aiPrompt: lessonContent.ai_prompt,
          aiPromptIsOverride: lessonContent.ai_prompt_is_override,
        }
      });
      toast.success('Контент сохранён!');
    } catch (error) {
      console.error('Error saving lesson content:', error);
      toast.error('Ошибка сохранения');
    } finally {
      setIsSaving(false);
    }
  };

  const MAX_VIDEOS = 6;

  const addVideoUrl = () => {
    if (lessonContent && lessonContent.video_urls.length < MAX_VIDEOS) {
      setLessonContent({
        ...lessonContent,
        video_urls: [...lessonContent.video_urls, ''],
        video_titles: [...lessonContent.video_titles, ''],
        video_preview_urls: [...(lessonContent.video_preview_urls || []), '']
      });
    }
  };

  const removeVideoUrl = (index: number) => {
    if (lessonContent) {
      const newUrls = lessonContent.video_urls.filter((_, i) => i !== index);
      const newTitles = lessonContent.video_titles.filter((_, i) => i !== index);
      const newPreviews = lessonContent.video_preview_urls.filter((_, i) => i !== index);
      setLessonContent({ ...lessonContent, video_urls: newUrls, video_titles: newTitles, video_preview_urls: newPreviews });
    }
  };

  const updateVideoUrl = (index: number, value: string) => {
    if (lessonContent) {
      const newUrls = [...lessonContent.video_urls];
      newUrls[index] = value;
      setLessonContent({ ...lessonContent, video_urls: newUrls });
    }
  };

  const updateVideoTitle = (index: number, value: string) => {
    if (lessonContent) {
      const newTitles = [...lessonContent.video_titles];
      while (newTitles.length <= index) newTitles.push('');
      newTitles[index] = value;
      setLessonContent({ ...lessonContent, video_titles: newTitles });
    }
  };

  const MAX_PDFS = 6;

  const handlePdfUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!lessonContent || !event.target.files?.length) return;
    const file = event.target.files[0];
    if (!file.type.includes('pdf')) { toast.error('Пожалуйста, загрузите PDF файл'); return; }
    if (lessonContent.pdf_urls.length >= MAX_PDFS) { toast.error(`Максимум ${MAX_PDFS} PDF файлов`); return; }

    setUploadingPdf(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('lessonId', String(lessonContent.lesson_id));
      const { url } = await apiUpload('/admin/lessons/upload-pdf', formData) as { url: string };
      setLessonContent({ ...lessonContent, pdf_urls: [...lessonContent.pdf_urls, url] });
      toast.success('PDF загружен!');
    } catch (error) {
      console.error('Error uploading PDF:', error);
      toast.error('Ошибка загрузки PDF');
    } finally {
      setUploadingPdf(false);
      event.target.value = '';
    }
  };

  const removePdf = (index: number) => {
    if (!lessonContent) return;
    setLessonContent({ ...lessonContent, pdf_urls: lessonContent.pdf_urls.filter((_, i) => i !== index) });
  };

  const handlePreviewUpload = async (videoIndex: number, event: React.ChangeEvent<HTMLInputElement>) => {
    if (!lessonContent || !event.target.files?.length) return;
    const file = event.target.files[0];
    if (!file.type.startsWith('image/')) { toast.error('Загрузите изображение (JPG, PNG, WebP)'); return; }
    setUploadingPreviewIndex(videoIndex);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('lessonId', String(lessonContent.lesson_id));
      formData.append('videoIndex', String(videoIndex));
      const { url } = await apiUpload('/admin/lessons/upload-video-preview', formData) as { url: string };
      const newPreviews = [...(lessonContent.video_preview_urls || [])];
      while (newPreviews.length <= videoIndex) newPreviews.push('');
      newPreviews[videoIndex] = url;
      setLessonContent({ ...lessonContent, video_preview_urls: newPreviews });
      toast.success('Превью загружено!');
    } catch (error) {
      console.error('Error uploading preview:', error);
      toast.error('Ошибка загрузки превью');
    } finally {
      setUploadingPreviewIndex(null);
      event.target.value = '';
    }
  };

  const removePreview = (videoIndex: number) => {
    if (!lessonContent) return;
    const newPreviews = [...(lessonContent.video_preview_urls || [])];
    if (newPreviews[videoIndex]) {
      newPreviews[videoIndex] = '';
      setLessonContent({ ...lessonContent, video_preview_urls: newPreviews });
    }
  };

  return (
    <AdminPageLayout
      title="Управление уроками"
      description="Редактирование контента, видео и публикация уроков"
      icon={BookOpen}
    >
      <div className="mb-5 rounded-2xl border border-border/60 bg-card/95 p-4 shadow-soft">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-medium text-foreground">Режим просмотра курса для администратора</h2>
              <p className="text-sm text-muted-foreground">
                Настройка влияет на страницу курса: можно видеть его как ученик по своему прогрессу или открыть все уроки сразу.
              </p>
            </div>
          </div>
          <div className="inline-flex rounded-xl border border-border/60 bg-background/80 p-1">
            <button
              type="button"
              onClick={() => setViewMode('student')}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                viewMode === 'student'
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
                viewMode === 'all'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Весь курс
            </button>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Lessons List */}
        <div className="lg:col-span-1">
          <div className="bg-card rounded-2xl border border-border/50 shadow-soft overflow-hidden sticky top-24">
            <div className="p-4 border-b border-border/50 bg-secondary/30">
              <h2 className="font-serif font-semibold text-foreground text-sm">Список уроков</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Выберите урок для редактирования</p>
            </div>
            <div className="max-h-[calc(100vh-200px)] overflow-y-auto">
              {courseData.map(week => (
                <div key={week.id}>
                  <div className="px-4 py-2 bg-muted/40 sticky top-0">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Неделя {week.id}
                    </span>
                  </div>
                  {week.lessons.map(lesson => (
                    <button
                      key={lesson.id}
                      onClick={() => setSelectedLessonId(lesson.id)}
                      className={`
                        w-full px-4 py-3 text-left border-b border-border/30 last:border-0
                        hover:bg-secondary/50 transition-colors group
                        ${selectedLessonId === lesson.id 
                          ? 'bg-primary/5 border-l-2 !border-l-primary' 
                          : 'border-l-2 border-l-transparent'
                        }
                      `}
                    >
                      <span className="text-xs font-semibold text-primary">День {lesson.day}</span>
                      <p className="text-sm font-medium text-foreground truncate mt-0.5 group-hover:text-primary transition-colors">
                        {lesson.title}
                      </p>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Lesson Editor */}
        <div className="lg:col-span-2">
          {selectedLesson && lessonContent ? (
            <div className="space-y-5 animate-fade-in-up">
              {/* Header card */}
              <div className="bg-card rounded-2xl border border-border/50 shadow-soft p-5 sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-primary bg-primary/10 px-2.5 py-1 rounded-lg">
                        День {selectedLesson.day}
                      </span>
                    </div>
                    <h2 className="font-serif text-lg font-semibold text-foreground">
                      {selectedLesson.title}
                    </h2>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium ${
                      lessonContent.is_published 
                        ? 'bg-success/10 text-success' 
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      {lessonContent.is_published ? (
                        <Eye className="w-3.5 h-3.5" />
                      ) : (
                        <EyeOff className="w-3.5 h-3.5" />
                      )}
                      {lessonContent.is_published ? 'Опубликован' : 'Скрыт'}
                    </div>
                    <Switch
                      checked={lessonContent.is_published}
                      onCheckedChange={(checked) => setLessonContent({ ...lessonContent, is_published: checked })}
                    />
                  </div>
                </div>
              </div>

              {isLoading ? (
                <div className="bg-card rounded-2xl border border-border/50 shadow-soft p-12 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : (
                <>
                  {/* Custom Description */}
                  <div className="bg-card rounded-2xl border border-border/50 shadow-soft p-5 sm:p-6 space-y-3">
                    <Label className="font-medium">Дополнительное описание</Label>
                    <Textarea
                      value={lessonContent.custom_description || ''}
                      onChange={(e) => setLessonContent({ ...lessonContent, custom_description: e.target.value || null })}
                      placeholder="Добавьте дополнительный текст к описанию урока..."
                      className="min-h-[90px] rounded-xl bg-secondary/30 border-border/50 focus:border-primary resize-none"
                    />
                    <p className="text-xs text-muted-foreground">
                      Дополнение к базовому: "{selectedLesson.description.slice(0, 90)}..."
                    </p>
                  </div>

                  {/* Video URLs */}
                  <div className="bg-card rounded-2xl border border-border/50 shadow-soft p-5 sm:p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <Label className="flex items-center gap-2 font-medium">
                        <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Video className="w-3.5 h-3.5 text-primary" />
                        </div>
                        Видео уроков
                      </Label>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={addVideoUrl}
                        disabled={lessonContent.video_urls.length >= MAX_VIDEOS}
                        className="rounded-xl gap-1.5 h-8"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Добавить ({lessonContent.video_urls.length}/{MAX_VIDEOS})
                      </Button>
                    </div>
                    {lessonContent.video_urls.length === 0 ? (
                      <div className="py-6 text-center border border-dashed border-border/50 rounded-xl bg-muted/20">
                        <Video className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
                        <p className="text-sm text-muted-foreground">Нажмите "Добавить" для загрузки видео</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {lessonContent.video_urls.map((url, index) => {
                          const previewUrl = lessonContent.video_preview_urls?.[index];
                          const currentTitle = lessonContent.video_titles?.[index] || '';
                          const fallbackTitle = selectedLesson.videoTopics[index] || `Видео ${index + 1}`;
                          return (
                            <div key={index} className="flex gap-3 items-start p-2 rounded-xl bg-secondary/20 border border-border/50">
                              <div className="relative w-20 h-12 rounded-lg overflow-hidden bg-muted flex-shrink-0 flex items-center justify-center group">
                                {previewUrl ? (
                                  <img src={getUploadUrl(previewUrl)} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <ImagePlus className="w-5 h-5 text-muted-foreground/50" />
                                )}
                                <label className={`absolute inset-0 cursor-pointer flex items-center justify-center transition-all ${previewUrl ? 'bg-black/0 group-hover:bg-black/40 opacity-0 group-hover:opacity-100' : 'bg-black/5'}`}>
                                  {uploadingPreviewIndex === index ? (
                                    <Loader2 className="w-5 h-5 text-white animate-spin" />
                                  ) : (
                                    <ImagePlus className="w-5 h-5 text-white" />
                                  )}
                                  <input
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp"
                                    onChange={(e) => handlePreviewUpload(index, e)}
                                    className="hidden"
                                    disabled={uploadingPreviewIndex !== null}
                                  />
                                </label>
                              </div>
                              <div className="flex-1 min-w-0 space-y-2">
                                <Input
                                  value={url}
                                  onChange={(e) => updateVideoUrl(index, e.target.value)}
                                  placeholder="Ссылка на YouTube или Vimeo"
                                  className="rounded-xl bg-secondary/30 border-border/50 focus:border-primary"
                                />
                                <Input
                                  value={currentTitle}
                                  onChange={(e) => updateVideoTitle(index, e.target.value)}
                                  placeholder={fallbackTitle}
                                  className="rounded-xl bg-background/80 border-border/50 focus:border-primary"
                                />
                                <p className="px-1 text-[11px] text-muted-foreground">
                                  Если поле оставить пустым, на карточке останется старый заголовок: "{fallbackTitle}"
                                </p>
                              </div>
                              {previewUrl && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removePreview(index)}
                                  className="h-8 w-8 text-muted-foreground hover:text-destructive rounded-lg flex-shrink-0"
                                  title="Удалить превью"
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeVideoUrl(index)}
                                className="text-destructive hover:text-destructive hover:bg-destructive/10 rounded-xl flex-shrink-0"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* PDF Uploads */}
                  <div className="bg-card rounded-2xl border border-border/50 shadow-soft p-5 sm:p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <Label className="flex items-center gap-2 font-medium">
                        <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center">
                          <FileText className="w-3.5 h-3.5 text-accent" />
                        </div>
                        PDF презентации ({lessonContent.pdf_urls.length}/{MAX_PDFS})
                      </Label>
                      <Button 
                        variant="outline" 
                        size="sm"
                        disabled={uploadingPdf || lessonContent.pdf_urls.length >= MAX_PDFS}
                        className="rounded-xl gap-1.5 h-8 cursor-pointer"
                        asChild
                      >
                        <label>
                          {uploadingPdf ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <FileUp className="w-3.5 h-3.5" />
                          )}
                          Загрузить PDF
                          <input type="file" accept=".pdf" onChange={handlePdfUpload} className="hidden" disabled={uploadingPdf || lessonContent.pdf_urls.length >= MAX_PDFS} />
                        </label>
                      </Button>
                    </div>
                    {lessonContent.pdf_urls.length === 0 ? (
                      <div className="py-6 text-center border border-dashed border-border/50 rounded-xl bg-muted/20">
                        <FileText className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
                        <p className="text-sm text-muted-foreground">Нет загруженных PDF</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {lessonContent.pdf_urls.map((url, index) => {
                          const rawName = decodeURIComponent(url.split('/').pop() || 'PDF файл');
                              const fileName = rawName.replace(/-\d+\.pdf$/i, '.pdf');
                          return (
                            <div key={index} className="flex items-center gap-3 p-3 rounded-xl bg-secondary/30 border border-border/50">
                              <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                                <FileText className="w-4 h-4 text-accent" />
                              </div>
                              <span className="flex-1 text-sm font-medium truncate">{fileName}</span>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removePdf(index)}
                                className="text-destructive hover:text-destructive hover:bg-destructive/10 rounded-lg h-8 w-8"
                              >
                                <X className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* AI Quiz Prompt */}
                  <div className="bg-card rounded-2xl border border-border/50 shadow-soft p-5 sm:p-6 space-y-3">
                    <Label className="flex items-center gap-2 font-medium">
                      <span className="text-base">🤖</span>
                      Настройки AI-тьютора
                    </Label>
                    <div className="inline-flex rounded-xl border border-border/60 bg-background/80 p-1">
                      <button
                        type="button"
                        onClick={() => setLessonContent({ ...lessonContent, ai_prompt_is_override: false })}
                        className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                          !lessonContent.ai_prompt_is_override
                            ? 'bg-primary text-primary-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        Доп. инструкции
                      </button>
                      <button
                        type="button"
                        onClick={() => setLessonContent({ ...lessonContent, ai_prompt_is_override: true })}
                        className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                          lessonContent.ai_prompt_is_override
                            ? 'bg-destructive text-destructive-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        Полный override
                      </button>
                    </div>
                    <Textarea
                      value={lessonContent.ai_prompt || ''}
                      onChange={(e) => setLessonContent({ ...lessonContent, ai_prompt: e.target.value || null })}
                      placeholder={lessonContent.ai_prompt_is_override
                        ? 'Введите полный системный промпт для AI-тьютора...'
                        : 'Добавьте дополнительные инструкции к базовому промпту...'}
                      className="min-h-[110px] rounded-xl bg-secondary/30 border-border/50 focus:border-primary resize-none"
                    />
                    {lessonContent.ai_prompt_is_override ? (
                      <div className="rounded-xl border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-foreground">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                          <p>
                            В режиме полного override базовый промпт системы не используется. Если поле оставить пустым,
                            тьютор автоматически вернётся к текущему базовому сценарию.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Этот текст добавляется к текущему рабочему базовому промпту. Если поле пустое, тьютор работает как сейчас.
                      </p>
                    )}
                  </div>

                  {/* Practical Task */}
                  <div className="bg-card rounded-2xl border border-border/50 shadow-soft p-5 sm:p-6 space-y-3">
                    <Label className="font-medium">Практическое задание</Label>
                    <Textarea
                      value={lessonContent.additional_materials || ''}
                      onChange={(e) => setLessonContent({ ...lessonContent, additional_materials: e.target.value || null })}
                      placeholder="Текст практического задания для ученика..."
                      className="min-h-[80px] rounded-xl bg-secondary/30 border-border/50 focus:border-primary resize-none"
                    />
                    <p className="text-xs text-muted-foreground">
                      Если оставить поле пустым, на странице урока будет показано старое задание из базовых данных курса.
                    </p>
                  </div>

                  {/* Save Button */}
                  <Button 
                    onClick={saveLessonContent}
                    disabled={isSaving}
                    className="w-full h-12 rounded-xl gradient-hero hover:opacity-90 shadow-glow font-semibold text-base"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Сохранение...
                      </>
                    ) : (
                      <>
                        <Save className="w-5 h-5 mr-2" />
                        Сохранить изменения
                      </>
                    )}
                  </Button>
                </>
              )}
            </div>
          ) : (
            <div className="bg-card rounded-2xl border border-border/50 shadow-soft p-12 flex flex-col items-center justify-center text-center animate-fade-in">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
                <BookOpen className="w-8 h-8 text-primary" />
              </div>
              <p className="font-serif text-lg font-semibold text-foreground mb-2">Выберите урок</p>
              <p className="text-sm text-muted-foreground max-w-xs">
                Нажмите на урок в списке слева для редактирования его содержимого
              </p>
            </div>
          )}
        </div>
      </div>
    </AdminPageLayout>
  );
}
