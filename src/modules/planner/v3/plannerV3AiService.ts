// ─────────────────────────────────────────────────────────────────
// PLANNER V3 — Servicio de IA
//
// Este archivo es el CEREBRO del planner. Hace 4 cosas:
// 1. generateWeeklyPlan()      → arma el plan de la semana con Gemini
// 2. analyzeInsightsScreenshot() → lee una captura de estadísticas
// 3. generateWeeklyReport()    → genera el informe al cerrar la semana
// 4. buildHistorySummary()     → resume la semana para que la próxima aprenda
//
// Usa el endpoint existente /api/gemini/content (action: generateText),
// que ya soporta imágenes + JSON estructurado. NO requiere cambios
// de backend.
// ─────────────────────────────────────────────────────────────────

import { getAuth } from 'firebase/auth';
import { v4 as uuidv4 } from 'uuid';
import type { BrandProfile } from '../../brandProfiles/types';
import {
  type ContentPlan,
  type MonthlyFocus,
  type PlanPlatform,
  type PlanTask,
  type PostMetrics,
  type RawPlanResponse,
  type WeekHistorySummary,
  type WeeklyReport,
  EMPTY_METRICS,
  GOAL_LABELS,
} from './plannerV3Types';
import { MODULE_CATALOG_FOR_AI } from './moduleCatalog';
import { pickPlaybook } from './playbooks';

const CONTENT_ENDPOINT = '/api/gemini/content';
const MODEL = 'gemini-2.5-flash';

// ── Helpers de red ───────────────────────────────────────────────

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getAuth().currentUser?.getIdToken();
  if (!token) throw new Error('No autenticado');
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

function parseJsonResponse<T>(data: { json?: unknown; text?: string }): T {
  if (data.json && typeof data.json === 'object') return data.json as T;
  const raw = (data.text || '')
    .trim()
    .replace(/^```json\n?/, '')
    .replace(/\n?```$/, '')
    .trim();
  return JSON.parse(raw) as T;
}

// ── Días del plan ────────────────────────────────────────────────

function buildDays(frequency: number): { iso: string; label: string }[] {
  const dayNames = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const monthNames = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const days: { iso: string; label: string }[] = [];
  const cursor = new Date();
  cursor.setDate(cursor.getDate() + 1); // el plan empieza mañana
  // Distribuir en la semana: 3 posts → día por medio; 5 → L-V; 7 → todos
  const step = frequency === 3 ? 2 : 1;
  while (days.length < frequency) {
    const name = dayNames[cursor.getDay()];
    days.push({
      iso: cursor.toISOString().split('T')[0],
      label: `${name.charAt(0).toUpperCase() + name.slice(1)} ${cursor.getDate()} ${monthNames[cursor.getMonth()]}`,
    });
    cursor.setDate(cursor.getDate() + step);
  }
  return days;
}

// ── Serializar la marca para Gemini ──────────────────────────────
// Convierte el BrandProfile en un bloque de texto compacto.
// Si la marca tiene aiSummary, se usa; si no, se arma con los campos crudos.

