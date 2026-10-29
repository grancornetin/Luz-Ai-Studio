// scripts/piloto-spikes/ledger-test.mjs
// Pruebas del libro de gasto (W8). Ejecutar:  node scripts/piloto-spikes/ledger-test.mjs
// No instala nada: usa esbuild (ya viene con vite) para compilar api/_piloto/ledger.ts
// y lo prueba con un Redis y un Firestore falsos en memoria.

import { build } from 'esbuild';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const outfile = path.join(root, `node_modules/.cache-ledger-test-${process.pid}.mjs`);
await build({
  entryPoints: [path.join(root, 'api/_piloto/ledger.ts')],
  bundle: true, platform: 'node', format: 'esm', outfile, logLevel: 'error',
  external: ['@upstash/redis', 'firebase-admin', 'firebase-admin/*', '@vercel/node'],
});
const L = await import(pathToFileURL(outfile).href);
fs.rmSync(outfile, { force: true });

// ── Redis falso (cada exec() es atómico, igual que MULTI) ───────────────────
function fakeRedis({ failing = false } = {}) {
  const data = new Map();
  const tick = () => new Promise(r => setImmediate(r));
  const guard = () => { if (failing) throw new Error('redis caído'); };
  return {
    data,
    async get(k) { await tick(); guard(); return data.has(k) ? data.get(k) : null; },
    async set(k, v, o) { await tick(); guard(); if (o?.nx && data.has(k)) return null; data.set(k, v); return 'OK'; },
    async del(...ks) { await tick(); guard(); let n = 0; for (const k of ks) if (data.delete(k)) n++; return n; },
    multi() {
      const ops = [];
      const m = {
        incrby(k, n) { ops.push(['i', k, n]); return m; },
        decrby(k, n) { ops.push(['i', k, -n]); return m; },
        expire() { ops.push(['e']); return m; },
        async exec() {
          await tick(); guard();
          return ops.map(([t, k, n]) => {
            if (t === 'e') return 1;
            const v = (Number(data.get(k)) || 0) + n; data.set(k, v); return v;
          });
        },
      };
      return m;
    },
  };
}
function fakeStore(initialTotalMicros = null) {
  const entries = []; const alerts = [];
  return {
    entries, alerts,
    async readTotalMicros() { return initialTotalMicros; },
    async writeEntry(e) { entries.push(e); },
    async setAlert(_u, a) { alerts.push(a); },
  };
}
const baseCaps = {
  totalCapUSD: 100, dailyCapUSD: 100,
  weeklyCapByKind: { image: 100, text: 100, vision: 100, video: 0 },
  videoPerClipCapUSD: 1.5, videoDailyCapUSD: 1.5, alertAt: 0.8,
};
const mk = (over = {}, redis = fakeRedis(), store = fakeStore()) => ({
  redis, store, ledger: L.createLedger({ redis, store, caps: { ...baseCaps, ...over }, now: () => Date.parse('2026-10-22T15:00:00Z') }),
});

let passed = 0;
async function t(name, fn) { await fn(); passed++; console.log('  ok  -', name); }

await t('tope DIARIO corta (y lo ya gastado no se pierde)', async () => {
  const { ledger, store } = mk({ dailyCapUSD: 1 });
  const a = await ledger.checkBudget('u1', 'image', 0.4);
  const b = await ledger.checkBudget('u1', 'image', 0.4);
  const c = await ledger.checkBudget('u1', 'image', 0.4);
  assert.equal(a.allowed, true); assert.equal(b.allowed, true);
  assert.equal(c.allowed, false); assert.equal(c.code, 'DAILY_CAP');
  assert.match(c.reason, /tope de gasto de hoy/);
  assert.ok(store.alerts.some(x => x.level === 'cut'));
  // una más chica que sí cabe (0.2) sigue permitida: la negada no dejó residuo
  assert.equal((await ledger.checkBudget('u1', 'image', 0.2)).allowed, true);
});

await t('tope TOTAL corta', async () => {
  const { ledger } = mk({ totalCapUSD: 1 });
  assert.equal((await ledger.checkBudget('u1', 'text', 0.6)).allowed, true);
  const d = await ledger.checkBudget('u1', 'text', 0.6);
  assert.equal(d.allowed, false); assert.equal(d.code, 'TOTAL_CAP');
});

await t('tope total sobrevive a que Redis pierda el contador (re-siembra desde Firestore)', async () => {
  const { ledger } = mk({ totalCapUSD: 1 }, fakeRedis(), fakeStore(950_000)); // Firestore dice 0,95 gastado
  const d = await ledger.checkBudget('u1', 'text', 0.2);
  assert.equal(d.allowed, false); assert.equal(d.code, 'TOTAL_CAP');
});

await t('tope SEMANAL por tipo; otro tipo no se afecta', async () => {
  const { ledger } = mk({ weeklyCapByKind: { image: 0.5, text: 5, vision: 5, video: 0 } });
  assert.equal((await ledger.checkBudget('u1', 'image', 0.4)).allowed, true);
  const d = await ledger.checkBudget('u1', 'image', 0.4);
  assert.equal(d.code, 'WEEKLY_CAP');
  assert.equal((await ledger.checkBudget('u1', 'text', 0.4)).allowed, true);
});

