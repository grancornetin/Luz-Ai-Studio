/**
 * recipes/outfitNightOut/shotPool.ts
 *
 * Los 3 shots FIJOS de preparación, traducidos del contrato de diseño
 * validado a mano (manifiesto 05_outfit_night_out.normalized.ts):
 *  - presentation: sosteniendo el outfit (hanger/prenda) antes de ponérselo,
 *    todavía con el look base puesto.
 *  - tryon_detail: un ajuste real de la prenda (cierre, tirante, correa),
 *    detalle de manos, mismo cuarto.
 *  - mirror_check: mirror selfie de cuerpo completo con el outfit puesto —
 *    cumple doble función de ancla (identidad/cuerpo/cuarto) y primer shot
 *    publicable en el nivel Corto (mismo patrón de fusión REF0+shot1 que
 *    outfitRevealBasic/outfitMultiLook).
 *
 * mirror_check es el ÚNICO de los 3 presente en todos los niveles — ver
 * levelResolver.ts. presentation/tryon_detail solo aparecen en niveles
 * Completo/Extendido, nunca reemplazan al mirror check.
 */
import type { ShotContract } from './types';

export const PRESENTATION_CONTRACT: ShotContract = {
  shotId: 'presentation',
  cameraGrammar: { framing: 'MEDIUM_FULL', angle: 'eye_level', composition: 'garment_presentation' },
  referencePolicy: { useIdentityRef: true, useBodyRef: true, useOutfitRefs: true },
  hpiPoseFamily: null,
  footwearVisible: false,
};

export const TRYON_DETAIL_CONTRACT: ShotContract = {
  shotId: 'tryon_detail',
  cameraGrammar: { framing: 'MEDIUM_CLOSE', angle: 'eye_level', composition: 'styling_adjustment' },
  referencePolicy: { useIdentityRef: true, useBodyRef: true, useOutfitRefs: true },
  hpiPoseFamily: null,
  footwearVisible: false,
};

export const MIRROR_CHECK_CONTRACT: ShotContract = {
  shotId: 'mirror_check',
  cameraGrammar: { framing: 'FULL_BODY', angle: 'eye_level', composition: 'mirror_selfie' },
  referencePolicy: { useIdentityRef: true, useBodyRef: true, useOutfitRefs: true },
  hpiPoseFamily: 'STANDING_ASYMMETRIC_FASHION_POSE',
  hpiCameraFamily: 'MIRROR_SELFIE_REFLECTION',
  footwearVisible: true,
};
