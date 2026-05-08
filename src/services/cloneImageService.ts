// src/services/cloneImageService.ts
// ─────────────────────────────────────────────────────────────────────────────
// Scene Clone — servicio de generación.
// V4: modo dual con anclas visuales por slot.
//
// Idea central:
// - REF0 sigue siendo la escena completa.
// - En modo 2 personas, el módulo puede enviar subject1SlotImage y subject2SlotImage.
// - Esos slots NO son identidad; son anclas locales de posición/pose/oclusiones.
// - El modelo debe reemplazar ambos placeholders por S1/S2, no conservar caras originales.
// ─────────────────────────────────────────────────────────────────────────────

import { imageApiService, extractImageRef, type GenerateImageParams } from './imageApiService';
import type { DetectedObject } from './sceneAnalysisService';

export type CameraStyle = 'iphone_1x' | 'iphone_05x' | 'iphone_selfie';
export type AspectRatio = '9:16' | '4:5' | '1:1' | '16:9';
export type SubjectSelector = 'auto' | 'left' | 'right';

export interface CloneImageParams {
  targetImage: string;
  faceImage: string;
  bodyImage: string;
  replaceOutfit: boolean;
  outfitOverrideImage?: string | null;
  cameraStyle: CameraStyle;
  aspectRatio: AspectRatio;
  enableSecondSubject?: boolean;
  subject1Selector?: SubjectSelector;
  subject1SlotImage?: string | null;
  subject2SlotImage?: string | null;
  faceImage2?: string | null;
  bodyImage2?: string | null;
  replaceOutfit2?: boolean;
  outfitOverrideImage2?: string | null;
  productOverrides?: DetectedObject[];
  modelId?: 'gemini' | 'seedream';
  onStatusChange?: GenerateImageParams['onStatusChange'];
  sessionParams?: Partial<GenerateImageParams>;
}

type RefMap = {
  scene: string;
  s1Face: string;
  s1Body: string;
  s2Face?: string;
  s2Body?: string;
  s1Slot?: string;
  s2Slot?: string;
  s1Outfit?: string;
  s2Outfit?: string;
};

type ProductRef = { name: string; refName: string };

type BuiltRefs = {
  referenceImages: Array<{ data: string; mimeType: string }>;
  map: RefMap;
  productRefs: ProductRef[];
};

function cameraPrompt(cameraStyle: CameraStyle): string {
  if (cameraStyle === 'iphone_05x') {
    return '[CAMERA] iPhone 0.5x ultra-wide perspective, believable wide lens distortion, real handheld smartphone photo.';
  }
  if (cameraStyle === 'iphone_selfie') {
    return '[CAMERA] iPhone front selfie perspective, natural arm-length distance, real handheld smartphone photo.';
  }
  return '[CAMERA] iPhone 1x main lens, natural proportions, real handheld smartphone photo.';
}

function buildRefs(params: CloneImageParams): BuiltRefs {
  const referenceImages: Array<{ data: string; mimeType: string }> = [];
  const add = (img: string | null | undefined, label: string): string | undefined => {
    if (!img) return undefined;
    const ref = extractImageRef(img, label);
    const refName = `REF${referenceImages.length}`;
    referenceImages.push({ data: ref.data, mimeType: ref.mimeType });
    return refName;
  };

  const hasSecond = !!params.enableSecondSubject && !!params.faceImage2 && !!params.bodyImage2;

  const map: RefMap = {
    scene: add(params.targetImage, 'sceneAnchor') || 'REF0',
    s1Face: add(params.faceImage, 'subject1Face') || 'REF1',
    s1Body: add(params.bodyImage, 'subject1Body') || 'REF2',
  };

  if (hasSecond) {
    map.s2Face = add(params.faceImage2, 'subject2Face');
    map.s2Body = add(params.bodyImage2, 'subject2Body');
    map.s1Slot = add(params.subject1SlotImage, 'subject1SlotAnchor');
    map.s2Slot = add(params.subject2SlotImage, 'subject2SlotAnchor');
  }

  if (params.replaceOutfit && params.outfitOverrideImage) {
    map.s1Outfit = add(params.outfitOverrideImage, 'subject1Outfit');
  }

  if (hasSecond && params.replaceOutfit2 && params.outfitOverrideImage2) {
    map.s2Outfit = add(params.outfitOverrideImage2, 'subject2Outfit');
  }

  const productRefs: ProductRef[] = [];
  (params.productOverrides || []).forEach((item, index) => {
    if (!item.replacementImage) return;
    const refName = add(item.replacementImage, `productReplacement${index + 1}`);
    if (refName) productRefs.push({ name: item.name || `producto ${index + 1}`, refName });
  });

  return { referenceImages, map, productRefs };
}

