/**
 * recipes/outfitRevealBasic/intelligenceLayer.ts
 *
 * Conecta HPI real por shot:
 *  - mirror_check (standing_anchor): HPI STANDING_ASYMMETRIC_FASHION_POSE +
 *    MIRROR_SELFIE_REFLECTION — mismas familias ya verificadas y filtradas
 *    para outfit_multi_look.
 *  - variation shots: la familia HPI viene de la variante elegida en
 *    renderVariants.ts (RevealVariant.hpiPoseFamily/hpiCameraFamily) — cada
 *    variante ya trae su propia familia real, verificada contra el banco
 *    JSON antes de escribirse ahí. Si la variante no tiene familia de pose
 *    (ej. genuine_pov, sin equivalente real en el banco), se deshabilita el
 *    HPI para ese shot en vez de dejar que pickFamily elija al azar entre
 *    familias incompatibles (bug ya corregido una vez para outfit_multi_look,
 *    y que rompió el shot self_pov original de esta receta — el HPI
 *    describía "seated on floor" sobre un prompt de pie).
 */
import { buildHpiBlock, getHpiNegatives, type HpiConfig, type HpiGender } from '../../../../services/hpiService';
import type { RevealPoseFamilies } from './types';
import { REVEAL_VARIANTS } from './renderVariants';

export interface AppliedIntelligence {
  hpiBlock:     string;
  hpiNegatives: string[];
}

function hpiConfigFor(poseFamily: RevealPoseFamilies, variantIndex: number | undefined, gender: HpiGender): HpiConfig {
  if (poseFamily === 'standing_anchor') {
    return {
      enabled: true, gender, modoVisual: 'ugc', includeGesture: true, includePerformance: false,
      allowedFamilies: { pose: ['STANDING_ASYMMETRIC_FASHION_POSE'], camera: ['MIRROR_SELFIE_REFLECTION'] },
    };
  }

  // variation
  const variant = REVEAL_VARIANTS[variantIndex ?? 0];
  if (!variant?.hpiPoseFamily) {
    return { enabled: false, gender, modoVisual: 'ugc', includeGesture: false, includePerformance: false };
  }
  return {
    enabled: true, gender, modoVisual: 'ugc', includeGesture: true, includePerformance: false,
    allowedFamilies: {
      pose:   [variant.hpiPoseFamily],
      camera: variant.hpiCameraFamily ? [variant.hpiCameraFamily] : undefined,
    },
  };
}

export function applyIntelligence(
  poseFamily:   RevealPoseFamilies,
  variantIndex: number | undefined,
  gender:       HpiGender,
): AppliedIntelligence {
  const config = hpiConfigFor(poseFamily, variantIndex, gender);
  const hpiBlock     = buildHpiBlock(config);
  const hpiNegatives = config.enabled ? getHpiNegatives(gender) : [];
  return { hpiBlock, hpiNegatives };
}
