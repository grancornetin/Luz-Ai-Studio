/**
 * recipes/weeklyFavoritesV2/index.ts
 *
 * Punto de entrada público de la receta weeklyFavoritesV2 hacia el resto del
 * sistema (photodumpDirectorService.ts). Expone 3 funciones con la misma
 * forma que outfitWeek.ts para que el Director pueda despachar a esta
 * receta sin cambiar su propio contrato hacia PhotodumpModule.tsx.
 *
 * No copia lógica de outfitWeek.ts — arma todo desde el flujo propio:
 * Manifest → Ancla → Reparto → Contratos → Validación de contrato →
 * Enrutamiento → Validación de enrutamiento → Texto de instrucciones →
 * Generación → Diagnóstico.
 */
import { imageApiService } from '../../../../services/imageApiService';
import { prepareRefs, getAspectRatio, NEGATIVE_SHORT } from '../shared';
import type {
  PhotodumpRefs, PhotodumpNarrative, PhotodumpProtagonist, PhotodumpDestino,
} from '../../types';
import type { PhotodumpShotDirective, PhotodumpREF0Result } from '../shared';
import { buildWeeklyFavoritesV2Manifest } from './manifest';
import { buildAnchorContract } from './anchor';
import { geminiStyleDetector } from './styleDetector';
import { allocateShots } from './allocator';
import { buildShotContracts } from './contracts';
import { validateShotContract } from './contractValidator';
import { routeReferences } from './referenceRouter';
import { validateRouting } from './routingValidator';
import { buildShotPrompt } from './promptBuilder';
import { buildShotDebug } from './debug';
import { applyIntelligence } from './intelligenceLayer';
import { fetchOutfitCheckPoseCandidates, pickOneCandidate, buildPoseAttitudeLine } from '../outfitCheck/poseClient';
import type {
  AnchorContract, WeeklyManifestV2, ShotContract, WeeklyFavoritesV2ShotPlan, WeeklyV2ShotDebug,
} from './types';

// ── Caché en memoria de la foto ancla por sesión ────────────────────────
// generatePhotodumpREF0 y generatePhotodumpShot son dos llamadas separadas
// que el Director invoca en momentos distintos (ver photodumpDirectorService.ts),
// sin un lugar compartido para pasarse datos entre sí sin cambiar la firma
// pública que usa PhotodumpModule.tsx. Como el resultado de la foto ancla
// depende únicamente de las referencias subidas (nunca cambia dentro de la
// misma sesión de generación), se cachea en memoria usando esas referencias
// como clave — así la detección de estilo por IA se ejecuta una sola vez
// por sesión, no una vez por cada foto.
const anchorCache = new Map<string, AnchorContract>();

function anchorCacheKey(refs: PhotodumpRefs): string {
  const urls = [
    refs.avatarRef, refs.bodyRef, refs.sceneRef, refs.outfitRef,
    ...(refs.outfitRefs ?? []), ...(refs.accesorioRefs ?? []),
    refs.productRef, ...(refs.productRefs ?? []),
  ].filter(Boolean);
  return `${urls.join('|')}::${refs.avatarHasDefinitiveOutfit ? 'base' : 'auto'}`;
}

// ── Caché en memoria de poses citadas del banco (sep 2026, desconexión de
// HPI) ────────────────────────────────────────────────────────────────────
// outfit_hero/outfit_integrated (persona con el outfit puesto, encuadre
// person_centered — NO es mirror selfie, a diferencia de outfit_multi_look/
// outfit_reveal_basic) dependían 100% de HPI para la dirección de pose —
// sin ningún texto escrito a mano de respaldo. HPI elegía libremente entre
// las 28 familias de poseBanks sin ningún filtro de compatibilidad con este
// encuadre (mismo tipo de bug ya confirmado en outfitMultiLook: familias
// "seated"/"reclined" mezclándose con un plano de pie). Reemplazado por
// pose real citada del banco (fetchOutfitCheckPoseCandidates, shot_type
// full_body+medio_cuerpo — 370 candidatos reales verificados), UNA sola
// llamada de red por sesión (mismo motivo que anchorCache: el contract se
// reconstruye por cada shot en generateWeeklyFavoritesV2Shot, así que sin
// este caché la llamada se repetiría por foto).
const poseAttitudeCache = new Map<string, Record<string, string | undefined>>();

const WEEKLY_POSE_SHOT_TYPES = ['full_body', 'medio_cuerpo'];
const POSE_ELIGIBLE_ROLES = new Set(['outfit_hero', 'outfit_integrated']);

