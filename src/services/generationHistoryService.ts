// src/services/generationHistoryService.ts
// Servicio de historial de generaciones.
// Almacena en Vercel/Upstash Redis (nube) en lugar de localStorage.
// — Sin límite de quota por dispositivo
// — Persiste entre dispositivos y navegadores
// — Compartido por todos los usuarios (separados por uid)
// — Plan gratuito Upstash: 10,000 cmds/día · 256MB (ya incluido en tu plan actual)

export interface HistoryEntry {
  id: string;
  createdAt: number;
  module: string;
  moduleLabel: string;
  creditsUsed: number;
  promptText?: string;
  focus?: string;
  imageThumbnail?: string;
}

export interface SaveHistoryParams {
  imageUrl?: string;
  module: string;
  moduleLabel: string;
  creditsUsed: number;
  promptText?: string;
  focus?: string;
}

class GenerationHistoryService {
  private baseUrl = '/api/history';

  // ─── Obtener uid del usuario actual ──────────────────────────────────────
  // Lee el uid de localStorage donde tu sistema de auth lo guarda.
  // Ajusta la clave si tu AuthContext usa un nombre diferente.
  private getUid(): string | null {
    try {
      // Intentar varias claves comunes de Firebase Auth en localStorage
      for (const key of Object.keys(localStorage)) {
        if (key.includes('firebase') || key.includes('auth') || key.includes('uid')) {
          const val = localStorage.getItem(key);
          if (val) {
            try {
              const parsed = JSON.parse(val);
              if (parsed?.uid) return parsed.uid;
              if (parsed?.localId) return parsed.localId;
            } catch {
              // No es JSON, puede ser el uid directamente
              if (val.length > 10 && val.length < 128 && !val.includes(' ')) return val;
            }
          }
        }
      }
      // Fallback: buscar en indexedDB o usar un id anónimo persistente
      let anonId = localStorage.getItem('_luz_anon_uid');
      if (!anonId) {
        anonId = `anon_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
        localStorage.setItem('_luz_anon_uid', anonId);
      }
      return anonId;
    } catch {
      return 'unknown';
    }
  }

  // ─── save ─────────────────────────────────────────────────────────────────
  // Guarda una entrada en el historial. Fire-and-forget — nunca lanza.
  // Retorna una promesa que se resuelve cuando el save termina (o falla silenciosamente).
  async save(params: SaveHistoryParams): Promise<void> {
    const uid = this.getUid();
    if (!uid) return;

    try {
      await fetch(this.baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save',
          payload: {
            uid,
            module: params.module,
            moduleLabel: params.moduleLabel,
            creditsUsed: params.creditsUsed,
            promptText: params.promptText,
            focus: params.focus,
            // Solo enviamos el thumbnail (primeros 300 chars) — no la imagen completa
            imageUrl: params.imageUrl ? params.imageUrl.substring(0, 300) : undefined,
          },
        }),
      });
    } catch {
      // Silenciar errores de red — el historial es secundario,
      // nunca debe afectar el flujo de generación
    }
  }

  // ─── list ─────────────────────────────────────────────────────────────────
  async list(limit = 50, offset = 0): Promise<{ entries: HistoryEntry[]; total: number; hasMore: boolean }> {
    const uid = this.getUid();
    if (!uid) return { entries: [], total: 0, hasMore: false };

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'list',
          payload: { uid, limit, offset },
        }),
      });
      if (!response.ok) return { entries: [], total: 0, hasMore: false };
      return response.json();
    } catch {
      return { entries: [], total: 0, hasMore: false };
    }
  }

  // ─── clear ────────────────────────────────────────────────────────────────
  async clear(): Promise<void> {
    const uid = this.getUid();
    if (!uid) return;

    try {
      await fetch(this.baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'clear',
          payload: { uid },
        }),
      });
    } catch {
      // Silenciar
    }
  }

  // ─── stats ────────────────────────────────────────────────────────────────
  async stats(): Promise<{
    totalGenerations: number;
    recentEntries: number;
    byModule: Record<string, number>;
  }> {
    const uid = this.getUid();
    if (!uid) return { totalGenerations: 0, recentEntries: 0, byModule: {} };

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'stats',
          payload: { uid },
        }),
      });
      if (!response.ok) return { totalGenerations: 0, recentEntries: 0, byModule: {} };
      return response.json();
    } catch {
      return { totalGenerations: 0, recentEntries: 0, byModule: {} };
    }
  }
}

export const generationHistoryService = new GenerationHistoryService();