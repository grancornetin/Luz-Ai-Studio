// api/history.ts
// Historial de generaciones por usuario, almacenado en Upstash Redis.
// Reemplaza el localStorage que se llenaba con imágenes base64.
//
// Estructura en Redis:
//   history:{uid}        → lista de HistoryEntry (JSON, últimas 100 entradas)
//   history:{uid}:count  → contador total de generaciones del usuario
//
// Plan gratuito Upstash Redis: 10,000 cmds/día · 256MB storage
// Una entrada de historial pesa ~200-400 bytes (sin imagen) → caben ~600,000 entradas en 256MB.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

// Máximo de entradas que guardamos por usuario en Redis
const MAX_ENTRIES_PER_USER = 100;
// TTL de cada entrada: 90 días (en segundos)
const HISTORY_TTL_SECONDS = 90 * 24 * 60 * 60;

export interface HistoryEntry {
  id: string;
  createdAt: number;
  module: string;
  moduleLabel: string;
  creditsUsed: number;
  promptText?: string;
  focus?: string;
  // imageUrl se guarda como thumbnail recortado (primeros 300 chars del data URI)
  // para identificación visual sin llenar el storage
  imageThumbnail?: string;
}

function historyKey(uid: string): string {
  return `history:${uid}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action, payload } = req.body || {};
  if (!action) return res.status(400).json({ error: 'Missing action' });

  // ── uid obligatorio para todas las acciones ──────────────────────────────
  const uid: string | undefined = payload?.uid;
  if (!uid) return res.status(400).json({ error: 'Missing uid' });

  try {

    // ──────────────────────────────────────────────────────────────────────
    // save — añadir una entrada al historial del usuario
    // ──────────────────────────────────────────────────────────────────────
    if (action === 'save') {
      const { module, moduleLabel, creditsUsed, promptText, focus, imageUrl } = payload;

      const entry: HistoryEntry = {
        id: `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        createdAt: Date.now(),
        module: module || 'unknown',
        moduleLabel: moduleLabel || '',
        creditsUsed: creditsUsed || 0,
        promptText: promptText || '',
        focus: focus || '',
        // Guardar solo los primeros 300 chars del data URI como thumbnail identifier
        // Esto permite saber qué tipo de imagen es (png/jpeg) sin guardar el payload completo
        imageThumbnail: imageUrl ? imageUrl.substring(0, 300) : undefined,
      };

      const key = historyKey(uid);

      // Obtener historial actual
      const existing: HistoryEntry[] = await redis.get<HistoryEntry[]>(key) || [];

      // Añadir nueva entrada al frente
      const updated = [entry, ...existing].slice(0, MAX_ENTRIES_PER_USER);

      // Guardar con TTL renovado
      await redis.set(key, updated, { ex: HISTORY_TTL_SECONDS });

      // Incrementar contador total
      await redis.incr(`history:${uid}:count`);

      return res.status(200).json({ success: true, id: entry.id, total: updated.length });
    }

    // ──────────────────────────────────────────────────────────────────────
    // list — obtener historial del usuario (paginado)
    // ──────────────────────────────────────────────────────────────────────
    if (action === 'list') {
      const limit: number = Math.min(payload?.limit || 50, 100);
      const offset: number = payload?.offset || 0;

      const key = historyKey(uid);
      const all: HistoryEntry[] = await redis.get<HistoryEntry[]>(key) || [];
      const page = all.slice(offset, offset + limit);

      return res.status(200).json({
        entries: page,
        total: all.length,
        hasMore: offset + limit < all.length,
      });
    }

    // ──────────────────────────────────────────────────────────────────────
    // clear — borrar todo el historial del usuario
    // ──────────────────────────────────────────────────────────────────────
    if (action === 'clear') {
      await redis.del(historyKey(uid));
      await redis.del(`history:${uid}:count`);
      return res.status(200).json({ success: true });
    }

    // ──────────────────────────────────────────────────────────────────────
    // stats — estadísticas del usuario (total generaciones, etc.)
    // ──────────────────────────────────────────────────────────────────────
    if (action === 'stats') {
      const key = historyKey(uid);
      const all: HistoryEntry[] = await redis.get<HistoryEntry[]>(key) || [];
      const totalCount = await redis.get<number>(`history:${uid}:count`) || all.length;

      // Agrupar por módulo
      const byModule: Record<string, number> = {};
      all.forEach(e => {
        byModule[e.module] = (byModule[e.module] || 0) + 1;
      });

      return res.status(200).json({
        totalGenerations: totalCount,
        recentEntries: all.length,
        byModule,
        oldestEntry: all.length > 0 ? all[all.length - 1].createdAt : null,
        newestEntry: all.length > 0 ? all[0].createdAt : null,
      });
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });

  } catch (error: any) {
    console.error('[History API] Error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}