// SPIKE DE FIDELIDAD (joyeria). Standalone: llama directo a Vertex con @google/genai.
// Modelo de imagen = el mismo de api/gemini/image-worker.ts: gemini-3.1-flash-image, location 'global'.
// Uso (desde la raiz del repo):
//   node scripts/piloto-spikes/fidelidad.mjs specs            # inventario de cada pieza (texto/vision, barato)
//   node scripts/piloto-spikes/fidelidad.mjs calib            # calibra el verificador con pares alterados adrede
//   node scripts/piloto-spikes/fidelidad.mjs bg               # 4 fondos sin producto (para estrategia C)
//   node scripts/piloto-spikes/fidelidad.mjs c                # estrategia C (composicion determinista, sin costo de imagen)
//   node scripts/piloto-spikes/fidelidad.mjs gen <receta> <A|B> <producto> [variante]
//   node scripts/piloto-spikes/fidelidad.mjs verify           # verifica TODO lo generado que aun no tiene puntaje
//   node scripts/piloto-spikes/fidelidad.mjs report           # resumen por receta/estrategia
// Topes duros: 40 imagenes generadas y USD 4 acumulados (leidos del CSV de gasto).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { makeClient } from './_auth.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const FOTOS = path.join(HERE, 'fotos-prueba');
const OUT = path.join(HERE, 'salidas-full');            // PNG completos (no se commitean)
const SPIKES = path.join(ROOT, 'CIERRE_MVP/spikes');
const THUMBS = path.join(SPIKES, 'fidelidad-salidas');
const CSV = path.join(SPIKES, 'fidelidad-gasto.csv');
const RESULTS = path.join(HERE, 'resultados.json');     // puntajes del verificador por archivo
const SPECS = path.join(HERE, 'specs.json');

const IMG_MODEL = 'gemini-3.1-flash-image';
const VER_MODEL = 'gemini-2.5-flash';
const MAX_IMAGES = 40, MAX_USD = 4.0;

// Precios oficiales (cloud.google.com/vertex-ai/generative-ai/pricing, verificado 22-oct-2026), USD por 1M tokens, region global, estandar:
//  gemini-3.1-flash-image: entrada texto/imagen 0.50 | salida texto 3.00 | salida imagen 60.00 (1K = 1120 tokens = USD 0.067; imagen de entrada = 1120 tokens)
//  gemini-2.5-flash: entrada 0.30 | salida (incl. razonamiento) 2.50
const PRICE = {
  [IMG_MODEL]: { in: 0.50, outText: 3.00, outImage: 60.0 },
  [VER_MODEL]: { in: 0.30, outText: 2.50, outImage: 0 },
};

const PRODUCTS = { anillo: 'anillo.jpg', cadena: 'cadena.jpg', argolla: 'argolla.jpg' };
fs.mkdirSync(OUT, { recursive: true }); fs.mkdirSync(THUMBS, { recursive: true });
const ai = () => (ai._c ??= makeClient(ROOT));
const py = (...a) => execFileSync('python', ['-I', path.join(HERE, 'imgtools.py'), ...a.map(String)], { encoding: 'utf8' });
const readJson = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
const b64 = f => fs.readFileSync(f).toString('base64');
const part = f => ({ inlineData: { mimeType: f.endsWith('.png') ? 'image/png' : 'image/jpeg', data: b64(f) } });

