/**
 * scripts/photodump-director/dumpShotPools.ts
 *
 * Experimento de naturalidad/aspiracionalidad (pedido por el usuario): lista
 * los itemId completos que buildShotPools arma para un brief, sin llamar a
 * Gemini — para poder leer las imágenes reales del banco por shot y comparar
 * contra el razonamiento del director. No modifica nada de producción, es
 * solo instrumentación de lectura.
 *
 * Uso:
 *   npx tsx scripts/photodump-director/dumpShotPools.ts "cena en un rooftop" --level=extendido
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { getRecipeContract } from '../../src/modules/photodump/director/recipeContracts';
import { buildShotPools } from '../../src/modules/photodump/director/bankFilter';
import type { BankSnapshot } from '../../src/modules/photodump/director/types';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const cwd       = resolve(__dirname, '../..');

const rawArgs  = process.argv.slice(2);
const brief    = rawArgs.find(a => !a.startsWith('--')) || 'cena en un rooftop en Manhattan';
const recipeId = 'outfit_night_out';

const bankPath = resolve(cwd, 'src/data/photodump-bank/bank-snapshot.json');
const snapshot = JSON.parse(readFileSync(bankPath, 'utf-8')) as BankSnapshot;
const recipeContract = getRecipeContract(recipeId);

const shotPools = buildShotPools(snapshot.items, brief, recipeContract);

for (const [shotId, candidates] of Object.entries(shotPools)) {
  console.log(`\n### ${shotId} (${candidates.length} candidatos) ###`);
  candidates.forEach(c => console.log(`  ${c.itemId}  (score: ${c.relevanceScore})`));
}
