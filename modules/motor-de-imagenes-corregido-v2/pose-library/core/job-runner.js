const fs = require('fs');
const store = require('./store');
const analyzer = require('./analyzer');
const imageGenerator = require('./image-generator');
const masterPrompts = require('./master-prompts');
const photodumpImport = require('./photodump-import');

const BACKOFF_STEPS = [10000, 20000, 30000, 60000];
const MIN_INTERVAL_MS = 2000;
const START_INTERVAL_MS = 25000;
const MAX_SKETCH_INTERVAL_MS = 120000;
// Espaciado preventivo fijo entre generaciones de sketch — protege la cuota
// por minuto de la API de imagen (confirmado con el usuario: límite real de
// 1-2 llamadas/minuto), se aplica SIEMPRE, no solo tras un 429. 60s asegura
// como máximo 1 llamada/minuto, dentro del margen seguro confirmado.
const SKETCH_MIN_INTERVAL_MS = 60000;
const MAX_LOG_ENTRIES = 300;

function wait(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

let runState = null;

// Items que quedaron en "processing" tras un corte/reinicio del proceso (no
// hay runState en memoria retomándolos) vuelven a la fase que les
// corresponde — nunca se pierden ni requieren acción manual. Se decide la
// fase mirando si ya tienen imageType: si sí, solo faltaba el sketch; si
// no, ni siquiera llegaron a analizarse.
function reclaimOrphanedProcessing(bank) {
  let changed = false;
  bank.items.forEach(item => {
    if (item.status === 'processing') {
      item.status = item.imageType ? 'pending_sketch' : 'pending_analysis';
      changed = true;
      pushLog(bank, { level: 'warn', itemId: item.id, itemName: item.name, phase: item.status === 'pending_sketch' ? 'sketch' : 'analyze', message: 'Item recuperado tras interrupción del proceso — vuelve a la cola' });
    }
  });
  return changed;
}

function currentBank() {
  const bank = store.loadBank();
  let changed = false;
  if (bank.activeBatch && (bank.activeBatch.status === 'running' || bank.activeBatch.status === 'paused') && !runState) {
    bank.activeBatch.status = 'interrupted';
    changed = true;
  }
  if (!runState && reclaimOrphanedProcessing(bank)) changed = true;
  if (changed) store.saveBank(bank);
  return bank;
}

function pushLog(bank, entry) {
  if (!bank.log) bank.log = [];
  bank.log.unshift({ at: new Date().toISOString(), ...entry });
  if (bank.log.length > MAX_LOG_ENTRIES) bank.log.length = MAX_LOG_ENTRIES;
}

function publicBank(bank) {
  const items = bank.items || [];
  return {
    activeBatch: bank.activeBatch,
    total: items.length,
    pendingAnalysis: items.filter(i => i.status === 'pending_analysis').length,
    pendingSketch: items.filter(i => i.status === 'pending_sketch').length,
    doneCount: items.filter(i => i.status === 'done').length,
    errorCount: items.filter(i => i.status === 'error').length,
    items: items.map(item => ({
      id: item.id,
      name: item.name,
      origin: item.origin,
      batchId: item.batchId,
      status: item.status,
      error: item.error || null,
      elapsedMs: item.elapsedMs || null,
      createdAt: item.createdAt,
      imageType: item.imageType || null,
      category: item.category || null,
      framing: item.framing || null,
      contactPoints: item.contactPoints || null,
      supportSurfaceHeight: item.supportSurfaceHeight || null,
      tags: item.tags || null,
      description: item.description || null,
      sketchExt: item.sketchExt || null,
      wantsSecondary: item.wantsSecondary || false,
      secondary: item.secondary || null
    }))
  };
}

function persistJobsNoop() { /* placeholder para simetría con photodump-trainer; bank.json ya es la fuente de verdad */ }

async function withBackoff(fn, { onRateLimitHit } = {}) {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err) {
      const isRateLimit = err.isRateLimit || /429|rate|quota/i.test(err.message || '');
      const isOverloaded = err.isOverloaded || err.isTimeout || /503|overload|unavailable/i.test(err.message || '');
      if (!isRateLimit && !isOverloaded) throw err;
      onRateLimitHit && onRateLimitHit();
      const delay = BACKOFF_STEPS[Math.min(attempt, BACKOFF_STEPS.length - 1)];
      await wait(delay);
      attempt++;
    }
  }
}

