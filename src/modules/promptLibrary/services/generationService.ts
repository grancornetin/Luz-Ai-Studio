import { geminiService } from '../../../services/geminiService';
import { MODELS, getModelForPrompt } from '../../../services/creditConfig';

// ──────────────────────────────────────────
// generationService — Prompt Library
// Enruta cada generación al modelo correcto:
//
//   PRO   → con referencias de persona (fidelidad facial)
//   FLASH → con persona pero sin fidelidad crítica / Campaign
//   FAST  → sin persona, volumen alto (Photodump, Outfit, Product)
//   TEXT  → análisis y variaciones
// ──────────────────────────────────────────

const DEFAULT_NEGATIVE = [
  'blurry', 'distorted', 'low quality', 'bad anatomy',
  'extra fingers', 'deformed hands', 'mutated body',
  'bad lighting', 'low resolution', 'overexposed',
  'underexposed', 'ugly', 'poor composition',
  'identity mixing', 'face distortion'
].join(', ');

export type GenerationProgress = {
  total: number;
  completed: number;
  current: number;
};

export const generationService = {

  // ── AUTO-SELECCIÓN según persona ─────────────────────────────────────
  // hasPersonReference: true  → Pro  ($0.134 — fidelidad facial)
  // hasPersonReference: false → Flash ($0.067 — generación creativa)
  async generateImage(
    prompt: string,
    references: (string | null)[],
    negativePrompt?: string,
    hasPersonReference: boolean = false
  ): Promise<string> {
    const model = getModelForPrompt(hasPersonReference);
    const cleanRefs = references.filter(Boolean) as string[];
    return geminiService.generateImageWithModel(
      prompt,
      negativePrompt || DEFAULT_NEGATIVE,
      model,
      '1K',
      cleanRefs,
      '3:4'
    );
  },

  // ── PRO explícito ────────────────────────────────────────────────────
  // Para módulos donde la identidad facial siempre es crítica:
  // Crear Modelo, Clonar Imagen, Studio UGC
  async generateImagePro(
    prompt: string,
    references: (string | null)[],
    negativePrompt?: string,
    aspectRatio: "1:1" | "3:4" | "4:3" | "9:16" | "16:9" = "3:4"
  ): Promise<string> {
    const cleanRefs = references.filter(Boolean) as string[];
    return geminiService.generateImageWithModel(
      prompt,
      negativePrompt || DEFAULT_NEGATIVE,
      MODELS.PRO,
      '1K',
      cleanRefs,
      aspectRatio
    );
  },

  // ── FLASH explícito ──────────────────────────────────────────────────
  // Para Campaign Generator — consistencia entre escenas con persona
  async generateImageFlash(
    prompt: string,
    references: (string | null)[],
    negativePrompt?: string,
    aspectRatio: "1:1" | "3:4" | "4:3" | "9:16" | "16:9" = "3:4"
  ): Promise<string> {
    const cleanRefs = references.filter(Boolean) as string[];
    return geminiService.generateImageWithModel(
      prompt,
      negativePrompt || DEFAULT_NEGATIVE,
      MODELS.FLASH,
      '1K',
      cleanRefs,
      aspectRatio
    );
  },

  // ── IMAGEN 4 FAST ────────────────────────────────────────────────────
  // Para Photodump, Outfit prendas, Product shots.
  // No soporta imágenes de referencia — solo texto → imagen.
  // Más rápido y 7x más barato que Pro.
  async generateImageFast(
    prompt: string,
    aspectRatio: "1:1" | "3:4" | "4:3" | "9:16" | "16:9" = "3:4"
  ): Promise<string> {
    return geminiService.generateImageFast(prompt, aspectRatio);
  },

  // ── BATCH FLASH ──────────────────────────────────────────────────────
  // Campaign Generator — N imágenes en secuencia con persona
  async generateBatchFlash(
    prompts: string[],
    references: (string | null)[],
    negativePrompt?: string,
    onProgress?: (p: GenerationProgress) => void
  ): Promise<string[]> {
    const cleanRefs = references.filter(Boolean) as string[];
    const neg = negativePrompt || DEFAULT_NEGATIVE;
    const results: string[] = [];
    const total = prompts.length;

    for (let i = 0; i < total; i++) {
      onProgress?.({ total, completed: i, current: i });
      try {
        const img = await geminiService.generateImageWithModel(
          prompts[i], neg, MODELS.FLASH, '1K', cleanRefs, '3:4'
        );
        results.push(img);
      } catch (err) {
        console.error(`Campaign batch error at index ${i}:`, err);
      }
      onProgress?.({ total, completed: i + 1, current: i });
    }
    return results;
  },

  // ── BATCH FAST ───────────────────────────────────────────────────────
  // Photodump Mode — N variaciones sin persona, máximo volumen
  async generateBatchFast(
    prompts: string[],
    onProgress?: (p: GenerationProgress) => void
  ): Promise<string[]> {
    const results: string[] = [];
    const total = prompts.length;

    for (let i = 0; i < total; i++) {
      onProgress?.({ total, completed: i, current: i });
      try {
        const img = await geminiService.generateImageFast(prompts[i], '3:4');
        results.push(img);
      } catch (err) {
        console.error(`Photodump batch error at index ${i}:`, err);
      }
      onProgress?.({ total, completed: i + 1, current: i });
    }
    return results;
  },

  // ── BATCH genérico (retrocompatibilidad) ─────────────────────────────
  // Mantiene la firma original para no romper módulos existentes
  async generateBatch(
    prompts: string[],
    references: (string | null)[],
    negativePrompt?: string,
    onProgress?: (p: GenerationProgress) => void
  ): Promise<string[]> {
    return this.generateBatchFlash(prompts, references, negativePrompt, onProgress);
  }

};