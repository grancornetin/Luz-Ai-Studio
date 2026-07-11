/**
 * recipes/weeklyFavoritesV2/contracts.ts
 *
 * Convierte cada foto asignada por el reparto (allocator.ts) en un contrato
 * explícito: qué debe mostrar, qué referencias necesita, cómo se relaciona
 * la persona con el item activo, y qué queda prohibido.
 *
 * Regla núcleo: ninguna referencia se agrega porque "existe" — toda
 * referencia debe quedar justificada aquí, en el contrato. Un accesorio
 * (bolso, joyería) solo entra a una foto de outfit si fue asignado
 * explícitamente como secundario (pairing/tag/plan) — en ese caso el rol es
 * "outfit integrado", no "outfit hero".
 */
import type {
  ManifestItem, AnchorContract, AllocatedShotSlot,
  ShotContract, ShotRole, ReferencePolicy, WardrobePolicy, CameraGrammarRef, CoverageLevel,
} from './types';

// Encuadre por defecto (foto principal) de cada rol.
function cameraGrammarForRole(role: ShotRole): CameraGrammarRef {
  switch (role) {
    case 'outfit_hero':
    case 'outfit_integrated':
      return { framing: 'MEDIUM_FULL', angle: 'eye_level', composition: 'person_centered' };
    case 'bag':
      return { framing: 'MEDIUM', angle: 'eye_level', composition: 'item_prominent' };
    case 'footwear':
      return { framing: 'CLOSE_UP', angle: 'low_angle_or_downward', composition: 'item_prominent' };
    case 'jewelry':
      return { framing: 'CLOSE_UP', angle: 'macro', composition: 'item_prominent' };
    case 'makeup_applied':
      return { framing: 'CLOSE_UP', angle: 'eye_level', composition: 'face_prominent' };
    case 'skincare_product_only':
      return { framing: 'CLOSE_UP', angle: 'eye_level', composition: 'item_prominent' };
    case 'skincare_in_hand':
      return { framing: 'MEDIUM', angle: 'eye_level', composition: 'hand_and_item' };
    case 'product_texture':
      return { framing: 'MACRO', angle: 'top_down', composition: 'item_fills_frame' };
    case 'overview':
      return { framing: 'WIDE', angle: 'top_down_or_flatlay', composition: 'items_arranged' };
    case 'mixed':
    default:
      return { framing: 'MEDIUM', angle: 'eye_level', composition: 'item_prominent' };
  }
}

// Encuadre de una segunda toma del mismo item (isAdditionalDetail) —
// deliberadamente distinto al de la foto principal del mismo rol, para que
// la variedad de ángulo/plano sea real y no una repetición. El cambio
// concreto de pose/momento dentro de ese encuadre lo aporta la capa de
// inteligencia (HPI + UGC Intelligence), no esta función.
function cameraGrammarForAdditionalDetail(role: ShotRole): CameraGrammarRef {
  switch (role) {
    case 'outfit_hero':
    case 'outfit_integrated':
      return { framing: 'MEDIUM', angle: 'three_quarter', composition: 'candid_in_motion' };
    case 'bag':
    case 'footwear':
    case 'jewelry':
      return { framing: 'MACRO', angle: 'angled', composition: 'texture_detail' };
    case 'makeup_applied':
      return { framing: 'MACRO', angle: 'angled', composition: 'texture_detail' };
    case 'skincare_product_only':
    case 'skincare_in_hand':
      return { framing: 'MEDIUM', angle: 'angled', composition: 'in_use_moment' };
    default:
      return { framing: 'MACRO', angle: 'angled', composition: 'texture_detail' };
  }
}

function wardrobePolicyForRole(role: ShotRole): WardrobePolicy {
  switch (role) {
    case 'outfit_hero':
    case 'outfit_integrated':
      return 'wears_active_item';
    case 'bag':
    case 'footwear':
      return 'holds_active_item';
    case 'jewelry':
    case 'makeup_applied':
    case 'skincare_in_hand':
      return 'wears_active_item';
    case 'skincare_product_only':
    case 'product_texture':
      return 'item_only_no_person';
    case 'overview':
    case 'mixed':
    default:
      return 'not_applicable';
  }
}

