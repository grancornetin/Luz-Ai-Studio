import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import type { Finding, LocatedFinding } from "../schema.js";
import { RECIPE_SOURCE_MAP, SHARED_SOURCE_LOCATIONS, CRITERION_KEYWORDS } from "./recipeMap.js";

type FileHit = { file: string; line: number; snippet: string; score: number };

async function listTsFiles(root: string): Promise<string[]> {
  const st = await stat(root).catch(() => null);
  if (!st) return [];
  if (st.isFile()) return [root];
  const out: string[] = [];
  const entries = await readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) out.push(...await listTsFiles(full));
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

async function searchKeywords(files: string[], keywords: string[]): Promise<FileHit[]> {
  const hits: FileHit[] = [];
  for (const file of files) {
    const content = await readFile(file, "utf8").catch(() => "");
    if (!content) continue;
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      const matched = keywords.filter(k => line.toLowerCase().includes(k.toLowerCase()));
      if (matched.length > 0) {
        hits.push({ file, line: i + 1, snippet: line.trim(), score: matched.length });
      }
    }
  }
  return hits.sort((a, b) => b.score - a.score);
}

/**
 * Dado un finding del evaluador visual + el recipeId real (sacado de
 * debug.json, no de una suposición de Gemini), busca de forma determinista
 * en el repo qué archivo/línea es más probable que haya producido el defecto.
 * No reemplaza el diagnóstico humano — reduce dónde mirar primero.
 */
export async function locateFinding(
  repoRoot: string,
  recipeId: string,
  finding: Finding,
): Promise<LocatedFinding> {
  const keywords = CRITERION_KEYWORDS[finding.criterion] ?? [finding.criterion];
  const recipeLocations = RECIPE_SOURCE_MAP[recipeId];

  const searchRoots = [
    ...(recipeLocations ?? []),
    ...SHARED_SOURCE_LOCATIONS,
  ].map(rel => path.join(repoRoot, rel));

  let files: string[] = [];
  for (const root of searchRoots) files.push(...await listTsFiles(root));

  if (!recipeLocations) {
    // Receta no mapeada todavía: buscar por nombre de carpeta en recipes/.
    const recipesRoot = path.join(repoRoot, "src/modules/photodump/recipes");
    files.push(...await listTsFiles(recipesRoot));
  }

  const hits = await searchKeywords(files, keywords);
  const best = hits[0];

  if (!best) {
    return {
      ...finding,
      recipeId,
      locatorConfidence: "none",
      locatorNotes: `No se encontraron coincidencias para las palabras clave [${keywords.join(", ")}] en las rutas mapeadas para "${recipeId}". Puede ser una receta sin mapear o un defecto puramente del modelo de imagen, no del código.`,
    };
  }

  const confidence: LocatedFinding["locatorConfidence"] =
    best.score >= 2 ? "high" : best.score === 1 ? "medium" : "low";

  return {
    ...finding,
    recipeId,
    suspectFile: path.relative(repoRoot, best.file),
    suspectLine: best.line,
    suspectSnippet: best.snippet,
    locatorConfidence: confidence,
    locatorNotes: hits.length > 1 ? `${hits.length} coincidencias totales, mostrando la de mayor score (${best.score}).` : undefined,
  };
}
