// src/services/avatarService.ts
// ─────────────────────────────────────────────────────────────────────────────
// Generación de avatares (body master, vistas técnicas, face master).
// Usa imageApiService → QStash + Redis → image-worker → Gemini 3 @ global.
// Nunca llama directamente a la API de Google ni al endpoint /api/gemini/image
// de forma síncrona.
// ─────────────────────────────────────────────────────────────────────────────

import { imageApiService, extractImageRef, type GenerateImageParams } from './imageApiService';

const MODULE = 'avatarService';

export const avatarService = {

  async generateBodyMaster(
    identityPrompt: string,
    negative: string,
    files: string[],
    gender: 'hombre' | 'mujer',
    forceOutfit: string | null = null,
    personality: string = 'Profesional y elegante',
    expression: string = 'Natural',
    onStatusChange?: GenerateImageParams['onStatusChange'],
  ): Promise<string> {
    const bodyArchetype = gender === 'mujer'
      ? 'PERFECT HOURGLASS 90-60-90 PROPORTIONS. Highly toned aesthetic silhouette. Slim waist, wide hips.'
      : 'ATHLETIC GYM BUILD. V-taper silhouette. Highly defined musculature, broad shoulders, slim waist.';

    const outfitInstruction = forceOutfit
      ? `Wearing ${forceOutfit}. DO NOT remove this outfit. The outfit is mandatory and must be integrated realistically.`
      : `[OUTFIT STRIPPING: REMOVE ALL ORIGINAL CLOTHES, ACCESSORIES, AND BACKGROUND.]
      [MANDATORY OUTFIT: PLAIN SKIN-TIGHT NEUTRAL GREY TECHNICAL BODYSUIT. NO TEXTURES, NO BRANDING.]`;

    const poseInstruction = (personality && !['Profesional y elegante', 'Reservado y Minimalista', 'Natural'].includes(personality))
      ? `Pose reflecting a ${personality} personality.`
      : 'Neutral, confident posture.';

    const expressionInstruction = (expression && expression !== 'Natural')
      ? `Facial expression: ${expression}.`
      : 'Neutral facial expression.';

    const prompt = `
      [PROTOCOL: BODYMASTER GENERATION]
      [CORE IDENTITY: ${identityPrompt}]
      [VIEW: FULL BODY HEAD-TO-TOE. ENTIRE SILHOUETTE VISIBLE FROM TOP OF HEAD TO BOTTOM OF FEET. NO CROPPING.]
      [STRICT FIDELITY: RECONSTRUCT FACE 1:1 FROM REFERENCE. PROPORTIONS, EYES, NOSE, JAWLINE MUST BE IDENTICAL.]
      [BODY RULES: ${bodyArchetype}]
      ${outfitInstruction}
      [STAGING: NEUTRAL GREY BACKGROUND. UNIFORM STUDIO LIGHTING. ${poseInstruction} ${expressionInstruction}]
    `.trim();

    const neg = `${negative}, fashion, casual clothes, jewelry, shoes, cropped feet, cropped head,
      artistic lighting, decorative background, wrinkles in fabric, 3/4 view, medium shot, stylized face`;

    const refs = files.map((f, i) => {
      try { return extractImageRef(f, `bodyMasterRef[${i}]`); } catch { return null; }
    }).filter(Boolean) as Array<{ data: string; mimeType: string }>;

    return imageApiService.generateImage({
      prompt,
      negative:        neg,
      referenceImages: refs.length > 0 ? refs : undefined,
      aspectRatio:     '3:4',
      module:          `${MODULE}.generateBodyMaster`,
      onStatusChange,
    });
  },

  async generateTechnicalViews(
    bodyMaster: string,
    gender: 'hombre' | 'mujer',
    outfitDescription: string | null = null,
    onStatusChange?: GenerateImageParams['onStatusChange'],
  ): Promise<{ rear: string; side: string }> {
    const archetype    = gender === 'mujer' ? '90-60-90 silhouette' : 'Gym-toned build';
    const outfitClause = outfitDescription ? `Wearing ${outfitDescription}.` : 'Same technical bodysuit.';
    const ref          = extractImageRef(bodyMaster, 'bodyMaster');

    const [rear, side] = await Promise.all([
      imageApiService.generateImage({
        prompt:          `[TECHNICAL VIEW: REAR 180 DEGREES]. FULL BODY HEAD-TO-TOE. Exact 180° rotation from BODYMASTER. ${outfitClause} Maintain ${archetype}.`,
        negative:        'face, frontal view',
        referenceImages: [ref],
        aspectRatio:     '3:4',
        module:          `${MODULE}.rearView`,
        onStatusChange,
      }),
      imageApiService.generateImage({
        prompt:          `[TECHNICAL VIEW: SIDE PROFILE 90 DEGREES]. FULL BODY HEAD-TO-TOE. Exact 90° rotation from BODYMASTER. ${outfitClause} Maintain ${archetype}.`,
        negative:        'frontal view, rear view',
        referenceImages: [ref],
        aspectRatio:     '3:4',
        module:          `${MODULE}.sideView`,
        onStatusChange,
      }),
    ]);

    return { rear, side };
  },

  async generateFaceMaster(
    bodyMaster: string,
    outfitDescription: string | null = null,
    onStatusChange?: GenerateImageParams['onStatusChange'],
  ): Promise<string> {
    const outfitClause = outfitDescription
      ? `Outfit visible at neck only, matching ${outfitDescription}.`
      : 'Technical bodysuit visible at neck only.';

    const ref = extractImageRef(bodyMaster, 'bodyMaster');

    return imageApiService.generateImage({
      prompt: `
        [PROTOCOL: FACEMASTER GENERATION]
        [REFERENCE: USE EXCLUSIVELY THE FACE FROM THE BODYMASTER IMAGE.]
        [VIEW: EXTREME CLOSE-UP FACE PORTRAIT. FOCUS ONLY ON HEAD AND NECK.]
        [STRICT FIDELITY: 1:1 BIOMETRIC DNA CLONE. DO NOT EMBELLISH. DO NOT STYLIZE. NO MAKEUP UNLESS PRESENT.]
        [PRIORITY: FIDELITY OVER AESTHETICS. MUST BE IDENTICAL TO BODYMASTER FACE.]
        [OUTFIT: ${outfitClause}]
      `.trim(),
      negative:        'full body, distant view, accessories, blur',
      referenceImages: [ref],
      aspectRatio:     '3:4',
      module:          `${MODULE}.generateFaceMaster`,
      onStatusChange,
    });
  },

  async generateMasterSet(
    identityPrompt: string,
    negative: string,
    gender: 'hombre' | 'mujer',
    forceOutfit: string | null = null,
    personality: string = 'Profesional y elegante',
    expression: string = 'Natural',
    onStatusChange?: GenerateImageParams['onStatusChange'],
  ): Promise<string[]> {
    // BodyMaster primero — las 3 vistas dependen de él
    const bodyMaster = await this.generateBodyMaster(
      identityPrompt, negative, [], gender, forceOutfit, personality, expression, onStatusChange,
    );

    // Las 3 vistas restantes en paralelo
    const [{ rear, side }, faceMaster] = await Promise.all([
      this.generateTechnicalViews(bodyMaster, gender, forceOutfit, onStatusChange),
      this.generateFaceMaster(bodyMaster, forceOutfit, onStatusChange),
    ]);

    return [bodyMaster, rear, side, faceMaster];
  },
};
