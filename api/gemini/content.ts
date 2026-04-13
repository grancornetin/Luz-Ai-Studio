// api/gemini/content.ts
// Handles: extractAvatarProfile, analyzeProduct, analyzeOutfit, generateText
// POST /api/gemini/content

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getVertex } from '../_lib/vertexClient';

// ── Schemas (duplicated server-side for validation) ─────────────
// Estos schemas se envían desde el frontend en el body del request.
// Vertex AI los usa para structured output (JSON mode).

interface ContentRequest {
  action:
    | 'extractAvatarProfile'
    | 'analyzeProduct'
    | 'analyzeOutfit'
    | 'generateText';
  images?: string[];           // base64 strings (sin data URL prefix)
  mimeTypes?: string[];        // mime types paralelos a images[]
  prompt: string;
  schema?: Record<string, unknown>; // responseSchema para JSON mode
  model?: string;              // override del modelo (default: gemini-1.5-pro)
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

    const vertex = getVertex();
    const modelName = body.model || 'gemini-1.5-pro';

    // Configuración del modelo
    const generationConfig: Record<string, unknown> = {};

    // Si hay schema, activar JSON mode
    if (body.schema) {
      generationConfig.responseMimeType = 'application/json';
      generationConfig.responseSchema = body.schema;
    }

    // Para generateText siempre queremos JSON
    if (body.action === 'generateText' && !body.schema) {
      generationConfig.responseMimeType = 'application/json';
    }

    const model = vertex.getGenerativeModel({
      model: modelName,
      generationConfig,
    });

    // Construir parts
    const parts: Array<Record<string, unknown>> = [];

    // Agregar imágenes si existen
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

    // Agregar prompt de texto
    parts.push({ text: body.prompt });

    // Llamar a Vertex AI
    const result = await model.generateContent({
      contents: [{ role: 'user', parts }],
    });

    const response = result.response;
    const textContent =
      response.candidates?.[0]?.content?.parts
        ?.map((p: any) => p.text || '')
        .filter(Boolean)
        .join('') || '';

    // Intentar parsear como JSON si es posible
    let parsedJson: unknown = null;
    try {
      parsedJson = JSON.parse(textContent);
    } catch {
      // No es JSON, devolver como texto
    }

    return res.status(200).json({
      success: true,
      text: textContent,
      json: parsedJson,
    });
  } catch (error: any) {
    console.error('Vertex AI content error:', error);

    const status = error.status || error.code || 500;
    const message = error.message || 'Internal server error';

    return res.status(typeof status === 'number' ? status : 500).json({
      success: false,
      error: message,
    });
  }
}