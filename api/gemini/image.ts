// api/gemini/image.ts
// Usa el SDK nuevo @google/genai con modo Vertex AI
// Soporta modelos Gemini 3 de imagen correctamente
//
// ROUTING:
//   PRO:   gemini-3-pro-image-preview     (identidad facial crítica)
//   FLASH: gemini-3.1-flash-image-preview (sin identidad)
//   FAST:  imagen-4.0-fast-generate-001   (máximo volumen)

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';

function getCredentials(): Record<string, unknown> {
  const credentialsJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!credentialsJson) {
    throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_KEY');
  }
  try {
    const decoded = credentialsJson.startsWith('{')
      ? credentialsJson
      : Buffer.from(credentialsJson, 'base64').toString('utf-8');
    return JSON.parse(decoded);
  } catch {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is not valid JSON or Base64.');
  }
}

function getGenAIClient(): GoogleGenAI {
  const projectId = process.env.GCP_PROJECT_ID;
  const location = process.env.GCP_LOCATION || 'us-central1';

  if (!projectId) {
    throw new Error('Missing GCP_PROJECT_ID');
  }

  const credentials = getCredentials();

  return new GoogleGenAI({
    vertexai: true,
    project: projectId,
    location,
    googleAuthOptions: { credentials },
  });
}

interface ImageRequest {
  action: 'generateImage' | 'generateImageFast';
  prompt: string;
  negative?: string;
  referenceImages?: Array<{
    data: string;
    mimeType: string;
  }>;
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

    if (!body.prompt) {
      return res.status(400).json({ error: 'Missing prompt' });
    }

    if (body.action === 'generateImage') {
      return await handleGeminiImageGeneration(body, res);
    }

    if (body.action === 'generateImageFast') {
      return await handleFastGeneration(body, res);
    }

    return res.status(400).json({ error: `Unknown action: ${body.action}` });
  } catch (error: any) {
    console.error('Vertex AI image error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Image generation failed',
    });
  }
}

// ── Gemini Image Generation (PRO o FLASH) usando @google/genai ──
async function handleGeminiImageGeneration(
  body: ImageRequest,
  res: VercelResponse
) {
  const ai = getGenAIClient();
  const modelName = body.model || 'gemini-3-pro-image-preview';

  // Construir parts
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

  // Llamar al modelo con config de imagen
  const response = await ai.models.generateContent({
    model: modelName,
    contents: { parts },
    config: {
      responseModalities: ['TEXT', 'IMAGE'],
    },
  });

  // Buscar imagen en la respuesta
  const candidates = response.candidates || [];
  for (const candidate of candidates) {
    const candidateParts = candidate.content?.parts || [];
    for (const part of candidateParts) {
      if (part.inlineData?.data) {
        const mimeType = part.inlineData.mimeType || 'image/png';
        return res.status(200).json({
          success: true,
          image: `data:${mimeType};base64,${part.inlineData.data}`,
        });
      }
    }
  }

  // Si no hay imagen, devolver texto de error
  const textContent = candidates[0]?.content?.parts
    ?.map((p: any) => p.text || '')
    .filter(Boolean)
    .join('') || '';

  return res.status(422).json({
    success: false,
    error: 'Model did not return an image',
    text: textContent,
  });
}

// ── Fast Generation (Imagen 4 o fallback a Gemini Flash Image) ──
async function handleFastGeneration(
  body: ImageRequest,
  res: VercelResponse
) {
  const ai = getGenAIClient();
  // Para FAST, intentar con gemini-3.1-flash-image-preview (más compatible)
  // Si el usuario quiere imagen-4.0, puede pasar el model explícitamente
  const modelName = body.model || 'gemini-3.1-flash-image-preview';

  const response = await ai.models.generateContent({
    model: modelName,
    contents: { parts: [{ text: body.prompt }] },
    config: {
      responseModalities: ['TEXT', 'IMAGE'],
    },
  });

  const candidates = response.candidates || [];
  for (const candidate of candidates) {
    const candidateParts = candidate.content?.parts || [];
    for (const part of candidateParts) {
      if (part.inlineData?.data) {
        const mimeType = part.inlineData.mimeType || 'image/png';
        return res.status(200).json({
          success: true,
          image: `data:${mimeType};base64,${part.inlineData.data}`,
        });
      }
    }
  }

  return res.status(422).json({
    success: false,
    error: 'Fast model did not return an image',
  });
}