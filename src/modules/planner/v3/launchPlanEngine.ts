// ─────────────────────────────────────────────────────────────────
// PLANNER V3 — Motor del plan de lanzamiento (joyería)
//
// Puro y sin dependencias de red/Firebase: recibe una función
// `callModel` que le entrega el servicio (o un script de prueba).
//
// Qué hace:
//  1. Arma el prompt con: marca, playbook joyería, calendario real,
//     catálogo real, recetas encendidas y banco de textos.
//  2. Pide al modelo la semana detallada + ideas de las semanas siguientes.
//  3. Normaliza, arregla lo que se puede arreglar sin modelo y valida.
//  4. Si falla, reintenta UNA vez diciéndole al modelo qué estuvo mal.
//  5. Lo que aún no pase se rellena con texto determinista (plantillas
//     seguras). Con JSON roto o modelo caído devuelve un plan completo
//     determinista: nunca una pantalla en blanco.
// ─────────────────────────────────────────────────────────────────

import type { CatalogItem, PilotPlanTask, PilotSeed, RecipeId } from '../../piloto/types';
import { RECIPES, enabledRecipeIds, recipesForFormat, recipesForPrompt } from '../../piloto/recipes';
import type { FunnelRole, WeekHistorySummary } from './plannerV3Types';
import type { LaunchOutlineWeek, LaunchPlanResult, LaunchSlot, ValidationIssue } from './launchTypes';
import { buildOutline, buildSlots, dayLabel, funnelMix, shortDate } from './launchCalendar';
import { pickPlaybook } from './playbooks';
import {
  AI_DISCLOSURE_REMINDER,
  AI_DISCLOSURE_TASK_STEP,
  CLAIM_RULES,
  CTAS,
  ESTRUCTURAS_CAPTION,
  GANCHOS,
  fold,
  formatCLP,
  hashtagCandidates,
  stripEmojis,
} from './jewelryCopy';
import {
  type ValidationContext,
  TEXT_FIELDS,
  hashtagIssues,
  parseHashtags,
  summarizeIssues,
  textIssues,
  validateFreeText,
  validateTasks,
} from './launchPlanValidator';

// ── Entradas y salida ────────────────────────────────────────────

export type ModelResponse = { json?: unknown; text?: string } | string | null | undefined;

export interface LaunchEngineInput {
  brandName: string;
  /** Resultado de serializeBrandForAI(brand) */
  brandText: string;
  mainCategory: string;
  shortDescription: string;
  seed: Pick<PilotSeed, 'categories' | 'material' | 'materialNote' | 'priceRange' | 'audience' | 'voice' | 'confirmedClaims'>;
  catalog: CatalogItem[];
  /** "YYYY-MM-DD" de hoy en Chile */
  todayISO: string;
  /** Semana a detallar (1 = la primera). Por defecto 1. */
  weekNumber?: number;
  /** Esquema de las 6 semanas ya guardado (si se está detallando la semana 2-6) */
  outline?: LaunchOutlineWeek[];
  history?: WeekHistorySummary[];
  /** Tareas de la semana anterior, para no repetir producto/receta al cambiar de semana */
  previousTasks?: PilotPlanTask[];
  /** Llama al modelo de texto. Debe devolver {json?, text?} como el endpoint, o el texto crudo. */
  callModel: (prompt: string, opts: { temperature: number; attempt: number }) => Promise<ModelResponse>;
  /** Máximo de llamadas al modelo (por defecto 2: una + un reintento) */
  maxModelCalls?: number;
}

// ── Utilidades ───────────────────────────────────────────────────

function newId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, ch => {
    const r = (Math.random() * 16) | 0;
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/** Lee JSON del modelo de forma tolerante (cercas de código, texto antes/después, comas sobrantes). */
export function tolerantParse(resp: ModelResponse): Record<string, unknown> | null {
  if (!resp) return null;
  if (typeof resp === 'object' && resp.json && typeof resp.json === 'object') return resp.json as Record<string, unknown>;
  const raw = typeof resp === 'string' ? resp : resp.text || '';
  if (!raw.trim()) return null;
  const clean = raw.replace(/```json\s*|```/g, '').trim();
  const start = clean.indexOf('{');
  const end = clean.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  const body = clean.slice(start, end + 1);
  const attempts = [body, body.replace(/,\s*([}\]])/g, '$1')];
  for (const a of attempts) {
    try {
      const parsed = JSON.parse(a);
      if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>;
    } catch {
      /* siguiente intento */
    }
  }
  return null;
}

const CATEGORY_LABEL: Record<string, { plural: string; singular: string }> = {
  aros: { plural: 'aros', singular: 'aros' },
  collares: { plural: 'collares', singular: 'collar' },
  anillos: { plural: 'anillos', singular: 'anillo' },
  pulseras: { plural: 'pulseras', singular: 'pulsera' },
  accesorios: { plural: 'accesorios', singular: 'accesorio' },
};

const VOICE_TEXT: Record<PilotSeed['voice'], string> = {
  calida: 'cálida y cercana, como conversar con una amiga',
  elegante: 'elegante y tranquila, frases cortas y pulidas, sin exclamaciones',
  juvenil: 'juvenil y fresca, directa y simpática, sin exagerar',
};

const AUDIENCE_TEXT: Record<PilotSeed['audience'], string> = {
  jovenes: 'mujeres jóvenes (universitarias y primeras pegas)',
  adultas: 'mujeres adultas que buscan piezas para el día a día',
  regalos: 'personas que buscan un regalo para alguien',
  no_se: 'todavía no está definido: habla en general',
};

const PRICE_TEXT: Record<PilotSeed['priceRange'], string> = {
  bajo: 'precios bajos (accesible)',
  medio: 'precios medios',
  alto: 'precios altos (pieza de más valor)',
};

