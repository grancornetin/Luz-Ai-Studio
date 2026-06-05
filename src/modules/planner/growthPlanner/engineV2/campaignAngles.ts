import type { CampaignAngle, CampaignAngleSelection, PlannerEngineV2Input, PreviousPlanMemory, BusinessArchetype } from './types';

const anglePools: Partial<Record<BusinessArchetype, CampaignAngle[]>> = {
  saas_subscription: ['comparacion_planes', 'decision_plan_correcto', 'educacion_creditos', 'objeciones_compra', 'prueba_social'],
  stock_clearance: ['stock_limitado', 'decision_plan_correcto', 'producto_en_uso'],
  prelaunch: ['lanzamiento_producto', 'comunidad', 'autoridad'],
  physical_product: ['producto_en_uso', 'antes_despues', 'dolor_visual', 'prueba_social'],
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
  const pool = [...(anglePools[archetype] || fallback)];
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
