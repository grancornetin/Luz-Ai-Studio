/**
 * recipes/outfitRevealBasic/promptBuilder.ts
 *
 * Arma el texto de instrucciones para cada shot:
 *  - mirror_check: fijo, mirror selfie de cuerpo completo, celular visible,
 *    outfit completo (cumple doble función de ancla + primer shot publicable).
 *  - shots de variación: el bloque de escena viene del banco de
 *    renderVariants.ts (ángulo/encuadre real, no un texto fijo repetido).
 *
 * Fidelidad de outfit: bug real encontrado en producción — el shot POV
 * original recortaba el calzado del encuadre sin que el prompt lo mencionara,
 * y el modelo terminó "olvidando" las zapatillas (drift de outfit). Ahora
 * cada variante declara footwearVisible — si es true, se refuerza
 * explícitamente que el calzado debe seguir siendo el de la referencia; si es
 * false (el encuadre no llega a los pies por diseño, ej. close-up o POV),
 * se aclara que el calzado no necesita estar en cuadro, pero el resto del
 * outfit sigue siendo exactamente el de la referencia.
 *
 * El marco del espejo nunca se pide explícitamente (ver manifiesto 4ter) — el
 * gesto de brazo levantado + celular en mano ya se lee como mirror-selfie.
 *
 * Múltiples prendas subidas se tratan como componentes de UN SOLO look
 * combinado (mismo criterio que outfitRefInstruction en
 * photodumpDirectorService.ts para outfit_check/outfit_haul/outfit_week).
 *
 * Anclaje de escena (bug real en producción): los shots de variación citan la
 * imagen ya generada del shot 1 como referencia extra (ver index.ts /
 * referenceRouter.ts) — hasSceneAnchor agrega la instrucción explícita de
 * reusar ese mismo cuarto, para que el fondo no cambie de shot a shot dentro
 * del mismo set (mismo criterio que outfitMultiLook/anchorChain.ts).
 */
import { NEGATIVE_SHORT } from '../shared';
import {
  IPHONE_CAMERA_ROLL_LINE, NO_WALKING_LINE, AVOID_EDITORIAL_LINE,
} from '../shared';
import type { RevealShotId } from './types';
import type { AppliedIntelligence } from './intelligenceLayer';
import { REVEAL_VARIANTS } from './renderVariants';

// El único elemento fijo de esta receta es EL ESPEJO — un mirror selfie
// puede pasar en cualquier lugar real donde exista uno: una habitación, un
// probador de tienda, el baño de un restaurante, el hall de un hotel, un
// centro comercial, un gimnasio (pregunta real del usuario sep 2026: "el
// elemento ancla debería ser solo frente a un espejo... lo único que
// manda es que es mirror selfie" — confirmado, no había ninguna razón de
// diseño para restringirlo a espacio doméstico). Reemplaza
// NO_STUDIO_BACKDROP_LINE (compartida por todo el módulo, sesgada a
// "bedroom/bathroom/an ordinary room... where someone actually lives")
// SOLO para esta receta — las demás recetas del módulo siguen usando la
// línea compartida sin cambios.
const MIRROR_ANYWHERE_LINE =
  'The background is a real, believable place where a mirror naturally exists — a bedroom, a bathroom, a store fitting room, a restaurant or bar bathroom, a hotel hallway or lobby, a mall, a gym, or any other real everyday space — never a photography studio, never a seamless backdrop, never a plain concrete or cyclorama floor. ' +
  'The specific place is free to vary shot to shot within what the brief and references support — it does not have to be a home or bedroom. It must look like a real, ordinary place, with a few real, natural details (furniture, wall texture, a mirror frame, ambient light) — not a blank staged set.';

export interface BuiltPrompt {
  prompt:   string;
  negative: string;
}

function outfitLine(garmentCount: number, footwearVisible: boolean): string {
  const base = garmentCount > 1
    ? `She is wearing the complete look shown across the outfit reference images — all pieces combined together as one outfit, fully put on and complete.`
    : 'She is wearing the outfit shown in the reference, fully put on and complete.';

  if (footwearVisible) {
    return `${base} This includes the exact shoes/footwear shown in the reference — same design, color, and style, clearly visible in this shot.`;
  }
  return `${base} The footwear from the reference does not need to be visible in this framing, but every other piece of the outfit must match the reference exactly.`;
}

function shotBlockFor(shotId: RevealShotId, variantIndex: number | undefined, hasSceneAnchor: boolean, poseAttitudeLine?: string): string {
  const sceneAnchorLine = hasSceneAnchor
    ? 'SCENE CONTINUITY: this is the SAME place, shown in the scene reference image — reuse the exact same background, furniture/fixtures, and lighting. Do not invent a different place.'
    : '';

  if (shotId === 'mirror_check') {
    return [
      `A full-body mirror selfie, from head to toe, the complete outfit clearly readable. ` +
      `No mirror frame needs to be visible; the raised arm holding the phone, partially covering part of her face, is what reads clearly as a self-taken mirror photo.`,
      MIRROR_ANYWHERE_LINE,
    ].filter(Boolean).join('\n');
  }
  const variant = REVEAL_VARIANTS[variantIndex ?? 0];
  return [variant.sceneBlock, sceneAnchorLine, poseAttitudeLine, MIRROR_ANYWHERE_LINE].filter(Boolean).join('\n');
}

export function buildShotPrompt(
  shotId:        RevealShotId,
  variantIndex:  number | undefined,
  garmentCount:  number,
  intelligence:  AppliedIntelligence,
  hasSceneAnchor: boolean = false,
  poseAttitudeLine?: string,
): BuiltPrompt {
  const footwearVisible = shotId === 'mirror_check' ? true : (REVEAL_VARIANTS[variantIndex ?? 0]?.footwearVisible ?? true);

  const lines = [
    shotBlockFor(shotId, variantIndex, hasSceneAnchor, poseAttitudeLine),
    outfitLine(garmentCount, footwearVisible),
    intelligence.hpiBlock,
    NO_WALKING_LINE,
    IPHONE_CAMERA_ROLL_LINE,
    AVOID_EDITORIAL_LINE,
  ].filter(Boolean);

  const negative = intelligence.hpiNegatives.length > 0
    ? `${NEGATIVE_SHORT}\n${intelligence.hpiNegatives.join(', ')}`
    : NEGATIVE_SHORT;

  return { prompt: lines.join('\n\n'), negative };
}
