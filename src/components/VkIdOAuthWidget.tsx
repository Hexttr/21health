import * as React from 'react';
import { AlertCircle } from 'lucide-react';

interface VkIdOAuthWidgetProps {
  accessCode?: string;
}

export function VkIdOAuthWidget({ accessCode = '' }: VkIdOAuthWidgetProps) {
  const [error, setError] = React.useState('');

  const startAuth = (provider: 'vkid' | 'mail_ru' | 'ok_ru') => {
    try {
      setError('');
      const apiUrl = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? '/api' : 'http://localhost:3001/api');
      const params = new URLSearchParams({ mode: 'login', provider });
      const normalizedAccessCode = accessCode.trim().toUpperCase();
      if (normalizedAccessCode) {
        params.set('accessCode', normalizedAccessCode);
      }
      window.location.assign(`${apiUrl}/auth/social/vkid/start?${params.toString()}`);
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : 'Не удалось запустить вход через VK ID');
    }
  };

  const providers = [
    {
      id: 'vkid' as const,
      label: 'ВКонтакте',
      content: <span className="text-[15px] font-extrabold tracking-tight text-[#0077FF]">VK</span>,
    },
    {
      id: 'mail_ru' as const,
      label: 'Mail.ru',
      content: <span className="text-[20px] font-black leading-none text-[#0A7CFF]">@</span>,
    },
    {
      id: 'ok_ru' as const,
      label: 'Одноклассники',
      content: <span className="text-[18px] font-black leading-none text-[#F58220]">OK</span>,
    },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        {providers.map((provider) => (
          <button
            key={provider.id}
            type="button"
            aria-label={`Войти через ${provider.label}`}
            title={`Войти через ${provider.label}`}
            onClick={() => startAuth(provider.id)}
            className="flex h-11 items-center justify-center rounded-2xl border border-border/65 bg-background/90 transition-colors hover:border-primary/35 hover:bg-secondary/45"
          >
            {provider.content}
          </button>
        ))}
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