// ---------- registro de gasto ----------
const HEADER = 'timestamp,id,tipo,modelo,receta,estrategia,producto,tokens_entrada,tokens_salida_texto,tokens_salida_imagen,imagenes_generadas,costo_usd_estimado,segundos,estado\n';
function ledgerTotals() {
  if (!fs.existsSync(CSV)) return { usd: 0, imgs: 0 };
  const rows = fs.readFileSync(CSV, 'utf8').trim().split('\n').slice(1).map(l => l.split(','));
  return { usd: rows.reduce((s, r) => s + Number(r[11] || 0), 0), imgs: rows.reduce((s, r) => s + Number(r[10] || 0), 0) };
}
function logRow(o) {
  if (!fs.existsSync(CSV)) fs.writeFileSync(CSV, HEADER);
  const f = v => String(v ?? '').replace(/,/g, ';');
  fs.appendFileSync(CSV, [new Date().toISOString(), o.id, o.tipo, o.modelo, o.receta, o.estrategia, o.producto, o.tin, o.tout, o.timg, o.imgs, o.usd.toFixed(5), o.secs.toFixed(1), o.estado].map(f).join(',') + '\n');
}
function costOf(model, u, imgOutDefault = 0) {
  const p = PRICE[model]; u = u || {};
  const det = (u.candidatesTokensDetails || []).find(d => d.modality === 'IMAGE');
  const timg = det?.tokenCount ?? imgOutDefault;
  const tout = Math.max(0, (u.candidatesTokenCount || 0) - timg) + (u.thoughtsTokenCount || 0);
  const tin = u.promptTokenCount || 0;
  return { tin, tout, timg, usd: (tin * p.in + tout * p.outText + timg * p.outImage) / 1e6 };
}
function guard(isImage) {
  const t = ledgerTotals();
  if (t.usd >= MAX_USD) throw new Error(`TOPE USD alcanzado (${t.usd.toFixed(3)})`);
  if (isImage && t.imgs >= MAX_IMAGES) throw new Error(`TOPE de imagenes alcanzado (${t.imgs})`);
}

// ---------- llamadas ----------
async function genImage({ id, receta, estrategia, producto, parts, aspect = '4:5' }) {
  guard(true);
  let t0 = Date.now();
  let res, estado = 'ok';
  try {
    for (let intento = 0; ; intento++) {   // 429 (cuota por minuto, compartida con otros spikes) no se cobra: se reintenta con espera
      try {
        t0 = Date.now();
        res = await ai().models.generateContent({
          model: IMG_MODEL, contents: [{ role: 'user', parts }],
          config: { responseModalities: ['TEXT', 'IMAGE'], imageConfig: { aspectRatio: aspect, imageSize: '1K' } },
        });
        break;
      } catch (e) {
        if (!/429|RESOURCE_EXHAUSTED/.test(String(e.message)) || intento >= 5) throw e;
        console.log(`  429, reintento ${intento + 1} en ${30 * (intento + 1)}s`); await new Promise(r => setTimeout(r, 30000 * (intento + 1)));
      }
    }
  } catch (e) {
    logRow({ id, tipo: 'imagen', modelo: IMG_MODEL, receta, estrategia, producto, tin: 0, tout: 0, timg: 0, imgs: 0, usd: 0, secs: (Date.now() - t0) / 1000, estado: 'error:' + String(e.message).slice(0, 80) });
    throw e;
  }
  const secs = (Date.now() - t0) / 1000;
  const img = (res.candidates?.[0]?.content?.parts || []).find(p => p.inlineData?.data);
  const c = costOf(IMG_MODEL, res.usageMetadata, img ? 1120 : 0);
  if (!img) estado = 'sin_imagen:' + (res.candidates?.[0]?.finishReason || '?');
  logRow({ id, tipo: 'imagen', modelo: IMG_MODEL, receta, estrategia, producto, tin: c.tin, tout: c.tout, timg: c.timg, imgs: img ? 1 : 0, usd: c.usd, secs, estado });
  if (!img) throw new Error('Sin imagen: ' + estado);
  const file = path.join(OUT, id + '.png');
  fs.writeFileSync(file, Buffer.from(img.inlineData.data, 'base64'));
  py('thumb', file, path.join(THUMBS, id + '.jpg'), 480);
  console.log(`[img] ${id} ${secs.toFixed(1)}s USD ${c.usd.toFixed(4)}`);
  return file;
}
async function genText({ id, tipo, receta = '', estrategia = '', producto = '', parts, json = true, thinking = 2048 }) {
  guard(false);
  const t0 = Date.now();
  let res;
  for (let n = 0; ; n++) { try { res = await ai().models.generateContent({
    model: VER_MODEL, contents: [{ role: 'user', parts }],
    config: { temperature: 0, ...(parts.filter(x => x.inlineData).length === 1 ? { mediaResolution: 'MEDIA_RESOLUTION_HIGH' } : {}), ...(json ? { responseMimeType: 'application/json' } : {}), thinkingConfig: { thinkingBudget: thinking } },
  }); break; } catch (e) { if (!/429|RESOURCE_EXHAUSTED/.test(String(e.message)) || n >= 6) throw e; await new Promise(r => setTimeout(r, 20000 * (n + 1))); } }
  const secs = (Date.now() - t0) / 1000;
  const c = costOf(VER_MODEL, res.usageMetadata);
  logRow({ id, tipo, modelo: VER_MODEL, receta, estrategia, producto, tin: c.tin, tout: c.tout, timg: 0, imgs: 0, usd: c.usd, secs, estado: 'ok' });
  const txt = res.text || '';
  return json ? JSON.parse(txt.replace(/^```json\s*|```\s*$/g, '')) : txt;
}

