// api/gemini/content.ts
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

interface ContentRequest {
  action:
    | 'extractAvatarProfile'
    | 'analyzeProduct'
    | 'analyzeOutfit'
    | 'generateText';
  images?: string[];
  mimeTypes?: string[];
  prompt: string;
  schema?: Record<string, unknown>;
  model?: string;
}

function corsHeaders(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  corsHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body as ContentRequest;

    if (!body.action || !body.prompt) {
      return res.status(400).json({ error: 'Missing action or prompt' });
    }

    // Modelo de texto: gemini-2.5-flash (barato, rápido, funciona en us-central1)
    const modelName = body.model || 'gemini-2.5-flash';
    const vertex = getVertex('us-central1');

    const generationConfig: Record<string, unknown> = {};

    if (body.schema) {
      generationConfig.responseMimeType = 'application/json';
      generationConfig.responseSchema = body.schema;
    }

    if (body.action === 'generateText' && !body.schema) {
      generationConfig.responseMimeType = 'application/json';
    }

    const model = vertex.getGenerativeModel({
      model: modelName,
      generationConfig,
    });

    const parts: Array<Record<string, unknown>> = [];

    if (body.images && body.images.length > 0) {
      for (let i = 0; i < body.images.length; i++) {
        const imageData = body.images[i];
        const mimeType = body.mimeTypes?.[i] || 'image/jpeg';

        parts.push({
          inlineData: {
            mimeType,
            data: imageData,
          },
        });
      }
    }

    parts.push({ text: body.prompt });

    const result = await model.generateContent({
      contents: [{ role: 'user', parts }],
    });

    const response = result.response;
    const textContent =
      response.candidates?.[0]?.content?.parts
        ?.map((p: any) => p.text || '')
        .filter(Boolean)
        .join('') || '';

    let parsedJson: unknown = null;
    try {
      parsedJson = JSON.parse(textContent);
    } catch {
      // Not JSON, return as text
    }

    return res.status(200).json({
      success: true,
      text: textContent,
      json: parsedJson,
    });
  } catch (error: any) {
    console.error('Vertex AI content error:', error);
    const message = error.message || 'Internal server error';

    return res.status(500).json({
      success: false,
      error: message,
    });
  }
}