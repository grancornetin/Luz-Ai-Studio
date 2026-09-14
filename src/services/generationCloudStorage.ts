// src/services/generationCloudStorage.ts
// Infraestructura cloud del historial de generaciones: sube imágenes
// comprimidas a Cloudinary (plan gratuito) y expone la colección
// Firestore users/{uid}/generations/{recordId} — Firestore solo guarda
// metadata (incluida la URL de Cloudinary), nunca la imagen en sí.
// Sin esto, la imagen nunca sale del navegador donde se generó (ver
// generationHistoryService.ts).

import { collection, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { compressImageForGallery, dataUrlToBlob } from '../utils/imageUtils';

export interface HistoryReference {
  label?: string;
  imageUrl?: string;
  mimeType?: string;
  role?: string;
}

// Cuenta gratuita de Cloudinary dedicada a este proyecto — el upload
// preset está configurado como "unsigned" para poder subir directo
// desde el navegador sin exponer el API secret.
const CLOUDINARY_CLOUD_NAME = 'tge5qj6e';
const CLOUDINARY_UPLOAD_PRESET = 'luz_ia_studio';
const CLOUDINARY_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;

export function generationsCol(uid: string) {
  return collection(db, 'users', uid, 'generations');
}

export function generationDoc(uid: string, id: string) {
  return doc(db, 'users', uid, 'generations', id);
}

function recordFolder(uid: string, recordId: string): string {
  return `users/${uid}/generations/${recordId}`;
}

// Sube un data: URL comprimido a Cloudinary y devuelve su URL pública.
async function uploadDataUrl(uid: string, recordId: string, filename: string, dataUrl: string): Promise<string> {
  const compressed = await compressImageForGallery(dataUrl);
  const blob = dataUrlToBlob(compressed);

  const formData = new FormData();
  formData.append('file', blob, `${filename}.jpg`);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
  formData.append('public_id', `${recordFolder(uid, recordId)}/${filename}`);

  const res = await fetch(CLOUDINARY_UPLOAD_URL, { method: 'POST', body: formData });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Cloudinary upload failed: ${res.status} ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.secure_url as string;
}

// Sube la imagen principal de un registro. Si ya es una URL (no base64), la deja intacta.
export async function uploadRecordImage(uid: string, recordId: string, imageUrl: string): Promise<string> {
  if (!imageUrl || !imageUrl.startsWith('data:')) return imageUrl || '';
  return uploadDataUrl(uid, recordId, 'main', imageUrl);
}

// Sube las imágenes de referencia (inputs) de un registro. Referencias sin imageUrl
// base64 (ya son URL, o no tienen imagen) se devuelven sin tocar.
export async function uploadRecordReferences(
  uid: string,
  recordId: string,
  references: HistoryReference[] | undefined,
): Promise<HistoryReference[] | undefined> {
  if (!references?.length) return references;
  return Promise.all(
    references.map(async (ref_, index) => {
      if (!ref_.imageUrl || !ref_.imageUrl.startsWith('data:')) return ref_;
      try {
        const url = await uploadDataUrl(uid, recordId, `ref_${index}`, ref_.imageUrl);
        return { ...ref_, imageUrl: url };
      } catch {
        // Si falla la subida de una referencia puntual, se omite su imagen
        // en vez de abortar todo el guardado del registro.
        return { ...ref_, imageUrl: '' };
      }
    }),
  );
}

// Borra las imágenes de un registro en Cloudinary. La API de destroy
// requiere una petición firmada (con API secret) que no puede hacerse
// desde el navegador — el borrado real de los assets en Cloudinary queda
// pendiente de un endpoint de servidor; por ahora solo se borra la
// referencia en Firestore (deleteRemoteRecord en generationHistoryService),
// los archivos huérfanos en Cloudinary no cuentan para las cuotas de
// lectura que causaron el problema original.
export async function deleteRecordImages(_uid: string, _recordId: string): Promise<void> {
  // No-op intencional — ver comentario arriba.
}
