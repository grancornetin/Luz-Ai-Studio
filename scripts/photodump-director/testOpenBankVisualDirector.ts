/**
 * scripts/photodump-director/testOpenBankVisualDirector.ts
 *
 * Experimento de investigación (NO conectado a producción, NO modifica
 * ningún archivo del pipeline actual ni del modo openBank ya desplegado):
 * prueba si "Decidir" viendo las imágenes REALES de un grupo de finalistas
 * (en vez de solo un resumen de texto de 100 caracteres, que es lo que hace
 * hoy openBankPromptBuilders.ts) reduce el problema diagnosticado en sesión
 * — candidatos reciclados entre historias distintas + justificaciones de
 * texto que no corresponden a lo que la foto realmente muestra.
 *
 * Diseño en 2 pasos (decidido con el usuario):
 *   Paso 1 (preselección MECÁNICA, sin Gemini): por cada shot_type
 *   normalizado presente en el banco, se toman hasta N candidatos —
 *   determinístico, sin juicio de texto de por medio, para no heredar el
 *   mismo sesgo de lenguaje que ya se identificó en el modo openBank actual.
 *   Paso 2 ("Decidir" con imágenes reales): esos finalistas (~15-25) se
 *   cargan como inlineData (igual que ya hace en producción
 *   api/gemini/content.ts con las referencias de identidad/outfit del
 *   usuario) junto con el prompt de texto, y ahí Gemini elige y justifica
 *   VIENDO la foto real, no un resumen.
 *
 * "Redactar" queda fuera de este experimento a propósito — el objetivo acá
 * es aislar y medir el efecto de un solo cambio (¿mejora el Paso 2 al ver
 * imágenes?), no repetir el pipeline completo.
 *
 * Uso:
 *   npx tsx scripts/photodump-director/testOpenBankVisualDirector.ts "cena en un rooftop" --count=7 --perType=3
 */
import { readFileSync, mkdirSync, copyFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, join } from 'path';
import { fileURLToPath } from 'url';
import { normalizeShotType, detectSceneTag, detectPreparationScene } from '../../src/modules/photodump/director/openBank/openBankFilter';
import { HARD_RULES_TEXT as PHOTODUMP_HARD_RULES_TEXT } from '../../src/modules/photodump/director/hardRules';
import { resolveEnergyFromBrief } from '../../src/modules/photodump/recipes/outfitNightOut/venueResolver';
import type { OpenBankSnapshot, OpenBankAnalysisItem } from '../../src/modules/photodump/director/openBank/openBankTypes';
import { generateJsonFromParts } from './geminiClient.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const cwd       = resolve(__dirname, '../..');

const BANK_IMAGES_DIR = 'C:\\Users\\Nico Trabajo\\Downloads\\contenido de prueba\\photodump\\images';
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];
const MIME_BY_EXT: Record<string, string> = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
};

