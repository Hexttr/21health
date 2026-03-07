import React, { useState, useEffect, useRef } from 'react';
import { api, getUploadUrl } from '@/api/client';
import { useAuth } from '@/contexts/AuthContext';
import { Play, Loader2, ExternalLink } from 'lucide-react';

interface PracticalMaterial {
  id: string;
  title: string;
  description: string | null;
  video_url: string;
  preview_url?: string | null;
}

export function PracticalMaterials() {
  const { isSessionReady } = useAuth();
  const [materials, setMaterials] = useState<PracticalMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMaterial, setSelectedMaterial] = useState<PracticalMaterial | null>(null);
  const [isPlayerVisible, setIsPlayerVisible] = useState(false);
  const [playerReadyToShow, setPlayerReadyToShow] = useState(false);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isSessionReady) return;
    loadMaterials();
  }, [isSessionReady]);

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  useEffect(() => {
    if (selectedMaterial !== null) {
      setPlayerReadyToShow(false);
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = requestAnimationFrame(() => {
          setPlayerReadyToShow(true);
          rafRef.current = null;
        });
      });
    } else {
      setPlayerReadyToShow(false);
    }
  }, [selectedMaterial]);

  const loadMaterials = async () => {
    try {
      const data = await api<Array<{ id: string; title: string; description: string | null; videoUrl: string; previewUrl?: string | null }>>('/materials');
      setMaterials((data || []).map(m => ({ ...m, video_url: m.videoUrl, preview_url: m.previewUrl })));
    } catch (error: unknown) {
      console.error('[PracticalMaterials] Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const getEmbedUrl = (url: string) => {
    const youtubeMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/);
    if (youtubeMatch) return `https://www.youtube.com/embed/${youtubeMatch[1]}`;
    const vimeoMatch = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
    return url;
  };

  const getPreviewUrl = (url: string): string | null => {
    const youtubeMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/);
    if (youtubeMatch) return `https://img.youtube.com/vi/${youtubeMatch[1]}/hqdefault.jpg`;
    return null;
  };

  const openPlayer = (material: PracticalMaterial) => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setSelectedMaterial(material);
    setIsPlayerVisible(true);
  };

  const closePlayer = () => {
    setIsPlayerVisible(false);
    closeTimeoutRef.current = setTimeout(() => {
      setSelectedMaterial(null);
      closeTimeoutRef.current = null;
    }, 380);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (materials.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
          <Play className="w-8 h-8 text-primary" />
        </div>
        <p className="text-foreground font-medium mb-1">Материалы скоро появятся</p>
        <p className="text-sm text-muted-foreground">Администратор добавит практические видео</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden">
        {/* Cards grid - animates out when player opens */}
        <div
          className={`grid gap-4 sm:grid-cols-2 lg:grid-cols-3 transition-[opacity,transform] duration-350 ease-smooth motion-reduce:duration-0 ${
            isPlayerVisible && selectedMaterial ? 'opacity-0 scale-[0.97] pointer-events-none absolute inset-0' : 'opacity-100 scale-100'
          }`}
          style={{ transformOrigin: 'center top' }}
        >
          {materials.map((material, index) => {
            const embedUrl = getEmbedUrl(material.video_url);
            const previewUrl = material.preview_url ? (material.preview_url.startsWith('http') ? material.preview_url : getUploadUrl(material.preview_url)) : getPreviewUrl(material.video_url);
            const isSelected = selectedMaterial?.id === material.id;
            return (
              <button
                key={material.id}
                type="button"
                onClick={() => embedUrl && (isSelected ? closePlayer() : openPlayer(material))}
                className={`group text-left rounded-2xl overflow-hidden transition-all focus-ring ${
                  isSelected ? 'ring-2 ring-primary shadow-lg' : 'shadow-soft hover:shadow-medium'
                }`}
              >
                <div className="aspect-video bg-muted relative overflow-hidden">
                  {previewUrl ? (
                    <img src={previewUrl} alt="" className="w-full h-full object-cover object-center" />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-secondary/50 to-muted" />
                  )}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-colors">
                    <div className="w-14 h-14 rounded-full bg-primary/90 flex items-center justify-center shadow-lg ring-2 ring-white/90 group-hover:scale-110 transition-transform opacity-90 group-hover:opacity-100">
                      <Play className="w-6 h-6 text-primary-foreground ml-1" fill="currentColor" />
                    </div>
                  </div>
                </div>
                <div className="p-3 sm:p-4 bg-card">
                  <p className="text-sm font-medium text-foreground line-clamp-2">{material.title}</p>
                  {embedUrl ? (
                    <span className="text-xs text-muted-foreground mt-1 block">Нажмите, чтобы смотреть</span>
                  ) : (
                    <a
                      href={material.video_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1.5 text-xs text-primary mt-1 hover:underline"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Открыть ссылку
                    </a>
                  )}
                </div>
              </button>
            );
          })}
        </div>
        {/* Player overlay - animates in when opened */}
        {selectedMaterial && (() => {
          const embedUrl = getEmbedUrl(selectedMaterial.video_url);
          if (!embedUrl) return null;
          return (
            <div
              className={`flex flex-col rounded-2xl overflow-hidden border-2 border-border bg-muted shadow-lg transition-[opacity,transform] duration-350 ease-smooth motion-reduce:duration-0 ${
                isPlayerVisible && playerReadyToShow
                  ? 'opacity-100 scale-100 relative'
                  : 'opacity-0 scale-[0.97] pointer-events-none absolute inset-0'
              }`}
              style={{ transformOrigin: 'center top' }}
            >
              <div className="flex items-center justify-between px-4 py-2.5 bg-secondary/50 border-b border-border/50 flex-shrink-0">
                <span className="font-medium text-sm text-foreground min-w-0 truncate pr-3">
                  {selectedMaterial.title}
                </span>
                <button
                  type="button"
                  onClick={closePlayer}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors flex-shrink-0"
                >
                  Назад
                </button>
              </div>
              <div className="flex-1 min-h-0 aspect-video">
                <iframe
                  src={embedUrl}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
