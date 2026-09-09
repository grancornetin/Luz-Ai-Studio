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

// Un lugar de reflejo que NO es un espejo tradicional (vidriera, ventanal,
// vidrio de auto, puerta de vidrio) necesita geometría explícita — sep
// 2026, bug real confirmado: sin esto, el modelo dibujó a la persona como
// si estuviera PARADA ADENTRO del local mirando hacia afuera, con el
// interior nítido detrás de ella en vez de reflejado — no leía como una
// selfie tomada desde la vereda. reglas espejo/mirror caen en la línea de
// arriba (captureStyleMechanicsLine ya cubre esa mecánica).
// Bilingüe como red de seguridad — el endpoint (analyzeWeeklyLooksPlaces)
// pide la respuesta en inglés, pero un candidato del fallback estático o
// una respuesta que no respete la instrucción de idioma puede venir en
// español (bug real visto: "Reflejo en el escaparate de una cafetería").
const REFLECTIVE_GLASS_KEYWORDS = [
  'window', 'glass', 'storefront', 'display case', 'shop front', 'car window', 'elevator door',
  'vidrio', 'vidriera', 'escaparate', 'ventanal', 'cristal',
];
const MIRROR_KEYWORDS = ['mirror', 'espejo'];

function isReflectiveGlassPlace(coherentPlaces?: string): boolean {
  if (!coherentPlaces) return false;
  const lower = coherentPlaces.toLowerCase();
  return REFLECTIVE_GLASS_KEYWORDS.some(k => lower.includes(k)) && !MIRROR_KEYWORDS.some(k => lower.includes(k));
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
  const base = `The background is ${coherentPlaces ?? 'a real, believable, ordinary place'} — a real, believable place with natural details, not a studio backdrop, not a photography set.`;
  if (!isReflectiveGlassPlace(coherentPlaces)) return base;
  return `${base} REFLECTION GEOMETRY: she is standing OUTSIDE on the sidewalk/street, facing the glass, taking a photo of her own reflection in it — the glass acts like a mirror. What's behind the glass (the shop's interior, other objects) is seen faintly THROUGH and behind her reflection, softer and slightly less sharp than her — never as a clear, sharply-lit space she appears to be standing inside of. She is not inside the store.`;
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
