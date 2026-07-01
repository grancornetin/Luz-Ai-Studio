// api/history.ts
// Historial de generaciones por usuario, almacenado en Upstash Redis.
// Actions: save · list · delete · deleteBatch · clear · stats

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';
import { setSecurityHeaders, setCorsHeaders, sanitizeUid, verifyAuth } from './middleware.js';

const redis = new Redis({
  url:   process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

const MAX_ENTRIES_PER_USER = 100;
const HISTORY_TTL_SECONDS  = 90 * 24 * 60 * 60; // 90 días

interface GenerationRecord {
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
  references?:  Array<Record<string, any>>;
  source?:      string;
  syncedAt?:    string;
}

function imageFingerprint(imageUrl: string): string {
  const raw = (imageUrl || '').trim();
  if (!raw) return '';
  if (raw.startsWith('data:')) {
    return `data:${raw.length}:${raw.slice(0, 96)}:${raw.slice(-96)}`;
  }
  return raw;
}

function normalizeRecord(record: GenerationRecord): GenerationRecord {
  return {
    ...record,
    imageKey: record.imageKey || imageFingerprint(record.imageUrl),
    creditsUsed: Number(record.creditsUsed || 0),
    syncedAt: new Date().toISOString(),
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

function historyKey(uid: string): string {
  return `history:${uid}`;
}

async function getHistory(uid: string): Promise<GenerationRecord[]> {
  const data = await redis.get<GenerationRecord[]>(historyKey(uid));
  return data ?? [];
}

async function setHistory(uid: string, records: GenerationRecord[]): Promise<void> {
  await redis.set(historyKey(uid), records, { ex: HISTORY_TTL_SECONDS });
}

export async function handleHistoryRequest(req: VercelRequest, res: VercelResponse) {
  setSecurityHeaders(res);
  // CORS restringido a la lista blanca centralizada (_middleware.ts).
  if (setCorsHeaders(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let verifiedUid: string;
  try {
    verifiedUid = await verifyAuth(req);
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const uid = sanitizeUid(verifiedUid);

  const { action, payload } = req.body || {};
  if (!action) return res.status(400).json({ error: 'Missing action' });

  try {

    if (action === 'save') {
      const record: GenerationRecord | undefined = payload.record;
      if (!record?.id) return res.status(400).json({ error: 'Missing record' });
      const existing = await getHistory(uid);
      const normalized = normalizeRecord(record);
      const duplicate = existing.find(r =>
        r.id === normalized.id ||
        (normalized.imageKey && r.imageKey === normalized.imageKey) ||
        r.imageUrl === normalized.imageUrl
      );
      const merged = mergeRecord(duplicate, normalized);
      const updated  = [
        merged,
        ...existing.filter(r =>
          r.id !== merged.id &&
          r.id !== duplicate?.id &&
          r.imageKey !== merged.imageKey &&
          r.imageUrl !== merged.imageUrl
        ),
      ].slice(0, MAX_ENTRIES_PER_USER);
      await setHistory(uid, updated);
      return res.status(200).json({ success: true, total: updated.length });
    }

    if (action === 'list') {
      const limit:  number = Math.min(payload?.limit  || 100, 100);
      const offset: number = payload?.offset || 0;
      const all  = await getHistory(uid);
      const page = all.slice(offset, offset + limit);
      return res.status(200).json({ entries: page, total: all.length, hasMore: offset + limit < all.length });
    }

    if (action === 'delete') {
      const id: string | undefined = payload.id;
      if (!id) return res.status(400).json({ error: 'Missing id' });
      const all     = await getHistory(uid);
      const updated = all.filter(r => r.id !== id);
      await setHistory(uid, updated);
      return res.status(200).json({ success: true, removed: all.length - updated.length });
    }

    if (action === 'deleteBatch') {
      const ids: string[] | undefined = payload.ids;
      if (!ids?.length) return res.status(400).json({ error: 'Missing ids array' });
      const idSet   = new Set(ids);
      const all     = await getHistory(uid);
      const updated = all.filter(r => !idSet.has(r.id));
      await setHistory(uid, updated);
      return res.status(200).json({ success: true, removed: all.length - updated.length });
    }

    if (action === 'clear') {
      await redis.del(historyKey(uid));
      return res.status(200).json({ success: true });
    }

    if (action === 'stats') {
      const all = await getHistory(uid);
      const byModule: Record<string, number> = {};
      all.forEach(e => { byModule[e.module] = (byModule[e.module] || 0) + 1; });
      return res.status(200).json({
        totalEntries: all.length,
        byModule,
        oldest: all.length ? all[all.length - 1].createdAt : null,
        newest: all.length ? all[0].createdAt : null,
      });
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });

  } catch (error: any) {
    console.error('[History API] Error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
