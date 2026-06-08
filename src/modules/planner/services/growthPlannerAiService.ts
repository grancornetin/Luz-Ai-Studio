import { getAuth } from 'firebase/auth';
import { Type } from '@google/genai';
import { v4 as uuidv4 } from 'uuid';
import type {
  GrowthBrand,
  GrowthContentModule,
  GrowthCtaTarget,
  GrowthEstimatedEffort,
  GrowthFunnelRole,
  GrowthInstagramMetrics,
  GrowthPlanDuration,
  GrowthProduct,
  GrowthStrategicPlan,
  GrowthTask,
  GrowthTaskPriority,
  GrowthTaskStatus,
} from '../growthPlannerTypes';
import {
  brandMemoryId,
  buildCreativeTaskBatchPrompt,
  buildHookRepairPrompt,
  buildEngineV2ValidationReport,
  buildPlanMemory,
  compatibleBlueprints,
  CONTRACT_LOCKED_FIELDS,
  CREATIVE_TASK_BATCH_SCHEMA,
  HOOK_REPAIR_BATCH_SCHEMA,
  detectBusinessArchetype,
  detectRepeatedBlueprints,
  detectRepeatedCaptions,
  generatePlanSkeleton,
  getBlueprintById,
  loadPreviousPlanMemory,
  mergeCreativeFields,
  normalizeCreativeTextV2,
  normalizeProductsForEngineV2,
  savePlanMemory,
  selectCampaignAngle,
  selectNicheAdapter,
  selectSalesAggressiveness,
  validateFinalPlan,
  validateContractLock,
  validateTaskAgainstBlueprint,
  type CreativeTaskFields,
  type EngineV2Metadata,
  type GeneratedTaskV2,
  type HookRepairFields,
  type PlanSkeletonTask,
  type PlannerEngineV2Input,
  type TaskBlueprint,
} from '../growthPlanner/engineV2';

interface GenerateGrowthPlanInput {
  duration: GrowthPlanDuration;
  brand: GrowthBrand;
  products: GrowthProduct[];
  instagramMetrics: GrowthInstagramMetrics;
  productImageRefs: { data: string; mimeType: string; label: string }[];
}

interface GrowthPlanGenerationProgress {
  stepId: string;
  label: string;
}

interface GenerateGrowthPlanOptions {
  onProgress?: (progress: GrowthPlanGenerationProgress) => void;
}

const CONTENT_ENDPOINT = '/api/gemini/content';
const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 90;
const MAX_WEEK_GENERATION_ATTEMPTS = 3;
const MAX_WEEK_REPAIR_ATTEMPTS = 2;
const MAX_COMPLETION_ROUNDS = 3;
const ALLOW_GENERIC_TASK_FALLBACK = false;
const MAX_PRODUCTS_IN_PROMPT = 30;
const MAX_PRODUCT_LINE_CHARS = 220;
const MAX_PRODUCT_SUMMARY_CHARS = 6500;
const MAX_STRATEGY_CONTEXT_CHARS = 4500;
const MAX_EXISTING_TASKS_CHARS = 3500;
const MAX_ERROR_CONTEXT_CHARS = 1200;
const MAX_REPAIR_JSON_CHARS = 4500;
const FUNNEL_ROLE_VALUES = ['atraer', 'generar_deseo', 'construir_confianza', 'convertir'];
const CONTENT_MODULE_VALUES = ['product', 'ugc', 'scene', 'prompt', 'outfit', 'none'];
const TASK_STATUS_VALUES = ['pending', 'in_progress', 'ready', 'published', 'skipped'];
const ESTIMATED_EFFORT_VALUES = ['bajo', 'medio', 'alto'];
const TASK_PRIORITY_VALUES = ['primary', 'support'];
const CTA_TARGET_VALUES = ['Instagram DM', 'Comentario', 'Facebook comentario', 'DM Facebook', 'Link', 'WhatsApp', 'Link en bio', 'Guardar', 'Responder story'];
const STORY_CONTENT_TYPES = ['Encuesta', 'Q&A', 'Secuencia de stories', 'Recordatorio', 'Demo rapida', 'Story estatica', 'Reel vertical'];
const INSTAGRAM_FEED_CONTENT_TYPES = ['Reel', 'Carrusel', 'Post educativo', 'Post con imagen', 'Publicacion de prueba social', 'Demo rapida'];
const FACEBOOK_CONTENT_TYPES = ['Post educativo', 'Publicacion de prueba social', 'Q&A', 'Encuesta', 'Reel', 'Carrusel'];
const ALLOWED_SLOTS = [
  '@producto1',
  '@producto2',
  '@producto3',
  '@producto4',
  '@persona1',
  '@outfit1',
  '@escena1',
  '@referencia1',
];

export const weakMarketingPhrases = [
  'empoderar',
  'empoderamiento',
  'pasion',
  'pasión',
  'contenido de valor',
  'brillar',
  'upgrade',
  'transforma tu negocio',
  'calidad profesional sin gastar una fortuna',
  'lista para brillar',
  'lleva tu marca al siguiente nivel',
  'solucion definitiva',
  'solución definitiva',
  'aliado visual',
  'tu exito empieza aqui',
  'tu éxito empieza aquí',
  'creatividad sin limites',
  'creatividad sin límites',
  'eleva tu marca a otro nivel',
  'calidad profesional a tu alcance',
  'imagenes de revista',
  'imágenes de revista',
  'transforma tus fotos',
  'marca exitosa',
  'emprendimiento inteligente',
  'magia',
  'magico',
  'mÃ¡gico',
  'infinitas posibilidades',
  'escala tu marca',
  'vende mas',
  'vende mÃ¡s',
  'impulso que necesita',
];

const weakPhraseReplacements: Record<string, string> = {
  empoderar: 'ayudar a crear contenido mas profesional con menos friccion',
  empoderamiento: 'autonomia para producir contenido comercial',
  pasion: 'oficio y constancia comercial',
  pasión: 'oficio y constancia comercial',
  'contenido de valor': 'contenido que explica una ventaja concreta y facilita la compra',
  brillar: 'verse mas profesional frente al cliente',
  upgrade: 'mejora visible',
  'transforma tu negocio': 'mejora el proceso de venta y publicacion',
  'calidad profesional sin gastar una fortuna': 'imagenes mas cuidadas sin contratar una produccion completa',
  'lista para brillar': 'lista para publicar con claridad comercial',
  'lleva tu marca al siguiente nivel': 'ordena la marca para vender con mas consistencia',
  'solucion definitiva': 'proceso concreto para crear fotos de producto listas para publicar',
  'solución definitiva': 'proceso concreto para crear fotos de producto listas para publicar',
  'aliado visual': 'herramienta para mejorar imagenes sin montar un set',
  'tu exito empieza aqui': 'el siguiente paso es mostrar el producto con mas claridad',
  'tu éxito empieza aquí': 'el siguiente paso es mostrar el producto con mas claridad',
  'creatividad sin limites': 'opciones visuales mas faciles de producir',
  'creatividad sin límites': 'opciones visuales mas faciles de producir',
  'eleva tu marca a otro nivel': 'muestra tu producto con una escena mas profesional',
  'calidad profesional a tu alcance': 'mejora tus imagenes sin montar un set',
  'imagenes de revista': 'imagenes limpias y listas para publicar',
  'imágenes de revista': 'imagenes limpias y listas para publicar',
  'transforma tus fotos': 'mejora tus imagenes para redes',
  'marca exitosa': 'marca con publicaciones mas consistentes',
  'emprendimiento inteligente': 'negocio que ahorra tiempo creando contenido visual para redes',
  magia: 'proceso claro para crear imagenes listas para publicar',
  magico: 'facil de ejecutar',
  'mÃ¡gico': 'facil de ejecutar',
  'infinitas posibilidades': 'variaciones visuales para campanas concretas',
  'escala tu marca': 'organiza la produccion visual segun el volumen que necesitas',
  'vende mas': 'abre conversaciones de compra mas claras',
  'vende mÃ¡s': 'abre conversaciones de compra mas claras',
  'impulso que necesita': 'siguiente accion comercial concreta',
};

const weakPhraseRules: Array<{ pattern: RegExp; label: string; replacement: string }> = [
  { pattern: /\bmagia\b|\bm[aÃ¡]gic\w*/gi, label: 'magia/magico', replacement: 'proceso claro para crear imagenes listas para publicar' },
  { pattern: /\brevista\b|\bim[aÃ¡]genes?\s+de\s+revista\b/gi, label: 'revista', replacement: 'imagenes listas para publicar' },
  { pattern: /\bempoder\w+/gi, label: 'empoderar', replacement: 'dar autonomia para producir contenido comercial' },
  { pattern: /\btransform\w+/gi, label: 'transformar', replacement: 'mejorar fotos de producto sin montar un set' },
  { pattern: /\bescal\w+/gi, label: 'escalar', replacement: 'organizar la produccion visual segun el volumen de contenido' },
  { pattern: /\b[eÃ©]xito\w*/gi, label: 'exito', replacement: 'resultado medible' },
  { pattern: /\bbrill\w+/gi, label: 'brillar', replacement: 'verse claro y profesional en redes' },
  { pattern: /\bimpulso\b|\bimpulso\s+que\s+necesita\b/gi, label: 'impulso', replacement: 'siguiente accion comercial concreta' },
  { pattern: /\baliad\w+/gi, label: 'aliado', replacement: 'herramienta de produccion visual' },
  { pattern: /\binfinitas\s+posibilidades\b/gi, label: 'infinitas posibilidades', replacement: 'variaciones visuales para campanas concretas' },
  { pattern: /\bvende\s+m[aÃ¡]s\b/gi, label: 'vende mas', replacement: 'abre conversaciones de compra mas claras' },
  { pattern: /\bcalidad\s+profesional\s+a\s+tu\s+alcance\b/gi, label: 'calidad profesional a tu alcance', replacement: 'mejorar fotos de producto sin montar un set' },
];

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
    supportPrompt: { type: Type.STRING },
    supportModule: { type: Type.STRING, enum: CONTENT_MODULE_VALUES },
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
    estimatedEffort: { type: Type.STRING, enum: ESTIMATED_EFFORT_VALUES },
    taskPriority: { type: Type.STRING, enum: TASK_PRIORITY_VALUES },
    ctaTarget: { type: Type.STRING, enum: CTA_TARGET_VALUES },
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
    'estimatedEffort',
    'taskPriority',
    'ctaTarget',
    'status',
  ],
};

const strategyBriefSchema = {
  type: Type.OBJECT,
  properties: {
    masterObjective: { type: Type.STRING },
    commercialPromise: { type: Type.STRING },
    targetCustomer: { type: Type.STRING },
    brandVoice: { type: Type.STRING },
    priorityProducts: stringArraySchema,
    mainObjections: stringArraySchema,
    contentAngles: stringArraySchema,
    prohibitedLanguage: stringArraySchema,
    channelRules: stringArraySchema,
    moduleRules: stringArraySchema,
    weeklyAngles: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          week: { type: Type.NUMBER },
          objective: { type: Type.STRING },
          angle: { type: Type.STRING },
          recommendedProducts: stringArraySchema,
          ctaFocus: { type: Type.STRING },
        },
        required: ['week', 'objective', 'angle', 'recommendedProducts', 'ctaFocus'],
      },
    },
  },
  required: [
    'masterObjective',
    'commercialPromise',
    'targetCustomer',
    'brandVoice',
    'priorityProducts',
    'mainObjections',
    'contentAngles',
    'prohibitedLanguage',
    'channelRules',
    'moduleRules',
    'weeklyAngles',
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
  if (duration === 7) return { min: 5, modelTasks: 5, maxOutputTokens: 4096 };
  if (duration === 14) return { min: 12, modelTasks: 12, maxOutputTokens: 6144 };
  return { min: 25, modelTasks: 25, maxOutputTokens: 8192 };
}

const GROWTH_STRATEGY_SCHEMA = {
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
    strategyBrief: strategyBriefSchema,
    roadmap: GROWTH_PLANNER_SCHEMA.properties.roadmap,
    brandAnalysis: GROWTH_PLANNER_SCHEMA.properties.brandAnalysis,
    productAnalysis: GROWTH_PLANNER_SCHEMA.properties.productAnalysis,
    socialMetricsAnalysis: GROWTH_PLANNER_SCHEMA.properties.socialMetricsAnalysis,
    nicheResearch: GROWTH_PLANNER_SCHEMA.properties.nicheResearch,
    generationLog: GROWTH_PLANNER_SCHEMA.properties.generationLog,
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
    'strategyBrief',
    'roadmap',
    'brandAnalysis',
    'productAnalysis',
    'socialMetricsAnalysis',
    'nicheResearch',
    'generationLog',
    'validationReportMarkdown',
  ],
};

const TASK_BATCH_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    tasks: { type: Type.ARRAY, items: taskSchema },
    generationLog: {
      type: Type.OBJECT,
      properties: {
        warnings: stringArraySchema,
        fixedErrors: stringArraySchema,
      },
      required: ['warnings', 'fixedErrors'],
    },
  },
  required: ['tasks', 'generationLog'],
};

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

function safeEstimatedEffort(value: string | undefined): GrowthEstimatedEffort {
  return ESTIMATED_EFFORT_VALUES.includes(value || '')
    ? value as GrowthEstimatedEffort
    : 'medio';
}

function safeTaskPriority(value: string | undefined): GrowthTaskPriority {
  return TASK_PRIORITY_VALUES.includes(value || '')
    ? value as GrowthTaskPriority
    : 'primary';
}

function safeCtaTarget(value: string | undefined): GrowthCtaTarget {
  return CTA_TARGET_VALUES.includes(value || '')
    ? value as GrowthCtaTarget
    : 'Instagram DM';
}

function isTextualManualAction(task: GrowthTask): boolean {
  return /encuesta|q&a|pregunta|respuesta|recordatorio|comentario|publicacion manual|publicaci[oÃ³]n manual|post educativo textual|texto|dm|whatsapp|sticker/i.test(
    `${task.contentType} ${task.visualConcept} ${task.caption} ${task.executionRecipe.steps.map(step => step.instruction).join(' ')}`,
  );
}

function ctaTargetsForPlatform(platform: GrowthTask['platform']): GrowthCtaTarget[] {
  if (platform === 'Stories') return ['Responder story', 'Link en bio', 'Instagram DM'];
  if (platform === 'Instagram Feed') return ['Instagram DM', 'Comentario', 'Guardar', 'Link en bio'];
  if (platform === 'Facebook') return ['Facebook comentario', 'DM Facebook', 'Link'];
  if (platform === 'WhatsApp') return ['WhatsApp'];
  return ['Instagram DM', 'Comentario', 'Guardar'];
}

function normalizeCtaTargetForPlatform(task: GrowthTask, ctx: ValidationContext): GrowthTask {
  const allowed = ctaTargetsForPlatform(task.platform);
  if (allowed.includes(task.ctaTarget)) return task;
  const text = `${task.contentType} ${task.caption} ${task.engagementHook}`.toLowerCase();
  let ctaTarget: GrowthCtaTarget = allowed[0];

  if (task.platform === 'Instagram Feed') {
    ctaTarget = /guardar|guarda/.test(text) ? 'Guardar' : /coment/.test(text) ? 'Comentario' : 'Instagram DM';
  } else if (task.platform === 'Facebook') {
    ctaTarget = /dm|mensaje/.test(text) ? 'DM Facebook' : /link|bio|checkout/.test(text) ? 'Link' : 'Facebook comentario';
  } else if (task.platform === 'Stories') {
    ctaTarget = /link|bio|checkout/.test(text) ? 'Link en bio' : /dm|mensaje/.test(text) ? 'Instagram DM' : 'Responder story';
  } else if (task.platform === 'WhatsApp') {
    ctaTarget = 'WhatsApp';
  }

  ctx.fixedErrors.push(`CTA incompatible corregido en "${task.contentType}": ${task.ctaTarget} -> ${ctaTarget}.`);
  return { ...task, ctaTarget };
}

function contentTypeFromAllowed(task: GrowthTask, allowed: string[]): string {
  if (allowed.includes(task.contentType)) return task.contentType;
  const text = `${task.contentType} ${task.visualConcept} ${task.caption}`.toLowerCase();
  if (/encuesta|votar|elige|opcion|opci[oÃ³]n/.test(text) && allowed.includes('Encuesta')) return 'Encuesta';
  if (/q&a|pregunta|duda|objecion|objeci[oÃ³]n/.test(text) && allowed.includes('Q&A')) return 'Q&A';
  if (/recordatorio|cierre|stock|precio|dm/.test(text) && allowed.includes('Recordatorio')) return 'Recordatorio';
  if (/demo|rapida|r[aÃ¡]pida|uso/.test(text) && allowed.includes('Demo rapida')) return 'Demo rapida';
  if (/reel|video|vertical/.test(text) && allowed.includes('Reel')) return 'Reel';
  if (/reel|video|vertical/.test(text) && allowed.includes('Reel vertical')) return 'Reel vertical';
  if (/carrusel|comparacion|paso a paso|guia|guia/.test(text) && allowed.includes('Carrusel')) return 'Carrusel';
  if (/prueba social|testimonio|review/.test(text) && allowed.includes('Publicacion de prueba social')) return 'Publicacion de prueba social';
  if (/imagen|producto|foto/.test(text) && allowed.includes('Post con imagen')) return 'Post con imagen';
  if (/post|educativo|explica|guia/.test(text) && allowed.includes('Post educativo')) return 'Post educativo';
  return allowed[0];
}

function normalizePlatformFormatTask(task: GrowthTask, ctx: ValidationContext): GrowthTask {
  let allowed: string[] | null = null;
  if (task.platform === 'Stories') allowed = STORY_CONTENT_TYPES;
  if (task.platform === 'Instagram Feed') allowed = INSTAGRAM_FEED_CONTENT_TYPES;
  if (task.platform === 'Facebook') allowed = FACEBOOK_CONTENT_TYPES;
  if (!allowed) return task;

  const contentType = contentTypeFromAllowed(task, allowed);
  if (contentType === task.contentType) return task;
  ctx.fixedErrors.push(`Formato corregido para ${task.platform}: ${task.contentType} -> ${contentType}.`);
  return { ...task, contentType };
}

function normalizeEngagementHookForCta(task: GrowthTask, ctx: ValidationContext): GrowthTask {
  const lower = task.engagementHook.toLowerCase();
  let engagementHook = task.engagementHook;
  if (task.platform !== 'Stories' && /responde esta story|responde la story|sticker/.test(lower)) {
    engagementHook = task.platform === 'Facebook'
      ? 'Comenta PLAN y te recomendamos una opcion segun tu ritmo de publicacion.'
      : 'Envianos DM con PLAN y te recomendamos una opcion segun tu ritmo de publicacion.';
    ctx.fixedErrors.push(`CTA de story removido de ${task.platform} en "${task.contentType}".`);
  }
  if (task.platform !== 'Facebook' && /facebook|comenta en facebook/.test(lower)) {
    engagementHook = task.platform === 'Stories'
      ? 'Responde esta story con PLAN y revisamos que opcion te conviene.'
      : 'Envianos DM con PLAN y revisamos que opcion te conviene.';
    ctx.fixedErrors.push(`CTA de Facebook removido de ${task.platform} en "${task.contentType}".`);
  }
  return { ...task, engagementHook };
}

function inferStoryFormat(task: GrowthTask): string {
  const text = `${task.contentType} ${task.funnelRole} ${task.visualConcept}`.toLowerCase();
  if (/encuesta|votar|elige|opcion|opci[oÃ³]n/.test(text)) return 'Encuesta';
  if (/pregunta|objecion|objeci[oÃ³]n|duda|q&a|qa/.test(text)) return 'Q&A';
  if (/recordatorio|cierre|dm|whatsapp|stock|precio/.test(text)) return 'Recordatorio';
  if (/demo|uso|rapida|r[aÃ¡]pida|muestra/.test(text)) return 'Demo rapida';
  return 'Secuencia de stories';
}

function inferEstimatedEffort(task: GrowthTask): GrowthEstimatedEffort {
  const text = `${task.platform} ${task.contentType} ${task.module} ${task.executionRecipe.steps.map(step => step.instruction).join(' ')}`.toLowerCase();
  const stepCount = task.executionRecipe.steps.length;
  const shotCount = task.shotGuide.shots.length;
  if (task.platform === 'WhatsApp' || /encuesta|q&a|recordatorio|comentario|guardar|responder story/.test(text)) return 'bajo';
  if (task.platform === 'Stories' && stepCount <= 2) return 'bajo';
  if (task.module === 'ugc' || task.module === 'scene' || task.module === 'outfit' || /reel|video|demo|try-on|produccion|producci[oÃ³]n/.test(text) || shotCount >= 3) return 'alto';
  if (task.module === 'product' || task.module === 'prompt' || /carrusel|post educativo|publicaci[oÃ³]n/.test(text)) return 'medio';
  return 'medio';
}

function inferCtaTarget(task: GrowthTask): GrowthCtaTarget {
  const text = `${task.platform} ${task.funnelRole} ${task.contentType} ${task.caption} ${task.engagementHook}`.toLowerCase();
  if (task.platform === 'Stories') return 'Responder story';
  if (task.platform === 'WhatsApp') return 'WhatsApp';
  if (task.platform === 'Facebook') return 'Facebook comentario';
  if (/guardar|guarda/.test(text) && task.funnelRole !== 'convertir') return 'Guardar';
  if (/link|bio|checkout/.test(text) && task.funnelRole === 'convertir') return 'Link en bio';
  return 'Instagram DM';
}

