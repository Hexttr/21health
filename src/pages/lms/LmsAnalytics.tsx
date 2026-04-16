import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Loader2, ChevronLeft, BarChart3 } from 'lucide-react';

type Summary = {
  enrollmentsTotal: number;
  coursesTotal: number;
  practicePending: number;
};

export default function LmsAnalytics() {
  const [data, setData] = useState<Summary | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api<Summary>('/lms/analytics/summary')
      .then(setData)
      .catch((e) => setErr(e instanceof Error ? e.message : 'Ошибка'));
  }, []);

  return (
    <div className="p-6 md:p-10 max-w-3xl mx-auto space-y-8">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/lms" className="gap-1">
            <ChevronLeft className="w-4 h-4" /> LMS
          </Link>
        </Button>
        <h1 className="text-2xl font-serif font-bold flex items-center gap-2">
          <BarChart3 className="w-7 h-7 text-primary" />
          Аналитика LMS
        </h1>
      </div>

      {err && <p className="text-destructive">{err}</p>}

      {!data && !err ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : data ? (
        <div className="grid sm:grid-cols-3 gap-4">
          <Card className="p-6">
            <div className="text-3xl font-bold text-primary">{data.enrollmentsTotal}</div>
            <div className="text-sm text-muted-foreground mt-1">Назначений (enrollments)</div>
          </Card>
          <Card className="p-6">
            <div className="text-3xl font-bold text-primary">{data.coursesTotal}</div>
            <div className="text-sm text-muted-foreground mt-1">Курсов в каталоге</div>
          </Card>
          <Card className="p-6">
            <div className="text-3xl font-bold text-primary">{data.practicePending}</div>
            <div className="text-sm text-muted-foreground mt-1">Практик на проверке</div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
