import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, ChevronLeft } from 'lucide-react';
import { toast } from 'sonner';

type Course = { id: string; title: string; description: string | null; isPublished: boolean };

export default function LmsAdminCourses() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<{
    course: Course;
    modules: Array<{
      id: string;
      title: string;
      sortOrder: number;
      moduleKind: string;
      items: Array<{
        id: string;
        title: string;
        itemType: string;
        test: { id: string } | null;
      }>;
    }>;
  } | null>(null);

  const [newCourse, setNewCourse] = useState({ title: '', description: '', isPublished: false });
  const [modForm, setModForm] = useState({ title: '', moduleKind: 'theory' });
  const [itemForm, setItemForm] = useState({ moduleId: '', title: '', itemType: 'theory', markdown: '' });
  const [qForm, setQForm] = useState({ testId: '', prompt: '', options: 'A\nB\nC\nD', correctIndex: 0 });

  const loadList = () => {
    api<{ courses: Course[] }>('/lms/courses')
      .then((r) => setCourses(r.courses))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadList();
  }, []);

  const loadDetail = (id: string) => {
    api<{
      course: Course;
      modules: Array<{
        id: string;
        title: string;
        sortOrder: number;
        moduleKind: string;
        items: Array<{ id: string; title: string; itemType: string; test: { id: string } | null }>;
      }>;
    }>(`/lms/courses/${id}`).then((r) => {
      setDetail(r);
      setSelectedId(id);
    });
  };

  const createCourse = async () => {
    if (!newCourse.title.trim()) return;
    await api('/lms/courses', {
      method: 'POST',
      body: {
        title: newCourse.title.trim(),
        description: newCourse.description || undefined,
        isPublished: newCourse.isPublished,
      },
    });
    toast.success('Курс создан');
    setNewCourse({ title: '', description: '', isPublished: false });
    loadList();
  };

  const addModule = async () => {
    if (!selectedId || !modForm.title.trim()) return;
    await api(`/lms/courses/${selectedId}/modules`, {
      method: 'POST',
      body: { title: modForm.title.trim(), moduleKind: modForm.moduleKind, sortOrder: 0 },
    });
    toast.success('Модуль добавлен');
    setModForm({ title: '', moduleKind: 'theory' });
    loadDetail(selectedId);
  };

  const addItem = async () => {
    if (!itemForm.moduleId || !itemForm.title.trim()) return;
    const content =
      itemForm.itemType === 'theory' ? { markdown: itemForm.markdown || 'Текст урока' } : {};
    await api(`/lms/modules/${itemForm.moduleId}/items`, {
      method: 'POST',
      body: {
        title: itemForm.title.trim(),
        itemType: itemForm.itemType,
        sortOrder: 0,
        content,
      },
    });
    toast.success('Элемент добавлен');
    setItemForm({ ...itemForm, title: '', markdown: '' });
    if (selectedId) loadDetail(selectedId);
  };

  const addQuestion = async () => {
    if (!qForm.testId || !qForm.prompt.trim()) return;
    const options = qForm.options
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    await api(`/lms/tests/${qForm.testId}/questions`, {
      method: 'POST',
      body: {
        questionType: 'single',
        sortOrder: 0,
        body: {
          prompt: qForm.prompt.trim(),
          options,
          correctIndex: Math.min(qForm.correctIndex, Math.max(0, options.length - 1)),
        },
      },
    });
    toast.success('Вопрос добавлен');
    setQForm({ ...qForm, prompt: '', options: 'A\nB\nC\nD', correctIndex: 0 });
    if (selectedId) loadDetail(selectedId);
  };

  if (loading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto space-y-8">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/lms" className="gap-1">
            <ChevronLeft className="w-4 h-4" /> LMS
          </Link>
        </Button>
        <h1 className="text-2xl font-serif font-bold">Курсы LMS</h1>
      </div>

      <Card className="p-5 space-y-3">
        <h2 className="font-semibold">Новый курс</h2>
        <div className="grid gap-2 max-w-md">
          <Label>Название</Label>
          <Input value={newCourse.title} onChange={(e) => setNewCourse({ ...newCourse, title: e.target.value })} />
          <Label>Описание</Label>
          <Textarea
            value={newCourse.description}
            onChange={(e) => setNewCourse({ ...newCourse, description: e.target.value })}
            rows={2}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={newCourse.isPublished}
              onChange={(e) => setNewCourse({ ...newCourse, isPublished: e.target.checked })}
            />
            Опубликован
          </label>
          <Button onClick={() => void createCourse()}>Создать</Button>
        </div>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="p-5">
          <h2 className="font-semibold mb-3">Список курсов</h2>
          <ul className="space-y-2">
            {courses.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className={`w-full text-left px-3 py-2 rounded-lg border ${selectedId === c.id ? 'border-primary bg-primary/5' : 'border-border/60 hover:bg-muted/40'}`}
                  onClick={() => loadDetail(c.id)}
                >
                  <div className="font-medium">{c.title}</div>
                  <div className="text-xs text-muted-foreground">{c.isPublished ? 'опубликован' : 'черновик'}</div>
                </button>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-5 space-y-4">
          {!detail ? (
            <p className="text-muted-foreground text-sm">Выберите курс слева</p>
          ) : (
            <>
              <h2 className="font-semibold">{detail.course.title}</h2>
              <div className="space-y-2 border rounded-lg p-3">
                <h3 className="text-sm font-medium">Новый модуль</h3>
                <Input
                  placeholder="Название модуля"
                  value={modForm.title}
                  onChange={(e) => setModForm({ ...modForm, title: e.target.value })}
                />
                <Input
                  placeholder="moduleKind (theory / mixed / …)"
                  value={modForm.moduleKind}
                  onChange={(e) => setModForm({ ...modForm, moduleKind: e.target.value })}
                />
                <Button size="sm" onClick={() => void addModule()}>
                  Добавить модуль
                </Button>
              </div>

              {detail.modules.map((m) => (
                <div key={m.id} className="border rounded-lg p-3 space-y-2">
                  <div className="font-medium">
                    {m.title}{' '}
                    <span className="text-xs text-muted-foreground">({m.moduleKind})</span>
                  </div>
                  <ul className="text-sm space-y-1 pl-2">
                    {m.items.map((it) => (
                      <li key={it.id}>
                        • {it.title}{' '}
                        <span className="text-muted-foreground">
                          [{it.itemType}]
                          {it.test ? ` testId=${it.test.id.slice(0, 8)}…` : ''}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}

              <div className="space-y-2 border-t pt-4">
                <h3 className="text-sm font-medium">Новый элемент модуля</h3>
                <select
                  className="w-full border rounded-md px-2 py-2 text-sm bg-background"
                  value={itemForm.moduleId}
                  onChange={(e) => setItemForm({ ...itemForm, moduleId: e.target.value })}
                >
                  <option value="">— модуль —</option>
                  {detail.modules.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.title}
                    </option>
                  ))}
                </select>
                <Input
                  placeholder="Название элемента"
                  value={itemForm.title}
                  onChange={(e) => setItemForm({ ...itemForm, title: e.target.value })}
                />
                <select
                  className="w-full border rounded-md px-2 py-2 text-sm bg-background"
                  value={itemForm.itemType}
                  onChange={(e) => setItemForm({ ...itemForm, itemType: e.target.value })}
                >
                  <option value="theory">theory</option>
                  <option value="practice">practice</option>
                  <option value="test">test</option>
                </select>
                {itemForm.itemType === 'theory' && (
                  <Textarea
                    placeholder="Текст (markdown)"
                    value={itemForm.markdown}
                    onChange={(e) => setItemForm({ ...itemForm, markdown: e.target.value })}
                    rows={4}
                  />
                )}
                <Button size="sm" onClick={() => void addItem()}>
                  Добавить элемент
                </Button>
              </div>

              <div className="space-y-2 border-t pt-4">
                <h3 className="text-sm font-medium">Вопрос к тесту (single choice)</h3>
                <Input
                  placeholder="testId (UUID)"
                  value={qForm.testId}
                  onChange={(e) => setQForm({ ...qForm, testId: e.target.value })}
                />
                <Textarea
                  placeholder="Формулировка"
                  value={qForm.prompt}
                  onChange={(e) => setQForm({ ...qForm, prompt: e.target.value })}
                />
                <Textarea
                  placeholder="Варианты с новой строки"
                  value={qForm.options}
                  onChange={(e) => setQForm({ ...qForm, options: e.target.value })}
                  rows={4}
                />
                <Label>Индекс верного (0-based)</Label>
                <Input
                  type="number"
                  min={0}
                  value={qForm.correctIndex}
                  onChange={(e) => setQForm({ ...qForm, correctIndex: Number(e.target.value) })}
                />
                <Button size="sm" variant="secondary" onClick={() => void addQuestion()}>
                  Добавить вопрос
                </Button>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
