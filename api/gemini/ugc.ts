// api/gemini/ugc.ts - Usando @upstash/redis con variables KV_REST_API_*
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';
import { Redis } from '@upstash/redis';
import { Client as QStashClient } from '@upstash/qstash';

const RETRY_DELAY_MS = 3000;

type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';
interface Job {
  id: string;
  status: JobStatus;
  result?: string;
  error?: string;
  createdAt: number;
  updatedAt: number;
  shotIndex?: number;
  totalShots?: number;
}

// Usar variables KV_REST_API_* que Vercel inyecta automáticamente
const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

function generateJobId(): string {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
}

function getCredentials(): Record<string, unknown> {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '';
  const decoded = raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf-8');
  return JSON.parse(decoded);
}

function getGenAIClient(location: string): GoogleGenAI {
  return new GoogleGenAI({
    vertexai: true,
    project: process.env.GCP_PROJECT_ID!,
    location,
    googleAuthOptions: { credentials: getCredentials() },
  });
}

function cleanBase64(b64: string): string {
  if (!b64) return '';
  return b64.replace(/^data:image\/(png|jpeg|webp);base64,/, '').replace(/\s/g, '');
}

// Guardar job en Redis con TTL de 1 hora
async function saveJob(job: Job): Promise<void> {
  await redis.set(`job:${job.id}`, JSON.stringify(job), { ex: 3600 });
}

async function getJob(jobId: string): Promise<Job | null> {
  const data = await redis.get(`job:${jobId}`);
  if (!data) return null;
  if (typeof data === 'string') return JSON.parse(data);
  return data as Job;
}

