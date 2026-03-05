import React, { useState, useEffect } from 'react';
import { api, apiUpload } from '@/api/client';
import { courseData, getAllLessons } from '@/data/courseData';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
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
} from 'lucide-react';
import { toast } from 'sonner';

interface LessonContent {
  id?: string;
  lesson_id: number;
  custom_description: string | null;
  video_urls: string[];
  pdf_urls: string[];
  additional_materials: string | null;
  is_published: boolean;
  ai_prompt: string | null;
}

export default function AdminLessons() {
  const [selectedLessonId, setSelectedLessonId] = useState<number | null>(null);
  const [lessonContent, setLessonContent] = useState<LessonContent | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);

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
      const data = await api<{ id: string; lessonId: number; customDescription: string | null; videoUrls: string[]; pdfUrls: string[]; additionalMaterials: string | null; isPublished: boolean; aiPrompt: string | null }>(`/lessons/${lessonId}`);
      setLessonContent({
        id: data.id,
        lesson_id: data.lessonId,
        custom_description: data.customDescription,
        video_urls: data.videoUrls || [],
        pdf_urls: data.pdfUrls || [],
        additional_materials: data.additionalMaterials,
        is_published: data.isPublished ?? true,
        ai_prompt: data.aiPrompt || null
      });
    } catch {
      setLessonContent({
        lesson_id: lessonId,
        custom_description: null,
        video_urls: [],
        pdf_urls: [],
        additional_materials: null,
        is_published: true,
        ai_prompt: null
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
          pdfUrls: lessonContent.pdf_urls,
          additionalMaterials: lessonContent.additional_materials,
          isPublished: lessonContent.is_published,
          aiPrompt: lessonContent.ai_prompt
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
        video_urls: [...lessonContent.video_urls, '']
      });
    }
  };

  const removeVideoUrl = (index: number) => {
    if (lessonContent) {
      setLessonContent({
        ...lessonContent,
        video_urls: lessonContent.video_urls.filter((_, i) => i !== index)
      });
    }
  };

  const updateVideoUrl = (index: number, value: string) => {
    if (lessonContent) {
      const newUrls = [...lessonContent.video_urls];
      newUrls[index] = value;
      setLessonContent({
        ...lessonContent,
        video_urls: newUrls
      });
    }
  };

  const MAX_PDFS = 6;

  const handlePdfUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!lessonContent || !event.target.files?.length) return;
    
    const file = event.target.files[0];
    if (!file.type.includes('pdf')) {
      toast.error('Пожалуйста, загрузите PDF файл');
      return;
    }

    if (lessonContent.pdf_urls.length >= MAX_PDFS) {
      toast.error(`Максимум ${MAX_PDFS} PDF файлов`);
      return;
    }

    setUploadingPdf(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('lessonId', String(lessonContent.lesson_id));
      const { url } = await apiUpload('/admin/lessons/upload-pdf', formData) as { url: string };
      setLessonContent({
        ...lessonContent,
        pdf_urls: [...lessonContent.pdf_urls, url]
      });
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
    setLessonContent({
      ...lessonContent,
      pdf_urls: lessonContent.pdf_urls.filter((_, i) => i !== index)
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-serif font-bold text-foreground">Управление уроками</h1>
          <p className="text-muted-foreground">Выберите урок для редактирования</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Lessons List */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Список уроков</CardTitle>
                <CardDescription>Выберите урок для редактирования</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-[600px] overflow-y-auto">
                  {courseData.map(week => (
                    <div key={week.id}>
                      <div className="px-4 py-2 bg-muted/50 text-sm font-medium text-muted-foreground">
                        Неделя {week.id}
                      </div>
                      {week.lessons.map(lesson => (
                        <button
                          key={lesson.id}
                          onClick={() => setSelectedLessonId(lesson.id)}
                          className={`
                            w-full px-4 py-3 text-left border-b border-border
                            hover:bg-muted/50 transition-colors
                            ${selectedLessonId === lesson.id ? 'bg-primary/10 border-l-2 border-l-primary' : ''}
                          `}
                        >
                          <span className="text-xs text-primary font-medium">День {lesson.day}</span>
                          <p className="text-sm font-medium text-foreground truncate">
                            {lesson.title}
                          </p>
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Lesson Editor */}
          <div className="lg:col-span-2">
            {selectedLesson && lessonContent ? (
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>День {selectedLesson.day}: {selectedLesson.title}</CardTitle>
                      <CardDescription>Редактирование контента урока</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="published" className="text-sm">Опубликован</Label>
                      <Switch
                        id="published"
                        checked={lessonContent.is_published}
                        onCheckedChange={(checked) => 
                          setLessonContent({ ...lessonContent, is_published: checked })
                        }
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    </div>
                  ) : (
                    <>
                      {/* Custom Description */}
                      <div className="space-y-2">
                        <Label>Дополнительное описание</Label>
                        <Textarea
                          value={lessonContent.custom_description || ''}
                          onChange={(e) => setLessonContent({ 
                            ...lessonContent, 
                            custom_description: e.target.value || null 
                          })}
                          placeholder="Добавьте дополнительный текст к описанию урока..."
                          className="min-h-[100px]"
                        />
                        <p className="text-xs text-muted-foreground">
                          Это дополнение к базовому описанию: "{selectedLesson.description.slice(0, 100)}..."
                        </p>
                      </div>

                      {/* Video URLs */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="flex items-center gap-2">
                            <Video className="w-4 h-4" />
                            Видео уроков
                          </Label>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={addVideoUrl}
                            disabled={lessonContent.video_urls.length >= MAX_VIDEOS}
                          >
                            <Plus className="w-4 h-4 mr-1" />
                            Добавить видео ({lessonContent.video_urls.length}/{MAX_VIDEOS})
                          </Button>
                        </div>
                        {lessonContent.video_urls.length === 0 ? (
                          <p className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-lg">
                            Нет добавленных видео. Нажмите "Добавить видео" для загрузки.
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {lessonContent.video_urls.map((url, index) => (
                              <div key={index} className="flex gap-2">
                                <Input
                                  value={url}
                                  onChange={(e) => updateVideoUrl(index, e.target.value)}
                                  placeholder="ID видео Kinescope (например: abc123def456)"
                                />
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeVideoUrl(index)}
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* PDF Uploads */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="flex items-center gap-2">
                            <FileText className="w-4 h-4" />
                            PDF презентации
                          </Label>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">
                              {lessonContent.pdf_urls.length}/{MAX_PDFS}
                            </span>
                            <Button 
                              variant="outline" 
                              size="sm"
                              disabled={uploadingPdf || lessonContent.pdf_urls.length >= MAX_PDFS}
                              asChild
                            >
                              <label className="cursor-pointer">
                                {uploadingPdf ? (
                                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                                ) : (
                                  <FileUp className="w-4 h-4 mr-1" />
                                )}
                                Загрузить PDF
                                <input
                                  type="file"
                                  accept=".pdf"
                                  onChange={handlePdfUpload}
                                  className="hidden"
                                  disabled={uploadingPdf || lessonContent.pdf_urls.length >= MAX_PDFS}
                                />
                              </label>
                            </Button>
                          </div>
                        </div>
                        {lessonContent.pdf_urls.length === 0 ? (
                          <p className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-lg">
                            Нет загруженных PDF. Нажмите "Загрузить PDF" для добавления.
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {lessonContent.pdf_urls.map((url, index) => {
                              const fileName = decodeURIComponent(url.split('/').pop() || 'PDF файл');
                              return (
                                <div key={index} className="flex items-center gap-2 p-3 rounded-lg bg-secondary/50 border border-border/50">
                                  <FileText className="w-4 h-4 text-primary flex-shrink-0" />
                                  <span className="flex-1 text-sm truncate">{fileName}</span>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => removePdf(index)}
                                    className="text-destructive hover:text-destructive h-8 w-8"
                                  >
                                    <X className="w-4 h-4" />
                                  </Button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* AI Quiz Prompt */}
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          🤖 Промпт для AI-тьютора
                        </Label>
                        <Textarea
                          value={lessonContent.ai_prompt || ''}
                          onChange={(e) => setLessonContent({ 
                            ...lessonContent, 
                            ai_prompt: e.target.value || null 
                          })}
                          placeholder="Опишите, чему AI должен учить студента в этом уроке. Например: 'Научи студента различать типы промптов и объясни, когда применять каждый из них. Используй примеры из практики психолога.'"
                          className="min-h-[120px]"
                        />
                        <p className="text-xs text-muted-foreground">
                          Этот промпт определяет поведение AI-тьютора при проверке знаний по уроку. 
                          Оставьте пустым для использования стандартного промпта.
                        </p>
                      </div>

                      {/* Additional Materials */}
                      <div className="space-y-2">
                        <Label>Дополнительные материалы</Label>
                        <Textarea
                          value={lessonContent.additional_materials || ''}
                          onChange={(e) => setLessonContent({ 
                            ...lessonContent, 
                            additional_materials: e.target.value || null 
                          })}
                          placeholder="Ссылки на документы, статьи, шаблоны..."
                          className="min-h-[80px]"
                        />
                      </div>

                      {/* Save Button */}
                      <Button 
                        onClick={saveLessonContent}
                        disabled={isSaving}
                        className="w-full"
                      >
                        {isSaving ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Сохранение...
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4 mr-2" />
                            Сохранить изменения
                          </>
                        )}
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                  <BookOpen className="w-12 h-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Выберите урок слева для редактирования</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
