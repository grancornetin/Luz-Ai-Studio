/**
 * recipes/outfitRevealBasic/contracts.ts
 *
 * Los 3 shots de esta receta son fijos por diseño (validado a mano, ver
 * manifiesto sección 3) — no hay reparto ni rotación, siempre son los mismos
 * 3 ángulos/distancias, sin importar cuántas prendas suba el usuario.
 */
import type { ShotContract, RevealShotId } from './types';

const REVEAL_SHOT_CONTRACTS: ShotContract[] = [
  {
    shotId: 'mirror_check',
    cameraGrammar: { framing: 'FULL_BODY', angle: 'eye_level', composition: 'mirror_selfie' },
    poseFamily: 'standing',
    referencePolicy: { useIdentityRef: true, useBodyRef: true, useOutfitRefs: true },
  },
  {
    shotId: 'self_pov',
    cameraGrammar: { framing: 'POV', angle: 'looking_down', composition: 'self_pov_no_face' },
    poseFamily: 'pov_no_hpi',
    referencePolicy: { useIdentityRef: false, useBodyRef: true, useOutfitRefs: true },
  },
  {
    shotId: 'close_detail',
    cameraGrammar: { framing: 'CLOSE_UP', angle: 'eye_level', composition: 'close_selfie' },
    poseFamily: 'upper_body',
    referencePolicy: { useIdentityRef: true, useBodyRef: false, useOutfitRefs: true },
  },
];

export function buildShotContracts(): ShotContract[] {
  return REVEAL_SHOT_CONTRACTS;
}

export function buildShotContract(shotId: RevealShotId): ShotContract {
  const contract = REVEAL_SHOT_CONTRACTS.find(c => c.shotId === shotId);
  if (!contract) throw new Error(`Shot desconocido para outfit_reveal_basic: "${shotId}".`);
  return contract;
}
