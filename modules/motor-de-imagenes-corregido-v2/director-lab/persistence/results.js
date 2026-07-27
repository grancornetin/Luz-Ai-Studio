'use strict';

const fs = require('fs');
const path = require('path');
const { atomicWriteFileSync } = require('./atomic-write');
const { safeId, generateId } = require('./ids');
const { writeAsset, findAsset } = require('./assets');
const { DATA_ROOT, ensureDir } = require('./store');

const RESULTS_ROOT = path.join(DATA_ROOT, 'results');

function runDir(runId) {
  return path.join(RESULTS_ROOT, runId);
}

function assetsDir(runId) {
  return path.join(runDir(runId), 'assets');
}

function create(runId, data) {
  const safeRunId = safeId(runId);
  if (!safeRunId) throw new Error('runId inválido');
  ensureDir(runDir(safeRunId));
  const id = generateId('result');
  const now = new Date().toISOString();
  const record = { ...data, id, runId: safeRunId, createdAt: now };
  delete record.assetDataUrl;
  if (data.assetDataUrl) {
    const asset = writeAsset(assetsDir(safeRunId), id, data.assetDataUrl);
    record.assetMimeType = asset.mimeType;
    record.assetSizeBytes = asset.sizeBytes;
  }
  atomicWriteFileSync(path.join(runDir(safeRunId), `${id}.json`), JSON.stringify(record, null, 2));
  return record;
}

function listForRun(runId) {
  const dir = runDir(safeId(runId) || '__invalid__');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(name => name.endsWith('.json'))
    .map(name => JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8')));
}

function getAssetPath(runId, resultId) {
  return findAsset(assetsDir(safeId(runId) || '__invalid__'), resultId);
}

module.exports = { create, listForRun, getAssetPath };
