'use strict';

const DOMAINS = ['pose', 'gesture', 'expression', 'scene', 'captureMechanism'];

const REFERENCE_ROLES = [
  'identity', 'body', 'outfit', 'product', 'scene', 'accessory', 'auxiliary'
];

const CURATION_STATUSES = ['strong_reference', 'approved', 'pending_review', 'rejected'];

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function fail(stage, cause) {
  const err = new Error(cause);
  err.stage = stage;
  err.cause = cause;
  return err;
}

function validateDirectorInput(input) {
  if (!input || typeof input !== 'object') {
    throw fail('input_validation', 'El input de director-core debe ser un objeto.');
  }
  if (!isNonEmptyString(input.projectId)) throw fail('input_validation', 'Falta projectId.');
  if (!isNonEmptyString(input.recipeId)) throw fail('input_validation', 'Falta recipeId.');
  if (!isNonEmptyString(input.shotId)) throw fail('input_validation', 'Falta shotId.');
  if (!input.brief || typeof input.brief !== 'object') {
    throw fail('input_validation', 'Falta brief estructurado.');
  }
  const references = Array.isArray(input.references) ? input.references : [];
  references.forEach((ref, index) => {
    if (!isNonEmptyString(ref.referenceId)) {
      throw fail('input_validation', `Referencia #${index} sin referenceId.`);
    }
    if (!REFERENCE_ROLES.includes(ref.role)) {
      throw fail('input_validation', `Referencia ${ref.referenceId} tiene rol inválido: ${ref.role}`);
    }
  });
  return true;
}

function validateDirectorOutput(output) {
  if (!output || typeof output !== 'object') {
    throw fail('output_validation', 'La salida de director-core debe ser un objeto.');
  }
  if (!['ready', 'blocked', 'needs_review'].includes(output.status)) {
    throw fail('output_validation', `status inválido: ${output.status}`);
  }
  if (!output.candidates || typeof output.candidates !== 'object') {
    throw fail('output_validation', 'Falta candidates por dominio.');
  }
  if (!output.selections || typeof output.selections !== 'object') {
    throw fail('output_validation', 'Falta selections por dominio.');
  }
  if (!isNonEmptyString(output.positivePrompt) && output.status === 'ready') {
    throw fail('output_validation', 'Un run "ready" debe tener positivePrompt.');
  }
  return true;
}

module.exports = {
  DOMAINS,
  REFERENCE_ROLES,
  CURATION_STATUSES,
  validateDirectorInput,
  validateDirectorOutput,
  fail
};
