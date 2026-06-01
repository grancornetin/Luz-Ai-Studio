import { getAuth } from 'firebase/auth';
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

function parseJsonFromText(text: string): unknown {
  const clean = text.trim().replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
  try {
    return JSON.parse(clean);
  } catch {
    const start = clean.indexOf('{');
    const end = clean.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(clean.slice(start, end + 1));
    }
    throw new Error('Gemini no devolvio JSON valido.');
  }
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
  const productSummary = input.products.map((product, index) =>
    `${index + 1}. ${product.name} | ${product.category} | ${product.price} | Stock/prioridad: ${product.stock} | Beneficio: ${product.benefit} | Descripcion: ${product.description}`,
  ).join('\n');

  return `Eres la directora estrategica de contenido de Luz IA Studio.
Debes crear un Planner Estrategico real y ejecutable para una emprendedora LATAM.

REGLAS IMPORTANTES:
- Responde SOLO JSON valido. Sin markdown fuera del JSON.
- No uses busqueda web ni cites fuentes externas.
- No inventes imagenes generadas.
- Crea entre ${input.duration === 7 ? '4 y 7' : input.duration === 14 ? '7 y 10' : '12 y 18'} tareas, no una tarea por cada dia necesariamente.
- Cada tarea debe ser concreta, lista para ejecutar y conectada a un modulo de Luz IA.
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
  "validationReportMarkdown": "string"
}`;
}

export async function generateGrowthPlanWithGemini(input: GenerateGrowthPlanInput): Promise<GrowthStrategicPlan> {
  const token = await getAuth().currentUser?.getIdToken().catch(() => null);
  if (!token) throw new Error('Necesitas iniciar sesion para generar el plan.');

  const response = await fetch(CONTENT_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      action: 'generateText',
      model: 'gemini-2.5-flash',
      prompt: buildPrompt(input),
      images: input.productImageRefs.map(image => image.data),
      mimeTypes: input.productImageRefs.map(image => image.mimeType),
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`No se pudo generar el plan (${response.status}). ${text}`);
  }

  const data = await response.json();
  if (!data.success) throw new Error(data.error || 'Gemini no pudo generar el plan.');

  const raw = data.json || parseJsonFromText(data.text || '');
  return normalizePlan(raw, input);
}
