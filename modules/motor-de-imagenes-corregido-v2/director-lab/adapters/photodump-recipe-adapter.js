'use strict';

// Envuelve el contrato REAL de la receta outfit_night_out de Photodump
// (compilado desde src/modules/photodump/recipes/outfitNightOut/ vía
// scripts/build-vendor.js). No reimplementa shots, HPI ni reglas — solo
// llama a las funciones reales tal cual funcionan en producción.

const levelResolver = require('../vendor/src/modules/photodump/recipes/outfitNightOut/levelResolver.js');
const intelligenceLayer = require('../vendor/src/modules/photodump/recipes/outfitNightOut/intelligenceLayer.js');
const promptBuilder = require('../vendor/src/modules/photodump/recipes/outfitNightOut/promptBuilder.js');
const hpiService = require('../vendor/src/services/hpiService.js');

let hpiReadyPromise = null;
function ensureHpiReady() {
  if (!hpiReadyPromise) {
    hpiService.initHpiService();
    hpiReadyPromise = new Promise(resolve => setTimeout(resolve, 300));
  }
  return hpiReadyPromise;
}

const SHOT_LABELS = {
  presentation: 'Sosteniendo el outfit antes de ponérselo',
  tryon_detail: 'Detalle de un ajuste real (cierre, tirante, zapato)',
  mirror_check: 'Espejo de cuerpo completo con el look puesto',
  posed_portrait: 'Retrato posado en el lugar',
  group_moment: 'Momento en grupo',
  motion_energy: 'Movimiento / energía de la noche',
  pov_legs: 'POV mirando hacia abajo',
  ambient_only: 'Plano ambiental del lugar',
  car_transition: 'Transición en el auto'
};

function shotIdOf(resolvedShot) {
  return resolvedShot.fixedContract ? resolvedShot.fixedContract.shotId : resolvedShot.nightMoment.id;
}

function contractOf(resolvedShot) {
  return resolvedShot.fixedContract || resolvedShot.nightMoment.contract;
}

function sceneBlockOf(resolvedShot, energy) {
  if (resolvedShot.nightMoment) {
    return resolvedShot.nightMoment.sceneBlockByEnergy[energy] || resolvedShot.nightMoment.sceneBlockByEnergy.elegante || '';
  }
  return null; // los shots fijos arman su propio sceneBlock dentro de promptBuilder
}

async function generateOutfitNightOutStory({ level, seed, hasCompanion, energy, gender, garmentCount, hasVenueAnchor, venueImageUrl, venueTextFallback, noteInjector }) {
  await ensureHpiReady();
  const resolvedShots = levelResolver.resolveShotsForLevel(level, seed, hasCompanion, energy);

  const shots = [];
  for (const resolvedShot of resolvedShots) {
    const shotId = shotIdOf(resolvedShot);
    const contract = contractOf(resolvedShot);
    // Reusa tal cual la capa de inteligencia real de Photodump — ya llama a
    // buildHpiBlock/getHpiNegatives internamente con los IDs fijos del contrato.
    const intelligence = intelligenceLayer.applyIntelligence(contract, gender);
    const built = promptBuilder.buildShotPrompt(shotId, intelligence, {
      garmentCount, hasVenueAnchor, hasCompanion, venueImageUrl, venueTextFallback, energy
    });

    const extraNote = noteInjector ? await noteInjector(shotId) : null;
    const positivePrompt = extraNote ? `${built.prompt}\n\nNOTA DEL USUARIO (tener en cuenta): "${extraNote}"` : built.prompt;

    shots.push({
      shotId,
      label: SHOT_LABELS[shotId] || shotId,
      isFixed: !!resolvedShot.fixedContract,
      contract,
      positivePrompt,
      negativePrompt: built.negative
    });
  }
  return shots;
}

module.exports = { generateOutfitNightOutStory, SHOT_LABELS };