function directPlanCta(task: GrowthTask, index: number): string {
  if (task.ctaTarget === 'Responder story') return 'Responde esta story con CREDITOS si quieres saber cuantas imagenes necesitas al mes.';
  if (task.ctaTarget === 'Facebook comentario') return 'Comenta PLAN y te recomendamos Explorer, Starter, Pro o Studio segun cuantos productos quieres mover.';
  if (task.ctaTarget === 'DM Facebook') return 'Envianos DM por Facebook con PLAN y revisamos que opcion calza con tu ritmo de contenido.';
  if (task.ctaTarget === 'Comentario') return 'Comenta PLAN y te recomendamos uno segun tu ritmo de publicacion.';
  if (task.ctaTarget === 'WhatsApp') return 'Responde con STARTER, PRO o STUDIO y te ayudo a elegir segun tu volumen de contenido.';
  if (task.ctaTarget === 'Link' || task.ctaTarget === 'Link en bio') return 'Abre el link y compara Explorer, Starter, Pro y Studio segun cuantos creditos necesitas al mes.';
  if (task.ctaTarget === 'Guardar') return 'Guarda esta comparacion para elegir tu plan segun productos, tiempo y ritmo de publicacion.';
  const ctas = [
    'Escribenos STARTER y te decimos si 200 creditos alcanzan para tu ritmo de publicacion.',
    'Envianos DM con PRO si quieres ver que puedes producir con 500 creditos.',
    'Escribenos STUDIO si necesitas contenido para varios productos o campanas activas.',
    'Envianos DM con EXPLORER si quieres validar una semana de contenido con 60 creditos.',
  ];
  if (task.platform === 'Stories') return 'Responde esta story con CREDITOS si quieres saber cuantas imagenes necesitas al mes.';
  if (task.platform === 'Facebook') return 'Comenta PLAN y te recomendamos Explorer, Starter, Pro o Studio segun cuantos productos quieres mover.';
  if (task.platform === 'WhatsApp') return 'Responde con STARTER, PRO o STUDIO y te ayudo a elegir segun tu volumen de contenido.';
  return ctas[index % ctas.length];
}

function normalizeCta(task: GrowthTask, index: number, ctx: ValidationContext): GrowthTask {
  let ctaTarget = safeCtaTarget(task.ctaTarget) || inferCtaTarget(task);
  const text = `${task.contentType} ${task.caption} ${task.engagementHook}`.toLowerCase();
  const sellsPlan = task.week >= 4 || /starter|\bpro\b|studio|explorer|credito|cr[eÃ©]dito|plan/.test(text);
  let engagementHook = task.engagementHook;

  if (sellsPlan || task.funnelRole === 'convertir') {
    ctaTarget = task.platform === 'Stories'
      ? 'Responder story'
      : task.platform === 'Facebook'
        ? index % 2 === 0 ? 'Facebook comentario' : 'DM Facebook'
        : task.platform === 'WhatsApp'
          ? 'WhatsApp'
          : index % 3 === 1 ? 'Comentario' : 'Instagram DM';
    engagementHook = directPlanCta({ ...task, ctaTarget }, index);
  } else if (/link en bio|haz clic|compra ahora|vende m[aÃ¡]s/.test(engagementHook.toLowerCase())) {
    ctaTarget = task.platform === 'Stories' ? 'Responder story' : task.platform === 'Facebook' ? 'Facebook comentario' : 'Instagram DM';
    engagementHook = ctaTarget === 'Responder story'
      ? 'Responde esta story con INFO y te mando una recomendacion concreta.'
      : ctaTarget === 'Facebook comentario'
        ? 'Comenta INFO y te mando la opcion mas simple para empezar.'
        : 'Envianos DM con INFO y te ayudamos a elegir el siguiente paso.';
    ctx.fixedErrors.push(`CTA generico reemplazado en "${task.contentType}".`);
  }

  return { ...task, ctaTarget, engagementHook };
}

function normalizePlatformFormat(task: GrowthTask, ctx: ValidationContext): GrowthTask {
  return normalizePlatformFormatTask(task, ctx);
}

function normalizePrimaryModule(task: GrowthTask, ctx: ValidationContext): GrowthTask {
  let next = task;
  const text = `${task.contentType} ${task.visualConcept} ${task.caption} ${task.prompt} ${task.supportPrompt || ''}`.toLowerCase();
  const previousModule = next.module;

  if (isTextualManualAction(next)) {
    next = {
      ...next,
      module: 'none',
      moduleReason: 'La accion principal es responder, preguntar, publicar texto o activar una interaccion nativa.',
      supportPrompt: next.prompt || next.supportPrompt,
      supportModule: next.prompt ? previousModule : next.supportModule,
      prompt: '',
    };
  } else if (/reel|video|persona|creadora|creador|hablando|usando|try-on|ugc/.test(text)) {
    next = { ...next, module: 'ugc', moduleReason: 'La pieza principal requiere una persona usando o explicando el producto.' };
  } else if (/escena|referencia|recrear|ambiente|set/.test(text)) {
    next = { ...next, module: 'scene', moduleReason: 'La pieza principal necesita una escena o referencia visual especifica.' };
  } else if (/prompt|variacion|variaciones|guia de prompts|ideas de prompt/.test(text)) {
    next = { ...next, module: 'prompt', moduleReason: 'La pieza principal se apoya en instrucciones o variaciones de prompt.' };
  } else if (/producto|foto|catalogo|catalogo|carrusel|imagen/.test(text)) {
    next = { ...next, module: 'product', moduleReason: 'La pieza principal esta centrada en producto o imagen de venta.' };
  }

  if (next.module !== previousModule) {
    ctx.fixedErrors.push(`Modulo principal corregido en "${task.contentType}": ${previousModule} -> ${next.module}.`);
  }
  return next;
}

interface ProductNormalizationResult {
  products: GrowthProduct[];
  warnings: string[];
  fixedErrors: string[];
  ignoredLines: string[];
}

interface ValidationContext {
  warnings: string[];
  fixedErrors: string[];
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map(value => value.trim()).filter(Boolean)));
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 50) || `product_${Date.now()}`;
}

function cleanProductLine(line: string): string {
  return line
    .replace(/^#{1,6}\s*/, '')
    .replace(/^[-*•]\s*/, '')
    .trim();
}

function parseProductHeading(line: string): { name: string; details: string } | null {
  const clean = cleanProductLine(line);
  const match = clean.match(/^(plan\s+[a-z0-9 áéíóúñ]+?)\s*(?:[-–—|:]|\s{2,})\s*(.+)$/i);
  if (match) return { name: match[1].trim(), details: match[2].trim() };
  if (/^plan\s+[a-z0-9 áéíóúñ]+$/i.test(clean)) return { name: clean, details: '' };
  return null;
}

function extractPlanCommercialFields(details: string, body: string[]) {
  const source = [details, ...body].join(' / ');
  const priceMatch = source.match(/(\$\s?\d+(?:[.,]\d+)?(?:\s?USD)?\s*\/\s*(?:unico|único|semana|mes|año|ano))/i);
  const creditsMatch = source.match(/(\d{1,5}\s+cr[eé]ditos?(?:\s+(?:al registrarte|por semana|semanales|mensuales|por mes|al mes))?)/i);
  return {
    price: priceMatch?.[1]?.replace(/\s+/g, ' ').trim() || 'Precio no indicado',
    credits: creditsMatch?.[1]?.replace(/\s+/g, ' ').trim() || '',
  };
}

function inferIdealFor(productName: string): string {
  const name = productName.toLowerCase();
  if (name.includes('gratis')) return 'Usuario nuevo que quiere probar la herramienta antes de pagar.';
  if (name.includes('explorer')) return 'Emprendedor que necesita una semana intensa de contenido para validar o lanzar.';
  if (name.includes('starter')) return 'Marca pequeña que publica de forma constante y necesita volumen mensual moderado.';
  if (name.includes('pro')) return 'Negocio que vende por redes y requiere contenido frecuente para campañas activas.';
  if (name.includes('studio')) return 'Equipo o marca con alto volumen de piezas visuales y varios productos.';
  return 'Usuario que necesita contenido visual mas claro para vender en redes.';
}

function inferMessageKey(productName: string, credits: string): string {
  const creditText = credits ? ` con ${credits}` : '';
  if (/gratis/i.test(productName)) return `Prueba Luz IA${creditText} antes de elegir un plan pagado.`;
  if (/explorer/i.test(productName)) return `Una semana de contenido visual para validar campanas sin contratar produccion.`;
  if (/starter/i.test(productName)) return `Contenido visual constante para redes con un costo mensual controlado.`;
  if (/pro/i.test(productName)) return `Mas volumen para sostener lanzamientos, productos y campanas de venta.`;
  if (/studio/i.test(productName)) return `Produccion visual de alto volumen para marcas con calendario activo.`;
  return `Permite crear contenido visual para redes sin depender de sesiones costosas.`;
}

function productFromLines(lines: string[], index: number, ctx: ProductNormalizationResult): GrowthProduct | null {
  if (!lines.length) return null;
  const heading = parseProductHeading(lines[0]);
  if (!heading) {
    const pipeParts = lines[0].split('|').map(part => part.trim()).filter(Boolean);
    if (pipeParts.length >= 2) {
      const [name, category = 'Producto', price = 'Precio no indicado', benefit = 'Beneficio por definir'] = pipeParts;
      return {
        id: slugify(name || `Producto ${index + 1}`),
        name: name || `Producto ${index + 1}`,
        category,
        description: lines.join(' '),
        price,
        stock: 'Prioridad seleccionada para este plan',
        benefit,
        rawSourceLines: lines,
      };
    }
    ctx.ignoredLines.push(...lines);
    ctx.warnings.push(`Linea no agrupada como producto: ${lines[0]}`);
    return null;
  }

  const body = lines.slice(1).map(cleanProductLine);
  const commercial = extractPlanCommercialFields(heading.details, body);
  const credits = commercial.credits || body.find(line => /credito|crédito/i.test(line)) || '';
  const idealFor = body.find(line => /para el|para la|ideal para|emprendedor|emprendedora|marca/i.test(line)) || '';
  const messageKey = body.find(line => /mensaje clave/i.test(line))?.replace(/mensaje clave\s*:?\s*/i, '') || '';
  const inferredFields: string[] = [];
  const finalIdealFor = idealFor || inferIdealFor(heading.name);
  const finalMessageKey = messageKey || inferMessageKey(heading.name, credits);
  if (!idealFor) inferredFields.push('idealFor');
  if (!messageKey) inferredFields.push('messageKey');
  const useCases = body
    .filter(line => /lanzamiento|campana|campaña|uso|crear|publica|publicar/i.test(line))
    .slice(0, 4);
  const benefit = finalMessageKey
    || body.find(line => /permite|ayuda|sirve|ideal/i.test(line))
    || 'Permite crear contenido visual constante para redes sin depender de sesiones costosas.';
  const warnings: string[] = [];
  if (!credits) warnings.push('Sin creditos detectados');
  if (!idealFor) warnings.push('Publico ideal inferido');
  if (!messageKey) warnings.push('Mensaje clave inferido');

  if (lines.length > 1) {
    ctx.fixedErrors.push(`${heading.name}: producto agrupado automaticamente desde ${lines.length} lineas.`);
  }
  warnings.forEach(warning => ctx.warnings.push(`${heading.name}: ${warning}.`));

  return {
    id: slugify(heading.name),
    name: heading.name,
    category: /plan/i.test(heading.name) ? 'Plan de suscripcion' : 'Producto',
    description: lines.join(' '),
    price: commercial.price,
    stock: credits || 'Disponibilidad no indicada',
    benefit,
    credits,
    idealFor: finalIdealFor,
    useCases,
    messageKey: finalMessageKey,
    inferredFields,
    rawSourceLines: lines,
    warnings,
  };
}

function normalizePlannerProductsDetailed(rawProducts: string | GrowthProduct[]): ProductNormalizationResult {
  const result: ProductNormalizationResult = { products: [], warnings: [], fixedErrors: [], ignoredLines: [] };

  if (Array.isArray(rawProducts)) {
    const products = rawProducts.map((product, index) => ({
      ...product,
      id: product.id || slugify(product.name || `Producto ${index + 1}`),
      rawSourceLines: product.rawSourceLines || [product.description || product.name],
      warnings: product.warnings || [],
    }));
    result.products = products;
    products.flatMap(product => product.warnings || []).forEach(warning => result.warnings.push(warning));
    return result;
  }

  const lines = rawProducts
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);
  let current: string[] = [];

  lines.forEach(line => {
    const isHeading = Boolean(parseProductHeading(line));
    const isPipeProduct = line.includes('|') && !/^[-*•]/.test(line);
    if ((isHeading || isPipeProduct) && current.length) {
      const product = productFromLines(current, result.products.length, result);
      if (product) result.products.push(product);
      current = [];
    }
    current.push(line);
  });

  if (current.length) {
    const product = productFromLines(current, result.products.length, result);
    if (product) result.products.push(product);
  }

  if (!result.products.length && lines.length) {
    result.products = lines.slice(0, 20).map((line, index) => ({
      id: `product_${index + 1}`,
      name: cleanProductLine(line) || `Producto ${index + 1}`,
      category: 'Producto',
      description: line,
      price: 'Precio no indicado',
      stock: 'Prioridad seleccionada para este plan',
      benefit: 'Beneficio por definir',
      rawSourceLines: [line],
      warnings: ['Producto creado con baja confianza desde una linea suelta'],
    }));
    result.warnings.push('Productos creados con baja confianza porque no se detectaron encabezados ni separadores claros.');
  }

  return result;
}

export function normalizePlannerProducts(rawProducts: string | GrowthProduct[]): GrowthProduct[] {
  return normalizePlannerProductsDetailed(rawProducts).products;
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function startOfToday(): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function parseDateOrNull(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDayLabel(date: Date, index: number): string {
  const days = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];
  const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${days[date.getDay()]} ${date.getDate()} ${months[date.getMonth()] || ''}`.trim() || `Dia ${index + 1}`;
}

function validateAndFixTaskDates(tasks: GrowthTask[], duration: GrowthPlanDuration, ctx: ValidationContext, planStartDate?: string) {
  const today = startOfToday();
  const requested = planStartDate ? parseDateOrNull(planStartDate) : null;
  const base = requested && requested >= today ? requested : today;
  const max = new Date(base);
  max.setDate(base.getDate() + duration - 1);
  let fixes = 0;

  const fixedTasks = tasks.map((task, index) => {
    const current = parseDateOrNull(task.date);
    const spreadOffset = Math.min(duration - 1, Math.floor(index * duration / Math.max(tasks.length, 1)));
    const fallback = new Date(base);
    fallback.setDate(base.getDate() + spreadOffset);
    const shouldFix = !current || current < base || current > max;
    if (!shouldFix) return task;
    fixes += 1;
    ctx.fixedErrors.push(`Fecha corregida en tarea ${index + 1}: ${task.date || 'sin fecha'} -> ${toIsoDate(fallback)}.`);
    return {
      ...task,
      date: toIsoDate(fallback),
      dayLabel: formatDayLabel(fallback, index),
    };
  });

  const datesValid = fixedTasks.every(task => {
    const date = parseDateOrNull(task.date);
    return Boolean(date && date >= base && date <= max);
  });

  return {
    tasks: fixedTasks,
    dateBaseUsed: toIsoDate(base),
    dateFixesApplied: fixes,
    datesValid,
    noPastDates: fixedTasks.every(task => {
      const date = parseDateOrNull(task.date);
      return Boolean(date && date >= today);
    }),
  };
}

function normalizeSlotName(slot: string): string {
  const clean = slot.trim().toLowerCase();
  const productNumber = clean.match(/producto\s*([1-4])|product\s*([1-4])|@producto([1-4])/i)?.[1]
    || clean.match(/producto\s*([1-4])|product\s*([1-4])|@producto([1-4])/i)?.[2]
    || clean.match(/producto\s*([1-4])|product\s*([1-4])|@producto([1-4])/i)?.[3];
  if (productNumber) return `@producto${productNumber}`;
  if (clean.includes('producto')) return '@producto1';
  if (clean.includes('persona') || clean.includes('modelo') || clean.includes('creador')) return '@persona1';
  if (clean.includes('outfit') || clean.includes('prenda')) return '@outfit1';
  if (clean.includes('escena') || clean.includes('superficie') || clean.includes('fondo')) return '@escena1';
  if (clean.includes('referencia')) return '@referencia1';
  return ALLOWED_SLOTS.includes(slot) ? slot : '';
}

function normalizePromptSlots(task: GrowthTask, ctx: ValidationContext): GrowthTask {
  const originalPrompt = task.prompt;
  const originalSupportPrompt = task.supportPrompt || '';
  let prompt = task.prompt
    .replace(/\[(PRODUCTO|PRODUCT|PLAN|SERVICIO)\]/gi, '@producto1')
    .replace(/\[(PRODUCTO\s*1|PRODUCT_1|PRIMER_PRODUCTO)\]/gi, '@producto1')
    .replace(/\[(PRODUCTO2|PRODUCT_2|SEGUNDO_PRODUCTO)\]/gi, '@producto2')
    .replace(/\[(PRODUCTO\s*2|PRODUCTO_2|PRODUCT\s*2)\]/gi, '@producto2')
    .replace(/\[(PRODUCTO3|PRODUCTO\s*3|PRODUCT_3|PRODUCT\s*3|TERCER_PRODUCTO)\]/gi, '@producto3')
    .replace(/\[(PRODUCTO4|PRODUCTO\s*4|PRODUCT_4|PRODUCT\s*4|CUARTO_PRODUCTO)\]/gi, '@producto4')
    .replace(/\[(PERSONA|MODELO|CREADORA|CREADOR)\]/gi, '@persona1')
    .replace(/\[(OUTFIT|PRENDA|LOOK)\]/gi, '@outfit1')
    .replace(/\[(ESCENA|SUPERFICIE|FONDO|SET)\]/gi, '@escena1')
    .replace(/\[(REFERENCIA|REF)\]/gi, '@referencia1');

  if (/\[[^\]]+\]/.test(prompt)) {
    ctx.warnings.push(`Tarea "${task.contentType}": quedaron placeholders no estandarizados en el prompt.`);
    prompt = prompt.replace(/\[[^\]]+\]/g, '').replace(/\s{2,}/g, ' ').trim();
  }

  const textSuggestsProduct = /producto|plan|oferta|precio|catalogo|catálogo|pack|suscripcion|suscripción/i.test(
    `${task.contentType} ${task.visualConcept} ${task.caption} ${prompt}`,
  );
  if (task.module !== 'none' && textSuggestsProduct && !/@producto[12]\b/.test(prompt)) {
    prompt = `Usa @producto1 como producto principal. ${prompt}`.trim();
    ctx.fixedErrors.push(`Slot @producto1 agregado en tarea "${task.contentType}".`);
  }

  const slotInstructionMap = new Map<string, string>();
  task.slotInstructions.forEach(slot => {
      const normalized = normalizeSlotName(slot.slot);
      if (!normalized) {
        ctx.warnings.push(`Slot descartado en tarea "${task.contentType}": ${slot.slot}.`);
        return;
      }
      if (!slotInstructionMap.has(normalized)) {
        slotInstructionMap.set(normalized, slot.instruction);
      } else if (slotInstructionMap.get(normalized) !== slot.instruction) {
        ctx.fixedErrors.push(`Instrucciones duplicadas consolidadas para ${normalized} en "${task.contentType}".`);
      }
  });

  const slotInstructions: GrowthTask['slotInstructions'] = Array.from(slotInstructionMap.entries())
    .map(([slot, instruction]) => ({ slot, instruction }));

  ALLOWED_SLOTS.forEach(slot => {
    if (prompt.includes(slot) && !slotInstructions.some(item => item.slot === slot)) {
      slotInstructions.push({ slot, instruction: `Reemplaza ${slot} con el asset correspondiente antes de ejecutar.` });
    }
  });

  if (prompt !== originalPrompt) {
    ctx.fixedErrors.push(`Slots normalizados en tarea "${task.contentType}".`);
  }

  let supportPrompt = task.supportPrompt;
  if (supportPrompt) {
    supportPrompt = supportPrompt
      .replace(/\[(PRODUCTO|PRODUCT|PLAN|SERVICIO)\]/gi, '@producto1')
      .replace(/\[(PRODUCTO\s*2|PRODUCTO2|PRODUCT_2|SEGUNDO_PRODUCTO)\]/gi, '@producto2')
      .replace(/\[(PRODUCTO\s*3|PRODUCTO3|PRODUCT_3|TERCER_PRODUCTO)\]/gi, '@producto3')
      .replace(/\[(PRODUCTO\s*4|PRODUCTO4|PRODUCT_4|CUARTO_PRODUCTO)\]/gi, '@producto4')
      .replace(/\[(PERSONA|MODELO|CREADORA|CREADOR)\]/gi, '@persona1')
      .replace(/\[(OUTFIT|PRENDA|LOOK)\]/gi, '@outfit1')
      .replace(/\[(ESCENA|SUPERFICIE|FONDO|SET)\]/gi, '@escena1')
      .replace(/\[(REFERENCIA|REF)\]/gi, '@referencia1')
      .replace(/\[[^\]]+\]/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
    ALLOWED_SLOTS.forEach(slot => {
      if (supportPrompt?.includes(slot) && !slotInstructions.some(item => item.slot === slot)) {
        slotInstructions.push({ slot, instruction: `Reemplaza ${slot} con el asset correspondiente antes de ejecutar.` });
      }
    });
    if (supportPrompt !== originalSupportPrompt) {
      ctx.fixedErrors.push(`Slots normalizados en supportPrompt de "${task.contentType}".`);
    }
  }

  return { ...task, prompt, supportPrompt, slotInstructions };
}

function validateModuleMapping(task: GrowthTask, ctx: ValidationContext): GrowthTask {
  const text = `${task.platform} ${task.contentType} ${task.visualConcept} ${task.caption} ${task.moduleReason}`.toLowerCase();
  let nextModule = task.module;
  let reason = task.moduleReason;

  if (/whatsapp|dm|mensaje directo|encuesta|texto|pantalla|screen|grabacion de pantalla|grabación de pantalla|proceso/i.test(text)) {
    nextModule = 'none';
    reason = 'Tarea manual o de comunicacion directa; no requiere modulo visual automatico.';
  } else if (/unboxing|review|testimonio|persona|creadora|creador|mostrando|usando/i.test(text)) {
    nextModule = 'ugc';
    reason = 'Incluye persona o prueba social mostrando el producto.';
  } else if (/flat lay|catalogo|catálogo|foto de producto|mockup|packaging|producto/i.test(text)) {
    nextModule = 'product';
    reason = 'Requiere imagen o composicion centrada en producto.';
  } else if (/recrear|referencia|escena|composicion|composición/i.test(text)) {
    nextModule = 'scene';
    reason = 'Requiere recrear una escena o referencia visual.';
  } else if (/outfit|look|prenda/i.test(text)) {
    nextModule = 'outfit';
    reason = 'Se relaciona con prendas u outfit.';
  }

  if (nextModule !== task.module) {
    ctx.fixedErrors.push(`Modulo corregido en "${task.contentType}": ${task.module} -> ${nextModule}.`);
  }

  return { ...task, module: nextModule, moduleReason: reason };
}

function normalizeManualSupportPrompt(task: GrowthTask, ctx: ValidationContext): GrowthTask {
  if (task.module !== 'none') return task;
  let supportPrompt = task.supportPrompt || task.prompt;
  if (!supportPrompt) return { ...task, prompt: '' };
  supportPrompt = supportPrompt
    .replace(/\[(PRODUCTO|PRODUCT|PLAN|SERVICIO)\]/gi, '@producto1')
    .replace(/\[(PRODUCTO\s*2|PRODUCTO2|PRODUCT_2|SEGUNDO_PRODUCTO)\]/gi, '@producto2')
    .replace(/\[(PRODUCTO\s*3|PRODUCTO3|PRODUCT_3|TERCER_PRODUCTO)\]/gi, '@producto3')
    .replace(/\[(PRODUCTO\s*4|PRODUCTO4|PRODUCT_4|CUARTO_PRODUCTO)\]/gi, '@producto4')
    .replace(/\[(PERSONA|MODELO|CREADORA|CREADOR)\]/gi, '@persona1')
    .replace(/\[(OUTFIT|PRENDA|LOOK)\]/gi, '@outfit1')
    .replace(/\[(ESCENA|SUPERFICIE|FONDO|SET)\]/gi, '@escena1')
    .replace(/\[(REFERENCIA|REF)\]/gi, '@referencia1')
    .replace(/\[[^\]]+\]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  const supportModule = task.supportModule && task.supportModule !== 'none' ? task.supportModule : 'product';
  const slotInstructions = [...task.slotInstructions];
  ALLOWED_SLOTS.forEach(slot => {
    if (supportPrompt.includes(slot) && !slotInstructions.some(item => item.slot === slot)) {
      slotInstructions.push({ slot, instruction: `Reemplaza ${slot} con el asset correspondiente antes de ejecutar.` });
    }
  });
  ctx.fixedErrors.push(`Prompt principal movido a supportPrompt en tarea manual "${task.contentType}".`);
  return {
    ...task,
    prompt: '',
    supportModule,
    supportPrompt,
    slotInstructions,
  };
}

function hashtagSeedFor(input: GenerateGrowthPlanInput): string[] {
  const category = slugify(input.brand.category).replace(/_/g, '');
  const brand = slugify(input.brand.name).replace(/_/g, '');
  return uniqueStrings([
    `#${category}`,
    `#${brand}`,
    '#emprendedoras',
    '#contenidopararedes',
    '#ventasonline',
    '#marketingdigital',
    '#negociodigital',
    '#ecommerce',
    '#instagramparanegocios',
    '#creaciondecontenido',
    '#marcapersonal',
    '#tiendaonline',
  ]);
}