// ---------- verificador de fidelidad ----------
const VERIFY_PROMPT = `Eres un auditor de control de calidad de joyeria. Recibes dos imagenes: la IMAGEN 1 es la foto REAL del producto (referencia). La IMAGEN 2 es una imagen generada o editada que supuestamente muestra EXACTAMENTE ese mismo producto en otra escena.
Compara con rigor, sin ser benevolente: solo importa si un cliente que compra por la IMAGEN 2 recibiria la pieza de la IMAGEN 1.
Reglas: (a) si la IMAGEN 2 muestra solo una parte de la pieza (macro, recorte, en el cuerpo), compara solo lo visible; (b) cuenta piedras / eslabones / dijes visibles en ambas; (c) cualquier elemento que no exista en la pieza real (piedras extra, grabados, cierres, dijes, brillos que cambian la pieza, otro metal) es "inventado"; (d) la escena, fondo, mano, caja o luz pueden ser distintos: no los penalices.
Responde SOLO JSON con estas claves:
{"misma_pieza": boolean, "forma_igual": boolean, "color_metal_igual": boolean, "color_piedras_igual": boolean, "proporciones_iguales": boolean,
 "lista_original": [string] (enumera UNA POR UNA cada piedra / eslabon distintivo / elemento visible de la IMAGEN 1 con su color y posicion), "lista_generada": [string] (igual para la IMAGEN 2), "cantidad_original_visible": string, "cantidad_generada": string, "cantidad_igual": boolean,
 "elementos_inventados": [string], "elementos_faltantes_o_deformados": [string], "pieza_visible_y_evaluable": boolean,
 "puntaje": integer 0-100 (100 = identica; 80+ = un cliente no notaria diferencias; <60 = otra pieza o deformada), "resumen": string (max 25 palabras)}`;
// Hallazgo de calibracion: pedirle al modelo comparar dos imagenes en una llamada lo hace "copiar" la lista de la imagen 1
// a la 2 (no vio 3 piedras borradas). Solucion: inventario CIEGO por imagen (cada una sola) y comparacion numerica en codigo.
const INV_PROMPT = `Eres un inspector de joyeria. Mira SOLO esta imagen y haz un inventario objetivo de la pieza de joyeria visible. Cuenta con cuidado, una por una; no adivines ni completes lo que no se ve.
Responde SOLO JSON: {"tipo": string, "pieza_completa_visible": boolean (se ve la pieza entera, sin recortes importantes),
 "metal_color": string, "forma_general": string,
 "piedras_de_color": integer (piedras visibles que NO son blancas/transparentes), "piedras_de_color_detalle": [string] (color y posicion de cada una),
 "piedras_blancas": integer (diamantes/circonias pequenas visibles), "dijes_o_medallones": integer, "tipo_cadena_o_banda": string,
 "extremos_o_cierre": string, "grabados_o_texto": [string], "otros_elementos_distintivos": [string], "personas_o_cara_visible": boolean}`;
