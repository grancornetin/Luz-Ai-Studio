/**
 * recipes/outfitMultiLook/anchorFixed.ts
 *
 * Genera la foto ancla única (REF0) para weekly / then_vs_now / rate_check /
 * curated_ideas — el mismo fondo se reutiliza en todos los shots del set.
 *
 * Validado manualmente (ver manifiesto sección 3, "Día 1 — ancla de escena,
 * outfit puesto, aprobado en 1 iteración"): el ancla NO es una foto vacía
 * extra — es la foto del primer look, con su outfit puesto, que además fija
 * el fondo para el resto del set. N looks = N fotos, nunca N+1. Por eso esta
 * función recibe el primer look y lo cita como cualquier otro shot de outfit,
 * en vez de generar una foto "world_only" separada sin outfit.
 */
import { imageApiService } from '../../../../services/imageApiService';
import { prepareRefs, getAspectRatio, NEGATIVE_SHORT } from '../shared';
import type { PhotodumpRefs, PhotodumpNarrative, PhotodumpProtagonist, PhotodumpDestino } from '../../types';
import type { PhotodumpREF0Result } from '../shared';
import type { LookItem } from './types';
import { IPHONE_CAMERA_ROLL_LINE, NO_STUDIO_BACKDROP_LINE, AVOID_EDITORIAL_LINE } from './renderProfile';

export async function generateFixedAnchor(
  firstLook:     LookItem,
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

  const refsToPass = [identityRefUrl, bodyRefUrl, sceneRefUrl, firstLook.refUrl].filter(Boolean) as string[];

  const prompt = `ANCHOR SHOT — establishes identity, body, room, and lighting for the entire set. Every following photo reuses this exact background.
A full-body mirror selfie. She is wearing the outfit shown in the reference, fully put on and complete — this is a real look, not a placeholder.
No mirror frame needs to be visible; the raised arm holding the phone, partially covering part of her face, is what reads clearly as a self-taken mirror photo.
${NO_STUDIO_BACKDROP_LINE}
${IPHONE_CAMERA_ROLL_LINE}
${AVOID_EDITORIAL_LINE}`;

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
    metadata:        { role: 'REF0_ANCHOR_MULTI_LOOK', narrative, protagonist, lookId: firstLook.id },
  });

  return { imageUrl, ref0Analysis: null, prompt, refsCount: preparedRefs.length };
}
