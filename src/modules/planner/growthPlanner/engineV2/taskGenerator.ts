import { Type } from '@google/genai';
import { normalizeSpanishText } from './orthography';
import { normalizeCreativeTextV2 } from './creativeNormalizers';
import { requiredSlotsForArchetype } from './slots';
import type {
  BusinessArchetype,
  GeneratedTaskV2,
  NicheAdapter,
  PlanSkeletonTask,
  PlannerEngineV2Input,
  SalesAggressiveness,
  TaskBlueprint,
} from './types';

export interface CreativeTaskFields {
  skeletonTaskId: string;
  visualConcept: string;
  whyItWorks: string;
  caption: string;
  hashtags: string;
  prompt: string;
  supportPrompt?: string;
  slotInstructions: Array<{ slot: string; instruction: string }>;
  requiredAssets: string[];
  executionRecipe: {
    overview: string;
    steps: Array<{ title: string; instruction: string; ctaLabel: string }>;
  };
  shotGuide: {
    duration: string;
    shots: Array<{ shot: number; duration: string; instruction: string }>;
    onScreenText: string[];
    inspirationSearches: string[];
    whatToAvoid: string[];
  };
  engagementHook: string;
}

export interface HookRepairFields {
  skeletonTaskId: string;
  caption: string;
  engagementHook: string;
}

export const HOOK_REPAIR_BATCH_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    tasks: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          skeletonTaskId: { type: Type.STRING },
          caption: { type: Type.STRING },
          engagementHook: { type: Type.STRING },
        },
        required: ['skeletonTaskId', 'caption', 'engagementHook'],
      },
    },
  },
  required: ['tasks'],
};

export const CREATIVE_TASK_BATCH_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    tasks: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          skeletonTaskId: { type: Type.STRING },
          visualConcept: { type: Type.STRING },
          whyItWorks: { type: Type.STRING },
          caption: { type: Type.STRING },
          hashtags: { type: Type.STRING },
          prompt: { type: Type.STRING },
          supportPrompt: { type: Type.STRING },
          slotInstructions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: { slot: { type: Type.STRING }, instruction: { type: Type.STRING } },
              required: ['slot', 'instruction'],
            },
          },
          requiredAssets: { type: Type.ARRAY, items: { type: Type.STRING } },
          executionRecipe: {
            type: Type.OBJECT,
            properties: {
              overview: { type: Type.STRING },
              steps: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    instruction: { type: Type.STRING },
                    ctaLabel: { type: Type.STRING },
                  },
                  required: ['title', 'instruction', 'ctaLabel'],
                },
              },
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
              onScreenText: { type: Type.ARRAY, items: { type: Type.STRING } },
              inspirationSearches: { type: Type.ARRAY, items: { type: Type.STRING } },
              whatToAvoid: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: ['duration', 'shots', 'onScreenText', 'inspirationSearches', 'whatToAvoid'],
          },
          engagementHook: { type: Type.STRING },
        },
        required: [
          'skeletonTaskId', 'visualConcept', 'whyItWorks', 'caption', 'hashtags', 'prompt',
          'slotInstructions', 'requiredAssets', 'executionRecipe', 'shotGuide', 'engagementHook',
        ],
      },
    },
  },
  required: ['tasks'],
};

