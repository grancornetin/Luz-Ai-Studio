'use strict';

const fs = require('fs');
const store = require('../core/store');
const jobRunner = require('../core/job-runner');
const photodumpImport = require('../core/photodump-import');

const PREFIX = '/api/pose-library/';

function extFromMime(mimeType) {
  if (mimeType === 'image/png') return '.png';
  if (mimeType === 'image/webp') return '.webp';
  return '.jpg';
}

function streamFile(res, filePath, mimeType) {
  if (!fs.existsSync(filePath)) return false;
  res.writeHead(200, { 'Content-Type': mimeType, 'Cache-Control': 'private, max-age=3600' });
  fs.createReadStream(filePath).pipe(res);
  return true;
}

async function handle(req, res, parsed, { sendJson, readJson }) {
  const pathname = parsed.pathname;
  if (!pathname.startsWith(PREFIX)) return false;

  // GET /status — banco completo + batch activo, para el polling del frontend
  if (req.method === 'GET' && pathname === PREFIX + 'status') {
    const bank = jobRunner.currentBank();
    sendJson(res, 200, jobRunner.publicBank(bank));
    return true;
  }

  // POST /check-duplicates — body: { hashes: string[], names: string[] }
  if (req.method === 'POST' && pathname === PREFIX + 'check-duplicates') {
    const body = await readJson(req);
    const hashes = Array.isArray(body.hashes) ? body.hashes : [];
    const names = Array.isArray(body.names) ? body.names : [];
    sendJson(res, 200, {
      duplicates: jobRunner.findDuplicateHashes(hashes),
      duplicateNames: jobRunner.findDuplicateNames(names)
    });
    return true;
  }

  // GET /logs
  if (req.method === 'GET' && pathname === PREFIX + 'logs') {
    sendJson(res, 200, { log: jobRunner.getLog() });
    return true;
  }

  // POST /jobs — arranca/agrega a la tanda (uploads manuales)
  // body: { items: [{ name, mimeType, dataBase64, thumbBase64, contentHash }] }
  if (req.method === 'POST' && pathname === PREFIX + 'jobs') {
    const body = await readJson(req, 2 * 1024 * 1024 * 1024);
    const rawItems = Array.isArray(body.items) ? body.items : [];
    if (!rawItems.length) {
      sendJson(res, 400, { error: true, cause: 'No se recibieron imágenes.' });
      return true;
    }

    const items = rawItems.map(raw => {
      const mimeType = raw.mimeType || 'image/jpeg';
      const ext = extFromMime(mimeType);
      const buffer = Buffer.from(raw.dataBase64, 'base64');
      const contentHash = raw.contentHash || store.hashBuffer(buffer);
      return {
        ext, mimeType, name: raw.name || 'sin-nombre', contentHash, buffer,
        thumbBuffer: raw.thumbBase64 ? Buffer.from(raw.thumbBase64, 'base64') : null
      };
    });

    const bank = jobRunner.startBatch(items);
    sendJson(res, 201, jobRunner.publicBank(bank));
    return true;
  }

  // POST /jobs/pause
  if (req.method === 'POST' && pathname === PREFIX + 'jobs/pause') {
    sendJson(res, 200, jobRunner.publicBank(jobRunner.pauseBatch()));
    return true;
  }

  // POST /jobs/resume
  if (req.method === 'POST' && pathname === PREFIX + 'jobs/resume') {
    sendJson(res, 200, jobRunner.publicBank(jobRunner.resumeBatch()));
    return true;
  }

  // GET /photodump/available — items aprobados de photodump disponibles para importar
  if (req.method === 'GET' && pathname === PREFIX + 'photodump/available') {
    const bank = store.loadBank();
    const alreadyImported = new Set(bank.items.filter(it => it.origin === 'photodump_import').map(it => it.sourceRef));
    const available = photodumpImport.listApprovedPhotodumpItems()
      .filter(item => !alreadyImported.has(item.id))
      .map(item => ({ id: item.id, name: item.name, ext: item.ext, mimeType: item.mimeType }));
    sendJson(res, 200, { items: available });
    return true;
  }

  // GET /photodump/:id/thumb — proxea el thumbnail de un item de photodump aún no importado
  const photodumpThumbMatch = pathname.match(/^\/api\/pose-library\/photodump\/([^/]+)\/thumb$/);
  if (req.method === 'GET' && photodumpThumbMatch) {
    const available = photodumpImport.listApprovedPhotodumpItems();
    const item = available.find(it => it.id === photodumpThumbMatch[1]);
    if (!item) { sendJson(res, 404, { error: true, cause: 'No encontrado' }); return true; }
    const filePath = photodumpImport.resolveThumbPath(item);
    if (!streamFile(res, filePath, item.mimeType)) sendJson(res, 404, { error: true, cause: 'Archivo no encontrado' });
    return true;
  }

  // POST /photodump/import — body: { itemIds: [...] }
  if (req.method === 'POST' && pathname === PREFIX + 'photodump/import') {
    const body = await readJson(req);
    const itemIds = Array.isArray(body.itemIds) ? body.itemIds : [];
    const bank = jobRunner.startBatchFromPhotodumpImport(itemIds);
    sendJson(res, 201, jobRunner.publicBank(bank));
    return true;
  }

  // GET /items/:id/thumb
  const thumbMatch = pathname.match(/^\/api\/pose-library\/items\/([^/]+)\/thumb$/);
  if (req.method === 'GET' && thumbMatch) {
    const bank = jobRunner.currentBank();
    const item = bank.items.find(i => i.id === thumbMatch[1]);
    if (!item) { sendJson(res, 404, { error: true, cause: 'No encontrado' }); return true; }
    if (item.origin === 'photodump_import') {
      const filePath = photodumpImport.resolveThumbPath({ id: item.sourceRef, ext: item.ext });
      if (!streamFile(res, filePath, item.mimeType)) sendJson(res, 404, { error: true, cause: 'Archivo no encontrado' });
      return true;
    }
    const filePath = fs.existsSync(store.thumbPath(item.id, item.ext)) ? store.thumbPath(item.id, item.ext) : store.imagePath(item.id, item.ext);
    if (!streamFile(res, filePath, item.mimeType)) sendJson(res, 404, { error: true, cause: 'Archivo no encontrado' });
    return true;
  }

  // GET /items/:id/sketch
  const sketchMatch = pathname.match(/^\/api\/pose-library\/items\/([^/]+)\/sketch$/);
  if (req.method === 'GET' && sketchMatch) {
    const bank = jobRunner.currentBank();
    const item = bank.items.find(i => i.id === sketchMatch[1]);
    if (!item || !item.sketchExt) { sendJson(res, 404, { error: true, cause: 'Sketch no disponible' }); return true; }
    const mimeType = item.sketchExt === '.png' ? 'image/png' : item.sketchExt === '.webp' ? 'image/webp' : 'image/jpeg';
    if (!streamFile(res, store.sketchPath(item.id, item.sketchExt), mimeType)) sendJson(res, 404, { error: true, cause: 'Archivo no encontrado' });
    return true;
  }

  // GET /items/:id/secondary-sketch
  const secondarySketchMatch = pathname.match(/^\/api\/pose-library\/items\/([^/]+)\/secondary-sketch$/);
  if (req.method === 'GET' && secondarySketchMatch) {
    const bank = jobRunner.currentBank();
    const item = bank.items.find(i => i.id === secondarySketchMatch[1]);
    if (!item || !item.secondary || !item.secondary.sketchExt) { sendJson(res, 404, { error: true, cause: 'Sketch secundario no disponible' }); return true; }
    const ext = item.secondary.sketchExt;
    const mimeType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
    if (!streamFile(res, store.secondarySketchPath(item.id, ext), mimeType)) sendJson(res, 404, { error: true, cause: 'Archivo no encontrado' });
    return true;
  }

  // POST /items/mark-secondary — body: { itemIds: string[] } — marca items done para generarles el tipo faltante
  if (req.method === 'POST' && pathname === PREFIX + 'items/mark-secondary') {
    const body = await readJson(req);
    const marked = jobRunner.markWantsSecondary(body.itemIds || []);
    sendJson(res, 200, { marked });
    return true;
  }

  // POST /items/:id/unmark-secondary
  const unmarkSecondaryMatch = pathname.match(/^\/api\/pose-library\/items\/([^/]+)\/unmark-secondary$/);
  if (req.method === 'POST' && unmarkSecondaryMatch) {
    const item = jobRunner.unmarkWantsSecondary(unmarkSecondaryMatch[1]);
    if (!item) { sendJson(res, 404, { error: true, cause: 'No encontrado' }); return true; }
    sendJson(res, 200, { item });
    return true;
  }

  // POST /generate-missing-types — arranca la cola de generación de tipo faltante sobre los items marcados
  if (req.method === 'POST' && pathname === PREFIX + 'generate-missing-types') {
    sendJson(res, 200, jobRunner.generateMissingTypes());
    return true;
  }

  // GET /generate-missing-types/status
  if (req.method === 'GET' && pathname === PREFIX + 'generate-missing-types/status') {
    sendJson(res, 200, jobRunner.secondaryQueueStatus());
    return true;
  }

  // GET /items/:id/original
  const originalMatch = pathname.match(/^\/api\/pose-library\/items\/([^/]+)\/original$/);
  if (req.method === 'GET' && originalMatch) {
    const bank = jobRunner.currentBank();
    const item = bank.items.find(i => i.id === originalMatch[1]);
    if (!item) { sendJson(res, 404, { error: true, cause: 'No encontrado' }); return true; }
    const filePath = item.origin === 'photodump_import'
      ? photodumpImport.resolveImagePath({ id: item.sourceRef, ext: item.ext })
      : store.imagePath(item.id, item.ext);
    if (!streamFile(res, filePath, item.mimeType)) sendJson(res, 404, { error: true, cause: 'Archivo no encontrado' });
    return true;
  }

  // GET /items/:id/analysis
  const analysisMatch = pathname.match(/^\/api\/pose-library\/items\/([^/]+)\/analysis$/);
  if (req.method === 'GET' && analysisMatch) {
    const entry = store.loadAnalysis(analysisMatch[1]);
    if (!entry) { sendJson(res, 404, { error: true, cause: 'Análisis no encontrado (¿todavía está procesando?)' }); return true; }
    sendJson(res, 200, { entry });
    return true;
  }

  // POST /items/:id/retry
  const retryMatch = pathname.match(/^\/api\/pose-library\/items\/([^/]+)\/retry$/);
  if (req.method === 'POST' && retryMatch) {
    const item = await jobRunner.retryItem(retryMatch[1]);
    if (!item) { sendJson(res, 400, { error: true, cause: 'No encontrado o no está en error' }); return true; }
    sendJson(res, 200, { item });
    return true;
  }

  // POST /retry-all-errors — reintenta todos los items en error en cola, con el mismo espaciado que un batch normal
  if (req.method === 'POST' && pathname === PREFIX + 'retry-all-errors') {
    sendJson(res, 200, jobRunner.retryAllErrors());
    return true;
  }

  // GET /retry-all-errors/status — progreso de la cola de reintentos
  if (req.method === 'GET' && pathname === PREFIX + 'retry-all-errors/status') {
    sendJson(res, 200, jobRunner.retryQueueStatus());
    return true;
  }

  // POST /reclassify-framing — re-análisis liviano (solo texto) para completar "framing" en items ya "done"
  if (req.method === 'POST' && pathname === PREFIX + 'reclassify-framing') {
    const status = await jobRunner.reclassifyFraming();
    sendJson(res, 200, status);
    return true;
  }

  // GET /reclassify-framing/status — progreso de la reclasificación
  if (req.method === 'GET' && pathname === PREFIX + 'reclassify-framing/status') {
    sendJson(res, 200, jobRunner.reclassifyStatus());
    return true;
  }

  // POST /items/:id/edit — body: { tags?, category?, contactPoints?, supportSurfaceHeight? }
  const editMatch = pathname.match(/^\/api\/pose-library\/items\/([^/]+)\/edit$/);
  if (req.method === 'POST' && editMatch) {
    const body = await readJson(req);
    const item = jobRunner.editItem(editMatch[1], body);
    if (!item) { sendJson(res, 404, { error: true, cause: 'No encontrado' }); return true; }
    sendJson(res, 200, { item });
    return true;
  }

  // POST /items/delete-bulk — body: { itemIds: string[] }
  if (req.method === 'POST' && pathname === PREFIX + 'items/delete-bulk') {
    const body = await readJson(req);
    const count = jobRunner.deleteItemsBulk(body.itemIds || []);
    sendJson(res, 200, { deleted: count });
    return true;
  }

  // GET /export — todas las entradas con status=done
  if (req.method === 'GET' && pathname === PREFIX + 'export') {
    const bank = jobRunner.currentBank();
    const doneIds = bank.items.filter(i => i.status === 'done').map(i => i.id);
    const entries = doneIds.map(id => store.loadAnalysis(id)).filter(Boolean);
    sendJson(res, 200, { total: entries.length, entries });
    return true;
  }

  return false;
}

module.exports = { handle };
