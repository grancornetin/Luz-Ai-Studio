'use strict';

const fs = require('fs');
const path = require('path');

const MIME_EXTENSIONS = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif'
};

function parseDataUrl(dataUrl) {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl || '');
  if (!match) return null;
  return { mimeType: match[1], buffer: Buffer.from(match[2], 'base64') };
}

function extensionForMime(mimeType) {
  return MIME_EXTENSIONS[mimeType] || '.bin';
}

function writeAsset(dir, id, dataUrl) {
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) throw new Error('dataUrl inválido: se esperaba formato data:<mime>;base64,<data>');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, id + extensionForMime(parsed.mimeType));
  fs.writeFileSync(filePath, parsed.buffer);
  return { filePath, mimeType: parsed.mimeType, sizeBytes: parsed.buffer.length };
}

function findAsset(dir, id) {
  if (!fs.existsSync(dir)) return null;
  const match = fs.readdirSync(dir).find(name => name.startsWith(id + '.'));
  return match ? path.join(dir, match) : null;
}

module.exports = { parseDataUrl, extensionForMime, writeAsset, findAsset, MIME_EXTENSIONS };
