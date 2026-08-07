/**
 * recipes/outfitNightOut/index.ts
 *
 * Punto de entrada público de la receta outfit_night_out hacia el resto del
 * sistema (photodumpDirectorService.ts). Expone 3 funciones con la misma
 * forma que outfitRevealBasic/index.ts y outfitMultiLook/index.ts.
 *
 * mirror_check cumple doble función de ancla (identidad/cuerpo/cuarto de
 * prep) y primer shot publicable — se genera una sola vez y se reusa como
 * REF0 para el resto del pipeline (mismo patrón de fusión ya usado en
 * outfitRevealBasic).
 *
 * A diferencia de outfitRevealBasic (1 sola ancla), acá hay DOS anclas:
 *  - prepAnchorCache: la imagen de mirror_check, citada por
 *    presentation/tryon_detail para mantener el mismo cuarto de prep.
 *  - venueAnchorCache: la imagen del PRIMER NightMoment generado en esta
 *    sesión (cualquiera que haya salido primero del banco rotable — no un
 *    shotId fijo), citada por los NightMoment siguientes para mantener el
 *    mismo venue. Se fija la primera vez que se genera un NightMoment y se
 *    reusa para el resto.
 *
 * energy/venueContext/hasCompanion se resuelven UNA VEZ en
 * buildOutfitNightOutDirectives() (a partir de refs/basePrompt) y viajan
 * fijos durante toda la generación real — no se recalculan por shot, para
 * que el banco de noche (pickNightMomentsForSet) siempre vea la misma
 * energía/companion que vio al armar el plan.
 *
 * DIRECTOR CREATIVO (ver modules/photodump/director/): buildOutfitNightOutDirectives
 * intenta correr el director (arquitectura A-K del usuario) ANTES de caer al
 * sistema estático de pickNightMomentsForSet. Si el director corre con éxito,
 * su selección de shots y sus prompts redactados (basados en piezas
 * reutilizables del banco real de fotos) reemplazan al array estático — el
 * texto se guarda en directorPromptCache y promptBuilder.ts lo usa en vez de
 * sceneBlockByEnergy. Si el director falla por CUALQUIER motivo (timeout,
 * red, JSON inválido), se cae automáticamente al comportamiento estático
 * actual — el usuario nunca debe ver un error duro por una falla del
 * director. Este fallback es no-negociable (ver plan "Director Creativo de
 * Photodump", Fase C).
 */
import { prepareRefs, getAspectRatio } from '../shared';
import type { PhotodumpRefs, PhotodumpDestino } from '../../types';
import type { PhotodumpShotDirective, PhotodumpREF0Result } from '../shared';
import { PRESENTATION_CONTRACT, TRYON_DETAIL_CONTRACT, MIRROR_CHECK_CONTRACT } from './shotPool';
import { resolveShotsForLevel } from './levelResolver';
import { findNightMoment } from './nightMoments';
import { extractCompanionRef } from './companion';
import { resolveVenueContext, resolveEnergyFromBrief } from './venueResolver';
import { routeReferences, type AnchorUrls } from './referenceRouter';
import { validateRouting } from './routingValidator';
import { buildShotPrompt } from './promptBuilder';
import { buildShotDebug } from './debug';
import { applyIntelligence } from './intelligenceLayer';
import { imageApiService } from '../../../../services/imageApiService';
import { runDirector } from '../../director/client';
import type { OutfitNightOutShotPlan, OutfitNightOutShotDebug, ShotContract, NightOutLevel, NightOutShotId } from './types';

// ── Cachés en memoria por sesión ─────────────────────────────────────────
// Mismo motivo que outfitRevealBasic/outfitMultiLook: generatePhotodumpREF0
// y generatePhotodumpShot son llamadas separadas del Director sin estado
// compartido — se cachea en memoria por refs.
const prepAnchorCache  = new Map<string, { imageUrl: string; prompt: string; refsCount: number }>();
const venueAnchorCache = new Map<string, { imageUrl: string; prompt: string; refsCount: number }>();
// shotId → texto redactado por el Director Creativo para ESTA sesión (misma
// key que prepAnchorCache/venueAnchorCache, un Map anidado por shotId).
// Vacío/ausente cuando el director no corrió o falló — promptBuilder.ts cae
// al sceneBlock estático en ese caso.
const directorPromptCache = new Map<string, Map<string, string>>();

function cacheKey(refs: PhotodumpRefs): string {
  const urls = [refs.avatarRef, refs.bodyRef, refs.outfitRef, ...(refs.outfitRefs ?? [])].filter(Boolean);
  return urls.join('|');
}

function garmentCountFor(refs: PhotodumpRefs): number {
  return [refs.outfitRef, ...(refs.outfitRefs ?? [])].filter(Boolean).length;
}

