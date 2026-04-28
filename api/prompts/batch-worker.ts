/**
 * api/prompts/batch-worker.ts
 *
 * Procesa UN item del batch:
 * 1. Lee item desde prompt_batch_items
 * 2. Normaliza prompt
 * 3. Genera imagen via /api/gemini/image (action: generateImageAsync)
 * 4. Polling via action: getJobStatus
 * 5. Sube imagen a Firebase Storage (igual que promptService.publishPrompt)
 * 6. Publica en colección globalPrompts con schema real del proyecto
 * 7. Actualiza contadores del batch
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { getApps } from 'firebase-admin/app';
import { adminDb } from '../../src/server/firebaseAdmin.js';

// ── Constantes ────────────────────────────────────────────────────────────────

const GLOBAL_PROMPTS = 'globalPrompts';

// authorId especial para prompts del batch — no corresponde a ningún usuario real
const BATCH_AUTHOR_ID   = 'batch_importer';
const BATCH_AUTHOR_NAME = 'LUZ IA Studio';

// ── Tipos ─────────────────────────────────────────────────────────────────────

type BatchWorkerBody = {
  itemId?: string;
  batchId?: string;
  adminSecret?: string;
};

type BatchItemDoc = {
  id: string;
  batchId: string;
  rawPrompt: string;
  category?: string;
  sourceId?: string | null;
  sourceUrl?: string | null;
  sourceImage?: string | null;
  sourceImages?: string[];
  sourceRank?: number | null;
  sourceLikes?: number | null;
  sourceViews?: number | null;
  sourceAuthor?: string | null;
  sourceAuthorName?: string | null;
  attempts?: number;
  status?: string;
};

// ── Auth ──────────────────────────────────────────────────────────────────────

function assertWorkerAuth(req: VercelRequest, body: BatchWorkerBody): void {
  const expected = process.env.BATCH_WORKER_SECRET;
  if (!expected) throw new Error('Missing BATCH_WORKER_SECRET env var.');

  const headerToken = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  const bodyToken   = body.adminSecret || '';

  if (headerToken !== expected && bodyToken !== expected) {
    const err = new Error('Unauthorized worker request.');
    (err as any).statusCode = 401;
    throw err;
  }
}

function getBaseUrl(req: VercelRequest): string {
  if (process.env.BASE_URL) return process.env.BASE_URL.replace(/\/$/, '');
  const host = req.headers.host;
  if (!host) throw new Error('BASE_URL is missing and request host is unavailable.');
  const protocol = host.includes('localhost') ? 'http' : 'https';
  return `${protocol}://${host}`;
}

// ── Normalización de prompt ───────────────────────────────────────────────────

const PREFERRED_KEYS = [
  'assembled_prompt', 'full_prompt_string', 'full_prompt_text', 'main_prompt',
  'prompt', 'description', 'scene_description', 'subject', 'style', 'environment',
  'background', 'lighting', 'composition', 'camera', 'mood', 'quality',
  'negative_prompt',
];

const IGNORED_KEYS = new Set([
  'id', 'version', 'batch_size', 'steps', 'cfg_scale', 'model_version',
  'dialogue', 'audio', 'subtitles', 'raw_text', 'rank', 'date', 'author',
  'author_name', 'model', 'source_url', 'image', 'images', 'likes', 'views',
]);

function shouldIgnoreKey(key: string): boolean {
  return IGNORED_KEYS.has(key.toLowerCase());
}

function shouldIgnoreText(text: string, keyHint: string): boolean {
  const lower = text.toLowerCase();
  const key   = keyHint.toLowerCase();
  if (lower.length < 3) return true;
  if (key.includes('audio') || key.includes('dialogue')) return true;
  if (lower.includes('all prompts in alt')) return true;
  if (lower.includes('open gemini') && lower.includes('upload')) return true;
  if (lower.includes('step 1') && lower.includes('open gemini')) return true;
  if (lower.includes('follow me') || lower.includes('like and retweet')) return true;
  return false;
}

function cleanFragment(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    .trim();
}

function walkJson(value: unknown, keyHint = '', out: string[]): void {
  if (typeof value === 'string') {
    const cleaned = cleanFragment(value);
    if (cleaned.length > 2 && !shouldIgnoreText(cleaned, keyHint)) out.push(cleaned);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach(v => walkJson(v, keyHint, out));
    return;
  }
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort((a, b) => {
      const ai = PREFERRED_KEYS.indexOf(a);
      const bi = PREFERRED_KEYS.indexOf(b);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });
    for (const key of keys) {
      if (shouldIgnoreKey(key)) continue;
      walkJson(obj[key], key, out);
    }
  }
}

function sanitizeJsonString(raw: string): string {
  return raw.replace(/[""]/g, '"').replace(/['']/g, "'");
}

function extractTextByRegex(raw: string): string[] {
  const matches = raw.match(/"([^"\\]{20,})"/g) || [];
  return matches
    .map(m => m.slice(1, -1).trim())
    .filter(t => !shouldIgnoreText(t, ''));
}

function normalizePrompt(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    // Intento 1: JSON válido
    try {
      const parsed = JSON.parse(trimmed);
      const frags: string[] = [];
      walkJson(parsed, '', frags);
      const deduped = Array.from(new Set(frags.map(cleanFragment))).filter(Boolean);
      if (deduped.length > 0) return finalizePrompt(deduped.join(', '));
    } catch { /* seguir */ }

    // Intento 2: sanear comillas tipográficas
    try {
      const parsed = JSON.parse(sanitizeJsonString(trimmed));
      const frags: string[] = [];
      walkJson(parsed, '', frags);
      const deduped = Array.from(new Set(frags.map(cleanFragment))).filter(Boolean);
      if (deduped.length > 0) return finalizePrompt(deduped.join(', '));
    } catch { /* seguir */ }

    // Intento 3: extracción por regex
    const frags  = extractTextByRegex(sanitizeJsonString(trimmed));
    const deduped = Array.from(new Set(frags.map(cleanFragment))).filter(Boolean);
    if (deduped.length > 0) return finalizePrompt(deduped.join(', '));
  }

  return finalizePrompt(trimmed);
}

