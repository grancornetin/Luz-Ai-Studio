// api/gemini/content.ts
// Maneja: extractAvatarProfile, analyzeProduct, analyzeOutfit, generateText
// Modelo: gemini-2.5-flash @ us-central1 (verificado)

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';

function getCredentials(): Record<string, unknown> {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '';
  const decoded = raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf-8');
  return JSON.parse(decoded);
}

function getGenAIClient(location: string = 'us-central1'): GoogleGenAI {
  return new GoogleGenAI({
    vertexai: true,
    project: process.env.GCP_PROJECT_ID!,
    location,
    googleAuthOptions: { credentials: getCredentials() },
  });
}

interface ContentRequest {
  action: 'extractAvatarProfile' | 'analyzeProduct' | 'analyzeOutfit' | 'generateText' | 'assistantChat';
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
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = req.body as ContentRequest;
    if (!body.action || !body.prompt) {
      return res.status(400).json({ error: 'Missing action or prompt' });
    }

    const modelName = body.model || 'gemini-2.5-flash';
    const ai = getGenAIClient('us-central1');

    // Configuración base
    const config: Record<string, unknown> = {};

    // assistantChat devuelve texto plano (nunca JSON)
    // generateText y acciones con schema fuerzan JSON
    if (body.schema) {
      config.responseMimeType = 'application/json';
      config.responseSchema = body.schema;
    } else if (body.action === 'generateText') {
      config.responseMimeType = 'application/json';
    }
    // assistantChat: sin responseMimeType → texto plano conversacional

    // Construir parts
    const parts: Array<any> = [];

    if (body.images && body.images.length > 0) {
      for (let i = 0; i < body.images.length; i++) {
        parts.push({
          inlineData: {
            mimeType: body.mimeTypes?.[i] || 'image/jpeg',
            data: body.images[i],
          },
        });
      }
    }

    parts.push({ text: body.prompt });

    // ─── ACCIÓN ESPECÍFICA: assistantChat ────────────────────────────
    if (body.action === 'assistantChat') {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: [{ role: 'user', parts }],
        config: {}, // texto plano, sin JSON forzado
      });

      const text = response.candidates?.[0]?.content?.parts
        ?.map((p: any) => p.text || '').filter(Boolean).join('') || '';

      return res.status(200).json({ success: true, text });
    }

    // ─── ACCIÓN ESPECÍFICA: analyzeOutfit ─────────────────────────────
    if (body.action === 'analyzeOutfit') {
      // Forzar JSON incluso sin schema explícito
      config.responseMimeType = 'application/json';
      
      const response = await ai.models.generateContent({
        model: modelName,
        contents: [{ role: 'user', parts }],
        config,
      });

      const rawText = response.candidates?.[0]?.content?.parts
        ?.map((p: any) => p.text || '').filter(Boolean).join('') || '{}';
      
      // Limpiar markdown o basura que a veces devuelve el modelo
      const cleanText = rawText.replace(/```json\s*|\s*```/g, '').trim();
      
      let parsedJson: unknown = null;
      try {
        parsedJson = JSON.parse(cleanText);
      } catch (e) {
        console.error('Failed to parse analyzeOutfit JSON:', cleanText);
        return res.status(422).json({ 
          success: false, 
          error: 'Invalid JSON response from model', 
          raw: cleanText 
        });
      }

      return res.status(200).json({ success: true, text: cleanText, json: parsedJson });
    }

    // ─── RESTO DE ACCIONES ───────────────────────────────────────────
    const response = await ai.models.generateContent({
      model: modelName,
      contents: [{ role: 'user', parts }],
      config,
    });

    const textContent = response.candidates?.[0]?.content?.parts
      ?.map((p: any) => p.text || '').filter(Boolean).join('') || '';

    let parsedJson: unknown = null;
    if (config.responseMimeType === 'application/json' || body.action === 'generateText') {
      try {
        const clean = textContent.replace(/```json\s*|\s*```/g, '').trim();
        parsedJson = JSON.parse(clean);
      } catch { /* not json */ }
    }

    return res.status(200).json({ success: true, text: textContent, json: parsedJson });
  } catch (error: any) {
    console.error('Content error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Internal error' });
  }
}