function referencePolicyForShot(
  role:            ShotRole,
  activeItem:       ManifestItem | null,
  secondaryItems:   ManifestItem[],
  anchor:           AnchorContract,
): ReferencePolicy {
  const empty: ReferencePolicy = {
    useIdentityRef:    false,
    useBodyRef:        false,
    useAnchorRef:      false,
    useOverviewRef:    false,
    activeItemRefs:    [],
    secondaryItemRefs: [],
    technicalRefs:     [],
  };

  const activeRefs = activeItem ? [activeItem.refUrl] : [];
  const secondaryRefs = secondaryItems.map(it => it.refUrl);
  const technicalRefs = activeItem?.technicalReferenceOnly ? [activeItem.refUrl] : [];
  const activeItemRefs = activeItem?.technicalReferenceOnly ? [] : activeRefs;

  switch (role) {
    case 'outfit_hero':
      // Identity + Body + Anchor + active Outfit. Nunca bolso u otro
      // accesorio salvo que haya sido asignado explícitamente — en ese caso
      // el rol correcto es outfit_integrated, no este.
      return { ...empty, useIdentityRef: true, useBodyRef: true, useAnchorRef: true, activeItemRefs };

    case 'outfit_integrated':
      // Identity + Body + Anchor + active Outfit + secundarios asignados explícitamente.
      return { ...empty, useIdentityRef: true, useBodyRef: true, useAnchorRef: true, activeItemRefs, secondaryItemRefs: secondaryRefs };

    case 'bag':
      // Anchor + active Bag + Identity/Body solo si hay persona en cuadro (holds_active_item).
      return { ...empty, useIdentityRef: true, useBodyRef: true, useAnchorRef: true, activeItemRefs };

    case 'footwear':
      // Anchor + active Footwear + Identity/Body solo si el encuadre lo requiere.
      return { ...empty, useAnchorRef: true, activeItemRefs };

    case 'jewelry':
      // Identity + Anchor + active Jewelry.
      return { ...empty, useIdentityRef: true, useAnchorRef: true, activeItemRefs };

    case 'makeup_applied':
      // Identity + Anchor + active Makeup.
      return { ...empty, useIdentityRef: true, useAnchorRef: true, activeItemRefs };

    case 'skincare_product_only':
      // Active Product + optional world/scene anchor. Nunca identidad ni cuerpo.
      return { ...empty, useAnchorRef: true, activeItemRefs };

    case 'skincare_in_hand':
      // Identity + Anchor + active Product.
      return { ...empty, useIdentityRef: true, useAnchorRef: true, activeItemRefs };

    case 'product_texture':
      // Active Product + referencia técnica explícita — nunca identidad, cuerpo o anchor humano.
      return { ...empty, technicalRefs };

    case 'overview':
      // Solo referencias de los items seleccionados. Nunca identidad, nunca
      // cuerpo, nunca anchor humano, nunca el set ya generado.
      return { ...empty, useOverviewRef: true, secondaryItemRefs: secondaryRefs };

    case 'mixed':
    default:
      // Anchor + un item activo + solo secundarios asignados explícitamente.
      return { ...empty, useAnchorRef: true, activeItemRefs, secondaryItemRefs: secondaryRefs };
  }
}

export function buildShotContract(
  slot:              AllocatedShotSlot,
  anchor:             AnchorContract,
  coverageLevel:      CoverageLevel,
  forbiddenItems:     ManifestItem[],
): ShotContract {
  return {
    shotId:            slot.slotId,
    role:              slot.role,
    activeItem:         slot.activeItem,
    secondaryItems:     slot.secondaryItems,
    referencePolicy:    referencePolicyForShot(slot.role, slot.activeItem, slot.secondaryItems, anchor),
    wardrobePolicy:     wardrobePolicyForRole(slot.role),
    cameraGrammar:      slot.isAdditionalDetail ? cameraGrammarForAdditionalDetail(slot.role) : cameraGrammarForRole(slot.role),
    forbiddenItems,
    coverageLevel,
    isAdditionalDetail: slot.isAdditionalDetail,
  };
}

export function buildShotContracts(
  slots:            AllocatedShotSlot[],
  anchor:           AnchorContract,
  itemCoverageLevel: Record<string, CoverageLevel>,
  allItems:          ManifestItem[],
): ShotContract[] {
  return slots.map(slot => {
    const coverageLevel = slot.activeItem ? (itemCoverageLevel[slot.activeItem.id] ?? 'not_covered') : 'not_covered';
    // Prohibido: cualquier item del catálogo que no sea el activo ni un
    // secundario explícitamente asignado a esta foto.
    const allowedIds = new Set([slot.activeItem?.id, ...slot.secondaryItems.map(it => it.id)].filter(Boolean) as string[]);
    const forbiddenItems = allItems.filter(it => !allowedIds.has(it.id));
    return buildShotContract(slot, anchor, coverageLevel, forbiddenItems);
  });
}
