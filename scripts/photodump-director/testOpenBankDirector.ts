/**
 * scripts/photodump-director/testOpenBankDirector.ts
 *
 * Harness de investigación del modo "banco abierto" (bypass aislado, sin
 * tipos de shot con nombre fijo) — mismo propósito que testDirector.ts
 * (correr el "cerebro" contra el banco real y leer el razonamiento como
 * texto, sin generar ninguna imagen), pero para la rama openBank/.
 *
 * Uso:
 *   npx tsx scripts/photodump-director/testOpenBankDirector.ts "cena en un rooftop" --count=7
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
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

for (const shot of finalPrompts) {
  console.log(`\n${'─'.repeat(70)}`);
  console.log(`PROMPT FINAL — ${shot.vehicleLabel}`);
  console.log('─'.repeat(70));
  console.log(shot.finalPrompt);
}

console.log('\n' + '═'.repeat(70));
console.log('(No se generó ninguna imagen — esto es solo el razonamiento en texto.)');
