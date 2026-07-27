'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const ruleEngine = require('../core/rule-engine');

test('getAllRules expone las 5 reglas creativas versionadas', () => {
  const rules = ruleEngine.getAllRules();
  const ids = rules.map(rule => rule.ruleId).sort();
  assert.deepEqual(ids, [
    'RULE_CAPTURE_MECHANISM_VARIETY',
    'RULE_FLASH_IPHONE',
    'RULE_HPI_ACTIVE_USE',
    'RULE_NO_LOCOMOTION',
    'RULE_REFERENCE_ROLE_ISOLATION'
  ].sort());
});

test('RULE_NO_LOCOMOTION detecta patrones de locomoción en inglés y español', () => {
  const rule = ruleEngine.RULE_NO_LOCOMOTION;
  assert.ok(rule.patterns.some(p => p.test('she is walking toward the door')));
  assert.ok(rule.patterns.some(p => p.test('caminando por la calle')));
  assert.ok(!rule.patterns.some(p => p.test('standing still against the wall')));
});

test('summarizeForPrompt no expone campos internos innecesarios (solo ruleId/domain/description)', () => {
  const summary = ruleEngine.summarizeForPrompt();
  summary.forEach(entry => {
    assert.deepEqual(Object.keys(entry).sort(), ['description', 'domain', 'ruleId']);
  });
});
