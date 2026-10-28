// scripts/piloto-spikes/qa1-factory-test.mjs
// QA1: pruebas simuladas de contentFactory.ts (SIN gasto, SIN red, SIN login).
//   node scripts/piloto-spikes/qa1-factory-test.mjs
// Compila con esbuild (ya viene con vite) y reemplaza firebase / imageApiService por simulaciones.
// La entrada/salida (FactoryIO) se inyecta, igual que en la app.

import { build } from 'esbuild';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const outfile = path.join(root, `node_modules/.cache-factory-test-${process.pid}.mjs`);

const stubPlugin = {
  name: 'stubs',
  setup(b) {
    const stub = (filter, contents) => b.onResolve({ filter }, a => ({ path: a.path, namespace: 'stub' }));
    b.onResolve({ filter: /^firebase\/(auth|firestore|storage)$/ }, a => ({ path: a.path, namespace: 'stub' }));
    b.onResolve({ filter: /\/firebase$/ }, a => ({ path: a.path, namespace: 'stub' }));
    b.onResolve({ filter: /services\/imageApiService$/ }, a => ({ path: a.path, namespace: 'stub' }));
    b.onResolve({ filter: /productGenerator\/productDirectorService$/ }, a => ({ path: a.path, namespace: 'stub' }));
    b.onLoad({ filter: /.*/, namespace: 'stub' }, a => {
      if (/productDirectorService/.test(a.path)) return { contents: 'export const runProductDirector=()=>{};export const buildShotPlans=()=>{};export const buildPromptPayloadsFromDirectorResult=()=>{};', loader: 'js' };
      if (/imageApiService/.test(a.path)) return { contents: 'export const imageApiService={};export const newSessionId=()=>"sess_test";', loader: 'js' };
      if (/\/firebase$/.test(a.path)) return { contents: 'export const auth={currentUser:{uid:"u1"}};export const db={};export const storage={};', loader: 'js' };
      return { contents: 'export const getAuth=()=>({});export const doc=()=>({});export const getDoc=()=>({});export const setDoc=()=>({});export const updateDoc=()=>({});export const getDownloadURL=()=>"";export const ref=()=>({});export const uploadBytes=()=>({});', loader: 'js' };
    });
  },
};

await build({
  entryPoints: [path.join(root, 'src/modules/piloto/contentFactory.ts')],
  bundle: true, platform: 'node', format: 'esm', outfile, logLevel: 'error',
  plugins: [stubPlugin],
  define: { 'import.meta.env': '{}' },
});
const F = await import(pathToFileURL(outfile).href);
fs.rmSync(outfile, { force: true });

// ── Simulación del IO ────────────────────────────────────────────
const item = (id) => ({
  id, name: `Aros ${id}`, category: 'aros', material: 'resina', color: 'verde', role: 'normal',
  originalPhotos: [{ url: `https://orig/${id}-1.jpg`, path: 'p1' }, { url: `https://orig/${id}-2.jpg`, path: 'p2' }],
  aiTags: [], createdAt: 1, updatedAt: 1,
});
const ITEMS = [item('A'), item('B')];
const mkTask = (over = {}) => ({
  id: 't1', date: '2026-10-27', dayLabel: 'Martes 27 oct', platform: 'Instagram Feed', format: 'Foto', status: 'pending',
  recipeId: 'catalogo_limpio', catalogItemIds: ['A'], caption: 'x', hashtags: '#x', suggestedTime: '19:30', title: 't',
  ...over,
});

function makeIO(opts = {}) {
  const log = { generate: 0, check: 0, saved: [], docs: [], patches: [], payloadCalls: 0 };
  const store = { task: null };
  const io = {
    log,
    async loadRefs(items) { return items.flatMap(i => i.originalPhotos.map(p => ({ dataUrl: 'data:image/jpeg;base64,AAAA', smallDataUrl: 'data:image/jpeg;base64,AAAA', srcUrl: p.url, itemId: i.id }))).slice(0, 4); },
    async buildPayloads(input, shots) {
      log.payloadCalls++;
      if (opts.payloadsThrow) throw opts.payloadsThrow;
      return shots.map((s, i) => ({ shotId: `s${i}`, shotType: s, referenceImages: [], aspectRatio: '4:5', negativePrompt: '', prompt: `P${i}` }));
    },
    async generate(payload, refs, meta) {
      log.generate++;
      if (opts.generate) return opts.generate(payload, meta, log.generate);
      return 'data:image/jpeg;base64,GEN';
    },
    async check(refs, gen, allowPeople) {
      log.check++;
      if (opts.check) return opts.check(log.check);
      return { score: 90, issues: [], hasPerson: false };
    },
    async saveGenerated(uid, name) { log.saved.push(name); return { url: `https://gen/${name}`, path: name }; },
    async saveAssetDoc(uid, a) { log.docs.push(a.id); },
    async patchTask(uid, planId, taskId, patch) { log.patches.push(patch); store.task = { ...(store.task || {}), ...patch }; },
    async sleep() {},
    now: () => 1000,
  };
  return { io, log, store };
}

