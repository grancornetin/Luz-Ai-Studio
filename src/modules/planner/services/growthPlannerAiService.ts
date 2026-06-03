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
};

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
  if (task.platform === 'WhatsApp') {
    if (task.hashtags.trim()) {
      ctx.fixedErrors.push(`Hashtags eliminados en tarea WhatsApp "${task.contentType}".`);
    }
    return { ...task, hashtags: '' };
  }

  const existing = uniqueStrings((task.hashtags.match(/#[a-z0-9_áéíóúñ]+/gi) || [])
    .filter(tag => !['#viral', '#fyp', '#parati', '#follow'].includes(tag.toLowerCase())));
  const target = uniqueStrings([...existing, ...hashtagSeedFor(input)]).slice(0, 12);
  if (target.length < 8 || target.join(' ') !== task.hashtags.trim()) {
    ctx.fixedErrors.push(`Hashtags ajustados en tarea "${task.contentType}" (${existing.length} -> ${Math.max(target.length, 8)}).`);
  }
  return { ...task, hashtags: target.slice(0, Math.max(8, Math.min(12, target.length))).join(' ') };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function filterWeakPhrasesText(value: string, field: string, ctx: ValidationContext): string {
  let next = value;
  weakMarketingPhrases.forEach(phrase => {
    const regex = new RegExp(escapeRegExp(phrase), 'gi');
    if (regex.test(next)) {
      next = next.replace(regex, weakPhraseReplacements[phrase] || 'mensaje comercial concreto');
      ctx.fixedErrors.push(`Frase debil filtrada en ${field}: "${phrase}".`);
    }
  });
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
    if (task.platform === 'WhatsApp') return task.hashtags.trim() === '';
    return count >= 8 && count <= 12;
  });
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

function containsWeakPhrase(plan: GrowthStrategicPlan): boolean {
  const text = [
    plan.strategyGoal,
    plan.businessDiagnosis,
    plan.planNarrative,
    plan.strategicTip,
    ...plan.tasks.flatMap(task => [task.visualConcept, task.whyItWorks, task.caption, task.prompt, task.supportPrompt || '', task.engagementHook]),
  ].join(' ').toLowerCase();
  return weakMarketingPhrases.some(phrase => text.includes(phrase.toLowerCase()));
}

function markdownList(items: string[]): string {
  return items.length ? items.map(item => `- ${item}`).join('\n') : '- Sin hallazgos.';
}

function buildValidationReport(plan: GrowthStrategicPlan): string {
  const normalizedProducts = plan.normalizedProducts || plan.products;
  const productRows = normalizedProducts.map(product =>
    `| ${product.name} | ${product.price || '-'} | ${product.credits || '-'} | ${product.idealFor || '-'} | ${product.messageKey || product.benefit || '-'} | ${(product.inferredFields || []).join(', ') || '-'} | ${(product.warnings || []).join('; ') || '-'} |`,
  ).join('\n');
  const taskRows = plan.tasks.map(task =>
    `| ${task.date} | ${task.dayLabel} | ${task.platform} | ${task.module} | ${task.funnelRole} | ${task.contentType} | ${task.engagementHook || '-'} | ${task.supportPrompt ? 'si' : 'no'} |`,
  ).join('\n');
  const roadmap = plan.roadmap.map(item => `- Semana ${item.week}: ${item.title} - ${item.objective}`).join('\n') || '- Sin roadmap.';
  const checks = plan.generationLog.validationChecks;
  const channelUsage = plan.generationLog.channelUsage || countByPlatform(plan.tasks);
  const channelUsageText = Object.entries(channelUsage).map(([channel, count]) => `- ${channel}: ${count}`).join('\n') || '- Sin canales detectados.';
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
| Fecha | Dia | Plataforma | Modulo | Funnel role | Content type | CTA target | Support prompt |
| --- | --- | --- | --- | --- | --- | --- | --- |
${taskRows}

## 5.1 Slots detectados
- ${slotSummary}

## 5.2 Support prompts
${supportPrompts}

## 6. Validaciones
- Fechas validas: ${checks.datesValid ? 'si' : 'no'}
- Sin fechas pasadas: ${checks.noPastDates ? 'si' : 'no'}
- Slots validos: ${checks.slotsValid ? 'si' : 'no'}
- Modulos validos: ${checks.modulesValid ? 'si' : 'no'}
- Hashtags validos: ${checks.hashtagsValid ? 'si' : 'no'}
- Palabras debiles corregidas: ${checks.weakPhrasesFiltered ? 'si' : 'no'}
- Productos normalizados: ${checks.productsNormalized ? 'si' : 'no'}

## 7. Warnings
${markdownList(plan.generationLog.warnings)}

## 8. Fixed errors
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
    status: safeStatus(task?.status),
  }));

  if (!tasks.length) throw new Error('Gemini devolvio un plan sin tareas.');

  const taskCompletion = ensureMinimumTasks(tasks, input, ctx);
  tasks = taskCompletion.tasks;
  tasks = tasks
    .map(task => validateModuleMapping(task, ctx))
    .map(task => normalizePromptSlots(task, ctx))
    .map(task => normalizeManualSupportPrompt(task, ctx))
    .map(task => validateHashtags(task, input, ctx));
  tasks = rebalanceChannels(tasks, input, ctx);
  tasks = tasks
    .map(task => validateModuleMapping(task, ctx))
    .map(task => normalizeManualSupportPrompt(task, ctx))
    .map(task => validateHashtags(task, input, ctx));
  const dateValidation = validateAndFixTaskDates(tasks, input.duration, ctx);
  tasks = dateValidation.tasks;
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
        weakPhrasesFiltered: true,
      },
      fixedErrors: uniqueStrings(ctx.fixedErrors),
    },
    validationReportMarkdown: '',
  };

  plan = applyWeakPhraseFilter(plan, ctx);
  plan.generationLog.warnings = uniqueStrings(ctx.warnings);
  plan.generationLog.fixedErrors = uniqueStrings(ctx.fixedErrors);
  plan.generationLog.validationChecks = {
    ...plan.generationLog.validationChecks,
    modulesValid: validateModules(plan.tasks),
    slotsValid: validateSlots(plan.tasks),
    hashtagsValid: validateHashtagState(plan.tasks),
    weakPhrasesFiltered: !containsWeakPhrase(plan),
  };
  plan.validationReportMarkdown = buildValidationReport(plan);
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
- Captions: 1 parrafo. Prompts: menos de 450 caracteres.
- Cada executionRecipe debe tener maximo 3 pasos.
- Cada shotGuide debe tener maximo 3 tomas.
- Modulos validos: product, ugc, scene, prompt, outfit, none.
- Si module es none, prompt debe ser "".
- Si una tarea manual necesita apoyo visual, usa supportModule y supportPrompt.
- Slots permitidos: @producto1, @producto2, @producto3, @producto4, @persona1, @outfit1, @escena1, @referencia1.
- No uses placeholders con corchetes.
- Status inicial de todas las tareas: pending.
- Evita lenguaje generico como "brillar", "contenido de valor" o "llevar al siguiente nivel".
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

export async function generateGrowthPlanWithGemini(
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
