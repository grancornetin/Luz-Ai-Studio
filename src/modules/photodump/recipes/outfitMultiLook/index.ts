/**
 * recipes/outfitMultiLook/index.ts
 *
 * Punto de entrada público de la receta outfit_multi_look hacia el resto del
 * sistema (photodumpDirectorService.ts). Expone 3 funciones con la misma
 * forma que weeklyFavoritesV2/index.ts para que el Director pueda despachar
 * a esta receta sin cambiar su propio contrato hacia PhotodumpModule.tsx.
 *
 * Una sola receta, 5 intenciones (weekly, then_vs_now, rate_check,
 * trip_recap, curated_ideas) — todas comparten el mismo motor salvo
 * trip_recap, que activa un modo de fondo variable (cadena de anclas) en vez
 * de una sola ancla fija reutilizada. Ver manifiesto sección 6/6bis/6ter.
 */
import { prepareRefs, getAspectRatio } from '../shared';
import type {
  PhotodumpRefs, PhotodumpNarrative, PhotodumpProtagonist, PhotodumpDestino,
} from '../../types';
import type { PhotodumpShotDirective, PhotodumpREF0Result } from '../shared';
import { buildMultiLookManifest } from './manifest';
import { generateFixedAnchor } from './anchorFixed';
import { generateAnchorChain, getCachedAnchorChain } from './anchorChain';
import { allocateLookShots } from './allocator';
import { buildShotContracts } from './contracts';
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

// ── Plan de sesión ──────────────────────────────────────────────────────

export interface OutfitMultiLookPlan {
  manifest:      MultiLookManifest;
  shotContracts: ShotContract[];
}

export function buildOutfitMultiLookDirectives(
  refs:           PhotodumpRefs,
  requestedCount: number,
): { directives: Omit<PhotodumpShotDirective, 'arcPosition' | 'aspectRatio'>[]; plan: OutfitMultiLookPlan } {
  const manifest = buildMultiLookManifest(refs);
  const allocation = allocateLookShots(manifest.looks, requestedCount);
  const shotContracts = buildShotContracts(allocation.looksToShoot, manifest.intent);

  const directives = shotContracts.map((contract): Omit<PhotodumpShotDirective, 'arcPosition' | 'aspectRatio'> => {
    const plan: OutfitMultiLookShotPlan = {
      shotId: contract.shotId,
      lookId: contract.look.id,
      intent: manifest.intent,
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

  if (manifest.backgroundMode === 'variable_per_shot') {
    const allocation = allocateLookShots(manifest.looks, requestedCount);
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

  const result = await generateFixedAnchor(refs, narrative, protagonist, destino, sessionParams);
  fixedAnchorCache.set(fixedAnchorCacheKey(refs), result.imageUrl);
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
  const allocation = allocateLookShots(manifest.looks, requestedCount);

  const lookId = shot.outfitMultiLookPlan?.lookId;
  const look = allocation.looksToShoot.find(l => l.id === lookId);
  if (!look) {
    throw new Error(`No se encontró el look para el shot "${shot.key}". No se puede generar sin un look válido.`);
  }

  const hasAnchor = manifest.backgroundMode === 'fixed_single_anchor';
  let anchorImageUrl: string | undefined;

  if (hasAnchor) {
    anchorImageUrl = fixedAnchorCache.get(fixedAnchorCacheKey(refs));
    if (!anchorImageUrl) {
      // Red de seguridad: si por algún motivo el REF0 no se generó antes
      // (llamada fuera de orden), se genera acá.
      const result = await generateFixedAnchor(refs, narrative, protagonist, destino, sessionParams);
      anchorImageUrl = result.imageUrl;
      fixedAnchorCache.set(fixedAnchorCacheKey(refs), anchorImageUrl);
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
      { shotId: shot.key, look, referencePolicy: { useIdentityRef: true, useBodyRef: true, useAnchorRef: false, activeLookRef: look.refUrl }, cameraGrammar: { framing: 'MEDIUM_FULL', angle: 'eye_level', composition: 'candid_off_center' }, poseIntensity: 'neutral' },
      { orderedUrls: [anchorImageUrl], breakdown: { look: [anchorImageUrl] } },
      'trip_recap link (already generated in chain)',
      { passed: true, errors: [] },
      { passed: true, errors: [] },
    );
    return { imageUrl: anchorImageUrl, prompt: 'trip_recap chain link', refsCount: 1, debug };
  }

  const contract = buildShotContracts([look], manifest.intent)[0];

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