export function serializeBrandForAI(brand: BrandProfile): string {
  const lines: string[] = [];
  lines.push(`Marca: ${brand.brandName}`);
  if (brand.country) lines.push(`País: ${brand.country}`);
  if (brand.mainCategory) lines.push(`Rubro: ${brand.mainCategory}`);
  if (brand.shortDescription) lines.push(`Qué vende: ${brand.shortDescription}`);

  const tc = brand.targetCustomer;
  if (tc) {
    const clienta: string[] = [];
    if (tc.genderFocus) clienta.push(tc.genderFocus);
    if (tc.ageRange) clienta.push(`${tc.ageRange} años`);
    if (tc.lifestyle) clienta.push(tc.lifestyle);
    if (clienta.length) lines.push(`Cliente ideal: ${clienta.join(', ')}`);
    if (tc.mainPain) lines.push(`Dolor principal del cliente: ${tc.mainPain}`);
    if (tc.buyingMotivation?.length) lines.push(`Por qué compra: ${tc.buyingMotivation.join(', ')}`);
    if (tc.customerDoubts?.length) lines.push(`Dudas antes de comprar: ${tc.customerDoubts.join(', ')}`);
    if (tc.freeDescription) lines.push(`Descripción del cliente: ${tc.freeDescription}`);
  }

  const pos = brand.positioning;
  if (pos) {
    if (pos.brandPromise) lines.push(`Promesa de marca: ${pos.brandPromise}`);
    if (pos.perceivedLevel) lines.push(`Nivel percibido: ${pos.perceivedLevel}`);
    if (pos.mainDifferentiators?.length) lines.push(`Diferenciales: ${pos.mainDifferentiators.join(', ')}`);
  }

  const v = brand.voice;
  if (v) {
    if (v.toneKeywords?.length) lines.push(`Tono de voz: ${v.toneKeywords.join(', ')}`);
    if (v.formality) lines.push(`Formalidad: ${v.formality}`);
    if (v.emojiLevel) lines.push(`Nivel de emojis: ${v.emojiLevel}`);
    if (v.preferredWords?.length) lines.push(`Palabras preferidas: ${v.preferredWords.join(', ')}`);
    if (v.forbiddenWords?.length) lines.push(`PALABRAS PROHIBIDAS (nunca usar): ${v.forbiddenWords.join(', ')}`);
  }

  const cr = brand.commercialRules;
  if (cr) {
    if (cr.mainSalesChannels?.length) lines.push(`Canales de venta: ${cr.mainSalesChannels.join(', ')}`);
    if (cr.preferredCTA?.length) lines.push(`CTA preferidos: ${cr.preferredCTA.join(', ')}`);
    if (cr.trustBuilders?.length) lines.push(`Generadores de confianza: ${cr.trustBuilders.join(', ')}`);
    if (cr.businessStage?.description) lines.push(`Etapa del negocio: ${cr.businessStage.description}`);
  }

  const ai = brand.aiSummary;
  if (ai?.brandEssence) {
    lines.push(`\nResumen de esencia: ${ai.brandEssence}`);
    if (ai.contentDo?.length) lines.push(`El contenido SÍ debe: ${ai.contentDo.join('; ')}`);
    if (ai.contentDont?.length) lines.push(`El contenido NO debe: ${ai.contentDont.join('; ')}`);
  }

  const si = brand.socialInsights;
  if (si) {
    if (si.networks && Object.keys(si.networks).length) {
      const labels = { instagram: 'Instagram', tiktok: 'TikTok', facebook: 'Facebook' } as const;
      (Object.keys(labels) as Array<keyof typeof labels>).forEach(key => {
        const network = si.networks?.[key];
        if (!network) return;
        const stats: string[] = [];
        if (network.followers) stats.push(`${network.followers} seguidores`);
        if (network.bestTime) stats.push(`mejor horario: ${network.bestTime}`);
        if (network.reachDiagnosis) stats.push(`alcance: ${network.reachDiagnosis}`);
        if (network.videoInsight) stats.push(`videos: ${network.videoInsight}`);
        if (network.postInsight) stats.push(`publicaciones: ${network.postInsight}`);
        if (stats.length) lines.push(`Datos reales de ${labels[key]}: ${stats.join(' · ')}`);
      });
    } else {
      const stats: string[] = [];
      if (si.followers) stats.push(`${si.followers} seguidores`);
      if (si.bestTime) stats.push(`mejor horario: ${si.bestTime}`);
      if (si.reelsInsight) stats.push(`reels: ${si.reelsInsight}`);
      if (si.carouselInsight) stats.push(`carruseles: ${si.carouselInsight}`);
      if (stats.length) lines.push(`Datos de Instagram: ${stats.join(' · ')}`);
    }
  }

  return lines.join('\n');
}

// ── Serializar historial para Gemini ─────────────────────────────

