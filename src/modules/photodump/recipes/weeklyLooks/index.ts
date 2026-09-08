/**
 * recipes/weeklyLooks/index.ts
 *
 * Punto de entrada público de la receta weeklyLooks — mitad "ropa" de la
 * separación de weeklyFavoritesV2 (sep 2026). Expone las mismas 3 funciones
 * que el resto de las recetas nuevas del Director (build.../generate...REF0/
 * generate...Shot).
 *
 * FASE DE PRUEBA (instrucción explícita del usuario, sep 2026: "en manera de
 * prueba hay que dejarlo simple"): esta receta se despacha hoy como un modo
 * interno de 'outfit_week' (refs.weeklyMode === 'looks'), no como un
 * PhotodumpRecipe propio — evita tocar RECIPE_META/selector/RecipeRefConfig
 * mientras se valida el enfoque. La UI de configuración (captureStyle/
 * placeMode) es deliberadamente simple (controles de texto/select) hasta
 * que el enfoque esté probado — la versión final (cards con imagen de
 * ejemplo + tooltip hover, pedida por el usuario) se construye después.
 *
 * Shot ancla (primer look, isAnchorShot=true) cumple doble función: primer
 * shot publicable + fija el lugar cuando placeMode === 'same_place' (mismo
 * patrón que outfitRevealBasic/mirror_check — se genera una sola vez y su
 * resultado real se reusa como referencia de escena para el resto del set).
 */
import { imageApiService } from '../../../../services/imageApiService';
import { prepareRefs, getAspectRatio } from '../shared';
import type { PhotodumpRefs, PhotodumpDestino } from '../../types';
import type { PhotodumpShotDirective, PhotodumpREF0Result } from '../shared';
import { buildWeeklyLooksManifest } from './manifest';
import { buildAnchorContract } from './anchor';
import { buildShotContracts } from './contracts';
import { routeReferences } from './referenceRouter';
import { buildShotPrompt } from './promptBuilder';
import { buildShotDebug } from './debug';
import { selectPoseAttitudeLine } from './poseSelection';
import { analyzeWeeklyLooksPlaces, fallbackPlacesList } from './placesClient';
import type {
  AnchorContract, ShotContract, WeeklyLooksShotPlan, WeeklyLooksShotDebug,
  CaptureStyle, PlaceMode, WeeklyLooksConfig,
} from './types';

// ── Config por defecto (fase de prueba: sin UI final todavía) ─────────────
const DEFAULT_CONFIG: WeeklyLooksConfig = { captureStyle: 'mirror_selfie', placeMode: 'varied_place' };

function resolveConfig(refs: PhotodumpRefs): WeeklyLooksConfig {
  return refs.weeklyLooksConfig ?? DEFAULT_CONFIG;
}

// ── Caché en memoria del shot ancla (imagen real ya generada) por sesión ──
// Mismo motivo que outfitRevealBasic/outfitMultiLook: build.../generate...REF0/
// generate...Shot son llamadas separadas del Director sin estado compartido.
const anchorImageCache = new Map<string, { imageUrl: string; prompt: string; refsCount: number }>();
// Caché de la LISTA de lugares coherentes del primer look (varied_place) —
// sep 2026, bug real corregido: antes se cacheaba un string libre único
// ("a bedroom, a store fitting room..."), y con varios shots en el mismo
// set el modelo convergía siempre al lugar "más obvio" de esa frase
// (pasillo de hotel, repetido en 4/4 shots del mismo set real). Ahora se
// cachea la LISTA y cada shot recibe UN lugar concreto y distinto (ver
// assignPlacesToShots), nunca la frase libre completa.
const coherentPlacesListCache = new Map<string, string[]>();

function cacheKey(refs: PhotodumpRefs): string {
  const urls = [refs.avatarRef, refs.bodyRef, refs.outfitRef, ...(refs.outfitRefs ?? [])].filter(Boolean);
  const cfg = resolveConfig(refs);
  return `${urls.join('|')}::${cfg.captureStyle}::${cfg.placeMode}`;
}