function mappingBlock(params: CloneImageParams, hasSecond: boolean, map: RefMap): string {
  if (!hasSecond) {
    return `
[SUBJECT MAPPING]
- Final image must contain exactly one main visible subject.
- Subject 1 replaces the original visible person in ${map.scene}.
- The original person in ${map.scene} is only a pose/composition placeholder, not an identity source.
`.trim();
  }

  const slotText = map.s1Slot && map.s2Slot
    ? `
[DUAL SLOT ANCHORS]
- ${map.s1Slot} is the local slot/placeholder assigned to Subject 1. Use it only for position, pose, crop, occlusion, scale, and local scene context.
- ${map.s2Slot} is the local slot/placeholder assigned to Subject 2. Use it only for position, pose, crop, occlusion, scale, and local scene context.
- The human identity visible inside ${map.s1Slot} and ${map.s2Slot} must be discarded.
- Slot anchors are not face references. The faces must come from ${map.s1Face} and ${map.s2Face}.
`.trim()
    : `
[DUAL SLOT ANCHORS]
- No visual slot crops were provided. Use the selected left/right mapping from the full scene anchor.
`.trim();

  if (params.subject1Selector === 'left') {
    return `
[SUBJECT MAPPING]
- Final image must contain exactly two visible main subjects.
- Subject 1 MUST replace the LEFT person in ${map.scene}.
- Subject 2 MUST replace the RIGHT person in ${map.scene}.
- Do not swap positions.
- Do not keep either original target identity.
${slotText}
`.trim();
  }

  if (params.subject1Selector === 'right') {
    return `
[SUBJECT MAPPING]
- Final image must contain exactly two visible main subjects.
- Subject 1 MUST replace the RIGHT person in ${map.scene}.
- Subject 2 MUST replace the LEFT person in ${map.scene}.
- Do not swap positions.
- Do not keep either original target identity.
${slotText}
`.trim();
  }

  return `
[SUBJECT MAPPING]
- Final image must contain exactly two visible main subjects.
- Subject 1 and Subject 2 must replace the two original people in ${map.scene}.
- Do not keep either original target identity.
- Do not duplicate one identity onto both people.
- Do not blend identities.
${slotText}
`.trim();
}

function productBlock(productRefs: ProductRef[]): string {
  if (!productRefs.length) return '';
  return `
[PRODUCT REPLACEMENTS]
${productRefs.map((p) => `- Replace only the matching product/accessory in the scene with ${p.refName} (${p.name}). Keep placement, scale, interaction, perspective, shadows and lighting coherent.`).join('\n')}
`.trim();
}