const results = [];
async function t(name, fn) {
  try { await fn(); results.push([true, name]); console.log('  ok  -', name); }
  catch (e) { results.push([false, name]); console.log('  MAL -', name, '\n       ', e.message.split('\n')[0]); }
}

const produce = (task, io, extra = {}) => F.produceTask({ uid: 'u1', planId: 'p1', task, items: ITEMS, io, ...extra });

await t('camino feliz: 3 opciones listas, con puntaje, sin fallback', async () => {
  const { io, log } = makeIO();
  const r = await produce(mkTask(), io);
  assert.equal(r.generationStatus, 'ready');
  assert.equal(r.assets.length, 3);
  assert.ok(r.assets.every(a => a.status === 'ready' && a.fidelityScore === 90));
  assert.equal(log.generate, 3);
});

await t('doble disparo (misma sesión) es idempotente: 1 sola tanda de generación', async () => {
  const { io, log } = makeIO();
  const [a, b] = await Promise.all([produce(mkTask(), io), produce(mkTask(), io)]);
  assert.equal(log.generate, 3);
  assert.equal(a.assets.length, 3);
  assert.equal(b.assets.length, 3);
});

await t('tarea ya lista no se regenera (segunda llamada sin gasto)', async () => {
  const { io, log } = makeIO();
  const r1 = await produce(mkTask(), io);
  const r2 = await produce(mkTask({ assets: r1.assets, generationStatus: 'ready' }), io);
  assert.equal(log.generate, 3);
  assert.equal(r2.assets.length, 3);
});

await t('reanudación tras cerrar la pestaña: solo genera lo que falta', async () => {
  // Estado que quedó guardado (checkpoint) cuando se cerró la pestaña con 1 de 3 opciones lista
  const saved = [{ id: 't1_v0_0', taskId: 't1', recipeId: 'catalogo_limpio', catalogItemId: 'A', kind: 'image', url: 'https://gen/t1_v0_0.jpg', costUSD: 0.08, fidelityScore: 90, status: 'ready', createdAt: 1 }];
  const b = makeIO();
  const r2 = await produce(mkTask({ assets: saved, generationStatus: 'generating' }), b.io);
  assert.equal(r2.assets.length, 3);
  assert.equal(b.log.generate, 2, 'solo regenera lo faltante');
  assert.equal(r2.generationStatus, 'ready');
});

await t('checkpoint: cada opción terminada se guarda en el plan antes de seguir', async () => {
  const { io, log } = makeIO();
  await produce(mkTask(), io);
  const withAssets = log.patches.filter(p => Array.isArray(p.assets));
  assert.ok(withAssets.length >= 3, `parches con assets: ${withAssets.length}`);
  assert.equal(withAssets[0].assets.length, 1);
});

await t('abortar (salir de la pantalla) corta lo pendiente y no explota', async () => {
  const sig = { aborted: true };
  const { io, log } = makeIO();
  const r = await produce(mkTask(), io, { signal: sig });
  assert.equal(log.generate, 0);
  assert.ok(['failed', 'ready'].includes(r.generationStatus));
});

await t('bloqueo IMAGE_RECITATION permanente -> fallback_original sin pantalla en blanco', async () => {
  const { io, log } = makeIO({ generate: () => { throw Object.assign(new Error('IMAGE_RECITATION'), { code: 'UNKNOWN' }); } });
  const r = await produce(mkTask(), io);
  assert.equal(r.generationStatus, 'ready');
  assert.ok(r.assets.every(a => a.status === 'fallback_original'));
  assert.ok(r.assets.every(a => a.url.startsWith('https://orig/')));
  assert.ok(log.generate <= 12, `intentos acotados (${log.generate})`);
});

