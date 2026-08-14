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
import { prepareRefs, getAspectRatio, extractImageData } from '../shared';
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
import { compressImageForUpload } from '../../../../utils/imageUtils';
import { runDirector, type DirectorReferenceImage } from '../../director/client';
import type { DirectorPlan, FinalPromptShot } from '../../director/types';
import type { OpenBankPlan, OpenBankFinalPromptShot, OpenBankShotDecision } from '../../director/openBank/openBankTypes';
import { buildOpenBankDirectives } from './openBankAdapter';
import { analyzeOpenBankVenue, redactOpenBankSingleShot } from '../../director/client';
import type { OutfitNightOutShotPlan, OutfitNightOutShotDebug, ShotContract, NightOutLevel, NightOutShotId, NightMomentId, OpenBankSyntheticShotId } from './types';

// ── Cachés en memoria por sesión ─────────────────────────────────────────
// Mismo motivo que outfitRevealBasic/outfitMultiLook: generatePhotodumpREF0
// y generatePhotodumpShot son llamadas separadas del Director sin estado
// compartido — se cachea en memoria por sessionId (único por tanda real, ver
// cacheKey más abajo). Nunca por refs solas — dos tandas distintas (incluso
// de usuarios distintos) pueden compartir las mismas fotos de referencia.
const prepAnchorCache  = new Map<string, { imageUrl: string; prompt: string; refsCount: number }>();
const venueAnchorCache = new Map<string, { imageUrl: string; prompt: string; refsCount: number }>();
// shotId → texto redactado por el Director Creativo para ESTA sesión (misma
// key que prepAnchorCache/venueAnchorCache, un Map anidado por shotId).
// Vacío/ausente cuando el director no corrió o falló — promptBuilder.ts cae
// al sceneBlock estático en ese caso.
const directorPromptCache = new Map<string, Map<string, string>>();
// Motivo de la última falla del director para esta sesión (refs) — solo
// para debug/diagnóstico, no afecta el comportamiento. Se limpia si el
// director corre con éxito.
const directorFailureCache = new Map<string, string>();
// Contrato del PRIMER shot real elegido por el director en modo open_bank —
// solo se puebla cuando directorMode === 'open_bank' (tryDirector). A
// diferencia de categorized (mirror_check SIEMPRE fijo, REF0 nunca necesita
// leer el plan), open_bank compone la apertura libremente — puede ser mirror
// selfie, POV en un ascensor, plano de escalera, lo que el director decida
// coherente con el brief (pedido explícito del usuario: "no me gustaría que
// el primer shot fuera obligado mirror check"). generateOutfitNightOutREF0
// lee este caché en vez de asumir MIRROR_CHECK_CONTRACT — puebla ANTES de
// llamar a REF0 porque buildOutfitNightOutDirectives (que llama a
// tryDirector) siempre corre primero en el flujo real (ver
// PhotodumpModule.tsx: plan completo se resuelve antes de invocar el REF0).
const openBankFirstShotCache = new Map<string, { contract: ShotContract; finalPrompt: string | undefined }>();
// Todos los ShotContract sintéticos de un plan open_bank para esta sesión
// (shotId → contract), no solo el primero — generateOutfitNightOutShot los
// necesita para los shots 2..N (open_bank_2, open_bank_3, ...), que de otra
// forma caerían al findNightMoment(shotId) del banco fijo y explotarían (esos
// shotIds sintéticos no existen ahí).
const openBankContractCache = new Map<string, Map<string, ShotContract>>();
// Plan crudo del director open_bank por sesión (shotId → OpenBankShotDecision)
// — necesario para re-redactar un shot puntual con continuidad de venue REAL
// (ver generateOutfitNightOutShot, rama open_bank_2..N con needsVenueAnchor)
// sin tener que rehacer la llamada de "Decidir" completa. El servidor
// reconstruye el richDetailBlock a partir de shot.chosenCandidateId — no
// hace falta cachearlo acá (ver redactOpenBankSingleShot en client.ts).
const openBankShotDecisionCache = new Map<string, Map<string, OpenBankShotDecision>>();

