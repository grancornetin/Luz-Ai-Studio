/**
 * recipes/outfitNightOut/nightMoments.ts
 *
 * Banco de "momentos de noche" — derivado de analizar 23 imágenes reales de
 * salidas nocturnas (2 tandas: registro elegante/cena y registro
 * fiesta/discoteca). El hallazgo real: la variedad de una salida nocturna NO
 * se explica por "en qué momento narrativo está" (llegada/social/cierre),
 * sino por el CRUCE de 4 ejes independientes:
 *
 *   Eje A — encuadre/sujeto (las 8 entradas de este banco)
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
  // Si false, la protagonista NO aparece en cuadro (ni rostro ni cuerpo) —
  // ambient_only y car_transition son bodegón/lugar puro. pov_legs SÍ cuenta
  // como con protagonista (se ven sus propias piernas), aunque no haya
  // rostro. pickNightMomentsForSet limita a máximo 1 shot sin protagonista
  // por set completo — de lo contrario el dump se siente como fotos de
  // situaciones/personas distintas, no la salida de una sola persona.
  hasProtagonist: boolean;
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
    hasProtagonist: true,
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
    hasProtagonist: true,
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
    hasProtagonist: true,
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
    hasProtagonist: true,
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
    hasProtagonist: false,
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
    hasProtagonist: false,
  },
  {
    // Reescrito con base real: img_1785273260414_82 (sushi, luz de barra azul de
    // fondo), img_1785428822234_19 (pose de beber con lengua asomando, fit=8 ya
    // en outfit_night_out), img_1785428822196_6 (postre de cumpleaños, atmósfera
    // íntima). Banco: 8 imágenes de noche con comida servida en mesa de
    // restaurante — casi todas etiquetadas para day_in_life/travel, no para
    // night_out, pero el training_note de img_1785428822214_12 lo describe
    // explícitamente como "combinación de outfit de noche con comida de
    // restaurante crea un contexto de 'salida' muy útil".
    id: 'food_detail',
    contract: {
      shotId: 'food_detail',
      cameraGrammar: { framing: 'CLOSE_UP', angle: 'high_angle', composition: 'food_detail' },
      referencePolicy: { useIdentityRef: false, useBodyRef: false, useOutfitRefs: false },
      hpiPoseFamily: null,
      hpiCameraFamily: 'HIGH_ANGLE_OVERHEAD_FRAMING',
      footwearVisible: false,
    },
    sceneBlockByEnergy: {
      elegante: 'An overhead close-up of the shared food and drinks on the restaurant table — a dish, dessert, or plate at the center, glasses nearby. No person in frame, just the sensory detail of the meal, warm restaurant lighting.',
      fiesta:   'An overhead close-up of shared snacks or bar food on the table, drinks nearby, colorful venue lighting spilling into the frame. No person in frame, just the sensory detail of the moment.',
    },
    requiresCompanion: false,
    fiestaOnly: false,
    hasProtagonist: false,
  },
  {
    // Reescrito con base real: img_1785428822266_30 ("un primer plano de gesto
    // (brindis) ancla una narrativa de experiencia (cena o salida nocturna) al
    // usar un fondo atmosférico de luces de ciudad y una iluminación cálida de
    // vela" — el ejemplo más alineado con foto de referencia real compartida
    // por el usuario), img_1785436486169_48 (brindis de grupo con champán,
    // fit=9), img_1785428822263_29 (fit=8, training_note: "el choque de copas
    // es un primitive de alto valor para comunicar celebración y conexión
    // social"). Sin familia HPI real de pose para 2+ personas interactuando
    // (mismo criterio que group_moment) — se describe a mano.
    id: 'toast_moment',
    contract: {
      shotId: 'toast_moment',
      cameraGrammar: { framing: 'CLOSE_UP', angle: 'eye_level', composition: 'toast_moment' },
      referencePolicy: { useIdentityRef: true, useBodyRef: true, useOutfitRefs: true, useCompanionRef: true },
      hpiPoseFamily: null,
      footwearVisible: false,
    },
    sceneBlockByEnergy: {
      elegante: 'A close-up candid toast — her glass and a companion\'s glass clinking together in the center of the frame, hands and glasses sharply in focus, faces softly out of focus or partially visible in the background. Warm candlelight or city lights behind. A genuine celebratory beat, not posed for the camera.',
      fiesta:   'A close-up candid toast — cups or glasses clinking together between her and one or more companions, hands and drinks sharply in focus, faces softly visible under colorful venue lighting. A genuine celebratory beat, not posed for the camera.',
    },
    requiresCompanion: true,
    fiestaOnly: false,
    hasProtagonist: true,
  },
  {
    // Nuevo, reemplaza a view_moment (que estaba inventado sin respaldo real
    // como shot autónomo "de espaldas mirando el paisaje" — el banco solo
    // respalda la vista urbana como FONDO de otra pose, no como shot propio).
    // Base real: img_1785331443133_1 (pileta + fiesta + noche, "reflejo en el
    // agua añade un elemento dinámico y estético reutilizable", el tipo exacto
    // de fiesta en pileta nocturna con gente compartido por el usuario),
    // img_1785331443157_8 (fit=10, "fotografía de celular en ambiente de
    // discoteca... la interacción entre las mujeres añade una capa social
    // importante"), img_1785297196870_149 ("fondo urbano nocturno como
    // elemento clave de ambientación para la narrativa de salida nocturna").
    // Requiere companion — el patrón real es grupo, no protagonista sola.
    id: 'group_party_moment',
    contract: {
      shotId: 'group_party_moment',
      cameraGrammar: { framing: 'WIDE', angle: 'eye_level', composition: 'group_party_moment' },
      referencePolicy: { useIdentityRef: true, useBodyRef: true, useOutfitRefs: true, useCompanionRef: true },
      hpiPoseFamily: null,
      hpiCameraFamily: 'LIFESTYLE_MEDIUM_DISTANCE',
      footwearVisible: false,
    },
    sceneBlockByEnergy: {
      elegante: 'A wide candid shot of the wider social scene — her and one or more companions together in the venue, natural unposed energy, genuine interaction, each person clearly distinct in face and body. The venue itself is part of the shot, not just the people.',
      fiesta:   'A wide candid shot of the party atmosphere — her and one or more companions together, colorful lighting, maybe a pool or dance floor reflected nearby, natural unposed energy, each person clearly distinct in face and body. The venue and the crowd feeling are part of the shot, not just the people.',
    },
    requiresCompanion: true,
    fiestaOnly: false,
    hasProtagonist: true,
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
 * Selecciona `count` entradas distintas y determinísticas por seed de un
 * sub-pool dado (mismo principio que pickVariantsForSet de
 * outfitRevealBasic/renderVariants.ts), usando un namespace de hash propio
 * para no colisionar con otras llamadas sobre el mismo seed.
 */