function resolveOriginalBuffer(item) {
  if (item.origin === 'photodump_import') {
    const path_ = photodumpImport.resolveImagePath({ id: item.sourceRef, ext: item.ext });
    return fs.readFileSync(path_);
  }
  return fs.readFileSync(store.imagePath(item.id, item.ext));
}

function extFromMime(mimeType) {
  if (mimeType === 'image/png') return '.png';
  if (mimeType === 'image/webp') return '.webp';
  return '.jpg';
}

// ── Fase ANALYZE ──

async function processAnalyzeOne(bank, item) {
  item.status = 'processing';
  store.saveBank(bank);

  let hitRateLimit = false;
  const start = Date.now();
  try {
    const buffer = resolveOriginalBuffer(item);
    const { parsed } = await withBackoff(
      () => analyzer.analyzeImage(buffer, item.mimeType),
      { onRateLimitHit: () => { hitRateLimit = true; } }
    );

    store.saveAnalysis(item.id, {
      itemId: item.id,
      sourceName: item.name,
      analyzedAt: new Date().toISOString(),
      analysis: parsed
    });

    item.imageType = parsed.image_type || null;
    item.category = parsed.category || null;
    item.framing = parsed.framing || null;
    item.contactPoints = parsed.contact_points || null;
    item.supportSurfaceHeight = parsed.support_surface_height || null;
    item.tags = parsed.tags || null;
    item.description = parsed.description || null;
    item.error = null;
    item.status = 'pending_sketch';
  } catch (err) {
    item.status = 'error';
    item.error = err.message;
    pushLog(bank, { level: 'error', itemId: item.id, itemName: item.name, phase: 'analyze', message: err.message });
  }
  return hitRateLimit;
}

// ── Fase SKETCH ──

async function processSketchOne(bank, item) {
  item.status = 'processing';
  store.saveBank(bank);

  let hitRateLimit = false;
  const start = Date.now();
  try {
    const buffer = resolveOriginalBuffer(item);
    const masterPrompt = item.imageType === 'expression'
      ? masterPrompts.getExpressionPrompt()
      : masterPrompts.getPosePrompt();

    const sketch = await withBackoff(
      () => imageGenerator.generateSketchWithFallback(buffer, item.mimeType, masterPrompt),
      { onRateLimitHit: () => { hitRateLimit = true; } }
    );

    const ext = extFromMime(sketch.mimeType);
    store.saveSketch(item.id, sketch.buffer, ext);

    item.sketchExt = ext;
    item.elapsedMs = Date.now() - start;
    item.error = null;
    item.status = 'done';
  } catch (err) {
    item.status = 'error';
    item.error = err.message;
    pushLog(bank, { level: 'error', itemId: item.id, itemName: item.name, phase: 'sketch', message: err.message });
  }
  return hitRateLimit;
}

// ── Tipo secundario ── (item.secondary)
// Para imágenes ya "done" que el usuario marcó manualmente como también
// aprovechables como el otro tipo (ej. quedó como "expression" pero tiene
// cuerpo/pose útil) — genera un segundo análisis+sketch del tipo opuesto,
// guardado en item.secondary, sin tocar el análisis/sketch primario.

function otherType(imageType) { return imageType === 'expression' ? 'body' : 'expression'; }

