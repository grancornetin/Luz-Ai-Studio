/**
 * recipes/outfitRevealBasic/contracts.ts
 *
 * Shot 1 (mirror_check) es fijo por diseño: full-body, ancla del mundo y
 * primer shot publicable — nunca varía.
 *
 * Shots 2 y 3 ya NO son conceptos fijos: toman 2 variantes distintas del
 * banco de renderVariants.ts (elegidas por seed de sesión, ver
 * pickVariantsForSet), evitando el bug real de repetir siempre el mismo
 * texto genérico (self_pov/close_detail fijos).
 *
 * buildShotContracts(seed) es la ÚNICA función que llama a
 * pickVariantsForSet — se usa una sola vez en buildOutfitRevealBasicDirectives()
 * para armar el plan completo, y el variantIndex resultante viaja en
 * OutfitRevealBasicShotPlan hacia generateOutfitRevealBasicShot (ver
 * index.ts), que reconstruye el contrato puntual con buildShotContractForVariant()
 * sin volver a llamar pickVariantsForSet — así plan y generación real
 * siempre usan exactamente la misma variante, sin depender de que ambos
 * lados calculen el mismo seed en el momento exacto.
 */
import type { ShotContract, RevealShotId } from './types';
import { pickVariantsForSet, REVEAL_VARIANTS } from './renderVariants';

const MIRROR_CHECK_CONTRACT: ShotContract = {
  shotId: 'mirror_check',
  cameraGrammar: { framing: 'FULL_BODY', angle: 'eye_level', composition: 'mirror_selfie' },
  poseFamily: 'standing_anchor',
  referencePolicy: { useIdentityRef: true, useBodyRef: true, useOutfitRefs: true },
};

function variantIndexOf(id: string): number {
  const idx = REVEAL_VARIANTS.findIndex(v => v.id === id);
  return idx === -1 ? 0 : idx;
}

export function buildVariationContract(shotId: RevealShotId, variantIndex: number): ShotContract {
  const variant = REVEAL_VARIANTS[variantIndex];
  return {
    shotId,
    cameraGrammar: variant.cameraGrammar,
    poseFamily: 'variation',
    referencePolicy: { useIdentityRef: true, useBodyRef: true, useOutfitRefs: true },
    variantIndex,
  };
}

export function buildMirrorCheckContract(): ShotContract {
  return MIRROR_CHECK_CONTRACT;
}

/** Solo se llama una vez, al armar el plan completo de la sesión. */
export function buildShotContracts(seed: string): ShotContract[] {
  const [v1, v2] = pickVariantsForSet(seed);
  return [
    MIRROR_CHECK_CONTRACT,
    buildVariationContract('variation_1', variantIndexOf(v1.id)),
    buildVariationContract('variation_2', variantIndexOf(v2.id)),
  ];
}
