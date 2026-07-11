/**
 * recipes/dayInLife.ts
 * Receta day_in_life — "Un día en mi vida".
 *
 * Única receta MULTI-MUNDO del módulo: el brief puede describir varios
 * momentos/lugares del día (ej: "gym en la mañana, oficina, cena con amigas"),
 * cada uno con su propia escena — a diferencia de outfit_check/outfit_haul/
 * outfit_week/product_haul/unboxing, que asumen un único mundo físico anclado
 * por un solo REF0 para todo el set.
 *
 * Arquitectura (análoga a weeklyFavoritesV2/index.ts — 3 funciones con la
 * misma forma que el resto de recetas para que el Director pueda despachar
 * sin cambiar su contrato hacia PhotodumpModule.tsx):
 *   1. parseDayBlocks(brief) — heurística de texto local (sin LLM, mismo
 *      enfoque que recipes/briefTags.ts) que segmenta el brief en 1-3 bloques.
 *   2. generateDayInLifeRef0Chain — genera un REF0 POR BLOQUE, cada uno
 *      encadenado al anterior (avatar original + REF0 previo) para mantener
 *      identidad sin heredar la escena física del bloque anterior.
 *   3. buildDayInLifeShotPlan — coverage obligatoria (cada bloque detectado
 *      recibe ≥1 shot) + roles narrativos por bloque (ESTABLISH/DETAIL/
 *      AMBIENCE/COMPANION), mismo patrón de 2 fases que product_haul pero
 *      organizado por bloque en vez de por producto.
 */
import { imageApiService } from '../../../services/imageApiService';
import { ugcApiService } from '../../../services/ugcApiService';
import {
  prepareRefs, getAspectRatio, NEGATIVE_SHORT,
  buildSceneFingerprint, SceneFingerprint, PhotodumpShotDirective, PhotodumpREF0Result,
} from './shared';
import {
  PhotodumpRefs, PhotodumpNarrative, PhotodumpProtagonist, PhotodumpDestino,
  DayBlock, DayBlockShotRole, DayInLifeManifest, DayInLifeCoveragePlan,
  DayBlockCoverageLedgerItem, OutfitBriefContext,
} from '../types';

// ── 1. Detección de bloques desde el brief (heurística local, sin LLM) ─────
// Mismo enfoque que recipes/briefTags.ts: listas de keywords + separadores de
// texto, sin llamada a backend. Si el brief no describe momentos separables,
// colapsa a 1 solo bloque — el resto del pipeline no necesita rama especial
// para el caso single-world, es simplemente N=1.

const TIME_KEYWORDS: Record<string, OutfitBriefContext['timeSignal']> = {
  'mañana': 'morning', 'manana': 'morning', 'amanecer': 'morning',
  'mediodía': 'day', 'mediodia': 'day', 'almuerzo': 'day',
  'tarde': 'afternoon',
  'atardecer': 'golden_hour', 'golden hour': 'golden_hour', 'dorada': 'golden_hour',
  'noche': 'night', 'cena': 'night', 'nocturna': 'night',
};

// Palabras/lugares que típicamente marcan un momento distinto del día —
// usadas como pistas de segmentación además de los separadores de lista.
const MOMENT_HINT_WORDS = [
  'gym', 'gimnasio', 'oficina', 'trabajo', 'universidad', 'escuela', 'colegio',
  'casa', 'café', 'cafe', 'restaurante', 'cena', 'almuerzo', 'brunch',
  'shopping', 'compras', 'playa', 'parque', 'evento', 'fiesta', 'reunión', 'reunion',
  'clase', 'entrenamiento', 'rutina', 'skincare', 'maquillaje',
];

const MAX_BLOCKS = 3;

function detectTimeSignal(segment: string): OutfitBriefContext['timeSignal'] {
  const lower = segment.toLowerCase();
  for (const [kw, signal] of Object.entries(TIME_KEYWORDS)) {
    if (lower.includes(kw)) return signal;
  }
  return 'unspecified';
}

function cleanLabel(segment: string): string {
  const trimmed = segment.trim().replace(/^(en |con |el |la |mi |un |una )/i, '');
  const capped = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  return capped.length > 40 ? capped.slice(0, 40).trim() : capped;
}

