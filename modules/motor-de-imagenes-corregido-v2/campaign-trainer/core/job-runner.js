const fs = require('fs');
const vertex = require('../../vertex-client');
const { getSystemPrompt } = require('./system-prompt');
const store = require('./store');

const MIN_INTERVAL_MS = 2000;
const START_INTERVAL_MS = 25000;
const MAX_INTERVAL_MS = 60000;
const BACKOFF_STEPS = [10000, 20000, 30000, 60000];
const MAX_LOG_ENTRIES = 300;

function wait(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

// Estado de la tanda activa en memoria (progreso fino: intervalo actual, rate limits).
// El banco completo (bank.json) es la fuente de verdad de qué imágenes existen y su estado;
// esto solo trackea el avance de la corrida en curso para no reescribir bank.json en cada tick de espera.
let runState = null;

function currentBank() {
  const bank = store.loadBank();
  if (bank.activeBatch && (bank.activeBatch.status === 'running' || bank.activeBatch.status === 'paused') && !runState) {
    // El servidor se reinició mientras corría — se marca como interrumpida.
    bank.activeBatch.status = 'interrupted';
    store.saveBank(bank);
  }
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
    doneCount: items.filter(i => i.status === 'done' || i.status === 'error').length,
    errorCount: items.filter(i => i.status === 'error').length,
    approvedCount: items.filter(i => i.review === 'approved').length,
    rejectedCount: items.filter(i => i.review === 'rejected').length,
    items: items.map(item => ({
      id: item.id,
      name: item.name,
      batchId: item.batchId,
      status: item.status,
      error: item.error || null,
      review: item.review || 'pending',
      elapsedMs: item.elapsedMs || null,
      createdAt: item.createdAt,
      searchTags: item.searchTags || null
    }))
  };
}

async function analyzeOne(item) {
  const buffer = fs.readFileSync(store.imagePath(item.id, item.ext));
  const base64 = buffer.toString('base64');
  const result = await vertex.generateAnthropicCompatible({
    system: getSystemPrompt(),
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: 'Analiza esta imagen de campaña según las instrucciones del sistema. Responde solo el JSON.' },
        { type: 'image', source: { type: 'base64', media_type: item.mimeType, data: base64 } }
      ]
    }],
    response_mime_type: 'application/json',
    max_tokens: 4000
  });
  const text = (result.content || []).map(b => b.text || '').join('');
  return { text, usage: result.usage };
}

async function analyzeWithRetry(item, onRateLimitHit) {
  let attempt = 0;
  while (true) {
    try {
      return await analyzeOne(item);
    } catch (err) {
      const isRateLimit = err.isRateLimit || /429|rate|quota/i.test(err.message || '');
      const isOverloaded = err.isOverloaded || /503|overload|unavailable/i.test(err.message || '');
      if (!isRateLimit && !isOverloaded) throw err;
      onRateLimitHit && onRateLimitHit();
      const delay = BACKOFF_STEPS[Math.min(attempt, BACKOFF_STEPS.length - 1)];
      await wait(delay);
      attempt++;
    }
  }
}

async function processOne(bank, item) {
  item.status = 'processing';
  store.saveBank(bank);

  let hitRateLimit = false;
  const start = Date.now();
  try {
    const { text, usage } = await analyzeWithRetry(item, () => {
      hitRateLimit = true;
      bank.activeBatch.rateLimitHits = (bank.activeBatch.rateLimitHits || 0) + 1;
    });
    const elapsed = Date.now() - start;
    let parsed = null;
    try { parsed = JSON.parse(text); } catch (_) { /* se guarda el texto crudo igual */ }

    store.saveAnalysis(item.id, {
      itemId: item.id,
      sourceName: item.name,
      analyzedAt: new Date().toISOString(),
      elapsedMs: elapsed,
      usage,
      analysis: parsed || { raw_text: text }
    });

    item.status = 'done';
    item.elapsedMs = elapsed;
    item.error = null;
    // Copia liviana de los tags al índice del banco, para que la galería filtre sin
    // tener que abrir el JSON completo de análisis de cada imagen en cada consulta.
    if (parsed && parsed.search_tags) item.searchTags = parsed.search_tags;
  } catch (err) {
    item.status = 'error';
    item.error = err.message;
    pushLog(bank, { level: 'error', itemId: item.id, itemName: item.name, message: err.message });
  }
  return hitRateLimit;
}

