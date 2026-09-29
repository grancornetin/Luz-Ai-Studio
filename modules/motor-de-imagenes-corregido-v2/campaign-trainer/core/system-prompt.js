const fs = require('fs');
const path = require('path');

const PROMPT_PATH = path.join(__dirname, 'system-prompt.txt');

let cached = null;

function getSystemPrompt() {
  if (cached) return cached;
  cached = fs.readFileSync(PROMPT_PATH, 'utf8');
  return cached;
}

module.exports = { getSystemPrompt };
