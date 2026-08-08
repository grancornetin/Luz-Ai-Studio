'use strict';

// Envuelve el contrato REAL de la receta outfit_night_out de Photodump
// (compilado desde src/modules/photodump/recipes/outfitNightOut/ vía
// scripts/build-vendor.js). No reimplementa shots, HPI ni reglas — solo
// llama a las funciones reales tal cual funcionan en producción.
//
// v3: si se provee geminiClient, un paso previo de razonamiento (ver
// core/gemini-recipe-reasoner.js) interpreta el brief libre con el marco de
// psicología de Photodump y elige una escena real del Scene Bank cuando no
// hay foto de referencia. Pose/gesto/HPI NUNCA pasan por Gemini — siguen
// viniendo de los contratos ya validados a mano.

const levelResolver = require('../vendor/src/modules/photodump/recipes/outfitNightOut/levelResolver.js');
const intelligenceLayer = require('../vendor/src/modules/photodump/recipes/outfitNightOut/intelligenceLayer.js');
const promptBuilder = require('../vendor/src/modules/photodump/recipes/outfitNightOut/promptBuilder.js');
const hpiService = require('../vendor/src/services/hpiService.js');
const geminiRecipeReasoner = require('../core/gemini-recipe-reasoner');
const psychologyContext = require('../core/psychology-context');
const bankRegistry = require('../core/bank-registry');

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

function psychologyLine(shotId) {
  const intent = psychologyContext.getPsychologicalIntent(shotId);
  if (!intent) return '';
  return (
    `PSYCHOLOGICAL INTENT (why this photo exists): ${intent.cameraMotivation} ` +
    `Desired identity: ${intent.desiredIdentity.join(', ')}. Desired feeling: ${intent.desiredFeeling.join(', ')}. ` +
    `Primary drive: ${intent.primaryDrive}.`
  );
}

function shuffleDeterministic(list, seedText) {
  // Mezcla determinística simple para no enviarle a Gemini siempre las
  // mismas primeras N escenas del JSON en el mismo orden.
  let seed = 0;
  for (let i = 0; i < seedText.length; i += 1) seed = (seed * 31 + seedText.charCodeAt(i)) >>> 0;
  return [...list].sort((a, b) => {
    const ha = (seed ^ hashString(a.sourceId)) >>> 0;
    const hb = (seed ^ hashString(b.sourceId)) >>> 0;
    return ha - hb;
  });
}

function hashString(text) {
  let h = 0;
  for (let i = 0; i < text.length; i += 1) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return h;
}

async function resolveSceneCandidates(brief) {
  // No se filtra por coincidencia de texto: el brief es lenguaje natural
  // libre ("night out en un rooftop en Manhattan"), no va a calzar con la
  // descripción literal de una escena. Se le entrega a Gemini un pool amplio
  // de escenas elegibles (ya filtradas por capacidad física real) y que él
  // razone cuál sirve mejor — para eso está el paso de razonamiento.
  const eligible = bankRegistry.searchBank('scene_bank', {}, {})
    .filter(candidate => candidate.capabilities && candidate.capabilities.supportsFullBody === 'yes');
  return shuffleDeterministic(eligible, brief || '').slice(0, 15);
}

async function reasonWithGemini({ geminiClient, brief }) {
  const sceneCandidates = await resolveSceneCandidates(brief);
  return geminiRecipeReasoner.reasonAboutRecipe({ geminiClient, brief, sceneCandidates });
}

async function generateOutfitNightOutStory({
  level, seed, hasCompanion, energy, gender, garmentCount, hasVenueAnchor, venueImageUrl, venueTextFallback,
  geminiClient
}) {
  await ensureHpiReady();

  let reasoning = null;
  let resolvedLevel = level;
  let resolvedEnergy = energy;
  let resolvedHasCompanion = hasCompanion;
  let resolvedVenueText = venueTextFallback;
  let resolvedVenueImageUrl = venueImageUrl;
  let resolvedHasVenueAnchor = hasVenueAnchor;

  if (geminiClient) {
    reasoning = await reasonWithGemini({ geminiClient, brief: venueTextFallback });
    if (reasoning.status === 'ok') {
      resolvedLevel = level || reasoning.level;
      resolvedEnergy = energy || reasoning.energy;
      resolvedHasCompanion = hasCompanion || reasoning.hasCompanion;
      if (!hasVenueAnchor && reasoning.scene) {
        resolvedVenueText = reasoning.scene.sourceText;
        resolvedHasVenueAnchor = true;
      }
    }
  }

  // Si no se eligió nivel explícitamente y Gemini no pudo resolverlo
  // (needs_review o sin geminiClient), cae a un default determinístico —
  // nunca se llama a resolveShotsForLevel con null.
  resolvedLevel = resolvedLevel || 'corto';
  resolvedEnergy = resolvedEnergy || 'elegante';
  resolvedHasCompanion = !!resolvedHasCompanion;

  const resolvedShots = levelResolver.resolveShotsForLevel(resolvedLevel, seed, resolvedHasCompanion, resolvedEnergy);

  const shots = [];
  for (const resolvedShot of resolvedShots) {
    const shotId = shotIdOf(resolvedShot);
    const contract = contractOf(resolvedShot);
    // Reusa tal cual la capa de inteligencia real de Photodump — ya llama a
    // buildHpiBlock/getHpiNegatives internamente con los IDs fijos del contrato.
    const intelligence = intelligenceLayer.applyIntelligence(contract, gender);
    const built = promptBuilder.buildShotPrompt(shotId, intelligence, {
      garmentCount, hasVenueAnchor: resolvedHasVenueAnchor, hasCompanion: resolvedHasCompanion,
      venueImageUrl: resolvedVenueImageUrl, venueTextFallback: resolvedVenueText, energy: resolvedEnergy
    });

    const psychLine = psychologyLine(shotId);
    const positivePrompt = psychLine ? `${built.prompt}\n\n${psychLine}` : built.prompt;

    shots.push({
      shotId,
      label: SHOT_LABELS[shotId] || shotId,
      isFixed: !!resolvedShot.fixedContract,
      contract,
      positivePrompt,
      negativePrompt: built.negative
    });
  }

  return { shots, reasoning, level: resolvedLevel, energy: resolvedEnergy };
}

module.exports = { generateOutfitNightOutStory, SHOT_LABELS };
