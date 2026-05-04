// src/services/generationHistoryService.ts
// Historial de generaciones con doble guardado:
// 1) IndexedDB local: malla de seguridad inmediata, incluso si falla la API.
// 2) /api/history: sincronizacion remota cuando el usuario esta autenticado.

import { getAuth } from 'firebase/auth';
import { checkFirstGeneration } from './missionsService';
import { rewardReferrer } from './referralService';

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
  scene_clone:        'Scene Clone',
  cloneImageService:  'Scene Clone',
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

const API = '/api/history';
const DB_NAME = 'luz_generation_history_db';
const STORE_NAME = 'records';
const DB_VERSION = 1;
const LOCAL_MAX_ENTRIES = 200;
const LEGACY_LS_KEY = 'luz_generation_history';

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

function openHistoryDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!canUseBrowserStorage()) {
      reject(new Error('IndexedDB no disponible'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);
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
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T | void> {
  const db = await openHistoryDb();
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

async function getLocalRecords(): Promise<GenerationRecord[]> {
  try {
    const records = await withStore<GenerationRecord[]>('readonly', store => store.getAll());
    return (Array.isArray(records) ? records : [])
      .map(normalizeRecord)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch {
    return loadLegacyLocalStorage();
  }
}

async function putLocalRecord(record: GenerationRecord): Promise<void> {
  const normalized = normalizeRecord(record);
  try {
    const all = await getLocalRecords();
    const duplicate = all.find(r => r.id === normalized.id || r.imageKey === normalized.imageKey);
    const merged = mergeRecord(duplicate, normalized);
    await withStore('readwrite', store => {
      if (duplicate && duplicate.id !== merged.id) store.delete(duplicate.id);
      store.put(merged);
    });
    await trimLocalHistory();
  } catch (err) {
    saveLegacyLocalStorage(normalized);
    throw err;
  }
}

async function trimLocalHistory(): Promise<void> {
  const records = await getLocalRecords();
  const extra = records.slice(LOCAL_MAX_ENTRIES);
  if (!extra.length) return;
  await withStore('readwrite', store => {
    extra.forEach(record => store.delete(record.id));
  });
}

async function deleteLocalRecord(id: string): Promise<void> {
  try {
    await withStore('readwrite', store => { store.delete(id); });
  } catch {
    const updated = loadLegacyLocalStorage().filter(r => r.id !== id);
    localStorage.setItem(LEGACY_LS_KEY, JSON.stringify(updated));
  }
}

async function clearLocalRecords(): Promise<void> {
  try {
    await withStore('readwrite', store => { store.clear(); });
  } catch {
    try { localStorage.removeItem(LEGACY_LS_KEY); } catch { /* ignore */ }
  }
}

async function migrateLegacyLocalStorage(): Promise<void> {
  const legacy = loadLegacyLocalStorage();
  if (!legacy.length || !canUseBrowserStorage()) return;
  try {
    for (const record of legacy) await putLocalRecord(record);
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

function stripHeavyLocalOnlyData(record: GenerationRecord): GenerationRecord {
  const safeReferences = record.references?.map((ref, index) => ({
    label: ref.label || `Referencia ${index + 1}`,
    mimeType: ref.mimeType,
    role: ref.role,
  }));

  return {
    ...record,
    references: safeReferences,
  };
}

async function call(action: string, payload: Record<string, unknown> = {}): Promise<any> {
  const uid = getUid();
  if (!uid) throw new Error('Usuario no autenticado');

  const token = await getAuth().currentUser?.getIdToken().catch(() => null);
  const res = await fetch(API, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    },
    body:    JSON.stringify({ action, payload: { uid, ...payload } }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `History API error: ${res.status}`);
  }
  return res.json();
}

export const generationHistoryService = {

  async save(record: Omit<GenerationRecord, 'id' | 'createdAt'> & Partial<Pick<GenerationRecord, 'id' | 'createdAt'>>): Promise<void> {
    await migrateLegacyLocalStorage();

    const id = record.id || `gen_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const newRecord = normalizeRecord({
      ...record,
      id,
      createdAt: record.createdAt || new Date().toISOString(),
      source: record.source || 'client',
    } as GenerationRecord);

    await putLocalRecord(newRecord).catch(() => {});

    try {
      await call('save', { record: stripHeavyLocalOnlyData(newRecord) });
      await putLocalRecord({ ...newRecord, syncedAt: new Date().toISOString() }).catch(() => {});
    } catch (err) {
      // La copia local ya quedo guardada. El historial no debe bloquear el modulo.
      console.warn('[History] Remote sync failed; local copy preserved.', err);
    } finally {
      const uid = getAuth().currentUser?.uid;
      if (uid) {
        checkFirstGeneration(uid).catch(() => {});
        rewardReferrer(uid).catch(() => {});
      }
    }
  },

  async getAll(limit = 100, offset = 0): Promise<GenerationRecord[]> {
    await migrateLegacyLocalStorage();
    const local = await getLocalRecords();

    try {
      const data = await call('list', { limit, offset });
      const remote = Array.isArray(data.entries) ? data.entries.map(normalizeRecord) : [];
      for (const record of remote) {
        await putLocalRecord({ ...record, syncedAt: record.syncedAt || new Date().toISOString() }).catch(() => {});
      }
      return mergeRecords(remote, local).slice(offset, offset + limit);
    } catch {
      return local.slice(offset, offset + limit);
    }
  },

  async delete(id: string): Promise<void> {
    await deleteLocalRecord(id);
    await call('delete', { id });
  },

  async deleteBatch(ids: string[]): Promise<void> {
    await Promise.all(ids.map(id => deleteLocalRecord(id)));
    await call('deleteBatch', { ids });
  },

  async clear(): Promise<void> {
    await clearLocalRecords();
    await call('clear');
  },

  async stats(): Promise<any> {
    return call('stats');
  },

  // Mantenido por compatibilidad con codigo que lo llama.
  async trimHistory(_uid: string): Promise<void> {
    await trimLocalHistory().catch(() => {});
  },
};