async function processSecondaryOne(bank, item) {
  item.secondaryStatus = 'processing';
  store.saveBank(bank);

  let hitRateLimit = false;
  const forcedType = otherType(item.imageType);
  try {
    const buffer = resolveOriginalBuffer(item);

    const { parsed } = await withBackoff(
      () => analyzer.analyzeImageAsType(buffer, item.mimeType, forcedType),
      { onRateLimitHit: () => { hitRateLimit = true; pushLog(bank, { level: 'warn', itemId: item.id, itemName: item.name, phase: 'secondary-analyze', message: 'Límite de cuota alcanzado — reintentando con backoff' }); } }
    );

    const masterPrompt = forcedType === 'expression'
      ? masterPrompts.getExpressionPrompt()
      : masterPrompts.getPosePrompt();
    const sketch = await withBackoff(
      () => imageGenerator.generateSketchWithFallback(buffer, item.mimeType, masterPrompt),
      { onRateLimitHit: () => { hitRateLimit = true; pushLog(bank, { level: 'warn', itemId: item.id, itemName: item.name, phase: 'secondary-sketch', message: 'Límite de cuota alcanzado en sketch secundario — reintentando con backoff' }); } }
    );
    const ext = extFromMime(sketch.mimeType);
    store.saveSecondarySketch(item.id, sketch.buffer, ext);

    item.secondary = {
      imageType: forcedType,
      framing: parsed.framing || null,
      contactPoints: parsed.contact_points || null,
      supportSurfaceHeight: parsed.support_surface_height || null,
      category: parsed.category || null,
      description: parsed.description || null,
      tags: parsed.tags || null,
      sketchExt: ext
    };
    item.secondaryStatus = 'done';
    item.secondaryError = null;
    item.wantsSecondary = false;
  } catch (err) {
    item.secondaryStatus = 'error';
    item.secondaryError = err.message;
    pushLog(bank, { level: 'error', itemId: item.id, itemName: item.name, phase: 'secondary', message: err.message });
  }
  return hitRateLimit;
}

// Marca items ya "done" para que se les genere el tipo faltante — no altera
// su análisis/sketch primario ni su status principal.
function markWantsSecondary(itemIds) {
  const bank = store.loadBank();
  const idSet = new Set(itemIds);
  let marked = 0;
  bank.items.forEach(item => {
    if (idSet.has(item.id) && item.status === 'done' && !item.secondary) {
      item.wantsSecondary = true;
      item.secondaryStatus = 'pending';
      marked++;
    }
  });
  store.saveBank(bank);
  return marked;
}

function unmarkWantsSecondary(itemId) {
  const bank = store.loadBank();
  const item = bank.items.find(i => i.id === itemId);
  if (!item) return null;
  item.wantsSecondary = false;
  item.secondaryStatus = null;
  store.saveBank(bank);
  return item;
}

let secondaryQueueState = null;

function secondaryQueueStatus() {
  return secondaryQueueState ? { ...secondaryQueueState } : { running: false };
}

// Cola con el mismo espaciado preventivo que el batch normal — cada item
// marcado gasta una llamada de análisis + una llamada de generación de
// sketch, así que respeta el mismo límite de cuota de imagen.
function generateMissingTypes() {
  if (secondaryQueueState && secondaryQueueState.running) return secondaryQueueStatus();
  if (runState) return secondaryQueueStatus(); // no correr en paralelo con un batch activo

  const bank = store.loadBank();
  const targets = bank.items.filter(i => i.wantsSecondary && i.status === 'done' && !i.secondary);
  if (!targets.length) return secondaryQueueStatus();

  secondaryQueueState = { running: true, total: targets.length, done: 0, errors: 0 };
  pushLog(bank, { level: 'info', message: `Generación de tipo faltante iniciada: ${targets.length} imágenes marcadas` });
  store.saveBank(bank);

  (async () => {
    let intervalMs = SKETCH_MIN_INTERVAL_MS;
    for (const target of targets) {
      const freshBank = store.loadBank();
      const item = freshBank.items.find(i => i.id === target.id);
      if (!item) { secondaryQueueState.done++; continue; }

      const callStart = Date.now();
      const hitRateLimit = await processSecondaryOne(freshBank, item);
      secondaryQueueState.done++;
      if (item.secondaryStatus === 'error') secondaryQueueState.errors++;
      if (hitRateLimit) intervalMs = Math.min(MAX_SKETCH_INTERVAL_MS, intervalMs * 2);
      store.saveBank(freshBank);

      const isLast = secondaryQueueState.done >= secondaryQueueState.total;
      if (!isLast) {
        const elapsed = Date.now() - callStart;
        const remaining = Math.max(MIN_INTERVAL_MS, intervalMs - elapsed);
        await wait(remaining);
      }
    }
    const finalBank = store.loadBank();
    pushLog(finalBank, { level: 'info', message: `Generación de tipo faltante terminada: ${secondaryQueueState.done}/${secondaryQueueState.total} procesadas (${secondaryQueueState.errors} con error)` });
    store.saveBank(finalBank);
    secondaryQueueState.running = false;
  })();

  return secondaryQueueStatus();
}

// ── Loop principal: drena pending_analysis primero, luego pending_sketch ──