function findBankImageFile(itemId: string): string | null {
  for (const ext of IMAGE_EXTENSIONS) {
    const candidate = join(BANK_IMAGES_DIR, `${itemId}${ext}`);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

function isUsable(item: OpenBankAnalysisItem): boolean {
  const prohibited = item.analysis.prohibited_commercial_signals;
  if (prohibited && prohibited !== 'ninguno' && prohibited !== null
      && !(Array.isArray(prohibited) && prohibited.length === 0)) {
    return false;
  }
  return true;
}

const rawArgs    = process.argv.slice(2);
const brief      = rawArgs.find(a => !a.startsWith('--')) || 'cena en un rooftop en Manhattan';
const countArg   = rawArgs.find(a => a.startsWith('--count='));
const totalShots = countArg ? parseInt(countArg.split('=')[1], 10) : 7;
const perTypeArg = rawArgs.find(a => a.startsWith('--perType='));
const perType    = perTypeArg ? parseInt(perTypeArg.split('=')[1], 10) : 3;

console.log('═'.repeat(70));
console.log('Director Creativo — experimento VISUAL (Decidir viendo imágenes reales)');
console.log('═'.repeat(70));
console.log(`Brief: "${brief}"`);
console.log(`Cantidad de shots pedida: ${totalShots}`);
console.log(`Preselección mecánica: hasta ${perType} candidatos por shot_type`);
console.log('─'.repeat(70));

const bankPath = resolve(cwd, 'src/data/photodump-bank/bank-snapshot.json');
const snapshot = JSON.parse(readFileSync(bankPath, 'utf-8')) as OpenBankSnapshot;
console.log(`Banco cargado: ${snapshot.itemCount} imágenes aprobadas (compilado ${snapshot.compiledAt}).`);

// ── Paso 1: preselección MECÁNICA por shot_type, sin Gemini ────────────────
const usable = snapshot.items.filter(isUsable);
const byShotType = new Map<string, OpenBankAnalysisItem[]>();
for (const item of usable) {
  const st = normalizeShotType(item.analysis.raw_visual_description?.shot_type);
  if (!byShotType.has(st)) byShotType.set(st, []);
  byShotType.get(st)!.push(item);
}

const finalists: OpenBankAnalysisItem[] = [];
const finalistIds = new Set<string>();
for (const [shotType, items] of byShotType.entries()) {
  // Determinístico: toma los primeros N en el orden del banco — sin juicio
  // de texto, sin ranking por brief. El objetivo es cobertura pareja de
  // TIPOS reales, no "los mejores" (eso lo decide Gemini viendo la imagen).
  for (const item of items.slice(0, perType)) {
    finalists.push(item);
    finalistIds.add(item.itemId);
  }
}

// Suma garantizada de vetas de escena (ver detectSceneTag/SCENE_KEYWORDS en
// openBankFilter.ts) — sin esto, candidatos temáticamente coherentes (ej.
// fotos reales de club con neón) quedan enterrados en la cola de su
// shot_type y el corte de perType los excluye siempre, confirmado con datos
// reales de esta sesión (0/5 candidatos de club entraban con perType=25).
const byScene = new Map<string, OpenBankAnalysisItem[]>();
for (const item of usable) {
  const scene = detectSceneTag(item);
  if (!scene) continue;
  if (!byScene.has(scene)) byScene.set(scene, []);
  byScene.get(scene)!.push(item);
  if (!finalistIds.has(item.itemId)) {
    finalists.push(item);
    finalistIds.add(item.itemId);
  }
}

// Veta de "preparación en bata/toalla" (ver detectPreparationScene) — señal
// distinta a SCENE_KEYWORDS: vive en outfit_visible, no en background_setting.
const preparationItems = usable.filter(detectPreparationScene);
if (preparationItems.length > 0) byScene.set('preparacion_bata_toalla', preparationItems);
for (const item of preparationItems) {
  if (!finalistIds.has(item.itemId)) {
    finalists.push(item);
    finalistIds.add(item.itemId);
  }
}

console.log(`\nFinalistas preseleccionados: ${finalists.length} candidatos, cubriendo ${byShotType.size} shot_types distintos + ${byScene.size} escenas detectadas.`);
for (const [shotType, items] of byShotType.entries()) {
  console.log(`  ${shotType}: ${Math.min(items.length, perType)}/${items.length} tomados`);
}
for (const [scene, items] of byScene.entries()) {
  console.log(`  escena:${scene}: ${items.length}/${items.length} tomados (sin tope)`);
}

// ── Cargar imágenes reales en base64, INTERCALADAS con un texto de
// etiqueta justo antes de cada una ("Candidato img_X:" + imagen) ───────────
// Bug encontrado en la corrida de 61 imágenes (10 shots, perType=6): mandar
// todas las imágenes juntas y una lista numerada de itemIds aparte le pide a
// Gemini que CUENTE en qué posición está cada imagen para emparejarla con su
// itemId — con pocas imágenes (34) casi no fallaba, pero con 61 fallló en
// 8 de 10 shots (el itemId elegido no correspondía a la imagen real en esa
// posición). Intercalar la etiqueta de texto justo antes de cada imagen
// elimina el conteo posicional a ciegas: cada imagen viaja pegada a su
// propio identificador, sin depender de contar bien 60+ imágenes en fila.
console.log('\nCargando imágenes reales de los finalistas...');
const interleavedParts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];
const finalistIndex: Array<{ itemId: string; shotType: string; found: boolean }> = [];
let foundCount = 0;
let totalKB = 0;

for (const item of finalists) {
  const sourcePath = findBankImageFile(item.itemId);
  const shotType = normalizeShotType(item.analysis.raw_visual_description?.shot_type);
  if (sourcePath) {
    const ext = sourcePath.slice(sourcePath.lastIndexOf('.')).toLowerCase();
    const data = readFileSync(sourcePath).toString('base64');
    interleavedParts.push({ text: `Candidato itemId="${item.itemId}" (shot_type=${shotType}):` });
    interleavedParts.push({ inlineData: { mimeType: MIME_BY_EXT[ext] || 'image/jpeg', data } });
    finalistIndex.push({ itemId: item.itemId, shotType, found: true });
    foundCount++;
    totalKB += data.length * 0.75 / 1024;
  } else {
    finalistIndex.push({ itemId: item.itemId, shotType, found: false });
  }
}

console.log(`Imágenes cargadas: ${foundCount}/${finalists.length} (${totalKB.toFixed(0)}KB en base64 total)`);

const energy = resolveEnergyFromBrief(brief);
console.log(`Energía inferida del brief: ${energy}`);

// ── Paso 2: "Decidir" con imágenes reales + texto ───────────────────────────
// El prompt ahora se arma en 2 mitades: la intro va ANTES de las imágenes
// intercaladas (parts = [introText, ...interleavedParts, instructionsText]),
// para que cada imagen llegue pegada a su propia etiqueta de itemId — ver
// comentario arriba de interleavedParts sobre el bug de conteo posicional.
const introText = `Sos el Director Creativo de "Photodump", un módulo que genera fotos tipo rollo-de-fotos-real de una historia (ej. una salida nocturna) para una app de contenido para creadoras.

${PHOTODUMP_HARD_RULES_TEXT}

BRIEF DEL USUARIO: "${brief}"

NÚCLEO NARRATIVO DE ESTA HISTORIA (el único criterio narrativo):
> Ella tuvo una noche memorable, y se veía increíble en el outfit.

A continuación te muestro ${foundCount} fotos reales del banco, cada una con su itemId indicado en el texto JUSTO ANTES de la imagen correspondiente. Mirá cada imagen con atención — vas a tener que elegir entre ellas.`;

const instructionsText = `Ya viste las ${foundCount} fotos reales de arriba, cada una etiquetada con su itemId. Ahora decidí:

Cada shot que elijas debe aportar evidencia real de AL MENOS UNO de estos 2 ejes ("memorable" o "outfit_increible") — marcalo en narrativeAxis.

LECTURA PSICOLÓGICA DE CADA CANDIDATO (manifiesto §3, obligatoria antes de elegir): la razón por la que un tipo de foto genera atención real en redes casi nunca es "se ve linda" — es que activa un impulso motivacional específico. Para esta receta, los 3 impulsos relevantes son:
- attraction_self_presentation: la pose/ángulo/gesto transmite confianza corporal y sensualidad DELIBERADA (no accidental) — mirror check, ángulo que alarga la silueta, mirada directa y segura a cámara.
- status_control: el entorno, la exclusividad del venue, la calidad de los objetos visibles o la sensación de acceso/dominio de la situación es lo que genera la reacción — no la pose de la protagonista en sí.
- belonging_social_validation: la foto funciona porque muestra pertenencia a un grupo/momento deseable (amigas, ambiente, código social reconocible) — la fuerza está en el contexto compartido, no en un individuo posando.
Antes de elegir un candidato, preguntate: ¿qué impulso de estos 3 hace que ESTE tipo de foto específico genere atención real si alguien la publicara? Usá esa lectura para juzgar si el candidato es realmente fuerte (no solo si combina con el brief en palabras) y para decidir qué pose/ángulo/gesto vale la pena heredar en keptElements. Declará el impulso identificado en psychologicalDrive, y en psychologicalReasoning explicá en 1-2 frases POR QUÉ ese candidato puntual activa ese impulso.
REGLA DURA: psychologicalReasoning es tu razonamiento INTERNO de director, nunca se traduce a texto literal en el prompt final ni implica prometer un resultado social (pretendientes, envidia, aceptación) — eso viola los guardrails del manifiesto (§15). Se usa solo para elegir mejor la pose y justificar por qué el candidato es fuerte, nunca aparece en shotReasoning ni en existenceReason con ese lenguaje: esos campos siempre describen la experiencia propia de la protagonista (self-focused: "se sintió increíble con el outfit"), nunca el efecto que la foto tendría en terceros (other-focused: "para que otros la deseen/envidien").

FILTRO DE TONO — depende del CONTEXTO NARRATIVO de cada shot, no es una prohibición general de sensualidad. La pregunta correcta para cada imagen es: "¿es plausible que la protagonista esté vestida así EN ESTE MOMENTO de ESTA historia?", no "¿es sensual?" — la sensualidad en sí (escote, silueta marcada, piernas, pose de confianza corporal) es parte legítima de attraction_self_presentation y no hay que evitarla. Esta regla es específica de outfit_night_out (salida nocturna); no es una lista fija de prendas prohibidas para todo Photodump.
- Si el shot ocurre en el venue, en tránsito (auto), o en cualquier momento donde la protagonista ya está "arreglada para salir": una imagen con ropa interior/lencería NO es plausible ahí — no tiene sentido narrativo estar en ropa interior en un club, restaurante o auto camino a algún lado. Descartala, sin importar qué tan bien encaje la pose con el brief.
- Si el shot ocurre en la etapa de PREPARACIÓN EN CASA (ej. "previa", "get ready with me", maquillándose, eligiendo el outfit, arreglándose el pelo) Y el brief describe o admite esa etapa: cualquier prenda plausible ANTES de estar vestida de salida es válida — bata, pijama, toalla, conjunto de loungewear, ropa deportiva de estar en casa. La línea sigue estando en ropa interior/lencería como prenda final y única visible (eso nunca es válido, ni siquiera en la preparación) — la diferencia es "está en bata/pijama antes de vestirse" (válido) vs. "está en ropa interior sin nada encima, posando" (nunca válido).
Si dudás sobre una imagen puntual, preguntate primero en qué etapa de la noche va ese shot y si esa prenda tiene sentido ahí — no descartes por sensualidad sola.

REGLA ANTI-ALUCINACIÓN — verificación obligatoria antes de responder: cada shot debe usar un itemId DISTINTO (nunca repitas chosenCandidateId entre 2 shots del mismo set). Si en algún shotReasoning vas a escribir una comparación entre shots (ej. "es la misma imagen que el shot X", "similar al anterior"), releé primero las etiquetas de itemId de las imágenes involucradas y confirmá que la comparación es literalmente cierta — nunca afirmes que 2 candidatos son "la misma imagen" a menos que sean exactamente el mismo itemId. Si tenés dudas, no lo afirmes.

CANTIDAD TOTAL DE SHOTS — LÍMITE DURO: el array "shots" debe tener EXACTAMENTE ${totalShots} elementos.

INSTRUCCIÓN CENTRAL: basate en lo que la foto REALMENTE muestra (pose, gesto, objeto, fondo, si hay compañía visible, si el encuadre es creíble para el brief), no en el nombre del shot_type. Si una foto no aporta nada útil para "${brief}" aunque su shot_type suene relevante, descartala y elegí otra. NO inventes una justificación genérica — shotReasoning debe describir algo que se ve literalmente en la imagen que elegiste. chosenCandidateId debe ser EXACTAMENTE el itemId tal como aparece en la etiqueta de texto pegada a la imagen que elegiste — verificalo dos veces antes de responder, es crítico que no se mezcle con el itemId de otra imagen cercana.

DIVERSIDAD REAL: evitá que 2+ shots se lean como la misma foto repetida.

Para cada shot elegido, completá keptElements (qué SÍ es transferible: pose, gesto, mirada, encuadre — viendo la imagen real) y discardedElements (qué NO: vestuario del candidato, escenario específico, iluminación).

RAZONAMIENTO DE ACCESORIOS (accessoryReasoning, obligatorio): basate en lo que ves en la imagen — ¿la protagonista tiene las manos libres/ocupadas en esa foto real?

MOTIVO DE EXISTENCIA (existenceReason, obligatorio): completá "esta foto existe porque..." con la razón concreta, coherente con lo que la imagen real muestra.

LÍNEA DE TIEMPO (timelineStages, 2 a 4 bloques amplios).

REGLAS DURAS DE CONTINUIDAD:
- Si 2+ shots comparten el mismo venue, decidí needsVenueAnchor=true y describí en continuityNote qué debe mantenerse consistente.
- Si algún shot muestra el interior de un auto, es SIEMPRE desde el punto de vista de una pasajera.

Devolvé el resultado en el formato JSON pedido.`;

const OPEN_BANK_VISUAL_PLAN_SCHEMA = {
  type: 'object',
  properties: {
    globalReasoning: { type: 'string' },
    timelineStages: { type: 'array', items: { type: 'string' } },
    shots: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          vehicleLabel: { type: 'string' },
          narrativeAxis: { type: 'string', enum: ['memorable', 'outfit_increible', 'ambos'] },
          psychologicalDrive: { type: 'string', enum: ['attraction_self_presentation', 'status_control', 'belonging_social_validation'] },
          psychologicalReasoning: { type: 'string' },
          chosenCandidateId: { type: 'string' },
          shotReasoning: { type: 'string' },
          keptElements: { type: 'array', items: { type: 'string' } },
          discardedElements: { type: 'array', items: { type: 'string' } },
          needsVenueAnchor: { type: 'boolean' },
          continuityNote: { type: 'string' },
          accessoryReasoning: { type: 'string' },
          timelineStage: { type: 'string' },
          existenceReason: { type: 'string' },
        },
        required: [
          'vehicleLabel', 'narrativeAxis', 'psychologicalDrive', 'psychologicalReasoning',
          'chosenCandidateId', 'shotReasoning',
          'keptElements', 'discardedElements', 'needsVenueAnchor', 'continuityNote',
          'accessoryReasoning', 'timelineStage', 'existenceReason',
        ],
      },
    },
  },
  required: ['globalReasoning', 'timelineStages', 'shots'],
};

