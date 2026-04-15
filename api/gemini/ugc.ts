// api/gemini/ugc.ts
// ═══════════════════════════════════════════════════════════════
// MODELOS VERIFICADOS:
//   PRO:  gemini-3-pro-image-preview     @ global       (entiende referencias)
//   TEXT: gemini-2.5-flash               @ us-central1  (análisis)
//
// IMPORTANTE: imagen-3.0 NO entiende referencias de imagen.
// Para UGC con identidad DEBE usarse gemini-3-pro-image-preview.
// ═══════════════════════════════════════════════════════════════

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';

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

// ── Generación de imagen con modelo PRO @ global ──
async function generateImage(
  parts: any[],
  aspectRatio: string
): Promise<string> {
  // Modelos en orden de fallback — todos en global
  const models = [
    { name: 'gemini-3-pro-image-preview', location: 'global' },
    { name: 'gemini-3.1-flash-image-preview', location: 'global' },
    { name: 'gemini-2.5-flash-image', location: 'us-central1' },
  ];

  const errors: string[] = [];

  for (const model of models) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(`[UGC] Modelo: ${model.name} @ ${model.location} (intento ${attempt})`);
        const ai = getGenAIClient(model.location);

        const response = await ai.models.generateContent({
          model: model.name,
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
              const mime = part.inlineData.mimeType || 'image/png';
              console.log(`[UGC] Éxito con ${model.name}`);
              return `data:${mime};base64,${part.inlineData.data}`;
            }
          }
        }
        errors.push(`${model.name}: no image in response`);
        break;
      } catch (e: any) {
        const msg = e.message || 'unknown';
        errors.push(`${model.name} #${attempt}: ${msg.slice(0, 100)}`);
        if (msg.includes('429') && attempt < 2) {
          await delay(RETRY_DELAY_MS);
          continue;
        }
        break;
      }
    }
  }

  throw new Error(`All models failed: ${errors.join(' | ')}`);
}

