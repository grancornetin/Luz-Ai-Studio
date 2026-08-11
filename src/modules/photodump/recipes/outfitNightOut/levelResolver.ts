/**
 * recipes/outfitNightOut/levelResolver.ts
 *
 * Arma la lista final de shots según el nivel elegido por el usuario:
 *  - CORTO (3):     mirror_check + 2 momentos de noche rotados del banco.
 *  - COMPLETO (5):  mirror_check + tryon_detail + 3 momentos de noche.
 *  - EXTENDIDO (7): mirror_check + 6 momentos de noche. Sin presentation ni
 *                   tryon_detail — el nivel más largo se usa para más
 *                   experiencia/sensación de la noche, no para más
 *                   preparación en casa (pedido explícito del usuario:
 *                   eliminar por completo la preparación del nivel Extendido).
 *
 * mirror_check es el único de los 3 shots fijos presente en TODOS los
 * niveles — cumple doble función de ancla + primer shot publicable (ver
 * shotPool.ts). presentation/tryon_detail solo existen para Completo (y ya
 * no para Extendido) — nunca reemplazan a mirror_check.
 */
import type { NightOutLevel, NightOutEnergy, ShotContract } from './types';
import { TRYON_DETAIL_CONTRACT, MIRROR_CHECK_CONTRACT } from './shotPool';
import { pickNightMomentsForSet, findNightMoment, type NightMoment } from './nightMoments';

export interface ResolvedShot {
  fixedContract?: ShotContract;
  nightMoment?:   NightMoment;
}

const NIGHT_MOMENT_COUNT_BY_LEVEL: Record<NightOutLevel, number> = {
  una_foto:  1,
  corto:     2,
  completo:  3,
  extendido: 6,
};

export function resolveShotsForLevel(
  level:        NightOutLevel,
  seed:         string,
  hasCompanion: boolean,
  energy:       NightOutEnergy,
): ResolvedShot[] {
  // Fallback de emergencia si el director falla en el nivel de 1 sola foto:
  // usa directamente single_hero_shot (no pickNightMomentsForSet — ese
  // sorteo podría devolver cualquier momento del banco, incluido uno sin
  // protagonista, rompiendo el contrato de "1 sola imagen que cuenta toda la
  // historia"). Sin mirror_check, para no convertir esto en 2 fotos.
  if (level === 'una_foto') {
    return [{ nightMoment: findNightMoment('single_hero_shot') }];
  }

  const momentCount = NIGHT_MOMENT_COUNT_BY_LEVEL[level];
  const nightMoments = pickNightMomentsForSet(seed, momentCount, hasCompanion, energy);

  const fixedShots: ShotContract[] = level === 'completo'
    ? [MIRROR_CHECK_CONTRACT, TRYON_DETAIL_CONTRACT]
    : [MIRROR_CHECK_CONTRACT];

  return [
    ...fixedShots.map((fixedContract): ResolvedShot => ({ fixedContract })),
    ...nightMoments.map((nightMoment): ResolvedShot => ({ nightMoment })),
  ];
}
