import React, { useState, useEffect } from 'react';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { SidebarTrigger } from '@/components/ui/sidebar';
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
import { Settings, Database, Save, Plus, Trash2, Loader2, DollarSign, KeyRound } from 'lucide-react';
import { invalidateModelsCache } from '@/components/ModelSelector';

interface AIProvider {
  id: string; name: string; displayName: string; apiKeyEnv: string | null; isActive: boolean;
}

interface UsageSummary {
  overview: {
    totalRequests: number;
    freeRequests: number;
    paidRequests: number;
    totalRevenue: string;
    activeUsers: number;
  };
  requestTypes: Array<{
    requestType: string;
    requests: number;
    revenue: string;
  }>;
  providerStats: Array<{
    providerName: string;
    requests: number;
    revenue: string;
  }>;
  topModels: Array<{
    modelName: string;
    providerName: string;
    requestType: string;
    requests: number;
    revenue: string;
  }>;
  windowDays: number;
  activeUserWindowHours: number;
  activeUserThreshold: number;
}

interface ProviderKeyStatus {
  hasStoredKey: boolean;
  masked: string | null;
  envVar: string | null;
  usesEnvFallback: boolean;
}

const SETTINGS_FIELDS = [
  { key: 'markup_percent', label: 'Наценка на AI-запросы (%)', hint: 'Процент наценки поверх базовой стоимости', type: 'number' as const },
  { key: 'daily_free_requests', label: 'Бесплатных запросов в день', hint: 'Количество бесплатных AI-запросов для каждого пользователя', type: 'number' as const },
  { key: 'min_topup_amount', label: 'Мин. сумма пополнения (₽)', hint: '', type: 'number' as const },
  { key: 'max_topup_amount', label: 'Макс. сумма пополнения (₽)', hint: '', type: 'number' as const },
  { key: 'free_for_admins', label: 'Бесплатно для администраторов', hint: 'Админы не тратят баланс при использовании AI (чат, изображения, квиз)', type: 'boolean' as const },
  { key: 'analytics_active_user_daily_requests', label: 'Порог активного пользователя за 24 часа', hint: 'Если пользователь сделал не меньше этого числа AI-запросов за последние 24 часа, он считается активным в аналитике', type: 'number' as const },
  { key: 'token_exchange_rate_rub_to_tokens', label: 'Курс токенов (сколько токенов за 1 ₽)', hint: 'Например, 10 означает что 50 ₽ отображаются как 500 Tokens', type: 'number' as const },
  { key: 'referral_signup_bonus_tokens', label: 'Бонус за регистрацию по реферальной ссылке (Tokens)', hint: 'Начисляется и пригласившему, и приглашенному после подтверждения телефона', type: 'number' as const },
  { key: 'referral_course_purchase_bonus_tokens', label: 'Бонус за покупку курса приглашенным (Tokens)', hint: 'Начисляется пригласившему после оплаты курса приглашенным пользователем', type: 'number' as const },
  { key: 'ai_user_to_student_bonus_tokens', label: 'Бонус за первый переход из Пользователя ИИ в Студента (Токенов)', hint: 'Разово начисляется пользователю при первом переходе из роли ai_user в student', type: 'number' as const },
  { key: 'course_14_price_rub', label: 'Цена курса 14 дней (₽)', hint: 'Стоимость базового тарифа', type: 'number' as const },
  { key: 'course_21_price_rub', label: 'Цена курса 21 день (₽)', hint: 'Стоимость полного курса', type: 'number' as const },
  { key: 'course_21_upgrade_price_rub', label: 'Апгрейд с 14 до 21 дня (₽)', hint: 'Разница, которую пользователь платит при расширении доступа', type: 'number' as const },
  { key: 'phone_verification_required_for_referrals', label: 'Требовать подтверждение телефона для рефералки', hint: 'Если включено, реферальная ссылка и бонусы активируются только после подтверждения номера', type: 'boolean' as const },
] as const;

