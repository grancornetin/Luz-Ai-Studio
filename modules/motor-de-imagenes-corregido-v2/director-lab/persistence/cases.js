'use strict';

const { createEntityStore } = require('./store');

const store = createEntityStore({
  prefix: 'case',
  entityDir: 'cases',
  indexFile: 'cases.json',
  indexFields: ['id', 'projectId', 'recipeId', 'name', 'createdAt', 'updatedAt'],
  mutable: true
});

module.exports = store;
