import type {
  BusinessArchetype,
  CampaignAngle,
  Channel,
  ContentModule,
  FunnelRole,
  TaskBlueprint,
} from './types';

const ALL_ARCHETYPES: BusinessArchetype[] = [
  'ecommerce_product', 'fashion_accessories', 'fashion_clothing', 'beauty_cosmetics',
  'food_beverage', 'service_business', 'local_retail', 'education_course',
  'events_experiences', 'handmade_crafts', 'generic_business',
  'physical_product', 'digital_product', 'local_service', 'professional_service', 'saas_subscription',
  'personal_brand', 'food_business', 'event_experience', 'marketplace_catalog', 'prelaunch',
  'stock_clearance', 'course_education', 'other',
];

const ALL_ANGLES: CampaignAngle[] = [
  'estilo_diario', 'versatilidad_producto', 'regalo_detalle', 'antes_despues_outfit',
  'prueba_social_producto', 'guia_de_estilo', 'producto_destacado', 'temporada_ocasion',
  'comparativa_productos', 'confianza_compra', 'impulso_whatsapp',
  'dolor_visual', 'ahorro_tiempo', 'comparacion_planes', 'prueba_social', 'educacion_creditos',
  'objeciones_compra', 'lanzamiento_producto', 'reactivacion_audiencia', 'decision_plan_correcto',
  'producto_en_uso', 'antes_despues', 'autoridad', 'comunidad', 'temporada', 'stock_limitado',
];

const PLATFORM_FORBIDDEN: Record<Channel, string[]> = {
  'Instagram Feed': ['sticker de story', 'responde esta story', 'publicar en Facebook', 'encuesta de story'],
  Stories: ['carrusel de Feed', 'post de Facebook', 'comenta en Facebook'],
  Facebook: ['sticker de Instagram', 'responder story', 'responde esta story'],
  TikTok: ['post formal de Facebook', 'publicar en Facebook'],
  WhatsApp: ['hashtags', 'publicar en', 'link en bio'],
};

const CTA_BY_PLATFORM: Record<Channel, TaskBlueprint['ctaTargets']> = {
  'Instagram Feed': ['Instagram DM', 'Comentario', 'Guardar', 'Link en bio'],
  Stories: ['Responder story', 'Instagram DM', 'Link en bio'],
  Facebook: ['Facebook comentario', 'DM Facebook', 'Link'],
  TikTok: ['Comentario', 'Instagram DM', 'Link'],
  WhatsApp: ['WhatsApp'],
};

type BlueprintSpec = [string, string, Channel, string, FunnelRole, ContentModule, TaskBlueprint['estimatedEffort']];

