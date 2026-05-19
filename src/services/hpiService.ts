// ─── Human Performance Intelligence (HPI) Service ────────────
// Carga los bancos HPI (hombre/mujer) y expone funciones para
// construir bloques de dirección humana que se inyectan como
// capa adicional en los prompts de generación de Campaign.
//
// QUÉ HACE: transfiere conducta visual humana — expresión,
// pose, gesto, cámara, performance. NO copia identidades.
//
// Fallback silencioso: si los JSON no cargan, buildHpiBlock()
// devuelve cadena vacía y el módulo sigue funcionando normal.

// ─── Tipos ────────────────────────────────────────────────────

interface HpiPromptBlocks {
  basePromptBlock?:  string;
  safePromptBlock?:  string;
  antiFlatPromptBlock?: string;
  antiStiffPromptBlock?: string;
}

interface HpiRiskEntry {
  riskType:  string;
  frequency: number;
}

interface HpiFamily {
  familyId:           string;
  quality?:           string; // "stable_family" | "emerging" | etc.
  mechanics?: {
    summary?:         string;
    baseDirectives?:  string;
    riskMitigation?:  string;
  };
  promptBlocks?:      HpiPromptBlocks;
  riskProfile?: {
    topRiskTypes?:       HpiRiskEntry[];
    negativePromptHints?: string[];
  };
  compatibleFamilies?: string[];
  amplifierHints?: Array<{ amplifierId: string; promptPhrase: string; frequency: number }>;
}

interface HpiDirectorRules {
  expressionBanks?:         HpiFamily[];
  poseBanks?:               HpiFamily[];
  gestureBanks?:            HpiFamily[];
  cameraRelationshipBanks?: HpiFamily[];
  performanceBanks?:        HpiFamily[];
  amplifierBanks?:          HpiFamily[];
  riskRules?:               Array<{ riskType: string; negativePromptHints?: string[]; globalSafeguards?: string[] }>;
  compatibilityMatrix?:     Array<{ primary: string; compatible: string[] }>;
  globalPrinciples?:        string[];
}

export type HpiGender = 'female' | 'male' | 'neutral';

export interface HpiConfig {
  enabled:    boolean;
  gender:     HpiGender;
  modoVisual: 'ugc' | 'editorial';
  includeGesture:     boolean;
  includePerformance: boolean;
}

// ─── Estado interno ────────────────────────────────────────────

let _female: HpiDirectorRules = {};
let _male:   HpiDirectorRules = {};
let _loaded  = false;

async function ensureLoaded(): Promise<void> {
  if (_loaded) return;
  _loaded = true;
  try {
    const mod = await import('../data/HPI/03_reglas_director_hpi_mujer_151.json');
    _female = (mod.default ?? mod) as unknown as HpiDirectorRules;
  } catch {
    _female = {};
  }
  try {
    const mod = await import('../data/HPI/03_reglas_director_hpi_51 hombre.json');
    _male = (mod.default ?? mod) as unknown as HpiDirectorRules;
  } catch {
    _male = {};
  }
}

export function initHpiService(): void {
  ensureLoaded().catch(() => {});
}

// ─── Helpers internos ─────────────────────────────────────────

function getBank(gender: HpiGender): HpiDirectorRules {
  if (gender === 'male')   return _male;
  if (gender === 'female') return _female;
  // neutral: mezcla — expresión de female, pose de male
  return _female;
}

// Elige una familia del banco: preferencia por stable_family,
// selección aleatoria dentro de ese subconjunto.
function pickFamily(bank: HpiFamily[] | undefined): HpiFamily | null {
  if (!bank || bank.length === 0) return null;
  const stable = bank.filter(f => f.quality === 'stable_family');
  const pool   = stable.length > 0 ? stable : bank;
  return pool[Math.floor(Math.random() * pool.length)];
}

// Extrae el texto de prompt más compacto de una familia.
// Prioriza basePromptBlock, truncado a 3 líneas.
function extractPromptText(family: HpiFamily | null): string {
  if (!family) return '';
  const raw =
    family.promptBlocks?.basePromptBlock ??
    family.mechanics?.baseDirectives ??
    family.mechanics?.summary ??
    '';
  if (!raw) return '';
  // Máximo 3 frases para no saturar el prompt
  const sentences = raw.split(/\.\s+/).slice(0, 3).join('. ').trim();
  return sentences.endsWith('.') ? sentences : sentences + '.';
}

