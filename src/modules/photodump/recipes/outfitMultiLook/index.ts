/**
 * recipes/outfitMultiLook/index.ts
 *
 * Punto de entrada público de la receta outfit_multi_look hacia el resto del
 * sistema (photodumpDirectorService.ts). Expone 3 funciones con la misma
 * forma que weeklyFavoritesV2/index.ts para que el Director pueda despachar
 * a esta receta sin cambiar su propio contrato hacia PhotodumpModule.tsx.
 *
 * Una sola receta, 4 intenciones (weekly, then_vs_now, trip_recap,
 * curated_ideas) — todas comparten el mismo motor salvo
 * trip_recap, que activa un modo de fondo variable (cadena de anclas) en vez
 * de una sola ancla fija reutilizada. Ver manifiesto sección 6/6bis/6ter.
 * (rate_check se eliminó julio 2026 — ver types.ts para el detalle.)
 */
import { prepareRefs, getAspectRatio } from '../shared';
import type {
  PhotodumpRefs, PhotodumpNarrative, PhotodumpProtagonist, PhotodumpDestino,
} from '../../types';
import type { PhotodumpShotDirective, PhotodumpREF0Result } from '../shared';
import { buildMultiLookManifest } from './manifest';
import { generateFixedAnchor } from './anchorFixed';
import { generateAnchorChain, getCachedAnchorChain } from './anchorChain';
import { allocateLookShots, requestedCountToLookCount } from './allocator';
import { buildShotContract, buildShotContracts } from './contracts';
import { validateShotContract } from './contractValidator';
import { routeReferences } from './referenceRouter';
import { validateRouting } from './routingValidator';
import { buildShotPrompt } from './promptBuilder';
import { buildShotDebug } from './debug';
import { applyIntelligence } from './intelligenceLayer';
import { imageApiService } from '../../../../services/imageApiService';
import type {
  MultiLookManifest, ShotContract, OutfitMultiLookShotPlan, OutfitMultiLookShotDebug,
} from './types';

// ── Caché en memoria de la ancla fija por sesión ────────────────────────
// Mismo motivo que weeklyFavoritesV2: generatePhotodumpREF0 y
// generatePhotodumpShot son llamadas separadas del Director sin un lugar
// compartido para pasarse datos — se cachea en memoria por refs.
const fixedAnchorCache = new Map<string, string>();

function fixedAnchorCacheKey(refs: PhotodumpRefs): string {
  const urls = [refs.avatarRef, refs.bodyRef, refs.sceneRef].filter(Boolean);
  return urls.join('|');
}

// El ancla ES la foto del primer look (fondo + outfit puesto en la misma
// generación) — se cachea aparte para que el shot del primer look, cuando
// llegue por generateOutfitMultiLookShot, devuelva esta imagen en vez de
// generar una segunda foto redundante del mismo look.
const firstLookImageCache = new Map<string, { lookId: string; imageUrl: string }>();

function firstLookImageCacheKey(refs: PhotodumpRefs): string {
  return fixedAnchorCacheKey(refs);
}

// ── Plan de sesión ──────────────────────────────────────────────────────

export interface OutfitMultiLookPlan {
  manifest:      MultiLookManifest;
  shotContracts: ShotContract[];
}

export async function buildOutfitMultiLookDirectives(
  refs:           PhotodumpRefs,
  requestedCount: number,
  seedKey?:       string,
): Promise<{ directives: Omit<PhotodumpShotDirective, 'arcPosition' | 'aspectRatio'>[]; plan: OutfitMultiLookPlan }> {
  const manifest = buildMultiLookManifest(refs);
  const allocation = allocateLookShots(manifest.looks, requestedCountToLookCount(requestedCount, manifest.intent));
  const shotContracts = await buildShotContracts(allocation.looksToShoot, manifest.intent, undefined, manifest.accessories, seedKey);

  const directives = shotContracts.map((contract): Omit<PhotodumpShotDirective, 'arcPosition' | 'aspectRatio'> => {
    const plan: OutfitMultiLookShotPlan = {
      shotId: contract.shotId,
      lookId: contract.look.id,
      intent: manifest.intent,
      angle:  contract.angle,
      poseAttitudeLine: contract.poseAttitudeLine,
    };
    return {
      key:                contract.shotId,
      beat:               'context',
      role:               'outfit_hero',
      purpose:            `multi_look_${manifest.intent}`,
      requiredElements:   [],
      forbiddenElements:  [],
      variationSpace:     [],
      framing:            contract.cameraGrammar.framing,
      composition:        contract.cameraGrammar.composition,
      cameraAngle:        contract.cameraGrammar.angle,
      outfitMultiLookPlan: plan,
    };
  });

  return { directives, plan: { manifest, shotContracts } };
}

