// src/services/cloneImageService.ts
// ─────────────────────────────────────────────────────────────────────────────
// Clone de escena con sustitución de identidad + reemplazo de outfits/productos.
// V3.2: scene-lighting lock + identity-only references + smartphone-faithful stabilization
//
// CAMBIO CLAVE:
// - La imagen target se trata como plantilla de escena / pose / composición / iluminación.
// - Las referencias de rostro/cuerpo se usan SOLO para identidad/anatomía, no para look fotográfico.
// - Se elimina el sesgo de “high-end editorial / crisp beauty render” que contaminaba la integración.
// - Se agrega estabilización técnica automática en el mismo paso: limpia levemente blur/ruido/compresión sin convertir la foto en editorial.
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
    subject1Slot?: string;
    subject2Face?: string;
    subject2Body?: string;
    subject2Slot?: string;
    subject1Outfit?: string;
    subject2Outfit?: string;
  };
  productRefs: ProductRefEntry[];
};

function getCameraStylePrompt(cameraStyle: CameraStyle): string {
  if (cameraStyle === 'iphone_05x') {
    return '[CAMERA: 0.5x Ultra Wide] Ultra-wide perspective, slight edge distortion, deeper field of view, stronger environmental presence.';
  }
  if (cameraStyle === 'iphone_selfie') {
    return '[CAMERA: Front Selfie] Natural arm-length distance, selfie perspective, believable front-camera realism.';
  }
  return '[CAMERA: 1x Main] Natural proportions, handheld realism, approximately 26mm equivalent iPhone main camera look.';
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

  const subject1Slot = params.subject1SlotImage ? addRef(params.subject1SlotImage, 'subject1SlotAnchor') : undefined;
  const subject2Slot = (hasSecondSubject && params.subject2SlotImage) ? addRef(params.subject2SlotImage, 'subject2SlotAnchor') : undefined;

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
      subject1Slot,
      subject2Face,
      subject2Body,
      subject2Slot,
      subject1Outfit,
      subject2Outfit,
    },
    productRefs,
  };
}

function getSubjectPlacementBlock(selector: SubjectSelector | undefined, hasSecondSubject: boolean): string {
  if (!hasSecondSubject) {
    return [
      '[SUBJECT POSITION MAPPING]',
      '- There is exactly one visible person in the final image.',
      '- Subject 1 replaces the original visible person from the scene anchor.',
      '- The original visible person in the scene anchor is only a pose/composition placeholder and must not remain as the final identity.',
    ].join('\n');
  }

  if (selector === 'left') {
    return [
      '[SUBJECT POSITION MAPPING]',
      '- There are exactly two visible people in the final image.',
      '- Subject 1 MUST replace the person on the LEFT side of the scene anchor.',
      '- Subject 2 MUST replace the person on the RIGHT side of the scene anchor.',
      '- The original left-side person is only a placeholder and must not remain.',
      '- The original right-side person is only a placeholder and must not remain.',
      '- Never swap the mapping.',
    ].join('\n');
  }

  if (selector === 'right') {
    return [
      '[SUBJECT POSITION MAPPING]',
      '- There are exactly two visible people in the final image.',
      '- Subject 1 MUST replace the person on the RIGHT side of the scene anchor.',
      '- Subject 2 MUST replace the person on the LEFT side of the scene anchor.',
      '- The original right-side person is only a placeholder and must not remain.',
      '- The original left-side person is only a placeholder and must not remain.',
      '- Never swap the mapping.',
    ].join('\n');
  }

  return [
    '[SUBJECT POSITION MAPPING]',
    '- There are exactly two visible people in the final image.',
    '- Assign Subject 1 and Subject 2 to the two anchor positions using the most stable spatial mapping.',
    '- Once the mapping is inferred, keep it fixed.',
    '- Both original people in the scene anchor are only placeholders and must not remain as final identities.',
    '- Never swap the two subjects after mapping.',
  ].join('\n');
}

