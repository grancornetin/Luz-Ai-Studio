/**
 * scripts/preparePrompts.js
 *
 * Convierte trending-prompts.json en prepared-prompts.json
 * listo para POST /api/batch  { action: 'import', ... }
 *
 * Uso:
 *   node scripts/preparePrompts.js --limit=10
 *   node scripts/preparePrompts.js --limit=100 --minLikes=500
 *   node scripts/preparePrompts.js --categories=product,fashion,poster
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const cwd       = resolve(__dirname, '..');

const args = process.argv.slice(2);
function getArg(name, fallback) {
  const m = args.find(a => a.startsWith(`--${name}=`));
  return m ? m.split('=').slice(1).join('=') : fallback;
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
if (!existsSync(inputPath)) { console.error(`✗ No existe: ${inputPath}`); process.exit(1); }

let data;
try { data = JSON.parse(readFileSync(inputPath, 'utf-8')); }
catch (e) { console.error(`✗ Error JSON: ${e.message}`); process.exit(1); }

if (!Array.isArray(data)) { console.error('✗ El archivo debe ser un array.'); process.exit(1); }

// ══════════════════════════════════════════════════════════════════════════════
// FILTROS DE EXCLUSIÓN
// Prompts que NO deben entrar a la galería comercial
// ══════════════════════════════════════════════════════════════════════════════

// Palabras que indican contenido religioso o no comercial
const EXCLUDE_KEYWORDS = [
  // Religioso
  'jesus','christ','crucifixion','crucified','golgotha','calvary','biblical',
  'bible','prophet','muhammad','allah','buddha','krishna','religious','prayer',
  'church','cathedral','mosque','temple','holy','sacred','resurrection','apostle',
  'virgin mary','saint ','god the','resurrection','last supper','baptism',
  // Político/guerra
  'war crime','genocide','massacre','holocaust','torture','execution',
  // Adulto/inapropiado
  'nude','naked','erotic','explicit','nsfw','porn',
  // Sin valor comercial
  'meme','troll','shitpost',
];

function isExcluded(prompt) {
  const lower = prompt.toLowerCase();
  return EXCLUDE_KEYWORDS.some(kw => lower.includes(kw));
}

// Categorías comerciales válidas para LUZ IA STUDIO
// Solo aceptamos lo que sirve para crear contenido de marca/moda/producto
const VALID_COMMERCIAL_CATEGORIES = [
  'product','fashion','food','poster','ugc','avatar','portrait',
  'advertising','brand','editorial','lifestyle','beauty','skincare',
  'luxury','commercial','infographic','3d','icon','packaging',
  'photograph','girl','woman','man','model',
];

function isCommerciallyRelevant(item, normalizedPrompt) {
  const cats = Array.isArray(item.categories)
    ? item.categories.map(c => String(c).toLowerCase()) : [];
  const p = normalizedPrompt.toLowerCase();

  // Si tiene categoría comercial explícita → aceptar
  if (cats.some(c => VALID_COMMERCIAL_CATEGORIES.some(v => c.includes(v)))) return true;

  // Si el prompt describe contenido comercial → aceptar
  const commercialSignals = [
    'product','fashion','outfit','editorial','brand','advertising','campaign',
    'packaging','ecommerce','lifestyle','portrait','model','ugc','skincare',
    'food photography','luxury','commercial','studio shot','poster','infographic',
    'icon','3d render','social media','content creator',
  ];
  if (commercialSignals.some(s => p.includes(s))) return true;

  // Si no hay señal comercial clara → excluir (demasiado genérico o irrelevante)
  return false;
}

// ══════════════════════════════════════════════════════════════════════════════
// DETECCIÓN DE CATEGORÍA (más precisa)
// ══════════════════════════════════════════════════════════════════════════════

function detectCategory(item, prompt) {
  const cats = Array.isArray(item.categories)
    ? item.categories.join(' ').toLowerCase() : '';
  const p = `${cats} ${prompt}`.toLowerCase();

  // Producto primero (muy específico)
  if (/\b(product shot|product photo|packaging|bottle|can|jar|skincare|cosmetic|ecommerce|mockup|brand identity|label design)\b/.test(p))
    return 'product';

  // Moda / editorial
  if (/\b(fashion|outfit|dress|editorial|lookbook|wardrobe|clothing|garment|style shot|runway)\b/.test(p))
    return 'fashion';

  // Comida
  if (/\b(food photo|recipe|dish|meal|cake|dessert|restaurant|culinary|plating|ingredients)\b/.test(p))
    return 'food';

  // Poster / diseño gráfico
  if (/\b(poster|flyer|banner|typograph|graphic design|cover|album art|movie poster|concert|headline)\b/.test(p))
    return 'poster';

  // Publicidad / anuncio
  if (/\b(advertisement|ad campaign|commercial|brand campaign|marketing visual|promo)\b/.test(p))
    return 'advertising';

  // Infografía / técnico
  if (/\b(infographic|diagram|blueprint|technical drawing|annotation|schematic|cross.section)\b/.test(p))
    return 'infographic';

  // 3D / icono
  if (/\b(3d render|isometric|diorama|pixar.style|icon set|3d icon|blender|cinema 4d)\b/.test(p))
    return '3d';

  // UGC / lifestyle
  if (/\b(ugc|user.generated|iphone photo|candid|mirror selfie|camera roll|lifestyle photo|content creator)\b/.test(p))
    return 'ugc';

  // Avatar / retrato (solo si hay señal clara de persona + uso comercial)
  if (/\b(model photo|portrait session|headshot|beauty shot|skin texture|editorial portrait|studio portrait)\b/.test(p))
    return 'avatar';

  // Categoría desde JSON original como fallback
  if (cats.includes('product'))     return 'product';
  if (cats.includes('fashion'))     return 'fashion';
  if (cats.includes('food'))        return 'food';
  if (cats.includes('photograph'))  return 'avatar';
  if (cats.includes('girl') || cats.includes('woman') || cats.includes('man')) return 'avatar';

  return 'other';
}

// ══════════════════════════════════════════════════════════════════════════════
// NORMALIZACIÓN — extrae texto plano estructurado en secciones
// compatibles con las etiquetas de LUZ IA STUDIO:
// persona | outfit | escena | producto
// ══════════════════════════════════════════════════════════════════════════════

const PREFERRED_KEYS = [
  // Prompt completo primero
  'assembled_prompt','full_prompt_string','full_prompt_text','main_prompt',
  'prompt_text','prompt','image_prompt','scene_prompt',
  // Secciones de persona
  'subject','person','model','demographics','facial_features','description','pose','expression',
  'skin','eyes','hair','makeup','visible_body',
  // Outfit
  'outfit','attire','clothing','style','wardrobe','accessories',
  // Escena / ambiente
  'environment','setting','scene_description','background','atmosphere','location',
  'lighting','camera','camera_settings','composition','shot_type','mood',
  // Producto
  'product','brand','packaging','label','materials',
  // Calidad
  'quality','technical_modifiers','negative_prompt',
];

const IGNORED_KEYS = new Set([
  'id','rank','date','author','author_name','model','source_url',
  'image','images','likes','views','steps','cfg_scale','batch_size',
  'dialogue','audio','subtitles','version','title',
]);

const PERSONA_KEYS  = new Set(['subject','person','model','demographics','facial_features','description','pose','expression','skin','eyes','hair','makeup','visible_body']);
const OUTFIT_KEYS   = new Set(['outfit','attire','clothing','wardrobe','accessories']);
const ESCENA_KEYS   = new Set(['environment','setting','scene_description','background','atmosphere','location','lighting','camera','camera_settings','composition','shot_type','mood']);
const PRODUCTO_KEYS = new Set(['product','brand','packaging','label','materials']);

function shouldIgnoreKey(k) { return IGNORED_KEYS.has(k.toLowerCase()); }
function shouldIgnoreText(t, hint = '') {
  const l = t.toLowerCase(), h = hint.toLowerCase();
  if (l.length < 3) return true;
  if (h.includes('audio') || h.includes('dialogue')) return true;
  if (l.includes('all prompts in alt')) return true;
  if (l.includes('open gemini') && l.includes('upload')) return true;
  if (l.includes('follow me') || l.includes('like and retweet')) return true;
  return false;
}

function cleanFrag(t) {
  return String(t)
    .replace(/\s+/g, ' ')
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    .replace(/ /g, ' ')
    .trim();
}

function walkJsonStructured(val, hint = '', sections = { persona:[], outfit:[], escena:[], producto:[], general:[] }) {
  if (typeof val === 'string') {
    const c = cleanFrag(val);
    if (c.length > 2 && !shouldIgnoreText(c, hint)) {
      const h = hint.toLowerCase();
      if (PERSONA_KEYS.has(h))       sections.persona.push(c);
      else if (OUTFIT_KEYS.has(h))   sections.outfit.push(c);
      else if (ESCENA_KEYS.has(h))   sections.escena.push(c);
      else if (PRODUCTO_KEYS.has(h)) sections.producto.push(c);
      else                           sections.general.push(c);
    }
    return sections;
  }
  if (Array.isArray(val)) {
    val.forEach(v => walkJsonStructured(v, hint, sections));
    return sections;
  }
  if (val && typeof val === 'object') {
    const keys = Object.keys(val).sort((a, b) => {
      const ai = PREFERRED_KEYS.indexOf(a), bi = PREFERRED_KEYS.indexOf(b);
      return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi);
    });
    keys.forEach(k => {
      if (!shouldIgnoreKey(k)) walkJsonStructured(val[k], k, sections);
    });
  }
  return sections;
}

function sectionsToPrompt(sections) {
  // Combina secciones en orden lógico para generación de imagen
  const parts = [];
  if (sections.persona.length)  parts.push(sections.persona.join(', '));
  if (sections.outfit.length)   parts.push(sections.outfit.join(', '));
  if (sections.producto.length) parts.push(sections.producto.join(', '));
  if (sections.escena.length)   parts.push(sections.escena.join(', '));
  if (sections.general.length)  parts.push(sections.general.join(', '));
  return parts.join('. ');
}

function sanitizeJson(s) {
  return s.replace(/[""]/g, '"').replace(/['']/g, "'");
}

function extractByRegex(s) {
  return (s.match(/"([^"\\]{20,})"/g) || [])
    .map(m => m.slice(1, -1).trim())
    .filter(t => !shouldIgnoreText(t));
}

function finalizePrompt(p) {
  const c = cleanFrag(p)
    .replace(/https?:\/\/\S+/g, '')
    .replace(/Gemini Promt\s*[^\w\s]/gi, '')
    .replace(/Step\s*\d\.[^"]{0,200}/gi, '')
    .replace(/\s+/g, ' ').trim();
  return /no artifacts/i.test(c) ? c
    : `${c}, ultra detailed, sharp focus, professional lighting, no artifacts, no noise`;
}

function normalizePrompt(input) {
  const raw = String(input || '').trim();
  if (!raw) return '';

  if (raw.startsWith('{') || raw.startsWith('[')) {
    for (const attempt of [raw, sanitizeJson(raw)]) {
      try {
        const parsed   = JSON.parse(attempt);
        const sections = walkJsonStructured(parsed);
        const combined = sectionsToPrompt(sections);
        const deduped  = Array.from(new Set(combined.split(/[,.] */).map(cleanFrag))).filter(Boolean);
        if (deduped.length > 0) return finalizePrompt(deduped.join(', '));
      } catch { /* continuar */ }
    }
    // Fallback: extracción por regex
    const frags   = extractByRegex(sanitizeJson(raw));
    const deduped = Array.from(new Set(frags.map(cleanFrag))).filter(Boolean);
    if (deduped.length > 0) return finalizePrompt(deduped.join(', '));
  }

  return finalizePrompt(raw);
}

