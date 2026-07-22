/**
 * recipes/outfitRevealBasic/index.ts
 *
 * Punto de entrada público de la receta outfit_reveal_basic hacia el resto
 * del sistema (photodumpDirectorService.ts). Expone 3 funciones con la misma
 * forma que outfitMultiLook/index.ts.
 *
 * Shot 1 (mirror_check) es fijo: cumple doble función de ancla
 * (identidad/cuerpo/cuarto) y primer shot publicable — se genera una sola
 * vez y se reusa como REF0 "legado" para el resto del pipeline. Shots 2 y 3
 * son variaciones elegidas del banco de renderVariants.ts, fijadas UNA VEZ
 * en buildOutfitRevealBasicDirectives() y transportadas en el plan — nunca
 * recalculadas, para que el plan y la generación real siempre coincidan.
 */
import { prepareRefs, getAspectRatio } from '../shared';
import type {
  PhotodumpRefs, PhotodumpDestino,
} from '../../types';
import type { PhotodumpShotDirective, PhotodumpREF0Result } from '../shared';
import { buildShotContracts, buildMirrorCheckContract, buildVariationContract } from './contracts';
import { routeReferences } from './referenceRouter';
import { validateRouting } from './routingValidator';
import { buildShotPrompt } from './promptBuilder';
import { buildShotDebug } from './debug';
import { applyIntelligence } from './intelligenceLayer';
import { imageApiService } from '../../../../services/imageApiService';
import type { OutfitRevealBasicShotPlan, OutfitRevealBasicShotDebug, ShotContract } from './types';

// ── Caché en memoria del shot mirror_check por sesión ───────────────────
// Mismo motivo que outfitMultiLook: generatePhotodumpREF0 y
// generatePhotodumpShot son llamadas separadas del Director sin un lugar
// compartido para pasarse datos — se cachea en memoria por refs.
const mirrorCheckCache = new Map<string, { imageUrl: string; prompt: string; refsCount: number }>();

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
  sessionParams: { uid?: string; sessionId?: string },
  shotIndex:     number,
  totalShots:    number,
): Promise<{ imageUrl: string; prompt: string; refsCount: number; debug: OutfitRevealBasicShotDebug }> {
  const routed   = routeReferences(contract, refs);
  const routingValidation = validateRouting(contract, routed);
  if (!routingValidation.passed) {
    throw new Error(`El shot "${contract.shotId}" no pasó la validación de referencias: ${routingValidation.errors.join(' | ')}`);
  }

  const intelligence = applyIntelligence(contract.poseFamily, contract.variantIndex, refs.gender ?? 'female');
  const { prompt, negative } = buildShotPrompt(contract.shotId, contract.variantIndex, garmentCountFor(refs), intelligence);
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
    metadata:        { role: 'OUTFIT_REVEAL_BASIC_SHOT', shotId: contract.shotId, variantIndex: contract.variantIndex },
  });

  const debug = buildShotDebug(contract, routed, prompt, routingValidation);
  return { imageUrl, prompt, refsCount: preparedRefs.length, debug };
}

// ── Plan de sesión ──────────────────────────────────────────────────────

function seedFor(refs: PhotodumpRefs): string {
  return cacheKey(refs);
}

export function buildOutfitRevealBasicDirectives(refs: PhotodumpRefs): Omit<PhotodumpShotDirective, 'arcPosition' | 'aspectRatio'>[] {
  const contracts = buildShotContracts(seedFor(refs));
  return contracts.map((contract): Omit<PhotodumpShotDirective, 'arcPosition' | 'aspectRatio'> => {
    const plan: OutfitRevealBasicShotPlan = { shotId: contract.shotId, variantIndex: contract.variantIndex };
    return {
      key:                contract.shotId,
      beat:               'reveal',
      role:               'outfit_hero',
      purpose:            `outfit_reveal_basic_${contract.shotId}`,
      requiredElements:   [],
      forbiddenElements:  [],
      variationSpace:     [],
      framing:            contract.cameraGrammar.framing,
      composition:        contract.cameraGrammar.composition,
      cameraAngle:        contract.cameraGrammar.angle,
      outfitRevealBasicPlan: plan,
    };
  });
}

// ── REF0 (mirror_check hace doble función de ancla) ─────────────────────

export async function generateOutfitRevealBasicREF0(
  refs:           PhotodumpRefs,
  destino:        PhotodumpDestino,
  sessionParams:  { uid?: string; sessionId?: string },
): Promise<PhotodumpREF0Result> {
  const result = await generateFromContract(buildMirrorCheckContract(), refs, destino, sessionParams, 0, 3);
  mirrorCheckCache.set(cacheKey(refs), result);
  return { imageUrl: result.imageUrl, ref0Analysis: null, prompt: result.prompt, refsCount: result.refsCount };
}

// ── Shot individual ─────────────────────────────────────────────────────

export interface OutfitRevealBasicShotResult {
  imageUrl:  string;
  prompt:    string;
  refsCount: number;
  debug:     OutfitRevealBasicShotDebug;
}

export async function generateOutfitRevealBasicShot(
  shot:           PhotodumpShotDirective,
  refs:           PhotodumpRefs,
  destino:        PhotodumpDestino,
  sessionParams:  { uid?: string; sessionId?: string },
  shotIndex:      number,
  totalShots:     number,
): Promise<OutfitRevealBasicShotResult> {
  const shotId = shot.outfitRevealBasicPlan?.shotId;
  if (!shotId) {
    throw new Error(`El shot "${shot.key}" no tiene un shotId válido de outfit_reveal_basic.`);
  }

  if (shotId === 'mirror_check') {
    const cached = mirrorCheckCache.get(cacheKey(refs));
    if (cached) {
      const debug = buildShotDebug(
        buildMirrorCheckContract(),
        { orderedUrls: [], breakdown: { outfits: [] } },
        'mirror_check (already generated as the anchor)',
        { passed: true, errors: [] },
      );
      return { imageUrl: cached.imageUrl, prompt: cached.prompt, refsCount: cached.refsCount, debug };
    }
    // Red de seguridad: si por algún motivo el REF0 no se generó antes.
    const result = await generateFromContract(buildMirrorCheckContract(), refs, destino, sessionParams, shotIndex, totalShots);
    mirrorCheckCache.set(cacheKey(refs), result);
    return result;
  }

  const variantIndex = shot.outfitRevealBasicPlan?.variantIndex ?? 0;
  const contract = buildVariationContract(shotId, variantIndex);
  return generateFromContract(contract, refs, destino, sessionParams, shotIndex, totalShots);
}
