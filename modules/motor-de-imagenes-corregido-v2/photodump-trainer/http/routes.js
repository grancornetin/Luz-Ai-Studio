'use strict';

const fs = require('fs');
const path = require('path');
const store = require('../core/store');
const jobRunner = require('../core/job-runner');

const PREFIX = '/api/photodump-trainer/';

function extFromMime(mimeType) {
  if (mimeType === 'image/png') return '.png';
  if (mimeType === 'image/webp') return '.webp';
  return '.jpg';
}

async function handle(req, res, parsed, { sendJson, readJson }) {
  const pathname = parsed.pathname;
  if (!pathname.startsWith(PREFIX)) return false;

  // GET /api/photodump-trainer/status — banco acumulado completo + tanda activa, para el polling del frontend
  if (req.method === 'GET' && pathname === PREFIX + 'status') {
    const bank = jobRunner.currentBank();
    sendJson(res, 200, jobRunner.publicBank(bank));
    return true;
  }

  // POST /api/photodump-trainer/check-duplicates — body: { hashes: string[], names: string[] }
  // Chequea ANTES de subir si alguno de esos hashes o nombres de archivo ya existe en el banco.
  // El chequeo por nombre es instantáneo (no requiere leer el archivo) — útil para reenviar
  // un lote de cientos de imágenes y descartar de una las que ya se analizaron.
  if (req.method === 'POST' && pathname === PREFIX + 'check-duplicates') {
    const body = await readJson(req);
    const hashes = Array.isArray(body.hashes) ? body.hashes : [];
    const names = Array.isArray(body.names) ? body.names : [];
    const duplicates = jobRunner.findDuplicateHashes(hashes);
    const duplicateNames = jobRunner.findDuplicateNames(names);
    sendJson(res, 200, { duplicates, duplicateNames });
    return true;
  }

  // GET /api/photodump-trainer/logs — historial de eventos (errores, avisos de rate limit, pausas)
  if (req.method === 'GET' && pathname === PREFIX + 'logs') {
    sendJson(res, 200, { log: jobRunner.getLog() });
    return true;
  }

  // POST /api/photodump-trainer/jobs — arranca una tanda nueva sobre el banco acumulado
  // body: { items: [{ name, mimeType, dataBase64, thumbBase64, contentHash }] }
  // Límite alto porque un lote de cientos de imágenes en base64 (+33% por la codificación)
  // puede sumar varios cientos de MB — el default de readJson (12MB) rechazaría cualquier
  // lote real de más de ~10-15 fotos.
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

  // POST /api/photodump-trainer/jobs/pause
  if (req.method === 'POST' && pathname === PREFIX + 'jobs/pause') {
    const bank = jobRunner.pauseBatch();
    sendJson(res, 200, jobRunner.publicBank(bank));
    return true;
  }

  // POST /api/photodump-trainer/jobs/resume
  if (req.method === 'POST' && pathname === PREFIX + 'jobs/resume') {
    const bank = jobRunner.resumeBatch();
    sendJson(res, 200, jobRunner.publicBank(bank));
    return true;
  }

  // GET /api/photodump-trainer/items/:id/thumb
  const thumbMatch = pathname.match(/^\/api\/photodump-trainer\/items\/([^/]+)\/thumb$/);
  if (req.method === 'GET' && thumbMatch) {
    const bank = jobRunner.currentBank();
    const item = bank.items.find(i => i.id === thumbMatch[1]);
    if (!item) { sendJson(res, 404, { error: true, cause: 'No encontrado' }); return true; }
    const file = fs.existsSync(store.thumbPath(item.id, item.ext)) ? store.thumbPath(item.id, item.ext) : store.imagePath(item.id, item.ext);
    if (!fs.existsSync(file)) { sendJson(res, 404, { error: true, cause: 'Archivo no encontrado' }); return true; }
    res.writeHead(200, { 'Content-Type': item.mimeType, 'Cache-Control': 'private, max-age=31536000' });
    fs.createReadStream(file).pipe(res);
    return true;
  }

  // GET /api/photodump-trainer/items/:id/analysis
  const analysisMatch = pathname.match(/^\/api\/photodump-trainer\/items\/([^/]+)\/analysis$/);
  if (req.method === 'GET' && analysisMatch) {
    const entry = store.loadAnalysis(analysisMatch[1]);
    if (!entry) { sendJson(res, 404, { error: true, cause: 'Análisis no encontrado (¿todavía está procesando?)' }); return true; }
    sendJson(res, 200, { entry });
    return true;
  }

  // POST /api/photodump-trainer/items/:id/review — body: { decision }
  const reviewMatch = pathname.match(/^\/api\/photodump-trainer\/items\/([^/]+)\/review$/);
  if (req.method === 'POST' && reviewMatch) {
    const body = await readJson(req);
    const item = jobRunner.reviewItem(reviewMatch[1], body.decision);
    if (!item) { sendJson(res, 404, { error: true, cause: 'No encontrado' }); return true; }
    sendJson(res, 200, { item });
    return true;
  }

  // POST /api/photodump-trainer/items/:id/retry — reintenta un item en error, sin resubir el archivo
  const retryMatch = pathname.match(/^\/api\/photodump-trainer\/items\/([^/]+)\/retry$/);
  if (req.method === 'POST' && retryMatch) {
    const item = await jobRunner.retryItem(retryMatch[1]);
    if (!item) { sendJson(res, 400, { error: true, cause: 'No encontrado o no está en error' }); return true; }
    sendJson(res, 200, { item });
    return true;
  }

  // POST /api/photodump-trainer/items/review-bulk — body: { itemIds: string[], decision }
  if (req.method === 'POST' && pathname === PREFIX + 'items/review-bulk') {
    const body = await readJson(req);
    const count = jobRunner.reviewItemsBulk(body.itemIds || [], body.decision);
    sendJson(res, 200, { updated: count });
    return true;
  }

  // POST /api/photodump-trainer/items/delete-bulk — body: { itemIds: string[] } — borra archivo + análisis + índice
  if (req.method === 'POST' && pathname === PREFIX + 'items/delete-bulk') {
    const body = await readJson(req);
    const count = jobRunner.deleteItemsBulk(body.itemIds || []);
    sendJson(res, 200, { deleted: count });
    return true;
  }

  // GET /api/photodump-trainer/export — banco final: todas las entradas aprobadas de todo el historial
  if (req.method === 'GET' && pathname === PREFIX + 'export') {
    const bank = jobRunner.currentBank();
    const approvedIds = new Set(bank.items.filter(i => i.review === 'approved').map(i => i.id));
    const entries = [...approvedIds].map(id => store.loadAnalysis(id)).filter(Boolean);
    sendJson(res, 200, { total: entries.length, entries });
    return true;
  }

  return false;
}

module.exports = { handle };
