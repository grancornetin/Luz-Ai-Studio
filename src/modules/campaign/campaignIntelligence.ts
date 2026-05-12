// ─── Campaign Visual Intelligence ─────────────────────────────
// Carga los JSON de entrenamiento editorial y expone funciones
// para enriquecer los prompts de Gemini con patrones visuales
// aprendidos. Todo fallback es silencioso — Campaign sigue
// funcionando aunque los JSON no existan o estén vacíos.

import type { CampaignPiece } from './types';

// ─── Tipos mínimos ────────────────────────────────────────────

export interface VisualFamily {
  id?: string;
  familyId?: string;
  name?: string;
  familyName?: string;
  compatibleModoVisual?: 'ugc' | 'editorial' | string;
  definition?: string;
  strategicSummary?: string;
  commercialIntentDNA?: {
    primaryIntent?: string;
    purchaseStages?: string[];
    visualRoles?: string[];
    psychologicalMechanisms?: string[];
  };
  intelligenceProfile?: {
    trustScore?: number;
    luxuryScore?: number;
    tactileScore?: number;
  };
  psychologicalMechanisms?: string[];
  campaignRoles?: {
    recommendedRoles?: string[];
    hookStrength?: number;
    conversionStrength?: number;
  };
  channelFit?: {
    recommendedChannels?: string[];
    [key: string]: unknown;
  };
  subfamilies?: Array<{ id?: string; label?: string; campaignHint?: string }>;
  blendDirective?: string | {
    blendDirective?: string;
    campaignUsage?: { recommendedRoles?: string[]; recommendedChannels?: string[] };
  };
  promptBlock?: string;
  anchorPromptBlock?: string;
  promptBlocks?: {
    basePromptBlock?: string;
    anchorPromptBlock?: string;
  };
  visualDirectives?: string[];
  avoid?: string[];
  negativePromptHints?: string[];
}

// ─── Carga segura de JSON ─────────────────────────────────────
// Vite soporta import de JSON nativamente. Usamos dynamic import
// con fallback a objeto vacío si algo falla.

let _directorRules: Record<string, unknown> = {};
let _familyBriefs: Record<string, unknown> = {};
let _loaded = false;

async function ensureLoaded(): Promise<void> {
  if (_loaded) return;
  _loaded = true;
  try {
    const mod = await import('../../data/trainer/campaign_director_rules.json');
    _directorRules = (mod.default ?? mod) as Record<string, unknown>;
  } catch {
    _directorRules = {};
  }
  try {
    const mod = await import('../../data/trainer/visual_family_briefs.json');
    _familyBriefs = (mod.default ?? mod) as Record<string, unknown>;
  } catch {
    _familyBriefs = {};
  }
}

// ─── API pública ──────────────────────────────────────────────

export function getDirectorRules(): Record<string, unknown> {
  return _directorRules;
}

export function getVisualFamilies(): VisualFamily[] {
  // Fuente 1: campaign_director_rules.json → visualBanks
  const banks = (_directorRules as any)?.visualBanks;
  if (Array.isArray(banks) && banks.length > 0) {
    return banks as VisualFamily[];
  }
  // Fuente 2: visual_family_briefs.json → families
  const families = (_familyBriefs as any)?.families;
  if (Array.isArray(families) && families.length > 0) {
    return families as VisualFamily[];
  }
  return [];
}

export function getFamilyById(id: string): VisualFamily | undefined {
  return getVisualFamilies().find(f => (f.id ?? f.familyId) === id);
}

export function getFamiliesByModoVisual(modo: 'ugc' | 'editorial' | string): VisualFamily[] {
  return getVisualFamilies().filter(f => !f.compatibleModoVisual || f.compatibleModoVisual === modo);
}

export function getEditorialFamilies(): VisualFamily[] {
  return getFamiliesByModoVisual('editorial');
}

// ─── Inicializar en background ────────────────────────────────
// Se llama una vez al arrancar para cargar los JSON sin bloquear.
export function initCampaignIntelligence(): void {
  ensureLoaded().catch(() => {});
}

// ─── Bloque de inteligencia para Gemini ───────────────────────
// Devuelve texto compacto con las familias editoriales relevantes
// para insertar en el prompt de planificación.

export function buildCampaignIntelligencePromptBlock(modoVisual?: string): string {
  const families = modoVisual
    ? getFamiliesByModoVisual(modoVisual)
    : getEditorialFamilies();

  if (families.length === 0) return '';

  // Máximo 7 familias para no saturar el prompt
  const top = families.slice(0, 7);

  const lines: string[] = [
    '═══════════════════════════════════════════════════',
    'VISUAL INTELLIGENCE — EDITORIAL FAMILY LIBRARY',
    '═══════════════════════════════════════════════════',
    'These families represent trained editorial visual patterns.',
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
    '- Set "visualFamilyId" to the ID of the best-matching family.',
    '- Set "psychologicalGoal" to one clear commercial/psychological goal for that piece.',
    '- Only use IDs that appear in the list above.',
    '- If no family fits, leave visualFamilyId as empty string.',
    '═══════════════════════════════════════════════════',
  );

  return lines.join('\n');
}

// ─── Obtener familia más frecuente en un plan ─────────────────
export function getTopFamilyFromPieces(pieces: CampaignPiece[]): VisualFamily | undefined {
  const counts: Record<string, number> = {};
  for (const p of pieces) {
    const id = (p as any).visualFamilyId as string | undefined;
    if (id) counts[id] = (counts[id] ?? 0) + 1;
  }
  const topId = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
  return topId ? getFamilyById(topId) : undefined;
}

// ─── Extraer texto del blendDirective normalizado ─────────────
export function extractBlendText(f: VisualFamily): string {
  if (!f.blendDirective) return f.strategicSummary ?? f.definition ?? '';
  if (typeof f.blendDirective === 'string') return f.blendDirective;
  return (f.blendDirective as any).blendDirective ?? f.strategicSummary ?? '';
}

// ─── Extraer prompt block transferible ───────────────────────
export function extractBasePromptBlock(f: VisualFamily): string {
  return (
    f.promptBlocks?.basePromptBlock ??
    f.promptBlock ??
    (Array.isArray(f.visualDirectives) ? f.visualDirectives.slice(0, 3).join(' · ') : '') ??
    ''
  );
}

// ─── Extraer anchor prompt block ─────────────────────────────
export function extractAnchorPromptBlock(f: VisualFamily): string {
  return (
    f.promptBlocks?.anchorPromptBlock ??
    f.anchorPromptBlock ??
    extractBlendText(f)
  );
}

// ─── Extraer guardrails compactos (máx 6) ────────────────────
export function extractGuardrails(f: VisualFamily): string[] {
  const hints = f.negativePromptHints ?? [];
  const avoids = (f.avoid ?? []).map(a => {
    // Limpiar el prefijo "Evitar: tipo_risk: " para dejar solo la descripción corta
    const colonIdx = a.indexOf(': ', a.indexOf(': ') + 1);
    return colonIdx !== -1 ? a.slice(0, colonIdx).replace('Evitar: ', '').trim() : a;
  });
  return [...hints, ...avoids].slice(0, 6);
}