async function resolveCoherentPlacesList(refs: PhotodumpRefs, config: WeeklyLooksConfig, basePrompt?: string): Promise<string[]> {
  const key = cacheKey(refs);
  const cached = coherentPlacesListCache.get(key);
  if (cached) return cached;
  const firstLookUrl = refs.outfitRef ?? refs.outfitRefs?.[0];
  const mirrorNeeded = config.captureStyle === 'mirror_selfie';
  const analyzed = firstLookUrl ? await analyzeWeeklyLooksPlaces(firstLookUrl, mirrorNeeded, basePrompt) : null;
  const list = analyzed ?? fallbackPlacesList();
  coherentPlacesListCache.set(key, list);
  return list;
}

// Asigna un lugar CONCRETO y distinto a cada shot, en el orden de la lista
// (no aleatorio, no repetido mientras alcancen las opciones) — si hay más
// shots que lugares disponibles, rota desde el principio (mejor repetir un
// lugar ya usado que quedarse sin ninguno).
function assignPlacesToShots(contracts: ShotContract[], places: string[]): ShotContract[] {
  if (places.length === 0) return contracts;
  return contracts.map((c, i) => ({ ...c, coherentPlaces: places[i % places.length] }));
}

async function attachPoseAndPlace(
  contracts:    ShotContract[],
  config:       WeeklyLooksConfig,
  seedKey:      string,
  refs:         PhotodumpRefs,
  basePrompt?:  string,
): Promise<ShotContract[]> {
  const withPose = await Promise.all(contracts.map(async (c): Promise<ShotContract> => ({
    ...c,
    poseAttitudeLine: await selectPoseAttitudeLine(config.captureStyle, seedKey, c.shotId),
  })));
  if (config.placeMode !== 'varied_place') return withPose;
  const places = await resolveCoherentPlacesList(refs, config, basePrompt);
  return assignPlacesToShots(withPose, places);
}

async function generateFromContract(
  contract:      ShotContract,
  refs:          PhotodumpRefs,
  destino:       PhotodumpDestino,
  config:        WeeklyLooksConfig,
  anchor:        AnchorContract,
  sessionParams: { uid?: string; sessionId?: string },
  shotIndex:     number,
  totalShots:    number,
  sceneAnchorImageUrl?: string,
): Promise<{ imageUrl: string; prompt: string; refsCount: number; debug: WeeklyLooksShotDebug }> {
  const routed = routeReferences(contract, refs, sceneAnchorImageUrl);
  const { prompt, negative } = buildShotPrompt(contract, anchor, config.captureStyle, config.placeMode);
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
    metadata:        { role: 'WEEKLY_LOOKS_SHOT', shotId: contract.shotId, captureStyle: config.captureStyle, placeMode: config.placeMode },
  });

  const debug = buildShotDebug(contract, config.captureStyle, config.placeMode, prompt);
  return { imageUrl, prompt, refsCount: preparedRefs.length, debug };
}

// ── Plan de sesión ──────────────────────────────────────────────────────

export async function buildWeeklyLooksDirectives(
  refs:        PhotodumpRefs,
  sessionId?:  string,
  basePrompt?: string,
): Promise<Omit<PhotodumpShotDirective, 'arcPosition' | 'aspectRatio'>[]> {
  const config = resolveConfig(refs);
  const manifest = buildWeeklyLooksManifest(refs);
  const rawContracts = buildShotContracts(manifest);
  const seedKey = `${cacheKey(refs)}::${sessionId ?? ''}`;
  const contracts = await attachPoseAndPlace(rawContracts, config, seedKey, refs, basePrompt);

  return contracts.map((contract): Omit<PhotodumpShotDirective, 'arcPosition' | 'aspectRatio'> => {
    const plan: WeeklyLooksShotPlan = {
      shotId:       contract.shotId,
      lookItemId:    contract.lookItem.id,
      isAnchorShot:  contract.isAnchorShot,
    };
    return {
      key:               contract.shotId,
      beat:              'context',
      role:              'outfit_hero',
      purpose:           `weekly_looks_${contract.shotId}`,
      requiredElements:  [],
      forbiddenElements: [],
      variationSpace:    [],
      framing:           contract.cameraGrammar.framing,
      composition:       contract.cameraGrammar.composition,
      cameraAngle:       contract.cameraGrammar.angle,
      weeklyLooksPlan:   plan,
    };
  });
}

// ── REF0 (el shot ancla hace doble función) ─────────────────────────────