function serializeHistory(history: WeekHistorySummary[]): string {
  if (!history.length) {
    return 'Sin historial: es la primera semana medida. Los "resultados esperados" deben ser cualitativos y honestos (ej: "esta semana establecemos tu punto de partida"), NUNCA números inventados.';
  }
  return history
    .map(h => {
      const parts: string[] = [`Semana ${h.weekNumber}:`];
      parts.push(`tipos usados: ${h.contentTypes.join(', ')}`);
      parts.push(`cumplimiento: ${Math.round(h.completionRate * 100)}%`);
      if (h.topPerformer) parts.push(`MEJOR resultado: ${h.topPerformer}`);
      if (h.worstPerformer) parts.push(`peor resultado: ${h.worstPerformer}`);
      if (h.reportRecommendations.length) parts.push(`recomendaciones pendientes: ${h.reportRecommendations.join('; ')}`);
      return parts.join(' | ');
    })
    .join('\n');
}

// ── Prompt maestro del plan semanal ──────────────────────────────

export function buildWeeklyPlanPrompt(params: {
  brand: BrandProfile;
  focus: MonthlyFocus;
  frequency: 3 | 5 | 7;
  platforms: PlanPlatform[];
  weekNumber: number;
  history: WeekHistorySummary[];
}): { prompt: string; days: { iso: string; label: string }[] } {
  const { brand, focus, frequency, platforms, weekNumber, history } = params;
  const days = buildDays(frequency);
  const playbook = pickPlaybook(brand.mainCategory, brand.shortDescription);

  const prompt = `Eres la directora creativa y estratega de contenido de una agencia de marketing especializada en emprendedoras latinoamericanas que venden por redes sociales. Combinas tres roles: community manager (sabes qué funciona en cada red), directora creativa (sabes qué contenido crear) y estratega comercial (todo apunta a vender).

Tu tarea: diseñar el plan de contenido de la semana ${weekNumber} para esta marca.

═══ LA MARCA ═══
${serializeBrandForAI(brand)}

═══ ENFOQUE DEL MES ═══
Meta: ${GOAL_LABELS[focus.goal]}
${focus.focusProduct ? `Producto/servicio a empujar: ${focus.focusProduct}` : ''}
${focus.notes ? `Nota de la emprendedora: ${focus.notes}` : ''}

═══ CONOCIMIENTO DEL RUBRO ═══
${playbook.content}

═══ HISTORIAL Y DATOS REALES ═══
${serializeHistory(history)}

═══ HERRAMIENTAS DE LA APP ═══
${MODULE_CATALOG_FOR_AI}

═══ DÍAS Y PLATAFORMAS ═══
Días del plan (exactamente ${frequency} tareas, una por día, usar estas fechas):
${days.map(d => `- ${d.label} (${d.iso})`).join('\n')}
Plataformas disponibles: ${platforms.join(', ')}

═══ REGLAS ESTRICTAS ═══
1. EMBUDO: distribuye los roles del embudo en la semana. Referencia:
   meta "Vender más" → ~30% atraer, 25% generar_deseo, 20% construir_confianza, 25% convertir.
   meta "Ganar seguidores" → ~50% atraer, 25% generar_deseo, 15% construir_confianza, 10% convertir.
   meta "Lanzar algo nuevo" → ~35% atraer, 35% generar_deseo, 15% construir_confianza, 15% convertir.
   meta "Mantener presencia" → ~35% atraer, 25% generar_deseo, 30% construir_confianza, 10% convertir.
2. VARIEDAD: no repitas el mismo contentType dos veces en la semana, y no repitas los tipos del historial reciente salvo que hayan sido el MEJOR resultado (los ganadores SÍ se repiten, con variación).
3. DATOS REALES MANDAN: si el historial muestra qué funcionó, la semana debe reflejarlo y "whyThisContent" debe citar la evidencia con números ("tu reel antes/después alcanzó 2.400 cuentas, el doble de tu promedio").
4. HONESTIDAD EN expectedResult: si hay datos, usa rangos basados en SUS números reales ("entre 800 y 1.500 cuentas, tu rango habitual en reels"). Si NO hay datos, sé cualitativa ("buscamos guardados y comentarios; esta semana define tu punto de partida"). PROHIBIDO prometer cifras sin base o hablar de "viral".
5. howToMeasure: di exactamente qué número mirar, dónde y cuándo ("48 horas después, en las estadísticas del post, mira alcance y guardados").
6. CAPTIONS: en la voz de la marca, con sus emojis según su nivel, respetando palabras prohibidas, cerrando con el CTA de sus canales de venta reales. Listos para copiar y publicar tal cual, en español.
7. PROMPTS de imagen: en el idioma y formato que el módulo necesita, completos y específicos (producto, escena, luz, encuadre). Nada genérico tipo "foto bonita del producto".
8. toolReason y whyThisContent: en lenguaje simple de emprendedora, sin jerga de marketing.
9. suggestedTime: usa el mejor horario real de LA RED DE ESA TAREA si existe (TikTok con datos de TikTok, Instagram con Instagram, Facebook con Facebook); si no, horarios estándar del rubro (12:00-14:00 o 19:00-21:00).
10. strategySummary: explica en 3-4 frases simples el arco de la semana y por qué está armada así, como se lo explicarías a la dueña de la marca tomando un café.

═══ FORMATO DE RESPUESTA ═══
Responde ÚNICAMENTE con un objeto JSON válido, sin texto adicional:
{
  "strategySummary": "string",
  "tasks": [
    {
      "date": "YYYY-MM-DD",
      "dayLabel": "string",
      "title": "idea en una frase",
      "contentType": "string",
      "format": "Reel|Carrusel|Foto|Story|Video",
      "platform": "una de las plataformas disponibles",
      "suggestedTime": "HH:MM",
      "funnelRole": "atraer|generar_deseo|construir_confianza|convertir",
      "toolModule": "product|ugc|scene|outfit|prompt|photodump|campaign|none",
      "toolReason": "string",
      "prompt": "string (vacío solo si toolModule es none)",
      "caption": "string",
      "hashtags": "#tag1 #tag2 #tag3 #tag4 #tag5",
      "whatToUpload": ["string"],
      "howToConfigure": ["string"],
      "whyThisContent": "string",
      "expectedResult": "string",
      "howToMeasure": "string",
      "engagementHook": "string"
    }
  ]
}`;

  return { prompt, days };
}