async function runBatch(initialBank, batchId) {
  runState = { cancelled: false };
  let bank = initialBank;
  bank.activeBatch.status = 'running';
  store.saveBank(bank);

  // Fase ANALYZE — sin espaciado artificial, con backoff reactivo.
  while (true) {
    bank = store.loadBank();
    if (!bank.activeBatch || bank.activeBatch.id !== batchId) { runState = null; return; }
    if (runState.cancelled || bank.activeBatch.status !== 'running') { runState = null; return; }

    const item = bank.items.find(it => it.batchId === batchId && it.status === 'pending_analysis');
    if (!item) break;

    const hitRateLimit = await processAnalyzeOne(bank, item);
    if (hitRateLimit) {
      pushLog(bank, { level: 'warn', itemId: item.id, itemName: item.name, phase: 'analyze', message: 'Límite de cuota alcanzado en análisis — reintentando con backoff' });
    }
    store.saveBank(bank);
  }

  // Fase SKETCH — espaciado preventivo fijo (SKETCH_MIN_INTERVAL_MS) entre
  // cada llamada, más backoff reactivo ante 429/503, más un intervalo de
  // lote que sube si el backoff se agota.
  let sketchIntervalMs = START_INTERVAL_MS;
  while (true) {
    bank = store.loadBank();
    if (!bank.activeBatch || bank.activeBatch.id !== batchId) { runState = null; return; }
    if (runState.cancelled || bank.activeBatch.status !== 'running') { runState = null; return; }

    const item = bank.items.find(it => it.batchId === batchId && it.status === 'pending_sketch');
    if (!item) break;

    const callStart = Date.now();
    const hitRateLimit = await processSketchOne(bank, item);
    if (hitRateLimit) {
      sketchIntervalMs = Math.min(MAX_SKETCH_INTERVAL_MS, sketchIntervalMs * 2);
      pushLog(bank, { level: 'warn', itemId: item.id, itemName: item.name, phase: 'sketch', message: `Límite de cuota alcanzado en generación de sketch — intervalo del lote ajustado a ${Math.round(sketchIntervalMs / 1000)}s` });
    }
    store.saveBank(bank);

    const stillPending = bank.items.some(it => it.batchId === batchId && it.status === 'pending_sketch');
    if (stillPending && bank.activeBatch.status === 'running' && !runState.cancelled) {
      const elapsed = Date.now() - callStart;
      const targetInterval = Math.max(SKETCH_MIN_INTERVAL_MS, sketchIntervalMs);
      const remaining = Math.max(MIN_INTERVAL_MS, targetInterval - elapsed);
      await wait(remaining);
    }
  }

  const freshBank = store.loadBank();
  if (freshBank.activeBatch && freshBank.activeBatch.id === bank.activeBatch.id && freshBank.activeBatch.status === 'running') {
    freshBank.activeBatch.status = 'completed';
    freshBank.activeBatch.finishedAt = new Date().toISOString();
    store.saveBank(freshBank);
  }
  runState = null;
}

// ── Encolado desde uploads manuales ──

function startBatch(newItems) {
  const bank = store.loadBank();
  const isAppendingToRunning = bank.activeBatch && ['running', 'queued', 'paused', 'interrupted'].includes(bank.activeBatch.status);

  const batchId = isAppendingToRunning ? bank.activeBatch.id : ('batch_' + Date.now());
  const createdAt = isAppendingToRunning ? bank.activeBatch.createdAt : new Date().toISOString();

  const itemsForThisBatch = newItems.map((it, idx) => {
    const id = 'pose_' + Date.now() + '_' + idx;
    store.saveImage(id, it.buffer, it.ext);
    if (it.thumbBuffer) store.saveThumb(id, it.thumbBuffer, it.ext);
    return {
      id, origin: 'upload', sourceRef: null,
      ext: it.ext, mimeType: it.mimeType, name: it.name, contentHash: it.contentHash,
      batchId, createdAt, status: 'pending_analysis', error: null,
      imageType: null, category: null, framing: null, contactPoints: null, supportSurfaceHeight: null,
      tags: null, description: null, sketchExt: null, elapsedMs: null
    };
  });

  bank.items = [...bank.items, ...itemsForThisBatch];
  const newItemIds = itemsForThisBatch.map(it => it.id);

  if (isAppendingToRunning) {
    bank.activeBatch.itemIds = [...bank.activeBatch.itemIds, ...newItemIds];
    pushLog(bank, { level: 'info', message: `${itemsForThisBatch.length} imágenes agregadas a la tanda en curso` });
    store.saveBank(bank);
    return bank;
  }

  bank.activeBatch = {
    id: batchId, createdAt, finishedAt: null, status: 'queued', itemIds: newItemIds
  };
  pushLog(bank, { level: 'info', message: `Tanda iniciada: ${itemsForThisBatch.length} imágenes nuevas` });
  store.saveBank(bank);

  runBatch(bank, bank.activeBatch.id).catch(err => {
    const b = store.loadBank();
    if (b.activeBatch) { b.activeBatch.status = 'error'; b.activeBatch.error = err.message; }
    store.saveBank(b);
    runState = null;
  });

  return bank;
}

