import { GoogleGenAI } from "@google/genai";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { QaJob, ShotReport, Finding } from "./schema.js";

function mimeFor(file: string): string {
  const ext = path.extname(file).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  return "image/jpeg";
}

async function imagePart(file: string) {
  const bytes = await readFile(file);
  return { inlineData: { mimeType: mimeFor(file), data: bytes.toString("base64") } };
}

const SYSTEM = `You are Luz Photodump QA, a strict forensic reviewer of AI-generated social media photography.
Evaluate only visible evidence. Never invent defects. Compare the output against supplied references, prompt and objective.
Return JSON only with: score 0-100, findings[]. Each finding: criterion, score, severity(info|warning|critical), title, evidence, probableCause, correction.
Prioritize identity, body, hair, outfit fidelity, anatomy, scene fidelity, invented objects, pose, raw iPhone realism, continuity and story.
Critical defects include extra/missing limbs, wrong identity, substituted outfit, duplicated major scene objects, impossible hands, or a shot that contradicts its objective.`;

export class GeminiVisualProvider {
  private readonly ai: GoogleGenAI;
  private readonly model: string;

  constructor(apiKey: string, model = process.env.QA_MODEL || "gemini-2.5-flash") {
    this.ai = new GoogleGenAI({ apiKey });
    this.model = model;
  }

  async evaluateShot(job: QaJob, shotIndex: number, root: string): Promise<ShotReport> {
    const shot = job.shots[shotIndex];
    const referenceFiles = [...job.globalReferences, ...shot.references];
    const parts: any[] = [{ text: `${SYSTEM}\n\nJOB:\n${JSON.stringify({ brief: job.brief, criteria: job.criteria, shot }, null, 2)}\nThe first image is the generated output. Remaining images are references.` }];
    parts.push(await imagePart(path.resolve(root, shot.image)));
    for (const ref of referenceFiles) parts.push(await imagePart(path.resolve(root, ref)));

    const response = await this.ai.models.generateContent({
      model: this.model,
      contents: [{ role: "user", parts }],
      config: { responseMimeType: "application/json", temperature: 0.1 },
    });
    const parsed = JSON.parse(response.text || "{}") as { score?: number; findings?: Finding[] };
    const score = Math.max(0, Math.min(100, Number(parsed.score ?? 0)));
    const status = score >= job.thresholds.pass ? "pass" : score <= job.thresholds.critical ? "fail" : "review";
    return { shotId: shot.id, score, status, findings: Array.isArray(parsed.findings) ? parsed.findings : [] };
  }
}
