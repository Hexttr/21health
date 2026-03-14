import React, { useState, useEffect } from 'react';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
  Plus, 
  Ticket,
  Copy,
  Shuffle,
  CheckCircle2,
  XCircle,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';

interface InvitationCode {
  id: string;
  code: string;
  comment: string;
  is_active: boolean;
  created_at: string;
}

export default function AdminCodes() {
  const [invitationCodes, setInvitationCodes] = useState<InvitationCode[]>([]);
  const [loadingCodes, setLoadingCodes] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newComment, setNewComment] = useState('');
  const [savingCode, setSavingCode] = useState(false);
  const [deletingCodeId, setDeletingCodeId] = useState<string | null>(null);
  const [codeToDelete, setCodeToDelete] = useState<InvitationCode | null>(null);

  useEffect(() => {
    loadInvitationCodes();
  }, []);

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
    for (let i = 0; i < 7; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    setNewCode(code);
  };

  const saveInvitationCode = async () => {
    if (!newCode.trim() || !newComment.trim()) { toast.error('Введите код и комментарий'); return; }
    setSavingCode(true);
    try {
      await api('/admin/codes', { method: 'POST', body: { code: newCode.trim().toUpperCase(), comment: newComment.trim(), isActive: true } });
      toast.success('Код создан!');
      setNewCode(''); setNewComment('');
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
      await api(`/admin/codes/${code.id}`, { method: 'PUT', body: { isActive: !code.is_active } });
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

  const deleteInvitationCode = async () => {
    if (!codeToDelete) {
      return;
    }

    setDeletingCodeId(codeToDelete.id);
    try {
      await api(`/admin/codes/${codeToDelete.id}`, { method: 'DELETE' });
      toast.success('Код удалён');
      setCodeToDelete(null);
      loadInvitationCodes();
    } catch (error) {
      console.error('Error deleting code:', error);
      toast.error(error instanceof Error ? error.message : 'Ошибка удаления кода');
    } finally {
      setDeletingCodeId(null);
    }
  };

  const activeCount = invitationCodes.filter(c => c.is_active).length;

  return (
    <AdminPageLayout
      title="Пригласительные коды"
      description="Управление кодами для регистрации студентов"
      icon={Ticket}
      iconColor="accent"
    >
      <div className="space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          {[
            { label: 'Всего кодов', value: invitationCodes.length, icon: Ticket, color: 'primary' },
            { label: 'Активных', value: activeCount, icon: CheckCircle2, color: 'success' },
          ].map(stat => (
            <div key={stat.label} className="bg-card rounded-2xl border border-border/50 shadow-soft p-4 sm:p-5">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${
                stat.color === 'primary' ? 'bg-primary/10' : 'bg-success/10'
              }`}>
                <stat.icon className={`${stat.color === 'primary' ? 'text-primary' : 'text-success'}`} style={{ width: '18px', height: '18px' }} />
              </div>
              <p className="text-2xl font-serif font-semibold text-foreground">{stat.value}</p>
              <p className="text-xs text-muted-foreground font-medium mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Create Code */}
        <div className="bg-card rounded-2xl border border-border/50 shadow-soft p-5 sm:p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Plus className="w-4.5 h-4.5 text-primary" style={{ width: '18px', height: '18px' }} />
            </div>
            <div>
              <h2 className="font-serif font-semibold text-foreground">Создать новый код</h2>
              <p className="text-xs text-muted-foreground">Код привязывается к потоку/группе студентов</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 mb-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Код</Label>
              <div className="flex gap-2">
                <Input
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                  placeholder="ABC1234"
                  maxLength={10}
                  className="rounded-xl bg-secondary/30 border-border/50 focus:border-primary font-mono uppercase"
                />
                <Button type="button" variant="outline" onClick={generateRandomCode} className="rounded-xl flex-shrink-0" title="Сгенерировать">
                  <Shuffle className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Комментарий (поток)</Label>
              <Input
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Поток Январь 2025"
                className="rounded-xl bg-secondary/30 border-border/50 focus:border-primary"
              />
            </div>
          </div>
          <Button onClick={saveInvitationCode} disabled={savingCode} className="rounded-xl gradient-hero hover:opacity-90 shadow-glow gap-2">
            {savingCode ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Создать код
          </Button>
        </div>

        {/* Codes List */}
        <div className="bg-card rounded-2xl border border-border/50 shadow-soft overflow-hidden">
          <div className="flex items-center gap-3 px-5 sm:px-6 py-4 border-b border-border/50">
            <Ticket className="w-4.5 h-4.5 text-accent" style={{ width: '18px', height: '18px' }} />
            <h2 className="font-serif font-semibold text-foreground">Существующие коды</h2>
            <span className="text-xs font-semibold text-muted-foreground bg-secondary px-2 py-0.5 rounded-full ml-auto">
              {invitationCodes.length}
            </span>
          </div>

          {loadingCodes ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : invitationCodes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Ticket className="w-10 h-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">Нет созданных кодов</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {invitationCodes.map((code) => (
                <div
                  key={code.id}
                  className={`flex items-center gap-4 px-5 sm:px-6 py-4 transition-colors ${
                    code.is_active ? 'hover:bg-secondary/20' : 'opacity-60 bg-muted/20'
                  }`}
                >
                  <div className={`w-2 h-8 rounded-full flex-shrink-0 ${code.is_active ? 'bg-success' : 'bg-muted'}`} />
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <code className="font-mono font-bold text-base text-foreground tracking-widest">
                        {code.code}
                      </code>
                      <button
                        onClick={() => copyCodeToClipboard(code.code)}
                        className="p-1 rounded-md hover:bg-secondary/70 text-muted-foreground hover:text-foreground transition-colors"
                        title="Скопировать"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5 truncate">{code.comment}</p>
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className={`text-xs font-medium flex items-center gap-1 ${code.is_active ? 'text-success' : 'text-muted-foreground'}`}>
                      {code.is_active ? (
                        <><CheckCircle2 className="w-3.5 h-3.5" /> Активен</>
                      ) : (
                        <><XCircle className="w-3.5 h-3.5" /> Неактивен</>
                      )}
                    </span>
                    <Switch
                      checked={code.is_active}
                      onCheckedChange={() => toggleCodeActive(code)}
                    />
                    <button
                      onClick={() => setCodeToDelete(code)}
                      disabled={deletingCodeId === code.id}
                      className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-60"
                      title="Удалить код"
                    >
                      {deletingCodeId === code.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Dialog open={Boolean(codeToDelete)} onOpenChange={(open) => !open && setCodeToDelete(null)}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-serif">Удалить пригласительный код?</DialogTitle>
            <DialogDescription>
              {codeToDelete
                ? `Код "${codeToDelete.code}" будет удален без возможности восстановления.`
                : 'Подтвердите удаление кода.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCodeToDelete(null)}
              className="rounded-xl"
              disabled={Boolean(codeToDelete && deletingCodeId === codeToDelete.id)}
            >
              Отмена
            </Button>
            <Button
              onClick={deleteInvitationCode}
              className="rounded-xl"
              variant="destructive"
              disabled={Boolean(codeToDelete && deletingCodeId === codeToDelete.id)}
            >
              {Boolean(codeToDelete && deletingCodeId === codeToDelete.id) ? (
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