// ── Generar el plan semanal ──────────────────────────────────────

export async function generateWeeklyPlan(params: {
  brand: BrandProfile;
  focus: MonthlyFocus;
  frequency: 3 | 5 | 7;
  platforms: PlanPlatform[];
  weekNumber: number;
  history: WeekHistorySummary[];
}): Promise<{ strategySummary: string; tasks: PlanTask[] }> {
  const { prompt, days } = buildWeeklyPlanPrompt(params);
  const headers = await authHeaders();

  const res = await fetch(CONTENT_ENDPOINT, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      action: 'generateText',
      model: MODEL,
      prompt,
      generationConfig: { temperature: 0.7, maxOutputTokens: 8192 },
    }),
  });

  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Error generando el plan');

  const parsed = parseJsonResponse<RawPlanResponse>(data);
  const rawTasks = Array.isArray(parsed.tasks) ? parsed.tasks : [];
  if (rawTasks.length === 0) throw new Error('El plan llegó vacío. Intenta de nuevo.');

  const tasks: PlanTask[] = rawTasks.map((t, i) => ({
    id: uuidv4(),
    status: 'pending',
    date: t.date || days[i]?.iso || '',
    dayLabel: t.dayLabel || days[i]?.label || '',
    title: t.title || t.contentType || 'Contenido',
    contentType: t.contentType || 'Contenido',
    format: (t.format as PlanTask['format']) || 'Foto',
    platform: (t.platform as PlanTask['platform']) || params.platforms[0],
    suggestedTime: t.suggestedTime || '19:00',
    funnelRole: (t.funnelRole as PlanTask['funnelRole']) || 'atraer',
    toolModule: (t.toolModule as PlanTask['toolModule']) || 'prompt',
    toolReason: t.toolReason || '',
    prompt: t.prompt || '',
    caption: t.caption || '',
    hashtags: t.hashtags || '',
    whatToUpload: Array.isArray(t.whatToUpload) ? t.whatToUpload : [],
    howToConfigure: Array.isArray(t.howToConfigure) ? t.howToConfigure : [],
    whyThisContent: t.whyThisContent || '',
    expectedResult: t.expectedResult || '',
    howToMeasure: t.howToMeasure || '',
    engagementHook: t.engagementHook || '',
  }));

  return {
    strategySummary: parsed.strategySummary || '',
    tasks,
  };
}