// ── Análisis de texto con gemini-2.5-flash @ us-central1 ──
async function analyzeText(parts: any[]): Promise<any> {
  const ai = getGenAIClient('us-central1');
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [{ role: 'user', parts }],
    config: { responseMimeType: 'application/json' },
  });

  const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
  const clean = text.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // Frontend envía: { action, payload: { ... } }
    const { action, payload } = req.body;

    if (!action) return res.status(400).json({ error: 'Missing action' });

    // ═══════════════════════════════════════════════════════════
    // generateImage0 — Imagen ancla (Master/REF0)
    // ═══════════════════════════════════════════════════════════
    if (action === 'generateImage0') {
      const { prompt, referenceImages, aspectRatio = '3:4' } = payload;
      if (!prompt) return res.status(400).json({ error: 'Missing prompt' });

      const parts: any[] = [];

      // Inyectar referencias (el modelo PRO las entiende)
      if (referenceImages && referenceImages.length > 0) {
        for (let i = 0; i < referenceImages.length; i++) {
          const ref = referenceImages[i];
          if (ref.data && ref.data.length > 64) {
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

      parts.push({ text: prompt });

      const image = await generateImage(parts, aspectRatio);
      return res.status(200).json({ success: true, image });
    }

    // ═══════════════════════════════════════════════════════════
    // generateDerivedShot — Shots derivados del ancla
    // ═══════════════════════════════════════════════════════════
    if (action === 'generateDerivedShot') {
      const { prompt, referenceImages, aspectRatio = '3:4' } = payload;
      if (!prompt) return res.status(400).json({ error: 'Missing prompt' });

      const parts: any[] = [];

      if (referenceImages && referenceImages.length > 0) {
        for (let i = 0; i < referenceImages.length; i++) {
          const ref = referenceImages[i];
          if (ref.data && ref.data.length > 64) {
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

      parts.push({ text: prompt });

      const image = await generateImage(parts, aspectRatio);
      return res.status(200).json({ success: true, image });
    }

    // ═══════════════════════════════════════════════════════════
    // analyzeProductRelevance — Texto con visión
    // ═══════════════════════════════════════════════════════════
    if (action === 'analyzeProductRelevance') {
      const { productRef, focus, outfitRef, sceneRef, sceneText } = payload;

      const parts: any[] = [];

      if (productRef?.data) {
        parts.push({ text: 'PRODUCT IMAGE:' });
        parts.push({
          inlineData: {
            mimeType: productRef.mimeType || 'image/jpeg',
            data: cleanBase64(productRef.data),
          },
        });
      }

      if (focus === 'OUTFIT' && outfitRef?.data) {
        parts.push({ text: 'OUTFIT REFERENCE:' });
        parts.push({
          inlineData: {
            mimeType: outfitRef.mimeType || 'image/jpeg',
            data: cleanBase64(outfitRef.data),
          },
        });
      }

      if (focus === 'SCENE' && sceneRef?.data) {
        parts.push({ text: 'SCENE REFERENCE:' });
        parts.push({
          inlineData: {
            mimeType: sceneRef.mimeType || 'image/jpeg',
            data: cleanBase64(sceneRef.data),
          },
        });
      }

      const contextText = sceneText ? `Scene description: ${sceneText}` : '';

      parts.push({ text: `
You are analyzing if a product/object is relevant to a ${focus?.toUpperCase()} context.
${focus === 'OUTFIT' ? 'Determine if this product is a COMPLEMENT to the outfit (jewelry, bag, belt, shoes = YES).' : ''}
${focus === 'SCENE' ? 'Determine if this product naturally belongs in this environment.' : ''}
${contextText}
Respond ONLY with JSON:
{ "isRelevant": boolean, "suggestion": "brief explanation", "productType": "jewelry|accessory|clothing|electronics|food|sports|home|other" }
` });

      const result = await analyzeText(parts);
      return res.status(200).json({ success: true, ...result });
    }

    // ═══════════════════════════════════════════════════════════
    // analyzeREF0 — Análisis de luz/espacio/pose
    // ═══════════════════════════════════════════════════════════
    if (action === 'analyzeREF0') {
      const { imageData, mimeType } = payload;

      const parts: any[] = [
        { text: "Analyze this image in detail. Respond ONLY with JSON." },
        { inlineData: { mimeType: mimeType || 'image/jpeg', data: cleanBase64(imageData) } },
        { text: `{
  "lighting": { "primarySource": "string", "direction": "string", "colorTemperature": "string", "shadowType": "string", "intensity": "string" },
  "spatial": { "elements": ["string"], "walls": "string", "floor": "string", "geometry": "string" },
  "poseContext": { "hasSeating": "boolean", "hasLeaningSurface": "boolean", "hasTable": "boolean", "availableActions": ["string"] }
}` },
      ];

      const result = await analyzeText(parts);
      return res.status(200).json(result);
    }

    // ═══════════════════════════════════════════════════════════
    // analyzeOutfit — Análisis de outfit
    // ═══════════════════════════════════════════════════════════
    if (action === 'analyzeOutfit') {
      const { imageData, mimeType } = payload;

      const parts: any[] = [
        { text: "Analyze this outfit image. Respond ONLY with JSON." },
        { inlineData: { mimeType: mimeType || 'image/jpeg', data: cleanBase64(imageData) } },
        { text: `{
  "hasJacket": "boolean", "hasPants": "boolean", "hasShoes": "boolean", "hasAccessories": "boolean",
  "hasDetail": "boolean", "fabricType": "string", "colors": ["string"],
  "hasTop": "boolean", "hasBottom": "boolean", "hasBelt": "boolean", "hasBag": "boolean",
  "hasHat": "boolean", "hasNecklace": "boolean"
}` },
      ];

      const result = await analyzeText(parts);
      return res.status(200).json(result);
    }

    // ═══════════════════════════════════════════════════════════
    // analyzeScene — Análisis de escena
    // ═══════════════════════════════════════════════════════════
    if (action === 'analyzeScene') {
      const { imageData, mimeType } = payload;

      const parts: any[] = [
        { text: "Analyze this scene. Respond ONLY with JSON." },
        { inlineData: { mimeType: mimeType || 'image/jpeg', data: cleanBase64(imageData) } },
        { text: `{
  "hasFurniture": "boolean", "hasNature": "boolean", "hasEquipment": "boolean",
  "hasTable": "boolean", "hasSeating": "boolean", "hasWindows": "boolean",
  "hasProps": "boolean", "sceneType": "string"
}` },
      ];

      const result = await analyzeText(parts);
      return res.status(200).json(result);
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });
  } catch (error: any) {
    console.error('UGC API error:', error);
    return res.status(500).json({ success: false, error: error.message || 'UGC generation failed' });
  }
}