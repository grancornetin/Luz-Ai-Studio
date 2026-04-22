// src/services/cloneImageService.ts
// ─────────────────────────────────────────────────────────────────────────────
// Clone de escena con sustitución de identidad + reemplazo de productos.
// Usa imageApiService → QStash + Redis → image-worker → Gemini 3 @ global.
// ─────────────────────────────────────────────────────────────────────────────

import { imageApiService, extractImageRef, type GenerateImageParams } from './imageApiService';
import type { DetectedObject } from './sceneAnalysisService';

export type CameraStyle     = 'iphone_1x' | 'iphone_05x' | 'iphone_selfie';
export type AspectRatio     = '9:16' | '4:5' | '1:1' | '16:9';
export type SubjectSelector = 'auto' | 'left' | 'right';

export interface CloneImageParams {
  targetImage:          string;
  faceImage:            string;
  bodyImage:            string;
  replaceOutfit:        boolean;
  outfitOverrideImage?: string | null;
  cameraStyle:          CameraStyle;
  aspectRatio:          AspectRatio;
  enableSecondSubject?: boolean;
  subject1Selector?:    SubjectSelector;
  faceImage2?:          string | null;
  bodyImage2?:          string | null;
  replaceOutfit2?:      boolean;
  outfitOverrideImage2?: string | null;
  productOverrides?:    DetectedObject[]; // solo los que tienen replacementImage
  onStatusChange?:      GenerateImageParams['onStatusChange'];
}

export const cloneImageService = {

  async cloneImage(params: CloneImageParams): Promise<string> {
    const runId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    const cameraStylePrompt =
      params.cameraStyle === 'iphone_05x'
        ? '[CAMERA: 0.5x Ultra Wide] Ultra-wide perspective, slight edge distortion, deep field of view.'
        : params.cameraStyle === 'iphone_selfie'
        ? '[CAMERA: Front Selfie] Natural arm-length distance, selfie perspective.'
        : '[CAMERA: 1x Main] Natural proportions, 26mm equiv, handheld realism.';

    // Construir instrucciones de reemplazo de productos
    let productReplacementsText = '';
    if (params.productOverrides && params.productOverrides.length > 0) {
      const items = params.productOverrides.filter(p => p.replacementImage);
      if (items.length > 0) {
        productReplacementsText = '\n[PRODUCT REPLACEMENTS]\n';
        items.forEach((item, idx) => {
          productReplacementsText += `- Replace the "${item.name}" in the original scene with the product shown in REF_P${idx + 1}.\n`;
        });
      }
    }

    const prompt = `
[PROTOCOL: CLONE IMAGE — SCENE LOCK + IDENTITY LOCK + PRODUCT LOCK]
[RUN_ID: ${runId}]

GOAL: Replicate the photo REF0 exactly (same pose, lighting, background, and framing) but replacing the identity of the person(s) and optionally replacing specific products/accessories.

[IDENTITY LOCK - SUBJECT 1]
- Face: Match REF1 perfectly.
- Body: Match REF2 proportions and skin tone.
- Hair: Match REF1 style and color.
${params.replaceOutfit ? '- Outfit: Use REF3 as wardrobe source.' : '- Outfit: Keep original outfit from REF0.'}

[SCENE LOCK]
- Pose: Identical to REF0.
- Lighting: Identical to REF0.
- Background: Identical to REF0.

${cameraStylePrompt}

${productReplacementsText}

[HARD RULES]
- Photorealistic iPhone style.
- No 3D render look.
- No text or watermarks.
- Preserve the exact composition and lighting of REF0.
- The replaced products must integrate naturally into the scene (same lighting, angle, shadows).
`.trim();

    // Construir array de referencias, filtrando null/undefined
    const refs: (string | null | undefined)[] = [
      params.targetImage,
      params.faceImage,
      params.bodyImage,
      params.replaceOutfit ? params.outfitOverrideImage : null,
      params.enableSecondSubject ? params.faceImage2 : null,
      params.enableSecondSubject ? params.bodyImage2 : null,
      params.enableSecondSubject && params.replaceOutfit2 ? params.outfitOverrideImage2 : null,
    ];

    // Añadir imágenes de reemplazo de productos
    if (params.productOverrides) {
      params.productOverrides.forEach(p => {
        if (p.replacementImage) refs.push(p.replacementImage);
      });
    }

    // Filtrar valores null/undefined y luego convertir a objetos
    const validRefs = refs.filter((img): img is string => !!img);
    const refObjects = validRefs.map((img, i) => {
      try { return extractImageRef(img, `cloneRef[${i}]`); } catch { return null; }
    }).filter(Boolean) as Array<{ data: string; mimeType: string }>;

    return imageApiService.generateImage({
      prompt,
      negative:        'cartoon, illustration, different pose, different background, distorted face, bad anatomy, text, watermark',
      referenceImages: refObjects,
      aspectRatio:     params.aspectRatio as any,
      module:          'cloneImageService',
      onStatusChange:  params.onStatusChange,
    });
  },
};