function extractNegatives(family: HpiFamily | null): string[] {
  if (!family) return [];
  return family.riskProfile?.negativePromptHints ?? [];
}

function extractSafeGuards(family: HpiFamily | null): string[] {
  if (!family) return [];
  const safe = family.promptBlocks?.safePromptBlock ?? '';
  if (!safe) return [];
  // Separado por punto y coma en el JSON
  return safe.split(';').map(s => s.trim()).filter(Boolean).slice(0, 2);
}

// ─── API pública ───────────────────────────────────────────────

export function buildHpiBlock(config: HpiConfig): string {
  if (!config.enabled) return '';

  const bank = getBank(config.gender);

  // Banco de pose: para neutral usar male (más estructurado)
  const posebank = config.gender === 'neutral' ? _male : bank;

  const expressionFamily   = pickFamily(bank.expressionBanks);
  const poseFamily         = pickFamily(posebank.poseBanks);
  const cameraFamily       = pickFamily(bank.cameraRelationshipBanks);
  const gestureFamily      = config.includeGesture     ? pickFamily(bank.gestureBanks)     : null;
  const performanceFamily  = config.includePerformance ? pickFamily(bank.performanceBanks)  : null;

  // Elegir 1-2 amplificadores del banco
  const amplifiers = (bank.amplifierBanks ?? []).slice(0, 2)
    .map(a => a.mechanics?.summary ?? a.familyId)
    .filter(Boolean);

  const expressionText  = extractPromptText(expressionFamily);
  const poseText        = extractPromptText(poseFamily);
  const cameraText      = extractPromptText(cameraFamily);
  const gestureText     = extractPromptText(gestureFamily);
  const performanceText = extractPromptText(performanceFamily);
  const ampText         = amplifiers.slice(0, 2).join(' · ');

  // Si no hay ningún texto útil, devolver vacío sin ensuciar el prompt
  if (!expressionText && !poseText && !cameraText) return '';

  const sections: string[] = [];

  if (expressionText)  sections.push(`EXPRESSION: ${expressionText}`);
  if (poseText)        sections.push(`BODY POSE: ${poseText}`);
  if (gestureText)     sections.push(`GESTURE: ${gestureText}`);
  if (cameraText)      sections.push(`CAMERA RELATIONSHIP: ${cameraText}`);
  if (performanceText) sections.push(`PERFORMANCE INTENT: ${performanceText}`);
  if (ampText)         sections.push(`VISUAL AMPLIFIERS: ${ampText}`);

  // Añadir safeguards de las familias con gestos (mayor riesgo anatómico)
  const safeguards = [
    ...extractSafeGuards(gestureFamily),
    ...extractSafeGuards(expressionFamily),
  ].slice(0, 2);
  if (safeguards.length > 0) {
    sections.push(`ANATOMICAL SAFEGUARDS: ${safeguards.join(' ')}`);
  }

  return [
    '══════════════════════════════════════════════════',
    '✦ HUMAN PERFORMANCE INTELLIGENCE (HPI) LAYER',
    '══════════════════════════════════════════════════',
    'This layer guides human expression, pose, gesture, and camera',
    'relationship ONLY. It does NOT override identity locks, product',
    'locks, or outfit locks defined elsewhere in this prompt.',
    'Transfer visual conduct — NOT identity, face, body, or clothing.',
    '',
    ...sections,
    '══════════════════════════════════════════════════',
  ].join('\n');
}

// Devuelve los negative prompts específicos de riesgo HPI
// para concatenar al NEGATIVE_BASE / NEGATIVE_UGC existente.
export function getHpiNegatives(gender: HpiGender = 'female'): string[] {
  const bank  = getBank(gender);
  const rules = bank.riskRules ?? [];

  const hints: string[] = [];

  // Recoger hints de las riskRules globales del banco
  for (const rule of rules) {
    if (rule.negativePromptHints) hints.push(...rule.negativePromptHints);
    if (rule.globalSafeguards)    hints.push(...rule.globalSafeguards);
  }

  // Negativos fijos de alta frecuencia que aplican siempre
  const always = [
    'extra fingers', 'missing fingers', 'merged fingers', 'wrong number of fingers',
    'deformed hands', 'dead eyes', 'frozen expression', 'stiff pose',
    'exaggerated pout', 'duck lips', 'fake smile', 'mannequin expression',
    'disconnected body parts', 'distorted proportions',
  ];

  // Deduplicate
  const all = Array.from(new Set([...always, ...hints]));
  return all.slice(0, 20); // cap para no inflar el negative prompt
}
