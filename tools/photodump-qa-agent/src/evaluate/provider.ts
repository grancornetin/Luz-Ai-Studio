import { GoogleGenAI } from "@google/genai";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Finding, ShotEvaluation } from "../schema.js";

function mimeFor(file: string): string {
  const ext = path.extname(file).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  return "image/jpeg";
}

async function imagePart(filePath: string) {
  const bytes = await readFile(filePath);
  return { inlineData: { mimeType: mimeFor(filePath), data: bytes.toString("base64") } };
}

const SYSTEM = `Eres Luz Photodump QA, un revisor forense y estricto de fotografía generada por IA para redes sociales (estilo UGC/iPhone).
Evalúa solo evidencia visible. Nunca inventes defectos que no se ven. Compara la foto generada contra las referencias entregadas (rostro, cuerpo, outfit, producto, escena) y contra el prompt/objetivo del shot.

Revisa estas categorías, en este orden de prioridad:
1. Identidad: rostro, cabello (color y tipo), edad aparente, consistencia entre shots del mismo set.
2. Anatomía: manos, dedos, brazos, piernas, proporciones, silueta, postura.
3. Outfit: prendas, capas, colores, textura, cómo cae la ropa sobre el cuerpo, accesorios.
4. Producto (si aplica): identidad correcta, cantidad correcta, posición, orientación.
5. Escena: muebles, decoración, duplicaciones de objetos, objetos inventados, continuidad entre shots.
6. Calidad: estilo UGC/cámara de iPhone (no editorial), iluminación, composición, si la foto cumple su rol narrativo.

Devuelve SOLO JSON con: score (0-100) y findings[]. Cada finding: criterion (uno de la lista de categorías en inglés snake_case, ej. "hands", "product_quantity", "invented_objects"), severity ("info"|"warning"|"critical"), title, evidence (qué se ve exactamente), probableCause (tu hipótesis de qué pudo causarlo, en términos visuales/de dirección, no de código).
Defectos críticos: extremidades de más o de menos, identidad equivocada, outfit sustituido, cantidad de producto incorrecta, objetos duplicados de forma imposible, manos imposibles, o un shot que contradice su objetivo narrativo.`;

export class GeminiEvaluator {
  private readonly ai: GoogleGenAI;
  private readonly model: string;

  constructor(apiKey: string, model = process.env.QA_MODEL || "gemini-2.5-flash") {
    this.ai = new GoogleGenAI({ apiKey });
    this.model = model;
  }

  get client(): GoogleGenAI {
    return this.ai;
  }

  get modelName(): string {
    return this.model;
  }

  async evaluateShot(params: {
    shotId: string;
    imageFile: string;
    referenceDescriptions: string[];
    prompt: string;
    objective: string;
    pass: number;
    critical: number;
  }): Promise<ShotEvaluation> {
    const { shotId, imageFile, referenceDescriptions, prompt, objective, pass, critical } = params;
    const context = {
      shotId,
      prompt,
      objective,
      references: referenceDescriptions,
    };
    const parts: any[] = [
      { text: `${SYSTEM}\n\nCONTEXTO DEL SHOT:\n${JSON.stringify(context, null, 2)}\nLa imagen adjunta es la foto generada a evaluar.` },
      await imagePart(imageFile),
    ];

    const response = await this.ai.models.generateContent({
      model: this.model,
      contents: [{ role: "user", parts }],
      config: { responseMimeType: "application/json", temperature: 0.1 },
    });
    const parsed = JSON.parse(response.text || "{}") as { score?: number; findings?: Omit<Finding, "shotId">[] };
    const score = Math.max(0, Math.min(100, Number(parsed.score ?? 0)));
    const findings: Finding[] = (Array.isArray(parsed.findings) ? parsed.findings : []).map(f => ({ ...f, shotId }));
    const status = score >= pass ? "pass" : score <= critical ? "fail" : "review";
    return { shotId, imageFile, score, status, findings };
  }
}