await t('bloqueo una vez y luego pasa: reintenta con otra composición y queda lista', async () => {
  let n = 0;
  const { io } = makeIO({ generate: () => { n++; if (n === 1) throw new Error('IMAGE_RECITATION'); return 'data:image/jpeg;base64,GEN'; } });
  const r = await produce(mkTask(), io);
  assert.equal(r.assets.filter(a => a.status === 'ready').length, 3);
});

await t('tope de gasto 402 al generar: error BUDGET_LIMIT amable, nada se cobra de más', async () => {
  const { io, log } = makeIO({ generate: () => { throw Object.assign(new Error('402 {"code":"BUDGET_LIMIT"}'), { raw: '{"code":"BUDGET_LIMIT"}' }); } });
  let err;
  try { await produce(mkTask(), io); } catch (e) { err = e; }
  assert.ok(err instanceof F.FactoryError && err.code === 'BUDGET_LIMIT');
  assert.equal(err.message, F.BUDGET_MESSAGE);
  assert.ok(!/BUDGET_LIMIT|402|USD/.test(err.message), 'mensaje sin jerga');
  assert.ok(log.generate <= 3, `no insiste tras el tope (${log.generate})`);
});

await t('tope 402 en el control de calidad (visión): BUDGET_LIMIT', async () => {
  const { io } = makeIO({ check: () => { throw new F.FactoryError('BUDGET_LIMIT', F.BUDGET_MESSAGE, 402); } });
  let err; try { await produce(mkTask(), io); } catch (e) { err = e; }
  assert.ok(err instanceof F.FactoryError && err.code === 'BUDGET_LIMIT');
});

await t('fidelidad baja 2 veces -> fallback_original (nunca se muestra la imagen mala)', async () => {
  const { io, log } = makeIO({ check: () => ({ score: 30, issues: ['piedra extra'], hasPerson: false }) });
  const r = await produce(mkTask(), io);
  assert.ok(r.assets.every(a => a.status === 'fallback_original'));
  assert.equal(log.saved.length, 0, 'ninguna imagen generada se guarda');
  assert.ok(r.note);
});

await t('control devuelve JSON roto (score null) 2 veces -> fallback_original', async () => {
  const { io } = makeIO({ check: () => ({ score: null, issues: [] }) });
  const r = await produce(mkTask(), io);
  assert.ok(r.assets.every(a => a.status === 'fallback_original'));
});

await t('control lanza error de red siempre -> fallback_original (no cuelga)', async () => {
  const { io } = makeIO({ check: () => { throw new Error('check 500'); } });
  const r = await produce(mkTask(), io);
  assert.ok(r.assets.every(a => a.status === 'fallback_original'));
});

await t('persona detectada en la imagen -> no se acepta', async () => {
  const { io } = makeIO({ check: () => ({ score: 95, issues: [], hasPerson: true }) });
  const r = await produce(mkTask(), io);
  assert.ok(r.assets.every(a => a.status === 'fallback_original'));
});

await t('director falla al preparar (JSON roto de Gemini) -> error amable, tarea queda failed', async () => {
  const { io, store } = makeIO({ payloadsThrow: new SyntaxError('Unexpected token < in JSON') });
  let err; try { await produce(mkTask(), io); } catch (e) { err = e; }
  assert.ok(err instanceof F.FactoryError && err.code === 'UNKNOWN');
  assert.equal(store.task.generationStatus, 'failed');
  assert.ok(!/JSON|Unexpected/.test(err.message));
});

await t('cuenta sin acceso (403 PRIVATE_MODE) -> ACCESS', async () => {
  const { io } = makeIO({ generate: () => { throw Object.assign(new Error('x'), { raw: '{"code":"PRIVATE_MODE"}' }); } });
  let err; try { await produce(mkTask(), io); } catch (e) { err = e; }
  assert.ok(err instanceof F.FactoryError && err.code === 'ACCESS');
});

await t('límite de simultáneas: nunca más de 2 imágenes en vuelo', async () => {
  let cur = 0, max = 0;
  const { io } = makeIO({ generate: async () => { cur++; max = Math.max(max, cur); await new Promise(r => setTimeout(r, 15)); cur--; return 'data:image/jpeg;base64,GEN'; } });
  await Promise.all([produce(mkTask({ id: 'a' }), io), produce(mkTask({ id: 'b' }), io)]);
  assert.ok(max <= 2, `máximo en vuelo ${max}`);
});

