import { imageApiService, extractImageRef, type GenerateImageParams } from './imageApiService';
import type { DetectedObject } from './sceneAnalysisService';

export type CameraStyle = 'iphone_1x' | 'iphone_05x' | 'iphone_selfie';
export type AspectRatio = '9:16' | '4:5' | '1:1' | '16:9';

export interface CloneImageParams {
  targetImage: string;
  faceImage: string;
  bodyImage: string;
  replaceOutfit: boolean;
  outfitOverrideImage?: string | null;
  cameraStyle: CameraStyle;
  aspectRatio: AspectRatio;
  productOverrides?: DetectedObject[];
  modelId?: 'gemini' | 'seedream';
  onStatusChange?: GenerateImageParams['onStatusChange'];
  sessionParams?: Partial<GenerateImageParams>;
}

type RefMap = {
  scene: string;
  s1Face: string;
  s1Body: string;
  s1Outfit?: string;
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

  const map: RefMap = {
    scene:  add(params.targetImage, 'sceneAnchor') || 'REF0',
    s1Face: add(params.faceImage,   'subject1Face') || 'REF1',
    s1Body: add(params.bodyImage,   'subject1Body') || 'REF2',
  };

  if (params.replaceOutfit && params.outfitOverrideImage) {
    map.s1Outfit = add(params.outfitOverrideImage, 'subject1Outfit');
  }

  const productRefs: ProductRef[] = [];
  (params.productOverrides || []).forEach((item, index) => {
    if (!item.replacementImage) return;
    const refName = add(item.replacementImage, `productReplacement${index + 1}`);
    if (refName) productRefs.push({ name: item.name || `producto ${index + 1}`, refName });
  });

  return { referenceImages, map, productRefs };
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

  return `
[PROTOCOL: SCENE CLONE BASE PASS — SCENE TEMPLATE + HUMAN IDENTITY REPLACEMENT]
[RUN_ID: ${runId}]

[REFERENCE MAP]
- ${map.scene}: full scene template. Use for background, composition, pose, camera, crop, lighting, environment and interactions only.
- ${map.s1Face}: Subject face identity reference.
- ${map.s1Body}: Subject body reference. Use for body proportions, visible anatomy, skin tone and hair-length guidance only.

[PRIMARY GOAL]
Create a new photorealistic image that keeps the scene from ${map.scene}, but replaces the human identity.
The person in ${map.scene} is a placeholder. Preserve their pose and location, but NOT their face, hair identity, or recognizable identity.
Never return the original target image unchanged.

[SUBJECT MAPPING]
- Final image must contain exactly one main visible subject.
- Subject replaces the original visible person in ${map.scene}.
- The original person in ${map.scene} is only a pose/composition placeholder, not an identity source.

[SCENE LOCK]
- Preserve the environment/background from ${map.scene}.
- Preserve the camera angle, crop, framing, perspective and lens feel from ${map.scene}.
- Preserve the pose, gesture, body placement and interaction from ${map.scene}.
- Preserve the lighting direction, white balance, exposure, shadows and scene mood from ${map.scene}.
- Preserve props and environmental objects unless explicitly replaced.

[IDENTITY LOCK]
- Subject must clearly and recognizably match ${map.s1Face}.
- Subject body must stay coherent with ${map.s1Body}.
- The target person's original face and hair identity must not survive.

[BASE WARDROBE RULE]
- This is not the outfit-edit pass. Keep wardrobe logically coherent with the target pose unless outfit references are explicitly provided later.
- Correct identity replacement is more important than preserving the original target person's facial details.

${cameraPrompt(params.cameraStyle)}

[HARD NEGATIVE RULES]
- No original target face preserved.
- No unchanged target person.
- No identity blending.
- No identity swap.
- No scene drift, no background drift, no crop drift.
- No bad anatomy, no extra limbs, no extra fingers.
- No illustration, no CGI, no 3D render, no text, no watermark.
`.trim();
}

function editPrompt(params: CloneImageParams, refs: BuiltRefs, runId: string): string {
  const { map } = refs;
  const hasOutfit = !!map.s1Outfit;
  const hasProducts = refs.productRefs.length > 0;

  return `
[PROTOCOL: SCENE CLONE EDIT PASS — LOCKED BASE + LOCALIZED EDIT]
[RUN_ID: ${runId}]

[REFERENCE MAP]
- ${map.scene}: locked base composition anchor.
- ${map.s1Face}: Subject face identity lock.
- ${map.s1Body}: Subject body lock.
${hasOutfit ? `- ${map.s1Outfit}: Subject outfit reference.` : ''}
${refs.productRefs.map((p) => `- ${p.refName}: replacement reference for ${p.name}.`).join('\n')}

[PRIMARY GOAL]
Use ${map.scene} as a locked base image. Keep the image almost identical and perform only the requested localized outfit/product changes.
Do not regenerate the whole image. Do not change face, scene, pose, crop or background.

[SUBJECT MAPPING]
- Final image must contain exactly one main visible subject.
- Subject must remain visually identical to ${map.s1Face}.

[IDENTITY LOCK]
- Subject must still match ${map.s1Face}.
- Never change the face, identity, body placement or pose while applying outfits/products.
- Never revert to the original target identity.

[OUTFIT LOCAL EDIT]
${hasOutfit ? `- Replace ONLY Subject clothing using ${map.s1Outfit}.` : '- Keep Subject wardrobe unchanged unless a product replacement overlaps that area.'}
- Clothing must fit the exact visible pose and body geometry.
- Render only garment parts that are logically visible in the crop and pose.
- If pants, shoes, skirt, or accessories are hidden by crop/pose/occlusion, do not force them to appear.
- Respect occlusions from arms, hands, hair, props, furniture and frame edges.
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
- No illustration, no CGI, no 3D render, no text, no watermark.
`.trim();
}

export const cloneImageService = {
  async cloneImage(params: CloneImageParams): Promise<string> {
    const runId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const refs = buildRefs(params);

    const isEditPass = !!refs.map.s1Outfit || refs.productRefs.length > 0;
    const isSeedream = (params.modelId || 'gemini') === 'seedream';

    const prompt = isSeedream || !isEditPass
      ? basePrompt(params, refs, runId)
      : editPrompt(params, refs, runId);

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
      ...(isEditPass ? [
        'pasted clothing',
        'collage look',
        'floating clothes',
        'warped garments',
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
