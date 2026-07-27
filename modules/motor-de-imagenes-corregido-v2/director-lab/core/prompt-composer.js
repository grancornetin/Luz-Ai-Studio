'use strict';

const ruleEngine = require('./rule-engine');
const directorRulesAdapter = require('../adapters/director-rules-adapter');

// Compone el prompt final usando exclusivamente texto proveniente de:
// - candidate.sourceText / scenePromptBlock (bancos reales)
// - alias de referencias asignadas por el usuario
// - narrativeDecision devuelta por Gemini (razón, no descripción visual inventada)
// Nunca inventa descripción visual fuera de estas fuentes.

function referenceClause(reference) {
  const roleLabel = {
    identity: 'identidad facial',
    body: 'cuerpo y proporciones',
    outfit: 'outfit',
    product: 'producto',
    scene: 'escena',
    accessory: 'accesorio',
    auxiliary: 'referencia auxiliar'
  }[reference.role] || reference.role;
  return `${reference.alias || reference.referenceId} (${roleLabel})`;
}

function composePositivePrompt({ brief, selections, references, narrativeDecision }) {
  const parts = [];

  parts.push('Vertical contemporary iPhone photograph, candid UGC photodump style.');

  if (narrativeDecision) parts.push(narrativeDecision);

  const referenceParts = (references || []).map(referenceClause);
  if (referenceParts.length) {
    parts.push(`References: ${referenceParts.join(', ')}.`);
  }

  if (selections.scene && selections.scene.sourceText) {
    parts.push(`Scene: ${selections.scene.sourceText}`);
  }
  if (selections.pose && selections.pose.sourceText) {
    parts.push(`Pose: ${selections.pose.sourceText}`);
  }
  if (selections.gesture && selections.gesture.sourceText) {
    parts.push(`Gesture: ${selections.gesture.sourceText}`);
  }
  if (selections.expression && selections.expression.sourceText) {
    parts.push(`Expression: ${selections.expression.sourceText}`);
  }
  if (selections.captureMechanism && selections.captureMechanism.sourceText) {
    parts.push(`Capture: ${selections.captureMechanism.sourceText}`);
  }

  parts.push(
    'Ambient light as the primary source, natural skin tone, no professional camera artifacts, ' +
    'phone-camera realism with small physically plausible imperfections.'
  );

  return parts.filter(Boolean).join(' ');
}

function composeNegativePrompt({ selections }) {
  const negativeSet = new Set([
    'walking', 'mid-stride', 'running', 'catwalk pose', 'paparazzi motion blur',
    'plastic skin', 'whitened skin', 'uniform lighting', 'professional bokeh',
    'heavy film grain', 'compact camera look', 'overexposed skin', 'extra limbs',
    'deformed hands', 'text', 'watermark', 'brand logo'
  ]);

  const riskLocks = directorRulesAdapter.getRiskLockRules();
  riskLocks.forEach(risk => {
    (risk.negativePromptHints || []).forEach(hint => negativeSet.add(hint));
  });

  if (selections.scene && Array.isArray(selections.scene.contaminationRisks)) {
    selections.scene.contaminationRisks.forEach(risk => negativeSet.add(risk));
  }

  return Array.from(negativeSet).join(', ');
}

function buildPromptFragmentsByReference(references) {
  const fragments = {};
  (references || []).forEach(reference => {
    fragments[reference.referenceId] = referenceClause(reference);
  });
  return fragments;
}

module.exports = { composePositivePrompt, composeNegativePrompt, buildPromptFragmentsByReference, referenceClause };
