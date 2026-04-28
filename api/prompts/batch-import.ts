/**
 * api/prompts/batch-import.ts
 *
 * POST /api/prompts/batch-import
 * Crea un batch en Firestore y encola cada prompt en QStash.
 *
 * Auth: Authorization: Bearer <BATCH_ADMIN_SECRET>
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { adminDb } from '../../src/server/firebaseAdmin.js';

type PreparedPromptItem = {
  raw: string;
  category?: string;
  sourceId?: string;
  sourceUrl?: string;
  sourceImage?: string;
  sourceImages?: string[];
  rank?: number;
  likes?: number;
  views?: number;
  author?: string;
  authorName?: string;
};

type BatchImportBody = {
  batchName?: string;
  prompts?: PreparedPromptItem[];
};

function createId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function getBaseUrl(req: VercelRequest): string {
  if (process.env.BASE_URL) return process.env.BASE_URL.replace(/\/$/, '');
  const host = req.headers.host;
  if (!host) throw new Error('BASE_URL is missing and request host is unavailable.');
  const protocol = host.includes('localhost') ? 'http' : 'https';
  return `${protocol}://${host}`;
}

function assertInternalAdmin(req: VercelRequest): void {
  const secret = process.env.BATCH_ADMIN_SECRET;
  if (!secret) throw new Error('Missing BATCH_ADMIN_SECRET env var.');

  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (token !== secret) {
    const err = new Error('Unauthorized batch import request.');
    (err as any).statusCode = 401;
    throw err;
  }
}

async function publishToQStash(args: {
  destinationUrl: string;
  token: string;
  body: unknown;
  delaySeconds: number;
}): Promise<void> {
  const { destinationUrl, token, body, delaySeconds } = args;
  const response = await fetch(
    'https://qstash.upstash.io/v2/publish/' + encodeURIComponent(destinationUrl),
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Upstash-Delay': `${delaySeconds}s`,
      },
      body: JSON.stringify(body),
    }
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`QStash publish failed: ${response.status} ${text}`);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ ok: false, error: 'Method not allowed. Use POST.' });
    }

    assertInternalAdmin(req);

    const body = req.body as BatchImportBody;
    const prompts = body.prompts || [];

    if (!Array.isArray(prompts) || prompts.length === 0) {
      return res.status(400).json({ ok: false, error: 'Body must include a non-empty prompts array.' });
    }
    if (prompts.length > 500) {
      return res.status(400).json({ ok: false, error: 'Batch too large. Max 500 prompts per batch.' });
    }

    const qstashToken = process.env.QSTASH_TOKEN;
    if (!qstashToken) {
      return res.status(500).json({ ok: false, error: 'Missing QSTASH_TOKEN env var.' });
    }

    const baseUrl   = getBaseUrl(req);
    const workerUrl = process.env.QSTASH_BATCH_WORKER_URL || `${baseUrl}/api/prompts/batch-worker`;

    const batchId = createId('batch');
    const now     = new Date();

    const batchRef = adminDb.collection('prompt_batches').doc(batchId);
    await batchRef.set({
      id: batchId,
      name: body.batchName || 'batch_prompt_import',
      total: prompts.length,
      pending: prompts.length,
      processing: 0,
      completed: 0,
      failed: 0,
      status: 'queued',
      createdAt: now,
      updatedAt: now,
      source: 'admin_batch_import',
    });

    const rateDelay  = Number(process.env.BATCH_ITEM_DELAY_SECONDS     || 8);
    const maxJitter  = Number(process.env.BATCH_DELAY_JITTER_SECONDS   || 3);
    const createdIds: string[] = [];

    for (let i = 0; i < prompts.length; i++) {
      const item = prompts[i];
      if (!item.raw || typeof item.raw !== 'string') continue;

      const itemId = createId('item');
      createdIds.push(itemId);

      await adminDb.collection('prompt_batch_items').doc(itemId).set({
        id: itemId,
        batchId,
        index: i,
        rawPrompt: item.raw,
        category: item.category || 'other',
        sourceId: item.sourceId || null,
        sourceUrl: item.sourceUrl || null,
        sourceImage: item.sourceImage || null,
        sourceImages: item.sourceImages || [],
        sourceRank: item.rank || null,
        sourceLikes: item.likes || null,
        sourceViews: item.views || null,
        sourceAuthor: item.author || null,
        sourceAuthorName: item.authorName || null,
        status: 'queued',
        attempts: 0,
        error: null,
        createdAt: now,
        updatedAt: now,
      });

      const jitter       = Math.floor(Math.random() * (maxJitter + 1));
      const delaySeconds = i * rateDelay + jitter;

      await publishToQStash({
        destinationUrl: workerUrl,
        token: qstashToken,
        delaySeconds,
        body: {
          itemId,
          batchId,
          adminSecret: process.env.BATCH_WORKER_SECRET,
        },
      });
    }

    await batchRef.update({
      status: 'processing',
      pending: createdIds.length,
      updatedAt: new Date(),
    });

    return res.status(200).json({
      ok: true,
      batchId,
      totalReceived: prompts.length,
      totalQueued: createdIds.length,
      workerUrl,
      delaySecondsBetweenItems: rateDelay,
    });
  } catch (error) {
    const err = error as Error & { statusCode?: number };
    console.error('[batch-import] error:', err);
    return res.status(err.statusCode || 500).json({ ok: false, error: err.message || 'Batch import failed.' });
  }
}
