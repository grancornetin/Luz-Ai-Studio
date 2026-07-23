/**
 * recipes/outfitNightOut/intelligenceLayer.ts
 *
 * Conecta HPI real por shot, leyendo directamente hpiPoseFamily/hpiCameraFamily
 * del ShotContract (ya verificados contra el JSON al escribir shotPool.ts y
 * nightMoments.ts). Si el contrato no declara una familia de pose (ej.
 * group_moment, pov_legs, car_transition — no existe familia real para
 * "grupo posando junto a otra persona" ni para "POV mirando las piernas
 * propias"), se deshabilita el HPI para ese shot en vez de dejar que
 * pickFamily elija al azar entre familias incompatibles — mismo criterio ya
 * aplicado en outfitRevealBasic/intelligenceLayer.ts para genuine_pov.
 *
 * includeGesture: false — mismo motivo documentado en
 * outfitRevealBasic/intelligenceLayer.ts: el banco gestureBanks del JSON HPI
 * puede describir una postura corporal entera además del gesto de mano
 * (curado para el caso de standing, no verificado aún para poses sentadas o
 * candid — no asumir que la curación cubre todos los casos sin volver a
 * revisar el JSON).
 */
import { buildHpiBlock, getHpiNegatives, type HpiConfig, type HpiGender } from '../../../../services/hpiService';
import type { ShotContract } from './types';

export interface AppliedIntelligence {
  hpiBlock:     string;
  hpiNegatives: string[];
}

function hpiConfigFor(contract: ShotContract, gender: HpiGender): HpiConfig {
  if (!contract.hpiPoseFamily) {
    return { enabled: false, gender, modoVisual: 'ugc', includeGesture: false, includePerformance: false };
  }
  return {
    enabled: true, gender, modoVisual: 'ugc', includeGesture: false, includePerformance: false,
    allowedFamilies: {
      pose:   [contract.hpiPoseFamily],
      camera: contract.hpiCameraFamily ? [contract.hpiCameraFamily] : undefined,
    },
  };
}

export function applyIntelligence(contract: ShotContract, gender: HpiGender): AppliedIntelligence {
  const config = hpiConfigFor(contract, gender);
  const hpiBlock     = buildHpiBlock(config);
  const hpiNegatives = config.enabled ? getHpiNegatives(gender) : [];
  return { hpiBlock, hpiNegatives };
}
