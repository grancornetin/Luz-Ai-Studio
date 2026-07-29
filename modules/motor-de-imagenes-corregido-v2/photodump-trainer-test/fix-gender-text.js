// Reemplazo de texto sobre los análisis ya guardados: el banco es 100% de sujetos femeninos,
// así que "el sujeto"/"la persona" (lenguaje genérico que el prompt viejo usaba por cautela
// de género) se reemplaza por "la mujer" — sin volver a llamar a Gemini, es edición de texto.
// No toca interpreted_signals ni search_tags (esos campos casi no usan "sujeto/persona" directo,
// y su texto es más técnico/mecánico, con menor riesgo de concordancia rota).
const fs = require('fs');
const path = require('path');
const store = require('../photodump-trainer/core/store');

// Casos con concordancia de género que rompería si se reemplaza mecánicamente
// (ej. "El sujeto está centrado" -> debe quedar "centrada", no "centrado").
// Verbo transitivo + sujeto/persona como objeto directo necesita la "a" personal en español
// ("capturando el sujeto" -> "capturando a la mujer", no "capturando la mujer").
const TRANSITIVE_VERB_FIXES = [
  [/\b(capturando|mostrando|enfocando|encuadrando|recortando)\s+(el sujeto|un sujeto)\b/gi, (_, verb) => `${verb} a la mujer`],
  [/\b(capturando|mostrando|enfocando|encuadrando|recortando)\s+(la persona|una persona)\b/gi, (_, verb) => `${verb} a la mujer`],
];

const PARTICIPLE_FIXES = [
  [/\b(El sujeto|Un sujeto)(\s+(?:está|se encuentra|aparece|luce)\s+)centrado\b/g, (_, art, mid) => `La mujer${mid}centrada`],
  [/\b(el sujeto|un sujeto)(\s+(?:está|se encuentra|aparece|luce)\s+)centrado\b/g, (_, art, mid) => `la mujer${mid}centrada`],
  [/\b(El sujeto|Un sujeto)(\s+(?:está|se encuentra|aparece|luce)\s+)descentrado\b/g, (_, art, mid) => `La mujer${mid}descentrada`],
  [/\b(el sujeto|un sujeto)(\s+(?:está|se encuentra|aparece|luce)\s+)descentrado\b/g, (_, art, mid) => `la mujer${mid}descentrada`],
  [/\b(El sujeto|Un sujeto)(\s+(?:está|se encuentra|aparece|luce)\s+)sentado\b/g, (_, art, mid) => `La mujer${mid}sentada`],
  [/\b(el sujeto|un sujeto)(\s+(?:está|se encuentra|aparece|luce)\s+)sentado\b/g, (_, art, mid) => `la mujer${mid}sentada`],
];

// Reemplazos simples de sustantivo (sin adjetivo que concuerde en la misma cláusula).
// Las variantes con mayúscula van primero para no perder la mayúscula de inicio de oración.
const SIMPLE_FIXES = [
  [/\bEl sujeto\b/g, 'La mujer'],
  [/\bel sujeto\b/g, 'la mujer'],
  [/\bLa sujeto\b/g, 'La mujer'],
  [/\bla sujeto\b/g, 'la mujer'],
  [/\bel propio sujeto\b/g, 'la propia mujer'],
  [/\bdel propio sujeto\b/g, 'de la propia mujer'],
  [/\bUn sujeto\b/g, 'Una mujer'],
  [/\bun sujeto\b/g, 'una mujer'],
  [/\bDel sujeto\b/g, 'De la mujer'],
  [/\bdel sujeto\b/g, 'de la mujer'],
  [/\bAl sujeto\b/g, 'A la mujer'],
  [/\bal sujeto\b/g, 'a la mujer'],
  [/\bLa persona\b/g, 'La mujer'],
  [/\bla persona\b/g, 'la mujer'],
  [/\bUna persona\b/g, 'Una mujer'],
  [/\buna persona\b/g, 'una mujer'],
  [/\bDe la persona\b/g, 'De la mujer'],
  [/\bde la persona\b/g, 'de la mujer'],
  [/\bA la persona\b/g, 'A la mujer'],
  [/\ba la persona\b/g, 'a la mujer'],
];

