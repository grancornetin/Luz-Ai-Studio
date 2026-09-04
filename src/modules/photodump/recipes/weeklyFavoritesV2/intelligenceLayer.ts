/**
 * recipes/weeklyFavoritesV2/intelligenceLayer.ts
 *
 * Conecta esta receta con los motores que existen justamente para que las
 * fotos no se vean genéricas:
 *
 *  - HPI (Human Performance Intelligence): pose, gesto, expresión, energía
 *    corporal — hoy SOLO para jewelry/makeup_applied/skincare_in_hand (ver
 *    HPI_STILL_CONNECTED_ROLES abajo). Solo aporta esto — nunca decide qué
 *    referencia usar, qué item aparece, ni cobertura. Ver
 *    src/services/hpiService.ts.
 *  - Pose citada del banco real (openbank, sep 2026): outfit_hero/
 *    outfit_integrated — ver attachPoseAttitudes en index.ts,
 *    contract.poseAttitudeLine, consumido en promptBuilder.ts.
 *  - UGC Intelligence (photodumpIntelligence.ts): composición, sensación de
 *    contenido real/creador (no publicitario), variedad de encuadre.
 *
 * Esta pieza NO decide referencias ni contenido — solo enriquece la
 * dirección visual/actoral de una foto ya definida por su contrato.
 */
import { buildHpiBlock, getHpiNegatives, type HpiConfig, type HpiGender } from '../../../../services/hpiService';
import { getStorySupportFamilies, type StorySupportFamily } from '../../photodumpIntelligence';
import type { ShotContract, WardrobePolicy } from './types';

// HPI solo tiene sentido cuando hay una persona posando activamente en la
// foto — no en fotos de producto solo, ni en la foto general (overview),
// donde no hay cuerpo que dirigir.
const WARDROBE_POLICIES_WITH_PERSON: WardrobePolicy[] = ['wears_active_item', 'holds_active_item'];

export function shotHasPersonPosing(contract: ShotContract): boolean {
  return WARDROBE_POLICIES_WITH_PERSON.includes(contract.wardrobePolicy);
}

export interface AppliedIntelligence {
  hpiBlock:      string;
  hpiNegatives:  string[];
  ugcFamily:     StorySupportFamily | null;
  ugcBlock:      string;
}

// includePerformance solo se activa para el shot hero de outfit — es donde
// más aporta energía/actitud; en el resto alcanza con expresión + pose base
// para no sobrecargar la foto con instrucciones que no le corresponden.
function hpiConfigForShot(contract: ShotContract, gender: HpiGender): HpiConfig {
  return {
    enabled:            true,
    gender,
    modoVisual:         'ugc',
    includeGesture:      contract.role !== 'overview',
    includePerformance:  contract.role === 'outfit_hero' || contract.role === 'outfit_integrated',
  };
}

// Elige una familia UGC apropiada para el tipo de foto — prioriza
// creator_aesthetic para fotos de detalle/producto (composición curada) y
// story_support para fotos con persona (sensación de vida real).
function pickUgcFamilyForShot(contract: ShotContract): StorySupportFamily | null {
  const families = getStorySupportFamilies();
  if (families.length === 0) return null;

  const wantsCuratedDetail = contract.role === 'product_texture'
    || contract.role === 'jewelry'
    || contract.role === 'skincare_product_only'
    || contract.role === 'overview';

  const pool = wantsCuratedDetail
    ? families.filter(f => f.usageClass === 'creator_aesthetic')
    : families.filter(f => f.usageClass === 'story_support');

  const finalPool = pool.length > 0 ? pool : families;
  // Determinístico por shotId — misma foto siempre elige la misma familia,
  // pero fotos distintas dentro de la misma sesión no repiten la primera
  // por defecto (variedad real entre shots).
  let hash = 0;
  for (let i = 0; i < contract.shotId.length; i++) hash = (hash * 31 + contract.shotId.charCodeAt(i)) >>> 0;
  return finalPool[hash % finalPool.length] ?? null;
}

// HPI desconectado para outfit_hero/outfit_integrated (sep 2026, decisión
// del usuario: "hay que desconectar HPI y dejamos solo el banco funcional,
// en todas las recetas"). Causa raíz: a diferencia de outfit_multi_look/
// outfit_reveal_basic, este encuadre (MEDIUM_FULL, person_centered) NO es
// mirror selfie, y HPI elegía libremente entre las 28 familias de
// poseBanks sin ningún filtro de compatibilidad — mismo tipo de bug ya
// confirmado en outfitMultiLook (familias "seated"/"reclined" mezclándose
// con un plano de pie). Reemplazado por pose real citada del banco (ver
// attachPoseAttitudes en index.ts, contract.poseAttitudeLine).
//
// jewelry/makeup_applied/skincare_in_hand SIGUEN usando HPI por ahora — no
// auditados todavía (volumen real del banco para esas categorías es bajo,
// ver ronda de auditoría sep 2026: solo 15 fotos de maquillaje en 733).
const HPI_STILL_CONNECTED_ROLES = new Set(['jewelry', 'makeup_applied', 'skincare_in_hand']);

export function applyIntelligence(
  contract: ShotContract,
  gender:   HpiGender,
): AppliedIntelligence {
  const hasPerson = shotHasPersonPosing(contract);
  const usesHpi    = hasPerson && HPI_STILL_CONNECTED_ROLES.has(contract.role);

  const hpiBlock     = usesHpi ? buildHpiBlock(hpiConfigForShot(contract, gender)) : '';
  const hpiNegatives = usesHpi ? getHpiNegatives(gender) : [];

  const ugcFamily = pickUgcFamilyForShot(contract);
  const ugcBlock  = ugcFamily?.storyDirective ?? ugcFamily?.promptBlock ?? '';

  return { hpiBlock, hpiNegatives, ugcFamily, ugcBlock };
}
