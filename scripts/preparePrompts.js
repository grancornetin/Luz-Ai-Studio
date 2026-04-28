/**
 * scripts/preparePrompts.js
 *
 * Convierte trending-prompts.json en prepared-prompts.json
 * listo para POST /api/prompts/batch-import
 *
 * Uso:
 *   node scripts/preparePrompts.js
 *   node scripts/preparePrompts.js --limit=10
 *   node scripts/preparePrompts.js --limit=100 --minLikes=500
 *   node scripts/preparePrompts.js --categories=Product,Photograph,Food
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const cwd       = resolve(__dirname, '..');

const args = process.argv.slice(2);

function getArg(name, fallback) {
  const match = args.find(a => a.startsWith(`--${name}=`));
  if (!match) return fallback;
  return match.split('=').slice(1).join('=');
}

const INPUT_FILE        = getArg('input',      'trending-prompts.json');
const OUTPUT_FILE       = getArg('output',     'prepared-prompts.json');
const LIMIT             = Number(getArg('limit',     '100'));
const MIN_LIKES         = Number(getArg('minLikes',  '0'));
const MIN_LENGTH        = Number(getArg('minLength', '60'));
const CATEGORIES_FILTER = getArg('categories', '')
  .split(',').map(x => x.trim().toLowerCase()).filter(Boolean);

// ── Leer input ────────────────────────────────────────────────────────────────

const inputPath = resolve(cwd, INPUT_FILE);
if (!existsSync(inputPath)) {
  console.error(`✗ No existe el archivo: ${inputPath}`);
  process.exit(1);
}

let data;
try {
  data = JSON.parse(readFileSync(inputPath, 'utf-8'));
} catch (e) {
  console.error(`✗ Error parseando JSON: ${e.message}`);
  process.exit(1);
}

if (!Array.isArray(data)) {
  console.error('✗ trending-prompts.json debe ser un array.');
  process.exit(1);
}

// ── Normalización ─────────────────────────────────────────────────────────────

const PREFERRED_KEYS = [
  'assembled_prompt', 'full_prompt_string', 'full_prompt_text', 'main_prompt',
  'prompt_text', 'prompt', 'image_prompt', 'scene_prompt',
  'description', 'scene_description', 'subject', 'style', 'environment',
  'background', 'lighting', 'composition', 'camera', 'mood', 'quality',
  'outfit', 'attire', 'setting', 'pose', 'visible_body',
  'negative_prompt',
];

const IGNORED_KEYS = new Set([
  'id', 'rank', 'date', 'author', 'author_name', 'model', 'source_url',
  'image', 'images', 'likes', 'views', 'steps', 'cfg_scale', 'batch_size',
  'dialogue', 'audio', 'subtitles', 'version', 'title',
]);

function shouldIgnoreKey(key) {
  return IGNORED_KEYS.has(String(key).toLowerCase());
}

function shouldIgnoreText(text, keyHint = '') {
  const lower = String(text).toLowerCase();
  const key   = String(keyHint).toLowerCase();
  if (lower.length < 3) return true;
  if (key.includes('audio') || key.includes('dialogue')) return true;
  if (lower.includes('all prompts in alt')) return true;
  if (lower.includes('open gemini') && lower.includes('upload')) return true;
  if (lower.includes('follow me') || lower.includes('like and retweet')) return true;
  return false;
}

function cleanFragment(text) {
  return String(text)
    .replace(/\s+/g, ' ')
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    .replace(/ /g, ' ')
    .trim();
}

function walkJson(value, keyHint = '', out = []) {
  if (typeof value === 'string') {
    const cleaned = cleanFragment(value);
    if (!shouldIgnoreText(cleaned, keyHint)) out.push(cleaned);
    return out;
  }
  if (Array.isArray(value)) {
    for (const v of value) walkJson(v, keyHint, out);
    return out;
  }
  if (value && typeof value === 'object') {
    const keys = Object.keys(value).sort((a, b) => {
      const ai = PREFERRED_KEYS.indexOf(a);
      const bi = PREFERRED_KEYS.indexOf(b);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });
    for (const key of keys) {
      if (shouldIgnoreKey(key)) continue;
      walkJson(value[key], key, out);
    }
  }
  return out;
}

function finalizePrompt(prompt) {
  const cleaned = cleanFragment(prompt)
    .replace(/https?:\/\/\S+/g, '')
    .replace(/Gemini Promt\s*[^\w\s]/gi, '')
    .replace(/Step\s*\d\.[^"]{0,200}/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (/no artifacts/i.test(cleaned)) return cleaned;
  return `${cleaned}, ultra detailed, sharp focus, professional lighting, no artifacts, no noise`;
}

function sanitizeJsonString(raw) {
  // Reemplaza comillas tipográficas por comillas estándar para que JSON.parse funcione
  return raw
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'");
}

function extractTextByRegex(raw) {
  // Fallback: extrae todos los valores de string del JSON aunque sea inválido
  const matches = raw.match(/"([^"\\]{20,})"/g) || [];
  return matches
    .map(m => m.slice(1, -1).trim())
    .filter(t => !shouldIgnoreText(t));
}

function normalizePrompt(input) {
  const raw = String(input || '').trim();
  if (!raw) return '';

  if (raw.startsWith('{') || raw.startsWith('[')) {
    // Intento 1: JSON válido directo
    try {
      const parsed = JSON.parse(raw);
      const frags  = walkJson(parsed);
      const deduped = Array.from(new Set(frags.map(cleanFragment))).filter(Boolean);
      if (deduped.length > 0) return finalizePrompt(deduped.join(', '));
    } catch { /* seguir */ }

    // Intento 2: sanear comillas tipográficas y reintentar
    try {
      const parsed = JSON.parse(sanitizeJsonString(raw));
      const frags  = walkJson(parsed);
      const deduped = Array.from(new Set(frags.map(cleanFragment))).filter(Boolean);
      if (deduped.length > 0) return finalizePrompt(deduped.join(', '));
    } catch { /* seguir */ }

    // Intento 3: extracción por regex (JSON malformado)
    const frags  = extractTextByRegex(sanitizeJsonString(raw));
    const deduped = Array.from(new Set(frags.map(cleanFragment))).filter(Boolean);
    if (deduped.length > 0) return finalizePrompt(deduped.join(', '));
  }

  return finalizePrompt(raw);
}

