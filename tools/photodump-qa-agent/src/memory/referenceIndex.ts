import { readFile } from "node:fs/promises";
import path from "node:path";
import type { GoogleGenAI } from "@google/genai";
import { ReferenceMemory } from "./store.js";
import type { ReferenceDescriptor } from "../schema.js";

function mimeFor(file: string): string {
  const ext = path.extname(file).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  return "image/jpeg";
}

const DESCRIBE_PROMPT = `Describe esta imagen de referencia en un párrafo corto (máximo 60 palabras), en español, enfocado solo en rasgos reutilizables para comparar contra fotos generadas por IA: rostro, color y tipo de cabello, edad aparente, silueta/cuerpo, prendas visibles, colores y texturas, objetos o escena si aplica. No opines sobre calidad, solo describe lo que ves.`;

export async function describeReference(ai: GoogleGenAI, model: string, filePath: string): Promise<string> {
  const bytes = await readFile(filePath);
  const response = await ai.models.generateContent({
    model,
    contents: [{
      role: "user",
      parts: [
        { text: DESCRIBE_PROMPT },
        { inlineData: { mimeType: mimeFor(filePath), data: bytes.toString("base64") } },
      ],
    }],
    config: { temperature: 0 },
  });
  return (response.text || "").trim();
}

/**
 * Devuelve el descriptor de una referencia, reusando la memoria por hash de
 * archivo cuando ya fue analizada antes — evita releerla con Gemini.
 */
export async function resolveReferenceDescriptor(
  ai: GoogleGenAI,
  model: string,
  memory: ReferenceMemory,
  filePath: string,
): Promise<ReferenceDescriptor> {
  const bytes = await readFile(filePath);
  const hash = ReferenceMemory.hashFile(bytes);
  const cached = memory.get(hash);
  if (cached) return cached;

  const description = await describeReference(ai, model, filePath);
  const descriptor: ReferenceDescriptor = {
    hash,
    file: filePath,
    description,
    analyzedAt: new Date().toISOString(),
  };
  memory.set(descriptor);
  return descriptor;
}
