'use strict';

const { createEntityStore } = require('./store');

const store = createEntityStore({
  prefix: 'proposal',
  entityDir: 'learning-proposals',
  indexFile: 'learning-proposals.json',
  indexFields: ['id', 'runId', 'domain', 'status', 'createdAt'],
  mutable: true
});

module.exports = store;
