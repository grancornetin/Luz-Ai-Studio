// src/modules/promptLibrary/services/generationService.ts
// ─────────────────────────────────────────────────────────────────────────────
// Enruta cada generación al flujo correcto:
//
//   Imágenes  → imageApiService (async, QStash, Gemini 3 @ global)
//   Texto     → geminiService.generateText (síncrono, gemini-2.5-flash)
//
// La distinción PRO/FLASH/FAST de modelos ya no aplica para selección de
// modelo: todos usan Gemini 3. Se mantiene la semántica de los métodos
// para no romper los módulos que los llaman.
// ─────────────────────────────────────────────────────────────────────────────

import { imageApiService, extractImageRef, type GenerateImageParams } from '../../../services/imageApiService';
import { geminiService } from '../../../services/geminiService';

const DEFAULT_NEGATIVE = [
  'blurry', 'distorted', 'low quality', 'bad anatomy',
  'extra fingers', 'deformed hands', 'mutated body',
  'bad lighting', 'low resolution', 'overexposed',
  'underexposed', 'ugly', 'poor composition',
  'identity mixing', 'face distortion',
].join(', ');

export type GenerationProgress = {
  total:     number;
  completed: number;
  current:   number;
};

// ─── Helper: convierte (string|null)[] a refs válidos ────────────────────────

function toRefs(
  referenceImages?: (string | null)[],
): Array<{ data: string; mimeType: string }> {
  if (!referenceImages) return [];
  return referenceImages
    .filter((img): img is string => !!img && img.trim().length > 0)
    .map((img, i) => {
      try { return extractImageRef(img, `promptLibRef[${i}]`); } catch { return null; }
    })
    .filter(Boolean) as Array<{ data: string; mimeType: string }>;
}

// ─── API pública ──────────────────────────────────────────────────────────────

export const generationService = {

  // Auto-selección según persona (la semántica se mantiene, el modelo no cambia)
  async generateImage(
    prompt: string,
    references: (string | null)[],
    negativePrompt?: string,
    _hasPersonReference: boolean = false,
    params?: Partial<GenerateImageParams>,
  ): Promise<string> {
    return imageApiService.generateImage({
      prompt,
      negative:        negativePrompt || DEFAULT_NEGATIVE,
      referenceImages: toRefs(references),
      aspectRatio:     '3:4',
      module:          'promptLibrary.generateImage',
      ...params,
    });
  },

  // Fidelidad facial crítica (PRO en el nombre por compatibilidad)
  async generateImagePro(
    prompt: string,
    references: (string | null)[],
    negativePrompt?: string,
    aspectRatio: '1:1' | '3:4' | '4:3' | '9:16' | '16:9' = '3:4',
    params?: Partial<GenerateImageParams>,
  ): Promise<string> {
    return imageApiService.generateImage({
      prompt,
      negative:        negativePrompt || DEFAULT_NEGATIVE,
      referenceImages: toRefs(references),
      aspectRatio,
      module:          'promptLibrary.generateImagePro',
      ...params,
    });
  },

  // Consistencia entre escenas con persona
  async generateImageFlash(
    prompt: string,
    references: (string | null)[],
    negativePrompt?: string,
    aspectRatio: '1:1' | '3:4' | '4:3' | '9:16' | '16:9' = '3:4',
    params?: Partial<GenerateImageParams>,
  ): Promise<string> {
    return imageApiService.generateImage({
      prompt,
      negative:        negativePrompt || DEFAULT_NEGATIVE,
      referenceImages: toRefs(references),
      aspectRatio,
      module:          'promptLibrary.generateImageFlash',
      ...params,
    });
  },

  // Volumen sin persona (antes usaba FAST/gemini-2.5; ahora Gemini 3 también)
  async generateImageFast(
    prompt: string,
    aspectRatio: '1:1' | '3:4' | '4:3' | '9:16' | '16:9' = '3:4',
    params?: Partial<GenerateImageParams>,
  ): Promise<string> {
    return imageApiService.generateImage({
      prompt,
      aspectRatio,
      module: 'promptLibrary.generateImageFast',
      ...params,
    });
  },

  // Campaign Generator — N imágenes en paralelo con persona
  async generateBatchFlash(
    prompts: string[],
    references: (string | null)[],
    negativePrompt?: string,
    onProgress?: (p: GenerationProgress) => void,
  ): Promise<string[]> {
    const refs = toRefs(references);
    const neg  = negativePrompt || DEFAULT_NEGATIVE;
    let completed = 0;
    const total   = prompts.length;

    const jobs: GenerateImageParams[] = prompts.map((prompt, i) => ({
      prompt,
      negative:        neg,
      referenceImages: refs,
      aspectRatio:     '3:4' as const,
      shotIndex:       i,
      totalShots:      total,
      module:          'promptLibrary.batchFlash',
    }));

    const results = await imageApiService.generateBatch(jobs, (done, t) => {
      completed = done;
      onProgress?.({ total: t, completed: done, current: done - 1 });
    });

    // Filtrar nulls — shots fallidos quedan como string vacío para no romper la UI
    return results.map(r => r ?? '');
  },

  // Photodump Mode — N variaciones sin persona, máximo volumen
  async generateBatchFast(
    prompts: string[],
    onProgress?: (p: GenerationProgress) => void,
  ): Promise<string[]> {
    let completed = 0;
    const total   = prompts.length;

    const jobs: GenerateImageParams[] = prompts.map((prompt, i) => ({
      prompt,
      aspectRatio: '3:4' as const,
      shotIndex:   i,
      totalShots:  total,
      module:      'promptLibrary.batchFast',
    }));

    const results = await imageApiService.generateBatch(jobs, (done, t) => {
      completed = done;
      onProgress?.({ total: t, completed: done, current: done - 1 });
    });

    return results.map(r => r ?? '');
  },

  // Retrocompatibilidad
  async generateBatch(
    prompts: string[],
    references: (string | null)[],
    negativePrompt?: string,
    onProgress?: (p: GenerationProgress) => void,
  ): Promise<string[]> {
    return this.generateBatchFlash(prompts, references, negativePrompt, onProgress);
  },
};
