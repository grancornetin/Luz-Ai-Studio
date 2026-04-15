// api/gemini/ugc.ts
// UGC Studio endpoint - usa modelos verificados con ubicación correcta
//
// MODELOS VERIFICADOS:
//   PRO:  gemini-3-pro-image-preview     @ global
//   FLASH: gemini-3.1-flash-image-preview @ global  
//   FAST: gemini-2.5-flash-image         @ us-central1

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';

// ── Modelos y ubicaciones verificadas ──
const MODELS = {
  PRO:  'gemini-3-pro-image-preview',
  FLASH: 'gemini-3.1-flash-image-preview',
  FAST: 'gemini-2.5-flash-image',
  TEXT: 'gemini-2.5-flash',
};

const MODEL_LOCATIONS: Record<string, string> = {
  [MODELS.PRO]:   'global',
  [MODELS.FLASH]: 'global',
  [MODELS.FAST]:  'us-central1',
  [MODELS.TEXT]:  'us-central1',
};

const RETRY_DELAY_MS = 3000;

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

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Generación con fallback entre modelos ──
async function generateImageWithFallback(
  parts: any[],
  aspectRatio: string,
  preferredModel: string = MODELS.PRO
): Promise<string> {
  // Orden de fallback: modelo preferido → FLASH → FAST
  const fallbackOrder = [preferredModel, MODELS.FLASH, MODELS.FAST]
    .filter((v, i, a) => a.indexOf(v) === i); // eliminar duplicados

  const errors: string[] = [];

  for (const model of fallbackOrder) {
    const location = MODEL_LOCATIONS[model] || 'us-central1';
    
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(`[UGC] Modelo: ${model} @ ${location} (intento ${attempt})`);
        const ai = getGenAIClient(location);

        const response = await ai.models.generateContent({
          model,
          contents: [{ role: 'user', parts }],
          config: {
            responseModalities: ['TEXT', 'IMAGE'],
          },
        });

        const candidates = response.candidates || [];
        for (const candidate of candidates) {
          for (const part of (candidate.content?.parts || [])) {
            if (part.inlineData?.data) {
              const mime = part.inlineData.mimeType || 'image/png';
              return `data:${mime};base64,${part.inlineData.data}`;
            }
          }
        }

        errors.push(`${model}: no image in response`);
        break; // No reintentar si respondió pero sin imagen
      } catch (e: any) {
        const msg = e.message || 'unknown';
        errors.push(`${model} attempt ${attempt}: ${msg.slice(0, 100)}`);

        if (msg.includes('429') && attempt < 2) {
          console.log(`[UGC] Rate limited, waiting ${RETRY_DELAY_MS}ms...`);
          await delay(RETRY_DELAY_MS);
          continue;
        }
        break; // Pasar al siguiente modelo en fallback
      }
    }
  }

  throw new Error(`All models failed: ${errors.join(' | ')}`);
}

// ── Análisis de texto ──
async function analyzeWithText(prompt: string, images?: Array<{data: string; mimeType: string}>): Promise<any> {
  const ai = getGenAIClient('us-central1');
  const parts: any[] = [];

  if (images) {
    for (const img of images) {
      parts.push({ inlineData: { mimeType: img.mimeType, data: img.data } });
    }
  }
  parts.push({ text: prompt });

  const response = await ai.models.generateContent({
    model: MODELS.TEXT,
    contents: [{ role: 'user', parts }],
    config: { responseMimeType: 'application/json' },
  });

  const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
  try { return JSON.parse(text); } catch { return {}; }
}

function corsHeaders(res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// ── Handler principal ──
export default async function handler(req: VercelRequest, res: VercelResponse) {
  corsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = req.body;
    const action = body.action;

    if (action === 'generateImage0' || action === 'generateDerivedShot') {
      const parts: any[] = [];

      if (body.referenceImages && Array.isArray(body.referenceImages)) {
        for (let i = 0; i < body.referenceImages.length; i++) {
          const ref = body.referenceImages[i];
          if (ref?.data) {
            parts.push({ text: `REF${i}:` });
            parts.push({
              inlineData: {
                mimeType: ref.mimeType || 'image/jpeg',
                data: cleanBase64(ref.data),
              },
            });
          }
        }
      }

      parts.push({ text: body.prompt || 'Generate an image' });

      const preferredModel = body.model || MODELS.PRO;
      const image = await generateImageWithFallback(parts, body.aspectRatio || '3:4', preferredModel);

      return res.status(200).json({ success: true, image });
    }

    if (action === 'analyzeProductRelevance' || action === 'analyzeText') {
      const images: Array<{data: string; mimeType: string}> = [];

      if (body.productRef?.data) {
        images.push({ data: cleanBase64(body.productRef.data), mimeType: body.productRef.mimeType || 'image/jpeg' });
      }
      if (body.outfitRef?.data) {
        images.push({ data: cleanBase64(body.outfitRef.data), mimeType: body.outfitRef.mimeType || 'image/jpeg' });
      }
      if (body.sceneRef?.data) {
        images.push({ data: cleanBase64(body.sceneRef.data), mimeType: body.sceneRef.mimeType || 'image/jpeg' });
      }

      const result = await analyzeWithText(body.prompt || '', images.length > 0 ? images : undefined);
      return res.status(200).json({ success: true, json: result, text: JSON.stringify(result) });
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });
  } catch (error: any) {
    console.error('UGC error:', error);
    return res.status(500).json({ success: false, error: error.message || 'UGC generation failed' });
  }
}