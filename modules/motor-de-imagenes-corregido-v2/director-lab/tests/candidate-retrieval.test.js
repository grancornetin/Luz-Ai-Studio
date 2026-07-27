'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const candidateRetrieval = require('../core/candidate-retrieval');

test('retrieveAll excluye escenas needs_review/candidate por defecto y preserva IDs/procedencia', () => {
  const candidates = candidateRetrieval.retrieveAll({});
  assert.ok(candidates.scene.length > 0);
  candidates.scene.forEach(candidate => {
    assert.equal(candidate.curationStatus === 'approved' || candidate.strongReference, true,
      `escena ${candidate.sourceId} con status ${candidate.curationStatus} no debería ser elegible por defecto`);
    assert.ok(candidate.sourceId, 'debe preservar sourceId');
    assert.equal(candidate.sourceBank, 'scene_bank');
  });
});

test('retrieveAll incluye directorRules como dominio separado (v2: pose/gesture/expression ya no se consultan acá, ver photodump-recipe-adapter.js)', () => {
  const candidates = candidateRetrieval.retrieveAll({});
  assert.ok(candidates.directorRules.length > 0);
  candidates.directorRules.forEach(candidate => assert.equal(candidate.domain, 'director_rule'));
  assert.equal(candidates.pose, undefined);
  assert.equal(candidates.gesture, undefined);
  assert.equal(candidates.expression, undefined);
});

test('collectRejectedByEligibility reporta escenas no-elegibles con motivo', () => {
  const rejected = candidateRetrieval.collectRejectedByEligibility('scene');
  assert.ok(rejected.length > 0, 'debe haber escenas needs_review/candidate rechazadas por defecto');
  rejected.forEach(rejection => {
    assert.equal(rejection.domain, 'scene');
    assert.ok(rejection.sourceId);
    assert.ok(rejection.reason.includes('curationStatus='));
  });
});
