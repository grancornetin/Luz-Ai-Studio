import {
  GrowthBrand,
  GrowthInstagramMetrics,
  GrowthPlanDuration,
  GrowthProduct,
  GrowthStrategicPlan,
  GrowthTask,
} from './growthPlannerTypes';

interface GrowthMockPlanOptions {
  brand?: GrowthBrand;
  brandSourceLabel?: string;
}

export const GROWTH_DEMO_BRAND: GrowthBrand = {
  name: 'CIGNIA',
  category: 'Accesorios femeninos',
  idealClient: 'Mujeres jovenes que buscan accesorios delicados para verse arregladas sin complicarse.',
  tone: 'Cercano, elegante, simple',
  mainSalesChannel: 'Instagram DM y WhatsApp',
  activeSocials: ['Instagram Feed', 'Stories', 'TikTok', 'WhatsApp'],
};

export const GROWTH_DEMO_PRODUCTS: GrowthProduct[] = [
  {
    id: 'p1',
    name: 'Aros Aurora',
    category: 'Aros',
    description: 'Aros dorados minimalistas para uso diario.',
    price: '$4.990',
    stock: '12 unidades',
    benefit: 'Elevan un outfit simple sin esfuerzo.',
  },
  {
    id: 'p2',
    name: 'Aros Roma',
    category: 'Aros',
    description: 'Aros medianos con brillo suave y terminacion pulida.',
    price: '$5.990',
    stock: '8 unidades',
    benefit: 'Se ven elegantes en fotos y en reuniones.',
  },
  {
    id: 'p3',
    name: 'Collar Roma',
    category: 'Collares',
    description: 'Cadena fina con dije circular para layering.',
    price: '$6.500',
    stock: '6 unidades',
    benefit: 'Completa looks basicos con un punto de luz.',
  },
];

export const GROWTH_DEMO_METRICS: GrowthInstagramMetrics = {
  followers: '15.564',
  reachDiagnosis: 'El alcance esta bajo respecto a la base de seguidores.',
  reelsInsight: 'Los Reels aportan alcance nuevo y funcionan mejor con proceso o try-on.',
  carouselInsight: 'Los carruseles generan mas guardados e interaccion cuando resuelven dudas.',
  bestTime: 'Tarde, entre 19:00 y 21:00.',
};

const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];

function isoDateFromOffset(offset: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toISOString().split('T')[0];
}

function dayLabelFromOffset(offset: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return `${dayNames[date.getDay()]} ${date.getDate()}`;
}

