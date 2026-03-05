import React, { useState, useEffect } from 'react';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { 
  Loader2, 
  Plus, 
  Ticket,
  Copy
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

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-2xl font-serif font-bold text-foreground">Пригласительные коды</h1>
          <p className="text-muted-foreground">Управление кодами для регистрации</p>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="w-5 h-5" />
                Создать новый код
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Код</Label>
                  <div className="flex gap-2">
                    <Input
                      value={newCode}
                      onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                      placeholder="ABC1234"
                      maxLength={10}
                    />
                    <Button type="button" variant="outline" onClick={generateRandomCode}>
                      Генерировать
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Комментарий (название потока)</Label>
                  <Input
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Поток Январь 2025"
                  />
                </div>
              </div>
              <Button onClick={saveInvitationCode} disabled={savingCode}>
                {savingCode ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Создать код
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Ticket className="w-5 h-5" />
                Существующие коды
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingCodes ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : (
                <div className="space-y-2">
                  {invitationCodes.map((code) => (
                    <div 
                      key={code.id} 
                      className={`flex items-center justify-between p-4 rounded-lg border ${
                        code.is_active ? 'bg-secondary/30' : 'bg-muted/30 opacity-60'
                      }`}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <code className="font-mono font-bold text-lg">{code.code}</code>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => copyCodeToClipboard(code.code)}
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                        </div>
                        <p className="text-sm text-muted-foreground">{code.comment}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-muted-foreground">
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
        </div>
      </div>
    </div>
  );
}