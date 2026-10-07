// src/services/userLibraryStore.ts
// Biblioteca personal en la nube: modelos (avatars), catálogo de productos y
// series de generación (sets). Antes vivían en localStorage del navegador
// (luz_avatars_{uid}, luz_products_{uid}, luz_sets_{uid}): se llenaba la cuota,
// los guardados fallaban en silencio y no se veían en otro dispositivo.
//
// Ahora:
//   - Firestore users/{uid}/{kind}/{id} guarda el ítem como JSON (campo `data`).
//     Nunca contiene base64: cualquier imagen `data:` se sube antes a Storage.
//   - Storage users/{uid}/{kind}/{id}/... guarda las imágenes.
//   - users/{uid}/meta/localMigration marca qué colecciones ya se migraron
//     desde el navegador. Mientras no esté marcada, la lectura mezcla los
//     ítems locales aún no subidos para que nada "desaparezca".
//   - La copia en localStorage se conserva como respaldo (no se borra al migrar).

import {
  collection, doc, getDoc, getDocs, setDoc, deleteDoc, serverTimestamp,
} from 'firebase/firestore';
import {
  ref as storageRef, uploadString, getDownloadURL, listAll, deleteObject,
} from 'firebase/storage';
import { db, storage } from '../firebase';

export type LibraryKind = 'avatars' | 'products' | 'sets';

// Firestore permite 1 MB por documento; dejamos margen.
const MAX_DOC_CHARS = 900_000;

// ── localStorage (formato antiguo) ────────────────────────────────────────────

function localKey(kind: LibraryKind, uid: string) {
  return `luz_${kind}_${uid}`;
}

function readLocal(kind: LibraryKind, uid: string): any[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(localKey(kind, uid)) || 'null');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Solo se usa para quitar un ítem que la usuaria borró a propósito; si no,
// el ítem volvería a aparecer (o a migrarse) desde la copia local.
function removeFromLocal(kind: LibraryKind, uid: string, id: string) {
  try {
    const items = readLocal(kind, uid);
    if (!items.some(i => i?.id === id)) return;
    localStorage.setItem(localKey(kind, uid), JSON.stringify(items.filter(i => i?.id !== id)));
  } catch (e) {
    console.warn(`[library] No se pudo actualizar la copia local de ${kind}:`, e);
  }
}

// ── Imágenes: data: URL → Storage ─────────────────────────────────────────────

function itemFolder(uid: string, kind: LibraryKind, id: string) {
  return `users/${uid}/${kind}/${id}`;
}

function isDataUrl(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('data:') && value.includes(';base64,');
}

// Hash corto del contenido: mismo contenido → mismo archivo (re-guardar no duplica)
// y contenido distinto → archivo distinto (no rompe URLs ya entregadas).
function shortHash(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

function extensionFor(dataUrl: string): string {
  const mime = dataUrl.slice(5, dataUrl.indexOf(';')).toLowerCase();
  if (mime.includes('png')) return 'png';
  if (mime.includes('webp')) return 'webp';
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';
  if (mime.includes('gif')) return 'gif';
  return 'bin';
}

async function uploadDataUrl(folder: string, name: string, dataUrl: string): Promise<string> {
  const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80) || 'img';
  const path = `${folder}/${safeName}_${shortHash(dataUrl)}.${extensionFor(dataUrl)}`;
  const fileRef = storageRef(storage, path);
  await uploadString(fileRef, dataUrl, 'data_url');
  return getDownloadURL(fileRef);
}

// Recorre el ítem completo (las formas varían por módulo) y reemplaza cada
// string `data:` por la URL de Storage. Las URLs http(s) quedan igual.
// Si una subida falla, se lanza el error: el guardado no debe fingir éxito.
async function replaceDataUrls(value: any, folder: string, path: string): Promise<any> {
  if (isDataUrl(value)) return uploadDataUrl(folder, path, value);
  if (Array.isArray(value)) {
    return Promise.all(value.map((v, i) => replaceDataUrls(v, folder, `${path}_${i}`)));
  }
  if (value && typeof value === 'object') {
    const entries = await Promise.all(
      Object.entries(value).map(async ([k, v]) => [k, await replaceDataUrls(v, folder, path ? `${path}_${k}` : k)] as const),
    );
    return Object.fromEntries(entries);
  }
  return value;
}

// ── Migración (flag por colección) ────────────────────────────────────────────

type MigrationFlags = Partial<Record<LibraryKind, boolean>>;

function migrationDoc(uid: string) {
  return doc(db, 'users', uid, 'meta', 'localMigration');
}

// Cache en memoria del flag para no leerlo en cada llamada.
const flagCache = new Map<string, Promise<MigrationFlags>>();
// Evita lanzar la misma migración dos veces en paralelo.
const migrating = new Set<string>();

