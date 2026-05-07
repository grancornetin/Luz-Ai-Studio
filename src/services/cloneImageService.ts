// src/services/cloneImageService.ts
// ─────────────────────────────────────────────────────────────────────────────
// Clone de escena con sustitución de identidad + reemplazo de outfits/productos.
// V2: refuerzo especial para escenas con 2 sujetos:
// - obliga a reemplazar ambas personas
// - refuerza left/right
// - evita que una sola identidad domine la escena
// - mantiene el trabajo de outfit como edición localizada
// Usa imageApiService → QStash + Redis → image-worker → Gemini 3 @ global.
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
  faceImage2?: string | null;
  bodyImage2?: string | null;
  replaceOutfit2?: boolean;
  outfitOverrideImage2?: string | null;
  productOverrides?: DetectedObject[];
  modelId?: 'gemini' | 'seedream';
  onStatusChange?: GenerateImageParams['onStatusChange'];
  sessionParams?: Partial<GenerateImageParams>;
}

type RefEntry = {
  refName: string;
  label: string;
  data: string;
  mimeType: string;
};

type ProductRefEntry = {
  name: string;
  refName: string;
};

type BuiltRefs = {
  referenceImages: Array<{ data: string; mimeType: string }>;
  refMap: {
    scene: string;
    subject1Face: string;
    subject1Body: string;
    subject2Face?: string;
    subject2Body?: string;
    subject1Outfit?: string;
    subject2Outfit?: string;
  };
  productRefs: ProductRefEntry[];
};

function getCameraStylePrompt(cameraStyle: CameraStyle): string {
  if (cameraStyle === 'iphone_05x') {
    return '[CAMERA: 0.5x Ultra Wide] Ultra-wide perspective, slight edge distortion, deeper field of view, strong environmental presence.';
  }
  if (cameraStyle === 'iphone_selfie') {
    return '[CAMERA: Front Selfie] Natural arm-length distance, selfie perspective, believable front-camera realism.';
  }
  return '[CAMERA: 1x Main] Natural proportions, handheld realism, approximately 26mm equivalent iPhone main camera look.';
}

function getSubjectPlacementInstruction(selector?: SubjectSelector, hasSecondSubject?: boolean): string {
  if (!hasSecondSubject) {
    return [
      '- There is exactly ONE visible subject in the final image.',
      '- Subject 1 is the only person in frame.',
      '- The original visible person in the anchor image must be fully replaced by Subject 1.',
    ].join('\n');
  }

  if (selector === 'left') {
    return [
      '- There are exactly TWO visible subjects in the final image.',
      '- Subject 1 MUST occupy the LEFT-side person position from the scene anchor.',
      '- Subject 2 MUST occupy the RIGHT-side person position from the scene anchor.',
      '- Replace both original people from the anchor scene.',
      '- Do not swap positions.',
      '- Do not merge identities.',
    ].join('\n');
  }

  if (selector === 'right') {
    return [
      '- There are exactly TWO visible subjects in the final image.',
      '- Subject 1 MUST occupy the RIGHT-side person position from the scene anchor.',
      '- Subject 2 MUST occupy the LEFT-side person position from the scene anchor.',
      '- Replace both original people from the anchor scene.',
      '- Do not swap positions.',
      '- Do not merge identities.',
    ].join('\n');
  }

  return [
    '- There are exactly TWO visible subjects in the final image.',
    '- Subject 1 and Subject 2 must be assigned using the most stable spatial mapping from the scene anchor.',
    '- Once the mapping is inferred, keep it fixed.',
    '- Replace both original people from the anchor scene.',
    '- Never swap Subject 1 and Subject 2.',
    '- Never merge or average their identities.',
  ].join('\n');
}

function getSubjectCountLock(params: CloneImageParams, hasSecondSubject: boolean): string {
  if (!hasSecondSubject) {
    return [
      '[SUBJECT COUNT LOCK]',
      '- Final image must contain exactly ONE visible person.',
      '- That visible person must be Subject 1.',
      '- No original anchor identity may remain visible.',
    ].join('\n');
  }

  return [
    '[SUBJECT COUNT LOCK]',
    '- Final image must contain exactly TWO visible people.',
    '- Both visible people must be replaced by the provided identities.',
    '- One person must be Subject 1 and the other must be Subject 2.',
    '- Neither original anchor identity may remain visible.',
    '- Do not omit one person.',
    '- Do not duplicate one identity onto both people.',
    '- Do not average, blend, or merge Subject 1 and Subject 2.',
  ].join('\n');
}

