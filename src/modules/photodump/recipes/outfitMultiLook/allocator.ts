/**
 * recipes/outfitMultiLook/allocator.ts
 *
 * Reparto mucho más simple que weeklyFavoritesV2: cada look sube como una
 * imagen ya completa y autocontenida (un outfit entero), así que no hay
 * "overview" ni "detalle adicional" que fabricar — cada look elegible recibe
 * exactamente un shot.
 *
 * Si el usuario pide menos shots (requestedCount) que looks subidos, se
 * generan solo los primeros requestedCount looks, en el orden en que fueron
 * cargados — nunca se inventa un look que no exista.
 */
import type { LookItem } from './types';

export interface MultiLookAllocationResult {
  requestedCount: number;
  coverageMode:   'full' | 'partial';
  looksToShoot:   LookItem[];
  uncoveredLooks: LookItem[];
  reason:         string;
}

export function allocateLookShots(looks: LookItem[], requestedCount: number): MultiLookAllocationResult {
  const looksToShoot = looks.slice(0, requestedCount);
  const uncoveredLooks = looks.slice(requestedCount);

  const coverageMode: 'full' | 'partial' = uncoveredLooks.length === 0 ? 'full' : 'partial';
  const reason = coverageMode === 'full'
    ? 'Todos los looks subidos tienen su propia foto.'
    : `Se pidieron ${requestedCount} fotos pero hay ${looks.length} looks cargados — ${uncoveredLooks.length} quedaron sin foto.`;

  return { requestedCount, coverageMode, looksToShoot, uncoveredLooks, reason };
}
