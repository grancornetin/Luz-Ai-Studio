// src/services/generationCloudStorage.ts
// Infraestructura cloud del historial de generaciones: sube imágenes
// comprimidas a Firebase Storage y expone la colección Firestore
// users/{uid}/generations/{recordId}. Sin esto, la imagen nunca sale
// del navegador donde se generó (ver generationHistoryService.ts).

import { collection, doc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, listAll, deleteObject } from 'firebase/storage';
import { db, storage } from '../firebase';
import { compressImageForGallery, dataUrlToBlob } from '../utils/imageUtils';

export interface HistoryReference {
  label?: string;
  imageUrl?: string;
  mimeType?: string;
  role?: string;
}

export function generationsCol(uid: string) {
  return collection(db, 'users', uid, 'generations');
}

export function generationDoc(uid: string, id: string) {
  return doc(db, 'users', uid, 'generations', id);
}

function recordFolder(uid: string, recordId: string): string {
  return `users/${uid}/generations/${recordId}`;
}

// Sube un data: URL comprimido a Storage y devuelve su URL pública de descarga.
async function uploadDataUrl(uid: string, recordId: string, filename: string, dataUrl: string): Promise<string> {
  const compressed = await compressImageForGallery(dataUrl);
  const blob = dataUrlToBlob(compressed);
  const storageRef = ref(storage, `${recordFolder(uid, recordId)}/${filename}.jpg`);
  await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
  return getDownloadURL(storageRef);
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

// Borra todas las imágenes de un registro (main + referencias) del Storage.
export async function deleteRecordImages(uid: string, recordId: string): Promise<void> {
  try {
    const folderRef = ref(storage, recordFolder(uid, recordId));
    const { items } = await listAll(folderRef);
    await Promise.all(items.map(item => deleteObject(item).catch(() => {})));
  } catch {
    // La carpeta puede no existir (registro nunca migrado a Storage) — no es un error.
  }
}
