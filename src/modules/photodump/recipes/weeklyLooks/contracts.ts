/**
 * recipes/weeklyLooks/contracts.ts
 *
 * Arma un ShotContract por cada look del manifest — un shot = un look
 * completo, cámara/gramática fija (MEDIUM_FULL centrado en el outfit,
 * cuerpo completo siempre visible: la historia es "esta ropa usé", el
 * calzado y la silueta completa importan en cada shot).
 *
 * El primer shot es siempre el "anchor shot": si placeMode === 'same_place',
 * su resultado real se reusa como referencia de escena para el resto del
 * set (ver index.ts) — mismo patrón que outfitRevealBasic/mirror_check.
 */
import type { WeeklyLooksManifest, ShotContract, CameraGrammarRef } from './types';

const LOOK_CAMERA_GRAMMAR: CameraGrammarRef = {
  framing:     'MEDIUM_FULL',
  angle:       'EYE_LEVEL',
  composition: 'person_centered_full_outfit_visible',
};

export function buildShotContracts(manifest: WeeklyLooksManifest): ShotContract[] {
  return manifest.items.map((item, i): ShotContract => ({
    shotId:       `weekly_look_${i}`,
    lookItem:      item,
    isAnchorShot:  i === 0,
    cameraGrammar: LOOK_CAMERA_GRAMMAR,
  }));
}
