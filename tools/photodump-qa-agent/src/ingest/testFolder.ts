import { createReadStream } from "node:fs";
import { mkdir, readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import unzipper from "unzipper";

export type IngestedTest = {
  testId: string;
  resultDir: string;
  imageFiles: string[];
  debugData: any;
};

/**
 * Un test en INBOX/<testId>/ trae images.zip (el "↓ ZIP" de PhotodumpModule)
 * y debug.json (el botón "Debug" — mismo currentSet.debugData serializado).
 * Ambos ya existen hoy en la UI; acá solo se extraen y normalizan.
 */
export async function ingestTest(inboxTestDir: string, resultsRoot: string): Promise<IngestedTest> {
  const testId = path.basename(inboxTestDir);
  const zipPath = path.join(inboxTestDir, "images.zip");
  const debugPath = path.join(inboxTestDir, "debug.json");

  const debugData = JSON.parse(await readFile(debugPath, "utf8"));

  const resultDir = path.join(resultsRoot, testId);
  await mkdir(resultDir, { recursive: true });
  await createReadStream(zipPath).pipe(unzipper.Extract({ path: resultDir })).promise();

  const entries = await readdir(resultDir, { withFileTypes: true });
  const imageFiles = entries
    .filter(e => e.isFile() && /\.(png|jpe?g|webp)$/i.test(e.name))
    .map(e => path.join(resultDir, e.name))
    .sort();

  return { testId, resultDir, imageFiles, debugData };
}

export async function isTestReady(inboxTestDir: string): Promise<boolean> {
  try {
    await readFile(path.join(inboxTestDir, "images.zip"));
    await readFile(path.join(inboxTestDir, "debug.json"));
    return true;
  } catch {
    return false;
  }
}

export async function clearInboxTest(inboxTestDir: string): Promise<void> {
  await rm(inboxTestDir, { recursive: true, force: true });
}