async function generateFromContract(
  contract:      ShotContract,
  refs:          PhotodumpRefs,
  destino:       PhotodumpDestino,
  basePrompt:    string,
  sessionParams: { uid?: string; sessionId?: string },
  shotIndex:     number,
  totalShots:    number,
  anchors:       AnchorUrls,
): Promise<{ imageUrl: string; prompt: string; refsCount: number; debug: OutfitNightOutShotDebug }> {
  const routed   = routeReferences(contract, refs, anchors);
  const routingValidation = validateRouting(contract, routed);
  if (!routingValidation.passed) {
    throw new Error(`El shot "${contract.shotId}" no pasó la validación de referencias: ${routingValidation.errors.join(' | ')}`);
  }

  const intelligence = applyIntelligence(contract, refs.gender ?? 'female');
  const venueCtx = resolveVenueContext(refs, basePrompt);
  const energy   = resolveEnergyFromBrief(basePrompt);
  const directorSceneBlock = directorPromptCache.get(cacheKey(refs))?.get(contract.shotId);
  const { prompt, negative } = buildShotPrompt(contract.shotId, intelligence, {
    garmentCount:      garmentCountFor(refs),
    hasVenueAnchor:    Boolean(anchors.venueAnchorUrl),
    hasCompanion:      Boolean(anchors.companionRef),
    venueImageUrl:     venueCtx.venueImageUrl,
    venueTextFallback: venueCtx.venueTextFallback,
    energy,
    directorSceneBlock,
  });
  const preparedRefs = await prepareRefs(routed.orderedUrls);

  const imageUrl = await imageApiService.generateImage({
    prompt,
    negative,
    referenceImages: preparedRefs,
    aspectRatio:     getAspectRatio(destino),
    modelId:         'gemini',
    uid:             sessionParams.uid,
    sessionId:       sessionParams.sessionId,
    module:          'photodump',
    moduleLabel:     'Photodump Mode',
    shotIndex,
    totalShots,
    metadata:        { role: 'OUTFIT_NIGHT_OUT_SHOT', shotId: contract.shotId },
  });

  const debug = buildShotDebug(contract, routed, prompt, routingValidation);
  return { imageUrl, prompt, refsCount: preparedRefs.length, debug };
}

function contractForFixedShotId(shotId: 'presentation' | 'tryon_detail' | 'mirror_check'): ShotContract {
  if (shotId === 'presentation')  return PRESENTATION_CONTRACT;
  if (shotId === 'tryon_detail')  return TRYON_DETAIL_CONTRACT;
  return MIRROR_CHECK_CONTRACT;
}

const FIXED_SHOT_IDS = new Set<NightOutShotId>(['presentation', 'tryon_detail', 'mirror_check']);

function isFixedShotId(shotId: NightOutShotId): shotId is 'presentation' | 'tryon_detail' | 'mirror_check' {
  return FIXED_SHOT_IDS.has(shotId);
}

function contractForShotId(shotId: NightOutShotId): ShotContract {
  if (isFixedShotId(shotId)) {
    return contractForFixedShotId(shotId);
  }
  return findNightMoment(shotId).contract;
}

function directiveFor(contract: ShotContract, beat: 'reveal' | 'candid'): Omit<PhotodumpShotDirective, 'arcPosition' | 'aspectRatio'> {
  const plan: OutfitNightOutShotPlan = { shotId: contract.shotId };
  return {
    key:                contract.shotId,
    beat,
    role:               'outfit_hero',
    purpose:            `outfit_night_out_${contract.shotId}`,
    requiredElements:   [],
    forbiddenElements:  [],
    variationSpace:     [],
    framing:            contract.cameraGrammar.framing,
    composition:        contract.cameraGrammar.composition,
    cameraAngle:        contract.cameraGrammar.angle,
    outfitNightOutPlan: plan,
  };
}

// ── Plan de sesión ──────────────────────────────────────────────────────

function seedFor(refs: PhotodumpRefs): string {
  return cacheKey(refs);
}

function staticDirectives(
  level:        NightOutLevel,
  seed:         string,
  hasCompanion: boolean,
  energy:       ReturnType<typeof resolveEnergyFromBrief>,
): Omit<PhotodumpShotDirective, 'arcPosition' | 'aspectRatio'>[] {
  const resolved = resolveShotsForLevel(level, seed, hasCompanion, energy);
  return resolved.map(r => {
    const contract = r.fixedContract ?? r.nightMoment!.contract;
    return directiveFor(contract, r.fixedContract ? 'reveal' : 'candid');
  });
}

/**
 * Intenta el Director Creativo (arquitectura A-K); si corre con éxito,
 * guarda sus prompts redactados en directorPromptCache y arma el plan de
 * shots a partir de los shotId que decidió. Si falla por cualquier motivo,
 * devuelve null — el caller cae al sistema estático (staticDirectives).
 * Nunca lanza: cualquier excepción se captura acá mismo.
 */
