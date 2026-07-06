// ── Module Preset Service ──────────────────────────────────────────────────
// CRUD de presets en Firestore + subida de assets a Firebase Storage
// Colección: users/{uid}/modulePresets

import {
  collection, doc, setDoc, getDoc, getDocs,
  deleteDoc, query, where, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import { db, storage } from '../../firebase';
import type {
  ModulePreset,
  ModulePresetInput,
  ModuleId,
  PresetAsset,
  PresetAssetInput,
} from './types';

const presetsCol = (uid: string) =>
  collection(db, 'users', uid, 'modulePresets');

const presetDoc = (uid: string, presetId: string) =>
  doc(db, 'users', uid, 'modulePresets', presetId);

// ── Subir un asset a Storage ───────────────────────────────────────────────
async function uploadPresetAsset(
  uid: string,
  presetId: string,
  asset: PresetAssetInput,
): Promise<PresetAsset> {
  if (asset.existingUrl && !asset.file) {
    return { key: asset.key, url: asset.existingUrl, mimeType: asset.mimeType };
  }
  if (!asset.file) throw new Error(`Asset "${asset.key}" no tiene archivo ni URL`);

  const path = `modulePresets/${uid}/${presetId}/${asset.key}`;
  const sRef = storageRef(storage, path);
  await uploadBytes(sRef, asset.file, { contentType: asset.mimeType ?? asset.file.type });
  const url = await getDownloadURL(sRef);
  return { key: asset.key, url, mimeType: asset.mimeType ?? asset.file.type };
}

// ── Borrar todos los assets de un preset ──────────────────────────────────
async function deletePresetAssets(uid: string, presetId: string, assets: PresetAsset[]) {
  await Promise.allSettled(
    assets.map(a => {
      const path = `modulePresets/${uid}/${presetId}/${a.key}`;
      return deleteObject(storageRef(storage, path));
    }),
  );
}

// ── Convertir doc Firestore → ModulePreset ────────────────────────────────
function fromDoc(id: string, data: Record<string, unknown>): ModulePreset {
  return {
    id,
    moduleId: data.moduleId as string,
    name: data.name as string,
    description: data.description as string | undefined,
    thumbnail: data.thumbnail as string | undefined,
    createdAt: (data.createdAt as Timestamp)?.toMillis?.() ?? Date.now(),
    updatedAt: (data.updatedAt as Timestamp)?.toMillis?.() ?? Date.now(),
    config: (data.config as Record<string, unknown>) ?? {},
    assets: (data.assets as PresetAsset[]) ?? [],
    version: (data.version as number) ?? 1,
  };
}

// ── API pública ────────────────────────────────────────────────────────────

export const presetService = {

  // Listar todos los presets de un módulo para un usuario
  // Nota: orderBy('updatedAt') en combinación con where() requiere índice compuesto en Firestore.
  // Para evitar tener que crearlo manualmente, filtramos y ordenamos en cliente.
  async list(uid: string, moduleId: ModuleId): Promise<ModulePreset[]> {
    const q = query(
      presetsCol(uid),
      where('moduleId', '==', moduleId),
    );
    const snap = await getDocs(q);
    const docs = snap.docs.map(d => fromDoc(d.id, d.data() as Record<string, unknown>));
    return docs.sort((a, b) => b.updatedAt - a.updatedAt);
  },

  // Obtener un preset específico
  async get(uid: string, presetId: string): Promise<ModulePreset | null> {
    const snap = await getDoc(presetDoc(uid, presetId));
    if (!snap.exists()) return null;
    return fromDoc(snap.id, snap.data() as Record<string, unknown>);
  },

  // Crear un nuevo preset (sube assets primero, luego guarda en Firestore)
  async create(
    uid: string,
    input: ModulePresetInput,
    assetInputs: PresetAssetInput[] = [],
  ): Promise<ModulePreset> {
    // Generar ID sin escribir nada en Firestore todavía
    const docRef = doc(presetsCol(uid));
    const presetId = docRef.id;

    // Subir assets con el ID ya conocido
    const assets = await Promise.all(
      assetInputs.map(a => uploadPresetAsset(uid, presetId, a)),
    );

    const thumbnail = assets.find(a => a.key === 'thumbnail')?.url
      ?? assets[0]?.url
      ?? input.thumbnail;

    const payload = {
      moduleId:    input.moduleId,
      name:        input.name,
      description: input.description ?? '',
      thumbnail:   thumbnail ?? null,
      config:      input.config,
      assets,
      version:     input.version ?? 1,
      createdAt:   serverTimestamp(),
      updatedAt:   serverTimestamp(),
    };

    await setDoc(docRef, payload);

    return {
      id: presetId,
      ...input,
      assets,
      thumbnail,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  },

  // Actualizar nombre/descripción/config de un preset existente
  async update(
    uid: string,
    presetId: string,
    changes: Partial<Pick<ModulePreset, 'name' | 'description' | 'config' | 'thumbnail' | 'assets'>>,
    newAssetInputs: PresetAssetInput[] = [],
  ): Promise<void> {
    let newAssets: PresetAsset[] = [];
    if (newAssetInputs.length > 0) {
      newAssets = await Promise.all(
        newAssetInputs.map(a => uploadPresetAsset(uid, presetId, a)),
      );
    }

    const payload: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
    };
    if (changes.name        !== undefined) payload.name        = changes.name;
    if (changes.description !== undefined) payload.description = changes.description;
    if (changes.config      !== undefined) payload.config      = changes.config;
    if (changes.thumbnail   !== undefined) payload.thumbnail   = changes.thumbnail;
    if (changes.assets      !== undefined) payload.assets      = changes.assets;
    if (newAssets.length > 0)             payload.assets      = newAssets;

    await setDoc(presetDoc(uid, presetId), payload, { merge: true });
  },

  // Eliminar preset y sus assets en Storage
  async delete(uid: string, presetId: string): Promise<void> {
    const preset = await presetService.get(uid, presetId);
    if (preset?.assets?.length) {
      await deletePresetAssets(uid, presetId, preset.assets);
    }
    await deleteDoc(presetDoc(uid, presetId));
  },

  // Duplicar un preset (copia config + assets existentes por URL)
  async duplicate(uid: string, presetId: string): Promise<ModulePreset> {
    const original = await presetService.get(uid, presetId);
    if (!original) throw new Error('Preset no encontrado');

    const assetInputs: PresetAssetInput[] = original.assets.map(a => ({
      key: a.key,
      existingUrl: a.url,
      mimeType: a.mimeType,
    }));

    return presetService.create(
      uid,
      {
        moduleId:    original.moduleId,
        name:        `${original.name} (copia)`,
        description: original.description,
        thumbnail:   original.thumbnail,
        config:      original.config,
        assets:      original.assets,
        version:     original.version,
      },
      assetInputs,
    );
  },
};