async function inventory(file, id, meta) {
  const cache = readJson(path.join(HERE, 'inventarios.json'), {});
  if (cache[id]) return cache[id];
  const r = await genText({ id: 'inv_' + id, tipo: 'inventario', receta: meta.receta, estrategia: meta.estrategia, producto: meta.producto, parts: [{ text: INV_PROMPT }, part(file)] });
  cache[id] = r; fs.writeFileSync(path.join(HERE, 'inventarios.json'), JSON.stringify(cache, null, 1)); return r;
}
function compareInv(o, g) {
  const issues = [];
  const full = g.pieza_completa_visible !== false;
  const cmp = (k, tol) => {
    const dO = o[k] ?? 0, dG = g[k] ?? 0;
    if (full ? Math.abs(dO - dG) > tol : dG > dO + tol) issues.push(`${k}: original ${dO} vs generada ${dG}`);
  };
  cmp('piedras_de_color', 0); cmp('piedras_blancas', 1); cmp('dijes_o_medallones', 0);
  if (g.personas_o_cara_visible) issues.push('cara/persona visible');
  return { ok: issues.length === 0, issues };
}
async function verifyPair(orig, gen, meta) {
  const r = await genText({ id: meta.id, tipo: 'verificador', receta: meta.receta, estrategia: meta.estrategia, producto: meta.producto,
    parts: [{ text: VERIFY_PROMPT }, { text: 'IMAGEN 1 (real):' }, part(orig), { text: 'IMAGEN 2 (a evaluar):' }, part(gen)] });
  const invO = await inventory(orig, 'orig_' + meta.producto, meta);
  const invG = await inventory(gen, meta.id.replace(/^ver_/, '').replace(/^calib_/, 'calib_'), meta);
  r.inventario_original = invO; r.inventario_generada = invG; r.comparacion_conteo = compareInv(invO, invG);
  r.cantidad_igual = r.cantidad_igual && r.comparacion_conteo.ok;   // el conteo ciego manda sobre el juicio conjunto
  if (!r.comparacion_conteo.ok) r.puntaje = Math.min(r.puntaje, 70);
  return r;
}
const passAuto = r => r && r.misma_pieza && r.forma_igual && r.cantidad_igual && r.color_metal_igual && r.proporciones_iguales
  && (r.elementos_inventados || []).length === 0 && r.puntaje >= 80;

// ---------- recetas ----------
const BG = {
  seda: 'folds of soft champagne-ivory silk fabric, gentle highlights, premium jewelry-catalog backdrop',
  piedra: 'a smooth light-grey honed stone (marble-like) surface with a soft blurred stone wall behind',
  neutro: 'a seamless warm off-white / pale beige studio paper backdrop with a soft natural shadow',
};
const PRODUCT_ORDER = ['anillo', 'cadena', 'argolla'];
function scene(receta, producto, variante = 0) {
  const kind = { anillo: 'ring', cadena: 'necklace', argolla: 'hoop earring' }[producto];
  switch (receta) {
    case 'r1': { const k = Object.keys(BG)[(PRODUCT_ORDER.indexOf(producto) + variante) % 3]; return `Clean e-commerce catalog photograph of the ${kind} centered on ${BG[k]}. Soft studio lighting, product fully visible, no other objects, no text.`; }
    case 'r2': return `Extreme macro close-up photograph of the ${kind} showing its most detailed area, shallow depth of field, soft studio light, neutral background, no text.`;
    case 'r3': return ({
      anillo: 'The ring worn on a ring finger of a relaxed hand, photographed from the wrist down; NO face, no head visible; natural skin, plain soft background.',
      cadena: 'The necklace worn around a neck, framed tightly from the collarbone to the chin line; NO face (no eyes, nose, mouth) visible; plain top or bare shoulders, soft background.',
      argolla: 'The hoop earring worn on an ear, tight crop of ear and a bit of hair and jaw only; NO eyes, nose or mouth visible; soft background.',
    })[producto];
    case 'r4': return ({
      anillo: 'The ring placed beside a small coin and a fingertip, or on a hand, so that its true real-world scale is clear; neutral surface; NO face.',
      cadena: 'The necklace gently held in an open palm of a hand (wrist down, NO face) so its real-world size is clear; soft background.',
      argolla: 'The hoop earring resting next to a small coin on a neutral surface so its real-world size is clear; NO people.',
    })[producto];
    case 'r5': return `Top-down flat lay: the ${kind} resting on natural linen next to a small kraft-paper jewelry gift box with a ribbon and one dried flower stem; soft window light; no text, no logos.`;
    case 'r6': return `Lifestyle photograph: the ${kind} on a bedside table / vanity next to a coffee cup and a book, warm morning light, shallow depth of field, no faces, no text.`;
  }
}
function promptFor(estrategia, receta, producto, spec, variante) {
  const s = scene(receta, producto, variante);
  if (estrategia === 'A') return `Use the attached photo as the reference of the jewelry piece. Create a photorealistic, premium image for an Instagram jewelry brand: ${s}`;
  // B: edicion conservadora + inventario explicito de invariantes (regla general: describir lo que NO puede cambiar)
  return `The attached photo is the REAL product. Produce a new photograph in which the jewelry piece is IDENTICAL to the one in the photo: the exact same shape, proportions, metal color, stone count/colors/positions, links/chain pattern, clasp/ends, engraving and finish. Do NOT add, remove, redesign, smooth, beautify, resize parts of, or "improve" anything on the piece. Do not add stones, charms, text or inscriptions.
Fixed inventory of the piece (must match exactly): ${spec}
Change ONLY the surrounding scene: ${s}`;
}