export function buildCreativeTaskBatchPrompt(params: {
  input: PlannerEngineV2Input;
  skeletonTasks: PlanSkeletonTask[];
  blueprints: TaskBlueprint[];
  nicheAdapter: NicheAdapter;
  salesAggressiveness: SalesAggressiveness;
  creativeSeed: string;
  repairErrors?: Record<string, string[]>;
  businessArchetype: BusinessArchetype;
}): string {
  const contracts = params.skeletonTasks.map(task => {
    const blueprint = params.blueprints.find(item => item.id === task.blueprintId);
    return {
      skeletonTaskId: task.id,
      blueprintId: task.blueprintId,
      platform: task.platform,
      contentType: task.contentType,
      funnelRole: task.funnelRole,
      module: task.module,
      supportModule: task.supportModule || null,
      ctaTarget: task.ctaTarget,
      date: task.date,
      productId: task.productId || null,
      promptPolicy: blueprint?.promptPolicy || 'none',
      requiredSlots: blueprint ? requiredSlotsForArchetype(blueprint, params.businessArchetype) : [],
      forbiddenTerms: blueprint?.forbiddenTerms || [],
      requiredTerms: blueprint?.requiredTerms || [],
      repairErrors: params.repairErrors?.[task.id] || [],
    };
  });

  const compactProducts = params.input.products.slice(0, 30).map(product => ({
    id: product.id,
    name: product.name,
    category: product.category,
    description: product.description.slice(0, 220),
    price: product.price,
    stock: product.stock,
    benefit: product.benefit.slice(0, 180),
    credits: product.credits || '',
    idealFor: product.idealFor || '',
    useCases: (product.useCases || []).slice(0, 4),
    messageKey: product.messageKey || '',
  }));

  return `Eres la redactora estratégica del Growth Planner de Luz IA Studio.
La app ya decidió toda la estructura. Tú solo completas los campos creativos.

REGLAS DURAS:
- Devuelve JSON estricto según el schema.
- Devuelve exactamente una respuesta creativa por skeletonTaskId recibido.
- No cambies ni devuelvas platform, contentType, date, dayLabel, funnelRole, module, ctaTarget, esfuerzo, prioridad ni blueprintId.
- Respeta la plataforma y no menciones otras plataformas.
- Español LATAM claro, natural y con acentos correctos.
- Caption de 2 a 4 frases. Hook accionable.
- Si CTA es DM, usa una palabra clave. Si es comentario, usa una palabra corta. Si es Stories, usa "responde esta story".
- Si module es none, prompt debe ser "".
- supportPrompt solo puede existir cuando existe supportModule.
- No uses: empoderar, brillar, magia, imágenes de revista, éxito, infinitas posibilidades, vende más, resultados increíbles, contenido de valor.
- No prometas curas, ingresos ni resultados garantizados.
- No uses "link en bio" salvo que el CTA target lo indique.
- Usa los slots requeridos y explica cada slot en slotInstructions.
- Slots SaaS permitidos: @plan1, @plan2, @plan3, @app_screen1, @resultado1, @comparativa1. @producto1 puede usarse como alias de @plan1.
- Máximo 3 pasos de ejecución y máximo 3 tomas.

MARCA:
${JSON.stringify(params.input.brand)}

PRODUCTOS/SERVICIOS:
${JSON.stringify(compactProducts)}

OBJETIVO:
${params.input.mainGoal}

FOCO COMERCIAL:
${params.input.commercialFocus}

ADAPTADOR DE NICHO:
${JSON.stringify(params.nicheAdapter)}

AGRESIVIDAD COMERCIAL:
${params.salesAggressiveness}

SEMILLA CREATIVA:
${params.creativeSeed}

CONTRATOS FIJOS:
${JSON.stringify(contracts, null, 2)}
`;
}

export function buildHookRepairPrompt(params: {
  tasks: GeneratedTaskV2[];
  brandName: string;
  tone: string;
}): string {
  const contracts = params.tasks.map(task => ({
    skeletonTaskId: task.id,
    platform: task.platform,
    contentType: task.contentType,
    ctaTarget: task.ctaTarget,
    currentCaption: task.caption,
    currentEngagementHook: task.engagementHook,
    validationErrors: task.validationErrors,
  }));
  return `Corrige SOLO caption y engagementHook para estas tareas del Growth Planner.
No devuelvas ni cambies ningún otro campo.

REGLAS:
- Devuelve JSON estricto.
- Mantén el sentido comercial de cada tarea.
- El hook debe tener verbo de acción, coincidir con ctaTarget y dejar claro el destino.
- Para DM o comentarios, usa una palabra clave corta cuando corresponda.
- Para Stories, usa "responde esta story".
- Caption de 2 a 4 frases.
- No uses frases genéricas ni promesas exageradas.
- Español LATAM natural y tono ${params.tone}.

MARCA: ${params.brandName}

TAREAS:
${JSON.stringify(contracts, null, 2)}
`;
}

