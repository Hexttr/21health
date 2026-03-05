import React, { useState, useEffect } from 'react';
import { api } from '@/api/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Play, Loader2 } from 'lucide-react';

interface PracticalMaterial {
  id: string;
  title: string;
  description: string | null;
  video_url: string;
}

export function PracticalMaterials() {
  const { isSessionReady } = useAuth();
  const [materials, setMaterials] = useState<PracticalMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMaterial, setSelectedMaterial] = useState<PracticalMaterial | null>(null);

  // Load only when session is ready (no delay needed - initialize() handles it)
  useEffect(() => {
    if (!isSessionReady) {
      console.log('[PracticalMaterials] Waiting for session to be ready...');
      return;
    }
    
    console.log('[PracticalMaterials] Session ready, loading materials');
    loadMaterials();
  }, [isSessionReady]);

  const loadMaterials = async () => {
    console.log('[PracticalMaterials] Loading materials...');
    try {
      const data = await api<Array<{ id: string; title: string; description: string | null; videoUrl: string }>>('/materials');
      console.log('[PracticalMaterials] Loaded:', data?.length || 0, 'materials');
      setMaterials((data || []).map(m => ({ ...m, video_url: m.videoUrl })));
    } catch (error: unknown) {
      console.error('[PracticalMaterials] Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const getEmbedUrl = (url: string) => {
    // YouTube
    const youtubeMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/);
    if (youtubeMatch) {
      return `https://www.youtube.com/embed/${youtubeMatch[1]}`;
    }
    // Vimeo
    const vimeoMatch = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    if (vimeoMatch) {
      return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
    }
    // Return as-is for other URLs
    return url;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (materials.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Практические материалы скоро появятся</p>
      </div>
    );
  }

  if (selectedMaterial) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setSelectedMaterial(null)}
          className="text-sm text-primary hover:underline flex items-center gap-1"
        >
          ← Назад к списку
        </button>
        
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">{selectedMaterial.title}</CardTitle>
            {selectedMaterial.description && (
              <p className="text-muted-foreground">{selectedMaterial.description}</p>
            )}
          </CardHeader>
          <CardContent>
            <div className="relative aspect-video rounded-lg overflow-hidden bg-muted">
              <iframe
                src={getEmbedUrl(selectedMaterial.video_url)}
                className="absolute inset-0 w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {materials.map((material) => (
        <Card
          key={material.id}
          className="cursor-pointer hover:shadow-medium transition-all duration-300 hover:scale-[1.02] group"
          onClick={() => setSelectedMaterial(material)}
        >
          <CardContent className="p-5">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                <Play className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-foreground mb-1 truncate">
                  {material.title}
                </h3>
                {material.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {material.description}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