await t('receta sin ejecución (en_el_cuerpo) usa originales, costo 0, sin generar', async () => {
  const { io, log } = makeIO();
  const r = await produce(mkTask({ recipeId: 'en_el_cuerpo' }), io);
  assert.equal(log.generate, 0);
  assert.ok(r.assets.length >= 1 && r.assets.every(a => a.status === 'fallback_original' && a.costUSD === 0));
});

await t('recetas activas del plan (recipes.ts) son todas ejecutables en la fábrica', async () => {
  const R = ['catalogo_limpio', 'detalle_macro', 'flatlay_regalo', 'estilo_de_vida', 'carrusel_educativo', 'story_venta'];
  for (const id of R) assert.ok(F.isExecutableRecipe(id), `${id} no es ejecutable`);
});

await t('cada receta ejecutable entrega >= 2 opciones hoy y 2 mañana', async () => {
  for (const id of F.EXECUTABLE_RECIPES) {
    const { io, log } = makeIO();
    const r = await produce(mkTask({ id: 'x' + id, recipeId: id }), io, { options: 3 });
    assert.ok(r.assets.length >= 2, `${id}: ${r.assets.length} opciones`);
    const m = makeIO();
    const r2 = await produce(mkTask({ id: 'y' + id, recipeId: id }), m.io, { options: 2 });
    assert.equal(r2.assets.length, 2, `${id} (mañana): ${r2.assets.length}`);
  }
});

await t('pre-generación: ventana hoy+2, hoy 3 opciones, los otros 2; salta tareas hechas', async () => {
  const today = new Date(2026, 9, 27);
  const tasks = [
    mkTask({ id: 'h', date: '2026-10-27' }), mkTask({ id: 'm', date: '2026-10-28' }), mkTask({ id: 'p', date: '2026-10-29' }),
    mkTask({ id: 'lejos', date: '2026-11-05' }), mkTask({ id: 'hecha', date: '2026-10-27', status: 'done' }),
  ];
  const { io, log } = makeIO();
  const prog = await F.preGenerateWindow({ uid: 'u1', planId: 'p1', tasks, items: ITEMS, io, today });
  assert.equal(prog.tasksTotal, 3);
  assert.equal(prog.totalImages, 3 + 2 + 2);
  assert.equal(log.generate, 7);
});

await t('pre-generación con tope: se detiene y avisa, sin seguir con las demás', async () => {
  const today = new Date(2026, 9, 27);
  const tasks = [mkTask({ id: 'h', date: '2026-10-27' }), mkTask({ id: 'm', date: '2026-10-28' })];
  const { io, log } = makeIO({ generate: () => { throw Object.assign(new Error('402'), { status: 402 }); } });
  const prog = await F.preGenerateWindow({ uid: 'u1', planId: 'p1', tasks, items: ITEMS, io, today });
  assert.equal(prog.budgetStopped, true);
  assert.ok(log.generate <= 3);
});

await t('catálogo vacío: failed con nota humana, no excepción', async () => {
  const { io } = makeIO();
  const r = await F.produceTask({ uid: 'u1', planId: 'p1', task: mkTask({ catalogItemIds: [] }), items: [], io });
  assert.equal(r.generationStatus, 'failed');
  assert.ok(r.note);
});

await t('"Dame otra idea" (fresh) crea variante nueva v1 sin pisar la v0', async () => {
  const { io } = makeIO();
  const r1 = await produce(mkTask(), io);
  const r2 = await produce(mkTask({ assets: r1.assets, generationStatus: 'ready' }), io, { fresh: true });
  assert.equal(F.variantOf(r2.assets), 1);
  assert.equal(F.currentAssets({ assets: r2.assets }).length, 3);
  assert.ok(r2.assets.some(a => a.id.includes('_v0_')));
});

await t('classifyError: mensajes reales de image.ts', () => {
  assert.equal(F.classifyError({ code: 'UNKNOWN', message: '402 {"error":"Llegaste al tope","code":"BUDGET_LIMIT"}' }), 'BUDGET');
  assert.equal(F.classifyError({ message: 'blocked by safety' }), 'BLOCKED');
  assert.equal(F.classifyError({ message: 'Poll failed: 500' }), 'OTHER');
});

const bad = results.filter(r => !r[0]).length;
console.log(`\n${results.length - bad} OK, ${bad} MAL`);
process.exit(bad ? 1 : 0);
