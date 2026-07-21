/**
 * recipes/outfitMultiLook/contractValidator.ts
 *
 * Valida el contrato de un shot en abstracto, antes de resolver ninguna
 * referencia a URL real. Reglas específicas por intención:
 *  - trip_recap exige una foto real de lugar (@escenaN) declarada por el
 *    usuario en cada look (nunca se genera con un lugar vacío/inventado —
 *    ver manifiesto 6ter). Nota: trip_recap no pasa por este validador hoy
 *    (usa generateAnchorChain directamente, que valida lo mismo por su
 *    cuenta) — esta regla queda igual por si en el futuro se unifica el
 *    flujo de validación.
 *  - then_vs_now exige era declarada en cada look.
 */
import type { ShotContract, ValidationResult, MultiLookIntent } from './types';

export function validateShotContract(contract: ShotContract, intent: MultiLookIntent): ValidationResult {
  const errors: string[] = [];

  if (!contract.referencePolicy.activeLookRef) {
    errors.push(`El shot "${contract.shotId}" no tiene la referencia del look activo.`);
  }

  if (intent === 'trip_recap' && !contract.look.placeSceneUrl) {
    errors.push(`El look "${contract.look.id}" no tiene una foto de lugar declarada — trip_recap exige que el usuario suba una imagen del lugar de cada look, nunca se inventa.`);
  }

  if (intent === 'then_vs_now' && !contract.look.era) {
    errors.push(`El look "${contract.look.id}" no tiene era (before/after) declarada — then_vs_now la necesita para decidir la intensidad de pose.`);
  }

  return { passed: errors.length === 0, errors };
}

export function validateShotContracts(contracts: ShotContract[], intent: MultiLookIntent): Map<string, ValidationResult> {
  const results = new Map<string, ValidationResult>();
  for (const contract of contracts) {
    results.set(contract.shotId, validateShotContract(contract, intent));
  }
  return results;
}