function getReferencePriorityBlock(refs: BuiltRefs): string {
  const sceneRef = refs.refMap.scene;
  const s1FaceRef = refs.refMap.subject1Face;
  const s1BodyRef = refs.refMap.subject1Body;
  const s2FaceRef = refs.refMap.subject2Face;
  const s2BodyRef = refs.refMap.subject2Body;
  const hasSecondSubject = !!s2FaceRef && !!s2BodyRef;

  return `
[REFERENCE PRIORITY]
- ${sceneRef} controls: lighting, exposure, contrast, white balance, shadows, highlights, color grading, camera quality, blur, grain, compression, perspective, crop, pose, expression, environment, and overall photographic realism.
- ${s1FaceRef} controls: Subject 1 facial identity only.
- ${s1BodyRef} controls: Subject 1 body proportions, visible anatomy, skin tone range, and general hair length only.
- Face/body references must NOT control lighting, exposure, skin finish, makeup intensity, camera quality, sharpness, contrast, color grading, facial expression, pose, crop, or background.
${hasSecondSubject ? `- ${s2FaceRef} controls: Subject 2 facial identity only.
- ${s2BodyRef} controls: Subject 2 body proportions, visible anatomy, skin tone range, and general hair length only.
- Subject 2 face/body references must NOT control lighting, exposure, skin finish, makeup intensity, camera quality, sharpness, contrast, color grading, facial expression, pose, crop, or background.` : ''}
`.trim();
}

function getSceneLightingTransferLock(refs: BuiltRefs): string {
  const sceneRef = refs.refMap.scene;
  const s1FaceRef = refs.refMap.subject1Face;
  const s1BodyRef = refs.refMap.subject1Body;
  const s2FaceRef = refs.refMap.subject2Face;
  const s2BodyRef = refs.refMap.subject2Body;
  const hasSecondSubject = !!s2FaceRef && !!s2BodyRef;

  return `
[SCENE LIGHTING TRANSFER LOCK]
- The inserted subject must be rendered inside the exact lighting system of ${sceneRef}.
- Copy the local light direction, shadow softness, shadow density, highlight intensity, bounce light, reflected color, ambient fill, skin exposure, skin contrast, and white balance from the person placeholder in ${sceneRef}.
- Match the placeholder person's face exposure, skin contrast, shadow pattern, highlight pattern, and local color cast from ${sceneRef}, even if the identity references have cleaner studio lighting.
- If ${sceneRef} has harsh sunlight, blown highlights, crushed shadows, low-light noise, warm indoor color, cool window light, flash, compression, motion blur, or soft focus, the inserted subject must inherit those same photographic conditions.
- Do not import studio lighting, frontal beauty lighting, gray-background portrait lighting, smooth skin finish, editorial facial contrast, perfect eye catchlights, or makeup rendering from ${s1FaceRef} or ${s1BodyRef}.
${hasSecondSubject ? `- Do not import studio lighting, frontal beauty lighting, gray-background portrait lighting, smooth skin finish, editorial facial contrast, perfect eye catchlights, or makeup rendering from ${s2FaceRef} or ${s2BodyRef}.` : ''}
`.trim();
}

function getSceneMatchedOutputQualityBlock(sceneRef: string): string {
  return `
[OUTPUT QUALITY]
- Match the capture quality of ${sceneRef}, not the quality of the identity references.
- Preserve the same sharpness, blur, grain, noise, compression, dynamic range, contrast, exposure, white balance, color grading, and lens behavior from ${sceneRef}.
- Do NOT upgrade the face, skin, hair, eyes, or clothing into a cleaner editorial/studio look.
- Do NOT add extra facial sharpness, beauty retouching, glossy skin, stronger catchlights, perfect pores, perfect makeup, or smoother skin than the scene supports.
- If ${sceneRef} is soft, noisy, compressed, low-light, overexposed, underexposed, warm, cool, blurry, flat, harsh, imperfect, or smartphone-like, the inserted subject must inherit those same imperfections.
- Final image must look like one coherent original smartphone photo captured under the exact same scene conditions.
`.trim();
}


function getTechnicalStabilizationBlock(sceneRef: string): string {
  return `
[TECHNICAL STABILIZATION — SMARTPHONE-FAITHFUL]
- Apply mild technical stabilization in the same generation step, but only after preserving the photographic character of ${sceneRef}.
- The goal is a cleaner version of the same smartphone capture, not a new aesthetic.
- If ${sceneRef} is blurry, slightly improve edge coherence and subject integration, but do not make faces, eyes, pores, hair, clothing, products, or logos sharper than a real iPhone capture from that scene would allow.
- If ${sceneRef} has compression artifacts, reduce them subtly while preserving the original color grading, lighting, texture softness, sensor noise, lens behavior, and casual smartphone feel.
- If ${sceneRef} is noisy or low-light, reduce noise mildly while preserving natural iPhone grain and low-light softness.
- If ${sceneRef} is already sharp, do not add extra sharpness.
- Do not upscale by inventing new skin texture, makeup, eyelashes, hair strands, fabric weave, product labels, stitching, logos, or material details that are not supported by the references.
- Do not transform the image into studio, editorial, DSLR, cinematic, luxury, HDR, catalog, campaign, beauty-retouched, or product-advertising photography.
- The result may be technically cleaner, but it must still feel like the same original iPhone photo under the same imperfect conditions.
`.trim();
}

