/**
 * recipes/outfitMultiLook/renderProfile.ts
 *
 * Las constantes de render (mirror-selfie, camera-roll, no-caminar, no-estudio)
 * se movieron a recipes/shared.ts (julio 2026) — son reglas globales de toda
 * la app, no específicas de esta receta, y outfit_reveal_basic las necesita
 * también sin acoplarse a esta carpeta. Este archivo queda como re-export
 * para no romper los imports internos existentes de outfitMultiLook/.
 */
export {
  IPHONE_CAMERA_ROLL_LINE,
  UGC_CASUAL_COMPOSITION_BLOCK,
  NO_WALKING_LINE,
  AVOID_EDITORIAL_LINE,
  NO_STUDIO_BACKDROP_LINE,
} from '../shared';
