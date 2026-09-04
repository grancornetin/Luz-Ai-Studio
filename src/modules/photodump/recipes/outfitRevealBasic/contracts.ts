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
import { fetchPoseCandidatesByKeyword, pickOneCandidate, buildPoseAttitudeLine } from '../outfitCheck/poseClient';

function variantIndexOf(id: string): number {
  const idx = REVEAL_VARIANTS.findIndex(v => v.id === id);
  return idx === -1 ? 0 : idx;
}

export function buildVariationContract(shotId: RevealShotId, variantIndex: number, poseAttitudeLine?: string, coherentPlaces?: string): ShotContract {
  const variant = REVEAL_VARIANTS[variantIndex];
  return {
    shotId,
    cameraGrammar: variant.cameraGrammar,
    poseFamily: 'variation',
    referencePolicy: { useIdentityRef: true, useBodyRef: true, useOutfitRefs: true },
    variantIndex,
    poseAttitudeLine,
    coherentPlaces,
  };
}

export function buildMirrorCheckContract(coherentPlaces?: string): ShotContract {
  return {
    shotId: 'mirror_check',
    cameraGrammar: { framing: 'FULL_BODY', angle: 'eye_level', composition: 'mirror_selfie' },
    poseFamily: 'standing_anchor',
    referencePolicy: { useIdentityRef: true, useBodyRef: true, useOutfitRefs: true },
    coherentPlaces,
  };
}

// Keywords verificadas a mano contra el banco real, RESTRINGIDO a
// full_body/mirror_selfie (sep 2026, misma disciplina que
// outfitMultiLook/contracts.ts) — solo para las variantes con volumen
// genuino confirmado. Primera pasada con keywords sueltas ("apoyad" solo)
// dio falsos positivos reales (capturaba "sentada... con el pie apoyado
// sobre el otro", una pose sentada, no de pie apoyada contra algo) —
// corregido con frases compuestas que exigen el contexto de pie + superficie.
// lateral_silhouette/three_quarter_showcase/over_shoulder_candid/
// close_detail_hair no tienen keyword propia todavía (ninguna veta
// discriminante auditada para ellas — "3/4" por ejemplo aparece igual en
// poses de pie, sentadas y apoyadas, no sirve como filtro) — sin entrada
// acá, el shot cae al sceneBlock genérico de renderVariants.ts, sin cambios.
const FULL_BODY_SHOT_TYPES = ['full_body', 'mirror_selfie'];
const VARIANT_POSE_KEYWORDS: Partial<Record<string, string[]>> = {
  back_view:        ['de espaldas'],
  seated_showcase:  ['sentada', 'sentado'],
  leaning_wall:     ['de pie, apoyad', 'de pie apoyad', 'apoyada contra una pared', 'apoyada en la pared', 'apoyado en el barandal', 'apoyada en el barandal'],
};

/** Solo se llama una vez, al armar el plan completo de la sesión. */
export async function buildShotContracts(seed: string, coherentPlaces?: string): Promise<ShotContract[]> {
  const [v1, v2] = pickVariantsForSet(seed);

  // Una sola llamada de red para todo el set (nunca por shot).
  const wantedGroups = Object.fromEntries(
    [v1.id, v2.id]
      .filter(id => VARIANT_POSE_KEYWORDS[id])
      .map(id => [id, VARIANT_POSE_KEYWORDS[id]!]),
  );
  const candidatesByGroup = Object.keys(wantedGroups).length > 0
    ? await fetchPoseCandidatesByKeyword(wantedGroups, seed, 5, FULL_BODY_SHOT_TYPES)
    : {};

  const poseAttitudeLineFor = (variantId: string): string | undefined => {
    const candidates = candidatesByGroup[variantId] ?? [];
    const chosen = pickOneCandidate(candidates, `${seed}::${variantId}`);
    return buildPoseAttitudeLine(chosen) || undefined;
  };

  return [
    buildMirrorCheckContract(coherentPlaces),
    buildVariationContract('variation_1', variantIndexOf(v1.id), poseAttitudeLineFor(v1.id), coherentPlaces),
    buildVariationContract('variation_2', variantIndexOf(v2.id), poseAttitudeLineFor(v2.id), coherentPlaces),
  ];
}