export function parseDayBlocks(briefText: string): DayBlock[] {
  const brief = (briefText || '').trim();
  if (!brief) {
    return [{ id: 'block_0', label: 'Momento del día', timeSignal: 'unspecified', sceneHint: brief, order: 0 }];
  }

  // Segmentar por separadores de lista fuertes: comas, " y ", punto y coma, saltos de línea.
  // No usar espacios simples — rompería frases normales.
  const rawSegments = brief
    .split(/,|;|\n|(?:\sy\s(?=\w))/gi)
    .map(s => s.trim())
    .filter(s => s.length > 2);

  // Solo tratamos como "bloques" los segmentos que mencionan una palabra de
  // momento/lugar reconocible — evita fragmentar un brief normal en pedazos
  // sin sentido narrativo (ej: "mi día tranquilo, relajada, sin apuro" no
  // debería convertirse en 3 bloques falsos).
  const candidateSegments = rawSegments.filter(seg => {
    const lower = seg.toLowerCase();
    return MOMENT_HINT_WORDS.some(w => lower.includes(w));
  });

  if (candidateSegments.length < 2) {
    // Brief describe un solo momento (o ninguno reconocible) — colapsa a 1 bloque,
    // usando el brief completo como sceneHint. Comportamiento single-world.
    return [{ id: 'block_0', label: 'Momento del día', timeSignal: detectTimeSignal(brief), sceneHint: brief, order: 0 }];
  }

  const capped = candidateSegments.slice(0, MAX_BLOCKS);
  return capped.map((seg, i) => ({
    id:         `block_${i}`,
    label:      cleanLabel(seg),
    timeSignal: detectTimeSignal(seg),
    sceneHint:  seg,
    order:      i,
  }));
}

// ── 2. Manifest ──────────────────────────────────────────────────
// Mismo patrón de manifest+coverage que productHaul.ts, indexado por blockId
// en vez de por producto. Sin scoring de compatibilidad — cada bloque es un
// mundo independiente, no se combina con otro.

export function buildDayInLifeManifest(
  refs: PhotodumpRefs,
  requestedCount: number,
  basePrompt: string,
): DayInLifeManifest {
  const blocks = parseDayBlocks(basePrompt);
  const maxStoryShots = Math.min(requestedCount, 20);

  // Acompañante: subido por el slot producto con haulProductKinds[i] === 'acompanante'.
  // No es un producto del día — se extrae aparte y no cuenta como sharedOutfitRefs.
  const allProductUrls = [refs.productRef, ...(refs.productRefs ?? [])].filter(Boolean) as string[];
  const productKinds = refs.haulProductKinds ?? [];
  const companionRefs: string[] = [];
  const sharedProductRefs: string[] = [];
  allProductUrls.forEach((url, i) => {
    if (productKinds[i] === 'acompanante') companionRefs.push(url);
    else sharedProductRefs.push(url);
  });
  if (refs.companionRef) companionRefs.push(refs.companionRef);

  const sharedOutfitRefs = [refs.outfitRef, ...(refs.outfitRefs ?? [])].filter(Boolean) as string[];

  const ledger: DayBlockCoverageLedgerItem[] = blocks.map(b => ({
    blockId:                     b.id,
    label:                       b.label,
    required:                    true,
    plannedHeroShots:            0,
    plannedSupportShots:         0,
    actualPromptedHeroShots:     0,
    actualPromptedSupportShots:  0,
    coverageStatus:              'uncovered' as const,
    shotIds:                     [],
  }));

  const coveragePlan: DayInLifeCoveragePlan = {
    requiredBlockIds:       blocks.map(b => b.id),
    plannedCoverage:        Object.fromEntries(blocks.map(b => [b.id, 0])),
    missingCoverage:        [],
    ledger,
    uncoveredRequiredItems: [],
    supportOnlyItems:       [],
    overexposedItems:       [],
    coverageWarnings:       [],
  };

  return {
    blocks,
    companionRefs,
    sharedOutfitRefs: [...sharedOutfitRefs, ...sharedProductRefs],
    requestedCount,
    maxStoryShots,
    coveragePlan,
  };
}

