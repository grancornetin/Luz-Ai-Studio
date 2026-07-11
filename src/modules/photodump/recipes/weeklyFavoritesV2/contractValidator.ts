/**
 * recipes/weeklyFavoritesV2/contractValidator.ts
 *
 * Primera etapa de validación: revisa el contrato de una foto en abstracto,
 * antes de resolver ninguna referencia a URL real. Si algo no cierra acá,
 * la foto no se genera.
 *
 * No hace ninguna afirmación sobre el contenido visual de una imagen ya
 * generada (eso está fuera de alcance — ver routingValidator.ts para el
 * límite explícito de qué se puede confirmar en código).
 */
import type { ShotContract, ValidationResult, ShotRole, BehaviorType } from './types';

// Roles que no requieren un item activo (la foto no gira en torno a un
// producto/prenda puntual).
const ROLES_WITHOUT_ACTIVE_ITEM: ShotRole[] = ['overview'];

// Qué comportamiento de item es compatible con cada rol — si el item activo
// tiene un behaviorType que no aparece en esta lista para su rol, el
// contrato es inconsistente.
const COMPATIBLE_BEHAVIOR_BY_ROLE: Record<ShotRole, BehaviorType[]> = {
  outfit_hero:            ['outfit_look', 'base_outfit'],
  outfit_integrated:      ['outfit_look', 'base_outfit'],
  bag:                    ['bag'],
  footwear:               ['footwear'],
  jewelry:                ['jewelry'],
  makeup_applied:         ['makeup_applied'],
  skincare_product_only:  ['skincare_product', 'product_texture'],
  skincare_in_hand:       ['skincare_product'],
  product_texture:        ['product_texture', 'makeup_swatch', 'skincare_product'],
  overview:               ['outfit_look', 'base_outfit', 'bag', 'footwear', 'jewelry', 'makeup_applied', 'makeup_swatch', 'skincare_product', 'product_texture'],
  mixed:                  ['outfit_look', 'base_outfit', 'bag', 'footwear', 'jewelry', 'makeup_applied', 'makeup_swatch', 'skincare_product', 'product_texture'],
};

export function validateShotContract(contract: ShotContract): ValidationResult {
  const errors: string[] = [];

  // 1. Item activo obligatorio, salvo roles explícitamente exentos.
  if (!contract.activeItem && !ROLES_WITHOUT_ACTIVE_ITEM.includes(contract.role)) {
    errors.push(`La foto de rol "${contract.role}" no tiene un item activo asignado.`);
  }

  // 2. El rol debe ser compatible con el comportamiento del item activo.
  if (contract.activeItem) {
    const compatible = COMPATIBLE_BEHAVIOR_BY_ROLE[contract.role] ?? [];
    if (!compatible.includes(contract.activeItem.behaviorType)) {
      errors.push(
        `El item activo "${contract.activeItem.id}" (comportamiento: ${contract.activeItem.behaviorType}) ` +
        `no es compatible con el rol "${contract.role}".`
      );
    }
  }

  // 3. La política de vestuario debe ser coherente con el rol — chequeo de
  // consistencia estructural (no de contenido visual).
  const noPersonRoles: ShotRole[] = ['skincare_product_only', 'product_texture', 'overview'];
  if (noPersonRoles.includes(contract.role) && contract.wardrobePolicy !== 'item_only_no_person' && contract.wardrobePolicy !== 'not_applicable') {
    errors.push(`El rol "${contract.role}" no debería tener persona en cuadro, pero la política de vestuario es "${contract.wardrobePolicy}".`);
  }

  // 4. Los items secundarios deben venir de una asignación explícita — este
  // validador no puede confirmarlo por sí mismo (esa asignación ocurre
  // aguas arriba, en el reparto/contrato), pero sí puede detectar el caso
  // inconsistente de un secundario repetido como activo.
  if (contract.activeItem && contract.secondaryItems.some(it => it.id === contract.activeItem!.id)) {
    errors.push(`El item activo "${contract.activeItem.id}" también aparece como item secundario en la misma foto.`);
  }

  // 5. La decisión de cobertura debe ser válida para el rol: una foto que
  // pretende cubrir un item de forma "primary" no puede ser de rol overview.
  if (contract.role === 'overview' && contract.coverageLevel === 'primary') {
    errors.push('La foto general (overview) no puede declarar cobertura "primary" — un item ahí cuenta como "overview_only".');
  }

  return { passed: errors.length === 0, errors };
}

export function validateShotContracts(contracts: ShotContract[]): Map<string, ValidationResult> {
  const results = new Map<string, ValidationResult>();
  for (const contract of contracts) {
    results.set(contract.shotId, validateShotContract(contract));
  }
  return results;
}
