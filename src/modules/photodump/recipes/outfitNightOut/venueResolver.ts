/**
 * recipes/outfitNightOut/venueResolver.ts
 *
 * Resuelve el venue (dónde pasa la noche) y la energía (elegante/fiesta) de
 * la sesión — ambos a partir del brief del usuario, con la foto de escena
 * como fuente real si existe.
 *
 * Venue: mismo criterio que outfit_check/InferredDestination — si hay
 * refs.sceneRef, es la fuente única de verdad (nunca se mezcla con
 * inferencia de texto, mismo principio que trip_recap: no inventar un lugar
 * si hay foto real). Si no hay foto, se infiere una descripción libre desde
 * el brief — a diferencia de outfit_check (que mapea a un set fijo de
 * destinos: oficina, playa, aeropuerto), acá no hace falta clasificar en
 * categorías: el texto del brief ya sirve directamente como descripción de
 * escena para el modelo.
 *
 * Energía: eje derivado del análisis real de 23 imágenes de referencia (ver
 * plan de implementación) — determina si el registro visual es
 * elegante/calmado (cena, rooftop, restaurante) o fiesta/alta energía
 * (previa, boliche, after). Sin señal clara, default a 'elegante' — es el
 * registro más seguro visualmente (nunca forzar un blur de discoteca sobre
 * un brief ambiguo).
 */
import type { PhotodumpRefs } from '../../types';
import type { NightOutEnergy } from './types';

const FIESTA_KEYWORDS = [
  'previa', 'boliche', 'antro', 'after', 'fiesta', 'disco', 'discoteca',
  'joda', 'peda', 'pool party', 'club',
];

export function resolveEnergyFromBrief(basePrompt: string): NightOutEnergy {
  const text = (basePrompt ?? '').toLowerCase();
  const isFiesta = FIESTA_KEYWORDS.some(kw => text.includes(kw));
  return isFiesta ? 'fiesta' : 'elegante';
}

export interface VenueContext {
  venueImageUrl?: string;
  venueTextFallback: string;
}

export function resolveVenueContext(refs: PhotodumpRefs, basePrompt: string): VenueContext {
  if (refs.sceneRef) {
    return { venueImageUrl: refs.sceneRef, venueTextFallback: '' };
  }
  const brief = (basePrompt ?? '').trim();
  const venueTextFallback = brief
    ? `a real venue matching this description: ${brief}`
    : 'a real, credible night-out venue — bar, restaurant, rooftop, or similar social space';
  return { venueTextFallback };
}
