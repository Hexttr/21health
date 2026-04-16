import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, apiUpload } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, ArrowLeft, Lock, CheckCircle2, Circle, BookOpen, ClipboardList, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

type ModuleItem = {
  id: string;
  title: string;
  sortOrder: number;
  itemType: string;
  content: Record<string, unknown>;
};

type ItemProgress = {
  moduleItemId: string;
  status: string;
  completedAt?: string | null;
};

type TestMeta = {
  id: string;
  passScorePercent: number;
  maxAttempts: number;
  cooldownHours: number;
} | null;

type TreeNode = {
  module: { id: string; title: string; sortOrder: number; moduleKind: string };
  items: Array<{ item: ModuleItem; progress: ItemProgress | null; test: TestMeta }>;
};

type EnrollmentPayload = {
  enrollment: { id: string; status: string };
  assignment: { enforceSequence: boolean; courseId: string };
  course: { id: string; title: string; description: string | null } | null;
  tree: TreeNode[];
};

type QuestionClient = {
  id: string;
  questionType: string;
  body: Record<string, unknown>;
};

function renderTheoryContent(content: Record<string, unknown>) {
  const md = typeof content.markdown === 'string' ? content.markdown : null;
  const text = typeof content.text === 'string' ? content.text : null;
  const html = typeof content.html === 'string' ? content.html : null;
  if (html) {
    return <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: html }} />;
  }
  if (md) {
    return <pre className="whitespace-pre-wrap text-sm font-sans bg-muted/40 p-4 rounded-lg">{md}</pre>;
  }
  if (text) {
    return <p className="whitespace-pre-wrap text-sm">{text}</p>;
  }
  if (Object.keys(content).length === 0) {
    return <p className="text-muted-foreground text-sm">Материал будет добавлен администратором.</p>;
  }
  return (
    <pre className="text-xs bg-muted/30 p-3 rounded overflow-auto max-h-96">{JSON.stringify(content, null, 2)}</pre>
  );
}

