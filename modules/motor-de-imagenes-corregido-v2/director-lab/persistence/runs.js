'use strict';

const { createEntityStore } = require('./store');

// Runs son inmutables por diseño (brief 4.1: "Cada ejecución debe ser inmutable
// como snapshot"). mutable=false — nunca se sobrescribe un run existente.
const store = createEntityStore({
  prefix: 'run',
  entityDir: 'runs',
  indexFile: 'runs.json',
  indexFields: ['id', 'caseId', 'shotId', 'status', 'previousRunId', 'createdAt'],
  mutable: false
});

module.exports = store;
