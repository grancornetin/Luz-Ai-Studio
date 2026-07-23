import { createReadStream } from "node:fs";
import { copyFile, mkdir, readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import unzipper from "unzipper";

export type IngestedTest = {
  testId: string;
  resultDir: string;
  imageFiles: string[];
  debugData: any;
};

const IMAGE_EXT = /\.(png|jpe?g|webp)$/i;

/**
 * Un test en INBOX/<testId>/ trae debug.json (el botón "Debug" de
 * PhotodumpModule) más las imágenes generadas, en dos formatos posibles:
 * - images.zip (copiado a mano) — se extrae a RESULTS/<testId>/.
 * - imágenes sueltas ya en la carpeta (las arma downloadsImporter.ts al
 *   importar automáticamente desde Descargas) — se copian directo.
 */
export async function ingestTest(inboxTestDir: string, resultsRoot: string): Promise<IngestedTest> {
  const testId = path.basename(inboxTestDir);
  const zipPath = path.join(inboxTestDir, "images.zip");
  const debugPath = path.join(inboxTestDir, "debug.json");

  const debugData = JSON.parse(await readFile(debugPath, "utf8"));

  const resultDir = path.join(resultsRoot, testId);
  await mkdir(resultDir, { recursive: true });

  const hasZip = await readFile(zipPath).then(() => true).catch(() => false);
  if (hasZip) {
    await createReadStream(zipPath).pipe(unzipper.Extract({ path: resultDir })).promise();
  } else {
    const inboxEntries = await readdir(inboxTestDir, { withFileTypes: true });
    const looseImages = inboxEntries.filter(e => e.isFile() && IMAGE_EXT.test(e.name));
    for (const img of looseImages) {
      await copyFile(path.join(inboxTestDir, img.name), path.join(resultDir, img.name));
    }
  }

  const entries = await readdir(resultDir, { withFileTypes: true });
  const imageFiles = entries
    .filter(e => e.isFile() && IMAGE_EXT.test(e.name))
    .map(e => path.join(resultDir, e.name))
    .sort();

  return { testId, resultDir, imageFiles, debugData };
}

export async function isTestReady(inboxTestDir: string): Promise<boolean> {
  const debugOk = await readFile(path.join(inboxTestDir, "debug.json")).then(() => true).catch(() => false);
  if (!debugOk) return false;

  const hasZip = await readFile(path.join(inboxTestDir, "images.zip")).then(() => true).catch(() => false);
  if (hasZip) return true;

  const entries = await readdir(inboxTestDir, { withFileTypes: true }).catch(() => []);
  return entries.some(e => e.isFile() && IMAGE_EXT.test(e.name));
}

export async function clearInboxTest(inboxTestDir: string): Promise<void> {
  await rm(inboxTestDir, { recursive: true, force: true });
}
