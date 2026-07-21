/**
 * recipes/outfitMultiLook/contracts.ts
 *
 * Convierte cada look asignado por el reparto (allocator.ts) en uno o más
 * contratos explícitos: qué encuadre usa, qué referencias necesita, y qué
 * intensidad de pose le corresponde según su era (solo then_vs_now).
 *
 * Encuadre fijo por diseño (validado manualmente, ver manifiesto sección 3):
 * "full-body mirror selfie" idéntico en todos los shots de weekly/then_vs_now.
 * trip_recap usa un encuadre de tercera persona candid (no es mirror-selfie
 * — cada shot está en un lugar público distinto).
 *
 * curated_ideas es la única intención con MÁS de 1 shot por look (ver
 * manifiesto — pedido real del usuario: para que sirva como guía de estilo
 * necesita al menos un ángulo adicional además del frontal, y opcionalmente
 * accesorios enlazados). Cada look produce 2 ShotContract: 'frontal' (igual
 * al resto de intenciones) y 'variation' — el ángulo de variación rota
 * determinísticamente por look.sourceIndex, mismo principio que
 * NEUTRAL_POSE_VARIANTS en intelligenceLayer.ts, para que ningún set repita
 * el mismo ángulo de variación en dos looks consecutivos.
 */
import type {
  LookItem, MultiLookIntent, MultiLookAccessory, ShotContract, ReferencePolicy,
  CameraGrammarRef, LookPoseIntensity, MultiLookShotAngle,
} from './types';

// Ángulos de variación disponibles para curated_ideas — rotados por posición
// del look, no elegidos al azar (reproducible, sin depender de Math.random).
const VARIATION_ANGLES: CameraGrammarRef[] = [
  { framing: 'MEDIUM_FULL', angle: 'eye_level', composition: 'mirror_selfie_back_view' },
  { framing: 'MEDIUM_FULL', angle: 'eye_level', composition: 'mirror_selfie_side_profile' },
  { framing: 'CLOSE_UP',    angle: 'eye_level', composition: 'fabric_detail_closeup' },
];

function variationAngleFor(look: LookItem): CameraGrammarRef {
  const idx = ((look.sourceIndex % VARIATION_ANGLES.length) + VARIATION_ANGLES.length) % VARIATION_ANGLES.length;
  return VARIATION_ANGLES[idx];
}

function cameraGrammarFor(intent: MultiLookIntent, look: LookItem, angle: MultiLookShotAngle): CameraGrammarRef {
  if (intent === 'trip_recap') {
    return { framing: 'MEDIUM_FULL', angle: 'eye_level', composition: 'candid_off_center' };
  }
  if (intent === 'curated_ideas' && angle === 'variation') {
    return variationAngleFor(look);
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

function referencePolicyFor(look: LookItem, linkedAccessoryUrls: string[]): ReferencePolicy {
  return {
    useIdentityRef: true,
    useBodyRef:     true,
    useAnchorRef:   true,
    activeLookRef:  look.refUrl,
    linkedAccessoryUrls: linkedAccessoryUrls.length > 0 ? linkedAccessoryUrls : undefined,
  };
}

function accessoryUrlsFor(look: LookItem, accessories: MultiLookAccessory[]): string[] {
  return accessories.filter(a => a.linkedLookIds.includes(look.id)).map(a => a.refUrl);
}

export function buildShotContract(
  look:            LookItem,
  intent:          MultiLookIntent,
  angle:           MultiLookShotAngle = 'frontal',
  chainAnchorUrl?: string,
  accessories:     MultiLookAccessory[] = [],
): ShotContract {
  return {
    shotId:          angle === 'frontal' ? `shot_${look.id}` : `shot_${look.id}_${angle}`,
    look,
    referencePolicy: referencePolicyFor(look, accessoryUrlsFor(look, accessories)),
    cameraGrammar:   cameraGrammarFor(intent, look, angle),
    poseIntensity:   poseIntensityFor(intent, look),
    angle,
    chainAnchorUrl,
  };
}

export function buildShotContracts(
  looks:       LookItem[],
  intent:      MultiLookIntent,
  chainAnchorByLookId?: Map<string, string>,
  accessories: MultiLookAccessory[] = [],
): ShotContract[] {
  const contracts: ShotContract[] = [];
  for (const look of looks) {
    const chainAnchorUrl = chainAnchorByLookId?.get(look.id);
    contracts.push(buildShotContract(look, intent, 'frontal', chainAnchorUrl, accessories));
    if (intent === 'curated_ideas') {
      contracts.push(buildShotContract(look, intent, 'variation', chainAnchorUrl, accessories));
    }
  }
  return contracts;
}