function buildBaseGeminiPrompt(params: CloneImageParams, refs: BuiltRefs, runId: string): string {
  const hasSecondSubject = !!params.enableSecondSubject && !!refs.refMap.subject2Face && !!refs.refMap.subject2Body;
  const sceneRef    = refs.refMap.scene;
  const s1FaceRef   = refs.refMap.subject1Face;
  const s1BodyRef   = refs.refMap.subject1Body;
  const s1SlotRef   = refs.refMap.subject1Slot;
  const s2FaceRef   = refs.refMap.subject2Face;
  const s2BodyRef   = refs.refMap.subject2Body;
  const s2SlotRef   = refs.refMap.subject2Slot;

  const refMapLines = [
    `- ${sceneRef} = scene anchor (USE FOR SCENE / POSE / COMPOSITION / LIGHTING / BACKGROUND / CAMERA QUALITY ONLY)`,
    `- ${s1FaceRef} = Subject 1 face identity reference (IDENTITY ONLY — not lighting, beauty style, expression, pose, or camera quality)`,
    `- ${s1BodyRef} = Subject 1 body reference (BODY PROPORTIONS / VISIBLE ANATOMY / SKIN TONE RANGE / GENERAL HAIR LENGTH ONLY)`,
    ...(s1SlotRef ? [`- ${s1SlotRef} = Subject 1 positional slot anchor (USE FOR EXACT PLACEMENT / POSE POSITION ONLY — not an identity source)`] : []),
    ...(hasSecondSubject && s2FaceRef ? [`- ${s2FaceRef} = Subject 2 face identity reference (IDENTITY ONLY — not lighting, beauty style, expression, pose, or camera quality)`] : []),
    ...(hasSecondSubject && s2BodyRef ? [`- ${s2BodyRef} = Subject 2 body reference (BODY PROPORTIONS / VISIBLE ANATOMY / SKIN TONE RANGE / GENERAL HAIR LENGTH ONLY)`] : []),
    ...(hasSecondSubject && s2SlotRef ? [`- ${s2SlotRef} = Subject 2 positional slot anchor (USE FOR EXACT PLACEMENT / POSE POSITION ONLY — not an identity source)`] : []),
  ].join('\n');

  return `
[PROTOCOL: CLONE IMAGE BASE PASS — SCENE TEMPLATE + IDENTITY REPLACEMENT]
[RUN_ID: ${runId}]

[REFERENCE MAP]
${refMapLines}

${getReferencePriorityBlock(refs)}

[PRIMARY GOAL]
Use ${sceneRef} as a scene template only.
Preserve the scene layout, pose, camera framing, background, lighting, perspective, interpersonal spacing, and overall composition from ${sceneRef}.
DO NOT preserve the original people identities from ${sceneRef}.
The people visible in ${sceneRef} are placeholders that must be replaced by the provided subjects.

${getSubjectPlacementBlock(params.subject1Selector, hasSecondSubject)}

${s1SlotRef ? `[SLOT ANCHOR RULES]
- ${s1SlotRef} shows the exact position, scale, crop, and pose context for Subject 1 in this scene.
- Use ${s1SlotRef} ONLY for spatial placement — to know where Subject 1's body goes in the frame.
- The human visible inside ${s1SlotRef} is a placeholder. Their face and identity must NOT appear in the output.
- Subject 1's face must come exclusively from ${s1FaceRef}.
- The slot anchor is a position guide, not an identity guide.` : ''}
${hasSecondSubject && s2SlotRef ? `- ${s2SlotRef} is the positional slot anchor for Subject 2. Same rules apply: position/scale only, identity from ${s2FaceRef}.` : ''}

[SCENE TEMPLATE RULES]
- Preserve the environment/background from ${sceneRef}.
- Preserve the camera angle and framing from ${sceneRef}.
- Preserve the pose and body placement from ${sceneRef} with high fidelity — body angle, arm position, hand placement, tilt of the head, shoulder direction.
- Preserve the crop from ${sceneRef}.
- Preserve the lighting direction, shadow direction, exposure, contrast, white balance, color grading, noise, blur, and compression from ${sceneRef}.
- Preserve the EXACT facial expression from ${sceneRef}: the mouth shape (open/closed/smile/serious), the specific eye shape (squinting/wide/soft/intense), the eyebrow position, cheek tension, and overall emotional tone.
- Preserve the approximate gesture, posture, leaning, and interpersonal interaction from ${sceneRef}.
- Preserve visible props and environmental objects unless explicitly replaced elsewhere.
- Treat the anchor people only as pose/composition placeholders, not as identity references.

${getSceneLightingTransferLock(refs)}

[FACIAL EXPRESSION LOCK]
- The facial expression of each subject in the output MUST match the facial expression of the corresponding person in ${sceneRef}.
- Do NOT default to a neutral face — copy the emotional state from ${sceneRef}.
- If the person in ${sceneRef} is smiling, the subject must smile with equivalent intensity.
- If the person in ${sceneRef} has a relaxed, serious, playful, squinting, kissing, winking, eyes-closed, or looking-away expression, match it exactly.
- Expression cloning is as important as identity cloning for the quality of this output.

[IDENTITY REPLACEMENT RULES]
- Replace every visible original anchor person identity.
- If the anchor contains 1 person, replace that person with Subject 1.
- If the anchor contains 2 people, replace BOTH people: one with Subject 1 and the other with Subject 2, according to the mapping rules.
- Never keep the original face of any visible anchor person.
- Never keep the original hair identity of any visible anchor person.
- Never return the unmodified target image.
- Never output only one replaced subject if two are required.
- Never duplicate Subject 1 onto both people.
- Never duplicate Subject 2 onto both people.
- Never blend Subject 1 and Subject 2 into a hybrid identity.

[SUBJECT 1 IDENTITY]
- Subject 1 face must clearly and recognizably match ${s1FaceRef}.
- Subject 1 body structure should follow ${s1BodyRef} for body proportions, visible anatomy, skin tone range, and general hair length only.
- Final visible skin color must be adapted to the exposure, white balance, shadows, highlights, and color grading of ${sceneRef}.
- Subject 1 must remain a distinct identity.

${hasSecondSubject && s2FaceRef && s2BodyRef ? `
[SUBJECT 2 IDENTITY]
- Subject 2 face must clearly and recognizably match ${s2FaceRef}.
- Subject 2 body structure should follow ${s2BodyRef} for body proportions, visible anatomy, skin tone range, and general hair length only.
- Final visible skin color must be adapted to the exposure, white balance, shadows, highlights, and color grading of ${sceneRef}.
- Subject 2 must remain a distinct identity.
- Subject 2 must not be confused with Subject 1.
`.trim() : ''}

[WARDROBE RULES FOR BASE PASS]
- In BASE PASS, wardrobe may remain generally consistent with the target scene unless explicit outfit replacement is requested later.
- Do not prioritize preserving the original identities through wardrobe.
- The most important objective is correct identity replacement while preserving scene composition.

${getCameraStylePrompt(params.cameraStyle)}

${getSceneMatchedOutputQualityBlock(sceneRef)}

${getTechnicalStabilizationBlock(sceneRef)}

[HARD RULES]
- Photorealistic smartphone image. No illustration. No CGI. No 3D render look.
- No text. No watermark.
- No face drift.
- No identity swap.
- No identity blending.
- No leaving the original anchor identity unchanged.
- No body deformation. No extra limbs. No extra fingers.
- No scene drift. No background drift. No composition drift.
- No global beautification. No editorial upgrade. No studio-lighting contamination from identity, outfit, or product references.
- Technical stabilization is allowed only as subtle smartphone-faithful cleanup, not aesthetic restyling.
- The final image must look like the same scene, but with the anchor people replaced by the requested subjects.
`.trim();
}

