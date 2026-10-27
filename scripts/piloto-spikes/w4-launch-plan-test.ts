// Prueba del motor de plan de lanzamiento (W4).
//   npx tsx scripts/piloto-spikes/w4-launch-plan-test.ts offline      -> sin llamadas al modelo (simulaciones)
//   npx tsx scripts/piloto-spikes/w4-launch-plan-test.ts live [N]     -> N corridas con Gemini (texto) vía Vertex, igual que /api/gemini/content
// Límite duro: 8 llamadas al modelo en total por ejecución.
// Credenciales: se leen de la variable GOOGLE_SERVICE_ACCOUNT_KEY / GCP_PROJECT_ID del entorno
// o del archivo .env.local indicado en W4_ENV_FILE. Nunca se imprimen.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { GoogleGenAI } from '@google/genai';
import { runLaunchPlan, type LaunchEngineInput, type ModelResponse } from '../../src/modules/planner/v3/launchPlanEngine';
import { validateTasks } from '../../src/modules/planner/v3/launchPlanValidator';
import { buildOutline, buildSlots, todayInSantiago } from '../../src/modules/planner/v3/launchCalendar';
import type { CatalogItem } from '../../src/modules/piloto/types';
import { RECIPES } from '../../src/modules/piloto/recipes';

const TODAY = '2026-10-26';
const OUT = 'CIERRE_MVP/informes/w4-ejemplo-plan.json';

const now = Date.now();
const item = (id: string, name: string, material: string, color: string, price: number, role: CatalogItem['role']): CatalogItem => ({
  id, name, category: 'aros', material, color, priceCLP: price, originalPhotos: [], aiTags: [], role, createdAt: now, updatedAt: now,
});
const CATALOG: CatalogItem[] = [
  item('cat-gota-mar', 'Aros Gota Mar', 'resina y acero', 'azul translúcido', 8990, 'ancla'),
  item('cat-argolla-mini', 'Aros Argolla Mini', 'acero', 'dorado', 6990, 'normal'),
  item('cat-flor-seca', 'Aros Flor Seca', 'resina y acero', 'transparente con flores', 9990, 'nuevo'),
  item('cat-luna', 'Aros Luna', 'resina y acero', 'blanco perlado', 7990, 'normal'),
  item('cat-ola', 'Aros Ola', 'resina y acero', 'verde agua', 8490, 'normal'),
];

function baseInput(callModel: LaunchEngineInput['callModel']): LaunchEngineInput {
  return {
    brandName: 'Mar de Resina',
    brandText: [
      'Marca: Mar de Resina',
      'País: Chile',
      'Rubro: Joyería',
      'Qué vende: Aros de resina y acero, precios bajos',
      'Tono de voz: juvenil, cercano',
    ].join('\n'),
    mainCategory: 'Joyería',
    shortDescription: 'Aros de resina y acero, precios bajos',
    seed: { categories: ['aros'], material: 'otro', materialNote: 'resina y acero', priceRange: 'bajo', audience: 'jovenes', voice: 'juvenil', confirmedClaims: [] },
    catalog: CATALOG,
    todayISO: TODAY,
    callModel,
  };
}

let modelCalls = 0;
const MAX_CALLS = 8;

function loadEnv(): void {
  const file = process.env.W4_ENV_FILE || 'C:/Users/Nico Trabajo/Downloads/luz-ia-studio (1)/.env.local';
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf-8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!process.env[m[1]]) process.env[m[1]] = v;
  }
}

function geminiCall(): LaunchEngineInput['callModel'] {
  loadEnv();
  const raw = process.env.GEMINI_SERVICE_ACCOUNT_KEY || process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '';
  const decoded = raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf-8');
  const ai = new GoogleGenAI({
    vertexai: true,
    project: process.env.GCP_PROJECT_ID!,
    location: 'us-central1',
    googleAuthOptions: { credentials: JSON.parse(decoded) },
  });
  return async (prompt, opts) => {
    if (modelCalls >= MAX_CALLS) throw new Error('Límite de 8 llamadas alcanzado');
    modelCalls++;
    // Misma configuración que api/gemini/content.ts (action generateText): JSON forzado, gemini-2.5-flash.
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: { temperature: opts.temperature, maxOutputTokens: 12288, responseMimeType: 'application/json' },
    });
    const text = response.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') ?? '';
    let json: unknown = null;
    try {
      json = JSON.parse(text.replace(/```json\s*|\s*```/g, '').trim());
    } catch {
      /* el motor lo tolera */
    }
    return { success: true, text, json } as unknown as ModelResponse;
  };
}