// ── 3. Shot planner — coverage obligatoria + roles narrativos por bloque ──
// Fase 1: cada bloque recibe 1 BLOCK_ESTABLISH garantizado (coverage).
// Fase 2: con el budget restante, se reparte DETAIL/AMBIENCE/COMPANION en ese
// orden de prioridad, repitiendo el ciclo de bloques (no agotando un bloque
// antes de pasar al siguiente) para que el arco final alterne momentos en
// vez de agruparlos.

export function buildDayInLifeShotPlan(
  manifest: DayInLifeManifest,
): Omit<PhotodumpShotDirective, 'arcPosition' | 'aspectRatio'>[] {
  const total = manifest.maxStoryShots;
  const hasCompanion = manifest.companionRefs.length > 0;

  const ledgerMap = new Map<string, DayBlockCoverageLedgerItem>(
    manifest.coveragePlan.ledger.map(l => [l.blockId, { ...l }]),
  );
  const addHeroShot = (blockId: string, shotKey: string) => {
    const l = ledgerMap.get(blockId);
    if (l) { l.plannedHeroShots++; l.shotIds.push(shotKey); l.coverageStatus = 'covered'; }
  };
  const addSupportShot = (blockId: string, shotKey: string) => {
    const l = ledgerMap.get(blockId);
    if (l) { l.plannedSupportShots++; l.shotIds.push(shotKey); }
  };

  type PlannedShot = Omit<PhotodumpShotDirective, 'arcPosition' | 'aspectRatio'> & { blockId: string; role: DayBlockShotRole };

  // ── FASE 1 — coverage obligatoria: 1 BLOCK_ESTABLISH por bloque ──────────
  const establishShots: PlannedShot[] = manifest.blocks.map((block, idx) => {
    const shot = buildDayBlockShot(block, 'BLOCK_ESTABLISH', idx, manifest.blocks.length, hasCompanion);
    addHeroShot(block.id, shot.key);
    return shot;
  });

  // ── FASE 2 — budget narrativo: DETAIL → AMBIENCE → COMPANION, alternando bloques ──
  const remainingBudget = Math.max(0, total - establishShots.length);
  const extraShots: PlannedShot[] = [];

  const rolesCycle: DayBlockShotRole[] = hasCompanion
    ? ['BLOCK_DETAIL', 'BLOCK_COMPANION', 'BLOCK_AMBIENCE']
    : ['BLOCK_DETAIL', 'BLOCK_AMBIENCE'];

  let roleCursor = 0;
  let blockCursor = 0;
  for (let i = 0; i < remainingBudget; i++) {
    const block = manifest.blocks[blockCursor % manifest.blocks.length];
    const role  = rolesCycle[roleCursor % rolesCycle.length];
    const shot  = buildDayBlockShot(block, role, blockCursor, manifest.blocks.length, hasCompanion);
    addSupportShot(block.id, shot.key);
    extraShots.push(shot);
    blockCursor++;
    // Solo avanza el rol cuando completó una vuelta de bloques — así cada
    // bloque recibe su DETAIL antes de que ningún bloque reciba su segunda ronda.
    if (blockCursor % manifest.blocks.length === 0) roleCursor++;
  }

  // Interleaving final: alternar ESTABLISH de cada bloque con sus extras
  // correspondientes en vez de poner todos los ESTABLISH primero — el orden
  // final del arco mezcla bloques, no los agrupa en bloques consecutivos.
  const interleaved: PlannedShot[] = [];
  const extrasByBlock = new Map<string, PlannedShot[]>();
  extraShots.forEach(s => {
    const arr = extrasByBlock.get(s.blockId) ?? [];
    arr.push(s);
    extrasByBlock.set(s.blockId, arr);
  });

  establishShots.forEach(est => {
    interleaved.push(est);
    const extras = extrasByBlock.get(est.blockId) ?? [];
    if (extras.length > 0) interleaved.push(extras.shift()!);
  });
  // Cualquier extra restante (bloques con más de 1 extra) se agrega al final,
  // en orden de bloque para no romper la alternancia ya lograda arriba.
  manifest.blocks.forEach(b => {
    const remaining = extrasByBlock.get(b.id) ?? [];
    interleaved.push(...remaining);
  });

  manifest.coveragePlan.ledger = Array.from(ledgerMap.values());
  manifest.coveragePlan.uncoveredRequiredItems = manifest.coveragePlan.ledger
    .filter(l => l.required && l.plannedHeroShots === 0)
    .map(l => l.blockId);

  return interleaved.slice(0, total).map(({ blockId, ...shot }) => shot);
}

