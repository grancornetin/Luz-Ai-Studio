const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Por defecto vive en la raíz del repo (src/data/trainer/photodump/), pero el banco crece a
// miles de imágenes — PHOTODUMP_TRAINER_DATA_DIR permite moverlo fuera del proyecto (ej. a un
// disco/carpeta separada) sin llenar la carpeta versionada ni sincronizada.
const DATA_DIR = process.env.PHOTODUMP_TRAINER_DATA_DIR
  || path.join(__dirname, '..', '..', '..', '..', 'src', 'data', 'trainer', 'photodump');
const IMAGES_DIR = path.join(DATA_DIR, 'images');
const THUMBS_DIR = path.join(DATA_DIR, 'thumbnails');
const ANALYSES_DIR = path.join(DATA_DIR, 'analyses');
const BANK_FILE = path.join(DATA_DIR, 'bank.json'); // índice único: todas las imágenes de todas las tandas

function ensureDirs() {
  [DATA_DIR, IMAGES_DIR, THUMBS_DIR, ANALYSES_DIR].forEach(dir => {
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

// ── Banco acumulado (índice único de TODAS las imágenes, de todas las tandas) ──
// { items: [...], activeBatch: {...} | null }

function loadBank() {
  ensureDirs();
  if (!fs.existsSync(BANK_FILE)) return { items: [], activeBatch: null, log: [] };
  try {
    const parsed = JSON.parse(fs.readFileSync(BANK_FILE, 'utf8'));
    // Reconstruir solo items/activeBatch (whitelist explícita) descartaba silenciosamente
    // cualquier campo nuevo agregado después (ej. `log`) — bug real: pushLog() escribía
    // correctamente al disco, pero la siguiente lectura lo tiraba, dejando /logs vacío
    // para siempre. Se preserva el resto del objeto con el spread.
    return { items: parsed.items || [], activeBatch: parsed.activeBatch || null, log: parsed.log || [], ...parsed };
  } catch (_) {
    return { items: [], activeBatch: null, log: [] };
  }
}

function saveBank(bank) {
  ensureDirs();
  atomicWrite(BANK_FILE, JSON.stringify(bank, null, 2));
}

// ── Imágenes originales + thumbnails ──

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

function imagePath(itemId, ext) {
  return path.join(IMAGES_DIR, `${itemId}${ext}`);
}

function thumbPath(itemId, ext) {
  return path.join(THUMBS_DIR, `${itemId}${ext}`);
}

function deleteImageFiles(itemId, ext) {
  [imagePath(itemId, ext), thumbPath(itemId, ext)].forEach(file => {
    try { if (fs.existsSync(file)) fs.unlinkSync(file); } catch (_) { /* ya no está, no importa */ }
  });
}

// ── Análisis individual por imagen ──

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
  DATA_DIR, IMAGES_DIR, THUMBS_DIR, ANALYSES_DIR,
  ensureDirs, hashBuffer,
  loadBank, saveBank,
  saveImage, saveThumb, imagePath, thumbPath, deleteImageFiles,
  saveAnalysis, loadAnalysis, deleteAnalysis
};