console.log('\n' + '─'.repeat(70));
console.log(`Llamando a Gemini (Decidir CON imágenes reales, ${foundCount} imágenes + texto)...`);
const t0 = Date.now();
const parts = [{ text: introText }, ...interleavedParts, { text: instructionsText }];
const plan = await generateJsonFromParts(parts, OPEN_BANK_VISUAL_PLAN_SCHEMA) as {
  globalReasoning: string;
  timelineStages: string[];
  shots: Array<{
    vehicleLabel: string; narrativeAxis: string; psychologicalDrive: string; psychologicalReasoning: string;
    chosenCandidateId: string;
    shotReasoning: string; keptElements: string[]; discardedElements: string[];
    needsVenueAnchor: boolean; continuityNote: string; accessoryReasoning: string;
    timelineStage: string; existenceReason: string;
  }>;
};
const elapsedSec = ((Date.now() - t0) / 1000).toFixed(1);
console.log(`Respuesta recibida en ${elapsedSec}s.`);

console.log('\n' + '═'.repeat(70));
console.log('RAZONAMIENTO GLOBAL:');
console.log('═'.repeat(70));
console.log(plan.globalReasoning);

console.log('\n' + '═'.repeat(70));
console.log(`DECISIÓN POR SHOT (${plan.shots.length} shots):`);
console.log('═'.repeat(70));
for (const shot of plan.shots) {
  console.log(`\n─── ${shot.vehicleLabel} [eje: ${shot.narrativeAxis}] [${shot.timelineStage}] ───`);
  console.log(`Candidato elegido: ${shot.chosenCandidateId}`);
  console.log(`Impulso psicológico: ${shot.psychologicalDrive} — ${shot.psychologicalReasoning}`);
  console.log(`Por qué: ${shot.shotReasoning}`);
  console.log(`Mantiene: ${(shot.keptElements || []).join(' | ')}`);
  console.log(`Descarta: ${(shot.discardedElements || []).join(' | ')}`);
  console.log(`Existe porque: ${shot.existenceReason}`);
}

