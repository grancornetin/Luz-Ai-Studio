/**
 * scripts/photodump-director/testDirector.js
 *
 * Fase A del plan: correr el "cerebro" del director (Puntos D-G) contra un
 * brief real y leer su razonamiento COMO TEXTO — sin generar ninguna imagen
 * todavía. Sirve para confirmar que el director piensa bien antes de
 * conectar la Etapa 3 (generación real).
 *
 * Uso:
 *   node scripts/photodump-director/testDirector.js "cena en un rooftop en Manhattan"
 *   node scripts/photodump-director/testDirector.js "previa en casa antes del boliche" --level=completo
 *
 * Requiere haber corrido antes scripts/compileBankSnapshot.js al menos una
 * vez (para tener src/data/photodump-bank/bank-snapshot.json actualizado).
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { getRecipeContract } from './recipeContracts.js';
import { buildShotPools } from './bankFilter.js';
import { decideStory } from './decideStory.js';
import { writePrompts } from './writePrompts.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const cwd       = resolve(__dirname, '../..');

const rawArgs = process.argv.slice(2);
const brief = rawArgs.find(a => !a.startsWith('--')) || 'cena en un rooftop en Manhattan';
const levelArg = rawArgs.find(a => a.startsWith('--level='));
const level = levelArg ? levelArg.split('=')[1] : 'corto';
const recipeId = 'outfit_night_out';

console.log('═'.repeat(70));
console.log(`Director Creativo — prueba de razonamiento (Fase A, sin generar imágenes)`);
console.log('═'.repeat(70));
console.log(`Receta: ${recipeId}`);
console.log(`Nivel: ${level}`);
console.log(`Brief: "${brief}"`);
console.log('─'.repeat(70));

const bankPath = resolve(cwd, 'src/data/photodump-bank/bank-snapshot.json');
const snapshot = JSON.parse(readFileSync(bankPath, 'utf-8'));
console.log(`Banco cargado: ${snapshot.itemCount} imágenes aprobadas (compilado ${snapshot.compiledAt}).`);

const recipeContract = getRecipeContract(recipeId);

console.log('Filtrando candidatos por tipo de shot (Punto E, sin IA)...');
const shotPools = buildShotPools(snapshot.items, brief, recipeContract);
for (const [shotId, candidates] of Object.entries(shotPools)) {
  console.log(`  ${shotId}: ${candidates.length} candidatos encontrados`);
}

console.log('─'.repeat(70));
console.log('Llamando a Gemini (Puntos D+F+G en una sola llamada)...');
const { plan } = await decideStory({ brief, recipeContract, level, shotPools });

console.log('═'.repeat(70));
console.log('RAZONAMIENTO GLOBAL:');
console.log('═'.repeat(70));
console.log(plan.globalReasoning);

console.log('\n' + '═'.repeat(70));
console.log('DECISIÓN POR SHOT:');
console.log('═'.repeat(70));

for (const shot of plan.shots) {
  console.log(`\n─── ${shot.shotId} ───`);
  console.log(`Candidatos evaluados: ${shot.candidatesConsidered.length}`);
  for (const c of shot.candidatesConsidered) {
    console.log(`  • ${c.itemId} — score ${c.score}/10`);
    console.log(`    Mantiene: ${c.keptElements.join(' | ') || '(nada)'}`);
    console.log(`    Descarta: ${c.discardedElements.join(' | ') || '(nada)'}`);
  }
  console.log(`Elegido: ${shot.chosenCandidateId || '(ninguno — se describe desde cero)'}`);
  console.log(`Por qué: ${shot.shotReasoning}`);
  console.log(`Necesita ancla de venue: ${shot.needsVenueAnchor ? 'sí' : 'no'}${shot.continuityNote ? ` — ${shot.continuityNote}` : ''}`);
}

console.log('\n' + '═'.repeat(70));
console.log(`Total shots planificados: ${plan.shots.length}`);

console.log('\n' + '═'.repeat(70));
console.log('Redactando prompts finales (Punto H)...');
console.log('═'.repeat(70));
const { shots: finalPrompts } = await writePrompts({ brief, plan });

for (const shot of finalPrompts) {
  console.log(`\n${'─'.repeat(70)}`);
  console.log(`PROMPT LISTO PARA HIGGSFIELD — shot: ${shot.shotId}`);
  console.log('─'.repeat(70));
  console.log(shot.finalPrompt);
}

console.log('\n' + '═'.repeat(70));
console.log('(No se generó ninguna imagen — copiá los prompts de arriba para probar a mano en Higgsfield.)');
