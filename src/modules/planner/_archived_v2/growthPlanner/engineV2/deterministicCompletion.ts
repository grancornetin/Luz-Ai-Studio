import type { GrowthProduct } from '../../growthPlannerTypes';
import { normalizeCreativeTextV2 } from './creativeNormalizers';
import { buildHookForCtaTarget } from './hookFactory';
import { sanitizePlannerText } from './inputSanitizer';
import { normalizeSlotsV2, SLOT_REGISTRY_V2 } from './slotRegistry';
import type {
  BusinessArchetype,
  GeneratedTaskV2,
  PlanSkeletonTask,
  PlannerEngineV2Input,
  TaskBlueprint,
} from './types';

export interface DeterministicCompletionContext {
  input: PlannerEngineV2Input;
  businessArchetype: BusinessArchetype;
  suggestedTime: string;
}

function productForTask(skeleton: PlanSkeletonTask, input: PlannerEngineV2Input): GrowthProduct {
  return input.products.find(product => product.id === skeleton.productId)
    || input.products[0]
    || {
      id: 'offer',
      name: input.commercialFocus || 'oferta principal',
      category: input.brand.category,
      description: input.commercialFocus,
      price: '',
      stock: '',
      benefit: input.mainGoal,
    };
}

function subjectFor(skeleton: PlanSkeletonTask, product: GrowthProduct, archetype: BusinessArchetype): string {
  if (archetype === 'saas_subscription' && /PLAN|CREDIT|DECISION|RECOMMENDATION|OFFER|QUALIFIER/.test(skeleton.blueprintId)) {
    return 'los planes y créditos disponibles';
  }
  return product.name || 'la oferta principal';
}

function platformCopy(platform: GeneratedTaskV2['platform'], subject: string): {
  visualConcept: string;
  recipeOverview: string;
  shots: string[];
} {
  if (platform === 'Stories') return {
    visualConcept: `Secuencia de stories que explica ${subject} con una pregunta clara y una respuesta breve.`,
    recipeOverview: `Preparar una secuencia de stories sobre ${subject} y responder las interacciones.`,
    shots: [`Story inicial con la pregunta principal sobre ${subject}.`, 'Story de respuesta con un ejemplo concreto.', 'Story final con el llamado a la acción.'],
  };
  if (platform === 'Facebook') return {
    visualConcept: `Publicación de Facebook que explica ${subject} mediante un caso concreto y abre comentarios.`,
    recipeOverview: `Preparar una publicación de Facebook sobre ${subject} y responder comentarios.`,
    shots: [`Visual principal con ${subject}.`, 'Detalle que apoya la explicación.', 'Cierre visual con la acción recomendada.'],
  };
  if (platform === 'WhatsApp') return {
    visualConcept: `Mensaje breve de WhatsApp que recomienda ${subject} según la necesidad de la persona.`,
    recipeOverview: `Preparar y enviar un mensaje de WhatsApp sobre ${subject}.`,
    shots: [`Imagen de apoyo para el mensaje sobre ${subject}.`],
  };
  if (platform === 'TikTok') return {
    visualConcept: `Video corto que muestra ${subject} con una explicación directa y un cierre accionable.`,
    recipeOverview: `Grabar y publicar un video corto sobre ${subject}.`,
    shots: [`Presentar ${subject} en el primer plano.`, 'Mostrar un uso o diferencia concreta.', 'Cerrar con la acción recomendada.'],
  };
  return {
    visualConcept: `Pieza para Instagram Feed que explica ${subject} con un ejemplo concreto y fácil de comparar.`,
    recipeOverview: `Crear y publicar una pieza de Instagram Feed sobre ${subject}.`,
    shots: [`Portada clara sobre ${subject}.`, 'Ejemplo o comparación concreta.', 'Cierre visual con la acción recomendada.'],
  };
}

function slotsFor(blueprint: TaskBlueprint, archetype: BusinessArchetype): string[] {
  if (archetype === 'saas_subscription' && /PLAN_COMPARISON|DECISION_GUIDE|CREDITS_EXPLAINER/.test(blueprint.id)) {
    return ['@plan1', '@plan2', '@plan3', '@plan4', '@comparativa1'];
  }
  if (archetype === 'saas_subscription' && /SOCIAL_PROOF|TESTIMONIAL/.test(blueprint.id)) {
    return ['@testimonio1', '@resultado1', '@logo1'];
  }
  return blueprint.requiredSlots.map(slot => archetype === 'saas_subscription' && slot === '@producto1' ? '@plan1' : slot);
}

function promptFor(blueprint: TaskBlueprint, subject: string, slots: string[]): string {
  if (blueprint.promptPolicy === 'none' || blueprint.defaultModule === 'none') return '';
  return `Crea una pieza ${blueprint.contentType.toLowerCase()} para ${blueprint.platform} que explique ${subject}. Usa ${slots.join(', ') || 'los recursos de marca'} con jerarquía clara, texto legible y espacio para el llamado a la acción.`;
}