await t('CONCURRENCIA: 40 llamadas simultáneas no superan el tope', async () => {
  const { ledger, redis } = mk({ totalCapUSD: 1, dailyCapUSD: 1 });
  const results = await Promise.all(Array.from({ length: 40 }, () => ledger.checkBudget('u1', 'image', 0.1)));
  const okCount = results.filter(r => r.allowed).length;
  assert.ok(okCount <= 10, `pasaron ${okCount} (máximo 10)`);
  assert.ok(okCount >= 1);
  const total = redis.data.get('piloto:b:u1:total');
  assert.ok(total <= 1_000_000, `contador final ${total}`);
  assert.ok(total >= okCount * 100_000 - 1);
});

await t('CONCURRENCIA: dos llamadas que juntas pasarían el tope -> nunca pasan las dos', async () => {
  for (let i = 0; i < 25; i++) {
    const { ledger } = mk({ totalCapUSD: 1 });
    const [x, y] = await Promise.all([ledger.checkBudget('u1', 'image', 0.6), ledger.checkBudget('u1', 'image', 0.6)]);
    assert.ok(!(x.allowed && y.allowed), 'pasaron las dos');
  }
});

await t('uid FUERA de la allowlist: no es piloto y el libro no lo toca', async () => {
  const env = { PILOT_UIDS: 'ana, bea' };
  assert.equal(L.isPilotUid('ana', env), true);
  assert.equal(L.isPilotUid('intrusa', env), false);
  assert.equal(L.isPilotUid('', env), false);
  assert.equal(L.isPilotUid('ana', {}), false, 'sin PILOT_UIDS nadie es piloto');
  // el gasto de la piloto no mueve contadores de otra cuenta
  const { ledger, redis } = mk({ dailyCapUSD: 1 });
  await ledger.checkBudget('ana', 'image', 0.9);
  assert.equal((await ledger.checkBudget('ana', 'image', 0.9)).allowed, false);
  assert.ok([...redis.data.keys()].every(k => k.startsWith('piloto:b:ana:') || k.startsWith('piloto:resv:')));
  assert.equal(L.isLockdownOn({}), false);
  assert.equal(L.isLockdownOn({ PILOT_LOCKDOWN: '1' }), true);
});

await t('reservar -> confirmar ajusta la diferencia y es idempotente', async () => {
  const { ledger, redis, store } = mk();
  const r = await ledger.checkBudget('u1', 'image', 0.10);
  await ledger.recordSpend({ uid: 'u1', kind: 'image', model: 'm', units: 1, unit: 'image', costUSD: 0.07, reservationId: r.reservationId });
  await ledger.recordSpend({ uid: 'u1', kind: 'image', model: 'm', units: 1, unit: 'image', costUSD: 0.07, reservationId: r.reservationId });
  assert.equal(redis.data.get('piloto:b:u1:total'), 70_000);
  assert.equal(store.entries.length, 1);
  assert.equal(store.entries[0].costUSD, 0.07);
});

await t('liberar una reserva devuelve el monto (y no se puede liberar dos veces)', async () => {
  const { ledger, redis } = mk();
  const r = await ledger.checkBudget('u1', 'image', 0.5);
  await ledger.releaseReservation(r.reservationId);
  await ledger.releaseReservation(r.reservationId);
  assert.equal(redis.data.get('piloto:b:u1:total'), 0);
});

await t('alerta al 80 %', async () => {
  const { ledger, store } = mk({ totalCapUSD: 10 });
  const a = await ledger.checkBudget('u1', 'image', 7);
  assert.equal(a.allowed && a.alert, false);
  const b = await ledger.checkBudget('u1', 'image', 1.5);
  assert.equal(b.allowed && b.alert, true);
  assert.ok(store.alerts.some(x => x.level === 'warn'));
});

await t('video apagado mientras el precio esté "pendiente"', async () => {
  const { ledger } = mk({ weeklyCapByKind: { image: 9, text: 9, vision: 9, video: 9 } });
  const d = await ledger.checkBudget('u1', 'video', 0.5);
  assert.equal(d.allowed, false); assert.equal(d.code, 'VIDEO_OFF');
});

await t('falla CERRADO si Redis está caído', async () => {
  const { ledger } = mk({}, fakeRedis({ failing: true }));
  const d = await ledger.checkBudget('u1', 'image', 0.1);
  assert.equal(d.allowed, false); assert.equal(d.code, 'LEDGER_ERROR');
});

await t('estimaciones inválidas se rechazan', async () => {
  const { ledger } = mk();
  for (const bad of [0, -1, NaN, Infinity]) assert.equal((await ledger.checkBudget('u1', 'image', bad)).allowed, false);
});

await t('día y semana en hora de Santiago', async () => {
  assert.equal(L.dayKey(Date.parse('2026-10-22T02:00:00Z')), '2026-10-21'); // 23:00 del 21 en Chile (UTC-3)
  assert.match(L.weekKey(Date.parse('2026-10-22T15:00:00Z')), /^2026-W4\d$/);
});

await t('estimación de content.ts: texto vs visión', async () => {
  const a = L.estimateContentRequestUSD({ action: 'generateText', prompt: 'x'.repeat(3000) });
  const b = L.estimateContentRequestUSD({ action: 'analyzeScene', prompt: 'hola', images: ['a'] });
  assert.equal(a.kind, 'text'); assert.equal(b.kind, 'vision');
  assert.ok(a.usd > 0 && a.usd < 0.05);
});

console.log(`\n${passed} pruebas OK`);
