/**
 * recipes/outfitMultiLook/intelligenceLayer.ts
 *
 * Conecta HPI real (pose/gesto/expresión) en vez de describir posturas de
 * memoria. La intensidad de pose (neutral / low_presence / high_impact)
 * viene del contrato (ver contracts.ts, derivada de era en then_vs_now) y
 * decide qué tan performática pedirle a HPI que sea la pose — nunca decide
 * contenido de referencia, solo dirección actoral.
 *
 * Validado manualmente (ver manifiesto sección 6bis): para low_presence NO
 * alcanza con "energía relajada" en abstracto — hace falta texto explícito
 * de postura desganada (hombros hacia adentro, brazo rígido, mirada
 * evasiva). Para high_impact, evitar el énfasis marcado de cadera/hip-pop en
 * outfits ceñidos — ese fue el patrón asociado a mayor tasa de fallo de
 * moderación sin causa textual clara identificada; se prioriza apertura de
 * pecho/hombros y altura de postura en su lugar.
 */
import { buildHpiBlock, getHpiNegatives, type HpiConfig, type HpiGender } from '../../../../services/hpiService';
import type { ShotContract, LookPoseIntensity } from './types';

export interface AppliedIntelligence {
  hpiBlock:     string;
  hpiNegatives: string[];
  poseLine:     string;
}

function hpiConfigFor(intensity: LookPoseIntensity, gender: HpiGender): HpiConfig {
  return {
    enabled:            true,
    gender,
    modoVisual:         'ugc',
    includeGesture:      true,
    includePerformance:  intensity === 'high_impact',
  };
}

function poseLineFor(intensity: LookPoseIntensity): string {
  switch (intensity) {
    case 'low_presence':
      return 'Low-presence, unconfident pose: shoulders rounded slightly forward and inward, not open, chest slightly caved rather than lifted. ' +
        'Weight distributed awkwardly, almost evenly on both feet without any deliberate stance — no contrapposto, no hip angle, just standing there without intention. ' +
        'Free arm hangs stiffly at the side, close to the body, not relaxed or extended. Head tilted slightly down and to the side, gaze directed toward the phone screen rather than confidently at the mirror. ' +
        'Flat expression, a little tired or self-conscious, no smile. Low energy, closed-off body language.';
    case 'high_impact':
      return 'Confident pose: standing tall and straight, weight evenly balanced, chest open and lifted, shoulders open and pulled back, spine long. ' +
        'Gaze directed at her own reflection in the mirror, not at the camera lens — a self-observing, satisfied glance, calm and self-assured. ' +
        'Free hand rests loosely on the hip, without pushing it out or angling it — a relaxed, natural hand placement, not an exaggerated pose. Slight head tilt, chin level, a small confident smile.';
    case 'neutral':
    default:
      return 'Natural, relaxed standing pose — a quick everyday moment, not posed for an audience.';
  }
}

export function applyIntelligence(contract: ShotContract, gender: HpiGender): AppliedIntelligence {
  const hpiBlock     = buildHpiBlock(hpiConfigFor(contract.poseIntensity, gender));
  const hpiNegatives = getHpiNegatives(gender);
  const poseLine     = poseLineFor(contract.poseIntensity);
  return { hpiBlock, hpiNegatives, poseLine };
}
