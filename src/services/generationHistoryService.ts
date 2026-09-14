// src/services/generationHistoryService.ts
// Historial de generaciones con doble guardado:
// 1) IndexedDB local por usuario: aislada por uid, se borra al logout.
// 2) Firestore + Storage: sincronizacion remota cuando el usuario esta autenticado,
//    para que el historial (con imagenes) este disponible en cualquier dispositivo.

import { getAuth } from 'firebase/auth';
import { doc, getDocs, getDoc, setDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { checkFirstGeneration } from './missionsService';
import { rewardReferrer } from './referralService';
import {
  generationsCol,
  generationDoc,
  uploadRecordImage,
  uploadRecordReferences,
  deleteRecordImages,
} from './generationCloudStorage';

export interface HistoryReference {
  label?: string;
  imageUrl?: string;
  mimeType?: string;
  role?: string;
}

export interface GenerationRecord {
  id:           string;
  imageUrl:     string;
  imageKey?:     string;
  module:       string;
  moduleLabel:  string;
  promptText?:  string;
  creditsUsed:  number;
  createdAt:    string;
  metadata?:    Record<string, any>;
  config?:      Record<string, any>;
  references?:  HistoryReference[];
  source?:      'client' | 'worker' | 'manual' | 'imported';
  syncedAt?:    string;
}

export const MODULE_LABELS: Record<string, string> = {
  prompt_studio:      'AI Generator',
  scene_clone:        'Recrear una foto',
  cloneImageService:  'Recrear una foto',
  model_dna:          'Model DNA · From Photos',
  model_dna_manual:   'Model DNA · From Scratch',
  content_studio:     'Content Studio',
  content_studio_pro: 'Content Studio',
  outfit_extractor:   'Outfit Kit',
  outfit_kit:         'Outfit Kit',
  catalog:            'Catalogo',
  product:            'Catalogo',
  campaign:           'Campaign',
  photodump:          'Photodump',
};

const STORE_NAME = 'records';
const DB_VERSION = 1;
const LOCAL_MAX_ENTRIES = 200;
const HISTORY_MAX_ENTRIES = 400;
const MIGRATION_CONCURRENCY = 2;
// Tope de registros que se migran por sesión/pestaña abierta — evita que un
// historial local viejo con cientos de registros se suba entero de golpe
// (esto agotó la cuota diaria de Firestore en un solo día de pruebas). El
// resto sigue migrando en las siguientes sesiones, unos pocos por vez.
const MIGRATION_BATCH_PER_SESSION = 20;
// Pausa entre cada subida — reparte la carga en el tiempo en vez de
// disparar todas las escrituras/uploads en el mismo instante.
const MIGRATION_DELAY_MS = 400;
const LEGACY_LS_KEY = 'luz_generation_history';

// ── IndexedDB por usuario ─────────────────────────────────────────────────────

function dbName(uid: string): string {
  return `luz_history_${uid}`;
}

function canUseBrowserStorage(): boolean {
  return typeof window !== 'undefined' && typeof indexedDB !== 'undefined';
}

function getUid(): string {
  try {
    const user = getAuth().currentUser;
    if (user?.uid) return user.uid;
  } catch { /* ignore */ }
  return '';
}

// Abre (o crea) la IndexedDB del usuario activo.
function openHistoryDb(uid: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!canUseBrowserStorage()) {
      reject(new Error('IndexedDB no disponible'));
      return;
    }

    const request = indexedDB.open(dbName(uid), DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt', { unique: false });
        store.createIndex('imageKey', 'imageKey', { unique: false });
      }
    };
  });
}

async function withStore<T>(
  uid: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T | void> {
  const db = await openHistoryDb(uid);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);
    let request: IDBRequest<T> | void;

    tx.oncomplete = () => {
      db.close();
      if (!request) resolve();
    };
    tx.onerror = () => {
      const err = tx.error;
      db.close();
      reject(err);
    };

    request = fn(store);
    if (request) {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    }
  });
}

// ── CRUD local ────────────────────────────────────────────────────────────────