// ── Copiar evidencia visual (mismo patrón que testOpenBankDirector.ts) ─────
console.log('\n' + '═'.repeat(70));
console.log('Copiando imágenes elegidas para inspección visual...');
console.log('═'.repeat(70));

const outputBase = resolve(cwd, 'pruebas de resultados/experimento naturalidad');
const briefSlug = brief.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const outputDir = resolve(outputBase, `visual_${briefSlug}_${timestamp}`);
mkdirSync(outputDir, { recursive: true });

const indexLines: string[] = [
  `Modo BANCO ABIERTO VISUAL — Decidir viendo imágenes reales (experimento)`,
  `Brief: "${brief}"`,
  `Cantidad de shots pedida: ${totalShots} (planificados: ${plan.shots.length})`,
  `Energía inferida: ${energy}`,
  `Preselección mecánica: ${finalists.length} finalistas (${foundCount} imágenes cargadas), hasta ${perType} por shot_type, ${byShotType.size} shot_types cubiertos`,
  `Tiempo de respuesta de Gemini (Decidir con imágenes): ${elapsedSec}s`,
  `Generado: ${new Date().toLocaleString('es-CL')}`,
  ``,
  `RAZONAMIENTO GLOBAL:`,
  plan.globalReasoning,
  ``,
  '═'.repeat(70),
  '',
];

