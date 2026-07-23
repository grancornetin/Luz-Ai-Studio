import chokidar from "chokidar";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { GeminiEvaluator } from "./evaluate/provider.js";
import { isTestReady } from "./ingest/testFolder.js";
import { importFromDownloads } from "./ingest/downloadsImporter.js";
import { runTest } from "./runTest.js";
import { buildBatchSummary } from "./report/markdown.js";
import type { TestReport } from "./schema.js";

if (!process.env.QA_AGENT_ROOT) throw new Error("Falta QA_AGENT_ROOT en el entorno (carpeta LuzPhotodumpAgent).");
if (!process.env.QA_REPO_ROOT) throw new Error("Falta QA_REPO_ROOT en el entorno (carpeta del repo Luz IA Studio).");
if (!process.env.GCP_PROJECT_ID) throw new Error("Falta GCP_PROJECT_ID en el entorno.");
if (!process.env.GEMINI_SERVICE_ACCOUNT_KEY && !process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
  throw new Error("Falta GEMINI_SERVICE_ACCOUNT_KEY o GOOGLE_SERVICE_ACCOUNT_KEY en el entorno.");
}

const agentRoot: string = process.env.QA_AGENT_ROOT;
const repoRoot: string = process.env.QA_REPO_ROOT;
const downloadsDir: string | undefined = process.env.QA_DOWNLOADS_DIR;

const evaluator = new GeminiEvaluator();
const inboxRoot = path.join(agentRoot, "INBOX");
await mkdir(inboxRoot, { recursive: true });
await mkdir(path.join(agentRoot, "REFERENCES"), { recursive: true });
await mkdir(path.join(agentRoot, "RESULTS"), { recursive: true });
await mkdir(path.join(agentRoot, "REPORTS"), { recursive: true });

const queued = new Set<string>();
const pendingBatch: TestReport[] = [];
let batchTimer: NodeJS.Timeout | undefined;

// Cola global: nunca correr dos pruebas al mismo tiempo, sin importar si
// llegaron por el watcher de INBOX, scanExisting() o scanDownloads() en
// paralelo — todas comparten el mismo ReferenceMemory y el mismo rate
// limiter de Gemini, correr dos a la vez pisaba el progreso de la otra.
let queueTail: Promise<void> = Promise.resolve();

function processTest(testId: string): void {
  if (queued.has(testId)) return;
  queued.add(testId);
  queueTail = queueTail.then(() => runOne(testId));
}

async function runOne(testId: string): Promise<void> {
  const testDir = path.join(inboxRoot, testId);
  try {
    if (!(await isTestReady(testDir))) return;
    console.log(`[QA] Procesando ${testId}`);
    const report = await runTest(testId, { agentRoot, repoRoot }, evaluator);
    console.log(`[QA] ${testId}: ${report.score}/100 (${report.status}), ${report.locatedFindings.length} hallazgo(s)`);
    pendingBatch.push(report);
    scheduleBatchSummary();
  } catch (error) {
    console.error(`[QA] Error en ${testId}`, error);
  } finally {
    queued.delete(testId);
  }
}

function scheduleBatchSummary() {
  if (batchTimer) clearTimeout(batchTimer);
  batchTimer = setTimeout(async () => {
    if (pendingBatch.length === 0) return;
    const summaryPath = path.join(agentRoot, "REPORTS", `batch_${Date.now()}.md`);
    await writeFile(summaryPath, buildBatchSummary(pendingBatch));
    console.log(`[QA] Resumen de corrida escrito en ${summaryPath}`);
    pendingBatch.length = 0;
  }, 5000);
}

async function scanExisting() {
  const entries = await readdir(inboxRoot, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (entry.isDirectory()) processTest(entry.name);
  }
}

/**
 * Busca en la carpeta de Descargas del usuario nuevos debug.json de
 * Photodump (photodump_debug_*.json) + sus imágenes hermanas (sueltas o en
 * zip), y arma la carpeta de INBOX automáticamente — sin que el usuario
 * tenga que renombrar ni copiar nada a mano.
 */
async function scanDownloads() {
  if (!downloadsDir) return;
  const imported = await importFromDownloads(downloadsDir, inboxRoot);
  for (const testId of imported) {
    console.log(`[QA] Importado automáticamente desde Descargas: ${testId}`);
    processTest(testId);
  }
}

// Arrancar watchers y el poll de Descargas primero — no bloquear el arranque
// esperando a que termine de procesar lo que ya estaba pendiente en INBOX/
// (eso puede tardar minutos con el rate limit de Gemini).
const watcher = chokidar.watch(inboxRoot, {
  depth: 1,
  ignoreInitial: true,
  awaitWriteFinish: { stabilityThreshold: 1500, pollInterval: 200 },
});
watcher.on("add", filePath => {
  const testId = path.basename(path.dirname(filePath));
  processTest(testId);
});
if (downloadsDir) {
  const pollSeconds = Number(process.env.QA_DOWNLOADS_POLL_SECONDS || 30);
  setInterval(() => { void scanDownloads(); }, pollSeconds * 1000);
  console.log(`[QA] Vigilando Descargas (${downloadsDir}) cada ${pollSeconds}s: genera un set en Photodump y bajá "↓ ZIP"/"Debug" normalmente, el agente arma la prueba solo.`);
} else {
  console.log(`[QA] Observando ${inboxRoot}. Copia images.zip + debug.json en INBOX/<nombre-de-prueba>/ para iniciar.`);
}

void scanExisting();
void scanDownloads();
