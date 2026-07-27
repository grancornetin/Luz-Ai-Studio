'use strict';

const { createEntityStore } = require('./store');

const store = createEntityStore({
  prefix: 'proj',
  entityDir: 'projects',
  indexFile: 'projects.json',
  indexFields: ['id', 'name', 'createdAt', 'updatedAt'],
  mutable: true
});

module.exports = store;
