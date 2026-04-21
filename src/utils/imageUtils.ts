// src/utils/imageUtils.ts
// ═══════════════════════════════════════════════════════════════════
// UTILIDAD CENTRAL DE COMPRESIÓN DE IMÁGENES
//
// Problema resuelto: el límite de payload del servidor es 1MB.
// En móvil las fotos de cámara pesan 3-8MB, haciendo que el JSON
// supere el límite y devuelva: "quota maxMessageSize exceeded".
//
// Solución: comprimir TODAS las imágenes antes de guardarlas en
// estado o enviarlas a la API, en todos los módulos de la app.
//
// Parámetros conservadores para mantener calidad visual:
//   maxWidth: 1024px  — suficiente para análisis de IA
//   quality:  0.82    — balance calidad/tamaño (JPEG)
//
// Si la imagen ya es pequeña, se devuelve sin cambios (no re-comprime).
// ═══════════════════════════════════════════════════════════════════

const MAX_WIDTH = 1024;
const JPEG_QUALITY = 0.82;

/**
 * Comprime una imagen (data URL o base64 puro) usando Canvas.
 * - Redimensiona si el ancho supera MAX_WIDTH (mantiene proporción).
 * - Re-codifica como JPEG con JPEG_QUALITY.
 * - Si la imagen ya es pequeña, la devuelve sin modificar.
 * - Si falla la compresión, devuelve la imagen original (nunca lanza).
 */
export async function compressImageForUpload(
  image: string,
  maxWidth: number = MAX_WIDTH,
  quality: number = JPEG_QUALITY
): Promise<string> {
  if (!image || image.length < 100) return image;

  return new Promise((resolve) => {
    const img = new window.Image();

    img.onload = () => {
      try {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        // Si ya es pequeña, no recomprimir
        if (width <= maxWidth && image.length < 300_000) {
          resolve(image);
          return;
        }

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(image); return; }

        ctx.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL('image/jpeg', quality);

        // Solo usar la versión comprimida si realmente es más pequeña
        resolve(compressed.length < image.length ? compressed : image);
      } catch {
        resolve(image); // fallback seguro
      }
    };

    img.onerror = () => resolve(image); // fallback seguro

    // Soporta tanto data URL completo como base64 puro
    if (image.startsWith('data:')) {
      img.src = image;
    } else {
      img.src = `data:image/jpeg;base64,${image}`;
    }
  });
}

/**
 * Lee un File del sistema y lo comprime en un solo paso.
 * Reemplaza el patrón FileReader + readAsDataURL en toda la app.
 */
export async function readAndCompressFile(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Error leyendo archivo'));
    reader.readAsDataURL(file);
  });
  return compressImageForUpload(dataUrl);
}
