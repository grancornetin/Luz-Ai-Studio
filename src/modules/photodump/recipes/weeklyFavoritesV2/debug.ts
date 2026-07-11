/**
 * recipes/weeklyFavoritesV2/debug.ts
 *
 * Arma el panel de diagnóstico de una foto: qué rol tuvo, qué item era el
 * protagonista, qué referencias se usaron, qué política de vestuario y
 * encuadre se aplicó, cómo quedó su cobertura, y el resultado de las dos
 * validaciones (de contrato y de enrutamiento).
 */
import type {
  ShotContract, RoutedReferences, ValidationResult, WeeklyV2ShotDebug, CoverageLevel,
} from './types';

function coverageReason(level: CoverageLevel, contract: ShotContract): string {
  switch (level) {
    case 'primary':
      return `"${contract.activeItem?.label ?? 'item'}" tiene su propia foto dedicada.`;
    case 'primary_plus_detail':
      return `"${contract.activeItem?.label ?? 'item'}" tiene foto propia más una foto de detalle adicional.`;
    case 'secondary':
      return `"${contract.activeItem?.label ?? 'item'}" aparece como acompañante en la foto de otro item.`;
    case 'overview_only':
      return 'El item solo aparece en la foto general — no tiene foto propia.';
    case 'not_covered':
    default:
      return 'El item no aparece en ninguna foto de esta sesión.';
  }
}

export function buildShotDebug(
  contract:            ShotContract,
  routed:               RoutedReferences,
  promptSummary:        string,
  contractValidation:   ValidationResult,
  routingValidation:    ValidationResult,
): WeeklyV2ShotDebug {
  return {
    shotId:            contract.shotId,
    role:              contract.role,
    activeItem:         contract.activeItem?.id ?? null,
    referencesUsed:     routed.orderedUrls,
    wardrobePolicy:     contract.wardrobePolicy,
    cameraGrammar:      contract.cameraGrammar,
    coverageDecision: {
      level:   contract.coverageLevel,
      reason:  coverageReason(contract.coverageLevel, contract),
    },
    contractValidation,
    routingValidation,
    promptSummary,
  };
}
