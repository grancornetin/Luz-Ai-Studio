// api/gemini/health.ts
// GET /api/gemini/health
// Verifica que la conexión a Vertex AI funciona correctamente.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getVertex } from '../_lib/vertexClient';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Intentar inicializar el cliente (valida credenciales)
    const vertex = getVertex();

    // Hacer una llamada mínima para verificar que funciona
    const model = vertex.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: 'Respond with only: OK' }] }],
    });

    const text = result.response.candidates?.[0]?.content?.parts?.[0];

    return res.status(200).json({
      success: true,
      status: 'connected',
      project: process.env.GCP_PROJECT_ID || 'unknown',
      location: process.env.GCP_LOCATION || 'us-central1',
      model_response: (text as any)?.text || 'no response',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      status: 'error',
      error: error.message,
      hint: !process.env.GCP_PROJECT_ID
        ? 'Missing GCP_PROJECT_ID env variable'
        : !process.env.GOOGLE_SERVICE_ACCOUNT_KEY
          ? 'Missing GOOGLE_SERVICE_ACCOUNT_KEY env variable'
          : 'Check Service Account permissions for Vertex AI API',
    });
  }
}