export async function generateWeeklyLooksREF0(
  refs:           PhotodumpRefs,
  destino:        PhotodumpDestino,
  sessionParams:  { uid?: string; sessionId?: string },
  basePrompt?:    string,
): Promise<PhotodumpREF0Result> {
  const config = resolveConfig(refs);
  const manifest = buildWeeklyLooksManifest(refs);
  if (manifest.items.length === 0) {
    throw new Error('Se necesita al menos un look (referencia de outfit) para generar el ancla visual.');
  }
  const anchor = buildAnchorContract(refs, manifest);

  const rawContract = buildShotContracts(manifest)[0];
  const seedKey = `${cacheKey(refs)}::${sessionParams.sessionId ?? ''}`;
  const [contract] = await attachPoseAndPlace([rawContract], config, seedKey, refs, basePrompt);

  // same_place con lugar subido por el usuario: reusa el slot genérico
  // "Escena" (refs.sceneRef) — mismo slot que trip_recap/outfit_check ya
  // usan para "subí una foto real del lugar" — en vez de un campo de
  // subida propio (fase de prueba: menos UI nueva, mismo slot conocido).
  // Si no subió nada, se pasa undefined y el lugar se GENERA en este mismo
  // shot (ver anchorOutfitLine/placeLine en promptBuilder.ts).
  const uploadedPlace = config.placeMode === 'same_place' ? (refs.sceneRef ?? undefined) : undefined;

  const result = await generateFromContract(contract, refs, destino, config, anchor, sessionParams, 0, manifest.items.length, uploadedPlace);
  anchorImageCache.set(cacheKey(refs), result);
  return { imageUrl: result.imageUrl, ref0Analysis: null, prompt: result.prompt, refsCount: result.refsCount };
}

// ── Shot individual ─────────────────────────────────────────────────────

export interface WeeklyLooksShotResult {
  imageUrl:  string;
  prompt:    string;
  refsCount: number;
  debug:     WeeklyLooksShotDebug;
}

export async function generateWeeklyLooksShot(
  shot:           PhotodumpShotDirective,
  refs:           PhotodumpRefs,
  destino:        PhotodumpDestino,
  sessionParams:  { uid?: string; sessionId?: string },
  shotIndex:      number,
  totalShots:     number,
  basePrompt?:    string,
): Promise<WeeklyLooksShotResult> {
  const plan = shot.weeklyLooksPlan;
  if (!plan) {
    throw new Error(`El shot "${shot.key}" no tiene un plan válido de weeklyLooks.`);
  }

  const config = resolveConfig(refs);

  if (plan.isAnchorShot) {
    const cached = anchorImageCache.get(cacheKey(refs));
    if (cached) {
      const manifest = buildWeeklyLooksManifest(refs);
      const rawContract = buildShotContracts(manifest)[0];
      const debug = buildShotDebug(rawContract, config.captureStyle, config.placeMode, 'weekly_look_0 (already generated as the anchor)');
      return { imageUrl: cached.imageUrl, prompt: cached.prompt, refsCount: cached.refsCount, debug };
    }
    // Red de seguridad: si por algún motivo el REF0 no se generó antes.
    return generateWeeklyLooksREF0(refs, destino, sessionParams, basePrompt).then(r => ({
      imageUrl: r.imageUrl, prompt: r.prompt, refsCount: r.refsCount,
      debug: buildShotDebug(buildShotContracts(buildWeeklyLooksManifest(refs))[0], config.captureStyle, config.placeMode, r.prompt),
    }));
  }

  const manifest = buildWeeklyLooksManifest(refs);
  const rawContracts = buildShotContracts(manifest);
  const seedKey = `${cacheKey(refs)}::${sessionParams.sessionId ?? ''}`;
  const contracts = await attachPoseAndPlace(rawContracts, config, seedKey, refs, basePrompt);
  const contract = contracts.find(c => c.shotId === plan.shotId);
  if (!contract) {
    throw new Error(`No se encontró el contrato para el shot "${plan.shotId}".`);
  }

  const anchor = buildAnchorContract(refs, manifest);
  const sceneAnchorImageUrl = config.placeMode === 'same_place' ? anchorImageCache.get(cacheKey(refs))?.imageUrl : undefined;

  return generateFromContract(contract, refs, destino, config, anchor, sessionParams, shotIndex, totalShots, sceneAnchorImageUrl);
}
