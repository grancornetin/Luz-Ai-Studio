const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Por defecto vive dentro del propio módulo (pose-library-data/), pero el
// banco crece a cientos/miles de archivos — POSE_LIBRARY_DATA_DIR permite
// moverlo fuera del proyecto (mismo patrón que PHOTODUMP_TRAINER_DATA_DIR
// en photodump-trainer/core/store.js) sin llenar la carpeta versionada.
const DATA_DIR = process.env.POSE_LIBRARY_DATA_DIR
  || path.join(__dirname, '..', 'pose-library-data');
const IMAGES_DIR = path.join(DATA_DIR, 'images');
const SKETCHES_DIR = path.join(DATA_DIR, 'sketches');
const THUMBS_DIR = path.join(DATA_DIR, 'thumbnails');
const ANALYSES_DIR = path.join(DATA_DIR, 'analyses');
const BANK_FILE = path.join(DATA_DIR, 'bank.json');

function ensureDirs() {
  [DATA_DIR, IMAGES_DIR, SKETCHES_DIR, THUMBS_DIR, ANALYSES_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });
}

function atomicWrite(filePath, content) {
  const tmp = filePath + '.tmp';
  fs.writeFileSync(tmp, content, 'utf8');
  fs.renameSync(tmp, filePath);
}

function hashBuffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

// ── Banco acumulado (índice único de todos los items) ──
// { items: [...], activeBatch: {...} | null, log: [...] }

function loadBank() {
  ensureDirs();
  if (!fs.existsSync(BANK_FILE)) return { items: [], activeBatch: null, log: [] };
  try {
    const parsed = JSON.parse(fs.readFileSync(BANK_FILE, 'utf8'));
    return { items: parsed.items || [], activeBatch: parsed.activeBatch || null, log: parsed.log || [], ...parsed };
  } catch (_) {
    return { items: [], activeBatch: null, log: [] };
  }
}

function saveBank(bank) {
  ensureDirs();
  atomicWrite(BANK_FILE, JSON.stringify(bank, null, 2));
}

// ── Imágenes originales, sketches y thumbnails ──

function saveImage(itemId, buffer, ext) {
  ensureDirs();
  const file = path.join(IMAGES_DIR, `${itemId}${ext}`);
  fs.writeFileSync(file, buffer);
  return file;
}

function saveThumb(itemId, buffer, ext) {
  ensureDirs();
  const file = path.join(THUMBS_DIR, `${itemId}${ext}`);
  fs.writeFileSync(file, buffer);
  return file;
}

function saveSketch(itemId, buffer, ext) {
  ensureDirs();
  const file = path.join(SKETCHES_DIR, `${itemId}${ext}`);
  fs.writeFileSync(file, buffer);
  return file;
}

function saveSecondarySketch(itemId, buffer, ext) {
  ensureDirs();
  const file = secondarySketchPath(itemId, ext);
  fs.writeFileSync(file, buffer);
  return file;
}

function imagePath(itemId, ext) {
  return path.join(IMAGES_DIR, `${itemId}${ext}`);
}

function thumbPath(itemId, ext) {
  return path.join(THUMBS_DIR, `${itemId}${ext}`);
}

function sketchPath(itemId, ext) {
  return path.join(SKETCHES_DIR, `${itemId}${ext}`);
}

// Sketch del "tipo secundario" (item.secondary) — cuando una imagen sirve
// tanto de referencia de cuerpo como de expresión, se guarda con sufijo
// propio para no pisar el sketch primario del mismo item.
function secondarySketchPath(itemId, ext) {
  return path.join(SKETCHES_DIR, `${itemId}_secondary${ext}`);
}

function deleteImageFiles(itemId, ext, secondaryExt) {
  const files = [imagePath(itemId, ext), thumbPath(itemId, ext), sketchPath(itemId, ext)];
  if (secondaryExt) files.push(secondarySketchPath(itemId, secondaryExt));
  files.forEach(file => {
    try { if (fs.existsSync(file)) fs.unlinkSync(file); } catch (_) { /* ya no está, no importa */ }
  });
}

// ── Análisis individual por item ──

function saveAnalysis(itemId, entry) {
  ensureDirs();
  atomicWrite(path.join(ANALYSES_DIR, `${itemId}.json`), JSON.stringify(entry, null, 2));
}

function loadAnalysis(itemId) {
  const file = path.join(ANALYSES_DIR, `${itemId}.json`);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (_) {
    return null;
  }
}

function deleteAnalysis(itemId) {
  const file = path.join(ANALYSES_DIR, `${itemId}.json`);
  try { if (fs.existsSync(file)) fs.unlinkSync(file); } catch (_) { /* no existía */ }
}

module.exports = {
  DATA_DIR, IMAGES_DIR, SKETCHES_DIR, THUMBS_DIR, ANALYSES_DIR,
  ensureDirs, hashBuffer,
  loadBank, saveBank,
  saveImage, saveThumb, saveSketch, imagePath, thumbPath, sketchPath, deleteImageFiles,
  saveSecondarySketch, secondarySketchPath,
  saveAnalysis, loadAnalysis, deleteAnalysis
};