// ── Shot builders ───────────────────────────────────────────────

const ROLE_LABEL: Record<DayBlockShotRole, string> = {
  BLOCK_ESTABLISH: 'ESTABLISH',
  BLOCK_DETAIL:    'DETAIL',
  BLOCK_AMBIENCE:  'AMBIENCE',
  BLOCK_COMPANION: 'COMPANION',
};

function buildDayBlockShot(
  block:       DayBlock,
  role:        DayBlockShotRole,
  blockIndex:  number,
  totalBlocks: number,
  hasCompanion: boolean,
): Omit<PhotodumpShotDirective, 'arcPosition' | 'aspectRatio'> & { blockId: string; role: DayBlockShotRole } {
  const shotNum = blockIndex + 1;
  const key = `${ROLE_LABEL[role]}_${block.id.toUpperCase()}`;

  const variationsByRole: Record<DayBlockShotRole, string[]> = {
    BLOCK_ESTABLISH: [
      `medium shot of the person in the moment of "${block.label}", natural expression, real iPhone UGC feel`,
      `selfie-style shot capturing the person during "${block.label}", candid energy, genuine mood`,
      `person captured mid-moment during "${block.label}", authentic body language, real environment visible`,
      `close-medium portrait of the person in "${block.label}", natural light, unposed feel`,
    ],
    BLOCK_DETAIL: [
      `close-up of an object, food, drink or detail that anchors "${block.label}" — the thing that tells the story of this moment`,
      `overhead or close shot of a detail from "${block.label}" — texture, object, or small scene fragment`,
      `hands interacting with something relevant to "${block.label}", genuine candid framing`,
      `macro or close-medium shot of a meaningful detail from "${block.label}"`,
    ],
    BLOCK_AMBIENCE: [
      `wide or medium shot of the environment during "${block.label}" — no person dominant, or person small in frame`,
      `atmospheric shot of the place where "${block.label}" happens — light, mood, architecture`,
      `environmental shot capturing the mood of "${block.label}" without focusing on a person`,
      `establishing shot of the setting for "${block.label}", real and lived-in, not staged`,
    ],
    BLOCK_COMPANION: [
      `the person together with their companion during "${block.label}", genuine shared moment, both visible`,
      `candid shot of the person and their companion during "${block.label}", natural interaction`,
      `medium shot of two people together in "${block.label}", real social energy, not posed`,
      `selfie-style shot with the companion during "${block.label}", casual and warm`,
    ],
  };

  const purposeByRole: Record<DayBlockShotRole, string> = {
    BLOCK_ESTABLISH: `The protagonist shot for the "${block.label}" moment (block ${shotNum} of ${totalBlocks}). Establishes who is living this moment and how it feels.`,
    BLOCK_DETAIL:     `A detail that anchors the "${block.label}" moment in something concrete — food, an object, a texture. Not a generic close-up, something that belongs to this specific moment.`,
    BLOCK_AMBIENCE:   `The atmosphere/place of "${block.label}" — communicates where this is happening without needing the person to dominate the frame.`,
    BLOCK_COMPANION:  `A shared moment during "${block.label}" — the protagonist is not alone here.`,
  };

  const requiredElements = role === 'BLOCK_COMPANION'
    ? ['companion_visible', 'genuine_shared_moment', 'real_environment']
    : role === 'BLOCK_AMBIENCE'
      ? ['environment_clearly_readable', 'mood_consistent_with_block']
      : ['real_environment_visible', 'authentic_ugc_feel', 'no_studio_polish'];

  return {
    key,
    blockId: block.id,
    role,
    beat: role === 'BLOCK_AMBIENCE' ? 'atmosphere' : role === 'BLOCK_DETAIL' ? 'detail' : role === 'BLOCK_COMPANION' ? 'candid' : 'context',
    purpose: purposeByRole[role],
    requiredElements,
    forbiddenElements: ['studio_backdrop', 'catalog_pose', 'ad_composition', 'white_background', role === 'BLOCK_COMPANION' && !hasCompanion ? 'invented_second_person' : ''].filter(Boolean) as string[],
    variationSpace: variationsByRole[role],
    framing:     role === 'BLOCK_DETAIL' ? 'CLOSE_UP' : role === 'BLOCK_AMBIENCE' ? 'WIDE' : 'MEDIUM',
    composition: `DAY_BLOCK_${ROLE_LABEL[role]}`,
    cameraAngle: role === 'BLOCK_AMBIENCE' ? 'WIDE_ESTABLISHING' : 'EYE_LEVEL',
    hpiAllowed:  role !== 'BLOCK_AMBIENCE',
    hpiScope:    role === 'BLOCK_DETAIL' ? 'micro_action_only' : 'full',
    wearState:   'wearing_full_outfit',
    cameraMode:  role === 'BLOCK_AMBIENCE' ? 'candid_third' : role === 'BLOCK_DETAIL' ? 'detail_macro' : 'third_person',
  };
}

