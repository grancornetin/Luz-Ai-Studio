'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const validators = require('../core/validators');

test('validateNoLocomotion bloquea prompts con lenguaje de locomoción', () => {
  const result = validators.validateNoLocomotion('A woman walking mid-stride toward the entrance.');
  assert.equal(result.passed, false);
  assert.ok(result.blocks.length > 0);
});

test('validateNoLocomotion pasa con prompts estáticos', () => {
  const result = validators.validateNoLocomotion('Standing still, leaning against the wall, both feet planted.');
  assert.equal(result.passed, true);
  assert.equal(result.blocks.length, 0);
});

test('validateStaticPoseEligibility advierte (no bloquea) cuando hay pose plana y alternativas HPI mejores', () => {
  const flatPose = { sourceId: 'POSE_FLAT', confidence: 70, sourceText: 'Standing frontal, arms down', tags: ['flat_pose'] };
  const pool = [
    flatPose,
    { sourceId: 'POSE_EXPRESSIVE', confidence: 85, sourceText: 'Leaning asymmetrically', tags: ['asymmetric'] }
  ];
  const result = validators.validateStaticPoseEligibility(flatPose, pool);
  assert.equal(result.passed, true, 'no debe bloquear, solo advertir');
  assert.ok(result.warnings.length > 0);
});

test('validateStaticPoseEligibility no advierte si la pose no es plana', () => {
  const asymPose = { sourceId: 'POSE_EXPRESSIVE', confidence: 85, sourceText: 'Leaning asymmetrically against wall', tags: ['asymmetric'] };
  const result = validators.validateStaticPoseEligibility(asymPose, [asymPose]);
  assert.equal(result.warnings.length, 0);
});

test('validateFlashSkin bloquea combinaciones prohibidas de flash/piel/óptica', () => {
  const result = validators.validateFlashSkin('Photo with plastic skin and professional bokeh background.');
  assert.equal(result.passed, false);
  assert.ok(result.blocks[0].includes('plastic skin'));
});

test('validateFlashSkin pasa con luz ambiental natural', () => {
  const result = validators.validateFlashSkin('Ambient natural light, natural skin tone.');
  assert.equal(result.passed, true);
});

test('validateReferenceDomainContamination bloquea cuando una referencia outfit trae vocabulario de pose/identidad', () => {
  const references = [{ referenceId: 'ref_outfit', role: 'outfit', alias: '@outfit-night-001' }];
  const fragments = { ref_outfit: '@outfit-night-001 (outfit) with a confident pose and identity features' };
  const result = validators.validateReferenceDomainContamination(references, fragments);
  assert.equal(result.passed, false);
});

test('validateReferenceDomainContamination pasa cuando el fragmento respeta el dominio', () => {
  const references = [{ referenceId: 'ref_outfit', role: 'outfit', alias: '@outfit-night-001' }];
  const fragments = { ref_outfit: '@outfit-night-001 (outfit)' };
  const result = validators.validateReferenceDomainContamination(references, fragments);
  assert.equal(result.passed, true);
});
