// ─── UGC Scene Intelligence ────────────────────────────────────
// Lee el banco de escenas reales entrenadas (scene_bank_ugc.json)
// y expone funciones para elegir una escena concreta cuando NO hay
// ninguna imagen real (ancla, inspiración o referencia de escena)
// que ya defina el entorno.
//
// Este motor NUNCA reemplaza una escena real subida por la usuaria.
// Solo llena el vacío que hoy se resuelve con texto genérico como
// "home, café, street" (Campaign) o "bedroom, hotel room" (Photodump).
//
// Compartido entre Campaign (sceneIntelligence vive en su carpeta
// por prioridad histórica) y Photodump — ambos lo importan igual.
//
// Fallback silencioso si el JSON falta o está vacío.

let _sceneBank: Record<string, unknown> = {};
let _loaded = false;

async function ensureLoaded(): Promise<void> {
  if (_loaded) return;
  _loaded = true;
  try {
    const mod = await import('../../data/trainer/inteligencia ugc/scene_bank_ugc.json');
    _sceneBank = (mod.default ?? mod) as Record<string, unknown>;
  } catch {
    _sceneBank = {};
  }
}

export function initSceneIntelligence(): void {
  ensureLoaded().catch(() => {});
}

// ─── Tipos ──────────────────────────────────────────────────────

export interface UgcScene {
  sceneId: string;
  name: string;
  status: string;
  sceneIdentity: {
    sceneFamily?: string;
    settingCategory?: string;
    sceneType?: string;
    locationConcept?: string;
  };
  confidence: number;
  scenePromptBlock: string;
  capabilities: {
    openFloorSpace?: string;
    supportsFullBody?: string;
    supportsSeatedPose?: string;
    supportsExtendedArms?: string;
    allowsMultipleOutfitChanges?: string;
    privacyLevel?: string;
    mirror?: { availability?: string; usability?: string };
  };
  limitations: string[];
  contaminationRisks: string[];
}

// ─── API pública ──────────────────────────────────────────────

export function getScenes(): UgcScene[] {
  const scenes = (_sceneBank as any)?.mainScenes;
  if (!Array.isArray(scenes)) return [];
  return (scenes as UgcScene[]).filter(s => s.status === 'approved');
}

export function getSceneById(id: string): UgcScene | undefined {
  return getScenes().find(s => s.sceneId === id);
}

/**
 * Filtra escenas por categoría de ambiente (bedroom, urban_exterior, cafe, etc.).
 */
export function getScenesByCategory(category: string): UgcScene[] {
  return getScenes().filter(s => s.sceneIdentity?.settingCategory === category);
}

/**
 * Filtra escenas que soportan cuerpo completo — útil para anchors
 * de campaña o shots full body de Photodump.
 */
export function getFullBodyScenes(): UgcScene[] {
  return getScenes().filter(s => s.capabilities?.supportsFullBody === 'yes');
}

/**
 * Elige una escena de forma determinística a partir de un seed
 * (por ejemplo el id de campaña o de sesión de photodump), para que
 * la misma generación no salte de escena entre llamadas sucesivas.
 * Si se pasa `category`, restringe la selección a esa categoría;
 * si no hay escenas en esa categoría, cae al banco completo.
 */
export function pickScene(seed: string, category?: string): UgcScene | undefined {
  const pool = category ? getScenesByCategory(category) : getScenes();
  const finalPool = pool.length > 0 ? pool : getScenes();
  if (finalPool.length === 0) return undefined;

  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return finalPool[hash % finalPool.length];
}

/**
 * Arma un bloque de prompt compacto con una escena concreta —
 * pensado para reemplazar instrucciones genéricas de locación
 * cuando no hay foto real de escena.
 */
export function buildScenePromptBlock(scene: UgcScene): string {
  const cap = scene.capabilities ?? {};
  const capLines: string[] = [];
  if (cap.supportsFullBody) capLines.push(`full body: ${cap.supportsFullBody}`);
  if (cap.mirror?.availability && cap.mirror.availability !== 'none') {
    capLines.push(`mirror: ${cap.mirror.availability} (${cap.mirror.usability ?? 'unknown'})`);
  }
  if (cap.privacyLevel) capLines.push(`privacy: ${cap.privacyLevel}`);

  const lines: string[] = [
    `📍 TRAINED SCENE — ${scene.name}`,
    scene.scenePromptBlock,
  ];
  if (capLines.length > 0) {
    lines.push(`Scene capabilities: ${capLines.join(' · ')}`);
  }
  if (scene.limitations?.length) {
    lines.push(`Known limitations: ${scene.limitations.join(' · ')}`);
  }
  if (scene.contaminationRisks?.length) {
    lines.push(`AVOID: ${scene.contaminationRisks.join(' · ')}`);
  }
  lines.push('Use this scene as the physical environment. Do not invent a different room, location, or background.');

  return lines.join('\n');
}