// ── 4. REF0 encadenado multi-bloque ─────────────────────────────
// Bloque 0: REF0 estándar (avatar + outfit/producto compartidos + sceneHint
// del bloque 0). Bloque N≥1: nueva generación que recibe avatar original +
// REF0 del bloque N-1 como referencias — misma persona, escena distinta.
// Cada REF0 se analiza individualmente → fingerprint propio por bloque.

export interface DayInLifeRef0ChainResult {
  chain:        { blockId: string; imageUrl: string; ref0Analysis: any; fingerprint: SceneFingerprint }[];
  primaryResult: PhotodumpREF0Result;  // el REF0 del bloque 0 — es el que usa el resto del pipeline como "ref0Url" legado
}

// ── Caché en memoria de la cadena de REF0 por sesión ────────────────────
// generatePhotodumpREF0 y generatePhotodumpShot son dos llamadas separadas del
// Director (ver photodumpDirectorService.ts) sin un lugar compartido para
// pasarse datos entre sí sin cambiar la firma pública que usa
// PhotodumpModule.tsx. La cadena completa (N REF0 + N fingerprints) se cachea
// usando las refs + brief como clave — así solo se genera una vez por sesión,
// y generateDayInLifeShot puede recuperar el fingerprint del bloque correcto
// para cada shot sin volver a llamar a la API de imágenes.
const ref0ChainCache = new Map<string, DayInLifeRef0ChainResult>();

function ref0ChainCacheKey(refs: PhotodumpRefs, basePrompt: string): string {
  const urls = [refs.avatarRef, refs.bodyRef, refs.sceneRef, refs.outfitRef, ...(refs.outfitRefs ?? [])].filter(Boolean);
  return `${urls.join('|')}::${basePrompt}`;
}

export function getCachedDayInLifeRef0Chain(refs: PhotodumpRefs, basePrompt: string): DayInLifeRef0ChainResult | undefined {
  return ref0ChainCache.get(ref0ChainCacheKey(refs, basePrompt));
}

