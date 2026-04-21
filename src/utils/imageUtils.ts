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

// ═══════════════════════════════════════════════════════════════════
// NUEVAS FUNCIONES PARA DESCARGA INDIVIDUAL Y MASIVA (ZIP)
// ═══════════════════════════════════════════════════════════════════

/**
 * Descarga una única imagen (funciona con dataURLs y URLs HTTP/HTTPS).
 * Si es dataURL, usa el método tradicional de anchor.
 * Si es URL, usa fetch + blob para mejor control de nombre de archivo.
 */
export async function downloadImage(url: string, filename: string): Promise<void> {
  try {
    // Si es dataURL, podemos descargar directamente sin fetch
    if (url.startsWith('data:')) {
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    // Para URLs externas, usar fetch para obtener el blob y asignar nombre
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
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

  // Intentar importar dinámicamente JSZip
  let JSZip: any;
  try {
    JSZip = (await import('jszip')).default;
  } catch (importError) {
    console.warn(
      'JSZip no está instalado. Por favor, ejecuta: npm install jszip\n' +
      'Mientras tanto, se descargarán las imágenes individualmente.'
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

  const zip = new JSZip();
  const fetchPromises = images.map(async (url, idx) => {
    try {
      let blob: Blob;
      if (url.startsWith('data:')) {
        // Convertir dataURL a Blob
        const response = await fetch(url);
        blob = await response.blob();
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