// api/gemini/image.ts
// ═══════════════════════════════════════════════════════════════
// MODELOS VERIFICADOS (diagnostic 2026-04-14):
//   PRO:   gemini-3-pro-image-preview     @ global
//   FLASH: gemini-3.1-flash-image-preview @ global
//   FAST:  gemini-2.5-flash-image         @ us-central1
// ═══════════════════════════════════════════════════════════════

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';

// ── Ubicación correcta según modelo ──
const MODEL_LOCATIONS: Record<string, string> = {
  'gemini-3-pro-image-preview':     'global',
  'gemini-3.1-flash-image-preview': 'global',
  'gemini-2.5-flash-image':         'us-central1',
};

function getLocationForModel(model: string): string {
  return MODEL_LOCATIONS[model] || 'us-central1';
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

interface ImageRequest {
  action: 'generateImage' | 'generateImageFast';
  prompt: string;
  negative?: string;
  referenceImages?: Array<{ data: string; mimeType: string }>;
  model?: string;
  aspectRatio?: '1:1' | '3:4' | '4:3' | '9:16' | '16:9';
}

function corsHeaders(res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  corsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = req.body as ImageRequest;
    if (!body.prompt) return res.status(400).json({ error: 'Missing prompt' });

    if (body.action === 'generateImage') {
      return await handleImageGeneration(body, res);
    }
    if (body.action === 'generateImageFast') {
      return await handleImageGeneration({ ...body, model: 'gemini-3.1-flash-image-preview' }, res);
    }

    return res.status(400).json({ error: `Unknown action: ${body.action}` });
  } catch (error: any) {
    console.error('Image error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Image generation failed' });
  }
}

async function handleImageGeneration(body: ImageRequest, res: VercelResponse) {
  const modelName = body.model || 'gemini-3.1-flash-image-preview';
  const location = getLocationForModel(modelName);
  const ai = getGenAIClient(location);

  const parts: Array<any> = [];

  // Agregar imágenes de referencia
  if (body.referenceImages && body.referenceImages.length > 0) {
    for (let i = 0; i < body.referenceImages.length; i++) {
      const ref = body.referenceImages[i];
      if (ref.data && ref.data.length > 64) {
        parts.push({ text: `REF${i}:` });
        parts.push({
          inlineData: {
            mimeType: ref.mimeType || 'image/jpeg',
            data: ref.data,
          },
        });
      }
    }
  }

  // Instrucción
  let instruction = body.prompt;
  if (body.negative) {
    instruction += `\nNEGATIVE: ${body.negative}`;
  }
  parts.push({ text: instruction });

  const response = await ai.models.generateContent({
    model: modelName,
    contents: [{ role: 'user', parts }],
    config: {
      responseModalities: ['TEXT', 'IMAGE'],
    },
  });

  // Buscar imagen en respuesta
  const candidates = response.candidates || [];
  for (const candidate of candidates) {
    for (const part of (candidate.content?.parts || [])) {
      if (part.inlineData?.data) {
        const mimeType = part.inlineData.mimeType || 'image/png';
        return res.status(200).json({
          success: true,
          image: `data:${mimeType};base64,${part.inlineData.data}`,
        });
      }
    }
  }

  const textContent = candidates[0]?.content?.parts
    ?.map((p: any) => p.text || '').filter(Boolean).join('') || '';

  return res.status(422).json({
    success: false,
    error: 'Model did not return an image',
    text: textContent,
  });
}