function finalizePrompt(prompt: string): string {
  const cleaned = prompt
    .replace(/https?:\/\/\S+/g, '')
    .replace(/Gemini Promt\s*[^\w\s]/gi, '')
    .replace(/Step\s*\d\.[^"]{0,200}/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  const lower = cleaned.toLowerCase();
  if (lower.includes('no artifacts') && lower.includes('sharp focus')) return cleaned;
  return `${cleaned}, ultra detailed, sharp focus, professional lighting, no artifacts, no noise`;
}

// ── Título y tags ─────────────────────────────────────────────────────────────

function generateTitle(prompt: string, category: string): string {
  const cleaned = prompt
    .replace(/^(create|generate|ultra-realistic|photorealistic)\s+/i, '')
    .split(/[,.]/)[0]
    .trim();
  const fallback = `${category.charAt(0).toUpperCase()}${category.slice(1)} Prompt`;
  return (cleaned || fallback).slice(0, 72);
}

const TAG_RULES: Array<[string, string[]]> = [
  ['product',    ['product', 'bottle', 'can', 'packaging', 'brand', 'advertising', 'ecommerce', 'skincare']],
  ['fashion',    ['fashion', 'outfit', 'dress', 'editorial', 'model', 'luxury', 'lookbook']],
  ['food',       ['food', 'recipe', 'cake', 'chicken', 'ice cream', 'dessert', 'biryani', 'ingredients']],
  ['portrait',   ['portrait', 'face', 'selfie', 'woman', 'man', 'person', 'skin texture']],
  ['ugc',        ['iphone', 'smartphone', 'candid', 'mirror selfie', 'camera roll', 'lifestyle']],
  ['cinematic',  ['cinematic', 'dramatic', 'chiaroscuro', 'rim light']],
  ['studio',     ['studio', 'seamless', 'white background', 'controlled lighting']],
  ['infographic',['infographic', 'annotation', 'labels', 'diagram', 'technical', 'blueprint']],
  ['3d',         ['3d', 'isometric', 'diorama', 'pixar', 'render', 'icon']],
  ['macro',      ['macro', 'close-up', 'extreme close-up', '100mm']],
];

function generateTags(prompt: string, category: string): string[] {
  const p    = prompt.toLowerCase();
  const tags = new Set<string>([category || 'other']);
  for (const [tag, needles] of TAG_RULES) {
    if (needles.some(n => p.includes(n))) tags.add(tag);
  }
  return Array.from(tags).slice(0, 6);
}

// ── Generación de imagen ──────────────────────────────────────────────────────

async function startImageGeneration(baseUrl: string, prompt: string): Promise<string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (process.env.BATCH_INTERNAL_API_SECRET) {
    headers['Authorization'] = `Bearer ${process.env.BATCH_INTERNAL_API_SECRET}`;
  }

  const res = await fetch(`${baseUrl}/api/gemini/image`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      action: 'generateImageAsync',
      payload: {
        prompt,
        aspectRatio: '3:4',
        modelId: 'gemini',
        module: 'batch_prompt_importer',
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Image generation start failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  if (!data.jobId) throw new Error('Image generation response did not include jobId.');
  return data.jobId;
}

async function pollImageGeneration(baseUrl: string, jobId: string): Promise<string> {
  const maxAttempts = Number(process.env.BATCH_IMAGE_POLL_ATTEMPTS    || 90);
  const intervalMs  = Number(process.env.BATCH_IMAGE_POLL_INTERVAL_MS || 2500);

  const headers: Record<string, string> = {};
  if (process.env.BATCH_INTERNAL_API_SECRET) {
    headers['Authorization'] = `Bearer ${process.env.BATCH_INTERNAL_API_SECRET}`;
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await new Promise(resolve => setTimeout(resolve, intervalMs));

    const res = await fetch(`${baseUrl}/api/gemini/image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({
        action: 'getJobStatus',
        payload: { jobId },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Image polling failed: ${res.status} ${text}`);
    }

    const data = await res.json();

    if (data.status === 'completed') {
      if (!data.image) throw new Error('Job completed but no image payload found.');
      return data.image as string;
    }
    if (data.status === 'failed') {
      throw new Error(data.error || 'Image generation failed.');
    }
  }

  throw new Error('Image generation timeout.');
}

// ── Subida a Firebase Storage ─────────────────────────────────────────────────
// Replica la lógica de uploadPromptImageIfNeeded de promptService.ts
// para que el imageUrl sea una URL pública de Firebase Storage, no base64.

async function uploadImageToStorage(base64: string, authorId: string): Promise<string> {
  if (!base64.startsWith('data:')) return base64;

  const match = base64.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/s);
  if (!match) throw new Error('Invalid base64 image format');

  const mimeType = match[1];
  const ext      = mimeType.split('/')[1] || 'jpg';
  const filename = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  const filePath = `globalPrompts/${authorId}/${filename}`;

  // Obtener bucket name desde service account (igual que image-worker.ts)
  const rawKey      = process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '';
  const credentials = JSON.parse(Buffer.from(rawKey, 'base64').toString('utf-8'));
  const bucketName  = process.env.FIREBASE_STORAGE_BUCKET
    || `${credentials.project_id}.firebasestorage.app`;

  const app    = getApps()[0];
  const bucket = getStorage(app).bucket(bucketName);
  const file   = bucket.file(filePath);
  const buffer = Buffer.from(match[2], 'base64');

  await file.save(buffer, {
    metadata: { contentType: mimeType },
    public: true,
  });

  return `https://storage.googleapis.com/${bucket.name}/${filePath}`;
}

// ── Contadores del batch ──────────────────────────────────────────────────────

async function updateBatchCounters(batchId: string, success: boolean): Promise<void> {
  const batchRef = adminDb.collection('prompt_batches').doc(batchId);

  await batchRef.update({
    pending:   FieldValue.increment(-1),
    completed: FieldValue.increment(success ? 1 : 0),
    failed:    FieldValue.increment(success ? 0 : 1),
    updatedAt: new Date(),
  });

  const snap  = await batchRef.get();
  const batch = snap.data();
  if (!batch) return;

  const total     = Number(batch.total     || 0);
  const completed = Number(batch.completed || 0);
  const failed    = Number(batch.failed    || 0);

  if (completed + failed >= total) {
    await batchRef.update({
      status:     failed > 0 ? 'completed_with_errors' : 'completed',
      finishedAt: new Date(),
      updatedAt:  new Date(),
    });
  }
}

// ── Handler principal ─────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const body = req.body as BatchWorkerBody;

  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ ok: false, error: 'Method not allowed. Use POST.' });
    }

    assertWorkerAuth(req, body);

    const { itemId } = body;
    if (!itemId) return res.status(400).json({ ok: false, error: 'Missing itemId.' });

    const itemRef  = adminDb.collection('prompt_batch_items').doc(itemId);
    const itemSnap = await itemRef.get();

    if (!itemSnap.exists) return res.status(404).json({ ok: false, error: 'Batch item not found.' });

    const item = itemSnap.data() as BatchItemDoc;

    if (item.status === 'completed') {
      return res.status(200).json({ ok: true, skipped: true, reason: 'Already completed.' });
    }

    const attempts    = Number(item.attempts || 0);
    const maxAttempts = Number(process.env.BATCH_MAX_ITEM_ATTEMPTS || 2);

    if (attempts >= maxAttempts) {
      return res.status(200).json({ ok: false, skipped: true, reason: 'Max attempts reached.' });
    }

    await itemRef.update({
      status:    'processing',
      attempts:  FieldValue.increment(1),
      updatedAt: new Date(),
    });

    const baseUrl          = getBaseUrl(req);
    const normalizedPrompt = normalizePrompt(item.rawPrompt);
    const category         = item.category || 'other';
    const title            = generateTitle(normalizedPrompt, category);
    const tags             = generateTags(normalizedPrompt, category);

    // Generar imagen
    const jobId        = await startImageGeneration(baseUrl, normalizedPrompt);
    const base64Image  = await pollImageGeneration(baseUrl, jobId);

    // Subir a Firebase Storage para obtener URL pública
    const imageUrl = await uploadImageToStorage(base64Image, BATCH_AUTHOR_ID);

    const now = new Date();

    // Schema compatible con promptService.ts / globalPrompts collection
    const promptDoc = {
      id:             '',          // se parchea tras addDoc
      title,
      promptText:     normalizedPrompt,
      promptDNA: {
        persons: [], personLayers: [], products: [],
        styles: [category], lighting: [], background: [],
        composition: [], details: [],
      },
      imageUrl,
      authorId:       BATCH_AUTHOR_ID,
      authorName:     BATCH_AUTHOR_NAME,
      authorPhotoURL: '',
      tags,
      likes:          0,
      likedBy:        [],
      saves:          0,
      commentsCount:  0,
      generations:    [],
      isPublic:       true,
      isPrivate:      false,
      reportedBy:     [],
      isFlagged:      false,
      // Metadata del import
      origin:         'batch_import',
      importBatchId:  item.batchId,
      importItemId:   item.id,
      sourceId:       item.sourceId    || null,
      sourceUrl:      item.sourceUrl   || null,
      sourceImage:    item.sourceImage || null,
      sourceImages:   item.sourceImages || [],
      sourceRank:     item.sourceRank  || null,
      sourceLikes:    item.sourceLikes || null,
      sourceViews:    item.sourceViews || null,
      sourceAuthor:   item.sourceAuthor     || null,
      sourceAuthorName: item.sourceAuthorName || null,
      createdAt:      now,
      updatedAt:      now,
    };

    const publishedRef = await adminDb.collection(GLOBAL_PROMPTS).add(promptDoc);
    // Parchar el campo id (igual que promptService.savePrompt)
    await publishedRef.update({ id: publishedRef.id });

    await itemRef.update({
      status:               'completed',
      normalizedPrompt,
      publishedPromptId:    publishedRef.id,
      generatedImagePreview: base64Image.slice(0, 120),
      error:                null,
      updatedAt:            now,
      completedAt:          now,
    });

    await updateBatchCounters(item.batchId, true);

    return res.status(200).json({
      ok:               true,
      itemId,
      batchId:          item.batchId,
      publishedPromptId: publishedRef.id,
    });

  } catch (error) {
    const err = error as Error & { statusCode?: number };
    console.error('[batch-worker] error:', err);

    try {
      if (body?.itemId) {
        const itemRef  = adminDb.collection('prompt_batch_items').doc(body.itemId);
        const itemSnap = await itemRef.get();
        if (itemSnap.exists) {
          const item = itemSnap.data() as BatchItemDoc;
          await itemRef.update({
            status:    'failed',
            error:     err.message || 'Unknown worker error.',
            updatedAt: new Date(),
            failedAt:  new Date(),
          });
          if (item?.batchId) await updateBatchCounters(item.batchId, false);
        }
      }
    } catch (nested) {
      console.error('[batch-worker] failed to mark item as failed:', nested);
    }

    return res.status(err.statusCode || 500).json({
      ok:    false,
      error: err.message || 'Batch worker failed.',
    });
  }
}
