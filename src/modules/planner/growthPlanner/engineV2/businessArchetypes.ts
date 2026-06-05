import type { ArchetypeDetection, BusinessArchetype, PlannerEngineV2Input, SalesAggressiveness } from './types';

const ARCHETYPE_KEYWORDS: Array<[BusinessArchetype, string[]]> = [
  ['stock_clearance', ['liquidacion', 'liquidación', 'ultimas unidades', 'últimas unidades', 'stock limitado', 'remate']],
  ['prelaunch', ['preventa', 'lista de espera', 'proximo lanzamiento', 'próximo lanzamiento', 'pre lanzamiento']],
  ['saas_subscription', ['software', 'saas', 'app', 'suscripcion', 'suscripción', 'creditos', 'créditos', 'plan mensual']],
  ['course_education', ['curso', 'academia', 'clases', 'programa educativo', 'formacion', 'formación']],
  ['digital_product', ['ebook', 'plantilla', 'descargable', 'producto digital', 'guia digital', 'guía digital']],
  ['food_business', ['restaurante', 'comida', 'reposteria', 'repostería', 'cafeteria', 'cafetería', 'pasteleria', 'pastelería']],
  ['event_experience', ['boda', 'evento', 'cabina', 'experiencia', 'celebracion', 'celebración']],
  ['local_service', ['peluqueria', 'peluquería', 'uñas', 'estetica', 'estética', 'fotografia', 'fotografía', 'salon', 'salón']],
  ['professional_service', ['asesoria', 'asesoría', 'marketing', 'contabilidad', 'diseño', 'consultoria', 'consultoría']],
  ['personal_brand', ['marca personal', 'creador', 'creadora', 'influencer', 'coach']],
  ['marketplace_catalog', ['marketplace', 'catalogo', 'catálogo', 'muchos productos', 'tienda multimarca']],
  ['physical_product', ['ropa', 'joya', 'joyas', 'cosmetico', 'cosmético', 'decoracion', 'decoración', 'producto fisico', 'producto físico']],
];

function inputText(input: PlannerEngineV2Input): string {
  return [
    input.brand.category,
    input.brand.idealClient,
    input.businessStage,
    input.mainGoal,
    input.commercialFocus,
    ...input.products.flatMap(product => [
      product.name,
      product.category,
      product.description,
      product.benefit,
      product.messageKey || '',
      ...(product.useCases || []),
    ]),
  ].join(' ').toLowerCase();
}

export function detectBusinessArchetype(input: PlannerEngineV2Input): ArchetypeDetection {
  const text = inputText(input);
  const scores = ARCHETYPE_KEYWORDS.map(([archetype, keywords]) => ({
    archetype,
    score: keywords.filter(keyword => text.includes(keyword)).length,
  })).sort((a, b) => b.score - a.score);
  const winner = scores[0];

  if (!winner || winner.score === 0) {
    return {
      businessArchetype: 'other',
      confidence: 'low',
      warnings: ['No hubo suficiente información para detectar el arquetipo; se usará configuración genérica.'],
    };
  }

  return {
    businessArchetype: winner.archetype,
    confidence: winner.score >= 3 ? 'high' : 'medium',
    warnings: [],
  };
}

export function selectSalesAggressiveness(input: PlannerEngineV2Input, archetype: BusinessArchetype): SalesAggressiveness {
  const text = inputText(input);
  if (archetype === 'stock_clearance' || /liquidacion|últimas unidades|stock limitado|cierre/.test(text)) return 'direct';
  if (/desde cero|confianza baja|consultiva|asesoria|asesoría/.test(text)) return 'soft';
  return 'balanced';
}
