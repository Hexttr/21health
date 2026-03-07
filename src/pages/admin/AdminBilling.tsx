import React, { useState, useEffect } from 'react';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Settings, Database, Save, Plus, Trash2, Loader2, DollarSign } from 'lucide-react';
import { invalidateModelsCache } from '@/components/ModelSelector';

interface AIProvider {
  id: string; name: string; displayName: string; apiKeyEnv: string | null; isActive: boolean;
}

function ProviderCard({ provider, modelCount, onUpdate }: { provider: AIProvider; modelCount: number; onUpdate: () => void }) {
  const [apiKey, setApiKey] = useState('');
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    api<{ hasKey: boolean; masked: string | null }>(`/admin/ai-providers/${provider.id}/apikey`)
      .then((r) => { setHasKey(r.hasKey); if (r.masked) setApiKey(r.masked); })
      .catch(() => setHasKey(false));
  }, [provider.id]);
  const saveApiKey = async () => {
    const raw = prompt('Введите API-ключ (оставьте пустым, чтобы не менять):');
    if (raw === null) return;
    setSaving(true);
    try {
      await api(`/admin/ai-providers/${provider.id}`, { method: 'PUT', body: { apiKey: raw || undefined } });
      setHasKey(!!raw);
      if (raw) setApiKey('••••' + raw.slice(-4));
      toast.success(raw ? 'Ключ сохранён' : 'Ключ не изменён');
      onUpdate();
    } catch { toast.error('Ошибка сохранения'); }
    finally { setSaving(false); }
  };
  return (
    <div className="bg-card rounded-2xl border border-border/50 shadow-soft p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm font-semibold">{provider.displayName}</p>
          <p className="text-xs text-muted-foreground">key: {provider.name} | env: {provider.apiKeyEnv || '—'}</p>
        </div>
        <span className={`text-xs px-2 py-1 rounded-full ${provider.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {provider.isActive ? 'Активен' : 'Выключен'}
        </span>
      </div>
      <div className="flex items-center gap-3 mb-2">
        <span className="text-xs text-muted-foreground">API-ключ: {hasKey === null ? '…' : hasKey ? apiKey || '••••' : 'не задан'}</span>
        <Button size="sm" variant="outline" className="rounded-lg h-7 text-xs" onClick={saveApiKey} disabled={saving}>
          {saving ? '…' : hasKey ? 'Изменить' : 'Добавить'}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Моделей: {modelCount}</p>
    </div>
  );
}
interface AIModel {
  id: string; providerId: string; modelKey: string; displayName: string; modelType: string;
  inputPricePer1k: string; outputPricePer1k: string; fixedPrice: string;
  isActive: boolean; sortOrder: number;
}
type Settings = Record<string, string>;

export default function AdminBilling() {
  const [providers, setProviders] = useState<AIProvider[]>([]);
  const [models, setModels] = useState<AIModel[]>([]);
  const [settings, setSettings] = useState<Settings>({});
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'settings' | 'models' | 'providers'>('settings');

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [p, m, s] = await Promise.all([
        api<AIProvider[]>('/admin/ai-providers'),
        api<AIModel[]>('/admin/ai-models'),
        api<Settings>('/admin/settings'),
      ]);
      setProviders(p); setModels(m); setSettings(s);
    } catch (e) { toast.error('Ошибка загрузки'); }
    finally { setLoading(false); }
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

      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <div className="flex items-center gap-3 mb-6">
          <DollarSign className="w-6 h-6 text-primary" />
          <h1 className="font-serif text-2xl font-semibold text-foreground">Биллинг и AI-модели</h1>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {(['settings', 'models', 'providers'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${tab === t ? 'bg-primary text-white' : 'bg-card border border-border/50 text-foreground hover:bg-secondary/50'}`}
            >
              {t === 'settings' ? 'Настройки' : t === 'models' ? 'Модели' : 'Провайдеры'}
            </button>
          ))}
        </div>

        {/* Settings tab */}
        {tab === 'settings' && (
          <div className="bg-card rounded-2xl border border-border/50 shadow-soft p-6 space-y-5">
            <div className="flex items-center gap-2 mb-2">
              <Settings className="w-5 h-5 text-primary" />
              <h2 className="font-serif text-lg font-semibold">Настройки платформы</h2>
            </div>
            {[
              { key: 'markup_percent', label: 'Наценка на AI-запросы (%)', hint: 'Процент наценки поверх базовой стоимости', type: 'number' as const },
              { key: 'daily_free_requests', label: 'Бесплатных запросов в день', hint: 'Количество бесплатных AI-запросов для каждого пользователя', type: 'number' as const },
              { key: 'min_topup_amount', label: 'Мин. сумма пополнения (₽)', hint: '', type: 'number' as const },
              { key: 'max_topup_amount', label: 'Макс. сумма пополнения (₽)', hint: '', type: 'number' as const },
              { key: 'free_for_admins', label: 'Бесплатно для администраторов', hint: 'Админы не тратят баланс при использовании AI (чат, изображения, квиз)', type: 'boolean' as const },
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
                    className="w-full h-10 rounded-xl border border-border/50 bg-secondary/30 px-3 text-sm focus:border-primary outline-none"
                  />
                )}
              </div>
            ))}
            <Button onClick={saveSettings} className="rounded-xl gap-2">
              <Save className="w-4 h-4" /> Сохранить настройки
            </Button>
          </div>
        )}

        {/* Models tab */}
        {tab === 'models' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="font-serif text-lg font-semibold">AI-модели</h2>
              <Button onClick={addModel} variant="outline" size="sm" className="rounded-xl gap-2">
                <Plus className="w-4 h-4" /> Добавить
              </Button>
            </div>
            {models.map((model) => (
              <div key={model.id} className="bg-card rounded-2xl border border-border/50 shadow-soft p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Database className="w-4 h-4 text-primary" />
                    <input
                      value={model.displayName}
                      onChange={(e) => updateModelField(model.id, 'displayName', e.target.value)}
                      className="text-sm font-semibold bg-transparent border-b border-transparent hover:border-border focus:border-primary outline-none"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 text-xs">
                      <input type="checkbox" checked={model.isActive} onChange={(e) => updateModelField(model.id, 'isActive', e.target.checked)} />
                      Активна
                    </label>
                    <button onClick={() => deleteModel(model.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground">Model key</label>
                    <input value={model.modelKey} onChange={(e) => updateModelField(model.id, 'modelKey', e.target.value)}
                      className="w-full h-8 rounded-lg border border-border/50 bg-secondary/30 px-2 text-xs outline-none focus:border-primary" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Тип</label>
                    <select value={model.modelType} onChange={(e) => updateModelField(model.id, 'modelType', e.target.value)}
                      className="w-full h-8 rounded-lg border border-border/50 bg-secondary/30 px-2 text-xs outline-none">
                      <option value="text">Текст</option>
                      <option value="image">Изображение</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Провайдер</label>
                    <select value={model.providerId} onChange={(e) => updateModelField(model.id, 'providerId', e.target.value)}
                      className="w-full h-8 rounded-lg border border-border/50 bg-secondary/30 px-2 text-xs outline-none">
                      {providers.map(p => <option key={p.id} value={p.id}>{p.displayName}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Порядок</label>
                    <input type="number" value={model.sortOrder} onChange={(e) => updateModelField(model.id, 'sortOrder', parseInt(e.target.value) || 0)}
                      className="w-full h-8 rounded-lg border border-border/50 bg-secondary/30 px-2 text-xs outline-none focus:border-primary" />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground">Input ₽/1K tok</label>
                    <input value={model.inputPricePer1k} onChange={(e) => updateModelField(model.id, 'inputPricePer1k', e.target.value)}
                      className="w-full h-8 rounded-lg border border-border/50 bg-secondary/30 px-2 text-xs outline-none focus:border-primary" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Output ₽/1K tok</label>
                    <input value={model.outputPricePer1k} onChange={(e) => updateModelField(model.id, 'outputPricePer1k', e.target.value)}
                      className="w-full h-8 rounded-lg border border-border/50 bg-secondary/30 px-2 text-xs outline-none focus:border-primary" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Фикс. цена ₽</label>
                    <input value={model.fixedPrice} onChange={(e) => updateModelField(model.id, 'fixedPrice', e.target.value)}
                      className="w-full h-8 rounded-lg border border-border/50 bg-secondary/30 px-2 text-xs outline-none focus:border-primary" />
                  </div>
                </div>

                <Button onClick={() => saveModel(model)} size="sm" variant="outline" className="rounded-xl gap-2">
                  <Save className="w-3.5 h-3.5" /> Сохранить
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Providers tab */}
        {tab === 'providers' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="font-serif text-lg font-semibold">AI-провайдеры</h2>
              <Button onClick={addProvider} variant="outline" size="sm" className="rounded-xl gap-2">
                <Plus className="w-4 h-4" /> Добавить
              </Button>
            </div>
            {providers.map((p) => (
              <ProviderCard key={p.id} provider={p} modelCount={models.filter(m => m.providerId === p.id).length} onUpdate={loadAll} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
