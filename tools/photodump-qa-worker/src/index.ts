import chokidar from "chokidar";
import { access, mkdir, rename } from "node:fs/promises";
import path from "node:path";
import { GeminiVisualProvider } from "./provider.js";
import { runJob } from "./core.js";

const root = path.resolve(process.env.QA_JOBS_DIR || "./jobs");
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) throw new Error("Falta GEMINI_API_KEY en el entorno.");

const provider = new GeminiVisualProvider(apiKey);
await mkdir(root, { recursive: true });
const active = new Set<string>();

async function processJob(jobFile: string) {
  const jobDir = path.dirname(jobFile);
  if (active.has(jobDir) || path.basename(jobDir).startsWith("_")) return;
  try {
    await access(path.join(jobDir, "READY"));
  } catch {
    return;
  }
  active.add(jobDir);
  console.log(`[QA] Procesando ${jobDir}`);
  try {
    const report = await runJob(jobDir, provider);
    await rename(path.join(jobDir, "READY"), path.join(jobDir, report.status === "pass" ? "DONE" : "REVIEW"));
    console.log(`[QA] ${report.jobId}: ${report.score}/100 (${report.status})`);
  } catch (error) {
    console.error(`[QA] Error en ${jobDir}`, error);
  } finally {
    active.delete(jobDir);
  }
}

const watcher = chokidar.watch(path.join(root, "*/job.json"), { ignoreInitial: false, awaitWriteFinish: { stabilityThreshold: 1500, pollInterval: 200 } });
watcher.on("add", processJob).on("change", processJob);
console.log(`[QA] Observando trabajos en ${root}. Crea job.json y un archivo vacío READY para iniciar.`);
