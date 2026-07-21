/**
 * recipes/outfitMultiLook/promptBuilder.ts
 *
 * Arma el texto de instrucciones para el generador de imágenes, a partir
 * únicamente del contrato del shot y sus referencias ya resueltas.
 *
 * weekly / then_vs_now / rate_check / curated_ideas: mirror-selfie con la
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

function outfitLine(intent: MultiLookIntent): string {
  switch (intent) {
    case 'then_vs_now':
      return 'She is wearing the outfit shown in the reference, fully put on and complete.';
    case 'curated_ideas':
      return 'She is wearing the outfit shown in the reference, fully put on and complete — one of several outfit ideas for the same occasion or theme.';
    case 'rate_check':
      return 'She is wearing the outfit shown in the reference, fully put on and complete — the full look, clearly legible.';
    case 'weekly':
    default:
      return 'She is wearing the outfit shown in the reference, fully put on and complete — a different look from any previous day.';
  }
}

export function buildShotPrompt(
  contract:      ShotContract,
  intent:        MultiLookIntent,
  hasAnchor:     boolean,
  intelligence:  AppliedIntelligence,
): BuiltPrompt {
  const lines = [
    mirrorSelfieBlock(hasAnchor),
    outfitLine(intent),
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