function pickDistinctIndices(seed: string, namespace: string, count: number, poolSize: number): number[] {
  const safeCount = Math.max(0, Math.min(count, poolSize));
  const picked: number[] = [];
  const used = new Set<number>();

  for (let i = 0; i < safeCount; i++) {
    let idx = hashString(`${seed}::${namespace}::${i}`) % poolSize;
    let attempts = 0;
    while (used.has(idx) && attempts < poolSize) {
      idx = (idx + 1) % poolSize;
      attempts++;
    }
    used.add(idx);
    picked.push(idx);
  }
  return picked;
}

/**
 * Filtra el pool disponible según companion/energía, y selecciona `count`
 * entradas distintas de forma determinística por seed.
 *
 * Regla dura: máximo 1 shot sin protagonista (hasProtagonist: false) por set
 * completo. Sin este límite, el set puede quedar con la protagonista ausente
 * en 2 de 3 fotos (ej. pov_legs + ambient_only + car_transition), lo que se
 * lee como fotos de lugares/situaciones distintas en vez del dump de la
 * salida de una sola persona. Si el pool con protagonista no alcanza para
 * cubrir el resto de `count` (pool muy chico tras filtrar companion/energía),
 * se permite más de 1 sin protagonista antes que repetir una entrada — evitar
 * duplicados es más importante que el límite blando.
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

  const withProtagonist    = pool.filter(m => m.hasProtagonist);
  const withoutProtagonist = pool.filter(m => !m.hasProtagonist);

  const safeCount = Math.max(0, Math.min(count, pool.length));
  // Preferido: exactamente 1 sin protagonista (si el set tiene al menos 1
  // shot y el sub-pool sin protagonista no está vacío). Piso: lo que sobre
  // si withProtagonist no alcanza para cubrir el resto por sí solo (pool muy
  // chico tras filtrar companion/energía) — evitar duplicados manda por
  // sobre el límite blando de "máximo 1".
  const preferred = safeCount > 0 && withoutProtagonist.length > 0 ? 1 : 0;
  const floor = Math.max(0, safeCount - withProtagonist.length);
  const noProtagonistCount = Math.min(Math.max(preferred, floor), withoutProtagonist.length, safeCount);
  const protagonistSlots = safeCount - noProtagonistCount;

  const protagonistIndices    = pickDistinctIndices(seed, 'protagonist', protagonistSlots, withProtagonist.length);
  const noProtagonistIndices  = pickDistinctIndices(seed, 'no-protagonist', noProtagonistCount, withoutProtagonist.length);

  const picked = [
    ...protagonistIndices.map(idx => withProtagonist[idx]),
    ...noProtagonistIndices.map(idx => withoutProtagonist[idx]),
  ];

  // Reordenar de forma determinística (no agrupar todos los "sin
  // protagonista" al final) usando el mismo hash de orden relativo por seed.
  return picked
    .map((moment, i) => ({ moment, key: hashString(`${seed}::order::${moment.id}::${i}`) }))
    .sort((a, b) => a.key - b.key)
    .map(({ moment }) => moment);
}

export function findNightMoment(id: NightMomentId): NightMoment {
  const moment = NIGHT_MOMENTS.find(m => m.id === id);
  if (!moment) throw new Error(`NightMoment desconocido: ${id}`);
  return moment;
}
