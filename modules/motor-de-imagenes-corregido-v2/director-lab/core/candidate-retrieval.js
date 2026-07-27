'use strict';

const bankRegistry = require('./bank-registry');

// Dado un brief interpretado, arma pools de candidatos elegibles por dominio.
// Todo lo que pasa por acá es JS puro sobre datos en disco — sin IA involucrada.
// Cada rechazo por elegibilidad (status no elegible) queda registrado para el trace.
//
// Nota (Director Lab v2): pose/gesture/expression YA NO se consultan acá.
// Las recetas reales de Photodump (ver adapters/photodump-recipe-adapter.js)
// declaran hpiPoseFamily/hpiCameraFamily fijos por contrato validado a mano
// — no eligen entre candidatos vía Gemini. Este módulo genérico (usado por
// director-core.js/runDirector, el flujo v1) solo sigue resolviendo escena y
// reglas de director, los dos dominios donde Gemini elige libremente en v2.

function retrieveSceneCandidates(brief) {
  return bankRegistry.searchBank('scene_bank', { text: brief.desiredLocation || '' }, {});
}

function retrieveDirectorRuleCandidates() {
  return bankRegistry.searchBank('director_rules_ugc', {}, {});
}

function retrieveAll(brief) {
  return {
    scene: retrieveSceneCandidates(brief),
    directorRules: retrieveDirectorRuleCandidates()
  };
}

function collectRejectedByEligibility(domain) {
  // Recorre el banco completo (sin filtro de elegibilidad) y separa los que
  // isEligible() habría excluido, para mostrar "descartados y motivo" en el trace.
  const bankId = domain === 'scene' ? 'scene_bank' : null;
  const bank = bankId ? bankRegistry.BANKS[bankId] : null;
  if (!bank) return [];
  const eligible = new Set(bank.search({}, {}).map(candidate => candidate.sourceId));
  const all = bank.search({}, { allowPendingReview: true });
  return all
    .filter(candidate => !eligible.has(candidate.sourceId))
    .map(candidate => ({
      domain,
      sourceBank: candidate.sourceBank,
      sourceId: candidate.sourceId,
      reason: `curationStatus=${candidate.curationStatus} no es elegible por defecto (requiere approved o strongReference).`
    }));
}

module.exports = {
  retrieveAll,
  retrieveSceneCandidates,
  retrieveDirectorRuleCandidates,
  collectRejectedByEligibility
};
