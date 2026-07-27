'use strict';

const { createEntityStore } = require('./store');

// Feedback en texto libre del usuario por (recipeId, shotId). Se reinyecta
// automáticamente en el prompt la próxima vez que se genera esa combinación
// (ver adapters/photodump-recipe-adapter.js -> noteInjector). El usuario solo
// escribe la nota y la guarda — no gestiona "entidades" ni tags.
const store = createEntityStore({
  prefix: 'note',
  entityDir: 'shot-notes',
  indexFile: 'shot-notes.json',
  indexFields: ['id', 'recipeId', 'shotId', 'note', 'createdAt'],
  mutable: true
});

function latestFor(recipeId, shotId) {
  const matches = store.list().filter(note => note.recipeId === recipeId && note.shotId === shotId);
  if (matches.length === 0) return null;
  return matches.reduce((latest, note) => (note.createdAt > latest.createdAt ? note : latest));
}

module.exports = { ...store, latestFor };
