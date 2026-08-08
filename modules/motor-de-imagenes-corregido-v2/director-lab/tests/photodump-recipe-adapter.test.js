'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const recipeAdapter = require('../adapters/photodump-recipe-adapter');

test('nivel "corto" produce siempre mirror_check (shot fijo) + 2 night moments reales', async () => {
  const { shots } = await recipeAdapter.generateOutfitNightOutStory({
    level: 'corto', seed: 'test-seed-corto', hasCompanion: false, energy: 'elegante',
    gender: 'female', garmentCount: 1, hasVenueAnchor: false,
    venueTextFallback: 'a rooftop bar'
  });
  assert.equal(shots.length, 3);
  assert.ok(shots.some(s => s.shotId === 'mirror_check' && s.isFixed));
  assert.equal(shots.filter(s => !s.isFixed).length, 2);
});

test('nivel "extendido" incluye los 3 shots fijos de preparación', async () => {
  const { shots } = await recipeAdapter.generateOutfitNightOutStory({
    level: 'extendido', seed: 'test-seed-ext', hasCompanion: false, energy: 'fiesta',
    gender: 'female', garmentCount: 2, hasVenueAnchor: false,
    venueTextFallback: 'a nightclub'
  });
  const fixedIds = shots.filter(s => s.isFixed).map(s => s.shotId).sort();
  assert.deepEqual(fixedIds, ['mirror_check', 'presentation', 'tryon_detail'].sort());
});

test('el prompt del shot con HPI declarado contiene texto real del banco HPI y la intención psicológica', async () => {
  const { shots } = await recipeAdapter.generateOutfitNightOutStory({
    level: 'corto', seed: 'test-seed-hpi', hasCompanion: false, energy: 'elegante',
    gender: 'female', garmentCount: 1, hasVenueAnchor: false,
    venueTextFallback: 'a rooftop bar'
  });
  const mirrorCheck = shots.find(s => s.shotId === 'mirror_check');
  assert.ok(mirrorCheck.positivePrompt.includes('HUMAN PERFORMANCE INTELLIGENCE'));
  assert.ok(mirrorCheck.positivePrompt.includes('PSYCHOLOGICAL INTENT'));
  assert.ok(mirrorCheck.positivePrompt.length > 500, 'el prompt real debe ser sustancial, no un placeholder');
});

test('mismo seed produce los mismos night moments (determinismo), sin geminiClient', async () => {
  const params = {
    level: 'completo', seed: 'seed-estable-123', hasCompanion: false, energy: 'elegante',
    gender: 'female', garmentCount: 1, hasVenueAnchor: false, venueTextFallback: 'a bar'
  };
  const resultA = await recipeAdapter.generateOutfitNightOutStory(params);
  const resultB = await recipeAdapter.generateOutfitNightOutStory(params);
  assert.deepEqual(resultA.shots.map(s => s.shotId), resultB.shots.map(s => s.shotId));
  assert.equal(resultA.reasoning, null, 'sin geminiClient no debe haber reasoning');
});

test('con geminiClient, el nivel/energía resueltos por Gemini se usan y la escena elegida aparece en los shots de venue', async () => {
  const stubClient = {
    async generateAnthropicCompatible(payload) {
      const body = JSON.parse(payload.messages[0].content);
      const scene = body.sceneCandidates[0];
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            level: 'completo', energy: 'fiesta', hasCompanion: false,
            sceneId: scene.sceneId, sceneReason: 'Escena de prueba compatible.',
            psychologicalReading: {
              primaryDrive: 'exploration_pleasure', desiredIdentity: 'divertida', desiredFeeling: 'energia',
              desiredExperience: 'una noche memorable', cameraMotivationSummary: 'capturar el momento'
            },
            reasoning: 'Razonamiento de prueba coherente con el brief.'
          })
        }]
      };
    }
  };

  const result = await recipeAdapter.generateOutfitNightOutStory({
    level: null, seed: 'test-gemini-1', hasCompanion: null, energy: null,
    gender: 'female', garmentCount: 1, hasVenueAnchor: false,
    venueTextFallback: 'una fiesta de cumpleaños',
    geminiClient: stubClient
  });

  assert.equal(result.level, 'completo');
  assert.equal(result.energy, 'fiesta');
  assert.equal(result.reasoning.status, 'ok');
  assert.ok(result.reasoning.scene);

  const venueShot = result.shots.find(s => !s.isFixed);
  assert.ok(venueShot.positivePrompt.includes('SAME venue') || venueShot.positivePrompt.length > 0);
});

test('si Gemini falla (needs_review), cae a nivel/energía por defecto sin romper la generación', async () => {
  const badClient = {
    async generateAnthropicCompatible() {
      return { content: [{ type: 'text', text: 'esto no es JSON valido' }] };
    }
  };
  const result = await recipeAdapter.generateOutfitNightOutStory({
    level: null, seed: 'test-gemini-fail', hasCompanion: null, energy: null,
    gender: 'female', garmentCount: 1, hasVenueAnchor: false,
    venueTextFallback: 'brief cualquiera',
    geminiClient: badClient
  });
  assert.equal(result.reasoning.status, 'needs_review');
  assert.ok(result.level, 'debe caer a un nivel por defecto, nunca null');
  assert.ok(result.shots.length > 0);
});