const MATERIAL_TEXT: Record<PilotSeed['material'], string> = {
  plata_925: 'plata 925',
  banado: 'baño (de oro u otro metal)',
  acero: 'acero',
  otro: 'otro material',
  no_se: 'no sabe / sin confirmar',
};

const CLAIM_LABEL: Record<PilotSeed['confirmedClaims'][number], string> = {
  plata_925: 'plata 925',
  hipoalergenico: 'hipoalergénico',
  garantia: 'garantía',
  banado_oro: 'baño de oro',
};

function roleLabel(r: FunnelRole): string {
  return { atraer: 'atraer gente nueva', generar_deseo: 'generar deseo', construir_confianza: 'construir confianza', convertir: 'convertir en pedidos' }[r];
}

function rotationOrder(catalog: CatalogItem[]): CatalogItem[] {
  const weight = (c: CatalogItem) => (c.role === 'nuevo' ? 0 : c.role === 'ancla' ? 1 : 2);
  return [...catalog].sort((a, b) => weight(a) - weight(b));
}

/** Parte del material que se puede nombrar sin afirmar un claim no confirmado. */
function safeMaterial(item: CatalogItem, claims: PilotSeed['confirmedClaims']): string {
  const m = (item.material || '').trim();
  if (!m) return '';
  const f = fold(m);
  for (const rule of CLAIM_RULES) {
    if (rule.pattern.test(f) && !(rule.requires && claims.includes(rule.requires))) return '';
  }
  return m;
}

// ── Prompt ───────────────────────────────────────────────────────

function serializeCatalog(catalog: CatalogItem[], claims: PilotSeed['confirmedClaims']): string {
  return catalog
    .map(c => {
      const mat = safeMaterial(c, claims);
      const parts = [
        `id: ${c.id}`,
        `nombre: ${c.name}`,
        `categoría: ${CATEGORY_LABEL[c.category]?.singular ?? c.category}`,
        mat ? `material: ${mat}` : 'material: (sin confirmar: no lo nombres)',
        c.color ? `color: ${c.color}` : '',
        typeof c.priceCLP === 'number' ? `precio: ${formatCLP(c.priceCLP)}` : 'precio: (no informado: no lo nombres)',
        `rol: ${c.role === 'ancla' ? 'ANCLA (la pieza principal: aparece más seguido)' : c.role === 'nuevo' ? 'NUEVA (destácala esta semana)' : 'normal'}`,
      ].filter(Boolean);
      return `- ${parts.join(' | ')}`;
    })
    .join('\n');
}

function serializeHistoryShort(history: WeekHistorySummary[] | undefined): string {
  if (!history?.length) {
    return 'Sin historial: es la primera semana. Los resultados esperados deben ser cualitativos y honestos (ej: "esta semana definimos tu punto de partida"), NUNCA números inventados.';
  }
  return history
    .map(h => {
      const p = [`Semana ${h.weekNumber}: tipos usados ${h.contentTypes.join(', ')}`, `cumplimiento ${Math.round(h.completionRate * 100)}%`];
      if (h.topPerformer) p.push(`MEJOR: ${h.topPerformer}`);
      if (h.worstPerformer) p.push(`peor: ${h.worstPerformer}`);
      if (h.reportRecommendations.length) p.push(`recomendaciones: ${h.reportRecommendations.join('; ')}`);
      return p.join(' | ');
    })
    .join('\n');
}

function serializeSlots(slots: LaunchSlot[]): string {
  return slots
    .map(s => {
      const rec = recipesForFormat(s.format).join(', ');
      return `${s.index + 1}. ${s.dayLabel} (${s.date}) · ${s.platform} · formato ${s.format} · rol ${roleLabel(s.funnelRole)} · hora ${s.suggestedTime} · recetas permitidas: ${rec}`;
    })
    .join('\n');
}

function serializeOutline(outline: LaunchOutlineWeek[], detailWeek: number): string {
  return outline
    .map(w => {
      const ev = w.events.length ? ` Fechas clave: ${w.events.map(e => `${e.label} [${e.date}${e.endDate ? ' a ' + e.endDate : ''}; evidencia ${e.evidence}]`).join(' | ')}.` : '';
      return `Semana ${w.weekNumber} (${shortDate(w.startDate)} al ${shortDate(w.endDate)})${w.weekNumber === detailWeek ? ' <- LA QUE DETALLAS' : ''}: ${w.theme}. ${w.objective}${ev}`;
    })
    .join('\n');
}

function serializeCopyBank(slots: LaunchSlot[]): string {
  const formats = new Set(slots.map(s => (s.format === 'Foto' ? 'foto' : s.format === 'Carrusel' ? 'carrusel' : 'story')));
  const ganchos = GANCHOS.filter(g => formats.has(g.formato)).map(g => `- ${g.texto}`).join('\n');
  const ctas = CTAS.filter(c => !c.texto.includes('{') || c.texto.includes('{fecha_corte}')).map(c => `- [${c.objetivo}] ${c.texto}`).join('\n');
  const est = ESTRUCTURAS_CAPTION.map(e => `- ${e.nombre}: ${e.plantilla}`).join('\n');
  return `GANCHOS (inspiración; reescríbelos con tus palabras, no copies literal):\n${ganchos}\n\nLLAMADOS A LA ACCIÓN (elige uno por caption):\n${ctas}\n\nESTRUCTURAS DE CAPTION (esquemas, no plantillas rígidas):\n${est}\nLos {datos entre llaves} solo se rellenan con información real que aparezca arriba; si falta el dato, no uses esa frase.`;
}

