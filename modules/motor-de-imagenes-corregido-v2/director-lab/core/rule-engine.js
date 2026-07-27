'use strict';

// Reglas creativas versionadas del Photodump Director (brief sección 5).
// Se guardan como datos, no escondidas dentro de un prompt gigante, para que
// el trace pueda referenciar ruleId y el equipo pueda editar sin tocar lógica.

const RULES_VERSION = 'photodump-rules-0.1.0';

const LOCOMOTION_PATTERNS = [
  /\bwalking\b/i, /\brunning\b/i, /\bmid[- ]?stride\b/i, /\bstriding\b/i,
  /\bzancada\b/i, /\bpie suspendido\b/i, /\bcaminando\b/i, /\bcorriendo\b/i,
  /\bwalking away\b/i, /\bin motion\b/i, /\bswinging arms\b/i, /\bhair blowing\b/i,
  /\bwind[- ]?blown\b/i, /\bpaparazzi\b/i, /\brunway\b/i, /\bcatwalk\b/i,
  /\bheel(?:s)? lifted\b/i, /\bstep(?:ping)? forward\b/i, /\bturning while walking\b/i
];

const RULE_NO_LOCOMOTION = {
  ruleId: 'RULE_NO_LOCOMOTION',
  version: RULES_VERSION,
  domain: 'pose',
  description:
    'La protagonista jamás debe aparecer caminando, corriendo, avanzando, girando en movimiento ' +
    'ni congelada entre pasos. Toda fotografía se toma con el cuerpo quieto o momentáneamente detenido. ' +
    'Se prohíbe locomoción, no dinamismo corporal.',
  patterns: LOCOMOTION_PATTERNS
};

const FLAT_POSE_PATTERNS = [
  /frontal.*(arms?|brazos).*(down|abajo)/i,
  /standing.*(feet together|pies juntos)/i,
  /symmetric(al)?\s+posture/i,
  /\bfrontal[,\s]+brazos\s+abajo\b/i
];

const RULE_HPI_ACTIVE_USE = {
  ruleId: 'RULE_HPI_ACTIVE_USE',
  version: RULES_VERSION,
  domain: 'pose',
  description:
    'Cuando la pose sea visible, se debe consultar HPI realmente, exigir asimetría corporal visible ' +
    'salvo justificación narrativa, y evitar por defecto "de pie, frontal, brazos abajo". Una pose plana ' +
    'debe disparar una advertencia si existen candidatos HPI elegibles más expresivos.',
  flatPosePatterns: FLAT_POSE_PATTERNS
};

const FLASH_SKIN_FORBIDDEN_TERMS = [
  'plastic skin', 'whitened skin', 'bleached skin', 'uniform lighting',
  'professional bokeh', 'optical bokeh', 'compact camera look', 'heavy film grain',
  'piel blanqueada', 'flash excesivo', 'harsh flash', 'overexposed skin'
];

const RULE_FLASH_IPHONE = {
  ruleId: 'RULE_FLASH_IPHONE',
  version: RULES_VERSION,
  domain: 'lighting',
  description:
    'Prioriza luz ambiental. El flash de teléfono, si existe, debe ser débil o moderado y de caída rápida. ' +
    'Nunca debe blanquear piel ni iluminar uniformemente todo el cuerpo. Evita convertir "iPhone" en grano ' +
    'analógico, bokeh óptico fuerte o cámara compacta profesional.',
  forbiddenTerms: FLASH_SKIN_FORBIDDEN_TERMS
};

const CAPTURE_MECHANISMS = [
  'mirror_selfie', 'front_selfie', 'friend_photo', 'propped_timed_photo',
  'pov', 'found_detail', 'other_approved'
];

const RULE_CAPTURE_MECHANISM_VARIETY = {
  ruleId: 'RULE_CAPTURE_MECHANISM_VARIETY',
  version: RULES_VERSION,
  domain: 'captureMechanism',
  description:
    'El Director debe elegir conscientemente el mecanismo de captura entre las opciones aprobadas. ' +
    'No existe prohibición global de mirror selfies en baños; debe evitarse la repetición innecesaria ' +
    'dentro del mismo Photodump, no el recurso en sí.',
  allowedMechanisms: CAPTURE_MECHANISMS
};

const REFERENCE_ROLE_DOMAIN_TERMS = {
  identity: ['face', 'rostro', 'skin tone', 'hair', 'cabello', 'facial features'],
  body: ['silhouette', 'body proportions', 'figure', 'cuerpo', 'proporciones'],
  outfit: ['garment', 'fabric', 'prenda', 'outfit', 'clothing', 'material', 'fit', 'color'],
  product: ['product', 'packaging', 'producto', 'empaque', 'label'],
  scene: ['location', 'space', 'espacio', 'architecture', 'room'],
  accessory: ['accessory', 'jewelry', 'accesorio', 'bag', 'shoes'],
  auxiliary: []
};

const RULE_REFERENCE_ROLE_ISOLATION = {
  ruleId: 'RULE_REFERENCE_ROLE_ISOLATION',
  version: RULES_VERSION,
  domain: 'reference',
  description:
    'Cada referencia solo aporta su dominio. No heredar modelo, pose, expresión, cuerpo, identidad, ' +
    'iluminación o composición desde una referencia de outfit u otro rol ajeno.',
  domainTerms: REFERENCE_ROLE_DOMAIN_TERMS,
  // Términos que NUNCA deben originarse de una referencia que no sea de identidad/cuerpo/escena.
  crossContaminationForbiddenFor: {
    outfit: ['pose', 'expression', 'face', 'identity', 'lighting', 'composition', 'background'],
    product: ['pose', 'expression', 'face', 'identity', 'lighting', 'composition'],
    accessory: ['pose', 'expression', 'face', 'identity', 'lighting', 'composition']
  }
};

const ALL_RULES = [
  RULE_NO_LOCOMOTION,
  RULE_HPI_ACTIVE_USE,
  RULE_FLASH_IPHONE,
  RULE_CAPTURE_MECHANISM_VARIETY,
  RULE_REFERENCE_ROLE_ISOLATION
];

function getAllRules() {
  return ALL_RULES;
}

function getRule(ruleId) {
  return ALL_RULES.find(rule => rule.ruleId === ruleId) || null;
}

function summarizeForPrompt() {
  return ALL_RULES.map(rule => ({ ruleId: rule.ruleId, domain: rule.domain, description: rule.description }));
}

module.exports = {
  RULES_VERSION,
  RULE_NO_LOCOMOTION,
  RULE_HPI_ACTIVE_USE,
  RULE_FLASH_IPHONE,
  RULE_CAPTURE_MECHANISM_VARIETY,
  RULE_REFERENCE_ROLE_ISOLATION,
  CAPTURE_MECHANISMS,
  getAllRules,
  getRule,
  summarizeForPrompt
};