// ---------- comandos ----------
async function cmdSpecs() {
  const specs = readJson(SPECS, {});
  for (const p of Object.keys(PRODUCTS)) {
    if (specs[p]) continue;
    specs[p] = await genText({ id: 'spec_' + p, tipo: 'spec', producto: p, json: false, thinking: 512,
      parts: [{ text: 'Describe in <=60 words, in English, as a strict inventory, this jewelry piece so that someone could verify a copy: type, metal color, exact count and colors of stones or distinctive elements, chain/link pattern, ends/clasp, engravings, proportions (e.g. width-to-height). Facts only, no marketing words.' }, part(path.join(FOTOS, PRODUCTS[p]))] });
    fs.writeFileSync(SPECS, JSON.stringify(specs, null, 2)); console.log(p, '=>', specs[p]);
  }
}
async function cmdCalib() {
  const res = readJson(path.join(HERE, 'calibracion.json'), {});
  const A = path.join(FOTOS, 'anillo.jpg');
  const mk = (n, m) => { const f = path.join(OUT, `calib_${n}.jpg`); py('distort', A, f, m); return f; };
  const cases = [
    ['identica', A], ['hue_estirada', mk('hue', 'hue')], ['piedras_borradas_y_extra', mk('erase', 'erase')], ['otra_pieza_cadena', path.join(FOTOS, 'cadena.jpg')],
  ];
  for (const [n, f] of cases) {
    if (res[n]) continue;
    res[n] = await verifyPair(A, f, { id: 'calib_' + n, receta: 'calibracion', estrategia: '-', producto: 'anillo' });
    console.log(n, '=> puntaje', res[n].puntaje, 'auto-pasa:', passAuto(res[n]), '|', res[n].resumen);
    fs.writeFileSync(path.join(HERE, 'calibracion.json'), JSON.stringify(res, null, 2));
  }
}
async function cmdBg() {
  const prompts = {
    seda: 'Empty premium jewelry-catalog backdrop: folds of soft champagne-ivory silk fabric with gentle highlights, an uncluttered calm area in the center, no objects, no text. Photorealistic.',
    piedra: 'Empty product backdrop: a smooth light-grey honed marble-like stone surface with a soft blurred stone wall behind, uncluttered center, no objects, no text. Photorealistic.',
    neutro: 'Empty studio backdrop: seamless warm off-white pale beige paper with a soft natural gradient and gentle shadow, uncluttered center, no objects, no text. Photorealistic.',
    flatlay: 'Empty top-down flat lay surface: natural cream linen cloth with a small kraft-paper jewelry gift box with ribbon in the lower-right corner and one dried flower stem in the upper-left corner, a large uncluttered area in the center, soft window light, no text, no logos. Photorealistic.',
  };
  for (const [k, p] of Object.entries(prompts)) {
    const f = path.join(OUT, `bg_${k}.png`); if (fs.existsSync(f)) continue;
    await genImage({ id: `bg_${k}`, receta: 'fondo-C', estrategia: 'C', producto: '-', parts: [{ text: p }] });
  }
}
function cmdC() {
  for (const [p, mode] of [['anillo', 'sat'], ['cadena', 'sat'], ['argolla', 'dist']]) {
    const cut = path.join(OUT, `cut_${p}.png`);
    if (!fs.existsSync(cut)) py('cutout', path.join(FOTOS, PRODUCTS[p]), cut, mode);
  }
  const scale = { anillo: 0.7, cadena: 0.62, argolla: 0.6 };
  PRODUCT_ORDER.forEach((p, i) => {
    const bgk = ['seda', 'piedra', 'neutro'][i];
    // r1 catalogo (2 opciones: fondo principal + otro fondo)
    for (const [v, k] of [[0, bgk], [1, ['seda', 'piedra', 'neutro'][(i + 1) % 3]]]) {
      py('compose', path.join(OUT, `cut_${p}.png`), path.join(OUT, `bg_${k}.png`), path.join(OUT, `r1_C_${p}_${v}.png`), scale[p]);
    }
    // r5 flatlay
    py('compose', path.join(OUT, `cut_${p}.png`), path.join(OUT, 'bg_flatlay.png'), path.join(OUT, `r5_C_${p}_0.png`), scale[p] * 0.7);
    // r2 macro determinista: zoom a una zona de la foto original (sin generacion)
    const focus = { anillo: [0.45, 0.55, 0.45], cadena: [0.38, 0.88, 0.32], argolla: [0.35, 0.40, 0.45] }[p];
    py('crop', path.join(FOTOS, PRODUCTS[p]), path.join(OUT, `r2_C_${p}_0.png`), ...focus);
    for (const v of v_list(p)) py('thumb', path.join(OUT, v), path.join(THUMBS, v.replace('.png', '.jpg')), 480);
  });
}
const v_list = p => fs.readdirSync(OUT).filter(f => /^r[0-9]_C_/.test(f) && f.includes('_' + p + '_') && f.endsWith('.png'));