function buildEditGeminiPrompt(params: CloneImageParams, refs: BuiltRefs, runId: string): string {
  const hasSecondSubject = !!params.enableSecondSubject && !!refs.refMap.subject2Face && !!refs.refMap.subject2Body;
  const sceneRef = refs.refMap.scene;
  const s1FaceRef = refs.refMap.subject1Face;
  const s1BodyRef = refs.refMap.subject1Body;
  const s2FaceRef = refs.refMap.subject2Face;
  const s2BodyRef = refs.refMap.subject2Body;
  const s1OutfitRef = refs.refMap.subject1Outfit;
  const s2OutfitRef = refs.refMap.subject2Outfit;

  const hasOutfit1 = !!s1OutfitRef;
  const hasOutfit2 = !!s2OutfitRef;
  const hasProductReplacements = refs.productRefs.length > 0;

  const refMapLines = [
    `- ${sceneRef} = locked base composition anchor`,
    `- ${s1FaceRef} = Subject 1 face identity reference (IDENTITY ONLY — not lighting, beauty style, expression, pose, or camera quality)`,
    `- ${s1BodyRef} = Subject 1 body reference (BODY PROPORTIONS / VISIBLE ANATOMY / SKIN TONE RANGE / GENERAL HAIR LENGTH ONLY)`,
    ...(hasSecondSubject && s2FaceRef ? [`- ${s2FaceRef} = Subject 2 face identity reference (IDENTITY ONLY — not lighting, beauty style, expression, pose, or camera quality)`] : []),
    ...(hasSecondSubject && s2BodyRef ? [`- ${s2BodyRef} = Subject 2 body reference (BODY PROPORTIONS / VISIBLE ANATOMY / SKIN TONE RANGE / GENERAL HAIR LENGTH ONLY)`] : []),
    ...(hasOutfit1 ? [`- ${s1OutfitRef} = Subject 1 outfit reference`] : []),
    ...(hasOutfit2 ? [`- ${s2OutfitRef} = Subject 2 outfit reference`] : []),
    ...refs.productRefs.map((p) => `- ${p.refName} = replacement reference for product/accessory "${p.name}"`),
  ].join('\n');

  return `
[PROTOCOL: CLONE IMAGE EDIT PASS — LOCALIZED OUTFIT / PRODUCT EDIT]
[RUN_ID: ${runId}]

[REFERENCE MAP]
${refMapLines}

${getReferencePriorityBlock(refs)}

[PRIMARY GOAL]
Use ${sceneRef} as a locked anchor image.
Keep the image almost identical to ${sceneRef}.
Perform only localized edits to the explicitly requested clothing and/or products.
Do not redesign the scene and do not change subject identities.

${getSubjectPlacementBlock(params.subject1Selector, hasSecondSubject)}

[SCENE LOCK]
- Keep framing/crop identical to ${sceneRef}.
- Keep camera angle and lens impression identical to ${sceneRef}.
- Keep pose and body placement identical to ${sceneRef}.
- Keep background and environment identical to ${sceneRef}.
- Keep lighting direction, shadow direction, exposure, contrast, white balance, color grading, noise, blur, compression, and local reflections identical to ${sceneRef}.
- Keep interpersonal spacing and body interaction identical to ${sceneRef}.

${getSceneLightingTransferLock(refs)}

[IDENTITY LOCK]
- Subject 1 identity must still match ${s1FaceRef}.
- Subject 1 body proportions and visible anatomy must remain coherent with ${s1BodyRef}, but visible skin must stay adapted to ${sceneRef} lighting and color grading.
${hasSecondSubject && s2FaceRef ? `- Subject 2 identity must still match ${s2FaceRef}.` : ''}
${hasSecondSubject && s2BodyRef ? `- Subject 2 body proportions and visible anatomy must remain coherent with ${s2BodyRef}, but visible skin must stay adapted to ${sceneRef} lighting and color grading.` : ''}
- Never change the identity of any already-correct subject while applying outfits/products.
- Never re-interpret the image globally.
- Never revert to the original target person identities.

[OUTFIT RULES]
${hasOutfit1 ? `- Replace ONLY Subject 1 clothing using ${s1OutfitRef}.` : '- Subject 1 wardrobe must remain unchanged unless a requested product edit overlaps that area.'}
${hasSecondSubject ? (hasOutfit2 ? `- Replace ONLY Subject 2 clothing using ${s2OutfitRef}.` : '- Subject 2 wardrobe must remain unchanged unless a requested product edit overlaps that area.') : ''}
- Outfit edits are localized changes only.
- Do not affect the other subject when editing one subject.
- Use body references only for body proportions and skin tone range, not as clothing references when an outfit override exists.
- Adapt the outfit to the exact visible pose and crop of the subject in the anchor image.
- Render only garment parts that are logically visible in the actual crop and pose.
- If only the upper body is visible, do not invent lower garments or shoes.
- Respect occlusions from arms, hands, hair, furniture, other person, props, and frame edges.
- The outfit reference controls garment identity only: silhouette, garment type, base color, visible design, material family, and recognizable details.
- The outfit reference must NOT control lighting, exposure, camera quality, catalog styling, mannequin pose, product-photo sharpness, background, or color grading.
- The new clothing must inherit scene lighting, perspective, shading, white balance, color grading, texture softness, noise, blur, compression, occlusion, and shadow logic from the anchor image.
- Fabrics must look naturally worn in the scene, with realistic folds, drape, seams, tension, and material response, but without catalog/editorial enhancement.
- The result must not look like pasted-on clothing or a collage.

${hasProductReplacements ? `
[PRODUCT REPLACEMENTS]
${refs.productRefs.map((p) => `- Replace only the corresponding product/accessory with the item shown in ${p.refName} (${p.name}). The product reference controls item identity, base color, shape, material family, and visible design only. It must NOT control lighting, catalog styling, product-photo sharpness, exposure, shadows, background, or color grading. Keep scale, placement, interaction, occlusion, perspective, noise, blur, compression, reflections, and lighting coherent with the anchor scene.`).join('\n')}
`.trim() : ''}

${getCameraStylePrompt(params.cameraStyle)}

${getSceneMatchedOutputQualityBlock(sceneRef)}

${getTechnicalStabilizationBlock(sceneRef)}

[HARD RULES]
- Photorealistic smartphone image. No illustration. No CGI. No 3D render look.
- No text. No watermark.
- No face drift.
- No identity swaps.
- No hairstyle drift.
- No body deformation. No extra limbs. No extra fingers.
- No scene drift. No background drift. No composition drift.
- No wardrobe contamination between Subject 1 and Subject 2.
- No global beautification. No editorial upgrade. No studio-lighting contamination from identity references.
- The final result must look like one coherent original photo.
`.trim();
}