function ProviderCard({ provider, modelCount, onUpdate }: { provider: AIProvider; modelCount: number; onUpdate: () => void }) {
  const [keyStatus, setKeyStatus] = useState<ProviderKeyStatus | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [keyDialogOpen, setKeyDialogOpen] = useState(false);
  const [keyValue, setKeyValue] = useState('');
  const [edit, setEdit] = useState({ displayName: provider.displayName, apiKeyEnv: provider.apiKeyEnv || '', isActive: provider.isActive });

  useEffect(() => {
    setEdit({ displayName: provider.displayName, apiKeyEnv: provider.apiKeyEnv || '', isActive: provider.isActive });
  }, [provider.displayName, provider.apiKeyEnv, provider.isActive]);

  const loadKeyStatus = async () => {
    try {
      const status = await api<ProviderKeyStatus>(`/admin/ai-providers/${provider.id}/apikey`);
      setKeyStatus(status);
    } catch {
      setKeyStatus(null);
    }
  };

  useEffect(() => {
    loadKeyStatus();
  }, [provider.id]);

  const saveApiKey = async () => {
    if (!keyValue.trim()) {
      toast.error('Введите API-ключ');
      return;
    }
    setSaving(true);
    try {
      const status = await api<ProviderKeyStatus>(`/admin/ai-providers/${provider.id}/apikey`, { method: 'PUT', body: { apiKey: keyValue } });
      setKeyStatus(status);
      setKeyValue('');
      setKeyDialogOpen(false);
      toast.success('Ключ сохранён');
      onUpdate();
    } catch { toast.error('Ошибка сохранения'); }
    finally { setSaving(false); }
  };

  const clearApiKey = async () => {
    if (!confirm(`Удалить сохранённый API-ключ для "${provider.displayName}"?`)) return;
    setSaving(true);
    try {
      const status = await api<ProviderKeyStatus>(`/admin/ai-providers/${provider.id}/apikey`, { method: 'DELETE' });
      setKeyStatus(status);
      toast.success('Сохранённый ключ удалён');
      onUpdate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка удаления ключа');
    } finally {
      setSaving(false);
    }
  };

  const saveProvider = async () => {
    setSaving(true);
    try {
      await api(`/admin/ai-providers/${provider.id}`, {
        method: 'PUT',
        body: { displayName: edit.displayName, apiKeyEnv: edit.apiKeyEnv || undefined, isActive: edit.isActive },
      });
      invalidateModelsCache();
      toast.success('Провайдер обновлён');
      onUpdate();
    } catch { toast.error('Ошибка сохранения'); }
    finally { setSaving(false); }
  };
  const deleteProvider = async () => {
    if (modelCount > 0 && !confirm(`Удалить провайдера "${provider.displayName}"? Будут удалены ${modelCount} модель(ей).`)) return;
    if (modelCount === 0 && !confirm(`Удалить провайдера "${provider.displayName}"?`)) return;
    setDeleting(true);
    try {
      await api(`/admin/ai-providers/${provider.id}`, { method: 'DELETE' });
      invalidateModelsCache();
      toast.success('Провайдер удалён');
      onUpdate();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Ошибка удаления'); }
    finally { setDeleting(false); }
  };
  return (
    <div className="rounded-2xl border border-border/70 bg-card/95 p-4 shadow-soft backdrop-blur-sm md:p-5 md:space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span className="break-all text-xs text-muted-foreground">key: {provider.name}</span>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={edit.isActive} onChange={(e) => setEdit({ ...edit, isActive: e.target.checked })} />
            Активен
          </label>
          <button onClick={deleteProvider} disabled={deleting} className="rounded-lg border border-border/60 bg-background/85 p-1.5 text-muted-foreground transition-colors hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="text-xs text-muted-foreground">Отображаемое имя</label>
          <input value={edit.displayName} onChange={(e) => setEdit({ ...edit, displayName: e.target.value })}
            className="w-full h-9 rounded-lg border border-border/60 bg-background/90 px-3 text-xs outline-none transition-colors focus:border-primary" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Env переменная</label>
          <input value={edit.apiKeyEnv} onChange={(e) => setEdit({ ...edit, apiKeyEnv: e.target.value })}
            placeholder="GEMINI_API_KEY"
            className="w-full h-9 rounded-lg border border-border/60 bg-background/90 px-3 text-xs outline-none transition-colors focus:border-primary" />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="min-w-0 break-words text-xs text-muted-foreground">
          API-ключ: {keyStatus?.hasStoredKey ? keyStatus.masked || '••••' : 'не сохранён'}
          {keyStatus?.usesEnvFallback ? `, fallback: ${keyStatus.envVar}` : keyStatus?.envVar ? `, env: ${keyStatus.envVar}` : ''}
        </span>
        <Button size="sm" variant="outline" className="h-8 rounded-lg border-border/70 bg-background/90 text-xs shadow-xs hover:bg-background" onClick={() => setKeyDialogOpen(true)} disabled={saving}>
          <KeyRound className="w-3.5 h-3.5" />
          {keyStatus?.hasStoredKey ? 'Заменить ключ' : 'Задать ключ'}
        </Button>
        {keyStatus?.hasStoredKey && (
          <Button size="sm" variant="outline" className="h-8 rounded-lg border-border/70 bg-background/90 text-xs shadow-xs hover:bg-background" onClick={clearApiKey} disabled={saving}>
            Удалить ключ
          </Button>
        )}
        <Button size="sm" variant="outline" className="h-8 rounded-lg border-border/70 bg-background/90 text-xs shadow-xs hover:bg-background" onClick={saveProvider} disabled={saving}>
          <Save className="w-3.5 h-3.5" /> Сохранить
        </Button>
        <span className="text-xs text-muted-foreground">Моделей: {modelCount}</span>
      </div>

      <Dialog open={keyDialogOpen} onOpenChange={setKeyDialogOpen}>
        <DialogContent className="w-[calc(100vw-24px)] max-w-lg rounded-2xl border border-border/60 bg-background/98">
          <DialogHeader>
            <DialogTitle className="font-serif">API-ключ провайдера</DialogTitle>
            <DialogDescription>
              Ключ сохраняется только на сервере и после записи больше не возвращается в браузер. При отсутствии сохранённого ключа будет использован `env`, если он задан.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor={`provider-key-${provider.id}`}>Новый API-ключ</Label>
              <Input
                id={`provider-key-${provider.id}`}
                type="password"
                value={keyValue}
                onChange={(e) => setKeyValue(e.target.value)}
                placeholder="Введите новый ключ"
                className="rounded-xl border-border/60 bg-background/90"
                autoComplete="off"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Текущий статус: {keyStatus?.hasStoredKey ? `сохранён (${keyStatus.masked})` : 'не сохранён'}
              {keyStatus?.usesEnvFallback ? `, используется env ${keyStatus.envVar}` : keyStatus?.envVar ? `, env ${keyStatus.envVar} доступен как fallback` : ''}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setKeyDialogOpen(false); setKeyValue(''); }} className="rounded-xl">Отмена</Button>
            <Button onClick={saveApiKey} disabled={saving} className="rounded-xl">
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Сохранить ключ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
interface AIModel {
  id: string; providerId: string; modelKey: string; displayName: string; modelType: string;
  supportsStreaming: boolean; supportsImageInput: boolean; supportsImageOutput: boolean; supportsSystemPrompt: boolean;
  inputPricePer1k: string; outputPricePer1k: string; fixedPrice: string;
  isActive: boolean; sortOrder: number;
}
type Settings = Record<string, string>;

export default function AdminBilling() {
  const [providers, setProviders] = useState<AIProvider[]>([]);
  const [models, setModels] = useState<AIModel[]>([]);
  const [settings, setSettings] = useState<Settings>({});
  const [usageSummary, setUsageSummary] = useState<UsageSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'settings' | 'models' | 'providers' | 'analytics'>('settings');

  useEffect(() => { loadAll(); }, []);

  const loadSettings = async () => {
    const data = await api<Settings>('/admin/settings');
    setSettings(data);
  };

  const loadProviders = async () => {
    const data = await api<AIProvider[]>('/admin/ai-providers');
    setProviders(data);
  };

  const loadModels = async () => {
    const data = await api<AIModel[]>('/admin/ai-models');
    setModels(data);
  };

  const loadAll = async () => {
    setLoading(true);
    try {
      await Promise.all([loadProviders(), loadModels(), loadSettings(), loadAnalytics()]);
    } catch (e) { toast.error('Ошибка загрузки'); }
    finally { setLoading(false); }
  };

  const loadAnalytics = async () => {
    const data = await api<UsageSummary>('/admin/usage-summary');
    setUsageSummary(data);
  };

  const saveSettings = async () => {
    try {
      await api('/admin/settings', { method: 'PUT', body: settings });
      toast.success('Настройки сохранены');
    } catch { toast.error('Ошибка сохранения'); }
  };

  const saveModel = async (model: AIModel) => {
    try {
      await api(`/admin/ai-models/${model.id}`, { method: 'PUT', body: model });
      invalidateModelsCache();
      toast.success('Модель обновлена');
    } catch { toast.error('Ошибка сохранения модели'); }
  };

  const addModel = async () => {
    if (providers.length === 0) { toast.error('Сначала создайте провайдера'); return; }
    try {
      const row = await api<AIModel>('/admin/ai-models', { method: 'POST', body: {
        providerId: providers[0].id, modelKey: 'new-model', displayName: 'Новая модель',
        modelType: 'text', sortOrder: models.length,
      }});
      setModels([...models, row]);
      invalidateModelsCache();
      toast.success('Модель добавлена');
    } catch { toast.error('Ошибка'); }
  };

  const deleteModel = async (id: string) => {
    if (!confirm('Удалить модель?')) return;
    try {
      await api(`/admin/ai-models/${id}`, { method: 'DELETE' });
      setModels(models.filter(m => m.id !== id));
      invalidateModelsCache();
      toast.success('Удалено');
    } catch { toast.error('Ошибка удаления'); }
  };

  const addProvider = async () => {
    const name = prompt('Имя провайдера (латиница, напр. openai):');
    if (!name) return;
    const displayName = prompt('Отображаемое имя (напр. OpenAI):') || name;
    try {
      const row = await api<AIProvider>('/admin/ai-providers', { method: 'POST', body: { name, displayName } });
      setProviders([...providers, row]);
      toast.success('Провайдер добавлен');
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Ошибка'); }
  };

  const updateModelField = (id: string, field: string, value: string | number | boolean) => {
    setModels(models.map(m => m.id === id ? { ...m, [field]: value } : m));
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'hsl(248deg 100% 94.56%)' }}>
      <div className="md:hidden sticky top-0 z-40 flex items-center gap-3 px-4 h-14 bg-card/80 backdrop-blur-xl border-b border-border/50">
        <SidebarTrigger /> <span className="font-semibold text-sm">Биллинг</span>
      </div>

      <div className="container mx-auto max-w-4xl px-4 py-6">
        <div className="mb-6 flex items-center gap-3">
          <DollarSign className="w-6 h-6 text-primary" />
          <h1 className="min-w-0 text-balance font-serif text-2xl font-semibold text-foreground">Биллинг и AI-модели</h1>
        </div>

        {/* Tabs */}
        <div className="mb-6 grid grid-cols-2 gap-2 rounded-2xl border border-border/60 bg-card/80 p-2 shadow-soft sm:flex sm:flex-wrap">
          {(['settings', 'models', 'providers', 'analytics'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`min-w-0 rounded-xl border px-3 py-2.5 text-center text-sm font-medium transition-colors ${tab === t ? 'border-primary bg-primary text-white shadow-sm' : 'border-border/70 bg-background/92 text-foreground shadow-xs hover:bg-secondary/70'}`}
            >
              {t === 'settings' ? 'Настройки' : t === 'models' ? 'Модели' : t === 'providers' ? 'Провайдеры' : 'Аналитика'}
            </button>
          ))}
        </div>

        {/* Settings tab */}
        {tab === 'settings' && (
          <div className="space-y-5 rounded-2xl border border-border/70 bg-card/95 p-4 shadow-soft md:p-6">
            <div className="flex items-center gap-2 mb-2">
              <Settings className="w-5 h-5 text-primary" />
              <h2 className="font-serif text-lg font-semibold">Настройки платформы</h2>
            </div>
            {[
              ...SETTINGS_FIELDS,
            ].map(({ key, label, hint, type }) => (
              <div key={key}>
                <label className="block text-sm font-medium text-foreground mb-1">{label}</label>
                {hint && <p className="text-xs text-muted-foreground mb-2">{hint}</p>}
                {type === 'boolean' ? (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={(settings[key] || '1') === '1'}
                      onChange={(e) => setSettings({ ...settings, [key]: e.target.checked ? '1' : '0' })}
                      className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                    />
                    <span className="text-sm">Да</span>
                  </label>
                ) : (
                  <input
                    type="number"
                    value={settings[key] || ''}
                    onChange={(e) => setSettings({ ...settings, [key]: e.target.value })}
                    className="h-10 w-full rounded-xl border border-border/60 bg-background/90 px-3 text-sm outline-none transition-colors focus:border-primary"
                  />
                )}
              </div>
            ))}
            <Button onClick={saveSettings} className="gap-2 rounded-xl shadow-xs">
              <Save className="w-4 h-4" /> Сохранить настройки
            </Button>
          </div>
        )}

        {/* Models tab */}
        {tab === 'models' && (
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="font-serif text-lg font-semibold">AI-модели</h2>
              <Button onClick={addModel} variant="outline" size="sm" className="h-9 rounded-xl border-border/70 bg-background/92 gap-2 shadow-xs hover:bg-background sm:self-auto self-start">
                <Plus className="w-4 h-4" /> Добавить
              </Button>
            </div>
            {models.map((model) => (
              <div key={model.id} className="space-y-3 rounded-2xl border border-border/70 bg-card/95 p-4 shadow-soft md:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <Database className="w-4 h-4 text-primary" />
                    <input
                      value={model.displayName}
                      onChange={(e) => updateModelField(model.id, 'displayName', e.target.value)}
                      className="min-w-0 flex-1 truncate border-b border-transparent bg-transparent text-sm font-semibold outline-none hover:border-border focus:border-primary"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="flex items-center gap-2 text-xs">
                      <input type="checkbox" checked={model.isActive} onChange={(e) => updateModelField(model.id, 'isActive', e.target.checked)} />
                      Активна
                    </label>
                    <button onClick={() => deleteModel(model.id)} className="rounded-lg border border-border/60 bg-background/85 p-1.5 text-muted-foreground transition-colors hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 sm:grid-cols-4">
                  <div>
                    <label className="text-xs text-muted-foreground">Model key</label>
                    <input value={model.modelKey} onChange={(e) => updateModelField(model.id, 'modelKey', e.target.value)}
                      className="h-9 w-full rounded-lg border border-border/60 bg-background/90 px-3 text-xs outline-none transition-colors focus:border-primary" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Тип</label>
                    <select value={model.modelType} onChange={(e) => updateModelField(model.id, 'modelType', e.target.value)}
                      className="h-9 w-full rounded-lg border border-border/60 bg-background/90 px-3 text-xs outline-none">
                      <option value="text">Текст</option>
                      <option value="image">Изображение</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Провайдер</label>
                    <select value={model.providerId} onChange={(e) => updateModelField(model.id, 'providerId', e.target.value)}
                      className="h-9 w-full rounded-lg border border-border/60 bg-background/90 px-3 text-xs outline-none">
                      {providers.map(p => <option key={p.id} value={p.id}>{p.displayName}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Порядок</label>
                    <input type="number" value={model.sortOrder} onChange={(e) => updateModelField(model.id, 'sortOrder', parseInt(e.target.value) || 0)}
                      className="h-9 w-full rounded-lg border border-border/60 bg-background/90 px-3 text-xs outline-none transition-colors focus:border-primary" />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 sm:grid-cols-3">
                  <div>
                    <label className="text-xs text-muted-foreground">Input ₽/1K tok</label>
                    <input value={model.inputPricePer1k} onChange={(e) => updateModelField(model.id, 'inputPricePer1k', e.target.value)}
                      className="h-9 w-full rounded-lg border border-border/60 bg-background/90 px-3 text-xs outline-none transition-colors focus:border-primary" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Output ₽/1K tok</label>
                    <input value={model.outputPricePer1k} onChange={(e) => updateModelField(model.id, 'outputPricePer1k', e.target.value)}
                      className="h-9 w-full rounded-lg border border-border/60 bg-background/90 px-3 text-xs outline-none transition-colors focus:border-primary" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Фикс. цена ₽</label>
                    <input value={model.fixedPrice} onChange={(e) => updateModelField(model.id, 'fixedPrice', e.target.value)}
                      className="h-9 w-full rounded-lg border border-border/60 bg-background/90 px-3 text-xs outline-none transition-colors focus:border-primary" />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2.5 min-[420px]:grid-cols-2 sm:grid-cols-4">
                  {[
                    { key: 'supportsStreaming', label: 'Streaming' },
                    { key: 'supportsImageInput', label: 'Image input' },
                    { key: 'supportsImageOutput', label: 'Image output' },
                    { key: 'supportsSystemPrompt', label: 'System prompt' },
                  ].map((capability) => (
                    <label key={capability.key} className="flex items-center gap-2 rounded-xl border border-border/60 bg-background/85 px-3 py-2 text-xs text-foreground">
                      <input
                        type="checkbox"
                        checked={Boolean(model[capability.key as keyof AIModel])}
                        onChange={(e) => updateModelField(model.id, capability.key, e.target.checked)}
                      />
                      {capability.label}
                    </label>
                  ))}
                </div>

                <Button onClick={() => saveModel(model)} size="sm" variant="outline" className="h-9 rounded-xl border-border/70 bg-background/92 gap-2 shadow-xs hover:bg-background">
                  <Save className="w-3.5 h-3.5" /> Сохранить
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Providers tab */}
        {tab === 'providers' && (
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="font-serif text-lg font-semibold">AI-провайдеры</h2>
              <Button onClick={addProvider} variant="outline" size="sm" className="h-9 rounded-xl border-border/70 bg-background/92 gap-2 shadow-xs hover:bg-background sm:self-auto self-start">
                <Plus className="w-4 h-4" /> Добавить
              </Button>
            </div>
            {providers.map((p) => (
              <ProviderCard key={p.id} provider={p} modelCount={models.filter(m => m.providerId === p.id).length} onUpdate={loadAll} />
            ))}
          </div>
        )}

        {tab === 'analytics' && usageSummary && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: 'Запросов', value: usageSummary.overview.totalRequests },
                { label: `Активных пользователей (>= ${usageSummary.activeUserThreshold} за ${usageSummary.activeUserWindowHours} ч)`, value: usageSummary.overview.activeUsers },
                { label: 'Бесплатных запросов', value: usageSummary.overview.freeRequests },
                { label: `Платная выручка за ${usageSummary.windowDays} дней`, value: `${Number(usageSummary.overview.totalRevenue).toFixed(2)} ₽` },
              ].map((card) => (
                <div key={card.label} className="bg-card rounded-2xl border border-border/50 shadow-soft p-5">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{card.label}</p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">{card.value}</p>
                </div>
              ))}
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="bg-card rounded-2xl border border-border/50 shadow-soft p-5 space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <h2 className="font-serif text-lg font-semibold">По типу запросов</h2>
                  <Button size="sm" variant="outline" className="h-9 self-start rounded-xl border-border/70 bg-background/92 shadow-xs hover:bg-background sm:self-auto" onClick={loadAnalytics}>Обновить</Button>
                </div>
                <div className="space-y-3">
                  {usageSummary.requestTypes.map((row) => (
                    <div key={row.requestType} className="flex flex-col gap-2 rounded-xl border border-border/60 bg-background/88 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">{row.requestType}</p>
                        <p className="text-xs text-muted-foreground">{row.requests} запросов</p>
                      </div>
                      <p className="text-sm font-semibold text-foreground">{Number(row.revenue).toFixed(2)} ₽</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-card rounded-2xl border border-border/50 shadow-soft p-5 space-y-4">
                <h2 className="font-serif text-lg font-semibold">По провайдерам</h2>
                <div className="space-y-3">
                  {usageSummary.providerStats.map((row) => (
                    <div key={row.providerName} className="flex flex-col gap-2 rounded-xl border border-border/60 bg-background/88 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">{row.providerName}</p>
                        <p className="text-xs text-muted-foreground">{row.requests} запросов</p>
                      </div>
                      <p className="text-sm font-semibold text-foreground">{Number(row.revenue).toFixed(2)} ₽</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-card rounded-2xl border border-border/50 shadow-soft p-5 space-y-4">
              <h2 className="font-serif text-lg font-semibold">Топ инструментов и моделей</h2>
              <div className="space-y-3">
                {usageSummary.topModels.map((row, index) => (
                  <div key={`${row.providerName}-${row.modelName}-${row.requestType}-${index}`} className="flex flex-col gap-2 rounded-xl border border-border/60 bg-background/88 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{row.modelName}</p>
                      <p className="text-xs text-muted-foreground break-words">{row.providerName} · {row.requestType} · {row.requests} запросов</p>
                    </div>
                    <p className="text-sm font-semibold text-foreground">{Number(row.revenue).toFixed(2)} ₽</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
