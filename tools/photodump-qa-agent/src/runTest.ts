import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { ingestTest } from "./ingest/testFolder.js";
import { ReferenceMemory } from "./memory/store.js";
import { listReferenceFiles, resolveReferenceDescriptor } from "./memory/referenceIndex.js";
import { GeminiEvaluator } from "./evaluate/provider.js";
import { locateFinding } from "./diagnose/repoLocator.js";
import { buildMarkdownReport } from "./report/markdown.js";
import { RateLimiter } from "./rateLimiter.js";
import { withRetryOn429 } from "./retry.js";
import type { TestReport, LocatedFinding } from "./schema.js";

export type AgentPaths = {
  agentRoot: string;
  repoRoot: string;
};

function statusFromScore(score: number, pass = 82, critical = 55): "pass" | "review" | "fail" {
  return score >= pass ? "pass" : score <= critical ? "fail" : "review";
}

export async function runTest(testId: string, paths: AgentPaths, evaluator: GeminiEvaluator): Promise<TestReport> {
  const inboxDir = path.join(paths.agentRoot, "INBOX", testId);
  const resultsRoot = path.join(paths.agentRoot, "RESULTS");
  const referencesDir = path.join(paths.agentRoot, "REFERENCES");
  const reportsDir = path.join(paths.agentRoot, "REPORTS", testId);

  const ingested = await ingestTest(inboxDir, resultsRoot);
  const debug = ingested.debugData;
  const recipeId: string = debug?.recipe ?? "unknown";
  const shots: any[] = Array.isArray(debug?.shots) ? debug.shots : [];

  const memory = new ReferenceMemory(referencesDir);
  await memory.load();

  // Una sola llamada a Gemini a la vez, con espera fija entre cada una —
  // visto en vivo que "3 en paralelo + esperar el resto del minuto" seguía
  // chocando con 429 (RESOURCE_EXHAUSTED) en una cuenta de servicio nueva.
  // Mejor lento y confiable que rápido y roto.
  const delaySeconds = Number(process.env.QA_DELAY_BETWEEN_CALLS_SECONDS || 25);
  const rateLimiter = new RateLimiter(delaySeconds * 1000);

  // Referencias globales del banco (incluye subcarpetas, ej. "contenido
  // enfocado en outfits", "contenido influencer"): cada imagen se indexa una
  // sola vez por hash y se reusa entre corridas — nunca se vuelve a mandar a
  // Gemini si ya está en REFERENCES/index.json.
  const allReferenceFiles = await listReferenceFiles(referencesDir);
  const newReferenceFiles: string[] = [];
  const referenceDescriptions: string[] = [];
  for (const file of allReferenceFiles) {
    const bytes = await readFile(file);
    const hash = ReferenceMemory.hashFile(bytes);
    if (memory.has(hash)) {
      referenceDescriptions.push(memory.get(hash)!.description);
    } else {
      newReferenceFiles.push(file);
    }
  }

  // Por defecto NO se indexan referencias nuevas acá — evaluar una prueba
  // debe ser rápido (unos pocos shots), indexar el banco completo es un
  // trabajo aparte que puede tardar horas. Correr `npm run index-references`
  // por separado para ir sumando el banco sin bloquear cada análisis.
  // Si se quiere volver al comportamiento viejo (indexar de a poco en cada
  // corrida), subir QA_REFERENCE_BATCH_SIZE en .env a un número > 0.
  const batchSize = Number(process.env.QA_REFERENCE_BATCH_SIZE || 0);
  const toIndexNow = newReferenceFiles.slice(0, batchSize);
  if (toIndexNow.length > 0) {
    console.log(`[QA] Indexando ${toIndexNow.length} referencia(s) nueva(s), 1 por vez cada ${delaySeconds}s...`);
    const descriptors = await rateLimiter.runAll(toIndexNow, async file => {
      const descriptor = await withRetryOn429(() => resolveReferenceDescriptor(evaluator.client, evaluator.modelName, memory, file));
      await memory.save(); // guardado incremental: si se corta a mitad de camino no se pierde lo ya indexado
      console.log(`[QA]   ✓ ${path.basename(file)}`);
      return descriptor;
    });
    referenceDescriptions.push(...descriptors.map(d => d.description));
  }
  const stillPending = newReferenceFiles.length - toIndexNow.length;
  if (stillPending > 0) {
    console.log(`[QA] Referencias: indexadas ${toIndexNow.length} nueva(s), quedan ${stillPending} pendientes para próximas corridas.`);
  }

  console.log(`[QA] Evaluando ${ingested.imageFiles.length} shot(s), 1 por vez cada ${delaySeconds}s...`);
  const shotEvaluations = await rateLimiter.runAll(ingested.imageFiles, async (imageFile, i) => {
    const shotDebug = shots[i];
    const shotId = shotDebug?.key ?? shotDebug?.role ?? `shot_${i}`;
    const evaluation = await withRetryOn429(() => evaluator.evaluateShot({
      shotId,
      imageFile,
      referenceDescriptions,
      prompt: shotDebug?.prompt ?? "",
      objective: shotDebug?.shotIntent ?? shotDebug?.role ?? "",
      pass: 82,
      critical: 55,
    }));
    console.log(`[QA]   ✓ ${shotId}: ${evaluation.score}/100`);
    return evaluation;
  });

  const allFindings = shotEvaluations.flatMap(s => s.findings);
  const locatedFindings: LocatedFinding[] = [];
  for (const finding of allFindings) {
    locatedFindings.push(await locateFinding(paths.repoRoot, recipeId, finding));
  }

  const score = shotEvaluations.length > 0
    ? Math.round(shotEvaluations.reduce((sum, s) => sum + s.score, 0) / shotEvaluations.length)
    : 0;
  const criticals = locatedFindings.filter(f => f.severity === "critical");
  const status = criticals.length > 0 ? "fail" : statusFromScore(score);

  const report: TestReport = {
    testId,
    recipeId,
    evaluatedAt: new Date().toISOString(),
    score,
    status,
    shots: shotEvaluations,
    locatedFindings,
    summary: criticals.length > 0
      ? `${criticals.length} hallazgo(s) crítico(s). Requiere revisión antes de aprobar.`
      : score >= 82
        ? "Set aprobado por el evaluador automático."
        : "Set utilizable, pero con hallazgos que conviene revisar.",
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "report.json"), JSON.stringify(report, null, 2));
  await writeFile(path.join(reportsDir, "report.md"), buildMarkdownReport(report));

  return report;
}
