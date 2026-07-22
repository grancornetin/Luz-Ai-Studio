import chokidar from "chokidar";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { GeminiEvaluator } from "./evaluate/provider.js";
import { isTestReady } from "./ingest/testFolder.js";
import { runTest } from "./runTest.js";
import { buildBatchSummary } from "./report/markdown.js";
import type { TestReport } from "./schema.js";

if (!process.env.QA_AGENT_ROOT) throw new Error("Falta QA_AGENT_ROOT en el entorno (carpeta LuzPhotodumpAgent).");
if (!process.env.QA_REPO_ROOT) throw new Error("Falta QA_REPO_ROOT en el entorno (carpeta del repo Luz IA Studio).");
if (!process.env.GEMINI_API_KEY) throw new Error("Falta GEMINI_API_KEY en el entorno.");

const agentRoot: string = process.env.QA_AGENT_ROOT;
const repoRoot: string = process.env.QA_REPO_ROOT;
const apiKey: string = process.env.GEMINI_API_KEY;

const evaluator = new GeminiEvaluator(apiKey);
const inboxRoot = path.join(agentRoot, "INBOX");
await mkdir(inboxRoot, { recursive: true });
await mkdir(path.join(agentRoot, "REFERENCES"), { recursive: true });
await mkdir(path.join(agentRoot, "RESULTS"), { recursive: true });
await mkdir(path.join(agentRoot, "REPORTS"), { recursive: true });

const active = new Set<string>();
const pendingBatch: TestReport[] = [];
let batchTimer: NodeJS.Timeout | undefined;

async function processTest(testId: string) {
  const testDir = path.join(inboxRoot, testId);
  if (active.has(testId)) return;
  if (!(await isTestReady(testDir))) return;

  active.add(testId);
  console.log(`[QA] Procesando ${testId}`);
  try {
    const report = await runTest(testId, { agentRoot, repoRoot }, evaluator);
    console.log(`[QA] ${testId}: ${report.score}/100 (${report.status}), ${report.locatedFindings.length} hallazgo(s)`);
    pendingBatch.push(report);
    scheduleBatchSummary();
  } catch (error) {
    console.error(`[QA] Error en ${testId}`, error);
  } finally {
    active.delete(testId);
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
    if (entry.isDirectory()) await processTest(entry.name);
  }
}

await scanExisting();

const watcher = chokidar.watch(inboxRoot, {
  depth: 1,
  ignoreInitial: true,
  awaitWriteFinish: { stabilityThreshold: 1500, pollInterval: 200 },
});
watcher.on("add", filePath => {
  const testId = path.basename(path.dirname(filePath));
  void processTest(testId);
});
console.log(`[QA] Observando ${inboxRoot}. Copia images.zip + debug.json en INBOX/<nombre-de-prueba>/ para iniciar.`);