export async function generateDayInLifeRef0Chain(
  manifest:      DayInLifeManifest,
  refs:          PhotodumpRefs,
  narrative:     PhotodumpNarrative,
  protagonist:   PhotodumpProtagonist,
  destino:       PhotodumpDestino,
  basePrompt:    string,
  sessionParams: { uid?: string; sessionId?: string },
): Promise<DayInLifeRef0ChainResult> {
  const avatarRefs = [refs.avatarRef, refs.bodyRef].filter(Boolean) as string[];
  const sharedRefs = manifest.sharedOutfitRefs.slice(0, 2);
  const aspectRatio = getAspectRatio(destino);
  const chain: DayInLifeRef0ChainResult['chain'] = [];

  let previousImageUrl: string | null = null;

  for (const block of manifest.blocks) {
    const isFirstBlock = previousImageUrl === null;
    const refsToPass: string[] = isFirstBlock
      ? [...avatarRefs, ...sharedRefs, ...(refs.sceneRef ? [refs.sceneRef] : [])]
      : [...avatarRefs, previousImageUrl as string];

    const prompt = isFirstBlock
      ? `ANCHOR SHOT — establishes identity, lighting, and world for the "${block.label}" moment (block 1 of ${manifest.blocks.length} in this day).
Scene context: ${block.sceneHint || basePrompt}.
Natural iPhone quality. Candid UGC feel. One photo, not a collage.`
      : `ANCHOR SHOT — new moment "${block.label}" (block ${block.order + 1} of ${manifest.blocks.length} in this day).
This is the SAME PERSON as the previous anchor image, now in a DIFFERENT place/moment: ${block.sceneHint || basePrompt}.
CRITICAL: preserve the exact identity (face, hair, skin tone, body) from the person reference — but the ENVIRONMENT must change to match this new moment. Do NOT reuse the previous room/location.
Natural iPhone quality. Candid UGC feel. One photo, not a collage.`;

    const preparedRefs = await prepareRefs(refsToPass);
    const imageUrl = await imageApiService.generateImage({
      prompt,
      negative:        NEGATIVE_SHORT,
      referenceImages: preparedRefs,
      aspectRatio,
      modelId:         'gemini',
      uid:             sessionParams.uid,
      sessionId:       sessionParams.sessionId,
      module:          'photodump',
      moduleLabel:     'Photodump Mode',
      shotIndex:       0,
      totalShots:      1,
      metadata:        { role: 'REF0_ANCHOR_DAY_BLOCK', narrative, protagonist, blockId: block.id, chainedFromPreviousBlock: !isFirstBlock },
    });

    let ref0Analysis: any = null;
    try {
      const extracted = preparedRefs[0];
      if (extracted) {
        ref0Analysis = await ugcApiService.analyzeREF0({ imageData: extracted.data, mimeType: extracted.mimeType });
      }
    } catch {
      ref0Analysis = null;
    }

    const fingerprint = buildSceneFingerprint(ref0Analysis, !!refs.sceneRef, block.sceneHint || '');

    chain.push({ blockId: block.id, imageUrl, ref0Analysis, fingerprint });
    previousImageUrl = imageUrl;
  }

  const first = chain[0];
  const result: DayInLifeRef0ChainResult = {
    chain,
    primaryResult: {
      imageUrl:     first.imageUrl,
      ref0Analysis: first.ref0Analysis,
      prompt:       `day_in_life multi-block anchor chain — ${chain.length} block(s)`,
      refsCount:    avatarRefs.length + sharedRefs.length,
    },
  };
  ref0ChainCache.set(ref0ChainCacheKey(refs, basePrompt), result);
  return result;
}

// ── 5. Scene-lock por bloque activo ─────────────────────────────
// Análogo a buildREF0HardLockBlock/buildSceneContinuityBlock de outfitCheck.ts,
// pero parametrizado por el fingerprint del bloque al que pertenece el shot
// actual — no un fingerprint global de sesión.

export function buildDayBlockLockBlock(fingerprint: SceneFingerprint, blockLabel: string): string {
  return `🏠 DAY BLOCK SCENE LOCK — "${blockLabel}" (BINDING for this shot):
This shot belongs to the "${blockLabel}" moment. The physical world for THIS moment was
established by this block's own anchor image — a DIFFERENT world than other moments in this day.

ARCHITECTURE FROZEN FOR THIS BLOCK ONLY:
  • Room/place type: ${fingerprint.roomType}
  • Dominant furniture/setting: ${fingerprint.dominantFurniture}
  • Lighting family: ${fingerprint.lightingFamily}
  • Color palette: ${fingerprint.colorPalette}
  ${fingerprint.keyProps.length > 0 ? `• Key identifying props: ${fingerprint.keyProps.join(', ')}` : ''}

STRICT: do NOT blend this block's environment with any other moment of the day. Each block
in this photodump is its own place — do NOT carry over furniture, lighting, or props from a
different block's moment into this shot.`;
}

// ── Helpers de debug ─────────────────────────────────────────────

export function buildDayInLifeCoverageDebug(manifest: DayInLifeManifest) {
  return {
    dayInLifeManifest: manifest,
    blocksDetected: manifest.blocks,
    coverageByBlock: manifest.coveragePlan.ledger,
    uncoveredRequiredItems_dayInLife: manifest.coveragePlan.uncoveredRequiredItems,
  };
}