export function buildLaunchPrompt(input: LaunchEngineInput, slots: LaunchSlot[], outline: LaunchOutlineWeek[], extra?: { issues?: string }): string {
  const week = input.weekNumber ?? 1;
  const playbook = pickPlaybook(input.mainCategory, input.shortDescription);
  const claims = input.seed.confirmedClaims;
  const tags = hashtagCandidates(input.seed);
  const confirmed = claims.length ? claims.map(c => CLAIM_LABEL[c]).join(', ') : 'NINGUNO';
  const otherWeeks = outline.filter(w => w.weekNumber !== week).map(w => w.weekNumber);
  const lastPrev = (input.previousTasks ?? []).slice(-2).map(t => `${t.recipeId ?? '?'} con ${(t.catalogItemIds ?? []).join(',')}`);

  return `Eres la estratega de contenido de una marca chilena de joyería que parte DESDE CERO SEGUIDORAS. Le hablas a la dueña (no programa, no es de marketing): español de Chile, tuteo, cercano, sin jerga.

Tu tarea: dejar lista la SEMANA ${week} del calendario de lanzamiento (con todos los textos para publicar) y proponer ideas para las otras semanas. La app produce las imágenes sola a partir de la receta que elijas y las fotos reales de la pieza: la dueña no configura nada.

═══ LA MARCA ═══
${input.brandText}
Lo que vende: ${input.seed.categories.map(c => CATEGORY_LABEL[c]?.plural ?? c).join(', ')}
Material (según ella): ${MATERIAL_TEXT[input.seed.material]}${input.seed.materialNote ? ` (${input.seed.materialNote})` : ''}
Rango de precios: ${PRICE_TEXT[input.seed.priceRange]}
A quién le vende: ${AUDIENCE_TEXT[input.seed.audience]}
Voz: ${VOICE_TEXT[input.seed.voice]}
Datos que ELLA confirmó y que SÍ puedes afirmar: ${confirmed}
Todo lo demás (hipoalergénico, garantía, plata 925, baño de oro, acero quirúrgico, resistencia al agua, "no se oscurece"...) NO está confirmado: no lo afirmes.

═══ CATÁLOGO REAL (elige SOLO estos ids, copiados exactos) ═══
${serializeCatalog(input.catalog, claims)}
Usa solo nombre, categoría, material, color y precio de arriba. NO inventes medidas, pesos, número de piedras ni otras características de la pieza.

═══ CONOCIMIENTO DEL RUBRO (estudio de mercado) ═══
${playbook.content}

═══ CALENDARIO DE LANZAMIENTO (6 semanas, hoy es ${input.todayISO}) ═══
${serializeOutline(outline, week)}
Embudo para quien parte de cero: ~40% atraer, 30% generar deseo, 20% construir confianza, 10% convertir al inicio; convertir sube solo en Black Friday y Navidad. Los roles de cada hueco ya están decididos abajo.

═══ HISTORIAL Y DATOS REALES ═══
${serializeHistoryShort(input.history)}
${lastPrev.length ? `Últimas publicaciones de la semana anterior (no repitas esas combinaciones al empezar): ${lastPrev.join(' ; ')}` : ''}

═══ RECETAS DISPONIBLES (elige una por tarea; no existe otra) ═══
${recipesForPrompt()}
No hay videos, personas, manos ni modelos en esta versión: solo imágenes de la pieza real.

═══ LOS ${slots.length} HUECOS DE LA SEMANA ${week} (fecha, red, formato y rol ya están decididos; tú eliges receta, pieza y textos) ═══
${serializeSlots(slots)}

═══ BANCO DE TEXTOS ═══
${serializeCopyBank(slots)}

═══ HASHTAGS (elige 6 por publicación de esta lista: 3 de nicho, 2 medios y 1 grande; no inventes los de otras marcas) ═══
nicho: ${tags.nicho.join(' ')}
medio: ${tags.medio.join(' ')}
grande: ${tags.grande.join(' ')}
Puedes agregar uno propio de la marca como #${fold(input.brandName).replace(/[^a-z0-9]/g, '') || 'tumarca'} (solo si cabe en el máximo de 8).

═══ REGLAS ESTRICTAS ═══
1. ROTACIÓN: no repitas la misma pieza en dos publicaciones seguidas ni con una de por medio (si el catálogo tiene 3 o más piezas); no repitas la misma receta dos veces seguidas. La pieza ANCLA aparece más seguido; la NUEVA aparece pronto. Usa 1 pieza por tarea (máximo 2 en flatlay_regalo y carrusel_educativo).
2. RECETA: la receta debe servir para el formato del hueco. En story_venta y carrusel_educativo el sceneBrief incluye el texto exacto que va sobre la imagen (corto).
3. VARIEDAD: no repitas el mismo contentType en la semana. Cada publicación responde UNA duda de compra o despierta UN deseo.
4. CAPTIONS: 2 a 4 párrafos cortos, máximo 600 caracteres, primera línea que enganche, cierre con un solo llamado a la acción (mensaje directo, guardar o compartir). Listos para copiar y pegar. Español de Chile, tuteo.
5. SIN EMOJIS en ningún texto.
6. PROHIBIDO en cualquier texto: las palabras "IA", "prompt", "modelo", "algoritmo"; promesas de resultados; "viral"; testimonios, reseñas, "mis clientas dicen"; cifras de ventas, clientas o seguidoras; escasez falsa ("quedan 3", "últimas unidades"); nombrar a otras marcas; afirmar materiales o garantías no confirmados.
7. FECHAS: solo menciona fechas que estén en el calendario de arriba (Black Friday 27 al 30 de noviembre, último día de pedido sugerido 14 y 18 de diciembre, Nochebuena 24, Navidad 25) o las fechas de los huecos. Ofertas o descuentos: solo di que existen si la marca los definió (no hay datos: NO inventes porcentajes ni cupones).
8. HONESTIDAD en expectedResult: sin datos reales, sé cualitativa ("buscamos guardados y mensajes; esta semana define tu punto de partida"). Cero números inventados.
9. howToMeasure: di qué número mirar, dónde y cuándo ("a las 48 horas, en las estadísticas de la publicación, mira alcance y guardados").
10. toolReason, whyThisContent y engagementHook: lenguaje simple de emprendedora. toolReason explica por qué esa foto ayuda a vender, en una frase (no hables de herramientas).
11. sceneBrief: describe la escena concreta (superficie, fondo, luz, encuadre) SIN personas, SIN manos y sin objetos que cambien el producto. Es una instrucción para fotografiar la pieza real; nunca para inventarla distinta.
12. Primeras ventas: el hueco de WhatsApp Estados es para el círculo cercano (amigas, familia, conocidas): tono cercano y directo.
13. ${otherWeeks.length ? `weekIdeas: para las semanas ${otherWeeks.join(', ')} entrega 3 ideas cortas cada una (máximo 120 caracteres por idea, sin emojis), coherentes con el tema de esa semana. Son un esquema: se detallan al cerrar cada semana.` : 'weekIdeas puede ir vacío.'}
14. strategySummary: 3 o 4 frases simples que expliquen cómo está armada la semana ${week} y por qué, como se lo contarías a la dueña tomando un café. Sin cifras inventadas.

${extra?.issues ? `═══ ESTA ES TU SEGUNDA OPORTUNIDAD ═══\nTu respuesta anterior tuvo estos problemas; corrígelos todos:\n${extra.issues}\n` : ''}═══ FORMATO DE RESPUESTA ═══
Responde ÚNICAMENTE con un objeto JSON válido, sin texto adicional ni comentarios:
{
  "strategySummary": "string",
  "weekIdeas": [{"weekNumber": number, "ideas": ["string", "string", "string"]}],
  "tasks": [
    {
      "slot": 1,
      "title": "idea en una frase",
      "contentType": "ej: Foto de catálogo, Detalle de cerca, Carrusel de dudas, Story de pedido",
      "recipeId": "una de las recetas permitidas del hueco",
      "catalogItemIds": ["id exacto del catálogo"],
      "sceneBrief": "string",
      "toolReason": "string",
      "caption": "string",
      "hashtags": "#uno #dos #tres #cuatro #cinco #seis",
      "whyThisContent": "string",
      "expectedResult": "string",
      "howToMeasure": "string",
      "engagementHook": "string"
    }
  ]
}
Entrega exactamente ${slots.length} tareas, con "slot" de 1 a ${slots.length}.`;
}