function validateHashtags(task: GrowthTask, input: GenerateGrowthPlanInput, ctx: ValidationContext): GrowthTask {
  if (task.platform === 'WhatsApp' || task.module === 'none') {
    if (task.hashtags.trim()) {
      ctx.fixedErrors.push(`Hashtags eliminados en tarea manual "${task.contentType}".`);
    }
    return { ...task, hashtags: '' };
  }

  const existing = uniqueStrings((task.hashtags.match(/#[a-z0-9_áéíóúñ]+/gi) || [])
    .filter(tag => !['#viral', '#fyp', '#parati', '#follow'].includes(tag.toLowerCase())));
  const brandTag = '#LuzIAStudio';
  const seed = hashtagSeedFor(input).filter(tag => tag.toLowerCase() !== brandTag.toLowerCase());

  if (task.platform === 'Stories') {
    const target = uniqueStrings([...existing, brandTag]).slice(0, 3);
    if (target.join(' ') !== task.hashtags.trim()) {
      ctx.fixedErrors.push(`Hashtags reducidos para Stories en "${task.contentType}".`);
    }
    return { ...task, hashtags: target.join(' ') };
  }

  const target = uniqueStrings([...existing, brandTag, ...seed]).slice(0, 10);
  const minimum = task.platform === 'Instagram Feed' || task.platform === 'Facebook' ? 6 : 4;
  const finalTags = target.slice(0, Math.max(minimum, Math.min(10, target.length)));
  if (finalTags.length < minimum || finalTags.join(' ') !== task.hashtags.trim()) {
    ctx.fixedErrors.push(`Hashtags limpiados en tarea "${task.contentType}" (${existing.length} -> ${finalTags.length}).`);
  }
  return { ...task, hashtags: finalTags.join(' ') };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function weakLanguageLabels(text: string): string[] {
  const labels: string[] = [];
  const source = text.toLowerCase();
  weakMarketingPhrases.forEach(phrase => {
    if (source.includes(phrase.toLowerCase())) labels.push(phrase);
  });
  weakPhraseRules.forEach(rule => {
    rule.pattern.lastIndex = 0;
    if (rule.pattern.test(text)) labels.push(rule.label);
    rule.pattern.lastIndex = 0;
  });
  return uniqueStrings(labels);
}

function brokenSentenceLabels(text: string): string[] {
  const labels: string[] = [];
  const source = text.toLowerCase();
  if (/mejorar fotos de producto sin montar un set\s+(esas|tus|tu|el|la|los|las|una|un|este|esta|esas|estas)\b/i.test(text)) {
    labels.push('reemplazo pegado despues de "mejorar fotos de producto sin montar un set"');
  }
  if (/crear imagenes listas para publicar\s+(esas|tus|tu|el|la|los|las|una|un|este|esta)\b/i.test(text)) {
    labels.push('reemplazo pegado despues de "crear imagenes listas para publicar"');
  }
  if (/\b(null|undefined)\b/i.test(text)) labels.push('texto visible null/undefined');
  if (/\b(\w{4,})\b(?:\s+\1\b){1,}/i.test(source)) labels.push('repeticion consecutiva');
  if (/sin montar un set\s+tu negocio|sin montar un set\s+tus fotos|sin montar un set\s+esas imagenes/i.test(text)) {
    labels.push('frase rota por reemplazo mecanico');
  }
  return uniqueStrings(labels);
}

function naturalSentenceForContext(context: string): string {
  const lower = context.toLowerCase();
  if (lower.includes('caption')) {
    return 'Una foto simple puede comunicar mejor cuando el producto se ve claro, con buena luz y una escena ordenada.';
  }
  if (lower.includes('visualconcept')) {
    return 'Imagen limpia del producto con fondo simple, buena luz y composicion lista para publicar.';
  }
  if (lower.includes('whyitworks')) {
    return 'Funciona porque muestra una accion concreta y facilita iniciar una conversacion de compra.';
  }
  if (lower.includes('prompt')) {
    return 'Crea una imagen lista para publicar con @producto1, fondo limpio, buena luz y composicion clara para redes.';
  }
  if (lower.includes('instruction')) {
    return 'Prepara una pieza simple, revisa que el producto se entienda y cierra con una accion clara.';
  }
  if (lower.includes('onscreentext')) {
    return 'Imagen lista para publicar';
  }
  if (lower.includes('contenttype')) {
    return 'Publicacion de prueba social';
  }
  if (lower.includes('businessdiagnosis')) {
    return 'La marca necesita mostrar productos con mas claridad y convertir el interes en conversaciones de compra.';
  }
  if (lower.includes('strategictip')) {
    return 'Publica una idea concreta por pieza y usa CTAs que abran conversacion por DM, comentario o story.';
  }
  if (lower.includes('plannarrative')) {
    return 'El plan combina piezas de producto, prueba social y conversion para producir contenido con menos friccion.';
  }
  return 'Luz IA Studio ayuda a preparar contenido para redes con menos friccion y una accion comercial clara.';
}

function splitSentences(text: string): string[] {
  return text.match(/[^.!?]+[.!?]?/g)?.map(sentence => sentence.trim()).filter(Boolean) || [text];
}

function rewriteWeakPhraseSentence(text: string, context: string): string {
  if (!text || text.trim().toLowerCase() === 'null' || text.trim().toLowerCase() === 'undefined') return '';
  const sentences = splitSentences(text);
  const next = sentences.map(sentence => {
    if (weakLanguageLabels(sentence).length || brokenSentenceLabels(sentence).length) {
      return naturalSentenceForContext(context);
    }
    return sentence;
  });
  return uniqueStrings(next).join(' ').replace(/\s+/g, ' ').trim();
}

function filterWeakPhrasesText(value: string, field: string, ctx: ValidationContext): string {
  const next = rewriteWeakPhraseSentence(value, field);
  if (next !== value) {
    const labels = uniqueStrings([...weakLanguageLabels(value), ...brokenSentenceLabels(value)]);
    ctx.fixedErrors.push(`Frase reescrita en ${field}: ${labels.join(', ') || 'lenguaje poco natural'}.`);
  }
  return next;
}

function applyWeakPhraseFilter(plan: GrowthStrategicPlan, ctx: ValidationContext): GrowthStrategicPlan {
  return {
    ...plan,
    strategyGoal: filterWeakPhrasesText(plan.strategyGoal, 'strategyGoal', ctx),
    businessDiagnosis: filterWeakPhrasesText(plan.businessDiagnosis, 'businessDiagnosis', ctx),
    planNarrative: filterWeakPhrasesText(plan.planNarrative, 'planNarrative', ctx),
    strategicTip: filterWeakPhrasesText(plan.strategicTip, 'strategicTip', ctx),
    tasks: plan.tasks.map(task => ({
      ...task,
      contentType: filterWeakPhrasesText(task.contentType, `contentType/${task.contentType}`, ctx),
      moduleReason: filterWeakPhrasesText(task.moduleReason, `moduleReason/${task.contentType}`, ctx),
      visualConcept: filterWeakPhrasesText(task.visualConcept, `visualConcept/${task.contentType}`, ctx),
      whyItWorks: filterWeakPhrasesText(task.whyItWorks, `whyItWorks/${task.contentType}`, ctx),
      caption: filterWeakPhrasesText(task.caption, `caption/${task.contentType}`, ctx),
      prompt: filterWeakPhrasesText(task.prompt, `prompt/${task.contentType}`, ctx),
      supportPrompt: task.supportPrompt
        ? filterWeakPhrasesText(task.supportPrompt, `supportPrompt/${task.contentType}`, ctx)
        : task.supportPrompt,
      engagementHook: filterWeakPhrasesText(task.engagementHook, `engagementHook/${task.contentType}`, ctx),
    })),
  };
}

function validateSlots(tasks: GrowthTask[]): boolean {
  return tasks.every(task => !/\[[^\]]+\]/.test(`${task.prompt} ${task.supportPrompt || ''}`)
    && task.slotInstructions.every(slot => ALLOWED_SLOTS.includes(slot.slot)));
}

function validateModules(tasks: GrowthTask[]): boolean {
  return tasks.every(task => CONTENT_MODULE_VALUES.includes(task.module));
}

function validateHashtagState(tasks: GrowthTask[]): boolean {
  return tasks.every(task => {
    const count = task.hashtags.match(/#[a-z0-9_áéíóúñ]+/gi)?.length || 0;
    if (task.platform === 'WhatsApp' || task.module === 'none') return task.hashtags.trim() === '';
    if (task.platform === 'Stories') return count <= 3;
    if (task.platform === 'Instagram Feed' || task.platform === 'Facebook') return count >= 6 && count <= 10;
    return count >= 4 && count <= 10;
  });
}

function validateCommercialFields(tasks: GrowthTask[]): boolean {
  return tasks.every(task =>
    ESTIMATED_EFFORT_VALUES.includes(task.estimatedEffort)
    && TASK_PRIORITY_VALUES.includes(task.taskPriority)
    && CTA_TARGET_VALUES.includes(task.ctaTarget),
  );
}

function validateStoriesFormats(tasks: GrowthTask[]): boolean {
  return tasks.every(task => task.platform !== 'Stories' || STORY_CONTENT_TYPES.includes(task.contentType));
}

function directPlanSalesTasks(tasks: GrowthTask[]): GrowthTask[] {
  return tasks.filter(task =>
    /explorer|starter|\bpro\b|studio|60|200|500|credito|cr[eÃ©]dito|costo por imagen|prompts|tiempo/i.test(
      `${task.contentType} ${task.visualConcept} ${task.caption} ${task.engagementHook}`,
    ),
  );
}

function funnelRoleForIndex(index: number, total: number): GrowthFunnelRole {
  const pct = total ? index / total : 0;
  if (pct < 0.25) return 'atraer';
  if (pct < 0.5) return 'generar_deseo';
  if (pct < 0.75) return 'construir_confianza';
  return 'convertir';
}

function preferredPlatformForIndex(index: number, duration: GrowthPlanDuration, activeSocials: GrowthBrand['activeSocials']): GrowthTask['platform'] {
  const active: GrowthBrand['activeSocials'] = activeSocials.length
    ? activeSocials
    : ['Instagram Feed'];
  if (duration !== 30) return active[index % active.length] || 'Instagram Feed';
  const monthlyPattern: GrowthTask['platform'][] = [
    'Instagram Feed',
    'Stories',
    'Instagram Feed',
    'Facebook',
    'Instagram Feed',
    'Stories',
    'Instagram Feed',
    'Stories',
    'Facebook',
    'Instagram Feed',
    active.includes('TikTok') ? 'TikTok' : active[0] || 'Instagram Feed',
    active.includes('WhatsApp') ? 'WhatsApp' : active[1] || 'Stories',
  ];
  const candidate = monthlyPattern[index % monthlyPattern.length];
  return active.includes(candidate) || ['Instagram Feed', 'Stories', 'Facebook'].includes(candidate)
    ? candidate
    : active[index % active.length] || 'Instagram Feed';
}

function createFallbackTask(index: number, total: number, input: GenerateGrowthPlanInput): GrowthTask {
  const role = funnelRoleForIndex(index, total);
  const product = input.products[index % Math.max(input.products.length, 1)];
  const productName = product?.name || 'producto principal';
  const platform = preferredPlatformForIndex(index, input.duration, input.brand.activeSocials);
  const module: GrowthContentModule = platform === 'WhatsApp' ? 'none' : role === 'construir_confianza' ? 'ugc' : 'product';
  const contentTypeByRole: Record<GrowthFunnelRole, string> = {
    atraer: 'Problema visible y contexto de compra',
    generar_deseo: 'Demostracion concreta del producto',
    construir_confianza: 'Objecion, prueba social o comparacion',
    convertir: 'CTA directo a plan, DM o checkout',
  };
  const basePrompt = `Crea una pieza comercial limpia usando @producto1 como ${productName}. Muestra una ventaja concreta, fondo simple y composicion lista para redes.`;

  return {
    id: uuidv4(),
    week: Math.min(4, Math.floor(index * 4 / Math.max(total, 1)) + 1),
    dayLabel: `Dia ${index + 1}`,
    date: '',
    platform,
    contentType: contentTypeByRole[role],
    funnelRole: role,
    module,
    moduleReason: module === 'none'
      ? 'Tarea manual de conversion o comunicacion directa.'
      : 'Tarea agregada por fallback para completar cobertura del plan.',
    suggestedTime: input.instagramMetrics.bestTime || '19:00',
    visualConcept: `${productName}: ${contentTypeByRole[role].toLowerCase()}.`,
    whyItWorks: 'Cubre un momento del embudo que faltaba en el plan mensual.',
    caption: `Muestra ${productName} con una razon concreta para comprar o pedir mas informacion.`,
    hashtags: '',
    prompt: module === 'none' ? '' : basePrompt,
    supportPrompt: module === 'none' ? basePrompt : undefined,
    supportModule: module === 'none' ? 'product' : undefined,
    slotInstructions: [{ slot: '@producto1', instruction: `Usa ${productName} como producto principal.` }],
    requiredAssets: [productName],
    executionRecipe: {
      overview: 'Completa esta pieza para equilibrar el calendario.',
      steps: [
        {
          id: uuidv4(),
          title: module === 'none' ? 'Preparar mensaje' : 'Crear pieza visual',
          module: module === 'none' ? 'none' : module,
          instruction: module === 'none'
            ? 'Redacta el mensaje o CTA usando el prompt de apoyo si necesitas una imagen complementaria.'
            : 'Genera la pieza con el modulo recomendado y revisa que el producto sea reconocible.',
          ctaLabel: module === 'none' ? 'Preparar manualmente' : 'Abrir modulo',
          status: 'pending',
        },
      ],
    },
    shotGuide: {
      duration: '15-30 segundos',
      shots: [],
      onScreenText: [],
      inspirationSearches: [],
      whatToAvoid: ['Promesas genericas sin mostrar beneficio concreto.'],
    },
    engagementHook: role === 'convertir' ? 'Pide DM o clic con una condicion clara.' : 'Pregunta por una necesidad concreta del cliente.',
    estimatedEffort: module === 'none' ? 'bajo' : 'medio',
    taskPriority: role === 'convertir' ? 'primary' : 'support',
    ctaTarget: platform === 'Stories' ? 'Responder story' : platform === 'WhatsApp' ? 'WhatsApp' : 'Instagram DM',
    status: 'pending',
  };
}

function ensureMinimumTasks(tasks: GrowthTask[], input: GenerateGrowthPlanInput, ctx: ValidationContext) {
  const expected = taskRange(input.duration).min;
  const generated = tasks.length;
  if (tasks.length >= expected) return { tasks, generated, added: 0, expected };

  if (!ALLOW_GENERIC_TASK_FALLBACK) {
    throw new Error(`Gemini devolvio ${generated} tareas, pero el plan necesita ${expected}. Se debe regenerar el bloque incompleto.`);
  }

  const nextTasks = [...tasks];
  while (nextTasks.length < expected) {
    nextTasks.push(createFallbackTask(nextTasks.length, expected, input));
  }
  ctx.fixedErrors.push(`Se completaron ${expected - generated} tarea(s) faltante(s) por fallback para duration ${input.duration}.`);
  return { tasks: nextTasks, generated, added: expected - generated, expected };
}

function ensureRoadmap(roadmap: GrowthStrategicPlan['roadmap'], duration: GrowthPlanDuration, ctx: ValidationContext) {
  if (duration !== 30) return roadmap;
  const required: GrowthStrategicPlan['roadmap'] = [
    { week: 1, title: 'Atraccion / problema visible', objective: 'Mostrar el problema que el producto resuelve y abrir interes.', funnelRole: 'atraer', hint: 'Contenido de diagnostico, ejemplos y situaciones reconocibles.' },
    { week: 2, title: 'Deseo / demostracion', objective: 'Demostrar producto, herramienta o resultado esperado.', funnelRole: 'generar_deseo', hint: 'Piezas visuales, antes/despues y demostraciones concretas.' },
    { week: 3, title: 'Confianza / objeciones', objective: 'Responder dudas, comparar opciones y sumar prueba social.', funnelRole: 'construir_confianza', hint: 'Reviews, comparaciones y objeciones frecuentes.' },
    { week: 4, title: 'Conversion / cierre', objective: 'Llevar a DM, checkout o eleccion de plan.', funnelRole: 'convertir', hint: 'CTA directo, planes, cierre y recordatorios.' },
  ];
  const merged = [...roadmap];
  required.forEach(item => {
    if (!merged.some(existing => Number(existing.week) === item.week)) {
      merged.push(item);
      ctx.fixedErrors.push(`Roadmap mensual completado con semana ${item.week}: ${item.title}.`);
    }
  });
  return merged.sort((a, b) => a.week - b.week);
}

function countByPlatform(tasks: GrowthTask[]): Record<string, number> {
  return tasks.reduce<Record<string, number>>((acc, task) => {
    acc[task.platform] = (acc[task.platform] || 0) + 1;
    return acc;
  }, {});
}

function countByValue<T extends string>(values: T[]): Record<T, number> {
  return values.reduce<Record<T, number>>((acc, value) => {
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {} as Record<T, number>);
}

function effortCounts(tasks: GrowthTask[]): Record<GrowthEstimatedEffort, number> {
  return countByValue(tasks.map(task => task.estimatedEffort));
}

function priorityCounts(tasks: GrowthTask[]): Record<GrowthTaskPriority, number> {
  return countByValue(tasks.map(task => task.taskPriority));
}

function ctaTargetCounts(tasks: GrowthTask[]): Record<GrowthCtaTarget, number> {
  return countByValue(tasks.map(task => task.ctaTarget));
}

function formatUsageByPlatform(tasks: GrowthTask[]): Record<string, number> {
  return tasks.reduce<Record<string, number>>((acc, task) => {
    const key = `${task.platform} / ${task.contentType}`;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function rebalanceChannels(tasks: GrowthTask[], input: GenerateGrowthPlanInput, ctx: ValidationContext): GrowthTask[] {
  if (input.duration !== 30 || tasks.length < 25) return tasks;
  const active = input.brand.activeSocials;
  const wantsStories = active.includes('Stories');
  const wantsFacebook = active.includes('Facebook');
  const wantsWhatsApp = active.includes('WhatsApp');
  const wantsTikTok = active.includes('TikTok');
  const next = [...tasks];
  const target: GrowthTask['platform'][] = [
    'Instagram Feed',
    'Stories',
    'Instagram Feed',
    'Facebook',
    'Instagram Feed',
    'Stories',
    'Instagram Feed',
    'Stories',
    'Facebook',
    'Instagram Feed',
    wantsTikTok ? 'TikTok' : 'Instagram Feed',
    wantsWhatsApp ? 'WhatsApp' : 'Instagram Feed',
    'Stories',
    'Instagram Feed',
    'Facebook',
    'Instagram Feed',
    'Stories',
    wantsTikTok ? 'TikTok' : 'Instagram Feed',
    'Instagram Feed',
    'Facebook',
    'Stories',
    'Instagram Feed',
    wantsWhatsApp ? 'WhatsApp' : 'Instagram Feed',
    'Instagram Feed',
    'Stories',
    'Instagram Feed',
  ];

  target.forEach((platform, index) => {
    if (!next[index]) return;
    if ((platform === 'Stories' && !wantsStories) || (platform === 'Facebook' && !wantsFacebook)) return;
    if (next[index].platform !== platform) {
      next[index] = { ...next[index], platform };
    }
  });

  const usage = countByPlatform(next);
  active.forEach(platform => {
    if (!usage[platform]) ctx.warnings.push(`La red activa ${platform} no quedo usada en el plan; revisar objetivo o disponibilidad de tareas.`);
  });
  ctx.fixedErrors.push('Distribucion mensual de canales revisada para evitar concentracion excesiva en Instagram Feed.');
  return next;
}

function weekFourSalesAngle(index: number) {
  const angles = [
    {
      plan: 'Explorer',
      contentType: 'Que puedes crear con 60 creditos Explorer',
      visualConcept: 'Comparacion simple de una semana de contenido usando 60 creditos: producto, variaciones y piezas para validar.',
      caption: 'Explorer sirve para probar una semana de contenido sin comprometerte con un plan grande: valida productos, mide respuestas y decide el siguiente paso con datos.',
      whyItWorks: 'Reduce la friccion de entrada y convierte dudas en una prueba concreta.',
    },
    {
      plan: 'Starter',
      contentType: 'Que puedes crear con 200 creditos Starter',
      visualConcept: 'Mapa visual de 200 creditos aplicados a publicaciones semanales, imagenes de producto y variaciones para redes.',
      caption: 'Starter es para marcas que necesitan publicar con constancia: 200 creditos te dan margen para fotos de producto, variaciones y piezas de apoyo durante el mes.',
      whyItWorks: 'Explica volumen mensual con una unidad que la clienta entiende: cantidad de contenido.',
    },
    {
      plan: 'Pro',
      contentType: 'Cuando conviene pasar a Pro',
      visualConcept: 'Escenario de marca con varios productos, campanas activas y necesidad de producir mas variaciones visuales.',
      caption: 'Pro conviene cuando ya tienes varios productos o campanas activas y necesitas producir mas sin frenar cada semana por falta de creditos.',
      whyItWorks: 'Vende el upgrade por necesidad operativa, no por promesa vaga.',
    },
    {
      plan: 'Studio',
      contentType: 'Cuando Studio tiene sentido',
      visualConcept: 'Planificacion de contenido para muchas lineas de producto, equipo o marca con alto volumen visual.',
      caption: 'Studio tiene sentido cuando necesitas contenido para varios productos, muchas pruebas visuales o un calendario comercial mas exigente.',
      whyItWorks: 'Enmarca Studio como respuesta a volumen real de trabajo.',
    },
    {
      plan: 'Comparacion',
      contentType: 'Comparacion de costo por imagen',
      visualConcept: 'Tabla clara comparando creditos, volumen de imagenes y tipo de usuaria ideal para cada plan.',
      caption: 'No elijas el plan mas grande: elige el que calza con cuantas imagenes necesitas producir por semana y cuantos productos vas a mover.',
      whyItWorks: 'Ayuda a decidir sin presion y baja objeciones de precio.',
    },
    {
      plan: 'Objeciones',
      contentType: 'No se si usare todos los creditos',
      visualConcept: 'Q&A sobre creditos, prompts y tiempo disponible, con respuestas concretas para elegir plan.',
      caption: 'Si no sabes si usaras todos los creditos, parte por tu ritmo real: cuantos productos tienes, cuantas publicaciones haces y cuanto tiempo puedes dedicar.',
      whyItWorks: 'Responde objeciones antes de pedir el DM.',
    },
  ];
  return angles[index % angles.length];
}

function contentTypeForSalesPlatform(task: GrowthTask, proposed: string): string {
  if (task.platform === 'Stories') {
    if (/objecion|objeci[oÃ³]n|no se|credito|cr[eÃ©]dito/.test(proposed.toLowerCase())) return 'Q&A';
    return task.funnelRole === 'convertir' ? 'Recordatorio' : 'Secuencia de stories';
  }
  if (task.platform === 'Facebook') {
    return /objecion|objeci[oÃ³]n|pregunta|cuando/.test(proposed.toLowerCase()) ? 'Q&A' : 'Post educativo';
  }
  if (task.platform === 'WhatsApp') return 'Mensaje de cierre';
  if (task.platform === 'Instagram Feed') return /comparacion|que puedes|cu[aÃ¡]ndo|cuando/.test(proposed.toLowerCase()) ? 'Carrusel' : 'Post con imagen';
  return proposed;
}

function strengthenWeekFourPlanSales(task: GrowthTask, index: number, ctx: ValidationContext): GrowthTask {
  if (task.week < 4) return task;
  const text = `${task.contentType} ${task.visualConcept} ${task.caption} ${task.whyItWorks}`.toLowerCase();
  const alreadyConcrete = /explorer|starter|\bpro\b|studio|60|200|500|credito|cr[eÃ©]dito|costo por imagen|prompts|tiempo/.test(text);
  const angle = weekFourSalesAngle(index);
  const contentType = contentTypeForSalesPlatform(task, angle.contentType);
  const next = {
    ...task,
    contentType: alreadyConcrete ? task.contentType : contentType,
    visualConcept: alreadyConcrete ? task.visualConcept : angle.visualConcept,
    caption: alreadyConcrete ? task.caption : angle.caption,
    whyItWorks: alreadyConcrete ? task.whyItWorks : angle.whyItWorks,
    funnelRole: 'convertir' as GrowthFunnelRole,
    estimatedEffort: safeEstimatedEffort(task.estimatedEffort),
  };

  if (!alreadyConcrete) {
    ctx.fixedErrors.push(`Semana 4 reforzada con venta concreta de plan ${angle.plan}.`);
  }

  return next;
}

function normalizeCommercialTask(task: GrowthTask, index: number, ctx: ValidationContext): GrowthTask {
  let next = task;
  next = normalizePlatformFormat(next, ctx);
  next = strengthenWeekFourPlanSales(next, index, ctx);
  const shouldInferCta = (next.platform === 'Stories' && task.ctaTarget !== 'Responder story')
    || (next.platform === 'WhatsApp' && task.ctaTarget !== 'WhatsApp')
    || (next.platform === 'Facebook' && task.ctaTarget === 'Instagram DM');
  next = {
    ...next,
    estimatedEffort: task.estimatedEffort && ESTIMATED_EFFORT_VALUES.includes(task.estimatedEffort)
      ? safeEstimatedEffort(task.estimatedEffort)
      : inferEstimatedEffort(next),
    taskPriority: task.taskPriority && TASK_PRIORITY_VALUES.includes(task.taskPriority)
      ? safeTaskPriority(task.taskPriority)
      : (next.funnelRole === 'convertir' || next.module !== 'none' ? 'primary' : 'support'),
    ctaTarget: !shouldInferCta && task.ctaTarget && CTA_TARGET_VALUES.includes(task.ctaTarget)
      ? safeCtaTarget(task.ctaTarget)
      : inferCtaTarget(next),
  };
  next = normalizeCta(next, index, ctx);
  next = normalizeCtaTargetForPlatform(next, ctx);
  next = normalizeEngagementHookForCta(next, ctx);
  next = normalizePrimaryModule(next, ctx);
  if (next.ctaTarget === 'Link en bio' && next.funnelRole !== 'convertir') {
    next = { ...next, ctaTarget: inferCtaTarget({ ...next, ctaTarget: 'Instagram DM' }) };
    ctx.fixedErrors.push(`CTA Link en bio reemplazado fuera de conversion en "${next.contentType}".`);
  }
  if (next.platform === 'Stories' && /carrusel|carousel/.test(next.contentType.toLowerCase())) {
    next = { ...next, contentType: inferStoryFormat(next) };
  }
  return next;
}

function normalizeTaskPriorities(tasks: GrowthTask[], ctx: ValidationContext): GrowthTask[] {
  const byDate = tasks.reduce<Record<string, number[]>>((acc, task, index) => {
    const key = task.date || task.dayLabel || `task_${index}`;
    acc[key] = acc[key] || [];
    acc[key].push(index);
    return acc;
  }, {});
  const next = [...tasks];

  Object.values(byDate).forEach(indexes => {
    if (indexes.length <= 1) return;
    let primaryIndex = indexes[0];
    indexes.forEach(index => {
      const task = next[index];
      const current = next[primaryIndex];
      const taskScore = (task.funnelRole === 'convertir' ? 3 : 0) + (task.estimatedEffort === 'alto' ? 2 : 0) + (task.module !== 'none' ? 1 : 0);
      const currentScore = (current.funnelRole === 'convertir' ? 3 : 0) + (current.estimatedEffort === 'alto' ? 2 : 0) + (current.module !== 'none' ? 1 : 0);
      if (taskScore > currentScore) primaryIndex = index;
    });
    indexes.forEach(index => {
      next[index] = { ...next[index], taskPriority: index === primaryIndex ? 'primary' : 'support' };
    });
    ctx.fixedErrors.push(`Tareas del dia ${next[primaryIndex].dayLabel} marcadas como primary/support.`);
  });

  return next;
}

function normalizeEffortDistribution(tasks: GrowthTask[], duration: GrowthPlanDuration, ctx: ValidationContext): GrowthTask[] {
  const next = tasks.map(task => ({ ...task, estimatedEffort: safeEstimatedEffort(task.estimatedEffort) }));

  for (let index = 2; index < next.length; index++) {
    if (
      next[index].estimatedEffort === 'alto'
      && next[index - 1].estimatedEffort === 'alto'
      && next[index - 2].estimatedEffort === 'alto'
    ) {
      next[index] = { ...next[index], estimatedEffort: 'medio' };
      ctx.fixedErrors.push(`Esfuerzo alto consecutivo reducido en "${next[index].contentType}".`);
    }
  }

  if (duration !== 30) return next;

  const total = next.length;
  const targetLow = Math.ceil(total * 0.35);
  const targetMedium = Math.ceil(total * 0.35);
  const maxHigh = Math.floor(total * 0.3);

  const counts = () => effortCounts(next);
  const convertOne = (
    from: GrowthEstimatedEffort,
    to: GrowthEstimatedEffort,
    preferSupport = false,
  ) => {
    const index = next.findIndex(task => task.estimatedEffort === from && (!preferSupport || task.taskPriority === 'support'));
    const fallbackIndex = next.findIndex(task => task.estimatedEffort === from);
    const targetIndex = index >= 0 ? index : fallbackIndex;
    if (targetIndex < 0) return false;
    next[targetIndex] = { ...next[targetIndex], estimatedEffort: to };
    return true;
  };

  while ((counts().alto || 0) > maxHigh && convertOne('alto', 'medio', true)) {
    ctx.fixedErrors.push('Distribucion de esfuerzo: una tarea alta paso a media para no saturar el mes.');
  }
  while ((counts().bajo || 0) < targetLow && (convertOne('medio', 'bajo', true) || convertOne('alto', 'bajo', true))) {
    ctx.fixedErrors.push('Distribucion de esfuerzo: se aumento la proporcion de tareas bajas.');
  }
  while ((counts().medio || 0) < targetMedium && ((counts().bajo || 0) > targetLow ? convertOne('bajo', 'medio') : convertOne('alto', 'medio', true))) {
    ctx.fixedErrors.push('Distribucion de esfuerzo: se aumento la proporcion de tareas medias.');
  }

  return next;
}

function effortDistributionValid(tasks: GrowthTask[], duration: GrowthPlanDuration): boolean {
  if (duration !== 30 || !tasks.length) return true;
  const counts = effortCounts(tasks);
  const total = tasks.length;
  return (counts.bajo || 0) >= Math.ceil(total * 0.35)
    && (counts.medio || 0) >= Math.ceil(total * 0.35)
    && (counts.alto || 0) <= Math.floor(total * 0.3)
    && !tasks.some((task, index) => index >= 2
      && task.estimatedEffort === 'alto'
      && tasks[index - 1].estimatedEffort === 'alto'
      && tasks[index - 2].estimatedEffort === 'alto');
}

function planTextEntries(plan: GrowthStrategicPlan): Array<{ path: string; text: string }> {
  const entries: Array<{ path: string; text: string }> = [
    { path: 'planNarrative', text: plan.planNarrative },
    { path: 'businessDiagnosis', text: plan.businessDiagnosis },
    { path: 'strategicTip', text: plan.strategicTip },
  ];
  plan.tasks.forEach((task, taskIndex) => {
    entries.push(
      { path: `tasks.${taskIndex}.caption`, text: task.caption },
      { path: `tasks.${taskIndex}.visualConcept`, text: task.visualConcept },
      { path: `tasks.${taskIndex}.whyItWorks`, text: task.whyItWorks },
    );
    task.shotGuide.onScreenText.forEach((text, index) => entries.push({ path: `tasks.${taskIndex}.shotGuide.onScreenText.${index}`, text }));
    task.executionRecipe.steps.forEach((step, index) => entries.push({ path: `tasks.${taskIndex}.executionRecipe.steps.${index}.instruction`, text: step.instruction }));
    task.shotGuide.shots.forEach((shot, index) => entries.push({ path: `tasks.${taskIndex}.shotGuide.shots.${index}.instruction`, text: shot.instruction }));
  });
  return entries;
}

function weakPhraseIssues(plan: GrowthStrategicPlan): string[] {
  return planTextEntries(plan)
    .flatMap(entry => weakLanguageLabels(entry.text).map(label => `${entry.path}: ${label}`));
}

function brokenSentenceIssues(plan: GrowthStrategicPlan): string[] {
  return planTextEntries(plan)
    .flatMap(entry => brokenSentenceLabels(entry.text).map(label => `${entry.path}: ${label}`));
}

function normalizeCaptionText(task: GrowthTask, index: number, ctx: ValidationContext): string {
  const raw = task.caption.trim().toLowerCase() === 'null' || task.caption.trim().toLowerCase() === 'undefined'
    ? ''
    : task.caption;
  if (raw !== task.caption) ctx.fixedErrors.push(`Caption null corregido en "${task.contentType}".`);
  const rewritten = rewriteWeakPhraseSentence(raw, `caption/${task.contentType}`);
  if (rewritten !== raw) {
    const labels = uniqueStrings([...weakLanguageLabels(raw), ...brokenSentenceLabels(raw)]);
    ctx.fixedErrors.push(`Caption limpiado en "${task.contentType}": ${labels.join(', ') || 'naturalidad'}.`);
  }
  const sentences = splitSentences(rewritten).filter(Boolean);
  const weak = weakLanguageLabels(rewritten).length > 0;
  const broken = brokenSentenceLabels(rewritten).length > 0;
  const overlong = rewritten.length > 420 || sentences.length > 4;
  const canned = /es hora de|descubre c[oÃ³]mo|tu negocio merece|resultados profesionales|resultados increibles|resultados incre[iÃ­]bles/i.test(rewritten);
  if (rewritten && !weak && !broken && !overlong && !canned) return rewritten;

  if (!rewritten && task.platform === 'WhatsApp') return '';

  const opener = task.platform === 'Stories'
    ? 'Una historia simple funciona mejor cuando pide una respuesta concreta.'
    : task.platform === 'Facebook'
      ? 'Una publicacion clara ayuda a que la gente entienda que opcion le conviene.'
      : 'Una foto simple puede hacer que un producto se entienda mejor en redes.';
  const middle = task.week >= 4
    ? 'Compara el plan segun cuantos productos quieres mover y cuantas piezas necesitas al mes.'
    : 'Muestra el producto con buena luz, una idea concreta y una accion facil de responder.';
  const cta = task.engagementHook || directPlanCta(task, index);
  ctx.fixedErrors.push(`Caption reescrito para sonar mas natural en "${task.contentType}".`);
  return `${opener} ${middle} ${cta}`.trim();
}

function validatePlatformCtaCoherence(tasks: GrowthTask[]): boolean {
  return tasks.every(task => ctaTargetsForPlatform(task.platform).includes(task.ctaTarget)
    && !(task.platform !== 'Stories' && /responde esta story|sticker/i.test(task.engagementHook)));
}

function validatePlatformFormatState(tasks: GrowthTask[]): boolean {
  return tasks.every(task => {
    if (task.platform === 'Stories') return STORY_CONTENT_TYPES.includes(task.contentType);
    if (task.platform === 'Instagram Feed') return INSTAGRAM_FEED_CONTENT_TYPES.includes(task.contentType);
    if (task.platform === 'Facebook') return FACEBOOK_CONTENT_TYPES.includes(task.contentType);
    return true;
  });
}

function validatePrimaryModuleAction(tasks: GrowthTask[]): boolean {
  return tasks.every(task => {
    if (isTextualManualAction(task)) return task.module === 'none' && task.prompt === '';
    if (task.module === 'none') return task.prompt === '';
    return CONTENT_MODULE_VALUES.includes(task.module);
  });
}

function validateCaptionsNatural(tasks: GrowthTask[]): boolean {
  return tasks.every(task => {
    if (task.caption.trim().toLowerCase() === 'null' || task.caption.trim().toLowerCase() === 'undefined') return false;
    if (weakLanguageLabels(task.caption).length || brokenSentenceLabels(task.caption).length) return false;
    if (/es hora de|descubre c[oÃ³]mo|tu negocio merece|resultados profesionales|resultados increibles|resultados incre[iÃ­]bles/i.test(task.caption)) return false;
    return splitSentences(task.caption).length <= 4 && task.caption.length <= 480;
  });
}

function normalizeSpanishText(text: string): string {
  if (!text) return text;
  return text
    .replace(/\bconversion\b/gi, 'conversión')
    .replace(/\bfriccion\b/gi, 'fricción')
    .replace(/\bproduccion\b/gi, 'producción')
    .replace(/\bcampanas\b/gi, 'campañas')
    .replace(/\bimagenes\b/gi, 'imágenes')
    .replace(/\bcuantas\b/gi, 'cuántas')
    .replace(/\bcreditos\b/gi, 'créditos')
    .replace(/\bpublicacion\b/gi, 'publicación')
    .replace(/\bsuscripcion\b/gi, 'suscripción')
    .replace(/\bEscribenos\b/g, 'Escríbenos')
    .replace(/\bEnvianos\b/g, 'Envíanos')
    .replace(/\bmodulo\b/gi, 'módulo')
    .replace(/\bdiagnostico\b/gi, 'diagnóstico')
    .replace(/\baccion\b/gi, 'acción')
    .replace(/\bopcion\b/gi, 'opción')
    .replace(/\bsegun\b/gi, 'según')
    .replace(/\btambien\b/gi, 'también')
    .replace(/\bmas\b/gi, 'más')
    .replace(/\bdias\b/gi, 'días')
    .replace(/\brapida\b/gi, 'rápida')
    .replace(/\bestatica\b/gi, 'estática');
}

function hasSpanishOrthographyIssues(text: string): boolean {
  return /\b(conversion|friccion|produccion|campanas|imagenes|cuantas|creditos|publicacion|suscripcion|Escribenos|Envianos|modulo|diagnostico)\b/i.test(text);
}

function normalizeTaskSpanishText(task: GrowthTask, ctx: ValidationContext): GrowthTask {
  const before = JSON.stringify(task);
  const next: GrowthTask = {
    ...task,
    moduleReason: normalizeSpanishText(task.moduleReason),
    visualConcept: normalizeSpanishText(task.visualConcept),
    whyItWorks: normalizeSpanishText(task.whyItWorks),
    caption: normalizeSpanishText(task.caption),
    prompt: normalizeSpanishText(task.prompt),
    supportPrompt: task.supportPrompt ? normalizeSpanishText(task.supportPrompt) : task.supportPrompt,
    engagementHook: normalizeSpanishText(task.engagementHook),
    executionRecipe: {
      ...task.executionRecipe,
      overview: normalizeSpanishText(task.executionRecipe.overview),
      steps: task.executionRecipe.steps.map(step => ({
        ...step,
        title: normalizeSpanishText(step.title),
        instruction: normalizeSpanishText(step.instruction),
        ctaLabel: normalizeSpanishText(step.ctaLabel),
      })),
    },
    shotGuide: {
      ...task.shotGuide,
      duration: normalizeSpanishText(task.shotGuide.duration),
      shots: task.shotGuide.shots.map(shot => ({
        ...shot,
        duration: normalizeSpanishText(shot.duration),
        instruction: normalizeSpanishText(shot.instruction),
      })),
      onScreenText: task.shotGuide.onScreenText.map(normalizeSpanishText),
      inspirationSearches: task.shotGuide.inspirationSearches.map(normalizeSpanishText),
      whatToAvoid: task.shotGuide.whatToAvoid.map(normalizeSpanishText),
    },
  };
  if (JSON.stringify(next) !== before) {
    ctx.fixedErrors.push(`Acentos y ortografía visible corregidos en "${task.contentType}".`);
  }
  return next;
}

function taskInternalText(task: GrowthTask): string {
  return [
    task.platform,
    task.contentType,
    task.module,
    task.supportModule || '',
    task.visualConcept,
    task.caption,
    task.executionRecipe.overview,
    ...task.executionRecipe.steps.map(step => step.instruction),
    task.shotGuide.duration,
    ...task.shotGuide.shots.map(shot => shot.instruction),
    ...task.shotGuide.onScreenText,
    task.ctaTarget,
    task.engagementHook,
  ].join(' ');
}

function taskOrthographyText(task: GrowthTask): string {
  return [
    task.visualConcept,
    task.caption,
    task.whyItWorks,
    task.moduleReason,
    task.prompt,
    task.supportPrompt || '',
    task.executionRecipe.overview,
    ...task.executionRecipe.steps.flatMap(step => [step.title, step.instruction, step.ctaLabel]),
    task.shotGuide.duration,
    ...task.shotGuide.shots.flatMap(shot => [shot.duration, shot.instruction]),
    ...task.shotGuide.onScreenText,
    ...task.shotGuide.inspirationSearches,
    ...task.shotGuide.whatToAvoid,
    task.engagementHook,
  ].join(' ');
}

function platformInternalConflictLabels(task: GrowthTask): string[] {
  const text = taskInternalText(task).toLowerCase();
  const labels: string[] = [];
  if (task.platform === 'Instagram Feed') {
    if (/story|stories|sticker|responde esta story|responder story|encuesta de story/.test(text)) labels.push('Feed menciona Stories o stickers');
    if (/publicar en facebook|facebook/.test(text)) labels.push('Feed menciona Facebook');
    if (!INSTAGRAM_FEED_CONTENT_TYPES.includes(task.contentType)) labels.push('Formato no valido para Instagram Feed');
  }
  if (task.platform === 'Stories') {
    if (!/story|stories|sticker|responder|secuencia|encuesta|q&a|recordatorio/.test(text)) labels.push('Stories no usa lenguaje de stories');
    if (/post con imagen|instagram feed|publicar en facebook|facebook/.test(text)) labels.push('Stories menciona otro formato o plataforma');
    if (!STORY_CONTENT_TYPES.includes(task.contentType)) labels.push('Formato no valido para Stories');
  }
  if (task.platform === 'Facebook') {
    if (/instagram stories|sticker de instagram|responde esta story|responder story/.test(text)) labels.push('Facebook menciona Instagram Stories');
    if (!FACEBOOK_CONTENT_TYPES.includes(task.contentType)) labels.push('Formato no valido para Facebook');
  }
  return uniqueStrings(labels);
}

function isActionableHook(task: GrowthTask): boolean {
  const hook = task.engagementHook.trim();
  if (!hook) return false;
  if (/^(la|el)\s+(frustraci[oó]n|oportunidad|deseo|miedo|problema)\s+de\b/i.test(hook)) return false;
  return /comenta|responde|env[ií]anos|escr[ií]benos|guarda|abre|manda|pide|elige|vota|contesta|haz clic/i.test(hook);
}

function actionableHookForTask(task: GrowthTask): string {
  if (task.ctaTarget === 'Responder story' || task.platform === 'Stories') {
    return 'Responde esta story con CRÉDITOS y te orientamos según tu ritmo de publicación.';
  }
  if (task.ctaTarget === 'Facebook comentario' || task.platform === 'Facebook') {
    return task.contentType.toLowerCase().includes('explorer')
      ? 'Comenta EXPLORER si quieres validar una semana de contenido.'
      : 'Comenta PLAN y te recomendamos una opción según tu ritmo de publicación.';
  }
  if (task.ctaTarget === 'Comentario') {
    return 'Comenta FOTO si quieres que revisemos una imagen de tu producto.';
  }
  if (task.ctaTarget === 'Guardar') {
    return 'Guarda esta guía para comparar planes antes de elegir.';
  }
  if (task.ctaTarget === 'WhatsApp') {
    return 'Respóndenos con PLAN y te ayudamos a elegir según tus productos.';
  }
  return 'Envíanos DM con PLAN y te recomendamos uno.';
}

function coherentVisualConcept(task: GrowthTask): string {
  if (task.platform === 'Stories') {
    return `Secuencia de stories con ${task.contentType.toLowerCase()}, sticker visible y una pregunta simple para responder por DM.`;
  }
  if (task.platform === 'Facebook') {
    return `Publicación para Facebook con mensaje claro, visual simple y CTA a comentario o mensaje privado.`;
  }
  if (task.contentType === 'Reel' || task.contentType === 'Demo rápida') {
    return 'Reel para Instagram Feed mostrando el producto en uso, con una idea concreta y cierre hacia DM.';
  }
  if (task.contentType === 'Carrusel') {
    return 'Carrusel para Instagram Feed con comparación clara, texto breve y cierre conversacional.';
  }
  return 'Post con imagen para Instagram Feed centrado en el producto, con visual limpio y CTA conversacional.';
}

function coherentCaption(task: GrowthTask): string {
  if (task.platform === 'Stories') {
    return `${task.contentType} simple para abrir conversación. Responde esta story con CRÉDITOS y te orientamos según tu ritmo de publicación.`;
  }
  if (task.platform === 'Facebook') {
    return 'Una publicación clara ayuda a comparar opciones sin presión. Comenta PLAN y te recomendamos uno según tu ritmo de publicación.';
  }
  if (task.contentType === 'Carrusel') {
    return 'Compara opciones antes de elegir un plan. Comenta PLAN y te recomendamos uno según cuántas imágenes necesitas al mes.';
  }
  return 'Una imagen clara puede hacer que tu producto se entienda mejor en redes. Envíanos DM con PLAN y revisamos qué opción te conviene.';
}

function coherentRecipe(task: GrowthTask): GrowthTask['executionRecipe'] {
  if (task.platform === 'Stories') {
    return {
      overview: 'Crear una secuencia de stories simple y responder las interacciones.',
      steps: [
        { id: `${task.id}_coherent_step_1`, title: 'Preparar story', module: 'none', instruction: 'Publica una story con una pregunta, encuesta o Q&A según el contenido de la tarea.', ctaLabel: 'Preparar story', status: 'pending' },
        { id: `${task.id}_coherent_step_2`, title: 'Responder', module: 'none', instruction: 'Responde manualmente a quienes interactúen y ofrece una recomendación concreta.', ctaLabel: 'Responder', status: 'pending' },
      ],
    };
  }
  if (task.platform === 'Facebook') {
    return {
      overview: 'Preparar una publicación para Facebook con CTA a comentario o mensaje.',
      steps: [
        { id: `${task.id}_coherent_step_1`, title: 'Crear publicación', module: task.module, instruction: 'Prepara el texto y el visual de apoyo para una publicación de Facebook.', ctaLabel: 'Preparar', status: 'pending' },
        { id: `${task.id}_coherent_step_2`, title: 'Publicar en Facebook', module: 'none', instruction: 'Publica en Facebook y responde comentarios con una recomendación concreta.', ctaLabel: 'Publicar', status: 'pending' },
      ],
    };
  }
  return {
    overview: 'Preparar una publicación para Instagram Feed con CTA a DM o comentario.',
    steps: [
      { id: `${task.id}_coherent_step_1`, title: 'Crear pieza', module: task.module, instruction: 'Genera o prepara la pieza visual para Instagram Feed sin usar stickers ni formato de story.', ctaLabel: 'Crear pieza', status: 'pending' },
      { id: `${task.id}_coherent_step_2`, title: 'Publicar en Feed', module: 'none', instruction: 'Publica en Instagram Feed y cierra con un CTA a DM, comentario o guardado.', ctaLabel: 'Publicar', status: 'pending' },
    ],
  };
}

function coherentShotGuide(task: GrowthTask): GrowthTask['shotGuide'] {
  if (task.platform === 'Stories') {
    return {
      duration: '2-3 stories',
      shots: [
        { shot: 1, duration: 'Story 1', instruction: 'Muestra el problema o comparación con texto breve.' },
        { shot: 2, duration: 'Story 2', instruction: 'Agrega sticker de encuesta, pregunta o Q&A.' },
        { shot: 3, duration: 'Story 3', instruction: 'Cierra pidiendo que respondan la story.' },
      ],
      onScreenText: ['Responde con CRÉDITOS', 'Te orientamos por DM'],
      inspirationSearches: ['instagram story poll product'],
      whatToAvoid: ['Usar formato de post de Feed', 'Pedir comentarios de Facebook'],
    };
  }
  if (task.platform === 'Facebook') {
    return {
      duration: task.contentType === 'Reel' ? '15-30 segundos' : 'No aplica',
      shots: task.contentType === 'Reel'
        ? [
          { shot: 1, duration: '0-5s', instruction: 'Muestra el producto o ejemplo principal.' },
          { shot: 2, duration: '5-15s', instruction: 'Explica la comparación o beneficio de forma simple.' },
          { shot: 3, duration: '15-30s', instruction: 'Cierra pidiendo comentario o mensaje en Facebook.' },
        ]
        : [],
      onScreenText: ['Comenta PLAN', 'Te recomendamos una opción'],
      inspirationSearches: ['facebook product post small business'],
      whatToAvoid: ['Mencionar stickers de Instagram', 'Pedir que respondan una story'],
    };
  }
  return {
    duration: task.contentType === 'Reel' || task.contentType === 'Demo rápida' ? '15-30 segundos' : 'No aplica',
    shots: task.contentType === 'Reel' || task.contentType === 'Demo rápida'
      ? [
        { shot: 1, duration: '0-5s', instruction: 'Muestra el producto o una foto inicial.' },
        { shot: 2, duration: '5-15s', instruction: 'Enseña la mejora visual o comparación.' },
        { shot: 3, duration: '15-30s', instruction: 'Cierra invitando a enviar DM o comentar.' },
      ]
      : [],
    onScreenText: ['Guarda esta guía', 'Escríbenos PLAN'],
    inspirationSearches: ['instagram feed product post'],
    whatToAvoid: ['Hablar de stickers o stories', 'Pedir publicar en Facebook'],
  };
}

function validateTaskInternalCoherence(task: GrowthTask, ctx?: ValidationContext): GrowthTask {
  const before = JSON.stringify(task);
  let next = normalizePlatformFormatTask(task, ctx || { warnings: [], fixedErrors: [] });
  const issues = platformInternalConflictLabels(next);
  const hookWasAbstract = !isActionableHook(next);

  if (issues.length || hookWasAbstract) {
    next = {
      ...next,
      visualConcept: coherentVisualConcept(next),
      caption: coherentCaption(next),
      executionRecipe: coherentRecipe(next),
      shotGuide: coherentShotGuide(next),
      engagementHook: hookWasAbstract ? actionableHookForTask(next) : next.engagementHook,
    };
    next = normalizeCtaTargetForPlatform(next, ctx || { warnings: [], fixedErrors: [] });
    next = normalizePrimaryModule(next, ctx || { warnings: [], fixedErrors: [] });
  }

  next = normalizeTaskSpanishText(next, ctx || { warnings: [], fixedErrors: [] });
  if (ctx && JSON.stringify(next) !== before) {
    const reason = uniqueStrings([...issues, hookWasAbstract ? 'hook abstracto' : '']).join(', ') || 'coherencia interna';
    ctx.fixedErrors.push(`Coherencia interna corregida en "${task.contentType}": ${reason}.`);
  }
  return next;
}

function taskInternalCoherenceIssues(tasks: GrowthTask[]): string[] {
  return tasks.flatMap((task, index) => {
    const issues = platformInternalConflictLabels(task);
    if (!isActionableHook(task)) issues.push('hook no accionable');
    if (hasSpanishOrthographyIssues(taskOrthographyText(task))) issues.push('acentos visibles pendientes');
    return uniqueStrings(issues).map(issue => `Tarea ${index + 1} (${task.platform}/${task.contentType}): ${issue}`);
  });
}

function spanishOrthographyValid(plan: GrowthStrategicPlan): boolean {
  const roadmapText = plan.roadmap.map(item => `${item.title} ${item.objective} ${item.hint}`).join(' ');
  const reportText = plan.validationReportMarkdown || '';
  return !hasSpanishOrthographyIssues(`${plan.planNarrative} ${plan.businessDiagnosis} ${plan.strategicTip} ${roadmapText} ${plan.tasks.map(taskOrthographyText).join(' ')} ${reportText}`);
}

function actionableHooksValid(tasks: GrowthTask[]): boolean {
  return tasks.every(isActionableHook);
}

function rewriteFinalText(value: string, context: string, ctx: ValidationContext): string {
  const next = rewriteWeakPhraseSentence(value, context);
  if (next !== value) {
    const labels = uniqueStrings([...weakLanguageLabels(value), ...brokenSentenceLabels(value)]);
    ctx.fixedErrors.push(`Texto reescrito en escaneo final (${context}): ${labels.join(', ') || 'naturalidad'}.`);
  }
  return next;
}

function finalNaturalLanguageScan(plan: GrowthStrategicPlan, ctx: ValidationContext): GrowthStrategicPlan {
  const tasks = plan.tasks.map((task, index) => {
    let next = normalizePlatformFormatTask(task, ctx);
    next = normalizePrimaryModule(next, ctx);
    next = normalizeCtaTargetForPlatform(next, ctx);
    next = normalizeEngagementHookForCta(next, ctx);
    next = {
      ...next,
      caption: normalizeCaptionText(next, index, ctx),
      visualConcept: rewriteFinalText(next.visualConcept, `visualConcept/${next.contentType}`, ctx),
      whyItWorks: rewriteFinalText(next.whyItWorks, `whyItWorks/${next.contentType}`, ctx),
      executionRecipe: {
        ...next.executionRecipe,
        steps: next.executionRecipe.steps.map(step => ({
          ...step,
          instruction: rewriteFinalText(step.instruction, `instruction/${next.contentType}`, ctx),
        })),
      },
      shotGuide: {
        ...next.shotGuide,
        onScreenText: next.shotGuide.onScreenText
          .map(text => rewriteFinalText(text, `onScreenText/${next.contentType}`, ctx))
          .filter(Boolean),
        shots: next.shotGuide.shots.map(shot => ({
          ...shot,
          instruction: rewriteFinalText(shot.instruction, `shotInstruction/${next.contentType}`, ctx),
        })),
      },
    };
    return next;
  });

  const nextPlan: GrowthStrategicPlan = {
    ...plan,
    planNarrative: rewriteFinalText(plan.planNarrative, 'planNarrative', ctx),
    businessDiagnosis: rewriteFinalText(plan.businessDiagnosis, 'businessDiagnosis', ctx),
    strategicTip: rewriteFinalText(plan.strategicTip, 'strategicTip', ctx),
    tasks,
  };

  const weakAfter = weakPhraseIssues(nextPlan);
  const brokenAfter = brokenSentenceIssues(nextPlan);
  if (weakAfter.length) ctx.warnings.push(`Frases debiles restantes tras escaneo final: ${weakAfter.join(' | ')}`);
  if (brokenAfter.length) ctx.warnings.push(`Frases rotas restantes tras escaneo final: ${brokenAfter.join(' | ')}`);
  return nextPlan;
}

function containsWeakPhrase(plan: GrowthStrategicPlan): boolean {
  return weakPhraseIssues(plan).length > 0;
}

function markdownList(items: string[]): string {
  return items.length ? items.map(item => `- ${item}`).join('\n') : '- Sin hallazgos.';
}

function buildValidationReport(plan: GrowthStrategicPlan): string {
  const normalizedProducts = plan.normalizedProducts || plan.products;
  const efforts = effortCounts(plan.tasks);
  const priorities = priorityCounts(plan.tasks);
  const ctas = ctaTargetCounts(plan.tasks);
  const formats = formatUsageByPlatform(plan.tasks);
  const directSales = directPlanSalesTasks(plan.tasks);
  const weakRemaining = weakPhraseIssues(plan);
  const brokenRemaining = brokenSentenceIssues(plan);
  const ctaFixes = plan.generationLog.fixedErrors.filter(error => /CTA incompatible|CTA de story|CTA de Facebook|CTA Link en bio/i.test(error));
  const nullCaptionFixes = plan.generationLog.fixedErrors.filter(error => /Caption null/i.test(error));
  const supportModuleMoves = plan.generationLog.fixedErrors.filter(error => /Modulo principal corregido|Modulo ajustado|supportPrompt/i.test(error));
  const hashtagFixes = plan.generationLog.fixedErrors.filter(error => /Hashtags/i.test(error));
  const internalIssues = taskInternalCoherenceIssues(plan.tasks);
  const internalFixes = plan.generationLog.fixedErrors.filter(error => /Coherencia interna corregida/i.test(error));
  const platformFixes = plan.generationLog.fixedErrors.filter(error => /Formato corregido|CTA incompatible|CTA de story|CTA de Facebook|Coherencia interna corregida/i.test(error));
  const recipeFixes = internalFixes;
  const hookFixes = plan.generationLog.fixedErrors.filter(error => /hook abstracto|hook accionable|Coherencia interna corregida/i.test(error));
  const accentFixes = plan.generationLog.fixedErrors.filter(error => /Acentos y ortografia visible corregidos|Acentos y ortografía visible corregidos/i.test(error));
  const productRows = normalizedProducts.map(product =>
    `| ${product.name} | ${product.price || '-'} | ${product.credits || '-'} | ${product.idealFor || '-'} | ${product.messageKey || product.benefit || '-'} | ${(product.inferredFields || []).join(', ') || '-'} | ${(product.warnings || []).join('; ') || '-'} |`,
  ).join('\n');
  const taskRows = plan.tasks.map(task =>
    `| ${task.date} | ${task.dayLabel} | ${task.platform} | ${task.module} | ${task.funnelRole} | ${task.contentType} | ${task.estimatedEffort} | ${task.taskPriority} | ${task.ctaTarget} | ${task.engagementHook || '-'} | ${task.supportPrompt ? 'si' : 'no'} |`,
  ).join('\n');
  const roadmap = plan.roadmap.map(item => `- Semana ${item.week}: ${item.title} - ${item.objective}`).join('\n') || '- Sin roadmap.';
  const checks = plan.generationLog.validationChecks;
  const channelUsage = plan.generationLog.channelUsage || countByPlatform(plan.tasks);
  const channelUsageText = Object.entries(channelUsage).map(([channel, count]) => `- ${channel}: ${count}`).join('\n') || '- Sin canales detectados.';
  const effortText = ESTIMATED_EFFORT_VALUES.map(value => `- ${value}: ${efforts[value] || 0}`).join('\n');
  const priorityText = TASK_PRIORITY_VALUES.map(value => `- ${value}: ${priorities[value] || 0}`).join('\n');
  const ctaText = CTA_TARGET_VALUES.map(value => `- ${value}: ${ctas[value] || 0}`).join('\n');
  const formatText = Object.entries(formats).map(([format, count]) => `- ${format}: ${count}`).join('\n') || '- Sin formatos detectados.';
  const directSalesText = directSales.map(task => `- Semana ${task.week} / ${task.platform}: ${task.contentType} -> ${task.engagementHook}`).join('\n') || '- Sin tareas de venta directa por plan detectadas.';
  const supportPrompts = plan.tasks
    .filter(task => task.supportPrompt)
    .map(task => `- ${task.contentType}: supportModule=${task.supportModule || '-'}; supportPrompt=${task.supportPrompt}`)
    .join('\n') || '- Sin support prompts.';
  const slotSummary = plan.tasks
    .map(task => `${task.contentType}: ${task.slotInstructions.map(slot => slot.slot).join(', ') || 'sin slots'}`)
    .join('\n- ');

  return `# Growth Planner Validation Report

## 1. Input resumido
- Marca: ${plan.brand.name}
- Categoria: ${plan.brand.category}
- Objetivo: ${plan.mainGoal}
- Duracion: ${plan.duration} dias
- Canal principal: ${plan.brand.mainSalesChannel}
- Redes activas: ${plan.brand.activeSocials.join(', ')}

## 2. Productos interpretados
| Producto/plan | Precio | Creditos | Publico ideal | Mensaje clave | Campos inferidos | Warnings |
| --- | --- | --- | --- | --- | --- | --- |
${productRows || '| - | - | - | - | - | - | Sin productos interpretados |'}

## 3. Metricas usadas
- Seguidores: ${plan.instagramMetrics.followers}
- Alcance: ${plan.instagramMetrics.reachDiagnosis}
- Horarios: ${plan.instagramMetrics.bestTime}
- Formatos destacados: Reels: ${plan.instagramMetrics.reelsInsight}; Carrusel: ${plan.instagramMetrics.carouselInsight}
- Confidence: ${plan.socialMetricsAnalysis.confidenceMapping || 'Media: datos declarados por la marca.'}

## 4. Estrategia generada
- Strategy goal: ${plan.strategyGoal}
- Diagnostico: ${plan.businessDiagnosis}
- Narrativa: ${plan.planNarrative}
- Tareas esperadas: ${plan.generationLog.expectedTasks ?? taskRange(plan.duration).min}
- Tareas generadas por Gemini: ${plan.generationLog.generatedTasks ?? plan.tasks.length}
- Tareas agregadas por fallback: ${plan.generationLog.tasksAddedByFallback ?? 0}
- Semanas generadas: ${plan.generationLog.roadmapWeeksGenerated ?? plan.roadmap.length}
${roadmap}

## 4.1 Canales usados
${channelUsageText}

## 5. Tareas
| Fecha | Dia | Plataforma | Modulo | Funnel role | Content type | Esfuerzo | Prioridad | CTA target | CTA | Support prompt |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
${taskRows}

## 5.1 Distribucion de esfuerzo
${effortText}

## 5.2 Prioridad de tareas
${priorityText}

## 5.3 CTAs por canal
${ctaText}

## 5.4 Formatos por plataforma
${formatText}

## 5.5 Tareas con venta directa por plan
${directSalesText}

## 5.6 Slots detectados
- ${slotSummary}

## 5.7 Support prompts
${supportPrompts}

## 6. Validaciones
- Fechas validas: ${checks.datesValid ? 'si' : 'no'}
- Sin fechas pasadas: ${checks.noPastDates ? 'si' : 'no'}
- Slots validos: ${checks.slotsValid ? 'si' : 'no'}
- Modulos validos: ${checks.modulesValid ? 'si' : 'no'}
- Hashtags validos: ${checks.hashtagsValid ? 'si' : 'no'}
- Campos comerciales completos: ${checks.commercialFieldsValid ? 'si' : 'no'}
- Distribucion de esfuerzo valida: ${checks.effortDistributionValid ? 'si' : 'no'}
- Stories sin carrusel: ${checks.storiesFormatsValid ? 'si' : 'no'}
- Venta directa por plan: ${checks.directPlanSalesPresent ? 'si' : 'no'}
- Sin frases rotas: ${checks.noBrokenSentences ? 'si' : 'no'}
- Sin captions null: ${checks.noNullCaptions ? 'si' : 'no'}
- Plataforma/CTA coherente: ${checks.platformCtaCoherenceValid ? 'si' : 'no'}
- Formato por plataforma valido: ${checks.platformFormatValid ? 'si' : 'no'}
- Modulo principal coherente: ${checks.primaryModuleActionValid ? 'si' : 'no'}
- Captions naturales: ${checks.captionsNaturalValid ? 'si' : 'no'}
- Palabras debiles corregidas: ${checks.weakPhrasesFiltered ? 'si' : 'no'}
- Coherencia interna por tarea: ${checks.taskInternalCoherenceValid ? 'si' : 'no'}
- Ortografia visible corregida: ${checks.spanishOrthographyValid ? 'si' : 'no'}
- Hooks accionables: ${checks.actionableHooksValid ? 'si' : 'no'}
- Productos normalizados: ${checks.productsNormalized ? 'si' : 'no'}

## 7. Auditoria de lenguaje natural
- Frases debiles restantes: ${weakRemaining.length}
${markdownList(weakRemaining)}

- Frases rotas detectadas: ${brokenRemaining.length}
${markdownList(brokenRemaining)}

- Conflictos plataforma/CTA corregidos: ${ctaFixes.length}
${markdownList(ctaFixes)}

- Captions null corregidos: ${nullCaptionFixes.length}
${markdownList(nullCaptionFixes)}

- Modulos movidos a supportModule o none: ${supportModuleMoves.length}
${markdownList(supportModuleMoves)}

- Hashtags reducidos/limpiados: ${hashtagFixes.length}
${markdownList(hashtagFixes)}

## Coherencia interna de tareas
- Tareas revisadas: ${plan.tasks.length}
- Tareas corregidas: ${internalFixes.length}
- Conflictos detectados: ${internalIssues.length}
- Plataformas corregidas: ${platformFixes.length}
- Recipes reescritas: ${recipeFixes.length}
- Hooks convertidos en accionables: ${hookFixes.length}
- Textos con acentos corregidos: ${accentFixes.length}

- Conflictos restantes:
${markdownList(internalIssues)}

- Correcciones aplicadas:
${markdownList(uniqueStrings([...internalFixes, ...platformFixes, ...hookFixes, ...accentFixes]))}

## 8. Warnings
${markdownList(plan.generationLog.warnings)}

## 9. Fixed errors
${markdownList(plan.generationLog.fixedErrors)}
`;
}

function normalizePlan(raw: any, input: GenerateGrowthPlanInput): GrowthStrategicPlan {
  const now = new Date().toISOString();
  const ctx: ValidationContext = {
    warnings: asArray(raw?.generationLog?.warnings, []),
    fixedErrors: asArray(raw?.generationLog?.fixedErrors, []),
  };
  const normalizedProductsResult = normalizePlannerProductsDetailed(input.products);
  ctx.warnings.push(...normalizedProductsResult.warnings);
  ctx.fixedErrors.push(...normalizedProductsResult.fixedErrors);
  if (normalizedProductsResult.ignoredLines.length) {
    ctx.warnings.push(`Lineas ignoradas al normalizar productos: ${normalizedProductsResult.ignoredLines.join(' | ')}`);
  }
  const normalizedProducts = normalizedProductsResult.products.length ? normalizedProductsResult.products : input.products;
  let tasks: GrowthTask[] = asArray(raw?.tasks, []).map((task: any, index: number) => ({
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
    supportPrompt: task?.supportPrompt ? String(task.supportPrompt) : undefined,
    supportModule: task?.supportModule ? safeModule(task.supportModule) : undefined,
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
    estimatedEffort: task?.estimatedEffort ? safeEstimatedEffort(task.estimatedEffort) : 'medio',
    taskPriority: task?.taskPriority ? safeTaskPriority(task.taskPriority) : 'primary',
    ctaTarget: task?.ctaTarget ? safeCtaTarget(task.ctaTarget) : 'Instagram DM',
    status: safeStatus(task?.status),
  }));

  if (!tasks.length) throw new Error('Gemini devolvio un plan sin tareas.');

  const taskCompletion = ensureMinimumTasks(tasks, input, ctx);
  tasks = taskCompletion.tasks;
  tasks = tasks
    .map((task, index) => normalizeCommercialTask(task, index, ctx))
    .map(task => validateModuleMapping(task, ctx))
    .map((task, index) => normalizeCommercialTask(task, index, ctx))
    .map(task => normalizePromptSlots(task, ctx))
    .map(task => normalizeManualSupportPrompt(task, ctx))
    .map(task => validateHashtags(task, input, ctx));
  tasks = rebalanceChannels(tasks, input, ctx);
  tasks = tasks
    .map((task, index) => normalizeCommercialTask(task, index, ctx))
    .map(task => validateModuleMapping(task, ctx))
    .map((task, index) => normalizeCommercialTask(task, index, ctx))
    .map(task => normalizeManualSupportPrompt(task, ctx))
    .map(task => validateHashtags(task, input, ctx));
  tasks = normalizeTaskPriorities(tasks, ctx);
  tasks = normalizeEffortDistribution(tasks, input.duration, ctx);
  const dateValidation = validateAndFixTaskDates(tasks, input.duration, ctx);
  tasks = dateValidation.tasks;
  tasks = normalizeTaskPriorities(tasks, ctx);
  const roadmap = ensureRoadmap(asArray(raw?.roadmap, []), input.duration, ctx);

  let plan: GrowthStrategicPlan = {
    id: String(raw?.id || `growth_${Date.now()}`),
    createdAt: String(raw?.createdAt || now),
    duration: input.duration,
    brand: input.brand,
    products: normalizedProducts,
    normalizedProducts,
    instagramMetrics: input.instagramMetrics,
    businessStage: String(raw?.businessStage || 'Etapa comercial por validar'),
    mainGoal: String(raw?.mainGoal || 'Aumentar ventas con contenido estrategico'),
    commercialFocus: String(raw?.commercialFocus || normalizedProducts.map(p => p.name).join(', ')),
    strategyGoal: String(raw?.strategyGoal || 'Convertir interes en conversaciones de compra'),
    businessDiagnosis: String(raw?.businessDiagnosis || ''),
    nicheInsights: asArray(raw?.nicheInsights, []),
    planNarrative: String(raw?.planNarrative || ''),
    strategicTip: String(raw?.strategicTip || ''),
    roadmap,
    tasks,
    brandAnalysis: {
      stageInterpretation: String(raw?.brandAnalysis?.stageInterpretation || ''),
      targetAnalysis: String(raw?.brandAnalysis?.targetAnalysis || input.brand.idealClient),
      voiceGuide: String(raw?.brandAnalysis?.voiceGuide || input.brand.tone),
    },
    productAnalysis: {
      productWarnings: uniqueStrings([
        ...asArray(raw?.productAnalysis?.productWarnings, []),
        ...normalizedProducts.flatMap(product => product.warnings || []),
      ]),
      confidenceByProduct: normalizedProducts.map(product => ({
        productId: product.id,
        level: product.warnings?.length ? 65 : 85,
        reason: product.warnings?.length
          ? `Producto normalizado con advertencias: ${product.warnings.join(', ')}`
          : 'Producto interpretado con estructura suficiente para planificar.',
      })),
      categorizationSummary: String(raw?.productAnalysis?.categorizationSummary
        || `${normalizedProducts.length} producto(s)/plan(es) normalizados para la estrategia.`),
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
        'Output normalizado y validado',
      ]),
      hasImages: input.productImageRefs.length > 0,
      hasMetrics: true,
      researchMode: 'gemini-2.5-flash sin grounding',
      dateBaseUsed: dateValidation.dateBaseUsed,
      dateFixesApplied: dateValidation.dateFixesApplied,
      expectedTasks: taskCompletion.expected,
      generatedTasks: taskCompletion.generated,
      tasksAddedByFallback: taskCompletion.added,
      roadmapWeeksGenerated: roadmap.length,
      channelUsage: countByPlatform(tasks),
      warnings: uniqueStrings(ctx.warnings),
      validationChecks: {
        datesValid: dateValidation.datesValid,
        noPastDates: dateValidation.noPastDates,
        languageValid: true,
        modulesValid: validateModules(tasks),
        slotsValid: validateSlots(tasks),
        hashtagsValid: validateHashtagState(tasks),
        taskCountValid: tasks.length >= taskCompletion.expected,
        productsNormalized: normalizedProducts.length > 0,
        commercialFieldsValid: validateCommercialFields(tasks),
        effortDistributionValid: effortDistributionValid(tasks, input.duration),
        storiesFormatsValid: validateStoriesFormats(tasks),
        directPlanSalesPresent: directPlanSalesTasks(tasks).length > 0,
        weakPhrasesFiltered: true,
      },
      fixedErrors: uniqueStrings(ctx.fixedErrors),
    },
    validationReportMarkdown: '',
  };

  plan = applyWeakPhraseFilter(plan, ctx);
  plan = finalNaturalLanguageScan(plan, ctx);
  plan = {
    ...plan,
    strategyGoal: normalizeSpanishText(plan.strategyGoal),
    businessDiagnosis: normalizeSpanishText(plan.businessDiagnosis),
    planNarrative: normalizeSpanishText(plan.planNarrative),
    strategicTip: normalizeSpanishText(plan.strategicTip),
    roadmap: plan.roadmap.map(item => ({
      ...item,
      title: normalizeSpanishText(item.title),
      objective: normalizeSpanishText(item.objective),
      hint: normalizeSpanishText(item.hint),
    })),
    tasks: plan.tasks.map(task => validateTaskInternalCoherence(task, ctx)),
  };
  plan = {
    ...plan,
    tasks: plan.tasks.map(task => validateHashtags(task, input, ctx)),
  };
  plan.generationLog.warnings = uniqueStrings(ctx.warnings);
  plan.generationLog.fixedErrors = uniqueStrings(ctx.fixedErrors);
  plan.generationLog.validationChecks = {
    ...plan.generationLog.validationChecks,
    modulesValid: validateModules(plan.tasks),
    slotsValid: validateSlots(plan.tasks),
    hashtagsValid: validateHashtagState(plan.tasks),
    commercialFieldsValid: validateCommercialFields(plan.tasks),
    effortDistributionValid: effortDistributionValid(plan.tasks, plan.duration),
    storiesFormatsValid: validateStoriesFormats(plan.tasks),
    directPlanSalesPresent: directPlanSalesTasks(plan.tasks).length > 0,
    noBrokenSentences: brokenSentenceIssues(plan).length === 0,
    noNullCaptions: plan.tasks.every(task => task.caption.trim().toLowerCase() !== 'null' && task.caption.trim().toLowerCase() !== 'undefined'),
    platformCtaCoherenceValid: validatePlatformCtaCoherence(plan.tasks),
    platformFormatValid: validatePlatformFormatState(plan.tasks),
    primaryModuleActionValid: validatePrimaryModuleAction(plan.tasks),
    captionsNaturalValid: validateCaptionsNatural(plan.tasks),
    weakPhrasesFiltered: !containsWeakPhrase(plan),
    taskInternalCoherenceValid: taskInternalCoherenceIssues(plan.tasks).length === 0,
    actionableHooksValid: actionableHooksValid(plan.tasks),
  };
  plan.validationReportMarkdown = normalizeSpanishText(buildValidationReport(plan));
  plan.generationLog.validationChecks = {
    ...plan.generationLog.validationChecks,
    spanishOrthographyValid: spanishOrthographyValid(plan),
  };
  plan.validationReportMarkdown = normalizeSpanishText(buildValidationReport(plan));
  return plan;
}

function compactText(value: unknown, maxChars: number): string {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > maxChars ? `${text.slice(0, Math.max(0, maxChars - 1)).trim()}…` : text;
}

function compactList(values: unknown, maxItems: number, maxItemChars: number): string[] {
  return asArray<string>(values as string[] | undefined, [])
    .map(value => compactText(value, maxItemChars))
    .filter(Boolean)
    .slice(0, maxItems);
}

function productSummaryForPrompt(products: GrowthProduct[]): string {
  const visibleProducts = products.slice(0, MAX_PRODUCTS_IN_PROMPT);
  const lines = visibleProducts.map((product, index) => {
    const line = [
      `${index + 1}. ${product.name}`,
      product.category,
      product.price,
      product.credits || product.stock,
      product.idealFor || product.benefit,
      product.messageKey || product.benefit,
    ].map(part => compactText(part, 70)).filter(Boolean).join(' | ');
    return compactText(line, MAX_PRODUCT_LINE_CHARS);
  });

  if (products.length > visibleProducts.length) {
    const remainingNames = products
      .slice(visibleProducts.length)
      .map(product => compactText(product.name, 45))
      .filter(Boolean)
      .join(', ');
    lines.push(`Otros ${products.length - visibleProducts.length} producto(s) disponibles: ${compactText(remainingNames, 900)}`);
  }

  return compactText(lines.join('\n'), MAX_PRODUCT_SUMMARY_CHARS);
}

type TaskBatch = {
  stepId: string;
  week: number;
  title: string;
  taskCount: number;
  dayStart: number;
  dayEnd: number;
  funnelRole: GrowthFunnelRole;
  focus: string;
};

function taskBatchesForDuration(duration: GrowthPlanDuration): TaskBatch[] {
  if (duration === 7) {
    return [{
      stepId: 'week_1',
      week: 1,
      title: 'Plan compacto de activacion',
      taskCount: 5,
      dayStart: 1,
      dayEnd: 7,
      funnelRole: 'atraer',
      focus: 'Cubrir un mini embudo completo: problema, deseo, confianza, conversion y seguimiento.',
    }];
  }

  if (duration === 14) {
    return [
      {
        stepId: 'week_1',
        week: 1,
        title: 'Atraccion y deseo',
        taskCount: 6,
        dayStart: 1,
        dayEnd: 7,
        funnelRole: 'atraer',
        focus: 'Mostrar problema, categoria, beneficios y primeras demostraciones del producto.',
      },
      {
        stepId: 'week_2',
        week: 2,
        title: 'Confianza y conversion',
        taskCount: 6,
        dayStart: 8,
        dayEnd: 14,
        funnelRole: 'convertir',
        focus: 'Resolver objeciones, usar prueba social, comparar opciones y cerrar por DM o canal principal.',
      },
    ];
  }

  return [
    {
      stepId: 'week_1',
      week: 1,
      title: 'Atraccion / problema visible',
      taskCount: 6,
      dayStart: 1,
      dayEnd: 7,
      funnelRole: 'atraer',
      focus: 'Abrir interes con problemas reconocibles, diagnosticos y situaciones de compra reales.',
    },
    {
      stepId: 'week_2',
      week: 2,
      title: 'Deseo / demostracion',
      taskCount: 6,
      dayStart: 8,
      dayEnd: 14,
      funnelRole: 'generar_deseo',
      focus: 'Mostrar producto, uso, resultado esperado, antes/despues o comparaciones visuales.',
    },
    {
      stepId: 'week_3',
      week: 3,
      title: 'Confianza / objeciones',
      taskCount: 6,
      dayStart: 15,
      dayEnd: 21,
      funnelRole: 'construir_confianza',
      focus: 'Responder dudas, mostrar prueba social, explicar garantias y bajar friccion.',
    },
    {
      stepId: 'week_4',
      week: 4,
      title: 'Conversion / cierre',
      taskCount: 7,
      dayStart: 22,
      dayEnd: 30,
      funnelRole: 'convertir',
      focus: 'Activar CTA directo, mensajes a WhatsApp/DM, recordatorios, bundles o decision de compra.',
    },
  ];
}

function taskBatchWithCount(batch: TaskBatch, taskCount: number): TaskBatch {
  return {
    ...batch,
    taskCount,
  };
}

function remainingDefaultTasks(batches: TaskBatch[], startIndex: number): number {
  return batches
    .slice(startIndex)
    .reduce((total, batch) => total + batch.taskCount, 0);
}

function completionBatchForDuration(input: GenerateGrowthPlanInput, missingTasks: number): TaskBatch {
  const defaultBatches = taskBatchesForDuration(input.duration);
  const lastBatch = defaultBatches[defaultBatches.length - 1];
  return {
    stepId: 'completion',
    week: lastBatch?.week || 1,
    title: 'Complemento estrategico final',
    taskCount: Math.max(1, missingTasks),
    dayStart: lastBatch?.dayStart || 1,
    dayEnd: input.duration,
    funnelRole: 'convertir',
    focus: 'Completar las tareas faltantes sin repetir ideas previas, reforzando los huecos del embudo y manteniendo la estrategia principal.',
  };
}

function maxOutputTokensForTaskBatch(taskCount: number): number {
  if (taskCount >= 8) return 8192;
  if (taskCount >= 7) return 6144;
  return 5120;
}

function roadmapInstruction(duration: GrowthPlanDuration): string {
  return taskBatchesForDuration(duration)
    .map(batch => `Semana ${batch.week}: ${batch.title} - ${batch.focus}`)
    .join('\n');
}

function buildStrategyPrompt(input: GenerateGrowthPlanInput): string {
  const today = new Date().toISOString().slice(0, 10);
  const productSummary = productSummaryForPrompt(input.products);

  return `Eres la directora estrategica de contenido de Luz IA Studio.
Debes disenar la estrategia base de un Planner Estrategico para una emprendedora LATAM.

REGLAS:
- Responde SOLO JSON valido. Sin markdown fuera del JSON.
- No generes tareas todavia. Solo diagnostico, roadmap y analisis.
- Crea un strategyBrief ejecutivo para que cada semana se genere despues consultando esa guia.
- El strategyBrief debe ser corto, accionable y especifico: objetivo maestro, promesa, objeciones, productos prioritarios, angulos por semana, reglas de canal y reglas de modulo.
- No uses busqueda web ni cites fuentes externas.
- Fecha actual/base: ${today}.
- Escribe compacto, especifico y comercial. Evita frases genericas.
- Lenguaje prohibido: magia, imagenes de revista, transforma tu marca, empoderar, infinitas posibilidades, escala tu marca, exito, impulso, aliado, vende mas, calidad profesional a tu alcance.
- El roadmap debe respetar esta estructura:
${roadmapInstruction(input.duration)}

MARCA:
${JSON.stringify(input.brand, null, 2)}

METRICAS/REDES GUARDADAS EN MARCA:
${JSON.stringify(input.instagramMetrics, null, 2)}

PRODUCTOS A EMPUJAR:
${productSummary}

IMAGENES DE PRODUCTO:
Se adjuntan ${input.productImageRefs.length} imagen(es) comprimidas como referencia visual. Usalas solo para entender estilo, color, packaging y nivel de confianza.

Devuelve este objeto sin tareas:
{
  "businessStage": "string",
  "mainGoal": "string",
  "commercialFocus": "string",
  "strategyGoal": "string",
  "businessDiagnosis": "string",
  "nicheInsights": ["string"],
  "planNarrative": "string",
  "strategicTip": "string",
  "strategyBrief": {
    "masterObjective": "string",
    "commercialPromise": "string",
    "targetCustomer": "string",
    "brandVoice": "string",
    "priorityProducts": ["string"],
    "mainObjections": ["string"],
    "contentAngles": ["string"],
    "prohibitedLanguage": ["string"],
    "channelRules": ["string"],
    "moduleRules": ["string"],
    "weeklyAngles": [{"week":1,"objective":"string","angle":"string","recommendedProducts":["string"],"ctaFocus":"string"}]
  },
  "roadmap": [{"week":1,"title":"string","objective":"string","funnelRole":"atraer","hint":"string"}],
  "brandAnalysis": {"stageInterpretation":"string","targetAnalysis":"string","voiceGuide":"string"},
  "productAnalysis": {"productWarnings":["string"],"confidenceByProduct":[{"productId":"id","level":80,"reason":"string"}],"categorizationSummary":"string"},
  "socialMetricsAnalysis": {"audienceInsights":"string","engagementLevel":"string","confidenceMapping":"string"},
  "nicheResearch": {"trends":["string"],"competitorGaps":["string"],"researchMode":"gemini sin grounding"},
  "generationLog": {"warnings":["string"],"fixedErrors":[]},
  "validationReportMarkdown": "reporte breve de maximo 5 lineas"
}`;
}

function strategyBriefForPrompt(strategy: any, batch: TaskBatch): string {
  const brief = strategy?.strategyBrief || {};
  const roadmapItem = asArray<any>(strategy?.roadmap, [])
    .find(item => Number(item?.week) === batch.week);
  const weeklyAngle = asArray<any>(brief?.weeklyAngles, [])
    .find(item => Number(item?.week) === batch.week);

  const compact = {
    masterObjective: compactText(brief.masterObjective || strategy?.strategyGoal, 260),
    commercialPromise: compactText(brief.commercialPromise || strategy?.planNarrative, 260),
    targetCustomer: compactText(brief.targetCustomer || strategy?.brandAnalysis?.targetAnalysis, 240),
    brandVoice: compactText(brief.brandVoice || strategy?.brandAnalysis?.voiceGuide, 220),
    priorityProducts: compactList(brief.priorityProducts, 8, 90),
    mainObjections: compactList(brief.mainObjections, 6, 120),
    contentAngles: compactList(brief.contentAngles, 8, 120),
    prohibitedLanguage: uniqueStrings([
      ...compactList(brief.prohibitedLanguage, 8, 70),
      'brillar',
      'contenido de valor',
      'llevar al siguiente nivel',
    ]),
    channelRules: compactList(brief.channelRules, 5, 130),
    moduleRules: compactList(brief.moduleRules, 5, 130),
    currentWeek: {
      week: batch.week,
      title: batch.title,
      objective: compactText(weeklyAngle?.objective || roadmapItem?.objective || batch.focus, 260),
      angle: compactText(weeklyAngle?.angle || roadmapItem?.hint || batch.focus, 260),
      recommendedProducts: compactList(weeklyAngle?.recommendedProducts, 6, 90),
      ctaFocus: compactText(weeklyAngle?.ctaFocus || (batch.funnelRole === 'convertir' ? 'DM, WhatsApp o checkout' : 'guardar, comentar o pedir informacion'), 160),
      funnelRole: batch.funnelRole,
    },
    sourceFallback: brief?.masterObjective ? 'strategyBrief generado por Gemini' : 'fallback compacto desde estrategia base',
  };

  return compactText(JSON.stringify(compact, null, 2), MAX_STRATEGY_CONTEXT_CHARS);
}

function compactTaskSummary(tasks: any[]): string {
  if (!tasks.length) return 'Aun no hay tareas generadas.';
  const lines = tasks.map((task, index) =>
    `${index + 1}. S${task.week} | ${task.date || task.dayLabel} | ${task.platform} | ${task.funnelRole} | ${compactText(task.contentType, 70)} | ${compactText(task.caption || task.visualConcept, 120)}`,
  );
  return compactText(lines.join('\n'), MAX_EXISTING_TASKS_CHARS);
}

function buildTaskBatchPrompt(
  input: GenerateGrowthPlanInput,
  strategy: any,
  batch: TaskBatch,
  existingTasks: any[],
  previousError = '',
): string {
  const today = new Date().toISOString().slice(0, 10);
  const productSummary = productSummaryForPrompt(input.products);

  return `Eres la directora estrategica de contenido de Luz IA Studio.
Genera SOLO las tareas de la ${batch.title} para un plan de ${input.duration} dias.

REGLAS:
- Antes de generar, consulta el BRIEF ESTRATEGICO OPERATIVO y alinea todas las tareas con el objetivo de esta semana.
- Responde SOLO JSON valido. Sin markdown fuera del JSON.
- Intenta crear ${batch.taskCount} tareas completas. Si el modelo entrega menos tareas pero son buenas, el sistema compensara en otro bloque.
- Todas las tareas deben tener week=${batch.week}.
- Las fechas deben estar entre el dia ${batch.dayStart} y el dia ${batch.dayEnd} del plan, contando desde ${today}, sin fechas pasadas.
- Foco de esta semana: ${batch.focus}
- Funnel principal sugerido: ${batch.funnelRole}; puedes mezclar roles si ayuda al embudo.
- No repitas ideas ya generadas en otras semanas.
- Cada tarea debe ser concreta, lista para ejecutar y conectada a un modulo de Luz IA.
- Cada tarea debe incluir estimatedEffort ("bajo", "medio", "alto"), taskPriority ("primary", "support") y ctaTarget.
- ctaTarget valido: Instagram DM, Comentario, Facebook comentario, DM Facebook, Link, WhatsApp, Link en bio, Guardar, Responder story.
- Prioriza CTAs conversacionales por DM/comentario/story. No abuses de "Link en bio".
- Ejemplos de CTA: "Escribenos STARTER y te decimos si este plan te alcanza", "Comenta PLAN y te recomendamos uno segun tu ritmo", "Responde esta story con CREDITOS si quieres saber cuantas imagenes necesitas al mes".
- Captions: maximo 2-4 frases, humanas, concretas y sin sobreexplicar. Prompts: menos de 450 caracteres.
- Evita captions con "es hora de", "descubre como", "tu negocio merece", "resultados profesionales" o "resultados increibles".
- Cada executionRecipe debe tener maximo 3 pasos.
- Cada shotGuide debe tener maximo 3 tomas.
- Modulos validos: product, ugc, scene, prompt, outfit, none.
- Si module es none, prompt debe ser "".
- Si una tarea manual necesita apoyo visual, usa supportModule y supportPrompt.
- Stories NO puede usar contentType "Carrusel" ni "Post con imagen". Usa Encuesta, Q&A, Secuencia de stories, Recordatorio, Demo rapida, Story estatica o Reel vertical.
- Instagram Feed puede usar Reel, Carrusel, Post educativo, Post con imagen, Publicacion de prueba social o Demo rapida. No uses Q&A de Stories.
- Facebook puede usar Post educativo, Publicacion de prueba social, Q&A, Encuesta, Reel o Carrusel. No hables de stickers de Instagram en Facebook.
- Coherencia interna obligatoria: platform, contentType, visualConcept, caption, executionRecipe, shotGuide, ctaTarget y engagementHook deben hablar de la misma plataforma.
- Si platform es Instagram Feed, NO menciones story, stories, sticker, encuesta de story, responder story ni publicar en Facebook.
- Si platform es Stories, usa lenguaje de stories: story, sticker, responder, secuencia, encuesta, Q&A o recordatorio.
- Si platform es Facebook, habla de comentarios, publicacion, post, reel, carrusel, grupo o comunidad; no menciones Instagram Stories.
- engagementHook debe ser accionable, no una idea abstracta. Empieza con Comenta, Responde, Envianos, Escribenos, Guarda o Abre.
- Cuida acentos visibles: conversion/conversión, friccion/fricción, produccion/producción, imagenes/imágenes, creditos/créditos, publicacion/publicación.
- Si ctaTarget es "Responder story", platform debe ser Stories.
- Si platform es Instagram Feed, usa Instagram DM, Comentario, Guardar o Link en bio.
- Si platform es Facebook, usa Facebook comentario, DM Facebook o Link.
- Si platform es Stories, usa Responder story, Link en bio o Instagram DM.
- Encuesta, Q&A, Recordatorio, post educativo textual o publicacion manual deben usar module none. Si necesitan imagen de apoyo, mueve el prompt a supportPrompt y supportModule.
- Para planes de 30 dias, reparte esfuerzo aproximado: 35% bajo, 35% medio, maximo 30% alto. No pongas mas de 2 tareas altas seguidas.
- Si hay mas de una tarea el mismo dia, una debe ser taskPriority "primary" y la otra "support".
- Slots permitidos: @producto1, @producto2, @producto3, @producto4, @persona1, @outfit1, @escena1, @referencia1.
- No uses placeholders con corchetes.
- Status inicial de todas las tareas: pending.
- Evita lenguaje generico: magia, imagenes de revista, transforma tu marca, empoderar, infinitas posibilidades, escala tu marca, exito, impulso, aliado, vende mas, calidad profesional a tu alcance.
- Usa lenguaje concreto: crear imagenes listas para publicar, mejorar fotos de producto sin montar un set, generar variaciones visuales para campanas, comparar planes segun cantidad de contenido, ahorrar tiempo en produccion visual.
- Semana 4 debe vender mejor Explorer, Starter, Pro y Studio: que puedes hacer con 60 creditos Explorer, 200 Starter, cuando conviene Pro, cuando conviene Studio, costo por imagen y objeciones sobre creditos, prompts o tiempo.
${previousError ? `\nERROR A CORREGIR DEL INTENTO ANTERIOR:\n${compactText(previousError, MAX_ERROR_CONTEXT_CHARS)}\n` : ''}

BRIEF ESTRATEGICO OPERATIVO:
${strategyBriefForPrompt(strategy, batch)}

OBJETIVO ESPECIFICO DE ESTA SEMANA:
Semana ${batch.week} - ${batch.title}: ${batch.focus}

MARCA:
${JSON.stringify(input.brand, null, 2)}

METRICAS/REDES:
${JSON.stringify(input.instagramMetrics, null, 2)}

PRODUCTOS:
${productSummary}

TAREAS YA GENERADAS:
${compactTaskSummary(existingTasks)}

Devuelve:
{
  "tasks": [{
    "week": ${batch.week},
    "dayLabel": "Lunes 8 jun",
    "date": "YYYY-MM-DD",
    "platform": "Instagram Feed",
    "contentType": "string",
    "funnelRole": "${batch.funnelRole}",
    "module": "product",
    "moduleReason": "string",
    "suggestedTime": "19:00",
    "visualConcept": "string",
    "whyItWorks": "string",
    "caption": "string",
    "hashtags": "#tag1 #tag2",
    "prompt": "string con slots permitidos, o vacio si module es none",
    "supportModule": "product",
    "supportPrompt": "string opcional solo si module es none",
    "slotInstructions": [{"slot":"@producto1","instruction":"string"}],
    "requiredAssets": ["string"],
    "executionRecipe": {"overview":"string","steps":[{"title":"string","module":"product","instruction":"string","ctaLabel":"Abrir modulo","status":"pending"}]},
    "shotGuide": {"duration":"string","shots":[{"shot":1,"duration":"0-3s","instruction":"string"}],"onScreenText":["string"],"inspirationSearches":["string"],"whatToAvoid":["string"]},
    "engagementHook": "string",
    "estimatedEffort": "medio",
    "taskPriority": "primary",
    "ctaTarget": "Instagram DM",
    "status": "pending"
  }],
  "generationLog": {"warnings":["string"],"fixedErrors":[]}
}`;
}

function buildTaskRepairPrompt(
  input: GenerateGrowthPlanInput,
  strategy: any,
  batch: TaskBatch,
  existingTasks: any[],
  brokenPayload: any,
  errorMessage: string,
): string {
  return `${buildTaskBatchPrompt(input, strategy, batch, existingTasks, compactText(errorMessage, MAX_ERROR_CONTEXT_CHARS))}

JSON ANTERIOR A CORREGIR:
${compactText(JSON.stringify(brokenPayload || {}, null, 2), MAX_REPAIR_JSON_CHARS)}

Corrige el JSON anterior y devuelve hasta ${batch.taskCount} tareas completas para la semana ${batch.week}. Si faltan tareas menores, prioriza que las tareas devueltas sean solidas y ejecutables.`;
}

function validateTaskBatchPayload(raw: any, batch: TaskBatch): any[] {
  const tasks = asArray<any>(raw?.tasks, []);
  const minimumUsableTasks = 1;
  if (tasks.length < minimumUsableTasks) {
    throw new Error(`La semana ${batch.week} no devolvio tareas utilizables.`);
  }

  const selected = tasks.slice(0, Math.min(tasks.length, batch.taskCount));

  return selected.map((task, index) => ({
    ...task,
    week: batch.week,
    status: safeStatus(task?.status),
    dayLabel: task?.dayLabel || `Dia ${batch.dayStart + index}`,
  }));
}

async function startGrowthPlannerJob(params: {
  token: string;
  prompt: string;
  schema: any;
  images?: string[];
  mimeTypes?: string[];
  maxOutputTokens: number;
  temperature?: number;
}): Promise<any> {
  const response = await fetch(CONTENT_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.token}`,
    },
    body: JSON.stringify({
      action: 'generateTextAsync',
      model: 'gemini-2.5-flash',
      prompt: params.prompt,
      schema: params.schema,
      images: params.images || [],
      mimeTypes: params.mimeTypes || [],
      generationConfig: {
        temperature: params.temperature ?? 0.45,
        maxOutputTokens: params.maxOutputTokens,
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
  return pollGrowthPlanJob(data.jobId, params.token);
}

async function generateStrategyWithRecovery(input: GenerateGrowthPlanInput, token: string): Promise<any> {
  let lastError = '';
  for (let attempt = 1; attempt <= MAX_WEEK_GENERATION_ATTEMPTS; attempt++) {
    try {
      return await startGrowthPlannerJob({
        token,
        prompt: buildStrategyPrompt(input),
        schema: GROWTH_STRATEGY_SCHEMA,
        images: input.productImageRefs.map(image => image.data),
        mimeTypes: input.productImageRefs.map(image => image.mimeType),
        maxOutputTokens: 4096,
        temperature: 0.4,
      });
    } catch (error: any) {
      lastError = error?.message || 'Estrategia incompleta.';
    }
  }

  throw new Error(`No se pudo crear la estrategia base. ${lastError}`);
}

async function generateTaskBatchWithRecovery(
  input: GenerateGrowthPlanInput,
  token: string,
  strategy: any,
  batch: TaskBatch,
  existingTasks: any[],
): Promise<{ tasks: any[]; warnings: string[]; fixedErrors: string[] }> {
  let lastRaw: any = null;
  let lastError = '';

  for (let attempt = 1; attempt <= MAX_WEEK_GENERATION_ATTEMPTS; attempt++) {
    try {
      lastRaw = await startGrowthPlannerJob({
        token,
        prompt: buildTaskBatchPrompt(input, strategy, batch, existingTasks, lastError),
        schema: TASK_BATCH_SCHEMA,
        maxOutputTokens: maxOutputTokensForTaskBatch(batch.taskCount),
        temperature: 0.45,
      });
      return {
        tasks: validateTaskBatchPayload(lastRaw, batch),
        warnings: asArray(lastRaw?.generationLog?.warnings, []),
        fixedErrors: asArray(lastRaw?.generationLog?.fixedErrors, []),
      };
    } catch (error: any) {
      lastError = error?.message || `La semana ${batch.week} vino incompleta.`;
    }
  }

  for (let attempt = 1; attempt <= MAX_WEEK_REPAIR_ATTEMPTS; attempt++) {
    try {
      lastRaw = await startGrowthPlannerJob({
        token,
        prompt: buildTaskRepairPrompt(input, strategy, batch, existingTasks, lastRaw, lastError),
        schema: TASK_BATCH_SCHEMA,
        maxOutputTokens: maxOutputTokensForTaskBatch(batch.taskCount),
        temperature: 0.25,
      });
      return {
        tasks: validateTaskBatchPayload(lastRaw, batch),
        warnings: asArray(lastRaw?.generationLog?.warnings, []),
        fixedErrors: [
          ...asArray(lastRaw?.generationLog?.fixedErrors, []),
          `Semana ${batch.week} corregida internamente tras ${MAX_WEEK_GENERATION_ATTEMPTS} intento(s).`,
        ],
      };
    } catch (error: any) {
      lastError = error?.message || `La correccion de la semana ${batch.week} vino incompleta.`;
    }
  }

  throw new Error(`No se pudo completar la semana ${batch.week} sin tareas genericas. ${lastError}`);
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

async function generateGrowthPlanLegacy(
  input: GenerateGrowthPlanInput,
  options: GenerateGrowthPlanOptions = {},
): Promise<GrowthStrategicPlan> {
  const token = await getAuth().currentUser?.getIdToken().catch(() => null);
  if (!token) throw new Error('Necesitas iniciar sesion para generar el plan.');

  options.onProgress?.({ stepId: 'strategy', label: 'Disenando estrategia base' });
  const strategy = await generateStrategyWithRecovery(input, token);
  const batches = taskBatchesForDuration(input.duration);
  const tasks: any[] = [];
  const warnings: string[] = asArray(strategy?.generationLog?.warnings, []);
  const fixedErrors: string[] = asArray(strategy?.generationLog?.fixedErrors, []);
  const expectedTasks = taskRange(input.duration).min;

  for (let index = 0; index < batches.length; index++) {
    const batch = batches[index];
    const remainingDefault = remainingDefaultTasks(batches, index + 1);
    const neededToProtectMinimum = expectedTasks - tasks.length - remainingDefault;
    const targetForThisBatch = Math.max(batch.taskCount, neededToProtectMinimum);
    const effectiveBatch = taskBatchWithCount(batch, targetForThisBatch);

    options.onProgress?.({ stepId: batch.stepId, label: `Generando semana ${batch.week}` });
    const result = await generateTaskBatchWithRecovery(input, token, strategy, effectiveBatch, tasks);
    tasks.push(...result.tasks);
    warnings.push(...result.warnings);
    fixedErrors.push(...result.fixedErrors);

    if (result.tasks.length < effectiveBatch.taskCount) {
      fixedErrors.push(
        `Semana ${batch.week} genero ${result.tasks.length}/${effectiveBatch.taskCount} tareas; el faltante se compensara en los siguientes bloques.`,
      );
    }
  }

  let completionRound = 0;
  while (tasks.length < expectedTasks && completionRound < MAX_COMPLETION_ROUNDS) {
    completionRound += 1;
    const missingTasks = expectedTasks - tasks.length;
    const completionBatch = completionBatchForDuration(input, missingTasks);
    options.onProgress?.({
      stepId: 'validation',
      label: missingTasks === 1 ? 'Completando una tarea faltante' : `Completando ${missingTasks} tareas faltantes`,
    });
    const beforeCompletion = tasks.length;
    const result = await generateTaskBatchWithRecovery(input, token, strategy, completionBatch, tasks);
    tasks.push(...result.tasks.slice(0, missingTasks));
    warnings.push(...result.warnings);
    fixedErrors.push(
      ...result.fixedErrors,
      `Bloque complementario ${completionRound} agrego ${tasks.length - beforeCompletion} tarea(s) reales con Gemini.`,
    );
  }

  options.onProgress?.({ stepId: 'validation', label: 'Validando y guardando plan' });

  const raw = {
    ...strategy,
    tasks,
    generationLog: {
      warnings,
      fixedErrors,
      steps: [
        'Estrategia base generada con Gemini 2.5 Flash',
        ...batches.map(batch => `Semana ${batch.week} generada con Gemini 2.5 Flash`),
        'Plan consolidado sin tareas genericas',
      ],
    },
  };
  return normalizePlan(raw, input);
}

function engineInputFromStrategy(input: GenerateGrowthPlanInput, strategy: any): PlannerEngineV2Input {
  return {
    duration: input.duration,
    brand: input.brand,
    products: normalizeProductsForEngineV2(input.products),
    instagramMetrics: input.instagramMetrics,
    businessStage: String(strategy?.businessStage || 'Etapa comercial por validar'),
    mainGoal: String(strategy?.mainGoal || 'Crear contenido que apoye ventas y conversaciones'),
    commercialFocus: String(strategy?.commercialFocus || input.products.map(product => product.name).join(', ')),
    planningDepth: 'guided',
  };
}

async function requestCreativeTaskBatch(params: {
  token: string;
  input: PlannerEngineV2Input;
  skeletonTasks: PlanSkeletonTask[];
  blueprints: TaskBlueprint[];
  nicheAdapter: ReturnType<typeof selectNicheAdapter>;
  salesAggressiveness: ReturnType<typeof selectSalesAggressiveness>;
  creativeSeed: string;
  businessArchetype: ReturnType<typeof detectBusinessArchetype>['businessArchetype'];
  repairErrors?: Record<string, string[]>;
}): Promise<CreativeTaskFields[]> {
  const raw = await startGrowthPlannerJob({
    token: params.token,
    prompt: buildCreativeTaskBatchPrompt(params),
    schema: CREATIVE_TASK_BATCH_SCHEMA,
    maxOutputTokens: Math.min(16384, Math.max(4096, params.skeletonTasks.length * 1900)),
    temperature: params.repairErrors ? 0.3 : 0.65,
  });
  return asArray<CreativeTaskFields>(raw?.tasks, []);
}

async function requestHookRepair(params: {
  token: string;
  input: PlannerEngineV2Input;
  tasks: GeneratedTaskV2[];
}): Promise<HookRepairFields[]> {
  const raw = await startGrowthPlannerJob({
    token: params.token,
    prompt: buildHookRepairPrompt({
      tasks: params.tasks,
      brandName: params.input.brand.name,
      tone: params.input.brand.tone,
    }),
    schema: HOOK_REPAIR_BATCH_SCHEMA,
    maxOutputTokens: Math.min(4096, Math.max(1200, params.tasks.length * 350)),
    temperature: 0.35,
  });
  return asArray<HookRepairFields>(raw?.tasks, []);
}

function isHookCaptionOnlyFailure(task: GeneratedTaskV2 | undefined): task is GeneratedTaskV2 {
  return Boolean(task?.validationErrors.length)
    && task!.validationErrors.every(error => /hook|caption/i.test(error));
}

async function generateV2Tasks(params: {
  token: string;
  input: PlannerEngineV2Input;
  skeletonTasks: PlanSkeletonTask[];
  nicheAdapter: ReturnType<typeof selectNicheAdapter>;
  salesAggressiveness: ReturnType<typeof selectSalesAggressiveness>;
  creativeSeed: string;
  businessArchetype: ReturnType<typeof detectBusinessArchetype>['businessArchetype'];
  onProgress?: GenerateGrowthPlanOptions['onProgress'];
}): Promise<{ tasks: GeneratedTaskV2[]; blueprintsUsed: string[] }> {
  const completed = new Map<string, GeneratedTaskV2>();
  const workingSkeletons = new Map(params.skeletonTasks.map(task => [task.id, task]));
  const weeks = Array.from(new Set(params.skeletonTasks.map(task => task.week))).sort((a, b) => a - b);

  for (const week of weeks) {
    let pending = params.skeletonTasks.filter(task => task.week === week);
    const hookRepairQueue: PlanSkeletonTask[] = [];
    params.onProgress?.({ stepId: `week_${week}`, label: `Generando semana ${week} con contratos seguros` });

    for (let attempt = 0; attempt <= 2 && pending.length; attempt++) {
      const blueprints = pending.map(task => getBlueprintById(task.blueprintId)).filter(Boolean) as TaskBlueprint[];
      const repairErrors = attempt === 0 ? undefined : Object.fromEntries(
        pending.map(task => [task.id, completed.get(task.id)?.validationErrors || ['La tarea no pasó su contrato. Regenera el bloque completo.']]),
      );
      let creatives: CreativeTaskFields[] = [];
      try {
        creatives = await requestCreativeTaskBatch({
          token: params.token,
          input: params.input,
          skeletonTasks: pending,
          blueprints,
          nicheAdapter: params.nicheAdapter,
          salesAggressiveness: params.salesAggressiveness,
          creativeSeed: params.creativeSeed,
          businessArchetype: params.businessArchetype,
          repairErrors,
        });
      } catch (error) {
        console.warn(`[GrowthPlanner V2] Week ${week} creative attempt ${attempt + 1} failed.`, error);
        continue;
      }
      const nextPending: PlanSkeletonTask[] = [];
      pending.forEach(skeleton => {
        const blueprint = getBlueprintById(skeleton.blueprintId);
        const creative = creatives.find(item => item.skeletonTaskId === skeleton.id);
        if (!blueprint || !creative) {
          nextPending.push(skeleton);
          return;
        }
        const task = mergeCreativeFields(skeleton, blueprint, creative, params.input.instagramMetrics.bestTime || '19:00', attempt);
        const lockErrors = validateContractLock(task, skeleton);
        const validation = validateTaskAgainstBlueprint(task, blueprint, { businessArchetype: params.businessArchetype });
        const withValidation = { ...task, validationErrors: [...lockErrors, ...validation.errors] };
        completed.set(skeleton.id, withValidation);
        if (!validation.valid || lockErrors.length) {
          if (!lockErrors.length && isHookCaptionOnlyFailure(withValidation)) hookRepairQueue.push(skeleton);
          else nextPending.push(skeleton);
        }
      });
      pending = nextPending;
    }

    const hookOnlyIds = new Set(hookRepairQueue.map(skeleton => skeleton.id));
    pending.filter(skeleton => isHookCaptionOnlyFailure(completed.get(skeleton.id))).forEach(skeleton => hookOnlyIds.add(skeleton.id));
    const hookOnlySkeletons = params.skeletonTasks.filter(skeleton => hookOnlyIds.has(skeleton.id));
    if (hookOnlySkeletons.length) {
      try {
        const hookRepairs = await requestHookRepair({
          token: params.token,
          input: params.input,
          tasks: hookOnlySkeletons.map(skeleton => completed.get(skeleton.id)!),
        });
        const repairedIds = new Set<string>();
        hookOnlySkeletons.forEach(skeleton => {
          const current = completed.get(skeleton.id);
          const repair = hookRepairs.find(item => item.skeletonTaskId === skeleton.id);
          const blueprint = getBlueprintById(skeleton.blueprintId);
          if (!current || !repair || !blueprint) return;
          const repaired = normalizeCreativeTextV2({
            ...current,
            caption: repair.caption,
            engagementHook: repair.engagementHook,
            regenerationAttempts: current.regenerationAttempts + 1,
          });
          const lockErrors = validateContractLock(repaired, skeleton);
          const validation = validateTaskAgainstBlueprint(repaired, blueprint, { businessArchetype: params.businessArchetype });
          completed.set(skeleton.id, {
            ...repaired,
            validationErrors: [...lockErrors, ...validation.errors],
          });
          if (validation.valid && !lockErrors.length) repairedIds.add(skeleton.id);
        });
        const remaining = [
          ...pending.filter(skeleton => !repairedIds.has(skeleton.id)),
          ...hookOnlySkeletons.filter(skeleton => !repairedIds.has(skeleton.id)),
        ];
        pending = Array.from(new Map(remaining.map(skeleton => [skeleton.id, skeleton])).values());
      } catch (error) {
        console.warn(`[GrowthPlanner V2] Week ${week} isolated hook repair failed.`, error);
        pending = Array.from(new Map([...pending, ...hookOnlySkeletons].map(skeleton => [skeleton.id, skeleton])).values());
      }
    }

    if (pending.length) {
      const alternativeSkeletons = pending.map(skeleton => {
        const alternative = compatibleBlueprints({
          platform: skeleton.platform,
          funnelRole: skeleton.funnelRole,
          archetype: params.businessArchetype,
          campaignAngle: skeleton.campaignAngle,
        }).find(blueprint => blueprint.id !== skeleton.blueprintId);
        if (!alternative) return skeleton;
        const replacement: PlanSkeletonTask = {
          ...skeleton,
          blueprintId: alternative.id,
          platform: alternative.platform,
          contentType: alternative.contentType,
          funnelRole: alternative.funnelRole,
          module: alternative.defaultModule,
          supportModule: alternative.defaultSupportModule,
          ctaTarget: alternative.ctaTargets[0],
          estimatedEffort: alternative.estimatedEffort,
          taskPriority: alternative.taskPriority,
          variationReason: `${skeleton.variationReason} Se cambió a ${alternative.id} tras fallar el contrato original.`,
        };
        workingSkeletons.set(replacement.id, replacement);
        return replacement;
      });
      const alternatives = alternativeSkeletons.map(task => getBlueprintById(task.blueprintId)).filter(Boolean) as TaskBlueprint[];
      let creatives: CreativeTaskFields[] = [];
      try {
        creatives = await requestCreativeTaskBatch({
          token: params.token,
          input: params.input,
          skeletonTasks: alternativeSkeletons,
          blueprints: alternatives,
          nicheAdapter: params.nicheAdapter,
          salesAggressiveness: params.salesAggressiveness,
          creativeSeed: `${params.creativeSeed}-alternative`,
          businessArchetype: params.businessArchetype,
        });
      } catch (error) {
        console.warn(`[GrowthPlanner V2] Week ${week} alternative blueprint attempt failed.`, error);
      }
      alternativeSkeletons.forEach(skeleton => {
        const blueprint = getBlueprintById(skeleton.blueprintId);
        const creative = creatives.find(item => item.skeletonTaskId === skeleton.id);
        if (!blueprint || !creative) return;
        const task = mergeCreativeFields(skeleton, blueprint, creative, params.input.instagramMetrics.bestTime || '19:00', 3);
        const lockErrors = validateContractLock(task, skeleton);
        const validation = validateTaskAgainstBlueprint(task, blueprint, { businessArchetype: params.businessArchetype });
        completed.set(skeleton.id, {
          ...task,
          needsManualReview: !validation.valid || lockErrors.length > 0,
          validationErrors: [...lockErrors, ...validation.errors],
        });
      });
    }
  }

  const tasks = params.skeletonTasks.map(original => {
    const skeleton = workingSkeletons.get(original.id) || original;
    const task = completed.get(original.id);
    if (task) return task;
    const blueprint = getBlueprintById(skeleton.blueprintId)!;
    return {
      ...mergeCreativeFields(skeleton, blueprint, {
        skeletonTaskId: skeleton.id,
        visualConcept: 'Tarea pendiente de revisión manual.',
        whyItWorks: 'No se recibió una respuesta creativa válida.',
        caption: 'Revisa esta tarea antes de publicarla.',
        hashtags: '',
        prompt: '',
        slotInstructions: [],
        requiredAssets: [],
        executionRecipe: { overview: 'Revisar manualmente.', steps: [{ title: 'Revisar', instruction: 'Completa la tarea antes de publicarla.', ctaLabel: 'Revisar' }] },
        shotGuide: { duration: 'No aplica', shots: [], onScreenText: [], inspirationSearches: [], whatToAvoid: [] },
        engagementHook: 'Escríbenos PLAN para recibir orientación.',
      }, params.input.instagramMetrics.bestTime || '19:00', 3),
      needsManualReview: true,
      validationErrors: ['Gemini no devolvió campos creativos válidos tras los intentos permitidos.'],
    };
  });
  return { tasks, blueprintsUsed: tasks.map(task => task.blueprintId) };
}

function buildV2BasePlan(params: {
  input: GenerateGrowthPlanInput;
  engineInput: PlannerEngineV2Input;
  strategy: any;
  tasks: GeneratedTaskV2[];
  roadmap: GrowthStrategicPlan['roadmap'];
  warnings: string[];
}): GrowthStrategicPlan {
  const products = normalizeProductsForEngineV2(params.engineInput.products);
  return {
    id: String(params.strategy?.id || `growth_v2_${Date.now()}`),
    createdAt: String(params.strategy?.createdAt || new Date().toISOString()),
    duration: params.input.duration,
    brand: params.input.brand,
    products,
    normalizedProducts: products,
    instagramMetrics: params.input.instagramMetrics,
    businessStage: params.engineInput.businessStage,
    mainGoal: params.engineInput.mainGoal,
    commercialFocus: params.engineInput.commercialFocus,
    strategyGoal: String(params.strategy?.strategyGoal || params.engineInput.mainGoal),
    businessDiagnosis: String(params.strategy?.businessDiagnosis || ''),
    nicheInsights: asArray(params.strategy?.nicheInsights, []),
    planNarrative: String(params.strategy?.planNarrative || ''),
    strategicTip: String(params.strategy?.strategicTip || ''),
    roadmap: params.roadmap,
    tasks: params.tasks,
    brandAnalysis: {
      stageInterpretation: String(params.strategy?.brandAnalysis?.stageInterpretation || params.engineInput.businessStage),
      targetAnalysis: String(params.strategy?.brandAnalysis?.targetAnalysis || params.input.brand.idealClient),
      voiceGuide: String(params.strategy?.brandAnalysis?.voiceGuide || params.input.brand.tone),
    },
    productAnalysis: {
      productWarnings: products.flatMap(product => product.warnings || []),
      confidenceByProduct: products.map(product => ({
        productId: product.id,
        level: product.warnings?.length ? 65 : 85,
        reason: product.warnings?.length ? product.warnings.join(', ') : 'Producto normalizado para Engine V2.',
      })),
      categorizationSummary: `${products.length} producto(s), servicio(s) o plan(es) normalizados para Engine V2.`,
    },
    socialMetricsAnalysis: {
      audienceInsights: String(params.strategy?.socialMetricsAnalysis?.audienceInsights || ''),
      engagementLevel: String(params.strategy?.socialMetricsAnalysis?.engagementLevel || ''),
      confidenceMapping: String(params.strategy?.socialMetricsAnalysis?.confidenceMapping || 'Media: información declarada por la marca.'),
    },
    nicheResearch: {
      trends: asArray(params.strategy?.nicheResearch?.trends, []),
      competitorGaps: asArray(params.strategy?.nicheResearch?.competitorGaps, []),
      researchMode: 'gemini_without_grounding',
    },
    generationLog: {
      timestamp: new Date().toISOString(),
      steps: ['Estrategia base generada', 'Skeleton V2 generado', 'Creatividad generada por blueprint', 'Contract Lock validado'],
      hasImages: params.input.productImageRefs.length > 0,
      hasMetrics: true,
      researchMode: 'gemini_without_grounding',
      expectedTasks: taskRange(params.input.duration).min,
      generatedTasks: params.tasks.length,
      tasksAddedByFallback: 0,
      roadmapWeeksGenerated: params.roadmap.length,
      channelUsage: countByPlatform(params.tasks),
      warnings: uniqueStrings(params.warnings),
      validationChecks: {},
      fixedErrors: [],
      legacyNormalizersSkipped: [
        'normalizeCommercialTask', 'normalizePlatformFormatTask', 'normalizeCtaTargetForPlatform',
        'normalizePrimaryModule', 'normalizePromptSlots', 'normalizeManualSupportPrompt',
        'rebalanceChannels', 'normalizeTaskPriorities', 'normalizeEffortDistribution',
        'validateTaskInternalCoherence', 'applyWeakPhraseFilter', 'finalNaturalLanguageScan',
        'validateHashtags legacy',
      ],
      v2ValidatorsApplied: [
        'Contract Lock', 'normalizeCreativeTextV2', 'validateSlotsV2', 'validateHooksV2',
        'validateWeakPhrasesV2', 'validateSensitiveClaimsV2', 'validateBlueprintContractV2',
        'validateFinalPlan',
      ],
      contractLockedFields: [...CONTRACT_LOCKED_FIELDS],
      tasksRegenerated: params.tasks.filter(task => task.regenerationAttempts > 0).length,
      tasksMarkedForReview: params.tasks.filter(task => task.needsManualReview).length,
    },
    validationReportMarkdown: '',
  };
}

async function generateGrowthPlanV2(
  input: GenerateGrowthPlanInput,
  options: GenerateGrowthPlanOptions = {},
): Promise<GrowthStrategicPlan> {
  const token = await getAuth().currentUser?.getIdToken().catch(() => null);
  if (!token) throw new Error('Necesitas iniciar sesión para generar el plan.');

  options.onProgress?.({ stepId: 'strategy', label: 'Diseñando estrategia base' });
  const strategy = await generateStrategyWithRecovery(input, token);
  const engineInput = engineInputFromStrategy(input, strategy);
  const brandId = brandMemoryId(engineInput);
  const previousPlans = loadPreviousPlanMemory(brandId);
  const archetype = detectBusinessArchetype(engineInput);
  const nicheAdapter = selectNicheAdapter(engineInput, archetype.businessArchetype);
  const salesAggressiveness = selectSalesAggressiveness(engineInput, archetype.businessArchetype);
  const campaign = selectCampaignAngle(engineInput, archetype.businessArchetype, previousPlans);
  const skeleton = generatePlanSkeleton(engineInput, archetype.businessArchetype, campaign, previousPlans);
  const generated = await generateV2Tasks({
    token,
    input: engineInput,
    skeletonTasks: skeleton.tasks,
    nicheAdapter,
    salesAggressiveness,
    creativeSeed: campaign.creativeSeed,
    businessArchetype: archetype.businessArchetype,
    onProgress: options.onProgress,
  });

  options.onProgress?.({ stepId: 'validation', label: 'Validando contratos del plan' });
  const normalized = buildV2BasePlan({
    input,
    engineInput,
    strategy,
    tasks: generated.tasks,
    roadmap: skeleton.roadmap,
    warnings: [...asArray(strategy?.generationLog?.warnings, []), ...archetype.warnings, 'Insights generados sin búsqueda web/grounding.'],
  });

  const finalValidation = validateFinalPlan(normalized, previousPlans, archetype.businessArchetype);
  const repeatedBlueprints = detectRepeatedBlueprints(generated.blueprintsUsed, previousPlans[0]?.previousBlueprintsUsed || []);
  const repeatedCaptions = detectRepeatedCaptions(generated.tasks.map(task => task.caption), previousPlans[0]?.previousCaptions || []);
  const blueprintValidation = Object.fromEntries(generated.tasks.map(task => {
    const blueprint = getBlueprintById(task.blueprintId)!;
    return [task.id, validateTaskAgainstBlueprint(task, blueprint, { businessArchetype: archetype.businessArchetype })];
  }));
  const metadata: EngineV2Metadata = {
    plannerEngineVersion: 'v2-blueprint',
    planningDepth: 'guided',
    planQualityStatus: finalValidation.status,
    campaignAngle: campaign.campaignAngle,
    campaignAngleReason: campaign.campaignAngleReason,
    creativeSeed: campaign.creativeSeed,
    noveltyScore: skeleton.noveltyScore,
    blueprintsUsed: generated.blueprintsUsed,
    blueprintValidation,
    taskRegenerationAttempts: Object.fromEntries(generated.tasks.map(task => [task.id, task.regenerationAttempts])),
    tasksNeedingManualReview: generated.tasks.filter(task => task.needsManualReview).map(task => task.id),
    previousPlanComparison: previousPlans.length ? `Comparado con ${previousPlans.length} plan(es) previos de la marca.` : 'Primer plan V2 registrado para la marca.',
    repeatedBlueprintsDetected: repeatedBlueprints,
    repeatedCaptionsDetected: repeatedCaptions,
    variationDecisions: skeleton.variationDecisions,
    finalValidationSummary: finalValidation,
    businessArchetype: archetype.businessArchetype,
    nicheAdapterUsed: nicheAdapter.id,
    salesAggressiveness,
    researchMode: 'gemini_without_grounding',
    researchConfidence: 'medium',
    researchedInsights: [],
    inferredInsights: normalized.nicheInsights,
    fallbackInsights: [],
    legacyNormalizersSkipped: normalized.generationLog.legacyNormalizersSkipped || [],
    v2ValidatorsApplied: normalized.generationLog.v2ValidatorsApplied || [],
    contractLockedFields: normalized.generationLog.contractLockedFields || [],
    tasksRegenerated: normalized.generationLog.tasksRegenerated || 0,
    tasksMarkedForReview: normalized.generationLog.tasksMarkedForReview || 0,
  };

  normalized.plannerEngineVersion = metadata.plannerEngineVersion;
  normalized.planningDepth = metadata.planningDepth;
  normalized.campaignAngle = metadata.campaignAngle;
  normalized.campaignAngleReason = metadata.campaignAngleReason;
  normalized.creativeSeed = metadata.creativeSeed;
  normalized.noveltyScore = metadata.noveltyScore;
  normalized.planQualityStatus = metadata.planQualityStatus;
  normalized.blueprintsUsed = metadata.blueprintsUsed;
  normalized.previousPlanComparison = metadata.previousPlanComparison;
  normalized.finalValidationSummary = metadata.finalValidationSummary;
  normalized.engineV2Metadata = metadata as unknown as Record<string, unknown>;
  normalized.generationLog.validationChecks = {
    ...normalized.generationLog.validationChecks,
    ...finalValidation.checks,
  };
  normalized.validationReportMarkdown = buildEngineV2ValidationReport(normalized, metadata);

  savePlanMemory(buildPlanMemory({ input: engineInput, angle: campaign.campaignAngle, tasks: generated.tasks }));
  return normalized;
}

export async function generateGrowthPlanWithGemini(
  input: GenerateGrowthPlanInput,
  options: GenerateGrowthPlanOptions = {},
): Promise<GrowthStrategicPlan> {
  try {
    return await generateGrowthPlanV2(input, options);
  } catch (error) {
    console.warn('[GrowthPlanner] Engine V2 failed, using legacy fallback.', error);
    return generateGrowthPlanLegacy(input, options);
  }
}