function buildBaseSeedreamPrompt(params: CloneImageParams, refs: BuiltRefs, runId: string): string {
  const hasSecondSubject = !!params.enableSecondSubject && !!refs.refMap.subject2Face && !!refs.refMap.subject2Body;
  const sceneRef = refs.refMap.scene;
  const s1FaceRef = refs.refMap.subject1Face;
  const s1BodyRef = refs.refMap.subject1Body;
  const s2FaceRef = refs.refMap.subject2Face;
  const s2BodyRef = refs.refMap.subject2Body;

  return `
[REFERENCE IMAGES PROVIDED]
- ${sceneRef}: scene template only. Use it for background, pose, composition, crop, perspective, camera, lighting, exposure, white balance, color grading, blur, grain, compression, and overall scene structure.
- ${s1FaceRef}: Subject 1 face identity reference only. Do not copy its lighting, studio look, skin finish, expression, pose, sharpness, or camera quality.
- ${s1BodyRef}: Subject 1 body reference for body proportions, visible anatomy, skin tone range, and general hair length only.
${hasSecondSubject && s2FaceRef ? `- ${s2FaceRef}: Subject 2 face identity reference only. Do not copy its lighting, studio look, skin finish, expression, pose, sharpness, or camera quality.` : ''}
${hasSecondSubject && s2BodyRef ? `- ${s2BodyRef}: Subject 2 body reference for body proportions, visible anatomy, skin tone range, and general hair length only.` : ''}

[RUN ID]
${runId}

${getReferencePriorityBlock(refs)}

[MAIN GOAL]
Replicate the same scene from ${sceneRef}, but do NOT preserve the original people identities.
The people in ${sceneRef} are placeholders that must be replaced by the provided subjects.

${getSubjectPlacementBlock(params.subject1Selector, hasSecondSubject)}

[SCENE RULES]
- Keep the same scene, background, camera, framing, crop, perspective, lighting, exposure, white balance, color grading, noise, blur, compression, and pose from ${sceneRef}.
- Keep the same interpersonal spacing and body placement.
- Keep the same environment and visible props.
- Keep the exact facial expression from ${sceneRef}: mouth shape, eye shape, eyebrow position, cheek tension, and emotional tone.
- Treat the original people only as pose/composition placeholders, not as identities to preserve.

${getSceneLightingTransferLock(refs)}

[IDENTITY REPLACEMENT RULES]
- Replace every visible person identity from the scene anchor.
- Never return the original target people unchanged.
- If there is one visible person, replace that person with Subject 1.
- If there are two visible people, replace both people with Subject 1 and Subject 2 according to the mapping.
- Never output only one replaced person when two are required.
- Never duplicate one subject onto both people.
- Never blend both identities together.

[SUBJECT IDENTITIES]
- Subject 1 face must clearly match ${s1FaceRef}.
- Subject 1 body proportions and skin tone range must follow ${s1BodyRef}, but final visible skin color must adapt to ${sceneRef} exposure, shadows, highlights, white balance, and color grading.
${hasSecondSubject && s2FaceRef ? `- Subject 2 face must clearly match ${s2FaceRef}.` : ''}
${hasSecondSubject && s2BodyRef ? `- Subject 2 body proportions and skin tone range must follow ${s2BodyRef}, but final visible skin color must adapt to ${sceneRef} exposure, shadows, highlights, white balance, and color grading.` : ''}

${getCameraStylePrompt(params.cameraStyle)}

${getSceneMatchedOutputQualityBlock(sceneRef)}

${getTechnicalStabilizationBlock(sceneRef)}

[HARD RULES]
- Photorealistic smartphone image only.
- No text or watermark.
- No face drift, identity swap, or identity blending.
- No scene drift.
- No body deformation.
- No global beautification. No editorial upgrade. No studio-lighting contamination from identity references.
- The final result must look like the same scene, but with the anchor people replaced by the requested subjects.
`.trim();
}

