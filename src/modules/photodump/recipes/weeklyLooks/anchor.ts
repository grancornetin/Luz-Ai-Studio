/**
 * recipes/weeklyLooks/anchor.ts
 *
 * Decide qué outfit lleva puesto la persona en el PRIMER look del set (el
 * resto de los looks son cada uno su propia referencia de outfit — ver
 * manifest.ts, un look = una referencia subida). Mismo criterio de
 * prioridad que weeklyFavoritesV2/anchor.ts, simplificado: acá SIEMPRE hay
 * persona (el punto de la receta es mostrar looks puestos), así que no
 * existe el modo 'world_only'.
 *
 *   1. El usuario marcó "este avatar ya trae su outfit definitivo" — se
 *      respeta tal cual.
 *   2. No hay outfit definitivo marcado, pero el primer look subido ya ES
 *      un outfit real (siempre lo es, por definición del manifest) — se usa
 *      directamente como base, sin necesidad de detectar estilo por IA como
 *      hace weeklyFavoritesV2 (esa receta necesita inferir estilo porque el
 *      avatar puede no traer NINGÚN outfit subido; acá siempre hay al menos
 *      un look real, es el requisito mínimo de la receta).
 */
import type { PhotodumpRefs } from '../../types';
import type { WeeklyLooksManifest, AnchorContract } from './types';

export function buildAnchorContract(
  refs:     PhotodumpRefs,
  manifest: WeeklyLooksManifest,
): AnchorContract {
  const identityRefUrl = refs.avatarRef ?? undefined;
  const bodyRefUrl      = refs.bodyRef ?? undefined;

  if (refs.avatarHasDefinitiveOutfit) {
    return { mode: 'person_with_explicit_base_outfit', identityRefUrl, bodyRefUrl };
  }

  if (manifest.items.length === 0) {
    return {
      mode: 'person_with_safe_fallback_outfit',
      identityRefUrl,
      bodyRefUrl,
      styleDetection: { styleIsClear: false, styleDescription: '', reason: 'No hay looks subidos.' },
    };
  }

  // El primer look subido es un outfit real y completo por definición del
  // manifest — se usa directamente como el outfit del primer shot, sin
  // pasar por detección de estilo (no hace falta inferir nada: ya tenemos
  // la prenda real).
  return { mode: 'person_with_style_matched_outfit', identityRefUrl, bodyRefUrl };
}