async function processGenerationJob(
  jobId: string,
  parts: any[],
  aspectRatio: string
): Promise<void> {
  let job = await getJob(jobId);
  if (!job) return;

  job.status = 'processing';
  job.updatedAt = Date.now();
  await saveJob(job);

  try {
    const models = [
      { name: 'gemini-3.1-flash-image-preview', location: 'global' },
      { name: 'gemini-3-pro-image-preview', location: 'global' },
      { name: 'gemini-2.5-flash-image', location: 'us-central1' },
    ];

    for (const model of models) {
      try {
        console.log(`[UGC Job ${jobId}] Trying model: ${model.name}`);
        const ai = getGenAIClient(model.location);
        const response = await ai.models.generateContent({
          model: model.name,
          contents: [{ role: 'user', parts }],
          config: { responseModalities: ['TEXT', 'IMAGE'] },
        });

        for (const candidate of (response.candidates || [])) {
          for (const part of (candidate.content?.parts || [])) {
            if (part.inlineData?.data) {
              const mime = part.inlineData.mimeType || 'image/png';
              const imageData = `data:${mime};base64,${part.inlineData.data}`;
              job.status = 'completed';
              job.result = imageData;
              job.updatedAt = Date.now();
              await saveJob(job);
              console.log(`[UGC Job ${jobId}] Completed with ${model.name}`);
              return;
            }
          }
        }
      } catch (e: any) {
        console.warn(`[UGC Job ${jobId}] Model ${model.name} failed:`, e.message);
      }
    }
    throw new Error('All models failed');
  } catch (error: any) {
    job.status = 'failed';
    job.error = error.message;
    job.updatedAt = Date.now();
    await saveJob(job);
    console.error(`[UGC Job ${jobId}] Failed:`, error.message);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { action, payload } = req.body;
    if (!action) return res.status(400).json({ error: 'Missing action' });

    // Iniciar generación asíncrona
    if (action === 'generateImageAsync') {
      const { prompt, referenceImages, aspectRatio = '3:4', shotIndex, totalShots } = payload;
      if (!prompt) return res.status(400).json({ error: 'Missing prompt' });

      const parts: any[] = [];
      if (referenceImages?.length) {
        for (const ref of referenceImages) {
          if (ref.data && ref.data.length > 64) {
            parts.push({ text: 'REF:' });
            parts.push({ inlineData: { mimeType: ref.mimeType || 'image/jpeg', data: cleanBase64(ref.data) } });
          }
        }
      }
      parts.push({ text: prompt });

      const jobId = generateJobId();
      const job: Job = {
        id: jobId,
        status: 'pending',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        shotIndex,
        totalShots,
      };
      await saveJob(job);

const qstash = new QStashClient({ token: process.env.QSTASH_TOKEN! });
const workerUrl = `${process.env.WORKER_BASE_URL}/api/gemini/ugc-worker`;

await qstash.publishJSON({
  url: workerUrl,
  body: { jobId, parts },
  retries: 2,
});

console.log(`[UGC] Job ${jobId} enqueued → ${workerUrl}`);
return res.status(202).json({ success: true, jobId, status: 'pending', shotIndex, totalShots });
    }

    // Consultar estado
    if (action === 'getJobStatus') {
      const { jobId } = payload;
      if (!jobId) return res.status(400).json({ error: 'Missing jobId' });

      const job = await getJob(jobId);
      if (!job) return res.status(404).json({ error: 'Job not found' });

      const response: any = {
        jobId: job.id,
        status: job.status,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
        shotIndex: job.shotIndex,
        totalShots: job.totalShots,
      };
      if (job.status === 'completed') response.image = job.result;
      if (job.status === 'failed') response.error = job.error;
      return res.status(200).json(response);
    }

    // ==================== ANÁLISIS (síncronos) ====================
    if (action === 'analyzeREF0') {
      const { imageData, mimeType } = payload;
      const ai = getGenAIClient('us-central1');
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          { text: "Analyze this image. Respond ONLY with JSON." },
          { inlineData: { mimeType: mimeType || 'image/jpeg', data: cleanBase64(imageData) } },
          { text: `{
  "lighting": { "primarySource": "string", "direction": "string", "colorTemperature": "string", "shadowType": "string", "intensity": "string" },
  "spatial": { "elements": ["string"], "walls": "string", "floor": "string", "geometry": "string" },
  "poseContext": { "hasSeating": "boolean", "hasLeaningSurface": "boolean", "hasTable": "boolean", "availableActions": ["string"] }
}` }
        ],
        config: { responseMimeType: 'application/json' }
      });
      const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      const clean = text.replace(/```json|```/g, '').trim();
      return res.status(200).json(JSON.parse(clean));
    }

    if (action === 'analyzeProductRelevance') {
      const { productRef, focus, outfitRef, sceneRef, sceneText } = payload;
      const parts: any[] = [];
      if (productRef?.data) {
        parts.push({ text: 'PRODUCT IMAGE:' });
        parts.push({ inlineData: { mimeType: productRef.mimeType || 'image/jpeg', data: cleanBase64(productRef.data) } });
      }
      if (focus === 'OUTFIT' && outfitRef?.data) {
        parts.push({ text: 'OUTFIT REFERENCE:' });
        parts.push({ inlineData: { mimeType: outfitRef.mimeType || 'image/jpeg', data: cleanBase64(outfitRef.data) } });
      }
      if (focus === 'SCENE' && sceneRef?.data) {
        parts.push({ text: 'SCENE REFERENCE:' });
        parts.push({ inlineData: { mimeType: sceneRef.mimeType || 'image/jpeg', data: cleanBase64(sceneRef.data) } });
      }
      parts.push({ text: `
Analyze if product is relevant to ${focus} context.
${focus === 'OUTFIT' ? 'Is this a complement to the outfit (jewelry, bag, belt, shoes = YES)?' : ''}
${focus === 'SCENE' ? 'Does this product naturally belong in this environment?' : ''}
${sceneText ? `Scene description: ${sceneText}` : ''}
Respond ONLY with JSON: { "isRelevant": boolean, "suggestion": "string", "productType": "jewelry|accessory|clothing|electronics|food|sports|home|other" }
` });
      const ai = getGenAIClient('us-central1');
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts }],
        config: { responseMimeType: 'application/json' }
      });
      const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      const clean = text.replace(/```json|```/g, '').trim();
      return res.status(200).json(JSON.parse(clean));
    }

    if (action === 'analyzeOutfit') {
      const { imageData, mimeType } = payload;
      const ai = getGenAIClient('us-central1');
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          { text: "Analyze this outfit. Respond ONLY with JSON." },
          { inlineData: { mimeType: mimeType || 'image/jpeg', data: cleanBase64(imageData) } },
          { text: `{ "hasJacket": "boolean", "hasPants": "boolean", "hasShoes": "boolean", "hasAccessories": "boolean", "hasDetail": "boolean", "fabricType": "string", "colors": ["string"], "hasTop": "boolean", "hasBottom": "boolean", "hasBelt": "boolean", "hasBag": "boolean", "hasHat": "boolean", "hasNecklace": "boolean", "bottomType": "shorts|pants|skirt|unknown" }` }
        ],
        config: { responseMimeType: 'application/json' }
      });
      const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      const clean = text.replace(/```json|```/g, '').trim();
      return res.status(200).json(JSON.parse(clean));
    }

    if (action === 'analyzeScene') {
      const { imageData, mimeType } = payload;
      const ai = getGenAIClient('us-central1');
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          { text: "Analyze this scene. Respond ONLY with JSON." },
          { inlineData: { mimeType: mimeType || 'image/jpeg', data: cleanBase64(imageData) } },
          { text: `{ "hasFurniture": "boolean", "hasNature": "boolean", "hasEquipment": "boolean", "hasTable": "boolean", "hasSeating": "boolean", "hasWindows": "boolean", "hasProps": "boolean", "sceneType": "string" }` }
        ],
        config: { responseMimeType: 'application/json' }
      });
      const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      const clean = text.replace(/```json|```/g, '').trim();
      return res.status(200).json(JSON.parse(clean));
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });
  } catch (error: any) {
    console.error('UGC API error:', error);
    return res.status(500).json({ success: false, error: error.message || 'UGC generation failed' });
  }
}