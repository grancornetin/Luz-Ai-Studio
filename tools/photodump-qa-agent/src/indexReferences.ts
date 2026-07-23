/**
 * Indexa el banco de REFERENCES/ en segundo plano, separado de la
 * evaluación de pruebas — así generar/revisar un set no espera a que
 * termine de analizar cientos de referencias que no tienen que ver con esa
 * prueba puntual. Correr cuando quieras sumar avance al banco:
 *
 *   npm run index-references
 *
 * Se puede dejar corriendo largo rato (usa el mismo ritmo lento y seguro de
 * QA_DELAY_BETWEEN_CALLS_SECONDS) o cortar en cualquier momento — el
 * progreso se guarda incrementalmente, nunca se pierde lo ya indexado.
 */
import path from "node:path";
import { readFile } from "node:fs/promises";
import { GeminiEvaluator } from "./evaluate/provider.js";
import { ReferenceMemory } from "./memory/store.js";
import { listReferenceFiles, resolveReferenceDescriptor } from "./memory/referenceIndex.js";
import { RateLimiter } from "./rateLimiter.js";
import { withRetryOn429 } from "./retry.js";

if (!process.env.QA_AGENT_ROOT) throw new Error("Falta QA_AGENT_ROOT en el entorno.");
if (!process.env.GCP_PROJECT_ID) throw new Error("Falta GCP_PROJECT_ID en el entorno.");
if (!process.env.GEMINI_SERVICE_ACCOUNT_KEY && !process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
  throw new Error("Falta GEMINI_SERVICE_ACCOUNT_KEY o GOOGLE_SERVICE_ACCOUNT_KEY en el entorno.");
}

const agentRoot: string = process.env.QA_AGENT_ROOT;
const referencesDir = path.join(agentRoot, "REFERENCES");
const delaySeconds = Number(process.env.QA_DELAY_BETWEEN_CALLS_SECONDS || 25);
const maxThisRun = Number(process.env.QA_INDEX_MAX_PER_RUN || Infinity);

const evaluator = new GeminiEvaluator();
const memory = new ReferenceMemory(referencesDir);
await memory.load();

const allFiles = await listReferenceFiles(referencesDir);
const pending: string[] = [];
for (const file of allFiles) {
  const bytes = await readFile(file);
  const hash = ReferenceMemory.hashFile(bytes);
  if (!memory.has(hash)) pending.push(file);
}

console.log(`[QA] Banco de referencias: ${allFiles.length} total, ${pending.length} pendiente(s) de indexar.`);
if (pending.length === 0) {
  console.log("[QA] Nada pendiente. Todo el banco ya está indexado.");
  process.exit(0);
}

const toIndex = pending.slice(0, maxThisRun);
console.log(`[QA] Indexando ${toIndex.length} referencia(s) esta corrida, 1 por vez cada ${delaySeconds}s...`);

const rateLimiter = new RateLimiter(delaySeconds * 1000);
let done = 0;
await rateLimiter.runAll(toIndex, async file => {
  await withRetryOn429(() => resolveReferenceDescriptor(evaluator.client, evaluator.modelName, memory, file));
  await memory.save();
  done += 1;
  console.log(`[QA]   ✓ (${done}/${toIndex.length}) ${path.basename(file)}`);
});

const stillPending = pending.length - toIndex.length;
console.log(`[QA] Listo. Indexadas ${toIndex.length} esta corrida. ${stillPending > 0 ? `Quedan ${stillPending} pendientes — correr de nuevo para seguir.` : "Banco completo indexado."}`);
