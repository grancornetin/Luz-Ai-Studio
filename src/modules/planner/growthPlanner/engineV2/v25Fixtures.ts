import { detectBusinessArchetype } from './businessArchetypes';
import { getBusinessAdapter } from './businessAdapters';
import type { BusinessArchetype, PlannerEngineV2Input } from './types';

function fixture(category: string, products: Array<{ name: string; category: string; price?: string; stock?: string }>, mainGoal: string): PlannerEngineV2Input {
  return {
    duration: 30,
    brand: {
      name: category === 'Accesorios' ? 'CIGNIA' : `Fixture ${category}`,
      category,
      idealClient: 'Personas interesadas en la oferta',
      tone: 'claro',
      mainSalesChannel: 'Instagram y WhatsApp',
      activeSocials: ['Instagram Feed', 'Stories', 'WhatsApp'],
    },
    products: products.map((product, index) => ({
      id: String(index + 1),
      name: product.name,
      category: product.category,
      description: product.name,
      price: product.price || '',
      stock: product.stock || '',
      benefit: 'Beneficio concreto',
    })),
    instagramMetrics: { followers: '', reachDiagnosis: '', reelsInsight: '', carouselInsight: '', bestTime: '' },
    businessStage: 'En venta',
    mainGoal,
    commercialFocus: products.map(product => product.name).join(', '),
  };
}

export const V25_ARCHETYPE_FIXTURES: Array<{ name: string; input: PlannerEngineV2Input; expected: BusinessArchetype; adapterId: string }> = [
  {
    name: 'CIGNIA accesorios',
    input: fixture('Accesorios', [
      { name: 'Aros Aurora', category: 'Aros', price: '$3.990', stock: '12' },
      { name: 'Aros Roma', category: 'Aros', price: '$4.990', stock: '8' },
      { name: 'Aros Boke', category: 'Aros', price: '$3.990', stock: '10' },
    ], 'Aumentar visibilidad y ventas de productos prioritarios'),
    expected: 'fashion_accessories',
    adapterId: 'fashion_accessories_adapter',
  },
  {
    name: 'Luz IA Studio SaaS',
    input: fixture('Software SaaS', [
      { name: 'Plan Explorer', category: 'Suscripcion con creditos' },
      { name: 'Plan Starter', category: 'Plan mensual de software' },
      { name: 'Plan Pro', category: 'Suscripcion de app' },
    ], 'Aumentar suscripciones de la plataforma'),
    expected: 'saas_subscription',
    adapterId: 'saas_adapter',
  },
  { name: 'Comida', input: fixture('Comida y bebidas', [{ name: 'Menu almuerzo', category: 'Comida', price: '$9.990', stock: '20' }], 'Aumentar pedidos'), expected: 'food_beverage', adapterId: 'food_beverage_adapter' },
  { name: 'Servicio local', input: fixture('Peluqueria', [{ name: 'Corte y peinado', category: 'Servicio local' }], 'Aumentar reservas'), expected: 'service_business', adapterId: 'service_business_adapter' },
  { name: 'Ropa', input: fixture('Moda', [{ name: 'Vestido Roma', category: 'Ropa', price: '$29.990', stock: '6' }], 'Aumentar ventas'), expected: 'fashion_clothing', adapterId: 'fashion_clothing_adapter' },
];

export function validateV25ArchetypeFixtures(): string[] {
  return V25_ARCHETYPE_FIXTURES.flatMap(item => {
    const detected = detectBusinessArchetype(item.input).businessArchetype;
    const adapterId = getBusinessAdapter(detected).id;
    return detected === item.expected && adapterId === item.adapterId
      ? []
      : [`${item.name}: esperado ${item.expected}/${item.adapterId}, recibido ${detected}/${adapterId}`];
  });
}
