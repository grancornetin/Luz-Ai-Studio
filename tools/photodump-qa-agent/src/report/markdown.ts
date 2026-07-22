import type { TestReport } from "../schema.js";

const SEVERITY_LABEL: Record<string, string> = {
  critical: "🔴 Crítico",
  warning: "🟡 Atención",
  info: "🔵 Info",
};

function findingBlock(f: TestReport["locatedFindings"][number]): string {
  const location = f.suspectFile
    ? `\`${f.suspectFile}:${f.suspectLine}\` (confianza: ${f.locatorConfidence})`
    : `sin ubicación determinada (confianza: ${f.locatorConfidence})`;
  const snippet = f.suspectSnippet ? `\n  \`\`\`\n  ${f.suspectSnippet}\n  \`\`\`` : "";
  const notes = f.locatorNotes ? `\n  Nota: ${f.locatorNotes}` : "";
  return `- **${SEVERITY_LABEL[f.severity] ?? f.severity} — ${f.title}** (shot \`${f.shotId}\`, ${f.criterion})
  Evidencia: ${f.evidence}
  Causa probable (visual): ${f.probableCause}
  Sospecha en código: ${location}${snippet}${notes}`;
}

export function buildMarkdownReport(report: TestReport): string {
  const critical = report.locatedFindings.filter(f => f.severity === "critical");
  const warning = report.locatedFindings.filter(f => f.severity === "warning");
  const info = report.locatedFindings.filter(f => f.severity === "info");

  const lines: string[] = [];
  lines.push(`# QA Photodump — ${report.testId}`);
  lines.push("");
  lines.push(`Receta: \`${report.recipeId}\` · Evaluado: ${report.evaluatedAt}`);
  lines.push(`Score global: **${report.score}/100** · Estado: **${report.status}**`);
  lines.push("");
  lines.push(report.summary);
  lines.push("");
  lines.push(`## Resumen de hallazgos (${report.locatedFindings.length})`);
  lines.push(`- 🔴 Críticos: ${critical.length}`);
  lines.push(`- 🟡 Atención: ${warning.length}`);
  lines.push(`- 🔵 Info: ${info.length}`);
  lines.push("");

  if (critical.length > 0) {
    lines.push("## Críticos");
    lines.push(...critical.map(findingBlock));
    lines.push("");
  }
  if (warning.length > 0) {
    lines.push("## Atención");
    lines.push(...warning.map(findingBlock));
    lines.push("");
  }
  if (info.length > 0) {
    lines.push("## Info");
    lines.push(...info.map(findingBlock));
    lines.push("");
  }

  lines.push("## Detalle por shot");
  for (const shot of report.shots) {
    lines.push(`### ${shot.shotId} — ${shot.score}/100 — ${shot.status}`);
    lines.push(`Imagen: \`${shot.imageFile}\``);
    if (shot.findings.length === 0) lines.push("Sin hallazgos.");
    lines.push("");
  }

  return lines.join("\n");
}

export function buildBatchSummary(reports: TestReport[]): string {
  const totalFindings = reports.reduce((sum, r) => sum + r.locatedFindings.length, 0);
  const critical = reports.reduce((sum, r) => sum + r.locatedFindings.filter(f => f.severity === "critical").length, 0);
  const lines: string[] = [];
  lines.push(`# Resumen de corrida QA — ${new Date().toISOString()}`);
  lines.push("");
  lines.push(`Se revisaron **${reports.length}** prueba(s) nueva(s), se detectaron **${totalFindings}** hallazgo(s) (${critical} crítico(s)).`);
  lines.push("");
  for (const r of reports) {
    lines.push(`- **${r.testId}** (\`${r.recipeId}\`) — ${r.score}/100, ${r.status}, ${r.locatedFindings.length} hallazgo(s)`);
  }
  return lines.join("\n");
}
