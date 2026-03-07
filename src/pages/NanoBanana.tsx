import { ImageGenerator } from '@/components/ImageGenerator';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { BalanceWidget } from '@/components/BalanceWidget';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { useChatContext } from '@/contexts/ChatContext';
import { getAIToolBadge } from '@/lib/ai-tools';

export default function NanoBanana() {
  const chatContext = useChatContext();

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'hsl(248deg 100% 94.56%)' }}>
      <div className="h-screen flex flex-col">
        {/* Header (mobile only) */}
        <header className="md:hidden flex-shrink-0 border-b border-border/50 bg-card/80 backdrop-blur-xl sticky top-0 z-10">
          <div className="flex items-center justify-between px-4 h-16">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="text-muted-foreground hover:text-foreground transition-colors" />
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-soft overflow-hidden bg-card border border-border/50">
                <img src="/icons/banano.png" alt="" className="w-7 h-7 object-contain" />
              </div>
              <div>
                <h1 className="font-serif text-lg font-semibold text-foreground leading-none">
                  NanoBanana 3 Pro
                </h1>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-xs text-muted-foreground">
                    Генерация изображений с помощью ИИ
                  </p>
                  <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${getAIToolBadge('paid')}`}>
                    paid
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <BalanceWidget compact />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => chatContext?.clearChat('nanobanana')}
                className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl gap-2"
                title="Очистить чат"
              >
                <Trash2 className="w-4 h-4" />
                <span className="hidden sm:inline">Очистить</span>
              </Button>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col p-4">
          <div className="max-w-3xl mx-auto min-[1920px]:max-w-[80%] flex-1 flex flex-col min-h-0 w-full">
            <ImageGenerator />
          </div>
        </div>
      </div>
    </div>
  );
}
