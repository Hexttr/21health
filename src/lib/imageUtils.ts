/** Сжатие для хранения в localStorage: 400px, quality 0.6, ~30–50KB */
export async function resizeForStorage(dataUrl: string): Promise<string> {
  return resizeImageForUpload(dataUrl, 400, 0.6);
}

/** Resize and compress image to avoid 413 / quota. Max 1024px, JPEG 0.82, target ~300KB */
export async function resizeImageForUpload(
  dataUrl: string,
  maxSize = 1024,
  quality = 0.82
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let w = img.width;
      let h = img.height;
      if (w > maxSize || h > maxSize) {
        if (w > h) {
          h = Math.round((h * maxSize) / w);
          w = maxSize;
        } else {
          w = Math.round((w * maxSize) / h);
          h = maxSize;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      try {
        const result = canvas.toDataURL('image/jpeg', quality);
        resolve(result);
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => reject(new Error('Не удалось загрузить изображение'));
    img.src = dataUrl;
  });
}
