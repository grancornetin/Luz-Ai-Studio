/**
 * api/batch.ts
 *
 * Función única que maneja el sistema batch de importación de prompts.
 *
 * Rutas:
 *   POST /api/batch  { action: 'import',  ...}  → crea batch y encola en QStash
 *   POST /api/batch  { action: 'worker',  ...}  → procesa un item del batch
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Client as QStashClient } from '@upstash/qstash';
import { FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { getApps } from 'firebase-admin/app';
import { GoogleGenAI } from '@google/genai';
import { adminDb } from '../src/server/firebaseAdmin.js';

// ── Constantes ────────────────────────────────────────────────────────────────

const GLOBAL_PROMPTS     = 'globalPrompts';
const BATCH_AUTHOR_ID    = 'batch_importer';
const BATCH_AUTHOR_NAME  = 'LUZ IA Studio';

// ── QStash ────────────────────────────────────────────────────────────────────

let _qstash: QStashClient | null = null;
function getQStash(): QStashClient {
  if (!_qstash) _qstash = new QStashClient({ token: process.env.QSTASH_TOKEN! });
  return _qstash;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function createId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function getBaseUrl(req: VercelRequest): string {
  if (process.env.BASE_URL) return process.env.BASE_URL.replace(/\/$/, '');
  const host = req.headers.host;
  if (!host) throw new Error('BASE_URL missing and host unavailable.');
  return `${host.includes('localhost') ? 'http' : 'https'}://${host}`;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

function assertSecret(req: VercelRequest, body: Record<string, any>, envKey: string): void {
  const expected = process.env[envKey];
  if (!expected) throw Object.assign(new Error(`Missing ${envKey} env var.`), { statusCode: 500 });
  const header = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  const inBody  = body?.adminSecret || '';
  if (header !== expected && inBody !== expected) {
    throw Object.assign(new Error('Unauthorized.'), { statusCode: 401 });
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// ACTION: import
// ══════════════════════════════════════════════════════════════════════════════

type PreparedPromptItem = {
  raw: string;
  category?: string;
  tags?: string[];
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

async function handleImport(req: VercelRequest, res: VercelResponse) {
  assertSecret(req, req.body, 'BATCH_ADMIN_SECRET');

  const { batchName, prompts = [] } = req.body as { batchName?: string; prompts?: PreparedPromptItem[] };

  if (!Array.isArray(prompts) || prompts.length === 0)
    return res.status(400).json({ ok: false, error: 'Body must include a non-empty prompts array.' });
  if (prompts.length > 500)
    return res.status(400).json({ ok: false, error: 'Batch too large. Max 500 prompts per batch.' });
  if (!process.env.QSTASH_TOKEN)
    return res.status(500).json({ ok: false, error: 'Missing QSTASH_TOKEN env var.' });

  const baseUrl   = getBaseUrl(req);
  const workerUrl = process.env.QSTASH_BATCH_WORKER_URL || `${baseUrl}/api/batch`;
  const batchId   = createId('batch');
  const now       = new Date();
  const rateDelay = Number(process.env.BATCH_ITEM_DELAY_SECONDS   || 8);
  const maxJitter = Number(process.env.BATCH_DELAY_JITTER_SECONDS || 3);

  await adminDb.collection('prompt_batches').doc(batchId).set({
    id: batchId,
    name: batchName || 'batch_prompt_import',
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

  const createdIds: string[] = [];

  for (let i = 0; i < prompts.length; i++) {
    const item = prompts[i];
    if (!item.raw || typeof item.raw !== 'string') continue;

    const itemId = createId('item');
    createdIds.push(itemId);

    await adminDb.collection('prompt_batch_items').doc(itemId).set({
      id: itemId, batchId, index: i,
      rawPrompt:       item.raw,
      category:        item.category     || 'other',
      preparedTags:    item.tags         || [],
      sourceId:        item.sourceId     || null,
      sourceUrl:       item.sourceUrl    || null,
      sourceImage:     item.sourceImage  || null,
      sourceImages:    item.sourceImages || [],
      sourceRank:      item.rank         || null,
      sourceLikes:     item.likes        || null,
      sourceViews:     item.views        || null,
      sourceAuthor:    item.author       || null,
      sourceAuthorName:item.authorName   || null,
      status: 'queued', attempts: 0, error: null,
      createdAt: now, updatedAt: now,
    });

    const delaySeconds = i * rateDelay + Math.floor(Math.random() * (maxJitter + 1));

    await getQStash().publishJSON({
      url:     workerUrl,
      body:    { action: 'worker', itemId, batchId, adminSecret: process.env.BATCH_WORKER_SECRET },
      delay:   delaySeconds,
      retries: 2,
    });
  }

  await adminDb.collection('prompt_batches').doc(batchId).update({
    status: 'processing', pending: createdIds.length, updatedAt: new Date(),
  });

  return res.status(200).json({
    ok: true, batchId,
    totalReceived: prompts.length,
    totalQueued:   createdIds.length,
    workerUrl,
    delaySecondsBetweenItems: rateDelay,
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// ACTION: worker — normalización, imagen, publicación
// ══════════════════════════════════════════════════════════════════════════════

// ── Normalización ─────────────────────────────────────────────────────────────

const PREFERRED_KEYS = [
  'assembled_prompt','full_prompt_string','full_prompt_text','main_prompt',
  'prompt_text','prompt','image_prompt','scene_prompt',
  'description','scene_description','subject','style','environment',
  'background','lighting','composition','camera','mood','quality',
  'outfit','attire','setting','pose','visible_body','negative_prompt',
];
const IGNORED_KEYS = new Set([
  'id','version','batch_size','steps','cfg_scale','model_version',
  'dialogue','audio','subtitles','raw_text','rank','date','author',
  'author_name','model','source_url','image','images','likes','views','title',
]);

function shouldIgnoreKey(k: string): boolean { return IGNORED_KEYS.has(k.toLowerCase()); }

function shouldIgnoreText(t: string, hint: string): boolean {
  const l = t.toLowerCase(), h = hint.toLowerCase();
  if (l.length < 3) return true;
  if (h.includes('audio') || h.includes('dialogue')) return true;
  if (l.includes('all prompts in alt')) return true;
  if (l.includes('open gemini') && l.includes('upload')) return true;
  return false;
}

function cleanFrag(t: string): string {
  return t.replace(/\s+/g,' ').replace(/[""]/g,'"').replace(/['']/g,"'").trim();
}

function walkJson(val: unknown, hint = '', out: string[] = []): string[] {
  if (typeof val === 'string') {
    const c = cleanFrag(val);
    if (c.length > 2 && !shouldIgnoreText(c, hint)) out.push(c);
    return out;
  }
  if (Array.isArray(val)) { val.forEach(v => walkJson(v, hint, out)); return out; }
  if (val && typeof val === 'object') {
    const obj = val as Record<string,unknown>;
    Object.keys(obj)
      .sort((a,b) => {
        const ai = PREFERRED_KEYS.indexOf(a), bi = PREFERRED_KEYS.indexOf(b);
        return (ai<0?999:ai)-(bi<0?999:bi);
      })
      .forEach(k => { if (!shouldIgnoreKey(k)) walkJson(obj[k], k, out); });
  }
  return out;
}

function sanitizeJson(s: string): string {
  return s.replace(/[""]/g,'"').replace(/['']/g,"'");
}

function extractByRegex(s: string): string[] {
  return (s.match(/"([^"\\]{20,})"/g)||[])
    .map(m => m.slice(1,-1).trim())
    .filter(t => !shouldIgnoreText(t,''));
}

function finalizePrompt(p: string): string {
  const c = cleanFrag(p)
    .replace(/https?:\/\/\S+/g,'')
    .replace(/Gemini Promt\s*[^\w\s]/gi,'')
    .replace(/Step\s*\d\.[^"]{0,200}/gi,'')
    .replace(/\s+/g,' ').trim();
  return /no artifacts/i.test(c) ? c
    : `${c}, ultra detailed, sharp focus, professional lighting, no artifacts, no noise`;
}

function normalizePrompt(raw: string): string {
  const t = raw.trim();
  if (!t) return '';
  if (t.startsWith('{') || t.startsWith('[')) {
    for (const attempt of [t, sanitizeJson(t)]) {
      try {
        const frags = walkJson(JSON.parse(attempt));
        const d = Array.from(new Set(frags.map(cleanFrag))).filter(Boolean);
        if (d.length > 0) return finalizePrompt(d.join(', '));
      } catch { /* continue */ }
    }
    const frags = extractByRegex(sanitizeJson(t));
    const d = Array.from(new Set(frags.map(cleanFrag))).filter(Boolean);
    if (d.length > 0) return finalizePrompt(d.join(', '));
  }
  return finalizePrompt(t);
}