// ── Normalización y arreglos sin modelo ──────────────────────────

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

interface RawTask extends Record<string, unknown> {
  slot?: unknown;
}

function pickRawTasks(parsed: Record<string, unknown> | null, slotCount: number): Array<RawTask | null> {
  const list = Array.isArray(parsed?.tasks) ? (parsed!.tasks as unknown[]) : [];
  const bySlot: Array<RawTask | null> = Array.from({ length: slotCount }, () => null);
  list.forEach((t, i) => {
    if (!t || typeof t !== 'object') return;
    const rt = t as RawTask;
    const n = Number(rt.slot);
    const idx = Number.isInteger(n) && n >= 1 && n <= slotCount ? n - 1 : i;
    if (idx >= 0 && idx < slotCount && !bySlot[idx]) bySlot[idx] = rt;
  });
  return bySlot;
}

function jargonFix(text: string): string {
  return text
    .replace(/(^|[^a-zA-Záéíóúñ])IA([^a-zA-Záéíóúñ]|$)/g, '$1inteligencia artificial$2')
    .replace(/\bmodelos\b/gi, 'diseños')
    .replace(/\bmodelo\b/gi, 'diseño')
    .replace(/\bprompts?\b/gi, 'indicación')
    .replace(/\balgoritmos?\b/gi, 'sistema');
}

function cleanText(text: string, repairs: ValidationIssue[], idx: number, field: string): string {
  let t = text;
  const noEmoji = stripEmojis(t);
  if (noEmoji !== t) repairs.push({ taskIndex: idx, field, code: 'emoji', message: 'Se quitaron emojis.', severity: 'repaired' });
  t = noEmoji;
  const fixed = jargonFix(t);
  if (fixed !== t) repairs.push({ taskIndex: idx, field, code: 'jerga', message: 'Se reemplazó jerga.', severity: 'repaired' });
  return fixed.replace(/[ \t]+\n/g, '\n').trim();
}

function normalizeRecipe(v: unknown): RecipeId | undefined {
  const s = str(v).toLowerCase().replace(/[\s-]+/g, '_');
  return (Object.keys(RECIPES) as RecipeId[]).find(id => id === s);
}

function buildHashtagsFallback(input: Pick<LaunchEngineInput, 'seed' | 'brandName'>, current: string[], salt: number): string[] {
  const cand = hashtagCandidates(input.seed);
  const pick = (arr: string[], n: number, out: string[]) => {
    const pool = arr.filter(t => !out.includes(t));
    for (let i = 0; i < pool.length && n > 0; i++) {
      const t = pool[(i + salt) % pool.length];
      if (!out.includes(t)) {
        out.push(t);
        n--;
      }
    }
  };
  const out = [...current];
  const target = 6;
  const need = Math.max(0, target - out.length);
  if (need) {
    // prioridad: nicho, medio, grande
    const nNiche = Math.min(3, need);
    pick(cand.nicho, nNiche, out);
    pick(cand.medio, Math.min(2, target - out.length), out);
    pick(cand.grande, Math.max(0, target - out.length), out);
    pick(cand.nicho, Math.max(0, target - out.length), out);
  }
  return out.slice(0, 8);
}

/** Elimina del texto de hashtags los que no pasan; devuelve la lista limpia. */
function cleanHashtags(raw: string, ctx: ValidationContext, input: LaunchEngineInput, salt: number): { value: string; changed: boolean } {
  const tags = parseHashtags(raw);
  const keep: string[] = [];
  for (const t of tags) {
    if (hashtagIssues(t + ' #aaa #bbb #ccc #ddd #eee', ctx).some(i => i.code !== 'hashtags_cantidad')) continue;
    if (!keep.some(k => k.toLowerCase() === t.toLowerCase())) keep.push(t);
  }
  const final = keep.length >= 5 && keep.length <= 8 ? keep : buildHashtagsFallback(input, keep.slice(0, 8), salt);
  const value = final.join(' ');
  return { value, changed: value !== tags.join(' ') };
}

