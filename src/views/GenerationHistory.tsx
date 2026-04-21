// src/services/generationHistoryService.ts
// Historial de generaciones — mismo contrato de interfaz que el original,
// pero almacenado en Vercel/Upstash Redis en lugar de localStorage.
//
// Ventajas sobre localStorage:
//   - Sin QuotaExceededError (localStorage tenía límite de ~5MB total)
//   - Persiste entre dispositivos y navegadores
//   - Escala a múltiples usuarios sin problema
//   - Usa el mismo Redis que ya tienes en ugc.ts (mismas env vars KV_REST_API_*)

// ── Tipos públicos (IDÉNTICOS al original — GenerationHistory.tsx los importa) ──

export interface GenerationRecord {
  id: string;
  imageUrl: string;       // base64 data URL completo
  module: string;
  moduleLabel: string;
  promptText?: string;
  creditsUsed: number;
  createdAt: string;      // ISO string — igual que antes
}

export const MODULE_LABELS: Record<string, string> = {
  prompt_studio:      'AI Generator',
  scene_clone:        'Scene Clone',
  model_dna:          'Model DNA',
  content_studio:     'Content Studio',
  content_studio_pro: 'Content Studio Pro',
  outfit_extractor:   'Outfit Extractor',
  outfit_kit:         'Outfit Kit',
  catalog:            'Catálogo',
  campaign:           'Campaign',
  photodump:          'Photodump',
};

// ── Configuración ────────────────────────────────────────────────────────

const API_URL = '/api/history';
const MAX_HISTORY = 100;

// ── Obtener uid del usuario actual ───────────────────────────────────────
// Firebase Auth guarda el usuario bajo claves que empiezan con "firebase:authUser"
// en localStorage. Si no lo encuentra, genera un id anónimo persistente.
function getUid(): string {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('firebase:authUser') || key.includes(':firebaseLocalStorage')) {
        try {
          const val = localStorage.getItem(key);
          if (!val) continue;
          const parsed = JSON.parse(val);
          const uid = parsed?.uid || parsed?.localId;
          if (uid && typeof uid === 'string' && uid.length > 4) return uid;
        } catch { /* no era JSON */ }
      }
    }
    // Fallback: id anónimo persistente
    let anonId = localStorage.getItem('_luz_anon_uid');
    if (!anonId) {
      anonId = `anon_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
      try { localStorage.setItem('_luz_anon_uid', anonId); } catch { /* storage lleno, igual funciona */ }
    }
    return anonId || 'unknown';
  } catch {
    return 'unknown';
  }
}

// ── Helper fetch silencioso ──────────────────────────────────────────────
async function apiCall<T>(action: string, extraPayload: Record<string, unknown> = {}): Promise<T | null> {
  try {
    const uid = getUid();
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, payload: { uid, ...extraPayload } }),
    });
    if (!response.ok) return null;
    return response.json() as Promise<T>;
  } catch {
    return null;
  }
}

// ── Servicio público — MISMA INTERFAZ QUE EL ORIGINAL ───────────────────

export const generationHistoryService = {

  async save(record: Omit<GenerationRecord, 'id' | 'createdAt'>): Promise<void> {
    const id = `gen_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const newRecord: GenerationRecord = {
      ...record,
      id,
      createdAt: new Date().toISOString(),
    };
    // Fire-and-forget — nunca bloquea el flujo de generación
    apiCall('save', { record: newRecord }).catch(() => {});
  },

  async getAll(): Promise<GenerationRecord[]> {
    const result = await apiCall<{ entries: GenerationRecord[] }>('list', { limit: MAX_HISTORY });
    return result?.entries ?? [];
  },

  async delete(id: string): Promise<void> {
    await apiCall('delete', { id });
  },

  async deleteBatch(ids: string[]): Promise<void> {
    await apiCall('deleteBatch', { ids });
  },

  async trimHistory(_uid: string): Promise<void> {
    // No-op: el límite lo maneja Redis automáticamente en cada save
  },
};