// ── Título y tags ─────────────────────────────────────────────────────────────

function generateTitle(prompt: string, category: string): string {
  const c = prompt.replace(/^(create|generate|ultra-realistic|photorealistic)\s+/i,'').split(/[,.]/)[0].trim();
  return (c || `${category.charAt(0).toUpperCase()}${category.slice(1)} Prompt`).slice(0, 72);
}

const TAG_RULES: Array<[string, string[]]> = [
  ['product',     ['product','bottle','can','packaging','brand','advertising','ecommerce','skincare']],
  ['fashion',     ['fashion','outfit','dress','editorial','model','luxury','lookbook']],
  ['food',        ['food','recipe','cake','chicken','ice cream','dessert','biryani','ingredients']],
  ['portrait',    ['portrait','face','selfie','woman','man','person','skin texture']],
  ['ugc',         ['iphone','smartphone','candid','mirror selfie','camera roll','lifestyle']],
  ['cinematic',   ['cinematic','dramatic','chiaroscuro','rim light']],
  ['studio',      ['studio','seamless','white background','controlled lighting']],
  ['infographic', ['infographic','annotation','labels','diagram','technical']],
  ['3d',          ['3d','isometric','diorama','pixar','render','icon']],
  ['macro',       ['macro','close-up','extreme close-up','100mm']],
];

