import * as React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';

export default function SocialAuthCallbackPage() {
  const { completeSocialAuth } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = React.useState(searchParams.get('error')?.trim() || '');
  const [isLoading, setIsLoading] = React.useState(!error);

  React.useEffect(() => {
    const ticket = searchParams.get('ticket')?.trim();
    const queryError = searchParams.get('error')?.trim();

    if (queryError) {
      setError(queryError);
      setIsLoading(false);
      return;
    }

    if (!ticket) {
      setError('Сессия входа не найдена. Попробуйте еще раз.');
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      const result = await completeSocialAuth(ticket);
      if (cancelled) {
        return;
      }

      if (result.error) {
        setError(result.error);
        setIsLoading(false);
        return;
      }

      navigate('/', { replace: true });
    })();

    return () => {
      cancelled = true;
    };
  }, [completeSocialAuth, navigate, searchParams]);

  return (
    <div className="min-h-screen mesh-bg px-4 py-6 sm:px-6">
      <div className="mx-auto flex min-h-[80vh] max-w-xl items-center justify-center">
        <div className="w-full rounded-[2rem] border border-border/60 bg-card/95 p-8 shadow-large backdrop-blur">
          {isLoading ? (
            <div className="flex flex-col items-center text-center">
              <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
              <h1 className="text-2xl font-extrabold text-foreground" style={{ fontFamily: 'Outfit, sans-serif' }}>
                Завершаем вход через VK ID
              </h1>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Проверяем ваш аккаунт и создаем безопасную сессию на платформе.
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center text-center">
              <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
                <ShieldAlert className="h-8 w-8" />
              </div>
              <h1 className="text-2xl font-extrabold text-foreground" style={{ fontFamily: 'Outfit, sans-serif' }}>
                Не удалось завершить вход
              </h1>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {error || 'Попробуйте еще раз или используйте обычный вход по email и паролю.'}
              </p>
              <div className="mt-6 flex w-full flex-col gap-3 sm:flex-row">
                <Button className="flex-1 rounded-2xl" onClick={() => navigate('/', { replace: true })}>
                  Вернуться на главную
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 rounded-2xl"
                  onClick={() => window.location.reload()}
                >
                  Попробовать снова
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
