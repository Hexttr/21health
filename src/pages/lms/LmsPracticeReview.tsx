import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, getUploadUrl } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, ChevronLeft } from 'lucide-react';
import { toast } from 'sonner';

type Sub = {
  id: string;
  status: string;
  comment: string | null;
  fileUrls: string[];
  user: { email: string; name: string | null } | null;
  moduleItem: { title: string } | null;
};

export default function LmsPracticeReview() {
  const [rows, setRows] = useState<Sub[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<Record<string, string>>({});

  const load = () => {
    api<{ submissions: Sub[] }>('/lms/practice-submissions')
      .then((r) => setRows(r.submissions))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const review = async (id: string, status: string) => {
    await api(`/lms/practice-submissions/${id}`, {
      method: 'PATCH',
      body: { status, feedback: feedback[id] || undefined },
    });
    toast.success('Сохранено');
    load();
  };

  if (loading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/lms" className="gap-1">
            <ChevronLeft className="w-4 h-4" /> LMS
          </Link>
        </Button>
        <h1 className="text-2xl font-serif font-bold">Практические работы</h1>
      </div>

      <div className="space-y-4">
        {rows.map((s) => (
          <Card key={s.id} className="p-4 space-y-2">
            <div className="flex flex-wrap justify-between gap-2">
              <div>
                <div className="font-medium">{s.moduleItem?.title || 'Практика'}</div>
                <div className="text-sm text-muted-foreground">
                  {s.user?.name || s.user?.email} · <span className="uppercase">{s.status}</span>
                </div>
              </div>
            </div>
            {s.comment && <p className="text-sm">{s.comment}</p>}
            {s.fileUrls?.length > 0 && (
              <ul className="text-sm text-primary">
                {s.fileUrls.map((u) => (
                  <li key={u}>
                    <a href={getUploadUrl(u)} target="_blank" rel="noreferrer">
                      {u}
                    </a>
                  </li>
                ))}
              </ul>
            )}
            <div>
              <Label>Комментарий проверяющего</Label>
              <Textarea
                value={feedback[s.id] ?? ''}
                onChange={(e) => setFeedback({ ...feedback, [s.id]: e.target.value })}
                rows={2}
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => void review(s.id, 'approved')}>
                Принять
              </Button>
              <Button size="sm" variant="secondary" onClick={() => void review(s.id, 'needs_revision')}>
                На доработку
              </Button>
              <Button size="sm" variant="destructive" onClick={() => void review(s.id, 'rejected')}>
                Отклонить
              </Button>
            </div>
          </Card>
        ))}
        {rows.length === 0 && <p className="text-muted-foreground">Нет заявок</p>}
      </div>
    </div>
  );
}
