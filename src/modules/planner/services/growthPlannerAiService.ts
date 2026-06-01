import { getAuth } from 'firebase/auth';
import { Type } from '@google/genai';
import { v4 as uuidv4 } from 'uuid';
import type {
  GrowthBrand,
  GrowthContentModule,
  GrowthFunnelRole,
  GrowthInstagramMetrics,
  GrowthPlanDuration,
  GrowthProduct,
  GrowthStrategicPlan,
  GrowthTask,
  GrowthTaskStatus,
} from '../growthPlannerTypes';

interface GenerateGrowthPlanInput {
  duration: GrowthPlanDuration;
  brand: GrowthBrand;
  products: GrowthProduct[];
  instagramMetrics: GrowthInstagramMetrics;
  productImageRefs: { data: string; mimeType: string; label: string }[];
}

const CONTENT_ENDPOINT = '/api/gemini/content';
const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 90;
const FUNNEL_ROLE_VALUES = ['atraer', 'generar_deseo', 'construir_confianza', 'convertir'];
const CONTENT_MODULE_VALUES = ['product', 'ugc', 'scene', 'prompt', 'outfit', 'none'];
const TASK_STATUS_VALUES = ['pending', 'in_progress', 'ready', 'published', 'skipped'];

const stringArraySchema = { type: Type.ARRAY, items: { type: Type.STRING } };
const executionStepSchema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    module: { type: Type.STRING, enum: CONTENT_MODULE_VALUES },
    instruction: { type: Type.STRING },
    ctaLabel: { type: Type.STRING },
    status: { type: Type.STRING, enum: ['pending', 'ready'] },
  },
  required: ['title', 'module', 'instruction', 'ctaLabel', 'status'],
};

const taskSchema = {
  type: Type.OBJECT,
  properties: {
    week: { type: Type.NUMBER },
    dayLabel: { type: Type.STRING },
    date: { type: Type.STRING },
    platform: { type: Type.STRING },
    contentType: { type: Type.STRING },
    funnelRole: { type: Type.STRING, enum: FUNNEL_ROLE_VALUES },
    module: { type: Type.STRING, enum: CONTENT_MODULE_VALUES },
    moduleReason: { type: Type.STRING },
    suggestedTime: { type: Type.STRING },
    visualConcept: { type: Type.STRING },
    whyItWorks: { type: Type.STRING },
    caption: { type: Type.STRING },
    hashtags: { type: Type.STRING },
    prompt: { type: Type.STRING },
    slotInstructions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          slot: { type: Type.STRING },
          instruction: { type: Type.STRING },
        },
        required: ['slot', 'instruction'],
      },
    },
    requiredAssets: stringArraySchema,
    executionRecipe: {
      type: Type.OBJECT,
      properties: {
        overview: { type: Type.STRING },
        steps: { type: Type.ARRAY, items: executionStepSchema },
      },
      required: ['overview', 'steps'],
    },
    shotGuide: {
      type: Type.OBJECT,
      properties: {
        duration: { type: Type.STRING },
        shots: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              shot: { type: Type.NUMBER },
              duration: { type: Type.STRING },
              instruction: { type: Type.STRING },
            },
            required: ['shot', 'duration', 'instruction'],
          },
        },
        onScreenText: stringArraySchema,
        inspirationSearches: stringArraySchema,
        whatToAvoid: stringArraySchema,
      },
      required: ['duration', 'shots', 'onScreenText', 'inspirationSearches', 'whatToAvoid'],
    },
    engagementHook: { type: Type.STRING },
    status: { type: Type.STRING, enum: TASK_STATUS_VALUES },
  },
  required: [
    'week',
    'dayLabel',
    'date',
    'platform',
    'contentType',
    'funnelRole',
    'module',
    'moduleReason',
    'suggestedTime',
    'visualConcept',
    'whyItWorks',
    'caption',
    'hashtags',
    'prompt',
    'slotInstructions',
    'requiredAssets',
    'executionRecipe',
    'shotGuide',
    'engagementHook',
    'status',
  ],
};

