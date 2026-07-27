'use strict';

const { createEntityStore } = require('./store');

const store = createEntityStore({
  prefix: 'eval',
  entityDir: 'evaluations',
  indexFile: 'evaluations.json',
  indexFields: ['id', 'runId', 'status', 'score', 'createdAt'],
  mutable: false
});

module.exports = store;