function basePrompt(params: CloneImageParams, refs: BuiltRefs, runId: string): string {
  const { map } = refs;
  const hasSecond = !!params.enableSecondSubject && !!map.s2Face && !!map.s2Body;

  return `
[PROTOCOL: SCENE CLONE BASE PASS — SCENE TEMPLATE + HUMAN IDENTITY REPLACEMENT]
[RUN_ID: ${runId}]

[REFERENCE MAP]
- ${map.scene}: full scene template. Use for background, composition, pose, camera, crop, lighting, environment and interactions only.
- ${map.s1Face}: Subject 1 face identity reference.
- ${map.s1Body}: Subject 1 body reference. Use for body proportions, visible anatomy, skin tone and hair-length guidance only.
${hasSecond ? `- ${map.s2Face}: Subject 2 face identity reference.
- ${map.s2Body}: Subject 2 body reference. Use for body proportions, visible anatomy, skin tone and hair-length guidance only.` : ''}
${hasSecond && map.s1Slot ? `- ${map.s1Slot}: Subject 1 local slot anchor.` : ''}
${hasSecond && map.s2Slot ? `- ${map.s2Slot}: Subject 2 local slot anchor.` : ''}

[PRIMARY GOAL]
Create a new photorealistic image that keeps the scene from ${map.scene}, but replaces the human identity/identities.
The people in ${map.scene} are placeholders. Preserve their pose and location, but NOT their faces, hair identity, or recognizable identity.
Never return the original target image unchanged.

${mappingBlock(params, hasSecond, map)}

[SCENE LOCK]
- Preserve the environment/background from ${map.scene}.
- Preserve the camera angle, crop, framing, perspective and lens feel from ${map.scene}.
- Preserve the pose, gesture, body placement, interpersonal spacing and interaction from ${map.scene}.
- Preserve the lighting direction, white balance, exposure, shadows and scene mood from ${map.scene}.
- Preserve props and environmental objects unless explicitly replaced.

[IDENTITY LOCK]
- Subject 1 must clearly and recognizably match ${map.s1Face}.
- Subject 1 body must stay coherent with ${map.s1Body}.
${hasSecond ? `- Subject 2 must clearly and recognizably match ${map.s2Face}.
- Subject 2 body must stay coherent with ${map.s2Body}.
- Subject 1 and Subject 2 must remain visually distinct.
- Do not blend or average their faces.` : ''}
- The target people's original faces and hair identities must not survive.

[BASE WARDROBE RULE]
- This is not the outfit-edit pass. Keep wardrobe logically coherent with the target pose unless outfit references are explicitly provided later.
- Correct identity replacement is more important than preserving the original target person's facial details.

${cameraPrompt(params.cameraStyle)}

[HARD NEGATIVE RULES]
- No original target face preserved.
- No unchanged target people.
- No identity blending.
- No identity swap.
- No duplicate same identity on two people.
- No missing second subject when two are required.
- No scene drift, no background drift, no crop drift.
- No bad anatomy, no extra limbs, no extra fingers.
- No illustration, no CGI, no 3D render, no text, no watermark.
`.trim();
}

function editPrompt(params: CloneImageParams, refs: BuiltRefs, runId: string): string {
  const { map } = refs;
  const hasSecond = !!params.enableSecondSubject && !!map.s2Face && !!map.s2Body;
  const hasOutfit1 = !!map.s1Outfit;
  const hasOutfit2 = !!map.s2Outfit;
  const hasProducts = refs.productRefs.length > 0;

  return `
[PROTOCOL: SCENE CLONE EDIT PASS — LOCKED BASE + LOCALIZED EDIT]
[RUN_ID: ${runId}]

[REFERENCE MAP]
- ${map.scene}: locked base composition anchor.
- ${map.s1Face}: Subject 1 face identity lock.
- ${map.s1Body}: Subject 1 body lock.
${hasSecond ? `- ${map.s2Face}: Subject 2 face identity lock.
- ${map.s2Body}: Subject 2 body lock.` : ''}
${hasOutfit1 ? `- ${map.s1Outfit}: Subject 1 outfit reference.` : ''}
${hasOutfit2 ? `- ${map.s2Outfit}: Subject 2 outfit reference.` : ''}
${refs.productRefs.map((p) => `- ${p.refName}: replacement reference for ${p.name}.`).join('\n')}

[PRIMARY GOAL]
Use ${map.scene} as a locked base image. Keep the image almost identical and perform only the requested localized outfit/product changes.
Do not regenerate the whole image. Do not change faces, scene, pose, crop or background.

${mappingBlock(params, hasSecond, map)}

[IDENTITY LOCK]
- Subject 1 must still match ${map.s1Face}.
${hasSecond ? `- Subject 2 must still match ${map.s2Face}.` : ''}
- Never change the face, identity, body placement or pose while applying outfits/products.
- Never revert to the original target identities.

[OUTFIT LOCAL EDIT]
${hasOutfit1 ? `- Replace ONLY Subject 1 clothing using ${map.s1Outfit}.` : '- Keep Subject 1 wardrobe unchanged unless a product replacement overlaps that area.'}
${hasSecond ? (hasOutfit2 ? `- Replace ONLY Subject 2 clothing using ${map.s2Outfit}.` : '- Keep Subject 2 wardrobe unchanged unless a product replacement overlaps that area.') : ''}
- Clothing must fit the exact visible pose and body geometry.
- Render only garment parts that are logically visible in the crop and pose.
- If pants, shoes, skirt, or accessories are hidden by crop/pose/occlusion, do not force them to appear.
- Respect occlusions from arms, hands, hair, props, furniture, the other subject and frame edges.
- Match scene lighting, shadows, color temperature, perspective, fabric folds, seams, tension and material response.
- No pasted clothing, no collage look, no floating garments.

${hasProducts ? productBlock(refs.productRefs) : ''}

[SCENE LOCK]
- Keep framing/crop identical to ${map.scene}.
- Keep background and environment identical.
- Keep camera, lighting, pose and subject placement identical.

${cameraPrompt(params.cameraStyle)}

[HARD NEGATIVE RULES]
- No face drift, no identity swap, no hairstyle drift.
- No scene drift, no background drift, no re-composition.
- No body deformation, no extra limbs, no extra fingers.
- No wardrobe contamination between subjects.
- No illustration, no CGI, no 3D render, no text, no watermark.
`.trim();
}