// ── Encolado desde import de photodump — sin copiar binarios ──

function startBatchFromPhotodumpImport(photodumpItemIds) {
  const bank = store.loadBank();
  const alreadyImported = new Set(bank.items.filter(it => it.origin === 'photodump_import').map(it => it.sourceRef));
  const available = photodumpImport.listApprovedPhotodumpItems();
  const byId = new Map(available.map(it => [it.id, it]));

  const toImport = photodumpItemIds
    .filter(id => !alreadyImported.has(id) && byId.has(id))
    .map(id => byId.get(id));

  if (!toImport.length) return bank;

  const isAppendingToRunning = bank.activeBatch && ['running', 'queued', 'paused', 'interrupted'].includes(bank.activeBatch.status);
  const batchId = isAppendingToRunning ? bank.activeBatch.id : ('batch_' + Date.now());
  const createdAt = isAppendingToRunning ? bank.activeBatch.createdAt : new Date().toISOString();

  const itemsForThisBatch = toImport.map((src, idx) => ({
    id: 'pose_' + Date.now() + '_' + idx,
    origin: 'photodump_import', sourceRef: src.id,
    ext: src.ext, mimeType: src.mimeType, name: src.name, contentHash: src.contentHash || null,
    batchId, createdAt, status: 'pending_analysis', error: null,
    imageType: null, category: null, framing: null, contactPoints: null, supportSurfaceHeight: null,
    tags: null, description: null, sketchExt: null, elapsedMs: null
  }));

  bank.items = [...bank.items, ...itemsForThisBatch];
  const newItemIds = itemsForThisBatch.map(it => it.id);

  if (isAppendingToRunning) {
    bank.activeBatch.itemIds = [...bank.activeBatch.itemIds, ...newItemIds];
    pushLog(bank, { level: 'info', message: `${itemsForThisBatch.length} imágenes importadas de photodump agregadas a la tanda en curso` });
    store.saveBank(bank);
    return bank;
  }

  bank.activeBatch = {
    id: batchId, createdAt, finishedAt: null, status: 'queued', itemIds: newItemIds
  };
  pushLog(bank, { level: 'info', message: `Tanda iniciada: ${itemsForThisBatch.length} imágenes importadas de photodump` });
  store.saveBank(bank);

  runBatch(bank, bank.activeBatch.id).catch(err => {
    const b = store.loadBank();
    if (b.activeBatch) { b.activeBatch.status = 'error'; b.activeBatch.error = err.message; }
    store.saveBank(b);
    runState = null;
  });

  return bank;
}

function resumeBatch() {
  const bank = store.loadBank();
  if (!bank.activeBatch || !['interrupted', 'paused'].includes(bank.activeBatch.status)) return bank;
  bank.activeBatch.status = 'queued';
  pushLog(bank, { level: 'info', message: 'Tanda reanudada desde el último checkpoint' });
  store.saveBank(bank);
  runBatch(bank, bank.activeBatch.id).catch(err => {
    const b = store.loadBank();
    if (b.activeBatch) { b.activeBatch.status = 'error'; b.activeBatch.error = err.message; }
    store.saveBank(b);
    runState = null;
  });
  return bank;
}

function pauseBatch() {
  const bank = store.loadBank();
  if (bank.activeBatch && bank.activeBatch.status === 'running') {
    bank.activeBatch.status = 'paused';
    if (runState) runState.cancelled = true;
    pushLog(bank, { level: 'info', message: 'Tanda pausada por el usuario' });
    store.saveBank(bank);
  }
  return bank;
}