// ── REF0 (foto ancla — solo aplica a fondo fijo) ────────────────────────
// Para trip_recap (fondo variable), no hay un REF0 único — el "ancla" real
// es la cadena completa, que se genera shot por shot en generateOutfitMultiLookShot.
// Acá se devuelve la primera imagen de la cadena como REF0 "legado" para que
// el Director tenga algo que mostrar de inmediato, igual que day_in_life.

export async function generateOutfitMultiLookREF0(
  refs:           PhotodumpRefs,
  narrative:      PhotodumpNarrative,
  protagonist:    PhotodumpProtagonist,
  destino:        PhotodumpDestino,
  basePrompt:     string,
  requestedCount: number,
  sessionParams:  { uid?: string; sessionId?: string },
): Promise<PhotodumpREF0Result> {
  const manifest = buildMultiLookManifest(refs);
  const requestedLookCount = requestedCountToLookCount(requestedCount, manifest.intent);

  if (manifest.backgroundMode === 'variable_per_shot') {
    const allocation = allocateLookShots(manifest.looks, requestedLookCount);
    if (allocation.looksToShoot.length === 0) {
      throw new Error('Se necesita al menos un look con lugar declarado para generar este viaje.');
    }
    const chainResult = await generateAnchorChain(
      allocation.looksToShoot, refs, narrative, protagonist, destino, basePrompt, sessionParams,
    );
    const first = chainResult.chain[0];
    return {
      imageUrl:     first.imageUrl,
      ref0Analysis: null,
      prompt:       `outfit_multi_look trip_recap anchor chain — ${chainResult.chain.length} place(s)`,
      refsCount:    1,
    };
  }

  const allocation = allocateLookShots(manifest.looks, requestedLookCount);
  const firstLook = allocation.looksToShoot[0];
  if (!firstLook) {
    throw new Error('Se necesita al menos un look para generar esta sesión.');
  }

  const result = await generateFixedAnchor(firstLook, refs, narrative, protagonist, destino, sessionParams);
  fixedAnchorCache.set(fixedAnchorCacheKey(refs), result.imageUrl);
  firstLookImageCache.set(firstLookImageCacheKey(refs), { lookId: firstLook.id, imageUrl: result.imageUrl });
  return result;
}

// ── Shot individual ─────────────────────────────────────────────────────

export interface OutfitMultiLookShotResult {
  imageUrl:  string;
  prompt:    string;
  refsCount: number;
  debug:     OutfitMultiLookShotDebug;
}

