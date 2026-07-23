/**
 * recipes/outfitNightOut/nightMoments.ts
 *
 * Banco de "momentos de noche" — derivado de analizar 23 imágenes reales de
 * salidas nocturnas (2 tandas: registro elegante/cena y registro
 * fiesta/discoteca). El hallazgo real: la variedad de una salida nocturna NO
 * se explica por "en qué momento narrativo está" (llegada/social/cierre),
 * sino por el CRUCE de 4 ejes independientes:
 *
 *   Eje A — encuadre/sujeto (las 5 entradas de este banco)
 *   Eje B — energía: elegante | fiesta (resolveEnergyFromBrief) — parametriza
 *           el promptBlock de cada entrada, no agrega entradas nuevas
 *   Eje C — venue: resuelto aparte por venueResolver.ts, inyectado como
 *           bloque de escena en cualquier entrada
 *   Eje D — compañía: filtra si group_moment entra al pool disponible
 *
 * Cada entrada expone la misma forma que RevealVariant de
 * outfitRevealBasic/renderVariants.ts (ShotContract + promptBlock) — el
 * resto del pipeline (referenceRouter, intelligenceLayer, promptBuilder) no
 * necesita saber que el contenido nació de cruzar 4 ejes.
 */
import type { NightMomentId, NightOutEnergy, ShotContract } from './types';

export interface NightMoment {
  id:            NightMomentId;
  contract:      ShotContract;
  // Texto de escena por energía — motion_energy no tiene entrada 'elegante'
  // porque solo está disponible cuando la energía resuelta es 'fiesta'.
  sceneBlockByEnergy: Partial<Record<NightOutEnergy, string>>;
  // Si true, requiere companion real subido para entrar al pool disponible.
  requiresCompanion: boolean;
  // Si true, solo disponible cuando la energía resuelta es 'fiesta'.
  fiestaOnly: boolean;
}

