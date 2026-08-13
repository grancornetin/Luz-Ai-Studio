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
import type { NightOutShotId, NightOutEnergy, NightMomentId } from './types';
import type { AppliedIntelligence } from './intelligenceLayer';
import { findNightMoment, pickSceneVariation } from './nightMoments';

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
  // Seed determinístico (ver seedFor en index.ts) para elegir, de las 4
  // variaciones de sceneBlockByEnergy de un NightMoment, cuál usar en ESTE
  // shot — sin esto, pickSceneVariation no tendría con qué variar entre
  // sesiones distintas (mismo motivo que pickNightMomentsForSet ya recibe
  // seed para elegir qué tipos de shot entran al set).
  seed:              string;
  // Si el Director Creativo (ver modules/photodump/director/) ya razonó y
  // redactó este shot con contenido real del banco de imágenes, su texto
  // reemplaza al sceneBlock estático de FIXED_SHOT_BLOCKS/nightMoments.ts.
  // Ausente/undefined cuando el director no corrió o falló (fallback al
  // sistema estático, ver outfitNightOut/index.ts).
  //
  // BUG REAL corregido: cuando directorSceneBlock está presente, el HPI
  // (bloque de pose genérico pre-cableado por shotId, ver intelligenceLayer.ts)
  // se agregaba IGUAL al final del prompt — dos descripciones de pose
  // independientes y a veces contradictorias en el mismo texto (ej. el
  // director redactó "de pie, mano en el bolsillo" mientras el HPI describía
  // "reclinada, piernas cruzadas, en tacones" para el mismo shot). El HPI
  // tenía sentido cuando sceneBlock era un string genérico corto que
  // necesitaba detalle de pose — es redundante/contradictorio ahora que el
  // director ya redacta una pose completa extraída de un candidato real del
  // banco. Con directorSceneBlock presente, el HPI se omite del prompt.
  directorSceneBlock?: string;
  // Solo para shots sintéticos de open_bank (shotId "open_bank_N", ver
  // openBankAdapter.ts) — footwearVisible/useOutfitRefs del ShotContract
  // sintético, para no depender de findNightMoment(shotId) (que no
  // reconocería un shotId sintético, ver comentario en buildShotPrompt).
  openBankFootwearVisible?: boolean;
  openBankHasOutfitRef?: boolean;
}

export function buildShotPrompt(
  shotId:       NightOutShotId,
  intelligence: AppliedIntelligence,
  options:      PromptBuilderOptions,
): BuiltPrompt {
  const isFixedPrepShot = shotId === 'presentation' || shotId === 'tryon_detail' || shotId === 'mirror_check';
  const isOpenBankShot = typeof shotId === 'string' && shotId.startsWith('open_bank_');
  const fromDirector = Boolean(options.directorSceneBlock);

  let sceneBlock: string;
  let footwearVisible: boolean;
  let extraLine = '';
  let hasOutfitRef: boolean;

  if (isFixedPrepShot) {
    sceneBlock = options.directorSceneBlock ?? FIXED_SHOT_BLOCKS[shotId as 'presentation' | 'tryon_detail' | 'mirror_check'];
    footwearVisible = shotId === 'mirror_check';
    hasOutfitRef = true;
  } else if (isOpenBankShot) {
    // El director SIEMPRE redacta directorSceneBlock para sus propios shots
    // (buildOpenBankWritePrompt nunca devuelve un shot sin finalPrompt) — no
    // hace falta un sceneBlock estático de respaldo acá.
    sceneBlock = options.directorSceneBlock ?? '';
    footwearVisible = options.openBankFootwearVisible ?? false;
    hasOutfitRef = options.openBankHasOutfitRef ?? true;
  } else {
    const moment = findNightMoment(shotId as NightMomentId);
    sceneBlock = options.directorSceneBlock ?? pickSceneVariation(moment, options.seed, options.energy);
    footwearVisible = moment.contract.footwearVisible;
    hasOutfitRef = moment.contract.referencePolicy.useOutfitRefs;
    if (shotId === 'group_moment') extraLine = companionLine(options.hasCompanion);
  }

  // BUG REAL corregido (ver comentario de directorSceneBlock arriba): con el
  // director activo, el calzado de la referencia deja de ser una bandera fija
  // por tipo de shot ("no hace falta que se vea") — si el shot muestra el
  // outfit, muestra el outfit completo, incluido el calzado. La única
  // excepción real son los shots sin referencia de outfit en absoluto
  // (ambient_only, car_transition, food_detail — no hay protagonista/cuerpo
  // en cuadro, la pregunta no aplica).
  if (fromDirector && hasOutfitRef) footwearVisible = true;

  // El HPI (pose genérica pre-cableada por shotId) se omite cuando el
  // director ya redactó su propia pose desde un candidato real del banco —
  // evita 2 descripciones de pose contradictorias en el mismo prompt.
  const hpiBlock = fromDirector ? '' : intelligence.hpiBlock;

  const lines = isFixedPrepShot
    ? [
        sceneBlock,
        NO_STUDIO_BACKDROP_LINE,
        outfitLine(options.garmentCount, footwearVisible),
        hpiBlock,
        NO_WALKING_LINE,
        IPHONE_CAMERA_ROLL_LINE,
        AVOID_EDITORIAL_LINE,
      ]
    : [
        sceneBlock,
        venueLine(options.venueImageUrl, options.venueTextFallback, options.hasVenueAnchor),
        outfitLine(options.garmentCount, footwearVisible),
        extraLine,
        hpiBlock,
        IPHONE_CAMERA_ROLL_LINE,
        AVOID_EDITORIAL_LINE,
      ];

  const prompt = lines.filter(Boolean).join('\n\n');
  const negative = intelligence.hpiNegatives.length > 0
    ? `${NEGATIVE_SHORT}\n${intelligence.hpiNegatives.join(', ')}`
    : NEGATIVE_SHORT;

  return { prompt, negative };
}
