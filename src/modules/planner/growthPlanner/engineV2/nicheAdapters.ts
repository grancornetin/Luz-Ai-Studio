import type { BusinessArchetype, NicheAdapter, PlannerEngineV2Input } from './types';

const adapters: NicheAdapter[] = [
  { id: 'fashion_adapter', archetypes: ['physical_product'], keywords: ['ropa', 'moda', 'outfit'], examples: ['producto en uso', 'combinación simple'], typicalObjections: ['talla', 'calce'], usefulProof: ['detalle de tela', 'look real'], visualStyle: ['luz natural', 'detalle'], suggestedAssets: ['foto frontal', 'foto en uso'] },
  { id: 'beauty_adapter', archetypes: ['physical_product', 'local_service'], keywords: ['belleza', 'cosmetico', 'estetica'], examples: ['rutina breve', 'textura'], typicalObjections: ['resultado', 'uso'], usefulProof: ['demostración prudente'], visualStyle: ['limpio', 'cercano'], suggestedAssets: ['producto', 'proceso'] },
  { id: 'accessories_adapter', archetypes: ['physical_product'], keywords: ['joya', 'accesorio'], examples: ['detalle del brillo', 'outfit simple'], typicalObjections: ['material', 'tamaño'], usefulProof: ['detalle real'], visualStyle: ['luz suave', 'macro'], suggestedAssets: ['detalle', 'foto en uso'] },
  { id: 'food_adapter', archetypes: ['food_business'], keywords: ['comida', 'cafeteria', 'reposteria'], examples: ['textura', 'empaque'], typicalObjections: ['frescura', 'entrega'], usefulProof: ['preparación', 'cliente real'], visualStyle: ['cálido', 'apetecible'], suggestedAssets: ['plato', 'empaque'] },
  { id: 'decor_adapter', archetypes: ['physical_product'], keywords: ['decoracion', 'hogar'], examples: ['antes y después del espacio'], typicalObjections: ['medidas', 'combinación'], usefulProof: ['ambiente real'], visualStyle: ['ordenado', 'luz natural'], suggestedAssets: ['producto', 'espacio'] },
  { id: 'local_service_adapter', archetypes: ['local_service'], keywords: ['servicio local'], examples: ['proceso', 'agenda'], typicalObjections: ['tiempo', 'ubicación'], usefulProof: ['reseña', 'resultado prudente'], visualStyle: ['cercano', 'real'], suggestedAssets: ['espacio', 'proceso'] },
  { id: 'professional_service_adapter', archetypes: ['professional_service'], keywords: ['asesoria', 'consultoria'], examples: ['diagnóstico breve', 'caso de uso'], typicalObjections: ['precio', 'confianza'], usefulProof: ['caso', 'metodología'], visualStyle: ['claro', 'sobrio'], suggestedAssets: ['captura', 'testimonio'] },
  { id: 'saas_adapter', archetypes: ['saas_subscription'], keywords: ['software', 'app', 'creditos'], examples: ['pantalla del resultado', 'ahorro de tiempo'], typicalObjections: ['créditos', 'prompts', 'tiempo'], usefulProof: ['demo', 'comparación de planes'], visualStyle: ['producto visible', 'captura clara'], suggestedAssets: ['captura', 'resultado'] },
  { id: 'course_adapter', archetypes: ['course_education', 'digital_product'], keywords: ['curso', 'ebook'], examples: ['lección', 'resultado de aprendizaje'], typicalObjections: ['dificultad', 'tiempo'], usefulProof: ['temario', 'testimonio'], visualStyle: ['educativo', 'ordenado'], suggestedAssets: ['temario', 'captura'] },
  { id: 'event_adapter', archetypes: ['event_experience'], keywords: ['evento', 'boda'], examples: ['momento de experiencia'], typicalObjections: ['disponibilidad', 'logística'], usefulProof: ['evento real'], visualStyle: ['emocional', 'real'], suggestedAssets: ['evento', 'montaje'] },
  { id: 'personal_brand_adapter', archetypes: ['personal_brand'], keywords: ['marca personal'], examples: ['opinión concreta', 'proceso'], typicalObjections: ['autoridad', 'confianza'], usefulProof: ['experiencia', 'caso'], visualStyle: ['humano', 'directo'], suggestedAssets: ['retrato', 'proceso'] },
  { id: 'marketplace_adapter', archetypes: ['marketplace_catalog'], keywords: ['catalogo', 'marketplace'], examples: ['selección por necesidad'], typicalObjections: ['elección', 'variedad'], usefulProof: ['comparativa'], visualStyle: ['catalogado', 'claro'], suggestedAssets: ['productos destacados'] },
  { id: 'generic_adapter', archetypes: ['other', 'prelaunch', 'stock_clearance'], keywords: [], examples: ['caso de uso concreto'], typicalObjections: ['precio', 'confianza'], usefulProof: ['demostración'], visualStyle: ['claro', 'real'], suggestedAssets: ['producto o servicio'] },
];

export function selectNicheAdapter(input: PlannerEngineV2Input, archetype: BusinessArchetype): NicheAdapter {
  const text = `${input.brand.category} ${input.commercialFocus}`.toLowerCase();
  return adapters.find(adapter => adapter.archetypes.includes(archetype) && adapter.keywords.some(keyword => text.includes(keyword)))
    || adapters.find(adapter => adapter.archetypes.includes(archetype))
    || adapters[adapters.length - 1];
}
