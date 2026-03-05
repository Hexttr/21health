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
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
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
        throw new Error(data.error || 'Ошибка генерации');
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
    <div className="flex flex-col h-full">
      {/* Main content area */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Result or placeholder */}
        {generatedImage ? (
          <div className="flex flex-col items-center gap-4">
            <div className="relative max-w-2xl w-full">
              <img
                src={generatedImage}
                alt="Generated"
                className="w-full rounded-2xl shadow-lg border border-border/50"
              />
              <Button
                onClick={downloadImage}
                size="icon"
                variant="secondary"
                className="absolute top-3 right-3"
              >
                <Download className="w-4 h-4" />
              </Button>
            </div>
            {sourceImage && (
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <span>Исходное изображение:</span>
                <img
                  src={sourceImage}
                  alt="Source"
                  className="w-16 h-16 rounded-lg object-cover border border-border/50"
                />
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-[50vh] text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mb-4">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-lg font-semibold text-foreground mb-2">
              Генератор изображений
            </h2>
            <p className="text-muted-foreground max-w-sm mb-4">
              Опишите, что хотите создать. Можно загрузить фото для редактирования.
            </p>
            {isLoading && (
              <div className="flex items-center gap-2 text-primary">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Генерация изображения...</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="flex-shrink-0 p-4 border-t border-border/50 bg-card/50">
        {/* Source image preview */}
        {sourceImage && (
          <div className="mb-3 flex items-center gap-2">
            <div className="relative">
              <img
                src={sourceImage}
                alt="Source"
                className="w-20 h-20 rounded-lg object-cover border border-border/50"
              />
              <button
                onClick={removeSourceImage}
                className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-md hover:bg-destructive/90"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <span className="text-sm text-muted-foreground">
              Изображение будет отредактировано
            </span>
          </div>
        )}

        <div className="flex gap-3">
          {/* Upload button */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            variant="outline"
            size="icon"
            className="h-[60px] w-[60px] shrink-0"
            disabled={isLoading}
          >
            <Upload className="w-5 h-5" />
          </Button>

          {/* Prompt input */}
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={sourceImage ? "Опишите, как изменить изображение..." : "Опишите, что хотите создать..."}
            className="min-h-[60px] max-h-[120px] resize-none"
            disabled={isLoading}
          />

          {/* Send button */}
          <Button
            onClick={generateImage}
            disabled={!prompt.trim() || isLoading}
            size="icon"
            className="h-[60px] w-[60px] shrink-0"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <ImageIcon className="w-5 h-5" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
