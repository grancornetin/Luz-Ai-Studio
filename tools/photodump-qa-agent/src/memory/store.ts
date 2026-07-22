import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ReferenceIndex, ReferenceDescriptor } from "../schema.js";

export class ReferenceMemory {
  private readonly indexPath: string;
  private index: ReferenceIndex = {};
  private loaded = false;

  constructor(private readonly referencesDir: string) {
    this.indexPath = path.join(referencesDir, "index.json");
  }

  async load(): Promise<void> {
    if (this.loaded) return;
    await mkdir(this.referencesDir, { recursive: true });
    try {
      this.index = JSON.parse(await readFile(this.indexPath, "utf8"));
    } catch {
      this.index = {};
    }
    this.loaded = true;
  }

  async save(): Promise<void> {
    await writeFile(this.indexPath, JSON.stringify(this.index, null, 2));
  }

  static hashFile(bytes: Buffer): string {
    return createHash("sha256").update(bytes).digest("hex");
  }

  get(hash: string): ReferenceDescriptor | undefined {
    return this.index[hash];
  }

  set(descriptor: ReferenceDescriptor): void {
    this.index[descriptor.hash] = descriptor;
  }

  has(hash: string): boolean {
    return Boolean(this.index[hash]);
  }
}
