// ─── Campaign UGC Visual Intelligence ────────────────────────
// Carga los JSON de entrenamiento UGC y expone funciones para
// enriquecer prompts de Gemini con patrones visuales UGC.
// Solo expone familias ugc_core — story_support y creator_aesthetic
// se reservan para Photodump. Fallback silencioso si los JSON faltan.

import type { CampaignPiece } from './types';
import type { VisualFamily } from './campaignIntelligence';

// ─── Carga segura de JSON ─────────────────────────────────────

let _directorRulesUgc: Record<string, unknown> = {};
let _familyBriefsUgc: Record<string, unknown> = {};
let _loaded = false;

async function ensureLoaded(): Promise<void> {
  if (_loaded) return;
  _loaded = true;
  try {
    const mod = await import('../../data/trainer/inteligencia ugc/campaign_director_rules_ugc.json');
    _directorRulesUgc = (mod.default ?? mod) as Record<string, unknown>;
  } catch {
    _directorRulesUgc = {};
  }
  try {
    const mod = await import('../../data/trainer/inteligencia ugc/visual_family_briefs_ugc.json');
    _familyBriefsUgc = (mod.default ?? mod) as Record<string, unknown>;
  } catch {
    _familyBriefsUgc = {};
  }
}

// ─── API pública ──────────────────────────────────────────────

export function getUgcVisualFamilies(): VisualFamily[] {
  // Fuente 1: campaign_director_rules_ugc.json → visualBanks
  const banks = (_directorRulesUgc as any)?.visualBanks;
  if (Array.isArray(banks) && banks.length > 0) {
    return (banks as VisualFamily[]).filter(f => f.usageClass === 'ugc_core');
  }
  // Fuente 2: visual_family_briefs_ugc.json → families
  const families = (_familyBriefsUgc as any)?.families;
  if (Array.isArray(families) && families.length > 0) {
    return (families as VisualFamily[]).filter(f => f.usageClass === 'ugc_core');
  }
  return [];
}

export function getUgcFamilyById(id: string): VisualFamily | undefined {
  return getUgcVisualFamilies().find(f => (f.id ?? f.familyId) === id);
}

export function initUgcIntelligence(): void {
  ensureLoaded().catch(() => {});
}

// ─── Bloque de inteligencia UGC para Gemini ───────────────────
// Devuelve texto compacto con las familias ugc_core para insertar
// en el prompt de planificación cuando modoVisual === 'ugc'.

export function buildUgcIntelligencePromptBlock(): string {
  const families = getUgcVisualFamilies();
  if (families.length === 0) return '';

  // Máximo 7 familias para no saturar el prompt
  const top = families.slice(0, 7);

  const lines: string[] = [
    '═══════════════════════════════════════════════════',
    'VISUAL INTELLIGENCE — UGC FAMILY LIBRARY',
    '═══════════════════════════════════════════════════',
    'These families represent trained UGC visual patterns — real creator behavior.',
    'Use them as creative direction, NOT as literal copy.',
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

    lines.push(`▸ ID: ${id}`);
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
