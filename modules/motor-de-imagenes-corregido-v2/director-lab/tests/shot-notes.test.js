'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

function withTempDataRoot(fn) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'director-lab-notes-test-'));
  const previous = process.env.DIRECTOR_LAB_DATA_ROOT;
  process.env.DIRECTOR_LAB_DATA_ROOT = tempDir;
  Object.keys(require.cache).forEach(key => {
    if (key.includes(`${path.sep}persistence${path.sep}`)) delete require.cache[key];
  });
  try {
    return fn();
  } finally {
    process.env.DIRECTOR_LAB_DATA_ROOT = previous;
    Object.keys(require.cache).forEach(key => {
      if (key.includes(`${path.sep}persistence${path.sep}`)) delete require.cache[key];
    });
  }
}

test('latestFor devuelve null si no hay notas para esa receta/shot', () => {
  withTempDataRoot(() => {
    const shotNotes = require('../persistence/shot-notes');
    assert.equal(shotNotes.latestFor('outfit_night_out', 'mirror_check'), null);
  });
});

test('latestFor devuelve la nota más reciente cuando hay varias para el mismo shot', () => {
  withTempDataRoot(() => {
    const shotNotes = require('../persistence/shot-notes');
    shotNotes.create({ recipeId: 'outfit_night_out', shotId: 'mirror_check', note: 'primera nota' });
    const second = shotNotes.create({ recipeId: 'outfit_night_out', shotId: 'mirror_check', note: 'segunda nota, la buena' });
    const latest = shotNotes.latestFor('outfit_night_out', 'mirror_check');
    assert.equal(latest.id, second.id);
    assert.equal(latest.note, 'segunda nota, la buena');
  });
});

test('notas de un shotId no contaminan otro shotId de la misma receta', () => {
  withTempDataRoot(() => {
    const shotNotes = require('../persistence/shot-notes');
    shotNotes.create({ recipeId: 'outfit_night_out', shotId: 'mirror_check', note: 'nota de mirror_check' });
    assert.equal(shotNotes.latestFor('outfit_night_out', 'presentation'), null);
  });
});