async function attachPoseAttitudes(contracts: ShotContract[], seedKey: string): Promise<ShotContract[]> {
  const eligible = contracts.filter(c => POSE_ELIGIBLE_ROLES.has(c.role));
  if (eligible.length === 0) return contracts;

  let byShotId = poseAttitudeCache.get(seedKey);
  if (!byShotId) {
    const candidatesByType = await fetchOutfitCheckPoseCandidates(WEEKLY_POSE_SHOT_TYPES, seedKey, 8);
    const pooled = WEEKLY_POSE_SHOT_TYPES.flatMap(t => candidatesByType[t] ?? []);
    byShotId = {};
    for (const contract of eligible) {
      const chosen = pickOneCandidate(pooled, `${seedKey}::${contract.shotId}`);
      byShotId[contract.shotId] = buildPoseAttitudeLine(chosen) || undefined;
    }
    poseAttitudeCache.set(seedKey, byShotId);
  }

  return contracts.map(c => POSE_ELIGIBLE_ROLES.has(c.role)
    ? { ...c, poseAttitudeLine: byShotId![c.shotId] }
    : c);
}

// ── Plan de sesión ──────────────────────────────────────────────────────
// Construye el catálogo y el reparto de fotos, y expone ambos junto a las
// directivas mínimas que espera PhotodumpShotDirective.

export interface WeeklyFavoritesV2Plan {
  manifest:      WeeklyManifestV2;
  shotContracts: ShotContract[];
}

export async function buildWeeklyFavoritesV2Directives(
  refs:            PhotodumpRefs,
  requestedCount:  number,
  anchor:          AnchorContract,
  sessionId?:      string,
): Promise<{ directives: Omit<PhotodumpShotDirective, 'arcPosition' | 'aspectRatio'>[]; plan: WeeklyFavoritesV2Plan }> {
  const manifest = buildWeeklyFavoritesV2Manifest(refs);
  const allocation = allocateShots(manifest, requestedCount);
  const rawContracts = buildShotContracts(allocation.shots, anchor, allocation.itemCoverageLevel, manifest.items);
  const shotContracts = await attachPoseAttitudes(rawContracts, `${anchorCacheKey(refs)}::${sessionId ?? ''}`);

  const directives = shotContracts.map((contract): Omit<PhotodumpShotDirective, 'arcPosition' | 'aspectRatio'> => {
    const plan: WeeklyFavoritesV2ShotPlan = {
      shotId:           contract.shotId,
      role:             contract.role,
      activeItemId:      contract.activeItem?.id ?? null,
      secondaryItemIds:  contract.secondaryItems.map(it => it.id),
      coverageLevel:     contract.coverageLevel,
    };
    return {
      key:               contract.shotId,
      beat:              'context',
      role:              contract.role,
      purpose:           contract.role,
      requiredElements:  [],
      forbiddenElements: contract.forbiddenItems.map(it => it.label),
      variationSpace:    [],
      framing:           contract.cameraGrammar.framing,
      composition:       contract.cameraGrammar.composition,
      cameraAngle:       contract.cameraGrammar.angle,
      weeklyFavoritesV2Plan: plan,
    };
  });

  return { directives, plan: { manifest, shotContracts } };
}

// ── REF0 (foto ancla) ───────────────────────────────────────────────────

