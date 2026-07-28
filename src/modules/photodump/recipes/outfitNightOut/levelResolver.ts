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
import { pickNightMomentsForSet, type NightMoment } from './nightMoments';

export interface ResolvedShot {
  fixedContract?: ShotContract;
  nightMoment?:   NightMoment;
}

const NIGHT_MOMENT_COUNT_BY_LEVEL: Record<NightOutLevel, number> = {
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
