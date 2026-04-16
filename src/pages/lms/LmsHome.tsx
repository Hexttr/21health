import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Loader2, BookOpen, GraduationCap } from 'lucide-react';

type EnrollmentRow = {
  enrollment: { id: string; status: string };
  assignment: { id: string; courseId: string; startsAt?: string } | null;
  course: { id: string; title: string; description: string | null } | null;
};

export default function LmsHome() {
  const [data, setData] = useState<EnrollmentRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api<{ enrollments: EnrollmentRow[] }>('/lms/my/enrollments')
      .then((r) => setData(r.enrollments || []))
      .catch((e) => setErr(e instanceof Error ? e.message : 'Ошибка загрузки'));
  }, []);

  if (err) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <p className="text-destructive">{err}</p>
      </div>
    );
  }

  if (data === null) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-serif font-bold text-foreground flex items-center gap-2">
          <GraduationCap className="w-8 h-8 text-primary" />
          Обучение
        </h1>
        <p className="text-muted-foreground mt-2">Назначенные вам курсы</p>
      </div>

      {data.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          Пока нет назначенных курсов. Обратитесь к администратору или тьютору.
        </Card>
      ) : (
        <ul className="space-y-4">
          {data.map((row) => (
            <li key={row.enrollment.id}>
              <Card className="p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex gap-3">
                  <BookOpen className="w-10 h-10 text-primary shrink-0" />
                  <div>
                    <h2 className="font-semibold text-lg">{row.course?.title || 'Курс'}</h2>
                    {row.course?.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">{row.course.description}</p>
                    )}
                  </div>
                </div>
                <Button asChild>
                  <Link to={`/lms/enrollment/${row.enrollment.id}`}>Открыть</Link>
                </Button>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Card className="p-5 border-dashed">
        <p className="text-sm text-muted-foreground mb-2">Классический курс (21 день)</p>
        <Button variant="outline" asChild>
          <Link to="/course-legacy">Перейти к прежнему интерфейсу</Link>
        </Button>
      </Card>
    </div>
  );
}
