// api/gemini/diagnostic.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';

function getCredentials(): Record<string, unknown> {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '';
  const decoded = raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf-8');
  return JSON.parse(decoded);
}

async function testModel(
  model: string,
  location: string,
  type: 'text' | 'image'
): Promise<{ model: string; location: string; type: string; ok: boolean; error?: string }> {
  try {
    const ai = new GoogleGenAI({
      vertexai: true,
      project: process.env.GCP_PROJECT_ID!,
      location,
      googleAuthOptions: { credentials: getCredentials() },
    });

    if (type === 'text') {
      const r = await ai.models.generateContent({
        model,
        contents: [{ role: 'user', parts: [{ text: 'Say OK' }] }],
      });
      const txt = r.candidates?.[0]?.content?.parts?.[0]?.text || '';
      return { model, location, type, ok: txt.length > 0 };
    } else {
      const r = await ai.models.generateContent({
        model,
        contents: [{ role: 'user', parts: [{ text: 'A red dot on white' }] }],
        config: { responseModalities: ['TEXT', 'IMAGE'] },
      });
      const hasImg = r.candidates?.some(c =>
        c.content?.parts?.some((p: any) => p.inlineData?.data)
      );
      return { model, location, type, ok: !!hasImg };
    }
  } catch (e: any) {
    return { model, location, type, ok: false, error: e.message?.slice(0, 150) };
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

  // Leer parámetro ?batch=1 o ?batch=2 para dividir las pruebas
  const batch = req.query.batch?.toString() || '1';

  let tests: Array<{ model: string; location: string; type: 'text' | 'image' }> = [];

  if (batch === '1') {
    // Batch 1: Modelos de texto + imagen básicos en us-central1
    tests = [
      { model: 'gemini-2.5-flash', location: 'us-central1', type: 'text' },
      { model: 'gemini-2.0-flash', location: 'us-central1', type: 'text' },
      { model: 'gemini-2.5-flash-image', location: 'us-central1', type: 'image' },
      { model: 'imagen-3.0-generate-001', location: 'us-central1', type: 'image' },
    ];
  } else if (batch === '2') {
    // Batch 2: Modelos Gemini 3 en global
    tests = [
      { model: 'gemini-3-pro-image-preview', location: 'global', type: 'image' },
      { model: 'gemini-3.1-flash-image-preview', location: 'global', type: 'image' },
      { model: 'gemini-3.1-flash-image', location: 'global', type: 'image' },
    ];
  } else if (batch === '3') {
    // Batch 3: Modelos extra
    tests = [
      { model: 'gemini-2.5-flash-image', location: 'global', type: 'image' },
      { model: 'gemini-2.0-flash-preview-image-generation', location: 'us-central1', type: 'image' },
      { model: 'imagen-3.0-fast-generate-001', location: 'us-central1', type: 'image' },
    ];
  }

  const results = [];
  for (const t of tests) {
    results.push(await testModel(t.model, t.location, t.type));
  }

  return res.status(200).json({
    batch,
    project: process.env.GCP_PROJECT_ID,
    results,
  });
}