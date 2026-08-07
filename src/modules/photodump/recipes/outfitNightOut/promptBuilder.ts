/**
 * recipes/outfitNightOut/promptBuilder.ts
 *
 * Arma el texto final por shot:
 *  - Shots fijos de preparación (presentation, tryon_detail, mirror_check):
 *    texto traducido del contrato validado a mano
 *    (05_outfit_night_out.normalized.ts), con NO_WALKING_LINE/
 *    NO_STUDIO_BACKDROP_LINE aplicables (son "de pie en casa").
 *  - NightMoment (banco de noche): NO se aplica NO_WALKING_LINE ni
 *    NO_STUDIO_BACKDROP_LINE — varias entradas son sentadas, POV, auto o sin
 *    persona en cuadro; forzar "de pie, fondo doméstico" ahí sería la misma
 *    contradicción de pose ya corregida en el HPI (ver informe de bugs de
 *    HPI de esta sesión). El venue (real o inferido) reemplaza al fondo
 *    doméstico como escena.
 *
 * Continuidad de venue: cuando hay venueAnchorUrl, se agrega la línea de
 * "mismo lugar" — mismo patrón que outfitRevealBasic/promptBuilder.ts para
 * el anclaje de escena entre shots.
 *
 * Companion: cuando el shot es group_moment y NO hay companion subido, se
 * agrega la línea explícita de "no inventar una segunda persona" — mismo
 * criterio ya real en photodumpDirectorService.ts para day_in_life.
 */
import { NEGATIVE_SHORT, IPHONE_CAMERA_ROLL_LINE, NO_STUDIO_BACKDROP_LINE, NO_WALKING_LINE, AVOID_EDITORIAL_LINE } from '../shared';
import type { NightOutShotId, NightOutEnergy } from './types';
import type { AppliedIntelligence } from './intelligenceLayer';
import { findNightMoment } from './nightMoments';

export interface BuiltPrompt {
  prompt:   string;
  negative: string;
}

const FIXED_SHOT_BLOCKS: Record<'presentation' | 'tryon_detail' | 'mirror_check', string> = {
  presentation: `She is holding up or arranging the night-out outfit — on a hanger, laid on the bed, or against her own body — while still wearing her everyday base clothing. This is a "before" moment: the outfit is being shown, not yet worn. The camera motivation is anticipation — she wanted to record this look before changing into it.`,
  tryon_detail: `A close but not extreme detail of one real styling adjustment — closing a zipper, adjusting a strap, fixing a hem, buckling a shoe. Hands performing the action, connected naturally to the arm — never floating. Frame close enough to read the fabric and the action, but keep some body and room context visible.`,
  mirror_check: `A full-body mirror selfie, from head to toe, the complete outfit clearly readable — the finished, ready-to-leave look. No mirror frame needs to be visible; the raised arm holding the phone, partially covering part of her face, is what reads clearly as a self-taken mirror photo.`,
};

function outfitLine(garmentCount: number, footwearVisible: boolean): string {
  const base = garmentCount > 1
    ? 'She is wearing the complete look shown across the outfit reference images — all pieces combined together as one outfit, fully put on and complete.'
    : 'She is wearing the outfit shown in the reference, fully put on and complete.';
  if (footwearVisible) {
    return `${base} This includes the exact shoes/footwear shown in the reference — same design, color, and style, clearly visible in this shot.`;
  }
  return `${base} The footwear from the reference does not need to be visible in this framing, but every other piece of the outfit must match the reference exactly.`;
}

function venueLine(venueImageUrl: string | undefined, venueTextFallback: string, hasVenueAnchor: boolean): string {
  const continuity = hasVenueAnchor
    ? 'SCENE CONTINUITY: this is the SAME venue, shown in the scene reference image — reuse the exact same background, furniture, and lighting. Do not invent a different place.'
    : '';
  const sceneLine = venueImageUrl
    ? 'The venue is shown in the scene reference image — replicate its environment, architecture, and lighting as closely as possible, this is the real place, not a similar-looking substitute.'
    : `The venue: ${venueTextFallback}.`;
  return [continuity, sceneLine].filter(Boolean).join('\n');
}

function companionLine(hasCompanion: boolean): string {
  return hasCompanion
    ? ''
    : '⚠️ No companion reference was uploaded — do NOT invent a second person. Show the protagonist alone in a genuine social-feeling moment instead.';
}

export interface PromptBuilderOptions {
  garmentCount:      number;
  hasVenueAnchor:    boolean;
  hasCompanion:      boolean;
  venueImageUrl?:    string;
  venueTextFallback: string;
  energy:            NightOutEnergy;
  // Si el Director Creativo (ver modules/photodump/director/) ya razonó y
  // redactó este shot con contenido real del banco de imágenes, su texto
  // reemplaza al sceneBlock estático de FIXED_SHOT_BLOCKS/nightMoments.ts —
  // pero las líneas estructurales (outfit, HPI, estilo cámara-roll) se
  // siguen aplicando igual, para no perder esas garantías de calidad.
  // Ausente/undefined cuando el director no corrió o falló (fallback al
  // sistema estático, ver outfitNightOut/index.ts).
  directorSceneBlock?: string;
}

export function buildShotPrompt(
  shotId:       NightOutShotId,
  intelligence: AppliedIntelligence,
  options:      PromptBuilderOptions,
): BuiltPrompt {
  const isFixedPrepShot = shotId === 'presentation' || shotId === 'tryon_detail' || shotId === 'mirror_check';

  let sceneBlock: string;
  let footwearVisible: boolean;
  let extraLine = '';

  if (isFixedPrepShot) {
    sceneBlock = options.directorSceneBlock ?? FIXED_SHOT_BLOCKS[shotId as 'presentation' | 'tryon_detail' | 'mirror_check'];
    footwearVisible = shotId === 'mirror_check';
  } else {
    const moment = findNightMoment(shotId);
    sceneBlock = options.directorSceneBlock ?? moment.sceneBlockByEnergy[options.energy] ?? moment.sceneBlockByEnergy.elegante ?? '';
    footwearVisible = moment.contract.footwearVisible;
    if (shotId === 'group_moment') extraLine = companionLine(options.hasCompanion);
  }

  const lines = isFixedPrepShot
    ? [
        sceneBlock,
        NO_STUDIO_BACKDROP_LINE,
        outfitLine(options.garmentCount, footwearVisible),
        intelligence.hpiBlock,
        NO_WALKING_LINE,
        IPHONE_CAMERA_ROLL_LINE,
        AVOID_EDITORIAL_LINE,
      ]
    : [
        sceneBlock,
        venueLine(options.venueImageUrl, options.venueTextFallback, options.hasVenueAnchor),
        outfitLine(options.garmentCount, footwearVisible),
        extraLine,
        intelligence.hpiBlock,
        IPHONE_CAMERA_ROLL_LINE,
        AVOID_EDITORIAL_LINE,
      ];

  const prompt = lines.filter(Boolean).join('\n\n');
  const negative = intelligence.hpiNegatives.length > 0
    ? `${NEGATIVE_SHORT}\n${intelligence.hpiNegatives.join(', ')}`
    : NEGATIVE_SHORT;

  return { prompt, negative };
}
