/**
 * recipes/outfitRevealBasic/promptBuilder.ts
 *
 * Arma el texto de instrucciones para cada uno de los 3 shots fijos, traducido
 * del diseño narrativo validado a mano (manifiesto sección 3):
 *
 *  - mirror_check: mirror selfie de cuerpo completo, celular visible, outfit
 *    completo. Cumple doble función de ancla (identidad/cuerpo/cuarto) y
 *    primer shot publicable — no hay REF0 separado.
 *  - self_pov: perspectiva en primera persona genuina, cámara = los propios
 *    ojos mirando hacia abajo al cuerpo. Sin celular, sin brazo, sin rostro
 *    visible. Escrito a mano (sin HPI, ver intelligenceLayer.ts).
 *  - close_detail: selfie de cerca (rostro/torso), mano en el pelo, celular
 *    visible.
 *
 * El marco del espejo nunca se pide explícitamente (ver manifiesto 4ter) — el
 * gesto de brazo levantado + celular en mano ya se lee como mirror-selfie.
 *
 * Múltiples prendas subidas se tratan como componentes de UN SOLO look
 * combinado (mismo criterio que outfitRefInstruction en
 * photodumpDirectorService.ts para outfit_check/outfit_haul/outfit_week) —
 * no como looks independientes.
 */
import { NEGATIVE_SHORT } from '../shared';
import {
  IPHONE_CAMERA_ROLL_LINE, NO_STUDIO_BACKDROP_LINE, NO_WALKING_LINE, AVOID_EDITORIAL_LINE,
} from '../shared';
import type { RevealShotId } from './types';
import type { AppliedIntelligence } from './intelligenceLayer';

export interface BuiltPrompt {
  prompt:   string;
  negative: string;
}

function outfitLine(garmentCount: number): string {
  if (garmentCount > 1) {
    return `She is wearing the complete look shown across the outfit reference images — all pieces combined together as one outfit, fully put on and complete.`;
  }
  return 'She is wearing the outfit shown in the reference, fully put on and complete.';
}

function shotBlockFor(shotId: RevealShotId): string {
  switch (shotId) {
    case 'mirror_check':
      return `A full-body mirror selfie, from head to toe, the complete outfit clearly readable. ` +
        `No mirror frame needs to be visible; the raised arm holding the phone, partially covering part of her face, is what reads clearly as a self-taken mirror photo.\n` +
        NO_STUDIO_BACKDROP_LINE;
    case 'self_pov':
      return `A genuine first-person point-of-view shot — the camera IS her own eyes looking down at her own body and outfit. ` +
        `No phone visible anywhere in frame, no arm holding a phone, no face, no mirror. ` +
        `The framing is naturally cropped the way a real person's own gaze would be: chin barely at the top edge or not visible at all, body and outfit filling the rest of the frame, looking down and slightly forward. ` +
        `This is not a photo someone else took — it is literally what she sees when she looks down at herself.\n` +
        NO_STUDIO_BACKDROP_LINE;
    case 'close_detail':
      return `A close, genuine selfie — framed from roughly the top of the head to the chest/upper torso, phone visible in hand. ` +
        `One hand casually touches her own hair. Natural, unposed, intimate framing — not a beauty portrait.\n` +
        NO_STUDIO_BACKDROP_LINE;
  }
}

export function buildShotPrompt(
  shotId:        RevealShotId,
  garmentCount:  number,
  intelligence:  AppliedIntelligence,
): BuiltPrompt {
  const lines = [
    shotBlockFor(shotId),
    outfitLine(garmentCount),
    intelligence.hpiBlock,
    shotId !== 'self_pov' ? NO_WALKING_LINE : '',
    IPHONE_CAMERA_ROLL_LINE,
    AVOID_EDITORIAL_LINE,
  ].filter(Boolean);

  const negative = intelligence.hpiNegatives.length > 0
    ? `${NEGATIVE_SHORT}\n${intelligence.hpiNegatives.join(', ')}`
    : NEGATIVE_SHORT;

  return { prompt: lines.join('\n\n'), negative };
}