function generateTags(prompt: string, category: string): string[] {
  const p = prompt.toLowerCase();
  const tags = new Set<string>([category || 'other']);
  for (const [tag, needles] of TAG_RULES)
    if (needles.some(n => p.includes(n))) tags.add(tag);
  return Array.from(tags).slice(0, 6);
}

// ── Generación de título con Gemini ──────────────────────────────────────────

function getGenAIClient(): GoogleGenAI {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '';
  const credentials = JSON.parse(raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf-8'));
  return new GoogleGenAI({
    vertexai: true,
    project: process.env.GCP_PROJECT_ID!,
    location: process.env.GCP_LOCATION || 'us-central1',
    googleAuthOptions: { credentials },
  });
}

async function generateTitleWithGemini(prompt: string, category: string): Promise<string> {
  try {
    const ai = getGenAIClient();
    const systemPrompt = `You are a creative director naming images for a professional AI image gallery.
Given a generation prompt and category, create a SHORT, evocative title (4-7 words max).
Rules:
- NO technical words (ultra detailed, sharp focus, professional lighting, no artifacts)
- NO generic words (beautiful, stunning, amazing, perfect)
- Focus on the SUBJECT and MOOD of the image
- Title case format
- Return ONLY the title, nothing else`;

    const userPrompt = `Category: ${category}\nPrompt: ${prompt.slice(0, 400)}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      config: { systemInstruction: systemPrompt, maxOutputTokens: 30, temperature: 0.7 },
    });

    const title = response.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
    // Validar que sea razonable: entre 3 y 80 caracteres
    if (title.length >= 3 && title.length <= 80) return title;
  } catch {
    // Si falla Gemini, usar el fallback local sin interrumpir el batch
  }
  return generateTitle(prompt, category);
}

// ── Generación de imagen ──────────────────────────────────────────────────────

async function startImageGeneration(baseUrl: string, prompt: string): Promise<string> {
  const headers: Record<string,string> = { 'Content-Type': 'application/json' };
  if (process.env.BATCH_INTERNAL_API_SECRET)
    headers['Authorization'] = `Bearer ${process.env.BATCH_INTERNAL_API_SECRET}`;

  const res = await fetch(`${baseUrl}/api/gemini/image`, {
    method: 'POST', headers,
    body: JSON.stringify({
      action: 'generateImageAsync',
      payload: { prompt, aspectRatio: '3:4', modelId: 'gemini', module: 'batch_prompt_importer' },
    }),
  });
  if (!res.ok) throw new Error(`Image start failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  if (!data.jobId) throw new Error('No jobId in image response.');
  return data.jobId;
}

async function pollImageGeneration(baseUrl: string, jobId: string): Promise<string> {
  const maxAttempts = Number(process.env.BATCH_IMAGE_POLL_ATTEMPTS    || 90);
  const intervalMs  = Number(process.env.BATCH_IMAGE_POLL_INTERVAL_MS || 2500);
  const headers: Record<string,string> = { 'Content-Type': 'application/json' };
  if (process.env.BATCH_INTERNAL_API_SECRET)
    headers['Authorization'] = `Bearer ${process.env.BATCH_INTERNAL_API_SECRET}`;

  for (let i = 1; i <= maxAttempts; i++) {
    await new Promise(r => setTimeout(r, intervalMs));
    const res = await fetch(`${baseUrl}/api/gemini/image`, {
      method: 'POST', headers,
      body: JSON.stringify({ action: 'getJobStatus', payload: { jobId } }),
    });
    if (!res.ok) throw new Error(`Poll failed: ${res.status} ${await res.text()}`);
    const data = await res.json();
    if (data.status === 'completed') {
      if (!data.image) throw new Error('Job completed but no image.');
      return data.image as string;
    }
    if (data.status === 'failed') throw new Error(data.error || 'Image generation failed.');
  }
  throw new Error('Image generation timeout.');
}

// ── Upload a Firebase Storage ─────────────────────────────────────────────────

async function uploadImageToStorage(base64: string, authorId: string): Promise<string> {
  if (!base64.startsWith('data:')) return base64;
  const match = base64.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/s);
  if (!match) throw new Error('Invalid base64 image format');

  const mimeType  = match[1];
  const ext       = mimeType.split('/')[1] || 'jpg';
  const filePath  = `globalPrompts/${authorId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

  const rawKey     = process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '';
  const creds      = JSON.parse(rawKey.startsWith('{') ? rawKey : Buffer.from(rawKey,'base64').toString('utf-8'));
  const bucketName = process.env.FIREBASE_STORAGE_BUCKET || `${creds.project_id}.firebasestorage.app`;

  const bucket = getStorage(getApps()[0]).bucket(bucketName);
  await bucket.file(filePath).save(Buffer.from(match[2], 'base64'), {
    metadata: { contentType: mimeType }, public: true,
  });
  return `https://storage.googleapis.com/${bucket.name}/${filePath}`;
}

// ── Contadores batch ──────────────────────────────────────────────────────────

async function updateBatchCounters(batchId: string, success: boolean): Promise<void> {
  const ref = adminDb.collection('prompt_batches').doc(batchId);
  await ref.update({
    pending:   FieldValue.increment(-1),
    completed: FieldValue.increment(success ? 1 : 0),
    failed:    FieldValue.increment(success ? 0 : 1),
    updatedAt: new Date(),
  });
  const snap = await ref.get();
  const data = snap.data();
  if (!data) return;
  if (Number(data.completed) + Number(data.failed) >= Number(data.total)) {
    await ref.update({
      status:     Number(data.failed) > 0 ? 'completed_with_errors' : 'completed',
      finishedAt: new Date(), updatedAt: new Date(),
    });
  }
}

// ── Worker handler ────────────────────────────────────────────────────────────

async function handleWorker(req: VercelRequest, res: VercelResponse) {
  const body = req.body as Record<string, any>;
  assertSecret(req, body, 'BATCH_WORKER_SECRET');

  const { itemId, batchId } = body;
  if (!itemId) return res.status(400).json({ ok: false, error: 'Missing itemId.' });

  const itemRef  = adminDb.collection('prompt_batch_items').doc(itemId);
  const itemSnap = await itemRef.get();
  if (!itemSnap.exists) return res.status(404).json({ ok: false, error: 'Item not found.' });

  const item = itemSnap.data() as any;

  if (item.status === 'completed')
    return res.status(200).json({ ok: true, skipped: true, reason: 'Already completed.' });

  if (Number(item.attempts || 0) >= Number(process.env.BATCH_MAX_ITEM_ATTEMPTS || 2))
    return res.status(200).json({ ok: false, skipped: true, reason: 'Max attempts reached.' });

  await itemRef.update({ status: 'processing', attempts: FieldValue.increment(1), updatedAt: new Date() });

  const baseUrl          = getBaseUrl(req);
  const normalizedPrompt = normalizePrompt(item.rawPrompt);
  const category         = item.category || 'other';
  const title            = await generateTitleWithGemini(normalizedPrompt, category);
  const tags             = (Array.isArray(item.preparedTags) && item.preparedTags.length > 0)
    ? item.preparedTags
    : generateTags(normalizedPrompt, category);

  const jobId      = await startImageGeneration(baseUrl, normalizedPrompt);
  const base64Img  = await pollImageGeneration(baseUrl, jobId);
  const imageUrl   = await uploadImageToStorage(base64Img, BATCH_AUTHOR_ID);

  const now = new Date();
  const ref = await adminDb.collection(GLOBAL_PROMPTS).add({
    id: '', title, promptText: normalizedPrompt,
    promptDNA: {
      persons:[], personLayers:[], products:[],
      styles:[category], lighting:[], background:[], composition:[], details:[],
    },
    imageUrl, authorId: BATCH_AUTHOR_ID, authorName: BATCH_AUTHOR_NAME,
    authorPhotoURL: '', tags,
    likes:0, likedBy:[], saves:0, commentsCount:0,
    generations:[], isPublic:true, isPrivate:false, reportedBy:[], isFlagged:false,
    origin:'batch_import', importBatchId: item.batchId, importItemId: item.id,
    sourceId:    item.sourceId       || null,
    sourceUrl:   item.sourceUrl      || null,
    sourceImage: item.sourceImage    || null,
    sourceImages:item.sourceImages   || [],
    sourceRank:  item.sourceRank     || null,
    sourceLikes: item.sourceLikes    || null,
    sourceViews: item.sourceViews    || null,
    sourceAuthor:     item.sourceAuthor     || null,
    sourceAuthorName: item.sourceAuthorName || null,
    createdAt: now, updatedAt: now,
  });
  await ref.update({ id: ref.id });

  await itemRef.update({
    status:'completed', normalizedPrompt,
    publishedPromptId: ref.id,
    error:null, updatedAt:now, completedAt:now,
  });
  await updateBatchCounters(item.batchId, true);

  return res.status(200).json({ ok:true, itemId, batchId:item.batchId, publishedPromptId:ref.id });
}

// ══════════════════════════════════════════════════════════════════════════════
// Handler principal
// ══════════════════════════════════════════════════════════════════════════════

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST')
    return res.status(405).json({ ok: false, error: 'Method not allowed. Use POST.' });

  const action = req.body?.action;

  try {
    if (action === 'import') return await handleImport(req, res);
    if (action === 'worker') return await handleWorker(req, res);
    return res.status(400).json({ ok: false, error: `Unknown action: ${action}. Use 'import' or 'worker'.` });
  } catch (err: any) {
    console.error(`[batch/${action}] error:`, err);
    // Marcar item como failed si el worker lanzó excepción no controlada
    if (action === 'worker' && req.body?.itemId) {
      try {
        const itemRef  = adminDb.collection('prompt_batch_items').doc(req.body.itemId);
        const itemSnap = await itemRef.get();
        if (itemSnap.exists) {
          await itemRef.update({ status:'failed', error:err.message, updatedAt:new Date(), failedAt:new Date() });
          await updateBatchCounters(itemSnap.data()!.batchId, false);
        }
      } catch { /* ignore nested error */ }
    }
    return res.status(err.statusCode || 500).json({ ok: false, error: err.message || 'Internal error.' });
  }
}