export async function generateWeeklyFavoritesV2REF0(
  refs:           PhotodumpRefs,
  narrative:      PhotodumpNarrative,
  protagonist:    PhotodumpProtagonist,
  destino:        PhotodumpDestino,
  basePrompt:     string,
  sessionParams:  { uid?: string; sessionId?: string },
): Promise<PhotodumpREF0Result & { anchor: AnchorContract }> {
  const mainRef = refs.avatarRef ?? refs.bodyRef ?? refs.sceneRef ?? refs.productRef ?? refs.outfitRef;
  if (!mainRef) throw new Error('Se necesita al menos una referencia para generar el ancla visual.');

  const manifest = buildWeeklyFavoritesV2Manifest(refs);
  const anchor = await buildAnchorContract(refs, manifest, geminiStyleDetector);
  anchorCache.set(anchorCacheKey(refs), anchor);

  const anchorLine = (() => {
    switch (anchor.mode) {
      case 'person_with_explicit_base_outfit':
        return 'The person wears the exact outfit shown in their reference photo — do not change it.';
      case 'person_with_style_matched_outfit':
        return `The person wears a new, generic outfit matching this style: ${anchor.styleDetection?.styleDescription || 'a consistent style inferred from the uploaded references'}. Do not copy any specific garment from the reference images.`;
      case 'person_with_safe_fallback_outfit':
        return 'The person wears a simple, neutral everyday outfit.';
      case 'world_only':
      default:
        return 'Environment and lighting only, no person in frame.';
    }
  })();

  const refsToPass: (string | null)[] = [
    anchor.identityRefUrl ?? null,
    anchor.bodyRefUrl ?? null,
    anchor.sceneRefUrl ?? null,
  ].filter(Boolean) as string[] as (string | null)[];

  const aspectInstr = getAspectRatio(destino);
  const prompt = `ANCHOR SHOT — establishes identity, body, lighting, room and mood for the entire set.
${anchorLine}
Natural iPhone quality. Candid UGC feel. One photo, not a collage.`;

  const preparedRefs = await prepareRefs(refsToPass as string[]);
  const imageUrl = await imageApiService.generateImage({
    prompt,
    negative:        NEGATIVE_SHORT,
    referenceImages: preparedRefs,
    aspectRatio:     aspectInstr,
    modelId:         'gemini',
    uid:             sessionParams.uid,
    sessionId:       sessionParams.sessionId,
    module:          'photodump',
    moduleLabel:     'Photodump Mode',
    shotIndex:       0,
    totalShots:      1,
    metadata:        { role: 'REF0_ANCHOR_V2', narrative, protagonist, anchorMode: anchor.mode },
  });

  return {
    imageUrl,
    ref0Analysis: null,
    prompt,
    refsCount: preparedRefs.length,
    anchor,
  };
}

// ── Shot individual ─────────────────────────────────────────────────────

export interface WeeklyFavoritesV2ShotResult {
  imageUrl:  string;
  prompt:    string;
  refsCount: number;
  debug:     WeeklyV2ShotDebug;
}

export async function generateWeeklyFavoritesV2Shot(
  shot:           PhotodumpShotDirective,
  refs:           PhotodumpRefs,
  destino:        PhotodumpDestino,
  sessionParams:  { uid?: string; sessionId?: string },
  shotIndex:      number,
  totalShots:     number,
  requestedCount: number,
): Promise<WeeklyFavoritesV2ShotResult> {
  // La foto ancla ya se calculó (y guardó en caché) al generar REF0 para esta
  // misma sesión — si por algún motivo no está disponible (llamada fuera de
  // orden, sesión distinta), se reconstruye aquí como red de seguridad.
  let anchor = anchorCache.get(anchorCacheKey(refs));
  if (!anchor) {
    const manifestForAnchor = buildWeeklyFavoritesV2Manifest(refs);
    anchor = await buildAnchorContract(refs, manifestForAnchor, geminiStyleDetector);
    anchorCache.set(anchorCacheKey(refs), anchor);
  }

  // El plan de contratos depende solo de refs + requestedCount + anchor —
  // reconstruirlo por cada shot es barato (sin llamadas a IA, salvo la
  // primera vez: attachPoseAttitudes cachea por seedKey, ver
  // poseAttitudeCache arriba) y evita tener que pasar el plan completo a
  // través de la cadena del Director.
  const { plan } = await buildWeeklyFavoritesV2Directives(refs, requestedCount, anchor, sessionParams.sessionId);

  const contract = plan.shotContracts.find(c => c.shotId === shot.key);
  if (!contract) {
    throw new Error(`No se encontró el contrato para la foto "${shot.key}". No se puede generar sin un contrato válido.`);
  }

  const contractValidation = validateShotContract(contract);
  if (!contractValidation.passed) {
    throw new Error(`La foto "${contract.shotId}" (rol: ${contract.role}) no pasó la validación de reglas: ${contractValidation.errors.join(' | ')}`);
  }

  const routed = routeReferences(contract.referencePolicy, anchor);
  const routingValidation = validateRouting(contract, routed);
  if (!routingValidation.passed) {
    throw new Error(`La foto "${contract.shotId}" (rol: ${contract.role}) no pasó la validación de referencias: ${routingValidation.errors.join(' | ')}`);
  }

  const intelligence = applyIntelligence(contract, refs.gender ?? 'female');
  const { prompt, negative } = buildShotPrompt(contract, anchor, routed, intelligence);
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
    metadata:        { role: contract.role, shotId: contract.shotId },
  });

  const debug = buildShotDebug(contract, routed, prompt, contractValidation, routingValidation);

  return { imageUrl, prompt, refsCount: preparedRefs.length, debug };
}
