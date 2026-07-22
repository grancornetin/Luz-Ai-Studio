/**
 * recipes/outfitRevealBasic/index.ts
 *
 * Punto de entrada público de la receta outfit_reveal_basic hacia el resto
 * del sistema (photodumpDirectorService.ts). Expone 3 funciones con la misma
 * forma que outfitMultiLook/index.ts.
 *
 * A diferencia de outfit_multi_look, acá SIEMPRE son los mismos 3 shots fijos
 * (mirror_check, self_pov, close_detail) — no hay looks que repartir ni
 * intenciones que elegir. El shot mirror_check cumple doble función: ancla
 * (identidad/cuerpo/cuarto) y primer shot publicable — se genera una sola vez
 * y se reusa como REF0 "legado" para el resto del pipeline.
 */
import { prepareRefs, getAspectRatio } from '../shared';
import type {
  PhotodumpRefs, PhotodumpDestino,
} from '../../types';
import type { PhotodumpShotDirective, PhotodumpREF0Result } from '../shared';
import { buildShotContracts, buildShotContract } from './contracts';
import { routeReferences } from './referenceRouter';
import { validateRouting } from './routingValidator';
import { buildShotPrompt } from './promptBuilder';
import { buildShotDebug } from './debug';
import { applyIntelligence } from './intelligenceLayer';
import { imageApiService } from '../../../../services/imageApiService';
import type { OutfitRevealBasicShotPlan, OutfitRevealBasicShotDebug, RevealShotId } from './types';

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

async function generateShotImage(
  shotId:        RevealShotId,
  refs:          PhotodumpRefs,
  destino:       PhotodumpDestino,
  sessionParams: { uid?: string; sessionId?: string },
  shotIndex:     number,
  totalShots:    number,
): Promise<{ imageUrl: string; prompt: string; refsCount: number; debug: OutfitRevealBasicShotDebug }> {
  const contract = buildShotContract(shotId);
  const routed   = routeReferences(contract, refs);
  const routingValidation = validateRouting(contract, routed);
  if (!routingValidation.passed) {
    throw new Error(`El shot "${shotId}" no pasó la validación de referencias: ${routingValidation.errors.join(' | ')}`);
  }

  const intelligence = applyIntelligence(contract.poseFamily, refs.gender ?? 'female');
  const { prompt, negative } = buildShotPrompt(shotId, garmentCountFor(refs), intelligence);
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
    metadata:        { role: 'OUTFIT_REVEAL_BASIC_SHOT', shotId },
  });

  const debug = buildShotDebug(contract, routed, prompt, routingValidation);
  return { imageUrl, prompt, refsCount: preparedRefs.length, debug };
}

// ── Plan de sesión ──────────────────────────────────────────────────────

export function buildOutfitRevealBasicDirectives(): Omit<PhotodumpShotDirective, 'arcPosition' | 'aspectRatio'>[] {
  const contracts = buildShotContracts();
  return contracts.map((contract): Omit<PhotodumpShotDirective, 'arcPosition' | 'aspectRatio'> => {
    const plan: OutfitRevealBasicShotPlan = { shotId: contract.shotId };
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
  const result = await generateShotImage('mirror_check', refs, destino, sessionParams, 0, 3);
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
      const contract = buildShotContract('mirror_check');
      const debug = buildShotDebug(
        contract,
        { orderedUrls: [], breakdown: { outfits: [] } },
        'mirror_check (already generated as the anchor)',
        { passed: true, errors: [] },
      );
      return { imageUrl: cached.imageUrl, prompt: cached.prompt, refsCount: cached.refsCount, debug };
    }
    // Red de seguridad: si por algún motivo el REF0 no se generó antes.
    const result = await generateShotImage('mirror_check', refs, destino, sessionParams, shotIndex, totalShots);
    mirrorCheckCache.set(cacheKey(refs), result);
    return result;
  }

  return generateShotImage(shotId, refs, destino, sessionParams, shotIndex, totalShots);
}