async function tryDirector(
  refs:         PhotodumpRefs,
  basePrompt:   string,
  level:        NightOutLevel,
  hasCompanion: boolean,
): Promise<Omit<PhotodumpShotDirective, 'arcPosition' | 'aspectRatio'>[] | null> {
  try {
    const { plan, finalPrompts } = await runDirector(basePrompt, 'outfit_night_out', level, hasCompanion);

    const promptByShotId = new Map(finalPrompts.map(p => [p.shotId, p.finalPrompt]));
    const key = cacheKey(refs);
    const shotCache = new Map<string, string>();

    const directives = plan.shots.map(shotDecision => {
      const shotId = shotDecision.shotId as NightOutShotId;
      const contract = contractForShotId(shotId);
      const redactedPrompt = promptByShotId.get(shotDecision.shotId);
      if (redactedPrompt) shotCache.set(shotId, redactedPrompt);
      return directiveFor(contract, FIXED_SHOT_IDS.has(shotId) ? 'reveal' : 'candid');
    });

    if (directives.length === 0) return null;
    directorPromptCache.set(key, shotCache);
    return directives;
  } catch (err) {
    console.warn('[outfit_night_out] Director Creativo falló, usando banco estático de respaldo:', err);
    return null;
  }
}

export async function buildOutfitNightOutDirectives(
  refs:       PhotodumpRefs,
  basePrompt: string,
): Promise<Omit<PhotodumpShotDirective, 'arcPosition' | 'aspectRatio'>[]> {
  const level = (refs.nightOutLevel ?? 'corto') as NightOutLevel;
  const hasCompanion = Boolean(extractCompanionRef(refs));
  const energy = resolveEnergyFromBrief(basePrompt);

  const fromDirector = await tryDirector(refs, basePrompt, level, hasCompanion);
  if (fromDirector) return fromDirector;

  return staticDirectives(level, seedFor(refs), hasCompanion, energy);
}

// ── REF0 (mirror_check hace doble función de ancla) ─────────────────────

export async function generateOutfitNightOutREF0(
  refs:           PhotodumpRefs,
  destino:        PhotodumpDestino,
  basePrompt:     string,
  sessionParams:  { uid?: string; sessionId?: string },
): Promise<PhotodumpREF0Result> {
  const companionRef = extractCompanionRef(refs);
  const result = await generateFromContract(
    MIRROR_CHECK_CONTRACT, refs, destino, basePrompt, sessionParams, 0, 1, { companionRef },
  );
  prepAnchorCache.set(cacheKey(refs), result);
  return { imageUrl: result.imageUrl, ref0Analysis: null, prompt: result.prompt, refsCount: result.refsCount };
}

// ── Shot individual ─────────────────────────────────────────────────────

export interface OutfitNightOutShotResult {
  imageUrl:  string;
  prompt:    string;
  refsCount: number;
  debug:     OutfitNightOutShotDebug;
}

export async function generateOutfitNightOutShot(
  shot:           PhotodumpShotDirective,
  refs:           PhotodumpRefs,
  destino:        PhotodumpDestino,
  basePrompt:     string,
  sessionParams:  { uid?: string; sessionId?: string },
  shotIndex:      number,
  totalShots:     number,
): Promise<OutfitNightOutShotResult> {
  const shotId = shot.outfitNightOutPlan?.shotId;
  if (!shotId) {
    throw new Error(`El shot "${shot.key}" no tiene un shotId válido de outfit_night_out.`);
  }

  const key = cacheKey(refs);
  const companionRef = extractCompanionRef(refs);

  if (shotId === 'mirror_check') {
    const cached = prepAnchorCache.get(key);
    if (cached) {
      const debug = buildShotDebug(
        MIRROR_CHECK_CONTRACT,
        { orderedUrls: [], breakdown: { outfits: [] } },
        'mirror_check (already generated as the anchor)',
        { passed: true, errors: [] },
      );
      return { imageUrl: cached.imageUrl, prompt: cached.prompt, refsCount: cached.refsCount, debug };
    }
    // Red de seguridad: si por algún motivo el REF0 no se generó antes.
    const result = await generateFromContract(
      MIRROR_CHECK_CONTRACT, refs, destino, basePrompt, sessionParams, shotIndex, totalShots, { companionRef },
    );
    prepAnchorCache.set(key, result);
    return result;
  }

  if (shotId === 'presentation' || shotId === 'tryon_detail') {
    const prepAnchorUrl = prepAnchorCache.get(key)?.imageUrl;
    return generateFromContract(
      contractForFixedShotId(shotId), refs, destino, basePrompt, sessionParams, shotIndex, totalShots,
      { prepAnchorUrl, companionRef },
    );
  }

  // NightMoment del banco de noche.
  const moment = findNightMoment(shotId);
  const venueAnchorUrl = venueAnchorCache.get(key)?.imageUrl;
  const result = await generateFromContract(
    moment.contract, refs, destino, basePrompt, sessionParams, shotIndex, totalShots,
    { venueAnchorUrl, companionRef },
  );
  if (!venueAnchorUrl) venueAnchorCache.set(key, result);
  return result;
}