function buildReferences(params: CloneImageParams): BuiltRefs {
  const entries: RefEntry[] = [];

  const addRef = (image: string | null | undefined, label: string): string | undefined => {
    if (!image) return undefined;
    const extracted = extractImageRef(image, label);
    const refName = `REF${entries.length}`;
    entries.push({
      refName,
      label,
      data: extracted.data,
      mimeType: extracted.mimeType,
    });
    return refName;
  };

  const scene = addRef(params.targetImage, 'sceneAnchor');
  const subject1Face = addRef(params.faceImage, 'subject1Face');
  const subject1Body = addRef(params.bodyImage, 'subject1Body');

  const hasSecondSubject = !!params.enableSecondSubject && !!params.faceImage2 && !!params.bodyImage2;
  const hasOutfit1 = !!params.replaceOutfit && !!params.outfitOverrideImage;
  const hasOutfit2 = hasSecondSubject && !!params.replaceOutfit2 && !!params.outfitOverrideImage2;

  const subject2Face = hasSecondSubject ? addRef(params.faceImage2, 'subject2Face') : undefined;
  const subject2Body = hasSecondSubject ? addRef(params.bodyImage2, 'subject2Body') : undefined;

  const subject1Outfit = hasOutfit1 ? addRef(params.outfitOverrideImage, 'subject1Outfit') : undefined;
  const subject2Outfit = hasOutfit2 ? addRef(params.outfitOverrideImage2, 'subject2Outfit') : undefined;

  const productRefs: ProductRefEntry[] = [];
  (params.productOverrides || []).forEach((item, index) => {
    if (!item.replacementImage) return;
    const refName = addRef(item.replacementImage, `productReplacement${index + 1}`);
    if (refName) {
      productRefs.push({
        name: item.name || `product ${index + 1}`,
        refName,
      });
    }
  });

  return {
    referenceImages: entries.map(({ data, mimeType }) => ({ data, mimeType })),
    refMap: {
      scene: scene || 'REF0',
      subject1Face: subject1Face || 'REF1',
      subject1Body: subject1Body || 'REF2',
      subject2Face,
      subject2Body,
      subject1Outfit,
      subject2Outfit,
    },
    productRefs,
  };
}