const SPECS: BlueprintSpec[] = [
  ['IG_REEL_BEFORE_AFTER', 'Antes y después visual', 'Instagram Feed', 'Antes/después', 'atraer', 'product', 'alto'],
  ['IG_POST_EDUCATIONAL_PAIN', 'Dolor educativo', 'Instagram Feed', 'Post educativo', 'atraer', 'product', 'medio'],
  ['IG_CAROUSEL_COMMON_ERRORS', 'Errores frecuentes', 'Instagram Feed', 'Carrusel', 'atraer', 'product', 'medio'],
  ['IG_REEL_MYTH_VS_REALITY', 'Mito versus realidad', 'Instagram Feed', 'Reel', 'atraer', 'ugc', 'alto'],
  ['STORY_POLL_PAIN_POINT', 'Encuesta de dolor', 'Stories', 'Encuesta', 'atraer', 'none', 'bajo'],
  ['STORY_QUICK_DIAGNOSIS', 'Diagnóstico rápido', 'Stories', 'Test rápido', 'atraer', 'none', 'bajo'],
  ['FB_QA_POST', 'Pregunta y respuesta', 'Facebook', 'Q&A en comentarios', 'atraer', 'none', 'bajo'],
  ['TIKTOK_PROBLEM_REVEAL', 'Problema visible', 'TikTok', 'Video corto', 'atraer', 'ugc', 'alto'],
  ['WHATSAPP_REENGAGEMENT_QUESTION', 'Reactivación por pregunta', 'WhatsApp', 'Recuperación de lead', 'atraer', 'none', 'bajo'],
  ['IG_REEL_SCREEN_DEMO', 'Demo de pantalla', 'Instagram Feed', 'Demo rápida', 'generar_deseo', 'ugc', 'alto'],
  ['IG_POST_SCENE_EXAMPLE', 'Ejemplo en escena', 'Instagram Feed', 'Post con imagen', 'generar_deseo', 'scene', 'medio'],
  ['IG_CAROUSEL_BENEFITS', 'Beneficios concretos', 'Instagram Feed', 'Carrusel', 'generar_deseo', 'product', 'medio'],
  ['IG_REEL_PRODUCT_IN_USE', 'Producto en uso', 'Instagram Feed', 'Reel', 'generar_deseo', 'ugc', 'alto'],
  ['IG_POST_PRODUCT_SPOTLIGHT', 'Producto destacado', 'Instagram Feed', 'Post con imagen', 'generar_deseo', 'product', 'medio'],
  ['STORY_DEMO_QUICK', 'Demo breve', 'Stories', 'Demo rápida', 'generar_deseo', 'ugc', 'medio'],
  ['STORY_THIS_OR_THAT', 'Esto o aquello', 'Stories', 'Encuesta', 'generar_deseo', 'none', 'bajo'],
  ['FB_PLAN_COMPARISON', 'Comparación de opciones', 'Facebook', 'Comparativa', 'generar_deseo', 'product', 'medio'],
  ['TIKTOK_FAST_DEMO', 'Demo veloz', 'TikTok', 'Demo rápida', 'generar_deseo', 'ugc', 'alto'],
  ['WHATSAPP_USE_CASE_MESSAGE', 'Caso de uso directo', 'WhatsApp', 'Mensaje de difusión', 'generar_deseo', 'none', 'bajo'],
  ['IG_POST_SOCIAL_PROOF', 'Prueba social', 'Instagram Feed', 'Publicación de prueba social', 'construir_confianza', 'product', 'medio'],
  ['IG_CAROUSEL_OBJECTION_RESPONSE', 'Respuesta a objeción', 'Instagram Feed', 'Carrusel', 'construir_confianza', 'product', 'medio'],
  ['IG_POST_CREDITS_EXPLAINER', 'Explicación de créditos', 'Instagram Feed', 'Post educativo', 'construir_confianza', 'product', 'medio'],
  ['IG_REEL_PROCESS_BEHIND', 'Proceso detrás', 'Instagram Feed', 'Reel', 'construir_confianza', 'ugc', 'alto'],
  ['STORY_QA_OBJECTIONS', 'Objeciones en Q&A', 'Stories', 'Q&A', 'construir_confianza', 'none', 'bajo'],
  ['STORY_FAQ_SEQUENCE', 'Preguntas frecuentes', 'Stories', 'Secuencia de stories', 'construir_confianza', 'none', 'bajo'],
  ['FB_OBJECTION_POST', 'Objeción explicada', 'Facebook', 'Post largo', 'construir_confianza', 'none', 'medio'],
  ['FB_SOCIAL_PROOF', 'Prueba social Facebook', 'Facebook', 'Publicación de prueba social', 'construir_confianza', 'product', 'medio'],
  ['TIKTOK_TESTIMONIAL_STYLE', 'Testimonio breve', 'TikTok', 'Storytime breve', 'construir_confianza', 'ugc', 'alto'],
  ['WHATSAPP_FAQ_REPLY', 'Respuesta FAQ', 'WhatsApp', 'Respuesta FAQ', 'construir_confianza', 'none', 'bajo'],
  ['IG_CAROUSEL_PLAN_COMPARISON', 'Comparación de planes', 'Instagram Feed', 'Comparativa', 'convertir', 'product', 'medio'],
  ['IG_POST_STARTER_VS_PRO', 'Starter versus Pro', 'Instagram Feed', 'Post educativo', 'convertir', 'product', 'medio'],
  ['IG_REEL_FINAL_CTA', 'Cierre en Reel', 'Instagram Feed', 'Reel', 'convertir', 'ugc', 'alto'],
  ['IG_POST_DECISION_GUIDE', 'Guía de decisión', 'Instagram Feed', 'Carrusel', 'convertir', 'product', 'medio'],
  ['IG_CAROUSEL_CREDITS_EXPLAINER', 'Créditos por plan', 'Instagram Feed', 'Carrusel', 'convertir', 'product', 'medio'],
  ['STORY_DM_QUALIFIER', 'Calificador por DM', 'Stories', 'Sticker de pregunta', 'convertir', 'none', 'bajo'],
  ['STORY_CREDITS_QUESTION', 'Pregunta sobre créditos', 'Stories', 'Q&A', 'convertir', 'none', 'bajo'],
  ['STORY_COUNTDOWN_OR_REMINDER', 'Recordatorio de cierre', 'Stories', 'Recordatorio', 'convertir', 'none', 'bajo'],
  ['STORY_CREDITS_EXPLAINER', 'Créditos en stories', 'Stories', 'Secuencia de stories', 'convertir', 'none', 'bajo'],
  ['FB_PLAN_RECOMMENDATION', 'Recomendación de plan', 'Facebook', 'Caso de uso', 'convertir', 'none', 'medio'],
  ['FB_DIRECT_OFFER_POST', 'Oferta directa', 'Facebook', 'Post largo', 'convertir', 'none', 'medio'],
  ['FB_OBJECTION_CLOSE_POST', 'Cierre de objeción', 'Facebook', 'Post largo', 'convertir', 'none', 'medio'],
  ['TIKTOK_PLAN_PICKER', 'Selector de plan', 'TikTok', 'Tutorial rápido', 'convertir', 'ugc', 'alto'],
  ['WHATSAPP_CLOSE_CONVERSATION', 'Cierre conversacional', 'WhatsApp', 'Cierre de venta', 'convertir', 'none', 'bajo'],
  ['WHATSAPP_PLAN_RECOMMENDATION', 'Recomendación por WhatsApp', 'WhatsApp', 'Recomendación de plan', 'convertir', 'none', 'bajo'],
  ['ASSET_PRODUCT_PHOTO_BASE', 'Foto base de producto', 'Instagram Feed', 'Post con imagen', 'generar_deseo', 'product', 'medio'],
  ['ASSET_PROMPT_VARIATIONS', 'Variaciones visuales', 'Instagram Feed', 'Carrusel', 'generar_deseo', 'prompt', 'medio'],
  ['ASSET_SCENE_REFERENCE', 'Referencia de escena', 'Instagram Feed', 'Post con imagen', 'generar_deseo', 'scene', 'medio'],
  ['ASSET_TESTIMONIAL_GRAPHIC', 'Gráfico testimonial', 'Instagram Feed', 'Publicación de prueba social', 'construir_confianza', 'product', 'medio'],
  ['ASSET_COMPARISON_TABLE', 'Tabla comparativa', 'Instagram Feed', 'Comparativa', 'convertir', 'product', 'medio'],
];