export function hasDeterministicFallback(blueprint: TaskBlueprint): boolean {
  return Boolean(blueprint.id && blueprint.platform && blueprint.contentType && blueprint.ctaTargets.length && blueprint.promptPolicy);
}

export function completeTaskFromBlueprintDeterministic(
  skeleton: PlanSkeletonTask,
  blueprint: TaskBlueprint,
  context: DeterministicCompletionContext,
): GeneratedTaskV2 {
  const product = productForTask(skeleton, context.input);
  const subject = subjectFor(skeleton, product, context.businessArchetype);
  const platform = platformCopy(skeleton.platform, subject);
  platform.visualConcept = `${blueprint.name}: ${platform.visualConcept}`;
  const slots = slotsFor(blueprint, context.businessArchetype);
  const hook = buildHookForCtaTarget(skeleton);
  const caption = sanitizePlannerText(`${platform.visualConcept} ${product.benefit || context.input.commercialFocus || context.input.mainGoal}. ${hook}`).value;
  const primaryPrompt = promptFor(blueprint, subject, slots);
  const supportPrompt = skeleton.supportModule && blueprint.promptPolicy !== 'none'
    ? `Crea un visual de apoyo para ${subject} usando ${slots.join(', ') || 'los recursos de marca'}.`
    : undefined;
  const task: GeneratedTaskV2 = {
    id: skeleton.id,
    week: skeleton.week,
    dayLabel: skeleton.dayLabel,
    date: skeleton.date,
    platform: skeleton.platform,
    contentType: skeleton.contentType,
    funnelRole: skeleton.funnelRole,
    module: skeleton.module,
    supportModule: skeleton.supportModule,
    moduleReason: skeleton.module === 'none' ? 'La acción principal ocurre directamente en el canal.' : `El blueprint usa ${skeleton.module} para crear la pieza principal.`,
    suggestedTime: context.suggestedTime,
    visualConcept: platform.visualConcept,
    whyItWorks: `Presenta ${subject} con información concreta y facilita una acción compatible con ${skeleton.platform}.`,
    caption,
    hashtags: skeleton.platform === 'WhatsApp' || skeleton.module === 'none'
      ? ''
      : context.businessArchetype === 'saas_subscription'
        ? '#ContenidoVisual #PlanDeContenido #LuzIAStudio'
        : '#ContenidoVisual #Producto #TiendaOnline',
    prompt: primaryPrompt,
    supportPrompt,
    slotInstructions: slots.map(slot => ({ slot, instruction: SLOT_REGISTRY_V2[slot] || `Recurso necesario para explicar ${subject}.` })),
    requiredAssets: slots.length ? slots : [`Información actualizada sobre ${subject}`],
    executionRecipe: {
      overview: platform.recipeOverview,
      steps: [
        { id: `${skeleton.id}_step_1`, title: 'Preparar contenido', module: skeleton.module, instruction: `Reúne la información y los recursos necesarios para explicar ${subject}.`, ctaLabel: skeleton.module === 'none' ? 'Preparar' : 'Crear pieza', status: 'pending' },
        { id: `${skeleton.id}_step_2`, title: 'Publicar y responder', module: 'none', instruction: `${platform.recipeOverview} Cierra con: ${hook}`, ctaLabel: 'Publicar', status: 'pending' },
      ],
    },
    shotGuide: {
      duration: /Reel|Video|Demo|Story|Stories|TikTok/i.test(`${skeleton.contentType} ${skeleton.platform}`) ? '15 a 30 segundos' : 'No aplica',
      shots: platform.shots.map((instruction, index) => ({ shot: index + 1, duration: '5 a 8 segundos', instruction })),
      onScreenText: [subject, hook],
      inspirationSearches: [`${skeleton.contentType} ${subject}`, `${skeleton.platform} ${subject}`],
      whatToAvoid: ['Promesas exageradas', 'Texto difícil de leer', 'Llamados a la acción sin destino claro'],
    },
    engagementHook: hook,
    estimatedEffort: skeleton.estimatedEffort,
    taskPriority: skeleton.taskPriority,
    ctaTarget: skeleton.ctaTarget,
    status: 'pending',
    blueprintId: blueprint.id,
    campaignAngle: skeleton.campaignAngle,
    variationReason: skeleton.variationReason,
    needsManualReview: false,
    validationErrors: [],
    regenerationAttempts: 0,
  };
  return normalizeSlotsV2(normalizeCreativeTextV2(task), context.businessArchetype).task;
}

export const conversionSafePackSaas = [
  'IG_CAROUSEL_PLAN_COMPARISON', 'STORY_DM_QUALIFIER', 'FB_PLAN_RECOMMENDATION',
  'IG_POST_DECISION_GUIDE', 'IG_CAROUSEL_CREDITS_EXPLAINER', 'STORY_CREDITS_QUESTION',
  'FB_OBJECTION_CLOSE_POST', 'WHATSAPP_PLAN_RECOMMENDATION',
] as const;