const taskTemplates: Array<Omit<GrowthTask, 'id' | 'week' | 'dayLabel' | 'date' | 'status'>> = [
  {
    platform: 'Instagram Feed',
    contentType: 'Carrusel de confianza',
    funnelRole: 'construir_confianza',
    module: 'prompt',
    moduleReason: 'Prompt Studio permite crear una pieza educativa visual sin depender de nuevas fotos.',
    suggestedTime: '19:30',
    visualConcept: 'Carrusel limpio con 5 dudas frecuentes sobre accesorios dorados y respuestas simples.',
    whyItWorks: 'Resuelve objeciones antes de vender y aumenta guardados.',
    caption: 'Antes de comprar accesorios dorados, casi todas preguntan lo mismo: si se ponen negros, si pesan y si combinan con todo. Guarda esta mini guia para elegir mejor.',
    hashtags: '#accesorios #joyeria #emprendimientochileno #arosdorados #modachile #looksdiarios #cignia #compralocal',
    prompt: 'Disena un carrusel 4:5 para Instagram sobre dudas frecuentes de @producto1, estilo editorial minimalista, fondo claro, acentos dorados, texto legible y composicion elegante.',
    slotInstructions: [{ slot: '@producto1', instruction: 'Sube una foto limpia de Aros Aurora o Aros Roma.' }],
    requiredAssets: ['Foto de producto', 'Lista de dudas frecuentes'],
    executionRecipe: {
      overview: 'Convierte dudas repetidas en una pieza guardable.',
      steps: [
        { id: 's1', title: 'Elegir duda principal', module: 'none', instruction: 'Anota 4 preguntas reales que te hacen por DM.', ctaLabel: 'Listo', status: 'pending' },
        { id: 's2', title: 'Crear carrusel', module: 'prompt', instruction: 'Usa el prompt con @producto1 y genera una base visual.', ctaLabel: 'Generar', status: 'pending' },
        { id: 's3', title: 'Publicar con CTA', module: 'none', instruction: 'Cierra con una pregunta para que respondan por comentarios.', ctaLabel: 'Publicar', status: 'pending' },
      ],
    },
    shotGuide: {
      duration: 'No aplica',
      shots: [],
      onScreenText: ['3 dudas antes de comprar aros dorados', 'Guarda esta guia'],
      inspirationSearches: ['minimal jewelry carousel instagram'],
      whatToAvoid: ['Textos largos', 'Fondos con poco contraste'],
    },
    engagementHook: 'Pregunta: cual de estas dudas tambien tenias?',
  },
  {
    platform: 'Stories',
    contentType: 'Encuesta de deseo',
    funnelRole: 'generar_deseo',
    module: 'none',
    moduleReason: 'La tarea se ejecuta directo en Instagram Stories, sin generacion IA.',
    suggestedTime: '20:00',
    visualConcept: 'Stories comparando Aros Aurora vs Collar Roma con encuesta simple.',
    whyItWorks: 'Activa respuestas rapidas y senales de interes para vender por DM.',
    caption: 'Hoy necesito tu voto: team aros delicados o collar finito?',
    hashtags: '',
    prompt: '',
    slotInstructions: [],
    requiredAssets: ['Foto Aros Aurora', 'Foto Collar Roma'],
    executionRecipe: {
      overview: 'Usa una decision facil para abrir conversaciones.',
      steps: [
        { id: 's1', title: 'Preparar dos fotos', module: 'none', instruction: 'Elige una foto clara de cada producto.', ctaLabel: 'Listo', status: 'pending' },
        { id: 's2', title: 'Subir encuesta', module: 'none', instruction: 'Publica encuesta con dos opciones: Aros / Collar.', ctaLabel: 'Subir', status: 'pending' },
        { id: 's3', title: 'Responder DMs', module: 'none', instruction: 'A quienes voten, responde con precio y stock.', ctaLabel: 'Responder', status: 'pending' },
      ],
    },
    shotGuide: {
      duration: '2 stories',
      shots: [
        { shot: 1, duration: 'Story 1', instruction: 'Foto Aros Aurora con sticker encuesta.' },
        { shot: 2, duration: 'Story 2', instruction: 'Foto Collar Roma con CTA a DM.' },
      ],
      onScreenText: ['Cual usarias hoy?', 'Te mando stock por DM'],
      inspirationSearches: ['instagram story poll jewelry'],
      whatToAvoid: ['Demasiado texto', 'Encuestas con mas de dos opciones'],
    },
    engagementHook: 'Responde manualmente a cada voto con una recomendacion concreta.',
  },
  {
    platform: 'TikTok',
    contentType: 'Reel try-on rapido',
    funnelRole: 'atraer',
    module: 'ugc',
    moduleReason: 'UGC Studio ayuda a simular uso real y reduce la distancia entre producto y compra.',
    suggestedTime: '18:45',
    visualConcept: 'Video corto mostrando como cambia un look simple al agregar los aros.',
    whyItWorks: 'Los Reels de transformacion tienen buena retencion y explican valor visualmente.',
    caption: 'El detalle que hace que un look basico se vea pensado. Te muestro mis favoritos de hoy.',
    hashtags: '#tryon #accesorios #tiktokchile #joyeria #outfitideas #aros #cignia',
    prompt: 'Crea una escena UGC vertical 9:16 con @producto1 usado por @persona1, estilo creadora latina, luz natural, look basico blanco, enfoque en transformacion sutil y elegante.',
    slotInstructions: [
      { slot: '@producto1', instruction: 'Sube foto frontal de los aros.' },
      { slot: '@persona1', instruction: 'Usa una persona/modelo con look neutro.' },
    ],
    requiredAssets: ['Foto producto', 'Referencia de persona o estilo'],
    executionRecipe: {
      overview: 'Muestra el beneficio en menos de 15 segundos.',
      steps: [
        { id: 's1', title: 'Preparar referencia', module: 'ugc', instruction: 'Carga @producto1 y una referencia de persona neutra.', ctaLabel: 'Cargar', status: 'pending' },
        { id: 's2', title: 'Generar visual', module: 'ugc', instruction: 'Usa el prompt vertical 9:16.', ctaLabel: 'Generar', status: 'pending' },
        { id: 's3', title: 'Editar texto', module: 'none', instruction: 'Agrega texto en pantalla y musica suave.', ctaLabel: 'Editar', status: 'pending' },
      ],
    },
    shotGuide: {
      duration: '12s',
      shots: [
        { shot: 1, duration: '3s', instruction: 'Look simple sin accesorio.' },
        { shot: 2, duration: '4s', instruction: 'Close-up colocando el aro.' },
        { shot: 3, duration: '5s', instruction: 'Resultado final con sonrisa y luz natural.' },
      ],
      onScreenText: ['De basico a arreglado', 'Un detalle cambia todo'],
      inspirationSearches: ['jewelry try on reel minimal'],
      whatToAvoid: ['Transiciones bruscas', 'Filtros que cambien color del producto'],
    },
    engagementHook: 'Pide que comenten "AURORA" si quieren precio y stock.',
  },
  {
    platform: 'Instagram Feed',
    contentType: 'Foto catalogo suave',
    funnelRole: 'convertir',
    module: 'product',
    moduleReason: 'Product Studio es la mejor opcion para una imagen comercial clara y vendible.',
    suggestedTime: '21:00',
    visualConcept: 'Foto de producto sobre tela clara, con sombra suave y detalle del brillo.',
    whyItWorks: 'Una foto limpia facilita que la clienta compare, pregunte y compre.',
    caption: 'Aros Aurora disponibles en pocas unidades. Delicados, livianos y faciles de combinar para todos los dias.',
    hashtags: '#aros #arosdorados #joyeriachile #accesoriosmujer #modaminimal #compralocal #cignia',
    prompt: 'Fotografia comercial 4:5 de @producto1 sobre tela blanca, luz natural lateral, sombra suave, estilo minimalista editorial, detalle del brillo dorado, fondo limpio.',
    slotInstructions: [{ slot: '@producto1', instruction: 'Sube la foto mas nitida del producto.' }],
    requiredAssets: ['Foto principal del producto'],
    executionRecipe: {
      overview: 'Crea una imagen de venta clara y directa.',
      steps: [
        { id: 's1', title: 'Elegir producto', module: 'product', instruction: 'Usa el producto con mejor stock.', ctaLabel: 'Listo', status: 'pending' },
        { id: 's2', title: 'Generar catalogo', module: 'product', instruction: 'Genera 2 variaciones con fondo claro.', ctaLabel: 'Generar', status: 'pending' },
        { id: 's3', title: 'Publicar', module: 'none', instruction: 'Incluye precio, stock y CTA a DM.', ctaLabel: 'Publicar', status: 'pending' },
      ],
    },
    shotGuide: {
      duration: 'No aplica',
      shots: [],
      onScreenText: ['Stock limitado', 'Pide por DM'],
      inspirationSearches: ['minimal jewelry product photography'],
      whatToAvoid: ['Fondos saturados', 'Manos tapando el producto'],
    },
    engagementHook: 'Cierra con: quieres que te mande foto puesta?',
  },
  {
    platform: 'Stories',
    contentType: 'Prueba social express',
    funnelRole: 'construir_confianza',
    module: 'scene',
    moduleReason: 'Scene Clone puede recrear un contexto de empaque o pedido para transmitir confianza.',
    suggestedTime: '19:00',
    visualConcept: 'Mesa de empaque con bolsita, tarjeta de gracias y producto listo para enviar.',
    whyItWorks: 'Humaniza el proceso y reduce miedo a comprar a una marca pequena.',
    caption: 'Preparando pedidos con mucho detalle. Si quieres el tuyo, escribeme y revisamos stock.',
    hashtags: '',
    prompt: 'Recrea una escena de empaque para @producto1 usando @escena1 como referencia, mesa clara, tarjeta de gracias, bolsa pequena, luz natural, estilo artesanal elegante.',
    slotInstructions: [
      { slot: '@producto1', instruction: 'Sube foto del producto que quieres vender.' },
      { slot: '@escena1', instruction: 'Sube una referencia de mesa o empaque.' },
    ],
    requiredAssets: ['Foto producto', 'Referencia de empaque'],
    executionRecipe: {
      overview: 'Muestra el cuidado detras del pedido.',
      steps: [
        { id: 's1', title: 'Buscar referencia', module: 'scene', instruction: 'Elige una escena de empaque simple.', ctaLabel: 'Listo', status: 'pending' },
        { id: 's2', title: 'Clonar escena', module: 'scene', instruction: 'Usa @producto1 y @escena1.', ctaLabel: 'Generar', status: 'pending' },
        { id: 's3', title: 'Subir Stories', module: 'none', instruction: 'Agrega sticker de preguntas.', ctaLabel: 'Subir', status: 'pending' },
      ],
    },
    shotGuide: {
      duration: '3 stories',
      shots: [
        { shot: 1, duration: 'Story 1', instruction: 'Mostrar empaque final.' },
        { shot: 2, duration: 'Story 2', instruction: 'Detalle del producto.' },
        { shot: 3, duration: 'Story 3', instruction: 'Sticker de preguntas.' },
      ],
      onScreenText: ['Asi preparo tu pedido', 'Quedan pocas unidades'],
      inspirationSearches: ['small business packing orders jewelry'],
      whatToAvoid: ['Desorden visual', 'Prometer despacho no confirmado'],
    },
    engagementHook: 'Usa sticker: quieres ver opciones disponibles?',
  },
  {
    platform: 'WhatsApp',
    contentType: 'Mensaje de cierre',
    funnelRole: 'convertir',
    module: 'none',
    moduleReason: 'La venta se cierra por mensaje directo; no requiere modulo IA.',
    suggestedTime: '12:30',
    visualConcept: 'Texto corto con foto del producto mas consultado y stock real.',
    whyItWorks: 'WhatsApp convierte mejor cuando el mensaje es directo y tiene baja friccion.',
    caption: 'Hola! Hoy tengo disponibles Aros Aurora y Collar Roma. Si quieres, te mando foto puesta, precio y opciones de retiro/envio.',
    hashtags: '',
    prompt: '',
    slotInstructions: [],
    requiredAssets: ['Foto producto', 'Precio actualizado', 'Stock real'],
    executionRecipe: {
      overview: 'Activa clientes tibios con un mensaje simple.',
      steps: [
        { id: 's1', title: 'Filtrar contactos', module: 'none', instruction: 'Elige personas que preguntaron antes o reaccionaron stories.', ctaLabel: 'Listo', status: 'pending' },
        { id: 's2', title: 'Enviar mensaje', module: 'none', instruction: 'Personaliza el primer nombre y ofrece ayuda concreta.', ctaLabel: 'Enviar', status: 'pending' },
      ],
    },
    shotGuide: {
      duration: 'No aplica',
      shots: [],
      onScreenText: [],
      inspirationSearches: [],
      whatToAvoid: ['Mensajes masivos frios', 'Presionar con urgencia falsa'],
    },
    engagementHook: 'Termina con una pregunta facil: quieres dorado o plateado?',
  },
];

