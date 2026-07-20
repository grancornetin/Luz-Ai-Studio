/**
 * recipes/outfitMultiLook/contracts.ts
 *
 * Convierte cada look asignado por el reparto (allocator.ts) en un contrato
 * explícito: qué encuadre usa, qué referencias necesita, y qué intensidad de
 * pose le corresponde según su era (solo then_vs_now).
 *
 * Encuadre fijo por diseño (validado manualmente, ver manifiesto sección 3):
 * "full-body mirror selfie" idéntico en todos los shots de weekly/then_vs_now/
 * rate_check/curated_ideas. trip_recap usa un encuadre de tercera persona
 * candid (no es mirror-selfie — cada shot está en un lugar público distinto).
 */
import type { LookItem, MultiLookIntent, ShotContract, ReferencePolicy, CameraGrammarRef, LookPoseIntensity } from './types';

function cameraGrammarFor(intent: MultiLookIntent): CameraGrammarRef {
  if (intent === 'trip_recap') {
    return { framing: 'MEDIUM_FULL', angle: 'eye_level', composition: 'candid_off_center' };
  }
  return { framing: 'MEDIUM_FULL', angle: 'eye_level', composition: 'mirror_selfie' };
}

// then_vs_now: la jerarquía de pose vive por look, no por mecanismo de
// generación distinto (ver manifiesto sección 6bis) — before = baja
// presencia deliberada, after = alto impacto deliberado. El resto de
// intenciones no tiene jerarquía, pose neutral en todos los looks.
function poseIntensityFor(intent: MultiLookIntent, look: LookItem): LookPoseIntensity {
  if (intent !== 'then_vs_now') return 'neutral';
  if (look.era === 'before') return 'low_presence';
  if (look.era === 'after') return 'high_impact';
  return 'neutral';
}

function referencePolicyFor(look: LookItem): ReferencePolicy {
  return {
    useIdentityRef: true,
    useBodyRef:     true,
    useAnchorRef:   true,
    activeLookRef:  look.refUrl,
  };
}

export function buildShotContract(
  look:            LookItem,
  intent:          MultiLookIntent,
  chainAnchorUrl?: string,
): ShotContract {
  return {
    shotId:          `shot_${look.id}`,
    look,
    referencePolicy: referencePolicyFor(look),
    cameraGrammar:   cameraGrammarFor(intent),
    poseIntensity:   poseIntensityFor(intent, look),
    chainAnchorUrl,
  };
}

export function buildShotContracts(
  looks:  LookItem[],
  intent: MultiLookIntent,
  chainAnchorByLookId?: Map<string, string>,
): ShotContract[] {
  return looks.map(look => buildShotContract(look, intent, chainAnchorByLookId?.get(look.id)));
}