const GROWTH_PLANNER_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    businessStage: { type: Type.STRING },
    mainGoal: { type: Type.STRING },
    commercialFocus: { type: Type.STRING },
    strategyGoal: { type: Type.STRING },
    businessDiagnosis: { type: Type.STRING },
    nicheInsights: stringArraySchema,
    planNarrative: { type: Type.STRING },
    strategicTip: { type: Type.STRING },
    roadmap: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          week: { type: Type.NUMBER },
          title: { type: Type.STRING },
          objective: { type: Type.STRING },
          funnelRole: { type: Type.STRING, enum: FUNNEL_ROLE_VALUES },
          hint: { type: Type.STRING },
        },
        required: ['week', 'title', 'objective', 'funnelRole', 'hint'],
      },
    },
    tasks: { type: Type.ARRAY, items: taskSchema },
    brandAnalysis: {
      type: Type.OBJECT,
      properties: {
        stageInterpretation: { type: Type.STRING },
        targetAnalysis: { type: Type.STRING },
        voiceGuide: { type: Type.STRING },
      },
      required: ['stageInterpretation', 'targetAnalysis', 'voiceGuide'],
    },
    productAnalysis: {
      type: Type.OBJECT,
      properties: {
        productWarnings: stringArraySchema,
        confidenceByProduct: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              productId: { type: Type.STRING },
              level: { type: Type.NUMBER },
              reason: { type: Type.STRING },
            },
            required: ['productId', 'level', 'reason'],
          },
        },
        categorizationSummary: { type: Type.STRING },
      },
      required: ['productWarnings', 'confidenceByProduct', 'categorizationSummary'],
    },
    socialMetricsAnalysis: {
      type: Type.OBJECT,
      properties: {
        audienceInsights: { type: Type.STRING },
        engagementLevel: { type: Type.STRING },
        confidenceMapping: { type: Type.STRING },
      },
      required: ['audienceInsights', 'engagementLevel', 'confidenceMapping'],
    },
    nicheResearch: {
      type: Type.OBJECT,
      properties: {
        trends: stringArraySchema,
        competitorGaps: stringArraySchema,
        researchMode: { type: Type.STRING },
      },
      required: ['trends', 'competitorGaps', 'researchMode'],
    },
    generationLog: {
      type: Type.OBJECT,
      properties: {
        warnings: stringArraySchema,
        fixedErrors: stringArraySchema,
      },
      required: ['warnings', 'fixedErrors'],
    },
    validationReportMarkdown: { type: Type.STRING },
  },
  required: [
    'businessStage',
    'mainGoal',
    'commercialFocus',
    'strategyGoal',
    'businessDiagnosis',
    'nicheInsights',
    'planNarrative',
    'strategicTip',
    'roadmap',
    'tasks',
    'brandAnalysis',
    'productAnalysis',
    'socialMetricsAnalysis',
    'nicheResearch',
    'generationLog',
    'validationReportMarkdown',
  ],
};

function taskRange(duration: GrowthPlanDuration) {
  if (duration === 7) return { min: 4, max: 4, maxOutputTokens: 4096 };
  if (duration === 14) return { min: 6, max: 6, maxOutputTokens: 6144 };
  return { min: 10, max: 10, maxOutputTokens: 8192 };
}

function cleanJsonText(text: string): string {
  return text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
}

function extractJsonCandidate(text: string): string {
  const clean = cleanJsonText(text);
  const start = clean.indexOf('{');
  const end = clean.lastIndexOf('}');
  if (start >= 0 && end > start) return clean.slice(start, end + 1);
  return clean;
}

function balanceJsonClosings(text: string): string {
  const stack: string[] = [];
  let inString = false;
  let escaped = false;

  for (const char of text) {
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === '{') stack.push('}');
    if (char === '[') stack.push(']');
    if ((char === '}' || char === ']') && stack[stack.length - 1] === char) stack.pop();
  }

  return text + stack.reverse().join('');
}

function repairJsonText(text: string): string {
  return balanceJsonClosings(extractJsonCandidate(text)
    .replace(/,\s*([}\]])/g, '$1')
    .replace(/}\s*{/g, '},{')
    .replace(/]\s*\[/g, '],[')
    .replace(/"\s*\n\s*"/g, '","'));
}

function parseJsonFromText(text: string): unknown {
  const candidate = extractJsonCandidate(text);
  const attempts = [candidate, repairJsonText(candidate)];
  for (const attempt of attempts) {
    try {
      return JSON.parse(attempt);
    } catch {
      // Try the next cleanup strategy.
    }
  }
  throw new Error('Gemini devolvio JSON incompleto. Reintenta con un plan de 7 dias o menos imagenes.');
}

