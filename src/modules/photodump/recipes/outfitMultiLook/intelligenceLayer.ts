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
 *
 * Bug real reportado en producción (piloto Fase 8, ronda 2): weekly/
 * curated_ideas caían siempre en poseIntensity 'neutral', y
 * 'neutral' era UNA sola frase fija — los 4 shots de un mismo set salían con
 * la misma pose plana (de frente, brazos pegados al cuerpo), sin la
 * variación orgánica que el resto de los bancos de la app sí tiene. Se
 * agrega un banco pequeño de variantes neutrales, rotado de forma
 * determinística por la posición del look en el set (look.sourceIndex) —
 * así cada shot del mismo set pide una postura distinta sin depender de
 * aleatoriedad no reproducible.
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

// Variantes de pose neutral con intención real (peso del cuerpo, ángulo de
// cabeza, gesto de la mano libre, mirada) — cada una es una postura distinta
// de "pararse frente al espejo", no una repetición de la misma con otras
// palabras.
const NEUTRAL_POSE_VARIANTS = [
  'Natural standing pose with soft contrapposto: weight shifted onto one leg, the hip on that side slightly lifted, the other knee relaxed and bent. ' +
    'Head tilted slightly to one side, gaze glancing down toward the phone screen. Free hand rests loosely near the waist or in a pocket. A relaxed, unforced everyday moment.',
  'Natural standing pose with weight shifted back onto one leg, shoulders slightly angled away from the mirror rather than square to it, creating a soft three-quarter body angle. ' +
    'Chin tilted down a little, gaze toward the phone. Free arm relaxed, elbow slightly bent, hand resting near the hip or the hem of the outfit.',
  'Natural standing pose facing the mirror at a slight angle, one foot placed slightly ahead of the other (still standing still, weight settled), spine long but relaxed, shoulders soft. ' +
    'Head tilted slightly, gaze directed at her own reflection rather than the phone. Free hand grazes her hair or the edge of the outfit, a small unconscious gesture.',
  'Natural standing pose with a slight lean of the upper body to one side, hip counter-balanced on the opposite side, creating a relaxed S-curve silhouette. ' +
    'Gaze directed slightly downward and to the side, soft unposed expression. Free hand tucked loosely into a pocket or resting against the opposite arm.',
];

function poseLineFor(intensity: LookPoseIntensity, variantIndex: number): string {
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
    default: {
      const idx = ((variantIndex % NEUTRAL_POSE_VARIANTS.length) + NEUTRAL_POSE_VARIANTS.length) % NEUTRAL_POSE_VARIANTS.length;
      return NEUTRAL_POSE_VARIANTS[idx];
    }
  }
}

export function applyIntelligence(contract: ShotContract, gender: HpiGender): AppliedIntelligence {
  const hpiBlock     = buildHpiBlock(hpiConfigFor(contract.poseIntensity, gender));
  const hpiNegatives = getHpiNegatives(gender);
  const poseLine     = poseLineFor(contract.poseIntensity, contract.look.sourceIndex);
  return { hpiBlock, hpiNegatives, poseLine };
}
