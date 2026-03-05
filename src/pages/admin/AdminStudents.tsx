import React, { useState, useEffect } from 'react';
import { api } from '@/api/client';
import { useImpersonation } from '@/contexts/ImpersonationContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  Loader2, 
  Users,
  BookOpen,
  CheckCircle2,
  Eye,
  Ban,
  Filter,
  Key,
  RefreshCw,
  Pencil
} from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface StudentProgress {
  user_id: string;
  email: string;
  name: string;
  completed_lessons: number;
  quiz_completed: number;
  invitation_code_comment: string | null;
  is_blocked: boolean;
}

export default function AdminStudents() {
  const navigate = useNavigate();
  const { startImpersonation } = useImpersonation();
  const [students, setStudents] = useState<StudentProgress[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [filterStream, setFilterStream] = useState<string>('all');
  const [availableStreams, setAvailableStreams] = useState<string[]>([]);
  
  // Password reset state
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetStudent, setResetStudent] = useState<StudentProgress | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  // Edit name state
  const [editNameDialogOpen, setEditNameDialogOpen] = useState(false);
  const [editStudent, setEditStudent] = useState<StudentProgress | null>(null);
  const [editedName, setEditedName] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);

  useEffect(() => {
    loadStudents();
  }, []);

  const handleImpersonate = (student: StudentProgress) => {
    startImpersonation({
      user_id: student.user_id,
      name: student.name,
      email: student.email
    });
    toast.success(`Режим просмотра: ${student.name}`);
    navigate('/');
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

  const generatePassword = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let password = '';
    for (let i = 0; i < 8; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPassword(password);
  };

  const openResetDialog = (student: StudentProgress) => {
    setResetStudent(student);
    setNewPassword('');
    setResetDialogOpen(true);
  };

  const openEditNameDialog = (student: StudentProgress) => {
    setEditStudent(student);
    setEditedName(student.name);
    setEditNameDialogOpen(true);
  };

  const handleSaveName = async () => {
    if (!editStudent || !editedName.trim()) {
      toast.error('Введите имя');
      return;
    }

    setIsSavingName(true);
    try {
      await api('/admin/users/update-name', {
        method: 'POST',
        body: { userId: editStudent.user_id, name: editedName.trim() }
      });
      toast.success(`Имя изменено на "${editedName.trim()}"`);
      setEditNameDialogOpen(false);
      setEditStudent(null);
      setEditedName('');
      loadStudents();
    } catch (error: any) {
      console.error('Error updating name:', error);
      toast.error(error.message || 'Ошибка сохранения имени');
    } finally {
      setIsSavingName(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetStudent || !newPassword) {
      toast.error('Введите новый пароль');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('Пароль должен быть минимум 6 символов');
      return;
    }

    setIsResettingPassword(true);
    try {
      await api('/admin/reset-password', {
        method: 'POST',
        body: { email: resetStudent.email, newPassword }
      });
      toast.success(`Пароль для ${resetStudent.name} успешно изменён`);
      setResetDialogOpen(false);
      setResetStudent(null);
      setNewPassword('');
      loadStudents();
    } catch (error: unknown) {
      console.error('Error resetting password:', error);
      toast.error(error instanceof Error ? error.message : 'Ошибка сброса пароля');
    } finally {
      setIsResettingPassword(false);
    }
  };

  const filteredStudents = (filterStream === 'all' 
    ? students.filter(s => !s.is_blocked) // Exclude blocked from "all streams"
    : filterStream === 'none'
      ? students.filter(s => !s.invitation_code_comment || s.is_blocked) // Show blocked here regardless of stream
      : students.filter(s => s.invitation_code_comment === filterStream && !s.is_blocked) // Exclude blocked from specific streams
  ).sort((a, b) => {
    // Sort by completed lessons desc, then by quizzes completed desc
    const totalA = a.completed_lessons + a.quiz_completed;
    const totalB = b.completed_lessons + b.quiz_completed;
    if (totalB !== totalA) return totalB - totalA;
    if (b.completed_lessons !== a.completed_lessons) return b.completed_lessons - a.completed_lessons;
    return b.quiz_completed - a.quiz_completed;
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-2xl font-serif font-bold text-foreground">Студенты</h1>
          <p className="text-muted-foreground">Управление учениками курса</p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Список студентов ({filteredStudents.length})
              </CardTitle>
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <Select value={filterStream} onValueChange={setFilterStream}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Все потоки" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все потоки</SelectItem>
                    <SelectItem value="none">Без потока</SelectItem>
                    {availableStreams.map(stream => (
                      <SelectItem key={stream} value={stream}>{stream}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loadingStudents ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : (
              <div className="space-y-2">
                {filteredStudents.map((student) => (
                  <div 
                    key={student.user_id} 
                    className={`flex items-center justify-between p-4 rounded-lg border ${
                      student.is_blocked ? 'bg-destructive/5 border-destructive/20' : 'bg-secondary/30'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">{student.name}</p>
                      <p className="text-sm text-muted-foreground truncate">{student.email}</p>
                      <div className="flex items-center gap-3 mt-1">
                        {student.is_blocked ? (
                          <span className="text-xs px-2 py-0.5 bg-destructive/10 text-destructive rounded font-medium">
                            Заблокирован
                          </span>
                        ) : (
                          <span className="text-xs px-2 py-0.5 bg-green-500/10 text-green-600 rounded font-medium">
                            Активен
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">
                          Поток: <span className="text-primary">{student.invitation_code_comment || '—'}</span>
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 ml-4">
                      <div className="text-center">
                        <div className="flex items-center gap-1 text-sm">
                          <BookOpen className="w-4 h-4 text-primary" />
                          <span>{student.completed_lessons}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">уроков</p>
                      </div>
                      <div className="text-center">
                        <div className="flex items-center gap-1 text-sm">
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                          <span>{student.quiz_completed}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">тестов</p>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditNameDialog(student)}
                          title="Редактировать имя"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleImpersonate(student)}
                          title="Просмотр от имени"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openResetDialog(student)}
                          title="Сбросить пароль"
                        >
                          <Key className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleBlockStudent(student)}
                          className={student.is_blocked ? 'text-green-500 hover:text-green-500' : 'text-destructive hover:text-destructive'}
                          title={student.is_blocked ? 'Разблокировать' : 'Заблокировать'}
                        >
                          <Ban className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Password Reset Dialog */}
      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Сброс пароля</DialogTitle>
            <DialogDescription>
              Установить новый пароль для {resetStudent?.name} ({resetStudent?.email})
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">Новый пароль</Label>
              <div className="flex gap-2">
                <Input
                  id="new-password"
                  type="text"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Минимум 6 символов"
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={generatePassword}
                  title="Сгенерировать пароль"
                >
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>
              {newPassword && (
                <p className="text-sm text-muted-foreground">
                  Пароль: <span className="font-mono text-foreground">{newPassword}</span>
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetDialogOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleResetPassword} disabled={isResettingPassword}>
              {isResettingPassword ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Сброс...
                </>
              ) : (
                'Сбросить пароль'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Name Dialog */}
      <Dialog open={editNameDialogOpen} onOpenChange={setEditNameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Редактировать имя</DialogTitle>
            <DialogDescription>
              Изменить имя для {editStudent?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Имя</Label>
              <Input
                id="edit-name"
                type="text"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                placeholder="Введите имя"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditNameDialogOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleSaveName} disabled={isSavingName}>
              {isSavingName ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Сохранение...
                </>
              ) : (
                'Сохранить'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