export function mergeCreativeFields(
  skeleton: PlanSkeletonTask,
  blueprint: TaskBlueprint,
  creative: CreativeTaskFields,
  suggestedTime: string,
  regenerationAttempts = 0,
): GeneratedTaskV2 {
  const clean = (value: string) => normalizeSpanishText(String(value || '').trim());
  const moduleReason = skeleton.module === 'none'
    ? 'La acción principal es nativa del canal y no requiere generación visual principal.'
    : `El blueprint ${blueprint.id} requiere el módulo ${skeleton.module} como pieza principal.`;
  return normalizeCreativeTextV2({
    id: skeleton.id,
    week: skeleton.week,
    dayLabel: skeleton.dayLabel,
    date: skeleton.date,
    platform: skeleton.platform,
    contentType: skeleton.contentType,
    funnelRole: skeleton.funnelRole,
    module: skeleton.module,
    supportModule: skeleton.supportModule,
    moduleReason,
    suggestedTime,
    visualConcept: clean(creative.visualConcept),
    whyItWorks: clean(creative.whyItWorks),
    caption: clean(creative.caption),
    hashtags: skeleton.platform === 'WhatsApp' || skeleton.module === 'none' ? '' : clean(creative.hashtags),
    prompt: skeleton.module === 'none' ? '' : clean(creative.prompt),
    supportPrompt: skeleton.supportModule && creative.supportPrompt ? clean(creative.supportPrompt) : undefined,
    slotInstructions: (creative.slotInstructions || []).map(slot => ({ slot: slot.slot, instruction: clean(slot.instruction) })),
    requiredAssets: (creative.requiredAssets || []).map(clean),
    executionRecipe: {
      overview: clean(creative.executionRecipe?.overview),
      steps: (creative.executionRecipe?.steps || []).slice(0, 3).map((step, index) => ({
        id: `${skeleton.id}_step_${index + 1}`,
        title: clean(step.title),
        module: index === 0 ? skeleton.module : 'none',
        instruction: clean(step.instruction),
        ctaLabel: clean(step.ctaLabel),
        status: 'pending',
      })),
    },
    shotGuide: {
      duration: clean(creative.shotGuide?.duration),
      shots: (creative.shotGuide?.shots || []).slice(0, 3).map((shot, index) => ({
        shot: Number(shot.shot || index + 1),
        duration: clean(shot.duration),
        instruction: clean(shot.instruction),
      })),
      onScreenText: (creative.shotGuide?.onScreenText || []).map(clean),
      inspirationSearches: (creative.shotGuide?.inspirationSearches || []).map(clean),
      whatToAvoid: (creative.shotGuide?.whatToAvoid || []).map(clean),
    },
    engagementHook: clean(creative.engagementHook),
    estimatedEffort: skeleton.estimatedEffort,
    taskPriority: skeleton.taskPriority,
    ctaTarget: skeleton.ctaTarget,
    status: 'pending',
    blueprintId: blueprint.id,
    campaignAngle: skeleton.campaignAngle,
    variationReason: skeleton.variationReason,
    needsManualReview: false,
    validationErrors: [],
    regenerationAttempts,
  });
}

export function emptyCreativeFields(skeletonTaskId: string): CreativeTaskFields {
  return {
    skeletonTaskId,
    visualConcept: '',
    whyItWorks: '',
    caption: '',
    hashtags: '',
    prompt: '',
    slotInstructions: [],
    requiredAssets: [],
    executionRecipe: { overview: '', steps: [] },
    shotGuide: { duration: '', shots: [], onScreenText: [], inspirationSearches: [], whatToAvoid: [] },
    engagementHook: '',
  };
}