// El batch se procesa por ÍNDICE contra el estado releído de disco en cada vuelta (no un
// array de itemIds fijo capturado al arrancar) — así, si el usuario agrega imágenes nuevas
// a la tanda en curso, este loop las recoge solo, sin necesidad de relanzarlo.
async function runBatch(initialBank, batchId) {
  runState = { cancelled: false };
  let bank = initialBank;
  bank.activeBatch.status = 'running';
  bank.activeBatch.currentIntervalMs = bank.activeBatch.currentIntervalMs || START_INTERVAL_MS;
  store.saveBank(bank);

  let i = 0;
  while (true) {
    bank = store.loadBank();
    if (!bank.activeBatch || bank.activeBatch.id !== batchId) break;
    if (runState.cancelled || bank.activeBatch.status !== 'running') break;

    const itemIds = bank.activeBatch.itemIds;
    if (i >= itemIds.length) break;

    const item = bank.items.find(it => it.id === itemIds[i]);
    i++;
    if (!item || item.status === 'done') continue;

    const start = Date.now();
    const hitRateLimit = await processOne(bank, item);
    if (hitRateLimit) {
      bank.activeBatch.currentIntervalMs = Math.min(MAX_INTERVAL_MS, bank.activeBatch.currentIntervalMs * 2);
      pushLog(bank, { level: 'warn', itemId: item.id, itemName: item.name, message: `Límite de cuota alcanzado — ritmo ajustado a ${Math.round(bank.activeBatch.currentIntervalMs / 1000)}s` });
    }
    store.saveBank(bank);

    const isLast = i >= itemIds.length;
    if (!isLast && bank.activeBatch.status === 'running' && !runState.cancelled) {
      const elapsedThisItem = Date.now() - start;
      const remaining = Math.max(MIN_INTERVAL_MS, bank.activeBatch.currentIntervalMs - elapsedThisItem);
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

// newItems: [{ ext, mimeType, name, contentHash, buffer, thumbBuffer }]
function startBatch(newItems) {
  const bank = store.loadBank();
  const isAppendingToRunning = bank.activeBatch && ['running', 'queued', 'paused', 'interrupted'].includes(bank.activeBatch.status);

  const batchId = isAppendingToRunning ? bank.activeBatch.id : ('batch_' + Date.now());
  const createdAt = isAppendingToRunning ? bank.activeBatch.createdAt : new Date().toISOString();

  const itemsForThisBatch = newItems.map((it, idx) => {
    const id = 'camp_' + Date.now() + '_' + idx;
    store.saveImage(id, it.buffer, it.ext);
    if (it.thumbBuffer) store.saveThumb(id, it.thumbBuffer, it.ext);
    return {
      id, ext: it.ext, mimeType: it.mimeType, name: it.name, contentHash: it.contentHash,
      batchId, createdAt, status: 'pending', review: 'pending', error: null
    };
  });

  bank.items = [...bank.items, ...itemsForThisBatch];
  const newItemIds = itemsForThisBatch.map(it => it.id);

  if (isAppendingToRunning) {
    bank.activeBatch.itemIds = [...bank.activeBatch.itemIds, ...newItemIds];
    pushLog(bank, { level: 'info', message: `${itemsForThisBatch.length} imágenes agregadas a la tanda en curso (sin interrumpirla)` });
    store.saveBank(bank);
    return bank;
  }

  bank.activeBatch = {
    id: batchId,
    createdAt,
    finishedAt: null,
    status: 'queued',
    currentIntervalMs: START_INTERVAL_MS,
    rateLimitHits: 0,
    itemIds: newItemIds
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

function reviewItem(itemId, decision) {
  const bank = store.loadBank();
  const item = bank.items.find(i => i.id === itemId);
  if (!item) return null;
  item.review = decision; // 'approved' | 'rejected' | 'pending'
  store.saveBank(bank);
  return item;
}

function reviewItemsBulk(itemIds, decision) {
  const bank = store.loadBank();
  const idSet = new Set(itemIds);
  let count = 0;
  bank.items.forEach(item => {
    if (idSet.has(item.id)) { item.review = decision; count++; }
  });
  store.saveBank(bank);
  return count;
}

async function retryItem(itemId) {
  const bank = store.loadBank();
  const item = bank.items.find(i => i.id === itemId);
  if (!item || item.status !== 'error') return null;
  item.status = 'pending';
  item.error = null;
  store.saveBank(bank);
  await processOne(bank, item);
  store.saveBank(bank);
  return item;
}

// Reintento en masa: reinyecta items YA EXISTENTES (con su imagen ya guardada en disco) de
// vuelta en la cola, en vez de reprocesarlos uno por uno de forma síncrona en el mismo
// request HTTP (eso colgaría el navegador esperando N llamadas a Gemini seguidas). Se
// benefician del mismo ritmo anti-rate-limit y preview en vivo que una tanda normal.
function retryItemsBulk(itemIds) {
  const bank = store.loadBank();
  const idSet = new Set(itemIds);
  const retryable = bank.items.filter(i => idSet.has(i.id) && i.status === 'error');
  if (!retryable.length) return { queued: 0, bank };

  retryable.forEach(item => { item.status = 'pending'; item.error = null; });
  const retryIds = retryable.map(i => i.id);

  const isAppendingToRunning = bank.activeBatch && ['running', 'queued', 'paused', 'interrupted'].includes(bank.activeBatch.status);

  if (isAppendingToRunning) {
    const existingIds = new Set(bank.activeBatch.itemIds);
    const toAdd = retryIds.filter(id => !existingIds.has(id));
    bank.activeBatch.itemIds = [...bank.activeBatch.itemIds, ...toAdd];
    pushLog(bank, { level: 'info', message: `${retryable.length} imágenes con error reencoladas en la tanda en curso` });
    store.saveBank(bank);
    return { queued: retryable.length, bank };
  }

  const batchId = 'batch_' + Date.now();
  bank.activeBatch = {
    id: batchId,
    createdAt: new Date().toISOString(),
    finishedAt: null,
    status: 'queued',
    currentIntervalMs: START_INTERVAL_MS,
    rateLimitHits: 0,
    itemIds: retryIds
  };
  pushLog(bank, { level: 'info', message: `Tanda de reintento iniciada: ${retryable.length} imágenes con error` });
  store.saveBank(bank);

  runBatch(bank, batchId).catch(err => {
    const b = store.loadBank();
    if (b.activeBatch) { b.activeBatch.status = 'error'; b.activeBatch.error = err.message; }
    store.saveBank(b);
    runState = null;
  });

  return { queued: retryable.length, bank };
}

function deleteItemsBulk(itemIds) {
  const bank = store.loadBank();
  const idSet = new Set(itemIds);
  const toDelete = bank.items.filter(i => idSet.has(i.id));
  toDelete.forEach(item => {
    store.deleteImageFiles(item.id, item.ext);
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

module.exports = {
  publicBank, currentBank,
  startBatch, resumeBatch, pauseBatch,
  reviewItem, reviewItemsBulk,
  retryItem, retryItemsBulk, deleteItemsBulk,
  findDuplicateHashes, findDuplicateNames,
  getLog
};
