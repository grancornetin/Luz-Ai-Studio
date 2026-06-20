// src/services/geminiService.ts
// ─────────────────────────────────────────────────────────────────────────────
// Servicio central. Regla de oro:
//   • Imágenes  → imageApiService (async, QStash, solo Gemini 3 @ global)
//   • Texto     → api/gemini/content (síncrono, gemini-2.5-flash @ us-central1)
//
// Los métodos generateImage* de este archivo son wrappers de imageApiService
// para compatibilidad con módulos que aún los llaman directamente.
// ─────────────────────────────────────────────────────────────────────────────

import {
  AVATAR_EXTRACTOR_SCHEMA,
  PRODUCT_ANALYZER_SCHEMA,
  OUTFIT_ANALYZER_SCHEMA,
} from '../constants';
import { imageApiService, extractImageRef, type GenerateImageParams } from './imageApiService';
import { getAuth } from 'firebase/auth';

async function getAuthHeader(): Promise<Record<string, string>> {
  const token = await getAuth().currentUser?.getIdToken().catch(() => null);
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

const CONTENT_ENDPOINT = '/api/gemini/content';

// ─── Helpers de texto ─────────────────────────────────────────────────────────

function safeJsonParse(text: any): any {
  try { return JSON.parse(typeof text === 'string' ? text : '{}'); }
  catch { return {}; }
}

async function callContentApi(payload: {
  action: string;
  images?: string[];
  mimeTypes?: string[];
  prompt: string;
  schema?: Record<string, unknown>;
  model?: string;
}): Promise<any> {
  const res = await fetch(CONTENT_ENDPOINT, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', ...(await getAuthHeader()) },
    body:    JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Network error' }));
    throw new Error(err.error || `Content API error: ${res.status}`);
  }
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Content API call failed');
  return data;
}

// ─── Servicio público ─────────────────────────────────────────────────────────

export const geminiService = {

  async ensureAccess() { /* no-op */ },

  async handleApiError(error: any): Promise<never> {
    console.error('Gemini Service Error:', error);
    throw error;
  },

  // ── Análisis de texto (gemini-2.5-flash, síncrono) ───────────────────────

  async extractAvatarProfile(images: string[]): Promise<any> {
    try {
      const extracted = images.map((img, i) => extractImageRef(img, `extractAvatarProfile[${i}]`));
      const result = await callContentApi({
        action:    'extractAvatarProfile',
        images:    extracted.map(e => e.data),
        mimeTypes: extracted.map(e => e.mimeType),
        prompt:    'BIOMETRIC ANALYST: Extract exact facial features and identity profile. Output in strict JSON.',
        schema:    AVATAR_EXTRACTOR_SCHEMA as any,
        model:     'gemini-2.5-flash',
      });
      return result.json || safeJsonParse(result.text);
    } catch (e) { return this.handleApiError(e); }
  },

  async analyzeProduct(images: string[], userDescription?: string): Promise<any> {
    try {
      const extracted = images.map((img, i) => extractImageRef(img, `analyzeProduct[${i}]`));
      const prompt = `PRODUCT ANALYST: Identify materials, textures and commercial dimensions. Output in JSON.${
        userDescription ? `\nUser description: ${userDescription}` : ''}`;
      const result = await callContentApi({
        action:    'analyzeProduct',
        images:    extracted.map(e => e.data),
        mimeTypes: extracted.map(e => e.mimeType),
        prompt,
        schema:    PRODUCT_ANALYZER_SCHEMA as any,
        model:     'gemini-2.5-flash',
      });
      return result.json || safeJsonParse(result.text);
    } catch (e) { return this.handleApiError(e); }
  },

  async analyzeOutfit(image: string): Promise<any> {
    try {
      const extracted = extractImageRef(image, 'analyzeOutfit');
      const result = await callContentApi({
        action:    'analyzeOutfit',
        images:    [extracted.data],
        mimeTypes: [extracted.mimeType],
        prompt:    'FASHION ANALYST: Detect coordinates (X, Y) and describe each garment with precision. Output in JSON.',
        schema:    OUTFIT_ANALYZER_SCHEMA as any,
        model:     'gemini-2.5-flash',
      });
      return result.json || safeJsonParse(result.text);
    } catch (e) { return this.handleApiError(e); }
  },

  async generateText(prompt: string): Promise<string> {
    try {
      const result = await callContentApi({
        action: 'generateText',
        prompt,
        model:  'gemini-2.5-flash',
      });
      return result.text || '';
    } catch (e) { return this.handleApiError(e); }
  },

  async generatePlainText(prompt: string): Promise<string> {
    try {
      const result = await callContentApi({
        action: 'generatePlainText',
        prompt,
        model:  'gemini-2.5-flash',
      });
      return result.text || '';
    } catch (e) { return this.handleApiError(e); }
  },

  // ── Campaign Plan — análisis multimodal con imágenes de referencia ──────────
  async generateCampaignPlan(prompt: string, slots: { base64: string }[]): Promise<string> {
    try {
      // Máximo 4 imágenes para el plan — 1 por rol, comprimidas para evitar 413
      const uniqueSlots = slots.slice(0, 4);
      const compressed  = await Promise.all(
        uniqueSlots.map(async (s, i) => {
          const { compressImageForUpload } = await import('../utils/imageUtils');
          const small = await compressImageForUpload(s.base64, 512, 0.75).catch(() => s.base64);
          return extractImageRef(small, `campaignSlot[${i}]`);
        })
      );

      const payload: Parameters<typeof callContentApi>[0] = {
        action: 'generateCampaignPlan',
        prompt,
        model:  'gemini-2.5-flash',
      };
      if (compressed.length > 0) {
        payload.images    = compressed.map(e => e.data);
        payload.mimeTypes = compressed.map(e => e.mimeType);
      }
      const result = await callContentApi(payload);
      return result.text || '';
    } catch (e) { return this.handleApiError(e); }
  },

  // ── Análisis visual de múltiples referencias — una sola llamada ──────────────
  // Recibe N imágenes (base64 o URL de dato) y devuelve un análisis por imagen.
  // Diseñada para ser reutilizada por outfit_haul, outfit_check, y cualquier módulo
  // que necesite entender qué hay en sus referencias antes de planificar shots.
  //
  // Parámetros:
  //   images        — array de base64 o data-URI (se comprimen a 512px antes de enviar)
  //   selectorHints — kinds elegidos manualmente por el usuario (mismo índice que images).
  //                   Gemini los recibe como "contexto del usuario" — puede confirmar o corregir.
  //   context       — texto breve opcional para dar contexto al análisis ("haul de moda", etc.)
  async analyzeVisualReferences(
    images:         string[],
    selectorHints?: string[],   // valores del selector manual (HaulRefKind[])
    context?:       string,
  ): Promise<import('../modules/photodump/types').VisualRefsAnalysisResult> {
    try {
      if (images.length === 0) {
        return { refs: [], analyzedAt: Date.now() };
      }

      // Comprimir todas las imágenes a 512px para no saturar el request
      const { compressImageForUpload } = await import('../utils/imageUtils');
      const compressed = await Promise.all(
        images.map(async (img, i) => {
          const small = await compressImageForUpload(img, 512, 0.75).catch(() => img);
          return extractImageRef(small, `visualRef[${i}]`);
        })
      );

      // Construir lista de hints para que Gemini sepa qué dijo el usuario
      const hintsBlock = selectorHints && selectorHints.length > 0
        ? `\nUSER SELECTOR HINTS (respect unless clearly wrong):\n${selectorHints.map((h, i) => `  Image ${i}: "${h}"`).join('\n')}`
        : '';

      const contextBlock = context ? `\nCONTEXT: ${context}` : '';

      const prompt = `You are a fashion analyst reviewing reference images for a content generation pipeline.
Analyze each image in order and return a JSON object.${contextBlock}${hintsBlock}

VALID resolvedKind values: full_outfit, top, bottom, dress, onepiece, outerwear, hosiery, footwear, bag, jewelry, accessory, mixed_set

For each image return:
- index: integer (0-based position)
- resolvedKind: best matching value from the list above
- confidence: "high" | "medium" | "low"
- components: object with boolean fields: hasTop, hasBottom, hasDress, hasOuterwear, hasFootwear, hasHosiery, hasBag, hasJewelry, hasAccessory, footwearLegCoverageRisk
  - footwearLegCoverageRisk: true if image shows footwear AND a leg-covering garment (pants, tights, tall boots) — risk of mismatched integration
- visualDescription: one concise English sentence describing what is visible (garment types, colors, silhouette)
- dominantColors: array of up to 3 color names in Spanish (e.g. ["blanco roto", "negro"])
- hasPerson: true if a person is wearing the items in the image
- isFlatlayOrProduct: true if it is a flat lay, product-only shot, or collage

Respond ONLY with valid JSON, no markdown:
{"refs": [ ...one object per image... ]}`;

      const result = await callContentApi({
        action:    'analyzeVisualRefs',
        images:    compressed.map(e => e.data),
        mimeTypes: compressed.map(e => e.mimeType),
        prompt,
        model:     'gemini-2.5-flash',
      });

      const parsed = result.json as { refs?: unknown[] } | null;
      if (!parsed || !Array.isArray(parsed.refs)) {
        console.warn('[analyzeVisualReferences] unexpected response shape:', result);
        return { refs: [], analyzedAt: Date.now() };
      }

      return {
        refs:       parsed.refs as import('../modules/photodump/types').VisualRefAnalysis[],
        analyzedAt: Date.now(),
      };
    } catch (e) { return this.handleApiError(e); }
  },

  // ── Análisis de imagen con texto personalizado (para Scene Clone) ──────────
  async analyzeImageWithText(imageBase64: string, prompt: string): Promise<string> {
    try {
      const extracted = extractImageRef(imageBase64, 'analyzeImageWithText');
      const result = await callContentApi({
        action:    'analyzeImageWithText',
        images:    [extracted.data],
        mimeTypes: [extracted.mimeType],
        prompt,
        model:     'gemini-2.5-flash', // modelo de visión + texto
      });
      // El resultado puede venir como JSON o texto plano
      if (result.json) return JSON.stringify(result.json);
      return result.text || '';
    } catch (e) { return this.handleApiError(e); }
  },

  // ── Generación de imágenes — wrappers sobre imageApiService ──────────────
  // Todos delegan a imageApiService para garantizar:
  //   • Flujo async con QStash + Redis
  //   • Solo modelos Gemini 3 @ global
  //   • Reintentos silenciosos integrados

  async generateImage(
    prompt: string,
    negative: string,
    _usePro: boolean = true,   // mantenido por compatibilidad, ignorado (siempre Gemini 3)
    _size: string = '1K',
    referenceImages?: (string | null)[],
    aspectRatio: '1:1' | '3:4' | '4:3' | '9:16' | '16:9' = '3:4',
    params?: Partial<GenerateImageParams>,
  ): Promise<string> {
    try {
      const refs = buildRefs(referenceImages);
      return await imageApiService.generateImage({
        prompt,
        negative,
        referenceImages: refs.length > 0 ? refs : undefined,
        aspectRatio,
        module: 'geminiService.generateImage',
        ...params,
      });
    } catch (e) { return this.handleApiError(e); }
  },

  async generateImageWithModel(
    prompt: string,
    negative: string,
    _modelName: string,        // ignorado — siempre Gemini 3 via imageApiService
    _size: string = '1K',
    referenceImages?: (string | null)[],
    aspectRatio: '1:1' | '3:4' | '4:3' | '9:16' | '16:9' = '3:4',
    params?: Partial<GenerateImageParams>,
  ): Promise<string> {
    try {
      const refs = buildRefs(referenceImages);
      return await imageApiService.generateImage({
        prompt,
        negative,
        referenceImages: refs.length > 0 ? refs : undefined,
        aspectRatio,
        module: 'geminiService.generateImageWithModel',
        ...params,
      });
    } catch (e) { return this.handleApiError(e); }
  },

  // generateImageFast era el modelo FAST (gemini-2.5-flash-image).
  // Ahora usa el mismo flujo Gemini 3 para garantizar consistencia y disponibilidad.
  async generateImageFast(
    prompt: string,
    aspectRatio: '1:1' | '3:4' | '4:3' | '9:16' | '16:9' = '3:4',
    params?: Partial<GenerateImageParams>,
  ): Promise<string> {
    try {
      return await imageApiService.generateImage({
        prompt,
        aspectRatio,
        module: 'geminiService.generateImageFast',
        ...params,
      });
    } catch (e) { return this.handleApiError(e); }
  },
};

// ─── Helper interno ───────────────────────────────────────────────────────────

function buildRefs(
  referenceImages?: (string | null)[],
): Array<{ data: string; mimeType: string }> {
  if (!referenceImages) return [];
  const refs: Array<{ data: string; mimeType: string }> = [];
  for (let i = 0; i < referenceImages.length; i++) {
    const img = referenceImages[i];
    if (img && img.trim().length > 0) {
      try { refs.push(extractImageRef(img, `REF${i}`)); } catch { /* skip invalid */ }
    }
  }
  return refs;
}