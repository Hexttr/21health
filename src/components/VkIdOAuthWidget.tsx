import * as React from 'react';
import * as VKID from '@vkid/sdk';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface VkWidgetConfigResponse {
  app: number;
  redirectUrl: string;
  state: string;
  codeVerifier: string;
  scope: string;
}

interface VkIdOAuthWidgetProps {
  accessCode?: string;
}

export function VkIdOAuthWidget({ accessCode = '' }: VkIdOAuthWidgetProps) {
  const { exchangeVkIdCode } = useAuth();
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [error, setError] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    let isCancelled = false;
    let oauthList: VKID.OAuthList | null = null;
    const container = containerRef.current;

    async function setupWidget() {
      if (!container) {
        return;
      }

      setIsLoading(true);
      setError('');
      container.innerHTML = '';

      try {
        const apiUrl = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? '/api' : 'http://localhost:3001/api');
        const query = new URLSearchParams({ mode: 'login' });
        const normalizedAccessCode = accessCode.trim().toUpperCase();
        if (normalizedAccessCode) {
          query.set('accessCode', normalizedAccessCode);
        }

        const response = await fetch(`${apiUrl}/auth/social/vkid/config?${query.toString()}`);
        const data = await response.json().catch(() => ({ error: 'Не удалось загрузить конфигурацию VK ID' })) as
          | VkWidgetConfigResponse
          | { error?: string };

        if (!response.ok) {
          throw new Error(('error' in data && data.error) || 'Не удалось загрузить конфигурацию VK ID');
        }

        if (isCancelled) {
          return;
        }

        const config = data as VkWidgetConfigResponse;
        VKID.Config.init({
          app: config.app,
          redirectUrl: config.redirectUrl,
          state: config.state,
          codeVerifier: config.codeVerifier,
          scope: config.scope,
          responseMode: VKID.ConfigResponseMode.Callback,
          mode: VKID.ConfigAuthMode.InNewWindow,
        });

        oauthList = new VKID.OAuthList();
        oauthList
          .on(VKID.OAuthListInternalEvents.LOGIN_SUCCESS, async (payload: VKID.AuthResponse) => {
            if (isCancelled) {
              return;
            }

            setError('');
            setIsLoading(true);

            const result = await exchangeVkIdCode({
              code: payload.code,
              state: payload.state,
              deviceId: payload.device_id,
            });

            if (isCancelled) {
              return;
            }

            if (result.error) {
              setError(result.error);
            }

            setIsLoading(false);
          })
          .on(VKID.WidgetEvents.ERROR, () => {
            if (!isCancelled) {
              setError('Не удалось загрузить форму VK ID. Попробуйте еще раз.');
              setIsLoading(false);
            }
          });

        oauthList.render({
          container,
          oauthList: [VKID.OAuthName.VK, VKID.OAuthName.MAIL, VKID.OAuthName.OK],
          scheme: VKID.Scheme.LIGHT,
          lang: VKID.Languages.RUS,
          styles: {
            height: 44,
            borderRadius: 14,
          },
        });

        if (!isCancelled) {
          setIsLoading(false);
        }
      } catch (setupError) {
        if (!isCancelled) {
          setError(setupError instanceof Error ? setupError.message : 'Не удалось загрузить форму VK ID');
          setIsLoading(false);
        }
      }
    }

    void setupWidget();

    return () => {
      isCancelled = true;
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [accessCode, exchangeVkIdCode]);

  return (
    <div className="space-y-3 rounded-2xl border border-border/60 bg-secondary/20 p-4">
      <div>
        <div className="text-sm font-semibold text-foreground">Войти через VK, Mail.ru или OK</div>
        <div className="mt-1 text-xs leading-5 text-muted-foreground">
          Без отдельной регистрации. Используем email от провайдера, если он доступен.
        </div>
      </div>

      <div className="relative min-h-[44px]">
        <div ref={containerRef} />
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-background/70 backdrop-blur-[1px]">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