function buildGeminiPrompt(params: CloneImageParams, refs: BuiltRefs, runId: string): string {
  const hasSecondSubject = !!params.enableSecondSubject && !!refs.refMap.subject2Face && !!refs.refMap.subject2Body;
  const hasOutfit1 = !!refs.refMap.subject1Outfit;
  const hasOutfit2 = !!refs.refMap.subject2Outfit;
  const hasProductReplacements = refs.productRefs.length > 0;
  const isEditPass = hasOutfit1 || hasOutfit2 || hasProductReplacements;

  const sceneRef = refs.refMap.scene;
  const s1FaceRef = refs.refMap.subject1Face;
  const s1BodyRef = refs.refMap.subject1Body;
  const s2FaceRef = refs.refMap.subject2Face;
  const s2BodyRef = refs.refMap.subject2Body;
  const s1OutfitRef = refs.refMap.subject1Outfit;
  const s2OutfitRef = refs.refMap.subject2Outfit;

  const referenceMapLines = [
    `- ${sceneRef} = ${isEditPass ? 'locked scene/base composition anchor' : 'original scene anchor'}`,
    `- ${s1FaceRef} = Subject 1 face identity reference`,
    `- ${s1BodyRef} = Subject 1 body reference (only proportions / visible anatomy / skin tone)`,
    ...(hasSecondSubject && s2FaceRef ? [`- ${s2FaceRef} = Subject 2 face identity reference`] : []),
    ...(hasSecondSubject && s2BodyRef ? [`- ${s2BodyRef} = Subject 2 body reference (only proportions / visible anatomy / skin tone)`] : []),
    ...(hasOutfit1 && s1OutfitRef ? [`- ${s1OutfitRef} = Subject 1 outfit reference`] : []),
    ...(hasOutfit2 && s2OutfitRef ? [`- ${s2OutfitRef} = Subject 2 outfit reference`] : []),
    ...refs.productRefs.map(p => `- ${p.refName} = Replacement reference for product/accessory "${p.name}"`),
  ].join('\n');

  const goalText = isEditPass
    ? `Use ${sceneRef} as a LOCKED anchor image. Perform a localized edit only. Keep the image almost identical to ${sceneRef}, and change only the explicitly requested wardrobe/products while preserving both subject identities and positions.`
    : hasSecondSubject
      ? `Recreate ${sceneRef} with the same scene, framing, pose, background and lighting, but replace BOTH visible people: one must become Subject 1 and the other must become Subject 2, following the requested spatial mapping.`
      : `Recreate ${sceneRef} with the same scene, pose, framing, background and lighting, while replacing the visible subject with Subject 1.`;

  const subject1Task = [
    '[SUBJECT 1 TASK]',
    `- Subject 1 face identity must clearly and recognizably match ${s1FaceRef}.`,
    `- Subject 1 body must follow ${s1BodyRef} only for body proportions, visible anatomy, and skin tone alignment.`,
    `- Subject 1 must remain distinct from Subject 2.`,
    hasOutfit1 && s1OutfitRef
      ? `- Replace ONLY Subject 1 clothing using ${s1OutfitRef}. This must not affect Subject 2, scene composition, pose, or identity locks.`
      : `- ${isEditPass ? 'Keep Subject 1 wardrobe unchanged unless a requested product replacement affects that exact area.' : 'If no outfit override is provided, keep the wardrobe logically consistent with the anchor scene.'}`,
  ].join('\n');

  const subject2Task = hasSecondSubject && s2FaceRef && s2BodyRef
    ? [
        '[SUBJECT 2 TASK]',
        `- Subject 2 face identity must clearly and recognizably match ${s2FaceRef}.`,
        `- Subject 2 body must follow ${s2BodyRef} only for body proportions, visible anatomy, and skin tone alignment.`,
        `- Subject 2 must remain distinct from Subject 1.`,
        hasOutfit2 && s2OutfitRef
          ? `- Replace ONLY Subject 2 clothing using ${s2OutfitRef}. This must not affect Subject 1, scene composition, pose, or identity locks.`
          : `- ${isEditPass ? 'Keep Subject 2 wardrobe unchanged unless a requested product replacement affects that exact area.' : 'If no outfit override is provided, keep the wardrobe logically consistent with the anchor scene.'}`,
      ].join('\n')
    : '';

  const productText = hasProductReplacements
    ? [
        '[PRODUCT REPLACEMENTS]',
        ...refs.productRefs.map(p => `- Replace only the corresponding product/accessory in the scene with the item shown in ${p.refName} (${p.name}). Keep scale, placement, perspective, hand interaction, lighting, and shadows coherent with the scene.`),
      ].join('\n')
    : '';

  return `
[PROTOCOL: CLONE IMAGE — SCENE LOCK + DUAL IDENTITY LOCK + LOCAL OUTFIT EDIT]
[MODE: ${isEditPass ? 'EDIT PASS' : 'BASE PASS'}]
[RUN_ID: ${runId}]

[REFERENCE MAP]
${referenceMapLines}

[GOAL]
${goalText}

${getSubjectCountLock(params, hasSecondSubject)}

[SUBJECT PLACEMENT]
${getSubjectPlacementInstruction(params.subject1Selector, hasSecondSubject)}

${subject1Task}
${subject2Task ? `\n\n${subject2Task}` : ''}
${productText ? `\n\n${productText}` : ''}

[BASE IDENTITY REPLACEMENT RULES]
- Replace all original visible person identities from the anchor scene.
- If there are 2 people in the scene, BOTH must be replaced.
- Never leave one original anchor identity visible.
- Never output only one replaced person when two are required.
- Never assign Subject 1 identity to both people.
- Never assign Subject 2 identity to both people.
- Never blend Subject 1 and Subject 2 into a hybrid face.

[SCENE LOCK]
- Framing/crop: identical to ${sceneRef}.
- Camera angle and lens impression: identical to ${sceneRef}.
- Pose and body placement: identical to ${sceneRef}.
- Background and environment: identical to ${sceneRef}.
- Lighting, white balance and shadow direction: identical to ${sceneRef}.
- Keep the same interpersonal spacing and body placement from the anchor scene.

${getCameraStylePrompt(params.cameraStyle)}

[OUTFIT INTEGRATION RULES]
- Outfit replacement is a LOCALIZED change only.
- Do NOT redesign the whole image.
- Do NOT change identity, face structure, hairstyle, scene, crop, camera, or pose while applying outfits.
- Use body references only for body proportions and skin tone. NEVER copy their clothing when an outfit override exists.
- Adapt each outfit to the exact visible body pose from the scene anchor.
- Respect real-world garment behavior: folds, seams, drape, tension, layering, sleeve behavior, collar behavior, and fabric thickness.
- The new outfit must inherit the scene lighting, perspective, white balance, shadows, and occlusions, so it looks photographed in the original scene, not pasted on top.
- Show ONLY garment parts that are logically visible in the current crop and pose.
- If only the torso is visible, render only the visible upper-body portion of the outfit.
- Never force hidden pants, skirts, shorts, shoes, or full-body garment sections to appear if the crop or pose does not reveal them.
- Respect occlusions from arms, hands, hair, furniture, props, the other person, and frame edges.
- Preserve realistic fabric texture and material response.

[HARD RULES]
- Photorealistic smartphone / iPhone style. No 3D render look. No illustration.
- No text. No watermark.
- No identity swaps. No face drift. No hairstyle drift.
- No body deformation. No extra limbs. No extra fingers. No broken anatomy.
- No scene drift. No background drift. No re-composition.
- No wardrobe contamination between Subject 1 and Subject 2.
- If only one subject has an outfit replacement, the other subject must remain unchanged.
- The final image must read as one single coherent original photo.
`.trim();
}

