/**
 * recipes/outfitMultiLook/allocator.ts
 *
 * Reparto mucho más simple que weeklyFavoritesV2: cada look sube como una
 * imagen ya completa y autocontenida (un outfit entero), así que no hay
 * "overview" ni "detalle adicional" que fabricar — cada look elegible recibe
 * exactamente un shot (o 2 en curated_ideas, ver contracts.ts).
 *
 * Si el usuario pide menos shots (requestedCount) que looks subidos, se
 * generan solo los primeros requestedCount looks, en el orden en que fueron
 * cargados — nunca se inventa un look que no exista.
 *
 * IMPORTANTE: requestedCount que llega desde PDStep2Receta.tsx/PhotodumpModule.tsx
 * está en UNIDADES DE FOTOS (lo que el usuario ve y elige en "cantidad de
 * imágenes"), no en cantidad de looks. Para curated_ideas, 1 look = 2 fotos
 * — por eso requestedCountToLookCount() convierte antes de repartir. Sin
 * esta conversión, pedir "3 fotos" con 3 looks cargados en curated_ideas
 * devolvía los 3 looks completos (6 fotos), ignorando el recorte pedido.
 */
import type { LookItem, MultiLookIntent } from './types';

export interface MultiLookAllocationResult {
  requestedCount: number;
  coverageMode:   'full' | 'partial';
  looksToShoot:   LookItem[];
  uncoveredLooks: LookItem[];
  reason:         string;
}

/** Convierte una cantidad de FOTOS pedida a cantidad de LOOKS a repartir. */
export function requestedCountToLookCount(requestedCount: number, intent: MultiLookIntent): number {
  const shotsPerLook = intent === 'curated_ideas' ? 2 : 1;
  return Math.max(0, Math.ceil(requestedCount / shotsPerLook));
}

export function allocateLookShots(looks: LookItem[], requestedLookCount: number): MultiLookAllocationResult {
  const looksToShoot = looks.slice(0, requestedLookCount);
  const uncoveredLooks = looks.slice(requestedLookCount);

  const coverageMode: 'full' | 'partial' = uncoveredLooks.length === 0 ? 'full' : 'partial';
  const reason = coverageMode === 'full'
    ? 'Todos los looks subidos tienen su propia foto.'
    : `Se pidieron ${requestedLookCount} looks pero hay ${looks.length} cargados — ${uncoveredLooks.length} quedaron sin foto.`;

  return { requestedCount: requestedLookCount, coverageMode, looksToShoot, uncoveredLooks, reason };
}
