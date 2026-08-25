// Carga los dos prompts maestros (validados manualmente por el usuario en
// tools/Pose library/promps maestros.txt) tal cual desde disco, sin tocar
// una palabra de su contenido. Cache en memoria tras la primera lectura —
// mismo patrón que photodump-trainer/core/system-prompt.js.

const fs = require('fs');
const path = require('path');

const POSE_PROMPT_PATH = path.join(__dirname, '..', 'prompts', 'pose-intent-transfer-proxy.txt');
const EXPRESSION_PROMPT_PATH = path.join(__dirname, '..', 'prompts', 'facial-expression-transfer-proxy.txt');

let posePromptCache = null;
let expressionPromptCache = null;

function getPosePrompt() {
  if (posePromptCache) return posePromptCache;
  posePromptCache = fs.readFileSync(POSE_PROMPT_PATH, 'utf8');
  return posePromptCache;
}

function getExpressionPrompt() {
  if (expressionPromptCache) return expressionPromptCache;
  expressionPromptCache = fs.readFileSync(EXPRESSION_PROMPT_PATH, 'utf8');
  return expressionPromptCache;
}

module.exports = { getPosePrompt, getExpressionPrompt };