function buildSeedreamPrompt(params: CloneImageParams, refs: BuiltRefs, runId: string): string {
  const hasSecondSubject = !!params.enableSecondSubject && !!refs.refMap.subject2Face && !!refs.refMap.subject2Body;
  const hasOutfit1 = !!refs.refMap.subject1Outfit;
  const hasOutfit2 = !!refs.refMap.subject2Outfit;
  const hasProductReplacements = refs.productRefs.length > 0;
  const isEditPass = hasOutfit1 || hasOutfit2 || hasProductReplacements;

  const imageList = [
    `• ${refs.refMap.scene}: ${isEditPass ? 'locked scene/base composition anchor' : 'scene anchor to replicate'}`,
    `• ${refs.refMap.subject1Face}: Subject 1 face identity reference`,
    `• ${refs.refMap.subject1Body}: Subject 1 body reference (use only for body proportions / visible anatomy / skin tone, not for clothing)`,
    ...(hasSecondSubject && refs.refMap.subject2Face ? [`• ${refs.refMap.subject2Face}: Subject 2 face identity reference`] : []),
    ...(hasSecondSubject && refs.refMap.subject2Body ? [`• ${refs.refMap.subject2Body}: Subject 2 body reference (use only for body proportions / visible anatomy / skin tone, not for clothing)`] : []),
    ...(hasOutfit1 && refs.refMap.subject1Outfit ? [`• ${refs.refMap.subject1Outfit}: Subject 1 outfit reference`] : []),
    ...(hasOutfit2 && refs.refMap.subject2Outfit ? [`• ${refs.refMap.subject2Outfit}: Subject 2 outfit reference`] : []),
    ...refs.productRefs.map(p => `• ${p.refName}: replacement reference for product/accessory "${p.name}"`),
  ].join('\n');

  const productInstructions = hasProductReplacements
    ? [
        '[PRODUCT REPLACEMENTS]',
        ...refs.productRefs.map(p => `- Replace only the matching product/accessory in the scene with the item shown in ${p.refName} (${p.name}). Keep scale, perspective, lighting and placement natural.`),
      ].join('\n')
    : '';

  return `
[REFERENCE IMAGES PROVIDED — USE EACH EXACTLY AS DESCRIBED]
${imageList}

[RUN ID]
${runId}

[GOAL]
${isEditPass
  ? `Treat ${refs.refMap.scene} as a locked anchor image. Perform a minimal localized edit only. Keep the scene, framing, pose, lighting and identity stable, and change only the explicitly requested outfit/product areas.`
  : hasSecondSubject
    ? `Replicate ${refs.refMap.scene} with the same scene, framing, pose, background and lighting, but replace BOTH visible people using the provided identity references.`
    : `Replicate ${refs.refMap.scene} with the same scene, framing, pose, background and lighting, replacing the visible person with Subject 1.`}

${getSubjectCountLock(params, hasSecondSubject)}

[SUBJECT PLACEMENT]
${getSubjectPlacementInstruction(params.subject1Selector, hasSecondSubject)}

[IDENTITY AND BODY RULES]
- Subject 1 face identity must clearly match ${refs.refMap.subject1Face}.
- Subject 1 body proportions and skin tone must follow ${refs.refMap.subject1Body}.
- Subject 1 must remain distinct from any other person.
${hasOutfit1 && refs.refMap.subject1Outfit
  ? `- Change only Subject 1 clothing using ${refs.refMap.subject1Outfit}.`
  : `- ${isEditPass ? 'Keep Subject 1 wardrobe unchanged unless a product replacement overlaps that area.' : 'Keep Subject 1 wardrobe logically consistent with the scene anchor if no outfit override is supplied.'}`}
${hasSecondSubject && refs.refMap.subject2Face ? `- Subject 2 face identity must clearly match ${refs.refMap.subject2Face}.` : ''}
${hasSecondSubject && refs.refMap.subject2Body ? `- Subject 2 body proportions and skin tone must follow ${refs.refMap.subject2Body}.` : ''}
${hasSecondSubject ? '- Subject 2 must remain distinct from Subject 1.' : ''}
${hasSecondSubject && hasOutfit2 && refs.refMap.subject2Outfit
  ? `- Change only Subject 2 clothing using ${refs.refMap.subject2Outfit}.`
  : hasSecondSubject
    ? `- ${isEditPass ? 'Keep Subject 2 wardrobe unchanged unless a product replacement overlaps that area.' : 'Keep Subject 2 wardrobe logically consistent with the scene anchor if no outfit override is supplied.'}`
    : ''}

[BASE IDENTITY REPLACEMENT RULES]
- Replace all original visible person identities from the anchor scene.
- If there are 2 people in the scene, BOTH must be replaced.
- Never leave one original person unchanged.
- Never output only one replaced person when two are required.
- Never duplicate Subject 1 onto both people.
- Never duplicate Subject 2 onto both people.
- Never blend both subjects into one hybrid identity.

[SCENE LOCK]
- Keep the framing/crop identical to the scene anchor.
- Keep pose and body placement identical to the scene anchor.
- Keep background and environment identical to the scene anchor.
- Keep lighting, shadow direction, white balance and camera impression identical to the scene anchor.
- Keep the same interpersonal spacing and body placement from the anchor scene.

${getCameraStylePrompt(params.cameraStyle)}

[OUTFIT INTEGRATION RULES]
- Outfit changes are localized edits only.
- Do not redesign the whole image.
- Do not change face identity, hairstyle, body geometry, pose, crop, background or camera while changing clothes.
- Use body references only for body structure and skin tone, never as clothing references when outfit overrides exist.
- The new clothes must fit the exact pose of the person in the anchor image.
- The new clothes must look naturally photographed in the original scene, with correct folds, drape, texture, lighting, perspective and occlusion.
- Show only the clothing areas that are actually visible in the crop and pose.
- Never invent pants, skirts, shorts or shoes if they are not truly visible.
- Respect occlusions caused by arms, hands, hair, props, furniture, the other person, and frame edges.

${productInstructions ? `${productInstructions}\n\n` : ''}[HARD RULES]
- Photorealistic smartphone image. No 3D render look. No illustration.
- No text or watermark.
- No face drift, no identity swap, no wardrobe mixing between subjects.
- No extra limbs or anatomy errors.
- No scene drift or background drift.
- If only one subject is edited, the other subject must remain unchanged.
- The final result must look like one single coherent original photo.
`.trim();
}