function check(name: string, ok: boolean, extra = ''): boolean {
  console.log(`${ok ? 'OK ' : 'MAL'} ${name}${extra ? ' — ' + extra : ''}`);
  return ok;
}

function auditResult(res: Awaited<ReturnType<typeof runLaunchPlan>>, input: LaunchEngineInput) {
  const outline = buildOutline(input.todayISO);
  const slots = buildSlots(outline[0]);
  const ctx = {
    slots,
    catalog: input.catalog,
    confirmedClaims: input.seed.confirmedClaims,
    events: outline.flatMap(w => w.events),
  };
  const issues = validateTasks(res.tasks, ctx);
  const ids = new Set(input.catalog.map(c => c.id));
  const w1ok = res.tasks.every(t => t.recipeId && RECIPES[t.recipeId]?.enabled && (t.catalogItemIds ?? []).length > 0 && (t.catalogItemIds ?? []).every(i => ids.has(i)));
  return { issues, w1ok };
}

async function offline(): Promise<boolean> {
  let all = true;
  const input = () => baseInput(async () => null);

  // 1) Modelo devuelve basura / JSON roto -> plan determinista completo, validador verde
  for (const [label, resp] of [
    ['respuesta vacía', null],
    ['texto que no es JSON', 'Lo siento, no puedo ayudarte con eso.'],
    ['JSON cortado a la mitad', '{"strategySummary":"Hola","tasks":[{"slot":1,"title":"Algo","caption":"abc'],
    ['JSON con tareas vacías', { json: { strategySummary: '', tasks: [] } }],
  ] as Array<[string, ModelResponse]>) {
    const inp = baseInput(async () => resp);
    const res = await runLaunchPlan(inp);
    const { issues, w1ok } = auditResult(res, inp);
    all = check(`${label}: plan completo, validador verde`, res.tasks.length === 5 && issues.length === 0 && w1ok, `source=${res.source}, llamadas=${res.modelCalls}`) && all;
  }

  // 2) El modelo lanza error de red -> fallback
  {
    const inp = baseInput(async () => { throw new Error('503'); });
    const res = await runLaunchPlan(inp);
    const { issues } = auditResult(res, inp);
    all = check('error de red: fallback sin pantalla en blanco', res.tasks.length === 5 && issues.length === 0 && res.source === 'fallback') && all;
  }

  // 3) Respuesta hostil: claims, promesas, testimonios, emojis, jerga, marca ajena, fecha inventada, receta apagada, producto inexistente
  const bad = (n: number) => ({
    slot: n,
    title: 'Aros hipoalergénicos de plata 925',
    contentType: 'Foto',
    recipeId: n % 2 ? 'en_el_cuerpo' : 'video_giro',
    catalogItemIds: ['no-existe'],
    sceneBrief: 'Modelo con prompt de IA usando los aros en la mano',
    toolReason: 'Usa la IA para generar',
    caption: `Garantía de por vida 😍 Mis clientas dicen que son lo mejor, más de 500 clientas felices. Como Silene pero mejor. Oferta hasta el 19 de diciembre, quedan 3 unidades. {medida}`,
    hashtags: '#silene #hipoalergenico #aros',
    whyThisContent: 'Se va a hacer viral y vas a vender mucho',
    expectedResult: 'Vas a ganar 1000 seguidoras',
    howToMeasure: 'mira',
    engagementHook: 'x',
  });
  {
    const inp = baseInput(async () => ({ json: { strategySummary: 'Plan con IA viral', tasks: [1, 2, 3, 4, 5].map(bad) } }));
    const res = await runLaunchPlan(inp);
    const { issues, w1ok } = auditResult(res, inp);
    const vals: string[] = []; // solo los VALORES de texto (los nombres de campo, como "prompt", no son texto para ella)
    JSON.stringify(res.tasks, (_k, v) => { if (typeof v === 'string') vals.push(v); return v; });
    const blob = vals.join(' | ').toLowerCase();
    const leaks = ['hipoalerg', 'garant', 'silene', 'clientas', '500', 'quedan 3', 'viral', 'prompt', '{medida}', 'en_el_cuerpo', 'no-existe', '19 de diciembre'].filter(w => blob.includes(w));
    all = check('respuesta hostil: nada prohibido llega a la usuaria', issues.length === 0 && w1ok && leaks.length === 0, `source=${res.source}, llamadas=${res.modelCalls}, fugas=${leaks.join(',') || 'ninguna'}`) && all;
  }

  // 4) Respuesta buena -> pasa sin reparar
  {
    const good = (n: number, rid: string, pid: string, ht: string) => ({
      slot: n, title: `Idea ${n} para tus aros`, contentType: `Tipo ${n}`, recipeId: rid, catalogItemIds: [pid],
      sceneBrief: 'Aros sobre una superficie clara, luz suave de ventana, fondo liso y sin otros objetos.',
      toolReason: 'La foto se prepara con tu pieza real.',
      caption: 'Te muestro estos aros de cerca para que los veas bien antes de pedir. Si tienes dudas, escríbeme por mensaje directo y lo vemos juntas.',
      hashtags: ht, whyThisContent: 'Responde la duda de calidad antes de comprar.',
      expectedResult: 'Buscamos guardados y mensajes; esta semana define tu punto de partida.',
      howToMeasure: 'A las 48 horas, en las estadísticas, mira alcance y guardados.', engagementHook: 'Cuéntame cuál te gustó más.',
    });
    const ht = '#aroschile #arosdemoda #joyeriachilena #hechoamano #regalosdenavidadchile #aros';
    const tasks = [
      good(1, 'catalogo_limpio', 'cat-flor-seca', ht),
      good(2, 'detalle_macro', 'cat-gota-mar', ht),
      good(3, 'carrusel_educativo', 'cat-luna', ht),
      good(4, 'estilo_de_vida', 'cat-ola', ht),
      good(5, 'story_venta', 'cat-argolla-mini', ht),
    ];
    const inp = baseInput(async () => ({ json: { strategySummary: 'Esta semana presentamos tu pieza principal con fotos simples, respondemos dudas de compra y dejamos claro cómo pedir. No hay metas de números.', weekIdeas: [{ weekNumber: 2, ideas: ['Carrusel sobre qué revisar antes de comprar aros', 'Detalle de la terminación', 'Cómo cuidar tus aros'] }], tasks } }));
    const res = await runLaunchPlan(inp);
    const { issues } = auditResult(res, inp);
    all = check('respuesta buena: pasa a la primera con 1 llamada', res.source === 'model' && res.modelCalls === 1 && issues.length === 0, `source=${res.source}, reparaciones=${res.repairs.length}`) && all;
    all = check('ideas de la semana 2 vienen del modelo', (res.outline[1].ideas[0] ?? '').startsWith('Carrusel sobre')) && all;
  }

  // 5) Rotación: modelo repite producto y receta -> se corrige
  {
    const t = (n: number) => ({
      slot: n, title: `Aros destacados ${n}`, contentType: `Tipo ${n}`, recipeId: 'catalogo_limpio', catalogItemIds: ['cat-luna'],
      sceneBrief: 'Aros sobre fondo claro con luz suave, sin otros objetos en la escena.', toolReason: 'La foto se prepara con tu pieza real.',
      caption: 'Estos aros son de los que más me gusta mostrar. Escríbeme por mensaje directo si quieres pedirlos o tienes dudas.',
      hashtags: '#aroschile #arosdemoda #joyeriachilena #hechoamano #regalosdenavidadchile #aros',
      whyThisContent: 'Muestra la pieza tal como es.', expectedResult: 'Buscamos guardados y mensajes; esta semana define tu punto de partida.',
      howToMeasure: 'A las 48 horas, en las estadísticas, mira alcance y guardados.', engagementHook: 'Cuéntame cuál te gustó más.',
    });
    const inp = baseInput(async () => ({ json: { strategySummary: 'x', tasks: [1, 2, 3, 4, 5].map(t) } }));
    const res = await runLaunchPlan(inp);
    const { issues } = auditResult(res, inp);
    const recs = res.tasks.map(x => x.recipeId);
    const noRepeat = recs.every((r, i) => i === 0 || r !== recs[i - 1]);
    all = check('rotación: no repite receta ni pieza cercana', issues.length === 0 && noRepeat, `recetas=${recs.join(',')}`) && all;
  }

  // 6) Con claims confirmados sí se permiten
  {
    const inp = baseInput(async () => null);
    inp.seed.confirmedClaims = ['plata_925'];
    const outline = buildOutline(TODAY);
    const slots = buildSlots(outline[0]);
    const caption = 'Esta pieza es de plata 925, según me informó mi proveedor. Si dudas, escríbeme por mensaje directo.';
    const t = (await runLaunchPlan(baseInput(async () => null))).tasks[0];
    const issues = validateTasks([{ ...t, caption }, ...Array(4).fill(null).map((_, i) => ({ ...t, caption, date: slots[i + 1].date, platform: slots[i + 1].platform, format: slots[i + 1].format, funnelRole: slots[i + 1].funnelRole }))].slice(0, 1), {
      slots: slots.slice(0, 1), catalog: CATALOG, confirmedClaims: ['plata_925'], events: [],
    });
    const sin = validateTasks([{ ...t, caption }], { slots: slots.slice(0, 1), catalog: CATALOG, confirmedClaims: [], events: [] });
    all = check('claim "plata 925": permitido solo si ella lo confirmó', !issues.some(i => i.code === 'claim_no_confirmado') && sin.some(i => i.code === 'claim_no_confirmado')) && all;
  }

  // 7) Calendario
  {
    const o = buildOutline(TODAY);
    const bf = o.find(w => w.events.some(e => e.id === 'black-friday-2026'));
    const slots = buildSlots(o[0]);
    all = check('calendario: 6 semanas desde mañana 27-oct', o.length === 6 && o[0].startDate === '2026-10-27' && o[5].endDate === '2026-12-07') && all;
    all = check('Black Friday cae en la semana 5 (24 al 30 nov)', bf?.weekNumber === 5, bf ? `${bf.startDate}..${bf.endDate}` : '') && all;
    all = check('semana 6 avisa los cortes de despacho', o[5].events.some(e => e.id === 'corte-despacho-rm')) && all;
    all = check('semana 1: 5 huecos con fechas únicas', slots.length === 5 && new Set(slots.map(s => s.date)).size === 5, slots.map(s => s.dayLabel).join(' | ')) && all;
    all = check('todayInSantiago devuelve YYYY-MM-DD', /^\d{4}-\d{2}-\d{2}$/.test(todayInSantiago())) && all;
  }
  console.log(all ? '\nOFFLINE: TODO OK' : '\nOFFLINE: HAY FALLAS');
  return all;
}