// ── Leer una captura de estadísticas ─────────────────────────────
// La usuaria sube el screenshot de las estadísticas de UN post
// (Instagram Insights o TikTok Analytics). Gemini extrae los números.
// La UI SIEMPRE muestra los números extraídos para que la usuaria
// los confirme o corrija antes de guardar.

export async function analyzeInsightsScreenshot(
  imageBase64: string,
  mimeType: string,
): Promise<Omit<PostMetrics, 'source' | 'capturedAt'>> {
  return analyzeInsightsScreenshots([imageBase64], [mimeType]);
}

export async function analyzeInsightsScreenshots(
  imagesBase64: string[],
  mimeTypes: string[],
): Promise<Omit<PostMetrics, 'source' | 'capturedAt'>> {
  const headers = await authHeaders();

  const prompt = `Estas imágenes son una o varias capturas de pantalla de las estadísticas de UNA publicación de Instagram, TikTok o Facebook (Insights/Analytics). Combina los datos visibles en todas las capturas.

Extrae SOLO los números que se vean claramente en la imagen. Si una métrica no aparece o no estás segura, usa null. NUNCA inventes números.

Ten en cuenta los nombres en español e inglés:
- reach: "Alcance", "Cuentas alcanzadas", "Reach", "Accounts reached"
- views: "Reproducciones", "Visualizaciones", "Views", "Plays"
- likes: "Me gusta", "Likes"
- comments: "Comentarios", "Comments"
- saves: "Guardados", "Veces guardado", "Saves"
- shares: "Compartidos", "Veces compartido", "Shares"
- follows: "Seguimientos", "Follows", "Nuevos seguidores"
- profileVisits: "Visitas al perfil", "Profile visits"

Los números pueden venir abreviados ("1,2 mil" = 1200, "3.4K" = 3400, "1M" = 1000000): conviértelos a número entero.

Responde ÚNICAMENTE con JSON válido:
{"reach": number|null, "views": number|null, "likes": number|null, "comments": number|null, "saves": number|null, "shares": number|null, "follows": number|null, "profileVisits": number|null}`;

  const res = await fetch(CONTENT_ENDPOINT, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      action: 'generateText',
      model: MODEL,
      prompt,
      images: imagesBase64,
      mimeTypes,
      generationConfig: { temperature: 0 },
    }),
  });

  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'No se pudo leer la captura');

  const parsed = parseJsonResponse<Record<string, number | null>>(data);
  return {
    ...EMPTY_METRICS,
    reach: typeof parsed.reach === 'number' ? parsed.reach : null,
    views: typeof parsed.views === 'number' ? parsed.views : null,
    likes: typeof parsed.likes === 'number' ? parsed.likes : null,
    comments: typeof parsed.comments === 'number' ? parsed.comments : null,
    saves: typeof parsed.saves === 'number' ? parsed.saves : null,
    shares: typeof parsed.shares === 'number' ? parsed.shares : null,
    follows: typeof parsed.follows === 'number' ? parsed.follows : null,
    profileVisits: typeof parsed.profileVisits === 'number' ? parsed.profileVisits : null,
  };
}

// ── Informe semanal ──────────────────────────────────────────────

function serializeTasksForReport(tasks: PlanTask[]): string {
  return tasks
    .map(t => {
      const m = t.metrics;
      const metricsStr = m
        ? `alcance:${m.reach ?? '?'} vistas:${m.views ?? '?'} likes:${m.likes ?? '?'} comentarios:${m.comments ?? '?'} guardados:${m.saves ?? '?'} compartidos:${m.shares ?? '?'}`
        : 'sin métricas registradas';
      return `[${t.id}] ${t.dayLabel} · ${t.contentType} (${t.format}, ${t.platform}, rol: ${t.funnelRole}) · estado: ${t.status} · ${metricsStr}`;
    })
    .join('\n');
}

