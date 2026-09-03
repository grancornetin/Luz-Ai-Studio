/**
 * recipes/outfitMultiLook/promptBuilder.ts
 *
 * Arma el texto de instrucciones para el generador de imágenes, a partir
 * únicamente del contrato del shot y sus referencias ya resueltas.
 *
 * weekly / then_vs_now / curated_ideas: mirror-selfie con la
 * MISMA ancla citada en cada shot — instrucción explícita de qué SÍ copiar
 * del ancla (el fondo) y qué NO (pose/outfit), porque sin esa distinción el
 * ancla puede arrastrar su propia pose al resultado nuevo (validado
 * manualmente, ver manifiesto sección 3).
 *
 * trip_recap: cada shot ya viene de una cadena con su propio lugar — no
 * hace falta la instrucción de "no copiar pose del ancla" porque cada
 * eslabón ya genera su propia pose desde cero (ver anchorChain.ts).
 *
 * El marco del espejo NUNCA se pide explícitamente — el gesto de brazo
 * levantado + celular en mano es lo que se lee como mirror-selfie, sin
 * necesidad de mostrar el borde del espejo (ver manifiesto 09_session_log,
 * sección 4ter).
 *
 * curated_ideas — shot de variación: pedido real del usuario (para que la
 * receta sirva de guía de estilo, no alcanza con 1 sola foto frontal por
 * look). El segundo shot de cada look usa un encuadre distinto según
 * contract.cameraGrammar.composition (rotado por posición en contracts.ts):
 * vista trasera, perfil lateral, o close-up de tela — nunca el mismo
 * mirror-selfie frontal repetido. Los accesorios enlazados (calzado/joyas,
 * ver referenceRouter.ts) se citan fielmente si el usuario los subió; si no
 * subió ninguno, se le pide al modelo elegir con criterio de estilista, sin
 * inventar marca ni un objeto anatómicamente imposible.
 */
import { NEGATIVE_SHORT } from '../shared';
import type { ShotContract, MultiLookIntent } from './types';
import type { AppliedIntelligence } from './intelligenceLayer';
import { IPHONE_CAMERA_ROLL_LINE, AVOID_EDITORIAL_LINE, NO_STUDIO_BACKDROP_LINE } from './renderProfile';

export interface BuiltPrompt {
  prompt:   string;
  negative: string;
}

function mirrorSelfieBlock(hasAnchor: boolean): string {
  if (!hasAnchor) {
    return `A full-body mirror selfie. No mirror frame needs to be visible; the raised arm holding the phone, partially covering part of her face, is what reads clearly as a self-taken mirror photo.\n${NO_STUDIO_BACKDROP_LINE}`;
  }
  return 'A full-body mirror selfie in the same space as the anchor reference image. Use the anchor only as the background reference — the exact same room, flooring, and furniture must appear identically. ' +
    'Do not copy the pose, outfit, or body language from the anchor — this is a completely different look and pose. ' +
    'No mirror frame needs to be visible; the raised arm holding the phone, partially covering part of her face, is what reads clearly as a self-taken mirror photo.\n' +
    NO_STUDIO_BACKDROP_LINE;
}

// curated_ideas, shot de variación — mismo espacio que el ancla (fondo
// idéntico), pero un ángulo/encuadre o actitud distinta al frontal, según
// la composición que le tocó rotar en contracts.ts. poseAttitudeLine (sep
// 2026, ver poseClient.ts) aporta pose/gesto/mirada real del banco cuando
// hay un candidato disponible — el texto fijo sigue siendo el que define el
// encuadre físico, poseAttitudeLine solo agrega la actitud corporal
// concreta encima; sin candidato, el shot cae al texto genérico solo.
function variationBlock(composition: string, poseAttitudeLine?: string): string {
  const attitudeSuffix = poseAttitudeLine ? `\n${poseAttitudeLine}` : '';
  switch (composition) {
    case 'mirror_selfie_back_view':
      return 'A full-body mirror selfie from behind — she has turned around to show the back of the outfit in the mirror reflection, same room as the anchor reference. ' +
        'No mirror frame needs to be visible; the raised arm holding the phone is what reads clearly as a self-taken mirror photo, seen from behind.\n' + NO_STUDIO_BACKDROP_LINE + attitudeSuffix;
    case 'mirror_selfie_side_profile':
      return 'A full-body mirror selfie from a side profile angle — she has turned to a three-quarter or full side view in the mirror reflection, same room as the anchor reference. ' +
        'No mirror frame needs to be visible; the raised arm holding the phone is what reads clearly as a self-taken mirror photo, seen from the side.\n' + NO_STUDIO_BACKDROP_LINE + attitudeSuffix;
    case 'mirror_selfie_alt_pose':
      return 'A full-body mirror selfie with a different body attitude than the frontal shot — same room as the anchor reference, full outfit still clearly visible. ' +
        'No mirror frame needs to be visible; the raised arm holding the phone is what reads clearly as a self-taken mirror photo.\n' + NO_STUDIO_BACKDROP_LINE + attitudeSuffix +
        (poseAttitudeLine ? '' : '\nShe adopts a different pose than a plain frontal stand — for example sitting, leaning, or resting against something in the room — while keeping the full outfit clearly visible.');
    default:
      return '';
  }
}

function outfitLine(intent: MultiLookIntent): string {
  switch (intent) {
    case 'then_vs_now':
      return 'She is wearing the outfit shown in the reference, fully put on and complete.';
    case 'curated_ideas':
      return 'She is wearing the outfit shown in the reference, fully put on and complete — one of several outfit ideas for the same occasion or theme.';
    case 'weekly':
    default:
      return 'She is wearing the outfit shown in the reference, fully put on and complete — a different look from any previous day.';
  }
}

// curated_ideas: instrucción de calzado/accesorios — cita fielmente la
// referencia enlazada si el usuario subió una; si no subió ninguna, pide
// criterio de estilista real en vez de omitir el tema o inventar a ciegas.
function accessoryLine(intent: MultiLookIntent, hasLinkedAccessory: boolean): string {
  if (intent !== 'curated_ideas') return '';
  if (hasLinkedAccessory) {
    return 'She is also wearing the shoes/accessories shown in their reference image(s), matched faithfully to those references.';
  }
  return 'Complete the look with shoes and any accessories (jewelry, bag) that a real stylist would choose for this exact outfit and occasion — coherent, tasteful, and appropriate, never inventing a brand logo, legible text, or an anatomically impossible object.';
}

export function buildShotPrompt(
  contract:      ShotContract,
  intent:        MultiLookIntent,
  hasAnchor:     boolean,
  intelligence:  AppliedIntelligence,
): BuiltPrompt {
  const isVariation = intent === 'curated_ideas' && contract.angle === 'variation';
  const hasLinkedAccessory = (contract.referencePolicy.linkedAccessoryUrls?.length ?? 0) > 0;

  const lines = [
    isVariation ? variationBlock(contract.cameraGrammar.composition, contract.poseAttitudeLine) : mirrorSelfieBlock(hasAnchor),
    outfitLine(intent),
    accessoryLine(intent, hasLinkedAccessory),
    intelligence.poseLine,
    intelligence.hpiBlock,
    IPHONE_CAMERA_ROLL_LINE,
    AVOID_EDITORIAL_LINE,
  ].filter(Boolean);

  const negative = intelligence.hpiNegatives.length > 0
    ? `${NEGATIVE_SHORT}\n${intelligence.hpiNegatives.join(', ')}`
    : NEGATIVE_SHORT;

  return { prompt: lines.join('\n\n'), negative };
}
