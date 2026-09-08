/**
 * recipes/weeklyLooks/debug.ts
 * Arma el bloque de diagnóstico de un shot — mismo propósito que
 * weeklyFavoritesV2/debug.ts, forma simplificada acorde a esta receta.
 */
import type { ShotContract, WeeklyLooksShotDebug, CaptureStyle, PlaceMode } from './types';

export function buildShotDebug(
  contract:     ShotContract,
  captureStyle: CaptureStyle,
  placeMode:    PlaceMode,
  prompt:       string,
): WeeklyLooksShotDebug {
  return {
    shotId:           contract.shotId,
    lookItem:          contract.lookItem.label,
    captureStyle,
    placeMode,
    poseAttitudeLine:  contract.poseAttitudeLine,
    promptSummary:     prompt.slice(0, 400),
  };
}