export const cloneImageService = {
  async cloneImage(params: CloneImageParams): Promise<string> {
    const runId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const refs = buildReferences(params);

    const hasSecondSubject = !!params.enableSecondSubject && !!refs.refMap.subject2Face && !!refs.refMap.subject2Body;
    const hasProductReplacements = refs.productRefs.length > 0;
    const hasOutfit1 = !!refs.refMap.subject1Outfit;
    const hasOutfit2 = !!refs.refMap.subject2Outfit;
    const isEditPass = hasOutfit1 || hasOutfit2 || hasProductReplacements;
    const isSeedream = (params.modelId || 'gemini') === 'seedream';

    const prompt = isSeedream
      ? buildSeedreamPrompt(params, refs, runId)
      : buildGeminiPrompt(params, refs, runId);

    const negative = [
      'cartoon',
      'illustration',
      'anime',
      'cgi',
      '3d render',
      'painting',
      'text',
      'watermark',
      'logo overlay',
      'different pose',
      'different background',
      'different crop',
      'different camera angle',
      'different framing',
      'different lighting',
      'scene drift',
      'background drift',
      'face drift',
      'identity swap',
      'identity blending',
      'averaged faces',
      'hairstyle change',
      'bad anatomy',
      'deformed hands',
      'extra fingers',
      'extra limbs',
      'duplicated person',
      'missing person',
      'one person only',
      ...(hasSecondSubject ? ['single subject when two are required', 'missing second subject', 'original person left unchanged'] : []),
      'floating clothes',
      'collage look',
      'pasted clothing',
      'warped garments',
      'outfit contamination between people',
      'hallucinated pants',
      'hallucinated shoes',
      'forced full body outfit',
      ...(isEditPass ? ['global restyling', 'scene reinterpretation', 'unwanted re-design'] : []),
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