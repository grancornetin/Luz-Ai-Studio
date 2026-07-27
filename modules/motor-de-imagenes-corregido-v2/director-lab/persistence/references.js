'use strict';

const path = require('path');
const { createEntityStore } = require('./store');
const { writeAsset, findAsset } = require('./assets');

const store = createEntityStore({
  prefix: 'ref',
  entityDir: 'references',
  indexFile: 'references.json',
  indexFields: ['id', 'caseId', 'role', 'alias', 'createdAt', 'updatedAt'],
  mutable: true
});

const ASSETS_DIR = path.join(store.dir, 'assets');

function createWithAsset(data) {
  const record = store.create(data);
  if (data.assetDataUrl) {
    const asset = writeAsset(ASSETS_DIR, record.id, data.assetDataUrl);
    return store.update(record.id, { assetMimeType: asset.mimeType, assetSizeBytes: asset.sizeBytes, hasAsset: true });
  }
  return record;
}

function getAssetPath(id) {
  return findAsset(ASSETS_DIR, id);
}

module.exports = { ...store, createWithAsset, getAssetPath };
