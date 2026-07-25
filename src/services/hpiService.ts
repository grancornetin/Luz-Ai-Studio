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
  dominantTags?:       string[];
  amplifierHints?: Array<{ amplifierId: string; promptPhrase: string; frequency: number }>;
  // Solo poseBanks: qué acción genérica ya describe cada mano en el texto de
  // la pose (ej. ['on_hip', 'holds_phone']). La mayoría de las poses (20/28
  // en el banco de mujer) ya comprometen ambas manos — agregar un GESTURE
  // independiente encima arriesga describir una TERCERA acción de mano para
  // solo 2 manos reales, y el modelo de imagen resuelve la contradicción
  // generando un elemento visual extra (bug real: "brazo/objeto fantasma"
  // cerca del codo). Solución: GESTURE solo se permite si su amplifiesAction
  // coincide con una de estas acciones — así el gesto AÑADE DETALLE a una
  // mano que la pose ya describió de forma genérica, en vez de inventar una
  // acción nueva. Ver informe de causa raíz de julio 2026.
  handActions?: string[];
  // Solo gestureBanks: qué acción de handActions amplifica este gesto (debe
  // aparecer en el vocabulario compartido: on_hip, holds_phone, on_surface,
  // in_hair, holds_bag, on_thigh_or_knee, relaxed_at_side, on_face_or_social,
  // gripping_equipment, holds_object, none). 'none' = compatible con
  // cualquier pose sin amplificar nada específico (ej. NO_VISIBLE_HAND_FOCUS).
  amplifiesAction?: string;
  // Solo gestureBanks: true si el texto del gesto asume un prop externo
  // (bolso, objeto) que puede no existir en el outfit/escena real. Estos
  // gestos ya están redactados de forma condicional ("IF the outfit already
  // includes...") pero se marcan igual para posible filtrado futuro por
  // contexto de outfit real.
  dependsOnExternalProp?: boolean;
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
  // Opcional: restringe la selección de familias a IDs específicos por
  // banco, en vez de elegir entre todas al azar. Necesario cuando el resto
  // del prompt ya fija una postura concreta (ej. "de pie frente al espejo,
  // cuerpo completo") — sin esto, pickFamily puede elegir familias de
  // sentada/reclinada/piso/gimnasio que contradicen esa instrucción (bug
  // real visto en producción: HPI describía "seated on floor" / "lat
  // pulldown exercise" sobre un prompt que pedía standing mirror-selfie).
  // Cada banco tiene su propio espacio de familyId — no se comparte la
  // misma lista entre poseBanks/gestureBanks/cameraRelationshipBanks.
  allowedFamilies?: {
    pose?:    string[];
    gesture?: string[];
    camera?:  string[];
  };
  // Opcional: tags de contexto/escenario ya decididos en el resto del prompt
  // (ej. "bedroom", "mirror", "outdoor"). Cuando se pasa, pickFamily prefiere
  // familias cuyo dominantTags matchee al menos uno de estos tags antes de
  // caer al pool completo — evita que HPI describa una pose de piscina sobre
  // un prompt que ya fijó un dormitorio.
  contextTags?: string[];
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

// ─── Anti-repetición por sesión ───────────────────────────────
// Recuerda los últimos familyId usados por banco durante la sesión del tab
// (memoria de proceso — se reinicia al recargar la página). No requiere
// pasar userId a través de las ~5 cadenas de llamada distintas que consumen
// buildHpiBlock: es un efecto colateral interno, no parte de HpiConfig.
// Objetivo: bajar la probabilidad de que dos generaciones consecutivas del
// mismo usuario repitan literalmente la misma familia de pose/gesto/cámara.

const RECENT_HISTORY_SIZE = 4;
const _recentByBank: Record<string, string[]> = {};

function rememberFamily(bankKey: string, familyId: string | undefined): void {
  if (!familyId) return;
  const history = _recentByBank[bankKey] ?? (_recentByBank[bankKey] = []);
  history.push(familyId);
  if (history.length > RECENT_HISTORY_SIZE) history.shift();
}

// Expuesto para tests/debug y para módulos que quieran forzar variedad
// entre tomas de una misma tanda sin esperar al próximo build.
export function resetHpiSessionMemory(): void {
  for (const key of Object.keys(_recentByBank)) delete _recentByBank[key];
}

// ─── Helpers internos ─────────────────────────────────────────

function getBank(gender: HpiGender): HpiDirectorRules {
  if (gender === 'male')   return _male;
  if (gender === 'female') return _female;
  // neutral: mezcla — expresión de female, pose de male
  return _female;
}

interface PickFamilyOptions {
  allowedFamilyIds?: string[];
  // Restringe el pool a estos IDs si al menos uno está presente en el banco
  // (usado para compatibilidad dirigida derivada de la pose ya elegida).
  // A diferencia de allowedFamilyIds, si la intersección queda vacía se cae
  // silenciosamente al pool anterior en vez de devolver null — es una
  // preferencia, no una restricción dura como allowedFamilies del caller.
  preferFamilyIds?: string[];
  // Tags de dominantTags a preferir (contexto de escenario/outfit).
  preferTags?: string[];
  // Restricción DURA (a diferencia de preferFamilyIds/preferTags, que caen
  // sin red si la intersección da vacía): solo se aceptan familias cuyo
  // amplifiesAction esté en esta lista, o cuyo amplifiesAction sea 'none'
  // (compatible con cualquier pose). Si la intersección queda vacía, se
  // devuelve null en vez de caer al banco completo — usado para que GESTURE
  // solo añada detalle a una mano que la pose ya describió, nunca una acción
  // nueva. Este es el fix del defecto que preferFamilyIds no cubría.
  requireActionMatch?: string[];
  // Bank key para anti-repetición por sesión (ej. 'pose:female').
  sessionBankKey?: string;
}

