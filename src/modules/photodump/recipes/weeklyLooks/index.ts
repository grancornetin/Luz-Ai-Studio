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
import { runWeeklyLooksDirector, type WeeklyLooksDirectorShot } from './directorAdapter';
import type {
  AnchorContract, ShotContract, WeeklyLooksShotPlan, WeeklyLooksShotDebug,
  CaptureStyle, PlaceMode, WeeklyLooksConfig, WeeklyLooksManifest,
} from './types';

// ── Config por defecto (fase de prueba: sin UI final todavía) ─────────────
const DEFAULT_CONFIG: WeeklyLooksConfig = { captureStyle: 'mirror_selfie', placeMode: 'varied_place' };

function resolveConfig(refs: PhotodumpRefs): WeeklyLooksConfig {
  return refs.weeklyLooksConfig ?? DEFAULT_CONFIG;
}

// ── Director Creativo (sep 2026) ────────────────────────────────────────
// Intento ÚNICO por sesión, cacheado — buildWeeklyLooksDirectives/
// generate...REF0/generate...Shot son llamadas separadas del Director de
// arriba (photodumpDirectorService.ts) sin estado compartido, mismo motivo
// que el resto de los cachés de este archivo. null = el Director falló (o
// nunca se intentó, ej. sin API key/timeout) — el caller cae al motor de
// texto fijo sin romper la generación, mismo principio de fallback
// no-negociable que ya usa outfit_check.
const directorShotsCache = new Map<string, WeeklyLooksDirectorShot[] | null>();

