/**
 * scripts/photodump-director/testOpenBankDirector.ts
 *
 * Harness de investigación del modo "banco abierto" (bypass aislado, sin
 * tipos de shot con nombre fijo) — mismo propósito que testDirector.ts
 * (correr el "cerebro" contra el banco real y leer el razonamiento como
 * texto, sin generar ninguna imagen), pero para la rama openBank/.
 *
 * Como el modo open_bank todavía no genera imágenes reales (ver
 * outfitNightOut/index.ts, tryDirector), el usuario no puede comprobar
 * visualmente si el razonamiento mejora sin esto: además de imprimir el
 * texto, este harness COPIA las fotos reales del banco que el director
 * eligió a una subcarpeta bajo "pruebas de resultados/experimento
 * naturalidad/", una por corrida, con un índice legible (README.txt) al
 * lado — mismo ejercicio manual que se hizo a mano en el chat, ahora
 * automatizado y repetible.
 *
 * Uso:
 *   npx tsx scripts/photodump-director/testOpenBankDirector.ts "cena en un rooftop" --count=7
 */
import { readFileSync, mkdirSync, copyFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, join } from 'path';
import { fileURLToPath } from 'url';
import { buildWideCandidatePool, countWideCandidatePool } from '../../src/modules/photodump/director/openBank/openBankFilter';
import {
  OPEN_BANK_PLAN_SCHEMA,
  OPEN_BANK_PROMPTS_SCHEMA,
  buildOpenBankDecidePrompt,
  buildRichDetailBlock,
  buildOpenBankWritePrompt,
} from '../../src/modules/photodump/director/openBank/openBankPromptBuilders';
import { resolveEnergyFromBrief } from '../../src/modules/photodump/recipes/outfitNightOut/venueResolver';
import type { OpenBankSnapshot, OpenBankPlan, OpenBankFinalPromptShot } from '../../src/modules/photodump/director/openBank/openBankTypes';
import { generateJson } from './geminiClient.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const cwd       = resolve(__dirname, '../..');

// Carpeta real donde viven las fotos originales del banco (fuera del repo,
// ver src/data/photodump-bank/COMO_ACTUALIZAR_EL_BANCO.md) — mismo path
// usado en toda la sesión para inspección visual manual.
const BANK_IMAGES_DIR = 'C:\\Users\\Nico Trabajo\\Downloads\\contenido de prueba\\photodump\\images';
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

