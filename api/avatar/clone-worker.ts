// api/avatar/clone-worker.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Receiver } from '@upstash/qstash';
import { Redis } from '@upstash/redis';
import { GoogleGenAI } from '@google/genai';

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
});

// ─── Google GenAI ─────────────────────────────────────────
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

// ─── Extraer perfil de identidad a partir de imágenes (modo image) ───
async function extractAvatarProfile(files: string[]): Promise<any> {
  const ai = getGenAIClient('us-central1');
  const parts: any[] = [];
  for (let i = 0; i < files.length; i++) {
    const base64Data = files[i].split(',')[1];
    parts.push({ inlineData: { mimeType: 'image/jpeg', data: base64Data } });
  }
  parts.push({ text: `Analyze these photos. Extract exact biometric identity. Return JSON with: identity_prompt (detailed description of face, body, hair, skin), negative_prompt, physical_description, metadata (gender, age, build, ethnicity, eyes, hairColor, hairType, hairLength).` });

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [{ role: 'user', parts }],
    config: { responseMimeType: 'application/json' },
  });
  const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
  const clean = text.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
}

// ─── Generar imagen con modelo específico (reutilizable) ───
// ─── Tabla de ubicaciones por modelo (igual que api/gemini/image.ts) ───
// Solo Flash — sin fallback a Pro para controlar costos.
const FLASH_MODEL    = 'gemini-3.1-flash-image-preview';
const FLASH_LOCATION = 'global';

async function generateImageWithModel(
  prompt: string,
  negative: string,
  _modelName: string,   // ignorado — siempre Flash
  referenceImages: string[],
  aspectRatio: '1:1' | '3:4' | '4:3' | '9:16' | '16:9' = '3:4'
): Promise<string> {
  const ai = getGenAIClient(FLASH_LOCATION);
  const parts: any[] = [];

  for (let i = 0; i < referenceImages.length; i++) {
    const img = referenceImages[i];
    if (img && img.length > 64) {
      const base64Data = img.split(',')[1] || img;
      parts.push({ text: `REF${i}:` });
      parts.push({ inlineData: { mimeType: 'image/png', data: base64Data } });
    }
  }

  const instruction = `PROMPT: ${prompt}\nNEGATIVE: ${negative}`;
  parts.push({ text: instruction });

  const response = await ai.models.generateContent({
    model:    FLASH_MODEL,
    contents: [{ role: 'user', parts }],
    config:   { responseModalities: ['TEXT', 'IMAGE'] },
  });

  for (const candidate of response.candidates || []) {
    for (const part of candidate.content?.parts || []) {
      if (part.inlineData?.data) {
        const mime = part.inlineData.mimeType || 'image/png';
        return `data:${mime};base64,${part.inlineData.data}`;
      }
    }
  }
  throw new Error('No image returned from model');
}

