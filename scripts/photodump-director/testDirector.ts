/**
 * scripts/photodump-director/testDirector.ts
 *
 * Harness de investigación del Director Creativo — corre el "cerebro"
 * (Decidir + Redactar) contra el banco real y el contrato REAL de producción
 * (importado directo de src/modules/photodump/director/*, no una copia
 * paralela) para leer el razonamiento como texto, sin generar ninguna imagen.
 *
 * Reemplaza a testDirector.js/decideStory.js/writePrompts.js/recipeContracts.js
 * (JS, congelados en una versión vieja del prompt — les faltaban enum de
 * shotId, diversityAxis/attentionBridge, accessoryReasoning, referenceImages)
 * — este harness usa las mismas funciones puras que corren en producción
 * (api/gemini/content.ts las importa de este mismo lugar), así que cualquier
 * ajuste que se pruebe acá es el ajuste real, no una aproximación.
 *
 * Uso:
 *   npx tsx scripts/photodump-director/testDirector.ts "cena en un rooftop" --level=extendido
 *
 * Requiere haber corrido antes scripts/compileBankSnapshot.js al menos una
 * vez (para tener src/data/photodump-bank/bank-snapshot.json actualizado).
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { getRecipeContract } from '../../src/modules/photodump/director/recipeContracts';
import { buildShotPools } from '../../src/modules/photodump/director/bankFilter';
import { resolveEnergyFromBrief } from '../../src/modules/photodump/recipes/outfitNightOut/venueResolver';
import {
  buildPhotodumpDirectorPlanSchema,
  PHOTODUMP_PROMPTS_SCHEMA,
  buildPhotodumpDecidePrompt,
  buildPhotodumpWritePrompt,
  sanitizeDirectorPlan,
} from '../../src/modules/photodump/director/promptBuilders';
import type { BankSnapshot, DirectorPlan, FinalPromptShot } from '../../src/modules/photodump/director/types';
import { generateJson } from './geminiClient.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const cwd       = resolve(__dirname, '../..');

const rawArgs   = process.argv.slice(2);
const brief     = rawArgs.find(a => !a.startsWith('--')) || 'cena en un rooftop en Manhattan';
const levelArg  = rawArgs.find(a => a.startsWith('--level='));
const level     = levelArg ? levelArg.split('=')[1] : 'corto';
const recipeId  = 'outfit_night_out';

console.log('═'.repeat(70));
console.log('Director Creativo — harness de investigación (sin generar imágenes)');
console.log('═'.repeat(70));
console.log(`Receta: ${recipeId}`);
console.log(`Nivel: ${level}`);
console.log(`Brief: "${brief}"`);
console.log('─'.repeat(70));

const bankPath = resolve(cwd, 'src/data/photodump-bank/bank-snapshot.json');
const snapshot = JSON.parse(readFileSync(bankPath, 'utf-8')) as BankSnapshot;
console.log(`Banco cargado: ${snapshot.itemCount} imágenes aprobadas (compilado ${snapshot.compiledAt}).`);

const recipeContract = getRecipeContract(recipeId);

console.log('Filtrando candidatos por tipo de shot (sin IA)...');
const shotPools = buildShotPools(snapshot.items, brief, recipeContract);
for (const [shotId, candidates] of Object.entries(shotPools)) {
  console.log(`  ${shotId}: ${candidates.length} candidatos encontrados`);
}

const energy = resolveEnergyFromBrief(brief);
console.log(`Energía inferida del brief: ${energy}`);

console.log('─'.repeat(70));
console.log('Llamando a Gemini (Decidir)...');
const decidePrompt = buildPhotodumpDecidePrompt(brief, recipeContract, level, shotPools, undefined, energy);
const rawPlan = await generateJson(decidePrompt, buildPhotodumpDirectorPlanSchema(recipeContract, level, energy)) as DirectorPlan;
const plan = sanitizeDirectorPlan(rawPlan, recipeContract, level);
if (rawPlan.shots.length !== plan.shots.length) {
  console.log(`\n[sanitizeDirectorPlan] Gemini devolvió ${rawPlan.shots.length} shots, se recortó/dedupe a ${plan.shots.length}.`);
}

console.log('═'.repeat(70));
console.log('RAZONAMIENTO GLOBAL:');
console.log('═'.repeat(70));
console.log(plan.globalReasoning);

console.log('\n' + '═'.repeat(70));
console.log('LÍNEA DE TIEMPO DECLARADA:');
console.log('═'.repeat(70));
(plan.timelineStages || []).forEach((stage, i) => console.log(`  ${i + 1}. ${stage}`));

console.log('\n' + '═'.repeat(70));
console.log('DECISIÓN POR SHOT (resumido — solo el elegido, no todos los candidatos):');
console.log('═'.repeat(70));

for (const shot of plan.shots) {
  const chosen = shot.candidatesConsidered.find(c => c.itemId === shot.chosenCandidateId);
  console.log(`\n─── ${shot.shotId} [${shot.timelineStage}] ───`);
  console.log(`Elegido: ${shot.chosenCandidateId || '(ninguno — se describe desde cero)'} (${shot.candidatesConsidered.length} candidatos evaluados)`);
  console.log(`Por qué: ${shot.shotReasoning}`);
  if (chosen) {
    console.log(`Mantiene: ${chosen.keptElements.join(' | ') || '(nada)'}`);
    console.log(`Descarta: ${chosen.discardedElements.join(' | ') || '(nada)'}`);
  }
  console.log(`Necesita ancla de venue: ${shot.needsVenueAnchor ? 'sí' : 'no'}${shot.continuityNote ? ` — ${shot.continuityNote}` : ''}`);
  console.log(`Accesorios: ${shot.accessoryReasoning}`);
  console.log(`Existe porque: ${shot.existenceReason}`);
}

console.log('\n' + '═'.repeat(70));
console.log(`Total shots planificados: ${plan.shots.length}`);

console.log('\n' + '═'.repeat(70));
console.log('Redactando prompts finales (Redactar)...');
console.log('═'.repeat(70));
const writePrompt = buildPhotodumpWritePrompt(brief, plan, energy);
const { shots: finalPrompts } = await generateJson(writePrompt, PHOTODUMP_PROMPTS_SCHEMA) as { shots: FinalPromptShot[] };

for (const shot of finalPrompts) {
  console.log(`\n${'─'.repeat(70)}`);
  console.log(`PROMPT FINAL — shot: ${shot.shotId}`);
  console.log('─'.repeat(70));
  console.log(shot.finalPrompt);
}

console.log('\n' + '═'.repeat(70));
console.log('(No se generó ninguna imagen — esto es solo el razonamiento en texto.)');
