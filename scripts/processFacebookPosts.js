/**
 * scripts/processFacebookPosts.js
 *
 * Convierte facebook-raw.json (exportado por la extensión Chrome)
 * en prepared-prompts.json compatible con el batch importer de LUZ IA STUDIO.
 *
 * Uso:
 *   node scripts/processFacebookPosts.js
 *   node scripts/processFacebookPosts.js --input=facebook-raw.json --output=prepared-prompts.json
 *   node scripts/processFacebookPosts.js --gemini   (usa Gemini para limpiar prompts ambiguos)
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
const hasFlag = name => args.includes(`--${name}`);

const INPUT_FILE  = getArg('input',  'facebook-raw.json');
const OUTPUT_FILE = getArg('output', 'prepared-prompts.json');
const USE_GEMINI  = hasFlag('gemini');
const MIN_LENGTH  = Number(getArg('minLength', '40'));

// ── Leer input ────────────────────────────────────────────────────────────────

const inputPath = resolve(cwd, INPUT_FILE);
if (!existsSync(inputPath)) {
  console.error(`✗ No existe: ${inputPath}`);
  console.error(`  Exporta facebook-raw.json desde la extensión Chrome primero.`);
  process.exit(1);
}

let raw;
try { raw = JSON.parse(readFileSync(inputPath, 'utf-8')); }
catch (e) { console.error(`✗ JSON inválido: ${e.message}`); process.exit(1); }

if (!Array.isArray(raw)) {
  console.error('✗ El archivo debe ser un array de entradas capturadas.');
  process.exit(1);
}

console.log(`\n✓ Cargadas ${raw.length} entradas desde ${INPUT_FILE}`);

// ── Limpieza de texto ─────────────────────────────────────────────────────────

function cleanCaption(text) {
  return String(text || '')
    .replace(/#\w+/g, '')
    .replace(/@[\w.]+/g, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    .replace(/ /g, ' ')
    .replace(/\n{3,}/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function finalizePrompt(p) {
  const c = p.replace(/\s+/g, ' ').trim();
  if (!c) return '';
  return /no artifacts/i.test(c)
    ? c
    : `${c}, ultra detailed, sharp focus, professional lighting, no artifacts, no noise`;
}

// ── Filtros de exclusión (igual que preparePrompts.js) ────────────────────────

const EXCLUDE_KEYWORDS = [
  'jesus','christ','crucifixion','crucified','golgotha','calvary','biblical',
  'bible','prophet','muhammad','allah','buddha','krishna','religious','prayer',
  'church','cathedral','mosque','temple','holy','sacred','resurrection','apostle',
  'virgin mary','saint ','god the','last supper','baptism',
  'war crime','genocide','massacre','holocaust','torture','execution',
  'nude','naked','erotic','explicit','nsfw','porn',
  'meme','troll','shitpost',
];

function isExcluded(text) {
  const l = text.toLowerCase();
  return EXCLUDE_KEYWORDS.some(kw => l.includes(kw));
}

// ── Detección de categoría (misma lógica que preparePrompts.js) ───────────────

function detectCategory(prompt) {
  const p = prompt.toLowerCase();

  if (/\b(poster|flyer|banner|typograph|graphic design|album art|movie poster|concert poster|headline|layout|cover design)\b/.test(p))
    return 'poster';
  if (/\b(brand identity|branding|brand concept|visual language|logo|brand guide)\b/.test(p))
    return 'branding';
  if (/\b(product shot|product photo|product image|product render|packaging|bottle|can|jar|skincare product|cosmetic product|ecommerce|mockup|label design|supplement|perfume bottle|spray bottle)\b/.test(p))
    return 'product';
  if (/\b(editorial|magazine|clean background|gradient background|minimalist composition)\b/.test(p)
      && !/\b(fashion editorial|outfit|full body|full-body|lookbook)\b/.test(p))
    return 'editorial';
  if (/\b(outfit|full.body|head.to.toe|streetwear|lookbook|wardrobe|garment|attire)\b/.test(p)
      && /\b(woman|man|girl|boy|model|person|figure)\b/.test(p))
    return 'outfit';
  if (/\b(fashion|runway|editorial fashion|clothing|style shot|haute couture|luxury fashion|fashion week)\b/.test(p))
    return 'fashion';
  if (/\bdress\b/.test(p) && /\b(woman|girl|model|wearing|styled)\b/.test(p))
    return 'fashion';
  if (/\b(portrait|close.up|face.*focus|headshot|beauty shot|skin texture|extreme close.up|macro.*face|eyes.*focus)\b/.test(p))
    return 'avatar';
  if (/\b(model photo|portrait session|editorial portrait|studio portrait|selfie)\b/.test(p))
    return 'avatar';
  if (/\b(ugc|user.generated|iphone photo|candid|mirror selfie|camera roll|lifestyle photo|content creator|phone camera)\b/.test(p))
    return 'ugc';

  // Fallbacks genéricos
  if (/\b(woman|girl|female|model)\b/.test(p)) return 'avatar';
  if (/\b(man|male|guy)\b/.test(p))            return 'avatar';
  if (/\b(product|object|item)\b/.test(p))     return 'product';

  return 'other';
}

// ── Generación de tags (misma lógica que preparePrompts.js) ──────────────────

function generateTags(prompt, category) {
  const p = prompt.toLowerCase();
  const tags = new Set([category]);

  if (/\b(close.up|extreme close.up|macro)\b/.test(p))   tags.add('close-up');
  if (/\b(full.body|head.to.toe|full body)\b/.test(p))    tags.add('full-body');
  if (/\b(low angle|worm.?s eye)\b/.test(p))             tags.add('low-angle');
  if (/\b(top.?down|overhead|bird.?s eye)\b/.test(p))    tags.add('top-down');
  if (/\b(studio light|controlled light|softbox|ring light)\b/.test(p)) tags.add('studio-light');
  if (/\b(natural light|golden hour|outdoor light|sunlight)\b/.test(p)) tags.add('natural-light');
  if (/\b(soft light|diffuse|overcast)\b/.test(p))       tags.add('soft-light');
  if (/\b(cinematic|film.?like|movie.?style)\b/.test(p)) tags.add('cinematic');
  if (/\b(white background|seamless white|clean background)\b/.test(p)) tags.add('clean-background');
  if (/\b(gradient background|gradient backdrop)\b/.test(p)) tags.add('gradient-background');
  if (/\b(minimal|minimalist)\b/.test(p))                tags.add('minimal');

  return Array.from(tags).slice(0, 7);
}

// ── Procesamiento con Gemini (opcional, --gemini flag) ────────────────────────

async function cleanWithGemini(rawText) {
  // Requiere GEMINI_API_KEY en el entorno
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('  ⚠ GEMINI_API_KEY no definida. Usando texto crudo.');
    return rawText;
  }

  const prompt = `You are a prompt cleaner for an AI image gallery.

Given this raw text scraped from a Facebook post caption, extract ONLY the image generation prompt.
Remove: hashtags, mentions, "follow me", promotional text, non-English social media text, step-by-step instructions.
If the text IS already a clean prompt, return it as-is.
If the text is in another language, translate it to English.
Return ONLY the clean prompt, nothing else.

Raw text:
${rawText}`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 500 },
        }),
      }
    );
    const data = await res.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || rawText;
  } catch (e) {
    console.warn(`  ⚠ Gemini error: ${e.message}`);
    return rawText;
  }
}

// ── Proceso principal ─────────────────────────────────────────────────────────

async function main() {
  const prepared   = [];
  let skippedShort = 0;
  let skippedExcl  = 0;
  let skippedEmpty = 0;

  for (let i = 0; i < raw.length; i++) {
    const entry = raw[i];
    process.stdout.write(`\r  Procesando ${i + 1}/${raw.length}…`);

    if (!entry.imageUrl) {
      skippedEmpty++;
      continue;
    }

    let text = cleanCaption(entry.rawCaption || '');

    if (!text) {
      // Sin caption — la imagen existe pero no hay prompt: la incluimos con texto vacío
      // para que el batch-worker pueda generar imagen; se marcará para revisión
      prepared.push({
        raw:         '',
        category:    'other',
        tags:        ['facebook', 'no-caption'],
        sourceId:    null,
        sourceUrl:   null,
        sourceImage: entry.imageUrl,
        sourceImages:[],
        rank:        null,
        likes:       0,
        views:       0,
        author:      null,
        authorName:  null,
        _note:       'sin-caption',
      });
      continue;
    }

    if (isExcluded(text)) {
      skippedExcl++;
      continue;
    }

    // Limpiar con Gemini si se pidió y el texto parece tener ruido
    if (USE_GEMINI && (text.includes('\n') || text.length < 80)) {
      text = await cleanWithGemini(text);
      text = cleanCaption(text); // limpiar una vez más
    }

    if (text.length < MIN_LENGTH) {
      skippedShort++;
      continue;
    }

    const promptText = finalizePrompt(text);
    const category   = detectCategory(promptText);
    const tags       = generateTags(promptText, category);

    prepared.push({
      raw:         promptText,
      category,
      tags,
      sourceId:    null,
      sourceUrl:   null,
      sourceImage: entry.imageUrl,
      sourceImages:[],
      rank:        null,
      likes:       0,
      views:       0,
      author:      null,
      authorName:  null,
    });
  }

  process.stdout.write('\n');

  // Distribución por categoría
  const catStats = {};
  prepared.forEach(p => { catStats[p.category] = (catStats[p.category] || 0) + 1; });

  const output = {
    batchName: `facebook_prompts_${new Date().toISOString().slice(0, 10)}`,
    prompts:   prepared,
  };

  writeFileSync(resolve(cwd, OUTPUT_FILE), JSON.stringify(output, null, 2));

  console.log(`\n✓ Archivo generado: ${OUTPUT_FILE}`);
  console.log(`✓ Prompts listos:   ${prepared.length} de ${raw.length} entradas`);
  console.log('\nDistribución por categoría:');
  Object.entries(catStats).sort((a, b) => b[1] - a[1]).forEach(([cat, n]) => {
    console.log(`  ${cat.padEnd(15)} ${n}`);
  });
  console.log('\nDescartados:');
  console.log(`  Sin imagen          : ${skippedEmpty}`);
  console.log(`  Texto excluido      : ${skippedExcl}`);
  console.log(`  Texto muy corto     : ${skippedShort}`);
  console.log('\nSiguiente paso:');
  console.log(`  Revisa ${OUTPUT_FILE} y luego envía el batch.`);
  if (USE_GEMINI) console.log('  (Procesado con Gemini para limpieza de texto)');
}

main().catch(e => { console.error(e); process.exit(1); });
