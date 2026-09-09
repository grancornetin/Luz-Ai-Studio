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

// Geometría de reflejo en vidrio real — reescrita TRES veces a partir de
// evidencia real:
//  v1 ("faintly through and behind her, softer"): demasiado tímida, no
//     mostraba la superposición real de doble exposición ni el texto
//     espejado (fotos reales que el usuario mandó lo mostraban con fuerza).
//  v2: v1 fijaba "she is standing OUTSIDE on the sidewalk/street" como si
//     TODO lugar de vidrio fuera una vidriera de calle — bug real
//     confirmado: un lugar real generado fue "office building lobby glass
//     wall" (vidrio INTERIOR), contradiciendo la posición fija. Reescrita
//     para no asumir ninguna posición absoluta (calle vs. interior) — la
//     geometría del fenómeno es la misma, solo cambia qué hay del otro
//     lado del vidrio.
//  v3 (esta versión): v2 resolvió bien la geometría (texto espejado,
//     transparencia entre planos, marco visible) pero dejó pasar la
//     CALIDAD DE LUZ del sujeto reflejado — bug real confirmado con
//     captura real: texto perfecto, marco visible, interior correctamente
//     opaco de fondo, pero ELLA se veía tan nítida y con tanto contraste/
//     modelado de luz directa que se leía como si estuviera parada del
//     lado de ADENTRO, no como su propio reflejo. Faltaba instruir cómo se
//     ve ÓPTICAMENTE una persona reflejada en vidrio (nunca la misma
//     nitidez/contraste que una foto directa) — agregado explícitamente.
const REFLECTION_GEOMETRY_LINE =
  'REFLECTION GEOMETRY: this is a real glass reflection, not a window view — she is standing in front of the glass surface described above (whichever side of it that place implies), and her reflection appears ON the glass. Two layers overlap with real see-through transparency: her reflected figure (and whatever is directly behind HER, on her own side of the glass) AND whatever is visible through the glass, on the OTHER side of it, bleed through each other simultaneously, like a double exposure — neither layer is simply "sharp foreground, blurry background"; both are semi-transparent where they overlap. Any text, signage, or lettering seen through the glass from the other side reads BACKWARDS/MIRRORED. The physical edge or frame of the glass (a storefront frame, a door edge, a window mullion, a wall corner) is visible somewhere in the shot, grounding it as a real pane of glass, not open air. HER REFLECTION ITSELF must look optically like a reflection, not a direct photo of her: slightly lower contrast and slightly desaturated compared to a normal photo, a faint soft glare/sheen across her figure from the glass surface, edges of her silhouette a touch softer than the sharpest details in the scene, and her lighting coming from HER OWN side of the glass (matching whatever ambient light exists where she is standing) — never lit as if a light source were placed directly in front of her face like a studio photo. If her reflection looks crisper, better-lit, or higher-contrast than the glass and what is seen through it, that is wrong — it should read as ON the glass, not standing behind it.';

// Tono/situación de la selfie — el usuario señaló que fotos reales de este
// tipo varían entre "de paso, espontánea" y "lugar de rutina/favorito,
// cuidada" — determinístico por shotId para no repetir siempre el mismo
// tono dentro de un mismo set.
const REFLECTION_MOODS = [
  'She glanced at her own reflection while walking past and paused just long enough to snap this — a spontaneous, of-the-moment photo, not staged.',
  'This is a place she passes by often — she knows this exact reflection spot, and this feels like an unhurried, familiar little routine.',
];

function reflectionMoodFor(shotId: string): string {
  let hash = 0;
  for (let i = 0; i < shotId.length; i++) hash = (hash * 31 + shotId.charCodeAt(i)) >>> 0;
  return REFLECTION_MOODS[hash % REFLECTION_MOODS.length];
}

// coherentPlaces: en varied_place es UN lugar concreto por shot (ver
// assignPlacesToShots en index.ts) — nunca la lista completa como texto
// libre. Bug real corregido (sep 2026): con la lista completa repetida en
// cada shot, el modelo convergía siempre al mismo lugar más obvio de la
// lista (4/4 shots del mismo set salieron en el mismo pasillo de hotel).
function placeLine(placeMode: 'same_place' | 'varied_place', isAnchorShot: boolean, shotId: string, coherentPlaces?: string): string {
  if (placeMode === 'same_place') {
    return isAnchorShot
      ? `The background is ${coherentPlaces ?? 'a real, believable, ordinary place'} — a real room with natural details (furniture, wall texture, light), not a studio backdrop.`
      : 'SCENE CONTINUITY: this is the SAME exact place shown in the scene reference image — reuse the same background, furniture/fixtures, and lighting. Do not invent a different place.';
  }
  const base = `The background is ${coherentPlaces ?? 'a real, believable, ordinary place'} — a real, believable place with natural details, not a studio backdrop, not a photography set.`;
  if (!isReflectiveGlassPlace(coherentPlaces)) return base;
  return `${base} ${REFLECTION_GEOMETRY_LINE} ${reflectionMoodFor(shotId)}`;
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
    placeLine(placeMode, contract.isAnchorShot, contract.shotId, contract.coherentPlaces),
    NO_WALKING_LINE,
    IPHONE_CAMERA_ROLL_LINE,
    AVOID_EDITORIAL_LINE,
  ].filter(Boolean);

  return { prompt: lines.join('\n\n'), negative: NEGATIVE_SHORT };
}