// ── Relleno determinista ─────────────────────────────────────────

const FALLBACK_TITLES: Record<RecipeId, (n: string) => string> = {
  catalogo_limpio: n => `${n}, tal como es`,
  detalle_macro: n => `El detalle de ${n}, de cerca`,
  flatlay_regalo: n => `${n} como idea de regalo`,
  estilo_de_vida: n => `${n} en tu día a día`,
  carrusel_educativo: () => 'Antes de comprar joyas online: 3 cosas para revisar',
  story_venta: n => `${n}: pídela por mensaje`,
  en_el_cuerpo: n => n,
  escala: n => n,
  video_giro: n => n,
  video_me_lo_puse: n => n,
};

const FALLBACK_CONTENT_TYPE: Record<RecipeId, string> = {
  catalogo_limpio: 'Foto de la pieza',
  detalle_macro: 'Detalle de cerca',
  flatlay_regalo: 'Idea de regalo',
  estilo_de_vida: 'La pieza en un ambiente',
  carrusel_educativo: 'Carrusel de dudas',
  story_venta: 'Story para pedir',
  en_el_cuerpo: 'La pieza puesta',
  escala: 'Tamaño real',
  video_giro: 'Video',
  video_me_lo_puse: 'Video',
};

const FALLBACK_WHY: Record<FunnelRole, string[]> = {
  atraer: [
    'Una foto limpia y bonita de tu pieza es lo que hace que alguien nueva se detenga y entienda qué vendes.',
    'Mostrar la pieza tal como es ayuda a que te encuentren y a que confíen desde el primer vistazo.',
  ],
  generar_deseo: [
    'Ver la pieza de cerca y bien iluminada despierta las ganas de tenerla y responde la duda de calidad.',
    'Una escena simple con tu pieza ayuda a imaginarla en la vida de quien la mira.',
  ],
  construir_confianza: [
    'Explicar lo que se revisa antes de comprar joyas por internet te muestra como alguien que sabe y cuida a quien compra.',
    'Responder una duda frecuente baja el miedo a comprar online y hace que te escriban.',
  ],
  convertir: [
    'Es el momento de decir cómo pedir. Tu círculo cercano suele ser quien compra primero.',
    'Una story directa con la pieza y cómo pedirla facilita que te escriban para comprar.',
  ],
};

const FALLBACK_EXPECTED = 'Buscamos guardados, compartidos y mensajes. Esta semana define tu punto de partida: no hay una meta de números.';
const FALLBACK_MEASURE = 'A las 48 horas, en las estadísticas de la publicación, mira alcance y guardados, y anota cuántos mensajes recibiste.';

function ctaFor(role: FunnelRole, salt: number): string {
  const wanted = role === 'convertir' ? ['dm', 'compra'] : role === 'construir_confianza' ? ['guardar', 'dm'] : role === 'generar_deseo' ? ['comentar', 'guardar'] : ['compartir', 'seguir', 'guardar'];
  const pool = CTAS.filter(c => wanted.includes(c.objetivo) && !c.texto.includes('{') && !/link|bio/i.test(c.texto));
  return pool[salt % pool.length].texto;
}

function fallbackCaption(item: CatalogItem, recipe: RecipeId, slot: LaunchSlot, input: LaunchEngineInput, salt: number): string {
  const mat = safeMaterial(item, input.seed.confirmedClaims);
  const price = typeof item.priceCLP === 'number' ? formatCLP(item.priceCLP) : '';
  const matPhrase = mat ? ` Material: ${mat}.` : '';
  const pricePhrase = price ? ` Valor: ${price}.` : ' Si quieres saber el valor, escríbeme.';
  const cta = ctaFor(slot.funnelRole, salt);
  const name = item.name;
  const color = item.color ? ` en ${item.color}` : '';
  switch (recipe) {
    case 'carrusel_educativo':
      return `Antes de comprar joyas por internet, revisa estas tres cosas.\n\n1) El tamaño real de la pieza, no solo la foto. 2) De qué material es y cómo se cuida. 3) Qué pasa si no te queda o no te gusta.\n\nYo te cuento todo eso de ${name} antes de que pidas.\n\n${cta}`;
    case 'story_venta':
      return `${name}${color}. Si te gustó, escríbeme y te cuento cómo pedirla.${matPhrase}${pricePhrase}\n\n${cta}`;
    case 'flatlay_regalo':
      return `¿Buscas un regalo que se vea pensado? ${name}${color} es de esas piezas fáciles de regalar.${matPhrase}${pricePhrase}\n\n${cta}`;
    case 'detalle_macro':
      return `Así se ve ${name} de cerca. Me gusta mostrar los detalles reales, sin retoques que cambien la pieza.${matPhrase}\n\nCuéntame qué detalle te gustó más.\n\n${cta}`;
    case 'estilo_de_vida':
      return `${name}${color} es de esas piezas simples que se llevan todos los días.${matPhrase}\n\nPuedes combinarla con lo que ya tienes en el clóset.\n\n${cta}`;
    default:
      return `Te presento ${name}${color}.${matPhrase}${pricePhrase}\n\nEstoy mostrando mis piezas de a una para que las veas bien antes de pedir.\n\n${cta}`;
  }
}

function fallbackScene(item: CatalogItem, recipe: RecipeId): string {
  const base = RECIPES[recipe].fallbackScene;
  return `${base} Pieza: ${item.name}${item.color ? `, color ${item.color}` : ''}. No agregar ni quitar detalles a la pieza.`;
}