export default function LmsEnrollment() {
  const { enrollmentId } = useParams<{ enrollmentId: string }>();
  const [data, setData] = useState<EnrollmentPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  const [testState, setTestState] = useState<{
    testId: string;
    attemptId: string;
    questions: QuestionClient[];
    answers: Record<string, unknown>;
    submitting: boolean;
    result: { scorePercent: number; passed: boolean } | null;
    error: string | null;
  } | null>(null);

  const [practiceFiles, setPracticeFiles] = useState<File[]>([]);
  const [practiceComment, setPracticeComment] = useState('');
  const [practiceBusy, setPracticeBusy] = useState(false);

  const load = () => {
    if (!enrollmentId) return;
    api<EnrollmentPayload>(`/lms/enrollments/${enrollmentId}`)
      .then(setData)
      .catch((e) => setErr(e instanceof Error ? e.message : 'Ошибка'));
  };

  useEffect(() => {
    load();
  }, [enrollmentId]);

  const flatItems = useMemo(() => {
    if (!data) return [];
    const out: Array<{
      item: ModuleItem;
      progress: ItemProgress | null;
      test: TestMeta;
      moduleTitle: string;
    }> = [];
    for (const t of data.tree) {
      for (const row of t.items) {
        out.push({ ...row, moduleTitle: t.module.title });
      }
    }
    return out;
  }, [data]);

  const selected = flatItems.find((x) => x.item.id === selectedItemId);

  const completeTheory = async () => {
    if (!enrollmentId || !selected || selected.item.itemType !== 'theory') return;
    await api(`/lms/enrollments/${enrollmentId}/items/${selected.item.id}/complete-theory`, { method: 'POST' });
    load();
  };

  const startTest = async (testId: string) => {
    if (!enrollmentId) return;
    setTestState({ testId, attemptId: '', questions: [], answers: {}, submitting: false, result: null, error: null });
    try {
      const res = await api<{
        attempt: { id: string };
        questions: QuestionClient[];
        resumed?: boolean;
      }>(`/lms/enrollments/${enrollmentId}/tests/${testId}/start`, { method: 'POST' });
      setTestState({
        testId,
        attemptId: res.attempt.id,
        questions: res.questions,
        answers: {},
        submitting: false,
        result: null,
        error: null,
      });
    } catch (e) {
      setTestState({
        testId,
        attemptId: '',
        questions: [],
        answers: {},
        submitting: false,
        result: null,
        error: e instanceof Error ? e.message : 'Ошибка',
      });
    }
  };

  const submitTest = async () => {
    if (!enrollmentId || !testState) return;
    setTestState((s) => (s ? { ...s, submitting: true } : s));
    try {
      const res = await api<{ scorePercent: number; passed: boolean }>(
        `/lms/enrollments/${enrollmentId}/tests/${testState.testId}/submit`,
        {
          method: 'POST',
          body: {
            attemptId: testState.attemptId,
            answers: testState.answers,
          },
        },
      );
      setTestState((s) => (s ? { ...s, submitting: false, result: res } : s));
      load();
    } catch (e) {
      setTestState((s) =>
        s ? { ...s, submitting: false, error: e instanceof Error ? e.message : 'Ошибка отправки' } : s,
      );
    }
  };

  const submitPractice = async (moduleItemId: string) => {
    if (!enrollmentId) return;
    setPracticeBusy(true);
    try {
      const urls: string[] = [];
      for (const f of practiceFiles) {
        const fd = new FormData();
        fd.append('file', f);
        const up = (await apiUpload('/lms/upload', fd)) as { url: string };
        urls.push(up.url);
      }
      await api(`/lms/enrollments/${enrollmentId}/practice`, {
        method: 'POST',
        body: {
          moduleItemId,
          fileUrls: urls,
          comment: practiceComment || undefined,
        },
      });
      setPracticeFiles([]);
      setPracticeComment('');
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setPracticeBusy(false);
    }
  };

  if (err) {
    return (
      <div className="p-8">
        <p className="text-destructive">{err}</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/lms">Назад</Link>
        </Button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
            <Link to="/lms" className="gap-2">
              <ArrowLeft className="w-4 h-4" /> К курсам
            </Link>
          </Button>
          <h1 className="text-2xl md:text-3xl font-serif font-bold">{data.course?.title || 'Курс'}</h1>
          {data.course?.description && <p className="text-muted-foreground mt-1">{data.course.description}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <Card className="lg:col-span-2 p-4 space-y-4 h-fit">
          <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Содержание</h2>
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            {data.tree.map((mod) => (
              <div key={mod.module.id}>
                <p className="text-xs font-medium text-muted-foreground mb-2">{mod.module.title}</p>
                <ul className="space-y-1">
                  {mod.items.map(({ item, progress }) => {
                    const st = progress?.status || 'locked';
                    const Icon =
                      item.itemType === 'theory'
                        ? BookOpen
                        : item.itemType === 'test'
                          ? ClipboardList
                          : FileText;
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedItemId(item.id);
                            setTestState(null);
                          }}
                          className={cn(
                            'w-full text-left flex items-start gap-2 rounded-lg px-2 py-2 text-sm transition-colors',
                            selectedItemId === item.id ? 'bg-primary/10 border border-primary/20' : 'hover:bg-muted/60',
                            st === 'locked' && 'opacity-60',
                          )}
                        >
                          {st === 'completed' ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                          ) : st === 'locked' ? (
                            <Lock className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                          ) : (
                            <Circle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                          )}
                          <span className="flex-1 min-w-0">
                            <span className="flex items-center gap-1.5">
                              <Icon className="w-3.5 h-3.5 shrink-0 opacity-70" />
                              {item.title}
                            </span>
                            <span className="text-[10px] text-muted-foreground block">
                              {item.itemType === 'theory'
                                ? 'Теория'
                                : item.itemType === 'test'
                                  ? 'Тест'
                                  : 'Практика'}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </Card>

        <Card className="lg:col-span-3 p-5 min-h-[320px]">
          {!selected ? (
            <p className="text-muted-foreground">Выберите элемент слева</p>
          ) : selected.item.itemType === 'theory' ? (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">{selected.item.title}</h2>
              {renderTheoryContent(selected.item.content)}
              {selected.progress?.status === 'available' && (
                <Button onClick={() => void completeTheory()}>Отметить как пройдено</Button>
              )}
              {selected.progress?.status === 'completed' && (
                <p className="text-sm text-emerald-700 font-medium">Раздел завершён</p>
              )}
              {selected.progress?.status === 'locked' && (
                <p className="text-sm text-muted-foreground">Сначала завершите предыдущие разделы.</p>
              )}
            </div>
          ) : selected.item.itemType === 'test' && !selected.test ? (
            <div>
              <h2 className="text-xl font-semibold">{selected.item.title}</h2>
              <p className="text-destructive text-sm mt-2">Тест ещё не настроен администратором.</p>
            </div>
          ) : selected.item.itemType === 'test' && selected.test ? (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">{selected.item.title}</h2>
              {!testState || testState.testId !== selected.test.id ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Проходной балл: {selected.test.passScorePercent}%. Попыток не больше {selected.test.maxAttempts}.
                  </p>
                  {selected.progress?.status === 'locked' ? (
                    <p className="text-sm text-muted-foreground">Тест пока недоступен.</p>
                  ) : (
                    <Button onClick={() => void startTest(selected.test!.id)}>Начать тест</Button>
                  )}
                </div>
              ) : testState.error && !testState.questions.length ? (
                <div className="space-y-2">
                  <p className="text-destructive text-sm">{testState.error}</p>
                  <Button variant="outline" onClick={() => setTestState(null)}>
                    Закрыть
                  </Button>
                </div>
              ) : testState.result ? (
                <div className="space-y-2">
                  <p className={cn('text-lg font-semibold', testState.result.passed ? 'text-emerald-700' : 'text-destructive')}>
                    Результат: {testState.result.scorePercent}% — {testState.result.passed ? 'зачёт' : 'незачёт'}
                  </p>
                  <Button variant="outline" onClick={() => setTestState(null)}>
                    Закрыть
                  </Button>
                </div>
              ) : (
                <div className="space-y-6">
                  {testState.questions.map((q, qi) => {
                    const body = q.body as Record<string, unknown>;
                    const opts = (body.options as string[]) || [];
                    return (
                      <div key={q.id} className="border-b border-border/60 pb-4 last:border-0">
                        <p className="font-medium mb-2">
                          {qi + 1}. {String(body.prompt || body.question || 'Вопрос')}
                        </p>
                        {q.questionType === 'single' && (
                          <RadioGroup
                            value={String(testState.answers[q.id] ?? '')}
                            onValueChange={(v) =>
                              setTestState((s) =>
                                s ? { ...s, answers: { ...s.answers, [q.id]: Number(v) } } : s,
                              )
                            }
                          >
                            {opts.map((opt, i) => (
                              <label key={i} className="flex items-center gap-2 text-sm py-1 cursor-pointer">
                                <RadioGroupItem value={String(i)} id={`${q.id}-${i}`} />
                                <span>{opt}</span>
                              </label>
                            ))}
                          </RadioGroup>
                        )}
                        {q.questionType === 'multi' && (
                          <div className="space-y-2">
                            {opts.map((opt, i) => {
                              const arr = Array.isArray(testState.answers[q.id])
                                ? (testState.answers[q.id] as number[])
                                : [];
                              const checked = arr.includes(i);
                              return (
                                <label key={i} className="flex items-center gap-2 text-sm cursor-pointer">
                                  <Checkbox
                                    checked={checked}
                                    onCheckedChange={(c) => {
                                      const next = new Set(arr);
                                      if (c) next.add(i);
                                      else next.delete(i);
                                      setTestState((s) =>
                                        s
                                          ? {
                                              ...s,
                                              answers: { ...s.answers, [q.id]: [...next].sort((a, b) => a - b) },
                                            }
                                          : s,
                                      );
                                    }}
                                  />
                                  {opt}
                                </label>
                              );
                            })}
                          </div>
                        )}
                        {q.questionType !== 'single' && q.questionType !== 'multi' && (
                          <Textarea
                            value={String(testState.answers[q.id] ?? '')}
                            onChange={(e) =>
                              setTestState((s) =>
                                s ? { ...s, answers: { ...s.answers, [q.id]: e.target.value } } : s,
                              )
                            }
                            placeholder="Ответ"
                          />
                        )}
                      </div>
                    );
                  })}
                  {testState.error && <p className="text-destructive text-sm">{testState.error}</p>}
                  <Button onClick={() => void submitTest()} disabled={testState.submitting}>
                    {testState.submitting ? 'Отправка…' : 'Отправить ответы'}
                  </Button>
                </div>
              )}
            </div>
          ) : selected.item.itemType === 'practice' ? (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">{selected.item.title}</h2>
              <p className="text-sm text-muted-foreground">Загрузите файлы и при необходимости оставьте комментарий.</p>
              {selected.progress?.status === 'locked' ? (
                <p className="text-sm">Практика пока недоступна.</p>
              ) : (
                <>
                  <div>
                    <Label htmlFor="pr-files">Файлы</Label>
                    <Input
                      id="pr-files"
                      type="file"
                      multiple
                      onChange={(e) => setPracticeFiles(e.target.files ? Array.from(e.target.files) : [])}
                    />
                  </div>
                  <div>
                    <Label htmlFor="pr-com">Комментарий</Label>
                    <Textarea
                      id="pr-com"
                      value={practiceComment}
                      onChange={(e) => setPracticeComment(e.target.value)}
                      rows={3}
                    />
                  </div>
                  <Button disabled={practiceBusy} onClick={() => void submitPractice(selected.item.id)}>
                    {practiceBusy ? 'Отправка…' : 'Отправить на проверку'}
                  </Button>
                </>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground">Неизвестный тип элемента</p>
          )}
        </Card>
      </div>
    </div>
  );
}