function buildTasks(duration: GrowthPlanDuration): GrowthTask[] {
  const count = duration === 30 ? 12 : duration === 14 ? 6 : 4;
  const weeks = duration === 30 ? 4 : duration === 14 ? 2 : 1;
  return Array.from({ length: count }).map((_, index) => {
    const template = taskTemplates[index % taskTemplates.length];
    const offset = Math.max(1, Math.round((index * duration) / count) + 1);
    return {
      ...template,
      id: `growth_task_${index + 1}`,
      week: Math.min(weeks, Math.floor((index * weeks) / count) + 1),
      dayLabel: dayLabelFromOffset(offset),
      date: isoDateFromOffset(offset),
      status: 'pending',
    };
  });
}

export function generateGrowthPlannerMockPlan(
  duration: GrowthPlanDuration,
  options: GrowthMockPlanOptions = {},
): GrowthStrategicPlan {
  const tasks = buildTasks(duration);
  const weeks = duration === 30 ? 4 : duration === 14 ? 2 : 1;
  const brand = options.brand ?? GROWTH_DEMO_BRAND;
  const brandName = brand.name || GROWTH_DEMO_BRAND.name;
  const brandCategory = brand.category || GROWTH_DEMO_BRAND.category;
  const sourceLabel = options.brandSourceLabel ?? 'marca demo';

  return {
    id: `growth_mock_${Date.now()}`,
    createdAt: new Date().toISOString(),
    duration,
    brand,
    products: GROWTH_DEMO_PRODUCTS,
    instagramMetrics: GROWTH_DEMO_METRICS,
    businessStage: 'Ventas irregulares con audiencia existente.',
    mainGoal: 'Aumentar mensajes y ventas por DM sin perder tono elegante.',
    commercialFocus: 'Linea dorada basica',
    strategyGoal: 'Reactivar alcance y convertir interes en mensajes',
    businessDiagnosis: `${brandName} tiene una base de marca atractiva en ${brandCategory}, pero necesita transformar alcance disperso en conversaciones de compra con piezas mas claras y repetibles.`,
    nicheInsights: [
      'Los accesorios se venden mejor cuando se muestran en uso y no solo aislados.',
      'Las dudas sobre calidad y durabilidad deben aparecer antes del CTA de venta.',
      'Stories con encuesta pueden detectar intencion sin sonar insistentes.',
    ],
    planNarrative: `Durante ${duration} dias, el plan alterna atraccion, deseo, confianza y conversion para vender sin saturar a la audiencia.`,
    strategicTip: 'Usa cada publicacion como inicio de conversacion: CTA pequeno, respuesta manual y stock claro.',
    roadmap: Array.from({ length: weeks }).map((_, index) => ({
      week: index + 1,
      title: ['Descubrimiento', 'Deseo', 'Confianza', 'Conversion'][index] || 'Optimizar',
      objective: [
        'Recordar que la marca existe y mostrar productos clave.',
        'Mostrar uso real, beneficios y comparaciones faciles.',
        'Resolver dudas, mostrar empaque y reforzar confianza.',
        'Cerrar con mensajes directos, stock y urgencia honesta.',
      ][index] || 'Repetir formatos ganadores y medir respuestas.',
      funnelRole: (['atraer', 'generar_deseo', 'construir_confianza', 'convertir'][index] || 'atraer') as any,
      hint: 'Mantener una sola idea por pieza.',
    })),
    tasks,
    brandAnalysis: {
      stageInterpretation: `Marca tomada desde ${sourceLabel}; se mantiene el diagnostico mock de ventas irregulares.`,
      targetAnalysis: brand.idealClient || 'Clientas que buscan accesorios delicados, faciles de combinar y con confianza de compra.',
      voiceGuide: brand.tone || 'Cercana, elegante y concreta. Evitar presion excesiva o palabras como barato.',
    },
    productAnalysis: {
      productWarnings: ['Faltan fotos de producto en uso real para aumentar confianza.'],
      confidenceByProduct: GROWTH_DEMO_PRODUCTS.map(product => ({
        productId: product.id,
        level: product.id === 'p1' ? 92 : 84,
        reason: 'Producto coherente con la categoria y facil de vender visualmente.',
      })),
      categorizationSummary: 'Accesorios de uso diario con buena oportunidad para contenido try-on, catalogo y stories de decision.',
    },
    socialMetricsAnalysis: {
      audienceInsights: 'La cuenta tiene comunidad suficiente para activar conversion por Stories y DM.',
      engagementLevel: 'Medio: conviene priorizar interaccion simple y carruseles guardables.',
      confidenceMapping: 'Sin screenshots reales, el mock asume lectura general segun metricas demo.',
    },
    nicheResearch: {
      trends: ['Try-on de accesorios', 'Carruseles de dudas frecuentes', 'Empaque de pedidos'],
      competitorGaps: ['Pocas marcas explican calidad y cuidado antes de vender.', 'Muchas fotos catalogo no muestran escala real.'],
      researchMode: 'mock-general',
    },
    generationLog: {
      timestamp: new Date().toISOString(),
      steps: ['Analizando marca', 'Leyendo productos', 'Analizando imagenes', 'Leyendo metricas de Instagram', 'Disenando estrategia', 'Creando tareas', 'Validando tono y CTA'],
      hasImages: true,
      hasMetrics: true,
      researchMode: 'mock-local',
      warnings: [`Plan generado con ${sourceLabel}; productos y metricas siguen siendo demo. No usa IA ni cambia Firestore.`],
      validationChecks: {
        datesValid: true,
        languageValid: true,
        forbiddenWordsValid: true,
        moduleMappingValid: true,
        slotsValid: true,
        hashtagCountValid: true,
        productConsistencyValid: true,
        noPastDates: true,
      },
      fixedErrors: [],
    },
    validationReportMarkdown: `# Growth Planner Mock - ${brandName}\n\nPlan de ${duration} dias generado con ${sourceLabel} para validar integracion visual dentro de Luz IA Studio.`,
  };
}