// ══════════════════════════════════════════════════════════════════════════════
// VALIDACIÓN FINAL
// ══════════════════════════════════════════════════════════════════════════════

function hasUnreplacedPlaceholders(p) {
  return /\[([a-z][^\]]{1,40})\]/i.test(p);
}

const NEGATIVE_STARTERS = ['cartoon,','anime,','blurry,','pixelated,','low quality,','no blur','avoid:','negative:'];
function isNegativeOnlyPrompt(p) {
  const l     = p.toLowerCase().trim();
  const hits  = ['blurry','pixelated','overexposed','low quality','cartoon','anime','harsh shadows','dull'].filter(w => l.includes(w)).length;
  const start = NEGATIVE_STARTERS.some(s => l.startsWith(s));
  return (hits >= 4 && l.length < 600) || (start && hits >= 2);
}

function isValidItem(item, prompt) {
  if (!prompt || prompt.length < MIN_LENGTH)      return false;
  if (Number(item.likes || 0) < MIN_LIKES)        return false;
  if (isExcluded(prompt))                         return false;
  if (hasUnreplacedPlaceholders(prompt))          return false;
  if (isNegativeOnlyPrompt(prompt))               return false;
  if (!isCommerciallyRelevant(item, prompt))      return false;

  const l = prompt.toLowerCase();
  if (l.includes('open gemini') && l.includes('step 1')) return false;
  if (l.includes('all prompts in alt'))                  return false;
  if (l.includes('follow me'))                           return false;

  if (CATEGORIES_FILTER.length > 0) {
    const cats = Array.isArray(item.categories)
      ? item.categories.map(c => String(c).toLowerCase()) : [];
    if (!cats.some(c => CATEGORIES_FILTER.some(f => c.includes(f)))) return false;
  }

  return true;
}

