// api/gemini/image.ts
// Modelos según routing del proyecto:
//   PRO:   gemini-3-pro-image-preview     (identidad facial crítica)
//   FLASH: gemini-3.1-flash-image-preview (sin identidad que mantener)
//   FAST:  imagen-4.0-fast-generate-001   (máximo volumen, mínimo costo)
//   TEXT:  gemini-2.5-flash               (solo texto/JSON)

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { VertexAI } from '@google-cloud/vertexai';

function getVertex(location: string = 'us-central1'): VertexAI {
  const credentialsJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  const projectId = process.env.GCP_PROJECT_ID;

  if (!credentialsJson || !projectId) {
    throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_KEY or GCP_PROJECT_ID environment variables.');
  }

  let credentials: Record<string, unknown>;
  try {
    const decoded = credentialsJson.startsWith('{')
      ? credentialsJson
      : Buffer.from(credentialsJson, 'base64').toString('utf-8');
    credentials = JSON.parse(decoded);
  } catch {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is not valid JSON or Base64.');
  }

  return new VertexAI({
    project: projectId,
    location,
    googleAuthOptions: { credentials },
  });
}

function getProjectId(): string {
  return process.env.GCP_PROJECT_ID || '';
}

function getLocation(): string {
  return process.env.GCP_LOCATION || 'us-central1';
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
      return await handleImagen4Generation(body, res);
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

// ── Gemini Image Generation (PRO o FLASH según modelo) ──
async function handleGeminiImageGeneration(
  body: ImageRequest,
  res: VercelResponse
) {
  // Default: PRO (identidad facial). Frontend puede enviar FLASH model.
  const modelName = body.model || 'gemini-3-pro-image-preview';

  // Modelos 3.x preview pueden necesitar 'global' o 'us-central1'
  // Probamos us-central1 primero; si falla, el frontend puede reintentar
  const vertex = getVertex('us-central1');

  const model = vertex.getGenerativeModel({
    model: modelName,
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
    } as any,
  });

  const parts: Array<Record<string, unknown>> = [];

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

  let instruction = body.prompt;
  if (body.negative) {
    instruction += `\nNEGATIVE: ${body.negative}`;
  }
  parts.push({ text: instruction });

  const result = await model.generateContent({
    contents: [{ role: 'user', parts }],
  });

  const response = result.response;

  const imagePart = response.candidates?.[0]?.content?.parts?.find(
    (p: any) => p.inlineData
  );

  if (imagePart?.inlineData?.data) {
    const mimeType = (imagePart as any).inlineData.mimeType || 'image/png';
    return res.status(200).json({
      success: true,
      image: `data:${mimeType};base64,${(imagePart as any).inlineData.data}`,
    });
  }

  const textContent = response.candidates?.[0]?.content?.parts
    ?.map((p: any) => p.text || '')
    .filter(Boolean)
    .join('');

  return res.status(422).json({
    success: false,
    error: 'Model did not return an image',
    text: textContent,
  });
}

// ── Imagen 4 Fast (máximo volumen, mínimo costo) ──
async function handleImagen4Generation(
  body: ImageRequest,
  res: VercelResponse
) {
  const projectId = getProjectId();
  const location = getLocation();
  const modelName = body.model || 'imagen-4.0-fast-generate-001';

  const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${modelName}:predict`;

  const accessToken = await getAccessToken();

  const requestBody = {
    instances: [
      {
        prompt: body.prompt,
      },
    ],
    parameters: {
      sampleCount: 1,
      aspectRatio: body.aspectRatio || '3:4',
      negativePrompt: body.negative || '',
      personGeneration: 'allow_all',
      safetySetting: 'block_only_high',
    },
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error('Imagen 4 API error:', errorBody);
    throw new Error(`Imagen 4 API returned ${response.status}: ${errorBody}`);
  }

  const data = await response.json();
  const prediction = data.predictions?.[0];

  if (prediction?.bytesBase64Encoded) {
    const mimeType = prediction.mimeType || 'image/png';
    return res.status(200).json({
      success: true,
      image: `data:${mimeType};base64,${prediction.bytesBase64Encoded}`,
    });
  }

  return res.status(422).json({
    success: false,
    error: 'Imagen 4 did not return an image',
  });
}

// ── Helper: obtener access token del Service Account ──
async function getAccessToken(): Promise<string> {
  const { GoogleAuth } = await import('google-auth-library');

  const credentialsJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '';
  let credentials: Record<string, unknown>;
  try {
    const decoded = credentialsJson.startsWith('{')
      ? credentialsJson
      : Buffer.from(credentialsJson, 'base64').toString('utf-8');
    credentials = JSON.parse(decoded);
  } catch {
    throw new Error('Invalid GOOGLE_SERVICE_ACCOUNT_KEY');
  }

  const auth = new GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  });

  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();

  if (!tokenResponse.token) {
    throw new Error('Failed to obtain access token');
  }

  return tokenResponse.token;
}