export const NIGHT_MOMENTS: NightMoment[] = [
  {
    id: 'posed_portrait',
    contract: {
      shotId: 'posed_portrait',
      cameraGrammar: { framing: 'MEDIUM_CLOSE', angle: 'eye_level', composition: 'posed_portrait' },
      referencePolicy: { useIdentityRef: true, useBodyRef: true, useOutfitRefs: true },
      hpiPoseFamily: 'SEATED_EDITORIAL_OR_LIFESTYLE_POSE',
      hpiCameraFamily: 'OBSERVED_PROFILE_OR_CANDID',
      footwearVisible: false,
    },
    sceneBlockByEnergy: {
      elegante: 'A posed portrait, medium-close, holding a drink or a small prop close to the body — glass of wine, cocktail, cup. Warm, intentional lighting. She is looking away from the camera or slightly past it, composed and calm.',
      fiesta:   'A posed portrait under colorful venue lighting, holding a drink close to the body — cocktail, cup, bottle. Playful, confident expression, looking toward or past the camera.',
    },
    requiresCompanion: false,
    fiestaOnly: false,
  },
  {
    id: 'group_moment',
    contract: {
      shotId: 'group_moment',
      cameraGrammar: { framing: 'MEDIUM_FULL', angle: 'eye_level', composition: 'group_moment' },
      referencePolicy: { useIdentityRef: true, useBodyRef: true, useOutfitRefs: true, useCompanionRef: true },
      hpiPoseFamily: null,
      footwearVisible: false,
    },
    sceneBlockByEnergy: {
      elegante: 'A candid moment with one companion — talking, laughing, or leaning in together at the table. Both people clearly distinct in face and body, genuine interaction, not posed symmetrically for the camera.',
      fiesta:   'A candid group moment with one or more companions — laughing, arms up, celebrating together. Colorful venue lighting, natural unposed energy, each person clearly distinct in face and body.',
    },
    requiresCompanion: true,
    fiestaOnly: false,
  },
  {
    id: 'motion_energy',
    contract: {
      shotId: 'motion_energy',
      cameraGrammar: { framing: 'MEDIUM_FULL', angle: 'eye_level', composition: 'motion_energy' },
      referencePolicy: { useIdentityRef: true, useBodyRef: true, useOutfitRefs: true },
      hpiPoseFamily: null,
      hpiCameraFamily: 'DYNAMIC_MOTION_CAPTURE_FRAMING',
      footwearVisible: false,
    },
    sceneBlockByEnergy: {
      fiesta: 'A candid dance-floor moment with genuine motion blur and colorful club lighting (neon, laser, or flash) — dancing, arms raised, hair in motion. The energy reads as a real captured instant, not a posed photo.',
    },
    requiresCompanion: false,
    fiestaOnly: true,
  },
  {
    id: 'pov_legs',
    contract: {
      shotId: 'pov_legs',
      cameraGrammar: { framing: 'CLOSE_UP', angle: 'looking_down', composition: 'pov_legs' },
      referencePolicy: { useIdentityRef: true, useBodyRef: true, useOutfitRefs: true },
      hpiPoseFamily: null,
      hpiCameraFamily: 'LOW_ANGLE_SELFIE_POV',
      footwearVisible: true,
    },
    sceneBlockByEnergy: {
      elegante: 'A first-person point-of-view shot looking down at her own legs and shoes, resting or crossed, with a drink glass visible nearby on a table. No face, no arm holding a phone — this is literally what she sees looking down.',
      fiesta:   'A first-person point-of-view shot looking down at her own legs and shoes, with a drink cup nearby. No face, no arm holding a phone — this is literally what she sees looking down.',
    },
    requiresCompanion: false,
    fiestaOnly: false,
  },
  {
    id: 'ambient_only',
    contract: {
      shotId: 'ambient_only',
      cameraGrammar: { framing: 'WIDE', angle: 'eye_level', composition: 'ambient_only' },
      referencePolicy: { useIdentityRef: false, useBodyRef: false, useOutfitRefs: false },
      hpiPoseFamily: null,
      hpiCameraFamily: 'LIFESTYLE_MEDIUM_DISTANCE',
      footwearVisible: false,
    },
    sceneBlockByEnergy: {
      elegante: 'An ambient shot of the table or venue — glasses of wine or cocktails, plates, warm lighting. No person in focus, just the atmosphere of the moment.',
      fiesta:   'An ambient shot of drinks on a table or bar — cocktails, cups, bottles, colorful lighting. No person in focus, just the atmosphere of the night.',
    },
    requiresCompanion: false,
    fiestaOnly: false,
  },
  {
    id: 'car_transition',
    contract: {
      shotId: 'car_transition',
      cameraGrammar: { framing: 'MEDIUM_CLOSE', angle: 'eye_level', composition: 'car_transition' },
      referencePolicy: { useIdentityRef: false, useBodyRef: false, useOutfitRefs: false },
      hpiPoseFamily: null,
      footwearVisible: false,
    },
    sceneBlockByEnergy: {
      elegante: 'The interior of a car at night, seen from the passenger view — dashboard lights, wet or dark windows, city lights outside. No person in frame, just the feeling of the ride there or back.',
      fiesta:   'The interior of a car at night, seen from the passenger view — dashboard lights, city lights or rain outside. No person in frame, just the feeling of the ride there or back.',
    },
    requiresCompanion: false,
    fiestaOnly: false,
  },
];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/**
 * Filtra el pool disponible según companion/energía, y selecciona `count`
 * entradas distintas de forma determinística por seed — mismo principio que
 * pickVariantsForSet de outfitRevealBasic/renderVariants.ts.
 */
export function pickNightMomentsForSet(
  seed:         string,
  count:        number,
  hasCompanion: boolean,
  energy:       NightOutEnergy,
): NightMoment[] {
  const pool = NIGHT_MOMENTS.filter(m => {
    if (m.requiresCompanion && !hasCompanion) return false;
    if (m.fiestaOnly && energy !== 'fiesta') return false;
    return true;
  });

  const n = pool.length;
  const safeCount = Math.max(0, Math.min(count, n));
  const picked: NightMoment[] = [];
  const usedIndices = new Set<number>();

  for (let i = 0; i < safeCount; i++) {
    let idx = hashString(`${seed}::${i}`) % n;
    let attempts = 0;
    while (usedIndices.has(idx) && attempts < n) {
      idx = (idx + 1) % n;
      attempts++;
    }
    usedIndices.add(idx);
    picked.push(pool[idx]);
  }
  return picked;
}

export function findNightMoment(id: NightMomentId): NightMoment {
  const moment = NIGHT_MOMENTS.find(m => m.id === id);
  if (!moment) throw new Error(`NightMoment desconocido: ${id}`);
  return moment;
}
