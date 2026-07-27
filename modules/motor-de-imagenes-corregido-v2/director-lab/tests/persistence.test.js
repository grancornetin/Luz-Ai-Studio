'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

function withTempDataRoot(fn) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'director-lab-test-'));
  const previous = process.env.DIRECTOR_LAB_DATA_ROOT;
  process.env.DIRECTOR_LAB_DATA_ROOT = tempDir;
  // Los stores cachean DATA_ROOT al require(); forzamos módulos frescos por test.
  Object.keys(require.cache).forEach(key => {
    if (key.includes(`${path.sep}persistence${path.sep}`)) delete require.cache[key];
  });
  try {
    return fn(tempDir);
  } finally {
    process.env.DIRECTOR_LAB_DATA_ROOT = previous;
    Object.keys(require.cache).forEach(key => {
      if (key.includes(`${path.sep}persistence${path.sep}`)) delete require.cache[key];
    });
  }
}

test('crear y recargar un proyecto sobrevive a un "reinicio" (nuevo require del store)', () => {
  withTempDataRoot(tempDir => {
    const projects = require('../persistence/projects');
    const created = projects.create({ name: 'Proyecto de prueba' });
    assert.ok(created.id);

    // Simula reinicio del servidor: se borra el cache y se vuelve a requerir.
    Object.keys(require.cache).forEach(key => {
      if (key.includes(`${path.sep}persistence${path.sep}`)) delete require.cache[key];
    });
    const projectsReloaded = require('../persistence/projects');
    const reloaded = projectsReloaded.get(created.id);
    assert.ok(reloaded);
    assert.equal(reloaded.name, 'Proyecto de prueba');
  });
});

test('runs son create-only: update() lanza en vez de sobrescribir silenciosamente', () => {
  withTempDataRoot(() => {
    const runs = require('../persistence/runs');
    const run = runs.create({ id: 'run_test_1', status: 'ready', caseId: 'case_x' });
    assert.throws(() => runs.update(run.id, { status: 'blocked' }));
  });
});

test('proyectos son mutables con backup .bak antes de update', () => {
  withTempDataRoot(tempDir => {
    const projects = require('../persistence/projects');
    const created = projects.create({ name: 'Original' });
    const updated = projects.update(created.id, { name: 'Actualizado' });
    assert.equal(updated.name, 'Actualizado');
    const backupPath = path.join(tempDir, 'projects', `${created.id}.json.bak`);
    assert.ok(fs.existsSync(backupPath), 'debe existir un backup .bak tras el update');
  });
});

test('subir un resultado guarda el binario como archivo aparte, nunca base64 en el JSON', () => {
  withTempDataRoot(() => {
    const runs = require('../persistence/runs');
    const results = require('../persistence/results');
    const run = runs.create({ id: 'run_test_2', status: 'ready', caseId: 'case_x' });
    const tinyPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
    const created = results.create(run.id, { assetDataUrl: `data:image/png;base64,${tinyPngBase64}`, note: 'test' });
    assert.ok(!('assetDataUrl' in created), 'el registro no debe conservar la dataUrl completa');
    const assetPath = results.getAssetPath(run.id, created.id);
    assert.ok(assetPath && fs.existsSync(assetPath));
  });
});