async function getLocalRecords(uid: string): Promise<GenerationRecord[]> {
  try {
    const records = await withStore<GenerationRecord[]>(uid, 'readonly', store => store.getAll());
    return (Array.isArray(records) ? records : [])
      .map(normalizeRecord)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch {
    return loadLegacyLocalStorage();
  }
}

async function putLocalRecord(uid: string, record: GenerationRecord): Promise<void> {
  const normalized = normalizeRecord(record);
  try {
    const all = await getLocalRecords(uid);
    const duplicate = all.find(r => r.id === normalized.id || r.imageKey === normalized.imageKey);
    const merged = mergeRecord(duplicate, normalized);
    await withStore(uid, 'readwrite', store => {
      if (duplicate && duplicate.id !== merged.id) store.delete(duplicate.id);
      store.put(merged);
    });
    await trimLocalHistory(uid);
  } catch (err) {
    saveLegacyLocalStorage(normalized);
    throw err;
  }
}

async function trimLocalHistory(uid: string): Promise<void> {
  const records = await getLocalRecords(uid);
  const extra = records.slice(LOCAL_MAX_ENTRIES);
  if (!extra.length) return;
  await withStore(uid, 'readwrite', store => {
    extra.forEach(record => store.delete(record.id));
  });
}

async function deleteLocalRecord(uid: string, id: string): Promise<void> {
  try {
    await withStore(uid, 'readwrite', store => { store.delete(id); });
  } catch {
    const updated = loadLegacyLocalStorage().filter(r => r.id !== id);
    localStorage.setItem(LEGACY_LS_KEY, JSON.stringify(updated));
  }
}

// Borra toda la IndexedDB del usuario (usado en logout).
function deleteUserDb(uid: string): Promise<void> {
  return new Promise((resolve) => {
    if (!canUseBrowserStorage()) { resolve(); return; }
    const req = indexedDB.deleteDatabase(dbName(uid));
    req.onsuccess = () => resolve();
    req.onerror   = () => resolve(); // fallo silencioso — no bloquear logout
    req.onblocked = () => resolve();
  });
}

// ── Legacy localStorage ───────────────────────────────────────────────────────

async function migrateLegacyLocalStorage(uid: string): Promise<void> {
  const legacy = loadLegacyLocalStorage();
  if (!legacy.length || !canUseBrowserStorage()) return;
  try {
    for (const record of legacy) await putLocalRecord(uid, record);
    localStorage.removeItem(LEGACY_LS_KEY);
  } catch { /* keep legacy copy if migration fails */ }
}

function loadLegacyLocalStorage(): GenerationRecord[] {
  try {
    const raw = localStorage.getItem(LEGACY_LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(normalizeRecord) : [];
  } catch { return []; }
}

function saveLegacyLocalStorage(record: GenerationRecord): void {
  try {
    const existing = loadLegacyLocalStorage();
    const normalized = normalizeRecord(record);
    const withoutDuplicate = existing.filter(r => r.id !== normalized.id && r.imageKey !== normalized.imageKey);
    localStorage.setItem(
      LEGACY_LS_KEY,
      JSON.stringify([normalized, ...withoutDuplicate].slice(0, 25)),
    );
  } catch { /* localStorage may be full; remote sync can still work */ }
}

// ── Helpers de datos ─────────────────────────────────────────────────────────

function imageFingerprint(imageUrl: string): string {
  const raw = (imageUrl || '').trim();
  if (!raw) return `empty_${Date.now()}`;
  if (raw.startsWith('data:')) {
    return `data:${raw.length}:${raw.slice(0, 96)}:${raw.slice(-96)}`;
  }
  return raw;
}

function normalizeRecord(record: GenerationRecord): GenerationRecord {
  const moduleLabel = record.moduleLabel || MODULE_LABELS[record.module] || record.module || 'Generacion';
  return {
    ...record,
    module: record.module || 'unknown',
    moduleLabel,
    imageKey: record.imageKey || imageFingerprint(record.imageUrl),
    creditsUsed: Number(record.creditsUsed || 0),
    createdAt: record.createdAt || new Date().toISOString(),
  };
}

function mergeRecord(oldRecord: GenerationRecord | undefined, nextRecord: GenerationRecord): GenerationRecord {
  if (!oldRecord) return nextRecord;
  return normalizeRecord({
    ...oldRecord,
    ...nextRecord,
    id: oldRecord.id || nextRecord.id,
    imageUrl: nextRecord.imageUrl || oldRecord.imageUrl,
    imageKey: oldRecord.imageKey || nextRecord.imageKey,
    createdAt: oldRecord.createdAt || nextRecord.createdAt,
    promptText: nextRecord.promptText || oldRecord.promptText,
    metadata: { ...(oldRecord.metadata || {}), ...(nextRecord.metadata || {}) },
    config: { ...(oldRecord.config || {}), ...(nextRecord.config || {}) },
    references: nextRecord.references?.length ? nextRecord.references : oldRecord.references,
    creditsUsed: Math.max(oldRecord.creditsUsed || 0, nextRecord.creditsUsed || 0),
  });
}

function mergeRecords(primary: GenerationRecord[], secondary: GenerationRecord[]): GenerationRecord[] {
  const map = new Map<string, GenerationRecord>();
  [...secondary, ...primary].forEach(record => {
    const normalized = normalizeRecord(record);
    const key = normalized.imageKey || normalized.id;
    map.set(key, mergeRecord(map.get(key), normalized));
  });
  return Array.from(map.values())
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

// ── Firestore remoto ──────────────────────────────────────────────────────────

async function fetchRemoteRecords(uid: string): Promise<GenerationRecord[]> {
  const snap = await getDocs(query(generationsCol(uid), orderBy('createdAt', 'desc')));
  return snap.docs.map(d => normalizeRecord(d.data() as GenerationRecord));
}

async function saveRemoteRecord(uid: string, record: GenerationRecord): Promise<GenerationRecord> {
  const imageUrl = await uploadRecordImage(uid, record.id, record.imageUrl);
  const references = await uploadRecordReferences(uid, record.id, record.references);
  const remoteRecord: GenerationRecord = { ...record, imageUrl, references };
  await setDoc(generationDoc(uid, record.id), remoteRecord);
  return remoteRecord;
}

async function deleteRemoteRecord(uid: string, id: string): Promise<void> {
  await deleteRecordImages(uid, id);
  await deleteDoc(generationDoc(uid, id)).catch(() => {});
}

// Aplica el tope de historial: borra (Storage + Firestore + local) los registros
// más viejos que excedan HISTORY_MAX_ENTRIES. Corre en background, sin bloquear al usuario.
async function enforceHistoryLimit(uid: string): Promise<void> {
  try {
    const remote = await fetchRemoteRecords(uid);
    const extra = remote.slice(HISTORY_MAX_ENTRIES);
    if (!extra.length) return;
    for (const record of extra) {
      await deleteRemoteRecord(uid, record.id);
      await deleteLocalRecord(uid, record.id);
    }
  } catch (err) {
    console.warn('[History] No se pudo aplicar el limite de historial.', err);
  }
}

// ── Migración de historial local viejo (base64 sin subir) hacia Storage+Firestore ──

function migrationFlagDoc(uid: string) {
  return doc(db, 'users', uid, 'meta', 'historyMigration');
}

async function getMigratedIds(uid: string): Promise<Set<string>> {
  try {
    const snap = await getDoc(migrationFlagDoc(uid));
    const data = snap.data() as { migratedIds?: string[] } | undefined;
    return new Set(data?.migratedIds || []);
  } catch {
    return new Set();
  }
}

async function markMigrated(uid: string, migratedIds: Set<string>): Promise<void> {
  try {
    await setDoc(migrationFlagDoc(uid), {
      migratedIds: Array.from(migratedIds),
      lastAttemptAt: new Date().toISOString(),
    });
  } catch { /* no bloquea la migración en curso */ }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Sube en background los registros locales que todavía no llegaron a la nube
// (sin syncedAt, o con imageUrl aun en base64). No bloquea al llamador.
// Migra de a lotes chicos (MIGRATION_BATCH_PER_SESSION) con pausa entre cada
// subida — un historial viejo con cientos de registros se termina de subir
// en varias sesiones en vez de disparar todo de una vez.
async function migrateLocalToCloud(uid: string): Promise<void> {
  try {
    const local = await getLocalRecords(uid);
    const migratedIds = await getMigratedIds(uid);
    const pending = local
      .filter(r => !migratedIds.has(r.id) && (!r.syncedAt || r.imageUrl?.startsWith('data:')))
      .slice(0, MIGRATION_BATCH_PER_SESSION);
    if (!pending.length) return;

    let cursor = 0;
    async function worker() {
      while (cursor < pending.length) {
        const record = pending[cursor++];
        try {
          const remoteRecord = await saveRemoteRecord(uid, record);
          await putLocalRecord(uid, { ...remoteRecord, syncedAt: new Date().toISOString() }).catch(() => {});
          migratedIds.add(record.id);
        } catch (err) {
          console.warn('[History] Migracion de registro fallida, se reintentara despues.', record.id, err);
        }
        await sleep(MIGRATION_DELAY_MS);
      }
    }
    await Promise.all(Array.from({ length: MIGRATION_CONCURRENCY }, worker));
    await markMigrated(uid, migratedIds);
    await enforceHistoryLimit(uid);
  } catch (err) {
    console.warn('[History] Migracion de historial local fallida.', err);
  }
}

// ── API pública ───────────────────────────────────────────────────────────────

export const generationHistoryService = {

  async save(record: Omit<GenerationRecord, 'id' | 'createdAt'> & Partial<Pick<GenerationRecord, 'id' | 'createdAt'>>): Promise<void> {
    const uid = getUid();
    if (!uid) return;

    await migrateLegacyLocalStorage(uid);

    const id = record.id || `gen_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const newRecord = normalizeRecord({
      ...record,
      id,
      createdAt: record.createdAt || new Date().toISOString(),
      source: record.source || 'client',
    } as GenerationRecord);

    await putLocalRecord(uid, newRecord).catch(() => {});

    try {
      const remoteRecord = await saveRemoteRecord(uid, newRecord);
      await putLocalRecord(uid, { ...remoteRecord, syncedAt: new Date().toISOString() }).catch(() => {});
      enforceHistoryLimit(uid).catch(() => {});
    } catch (err) {
      console.warn('[History] Remote sync failed; local copy preserved.', err);
    } finally {
      if (uid) {
        checkFirstGeneration(uid).catch(() => {});
        rewardReferrer(uid).catch(() => {});
      }
    }
  },

  async getAll(limit = 100, offset = 0): Promise<GenerationRecord[]> {
    const uid = getUid();
    if (!uid) return [];

    await migrateLegacyLocalStorage(uid);
    const local = await getLocalRecords(uid);

    // Migración de historial viejo en background — no bloquea la lectura actual.
    migrateLocalToCloud(uid).catch(() => {});

    try {
      const remote = await fetchRemoteRecords(uid);
      for (const record of remote) {
        await putLocalRecord(uid, { ...record, syncedAt: record.syncedAt || new Date().toISOString() }).catch(() => {});
      }
      return mergeRecords(remote, local).slice(offset, offset + limit);
    } catch {
      return local.slice(offset, offset + limit);
    }
  },

  async delete(id: string): Promise<void> {
    const uid = getUid();
    if (!uid) return;
    await deleteLocalRecord(uid, id);
    await deleteRemoteRecord(uid, id);
  },

  async deleteBatch(ids: string[]): Promise<void> {
    const uid = getUid();
    if (!uid) return;
    await Promise.all(ids.map(async id => {
      await deleteLocalRecord(uid, id);
      await deleteRemoteRecord(uid, id);
    }));
  },

  async clear(): Promise<void> {
    const uid = getUid();
    if (!uid) return;
    const remote = await fetchRemoteRecords(uid).catch(() => []);
    await Promise.all(remote.map(record => deleteRemoteRecord(uid, record.id)));
    await deleteUserDb(uid);
  },

  async stats(): Promise<{ total: number; byModule: Record<string, number> }> {
    const uid = getUid();
    if (!uid) return { total: 0, byModule: {} };
    const remote = await fetchRemoteRecords(uid).catch(() => []);
    const byModule: Record<string, number> = {};
    remote.forEach(r => { byModule[r.module] = (byModule[r.module] || 0) + 1; });
    return { total: remote.length, byModule };
  },

  // Borra la IndexedDB local del usuario. Llamar en logout antes de firebaseSignOut.
  async clearLocalForUser(uid: string): Promise<void> {
    await deleteUserDb(uid);
    try { localStorage.removeItem(LEGACY_LS_KEY); } catch { /* ignore */ }
  },

  async trimHistory(_uid: string): Promise<void> {
    const uid = getUid();
    if (uid) await trimLocalHistory(uid).catch(() => {});
  },
};