function blueprintFromSpec(spec: BlueprintSpec): TaskBlueprint {
  const [id, name, platform, contentType, funnelRole, defaultModule, estimatedEffort] = spec;
  const isManual = defaultModule === 'none';
  const isSocialProof = /SOCIAL_PROOF|TESTIMONIAL/.test(id);
  const promptPolicy = isManual
    ? (/STORY_DM_QUALIFIER|STORY_CREDITS_QUESTION/.test(id) ? 'none' : 'optional_support')
    : (isSocialProof ? 'optional_primary' : 'required_primary');
  return {
    id,
    name,
    platform,
    contentType,
    funnelRole,
    defaultModule,
    allowedModules: isManual ? ['none'] : [defaultModule],
    defaultSupportModule: isManual ? 'product' : undefined,
    allowedSupportModules: isManual ? ['product', 'ugc', 'scene', 'prompt'] : [],
    ctaTargets: CTA_BY_PLATFORM[platform],
    estimatedEffort,
    taskPriority: funnelRole === 'convertir' ? 'primary' : estimatedEffort === 'bajo' ? 'support' : 'primary',
    promptPolicy,
    requiresPrompt: promptPolicy === 'required_primary',
    allowsSupportPrompt: isManual,
    requiredSlots: isSocialProof ? ['@testimonio1'] : !isManual ? ['@producto1'] : [],
    forbiddenTerms: PLATFORM_FORBIDDEN[platform],
    requiredTerms: platform === 'Stories' ? ['story'] : platform === 'WhatsApp' ? ['mensaje'] : [],
    businessArchetypes: ALL_ARCHETYPES,
    campaignAngles: ALL_ANGLES,
    objectiveTags: [funnelRole, contentType.toLowerCase(), platform.toLowerCase()],
    outputContract: {
      mustUsePlatformLanguage: true,
      mustHaveActionableHook: true,
      mustNotMentionOtherPlatforms: true,
      mustRespectModuleRules: true,
      mustRespectCTA: true,
    },
  };
}

export const TASK_BLUEPRINTS: TaskBlueprint[] = SPECS.map(blueprintFromSpec);

export function getBlueprintById(id: string): TaskBlueprint | undefined {
  return TASK_BLUEPRINTS.find(blueprint => blueprint.id === id);
}

export function compatibleBlueprints(params: {
  platform?: Channel;
  funnelRole?: FunnelRole;
  archetype?: BusinessArchetype;
  campaignAngle?: CampaignAngle;
}): TaskBlueprint[] {
  return TASK_BLUEPRINTS.filter(blueprint =>
    (!params.platform || blueprint.platform === params.platform)
    && (!params.funnelRole || blueprint.funnelRole === params.funnelRole)
    && (!params.archetype || blueprint.businessArchetypes.includes(params.archetype))
    && (!params.campaignAngle || blueprint.campaignAngles.includes(params.campaignAngle)),
  );
}
