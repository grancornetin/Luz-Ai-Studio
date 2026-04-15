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

function cleanBase64(b64: string): string {
  if (!b64) return '';
  return b64.replace(/^data:image\/(png|jpeg|webp);base64,/, '').replace(/\s/g, '');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { action, payload } = req.body;

    if (!action) {
      return res.status(400).json({ error: 'Missing action' });
    }

    const ai = getGenAIClient();

    // ===================================================================
    // ACCIÓN: generateImage0 (Master Anchor)
    // ===================================================================
    if (action === 'generateImage0') {
      const { prompt, referenceImages, aspectRatio = '3:4' } = payload;

      if (!prompt) {
        return res.status(400).json({ error: 'Missing prompt' });
      }

      const parts: any[] = [];

      if (referenceImages && referenceImages.length > 0) {
        for (let i = 0; i < referenceImages.length; i++) {
          const ref = referenceImages[i];
          if (ref.data && ref.data.length > 64) {
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

      const modelName = 'imagen-3.0-fast-generate-001';

      const response = await ai.models.generateContent({
        model: modelName,
        contents: [{ role: 'user', parts }],
        config: {
          responseModalities: ['IMAGE'],
          imageConfig: { aspectRatio: aspectRatio as any, imageSize: '1K' },
        },
      });

      const imagePart = response.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData?.data);

      if (!imagePart?.inlineData?.data) {
        return res.status(422).json({ error: 'No image generated' });
      }

      return res.status(200).json({
        success: true,
        image: `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`,
      });
    }

    // ===================================================================
    // ACCIÓN: generateDerivedShot (Shots derivados)
    // ===================================================================
    if (action === 'generateDerivedShot') {
      const { prompt, referenceImages, aspectRatio = '3:4' } = payload;

      if (!prompt) {
        return res.status(400).json({ error: 'Missing prompt' });
      }

      const parts: any[] = [];

      if (referenceImages && referenceImages.length > 0) {
        for (let i = 0; i < referenceImages.length; i++) {
          const ref = referenceImages[i];
          if (ref.data && ref.data.length > 64) {
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

      const modelName = 'gemini-2.5-flash-image';

      const response = await ai.models.generateContent({
        model: modelName,
        contents: [{ role: 'user', parts }],
        config: {
          responseModalities: ['IMAGE'],
          imageConfig: { aspectRatio: aspectRatio as any, imageSize: '1K' },
        },
      });

      const imagePart = response.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData?.data);

      if (!imagePart?.inlineData?.data) {
        return res.status(422).json({ error: 'No image generated' });
      }

      return res.status(200).json({
        success: true,
        image: `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`,
      });
    }

    // ===================================================================
    // ACCIÓN: analyzeProductRelevance (texto)
    // ===================================================================
    if (action === 'analyzeProductRelevance') {
      const { productRef, focus, outfitRef, sceneRef, sceneText } = payload;

      const parts: any[] = [];

      if (productRef && productRef.data) {
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

      const directive = `
You are analyzing if a product/object is relevant to a ${focus.toUpperCase()} context.

${focus === 'OUTFIT' ? `
OUTFIT CONTEXT:
Determine if this product is a COMPLEMENT to the outfit:
- YES if it is: jewelry, bag, belt, hat, scarf, shoes, or any accessory
- NO if it is: electronics, food/drink, tools, or anything not meant to be worn
` : focus === 'SCENE' ? `
SCENE CONTEXT:
Determine if this product/object is RELEVANT to the scene:
- YES if it naturally belongs in this environment
- NO if it feels out of place
` : ''}

${contextText}

Respond ONLY with JSON:
{
  "isRelevant": boolean,
  "suggestion": "brief explanation",
  "productType": "jewelry|accessory|clothing|electronics|food|sports|home|other"
}`;

      parts.push({ text: directive });

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts }],
        config: { responseMimeType: 'application/json' },
      });

      const text = response.text || '';
      const clean = text.replace(/```json|```/g, '').trim();
      const result = JSON.parse(clean);

      return res.status(200).json({ success: true, ...result });
    }

    // ===================================================================
    // ACCIÓN: analyzeREF0 (Analizar luz, espacio y pose de REF0)
    // ===================================================================
    if (action === 'analyzeREF0') {
      const { imageData, mimeType } = payload;

      const parts: any[] = [
        { text: "Analyze this image in detail. Respond ONLY with JSON." },
        { inlineData: { mimeType: mimeType || 'image/jpeg', data: cleanBase64(imageData) } },
        { text: `{
  "lighting": {
    "primarySource": "string (e.g., 'window on the left', 'overhead soft light', 'natural light from behind camera')",
    "direction": "string (e.g., 'left to right', 'top down', 'front facing')",
    "colorTemperature": "string (e.g., 'warm golden', 'cool white', 'neutral daylight')",
    "shadowType": "string (e.g., 'soft diffused', 'hard cast', 'minimal shadows')",
    "intensity": "string (e.g., 'bright', 'dim', 'overcast')"
  },
  "spatial": {
    "elements": ["string (list all visible objects: furniture, decor, architectural features)"],
    "walls": "string (description of walls: color, texture, any visible features)",
    "floor": "string (description of floor: material, color, texture)",
    "geometry": "string (description of room layout: 'rectangular', 'corner', 'open space')"
  },
  "poseContext": {
    "hasSeating": "boolean",
    "hasLeaningSurface": "boolean",
    "hasTable": "boolean",
    "availableActions": ["string (e.g., 'standing', 'sitting on sofa', 'leaning on wall', 'holding product')"]
  }
}` }
      ];

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts }],
        config: { responseMimeType: 'application/json' },
      });

      const text = response.text || '';
      const clean = text.replace(/```json|```/g, '').trim();
      const result = JSON.parse(clean);

      return res.status(200).json(result);
    }

    // ===================================================================
    // ACCIÓN: analyzeOutfit (Analizar outfit)
    // ===================================================================
    if (action === 'analyzeOutfit') {
      const { imageData, mimeType } = payload;

      const parts: any[] = [
        { text: "Analyze this outfit image. Respond ONLY with JSON." },
        { inlineData: { mimeType: mimeType || 'image/jpeg', data: cleanBase64(imageData) } },
        { text: `{
  "hasJacket": "boolean",
  "hasPants": "boolean",
  "hasShoes": "boolean",
  "hasAccessories": "boolean",
  "hasDetail": "boolean",
  "fabricType": "string",
  "colors": ["string"],
  "hasTop": "boolean",
  "hasBottom": "boolean",
  "hasBelt": "boolean",
  "hasBag": "boolean",
  "hasHat": "boolean",
  "hasNecklace": "boolean"
}` }
      ];

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts }],
        config: { responseMimeType: 'application/json' },
      });

      const text = response.text || '';
      const clean = text.replace(/```json|```/g, '').trim();
      const result = JSON.parse(clean);

      return res.status(200).json(result);
    }

    // ===================================================================
    // ACCIÓN: analyzeScene (Analizar escena)
    // ===================================================================
    if (action === 'analyzeScene') {
      const { imageData, mimeType } = payload;

      const parts: any[] = [
        { text: "Analyze this scene. Respond ONLY with JSON." },
        { inlineData: { mimeType: mimeType || 'image/jpeg', data: cleanBase64(imageData) } },
        { text: `{
  "hasFurniture": "boolean",
  "hasNature": "boolean",
  "hasEquipment": "boolean",
  "hasTable": "boolean",
  "hasSeating": "boolean",
  "hasWindows": "boolean",
  "hasProps": "boolean",
  "sceneType": "string"
}` }
      ];

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts }],
        config: { responseMimeType: 'application/json' },
      });

      const text = response.text || '';
      const clean = text.replace(/```json|```/g, '').trim();
      const result = JSON.parse(clean);

      return res.status(200).json(result);
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });
  } catch (error: any) {
    console.error('UGC API error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'UGC generation failed',
    });
  }
}