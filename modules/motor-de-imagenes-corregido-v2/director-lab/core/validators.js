'use strict';

const ruleEngine = require('./rule-engine');

function validateNoLocomotion(prompt) {
  const rule = ruleEngine.RULE_NO_LOCOMOTION;
  const matches = rule.patterns.filter(pattern => pattern.test(prompt));
  if (matches.length === 0) {
    return { validatorId: 'validateNoLocomotion', ruleId: rule.ruleId, passed: true, warnings: [], blocks: [] };
  }
  return {
    validatorId: 'validateNoLocomotion',
    ruleId: rule.ruleId,
    passed: false,
    warnings: [],
    blocks: [`El prompt contiene lenguaje de locomoción prohibido: ${matches.map(m => m.source).join(', ')}`]
  };
}

function validateStaticPoseEligibility(selectedPoseCandidate, poseCandidatePool) {
  const rule = ruleEngine.RULE_HPI_ACTIVE_USE;
  if (!selectedPoseCandidate) {
    return { validatorId: 'validateStaticPoseEligibility', ruleId: rule.ruleId, passed: true, warnings: [], blocks: [] };
  }
  const text = selectedPoseCandidate.sourceText || '';
  const isFlat = rule.flatPosePatterns.some(pattern => pattern.test(text)) ||
    (selectedPoseCandidate.tags || []).includes('flat_pose');
  if (!isFlat) {
    return { validatorId: 'validateStaticPoseEligibility', ruleId: rule.ruleId, passed: true, warnings: [], blocks: [] };
  }
  const moreExpressiveAvailable = (poseCandidatePool || []).some(candidate =>
    candidate.sourceId !== selectedPoseCandidate.sourceId &&
    !(candidate.tags || []).includes('flat_pose') &&
    (candidate.confidence || 0) >= (selectedPoseCandidate.confidence || 0) - 15
  );
  if (!moreExpressiveAvailable) {
    return { validatorId: 'validateStaticPoseEligibility', ruleId: rule.ruleId, passed: true, warnings: [], blocks: [] };
  }
  return {
    validatorId: 'validateStaticPoseEligibility',
    ruleId: rule.ruleId,
    passed: true,
    warnings: [
      `Pose plana seleccionada (${selectedPoseCandidate.sourceId}) existiendo candidatos HPI elegibles más expresivos en el pool.`
    ],
    blocks: []
  };
}

function validateFlashSkin(prompt) {
  const rule = ruleEngine.RULE_FLASH_IPHONE;
  const lower = prompt.toLowerCase();
  const matches = rule.forbiddenTerms.filter(term => lower.includes(term.toLowerCase()));
  if (matches.length === 0) {
    return { validatorId: 'validateFlashSkin', ruleId: rule.ruleId, passed: true, warnings: [], blocks: [] };
  }
  return {
    validatorId: 'validateFlashSkin',
    ruleId: rule.ruleId,
    passed: false,
    warnings: [],
    blocks: [`El prompt contiene términos prohibidos de flash/piel/óptica: ${matches.join(', ')}`]
  };
}

function validateReferenceDomainContamination(references, promptFragmentsByReference) {
  const rule = ruleEngine.RULE_REFERENCE_ROLE_ISOLATION;
  const blocks = [];
  (references || []).forEach(reference => {
    const forbiddenTerms = rule.crossContaminationForbiddenFor[reference.role];
    if (!forbiddenTerms) return;
    const fragment = (promptFragmentsByReference && promptFragmentsByReference[reference.referenceId]) || '';
    const lower = fragment.toLowerCase();
    const hits = forbiddenTerms.filter(term => lower.includes(term.toLowerCase()));
    if (hits.length > 0) {
      blocks.push(
        `La referencia ${reference.alias || reference.referenceId} (rol ${reference.role}) contamina dominios ajenos: ${hits.join(', ')}`
      );
    }
  });
  return {
    validatorId: 'validateReferenceDomainContamination',
    ruleId: rule.ruleId,
    passed: blocks.length === 0,
    warnings: [],
    blocks
  };
}

function runAllValidators({ positivePrompt, selections, candidatesByDomain, references, promptFragmentsByReference }) {
  const results = [
    validateNoLocomotion(positivePrompt),
    validateStaticPoseEligibility(selections.pose, candidatesByDomain.pose),
    validateFlashSkin(positivePrompt),
    validateReferenceDomainContamination(references, promptFragmentsByReference)
  ];
  const allWarnings = results.flatMap(result => result.warnings);
  const allBlocks = results.flatMap(result => result.blocks);
  return {
    results,
    warnings: allWarnings,
    blocks: allBlocks,
    passed: allBlocks.length === 0
  };
}

module.exports = {
  validateNoLocomotion,
  validateStaticPoseEligibility,
  validateFlashSkin,
  validateReferenceDomainContamination,
  runAllValidators
};