export async function generateOutfitMultiLookShot(
  shot:           PhotodumpShotDirective,
  refs:           PhotodumpRefs,
  destino:        PhotodumpDestino,
  sessionParams:  { uid?: string; sessionId?: string },
  shotIndex:      number,
  totalShots:     number,
  requestedCount: number,
  basePrompt:     string,
  narrative:      PhotodumpNarrative,
  protagonist:    PhotodumpProtagonist,
): Promise<OutfitMultiLookShotResult> {
  const manifest = buildMultiLookManifest(refs);
  const allocation = allocateLookShots(manifest.looks, requestedCountToLookCount(requestedCount, manifest.intent));

  const lookId = shot.outfitMultiLookPlan?.lookId;
  const angle  = shot.outfitMultiLookPlan?.angle ?? 'frontal';
  const look = allocation.looksToShoot.find(l => l.id === lookId);
  if (!look) {
    throw new Error(`No se encontró el look para el shot "${shot.key}". No se puede generar sin un look válido.`);
  }

  const hasAnchor = manifest.backgroundMode === 'fixed_single_anchor';
  let anchorImageUrl: string | undefined;

  if (hasAnchor) {
    // El ancla YA es la foto FRONTAL del primer look (fondo + outfit puesto,
    // generados juntos en generateFixedAnchor) — si este shot es ese mismo
    // look Y el mismo ángulo frontal, se devuelve la imagen ya generada en
    // vez de duplicarla. El shot de VARIACIÓN del primer look (curated_ideas)
    // comparte lookId pero es un ángulo distinto (trasera/lateral/detalle) —
    // debe generarse de verdad, nunca reusar el ancla. Bug real: sin el
    // chequeo de angle acá, el shot de variación del look 0 devolvía la
    // misma imagen frontal dos veces (visto en producción — 2 fotos
    // idénticas del mismo vestido en vez de frontal + trasera).
    const cachedFirstLook = firstLookImageCache.get(firstLookImageCacheKey(refs));
    if (cachedFirstLook && cachedFirstLook.lookId === look.id && angle === 'frontal') {
      const debug = buildShotDebug(
        { shotId: shot.key, look, referencePolicy: { useIdentityRef: true, useBodyRef: true, useAnchorRef: false, activeLookRef: look.refUrl }, cameraGrammar: { framing: 'MEDIUM_FULL', angle: 'eye_level', composition: 'mirror_selfie' }, poseIntensity: 'neutral', angle: 'frontal' },
        { orderedUrls: [cachedFirstLook.imageUrl], breakdown: { look: [cachedFirstLook.imageUrl] } },
        'first look (already generated as the set anchor)',
        { passed: true, errors: [] },
        { passed: true, errors: [] },
      );
      return { imageUrl: cachedFirstLook.imageUrl, prompt: 'multi_look anchor (first look)', refsCount: 1, debug };
    }

    anchorImageUrl = fixedAnchorCache.get(fixedAnchorCacheKey(refs));
    if (!anchorImageUrl) {
      // Red de seguridad: si por algún motivo el REF0 no se generó antes
      // (llamada fuera de orden), se genera acá.
      const result = await generateFixedAnchor(look, refs, narrative, protagonist, destino, sessionParams);
      anchorImageUrl = result.imageUrl;
      fixedAnchorCache.set(fixedAnchorCacheKey(refs), anchorImageUrl);
      firstLookImageCache.set(firstLookImageCacheKey(refs), { lookId: look.id, imageUrl: anchorImageUrl });
      const debug = buildShotDebug(
        { shotId: shot.key, look, referencePolicy: { useIdentityRef: true, useBodyRef: true, useAnchorRef: false, activeLookRef: look.refUrl }, cameraGrammar: { framing: 'MEDIUM_FULL', angle: 'eye_level', composition: 'mirror_selfie' }, poseIntensity: 'neutral', angle: 'frontal' },
        { orderedUrls: [anchorImageUrl], breakdown: { look: [anchorImageUrl] } },
        result.prompt,
        { passed: true, errors: [] },
        { passed: true, errors: [] },
      );
      return { imageUrl: anchorImageUrl, prompt: result.prompt, refsCount: result.refsCount, debug };
    }
  } else {
    let chain = getCachedAnchorChain(refs, basePrompt);
    if (!chain) {
      chain = await generateAnchorChain(allocation.looksToShoot, refs, narrative, protagonist, destino, basePrompt, sessionParams);
    }
    const link = chain.chain.find(c => c.lookId === look.id);
    anchorImageUrl = link?.imageUrl;
    if (!anchorImageUrl) {
      throw new Error(`No se encontró la imagen de ancla para el look "${look.id}" en la cadena de trip_recap.`);
    }
    // trip_recap: la imagen de este eslabón YA es el resultado final del shot
    // (se generó con el outfit puesto en anchorChain.ts) — no hace falta
    // volver a generar, se devuelve directamente.
    const debug = buildShotDebug(
      { shotId: shot.key, look, referencePolicy: { useIdentityRef: true, useBodyRef: true, useAnchorRef: false, activeLookRef: look.refUrl }, cameraGrammar: { framing: 'MEDIUM_FULL', angle: 'eye_level', composition: 'candid_off_center' }, poseIntensity: 'neutral', angle: 'frontal' },
      { orderedUrls: [anchorImageUrl], breakdown: { look: [anchorImageUrl] } },
      'trip_recap link (already generated in chain)',
      { passed: true, errors: [] },
      { passed: true, errors: [] },
    );
    return { imageUrl: anchorImageUrl, prompt: 'trip_recap chain link', refsCount: 1, debug };
  }

  // poseAttitudeLine ya se resolvió UNA vez en buildOutfitMultiLookDirectives
  // (ver contracts.ts) y viaja en el plan guardado — nunca se repite la
  // llamada de red al generar la imagen real.
  const contract = buildShotContract(look, manifest.intent, angle, undefined, manifest.accessories, shot.outfitMultiLookPlan?.poseAttitudeLine);

  const contractValidation = validateShotContract(contract, manifest.intent);
  if (!contractValidation.passed) {
    throw new Error(`El look "${look.id}" no pasó la validación de reglas: ${contractValidation.errors.join(' | ')}`);
  }

  const routed = routeReferences(contract, refs, anchorImageUrl);
  const routingValidation = validateRouting(contract, routed);
  if (!routingValidation.passed) {
    throw new Error(`El look "${look.id}" no pasó la validación de referencias: ${routingValidation.errors.join(' | ')}`);
  }

  const intelligence = applyIntelligence(contract, refs.gender ?? 'female');
  const { prompt, negative } = buildShotPrompt(contract, manifest.intent, hasAnchor, intelligence);
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
    metadata:        { role: 'MULTI_LOOK_SHOT', intent: manifest.intent, lookId: look.id, era: look.era },
  });

  const debug = buildShotDebug(contract, routed, prompt, contractValidation, routingValidation);

  return { imageUrl, prompt, refsCount: preparedRefs.length, debug };
}