export async function generateWeeklyReport(plan: ContentPlan): Promise<WeeklyReport> {
  const headers = await authHeaders();

  const prompt = `Eres la estratega de contenido de una marca. La semana terminó y tienes los resultados reales de cada publicación. Escribe el informe semanal para la dueña de la marca, en lenguaje simple y cercano, sin jerga de marketing.

MARCA: ${plan.brandName} · Meta del mes: ${GOAL_LABELS[plan.monthlyFocus.goal]}
ESTRATEGIA QUE SE PLANTEÓ: ${plan.strategySummary}

RESULTADOS DE LA SEMANA:
${serializeTasksForReport(plan.tasks)}

REGLAS:
- Basa TODO en los números reales de arriba. Si una publicación no tiene métricas, no inventes nada sobre ella.
- Los "wins" citan números concretos.
- Los "learnings" son honestos pero constructivos: nunca culpan a la emprendedora, siempre apuntan a qué probar distinto.
- "bestTask": el taskId (entre corchetes arriba) de la mejor publicación según los datos, con el porqué. Si no hay métricas suficientes, null.
- "recommendations": 2-4 acciones concretas para la próxima semana, derivadas de los datos.
- Si casi no hay métricas registradas, el informe lo dice con cariño y recomienda registrar resultados la próxima semana para poder mejorar el plan.

Responde ÚNICAMENTE con JSON válido:
{
  "summary": "string (2-3 frases)",
  "wins": ["string"],
  "learnings": ["string"],
  "bestTask": {"taskId": "string", "why": "string"} | null,
  "recommendations": ["string"]
}`;

  const res = await fetch(CONTENT_ENDPOINT, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      action: 'generateText',
      model: MODEL,
      prompt,
      generationConfig: { temperature: 0.4 },
    }),
  });

  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'No se pudo generar el informe');

  const parsed = parseJsonResponse<Omit<WeeklyReport, 'generatedAt'>>(data);
  return {
    summary: parsed.summary || '',
    wins: Array.isArray(parsed.wins) ? parsed.wins : [],
    learnings: Array.isArray(parsed.learnings) ? parsed.learnings : [],
    bestTask: parsed.bestTask && parsed.bestTask.taskId ? parsed.bestTask : null,
    recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
    generatedAt: Date.now(),
  };
}

// ── Resumen histórico (función pura, sin IA) ─────────────────────

export function buildHistorySummary(plan: ContentPlan): WeekHistorySummary {
  const doneTasks = plan.tasks.filter(t => t.status === 'done');
  const completionRate = plan.tasks.length ? doneTasks.length / plan.tasks.length : 0;

  const withMetrics = plan.tasks.filter(
    t => t.metrics && (t.metrics.reach !== null || t.metrics.views !== null),
  );

  const score = (t: PlanTask) =>
    (t.metrics?.reach ?? 0) + (t.metrics?.views ?? 0);

  let topPerformer: string | null = null;
  let worstPerformer: string | null = null;

  if (withMetrics.length > 0) {
    const sorted = [...withMetrics].sort((a, b) => score(b) - score(a));
    const top = sorted[0];
    topPerformer = `${top.contentType} (${top.format}) — alcance ${top.metrics?.reach ?? top.metrics?.views ?? 0}`;
    if (sorted.length > 1) {
      const worst = sorted[sorted.length - 1];
      worstPerformer = `${worst.contentType} (${worst.format}) — alcance ${worst.metrics?.reach ?? worst.metrics?.views ?? 0}`;
    }
  }

  return {
    weekNumber: plan.weekNumber,
    contentTypes: plan.tasks.map(t => t.contentType),
    completionRate,
    topPerformer,
    worstPerformer,
    reportRecommendations: plan.weeklyReport?.recommendations ?? [],
  };
}
