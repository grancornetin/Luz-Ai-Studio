// src/services/cloneImageService.ts
// ─────────────────────────────────────────────────────────────────────────────
// Clone de escena con sustitución de identidad + reemplazo de outfits/productos.
// Esta versión fortalece la etapa de cambio de outfit para reducir drift de:
// - rostro
// - escena
// - pose / encuadre
// - geometría corporal
// y obliga al modelo a hacer una edición localizada sobre la composición base.
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
  // Notificaciones Nivel 3 — sessionId/module/etc para agrupar shots
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
    return '- There is one visible subject. Subject 1 is the only person in the frame.';
  }

  if (selector === 'left') {
    return [
      '- Subject 1 is the person on the LEFT side of the frame in the scene anchor.',
      '- Subject 2 is the other visible person.'
    ].join('\n');
  }

  if (selector === 'right') {
    return [
      '- Subject 1 is the person on the RIGHT side of the frame in the scene anchor.',
      '- Subject 2 is the other visible person.'
    ].join('\n');
  }

  return [
    '- Subject 1 and Subject 2 must be assigned by spatial consistency with the scene anchor.',
    '- Infer the most consistent mapping once, then keep that mapping fixed throughout the generation.',
    '- Never swap the identities of Subject 1 and Subject 2.'
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
    `- ${s1BodyRef} = Subject 1 body reference (body proportions / visible anatomy / skin tone only)`,
    ...(hasSecondSubject && s2FaceRef ? [`- ${s2FaceRef} = Subject 2 face identity reference`] : []),
    ...(hasSecondSubject && s2BodyRef ? [`- ${s2BodyRef} = Subject 2 body reference (body proportions / visible anatomy / skin tone only)`] : []),
    ...(hasOutfit1 && s1OutfitRef ? [`- ${s1OutfitRef} = Subject 1 outfit reference`] : []),
    ...(hasOutfit2 && s2OutfitRef ? [`- ${s2OutfitRef} = Subject 2 outfit reference`] : []),
    ...refs.productRefs.map(p => `- ${p.refName} = Replacement reference for product/accessory "${p.name}"`),
  ].join('\n');

  const goalText = isEditPass
    ? `Use ${sceneRef} as a LOCKED anchor image. Perform a localized edit only. Keep the image almost identical to ${sceneRef}, and change only the explicitly requested wardrobe/products.`
    : `Recreate ${sceneRef} with the same scene, pose, framing, background and lighting, while replacing the visible subject identity/identities with the provided references.`;

  const subject1Task = [
    '[SUBJECT 1 TASK]',
    `- Subject 1 identity must match ${s1FaceRef} for face, hair identity, and overall recognizable appearance.`,
    `- Subject 1 body must follow ${s1BodyRef} only for body proportions, visible anatomy and skin tone alignment.`,
    hasOutfit1 && s1OutfitRef
      ? `- Replace ONLY Subject 1 clothing using ${s1OutfitRef}. The new outfit must be naturally worn by Subject 1 and must not affect face, body geometry, pose, or the rest of the scene.`
      : `- ${isEditPass ? 'Keep Subject 1 wardrobe unchanged unless a product replacement overlaps that area.' : 'If no outfit override is provided, keep the wardrobe consistent with the scene anchor.'}`,
  ].join('\n');

  const subject2Task = hasSecondSubject && s2FaceRef && s2BodyRef
    ? [
        '[SUBJECT 2 TASK]',
        `- Subject 2 identity must match ${s2FaceRef} for face, hair identity, and overall recognizable appearance.`,
        `- Subject 2 body must follow ${s2BodyRef} only for body proportions, visible anatomy and skin tone alignment.`,
        hasOutfit2 && s2OutfitRef
          ? `- Replace ONLY Subject 2 clothing using ${s2OutfitRef}. The new outfit must be naturally worn by Subject 2 and must not affect Subject 1, face identity, body geometry, pose, or the rest of the scene.`
          : `- ${isEditPass ? 'Keep Subject 2 wardrobe unchanged unless a product replacement overlaps that area.' : 'If no outfit override is provided, keep the wardrobe consistent with the scene anchor.'}`,
      ].join('\n')
    : '';

  const productText = hasProductReplacements
    ? [
        '[PRODUCT REPLACEMENTS]',
        ...refs.productRefs.map(p => `- Replace only the corresponding product/accessory in the scene with the item shown in ${p.refName} (${p.name}). Keep scale, placement, perspective, hand interaction, lighting, and shadows coherent with the scene.`),
      ].join('\n')
    : '';

  return `
[PROTOCOL: CLONE IMAGE — SCENE LOCK + IDENTITY LOCK + LOCAL OUTFIT EDIT]
[MODE: ${isEditPass ? 'EDIT PASS' : 'BASE PASS'}]
[RUN_ID: ${runId}]

[REFERENCE MAP]
${referenceMapLines}

[GOAL]
${goalText}

[SUBJECT PLACEMENT]
${getSubjectPlacementInstruction(params.subject1Selector, hasSecondSubject)}

${subject1Task}
${subject2Task ? `\n\n${subject2Task}` : ''}
${productText ? `\n\n${productText}` : ''}

[SCENE LOCK]
- Framing/crop: identical to ${sceneRef}.
- Camera angle and lens impression: identical to ${sceneRef}.
- Pose and body placement: identical to ${sceneRef}.
- Background and environment: identical to ${sceneRef}.
- Lighting, white balance and shadow direction: identical to ${sceneRef}.
- Hair positioning and facial orientation should remain coherent with the scene anchor.

${getCameraStylePrompt(params.cameraStyle)}

[OUTFIT INTEGRATION RULES]
- Outfit replacement is a LOCALIZED change only.
- Do NOT redesign the whole image.
- Do NOT change identity, face structure, hairstyle, scene, crop, camera, or pose while applying outfits.
- Use body references only for body proportions and skin tone. NEVER copy their clothing when an outfit override exists.
- Adapt the outfit to the exact visible body pose from the scene anchor.
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

  const subject2Instructions = hasSecondSubject
    ? [
        '- There are two visible people in the scene.',
        getSubjectPlacementInstruction(params.subject1Selector, true),
        hasOutfit2 && refs.refMap.subject2Outfit
          ? `- Change only Subject 2 clothing using ${refs.refMap.subject2Outfit}.`
          : '- Keep Subject 2 wardrobe unchanged unless a product replacement overlaps that area.',
      ].join('\n')
    : '- There is only one visible person in the scene.';

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
  : `Replicate ${refs.refMap.scene} with the same scene, framing, pose, background and lighting, while replacing the visible subject identity/identities using the provided references.`}

[IDENTITY AND BODY RULES]
- Subject 1 face identity must match ${refs.refMap.subject1Face}.
- Subject 1 body proportions and skin tone must follow ${refs.refMap.subject1Body}.
${hasOutfit1 && refs.refMap.subject1Outfit
  ? `- Change only Subject 1 clothing using ${refs.refMap.subject1Outfit}.`
  : `- ${isEditPass ? 'Keep Subject 1 wardrobe unchanged unless a product replacement overlaps that area.' : 'Keep Subject 1 wardrobe consistent with the scene anchor if no outfit override is supplied.'}`}
${hasSecondSubject && refs.refMap.subject2Face ? `- Subject 2 face identity must match ${refs.refMap.subject2Face}.` : ''}
${hasSecondSubject && refs.refMap.subject2Body ? `- Subject 2 body proportions and skin tone must follow ${refs.refMap.subject2Body}.` : ''}
${subject2Instructions}

[SCENE LOCK]
- Keep the framing/crop identical to the scene anchor.
- Keep pose and body placement identical to the scene anchor.
- Keep background and environment identical to the scene anchor.
- Keep lighting, shadow direction, white balance and camera impression identical to the scene anchor.

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
      'hairstyle change',
      'bad anatomy',
      'deformed hands',
      'extra fingers',
      'extra limbs',
      'duplicated person',
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