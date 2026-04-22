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
    headers: { 'Content-Type': 'application/json' },
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

  // ── NUEVO: Análisis de imagen con texto personalizado (para Scene Clone) ──
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