async function resolveDirectorShots(
  refs:       PhotodumpRefs,
  manifest:   WeeklyLooksManifest,
  config:     WeeklyLooksConfig,
  basePrompt: string,
  seedKey:    string,
): Promise<WeeklyLooksDirectorShot[] | null> {
  if (directorShotsCache.has(seedKey)) return directorShotsCache.get(seedKey)!;
  try {
    const shots = await runWeeklyLooksDirector(refs, manifest, basePrompt, config.captureStyle, config.placeMode);
    directorShotsCache.set(seedKey, shots);
    return shots;
  } catch (err) {
    console.warn('[weeklyLooks] Director Creativo falló, cayendo al motor de texto fijo:', err);
    directorShotsCache.set(seedKey, null);
    return null;
  }
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
  // Director Creativo (ver directorAdapter.ts): si viene, se usa TAL CUAL
  // como prompt final — saltea buildShotPrompt del motor de texto fijo.
  // Las referencias (routeReferences) siguen resolviéndose igual en ambos
  // casos — el Director nunca decide qué outfit/imagen citar, solo texto.
  directorFinalPrompt?: string,
): Promise<{ imageUrl: string; prompt: string; refsCount: number; debug: WeeklyLooksShotDebug }> {
  const routed = routeReferences(contract, refs, sceneAnchorImageUrl);
  const { prompt: builtPrompt, negative } = buildShotPrompt(contract, anchor, config.captureStyle, config.placeMode);
  const basePromptForShot = directorFinalPrompt ?? builtPrompt;

  // same_place, shot NO ancla: la última referencia de imagen es la foto ya
  // generada del shot ancla — se pasa SOLO para fijar el lugar/fondo. Pero
  // esa imagen también muestra el outfit del shot 1, y sin una instrucción
  // explícita el modelo mezcla ese outfit con el de este look (bug real
  // confirmado prueba 6 sep 2026: shot 2 con outfits mezclados; shot 3 en
  // otro lugar porque el texto de continuidad era vago). Este bloque nombra
  // qué ES cada referencia y qué ignorar de la del lugar.
  const sceneVsOutfitLine = sceneAnchorImageUrl
    ? `REFERENCE IMAGES — READ CAREFULLY: the LAST reference image is a photo of the EXACT SAME PLACE this shot happens in. Use it ONLY to copy the location: the same walls, floor, furniture, fixtures, architecture and lighting — this shot must look like it was taken in that identical spot, same angle of the room, nothing invented. IGNORE completely the outfit, clothes, shoes, pose, body position and framing shown in that place photo — those belong to a different day. The outfit for THIS shot comes exclusively from the OTHER reference images (the person and the garment references) and the pose comes from the text below. Do not blend the two outfits; do not carry any clothing item from the place photo into this shot.\n\n`
    : '';
  const prompt = `${sceneVsOutfitLine}${basePromptForShot}`;
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

  // Director Creativo primero (ver directorAdapter.ts) — si tiene éxito,
  // cada contrato lleva su directorFinalPrompt ya redactado; si falla,
  // directorShots queda null y el resto del flujo sigue exactamente igual
  // que antes de esta migración (motor de texto fijo). Con el Director
  // activo se salta attachPoseAndPlace por completo — pose/lugar ya los
  // resolvió el Director razonando, llamarlo igual sería una llamada de
  // red desperdiciada (mismo principio que el fix de "no pedir poses del
  // banco al arco legado si el Director tuvo éxito" en outfit_check).
  const directorShots = await resolveDirectorShots(refs, manifest, config, basePrompt ?? '', seedKey);
  const directorByLookId = new Map((directorShots ?? []).map(s => [s.lookItemId, s]));

  const contracts = directorShots
    ? rawContracts
    : await attachPoseAndPlace(rawContracts, config, seedKey, refs, basePrompt);

  return contracts.map((contract): Omit<PhotodumpShotDirective, 'arcPosition' | 'aspectRatio'> => {
    const directorShot = directorByLookId.get(contract.lookItem.id);
    const plan: WeeklyLooksShotPlan = {
      shotId:       contract.shotId,
      lookItemId:    contract.lookItem.id,
      isAnchorShot:  contract.isAnchorShot,
      directorFinalPrompt: directorShot?.finalPrompt,
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
  const directorShots = await resolveDirectorShots(refs, manifest, config, basePrompt ?? '', seedKey);
  const [contract] = directorShots
    ? [rawContract]
    : await attachPoseAndPlace([rawContract], config, seedKey, refs, basePrompt);
  const directorFinalPrompt = directorShots?.find(s => s.lookItemId === contract.lookItem.id)?.finalPrompt;

  // same_place con lugar subido por el usuario: reusa el slot genérico
  // "Escena" (refs.sceneRef) — mismo slot que trip_recap/outfit_check ya
  // usan para "subí una foto real del lugar" — en vez de un campo de
  // subida propio (fase de prueba: menos UI nueva, mismo slot conocido).
  // Si no subió nada, se pasa undefined y el lugar se GENERA en este mismo
  // shot (ver anchorOutfitLine/placeLine en promptBuilder.ts). Con Director
  // activo y same_place, el lugar SIEMPRE se genera acá (nunca lo redacta
  // el Director en texto, ver directorContract.ts) salvo que el usuario
  // haya subido su propio lugar.
  const uploadedPlace = config.placeMode === 'same_place' ? (refs.sceneRef ?? undefined) : undefined;

  const result = await generateFromContract(contract, refs, destino, config, anchor, sessionParams, 0, manifest.items.length, uploadedPlace, directorFinalPrompt);
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
  // plan.directorFinalPrompt (resuelto en buildWeeklyLooksDirectives) ya
  // indica si el Director tuvo éxito para este shot — si vino, no hace
  // falta attachPoseAndPlace (pose/lugar de texto fijo nunca se usan).
  const contracts = plan.directorFinalPrompt
    ? rawContracts
    : await attachPoseAndPlace(rawContracts, config, seedKey, refs, basePrompt);
  const contract = contracts.find(c => c.shotId === plan.shotId);
  if (!contract) {
    throw new Error(`No se encontró el contrato para el shot "${plan.shotId}".`);
  }

  const anchor = buildAnchorContract(refs, manifest);
  const sceneAnchorImageUrl = config.placeMode === 'same_place' ? anchorImageCache.get(cacheKey(refs))?.imageUrl : undefined;

  // plan.directorFinalPrompt ya viene resuelto desde buildWeeklyLooksDirectives
  // (el Director corre UNA vez por sesión, cacheado por seedKey) — nunca se
  // vuelve a llamar acá.
  return generateFromContract(contract, refs, destino, config, anchor, sessionParams, shotIndex, totalShots, sceneAnchorImageUrl, plan.directorFinalPrompt);
}