function findBankImageFile(itemId: string): string | null {
  for (const ext of IMAGE_EXTENSIONS) {
    const candidate = join(BANK_IMAGES_DIR, `${itemId}${ext}`);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

const rawArgs   = process.argv.slice(2);
const brief     = rawArgs.find(a => !a.startsWith('--')) || 'cena en un rooftop en Manhattan';
const countArg  = rawArgs.find(a => a.startsWith('--count='));
const totalShots = countArg ? parseInt(countArg.split('=')[1], 10) : 7;

console.log('═'.repeat(70));
console.log('Director Creativo — modo BANCO ABIERTO (bypass aislado, sin tipos fijos)');
console.log('═'.repeat(70));
console.log(`Brief: "${brief}"`);
console.log(`Cantidad de shots pedida: ${totalShots}`);
console.log('─'.repeat(70));

const bankPath = resolve(cwd, 'src/data/photodump-bank/bank-snapshot.json');
const snapshot = JSON.parse(readFileSync(bankPath, 'utf-8')) as OpenBankSnapshot;
console.log(`Banco cargado: ${snapshot.itemCount} imágenes aprobadas (compilado ${snapshot.compiledAt}).`);

console.log('Armando panorama amplio del banco (sin IA, sin filtrar por brief)...');
const widePool = buildWideCandidatePool(snapshot.items, 25);
const total = countWideCandidatePool(widePool);
console.log(`Panorama: ${total} candidatos vistos, agrupados por shot_type:`);
for (const [shotType, candidates] of Object.entries(widePool)) {
  console.log(`  ${shotType}: ${candidates.length} candidatos`);
}

const energy = resolveEnergyFromBrief(brief);
console.log(`Energía inferida del brief: ${energy}`);

console.log('─'.repeat(70));
console.log('Llamando a Gemini (Decidir)...');
const decidePrompt = buildOpenBankDecidePrompt(brief, totalShots, widePool, undefined, energy);
console.log(`Tamaño del prompt "Decidir": ${decidePrompt.length} caracteres (~${Math.round(decidePrompt.length / 4)} tokens estimados)`);

const rawPlan = await generateJson(decidePrompt, OPEN_BANK_PLAN_SCHEMA) as OpenBankPlan;

console.log('═'.repeat(70));
console.log('RAZONAMIENTO GLOBAL:');
console.log('═'.repeat(70));
console.log(rawPlan.globalReasoning);

console.log('\n' + '═'.repeat(70));
console.log('LÍNEA DE TIEMPO DECLARADA:');
console.log('═'.repeat(70));
(rawPlan.timelineStages || []).forEach((stage, i) => console.log(`  ${i + 1}. ${stage}`));

console.log('\n' + '═'.repeat(70));
console.log(`DECISIÓN POR SHOT (${rawPlan.shots.length} shots):`);
console.log('═'.repeat(70));

for (const shot of rawPlan.shots) {
  console.log(`\n─── ${shot.vehicleLabel} [eje: ${shot.narrativeAxis}] [${shot.timelineStage}] ───`);
  console.log(`Candidato elegido: ${shot.chosenCandidateId || '(ninguno — se describe desde cero)'}`);
  console.log(`Por qué: ${shot.shotReasoning}`);
  console.log(`Mantiene: ${(shot.keptElements || []).join(' | ') || '(nada)'}`);
  console.log(`Descarta: ${(shot.discardedElements || []).join(' | ') || '(nada)'}`);
  console.log(`Necesita ancla de venue: ${shot.needsVenueAnchor ? 'sí' : 'no'}${shot.continuityNote ? ` — ${shot.continuityNote}` : ''}`);
  console.log(`Accesorios: ${shot.accessoryReasoning}`);
  console.log(`Existe porque: ${shot.existenceReason}`);
}

console.log('\n' + '═'.repeat(70));
console.log(`Total shots planificados: ${rawPlan.shots.length} (pedidos: ${totalShots})`);

console.log('\n' + '═'.repeat(70));
console.log('Redactando prompts finales (Redactar)...');
console.log('═'.repeat(70));
const chosenIds = rawPlan.shots.map(s => s.chosenCandidateId).filter(Boolean);
const richDetailBlock = buildRichDetailBlock(chosenIds, snapshot.items);
const writePrompt = buildOpenBankWritePrompt(brief, rawPlan, richDetailBlock, energy);
const { shots: finalPrompts } = await generateJson(writePrompt, OPEN_BANK_PROMPTS_SCHEMA) as { shots: OpenBankFinalPromptShot[] };

const finalPromptByIndex = new Map(finalPrompts.map(s => [s.shotIndex, s.finalPrompt]));

for (const shot of finalPrompts) {
  console.log(`\n${'─'.repeat(70)}`);
  console.log(`PROMPT FINAL — ${shot.vehicleLabel}`);
  console.log('─'.repeat(70));
  console.log(shot.finalPrompt);
}

console.log('\n' + '═'.repeat(70));
console.log('(No se generó ninguna imagen con IA — esto es solo el razonamiento en texto.)');

// ── Copiar las fotos REALES elegidas a una subcarpeta, para inspección
// visual directa (el usuario no puede comprobar mejoras solo con texto,
// ver comentario de cabecera) ────────────────────────────────────────────
console.log('\n' + '═'.repeat(70));
console.log('Copiando imágenes elegidas para inspección visual...');
console.log('═'.repeat(70));

const outputBase = resolve(cwd, 'pruebas de resultados/experimento naturalidad');
const briefSlug = brief.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const outputDir = resolve(outputBase, `openbank_${briefSlug}_${timestamp}`);
mkdirSync(outputDir, { recursive: true });

const indexLines: string[] = [
  `Modo BANCO ABIERTO — copia de candidatos elegidos para inspección visual`,
  `Brief: "${brief}"`,
  `Cantidad de shots pedida: ${totalShots} (planificados: ${rawPlan.shots.length})`,
  `Energía inferida: ${energy}`,
  `Generado: ${new Date().toLocaleString('es-CL')}`,
  ``,
  `RAZONAMIENTO GLOBAL:`,
  rawPlan.globalReasoning,
  ``,
  '═'.repeat(70),
  '',
];

let copiedCount = 0;
let missingCount = 0;

rawPlan.shots.forEach((shot, i) => {
  const n = String(i + 1).padStart(2, '0');
  indexLines.push(`── Shot ${n}: ${shot.vehicleLabel} [eje: ${shot.narrativeAxis}] [${shot.timelineStage}] ──`);
  indexLines.push(`itemId original del banco: ${shot.chosenCandidateId || '(ninguno)'}`);
  indexLines.push(`Por qué se eligió: ${shot.shotReasoning}`);
  indexLines.push(`Mantiene: ${(shot.keptElements || []).join(' | ') || '(nada)'}`);
  indexLines.push(`Descarta: ${(shot.discardedElements || []).join(' | ') || '(nada)'}`);
  indexLines.push(`Existe porque: ${shot.existenceReason}`);

  if (shot.chosenCandidateId) {
    const sourcePath = findBankImageFile(shot.chosenCandidateId);
    if (sourcePath) {
      const ext = sourcePath.slice(sourcePath.lastIndexOf('.'));
      const destName = `shot_${n}_${shot.vehicleLabel.replace(/[^a-zA-Z0-9]+/g, '_').slice(0, 30)}${ext}`;
      copyFileSync(sourcePath, join(outputDir, destName));
      indexLines.push(`Archivo copiado: ${destName}`);
      copiedCount++;
    } else {
      indexLines.push(`⚠ No se encontró el archivo original en el banco (${shot.chosenCandidateId}) — puede tener otra extensión no contemplada.`);
      missingCount++;
    }
  } else {
    indexLines.push(`(Este shot no usó un candidato del banco — descrito desde cero.)`);
  }

  const finalPrompt = finalPromptByIndex.get(i + 1);
  if (finalPrompt) {
    indexLines.push(``);
    indexLines.push(`Prompt final redactado (lo que se usaría para generar la imagen real):`);
    indexLines.push(finalPrompt);
  }
  indexLines.push('');
});

writeFileSync(join(outputDir, 'README.txt'), indexLines.join('\n'), 'utf-8');

console.log(`Carpeta creada: ${outputDir}`);
console.log(`Imágenes copiadas: ${copiedCount}/${rawPlan.shots.length}${missingCount > 0 ? ` (${missingCount} no encontradas)` : ''}`);
console.log(`Índice legible: README.txt dentro de esa carpeta.`);
