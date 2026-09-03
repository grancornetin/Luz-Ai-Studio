// src/utils/imageUtils.ts
// ═══════════════════════════════════════════════════════════════════
// UTILIDAD CENTRAL DE COMPRESIÓN DE IMÁGENES Y DESCARGA MASIVA
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
//
// NUEVO: Funciones para descarga individual y ZIP (descarga masiva)
// ═══════════════════════════════════════════════════════════════════

const MAX_WIDTH = 1024;
const JPEG_QUALITY = 0.82;

// Parámetros para galería pública — imágenes livianas para Storage
const GALLERY_MAX_WIDTH = 600;
const GALLERY_JPEG_QUALITY = 0.65;

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
 * Comprime una imagen para la galería pública.
 * Usa parámetros más agresivos (600px, 65%) porque en galería
 * las imágenes se ven pequeñas en pantalla. Reduce el peso en
 * Storage hasta 4x comparado con la compresión estándar.
 */
export async function compressImageForGallery(image: string): Promise<string> {
  return compressImageForUpload(image, GALLERY_MAX_WIDTH, GALLERY_JPEG_QUALITY);
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

// ═══════════════════════════════════════════════════════════════════
// NUEVAS FUNCIONES PARA DESCARGA INDIVIDUAL Y MASIVA (ZIP)
// ═══════════════════════════════════════════════════════════════════

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, b64] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)?.[1] ?? 'image/jpeg';
  const bytes = atob(b64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

async function urlToBlob(url: string): Promise<Blob> {
  if (url.startsWith('data:')) return dataUrlToBlob(url);

  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.blob();
}

function isAppleMobile(): boolean {
  const ua = navigator.userAgent || '';
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

async function tryNativeImageShare(blob: Blob, filename: string): Promise<boolean> {
  if (!navigator.share || typeof File === 'undefined') return false;

  const extension = blob.type.split('/')[1] || 'png';
  const safeFilename = filename.includes('.') ? filename : `${filename}.${extension}`;
  const file = new File([blob], safeFilename, { type: blob.type || 'image/png' });
  const shareData: ShareData = {
    files: [file],
    title: safeFilename,
  };

  if (navigator.canShare && !navigator.canShare(shareData)) return false;

  try {
    await navigator.share(shareData);
    return true;
  } catch (error: any) {
    if (error?.name === 'AbortError') return true;
    console.warn('No se pudo abrir el guardado nativo:', error);
    return false;
  }
}

/**
 * Descarga una única imagen (funciona con dataURLs y URLs HTTP/HTTPS).
 * En iPhone/iPad usa la hoja nativa de compartir cuando está disponible,
 * porque Safari guarda descargas en Archivos y no puede escribir directo en Fotos.
 */
export async function downloadImage(
  url: string,
  filename: string,
  options: { preferNativeShare?: boolean } = {},
): Promise<void> {
  try {
    const shouldShare = options.preferNativeShare ?? isAppleMobile();

    if (shouldShare) {
      const blob = await urlToBlob(url);
      const shared = await tryNativeImageShare(blob, filename);
      if (shared) return;

      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
      return;
    }

    const blob = await urlToBlob(url);
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(blobUrl);
  } catch (error) {
    console.error('Error descargando imagen:', error);
    // Fallback: abrir en nueva pestaña (último recurso)
    window.open(url, '_blank');
  }
}

/**
 * Descarga múltiples imágenes como un solo archivo ZIP.
 * Requiere la librería 'jszip' (instalar con npm install jszip).
 * Si no está instalada, muestra un error en consola y descarga cada imagen individualmente.
 *
 * @param images Array de URLs o dataURLs de imágenes
 * @param zipFilename Nombre del archivo ZIP resultante (ej: 'mis_imagenes.zip')
 * @param imageNamePrefix Prefijo para los nombres internos de las imágenes (ej: 'foto' → foto_1.jpg, foto_2.jpg)
 */
export async function downloadAsZip(
  images: string[],
  zipFilename: string = 'images.zip',
  imageNamePrefix: string = 'image'
): Promise<void> {
  if (!images.length) return;

  // Intentar importar dinámicamente JSZip. jszip SÍ está declarado como dependencia
  // real del proyecto (package.json) — el mensaje anterior de este catch ("JSZip no
  // está instalado") era engañoso: culpaba siempre a una dependencia faltante y
  // descartaba el error real (`importError` nunca se logueaba), aunque la causa más
  // probable en producción sea un fallo transitorio de red al cargar el chunk del
  // bundle (bug real reportado: el botón "Guardar como ZIP" descargaba archivos
  // sueltos sin avisar por qué). Un reintento cubre ese caso transitorio; si vuelve a
  // fallar, ahora sí queda el error real en consola para diagnosticar la causa.
  let JSZip: any;
  try {
    JSZip = (await import('jszip')).default;
  } catch (firstError) {
    console.warn('Primer intento de cargar JSZip falló, reintentando una vez:', firstError);
    try {
      JSZip = (await import('jszip')).default;
    } catch (importError) {
      console.error(
        'No se pudo cargar JSZip tras reintentar — se descargarán las imágenes individualmente. Error real:',
        importError
      );
      // Fallback: descargar una por una
      for (let i = 0; i < images.length; i++) {
        const ext = images[i].startsWith('data:')
          ? images[i].split(';')[0].split('/')[1] || 'jpg'
          : 'jpg';
        await downloadImage(images[i], `${imageNamePrefix}_${i + 1}.${ext}`);
      }
      return;
    }
  }

  const zip = new JSZip();
  const fetchPromises = images.map(async (url, idx) => {
    try {
      let blob: Blob;
      if (url.startsWith('data:')) {
        blob = dataUrlToBlob(url);
      } else {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        blob = await response.blob();
      }
      const ext = blob.type.split('/')[1] || 'jpg';
      zip.file(`${imageNamePrefix}_${idx + 1}.${ext}`, blob);
    } catch (error) {
      console.error(`Error al agregar imagen ${idx + 1} al ZIP:`, error);
    }
  });

  await Promise.all(fetchPromises);
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(zipBlob);
  link.download = zipFilename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}