function buildEditSeedreamPrompt(params: CloneImageParams, refs: BuiltRefs, runId: string): string {
  const hasSecondSubject = !!params.enableSecondSubject && !!refs.refMap.subject2Face && !!refs.refMap.subject2Body;
  const sceneRef = refs.refMap.scene;
  const s1OutfitRef = refs.refMap.subject1Outfit;
  const s2OutfitRef = refs.refMap.subject2Outfit;
  const hasOutfit1 = !!s1OutfitRef;
  const hasOutfit2 = !!s2OutfitRef;
  const hasProductReplacements = refs.productRefs.length > 0;

  return `
[REFERENCE IMAGES PROVIDED]
- ${refs.refMap.scene}: locked base composition anchor. Use it for scene, pose, crop, lighting, exposure, white balance, color grading, camera quality, blur, grain, and compression.
- ${refs.refMap.subject1Face}: Subject 1 face identity reference only. Do not copy its lighting, studio look, skin finish, expression, pose, sharpness, or camera quality.
- ${refs.refMap.subject1Body}: Subject 1 body reference for body proportions, visible anatomy, skin tone range, and general hair length only.
${hasSecondSubject && refs.refMap.subject2Face ? `- ${refs.refMap.subject2Face}: Subject 2 face identity reference only. Do not copy its lighting, studio look, skin finish, expression, pose, sharpness, or camera quality.` : ''}
${hasSecondSubject && refs.refMap.subject2Body ? `- ${refs.refMap.subject2Body}: Subject 2 body reference for body proportions, visible anatomy, skin tone range, and general hair length only.` : ''}
${hasOutfit1 ? `- ${s1OutfitRef}: Subject 1 outfit reference.` : ''}
${hasOutfit2 ? `- ${s2OutfitRef}: Subject 2 outfit reference.` : ''}
${refs.productRefs.map((p) => `- ${p.refName}: replacement reference for product/accessory "${p.name}".`).join('\n')}

[RUN ID]
${runId}

${getReferencePriorityBlock(refs)}

[MAIN GOAL]
Perform a minimal localized edit on the locked base image.
Keep the scene, crop, pose, lighting, camera quality, color grading, and identities stable.
Change only the explicitly requested outfit and/or product areas.

${getSubjectPlacementBlock(params.subject1Selector, hasSecondSubject)}

[LOCK RULES]
- Keep the scene unchanged.
- Keep background unchanged.
- Keep pose unchanged.
- Keep crop unchanged.
- Keep camera impression unchanged.
- Keep lighting, exposure, white balance, color grading, noise, blur, compression, and local reflections unchanged.
- Keep correct identities unchanged.

${getSceneLightingTransferLock(refs)}

[IDENTITY RULES]
- Subject 1 must still match ${refs.refMap.subject1Face}.
${hasSecondSubject && refs.refMap.subject2Face ? `- Subject 2 must still match ${refs.refMap.subject2Face}.` : ''}
- Never swap identities.
- Never revert to the original target identities.
- Never import studio lighting, beauty skin, or editorial sharpness from identity references.

[OUTFIT RULES]
${hasOutfit1 ? `- Change only Subject 1 clothing using ${s1OutfitRef}.` : '- Keep Subject 1 wardrobe unchanged unless a requested product edit overlaps that area.'}
${hasSecondSubject ? (hasOutfit2 ? `- Change only Subject 2 clothing using ${s2OutfitRef}.` : '- Keep Subject 2 wardrobe unchanged unless a requested product edit overlaps that area.') : ''}
- Outfit edits are localized only.
- Fit clothing to the subject pose exactly.
- Show only clothing parts that are actually visible.
- Do not invent hidden pants, skirts, shoes, or full-body sections.
- The outfit reference controls garment identity only: silhouette, garment type, base color, visible design, material family, and recognizable details.
- The outfit reference must NOT control lighting, exposure, camera quality, catalog styling, mannequin pose, product-photo sharpness, background, or color grading.
- Clothing must look naturally photographed in the scene, with correct folds, drape, lighting, shadow, perspective, color grading, noise, blur, compression, softness, and occlusion.
- Do not affect the other subject when editing one subject.

${hasProductReplacements ? `
[PRODUCT REPLACEMENTS]
${refs.productRefs.map((p) => `- Replace only the matching product/accessory with ${p.refName} (${p.name}). The product reference controls item identity, base color, shape, material family, and visible design only. It must NOT control lighting, catalog styling, product-photo sharpness, exposure, shadows, background, or color grading. Preserve scale, placement, interaction, occlusion, perspective, noise, blur, compression, reflections, and lighting from the locked scene.`).join('\n')}
`.trim() : ''}

${getCameraStylePrompt(params.cameraStyle)}

${getSceneMatchedOutputQualityBlock(sceneRef)}

${getTechnicalStabilizationBlock(sceneRef)}

[HARD RULES]
- Photorealistic smartphone image only.
- No text or watermark.
- No scene drift.
- No face drift.
- No identity swaps.
- No body deformation.
- No collage look.
- No global beautification. No editorial upgrade. No studio-lighting contamination from identity, outfit, or product references.
- Technical stabilization is allowed only as subtle smartphone-faithful cleanup, not aesthetic restyling.
- Final result must look like one coherent original photo.
`.trim();
}

