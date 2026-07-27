'use strict';

const { createEntityStore } = require('./store');

const store = createEntityStore({
  prefix: 'recipe',
  entityDir: 'recipes',
  indexFile: 'recipes.json',
  indexFields: ['id', 'projectId', 'name', 'createdAt', 'updatedAt'],
  mutable: true
});

module.exports = store;
