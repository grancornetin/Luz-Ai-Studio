// ─── Campaign UGC Visual Intelligence ────────────────────────
// Carga los JSON de entrenamiento UGC (banco original + banco v2)
// y expone funciones para enriquecer prompts de Gemini con
// patrones visuales UGC.
// Expone familias ugc_core y editorial — story_support y
// creator_aesthetic se reservan para Photodump.
//
// OJO con "editorial": en este banco NO significa fotografía de
// revista/estudio. Es UGC real con más cuidado de luz y pose —
// la creadora sabe que la cámara la está viendo. Sigue siendo UGC,
// solo más pulido. Por eso se lo etiqueta "[polished UGC]" en el
// bloque de prompt en vez de tratarlo como una categoría aparte.
//
// Fallback silencioso si los JSON faltan.

import type { CampaignPiece } from './types';
import type { VisualFamily } from './campaignIntelligence';

// ─── Carga segura de JSON ─────────────────────────────────────
// El banco UGC crece agregando archivos "_v2", "_v3", etc. — cada
// nuevo archivo se suma a las mismas listas de abajo, sin tocar
// los anteriores. Los getters fusionan todo automáticamente.

let _directorRulesBanks: Record<string, unknown>[] = [];
let _familyBriefsBanks: Record<string, unknown>[] = [];
let _loaded = false;

const DIRECTOR_RULES_SOURCES = [
  () => import('../../data/trainer/inteligencia ugc/campaign_director_rules_ugc.json'),
  () => import('../../data/trainer/inteligencia ugc/campaign_director_rules_ugc_v2.json'),
];

const FAMILY_BRIEFS_SOURCES = [
  () => import('../../data/trainer/inteligencia ugc/visual_family_briefs_ugc.json'),
  () => import('../../data/trainer/inteligencia ugc/visual_family_briefs_ugc_v2.json'),
];

async function ensureLoaded(): Promise<void> {
  if (_loaded) return;
  _loaded = true;

  const rules = await Promise.all(
    DIRECTOR_RULES_SOURCES.map(async load => {
      try {
        const mod = await load();
        return (mod.default ?? mod) as Record<string, unknown>;
      } catch {
        return {};
      }
    })
  );
  _directorRulesBanks = rules;

  const briefs = await Promise.all(
    FAMILY_BRIEFS_SOURCES.map(async load => {
      try {
        const mod = await load();
        return (mod.default ?? mod) as Record<string, unknown>;
      } catch {
        return {};
      }
    })
  );
  _familyBriefsBanks = briefs;
}

// ─── Fusión de familias sin duplicar por ID ───────────────────
// Prioridad: visualBanks de todos los director_rules primero,
// luego families de todos los family_briefs — solo se agregan
// familias cuyo ID todavía no apareció.

function collectAllUgcFamilies(): VisualFamily[] {
  const byId = new Map<string, VisualFamily>();

  for (const bank of _directorRulesBanks) {
    const banks = (bank as any)?.visualBanks;
    if (Array.isArray(banks)) {
      for (const f of banks as VisualFamily[]) {
        const id = f.id ?? f.familyId;
        if (id && !byId.has(id)) byId.set(id, f);
      }
    }
  }

  for (const brief of _familyBriefsBanks) {
    const families = (brief as any)?.families;
    if (Array.isArray(families)) {
      for (const f of families as VisualFamily[]) {
        const id = f.id ?? f.familyId;
        if (id && !byId.has(id)) byId.set(id, f);
      }
    }
  }

  return Array.from(byId.values());
}

// ─── API pública ──────────────────────────────────────────────

// Puntaje de calidad para ordenar familias cuando hay más candidatas
// que espacio en el prompt. Prioriza performanceFamilyValue.avgScore
// (0-100, ya normalizado) y cae a intelligenceScores como respaldo.
function familyQualityScore(f: VisualFamily): number {
  const perf = (f as any).performanceFamilyValue?.avgScore;
  if (typeof perf === 'number') return perf;
  const training = (f as any).intelligenceScores?.avgTrainingValueScore;
  if (typeof training === 'number') return training;
  return 0;
}