async function live(runs: number): Promise<boolean> {
  const call = geminiCall();
  const results: unknown[] = [];
  let ok = true;
  for (let r = 1; r <= runs; r++) {
    const inp = baseInput(call);
    const t0 = Date.now();
    const res = await runLaunchPlan(inp);
    const secs = ((Date.now() - t0) / 1000).toFixed(1);
    const { issues, w1ok } = auditResult(res, inp);
    const formatErrors = res.repairs.filter(x => x.code === 'json_roto' || x.code === 'modelo_no_disponible').length;
    ok = check(`corrida ${r}: source=${res.source}, llamadas=${res.modelCalls}, reparaciones=${res.repairs.length}, ${secs}s`, issues.length === 0 && w1ok && res.tasks.length === 5 && formatErrors === 0) && ok;
    results.push({
      run: r,
      source: res.source,
      modelCalls: res.modelCalls,
      seconds: Number(secs),
      validatorIssues: issues.length,
      semana1ConRecetaYProductoReal: w1ok,
      reparaciones: res.repairs.map(x => `${x.taskIndex}:${x.field}:${x.code}`),
      result: res,
    });
  }
  console.log(`Llamadas al modelo usadas: ${modelCalls}/${MAX_CALLS}`);
  const out = {
    generadoEn: new Date().toISOString(),
    marcaDePrueba: 'Mar de Resina (aros de resina y acero, precios bajos)',
    hoy: TODAY,
    catalogo: CATALOG.map(c => ({ id: c.id, nombre: c.name, material: c.material, color: c.color, precio: c.priceCLP, rol: c.role })),
    llamadasAlModelo: modelCalls,
    corridas: results,
  };
  writeFileSync(OUT, JSON.stringify(out, null, 2), 'utf-8');
  console.log(`Guardado en ${OUT}`);
  return ok;
}

const mode = process.argv[2] || 'offline';
const good = mode === 'live' ? await live(Number(process.argv[3] || 3)) : await offline();
process.exit(good ? 0 : 1);
