import { adapterAllowsCampaignAngle, getBusinessAdapter } from './businessAdapters';
import type { CampaignAngle, CampaignAngleSelection, PlannerEngineV2Input, PreviousPlanMemory, BusinessArchetype } from './types';

const anglePools: Partial<Record<BusinessArchetype, CampaignAngle[]>> = {
  saas_subscription: ['comparacion_planes', 'decision_plan_correcto', 'educacion_creditos', 'objeciones_compra', 'prueba_social'],
  stock_clearance: ['stock_limitado', 'decision_plan_correcto', 'producto_en_uso'],
  prelaunch: ['lanzamiento_producto', 'comunidad', 'autoridad'],
  physical_product: ['producto_en_uso', 'antes_despues', 'dolor_visual', 'prueba_social'],
  ecommerce_product: ['producto_en_uso', 'producto_destacado', 'comparativa_productos', 'confianza_compra'],
  fashion_accessories: ['estilo_diario', 'versatilidad_producto', 'antes_despues_outfit', 'guia_de_estilo', 'producto_destacado', 'impulso_whatsapp'],
  fashion_clothing: ['estilo_diario', 'versatilidad_producto', 'guia_de_estilo', 'temporada_ocasion'],
  beauty_cosmetics: ['producto_en_uso', 'prueba_social_producto', 'confianza_compra'],
  food_beverage: ['producto_destacado', 'temporada_ocasion', 'prueba_social_producto'],
  service_business: ['prueba_social', 'autoridad', 'objeciones_compra', 'comunidad'],
  local_service: ['prueba_social', 'autoridad', 'objeciones_compra', 'comunidad'],
  professional_service: ['autoridad', 'objeciones_compra', 'prueba_social', 'ahorro_tiempo'],
};

function hash(value: string): number {
  return Array.from(value).reduce((total, char) => ((total * 31) + char.charCodeAt(0)) >>> 0, 7);
}

export function selectCampaignAngle(
  input: PlannerEngineV2Input,
  archetype: BusinessArchetype,
  previousPlans: PreviousPlanMemory[],
): CampaignAngleSelection {
  const fallback: CampaignAngle[] = ['dolor_visual', 'producto_en_uso', 'prueba_social', 'objeciones_compra', 'ahorro_tiempo'];
  const adapter = getBusinessAdapter(archetype);
  const pool = [...(anglePools[archetype] || fallback)].filter(angle => adapterAllowsCampaignAngle(angle, adapter));
  const lastAngle = previousPlans[0]?.previousCampaignAngles.at(-1);
  const candidates = pool.filter(angle => angle !== lastAngle);
  const source = candidates.length ? candidates : pool;
  const seedSource = `${input.brand.name}|${input.mainGoal}|${input.commercialFocus}|${Date.now()}`;
  const selected = source[hash(seedSource) % source.length];
  return {
    campaignAngle: selected,
    campaignAngleReason: `Ángulo elegido para ${archetype} según objetivo "${input.mainGoal}" y evitando repetir el último plan.`,
    creativeSeed: `${selected}-${hash(seedSource).toString(36)}`,
  };
}