async function retryItem(itemId) {
  const bank = store.loadBank();
  const item = bank.items.find(i => i.id === itemId);
  if (!item || item.status !== 'error') return null;

  // Reintentar desde la fase que falló: si nunca llegó a analizarse
  // (imageType null), vuelve a pending_analysis; si el análisis ya está
  // guardado, solo falta el sketch.
  item.status = item.imageType ? 'pending_sketch' : 'pending_analysis';
  item.error = null;
  store.saveBank(bank);

  if (item.status === 'pending_analysis') {
    await processAnalyzeOne(bank, item);
    store.saveBank(bank);
    if (item.status === 'error') return item;
  }
  if (item.status === 'pending_sketch') {
    await processSketchOne(bank, item);
    store.saveBank(bank);
  }
  return item;
}

function editItem(itemId, { tags, category, framing, contactPoints, supportSurfaceHeight }) {
  const bank = store.loadBank();
  const item = bank.items.find(i => i.id === itemId);
  if (!item) return null;
  if (tags !== undefined) item.tags = tags;
  if (category !== undefined) item.category = category;
  if (framing !== undefined) item.framing = framing;
  if (contactPoints !== undefined) item.contactPoints = contactPoints;
  if (supportSurfaceHeight !== undefined) item.supportSurfaceHeight = supportSurfaceHeight;
  store.saveBank(bank);
  return item;
}

function deleteItemsBulk(itemIds) {
  const bank = store.loadBank();
  const idSet = new Set(itemIds);
  const toDelete = bank.items.filter(i => idSet.has(i.id));
  toDelete.forEach(item => {
    const secondaryExt = item.secondary ? item.secondary.sketchExt : null;
    if (item.origin === 'upload') store.deleteImageFiles(item.id, item.ext, secondaryExt);
    else {
      // imports no tienen binario propio en este banco, pero el sketch sí
      try { const p = store.sketchPath(item.id, item.sketchExt || '.png'); if (fs.existsSync(p)) fs.unlinkSync(p); } catch (_) {}
      if (secondaryExt) { try { const p = store.secondarySketchPath(item.id, secondaryExt); if (fs.existsSync(p)) fs.unlinkSync(p); } catch (_) {} }
    }
    store.deleteAnalysis(item.id);
  });
  bank.items = bank.items.filter(i => !idSet.has(i.id));
  store.saveBank(bank);
  return toDelete.length;
}

function findDuplicateHashes(hashes) {
  const bank = store.loadBank();
  const existingHashes = new Set(bank.items.map(i => i.contentHash).filter(Boolean));
  return hashes.filter(h => existingHashes.has(h));
}

function findDuplicateNames(names) {
  const bank = store.loadBank();
  const existingNames = new Set(bank.items.map(i => i.name).filter(Boolean));
  return names.filter(n => existingNames.has(n));
}

function getLog() {
  const bank = store.loadBank();
  return bank.log || [];
}

// ── Reclasificación de framing en lote — solo texto, liviano ──
// Pensado para completar el campo "framing" en items que ya están "done" de
// antes de que existiera (no toca category/tags/description/sketch). No
// comparte cola con el batch principal (es análisis de texto puro, sin el
// límite de cuota estricto de generación de imagen), pero sí respeta un
// pequeño backoff reactivo por si pega contra el mismo límite de texto.

let reclassifyState = null;

function reclassifyStatus() {
  return reclassifyState ? { ...reclassifyState } : { running: false };
}

