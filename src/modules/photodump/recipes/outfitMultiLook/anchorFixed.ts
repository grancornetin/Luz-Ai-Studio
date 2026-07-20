/**
 * recipes/outfitMultiLook/anchorFixed.ts
 *
 * Genera la foto ancla única (REF0) para weekly / then_vs_now / rate_check /
 * curated_ideas — el mismo fondo se reutiliza en todos los shots del set.
 *
 * A diferencia de weeklyFavoritesV2, acá NUNCA hace falta detectar estilo:
 * cada look ya trae un outfit explícito y completo. El ancla es siempre
 * "world_only" — un mirror-selfie técnico que fija identidad + cuarto, sin
 * ningún outfit puesto, para no contaminar el primer look real (mismo
 * principio validado manualmente: REF0 no debe citar ningún outfit).
 */
import { imageApiService } from '../../../../services/imageApiService';
import { prepareRefs, getAspectRatio, NEGATIVE_SHORT } from '../shared';
import type { PhotodumpRefs, PhotodumpNarrative, PhotodumpProtagonist, PhotodumpDestino } from '../../types';
import type { PhotodumpREF0Result } from '../shared';
import { IPHONE_CAMERA_ROLL_LINE } from './renderProfile';

export async function generateFixedAnchor(
  refs:          PhotodumpRefs,
  narrative:     PhotodumpNarrative,
  protagonist:   PhotodumpProtagonist,
  destino:       PhotodumpDestino,
  sessionParams: { uid?: string; sessionId?: string },
): Promise<PhotodumpREF0Result> {
  const identityRefUrl = refs.avatarRef ?? undefined;
  const bodyRefUrl      = refs.bodyRef ?? undefined;
  const sceneRefUrl     = refs.sceneRef ?? undefined;

  if (!identityRefUrl && !bodyRefUrl) {
    throw new Error('Se necesita al menos una referencia de identidad o cuerpo para generar el ancla de esta sesión.');
  }

  const refsToPass = [identityRefUrl, bodyRefUrl, sceneRefUrl].filter(Boolean) as string[];

  const prompt = `ANCHOR SHOT — establishes identity, body, room, and lighting for the entire set. Every following photo reuses this exact background.
A full-body mirror selfie. No specific outfit called out here — simple, neutral everyday clothing, not the look that will be shown in the following photos.
${IPHONE_CAMERA_ROLL_LINE}`;

  const preparedRefs = await prepareRefs(refsToPass);
  const imageUrl = await imageApiService.generateImage({
    prompt,
    negative:        NEGATIVE_SHORT,
    referenceImages: preparedRefs,
    aspectRatio:     getAspectRatio(destino),
    modelId:         'gemini',
    uid:             sessionParams.uid,
    sessionId:       sessionParams.sessionId,
    module:          'photodump',
    moduleLabel:     'Photodump Mode',
    shotIndex:       0,
    totalShots:      1,
    metadata:        { role: 'REF0_ANCHOR_MULTI_LOOK', narrative, protagonist },
  });

  return { imageUrl, ref0Analysis: null, prompt, refsCount: preparedRefs.length };
}