// Elige una familia del banco con esta prioridad de filtrado:
//   1. allowedFamilyIds (restricción dura, puede devolver null)
//   2. stable_family
//   3. requireActionMatch (restricción DURA, puede devolver null — ver arriba)
//   4. preferFamilyIds (compatibilidad dirigida con la pose ya elegida — best-effort, cae sin red)
//   5. preferTags (contexto de escenario — best-effort, cae sin red)
//   6. excluir familyId usados recientemente en la sesión (anti-repetición)
function pickFamily(bank: HpiFamily[] | undefined, options: PickFamilyOptions = {}): HpiFamily | null {
  if (!bank || bank.length === 0) return null;
  const { allowedFamilyIds, preferFamilyIds, preferTags, requireActionMatch, sessionBankKey } = options;

  const scoped = allowedFamilyIds
    ? bank.filter(f => allowedFamilyIds.includes(f.familyId))
    : bank;
  if (scoped.length === 0) return null;

  const stable = scoped.filter(f => f.quality === 'stable_family');
  let pool = stable.length > 0 ? stable : scoped;

  if (requireActionMatch) {
    pool = pool.filter(f =>
      f.amplifiesAction === 'none' || (f.amplifiesAction != null && requireActionMatch.includes(f.amplifiesAction))
    );
    if (pool.length === 0) return null;
  }

  if (preferFamilyIds && preferFamilyIds.length > 0) {
    const compatible = pool.filter(f => preferFamilyIds.includes(f.familyId));
    if (compatible.length > 0) pool = compatible;
  }

  if (preferTags && preferTags.length > 0) {
    const tagged = pool.filter(f =>
      (f.dominantTags ?? []).some(tag => preferTags.includes(tag))
    );
    if (tagged.length > 0) pool = tagged;
  }

  if (sessionBankKey) {
    const recent = _recentByBank[sessionBankKey] ?? [];
    const fresh = pool.filter(f => !recent.includes(f.familyId));
    if (fresh.length > 0) pool = fresh;
  }

  const chosen = pool[Math.floor(Math.random() * pool.length)];
  if (sessionBankKey) rememberFamily(sessionBankKey, chosen?.familyId);
  return chosen;
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
  const sessionScope = `${config.gender}`;
  const contextTags = config.contextTags;

  // Pose se elige primero: es el ancla del resto de la selección.
  const poseFamily = pickFamily(posebank.poseBanks, {
    allowedFamilyIds: config.allowedFamilies?.pose,
    preferTags:       contextTags,
    sessionBankKey:   `pose:${sessionScope}`,
  });

  // Compatibilidad dirigida: si el caller no fijó allowedFamilies para
  // gesto/cámara, restringir el pool a compatibleFamilies de la pose ya
  // elegida antes de sortear — evita combinaciones incoherentes (ej. pose
  // sentada + gesto de caminar) que la selección puramente aleatoria podía
  // producir. Si el caller SÍ fijó allowedFamilies (casos como
  // outfitRevealBasic, que ya resuelve la familia exacta a mano), esa
  // restricción dura tiene prioridad y preferFamilyIds no se aplica.
  const poseCompatible = poseFamily?.compatibleFamilies;

  // Compatibilidad de manos: en vez de vetar GESTURE por completo cuando la
  // pose ya compromete ambas manos (20/28 poses), permitimos que GESTURE
  // añada DETALLE a una mano que la pose ya describió de forma genérica —
  // ej. la pose dice "one hand rests on it [the hip]" sin detalle, y
  // HAND_ON_HIP_GESTURE (amplifiesAction: 'on_hip') especifica cómo se ven
  // los dedos en esa misma cadera, sin inventar una tercera acción de mano.
  // requireActionMatch es una restricción DURA: si ninguna familia de gesto
  // amplifica alguna de las handActions de la pose, se devuelve null (gesto
  // omitido) en vez de caer al banco completo sin restricción — ese fallback
  // silencioso era exactamente el defecto que producía el bug original
  // (brazo/objeto fantasma). No aplica si el caller ya fijó una familia de
  // gesto explícita a mano (allowedFamilies.gesture), ni si la pose no
  // declara handActions (banco masculino, sin este campo aún).
  const poseHandActions = poseFamily?.handActions;

  const expressionFamily = pickFamily(bank.expressionBanks, {
    preferTags:     contextTags,
    sessionBankKey: `expression:${sessionScope}`,
  });
  const cameraFamily = pickFamily(bank.cameraRelationshipBanks, {
    allowedFamilyIds: config.allowedFamilies?.camera,
    preferFamilyIds:  config.allowedFamilies?.camera ? undefined : poseCompatible,
    sessionBankKey:   `camera:${sessionScope}`,
  });
  const gestureFamily = config.includeGesture ? pickFamily(bank.gestureBanks, {
    allowedFamilyIds:   config.allowedFamilies?.gesture,
    requireActionMatch: (!config.allowedFamilies?.gesture && poseHandActions) ? poseHandActions : undefined,
    preferFamilyIds:    config.allowedFamilies?.gesture ? undefined : poseCompatible,
    sessionBankKey:     `gesture:${sessionScope}`,
  }) : null;
  const performanceFamily = config.includePerformance ? pickFamily(bank.performanceBanks, {
    preferFamilyIds: poseCompatible,
    preferTags:      contextTags,
    sessionBankKey:  `performance:${sessionScope}`,
  }) : null;

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
