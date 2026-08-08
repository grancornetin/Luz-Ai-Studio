'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const reasoner = require('../core/gemini-recipe-reasoner');

const SAMPLE_CANDIDATES = [
  { sourceId: 'SCENE_REAL_1', sourceText: 'A rooftop bar at night.', settingCategory: 'urban_exterior', capabilities: {} },
  { sourceId: 'SCENE_REAL_2', sourceText: 'An elegant hotel lobby.', settingCategory: 'hotel', capabilities: {} }
];

function textResponse(payload) {
  return { content: [{ type: 'text', text: JSON.stringify(payload) }] };
}

test('reasonAboutRecipe acepta un sceneId real presente en el pool enviado', async () => {
  const client = {
    async generateAnthropicCompatible() {
      return textResponse({
        level: 'corto', energy: 'elegante', hasCompanion: false,
        sceneId: 'SCENE_REAL_1', sceneReason: 'ok',
        psychologicalReading: { primaryDrive: 'x' }, reasoning: 'ok'
      });
    }
  };
  const result = await reasoner.reasonAboutRecipe({ geminiClient: client, brief: 'x', sceneCandidates: SAMPLE_CANDIDATES });
  assert.equal(result.status, 'ok');
  assert.equal(result.scene.sourceId, 'SCENE_REAL_1');
});

test('reasonAboutRecipe rechaza un sceneId inventado y devuelve needs_review tras el reintento', async () => {
  const client = {
    async generateAnthropicCompatible() {
      return textResponse({
        level: 'corto', energy: 'elegante', hasCompanion: false,
        sceneId: 'SCENE_FAKE_999', sceneReason: 'ok', reasoning: 'ok'
      });
    }
  };
  const result = await reasoner.reasonAboutRecipe({ geminiClient: client, brief: 'x', sceneCandidates: SAMPLE_CANDIDATES });
  assert.equal(result.status, 'needs_review');
});

test('reasonAboutRecipe acepta sceneId null (ninguna escena calza)', async () => {
  const client = {
    async generateAnthropicCompatible() {
      return textResponse({
        level: 'completo', energy: 'fiesta', hasCompanion: true,
        sceneId: null, sceneReason: '', reasoning: 'ninguna escena calzaba bien'
      });
    }
  };
  const result = await reasoner.reasonAboutRecipe({ geminiClient: client, brief: 'x', sceneCandidates: SAMPLE_CANDIDATES });
  assert.equal(result.status, 'ok');
  assert.equal(result.scene, null);
});

test('reasonAboutRecipe marca needs_review si level/energy no son valores válidos', async () => {
  const client = {
    async generateAnthropicCompatible() {
      return textResponse({ level: 'medio', energy: 'triste', hasCompanion: false, sceneId: null, reasoning: 'x' });
    }
  };
  const result = await reasoner.reasonAboutRecipe({ geminiClient: client, brief: 'x', sceneCandidates: SAMPLE_CANDIDATES });
  assert.equal(result.status, 'needs_review');
});

test('reasonAboutRecipe se recupera si el segundo intento sí trae un sceneId válido', async () => {
  let callCount = 0;
  const client = {
    async generateAnthropicCompatible() {
      callCount += 1;
      const sceneId = callCount === 1 ? 'SCENE_FAKE' : 'SCENE_REAL_2';
      return textResponse({ level: 'corto', energy: 'elegante', hasCompanion: false, sceneId, reasoning: 'x' });
    }
  };
  const result = await reasoner.reasonAboutRecipe({ geminiClient: client, brief: 'x', sceneCandidates: SAMPLE_CANDIDATES });
  assert.equal(result.status, 'ok');
  assert.equal(callCount, 2);
});