/** Tarea completa y segura para un hueco, con la pieza y la receta indicadas. */
export function fallbackTask(
  slot: LaunchSlot,
  item: CatalogItem,
  recipe: RecipeId,
  input: LaunchEngineInput,
  salt: number,
): PilotPlanTask {
  const why = FALLBACK_WHY[slot.funnelRole];
  const hashtags = buildHashtagsFallback(input, [], salt).join(' ');
  return {
    id: newId(),
    date: slot.date,
    dayLabel: slot.dayLabel,
    status: 'pending',
    title: FALLBACK_TITLES[recipe](item.name),
    contentType: FALLBACK_CONTENT_TYPE[recipe],
    format: slot.format,
    platform: slot.platform,
    suggestedTime: slot.suggestedTime,
    funnelRole: slot.funnelRole,
    toolModule: 'none',
    toolReason: 'Tu foto se prepara con tu pieza real: no tienes que configurar nada, solo revisarla.',
    prompt: '',
    caption: fallbackCaption(item, recipe, slot, input, salt),
    hashtags,
    whatToUpload: [],
    howToConfigure: [AI_DISCLOSURE_TASK_STEP],
    whyThisContent: why[salt % why.length],
    expectedResult: FALLBACK_EXPECTED,
    howToMeasure: FALLBACK_MEASURE,
    engagementHook: ctaFor(slot.funnelRole, salt + 1),
    recipeId: recipe,
    catalogItemIds: [item.id],
    sceneBrief: fallbackScene(item, recipe),
    generationStatus: 'idle',
    assets: [],
  };
}

const RECIPE_PREFERENCE: Record<FunnelRole, RecipeId[]> = {
  atraer: ['catalogo_limpio', 'flatlay_regalo', 'estilo_de_vida', 'detalle_macro'],
  generar_deseo: ['detalle_macro', 'estilo_de_vida', 'flatlay_regalo', 'catalogo_limpio'],
  construir_confianza: ['carrusel_educativo', 'detalle_macro', 'catalogo_limpio'],
  convertir: ['story_venta', 'flatlay_regalo', 'catalogo_limpio'],
};

function chooseRecipe(slot: LaunchSlot, prev: RecipeId | undefined, used: RecipeId[]): RecipeId {
  const ok = recipesForFormat(slot.format);
  const pref = RECIPE_PREFERENCE[slot.funnelRole].filter(r => ok.includes(r));
  const ordered = [...pref, ...ok.filter(r => !pref.includes(r))];
  return ordered.find(r => r !== prev && !used.includes(r)) ?? ordered.find(r => r !== prev) ?? ordered[0] ?? enabledRecipeIds()[0];
}

/** Elige la pieza menos usada que no choque con las vecinas. */
function chooseItem(catalog: CatalogItem[], recent: string[][], usage: Map<string, number>, windowSize: number): CatalogItem {
  const order = rotationOrder(catalog);
  const blocked = new Set(recent.slice(-windowSize).flat());
  const candidates = order.filter(c => !blocked.has(c.id));
  const pool = candidates.length ? candidates : order;
  // menos usada primero; el ancla puede repetirse antes (cuenta como media vez)
  const score = (c: CatalogItem) => (usage.get(c.id) ?? 0) * (c.role === 'ancla' ? 0.5 : 1);
  return [...pool].sort((a, b) => score(a) - score(b))[0];
}

function rotationWindow(catalogSize: number): number {
  return catalogSize >= 3 ? 2 : catalogSize === 2 ? 1 : 0;
}

function fallbackWeek(slots: LaunchSlot[], input: LaunchEngineInput, ctxPrev: Array<Pick<PilotPlanTask, 'recipeId' | 'catalogItemIds'>>): PilotPlanTask[] {
  const tasks: PilotPlanTask[] = [];
  const recentItems: string[][] = ctxPrev.map(t => t.catalogItemIds ?? []);
  const usage = new Map<string, number>();
  const usedRecipes: RecipeId[] = [];
  let prevRecipe = ctxPrev[ctxPrev.length - 1]?.recipeId;
  const win = rotationWindow(input.catalog.length);
  slots.forEach((slot, i) => {
    const item = chooseItem(input.catalog, recentItems, usage, win);
    const recipe = chooseRecipe(slot, prevRecipe, usedRecipes);
    tasks.push(fallbackTask(slot, item, recipe, input, i + (input.weekNumber ?? 1)));
    recentItems.push([item.id]);
    usage.set(item.id, (usage.get(item.id) ?? 0) + 1);
    usedRecipes.push(recipe);
    prevRecipe = recipe;
  });
  return tasks;
}

const FALLBACK_IDEAS: Record<number, string[]> = {
  1: ['Presenta tu pieza principal con una foto limpia', 'Cuenta en una story cómo se pide', 'Avisa a tu círculo cercano por WhatsApp'],
  2: ['Carrusel: qué revisar antes de comprar aros por internet', 'Detalle de cerca de la terminación', 'Cómo cuidar tus joyas para que duren más'],
  3: ['Una misma pieza en tres ambientes distintos', 'Pregunta en stories qué quieren ver', 'Compara dos piezas del catálogo'],
  4: ['Avisa qué viene en Black Friday', 'Ideas de regalo por presupuesto', 'Deja claro cómo pedir y cuándo despachas'],
  5: ['Tus piezas favoritas para regalar esta semana', 'Cómo pedir y en cuánto tiempo llega', 'Recordatorio de los días de Black Friday'],
  6: ['Guía de regalos de Navidad por presupuesto', 'Último día sugerido de pedido, con fecha clara', 'Cómo llega el regalo envuelto'],
};

export function fallbackSummary(week: number, outline: LaunchOutlineWeek[]): string {
  const w = outline.find(x => x.weekNumber === week);
  return `Esta semana nos enfocamos en "${w?.theme ?? 'presentar tu marca'}". ${w?.objective ?? ''} Partimos mostrando tu pieza real con fotos simples y claras, respondemos las dudas de quien compra por internet y dejamos claro cómo pedir. No hay metas de números: esta semana define tu punto de partida.`.replace(/\s+/g, ' ').trim();
}