function seedreamPrompt(params: CloneImageParams, refs: BuiltRefs, runId: string, isEditPass: boolean): string {
  // Seedream no siempre interpreta bien REF numeradas complejas, por eso se entrega
  // una versión más directa y redundante del mismo protocolo.
  const { map } = refs;
  const hasSecond = !!params.enableSecondSubject && !!map.s2Face && !!map.s2Body;
  const baseOrEdit = isEditPass ? editPrompt(params, refs, runId) : basePrompt(params, refs, runId);

  return `
[SEEDREAM REFERENCE INSTRUCTIONS]
- ${map.scene}: ${isEditPass ? 'locked base image' : 'full scene template only'}.
- ${map.s1Face}: Subject 1 identity.
- ${map.s1Body}: Subject 1 body/proportions.
${hasSecond ? `- ${map.s2Face}: Subject 2 identity.
- ${map.s2Body}: Subject 2 body/proportions.` : ''}
${hasSecond && map.s1Slot ? `- ${map.s1Slot}: slot assigned to Subject 1, not identity.` : ''}
${hasSecond && map.s2Slot ? `- ${map.s2Slot}: slot assigned to Subject 2, not identity.` : ''}

${baseOrEdit}
`.trim();
}

export const cloneImageService = {
  async cloneImage(params: CloneImageParams): Promise<string> {
    const runId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const refs = buildRefs(params);

    const hasSecond = !!params.enableSecondSubject && !!refs.map.s2Face && !!refs.map.s2Body;
    const isEditPass = !!refs.map.s1Outfit || !!refs.map.s2Outfit || refs.productRefs.length > 0;
    const isSeedream = (params.modelId || 'gemini') === 'seedream';

    const prompt = isSeedream
      ? seedreamPrompt(params, refs, runId, isEditPass)
      : isEditPass
        ? editPrompt(params, refs, runId)
        : basePrompt(params, refs, runId);

    const negative = [
      'cartoon',
      'illustration',
      'anime',
      'cgi',
      '3d render',
      'painting',
      'text',
      'watermark',
      'different background',
      'different scene',
      'different crop',
      'different framing',
      'different camera angle',
      'different lighting',
      'scene drift',
      'background drift',
      'composition drift',
      'face drift',
      'identity swap',
      'identity blending',
      'averaged faces',
      'hybrid face',
      'original target face preserved',
      'original person unchanged',
      'return original target image',
      'bad anatomy',
      'deformed hands',
      'extra fingers',
      'extra limbs',
      ...(hasSecond ? [
        'missing second subject',
        'single subject when two are required',
        'same identity copied twice',
        'one person unchanged',
      ] : []),
      ...(isEditPass ? [
        'pasted clothing',
        'collage look',
        'floating clothes',
        'warped garments',
        'outfit contamination between people',
        'forced full body outfit',
        'hallucinated pants',
        'hallucinated shoes',
      ] : []),
    ].join(', ');

    return imageApiService.generateImage({
      prompt,
      negative,
      referenceImages: refs.referenceImages,
      aspectRatio: params.aspectRatio as any,
      module: 'cloneImageService',
      modelId: params.modelId || 'gemini',
      onStatusChange: params.onStatusChange,
      ...params.sessionParams,
    });
  },
};