async function reclassifyFraming() {
  if (reclassifyState && reclassifyState.running) return reclassifyStatus();

  const analyzer = require('./analyzer');
  const bank = store.loadBank();
  const targets = bank.items.filter(i => i.status === 'done' && !i.framing);
  reclassifyState = { running: true, total: targets.length, done: 0, errors: 0 };

  pushLog(bank, { level: 'info', message: `Reclasificación de framing iniciada: ${targets.length} imágenes sin encuadre asignado` });
  store.saveBank(bank);

  (async () => {
    for (const target of targets) {
      const freshBank = store.loadBank();
      const item = freshBank.items.find(i => i.id === target.id);
      if (!item) { reclassifyState.done++; continue; }
      try {
        const buffer = resolveOriginalBuffer(item);
        const framing = await withBackoff(() => analyzer.classifyFraming(buffer, item.mimeType));
        item.framing = framing;
      } catch (err) {
        reclassifyState.errors++;
        pushLog(freshBank, { level: 'warn', itemId: item.id, itemName: item.name, phase: 'reclassify-framing', message: err.message });
      }
      reclassifyState.done++;
      store.saveBank(freshBank);
    }
    const finalBank = store.loadBank();
    pushLog(finalBank, { level: 'info', message: `Reclasificación de framing terminada: ${reclassifyState.done}/${reclassifyState.total} procesadas (${reclassifyState.errors} errores)` });
    store.saveBank(finalBank);
    reclassifyState.running = false;
  })();

  return reclassifyStatus();
}

// ── Cola de reintentos con espaciado — para reintentar en masa items en
// error sin volver a pisar el límite de cuota que ya rompió el batch
// original. Reutiliza el mismo espaciado preventivo (SKETCH_MIN_INTERVAL_MS)
// y backoff que el batch normal, pero solo sobre items con status "error".

let retryQueueState = null;

function retryQueueStatus() {
  return retryQueueState ? { ...retryQueueState } : { running: false };
}

function retryAllErrors() {
  if (retryQueueState && retryQueueState.running) return retryQueueStatus();
  if (runState) return retryQueueStatus(); // no correr en paralelo con un batch activo

  const bank = store.loadBank();
  const targets = bank.items.filter(i => i.status === 'error');
  if (!targets.length) return retryQueueStatus();

  targets.forEach(item => {
    item.status = item.imageType ? 'pending_sketch' : 'pending_analysis';
    item.error = null;
  });
  retryQueueState = { running: true, total: targets.length, done: 0, errors: 0 };
  pushLog(bank, { level: 'info', message: `Reintento en cola iniciado: ${targets.length} imágenes en error, con el mismo espaciado que un batch normal` });
  store.saveBank(bank);

  (async () => {
    // Fase ANALYZE de los reintentados que no llegaron a analizarse — sin espaciado, igual que el batch normal.
    while (true) {
      const freshBank = store.loadBank();
      const item = freshBank.items.find(it => targets.some(t => t.id === it.id) && it.status === 'pending_analysis');
      if (!item) break;
      await processAnalyzeOne(freshBank, item);
      retryQueueState.done++;
      if (item.status === 'error') retryQueueState.errors++;
      store.saveBank(freshBank);
    }

    // Fase SKETCH — mismo espaciado preventivo fijo que el batch normal.
    let intervalMs = SKETCH_MIN_INTERVAL_MS;
    while (true) {
      const freshBank = store.loadBank();
      const item = freshBank.items.find(it => targets.some(t => t.id === it.id) && it.status === 'pending_sketch');
      if (!item) break;

      const callStart = Date.now();
      const hitRateLimit = await processSketchOne(freshBank, item);
      retryQueueState.done++;
      if (item.status === 'error') retryQueueState.errors++;
      if (hitRateLimit) intervalMs = Math.min(MAX_SKETCH_INTERVAL_MS, intervalMs * 2);
      store.saveBank(freshBank);

      const stillPending = freshBank.items.some(it => targets.some(t => t.id === it.id) && it.status === 'pending_sketch');
      if (stillPending) {
        const elapsed = Date.now() - callStart;
        const remaining = Math.max(MIN_INTERVAL_MS, intervalMs - elapsed);
        await wait(remaining);
      }
    }

    const finalBank = store.loadBank();
    pushLog(finalBank, { level: 'info', message: `Reintento en cola terminado: ${retryQueueState.done}/${retryQueueState.total} procesadas (${retryQueueState.errors} siguen en error)` });
    store.saveBank(finalBank);
    retryQueueState.running = false;
  })();

  return retryQueueStatus();
}

module.exports = {
  publicBank, currentBank,
  startBatch, startBatchFromPhotodumpImport, resumeBatch, pauseBatch,
  retryItem, editItem, deleteItemsBulk,
  findDuplicateHashes, findDuplicateNames,
  getLog,
  reclassifyFraming, reclassifyStatus,
  retryAllErrors, retryQueueStatus,
  markWantsSecondary, unmarkWantsSecondary,
  generateMissingTypes, secondaryQueueStatus
};
