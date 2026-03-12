import * as React from "react";
import {
  Eye,
  EyeOff,
  Loader2,
  MessageCircle,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { api } from "@/api/client";
import { TestimonialAvatar } from "@/components/TestimonialAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

type AvatarVariant = "male" | "female";

interface TestimonialAdminItem {
  id: string;
  name: string;
  roleOrSubtitle: string;
  text: string;
  avatarVariant: AvatarVariant;
  sortOrder: number;
  isPublished: boolean;
}

const emptyDraft = {
  name: "Новый отзыв",
  roleOrSubtitle: "Участник платформы",
  text: "Добавьте текст отзыва, чтобы он появился в публичном слайдере.",
  avatarVariant: "female" as AvatarVariant,
  sortOrder: 0,
  isPublished: false,
};

export function TestimonialsAdmin() {
  const [items, setItems] = React.useState<TestimonialAdminItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [savingId, setSavingId] = React.useState<string | null>(null);

  const loadItems = React.useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<TestimonialAdminItem[]>("/admin/testimonials");
      setItems(data);
    } catch (error) {
      console.error("Error loading testimonials:", error);
      toast.error("Не удалось загрузить отзывы");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const updateItem = (id: string, updates: Partial<TestimonialAdminItem>) => {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...updates } : item)),
    );
  };

  const addItem = async () => {
    try {
      const nextOrder =
        items.length > 0 ? Math.max(...items.map((item) => item.sortOrder)) + 1 : 1;
      const created = await api<TestimonialAdminItem>("/admin/testimonials", {
        method: "POST",
        body: { ...emptyDraft, sortOrder: nextOrder },
      });
      setItems((current) => [...current, created]);
      toast.success("Черновик отзыва добавлен");
    } catch (error) {
      console.error("Error creating testimonial:", error);
      toast.error("Не удалось добавить отзыв");
    }
  };

  const saveItem = async (item: TestimonialAdminItem) => {
    if (!item.name.trim() || !item.text.trim()) {
      toast.error("Заполните имя и текст отзыва");
      return;
    }

    setSavingId(item.id);
    try {
      const updated = await api<TestimonialAdminItem>(`/admin/testimonials/${item.id}`, {
        method: "PUT",
        body: item,
      });
      updateItem(item.id, updated);
      toast.success("Отзыв сохранен");
    } catch (error) {
      console.error("Error saving testimonial:", error);
      toast.error("Не удалось сохранить отзыв");
    } finally {
      setSavingId(null);
    }
  };

  const togglePublished = async (item: TestimonialAdminItem, checked: boolean) => {
    updateItem(item.id, { isPublished: checked });
    try {
      await api(`/admin/testimonials/${item.id}`, {
        method: "PUT",
        body: { ...item, isPublished: checked },
      });
      toast.success(checked ? "Отзыв опубликован" : "Отзыв скрыт");
    } catch (error) {
      console.error("Error toggling testimonial:", error);
      updateItem(item.id, { isPublished: item.isPublished });
      toast.error("Не удалось изменить публикацию");
    }
  };

  const deleteItem = async (id: string) => {
    if (!window.confirm("Удалить этот отзыв?")) {
      return;
    }

    try {
      await api(`/admin/testimonials/${id}`, { method: "DELETE" });
      setItems((current) => current.filter((item) => item.id !== id));
      toast.success("Отзыв удален");
    } catch (error) {
      console.error("Error deleting testimonial:", error);
      toast.error("Не удалось удалить отзыв");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {items.length} отзывов, опубликовано {items.filter((item) => item.isPublished).length}
        </p>
        <Button
          onClick={addItem}
          className="rounded-xl gradient-hero hover:opacity-90 shadow-glow gap-2"
        >
          <Plus className="h-4 w-4" />
          Добавить отзыв
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-border/50 bg-card p-12 text-center shadow-soft">
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <MessageCircle className="h-8 w-8 text-primary" />
          </div>
          <p className="font-serif text-lg font-semibold text-foreground">Отзывы пока не добавлены</p>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Создайте первый отзыв: он сразу появится в слайдере на публичной главной и в студенческом кабинете.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item, index) => (
            <div
              key={item.id}
              className="overflow-hidden rounded-[28px] border border-border/50 bg-card shadow-soft animate-fade-in-up"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex flex-col gap-3 border-b border-border/50 bg-secondary/18 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div className="flex items-center gap-3">
                  <TestimonialAvatar variant={item.avatarVariant} size="sm" />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-foreground">
                      {item.name || "Без имени"}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {item.roleOrSubtitle || "Подзаголовок не указан"}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div
                    className={`flex items-center gap-1.5 text-xs font-medium ${
                      item.isPublished ? "text-success" : "text-muted-foreground"
                    }`}
                  >
                    {item.isPublished ? (
                      <Eye className="h-3.5 w-3.5" />
                    ) : (
                      <EyeOff className="h-3.5 w-3.5" />
                    )}
                    {item.isPublished ? "Опубликован" : "Скрыт"}
                  </div>
                  <Switch
                    checked={item.isPublished}
                    onCheckedChange={(checked) => void togglePublished(item, checked)}
                  />
                </div>
              </div>

              <div className="space-y-4 p-5 sm:p-6">
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
                  <div className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Имя</Label>
                        <Input
                          value={item.name}
                          onChange={(event) => updateItem(item.id, { name: event.target.value })}
                          className="rounded-xl bg-secondary/30 border-border/50 focus:border-primary"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Подпись</Label>
                        <Input
                          value={item.roleOrSubtitle}
                          onChange={(event) =>
                            updateItem(item.id, { roleOrSubtitle: event.target.value })
                          }
                          placeholder="Например: психолог, маркетолог"
                          className="rounded-xl bg-secondary/30 border-border/50 focus:border-primary"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Текст отзыва</Label>
                      <Textarea
                        value={item.text}
                        onChange={(event) => updateItem(item.id, { text: event.target.value })}
                        placeholder="Расскажите, какой результат получил пользователь"
                        className="min-h-[120px] rounded-xl bg-secondary/30 border-border/50 focus:border-primary resize-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-4 rounded-2xl border border-border/50 bg-secondary/16 p-4">
                    <div className="space-y-2">
                      <Label>Аватар</Label>
                      <Select
                        value={item.avatarVariant}
                        onValueChange={(value: AvatarVariant) =>
                          updateItem(item.id, { avatarVariant: value })
                        }
                      >
                        <SelectTrigger className="rounded-xl bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="female">Женский силуэт</SelectItem>
                          <SelectItem value="male">Мужской силуэт</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Порядок</Label>
                      <Input
                        type="number"
                        value={item.sortOrder}
                        onChange={(event) =>
                          updateItem(item.id, {
                            sortOrder: Number.parseInt(event.target.value || "0", 10) || 0,
                          })
                        }
                        className="rounded-xl bg-background"
                      />
                    </div>

                    <div className="rounded-2xl border border-primary/12 bg-white p-4 shadow-xs">
                      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        Превью
                      </p>
                      <div className="flex items-center gap-3">
                        <TestimonialAvatar variant={item.avatarVariant} size="md" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {item.name || "Имя"}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {item.roleOrSubtitle || "Подпись"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Button
                    onClick={() => void saveItem(item)}
                    disabled={savingId === item.id}
                    className="rounded-xl gradient-hero hover:opacity-90 shadow-glow gap-2"
                  >
                    {savingId === item.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Сохранить
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => void deleteItem(item.id)}
                    className="rounded-xl text-destructive hover:text-destructive hover:bg-destructive/10 gap-2"
                  >
                    <Trash2 className="h-4 w-4" />
                    Удалить
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
