import type { BusinessArchetype, CampaignAngle, NicheAdapter, PlannerEngineV2Input } from './types';

const SAAS_BLUEPRINTS = [
  'IG_REEL_SCREEN_DEMO', 'IG_POST_CREDITS_EXPLAINER', 'IG_CAROUSEL_PLAN_COMPARISON',
  'IG_POST_STARTER_VS_PRO', 'IG_CAROUSEL_CREDITS_EXPLAINER', 'STORY_CREDITS_QUESTION',
  'STORY_CREDITS_EXPLAINER', 'FB_PLAN_COMPARISON', 'FB_PLAN_RECOMMENDATION',
  'TIKTOK_PLAN_PICKER', 'WHATSAPP_PLAN_RECOMMENDATION', 'ASSET_PROMPT_VARIATIONS',
];

const PRODUCT_BLUEPRINTS = [
  'IG_REEL_BEFORE_AFTER', 'IG_POST_EDUCATIONAL_PAIN', 'IG_CAROUSEL_COMMON_ERRORS',
  'IG_REEL_MYTH_VS_REALITY', 'STORY_POLL_PAIN_POINT', 'STORY_QUICK_DIAGNOSIS',
  'FB_QA_POST', 'TIKTOK_PROBLEM_REVEAL', 'WHATSAPP_REENGAGEMENT_QUESTION', 'IG_POST_SCENE_EXAMPLE',
  'IG_CAROUSEL_BENEFITS', 'IG_REEL_PRODUCT_IN_USE', 'IG_POST_PRODUCT_SPOTLIGHT',
  'STORY_DEMO_QUICK', 'STORY_THIS_OR_THAT', 'TIKTOK_FAST_DEMO', 'WHATSAPP_USE_CASE_MESSAGE',
  'IG_POST_SOCIAL_PROOF', 'IG_CAROUSEL_OBJECTION_RESPONSE', 'IG_REEL_PROCESS_BEHIND',
  'STORY_QA_OBJECTIONS', 'STORY_FAQ_SEQUENCE', 'FB_OBJECTION_POST', 'FB_SOCIAL_PROOF',
  'TIKTOK_TESTIMONIAL_STYLE', 'WHATSAPP_FAQ_REPLY', 'IG_REEL_FINAL_CTA', 'IG_POST_DECISION_GUIDE',
  'STORY_DM_QUALIFIER', 'STORY_COUNTDOWN_OR_REMINDER', 'FB_DIRECT_OFFER_POST',
  'FB_OBJECTION_CLOSE_POST', 'WHATSAPP_CLOSE_CONVERSATION', 'ASSET_PRODUCT_PHOTO_BASE',
  'ASSET_SCENE_REFERENCE', 'ASSET_TESTIMONIAL_GRAPHIC', 'ASSET_COMPARISON_TABLE',
];

const ALL_NON_SAAS_ANGLES: CampaignAngle[] = [
  'dolor_visual', 'ahorro_tiempo', 'prueba_social', 'objeciones_compra', 'lanzamiento_producto',
  'reactivacion_audiencia', 'producto_en_uso', 'antes_despues', 'autoridad', 'comunidad',
  'temporada', 'stock_limitado', 'estilo_diario', 'versatilidad_producto', 'regalo_detalle',
  'antes_despues_outfit', 'prueba_social_producto', 'guia_de_estilo', 'producto_destacado',
  'temporada_ocasion', 'comparativa_productos', 'confianza_compra', 'impulso_whatsapp',
];

const SAAS_ANGLES: CampaignAngle[] = [
  'comparacion_planes', 'decision_plan_correcto', 'educacion_creditos', 'objeciones_compra',
  'prueba_social', 'ahorro_tiempo',
];

const SAAS_VOCABULARY = [
  'creditos', 'créditos', 'plan starter', 'plan pro', 'plan explorer', 'plan studio',
  'suscripcion', 'suscripción', 'saas', 'app', 'pantalla', 'software', 'demo de app',
  'mrr', 'onboarding', 'generacion de imagenes', 'generación de imágenes', 'prompts',
  'revisa los planes', 'ritmo de publicación', '200 créditos', '500 créditos', '1200 créditos',
];

function adapter(params: Partial<NicheAdapter> & Pick<NicheAdapter, 'id' | 'archetypes'>): NicheAdapter {
  return {
    keywords: [], examples: [], typicalObjections: [], usefulProof: [], visualStyle: [], suggestedAssets: [],
    allowedBlueprints: PRODUCT_BLUEPRINTS, forbiddenBlueprints: SAAS_BLUEPRINTS,
    allowedCampaignAngles: ALL_NON_SAAS_ANGLES, forbiddenCampaignAngles: SAAS_ANGLES,
    allowedVocabulary: [], forbiddenVocabulary: SAAS_VOCABULARY,
    slotRegistry: ['@producto1', '@producto2', '@producto3', '@modelo1', '@look1', '@escena1', '@testimonio1', '@packaging1', '@detalle1', '@outfit1'],
    ctaRules: ['Usar CTA compatible con el producto y el canal.'],
    formatRules: ['No mezclar instrucciones de video con posts de imagen.'],
    moduleRules: ['Usar product, ugc, scene o none segun la accion principal.'],
    captionRules: ['El caption debe estar listo para publicar y no explicar la estrategia interna.'],
    weakPhraseRules: ['Evitar promesas infladas y reemplazos mecanicos.'],
    ...params,
  };
}

