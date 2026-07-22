// ── Module Preset Service — IndexedDB backend ──────────────────────────────
// Guarda presets en IndexedDB por usuario (mismo origen que antes en
// localStorage, pero sin el límite de ~5-10MB — los presets con varias
// referencias de imagen llenaban esa cuota rápido). Misma API pública.

import type {
  ModulePreset,
  ModulePresetInput,
  ModuleId,
  PresetAssetInput,
} from './types';

const DB_NAME    = 'luz_module_presets';
const DB_VERSION = 1;
const STORE      = 'presets';
const LEGACY_PREFIX = 'modulePresets_'; // clave vieja en localStorage: modulePresets_{uid}_{moduleId}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('byUidModule', ['uid', 'moduleId']);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
  return dbPromise;
}

function tx(db: IDBDatabase, mode: IDBTransactionMode) {
  const t = db.transaction(STORE, mode);
  return { t, store: t.objectStore(STORE) };
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

// Registro guardado en IndexedDB: preset + uid (para poder indexar por [uid, moduleId])
type StoredPreset = ModulePreset & { uid: string };

async function listByUidModule(uid: string, moduleId: ModuleId): Promise<StoredPreset[]> {
  const db = await openDb();
  const { store } = tx(db, 'readonly');
  const index = store.index('byUidModule');
  const results = await reqToPromise(index.getAll(IDBKeyRange.only([uid, moduleId])));
  return results as StoredPreset[];
}

async function getById(presetId: string): Promise<StoredPreset | null> {
  const db = await openDb();
  const { store } = tx(db, 'readonly');
  const result = await reqToPromise(store.get(presetId));
  return (result as StoredPreset) ?? null;
}

async function putPreset(preset: StoredPreset): Promise<void> {
  const db = await openDb();
  const { t, store } = tx(db, 'readwrite');
  store.put(preset);
  return new Promise((resolve, reject) => {
    t.oncomplete = () => resolve();
    t.onerror    = () => reject(t.error);
  });
}

async function deleteById(presetId: string): Promise<void> {
  const db = await openDb();
  const { t, store } = tx(db, 'readwrite');
  store.delete(presetId);
  return new Promise((resolve, reject) => {
    t.oncomplete = () => resolve();
    t.onerror    = () => reject(t.error);
  });
}

function newId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ── Migración única desde localStorage (presets guardados antes de IndexedDB) ──
let migrated = false;
async function migrateFromLocalStorageOnce(): Promise<void> {
  if (migrated) return;
  migrated = true;
  const legacyKeys = Object.keys(localStorage).filter(k => k.startsWith(LEGACY_PREFIX));
  if (legacyKeys.length === 0) return;

  for (const key of legacyKeys) {
    const uid = key.slice(LEGACY_PREFIX.length).split('_')[0];
    try {
      const list: ModulePreset[] = JSON.parse(localStorage.getItem(key) ?? '[]');
      for (const preset of list) {
        await putPreset({ ...preset, uid });
      }
      localStorage.removeItem(key); // libera la cuota una vez migrado
    } catch {
      // clave corrupta: se ignora y se deja de intentar migrar
    }
  }
}

export const presetService = {

  async list(uid: string, moduleId: ModuleId): Promise<ModulePreset[]> {
    await migrateFromLocalStorageOnce();
    const list = await listByUidModule(uid, moduleId);
    return list
      .map(({ uid: _uid, ...preset }) => preset)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  },

  async get(uid: string, presetId: string): Promise<ModulePreset | null> {
    await migrateFromLocalStorageOnce();
    const found = await getById(presetId);
    if (!found) return null;
    const { uid: _uid, ...preset } = found;
    return preset;
  },

  async create(
    uid: string,
    input: ModulePresetInput,
    _assetInputs: PresetAssetInput[] = [],
  ): Promise<ModulePreset> {
    await migrateFromLocalStorageOnce();
    const now = Date.now();
    const preset: ModulePreset = {
      id:          newId(),
      moduleId:    input.moduleId,
      name:        input.name,
      description: input.description ?? '',
      thumbnail:   input.thumbnail ?? null,
      config:      input.config,
      assets:      [],
      version:     input.version ?? 1,
      createdAt:   now,
      updatedAt:   now,
    };
    await putPreset({ ...preset, uid });
    return preset;
  },

  async update(
    uid: string,
    presetId: string,
    changes: Partial<Pick<ModulePreset, 'name' | 'description' | 'config' | 'thumbnail' | 'assets'>>,
  ): Promise<void> {
    const preset = await getById(presetId);
    if (!preset) return;
    await putPreset({ ...preset, ...changes, updatedAt: Date.now() });
  },

  async delete(uid: string, presetId: string): Promise<void> {
    await deleteById(presetId);
  },

  async duplicate(uid: string, presetId: string): Promise<ModulePreset> {
    const original = await presetService.get(uid, presetId);
    if (!original) throw new Error('Preset no encontrado');
    return presetService.create(uid, {
      moduleId:    original.moduleId,
      name:        `${original.name} (copia)`,
      description: original.description,
      thumbnail:   original.thumbnail,
      config:      original.config,
      assets:      [],
      version:     original.version,
    });
  },

  // Marca un preset como default del módulo (solo uno a la vez); pasar null para quitar el default
  async setDefault(uid: string, moduleId: ModuleId, presetId: string | null): Promise<void> {
    const list = await listByUidModule(uid, moduleId);
    await Promise.all(list.map(p => putPreset({ ...p, isDefault: p.id === presetId })));
  },

  async getDefault(uid: string, moduleId: ModuleId): Promise<ModulePreset | null> {
    const list = await listByUidModule(uid, moduleId);
    const found = list.find(p => p.isDefault);
    if (!found) return null;
    const { uid: _uid, ...preset } = found;
    return preset;
  },
};
