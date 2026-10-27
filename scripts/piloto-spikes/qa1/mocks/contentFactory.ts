// Fábrica real, pero con una entrada/salida simulada (no gasta ni usa la red).
import type { FactoryIO } from '@repo/modules/piloto/contentFactory?real';
import { ph, qaState, wait } from './qa';
export * from '@repo/modules/piloto/contentFactory?real';

export function createDefaultIO(): FactoryIO {
  let n = 0;
  return {
    async loadRefs(items) { return items.flatMap((i: any) => i.originalPhotos.map((p: any) => ({ dataUrl: 'd', smallDataUrl: 'd', srcUrl: p.url, itemId: i.id }))); },
    async buildPayloads(_i, shots) { return shots.map((s, k) => ({ shotId: `s${k}`, shotType: s, referenceImages: [], aspectRatio: '4:5', negativePrompt: '', prompt: 'x' })) as any; },
    async generate() {
      const s = qaState();
      await wait(s === 'generating' ? 2500 : 600);
      if (s === 'budget') throw Object.assign(new Error('402 {"code":"BUDGET_LIMIT"}'), { raw: '{"code":"BUDGET_LIMIT"}' });
      return ph(n++);
    },
    async check() { return { score: 90, issues: [], hasPerson: false }; },
    async saveGenerated(_u, name, dataUrl) { return { url: dataUrl, path: name }; },
    async saveAssetDoc() {},
    async patchTask() {},
    sleep: wait,
    now: () => Date.now(),
  };
}
