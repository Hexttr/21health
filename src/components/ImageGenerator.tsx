import React, { useState, useRef } from 'react';
import { ImageIcon, Send, Loader2, Upload, X, Download, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

export function ImageGenerator() {
  const [prompt, setPrompt] = useState('');
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Пожалуйста, выберите изображение');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Изображение слишком большое (макс. 10MB)');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setSourceImage(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const removeSourceImage = () => {
    setSourceImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const generateImage = async () => {
    if (!prompt.trim() || isLoading) return;

    setIsLoading(true);
    setGeneratedImage(null);

    try {
      const token = localStorage.getItem('token');
      const apiUrl = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? '/api' : 'http://localhost:3001/api');
      const response = await fetch(`${apiUrl}/ai/image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({ prompt: prompt.trim(), image: sourceImage }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errMsg = typeof data?.error === 'string' ? data.error : data?.error?.message || 'Ошибка генерации';
        throw new Error(errMsg);
      }

      if (data.imageUrl) {
        setGeneratedImage(data.imageUrl);
        toast.success('Изображение сгенерировано!');
      } else {
        throw new Error('Не удалось получить изображение');
      }
    } catch (error) {
      console.error('Image generation error:', error);
      toast.error(error instanceof Error ? error.message : 'Ошибка генерации изображения');
    } finally {
      setIsLoading(false);
    }
  };

  const downloadImage = () => {
    if (!generatedImage) return;
    
    const link = document.createElement('a');
    link.href = generatedImage;
    link.download = `generated-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      generateImage();
    }
  };

  return (
    <div className="flex flex-col gap-5 py-4">
      {/* Result or placeholder */}
      {generatedImage ? (
        <div className="animate-fade-in-up space-y-4">
          <div className="relative">
            <img
              src={generatedImage}
              alt="Generated"
              className="w-full rounded-2xl shadow-large border border-border/50"
            />
            <Button
              onClick={downloadImage}
              size="sm"
              variant="secondary"
              className="absolute top-3 right-3 rounded-xl gap-1.5 shadow-medium backdrop-blur-sm bg-card/80"
            >
              <Download className="w-4 h-4" />
              Скачать
            </Button>
          </div>
          {sourceImage && (
            <div className="flex items-center gap-3 text-sm text-muted-foreground bg-secondary/30 rounded-xl p-3">
              <img src={sourceImage} alt="Source" className="w-12 h-12 rounded-lg object-cover border border-border/50" />
              <span>Исходное изображение</span>
            </div>
          )}
        </div>
      ) : (
        <div className={`flex flex-col items-center justify-center py-16 text-center bg-card rounded-2xl border border-border/50 transition-all ${isLoading ? 'border-primary/30' : ''}`}>
          {isLoading ? (
            <>
              <div className="w-20 h-20 rounded-3xl flex items-center justify-center mb-5 shadow-large animate-pulse overflow-hidden bg-card border border-border/50">
                <img src="/icons/banano.png" alt="" className="w-14 h-14 object-contain opacity-80" />
              </div>
              <p className="font-serif text-lg font-semibold text-foreground mb-2">Генерирую изображение...</p>
              <p className="text-sm text-muted-foreground">Это может занять несколько секунд</p>
              <div className="flex items-center gap-1.5 mt-4">
                <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </>
          ) : (
            <>
              <div className="w-20 h-20 rounded-3xl flex items-center justify-center mb-5 shadow-large overflow-hidden bg-card border border-border/50">
                <img src="/icons/banano.png" alt="" className="w-14 h-14 object-contain" />
              </div>
              <p className="font-serif text-lg font-semibold text-foreground mb-2">Генератор изображений</p>
              <p className="text-sm text-muted-foreground max-w-sm">
                Опишите, что хотите создать. Можно загрузить фото для редактирования.
              </p>
            </>
          )}
        </div>
      )}

      {/* Input area */}
      <div className="bg-card rounded-2xl border border-border/50 shadow-soft p-4">
        {sourceImage && (
          <div className="mb-3 flex items-center gap-3 p-3 rounded-xl bg-secondary/30 border border-border/50">
            <div className="relative flex-shrink-0">
              <img src={sourceImage} alt="Source" className="w-14 h-14 rounded-lg object-cover border border-border/50" />
              <button
                onClick={removeSourceImage}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-md hover:bg-destructive/90"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground">Исходное фото загружено. Опишите, как его изменить.</p>
          </div>
        )}

        <div className="flex gap-3 items-end">
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
          <Button
            onClick={() => fileInputRef.current?.click()}
            variant="outline"
            size="icon"
            className="h-[52px] w-[52px] shrink-0 rounded-xl border-border/50 hover:border-primary/40"
            disabled={isLoading}
            title="Загрузить изображение"
          >
            <Upload className="w-4.5 h-4.5" style={{ width: '18px', height: '18px' }} />
          </Button>

          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={sourceImage ? "Опишите изменения..." : "Опишите, что хотите создать..."}
            className="min-h-[52px] max-h-[120px] resize-none rounded-xl bg-secondary/30 border-border/50 focus:border-primary text-sm"
            disabled={isLoading}
            rows={1}
          />

          <Button
            onClick={generateImage}
            disabled={!prompt.trim() || isLoading}
            size="icon"
            className="h-[52px] w-[52px] min-w-[52px] shrink-0 rounded-xl gradient-hero hover:opacity-90 shadow-glow disabled:opacity-50 disabled:shadow-none"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <ImageIcon className="w-5 h-5" />
            )}
          </Button>
        </div>
        <p className="text-center text-xs text-muted-foreground/60 mt-2">
          Enter — сгенерировать, Shift+Enter — новая строка
        </p>
      </div>
    </div>
  );
}
