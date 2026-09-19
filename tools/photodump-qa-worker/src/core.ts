import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { jobSchema, type QaReport, type Finding } from "./schema.js";
import { GeminiVisualProvider } from "./provider.js";

function esc(value: unknown): string {
  return String(value ?? "").replace(/[&<>\"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] || c));
}

function statusFor(score: number, pass: number, critical: number): "pass" | "review" | "fail" {
  return score >= pass ? "pass" : score <= critical ? "fail" : "review";
}

function html(report: QaReport): string {
  const shots = report.shots.map(s => `<section><h2>${esc(s.shotId)} — ${s.score}/100 — ${s.status}</h2>${s.findings.map(f => `<article class="${f.severity}"><h3>${esc(f.title)}</h3><p><b>${esc(f.criterion)}</b>: ${esc(f.evidence)}</p><p><b>Causa probable:</b> ${esc(f.probableCause)}</p><p><b>Corrección:</b> ${esc(f.correction)}</p></article>`).join("")}</section>`).join("");
  return `<!doctype html><html lang="es"><meta charset="utf-8"><title>QA ${esc(report.jobId)}</title><style>body{font-family:system-ui;max-width:1000px;margin:40px auto;padding:0 20px;background:#f5f5f5;color:#171717}header,section{background:white;padding:24px;margin:16px 0;border-radius:14px}.critical{border-left:5px solid #b91c1c;padding-left:14px}.warning{border-left:5px solid #b45309;padding-left:14px}.info{border-left:5px solid #0369a1;padding-left:14px}</style><header><h1>${esc(report.recipeId)}</h1><p>Score: <b>${report.score}</b> · Estado: <b>${report.status}</b></p><p>${esc(report.summary)}</p></header>${shots}</html>`;
}

export async function runJob(jobDir: string, provider: GeminiVisualProvider): Promise<QaReport> {
  const raw = JSON.parse(await readFile(path.join(jobDir, "job.json"), "utf8"));
  const job = jobSchema.parse(raw);
  const shots = [];
  for (let i = 0; i < job.shots.length; i += 1) shots.push(await provider.evaluateShot(job, i, jobDir));
  const score = Math.round(shots.reduce((sum, shot) => sum + shot.score, 0) / shots.length);
  const criticals = shots.flatMap(s => s.findings).filter(f => f.severity === "critical");
  const sequenceFindings: Finding[] = [];
  const report: QaReport = {
    jobId: job.id,
    recipeId: job.recipeId,
    createdAt: new Date().toISOString(),
    score,
    status: criticals.length > 0 ? "fail" : statusFor(score, job.thresholds.pass, job.thresholds.critical),
    shots,
    sequenceFindings,
    summary: criticals.length > 0 ? `${criticals.length} error(es) crítico(s). Requiere regeneración o revisión humana.` : score >= job.thresholds.pass ? "Secuencia aprobada por el evaluador automático." : "Secuencia utilizable, pero requiere revisión humana de los hallazgos señalados.",
  };
  const out = path.join(jobDir, "reports");
  await mkdir(out, { recursive: true });
  await writeFile(path.join(out, "report.json"), JSON.stringify(report, null, 2));
  await writeFile(path.join(out, "report.html"), html(report));
  return report;
}
