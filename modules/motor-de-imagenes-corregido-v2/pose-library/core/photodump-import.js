// Lectura de solo lectura del banco existente de photodump-trainer, para
// importar imágenes ya aprobadas sin re-subir binarios ni tocar ese banco.

const fs = require('fs');
const path = require('path');

function photodumpDataDir() {
  return process.env.PHOTODUMP_TRAINER_DATA_DIR
    || path.join(__dirname, '..', '..', '..', '..', 'src', 'data', 'trainer', 'photodump');
}

function photodumpBankFile() {
  return path.join(photodumpDataDir(), 'bank.json');
}

function listApprovedPhotodumpItems() {
  const file = photodumpBankFile();
  if (!fs.existsSync(file)) return [];
  try {
    const bank = JSON.parse(fs.readFileSync(file, 'utf8'));
    return (bank.items || []).filter(item => item.review === 'approved' && item.status === 'done');
  } catch (_) {
    return [];
  }
}

function resolveImagePath(item) {
  return path.join(photodumpDataDir(), 'images', item.id + item.ext);
}

function resolveThumbPath(item) {
  const thumb = path.join(photodumpDataDir(), 'thumbnails', item.id + item.ext);
  return fs.existsSync(thumb) ? thumb : resolveImagePath(item);
}

module.exports = {
  photodumpDataDir,
  listApprovedPhotodumpItems,
  resolveImagePath,
  resolveThumbPath
};
