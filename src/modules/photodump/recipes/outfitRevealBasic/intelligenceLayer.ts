/**
 * recipes/outfitRevealBasic/intelligenceLayer.ts
 *
 * Conecta HPI real por shot:
 *  - mirror_check (standing_anchor): HPI STANDING_ASYMMETRIC_FASHION_POSE +
 *    MIRROR_SELFIE_REFLECTION — mismas familias ya verificadas y filtradas
 *    para outfit_multi_look. MIRROR_SELFIE_REFLECTION sí describe el
 *    teléfono correctamente ("phone visible or implied in the reflection").
 *  - variation shots: HPI DESCONECTADO a propósito (sep 2026, bug real
 *    confirmado en producción: el shot back_view/over_shoulder_candid salió
 *    con una mano apoyada en la cadera y ninguna sosteniendo la toma —
 *    leído como foto tomada por otra persona, no como selfie de espaldas).
 *    Causa raíz: las familias de poseBanks/cameraRelationshipBanks (banco
 *    HPI genérico, compartido con otros módulos como Content Studio/UGC) no
 *    tienen ningún concepto de "esto es una selfie, necesita el teléfono
 *    visible" — describen mecánica corporal/de cámara en términos
 *    editoriales abstractos (ej. OBSERVED_PROFILE_OR_CANDID literalmente
 *    dice "observed", la mecánica de una cámara externa). Las 7 variantes
 *    de renderVariants.ts ahora describen la mecánica física del selfie
 *    (brazo/teléfono) directamente en su propio sceneBlock — mismo criterio
 *    que ya usa hardRules.ts (regla 5) para el Director genérico de
 *    outfit_check/outfit_night_out. hpiPoseFamily/hpiCameraFamily quedan en
 *    el tipo por si algún día se resuelve esto con familias HPI reales que
 *    sí incluyan el teléfono — hoy las 7 variantes los dejan en null.
 *
 * includeGesture: true (reactivado 2026-07-23, ver hpiService.ts): el banco
 * gestureBanks se curó — cada basePromptBlock ahora describe SOLO el gesto
 * de mano/brazo, sin la postura corporal entera que antes venía mezclada
 * (ej. "RESTING_OR_SUPPORT_HANDS" ya no arrastra "reclined on couch, torso
 * rotated 90-120°"). Se había desactivado tras un bug real en producción
 * (brazo extra apoyado en una superficie inexistente sobre una pose de pie,
 * causado por ese texto contaminado) — verificado contra el JSON real antes
 * de reactivar: las 11 familias actuales solo describen la mano.
 * Nota: dominantTags de varias familias (RESTING_OR_SUPPORT_HANDS,
 * HAND_TO_HAIR_GESTURE, PHONE_OR_DEVICE_CAPTURE) todavía traen tags de
 * postura (seated_pose, reclined_pose) sin curar — no afecta el prompt real
 * hoy porque no usamos contextTags/preferTags acá, pero si en el futuro se
 * filtra por tags en esta receta, revisar esos tags primero.
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
    return { enabled: false, gender, modoVisual: 'ugc', includeGesture: true, includePerformance: false };
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
