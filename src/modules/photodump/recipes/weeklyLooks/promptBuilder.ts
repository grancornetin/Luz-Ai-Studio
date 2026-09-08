/**
 * recipes/weeklyLooks/promptBuilder.ts
 *
 * Arma el texto de instrucciones para cada shot. Incluye desde el arranque
 * el lenguaje de mejor desempeño para look de camera-roll real
 * (IPHONE_CAMERA_ROLL_LINE / NO_WALKING_LINE / AVOID_EDITORIAL_LINE, ver
 * shared.ts) — weeklyFavoritesV2 nunca las usó, solo tenía un texto suelto
 * ("Natural iPhone quality...") sin el refuerzo real que ya está validado en
 * outfit_reveal_basic/outfit_multi_look.
 */
import {
  NEGATIVE_SHORT, IPHONE_CAMERA_ROLL_LINE, NO_WALKING_LINE, AVOID_EDITORIAL_LINE,
} from '../shared';
import type { AnchorContract, ShotContract } from './types';
import { captureStyleMechanicsLine } from './poseSelection';
import type { CaptureStyle } from './types';

function anchorOutfitLine(anchor: AnchorContract, isAnchorShot: boolean): string {
  // El shot ancla (primer look) usa el modo detectado por anchor.ts; el
  // resto de los shots siempre visten el look de SU PROPIO contrato (una
  // referencia de outfit real subida, nunca inferido).
  if (!isAnchorShot) {
    return 'She is wearing the complete look shown in this shot\'s outfit reference — every piece, fully put on, including the exact shoes/footwear, clearly visible head to toe.';
  }
  switch (anchor.mode) {
    case 'person_with_explicit_base_outfit':
      return 'She is wearing the exact outfit shown in her own reference photo — do not change it.';
    case 'person_with_style_matched_outfit':
    default:
      return 'She is wearing the complete look shown in this shot\'s outfit reference — every piece, fully put on, including the exact shoes/footwear, clearly visible head to toe.';
  }
}

// coherentPlaces: en varied_place es UN lugar concreto por shot (ver
// assignPlacesToShots en index.ts) — nunca la lista completa como texto
// libre. Bug real corregido (sep 2026): con la lista completa repetida en
// cada shot, el modelo convergía siempre al mismo lugar más obvio de la
// lista (4/4 shots del mismo set salieron en el mismo pasillo de hotel).
function placeLine(placeMode: 'same_place' | 'varied_place', isAnchorShot: boolean, coherentPlaces?: string): string {
  if (placeMode === 'same_place') {
    return isAnchorShot
      ? `The background is ${coherentPlaces ?? 'a real, believable, ordinary place'} — a real room with natural details (furniture, wall texture, light), not a studio backdrop.`
      : 'SCENE CONTINUITY: this is the SAME exact place shown in the scene reference image — reuse the same background, furniture/fixtures, and lighting. Do not invent a different place.';
  }
  return `The background is ${coherentPlaces ?? 'a real, believable, ordinary place'} — a real, believable place with natural details, not a studio backdrop, not a photography set.`;
}

export interface BuiltPrompt {
  prompt:   string;
  negative: string;
}

export function buildShotPrompt(
  contract:     ShotContract,
  anchor:       AnchorContract,
  captureStyle: CaptureStyle,
  placeMode:    'same_place' | 'varied_place',
): BuiltPrompt {
  const lines = [
    anchorOutfitLine(anchor, contract.isAnchorShot),
    captureStyleMechanicsLine(captureStyle),
    contract.poseAttitudeLine,
    placeLine(placeMode, contract.isAnchorShot, contract.coherentPlaces),
    NO_WALKING_LINE,
    IPHONE_CAMERA_ROLL_LINE,
    AVOID_EDITORIAL_LINE,
  ].filter(Boolean);

  return { prompt: lines.join('\n\n'), negative: NEGATIVE_SHORT };
}
