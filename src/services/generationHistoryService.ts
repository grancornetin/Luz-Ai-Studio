// src/services/generationHistoryService.ts
// Llama a /api/history (servidor) para guardar y leer el historial.
// Redis y @upstash/redis viven únicamente en el servidor — nunca aquí.

import { getAuth } from 'firebase/auth';
import { checkFirstGeneration } from './missionsService';
import { rewardReferrer } from './referralService';

export interface GenerationRecord {
  id:           string;
  imageUrl:     string;
  module:       string;
  moduleLabel:  string;
  promptText?:  string;
  creditsUsed:  number;
  createdAt:    string;
}

export const MODULE_LABELS: Record<string, string> = {
  prompt_studio:      'AI Generator',
  scene_clone:        'Scene Clone',
  model_dna:          'Model DNA · From Photos',
  model_dna_manual:   'Model DNA · From Scratch',
  content_studio:     'Content Studio',
  content_studio_pro: 'Content Studio',
  outfit_extractor:   'Outfit Kit',
  outfit_kit:         'Outfit Kit',
  catalog:            'Catálogo',
  campaign:           'Campaign',
  photodump:          'Photodump',
};

const API = '/api/history';

function getUid(): string {
  try {
    const user = getAuth().currentUser;
    if (user?.uid) return user.uid;
  } catch { /* ignorar */ }
  return '';
}

async function call(action: string, payload: Record<string, unknown> = {}): Promise<any> {
  const uid = getUid();
  if (!uid) throw new Error('Usuario no autenticado');

  const res = await fetch(API, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ action, payload: { uid, ...payload } }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `History API error: ${res.status}`);
  }
  return res.json();
}

export const generationHistoryService = {

  async save(record: Omit<GenerationRecord, 'id' | 'createdAt'>): Promise<void> {
    const id = `gen_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const newRecord: GenerationRecord = {
      ...record,
      id,
      createdAt: new Date().toISOString(),
    };
    await call('save', { record: newRecord });

    // Auto-disparar misión primera generación y reward de referido (fire-and-forget)
    const uid = getAuth().currentUser?.uid;
    if (uid) {
      checkFirstGeneration(uid).catch(() => {});
      rewardReferrer(uid).catch(() => {});
    }
  },

  async getAll(limit = 100, offset = 0): Promise<GenerationRecord[]> {
    const data = await call('list', { limit, offset });
    return data.entries ?? [];
  },

  async delete(id: string): Promise<void> {
    await call('delete', { id });
  },

  async deleteBatch(ids: string[]): Promise<void> {
    await call('deleteBatch', { ids });
  },

  async clear(): Promise<void> {
    await call('clear');
  },

  async stats(): Promise<any> {
    return call('stats');
  },

  // Mantenido por compatibilidad con código que lo llama
  async trimHistory(_uid: string): Promise<void> { /* manejado en el servidor */ },
};
