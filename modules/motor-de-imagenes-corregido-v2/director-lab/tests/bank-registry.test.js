'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const bankRegistry = require('../core/bank-registry');

test('listBanks carga los bancos reales con datos verificables (scene_bank, director_rules_ugc, hpi_real)', () => {
  const banks = bankRegistry.listBanks();
  const ids = banks.map(bank => bank.bankId).sort();
  assert.deepEqual(ids, ['director_rules_ugc', 'hpi_real', 'scene_bank'].sort());

  const sceneBank = banks.find(bank => bank.bankId === 'scene_bank');
  assert.ok(sceneBank.status.total > 0, 'scene_bank debe tener escenas reales cargadas');
  assert.ok(sceneBank.status.available);

  const hpiReal = banks.find(bank => bank.bankId === 'hpi_real');
  assert.ok(hpiReal.status.available, 'hpi_real debe reportar el banco real de Photodump conectado');
});

test('getBankStatus de un banco desconocido devuelve available:false sin lanzar', () => {
  const status = bankRegistry.getBankStatus('nonexistent_bank');
  assert.equal(status.available, false);
});

test('searchBank sobre scene_bank devuelve candidatos con procedencia real', () => {
  const results = bankRegistry.searchBank('scene_bank', {}, {});
  assert.ok(results.length > 0);
  results.forEach(candidate => {
    assert.equal(candidate.sourceBank, 'scene_bank');
    assert.ok(candidate.sourceId);
  });
});

test('getEntry devuelve null para un sourceId inexistente en vez de lanzar', () => {
  const entry = bankRegistry.getEntry('scene_bank', 'SCENE_DOES_NOT_EXIST');
  assert.equal(entry, null);
});
