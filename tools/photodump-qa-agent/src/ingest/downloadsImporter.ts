import { createHash } from "node:crypto";
import { mkdir, readdir, stat, copyFile, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import unzipper from "unzipper";

const DEBUG_JSON_PATTERN = /^photodump_debug_.*\.json$/i;
const IMAGE_PATTERN = /\.(png|jpe?g|webp)$/i;
const WINDOW_MS = 5 * 60 * 1000; // 5 minutos: ventana entre el debug.json y sus imágenes/zip hermanos

type Candidate = { name: string; fullPath: string; mtimeMs: number };

/**
 * Registro persistente de debug.json ya importados, por hash de CONTENIDO
 * (no de nombre de carpeta) — así un mismo debug.json nunca se reimporta
 * aunque la carpeta de INBOX que se creó la primera vez ya no exista más
 * (se haya renombrado a mano, movido, o borrado tras procesar).
 */
async function loadImportedRegistry(inboxRoot: string): Promise<Set<string>> {
  const registryPath = path.join(inboxRoot, "..", "_imported_from_downloads.json");
  try {
    const raw = JSON.parse(await readFile(registryPath, "utf8"));
    return new Set(Array.isArray(raw) ? raw : []);
  } catch {
    return new Set();
  }
}

async function saveImportedRegistry(inboxRoot: string, registry: Set<string>): Promise<void> {
  const registryPath = path.join(inboxRoot, "..", "_imported_from_downloads.json");
  await writeFile(registryPath, JSON.stringify([...registry], null, 2));
}

function hashContent(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

async function listCandidates(dir: string, matcher: RegExp): Promise<Candidate[]> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const out: Candidate[] = [];
  for (const entry of entries) {
    if (!entry.isFile() || !matcher.test(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    const st = await stat(fullPath);
    out.push({ name: entry.name, fullPath, mtimeMs: st.mtimeMs });
  }
  return out;
}

/**
 * Busca en Descargas debug.json de Photodump que todavía no se importaron
 * (comparando contra processedMarkerDir) y arma automáticamente una carpeta
 * de INBOX con las imágenes hermanas — sueltas (photodump_1.png,
 * photodump_2.png...) o dentro de un .zip descargado en la misma ventana de
 * tiempo. El usuario no tiene que renombrar ni copiar nada a mano.
 */
/**
 * Siembra el registro con los debug.json de pruebas que ya están en INBOX/
 * (procesadas o no, con cualquier nombre de carpeta manual) — para que la
 * primera vez que corre el importador automático no reprocese trabajo ya
 * hecho a mano antes de activar esta función.
 */
async function seedRegistryFromExistingInbox(inboxRoot: string, registry: Set<string>): Promise<boolean> {
  let changed = false;
  const entries = await readdir(inboxRoot, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const debugPath = path.join(inboxRoot, entry.name, "debug.json");
    const bytes = await readFile(debugPath).catch(() => null);
    if (!bytes) continue;
    const hash = hashContent(bytes);
    if (!registry.has(hash)) {
      registry.add(hash);
      changed = true;
    }
  }
  return changed;
}

export async function importFromDownloads(downloadsDir: string, inboxRoot: string): Promise<string[]> {
  const debugFiles = await listCandidates(downloadsDir, DEBUG_JSON_PATTERN);
  const imported: string[] = [];
  const registry = await loadImportedRegistry(inboxRoot);
  let registryChanged = await seedRegistryFromExistingInbox(inboxRoot, registry);

  for (const debugFile of debugFiles) {
    // Identificar por CONTENIDO del debug.json, no por nombre de carpeta —
    // así aunque el usuario haya procesado esta misma prueba antes con un
    // nombre de carpeta manual distinto (ej. "prueba758072"), no se reimporta.
    const debugBytes = await readFile(debugFile.fullPath);
    const contentHash = hashContent(debugBytes);
    if (registry.has(contentHash)) continue;

    const idMatch = debugFile.name.match(/photodump_debug_(.+)\.json$/i);
    const testId = idMatch ? `photodump_${idMatch[1]}` : `photodump_${debugFile.mtimeMs}`;
    const testDir = path.join(inboxRoot, testId);

    // Ya existe una carpeta con este mismo testId autogenerado — no pisarla.
    const alreadyExists = await stat(testDir).then(() => true).catch(() => false);
    if (alreadyExists) {
      registry.add(contentHash);
      registryChanged = true;
      continue;
    }

    // Imágenes sueltas (photodump_1.png, "photodump_1 (1).png", etc.) descargadas cerca del debug.json.
    const looseImages = (await listCandidates(downloadsDir, IMAGE_PATTERN))
      .filter(f => /^photodump_\d+(\s\(\d+\))?\.(png|jpe?g|webp)$/i.test(f.name))
      .filter(f => Math.abs(f.mtimeMs - debugFile.mtimeMs) <= WINDOW_MS);

    // O un .zip descargado en la misma ventana (cualquier nombre — se valida que tenga imágenes adentro).
    const zipCandidates = (await listCandidates(downloadsDir, /\.zip$/i))
      .filter(f => Math.abs(f.mtimeMs - debugFile.mtimeMs) <= WINDOW_MS);

    if (looseImages.length === 0 && zipCandidates.length === 0) continue; // no hay match todavía, puede ser un debug.json más nuevo que sus imágenes

    await mkdir(testDir, { recursive: true });
    await copyFile(debugFile.fullPath, path.join(testDir, "debug.json"));

    if (looseImages.length > 0) {
      // Ordenar por el número en el nombre (photodump_1, photodump_2...) para mantener el orden real del set.
      looseImages.sort((a, b) => {
        const na = Number(a.name.match(/photodump_(\d+)/)?.[1] ?? 0);
        const nb = Number(b.name.match(/photodump_(\d+)/)?.[1] ?? 0);
        return na - nb;
      });
      for (const img of looseImages) {
        await copyFile(img.fullPath, path.join(testDir, img.name.replace(/\s\(\d+\)/, "")));
      }
    } else {
      // Tomar el zip más reciente de la ventana y validar que tenga imágenes.
      const zip = zipCandidates.sort((a, b) => b.mtimeMs - a.mtimeMs)[0];
      const directory = await unzipper.Open.file(zip.fullPath);
      const hasImages = directory.files.some(f => IMAGE_PATTERN.test(f.path));
      if (!hasImages) continue;
      await directory.extract({ path: testDir });
    }

    registry.add(contentHash);
    registryChanged = true;
    imported.push(testId);
  }

  if (registryChanged) await saveImportedRegistry(inboxRoot, registry);
  return imported;
}