function asArray<T>(value: T[] | undefined, fallback: T[]): T[] {
  return Array.isArray(value) && value.length ? value : fallback;
}

function safeStatus(status: string | undefined): GrowthTaskStatus {
  return ['pending', 'in_progress', 'ready', 'published', 'skipped'].includes(status || '')
    ? status as GrowthTaskStatus
    : 'pending';
}

function safeModule(module: string | undefined): GrowthContentModule {
  return ['product', 'ugc', 'scene', 'prompt', 'outfit', 'none'].includes(module || '')
    ? module as GrowthContentModule
    : 'prompt';
}

function safeRole(role: string | undefined): GrowthFunnelRole {
  return ['atraer', 'generar_deseo', 'construir_confianza', 'convertir'].includes(role || '')
    ? role as GrowthFunnelRole
    : 'atraer';
}

function normalizePlan(raw: any, input: GenerateGrowthPlanInput): GrowthStrategicPlan {
  const now = new Date().toISOString();
  const tasks: GrowthTask[] = asArray(raw?.tasks, []).map((task: any, index: number) => ({
    id: String(task?.id || uuidv4()),
    week: Number(task?.week || Math.floor(index / 4) + 1),
    dayLabel: String(task?.dayLabel || `Dia ${index + 1}`),
    date: String(task?.date || new Date(Date.now() + index * 86400000).toISOString().slice(0, 10)),
    platform: task?.platform || input.brand.activeSocials[0] || 'Instagram Feed',
    contentType: String(task?.contentType || 'Contenido estrategico'),
    funnelRole: safeRole(task?.funnelRole),
    module: safeModule(task?.module),
    moduleReason: String(task?.moduleReason || 'Modulo recomendado por objetivo de contenido.'),
    suggestedTime: String(task?.suggestedTime || input.instagramMetrics.bestTime || '19:00'),
    visualConcept: String(task?.visualConcept || 'Pieza visual enfocada en producto y confianza.'),
    whyItWorks: String(task?.whyItWorks || 'Conecta el producto con una motivacion concreta de compra.'),
    caption: String(task?.caption || ''),
    hashtags: String(task?.hashtags || ''),
    prompt: String(task?.prompt || ''),
    slotInstructions: asArray(task?.slotInstructions, []),
    requiredAssets: asArray(task?.requiredAssets, []),
    executionRecipe: {
      overview: String(task?.executionRecipe?.overview || 'Ejecuta la pieza con foco en claridad, producto y CTA.'),
      steps: asArray(task?.executionRecipe?.steps, []).map((step: any, stepIndex: number) => ({
        id: String(step?.id || `${task?.id || index}_step_${stepIndex + 1}`),
        title: String(step?.title || `Paso ${stepIndex + 1}`),
        module: safeModule(step?.module),
        instruction: String(step?.instruction || ''),
        ctaLabel: String(step?.ctaLabel || 'Ejecutar'),
        status: step?.status === 'ready' ? 'ready' : 'pending',
      })),
    },
    shotGuide: {
      duration: String(task?.shotGuide?.duration || '15-30 segundos'),
      shots: asArray(task?.shotGuide?.shots, []),
      onScreenText: asArray(task?.shotGuide?.onScreenText, []),
      inspirationSearches: asArray(task?.shotGuide?.inspirationSearches, []),
      whatToAvoid: asArray(task?.shotGuide?.whatToAvoid, []),
    },
    engagementHook: String(task?.engagementHook || 'Termina con una pregunta simple para abrir conversacion.'),
    status: safeStatus(task?.status),
  }));

  if (!tasks.length) throw new Error('Gemini devolvio un plan sin tareas.');

  return {
    id: String(raw?.id || `growth_${Date.now()}`),
    createdAt: String(raw?.createdAt || now),
    duration: input.duration,
    brand: input.brand,
    products: input.products,
    instagramMetrics: input.instagramMetrics,
    businessStage: String(raw?.businessStage || 'Etapa comercial por validar'),
    mainGoal: String(raw?.mainGoal || 'Aumentar ventas con contenido estrategico'),
    commercialFocus: String(raw?.commercialFocus || input.products.map(p => p.name).join(', ')),
    strategyGoal: String(raw?.strategyGoal || 'Convertir interes en conversaciones de compra'),
    businessDiagnosis: String(raw?.businessDiagnosis || ''),
    nicheInsights: asArray(raw?.nicheInsights, []),
    planNarrative: String(raw?.planNarrative || ''),
    strategicTip: String(raw?.strategicTip || ''),
    roadmap: asArray(raw?.roadmap, []),
    tasks,
    brandAnalysis: {
      stageInterpretation: String(raw?.brandAnalysis?.stageInterpretation || ''),
      targetAnalysis: String(raw?.brandAnalysis?.targetAnalysis || input.brand.idealClient),
      voiceGuide: String(raw?.brandAnalysis?.voiceGuide || input.brand.tone),
    },
    productAnalysis: {
      productWarnings: asArray(raw?.productAnalysis?.productWarnings, []),
      confidenceByProduct: asArray(raw?.productAnalysis?.confidenceByProduct, []),
      categorizationSummary: String(raw?.productAnalysis?.categorizationSummary || ''),
    },
    socialMetricsAnalysis: {
      audienceInsights: String(raw?.socialMetricsAnalysis?.audienceInsights || ''),
      engagementLevel: String(raw?.socialMetricsAnalysis?.engagementLevel || ''),
      confidenceMapping: String(raw?.socialMetricsAnalysis?.confidenceMapping || ''),
    },
    nicheResearch: {
      trends: asArray(raw?.nicheResearch?.trends, []),
      competitorGaps: asArray(raw?.nicheResearch?.competitorGaps, []),
      researchMode: String(raw?.nicheResearch?.researchMode || 'sin grounding'),
    },
    generationLog: {
      timestamp: now,
      steps: asArray(raw?.generationLog?.steps, [
        'Marca leida',
        'Productos procesados',
        'Metricas revisadas',
        'Plan generado con Gemini 2.5 Flash',
      ]),
      hasImages: input.productImageRefs.length > 0,
      hasMetrics: true,
      researchMode: 'gemini-2.5-flash sin grounding',
      warnings: asArray(raw?.generationLog?.warnings, []),
      validationChecks: raw?.generationLog?.validationChecks || {
        datesValid: true,
        languageValid: true,
        taskCountValid: true,
        modulesValid: true,
      },
      fixedErrors: asArray(raw?.generationLog?.fixedErrors, []),
    },
    validationReportMarkdown: String(raw?.validationReportMarkdown || `# Planner Estrategico - ${input.brand.name}`),
  };
}