// ── Orquestación ─────────────────────────────────────────────────

interface Normalized {
  tasks: PilotPlanTask[];
  summary: string;
  ideas: Map<number, string[]>;
  repairs: ValidationIssue[];
}

function normalize(parsed: Record<string, unknown> | null, slots: LaunchSlot[], input: LaunchEngineInput, ctx: ValidationContext): Normalized {
  const repairs: ValidationIssue[] = [];
  const raws = pickRawTasks(parsed, slots.length);
  const known = new Map(input.catalog.map(c => [c.id, c]));
  const tasks: PilotPlanTask[] = slots.map((slot, i) => {
    const r = raws[i] ?? {};
    const f = (k: string) => cleanText(str(r[k]), repairs, i, k);
    const recipeId = normalizeRecipe(r.recipeId);
    let ids = Array.isArray(r.catalogItemIds) ? (r.catalogItemIds as unknown[]).map(x => str(x)).filter(Boolean) : [];
    ids = Array.from(new Set(ids)).filter(id => known.has(id));
    if (recipeId && RECIPES[recipeId]) ids = ids.slice(0, RECIPES[recipeId].maxProducts);
    const hashtags = cleanHashtags(str(r.hashtags), ctx, input, i + (input.weekNumber ?? 1));
    if (hashtags.changed && str(r.hashtags)) {
      repairs.push({ taskIndex: i, field: 'hashtags', code: 'hashtags', message: 'Se limpiaron los hashtags.', severity: 'repaired' });
    }
    const task: PilotPlanTask = {
      id: newId(),
      date: slot.date,
      dayLabel: slot.dayLabel,
      status: 'pending',
      title: f('title'),
      contentType: f('contentType'),
      format: slot.format,
      platform: slot.platform,
      suggestedTime: slot.suggestedTime,
      funnelRole: slot.funnelRole,
      toolModule: 'none',
      toolReason: f('toolReason'),
      prompt: '',
      caption: f('caption'),
      hashtags: hashtags.value,
      whatToUpload: [],
      howToConfigure: [AI_DISCLOSURE_TASK_STEP],
      whyThisContent: f('whyThisContent'),
      expectedResult: f('expectedResult'),
      howToMeasure: f('howToMeasure'),
      engagementHook: f('engagementHook'),
      recipeId,
      catalogItemIds: ids,
      sceneBrief: f('sceneBrief'),
      generationStatus: 'idle',
      assets: [],
    };
    return task;
  });

  const ideas = new Map<number, string[]>();
  const wi = Array.isArray(parsed?.weekIdeas) ? (parsed!.weekIdeas as unknown[]) : [];
  for (const entry of wi) {
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as { weekNumber?: unknown; ideas?: unknown };
    const n = Number(e.weekNumber);
    if (!Number.isInteger(n) || !Array.isArray(e.ideas)) continue;
    const list = (e.ideas as unknown[])
      .map(x => stripEmojis(jargonFix(str(x))))
      .filter(x => x.length >= 8 && x.length <= 160 && validateFreeText(x, ctx, 8))
      .slice(0, 4);
    if (list.length) ideas.set(n, list);
  }
  return { tasks, summary: cleanText(str(parsed?.summary ?? parsed?.strategySummary), repairs, -1, 'strategySummary'), ideas, repairs };
}

/** Reparación determinista de lo que sigue fallando: reemplaza solo lo necesario por texto seguro. */
function deterministicRepair(
  tasks: PilotPlanTask[],
  slots: LaunchSlot[],
  input: LaunchEngineInput,
  ctx: ValidationContext,
  repairs: ValidationIssue[],
): PilotPlanTask[] {
  const out = tasks.map(t => ({ ...t }));
  const prevSeq = ctx.previousTasks ?? [];
  const catalogById = new Map(input.catalog.map(c => [c.id, c]));
  const win = rotationWindow(input.catalog.length);

  // 1) Receta y pieza válidas, y rotación (en orden, mirando lo ya fijado)
  const usage = new Map<string, number>();
  const usedRecipes: RecipeId[] = [];
  out.forEach((t, i) => {
    const slot = slots[i];
    const recent: string[][] = [...prevSeq.map(p => p.catalogItemIds ?? []), ...out.slice(0, i).map(p => p.catalogItemIds ?? [])];
    const prevRecipe = i === 0 ? prevSeq[prevSeq.length - 1]?.recipeId : out[i - 1].recipeId;
    let replaceAll = false;

    // receta
    const okRecipes = recipesForFormat(slot.format);
    if (!t.recipeId || !okRecipes.includes(t.recipeId) || t.recipeId === prevRecipe) {
      repairs.push({ taskIndex: i, field: 'recipeId', code: 'receta', message: 'Se eligió otra receta válida.', severity: 'repaired' });
      t.recipeId = chooseRecipe(slot, prevRecipe, usedRecipes);
      replaceAll = true; // el texto de la escena ya no calza con la receta
    }
    // pieza
    const ids = (t.catalogItemIds ?? []).filter(id => catalogById.has(id));
    const blocked = new Set(recent.slice(-win).flat());
    const conflict = ids.some(id => blocked.has(id));
    if (!ids.length || conflict) {
      repairs.push({ taskIndex: i, field: 'catalogItemIds', code: 'producto', message: 'Se eligió otra pieza del catálogo para rotar.', severity: 'repaired' });
      t.catalogItemIds = [chooseItem(input.catalog, recent, usage, win).id];
      replaceAll = true;
    } else {
      t.catalogItemIds = ids;
    }
    const item = catalogById.get(t.catalogItemIds![0])!;

    // textos: cualquier campo con problema se reemplaza por el de la tarea de relleno
    const salt = i + (input.weekNumber ?? 1);
    const fb = fallbackTask(slot, item, t.recipeId!, input, salt);
    if (replaceAll) {
      Object.assign(t, { ...fb, id: t.id });
    } else {
      for (const field of TEXT_FIELDS) {
        const value = (t as unknown as Record<string, string>)[field] ?? '';
        const bad = !value || value.trim().length < 3 || textIssues(value, ctx).length > 0 || ((field === 'caption' || field === 'sceneBrief') && value.length < 25);
        if (bad) {
          (t as unknown as Record<string, string>)[field] = (fb as unknown as Record<string, string>)[field];
          repairs.push({ taskIndex: i, field, code: 'relleno', message: `Se rellenó "${field}" con texto seguro.`, severity: 'repaired' });
        }
      }
      if (hashtagIssues(t.hashtags, ctx).length) {
        t.hashtags = fb.hashtags;
        repairs.push({ taskIndex: i, field: 'hashtags', code: 'relleno', message: 'Se rellenaron los hashtags.', severity: 'repaired' });
      }
    }
    usage.set(t.catalogItemIds![0], (usage.get(t.catalogItemIds![0]) ?? 0) + 1);
    usedRecipes.push(t.recipeId!);
  });
  return out;
}

