'use strict';

const projects = require('../persistence/projects');
const recipes = require('../persistence/recipes');
const cases = require('../persistence/cases');

const PROJECT_NAME = 'Photodump Director Validation';
const RECIPE_NAME = 'Outfit-check for night out';
const CASE_NAME = 'T5-B — pausa junto a la entrada';

const T5B_BRIEF = {
  testName: 'T5-B',
  recipeName: RECIPE_NAME,
  shotName: 'pausa junto a la entrada',
  narrativeGoal:
    'La protagonista ya llegó y está completamente detenida en una pausa junto a la entrada de un lugar nocturno.',
  photodumpStage: 'arrival',
  contentType: 'friend_photo',
  desiredLocation: 'entrance',
  timeOfDay: 'night',
  captureMechanism: 'friend_photo',
  desiredFraming: 'three_quarter_or_full_body',
  requiredReferenceRoles: ['identity', 'body', 'outfit'],
  constraintsFreeText:
    'Cero locomoción. Pose estática expresiva con asimetría visible. Interacción con pared, marco, baranda o ' +
    'peldaño bajo. Ambos pies físicamente estables. No pose frontal neutra con brazos caídos. No pies juntos ' +
    'con cuerpo simétrico. No campaña street style. No paparazzi. Luz ambiental principal, flash ausente o ' +
    'restringido. Piel con tono natural. Apariencia de iPhone, no de cámara profesional.',
  evaluatorNotes: '',
  freeformBrief:
    'Una fotografía vertical contemporánea de iPhone tomada por una amiga durante una pausa junto a la entrada ' +
    'de un lugar nocturno. La protagonista ya llegó y está completamente detenida. Debe verse aproximadamente ' +
    'de tres cuartos o cuerpo entero, con el outfit legible, en un lugar atractivo pero alcanzable.'
};

const T5B_REFERENCES = [
  { role: 'identity', alias: '@pia', notes: 'Identidad facial, piel y cabello.' },
  { role: 'body', alias: '@pia-body', notes: 'Cuerpo y proporciones.' },
  { role: 'outfit', alias: '@outfit-night-001', notes: 'Outfit solamente.' }
];

function ensureSeeded() {
  const existingProject = projects.list().find(project => project.name === PROJECT_NAME);
  const project = existingProject || projects.create({ name: PROJECT_NAME, description: 'Proyecto de validación del Director para Photodump.' });

  const existingRecipe = recipes.list().find(recipe => recipe.projectId === project.id && recipe.name === RECIPE_NAME);
  const recipe = existingRecipe || recipes.create({ projectId: project.id, name: RECIPE_NAME });

  const existingCase = cases.list().find(caseItem => caseItem.recipeId === recipe.id && caseItem.name === CASE_NAME);
  const caseRecord = existingCase || cases.create({
    projectId: project.id,
    recipeId: recipe.id,
    name: CASE_NAME,
    brief: T5B_BRIEF,
    referencesSeed: T5B_REFERENCES,
    acceptanceNotes:
      'Ver Director_Lab_MVP_Brief_Claude.md sección 6. Referencias @pia/@pia-body/@outfit-night-001 son ' +
      'placeholders sin binario real hasta que el desarrollador suba las fotos correspondientes vía UI.'
  });

  return { project, recipe, case: caseRecord };
}

module.exports = { ensureSeeded, PROJECT_NAME, RECIPE_NAME, CASE_NAME, T5B_BRIEF, T5B_REFERENCES };
