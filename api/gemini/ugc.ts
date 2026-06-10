// api/gemini/ugc.ts - Usando @upstash/redis con variables KV_REST_API_*
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';
import { Redis } from '@upstash/redis';
import { Client as QStashClient } from '@upstash/qstash';
import { setCorsHeaders, setSecurityHeaders, validateBase64Image, validatePrompt, getImageRatelimit, checkRateLimit, sanitizeUid, verifyAuth } from '../_middleware.js';

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
  // Notificaciones Nivel 3
  uid?: string;
  sessionId?: string;
  module?: string;
  moduleLabel?: string;
  metadata?: Record<string, any>;
  refunded?: boolean;
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
    // IMPORTANT: Only Gemini 3 models are allowed for image generation.
    // Gemini 2.5 is intentionally excluded — it produces identity/style drift
    // that breaks the UGC consistency guarantees of this module.
    // If all Gemini 3 attempts fail, the job fails cleanly and the client-side
    // auto-retry system (3 silent retries) handles the recovery.
    const models = [
      { name: 'gemini-3.1-flash-image-preview', location: 'global' },
      { name: 'gemini-3-pro-image-preview',      location: 'global' },
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
  setSecurityHeaders(res);
  if (setCorsHeaders(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { action, payload } = req.body;
    if (!action) return res.status(400).json({ error: 'Missing action' });

    // ── Autenticación obligatoria para TODAS las acciones de este endpoint ──
    // Esto evita que un atacante consuma cuota de Gemini gratis o cree jobs
    // a nombre de otro usuario (todas las acciones cobran o devuelven datos).
    let verifiedUid: string;
    try {
      verifiedUid = await verifyAuth(req);
    } catch {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Rate limiting en generaciones
    if (action === 'generateImageAsync') {
      const rlKey = sanitizeUid(verifiedUid);
      const allowed = await checkRateLimit(getImageRatelimit(), rlKey, res);
      if (!allowed) return;

      // Validar prompt
      if (payload?.prompt) {
        const promptErr = validatePrompt(payload.prompt);
        if (promptErr) return res.status(400).json({ error: promptErr });
      }
    }

    // Iniciar generación asíncrona
    if (action === 'generateImageAsync') {
      const {
        prompt, referenceImages, aspectRatio = '3:4',
        shotIndex, totalShots, modelId = 'gemini',
        sessionId, module: moduleName, moduleLabel, metadata,
      } = payload;
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
      const safeUid = sanitizeUid(verifiedUid);
      const job: Job = {
        id: jobId,
        status: 'pending',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        shotIndex,
        totalShots,
        uid: safeUid,
        sessionId,
        module: moduleName,
        moduleLabel,
        metadata,
      };

      // Siempre guardar parts en Redis — evita superar límite 1MB de QStash
      // con referencias de imagen pesadas, independiente del modelo.
      await Promise.all([
        saveJob(job),
        redis.set(`img_parts:${jobId}`, JSON.stringify(parts), { ex: 3600 }),
      ]);

      const qstash = new QStashClient({ token: process.env.QSTASH_TOKEN! });
      const isSeedream = modelId === 'seedream';
      const workerUrl = isSeedream
        ? `${process.env.WORKER_BASE_URL}/api/gemini/seedream-worker`
        : `${process.env.WORKER_BASE_URL}/api/gemini/ugc-worker`;

      // Seedream: pasa prompt y aspectRatio (worker lee parts de Redis)
      // Gemini ugc-worker: ahora también lee parts de Redis (no vienen en body)
      const workerBody = isSeedream
        ? { jobId, prompt, aspectRatio }
        : { jobId };

      await qstash.publishJSON({ url: workerUrl, body: workerBody, retries: 2 });

      console.log(`[UGC] Job ${jobId} enqueued model=${modelId} → ${workerUrl}`);
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
        refunded: job.refunded === true,
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

    if (action === 'inferGender') {
      const { imageData, mimeType } = payload;
      const ai = getGenAIClient('us-central1');
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          { text: 'Look at this photo of a person. Determine their apparent gender presentation for the purpose of generating appropriate HPI (Human Performance Intelligence) pose and expression guidance, and for writing correctly-gendered Spanish captions. Respond ONLY with JSON.' },
          { inlineData: { mimeType: mimeType || 'image/jpeg', data: cleanBase64(imageData) } },
          { text: '{"gender": "female" | "male" | "neutral"}' },
        ],
        config: { responseMimeType: 'application/json' }
      });
      const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      const clean = text.replace(/```json|```/g, '').trim();
      return res.status(200).json(JSON.parse(clean));
    }

    if (action === 'analyzeAnchor') {
      const { imageData, mimeType } = payload;
      const ai = getGenAIClient('us-central1');
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          { text: 'You are a visual analyst for a campaign generator. Analyze this anchor image and extract ALL visual invariants that must be preserved across every derived campaign image. Be specific and concrete — no vague descriptions. Respond ONLY with the JSON object below, filled with real observations from the image.' },
          { inlineData: { mimeType: mimeType || 'image/jpeg', data: cleanBase64(imageData) } },
          { text: `{
  "lighting": {
    "primarySource": "describe the light source you see (e.g. soft window from left, outdoor sun, studio softbox)",
    "direction": "direction of light (e.g. left to right, overhead, frontal, backlit)",
    "colorTemperature": "warm golden / cool daylight / neutral white / mixed",
    "shadowType": "soft diffused / hard dramatic / minimal / no visible shadows",
    "intensity": "bright / moody low-key / balanced / overcast flat",
    "productionLevel": "high-end studio controlled / natural ambient mid-tier / UGC casual authentic"
  },
  "environment": {
    "locationType": "describe location type (e.g. grey seamless studio, urban street exterior, home bedroom, product flat lay)",
    "indoorOutdoor": "indoor / outdoor / mixed",
    "backgroundDesc": "describe background in 1 sentence",
    "surfaceLanguage": "none visible / marble / wood / concrete / fabric / other: describe",
    "productionTier": "high-end editorial / mid-tier commercial / UGC authentic",
    "propsLevel": "minimal — clean / moderate — some props / rich — many styled elements"
  },
  "styling": {
    "hasVisiblePerson": false,
    "garmentCategory": "if person visible: exact garment category (e.g. long midi skirt, tailored coat, jeans hoodie). If no person: empty string",
    "outfitColorFamily": "if person visible: color family of outfit. If no person: empty string",
    "formalityTier": "formal editorial / smart casual / casual / streetwear / no person",
    "silhouette": "structured refined / flowing ethereal / oversized relaxed / fitted / no person",
    "doNotSwitch": "if person visible: what garment category must never be replaced (e.g. do not switch to activewear, mini dress, or catsuit). If no person: empty string",
    "bodyType": "if person visible: describe body type as seen (e.g. curvy with wide hips and full bust, petite and slim, athletic and toned, plus-size with soft curves, straight/lean). Be factual and neutral. If no person: empty string",
    "visibleMarks": "if person visible: list any tattoos, birthmarks, scars or distinctive skin marks visible in exposed skin areas NOT covered by clothing (e.g. tattoo on left forearm, small birthmark on neck). If none visible or no person: empty string"
  },
  "product": {
    "category": "product category visible in image (e.g. ankle boots, glass serum bottle, leather handbag, candle). If no product visible: describe from context",
    "colorFamily": "main color family of product (e.g. black, warm beige, red, transparent)",
    "materialDesc": "visible material or texture (e.g. smooth leather with silver buckle, frosted glass, woven fabric)",
    "dominanceLevel": "hero — centered and large / supporting — held or worn by model / accent — secondary in composition"
  },
  "composition": {
    "shotType": "full body / three-quarter / waist up / product hero only / detail close-up / lifestyle scene",
    "cameraDistance": "wide / medium / close-up / macro",
    "negativeSpace": "generous — lots of empty space / moderate / minimal — busy composition",
    "visualHierarchy": "product first / model first / balanced product and model",
    "framingStyle": "editorial minimal / editorial rich / UGC candid / commercial clean"
  },
  "mood": {
    "emotionalRegister": "quiet luxury / aspirational premium / authentic relatable / bold high-energy / soft intimate",
    "energyLevel": "calm and refined / dynamic energetic / soft and intimate / bold and assertive",
    "colorPalette": "describe the dominant color palette in 1 sentence",
    "overallMood": "premium editorial / UGC organic authentic / luxury fashion / commercial bright"
  }
}` },
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