async function cmdGen(receta, estrategia, producto, variante = 0) {
  const id = `${receta}_${estrategia}_${producto}_${variante}`;
  if (fs.existsSync(path.join(OUT, id + '.png'))) return console.log('ya existe', id);
  const specs = readJson(SPECS, {});
  const prompt = promptFor(estrategia, receta, producto, specs[producto] || '', variante);
  fs.writeFileSync(path.join(OUT, id + '.prompt.txt'), prompt);
  await genImage({ id, receta, estrategia, producto, parts: [{ text: prompt }, part(path.join(FOTOS, PRODUCTS[producto]))] });
}
async function cmdVerify() {
  const results = readJson(RESULTS, {});
  for (const f of fs.readdirSync(OUT).filter(f => /^r[0-9]_[ABC]_/.test(f) && f.endsWith('.png')).sort()) {
    const id = f.replace('.png', ''); if (results[id]) continue;
    const [receta, estrategia, producto] = id.split('_');
    results[id] = await verifyPair(path.join(FOTOS, PRODUCTS[producto]), path.join(OUT, f), { id: 'ver_' + id, receta, estrategia, producto });
    console.log(id, results[id].puntaje, passAuto(results[id]) ? 'PASA' : 'no', '|', results[id].resumen);
    fs.writeFileSync(RESULTS, JSON.stringify(results, null, 2));
  }
}
function cmdReport() {
  const results = readJson(RESULTS, {}); const t = ledgerTotals();
  const rows = fs.readFileSync(CSV, 'utf8').trim().split('\n').slice(1).map(l => l.split(','));
  console.log(`Gasto acumulado: USD ${t.usd.toFixed(3)} | imagenes: ${t.imgs}`);
  const g = {};
  for (const [id, r] of Object.entries(results)) { const [rc, st] = id.split('_'); const k = rc + ' ' + st; (g[k] ??= []).push([id, r.puntaje, passAuto(r)]); }
  for (const k of Object.keys(g).sort()) console.log(k, g[k].map(x => `${x[0].split('_').slice(2).join('_')}:${x[1]}${x[2] ? '+' : '-'}`).join('  '), ` auto-pasa ${g[k].filter(x => x[2]).length}/${g[k].length}`);
  const img = rows.filter(r => r[2] === 'imagen' && r[10] === '1');
  console.log('imagenes ok:', img.length, 'costo medio USD', (img.reduce((s, r) => s + Number(r[11]), 0) / (img.length || 1)).toFixed(4), 'seg medio', (img.reduce((s, r) => s + Number(r[12]), 0) / (img.length || 1)).toFixed(1));
}

const [cmd, ...args] = process.argv.slice(2);
const table = { specs: cmdSpecs, calib: cmdCalib, bg: cmdBg, c: cmdC, gen: () => cmdGen(...args), verify: cmdVerify, report: cmdReport };
if (!table[cmd]) { console.log('Comandos: ' + Object.keys(table).join(' | ')); process.exit(1); }
Promise.resolve(table[cmd]()).catch(e => { console.error('ERROR:', e.message); process.exit(1); });
