'use strict';

const fs = require('fs');
const path = require('path');
const { atomicWriteFileSync } = require('./atomic-write');
const { safeId, generateId } = require('./ids');

const DATA_ROOT = process.env.DIRECTOR_LAB_DATA_ROOT || path.join(__dirname, '..', '..', 'director-lab-data');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// Crea un store CRUD simple para una entidad: un JSON por registro en <DATA_ROOT>/<entityDir>/<id>.json,
// más un índice liviano opcional en <DATA_ROOT>/<indexFile> con solo los campos declarados en indexFields.
// mutable=true habilita update() con backup .bak antes de sobrescribir (proyectos/recetas).
// mutable=false (default) trata los registros como create-only/inmutables (runs, resultados, evaluaciones).
function createEntityStore({ prefix, entityDir, indexFile, indexFields = ['id', 'createdAt', 'updatedAt'], mutable = false }) {
  const dir = path.join(DATA_ROOT, entityDir);
  ensureDir(dir);

  function recordPath(id) {
    return path.join(dir, `${id}.json`);
  }

  function loadIndex() {
    if (!indexFile) return null;
    const indexPath = path.join(DATA_ROOT, indexFile);
    if (!fs.existsSync(indexPath)) return [];
    try {
      return JSON.parse(fs.readFileSync(indexPath, 'utf8'));
    } catch (_) {
      return [];
    }
  }

  function saveIndex(entries) {
    if (!indexFile) return;
    const indexPath = path.join(DATA_ROOT, indexFile);
    atomicWriteFileSync(indexPath, JSON.stringify(entries, null, 2));
  }

  function upsertIndexEntry(record) {
    if (!indexFile) return;
    const entries = loadIndex();
    const summary = {};
    indexFields.forEach(field => { summary[field] = record[field]; });
    const idx = entries.findIndex(entry => entry.id === record.id);
    if (idx >= 0) entries[idx] = summary; else entries.push(summary);
    saveIndex(entries);
  }

  function create(data) {
    const id = safeId(data.id) || generateId(prefix);
    const now = new Date().toISOString();
    const record = { ...data, id, createdAt: data.createdAt || now, updatedAt: now };
    atomicWriteFileSync(recordPath(id), JSON.stringify(record, null, 2));
    upsertIndexEntry(record);
    return record;
  }

  function get(id) {
    const safe = safeId(id);
    if (!safe) return null;
    const filePath = recordPath(safe);
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }

  function list() {
    if (indexFile) return loadIndex();
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
      .filter(name => name.endsWith('.json') && !name.includes('.tmp-') && !name.endsWith('.bak'))
      .map(name => JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8')));
  }

  function update(id, patch) {
    if (!mutable) throw new Error(`El store de ${entityDir} es create-only; no soporta update().`);
    const existing = get(id);
    if (!existing) return null;
    const filePath = recordPath(existing.id);
    if (fs.existsSync(filePath)) {
      fs.copyFileSync(filePath, `${filePath}.bak`);
    }
    const updated = { ...existing, ...patch, id: existing.id, updatedAt: new Date().toISOString() };
    atomicWriteFileSync(filePath, JSON.stringify(updated, null, 2));
    upsertIndexEntry(updated);
    return updated;
  }

  return { create, get, list, update, dir };
}

module.exports = { createEntityStore, DATA_ROOT, ensureDir };