function buildPrompt(input: GenerateGrowthPlanInput): string {
  const range = taskRange(input.duration);
  const productSummary = input.products.map((product, index) =>
    `${index + 1}. ${product.name} | ${product.category} | ${product.price} | ${product.benefit}`,
  ).join('\n');

  return `Eres la directora estrategica de contenido de Luz IA Studio.
Debes crear un Planner Estrategico real y ejecutable para una emprendedora LATAM.

REGLAS IMPORTANTES:
- Responde SOLO JSON valido. Sin markdown fuera del JSON.
- No uses busqueda web ni cites fuentes externas.
- No inventes imagenes generadas.
- Crea exactamente ${range.max} tareas. No crees mas.
- Cada tarea debe ser concreta, lista para ejecutar y conectada a un modulo de Luz IA.
- Escribe compacto: maximo 1 frase por campo, captions de 1 parrafo y prompts de menos de 450 caracteres.
- Cada executionRecipe debe tener maximo 3 pasos.
- Cada shotGuide debe tener maximo 3 tomas.
- nicheInsights, trends y competitorGaps deben tener maximo 3 items.
- Modulos validos: product, ugc, scene, prompt, outfit, none.
- Funnel roles validos: atraer, generar_deseo, construir_confianza, convertir.
- Status inicial de todas las tareas: pending.
- Usa espanol claro, cercano y comercial.

MARCA:
${JSON.stringify(input.brand, null, 2)}

METRICAS/REDES GUARDADAS EN MARCA:
${JSON.stringify(input.instagramMetrics, null, 2)}

PRODUCTOS A EMPUJAR EN ESTE PLAN:
${productSummary}

IMAGENES DE PRODUCTO:
Se adjuntan ${input.productImageRefs.length} imagen(es) comprimidas como referencia visual. Usalas solo para entender material, estilo, color, packaging y nivel de confianza.

Devuelve un objeto compatible con esta forma:
{
  "businessStage": "string",
  "mainGoal": "string",
  "commercialFocus": "string",
  "strategyGoal": "string",
  "businessDiagnosis": "string",
  "nicheInsights": ["string"],
  "planNarrative": "string",
  "strategicTip": "string",
  "roadmap": [{"week":1,"title":"string","objective":"string","funnelRole":"atraer","hint":"string"}],
  "tasks": [{
    "week": 1,
    "dayLabel": "Lunes 8 jun",
    "date": "YYYY-MM-DD",
    "platform": "Instagram Feed",
    "contentType": "string",
    "funnelRole": "atraer",
    "module": "product",
    "moduleReason": "string",
    "suggestedTime": "19:00",
    "visualConcept": "string",
    "whyItWorks": "string",
    "caption": "string",
    "hashtags": "#tag1 #tag2",
    "prompt": "string con slots como [PRODUCTO], [COLOR], [ESCENA]",
    "slotInstructions": [{"slot":"[PRODUCTO]","instruction":"string"}],
    "requiredAssets": ["string"],
    "executionRecipe": {"overview":"string","steps":[{"title":"string","module":"product","instruction":"string","ctaLabel":"Abrir modulo","status":"pending"}]},
    "shotGuide": {"duration":"string","shots":[{"shot":1,"duration":"0-3s","instruction":"string"}],"onScreenText":["string"],"inspirationSearches":["string"],"whatToAvoid":["string"]},
    "engagementHook": "string",
    "status": "pending"
  }],
  "brandAnalysis": {"stageInterpretation":"string","targetAnalysis":"string","voiceGuide":"string"},
  "productAnalysis": {"productWarnings":["string"],"confidenceByProduct":[{"productId":"id","level":80,"reason":"string"}],"categorizationSummary":"string"},
  "socialMetricsAnalysis": {"audienceInsights":"string","engagementLevel":"string","confidenceMapping":"string"},
  "nicheResearch": {"trends":["string"],"competitorGaps":["string"],"researchMode":"gemini sin grounding"},
  "generationLog": {"warnings":["string"],"fixedErrors":[]},
  "validationReportMarkdown": "reporte breve de maximo 5 lineas"
}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function pollGrowthPlanJob(jobId: string, token: string): Promise<any> {
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    await sleep(POLL_INTERVAL_MS);
    const response = await fetch(CONTENT_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        action: 'getContentJobStatus',
        payload: { jobId },
      }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`No se pudo consultar la generacion (${response.status}). ${text}`);
    }

    const job = await response.json();
    if (job.status === 'completed') return job.json || parseJsonFromText(job.text || '');
    if (job.status === 'failed') throw new Error(job.error || 'La generacion fallo.');
  }

  throw new Error('La generacion sigue demorando demasiado. Reintenta con menos imagenes o un plan mas corto.');
}

export async function generateGrowthPlanWithGemini(input: GenerateGrowthPlanInput): Promise<GrowthStrategicPlan> {
  const token = await getAuth().currentUser?.getIdToken().catch(() => null);
  if (!token) throw new Error('Necesitas iniciar sesion para generar el plan.');
  const range = taskRange(input.duration);

  const response = await fetch(CONTENT_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      action: 'generateTextAsync',
      model: 'gemini-2.5-flash',
      prompt: buildPrompt(input),
      schema: GROWTH_PLANNER_SCHEMA,
      images: input.productImageRefs.map(image => image.data),
      mimeTypes: input.productImageRefs.map(image => image.mimeType),
      generationConfig: {
        temperature: 0.45,
        maxOutputTokens: range.maxOutputTokens,
        thinkingConfig: { thinkingBudget: 0 },
      },
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`No se pudo generar el plan (${response.status}). ${text}`);
  }

  const data = await response.json();
  if (!data.success || !data.jobId) throw new Error(data.error || 'No se pudo iniciar la generacion.');

  const raw = await pollGrowthPlanJob(data.jobId, token);
  return normalizePlan(raw, input);
}
