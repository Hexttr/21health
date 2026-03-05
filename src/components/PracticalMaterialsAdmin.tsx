import React, { useState, useEffect } from 'react';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { 
  Plus, 
  Trash2, 
  Save, 
  Loader2, 
  Video,
  GripVertical
} from 'lucide-react';
import { toast } from 'sonner';

interface PracticalMaterial {
  id: string;
  title: string;
  description: string | null;
  video_url: string;
  sort_order: number;
  is_published: boolean;
}

export function PracticalMaterialsAdmin() {
  const [materials, setMaterials] = useState<PracticalMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    loadMaterials();
  }, []);

  const loadMaterials = async () => {
    try {
      const data = await api<Array<{ id: string; title: string; description: string | null; videoUrl: string; sortOrder: number; isPublished: boolean }>>('/admin/materials');
      setMaterials(data.map(m => ({ id: m.id, title: m.title, description: m.description, video_url: m.videoUrl, sort_order: m.sortOrder, is_published: m.isPublished })));
    } catch (error) {
      console.error('Error loading materials:', error);
      toast.error('Ошибка загрузки материалов');
    } finally {
      setLoading(false);
    }
  };

  const addMaterial = async () => {
    try {
      const maxOrder = materials.length > 0 
        ? Math.max(...materials.map(m => m.sort_order)) 
        : 0;

      const data = await api<{ id: string; title: string; description: string | null; videoUrl: string; sortOrder: number; isPublished: boolean }>('/admin/materials', {
        method: 'POST',
        body: { title: 'Новый материал', videoUrl: '', sortOrder: maxOrder + 1, isPublished: false }
      });
      
      setMaterials([...materials, { id: data.id, title: data.title, description: data.description, video_url: data.videoUrl, sort_order: data.sortOrder, is_published: data.isPublished }]);
      toast.success('Материал добавлен');
    } catch (error) {
      console.error('Error adding material:', error);
      toast.error('Ошибка добавления');
    }
  };

  const updateMaterial = (id: string, updates: Partial<PracticalMaterial>) => {
    setMaterials(materials.map(m => 
      m.id === id ? { ...m, ...updates } : m
    ));
  };

  const saveMaterial = async (material: PracticalMaterial) => {
    setSaving(material.id);
    try {
      await api(`/admin/materials/${material.id}`, {
        method: 'PUT',
        body: {
          title: material.title,
          description: material.description,
          videoUrl: material.video_url,
          sortOrder: material.sort_order,
          isPublished: material.is_published
        }
      });
      toast.success('Сохранено');
    } catch (error) {
      console.error('Error saving material:', error);
      toast.error('Ошибка сохранения');
    } finally {
      setSaving(null);
    }
  };

  const deleteMaterial = async (id: string) => {
    if (!confirm('Удалить этот материал?')) return;

    try {
      await api(`/admin/materials/${id}`, { method: 'DELETE' });
      
      setMaterials(materials.filter(m => m.id !== id));
      toast.success('Материал удалён');
    } catch (error) {
      console.error('Error deleting material:', error);
      toast.error('Ошибка удаления');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Практические материалы</h3>
          <p className="text-sm text-muted-foreground">Один материал — один видеоролик</p>
        </div>
        <Button onClick={addMaterial} className="gap-2">
          <Plus className="w-4 h-4" />
          Добавить материал
        </Button>
      </div>

      {materials.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Video className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Пока нет материалов</p>
            <Button onClick={addMaterial} variant="outline" className="mt-4">
              Добавить первый материал
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {materials.map((material, index) => (
            <Card key={material.id}>
              <CardContent className="pt-6">
                <div className="flex gap-4">
                  <div className="flex items-center text-muted-foreground">
                    <GripVertical className="w-5 h-5" />
                  </div>
                  
                  <div className="flex-1 space-y-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <Label>Название</Label>
                        <Input
                          value={material.title}
                          onChange={(e) => updateMaterial(material.id, { title: e.target.value })}
                          placeholder="Название материала"
                        />
                      </div>
                      
                      <div className="flex items-center gap-3 pt-7">
                        <div className="flex items-center gap-2">
                          <Label htmlFor={`published-${material.id}`} className="text-sm">
                            Опубликован
                          </Label>
                          <Switch
                            id={`published-${material.id}`}
                            checked={material.is_published}
                            onCheckedChange={(checked) => 
                              updateMaterial(material.id, { is_published: checked })
                            }
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Описание (необязательно)</Label>
                      <Textarea
                        value={material.description || ''}
                        onChange={(e) => updateMaterial(material.id, { 
                          description: e.target.value || null 
                        })}
                        placeholder="Краткое описание материала..."
                        className="min-h-[60px]"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <Video className="w-4 h-4" />
                        Ссылка на видео
                      </Label>
                      <Input
                        value={material.video_url}
                        onChange={(e) => updateMaterial(material.id, { video_url: e.target.value })}
                        placeholder="https://youtube.com/watch?v=... или https://vimeo.com/..."
                      />
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                      <Button
                        onClick={() => saveMaterial(material)}
                        disabled={saving === material.id}
                        size="sm"
                      >
                        {saving === material.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Save className="w-4 h-4 mr-1" />
                            Сохранить
                          </>
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteMaterial(material.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Удалить
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
