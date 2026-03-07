import React, { useMemo, useRef, useState } from 'react';
import { FileText, Loader2, Paperclip, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { apiUpload } from '@/api/client';

const IMAGE_ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif'];
const DOCUMENT_ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.xls', '.xlsx', '.csv', '.pptx', '.txt', '.md', '.json'];
const DOCUMENT_ACCEPT = DOCUMENT_ALLOWED_EXTENSIONS.join(',');

export type ChatAttachment = {
  id: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  status: 'ready' | 'failed';
  extractedPreview: string | null;
  pageCount: number | null;
  sheetCount: number | null;
  slideCount: number | null;
  expiresAt: string;
  createdAt: string;
};

type ChatAttachmentPanelProps = {
  images: string[];
  onImagesChange: (images: string[]) => void;
  attachments: ChatAttachment[];
  onAttachmentsChange: (attachments: ChatAttachment[]) => void;
  canAttachImages: boolean;
  canAttachDocuments: boolean;
  disabled?: boolean;
  className?: string;
  footer?: React.ReactNode;
  children: (controls: { openFilePicker: () => void; isUploadingDocuments: boolean }) => React.ReactNode;
};

function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (bytes >= 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${bytes} B`;
}

function getExtension(filename: string): string {
  const parts = filename.toLowerCase().split('.');
  return parts.length > 1 ? `.${parts.pop()}` : '';
}

export function ChatAttachmentPanel({
  images,
  onImagesChange,
  attachments,
  onAttachmentsChange,
  canAttachImages,
  canAttachDocuments,
  disabled = false,
  className,
  footer,
  children,
}: ChatAttachmentPanelProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadingDocuments, setUploadingDocuments] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const accept = useMemo(() => {
    const values: string[] = [];
    if (canAttachImages) values.push(...IMAGE_ALLOWED_TYPES);
    if (canAttachDocuments) values.push(DOCUMENT_ACCEPT);
    return values.join(',');
  }, [canAttachDocuments, canAttachImages]);

  const readImages = async (files: File[]) => {
    const remaining = 14 - images.length;
    if (remaining <= 0) {
      toast.error('Максимум 14 изображений');
      return;
    }

    const selected: File[] = [];
    for (const file of files.slice(0, remaining)) {
      if (!file.type.startsWith('image/')) continue;
      if (!IMAGE_ALLOWED_TYPES.includes(file.type)) {
        toast.error(`Формат изображения не поддерживается: ${file.name}`);
        continue;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name} слишком большой (максимум 10 MB)`);
        continue;
      }
      selected.push(file);
    }

    if (selected.length === 0) return;

    const urls = await Promise.all(selected.map((file) => new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    }))).catch(() => {
      toast.error('Не удалось прочитать изображение');
      return null;
    });

    if (!urls) return;
    onImagesChange([...images, ...urls].slice(0, 14));
  };

  const uploadDocuments = async (files: File[]) => {
    const remaining = 5 - attachments.length;
    if (remaining <= 0) {
      toast.error('Максимум 5 документов');
      return;
    }

    const selected = files
      .filter((file) => !file.type.startsWith('image/'))
      .slice(0, remaining);
    let currentAttachments = attachments;

    for (const file of selected) {
      const extension = getExtension(file.name);
      if (!DOCUMENT_ALLOWED_EXTENSIONS.includes(extension)) {
        toast.error(`Формат документа не поддерживается: ${file.name}`);
        continue;
      }
      if (file.size > 25 * 1024 * 1024) {
        toast.error(`${file.name} слишком большой (максимум 25 MB)`);
        continue;
      }

      setUploadingDocuments((prev) => [...prev, file.name]);
      try {
        const formData = new FormData();
        formData.append('file', file);
        const response = await apiUpload('/ai/attachments', formData) as { attachment: ChatAttachment };
        currentAttachments = [...currentAttachments, response.attachment];
        onAttachmentsChange(currentAttachments);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : `Не удалось загрузить ${file.name}`);
      } finally {
        setUploadingDocuments((prev) => prev.filter((item) => item !== file.name));
      }
    }
  };

  const processFiles = async (files: File[]) => {
    if (!files.length || disabled) return;

    const imageFiles = files.filter((file) => file.type.startsWith('image/'));
    const documentFiles = files.filter((file) => !file.type.startsWith('image/'));

    if (imageFiles.length > 0 && !canAttachImages) {
      toast.error('Текущая модель не поддерживает изображения');
    }
    if (documentFiles.length > 0 && !canAttachDocuments) {
      toast.error('Текущая модель не поддерживает документы');
    }

    if (canAttachImages && imageFiles.length > 0) {
      await readImages(imageFiles);
    }
    if (canAttachDocuments && documentFiles.length > 0) {
      await uploadDocuments(documentFiles);
    }
  };

  const removeImage = (index: number) => {
    onImagesChange(images.filter((_, currentIndex) => currentIndex !== index));
  };

  const removeAttachment = (id: string) => {
    onAttachmentsChange(attachments.filter((attachment) => attachment.id !== id));
  };

  const clearAll = () => {
    onImagesChange([]);
    onAttachmentsChange([]);
    if (inputRef.current) inputRef.current.value = '';
  };

  const hasAnyAttachments = images.length > 0 || attachments.length > 0 || uploadingDocuments.length > 0;

  return (
    <div
      className={`flex-shrink-0 rounded-[24px] border p-4 transition-colors ${
        isDragOver ? 'border-primary bg-primary/5' : 'border-border/60 bg-background/95'
      } ${className || ''}`}
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled && (canAttachImages || canAttachDocuments)) {
          setIsDragOver(true);
        }
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setIsDragOver(false);
        }
      }}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragOver(false);
        void processFiles(Array.from(event.dataTransfer.files || []));
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple
        onChange={(event) => {
          const files = event.target.files;
          if (files?.length) {
            void processFiles(Array.from(files));
          }
          event.target.value = '';
        }}
        className="hidden"
      />

      {hasAnyAttachments && (
        <div className="mb-3 space-y-3 rounded-2xl border border-border/50 bg-secondary/25 p-3">
          {images.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {images.map((url, index) => (
                <div key={`${url}-${index}`} className="relative">
                  <img src={url} alt="" className="w-14 h-14 rounded-lg object-cover border border-border/50" />
                  <button
                    type="button"
                    onClick={() => removeImage(index)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-md hover:bg-destructive/90"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {(attachments.length > 0 || uploadingDocuments.length > 0) && (
            <div className="flex flex-wrap gap-2">
              {attachments.map((attachment) => (
                <div
                  key={attachment.id}
                  className="inline-flex max-w-full items-start gap-2 rounded-xl border border-border/60 bg-background px-3 py-2 text-left shadow-sm"
                >
                  <FileText className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-foreground">{attachment.originalName}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatFileSize(attachment.fileSize)}
                      {attachment.pageCount ? ` · ${attachment.pageCount} стр.` : ''}
                      {attachment.sheetCount ? ` · ${attachment.sheetCount} лист.` : ''}
                      {attachment.slideCount ? ` · ${attachment.slideCount} слайд.` : ''}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeAttachment(attachment.id)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}

              {uploadingDocuments.map((name) => (
                <div
                  key={name}
                  className="inline-flex max-w-full items-center gap-2 rounded-xl border border-border/60 bg-background px-3 py-2 text-left shadow-sm"
                >
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-foreground">{name}</div>
                    <div className="text-xs text-muted-foreground">Извлекаем текст...</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {children({
        openFilePicker: () => inputRef.current?.click(),
        isUploadingDocuments: uploadingDocuments.length > 0,
      })}

      {footer}

      {isDragOver && (
        <div className="mt-3 rounded-xl border border-dashed border-primary/40 bg-primary/5 px-4 py-3 text-sm text-primary">
          Перетащите изображения или документы сюда, чтобы добавить их к запросу.
        </div>
      )}

      {hasAnyAttachments && (
        <div className="mt-3 flex justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clearAll}
            className="text-xs text-muted-foreground hover:text-destructive"
            disabled={disabled || uploadingDocuments.length > 0}
          >
            <Paperclip className="w-3.5 h-3.5 mr-1" />
            Очистить вложения
          </Button>
        </div>
      )}
    </div>
  );
}