// ─── Lógica común para generar las 4 vistas a partir de un prompt de identidad ───
async function generateFullSet(
  identityPrompt: string,
  negativePrompt: string,
  gender: 'hombre' | 'mujer',
  referenceImages: string[],   // para modo imagen se usan; para manual puede ser []
  outfitOverride: string | null = null
): Promise<string[]> {
  const bodyArchetype = gender === 'mujer'
    ? "PERFECT HOURGLASS 90-60-90 PROPORTIONS. Highly toned aesthetic silhouette. Slim waist, wide hips."
    : "ATHLETIC GYM BUILD. V-taper silhouette. Highly defined musculature, broad shoulders, slim waist.";

  const outfitInstruction = outfitOverride
    ? `Wearing ${outfitOverride}. DO NOT remove this outfit. The outfit is mandatory and must be integrated realistically.`
    : `[OUTFIT STRIPPING: REMOVE ALL ORIGINAL CLOTHES, ACCESSORIES, AND BACKGROUND.]
       [MANDATORY OUTFIT: PLAIN SKIN-TIGHT NEUTRAL GREY TECHNICAL BODYSUIT. NO TEXTURES, NO BRANDING.]`;

  const technicalPrompt = `
    [PROTOCOL: BODYMASTER GENERATION]
    [CORE IDENTITY: ${identityPrompt}]
    [VIEW: FULL BODY HEAD-TO-TOE. ENTIRE SILHOUETTE VISIBLE FROM TOP OF HEAD TO BOTTOM OF FEET. NO CROPPING.]
    [STRICT FIDELITY: RECONSTRUCT FACE 1:1 FROM REFERENCE. PROPORTIONS, EYES, NOSE, JAWLINE MUST BE IDENTICAL.]
    [BODY RULES: ${bodyArchetype}]
    ${outfitInstruction}
    [STAGING: NEUTRAL GREY BACKGROUND. UNIFORM STUDIO LIGHTING. Neutral, confident posture. Neutral facial expression.]
  `;
  const strictNegative = `${negativePrompt}, fashion, casual clothes, jewelry, shoes, cropped feet, cropped head, artistic lighting, decorative background, wrinkles in fabric, 3/4 view, medium shot, stylized face`;

  const bodyMaster = await generateImageWithModel(
    technicalPrompt, strictNegative, 'gemini-3.1-flash-image-preview', referenceImages, '3:4'
  );

  const rear = await generateImageWithModel(
    `[TECHNICAL VIEW: REAR 180 DEGREES]. FULL BODY HEAD-TO-TOE. Exact 180° rotation from BODYMASTER. ${outfitOverride ? `Wearing ${outfitOverride}.` : 'Same technical bodysuit.'} Maintain ${gender === 'mujer' ? '90-60-90 silhouette' : 'gym-toned build'}.`,
    'face, frontal view', 'gemini-3.1-flash-image-preview', [bodyMaster], '3:4'
  );

  const side = await generateImageWithModel(
    `[TECHNICAL VIEW: SIDE PROFILE 90 DEGREES]. FULL BODY HEAD-TO-TOE. Exact 90° rotation from BODYMASTER. ${outfitOverride ? `Wearing ${outfitOverride}.` : 'Same technical bodysuit.'} Maintain ${gender === 'mujer' ? '90-60-90 silhouette' : 'gym-toned build'}.`,
    'frontal view, rear view', 'gemini-3.1-flash-image-preview', [bodyMaster], '3:4'
  );

  const faceMaster = await generateImageWithModel(
    `[PROTOCOL: FACEMASTER GENERATION]
     [REFERENCE: USE EXCLUSIVELY THE FACE FROM THE BODYMASTER IMAGE.]
     [VIEW: EXTREME CLOSE-UP FACE PORTRAIT. FOCUS ONLY ON HEAD AND NECK.]
     [STRICT FIDELITY: 1:1 BIOMETRIC DNA CLONE. DO NOT EMBELLISH. DO NOT STYLIZE. NO MAKEUP UNLESS PRESENT.]
     [PRIORITY: FIDELITY OVER AESTHETICS. MUST BE IDENTICAL TO BODYMASTER FACE.]
     [OUTFIT: ${outfitOverride ? `Outfit visible at neck only, matching ${outfitOverride}.` : 'Technical bodysuit visible at neck only.'}]`,
    'full body, distant view, accessories, blur', 'gemini-3.1-flash-image-preview', [bodyMaster], '3:4'
  );

  return [bodyMaster, rear, side, faceMaster];
}

// ─── Worker principal ──────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const signature = req.headers['upstash-signature'] as string;
  if (!signature) return res.status(401).json({ error: 'Missing signature' });
  try {
    const bodyString = JSON.stringify(req.body);
    await receiver.verify({ signature, body: bodyString });
  } catch (err) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const { jobId, mode, files, identityPrompt, negativePrompt, gender, personality, expression } = req.body;
  if (!jobId) return res.status(400).json({ error: 'Missing jobId' });

  // Obtener job de Redis
  const raw = await redis.get(`clone_job:${jobId}`);
  if (!raw) return res.status(404).json({ error: 'Job not found' });
  const job = typeof raw === 'string' ? JSON.parse(raw) : raw;

  job.status = 'processing';
  job.updatedAt = Date.now();
  await redis.set(`clone_job:${jobId}`, JSON.stringify(job), { ex: 3600 });

  try {
    let finalIdentityPrompt: string;
    let finalNegativePrompt: string;
    let refImages: string[] = [];

    if (mode === 'image') {
      // Extraer identidad de las fotos
      const identityData = await extractAvatarProfile(files);
      finalIdentityPrompt = identityData.identity_prompt;
      finalNegativePrompt = identityData.negative_prompt;
      refImages = files;
    } else { // manual
      finalIdentityPrompt = identityPrompt;
      finalNegativePrompt = negativePrompt;
      refImages = [];
    }

    const resultImages = await generateFullSet(
      finalIdentityPrompt,
      finalNegativePrompt,
      gender,
      refImages,
      null   // sin outfit override
    );

    job.status = 'completed';
    job.result = resultImages;
    job.updatedAt = Date.now();
    await redis.set(`clone_job:${jobId}`, JSON.stringify(job), { ex: 3600 });

    return res.status(200).json({ ok: true });
  } catch (error: any) {
    job.status = 'failed';
    job.error = error.message;
    job.updatedAt = Date.now();
    await redis.set(`clone_job:${jobId}`, JSON.stringify(job), { ex: 3600 });
    return res.status(500).json({ error: error.message });
  }
}