// ── Module Preset Service — localStorage backend ───────────────────────────
// Guarda presets en localStorage por usuario. Misma API que la versión Firestore.
// Clave: modulePresets_{uid}_{moduleId}

import type {
  ModulePreset,
  ModulePresetInput,
  ModuleId,
  PresetAsset,
  PresetAssetInput,
} from './types';

function storageKey(uid: string, moduleId: ModuleId) {
  return `modulePresets_${uid}_${moduleId}`;
}

function readAll(uid: string, moduleId: ModuleId): ModulePreset[] {
  try {
    const raw = localStorage.getItem(storageKey(uid, moduleId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeAll(uid: string, moduleId: ModuleId, presets: ModulePreset[]) {
  localStorage.setItem(storageKey(uid, moduleId), JSON.stringify(presets));
}

function newId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export const presetService = {

  async list(uid: string, moduleId: ModuleId): Promise<ModulePreset[]> {
    return readAll(uid, moduleId).sort((a, b) => b.updatedAt - a.updatedAt);
  },

  async get(uid: string, presetId: string): Promise<ModulePreset | null> {
    // Busca en todas las claves del usuario
    const keys = Object.keys(localStorage).filter(k => k.startsWith(`modulePresets_${uid}_`));
    for (const key of keys) {
      try {
        const list: ModulePreset[] = JSON.parse(localStorage.getItem(key) ?? '[]');
        const found = list.find(p => p.id === presetId);
        if (found) return found;
      } catch { /* continúa */ }
    }
    return null;
  },

  async create(
    uid: string,
    input: ModulePresetInput,
    _assetInputs: PresetAssetInput[] = [],
  ): Promise<ModulePreset> {
    const now = Date.now();
    const preset: ModulePreset = {
      id:          newId(),
      moduleId:    input.moduleId,
      name:        input.name,
      description: input.description ?? '',
      thumbnail:   input.thumbnail ?? null,
      config:      input.config,
      assets:      [] as PresetAsset[],
      version:     input.version ?? 1,
      createdAt:   now,
      updatedAt:   now,
    };
    const list = readAll(uid, input.moduleId);
    list.unshift(preset);
    writeAll(uid, input.moduleId, list);
    return preset;
  },

  async update(
    uid: string,
    presetId: string,
    changes: Partial<Pick<ModulePreset, 'name' | 'description' | 'config' | 'thumbnail' | 'assets'>>,
  ): Promise<void> {
    const preset = await presetService.get(uid, presetId);
    if (!preset) return;
    const updated: ModulePreset = {
      ...preset,
      ...changes,
      updatedAt: Date.now(),
    };
    const list = readAll(uid, preset.moduleId);
    writeAll(uid, preset.moduleId, list.map(p => p.id === presetId ? updated : p));
  },

  async delete(uid: string, presetId: string): Promise<void> {
    const preset = await presetService.get(uid, presetId);
    if (!preset) return;
    const list = readAll(uid, preset.moduleId);
    writeAll(uid, preset.moduleId, list.filter(p => p.id !== presetId));
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
    const list = readAll(uid, moduleId);
    writeAll(uid, moduleId, list.map(p => ({ ...p, isDefault: p.id === presetId })));
  },

  async getDefault(uid: string, moduleId: ModuleId): Promise<ModulePreset | null> {
    const list = readAll(uid, moduleId);
    return list.find(p => p.isDefault) ?? null;
  },
};
