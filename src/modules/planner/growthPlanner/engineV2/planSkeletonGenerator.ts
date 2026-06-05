import { v4 as uuidv4 } from 'uuid';
import { selectBlueprintsForPlan } from './blueprintSelector';
import type {
  BusinessArchetype,
  CampaignAngleSelection,
  Channel,
  FunnelRole,
  PlannerEngineV2Input,
  PreviousPlanMemory,
  SkeletonResult,
} from './types';

const MIN_TASKS = { 7: 5, 14: 12, 30: 25 } as const;
const CHANNEL_PATTERN: Channel[] = [
  'Instagram Feed', 'Stories', 'Instagram Feed', 'Facebook', 'Instagram Feed', 'Stories',
  'TikTok', 'Instagram Feed', 'Stories', 'Facebook', 'Instagram Feed', 'WhatsApp',
];

function addDays(date: Date, amount: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

export function dayLabelFromDate(date: string): string {
  const parsed = new Date(`${date}T12:00:00`);
  return new Intl.DateTimeFormat('es-CL', { weekday: 'short', day: 'numeric', month: 'short' })
    .format(parsed)
    .replace(/\./g, '');
}

function funnelRoleFor(index: number, total: number): FunnelRole {
  const ratio = index / total;
  if (ratio < 0.25) return 'atraer';
  if (ratio < 0.5) return 'generar_deseo';
  if (ratio < 0.75) return 'construir_confianza';
  return 'convertir';
}

function weekFor(index: number, total: number): number {
  return Math.min(4, Math.floor(index * 4 / total) + 1);
}

function activeChannels(input: PlannerEngineV2Input): Channel[] {
  const active: Channel[] = input.brand.activeSocials.length ? input.brand.activeSocials : ['Instagram Feed'];
  return Array.from(new Set(active));
}

function channelSlots(input: PlannerEngineV2Input, total: number): Array<{ platform: Channel; funnelRole: FunnelRole }> {
  const active = activeChannels(input);
  const preferred = CHANNEL_PATTERN.filter(channel => active.includes(channel));
  const pattern = preferred.length ? preferred : active;
  return Array.from({ length: total }, (_, index) => ({
    platform: pattern[index % pattern.length],
    funnelRole: funnelRoleFor(index, total),
  }));
}

export function generatePlanSkeleton(
  input: PlannerEngineV2Input,
  businessArchetype: BusinessArchetype,
  campaign: CampaignAngleSelection,
  previousPlans: PreviousPlanMemory[],
): SkeletonResult {
  const total = MIN_TASKS[input.duration];
  const slots = channelSlots(input, total);
  const selection = selectBlueprintsForPlan({
    slots,
    campaignAngle: campaign.campaignAngle,
    businessArchetype,
    previousPlans,
    creativeSeed: campaign.creativeSeed,
  });
  const start = new Date();
  start.setHours(12, 0, 0, 0);
  const tasks = selection.blueprints.map((blueprint, index) => {
    const dayOffset = Math.round(index * Math.max(input.duration - 1, 1) / Math.max(total - 1, 1));
    const date = addDays(start, dayOffset).toISOString().slice(0, 10);
    const product = input.products[index % Math.max(input.products.length, 1)];
    return {
      id: uuidv4(),
      week: weekFor(index, total),
      date,
      dayLabel: dayLabelFromDate(date),
      blueprintId: blueprint.id,
      campaignAngle: campaign.campaignAngle,
      platform: blueprint.platform,
      contentType: blueprint.contentType,
      funnelRole: blueprint.funnelRole,
      module: blueprint.defaultModule,
      supportModule: blueprint.defaultSupportModule,
      ctaTarget: blueprint.ctaTargets[index % blueprint.ctaTargets.length],
      estimatedEffort: blueprint.estimatedEffort,
      taskPriority: index / total < 0.7 ? 'primary' as const : 'support' as const,
      productId: product?.id,
      variationReason: `Blueprint ${blueprint.id} seleccionado para ${campaign.campaignAngle}, semana ${weekFor(index, total)} y canal ${blueprint.platform}.`,
    };
  });

  if (input.duration === 30) {
    const targetLow = Math.ceil(total * 0.35);
    const targetMedium = Math.ceil(total * 0.35);
    const maxHigh = Math.floor(total * 0.3);
    tasks.forEach((task, index) => {
      if (index < targetLow) task.estimatedEffort = 'bajo';
      else if (index < targetLow + targetMedium) task.estimatedEffort = 'medio';
      else task.estimatedEffort = index - targetLow - targetMedium < maxHigh ? 'alto' : 'medio';
    });
    for (let index = 2; index < tasks.length; index++) {
      if (tasks[index].estimatedEffort === 'alto' && tasks[index - 1].estimatedEffort === 'alto' && tasks[index - 2].estimatedEffort === 'alto') {
        tasks[index].estimatedEffort = 'medio';
      }
    }
  }

  return {
    tasks,
    roadmap: ([
      { week: 1, title: 'Atracción y diagnóstico', objective: 'Hacer visible el problema o necesidad.', funnelRole: 'atraer', hint: 'Problemas reconocibles y preguntas simples.' },
      { week: 2, title: 'Deseo y demostración', objective: 'Mostrar producto, servicio o resultado en uso.', funnelRole: 'generar_deseo', hint: 'Demostraciones y casos de uso.' },
      { week: 3, title: 'Confianza y objeciones', objective: 'Responder dudas con prueba y explicación.', funnelRole: 'construir_confianza', hint: 'Prueba social, FAQ y comparaciones.' },
      { week: 4, title: 'Conversión y decisión', objective: 'Facilitar una decisión y abrir conversación comercial.', funnelRole: 'convertir', hint: 'Recomendaciones, cierres y CTAs claros.' },
    ] satisfies SkeletonResult['roadmap']).slice(0, input.duration === 7 ? 1 : input.duration === 14 ? 2 : 4),
    blueprintsUsed: selection.blueprintsUsed,
    variationDecisions: selection.variationDecisions,
    noveltyScore: selection.noveltyScore,
  };
}
