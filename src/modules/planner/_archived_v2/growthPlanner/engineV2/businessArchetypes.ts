import type { ArchetypeDetection, BusinessArchetype, PlannerEngineV2Input, SalesAggressiveness } from './types';

function normalize(value: string): string {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function inputText(input: PlannerEngineV2Input): string {
  return normalize([
    input.brand.category, input.brand.idealClient, input.brand.mainSalesChannel,
    input.businessStage, input.mainGoal, input.commercialFocus,
    ...input.products.flatMap(product => [
      product.name, product.category, product.description, product.benefit, product.price, product.stock,
      product.messageKey || '', ...(product.useCases || []),
    ]),
  ].join(' '));
}

function has(text: string, pattern: RegExp): boolean {
  return pattern.test(text);
}

export function detectBusinessArchetype(input: PlannerEngineV2Input): ArchetypeDetection {
  const text = inputText(input);
  const productsText = normalize(input.products.flatMap(product => [product.name, product.category, product.description]).join(' '));
  const hasPhysicalSignals = input.products.some(product => Boolean(product.price.trim() || product.stock.trim()))
    || has(text, /\bstock\b|precio|unidad|envio|despacho/);
  const productsArePlans = input.products.length > 0
    && input.products.filter(product => has(normalize(`${product.name} ${product.category} ${product.description} ${product.credits || ''}`), /\bplan\b|suscrip|creditos|mensual|semanal/)).length >= Math.ceil(input.products.length / 2);
  const strongSaasEvidence = productsArePlans
    && has(text, /\bsaas\b|software|plataforma|suscrip|creditos|plan mensual|app\b/);

  const rules: Array<[BusinessArchetype, RegExp]> = [
    ['fashion_accessories', /accesor|aros?\b|joyeria|bisuteria|collares?|pulseras?|anillos?|pendientes?/],
    ['fashion_clothing', /\bropa\b|moda|vestuario|poleras?|vestidos?|pantalones?|chaquetas?|outfit/],
    ['beauty_cosmetics', /belleza|cosmetic|maquillaje|skincare|cuidado de la piel/],
    ['food_beverage', /comida|bebida|restaurante|reposteria|cafeteria|pasteleria|panaderia/],
    ['handmade_crafts', /artesania|hecho a mano|manualidades|handmade/],
    ['education_course', /curso|academia|clases|programa educativo|formacion/],
    ['digital_product', /ebook|plantilla|descargable|producto digital|guia digital/],
    ['events_experiences', /boda|evento|experiencia|celebracion/],
    ['service_business', /servicio|peluqueria|estetica|fotografia|asesoria|consultoria|agenda|reserva/],
    ['local_retail', /tienda local|local comercial|retiro en tienda/],
  ];
  const specific = rules.find(([, pattern]) => has(text, pattern));
  if (specific) return { businessArchetype: specific[0], confidence: 'high', warnings: [] };
  if (strongSaasEvidence && !hasPhysicalSignals) return { businessArchetype: 'saas_subscription', confidence: 'high', warnings: [] };
  if (hasPhysicalSignals || productsText.trim()) return { businessArchetype: 'ecommerce_product', confidence: hasPhysicalSignals ? 'high' : 'medium', warnings: [] };
  return {
    businessArchetype: 'generic_business',
    confidence: 'low',
    warnings: ['No hubo suficiente informacion para detectar un nicho especifico; se usara configuracion generica.'],
  };
}

export function selectSalesAggressiveness(input: PlannerEngineV2Input, archetype: BusinessArchetype): SalesAggressiveness {
  const text = inputText(input);
  if (archetype === 'stock_clearance' || /liquidacion|ultimas unidades|stock limitado|cierre/.test(text)) return 'direct';
  if (/desde cero|confianza baja|consultiva|asesoria/.test(text)) return 'soft';
  return 'balanced';
}