export function getUgcVisualFamilies(): VisualFamily[] {
  return collectAllUgcFamilies()
    .filter(f => f.usageClass === 'ugc_core' || f.usageClass === 'editorial')
    .sort((a, b) => familyQualityScore(b) - familyQualityScore(a));
}

export function getUgcFamilyById(id: string): VisualFamily | undefined {
  return getUgcVisualFamilies().find(f => (f.id ?? f.familyId) === id);
}

export function initUgcIntelligence(): void {
  ensureLoaded().catch(() => {});
}

// ─── Bloque de inteligencia UGC para Gemini ───────────────────
// Devuelve texto compacto con las familias ugc_core/editorial para
// insertar en el prompt de planificación cuando modoVisual === 'ugc'.

export function buildUgcIntelligencePromptBlock(): string {
  const families = getUgcVisualFamilies();
  if (families.length === 0) return '';

  // Máximo 7 familias para no saturar el prompt. Ya vienen ordenadas
  // por calidad (familyQualityScore), así que el slice toma las mejores
  // de todo el banco combinado (original + v2, ugc_core + editorial).
  const top = families.slice(0, 7);

  const lines: string[] = [
    '═══════════════════════════════════════════════════',
    'VISUAL INTELLIGENCE — UGC FAMILY LIBRARY',
    '═══════════════════════════════════════════════════',
    'These families represent trained UGC visual patterns — real creator behavior.',
    'Use them as creative direction, NOT as literal copy.',
    'Some families are tagged "[polished UGC]" — this does NOT mean studio/magazine',
    'editorial photography. It means the same authentic UGC creator, but with more',
    'deliberate lighting and a pose that shows camera-awareness. Still real, still UGC.',
    'Assign visualFamilyId to each piece using ONLY the IDs listed here.',
    'If unsure, leave visualFamilyId empty — never invent an ID.',
    '',
  ];

  for (const f of top) {
    const id = f.id ?? f.familyId ?? '';
    const name = f.name ?? f.familyName ?? id;
    const def = f.definition ?? f.strategicSummary ?? '';
    const intent = f.commercialIntentDNA?.primaryIntent ?? '';
    const stages = f.commercialIntentDNA?.purchaseStages?.join(', ') ?? '';
    const roles = f.campaignRoles?.recommendedRoles?.join(', ') ?? '';
    const channels = f.channelFit?.recommendedChannels?.slice(0, 3).join(', ') ?? '';
    const mechanisms = (f.psychologicalMechanisms ?? f.commercialIntentDNA?.psychologicalMechanisms ?? []).slice(0, 3).join(', ');
    const blend = typeof f.blendDirective === 'string'
      ? f.blendDirective
      : (f.blendDirective as any)?.blendDirective ?? '';
    const polishedTag = f.usageClass === 'editorial' ? ' [polished UGC]' : '';

    lines.push(`▸ ID: ${id}${polishedTag}`);
    lines.push(`  Name: ${name}`);
    if (def) lines.push(`  Definition: ${def}`);
    if (intent) lines.push(`  Commercial intent: ${intent}`);
    if (stages) lines.push(`  Purchase stages: ${stages}`);
    if (roles) lines.push(`  Campaign roles: ${roles}`);
    if (channels) lines.push(`  Best channels: ${channels}`);
    if (mechanisms) lines.push(`  Psychological triggers: ${mechanisms}`);
    if (blend) lines.push(`  Blend directive: ${blend}`);
    lines.push('');
  }

  lines.push(
    'INSTRUCTIONS FOR EACH PIECE:',
    '- Set "visualFamilyId" to the ID of the best-matching UGC family.',
    '- Set "psychologicalGoal" to one clear commercial/psychological goal for that piece.',
    '- Only use IDs that appear in the list above.',
    '- If no family fits, leave visualFamilyId as empty string.',
    '═══════════════════════════════════════════════════',
  );

  return lines.join('\n');
}

// ─── Obtener familia UGC más frecuente en un plan ─────────────
export function getTopUgcFamilyFromPieces(pieces: CampaignPiece[]): VisualFamily | undefined {
  const counts: Record<string, number> = {};
  for (const p of pieces) {
    const id = (p as any).visualFamilyId as string | undefined;
    if (id) counts[id] = (counts[id] ?? 0) + 1;
  }
  const topId = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
  return topId ? getUgcFamilyById(topId) : undefined;
}