let copiedCount = 0;
plan.shots.forEach((shot, i) => {
  const n = String(i + 1).padStart(2, '0');
  indexLines.push(`── Shot ${n}: ${shot.vehicleLabel} [eje: ${shot.narrativeAxis}] [${shot.timelineStage}] ──`);
  indexLines.push(`itemId original del banco: ${shot.chosenCandidateId}`);
  indexLines.push(`Impulso psicológico (interno, no aparece en el prompt final): ${shot.psychologicalDrive} — ${shot.psychologicalReasoning}`);
  indexLines.push(`Por qué se eligió: ${shot.shotReasoning}`);
  indexLines.push(`Mantiene: ${(shot.keptElements || []).join(' | ') || '(nada)'}`);
  indexLines.push(`Descarta: ${(shot.discardedElements || []).join(' | ') || '(nada)'}`);
  indexLines.push(`Existe porque: ${shot.existenceReason}`);

  const sourcePath = findBankImageFile(shot.chosenCandidateId);
  if (sourcePath) {
    const ext = sourcePath.slice(sourcePath.lastIndexOf('.'));
    const destName = `shot_${n}_${shot.vehicleLabel.replace(/[^a-zA-Z0-9]+/g, '_').slice(0, 30)}${ext}`;
    copyFileSync(sourcePath, join(outputDir, destName));
    indexLines.push(`Archivo copiado: ${destName}`);
    copiedCount++;
  } else {
    indexLines.push(`⚠ No se encontró el archivo original (${shot.chosenCandidateId}) — puede que Gemini haya inventado un itemId no adjuntado.`);
  }
  indexLines.push('');
});

writeFileSync(join(outputDir, 'README.txt'), indexLines.join('\n'), 'utf-8');

console.log(`\nCarpeta creada: ${outputDir}`);
console.log(`Imágenes copiadas: ${copiedCount}/${plan.shots.length}`);
console.log(`Índice legible: README.txt dentro de esa carpeta.`);