// ══════════════════════════════════════════════════════════════════════════════
// PROCESO PRINCIPAL
// ══════════════════════════════════════════════════════════════════════════════

const sorted = [...data].sort((a, b) => Number(a.rank || 999999) - Number(b.rank || 999999));
const prepared         = [];
const seenFingerprints = new Set();
let   skippedExcluded  = 0;
let   skippedPlaceholder = 0;
let   skippedNonCommercial = 0;
let   skippedDuplicate = 0;

for (const item of sorted) {
  if (prepared.length >= LIMIT) break;

  const normalizedPrompt = normalizePrompt(item.prompt);

  // Contadores de debug
  if (isExcluded(normalizedPrompt))                      { skippedExcluded++;       continue; }
  if (hasUnreplacedPlaceholders(normalizedPrompt))       { skippedPlaceholder++;    continue; }
  if (isNegativeOnlyPrompt(normalizedPrompt))            { skippedPlaceholder++;    continue; }
  if (!normalizedPrompt || normalizedPrompt.length < MIN_LENGTH) { continue; }
  if (Number(item.likes || 0) < MIN_LIKES)               { continue; }
  if (!isCommerciallyRelevant(item, normalizedPrompt))   { skippedNonCommercial++;  continue; }

  const l = normalizedPrompt.toLowerCase();
  if (l.includes('open gemini') && l.includes('step 1')) continue;
  if (l.includes('all prompts in alt'))                  continue;
  if (l.includes('follow me'))                           continue;

  if (CATEGORIES_FILTER.length > 0) {
    const cats = Array.isArray(item.categories)
      ? item.categories.map(c => String(c).toLowerCase()) : [];
    if (!cats.some(c => CATEGORIES_FILTER.some(f => c.includes(f)))) continue;
  }

  const fingerprint = normalizedPrompt.toLowerCase().slice(0, 500);
  if (seenFingerprints.has(fingerprint)) { skippedDuplicate++; continue; }
  seenFingerprints.add(fingerprint);

  prepared.push({
    raw:          normalizedPrompt,
    category:     detectCategory(item, normalizedPrompt),
    sourceId:     item.id          || null,
    sourceUrl:    item.source_url  || null,
    sourceImage:  item.image       || null,
    sourceImages: Array.isArray(item.images) ? item.images : [],
    rank:         item.rank        || null,
    likes:        item.likes       || 0,
    views:        item.views       || 0,
    author:       item.author      || null,
    authorName:   item.author_name || null,
  });
}

// Stats por categoría
const catStats = {};
prepared.forEach(p => { catStats[p.category] = (catStats[p.category] || 0) + 1; });

const output = {
  batchName: `trending_prompts_import_${new Date().toISOString().slice(0, 10)}`,
  prompts:   prepared,
};

writeFileSync(resolve(cwd, OUTPUT_FILE), JSON.stringify(output, null, 2));

console.log('');
console.log(`✓ Archivo generado: ${OUTPUT_FILE}`);
console.log(`✓ Prompts listos:   ${prepared.length} de ${data.length} totales`);
console.log('');
console.log('Distribución por categoría:');
Object.entries(catStats).sort((a,b) => b[1]-a[1]).forEach(([cat, n]) => {
  console.log(`  ${cat.padEnd(15)} ${n}`);
});
console.log('');
console.log('Descartados:');
console.log(`  Religiosos/inapropiados : ${skippedExcluded}`);
console.log(`  No comerciales          : ${skippedNonCommercial}`);
console.log(`  Placeholders/negativos  : ${skippedPlaceholder}`);
console.log(`  Duplicados              : ${skippedDuplicate}`);
console.log('');
console.log('Siguiente paso:');
console.log(`  Revisa prepared-prompts.json y luego envía el batch.`);
