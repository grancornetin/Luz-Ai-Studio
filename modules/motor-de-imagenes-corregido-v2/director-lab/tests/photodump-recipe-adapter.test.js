'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const recipeAdapter = require('../adapters/photodump-recipe-adapter');

test('nivel "corto" produce siempre mirror_check (shot fijo) + 2 night moments reales', async () => {
  const shots = await recipeAdapter.generateOutfitNightOutStory({
    level: 'corto', seed: 'test-seed-corto', hasCompanion: false, energy: 'elegante',
    gender: 'female', garmentCount: 1, hasVenueAnchor: false,
    venueTextFallback: 'a rooftop bar'
  });
  assert.equal(shots.length, 3);
  assert.ok(shots.some(s => s.shotId === 'mirror_check' && s.isFixed));
  assert.equal(shots.filter(s => !s.isFixed).length, 2);
});

test('nivel "extendido" incluye los 3 shots fijos de preparación', async () => {
  const shots = await recipeAdapter.generateOutfitNightOutStory({
    level: 'extendido', seed: 'test-seed-ext', hasCompanion: false, energy: 'fiesta',
    gender: 'female', garmentCount: 2, hasVenueAnchor: false,
    venueTextFallback: 'a nightclub'
  });
  const fixedIds = shots.filter(s => s.isFixed).map(s => s.shotId).sort();
  assert.deepEqual(fixedIds, ['mirror_check', 'presentation', 'tryon_detail'].sort());
});

test('el prompt del shot con HPI declarado contiene texto real del banco HPI (no vacío)', async () => {
  const shots = await recipeAdapter.generateOutfitNightOutStory({
    level: 'corto', seed: 'test-seed-hpi', hasCompanion: false, energy: 'elegante',
    gender: 'female', garmentCount: 1, hasVenueAnchor: false,
    venueTextFallback: 'a rooftop bar'
  });
  const mirrorCheck = shots.find(s => s.shotId === 'mirror_check');
  assert.ok(mirrorCheck.positivePrompt.includes('HUMAN PERFORMANCE INTELLIGENCE'));
  assert.ok(mirrorCheck.positivePrompt.length > 500, 'el prompt real debe ser sustancial, no un placeholder');
});

test('mismo seed produce los mismos night moments (determinismo)', async () => {
  const params = {
    level: 'completo', seed: 'seed-estable-123', hasCompanion: false, energy: 'elegante',
    gender: 'female', garmentCount: 1, hasVenueAnchor: false, venueTextFallback: 'a bar'
  };
  const shotsA = await recipeAdapter.generateOutfitNightOutStory(params);
  const shotsB = await recipeAdapter.generateOutfitNightOutStory(params);
  assert.deepEqual(shotsA.map(s => s.shotId), shotsB.map(s => s.shotId));
});