export async function runLaunchPlan(input: LaunchEngineInput): Promise<LaunchPlanResult> {
  const week = input.weekNumber ?? 1;
  const outline = input.outline?.length ? input.outline : buildOutline(input.todayISO);
  const weekOutline = outline.find(w => w.weekNumber === week) ?? outline[0];
  const slots = buildSlots(weekOutline);
  const events = outline.flatMap(w => w.events);
  const ctx: ValidationContext = {
    slots,
    catalog: input.catalog,
    confirmedClaims: input.seed.confirmedClaims,
    events,
    previousTasks: (input.previousTasks ?? []).slice(-2).map(t => ({ recipeId: t.recipeId, catalogItemIds: t.catalogItemIds })),
  };
  const maxCalls = input.maxModelCalls ?? 2;
  const allRepairs: ValidationIssue[] = [];
  let calls = 0;
  let best: Normalized | null = null;
  let finalIssues: ValidationIssue[] = [];
  let lastIssuesText: string | undefined;

  if (!input.catalog.length) {
    // Sin catálogo no hay plan de producto: se devuelve el esquema sin tareas.
    return finish([], null, 'fallback');
  }

  while (calls < maxCalls) {
    calls++;
    let resp: ModelResponse;
    try {
      resp = await input.callModel(buildLaunchPrompt(input, slots, outline, { issues: lastIssuesText }), { temperature: calls === 1 ? 0.7 : 0.4, attempt: calls });
    } catch (e) {
      allRepairs.push({ taskIndex: -1, field: 'modelo', code: 'modelo_no_disponible', message: `El modelo no respondió: ${(e as Error)?.message ?? 'error'}`, severity: 'repaired' });
      break;
    }
    const parsed = tolerantParse(resp);
    if (!parsed) {
      allRepairs.push({ taskIndex: -1, field: 'json', code: 'json_roto', message: 'La respuesta no era JSON válido.', severity: 'repaired' });
      lastIssuesText = '- La respuesta anterior no era un JSON válido. Responde SOLO el objeto JSON, sin texto adicional y con todas las comillas bien cerradas.';
      continue;
    }
    const norm = normalize(parsed, slots, input, ctx);
    const issues = validateTasks(norm.tasks, ctx);
    best = norm;
    finalIssues = issues;
    if (!issues.length) break;
    lastIssuesText = summarizeIssues(issues);
  }

  if (best && finalIssues.length) {
    const repaired = deterministicRepair(best.tasks, slots, input, ctx, allRepairs);
    const after = validateTasks(repaired, ctx);
    if (after.length === 0) {
      best.tasks = repaired;
      allRepairs.push(...best.repairs);
      return finish(best.tasks, best, 'model_repaired');
    }
    // Último recurso: plan completo determinista
    allRepairs.push(...after.map(a => ({ ...a, severity: 'repaired' as const, message: `Fallback total: ${a.message}` })));
    best = null;
  } else if (best) {
    allRepairs.push(...best.repairs);
    return finish(best.tasks, best, best.repairs.length ? 'model_repaired' : 'model');
  }

  const fb = fallbackWeek(slots, input, ctx.previousTasks ?? []);
  const fbIssues = validateTasks(fb, ctx);
  if (fbIssues.length) {
    // No debería pasar: las plantillas son seguras. Se registra para verlo en las pruebas.
    allRepairs.push(...fbIssues.map(a => ({ ...a, message: `FALLBACK CON PROBLEMAS: ${a.message}` })));
  }
  return finish(fb, null, 'fallback');

  function finish(tasks: PilotPlanTask[], norm: Normalized | null, source: LaunchPlanResult['source']): LaunchPlanResult {
    const summaryOk = norm && validateFreeText(norm.summary, ctx, 40);
    const detailed = outline.map(w => {
      if (w.weekNumber === week) return { ...w, detailed: true };
      const fromModel = norm?.ideas.get(w.weekNumber);
      const ideas = fromModel?.length ? fromModel : w.ideas.length ? w.ideas : FALLBACK_IDEAS[w.weekNumber] ?? [];
      return { ...w, ideas, detailed: w.detailed };
    });
    return {
      strategySummary: summaryOk ? norm!.summary : fallbackSummary(week, outline),
      tasks,
      outline: detailed.map(w => (w.weekNumber === week && !w.ideas.length ? { ...w, ideas: FALLBACK_IDEAS[w.weekNumber] ?? [] } : w)),
      aiDisclosureReminder: AI_DISCLOSURE_REMINDER,
      source,
      repairs: allRepairs,
      modelCalls: calls,
    };
  }
}

export { funnelMix, dayLabel };
