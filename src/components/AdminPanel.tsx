import React, { useState, useEffect } from 'react';
import { api, apiUpload } from '@/api/client';
import { courseData, Lesson, getAllLessons } from '@/data/courseData';
import { useImpersonation } from '@/contexts/ImpersonationContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ChevronLeft, 
  Save, 
  Loader2, 
  Video, 
  Plus, 
  Trash2, 
  Users,
  BookOpen,
  CheckCircle2,
  FileUp,
  FileText,
  X,
  Eye,
  Play,
  Key,
  Ticket,
  Copy,
  Ban,
  Filter
} from 'lucide-react';
import { PracticalMaterialsAdmin } from './PracticalMaterialsAdmin';
import { toast } from 'sonner';

interface AdminPanelProps {
  onClose: () => void;
}

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

interface StudentProgress {
  user_id: string;
  email: string;
  name: string;
  completed_lessons: number;
  quiz_completed: number;
  invitation_code_comment: string | null;
  is_blocked: boolean;
}

interface InvitationCode {
  id: string;
  code: string;
  comment: string;
  is_active: boolean;
  created_at: string;
}

export function AdminPanel({ onClose }: AdminPanelProps) {
  const { startImpersonation } = useImpersonation();
  const [selectedLessonId, setSelectedLessonId] = useState<number | null>(null);
  const [lessonContent, setLessonContent] = useState<LessonContent | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [students, setStudents] = useState<StudentProgress[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  
  // Password reset state
  const [resetEmail, setResetEmail] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  // Invitation codes state
  const [invitationCodes, setInvitationCodes] = useState<InvitationCode[]>([]);
  const [loadingCodes, setLoadingCodes] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newComment, setNewComment] = useState('');
  const [savingCode, setSavingCode] = useState(false);

  // Filter state
  const [filterStream, setFilterStream] = useState<string>('all');
  const [availableStreams, setAvailableStreams] = useState<string[]>([]);

  const allLessons = getAllLessons();
  const selectedLesson = allLessons.find(l => l.id === selectedLessonId);

  const handleImpersonate = (student: StudentProgress) => {
    startImpersonation({
      user_id: student.user_id,
      name: student.name,
      email: student.email
    });
    toast.success(`Режим просмотра: ${student.name}`);
    onClose();
  };

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

  const loadStudents = async () => {
    setLoadingStudents(true);
    try {
      const data = await api<Array<{
        user_id: string;
        email: string;
        name: string;
        completed_lessons: number;
        quiz_completed: number;
        invitation_code_comment: string | null;
        is_blocked: boolean;
      }>>('/admin/users');
      const studentData: StudentProgress[] = data.map((u) => ({
        user_id: u.user_id,
        email: u.email,
        name: u.name,
        completed_lessons: u.completed_lessons,
        quiz_completed: u.quiz_completed,
        invitation_code_comment: u.invitation_code_comment,
        is_blocked: u.is_blocked
      }));
      const streams = new Set(data.map(u => u.invitation_code_comment).filter(Boolean) as string[]);
      setAvailableStreams(Array.from(streams).sort());
      setStudents(studentData);
    } catch (error) {
      console.error('Error loading students:', error);
      toast.error('Ошибка загрузки списка студентов');
    } finally {
      setLoadingStudents(false);
    }
  };

  const toggleBlockStudent = async (student: StudentProgress) => {
    try {
      const newBlockedStatus = !student.is_blocked;
      await api(newBlockedStatus ? '/admin/block-user' : '/admin/unblock-user', {
        method: 'POST',
        body: { userId: student.user_id }
      });
      toast.success(newBlockedStatus ? `${student.name} заблокирован` : `${student.name} разблокирован`);
      loadStudents();
    } catch (error) {
      console.error('Error toggling block status:', error);
      toast.error('Ошибка изменения статуса');
    }
  };

  const filteredStudents = filterStream === 'all' 
    ? students 
    : filterStream === 'none'
      ? students.filter(s => !s.invitation_code_comment)
      : students.filter(s => s.invitation_code_comment === filterStream);

  const loadInvitationCodes = async () => {
    setLoadingCodes(true);
    try {
      const data = await api<Array<{ id: string; code: string; comment: string; isActive: boolean; createdAt: string }>>('/admin/codes');
      setInvitationCodes(data.map(c => ({ id: c.id, code: c.code, comment: c.comment, is_active: c.isActive, created_at: c.createdAt })));
    } catch (error) {
      console.error('Error loading codes:', error);
      toast.error('Ошибка загрузки кодов');
    } finally {
      setLoadingCodes(false);
    }
  };

  const generateRandomCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 7; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewCode(code);
  };

  const saveInvitationCode = async () => {
    if (!newCode.trim() || !newComment.trim()) {
      toast.error('Введите код и комментарий');
      return;
    }

    setSavingCode(true);
    try {
      await api('/admin/codes', {
        method: 'POST',
        body: { code: newCode.trim().toUpperCase(), comment: newComment.trim(), isActive: true }
      });
      toast.success('Код создан!');
      setNewCode('');
      setNewComment('');
      loadInvitationCodes();
    } catch (error: unknown) {
      console.error('Error saving code:', error);
      toast.error(error instanceof Error && error.message.includes('существует') ? 'Такой код уже существует' : 'Ошибка сохранения кода');
    } finally {
      setSavingCode(false);
    }
  };

  const toggleCodeActive = async (code: InvitationCode) => {
    try {
      await api(`/admin/codes/${code.id}`, {
        method: 'PUT',
        body: { isActive: !code.is_active }
      });
      loadInvitationCodes();
      toast.success(code.is_active ? 'Код деактивирован' : 'Код активирован');
    } catch (error) {
      console.error('Error toggling code:', error);
      toast.error('Ошибка изменения статуса');
    }
  };

  const copyCodeToClipboard = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Код скопирован!');
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

  const handleResetPassword = async () => {
    if (!resetEmail || !resetPassword) {
      toast.error('Введите email и новый пароль');
      return;
    }

    if (resetPassword.length < 6) {
      toast.error('Пароль должен быть минимум 6 символов');
      return;
    }

    setIsResettingPassword(true);
    try {
      await api('/admin/reset-password', {
        method: 'POST',
        body: { email: resetEmail, newPassword: resetPassword }
      });
      toast.success(`Пароль для ${resetEmail} успешно изменён`);
      setResetEmail('');
      setResetPassword('');
    } catch (error) {
      console.error('Error resetting password:', error);
      toast.error(error instanceof Error ? error.message : 'Ошибка сброса пароля');
    } finally {
      setIsResettingPassword(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={onClose}>
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <h1 className="font-serif text-2xl font-semibold text-foreground">
              Админ-панель
            </h1>
          </div>
        </div>

        <Tabs defaultValue="lessons" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="lessons" className="flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              Уроки
            </TabsTrigger>
            <TabsTrigger value="practical" className="flex items-center gap-2">
              <Play className="w-4 h-4" />
              Практические материалы
            </TabsTrigger>
            <TabsTrigger value="students" className="flex items-center gap-2" onClick={loadStudents}>
              <Users className="w-4 h-4" />
              Студенты
            </TabsTrigger>
            <TabsTrigger value="invitation-codes" className="flex items-center gap-2" onClick={loadInvitationCodes}>
              <Ticket className="w-4 h-4" />
              Пригл. коды
            </TabsTrigger>
            <TabsTrigger value="password-reset" className="flex items-center gap-2">
              <Key className="w-4 h-4" />
              Сброс пароля
            </TabsTrigger>
          </TabsList>

          <TabsContent value="lessons">
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
                                ${selectedLessonId === lesson.id ? 'bg-primary/5 border-l-2 border-l-primary' : ''}
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
                                      placeholder="https://youtube.com/watch?v=... или https://vimeo.com/..."
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
                                  const rawName = decodeURIComponent(url.split('/').pop() || 'PDF файл');
                                  const fileName = rawName.replace(/-\d+\.pdf$/i, '.pdf');
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
                            className="w-full gradient-hero"
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
                    <CardContent className="py-16 text-center">
                      <BookOpen className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">
                        Выберите урок слева для редактирования
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="practical">
            <Card>
              <CardContent className="pt-6">
                <PracticalMaterialsAdmin />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="students">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Список студентов</CardTitle>
                    <CardDescription>Прогресс обучения всех студентов</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-muted-foreground" />
                    <select
                      value={filterStream}
                      onChange={(e) => setFilterStream(e.target.value)}
                      className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      <option value="all">Все потоки</option>
                      <option value="none">Без потока</option>
                      {availableStreams.map(stream => (
                        <option key={stream} value={stream}>{stream}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loadingStudents ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : filteredStudents.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    {students.length === 0 ? 'Нет зарегистрированных студентов' : 'Нет студентов в выбранном потоке'}
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left py-3 px-4 font-medium text-muted-foreground">Имя</th>
                          <th className="text-left py-3 px-4 font-medium text-muted-foreground">Email</th>
                          <th className="text-left py-3 px-4 font-medium text-muted-foreground">Поток</th>
                          <th className="text-center py-3 px-4 font-medium text-muted-foreground">Статус</th>
                          <th className="text-center py-3 px-4 font-medium text-muted-foreground">Уроки</th>
                          <th className="text-center py-3 px-4 font-medium text-muted-foreground">Тесты</th>
                          <th className="text-center py-3 px-4 font-medium text-muted-foreground">Действия</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredStudents.map(student => (
                          <tr key={student.user_id} className={`border-b border-border hover:bg-muted/30 transition-colors ${student.is_blocked ? 'opacity-60 bg-destructive/5' : ''}`}>
                            <td className="py-3 px-4 font-medium">
                              {student.name}
                              {student.is_blocked && <span className="ml-2 text-destructive text-xs">(заблокирован)</span>}
                            </td>
                            <td className="py-3 px-4 text-muted-foreground">{student.email}</td>
                            <td className="py-3 px-4">
                              {student.invitation_code_comment ? (
                                <span className="inline-flex items-center px-2 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                                  {student.invitation_code_comment}
                                </span>
                              ) : (
                                <span className="text-muted-foreground text-xs">—</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                student.is_blocked 
                                  ? 'bg-destructive/10 text-destructive' 
                                  : 'bg-green-100 text-green-700'
                              }`}>
                                {student.is_blocked ? 'Заблокирован' : 'Активен'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-success/10 text-success text-sm">
                                <CheckCircle2 className="w-3 h-3" />
                                {student.completed_lessons}/21
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-accent/10 text-accent text-sm">
                                {student.quiz_completed}/21
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center justify-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleImpersonate(student)}
                                  className="gap-1.5"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  Войти
                                </Button>
                                <Button
                                  variant={student.is_blocked ? "outline" : "destructive"}
                                  size="sm"
                                  onClick={() => toggleBlockStudent(student)}
                                  className="gap-1.5"
                                >
                                  <Ban className="w-3.5 h-3.5" />
                                  {student.is_blocked ? 'Разблок.' : 'Блок.'}
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="password-reset">
            <Card>
              <CardHeader>
                <CardTitle>Сброс пароля пользователя</CardTitle>
                <CardDescription>
                  Введите email пользователя и новый пароль для сброса
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-email">Email пользователя</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="user@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reset-password">Новый пароль</Label>
                  <Input
                    id="reset-password"
                    type="text"
                    value={resetPassword}
                    onChange={(e) => setResetPassword(e.target.value)}
                    placeholder="Минимум 6 символов"
                  />
                </div>
                <Button 
                  onClick={handleResetPassword}
                  disabled={isResettingPassword || !resetEmail || !resetPassword}
                  className="w-full"
                >
                  {isResettingPassword ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Сброс пароля...
                    </>
                  ) : (
                    <>
                      <Key className="w-4 h-4 mr-2" />
                      Сбросить пароль
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="invitation-codes">
            <Card>
              <CardHeader>
                <CardTitle>Пригласительные коды</CardTitle>
                <CardDescription>Создавайте коды для регистрации новых студентов</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Create new code */}
                <div className="p-4 rounded-lg border border-border bg-muted/30">
                  <h3 className="font-medium mb-4">Создать новый код</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Код</Label>
                      <div className="flex gap-2">
                        <Input
                          value={newCode}
                          onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                          placeholder="X1D5378"
                          className="uppercase"
                        />
                        <Button variant="outline" size="icon" onClick={generateRandomCode} title="Сгенерировать">
                          🎲
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Комментарий</Label>
                      <Input
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="Поток 1"
                      />
                    </div>
                    <div className="flex items-end">
                      <Button 
                        onClick={saveInvitationCode} 
                        disabled={savingCode || !newCode.trim() || !newComment.trim()}
                        className="w-full"
                      >
                        {savingCode ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Plus className="w-4 h-4 mr-2" />
                            Создать код
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Codes list */}
                {loadingCodes ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : invitationCodes.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Нет созданных кодов
                  </p>
                ) : (
                  <div className="space-y-2">
                    {invitationCodes.map(code => (
                      <div 
                        key={code.id} 
                        className={`flex items-center justify-between p-4 rounded-lg border ${
                          code.is_active ? 'bg-card border-border' : 'bg-muted/50 border-border/50'
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <code className={`font-mono text-lg font-bold ${code.is_active ? 'text-primary' : 'text-muted-foreground line-through'}`}>
                              {code.code}
                            </code>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8"
                              onClick={() => copyCodeToClipboard(code.code)}
                            >
                              <Copy className="w-4 h-4" />
                            </Button>
                          </div>
                          <span className="text-muted-foreground">—</span>
                          <span className={code.is_active ? '' : 'text-muted-foreground'}>{code.comment}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            code.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                          }`}>
                            {code.is_active ? 'Активен' : 'Неактивен'}
                          </span>
                          <Switch
                            checked={code.is_active}
                            onCheckedChange={() => toggleCodeActive(code)}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