function fixText(text) {
  let result = text;
  TRANSITIVE_VERB_FIXES.forEach(([re, fn]) => { result = result.replace(re, fn); });
  PARTICIPLE_FIXES.forEach(([re, fn]) => { result = result.replace(re, fn); });
  SIMPLE_FIXES.forEach(([re, replacement]) => { result = result.replace(re, replacement); });
  return result;
}

function fixRawDescription(raw) {
  if (!raw) return { raw, changed: false };
  let changed = false;
  const fixed = {};
  Object.entries(raw).forEach(([k, v]) => {
    if (typeof v === 'string') {
      const newV = fixText(v);
      if (newV !== v) changed = true;
      fixed[k] = newV;
    } else {
      fixed[k] = v;
    }
  });
  return { raw: fixed, changed };
}

// search_tags describe la foto original igual que raw_visual_description (no son instrucciones
// para el motor como `condition`), así que aplica el mismo criterio de reemplazo.
function fixSearchTags(tags) {
  if (!tags) return { tags, changed: false };
  let changed = false;
  const fixed = { ...tags };
  if (typeof fixed.framing === 'string') {
    const newV = fixText(fixed.framing);
    if (newV !== fixed.framing) { changed = true; fixed.framing = newV; }
  }
  if (fixed.camera_origin === 'sujeto' || fixed.camera_origin === 'el sujeto') {
    fixed.camera_origin = 'mujer';
    changed = true;
  } else if (typeof fixed.camera_origin === 'string') {
    const newV = fixText(fixed.camera_origin);
    if (newV !== fixed.camera_origin) { changed = true; fixed.camera_origin = newV; }
  }
  return { tags: fixed, changed };
}

function main() {
  const dryRun = process.argv.includes('--dry-run');
  const bank = store.loadBank();
  const done = bank.items.filter(i => i.status === 'done');
  let filesChanged = 0;
  let filesSkipped = 0;
  let shownExamples = 0;

  done.forEach(item => {
    const entry = store.loadAnalysis(item.id);
    if (!entry || !entry.analysis) { filesSkipped++; return; }

    const beforeRaw = entry.analysis.raw_visual_description;
    const { raw, changed: rawChanged } = fixRawDescription(beforeRaw);
    const beforeTags = entry.analysis.search_tags;
    const { tags, changed: tagsChanged } = fixSearchTags(beforeTags);
    if (!rawChanged && !tagsChanged) return;

    if (dryRun) {
      if (shownExamples < 20) {
        if (rawChanged) Object.keys(beforeRaw).forEach(k => {
          if (typeof beforeRaw[k] === 'string' && beforeRaw[k] !== raw[k]) {
            console.log('ANTES:  ', beforeRaw[k].slice(0, 160));
            console.log('DESPUES:', raw[k].slice(0, 160));
            console.log('---');
          }
        });
        if (tagsChanged) {
          console.log('TAGS ANTES:  ', JSON.stringify(beforeTags).slice(0, 160));
          console.log('TAGS DESPUES:', JSON.stringify(tags).slice(0, 160));
          console.log('---');
        }
        shownExamples++;
      }
    } else {
      if (rawChanged) entry.analysis.raw_visual_description = raw;
      if (tagsChanged) entry.analysis.search_tags = tags;
      store.saveAnalysis(item.id, entry);
    }
    filesChanged++;
  });

  console.log(`${dryRun ? '[DRY RUN] ' : ''}Archivos ${dryRun ? 'que se modificarían' : 'modificados'}: ${filesChanged}`);
  console.log(`Archivos sin análisis (saltados): ${filesSkipped}`);
  console.log(`Total revisados: ${done.length}`);
}

main();
