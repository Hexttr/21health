import React, { useState, useEffect } from 'react';
import { api } from '@/api/client';
import { useImpersonation } from '@/contexts/ImpersonationContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AdminPageLayout } from '@/components/AdminPageLayout';
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
  Eye,
  Ban,
  Key,
  RefreshCw,
  Pencil,
  UserCheck,
  UserX,
  Sparkles,
  Trash2,
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

type AppRole = 'admin' | 'student';

interface StudentProgress {
  user_id: string;
  email: string;
  name: string;
  role: AppRole;
  completed_lessons: number;
  quiz_completed: number;
  is_blocked: boolean;
}

export default function AdminStudents() {
  const navigate = useNavigate();
  const { startImpersonation } = useImpersonation();
  const [students, setStudents] = useState<StudentProgress[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetStudent, setResetStudent] = useState<StudentProgress | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  const [editNameDialogOpen, setEditNameDialogOpen] = useState(false);
  const [editStudent, setEditStudent] = useState<StudentProgress | null>(null);
  const [editedName, setEditedName] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);

  const [changingRoleFor, setChangingRoleFor] = useState<string | null>(null);
  const [deletingStudentId, setDeletingStudentId] = useState<string | null>(null);
  const [studentToDelete, setStudentToDelete] = useState<StudentProgress | null>(null);

  const getRoleLabel = (role: AppRole) => {
    if (role === 'admin') return 'Админ';
    return 'Студент';
  };

  useEffect(() => {
    loadStudents();
  }, []);

  const handleImpersonate = (student: StudentProgress) => {
    startImpersonation({ user_id: student.user_id, name: student.name, email: student.email });
    toast.success(`Режим просмотра: ${student.name}`);
    navigate('/');
  };

  const loadStudents = async () => {
    setLoadingStudents(true);
    try {
      const data = await api<Array<{
        user_id: string; email: string; name: string; role: AppRole;
        completed_lessons: number; quiz_completed: number;
        is_blocked: boolean;
      }>>('/admin/users');
      const studentData: StudentProgress[] = data.map((u) => ({
        user_id: u.user_id, email: u.email, name: u.name, role: u.role || 'student',
        completed_lessons: u.completed_lessons, quiz_completed: u.quiz_completed,
        is_blocked: u.is_blocked
      }));
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
        method: 'POST', body: { userId: student.user_id }
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
    for (let i = 0; i < 8; i++) password += chars.charAt(Math.floor(Math.random() * chars.length));
    setNewPassword(password);
  };

  const openResetDialog = (student: StudentProgress) => {
    setResetStudent(student); setNewPassword(''); setResetDialogOpen(true);
  };

  const openEditNameDialog = (student: StudentProgress) => {
    setEditStudent(student); setEditedName(student.name); setEditNameDialogOpen(true);
  };

  const handleSetRole = async (userId: string, role: AppRole) => {
    setChangingRoleFor(userId);
    try {
      const response = await api<{ success: true; role: AppRole; bonusAwardedTokens?: number }>('/admin/set-role', {
        method: 'POST',
        body: { userId, role },
      });
      if (response.bonusAwardedTokens && response.bonusAwardedTokens > 0) {
        toast.success(`Роль изменена, начислено ${response.bonusAwardedTokens} токенов`);
      } else {
        toast.success('Роль изменена');
      }
      loadStudents();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Ошибка смены роли');
    } finally {
      setChangingRoleFor(null);
    }
  };

  const handleSaveName = async () => {
    if (!editStudent || !editedName.trim()) { toast.error('Введите имя'); return; }
    setIsSavingName(true);
    try {
      await api('/admin/users/update-name', { method: 'POST', body: { userId: editStudent.user_id, name: editedName.trim() } });
      toast.success(`Имя изменено на "${editedName.trim()}"`);
      setEditNameDialogOpen(false); setEditStudent(null); setEditedName('');
      loadStudents();
    } catch (error: any) {
      console.error('Error updating name:', error);
      toast.error(error.message || 'Ошибка сохранения имени');
    } finally {
      setIsSavingName(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetStudent || !newPassword) { toast.error('Введите новый пароль'); return; }
    if (newPassword.length < 6) { toast.error('Пароль должен быть минимум 6 символов'); return; }
    setIsResettingPassword(true);
    try {
      await api('/admin/reset-password', { method: 'POST', body: { email: resetStudent.email, newPassword } });
      toast.success(`Пароль для ${resetStudent.name} успешно изменён`);
      setResetDialogOpen(false); setResetStudent(null); setNewPassword('');
      loadStudents();
    } catch (error: unknown) {
      console.error('Error resetting password:', error);
      toast.error(error instanceof Error ? error.message : 'Ошибка сброса пароля');
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleDeleteStudent = async () => {
    if (!studentToDelete) {
      return;
    }

    setDeletingStudentId(studentToDelete.user_id);
    try {
      await api(`/admin/users/${studentToDelete.user_id}`, { method: 'DELETE' });
      toast.success('Пользователь удалён');
      setStudentToDelete(null);
      loadStudents();
    } catch (error) {
      console.error('Error deleting student:', error);
      toast.error(error instanceof Error ? error.message : 'Ошибка удаления пользователя');
    } finally {
      setDeletingStudentId(null);
    }
  };
  const filteredStudents = students.sort((a, b) => {
    const totalA = a.completed_lessons + a.quiz_completed;
    const totalB = b.completed_lessons + b.quiz_completed;
    if (totalB !== totalA) return totalB - totalA;
    if (b.completed_lessons !== a.completed_lessons) return b.completed_lessons - a.completed_lessons;
    return b.quiz_completed - a.quiz_completed;
  });

  const totalActive = students.filter(s => !s.is_blocked).length;
  const totalBlocked = students.filter(s => s.is_blocked).length;

  return (
    <AdminPageLayout
      title="Студенты"
      description="Управление учениками курса"
      icon={Users}
      actions={
        <Button variant="outline" size="sm" onClick={loadStudents} disabled={loadingStudents} className="rounded-xl gap-2 h-9">
          <RefreshCw className={`w-3.5 h-3.5 ${loadingStudents ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Обновить</span>
        </Button>
      }
    >
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-6">
        {[
          { label: 'Всего студентов', value: students.length, icon: Users, color: 'primary' },
          { label: 'Активных', value: totalActive, icon: UserCheck, color: 'success' },
          { label: 'Заблокированных', value: totalBlocked, icon: UserX, color: 'destructive' },
        ].map(stat => (
          <div key={stat.label} className="bg-card rounded-2xl border border-border/50 shadow-soft p-4 sm:p-5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${
              stat.color === 'primary' ? 'bg-primary/10' :
              stat.color === 'success' ? 'bg-success/10' : 'bg-destructive/10'
            }`}>
              <stat.icon className={`w-4.5 h-4.5 ${
                stat.color === 'primary' ? 'text-primary' :
                stat.color === 'success' ? 'text-success' : 'text-destructive'
              }`} style={{ width: '18px', height: '18px' }} />
            </div>
            <p className="text-2xl font-serif font-semibold text-foreground">{stat.value}</p>
            <p className="text-xs text-muted-foreground font-medium mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Students List */}
      <div className="bg-card rounded-2xl border border-border/50 shadow-soft overflow-hidden">
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-border/50">
          <div className="flex items-center gap-2">
            <h2 className="font-serif font-semibold text-foreground">
              Список студентов
            </h2>
            <span className="text-xs font-semibold text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
              {filteredStudents.length}
            </span>
          </div>
        </div>

        {loadingStudents ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Users className="w-12 h-12 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">Нет студентов в этой категории</p>
          </div>
        ) : (
          <>
            {/* Header row — скрыт на мобильных */}
            <div className="hidden sm:grid sm:grid-cols-[auto_1fr_auto_auto_auto] gap-4 px-5 sm:px-6 py-3 border-b border-border/50 bg-secondary/20 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <div className="w-10" />
              <div>Студент</div>
              <div className="w-[160px]">Роль</div>
              <div className="text-center min-w-[100px]">Прогресс</div>
              <div className="w-[140px] text-right">Действия</div>
            </div>
            <div className="divide-y divide-border/50">
            {filteredStudents.map((student, index) => (
              <div
                key={student.user_id}
                className={`flex flex-col sm:grid sm:grid-cols-[auto_1fr_auto_auto_auto] sm:items-center gap-3 sm:gap-4 px-5 sm:px-6 py-4 hover:bg-secondary/20 transition-colors ${
                  student.is_blocked ? 'bg-destructive/3' : ''
                }`}
              >
                {/* Avatar */}
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-serif font-semibold text-sm flex-shrink-0 ${
                  student.is_blocked 
                    ? 'bg-destructive/10 text-destructive' 
                    : 'bg-primary/10 text-primary'
                }`}>
                  {student.name?.charAt(0)?.toUpperCase() || '?'}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-foreground truncate">{student.name}</p>
                    {student.is_blocked && (
                      <span className="text-xs px-2 py-0.5 bg-destructive/10 text-destructive rounded-full font-medium flex-shrink-0">
                        Заблокирован
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground truncate mt-0.5">{student.email}</p>
                </div>

                {/* Роль — отдельная колонка */}
                <div className="flex items-center gap-2 sm:flex-col sm:items-start">
                  <span className="text-xs text-muted-foreground sm:hidden">Роль:</span>
                  <Select
                    value={student.role}
                    onValueChange={(v) => handleSetRole(student.user_id, v as AppRole)}
                    disabled={changingRoleFor === student.user_id}
                  >
                    <SelectTrigger className="w-full sm:w-[160px] h-8 rounded-lg border-border/50 bg-secondary/30 text-xs font-medium gap-1.5">
                      {changingRoleFor === student.user_id && <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" />}
                      <SelectValue>{getRoleLabel(student.role)}</SelectValue>
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="admin">Админ</SelectItem>
                      <SelectItem value="student">Студент</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Progress stats */}
                <div className="hidden sm:flex items-center gap-4 flex-shrink-0">
                  <div className="text-center min-w-[40px]">
                    <div className="flex items-center justify-center gap-1">
                      <BookOpen className="w-3.5 h-3.5 text-primary" />
                      <span className="text-sm font-semibold text-foreground">{student.completed_lessons}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">уроков</p>
                  </div>
                  <div className="text-center min-w-[40px]">
                    <div className="flex items-center justify-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-accent" />
                      <span className="text-sm font-semibold text-foreground">{student.quiz_completed}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">тестов</p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0 sm:justify-end">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openEditNameDialog(student)}
                    title="Редактировать имя"
                    className="w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/70"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleImpersonate(student)}
                    title="Просмотр от имени"
                    className="w-8 h-8 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openResetDialog(student)}
                    title="Сбросить пароль"
                    className="w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/70"
                  >
                    <Key className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => toggleBlockStudent(student)}
                    title={student.is_blocked ? 'Разблокировать' : 'Заблокировать'}
                    className={`w-8 h-8 rounded-lg ${
                      student.is_blocked 
                        ? 'text-success hover:text-success hover:bg-success/10' 
                        : 'text-muted-foreground hover:text-destructive hover:bg-destructive/10'
                    }`}
                  >
                    <Ban className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setStudentToDelete(student)}
                    disabled={deletingStudentId === student.user_id}
                    title="Удалить пользователя"
                    className="w-8 h-8 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  >
                    {deletingStudentId === student.user_id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                  </Button>
                </div>
              </div>
            ))}
            </div>
          </>
        )}
      </div>

      {/* Password Reset Dialog */}
      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-serif">Сброс пароля</DialogTitle>
            <DialogDescription>
              Установить новый пароль для <strong>{resetStudent?.name}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="new-password">Новый пароль</Label>
              <div className="flex gap-2">
                <Input
                  id="new-password"
                  type="text"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Минимум 6 символов"
                  className="flex-1 rounded-xl bg-secondary/30 border-border/50"
                />
                <Button type="button" variant="outline" onClick={generatePassword} className="rounded-xl flex-shrink-0">
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>
              {newPassword && (
                <p className="text-sm text-muted-foreground">
                  Пароль: <span className="font-mono font-semibold text-foreground">{newPassword}</span>
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetDialogOpen(false)} className="rounded-xl">Отмена</Button>
            <Button onClick={handleResetPassword} disabled={isResettingPassword} className="rounded-xl">
              {isResettingPassword ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Сбросить пароль
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Name Dialog */}
      <Dialog open={editNameDialogOpen} onOpenChange={setEditNameDialogOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-serif">Редактировать имя</DialogTitle>
            <DialogDescription>Изменить имя для {editStudent?.email}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Имя</Label>
              <Input
                id="edit-name"
                type="text"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                placeholder="Введите имя"
                className="rounded-xl bg-secondary/30 border-border/50"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditNameDialogOpen(false)} className="rounded-xl">Отмена</Button>
            <Button onClick={handleSaveName} disabled={isSavingName} className="rounded-xl">
              {isSavingName ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(studentToDelete)} onOpenChange={(open) => !open && setStudentToDelete(null)}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-serif">Удалить пользователя?</DialogTitle>
            <DialogDescription>
              {studentToDelete
                ? `Пользователь "${studentToDelete.name}" (${studentToDelete.email}) будет удален без возможности восстановления.`
                : 'Подтвердите удаление пользователя.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setStudentToDelete(null)}
              className="rounded-xl"
              disabled={Boolean(studentToDelete && deletingStudentId === studentToDelete.user_id)}
            >
              Отмена
            </Button>
            <Button
              onClick={handleDeleteStudent}
              variant="destructive"
              className="rounded-xl"
              disabled={Boolean(studentToDelete && deletingStudentId === studentToDelete.user_id)}
            >
              {Boolean(studentToDelete && deletingStudentId === studentToDelete.user_id) ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : null}
              Удалить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminPageLayout>
  );
}