export const businessAdapters: Record<string, NicheAdapter> = {
  saas_subscription: adapter({
    id: 'saas_adapter', archetypes: ['saas_subscription'],
    allowedBlueprints: [...PRODUCT_BLUEPRINTS, ...SAAS_BLUEPRINTS],
    forbiddenBlueprints: [], allowedCampaignAngles: SAAS_ANGLES, forbiddenCampaignAngles: [],
    forbiddenVocabulary: [], slotRegistry: ['@plan1', '@plan2', '@plan3', '@plan4', '@app_screen1', '@resultado1', '@comparativa1', '@testimonio1', '@logo1'],
    examples: ['demo de producto', 'comparacion de planes'], typicalObjections: ['creditos', 'tiempo', 'suscripcion'],
  }),
  fashion_accessories: adapter({
    id: 'fashion_accessories_adapter', archetypes: ['fashion_accessories'],
    keywords: ['accesorio', 'aros', 'joyeria', 'bisuteria', 'collar', 'pulsera'],
    examples: ['producto en uso', 'combinacion con outfit', 'detalle del material'],
    typicalObjections: ['material', 'tamano', 'disponibilidad'], usefulProof: ['detalle real', 'foto en uso'],
    visualStyle: ['macro', 'luz suave', 'outfit'], suggestedAssets: ['detalle', 'modelo', 'packaging'],
    ctaRules: ['Usar nombre del producto como palabra clave; nunca STARTER, PRO, PLAN o CREDITOS.'],
    moduleRules: ['product para catalogo, ugc para try-on, scene para lifestyle y none para interacciones nativas.'],
    weakPhraseRules: ['Permitir brillo sutil; prohibir haz brillar tu negocio.'],
  }),
  fashion_clothing: adapter({ id: 'fashion_clothing_adapter', archetypes: ['fashion_clothing'], keywords: ['ropa', 'moda', 'vestuario', 'outfit'] }),
  beauty_cosmetics: adapter({ id: 'beauty_cosmetics_adapter', archetypes: ['beauty_cosmetics'], keywords: ['belleza', 'cosmetica', 'skincare'] }),
  food_beverage: adapter({ id: 'food_beverage_adapter', archetypes: ['food_beverage', 'food_business'], keywords: ['comida', 'bebida', 'cafeteria'] }),
  service_business: adapter({ id: 'service_business_adapter', archetypes: ['service_business', 'local_service', 'professional_service'], keywords: ['servicio', 'agenda', 'reserva'] }),
  ecommerce_product: adapter({ id: 'ecommerce_product_adapter', archetypes: ['ecommerce_product', 'physical_product', 'marketplace_catalog', 'handmade_crafts', 'local_retail'] }),
  digital_product: adapter({ id: 'digital_product_adapter', archetypes: ['digital_product', 'education_course', 'course_education'] }),
  events_experiences: adapter({ id: 'events_experiences_adapter', archetypes: ['events_experiences', 'event_experience'] }),
  generic_business: adapter({ id: 'generic_business_adapter', archetypes: ['generic_business', 'other', 'personal_brand', 'prelaunch', 'stock_clearance'] }),
};

export function getBusinessAdapter(archetype: BusinessArchetype): NicheAdapter {
  return Object.values(businessAdapters).find(item => item.archetypes.includes(archetype))
    || businessAdapters.generic_business;
}

export function isBlueprintAllowedForAdapter(blueprintId: string, adapterValue: NicheAdapter): boolean {
  return adapterValue.allowedBlueprints.includes(blueprintId) && !adapterValue.forbiddenBlueprints.includes(blueprintId);
}

export function adapterAllowsCampaignAngle(angle: CampaignAngle, adapterValue: NicheAdapter): boolean {
  return adapterValue.allowedCampaignAngles.includes(angle) && !adapterValue.forbiddenCampaignAngles.includes(angle);
}

export function validateAdapterVocabulary(text: string, adapterValue: NicheAdapter): string[] {
  const lower = text.toLowerCase();
  return adapterValue.forbiddenVocabulary.filter(term => {
    const escaped = term.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}([^\\p{L}\\p{N}]|$)`, 'iu').test(lower);
  });
}

export function buildIsolatedPlannerContext(input: PlannerEngineV2Input, archetype: BusinessArchetype) {
  const activeAdapter = getBusinessAdapter(archetype);
  return { input, businessArchetype: archetype, adapter: activeAdapter, brandId: `${input.brand.name.trim().toLowerCase().replace(/\s+/g, '_')}::${archetype}` };
}
