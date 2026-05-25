// ─── Photodump Story Intelligence ─────────────────────────────
// Lee el banco UGC y expone SOLO las familias con valor narrativo:
//   story_support   → BTS, contexto, transición, vida real
//   creator_aesthetic → flat lay, moodboard, detalle curado
//
// Estas familias NO se usan en Campaign (que usa ugc_core).
// Este servicio es de solo lectura — no modifica ningún archivo.

let _familyBriefsUgc: Record<string, unknown> = {};
let _loaded = false;

// ─── Tipos ────────────────────────────────────────────────────

export interface StorySupportFamily {
  familyId: string;
  familyName: string;
  usageClass: 'story_support' | 'creator_aesthetic';

  // Intención narrativa (reinterpretada desde commercialIntentDNA)
  primaryIntent: string;
  psychologicalMechanisms: string[];
  narrativeBehavior: string;

  // Valor narrativo — campos propios del banco UGC
  storyFamilyValue: {
    avgScore: number;
    priority: 'high' | 'medium' | 'low';
    bestStoryRoles: string[];         // story_opener, bts_frame, context_frame, mood_frame, etc.
    bestNarrativeArcs: string[];      // day_in_the_life, back_to_work, creator_essentials, etc.
    recommendedSequencePositions: string[]; // opener, early_context, bridge, transition_frame
    sampleStoryDirective: string;
  } | null;

  // Directiva narrativa lista para inyectar en prompts
  storyDirective: string | null;

  // Composición visual
  compositionPattern: {
    dominantElement: string;
    preferredShotType: string;
    preferredLighting: string;
    lightQuality: string;
    visualRhythm: string;
  } | null;

  // Bloque de prompt base (si existe)
  promptBlock: string | null;

  // Resumen corto para mostrar en UI o logs
  definition: string;

  // Subfamilias (shots concretos dentro de esta familia)
  subfamilies: Array<{
    subfamilyId: string;
    label: string;
    imageCount: number;
    campaignHint: string;
  }>;
}

// ─── Carga segura del JSON ────────────────────────────────────

async function ensureLoaded(): Promise<void> {
  if (_loaded) return;
  _loaded = true;
  try {
    const mod = await import('../../data/trainer/inteligencia ugc/visual_family_briefs_ugc.json');
    _familyBriefsUgc = (mod.default ?? mod) as Record<string, unknown>;
  } catch {
    _familyBriefsUgc = {};
  }
}

// ─── API pública ──────────────────────────────────────────────

/**
 * Devuelve las familias con valor narrativo del banco UGC.
 * Solo incluye story_support y creator_aesthetic.
 * Ordena por storyFamilyValue.avgScore descendente.
 */
export function getStorySupportFamilies(): StorySupportFamily[] {
  const raw = (_familyBriefsUgc as any)?.families;
  if (!Array.isArray(raw)) return [];

  const filtered = (raw as any[]).filter(
    (f) => f.usageClass === 'story_support' || f.usageClass === 'creator_aesthetic'
  );

  const mapped: StorySupportFamily[] = filtered.map((f) => ({
    familyId: f.familyId ?? '',
    familyName: f.familyName ?? '',
    usageClass: f.usageClass,

    primaryIntent: f.commercialIntentDNA?.primaryIntent ?? '',
    psychologicalMechanisms: f.commercialIntentDNA?.psychologicalMechanisms ?? [],
    narrativeBehavior: f.commercialIntentDNA?.narrativeBehavior ?? '',

    storyFamilyValue: f.storyFamilyValue ?? null,
    storyDirective: f.storyDirective ?? null,

    compositionPattern: f.blendDirective?.compositionPattern ?? null,

    promptBlock:
      f.promptBlocks?.basePromptBlock ??
      f.promptBlock ??
      null,

    definition: f.definition ?? '',

    subfamilies: Array.isArray(f.subfamilies)
      ? f.subfamilies.map((s: any) => ({
          subfamilyId: s.subfamilyId ?? '',
          label: s.label ?? '',
          imageCount: s.imageCount ?? 0,
          campaignHint: s.campaignHint ?? '',
        }))
      : [],
  }));

  // Ordena por avgScore del storyFamilyValue (mayor primero)
  return mapped.sort(
    (a, b) =>
      (b.storyFamilyValue?.avgScore ?? 0) - (a.storyFamilyValue?.avgScore ?? 0)
  );
}

/**
 * Devuelve una familia específica por ID.
 */
export function getStorySupportFamilyById(id: string): StorySupportFamily | undefined {
  return getStorySupportFamilies().find((f) => f.familyId === id);
}

/**
 * Filtra familias por posición en la secuencia del photodump.
 * Útil para elegir qué familia asignar a cada beat (hook/development/closing).
 *
 * position: 'opener' | 'early_context' | 'bridge' | 'transition_frame'
 */
export function getFamiliesBySequencePosition(
  position: string
): StorySupportFamily[] {
  return getStorySupportFamilies().filter((f) =>
    f.storyFamilyValue?.recommendedSequencePositions?.includes(position)
  );
}

/**
 * Filtra familias compatibles con un arco narrativo específico.
 * Útil para matching entre el narrative del photodump y las familias.
 *
 * arc: 'day_in_the_life' | 'back_to_work' | 'creator_essentials' | etc.
 */
export function getFamiliesByNarrativeArc(arc: string): StorySupportFamily[] {
  return getStorySupportFamilies().filter((f) =>
    f.storyFamilyValue?.bestNarrativeArcs?.includes(arc)
  );
}

/**
 * Inicializa la carga del banco en segundo plano.
 * Llamar una vez al montar el módulo Photodump.
 */
export function initPhotodumpIntelligence(): void {
  ensureLoaded().catch(() => {});
}
