/**
 * recipes/outfitRevealBasic/intelligenceLayer.ts
 *
 * Conecta HPI real por shot, cada uno con su propia familia validada a mano
 * (ver manifiesto sección 3):
 *  - mirror_check: HPI STANDING_ASYMMETRIC_FASHION_POSE (mirror-selfie de
 *    cuerpo completo, de pie) + MIRROR_SELFIE_REFLECTION (cámara). Mismas
 *    familias ya verificadas y filtradas para outfit_multi_look — confirmado
 *    que existen en el banco real (03_reglas_director_hpi_mujer_151.json).
 *  - self_pov: SIN HPI. El manifiesto confirma que no existe una familia real
 *    para "POV puro de ojos sin cámara visible" (HPI está construido sobre
 *    fotos de persona-visible sosteniendo cámara) — describir de memoria una
 *    familia inexistente sería peor que no usar HPI en absoluto.
 *  - close_detail: HPI UPPER_BODY_SELFIE_POSE (selfie de cerca, rostro/torso).
 *
 * Mismo principio ya corregido en outfit_multi_look (allowedFamilies en
 * hpiService.ts): no dejar que pickFamily elija al azar entre las 9 familias
 * de poseBanks, varias de las cuales (sentada/reclinada/gimnasio) contradicen
 * la postura ya fijada por el diseño de este shot.
 */
import { buildHpiBlock, getHpiNegatives, type HpiConfig, type HpiGender } from '../../../../services/hpiService';
import type { RevealPoseFamilies } from './types';

export interface AppliedIntelligence {
  hpiBlock:     string;
  hpiNegatives: string[];
}

function hpiConfigFor(poseFamily: RevealPoseFamilies, gender: HpiGender): HpiConfig {
  if (poseFamily === 'pov_no_hpi') {
    return { enabled: false, gender, modoVisual: 'ugc', includeGesture: false, includePerformance: false };
  }
  if (poseFamily === 'standing') {
    return {
      enabled: true, gender, modoVisual: 'ugc', includeGesture: true, includePerformance: false,
      allowedFamilies: { pose: ['STANDING_ASYMMETRIC_FASHION_POSE'], camera: ['MIRROR_SELFIE_REFLECTION'] },
    };
  }
  // upper_body (close_detail)
  return {
    enabled: true, gender, modoVisual: 'ugc', includeGesture: true, includePerformance: false,
    allowedFamilies: { pose: ['UPPER_BODY_SELFIE_POSE'] },
  };
}

export function applyIntelligence(poseFamily: RevealPoseFamilies, gender: HpiGender): AppliedIntelligence {
  const hpiBlock     = buildHpiBlock(hpiConfigFor(poseFamily, gender));
  const hpiNegatives = poseFamily === 'pov_no_hpi' ? [] : getHpiNegatives(gender);
  return { hpiBlock, hpiNegatives };
}