function getFlags(uid: string): Promise<MigrationFlags> {
  let p = flagCache.get(uid);
  if (!p) {
    p = getDoc(migrationDoc(uid))
      .then(snap => (snap.exists() ? (snap.data() as MigrationFlags) : {}))
      .catch(e => {
        flagCache.delete(uid); // reintentar la próxima vez
        console.warn('[library] No se pudo leer el estado de migración:', e);
        return {};
      });
    flagCache.set(uid, p);
  }
  return p;
}

async function markMigrated(uid: string, kind: LibraryKind) {
  await setDoc(migrationDoc(uid), { [kind]: true, [`${kind}At`]: serverTimestamp() }, { merge: true });
  const current = await getFlags(uid);
  flagCache.set(uid, Promise.resolve({ ...current, [kind]: true }));
}

// Sube uno a uno los ítems locales que aún no están en Firestore.
// Si alguno falla, el flag no se marca y se reintenta en la próxima carga.
async function migrateLocal(uid: string, kind: LibraryKind, pending: any[]) {
  const key = `${uid}:${kind}`;
  if (migrating.has(key)) return;
  migrating.add(key);
  let failures = 0;
  try {
    for (const item of pending) {
      // Si la usuaria lo borró mientras tanto, no lo resucitamos.
      if (!readLocal(kind, uid).some(i => i?.id === item.id)) continue;
      try {
        await saveItem(uid, kind, item);
      } catch (e) {
        failures++;
        console.warn(`[library] No se pudo migrar ${kind}/${item.id} (se reintenta en la próxima carga):`, e);
      }
    }
    if (failures === 0) {
      await markMigrated(uid, kind);
      console.warn(`[library] Migración de ${kind} completada (${pending.length} ítems). La copia local queda como respaldo.`);
    }
  } catch (e) {
    console.warn(`[library] Migración de ${kind} interrumpida:`, e);
  } finally {
    migrating.delete(key);
  }
}

// ── API pública ───────────────────────────────────────────────────────────────

function byCreatedAt(a: any, b: any) {
  return (Number(a?.createdAt) || 0) - (Number(b?.createdAt) || 0);
}

async function readRemote(uid: string, kind: LibraryKind): Promise<any[]> {
  const snap = await getDocs(collection(db, 'users', uid, kind));
  const items: any[] = [];
  snap.forEach(d => {
    try {
      items.push(JSON.parse(d.data().data));
    } catch (e) {
      console.warn(`[library] Documento ${kind}/${d.id} ilegible, se omite:`, e);
    }
  });
  return items;
}

export async function getItems(uid: string, kind: LibraryKind): Promise<any[]> {
  let remote: any[];
  try {
    remote = await readRemote(uid, kind);
  } catch (e) {
    // Sin conexión o error de Firestore: mostramos lo que haya en el navegador.
    console.warn(`[library] No se pudo leer ${kind} desde la nube, usando copia local:`, e);
    return readLocal(kind, uid).sort(byCreatedAt);
  }

  const flags = await getFlags(uid);
  if (flags[kind]) return remote.sort(byCreatedAt);

  const remoteIds = new Set(remote.map(i => i?.id));
  const pending = readLocal(kind, uid).filter(i => i?.id && !remoteIds.has(i.id));

  if (pending.length === 0) {
    markMigrated(uid, kind).catch(e => console.warn('[library] No se pudo marcar la migración:', e));
    return remote.sort(byCreatedAt);
  }

  // Migración en segundo plano; mientras tanto se muestran también los locales.
  migrateLocal(uid, kind, pending);
  return [...remote, ...pending].sort(byCreatedAt);
}

export async function saveItem(uid: string, kind: LibraryKind, item: any): Promise<void> {
  if (!item?.id) throw new Error(`No se puede guardar en ${kind}: falta el id.`);
  const id = String(item.id);
  const clean = await replaceDataUrls(item, itemFolder(uid, kind, id), '');
  const data = JSON.stringify(clean);
  if (data.length > MAX_DOC_CHARS) {
    throw new Error(`El elemento ${kind}/${id} es demasiado grande para guardarse (${data.length} caracteres).`);
  }
  await setDoc(doc(db, 'users', uid, kind, id), {
    id,
    createdAt: Number(item.createdAt) || Date.now(),
    updatedAt: serverTimestamp(),
    data,
  });
}

export async function deleteItem(uid: string, kind: LibraryKind, id: string): Promise<void> {
  await deleteDoc(doc(db, 'users', uid, kind, id));
  removeFromLocal(kind, uid, id);

  // Borrado de imágenes: best-effort, no bloquea ni falla el borrado.
  try {
    const listing = await listAll(storageRef(storage, itemFolder(uid, kind, id)));
    await Promise.all(listing.items.map(f => deleteObject(f).catch(() => {})));
  } catch (e) {
    console.warn(`[library] No se pudieron borrar las imágenes de ${kind}/${id}:`, e);
  }
}
