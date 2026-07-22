import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { ingestTest } from "./ingest/testFolder.js";
import { ReferenceMemory } from "./memory/store.js";
import { resolveReferenceDescriptor } from "./memory/referenceIndex.js";
import { GeminiEvaluator } from "./evaluate/provider.js";
import { locateFinding } from "./diagnose/repoLocator.js";
import { buildMarkdownReport } from "./report/markdown.js";
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

  // Referencias globales del banco: cualquier imagen ya puesta en REFERENCES/
  // se indexa una sola vez y se reusa entre corridas.
  const referenceFiles = await readdir(referencesDir, { withFileTypes: true }).then(entries =>
    entries.filter(e => e.isFile() && /\.(png|jpe?g|webp)$/i.test(e.name)).map(e => path.join(referencesDir, e.name)),
  );
  const referenceDescriptions: string[] = [];
  for (const file of referenceFiles) {
    const descriptor = await resolveReferenceDescriptor(evaluator.client, evaluator.modelName, memory, file);
    referenceDescriptions.push(descriptor.description);
  }
  await memory.save();

  const shotEvaluations = [];
  for (let i = 0; i < ingested.imageFiles.length; i += 1) {
    const imageFile = ingested.imageFiles[i];
    const shotDebug = shots[i];
    const shotId = shotDebug?.key ?? shotDebug?.role ?? `shot_${i}`;
    const evaluation = await evaluator.evaluateShot({
      shotId,
      imageFile,
      referenceDescriptions,
      prompt: shotDebug?.prompt ?? "",
      objective: shotDebug?.shotIntent ?? shotDebug?.role ?? "",
      pass: 82,
      critical: 55,
    });
    shotEvaluations.push(evaluation);
  }

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