// ── Detección de categoría ────────────────────────────────────────────────────

function detectCategory(item, prompt) {
  const cats = Array.isArray(item.categories)
    ? item.categories.join(' ').toLowerCase() : '';
  const p = `${cats} ${prompt}`.toLowerCase();
  if (/\b(product|bottle|can|packaging|ecommerce|brand|advertising|skincare|snack)\b/.test(p)) return 'product';
  if (/\b(fashion|outfit|dress|editorial|model|lookbook|wardrobe|clothing)\b/.test(p))          return 'fashion';
  if (/\b(food|recipe|cake|chicken|ice cream|dessert|biryani|ingredients|baklava)\b/.test(p))   return 'food';
  if (/\b(portrait|selfie|person|woman|man|girl|face|skin texture|avatar)\b/.test(p))           return 'avatar';
  if (/\b(3d|isometric|diorama|pixar|render|icon)\b/.test(p))                                   return '3d';
  if (/\b(infographic|annotation|diagram|blueprint|technical)\b/.test(p))                       return 'infographic';
  return 'other';
}

// ── Filtros de calidad ────────────────────────────────────────────────────────

// Detecta si el prompt tiene placeholders genéricos sin reemplazar
function hasUnreplacedPlaceholders(prompt) {
  // Detecta placeholders tipo [PERSON NAME], [a theme], [ratio], [OBJECT], etc.
  return /\[([a-z][^\]]{1,40})\]/i.test(prompt);
}

// Detecta prompts que son solo listas negativas (negative_prompt sin subject real)
const NEGATIVE_STARTERS = ['cartoon', 'anime', 'blurry', 'pixelated', 'low quality', 'no blur', 'avoid'];
function isNegativeOnlyPrompt(prompt) {
  const lower  = prompt.toLowerCase().trim();
  const negativeWords = ['blurry', 'pixelated', 'overexposed', 'low quality', 'cartoon', 'anime', 'harsh shadows', 'dull'];
  const hits   = negativeWords.filter(w => lower.includes(w)).length;
  const startsNegative = NEGATIVE_STARTERS.some(s => lower.startsWith(s));
  return (hits >= 4 && lower.length < 600) || (startsNegative && hits >= 2);
}

function isValidItem(item, normalizedPrompt) {
  if (!normalizedPrompt || normalizedPrompt.length < MIN_LENGTH) return false;
  if (Number(item.likes || 0) < MIN_LIKES) return false;
  if (hasUnreplacedPlaceholders(normalizedPrompt)) return false;
  if (isNegativeOnlyPrompt(normalizedPrompt)) return false;
  const p = normalizedPrompt.toLowerCase();
  if (p.includes('open gemini') && p.includes('step 1')) return false;
  if (p.includes('all prompts in alt')) return false;
  if (p.includes('follow me')) return false;
  if (CATEGORIES_FILTER.length > 0) {
    const cats = Array.isArray(item.categories)
      ? item.categories.map(c => String(c).toLowerCase()) : [];
    if (!cats.some(c => CATEGORIES_FILTER.some(f => c.includes(f)))) return false;
  }
  return true;
}

// ── Proceso principal ─────────────────────────────────────────────────────────

const sorted = [...data].sort((a, b) => Number(a.rank || 999999) - Number(b.rank || 999999));
const prepared         = [];
const seenFingerprints = new Set();

for (const item of sorted) {
  if (prepared.length >= LIMIT) break;
  const normalizedPrompt = normalizePrompt(item.prompt);
  if (!isValidItem(item, normalizedPrompt)) continue;
  const fingerprint = normalizedPrompt.toLowerCase().slice(0, 500);
  if (seenFingerprints.has(fingerprint)) continue;
  seenFingerprints.add(fingerprint);

  prepared.push({
    raw:          normalizedPrompt,
    category:     detectCategory(item, normalizedPrompt),
    sourceId:     item.id           || null,
    sourceUrl:    item.source_url   || null,
    sourceImage:  item.image        || null,
    sourceImages: Array.isArray(item.images) ? item.images : [],
    rank:         item.rank         || null,
    likes:        item.likes        || 0,
    views:        item.views        || 0,
    author:       item.author       || null,
    authorName:   item.author_name  || null,
  });
}

const output = {
  batchName: `trending_prompts_import_${new Date().toISOString().slice(0, 10)}`,
  prompts:   prepared,
};

writeFileSync(resolve(cwd, OUTPUT_FILE), JSON.stringify(output, null, 2));

console.log(`✓ Archivo generado: ${OUTPUT_FILE}`);
console.log(`✓ Prompts preparados: ${prepared.length} de ${data.length} en ${INPUT_FILE}`);
console.log('');
console.log('Próximo paso:');
console.log(`  curl -X POST http://localhost:3000/api/prompts/batch-import \\`);
console.log(`    -H "Content-Type: application/json" \\`);
console.log(`    -H "Authorization: Bearer $BATCH_ADMIN_SECRET" \\`);
console.log(`    -d @${OUTPUT_FILE}`);
