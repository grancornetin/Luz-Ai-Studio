import { geminiService } from './geminiService';
import { MODELS } from './creditConfig';

// ──────────────────────────────────────────
// avatarService
// Usa SIEMPRE gemini-3-pro-image-preview (PRO)
// porque la identidad facial es crítica en
// todos los flujos de creación de modelos.
// ──────────────────────────────────────────

export const avatarService = {

  async generateBodyMaster(
    identityPrompt: string,
    negative: string,
    files: string[],
    gender: 'hombre' | 'mujer',
    forceOutfit: string | null = null,
    personality: string = 'Profesional y elegante',
    expression: string = 'Natural'
  ): Promise<string> {
    const bodyArchetype = gender === 'mujer'
      ? "PERFECT HOURGLASS 90-60-90 PROPORTIONS. Highly toned aesthetic silhouette. Slim waist, wide hips."
      : "ATHLETIC GYM BUILD. V-taper silhouette. Highly defined musculature, broad shoulders, slim waist.";

    const outfitInstruction = forceOutfit
      ? `Wearing ${forceOutfit}. DO NOT remove this outfit. The outfit is mandatory and must be integrated realistically.`
      : `[OUTFIT STRIPPING: REMOVE ALL ORIGINAL CLOTHES, ACCESSORIES, AND BACKGROUND.]
      [MANDATORY OUTFIT: PLAIN SKIN-TIGHT NEUTRAL GREY TECHNICAL BODYSUIT. NO TEXTURES, NO BRANDING.]`;

    let poseInstruction = `Neutral, confident posture.`;
    if (personality && personality !== 'Profesional y elegante' && personality !== 'Reservado y Minimalista' && personality !== 'Natural') {
      poseInstruction = `Pose reflecting a ${personality} personality.`;
    }

    let expressionInstruction = `Neutral facial expression.`;
    if (expression && expression !== 'Natural') {
      expressionInstruction = `Facial expression: ${expression}.`;
    }

    const technicalPrompt = `
      [PROTOCOL: BODYMASTER GENERATION]
      [CORE IDENTITY: ${identityPrompt}]
      [VIEW: FULL BODY HEAD-TO-TOE. ENTIRE SILHOUETTE VISIBLE FROM TOP OF HEAD TO BOTTOM OF FEET. NO CROPPING.]
      [STRICT FIDELITY: RECONSTRUCT FACE 1:1 FROM REFERENCE. PROPORTIONS, EYES, NOSE, JAWLINE MUST BE IDENTICAL.]
      [BODY RULES: ${bodyArchetype}]
      ${outfitInstruction}
      [STAGING: NEUTRAL GREY BACKGROUND. UNIFORM STUDIO LIGHTING. ${poseInstruction} ${expressionInstruction}]
    `;

    const strictNegative = `
      ${negative}, fashion, casual clothes, jewelry, shoes, cropped feet, cropped head,
      artistic lighting, decorative background, wrinkles in fabric, 3/4 view, medium shot, stylized face
    `;

    // PRO — identidad facial crítica
    return geminiService.generateImageWithModel(technicalPrompt, strictNegative, MODELS.PRO, '1K', files, '3:4');
  },

  async generateTechnicalViews(bodyMaster: string, gender: 'hombre' | 'mujer', outfitDescription: string | null = null): Promise<{ rear: string; side: string }> {
    const archetype = gender === 'mujer' ? "90-60-90 silhouette" : "Gym-toned build";
    const outfitClause = outfitDescription ? `Wearing ${outfitDescription}.` : "Same technical bodysuit.";

    const rear = await geminiService.generateImageWithModel(
      `[TECHNICAL VIEW: REAR 180 DEGREES]. FULL BODY HEAD-TO-TOE. Exact 180° rotation from BODYMASTER. ${outfitClause} Maintain ${archetype}.`,
      "face, frontal view",
      MODELS.PRO, '1K', [bodyMaster], '3:4'
    );

    const side = await geminiService.generateImageWithModel(
      `[TECHNICAL VIEW: SIDE PROFILE 90 DEGREES]. FULL BODY HEAD-TO-TOE. Exact 90° rotation from BODYMASTER. ${outfitClause} Maintain ${archetype}.`,
      "frontal view, rear view",
      MODELS.PRO, '1K', [bodyMaster], '3:4'
    );

    return { rear, side };
  },

  async generateFaceMaster(bodyMaster: string, outfitDescription: string | null = null): Promise<string> {
    const outfitClause = outfitDescription
      ? `Outfit visible at neck only, matching ${outfitDescription}.`
      : "Technical bodysuit visible at neck only.";

    const technicalPrompt = `
      [PROTOCOL: FACEMASTER GENERATION]
      [REFERENCE: USE EXCLUSIVELY THE FACE FROM THE BODYMASTER IMAGE.]
      [VIEW: EXTREME CLOSE-UP FACE PORTRAIT. FOCUS ONLY ON HEAD AND NECK.]
      [STRICT FIDELITY: 1:1 BIOMETRIC DNA CLONE. DO NOT EMBELLISH. DO NOT STYLIZE. NO MAKEUP UNLESS PRESENT.]
      [PRIORITY: FIDELITY OVER AESTHETICS. MUST BE IDENTICAL TO BODYMASTER FACE.]
      [OUTFIT: ${outfitClause}]
    `;

    // PRO — máxima fidelidad facial
    return geminiService.generateImageWithModel(
      technicalPrompt, "full body, distant view, accessories, blur",
      MODELS.PRO, '1K', [bodyMaster], '3:4'
    );
  },

  async generateMasterSet(
    identityPrompt: string,
    negative: string,
    gender: 'hombre' | 'mujer',
    forceOutfit: string | null = null,
    personality: string = 'Profesional y elegante',
    expression: string = 'Natural'
  ): Promise<string[]> {
    const bodyMaster = await this.generateBodyMaster(identityPrompt, negative, [], gender, forceOutfit, personality, expression);
    const views = await this.generateTechnicalViews(bodyMaster, gender, forceOutfit);
    const faceMaster = await this.generateFaceMaster(bodyMaster, forceOutfit);
    return [bodyMaster, views.rear, views.side, faceMaster];
  }

};