export const cloneImageService = {
  async cloneImage(params: CloneImageParams): Promise<string> {
    const runId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const refs = buildReferences(params);

    const hasSecondSubject = !!params.enableSecondSubject && !!refs.refMap.subject2Face && !!refs.refMap.subject2Body;
    const hasOutfit1 = !!refs.refMap.subject1Outfit;
    const hasOutfit2 = !!refs.refMap.subject2Outfit;
    const hasProductReplacements = refs.productRefs.length > 0;
    const isEditPass = hasOutfit1 || hasOutfit2 || hasProductReplacements;
    const isSeedream = (params.modelId || 'gemini') === 'seedream';

    const prompt = isSeedream
      ? (isEditPass
          ? buildEditSeedreamPrompt(params, refs, runId)
          : buildBaseSeedreamPrompt(params, refs, runId))
      : (isEditPass
          ? buildEditGeminiPrompt(params, refs, runId)
          : buildBaseGeminiPrompt(params, refs, runId));

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
      'different background',
      'different scene',
      'different framing',
      'different crop',
      'different camera angle',
      'different lighting',
      'different exposure',
      'different white balance',
      'different color grading',
      'different contrast',
      'different sharpness',
      'studio lighting',
      'beauty lighting',
      'editorial lighting',
      'glossy skin',
      'overly smooth skin',
      'beauty retouching',
      'over-sharpened face',
      'perfect catchlights',
      'scene drift',
      'background drift',
      'composition drift',
      'face drift',
      'identity swap',
      'identity blending',
      'averaged faces',
      'hybrid face',
      'original target face preserved',
      'original anchor identity left unchanged',
      'missing person',
      'one person only',
      'duplicated person',
      'duplicate same identity',
      'bad anatomy',
      'deformed hands',
      'extra fingers',
      'extra limbs',
      ...(hasSecondSubject ? [
        'missing second subject',
        'single subject when two are required',
        'same person copied twice',
      ] : []),
      ...(isEditPass ? [
        'global restyling',
        'full image redesign',
        'scene reinterpretation',
        'collage look',
        'pasted clothing',
        'floating clothes',
        'warped garments',
        'outfit contamination between people',
        'hallucinated pants',
        'hallucinated shoes',
        'forced full body outfit',
      ] : [
        'return original unmodified target image',
        'unchanged original people',
      ]),
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