/**
 * BUG REAL corregido: antes esta clave se armaba solo con las URLs de
 * referencia (avatar/cuerpo/outfit), sin brief ni sessionId. Como estos Maps
 * viven en memoria del proceso serverless (compartida entre requests, no por
 * usuario), dos tandas con las mismas fotos de referencia (típico al usar
 * presets para ahorrar tiempo entre pruebas) caían en la MISMA clave — el
 * venue y los shots elegidos por el director de la primera tanda quedaban
 * pegados para siempre, sin importar el brief nuevo. Usar sessionId (único
 * por tanda real, generado una vez por generación completa — ver
 * PhotodumpModule.tsx) es la única clave que garantiza que NINGUNA tanda,
 * de ningún usuario, pueda leer resultados cacheados de otra. refs+basePrompt
 * queda solo como fallback defensivo si por algún motivo sessionId no llega
 * (no debería ocurrir en el flujo real).
 */
function cacheKey(refs: PhotodumpRefs, basePrompt: string, sessionId?: string): string {
  if (sessionId) return sessionId;
  const urls = [refs.avatarRef, refs.bodyRef, refs.outfitRef, ...(refs.outfitRefs ?? [])].filter(Boolean);
  return `${urls.join('|')}::${basePrompt}`;
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
  const directorSceneBlock = directorPromptCache.get(cacheKey(refs, basePrompt, sessionParams.sessionId))?.get(contract.shotId);
  const { prompt, negative } = buildShotPrompt(contract.shotId, intelligence, {
    garmentCount:      garmentCountFor(refs),
    hasVenueAnchor:    Boolean(anchors.venueAnchorUrl),
    hasCompanion:      Boolean(anchors.companionRef),
    venueImageUrl:     venueCtx.venueImageUrl,
    venueTextFallback: venueCtx.venueTextFallback,
    energy,
    seed: seedFor(refs),
    directorSceneBlock,
    openBankFootwearVisible: contract.footwearVisible,
    openBankHasOutfitRef: contract.referencePolicy.useOutfitRefs,
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

  const debug = buildShotDebug(contract, routed, prompt, routingValidation, Boolean(directorSceneBlock));
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
  // Nunca debería llegar acá con un shotId sintético de open_bank — el guard
  // `directorMode === 'open_bank'` en tryDirector corta ese flujo antes de
  // usar contractForShotId (ver openBankAdapter.ts para el camino real de
  // open_bank). Narrowing explícito porque NightOutShotId incluye el tipo
  // sintético desde que se agregó OpenBankSyntheticShotId.
  if (typeof shotId === 'string' && shotId.startsWith('open_bank_')) {
    throw new Error(`contractForShotId recibió un shotId sintético de open_bank ("${shotId}") — esto es un bug, ese modo no debe pasar por acá.`);
  }
  return findNightMoment(shotId as NightMomentId).contract;
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

// Seed del sorteo determinístico del sistema estático — a propósito NO
// incluye el brief (rota por refs, no cachea resultado de una llamada cara).
function seedFor(refs: PhotodumpRefs): string {
  const urls = [refs.avatarRef, refs.bodyRef, refs.outfitRef, ...(refs.outfitRefs ?? [])].filter(Boolean);
  return urls.join('|');
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
 * Prepara las imágenes reales del usuario (identidad, cuerpo, outfit, escena
 * si existe, acompañante si existe) para mandarle al Director Creativo en su
 * llamada de "Decidir" — mismo formato/compresión que prepareRefs (768px,
 * calidad 0.72) para no encarecer el payload. Pedido real del usuario: sin
 * ver el outfit real, el director heredaba poses de candidatos del banco que
 * dependían de estructura física inexistente en la prenda real (ej. "mano en
 * el bolsillo" transferido a una falda sin bolsillos visibles) — comparaba
 * texto contra texto, nunca contra la imagen real.
 */
async function buildDirectorReferenceImages(refs: PhotodumpRefs, companionRef: string | null): Promise<DirectorReferenceImage[]> {
  const entries: Array<{ role: DirectorReferenceImage['role']; url: string | null | undefined }> = [
    { role: 'identidad/rostro', url: refs.avatarRef },
    { role: 'cuerpo', url: refs.bodyRef },
    { role: 'outfit', url: refs.outfitRef },
    ...(refs.outfitRefs ?? []).map(url => ({ role: 'outfit' as const, url })),
    { role: 'escena/venue', url: refs.sceneRef },
    { role: 'acompañante', url: companionRef },
  ];

  const images: DirectorReferenceImage[] = [];
  for (const entry of entries) {
    if (!entry.url) continue;
    try {
      const compressed = await compressImageForUpload(entry.url, 768, 0.72);
      const extracted = extractImageData(compressed);
      if (extracted) images.push({ role: entry.role, data: extracted.data, mimeType: extracted.mimeType });
    } catch {
      // No bloquear el director por una imagen individual que falle en comprimir.
    }
  }
  return images;
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
  sessionId?:   string,
): Promise<Omit<PhotodumpShotDirective, 'arcPosition' | 'aspectRatio'>[] | null> {
  try {
    const directorMode = refs.directorMode ?? 'categorized';
    const companionRef = extractCompanionRef(refs);
    const referenceImages = await buildDirectorReferenceImages(refs, companionRef);
    const { plan, finalPrompts } = await runDirector(basePrompt, 'outfit_night_out', level, hasCompanion, referenceImages, directorMode);

    // Modo "banco abierto" — bypass aislado y reversible (ver plan de
    // sesión). Su plan/finalPrompts usan vehicleLabel libre, no shotId de
    // un enum fijo — openBankAdapter.ts arma un ShotContract SINTÉTICO por
    // shot (shotId "open_bank_N") en vez de contractForShotId, reusando tal
    // cual el resto del pipeline (routeReferences, validateRouting,
    // buildShotPrompt, buildShotDebug — ninguno hace switch sobre shotId).
    if (directorMode === 'open_bank') {
      const openBankPlan = plan as OpenBankPlan;
      const openBankFinalPrompts = finalPrompts as OpenBankFinalPromptShot[];
      const { contracts, finalPrompts: redactedByShotId } = buildOpenBankDirectives(openBankPlan, openBankFinalPrompts);

      if (contracts.size === 0) {
        directorFailureCache.set(cacheKey(refs, basePrompt, sessionId), 'El director (open_bank) devolvió 0 shots.');
        return null;
      }

      const key = cacheKey(refs, basePrompt, sessionId);
      const shotCache = new Map<string, string>();
      const decisionCache = new Map<string, OpenBankShotDecision>();
      const directives: Omit<PhotodumpShotDirective, 'arcPosition' | 'aspectRatio'>[] = [];
      openBankPlan.shots.forEach((shot, i) => {
        const shotId = `open_bank_${i + 1}` as OpenBankSyntheticShotId;
        if (contracts.has(shotId)) decisionCache.set(shotId, shot);
      });
      for (const [shotId, contract] of contracts.entries()) {
        const redactedPrompt = redactedByShotId.get(shotId);
        if (redactedPrompt) shotCache.set(shotId, redactedPrompt);
        directives.push(directiveFor(contract, 'candid'));
      }

      if (directives.length === 0) {
        directorFailureCache.set(key, 'El director (open_bank) no produjo ningún shot con prompt redactado.');
        return null;
      }
      directorPromptCache.set(key, shotCache);
      directorFailureCache.delete(key);
      openBankContractCache.set(key, contracts);
      openBankShotDecisionCache.set(key, decisionCache);

      // Primer shot real del plan — apertura libre (ver comentario de
      // openBankFirstShotCache), reemplaza al mirror_check fijo para esta
      // sesión. generateOutfitNightOutREF0 lo lee de acá.
      const firstDirective = directives[0];
      const firstContract = contracts.get(firstDirective.outfitNightOutPlan!.shotId as OpenBankSyntheticShotId)!;
      openBankFirstShotCache.set(key, {
        contract: firstContract,
        finalPrompt: shotCache.get(firstDirective.outfitNightOutPlan!.shotId),
      });

      return directives;
    }

    // A partir de acá directorMode === 'categorized' garantizado (el guard
    // de arriba corta el flujo para 'open_bank') — la respuesta del server
    // tiene la forma DirectorPlan/FinalPromptShot[] con shotId, nunca la
    // forma OpenBankPlan/OpenBankFinalPromptShot[] con vehicleLabel.
    const categorizedPlan = plan as DirectorPlan;
    const categorizedFinalPrompts = finalPrompts as FinalPromptShot[];
    const promptByShotId = new Map(categorizedFinalPrompts.map(p => [p.shotId, p.finalPrompt]));
    const key = cacheKey(refs, basePrompt, sessionId);
    const shotCache = new Map<string, string>();

    // Defensa adicional al enum del schema (ver content.ts): si Gemini
    // igual devuelve un shotId inválido, se descarta SOLO ese shot en vez de
    // tirar la sesión completa al fallback estático — antes un único id
    // inválido rompía TODO el plan (incluidos shots válidos), por el .map
    // sin try/catch propagando la excepción de contractForShotId.
    const directives: Omit<PhotodumpShotDirective, 'arcPosition' | 'aspectRatio'>[] = [];
    for (const shotDecision of categorizedPlan.shots) {
      const shotId = shotDecision.shotId as NightOutShotId;
      let contract: ShotContract;
      try {
        contract = contractForShotId(shotId);
      } catch {
        console.warn(`[outfit_night_out] Director devolvió un shotId inválido, se descarta: ${shotDecision.shotId}`);
        continue;
      }
      const redactedPrompt = promptByShotId.get(shotDecision.shotId);
      if (redactedPrompt) shotCache.set(shotId, redactedPrompt);
      directives.push(directiveFor(contract, FIXED_SHOT_IDS.has(shotId) ? 'reveal' : 'candid'));
    }

    if (directives.length === 0) {
      directorFailureCache.set(key, 'El director devolvió 0 shots.');
      return null;
    }
    directorPromptCache.set(key, shotCache);
    directorFailureCache.delete(key);
    return directives;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    directorFailureCache.set(cacheKey(refs, basePrompt, sessionId), message);
    console.warn('[outfit_night_out] Director Creativo falló, usando banco estático de respaldo:', err);
    return null;
  }
}

export async function buildOutfitNightOutDirectives(
  refs:       PhotodumpRefs,
  basePrompt: string,
  sessionId?: string,
): Promise<Omit<PhotodumpShotDirective, 'arcPosition' | 'aspectRatio'>[]> {
  const level = (refs.nightOutLevel ?? 'corto') as NightOutLevel;
  const hasCompanion = Boolean(extractCompanionRef(refs));
  const energy = resolveEnergyFromBrief(basePrompt);

  const fromDirector = await tryDirector(refs, basePrompt, level, hasCompanion, sessionId);
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
  const level = (refs.nightOutLevel ?? 'corto') as NightOutLevel;
  const key = cacheKey(refs, basePrompt, sessionParams.sessionId);

  // open_bank: la apertura la elige libremente el director (mirror selfie,
  // POV de ascensor, plano de escalera, lo que sea coherente con el brief) —
  // nunca mirror_check fijo. buildOutfitNightOutDirectives (llamado ANTES en
  // el flujo real, ver PhotodumpModule.tsx) ya corrió el director y dejó el
  // primer shot listo en openBankFirstShotCache — no se vuelve a llamar a
  // Gemini acá.
  if (refs.directorMode === 'open_bank') {
    const firstShot = openBankFirstShotCache.get(key);
    if (firstShot) {
      const result = await generateFromContract(
        firstShot.contract, refs, destino, basePrompt, sessionParams, 0, 1, { companionRef },
      );
      prepAnchorCache.set(key, result);
      // Siembra el ancla de venue SOLO si este primer shot realmente ocurre
      // en el venue principal — ver comentario en generateOutfitNightOutShot
      // (open_bank_2..N) y OpenBankShotDecision.isMainVenue: un set puede
      // abrir con un shot que NO es del venue principal (auto de camino,
      // casa antes de salir) y en ese caso el ancla real debe esperar al
      // primer shot que sí lo sea, no fijarse con esta imagen equivocada.
      const firstShotDecision = openBankShotDecisionCache.get(key)?.get('open_bank_1');
      if (firstShotDecision?.isMainVenue !== false) venueAnchorCache.set(key, result);
      return { imageUrl: result.imageUrl, ref0Analysis: null, prompt: result.prompt, refsCount: result.refsCount };
    }
    // Red de seguridad: si por algún motivo el director no corrió o falló
    // antes de llegar acá (no debería pasar en el flujo real), cae al mismo
    // ancla fija que categorized — nunca debe tirar un error duro al usuario.
  }

  // 'una_foto': el único shot del set ES el ancla — mismo patrón de fusión
  // REF0+shot1 que outfitRevealBasic/outfitMultiLook, pero con
  // single_hero_shot en vez de mirror_check.
  const contract = level === 'una_foto' ? findNightMoment('single_hero_shot').contract : MIRROR_CHECK_CONTRACT;
  const result = await generateFromContract(
    contract, refs, destino, basePrompt, sessionParams, 0, 1, { companionRef },
  );
  prepAnchorCache.set(key, result);
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

  const key = cacheKey(refs, basePrompt, sessionParams.sessionId);
  const companionRef = extractCompanionRef(refs);

  // open_bank_1 es SIEMPRE el primer shot de un plan open_bank (ver
  // openBankAdapter.ts, openBankShotId(i+1), 1-based) — cumple el mismo rol
  // de ancla que mirror_check/single_hero_shot: ya se generó como REF0
  // (generateOutfitNightOutREF0 lee openBankFirstShotCache), acá solo se
  // reusa el resultado cacheado.
  const isOpenBankAnchor = shotId === 'open_bank_1';
  if (shotId === 'mirror_check' || shotId === 'single_hero_shot' || isOpenBankAnchor) {
    const contract = isOpenBankAnchor
      ? openBankFirstShotCache.get(key)?.contract
      : (shotId === 'single_hero_shot' ? findNightMoment('single_hero_shot').contract : MIRROR_CHECK_CONTRACT);
    const cached = prepAnchorCache.get(key);
    if (cached && contract) {
      const usedDirector = directorPromptCache.get(key)?.has(shotId) ?? false;
      const debug = buildShotDebug(
        contract,
        { orderedUrls: [], breakdown: { outfits: [] } },
        `${shotId} (already generated as the anchor)`,
        { passed: true, errors: [] },
        usedDirector,
      );
      return { imageUrl: cached.imageUrl, prompt: cached.prompt, refsCount: cached.refsCount, debug };
    }
    // Red de seguridad: si por algún motivo el REF0 no se generó antes (o,
    // para open_bank, el contrato sintético no llegó a cachearse).
    const fallbackContract = contract
      ?? (shotId === 'single_hero_shot' ? findNightMoment('single_hero_shot').contract : MIRROR_CHECK_CONTRACT);
    const result = await generateFromContract(
      fallbackContract, refs, destino, basePrompt, sessionParams, shotIndex, totalShots, { companionRef },
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

  // Shots open_bank_2..N (open_bank_1 ya se resolvió arriba como ancla) —
  // contrato sintético armado por openBankAdapter.ts, cacheado en tryDirector.
  //
  // BUG REAL corregido (prueba real, 13 ago 2026): la continuidad de venue
  // dependía SOLO del texto (needsVenueAnchor/continuityNote que el director
  // declara por shot) — en una sesión real de 7 shots, el director marcó bien
  // needsVenueAnchor en los shots 4/5/6 pero se lo saltó en el shot 7 (el
  // último), y sin ninguna imagen real de referencia, el prompt de ese shot
  // quedó con una descripción de escena genérica ("dramatic architectural
  // lighting") que el generador resolvió como un venue completamente
  // distinto (arquitectura de ladrillo/balcones, nada que ver con el rooftop
  // real de los otros 6 shots). Mismo patrón de riesgo que ya existía en
  // categorized antes de tener venueAnchorCache.
  //
  // Fix: igual que categorized, TODO shot open_bank_2..N usa automáticamente
  // la imagen del shot anterior más reciente de este set como referencia
  // visual de venue — no depende de que el director lo declare bien en cada
  // shot. Refuerza (no reemplaza) la continuidad por texto que ya existe.
  const openBankContract = openBankContractCache.get(key)?.get(shotId);
  if (openBankContract) {
    const venueAnchorUrl = venueAnchorCache.get(key)?.imageUrl;

    // BUG REAL corregido (prueba 13, 14 ago 2026): incluso con venueAnchorUrl
    // pasado al GENERADOR de imagen, el TEXTO del prompt (directorSceneBlock)
    // ya venía redactado desde el plan inicial, ANTES de que existiera
    // ninguna imagen — así que "reuse la baranda del shot anterior" era una
    // promesa de texto sobre una baranda que Gemini nunca vio, no una
    // observación real. Resultado real: una baranda "aparecía de la nada" en
    // medio de mesas de gente, una puerta de baño forzada abierta para
    // "cumplir" con la continuidad, y una esquina nueva del venue con
    // mobiliario de otro estilo. Fix: si el shot necesita continuidad de
    // venue Y ya existe la imagen real del shot anterior, re-redactar ESTE
    // shot puntual viendo esa imagen real (analyzeOpenBankVenue +
    // redactOpenBankSingleShot) antes de generar — reemplaza el texto
    // genérico del plan original por una observación concreta. Si cualquiera
    // de las 2 llamadas falla (red, timeout), se cae silenciosamente al
    // prompt ya redactado del plan original — nunca debe romper la sesión.
    const shotDecision = openBankShotDecisionCache.get(key)?.get(shotId);
    if (shotDecision?.needsVenueAnchor && venueAnchorUrl) {
      const venueObservation = await analyzeOpenBankVenue(venueAnchorUrl);
      if (venueObservation) {
        const energy = resolveEnergyFromBrief(basePrompt);
        const rewritten = await redactOpenBankSingleShot(basePrompt, shotDecision, venueObservation, energy);
        if (rewritten) {
          directorPromptCache.get(key)?.set(shotId, rewritten);
        }
      }
    }

    const result = await generateFromContract(
      openBankContract, refs, destino, basePrompt, sessionParams, shotIndex, totalShots,
      { venueAnchorUrl, companionRef },
    );
    // Solo actualiza el ancla si este shot es del venue principal — nunca
    // con un shot de otra etapa (auto, casa antes de salir). Si todavía no
    // había ancla fijada (ningún shot anterior fue isMainVenue=true) y este
    // sí lo es, este shot la fija por primera vez. isMainVenue !== false
    // (no === true) como red de seguridad ante planes viejos sin el campo.
    if (shotDecision?.isMainVenue !== false) venueAnchorCache.set(key, result);
    return result;
  }

  // NightMoment del banco de noche (modo categorized) — nunca debería llegar
  // acá con un shotId sintético de open_bank (el bloque de arriba ya lo
  // habría resuelto); narrowing explícito por el mismo motivo que
  // contractForShotId.
  if (typeof shotId === 'string' && shotId.startsWith('open_bank_')) {
    throw new Error(`generateOutfitNightOutShot no encontró el contrato sintético cacheado para "${shotId}" — esto es un bug (openBankContractCache debería tenerlo).`);
  }
  const moment = findNightMoment(shotId as NightMomentId);
  const venueAnchorUrl = venueAnchorCache.get(key)?.imageUrl;
  const result = await generateFromContract(
    moment.contract, refs, destino, basePrompt, sessionParams, shotIndex, totalShots,
    { venueAnchorUrl, companionRef },
  );
  if (!venueAnchorUrl) venueAnchorCache.set(key, result);
  return result;
}
