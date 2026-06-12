import type { GrowthProduct, GrowthStrategicPlan, GrowthTask } from '../../growthPlannerTypes';
import {
  BRAND_DISPLAY_NAME,
  PREMIUM_WEAK_PHRASE_PATTERN,
  RAW_VISIBLE_SLOT_PATTERN,
  polishPremiumVisibleCopy,
} from './copyPolish';
import type {
  VisibleOutputQualityResult,
  VisiblePlanFocus,
  VisiblePlannerOutput,
  VisiblePlannerTask,
  VisibleRoadmapItem,
  VisibleShotItem,
  VisibleTaskStep,
} from './types';

const MODULE_LABELS = {
  product: 'Foto de producto',
  ugc: 'UGC Studio',
  scene: 'Scene Clone',
  prompt: 'Prompt Studio',
  outfit: 'Outfit Extractor',
  none: 'No necesitas usar un módulo para esta tarea',
} as const;

const EFFORT_LABELS = { bajo: 'Esfuerzo bajo', medio: 'Esfuerzo medio', alto: 'Esfuerzo alto' } as const;
const PRIORITY_LABELS = { primary: 'Tarea principal', support: 'Tarea de apoyo' } as const;
const TECHNICAL_TERMS = /plannerEngineVersion|blueprintId|creativeSeed|noveltyScore|releaseGate|validationChecks|fixedErrors|contractLockedFields|regenerationAttempts|validationReportMarkdown|moduleReason|variationReason/i;
const BAD_BRAND_PATTERN = /\bLuz\s*Ai\b|\bLuz\s*AI\b|\bLuzIA\b|Luz IA Studio\s+Studio/i;
const UNACCENTED_PATTERN = /\b(suscripcion|produccion|campanas|interaccion|diagnostico|creditos|imagenes|edicion|publicacion|conversion|friccion|modulo|duracion|metricas)\b/i;
const BAD_HASHTAG_PATTERN = /#(?:Emprendedoras?Exitosas?|EscalaTuNegocio|FotosProfesionales|FotosDeImpacto|TransformacionVisual|FotosParaVender|ContenidoDeCalidad|OptimizaTusFotos|IAparaNegocios|ResultadosInstantaneos|TransformacionDigital|ContenidoQueVende|VendeMas|Brilla|Wow)\b/i;
const MECHANICAL_COPY_PATTERN = /\b(?:esta publicaci[oó]n compara|esta pieza muestra|el objetivo es explicar|el plan (?:pro|explorer|starter|studio) est[aá] pensado|opci[oó]n pr[aá]ctica de forma pr[aá]ctica)\b/i;
const DIAGNOSTIC_BLUEPRINT_PATTERN = /PAIN|DIAGNOSIS|COMMON_ERRORS|MYTH_VS_REALITY|QA_POST|PROBLEM_REVEAL|THIS_OR_THAT/;
const CREDITS_BLUEPRINT_PATTERN = /CREDITS/;
const COMPARISON_BLUEPRINT_PATTERN = /PLAN_COMPARISON|STARTER_VS_PRO|DECISION_GUIDE|PLAN_PICKER|PLAN_RECOMMENDATION/;
const LUZ_IA_OFFER_PATTERN = /\b(?:luz\s*(?:ia|ai)\s*studio|luzia|plan\s+(?:explorer|starter|pro|studio)|explorer|starter|cr[eé]ditos?\s+ia)\b/i;
const DEMO_CONTEXT_PATTERN = /\b(?:CIGNIA|Aros Aurora|Aros Roma|Collar Roma)\b/i;

const TITLE_BY_BLUEPRINT: Record<string, string> = {
  IG_REEL_BEFORE_AFTER: 'Haz un antes y después con una foto casera',
  IG_POST_EDUCATIONAL_PAIN: 'Pregunta si sus fotos reflejan la calidad del producto',
  IG_CAROUSEL_COMMON_ERRORS: 'Muestra 3 errores comunes en fotos de producto',
  IG_REEL_MYTH_VS_REALITY: 'Desmiente el mito de que editar fotos es difícil',
  STORY_POLL_PAIN_POINT: 'Pregunta qué parte de sus fotos les cuesta más',
  STORY_QUICK_DIAGNOSIS: 'Crea un test rápido para diagnosticar sus fotos',
  FB_QA_POST: 'Abre un Q&A sobre fotos de producto en Facebook',
  TIKTOK_PROBLEM_REVEAL: 'Muestra por qué una buena foto puede verse poco clara',
  WHATSAPP_REENGAGEMENT_QUESTION: 'Pregunta qué contenido visual necesitan preparar',
  IG_REEL_SCREEN_DEMO: 'Muestra cómo usar la app en 30 segundos',
  IG_POST_SCENE_EXAMPLE: 'Presenta el producto dentro de una escena útil',
  IG_CAROUSEL_BENEFITS: 'Explica beneficios visuales con ejemplos concretos',
  IG_REEL_PRODUCT_IN_USE: 'Muestra el producto en uso con una demo breve',
  IG_POST_PRODUCT_SPOTLIGHT: 'Destaca un producto con una imagen clara',
  STORY_DEMO_QUICK: 'Enseña una mejora visual en tres stories',
  STORY_THIS_OR_THAT: 'Compara foto casera y foto mejorada',
  FB_PLAN_COMPARISON: 'Compara opciones según el ritmo de contenido',
  TIKTOK_FAST_DEMO: 'Enseña un cambio visual en pocos segundos',
  WHATSAPP_USE_CASE_MESSAGE: 'Comparte un caso de uso por WhatsApp',
  IG_POST_SOCIAL_PROOF: 'Presenta un testimonio real con resultado visual',
  IG_CAROUSEL_OBJECTION_RESPONSE: 'Responde una duda frecuente con ejemplos',
  IG_POST_CREDITS_EXPLAINER: 'Explica qué se puede crear con los créditos',
  IG_REEL_PROCESS_BEHIND: 'Muestra el proceso detrás de una imagen final',
  STORY_QA_OBJECTIONS: 'Responde dudas frecuentes en Stories',
  STORY_FAQ_SEQUENCE: 'Aclara tres preguntas frecuentes en Stories',
  FB_OBJECTION_POST: 'Responde una objeción con una explicación simple',
  FB_SOCIAL_PROOF: 'Cuenta un resultado real en Facebook',
  TIKTOK_TESTIMONIAL_STYLE: 'Cuenta un resultado visual en formato breve',
  WHATSAPP_FAQ_REPLY: 'Responde una duda frecuente por WhatsApp',
  IG_CAROUSEL_PLAN_COMPARISON: 'Ayuda a elegir entre Explorer, Starter, Pro y Studio',
  IG_POST_STARTER_VS_PRO: 'Explica cuándo conviene Starter o Pro',
  IG_REEL_FINAL_CTA: 'Invita a elegir un plan con un ejemplo visual',
  IG_POST_DECISION_GUIDE: 'Ayuda a elegir un plan según la cantidad de contenido',
  IG_CAROUSEL_CREDITS_EXPLAINER: 'Compara cuántas imágenes permite cada plan',
  STORY_DM_QUALIFIER: 'Pregunta qué volumen de contenido necesita la marca',
  STORY_CREDITS_QUESTION: 'Responde dudas sobre créditos en Stories',
  STORY_COUNTDOWN_OR_REMINDER: 'Recuerda revisar el plan antes de decidir',
  STORY_CREDITS_EXPLAINER: 'Explica los créditos con una secuencia breve',
  FB_PLAN_RECOMMENDATION: 'Recomienda un plan según cada caso',
  FB_DIRECT_OFFER_POST: 'Presenta una opción concreta para empezar',
  FB_OBJECTION_CLOSE_POST: 'Aclara la última duda antes de elegir',
  TIKTOK_PLAN_PICKER: 'Ayuda a elegir un plan con un test rápido',
  WHATSAPP_CLOSE_CONVERSATION: 'Retoma una conversación con una recomendación clara',
  WHATSAPP_PLAN_RECOMMENDATION: 'Recomienda un plan por WhatsApp',
};

interface HumanComposerContext {
  products: GrowthProduct[];
  titleCounts: Map<string, number>;
  sequence: number;
  brandName: string;
  isLuzIaOffer: boolean;
}

function unique(items: string[]): string[] {
  return Array.from(new Set(items.filter(Boolean)));
}

function sentence(text: string): string {
  const trimmed = text.trim().replace(/[,\s]+$/, '');
  if (!trimmed) return '';
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function shortenTitle(text: string, maxLength = 64): string {
  const clean = text.trim().replace(/\s{2,}/g, ' ');
  if (clean.length <= maxLength) return clean;
  const shortened = clean.slice(0, maxLength - 3).replace(/\s+\S*$/, '').trimEnd();
  return `${shortened || clean.slice(0, maxLength - 3).trimEnd()}...`;
}

function brandHashtag(brandName: string): string {
  const token = brandName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\p{L}\p{N}]/gu, '');
  return token ? `#${token.slice(0, 28)}` : '';
}

function isLuzIaCommercialOffer(brandName: string, brandCategory: string, products: GrowthProduct[]): boolean {
  const text = [
    brandName,
    brandCategory,
    ...products.flatMap(product => [product.name, product.category, product.description, product.benefit, product.credits || '']),
  ].join(' ').toLowerCase();
  const namedPlans = ['explorer', 'starter', 'pro', 'studio'].filter(plan => new RegExp(`\\b${plan}\\b`, 'i').test(text));
  return /luz\s*(?:ia|ai)\s*studio|luzia/.test(text)
    || (/\bcr[eé]dito/.test(text) && namedPlans.length >= 1)
    || namedPlans.length >= 2;
}

function safePlannerText(text: string, fallback: string, isLuzIaOffer: boolean): string {
  const polished = polishPremiumVisibleCopy(text);
  return !isLuzIaOffer && LUZ_IA_OFFER_PATTERN.test(polished) ? fallback : polished;
}

function coreTaskText(task: GrowthTask): string {
  return [
    task.visualConcept, task.caption, task.prompt, task.supportPrompt || '', task.engagementHook,
    task.blueprintId || '', task.contentType,
  ].filter(Boolean).join(' ').toLowerCase();
}

function safeVisibleText(
  text: string,
  task: GrowthTask,
  products: GrowthProduct[],
  focus: VisiblePlanFocus,
  fallback: string,
  isLuzIaOffer = true,
): string {
  const polished = polishPremiumVisibleCopy(text, { task, products, planFocus: focus })
    .replace(/(?:^|(?<=[.!?])\s+)(?:Esta publicaci[oó]n|Esta pieza|El objetivo es)[^.!?]*[.!?]?/gi, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
  const selectedProductsText = products.map(product => product.name).join(' ');
  const containsForeignDemoContext = DEMO_CONTEXT_PATTERN.test(polished) && !DEMO_CONTEXT_PATTERN.test(selectedProductsText);
  if (!polished
    || PREMIUM_WEAK_PHRASE_PATTERN.test(polished)
    || MECHANICAL_COPY_PATTERN.test(polished)
    || containsForeignDemoContext
    || (!isLuzIaOffer && LUZ_IA_OFFER_PATTERN.test(polished))) return fallback;
  return polished;
}

export function detectTaskPlanFocus(task: GrowthTask, isLuzIaOffer = true): VisiblePlanFocus {
  const blueprint = task.blueprintId || '';
  const text = coreTaskText(task).replace(/luz\s*(?:ia|ai)?\s*studio/gi, '');
  if (DIAGNOSTIC_BLUEPRINT_PATTERN.test(blueprint) || (task.week === 1 && task.funnelRole === 'atraer')) {
    return 'Diagnóstico visual';
  }
  if (!isLuzIaOffer) {
    return COMPARISON_BLUEPRINT_PATTERN.test(blueprint) || CREDITS_BLUEPRINT_PATTERN.test(blueprint)
      ? 'Oferta principal'
      : 'App en general';
  }
  if (COMPARISON_BLUEPRINT_PATTERN.test(blueprint) || /\bcompar|elegir (?:entre|un) plan|cu[aá]l plan|seg[uú]n tu ritmo/.test(text)) {
    return 'Comparativa de planes';
  }
  if (CREDITS_BLUEPRINT_PATTERN.test(blueprint) && !/\b(?:explorer|starter|pro|studio)\b/.test(text)) {
    return 'Créditos en general';
  }
  const specificPlans = [
    ['Plan Explorer', 'explorer'],
    ['Plan Starter', 'starter'],
    ['Plan Pro', 'pro'],
    ['Plan Studio', 'studio'],
  ] as const;
  const matches = specificPlans.filter(([, token]) => new RegExp(`\\b${token}\\b`, 'i').test(text));
  if (matches.length === 1 && new RegExp(`\\b${matches[0][1]}\\b`, 'i').test(task.engagementHook || task.caption)) {
    return matches[0][0];
  }
  if (CREDITS_BLUEPRINT_PATTERN.test(blueprint) || /\bcr[eé]dito/.test(text)) return 'Créditos en general';
  return 'App en general';
}

export function composeVisibleCTA(task: GrowthTask, focus: VisiblePlanFocus, isLuzIaOffer = true): string {
  const blueprint = task.blueprintId || '';
  if (task.week === 1) {
    if (task.platform === 'Stories') return 'Responde esta story y cuéntanos qué parte te cuesta más.';
    if (/Q&A|QA_POST/.test(`${task.contentType} ${blueprint}`)) return 'Deja tu pregunta en los comentarios.';
    if (task.ctaTarget === 'Guardar') return 'Guarda esta guía para revisarla cuando prepares tus próximas fotos.';
    if (/Comentario/.test(task.ctaTarget)) return 'Comenta FOTOS y cuéntanos qué parte quieres mejorar.';
    return isLuzIaOffer
      ? 'Envíanos DIAGNÓSTICO y cuéntanos qué tipo de fotos estás preparando.'
      : 'Envíanos un mensaje y cuéntanos qué necesitas resolver.';
  }
  if (/Q&A|FAQ/.test(`${task.contentType} ${blueprint}`)) {
    return task.platform === 'Stories' ? 'Responde esta story con tu duda.' : 'Deja tu pregunta en los comentarios.';
  }
  if (task.ctaTarget === 'Guardar') return 'Guarda esta guía para revisarla cuando prepares tus próximas fotos.';
  if (!isLuzIaOffer) {
    if (task.ctaTarget === 'Responder story') return 'Responde esta story y cuéntanos qué opción te interesa.';
    if (/Comentario/.test(task.ctaTarget)) return 'Deja tu pregunta en los comentarios.';
    if (task.ctaTarget === 'WhatsApp') return 'Escríbenos por WhatsApp y cuéntanos qué necesitas.';
    if (task.ctaTarget === 'Link' || task.ctaTarget === 'Link en bio') return 'Revisa los detalles en el enlace de la bio.';
    return 'Envíanos un mensaje y te orientamos según lo que necesitas.';
  }
  if (focus === 'Comparativa de planes') return 'Escríbenos PLAN y te recomendamos una opción según tu ritmo de publicación.';
  if (focus === 'Plan Explorer') return 'Envíanos EXPLORER por DM si quieres probar una semana de contenido visual.';
  if (focus === 'Plan Starter') return 'Envíanos STARTER por DM y revisamos si 200 créditos te alcanzan.';
  if (focus === 'Plan Pro') return 'Envíanos PRO por DM si necesitas contenido frecuente para campañas activas.';
  if (focus === 'Plan Studio') return 'Envíanos STUDIO por DM si tu marca necesita alto volumen de piezas visuales.';
  if (focus === 'Créditos en general') return 'Envíanos CRÉDITOS y te explicamos cuántos necesitas según tu calendario.';
  if (task.ctaTarget === 'Responder story') return 'Responde esta story y cuéntanos qué quieres crear.';
  if (/Comentario/.test(task.ctaTarget)) return 'Deja tu pregunta en los comentarios.';
  if (task.ctaTarget === 'WhatsApp') return 'Escríbenos por WhatsApp y cuéntanos qué contenido necesitas preparar.';
  if (task.ctaTarget === 'Link' || task.ctaTarget === 'Link en bio') return 'Revisa las opciones en el enlace de la bio.';
  return 'Envíanos FOTOS por DM y cuéntanos qué quieres mejorar.';
}

function titleFallback(task: GrowthTask): string {
  const format = task.contentType.toLowerCase();
  if (/q&a|pregunta/.test(format)) return `Responde preguntas sobre ${task.platform === 'Facebook' ? 'Facebook' : 'contenido visual'}`;
  if (/encuesta|test/.test(format)) return 'Pregunta qué resultado visual necesita la audiencia';
  if (/reel|video|demo/.test(format)) return 'Muestra un ejemplo visual en pocos pasos';
  if (/carrusel|comparativa/.test(format)) return 'Ordena la información en una guía fácil de revisar';
  if (task.platform === 'WhatsApp') return 'Abre una conversación con una recomendación útil';
  return 'Explica una idea visual con un ejemplo claro';
}

export function buildHumanTaskTitle(
  task: GrowthTask,
  titleCounts: Map<string, number> = new Map(),
  isLuzIaOffer = true,
): string {
  const blueprint = task.blueprintId || '';
  const genericOfferTitle = COMPARISON_BLUEPRINT_PATTERN.test(blueprint)
    ? 'Compara tus opciones con una guía simple'
    : CREDITS_BLUEPRINT_PATTERN.test(blueprint)
      ? 'Explica cómo funciona tu oferta'
      : '';
  const base = (!isLuzIaOffer && genericOfferTitle) || TITLE_BY_BLUEPRINT[blueprint] || titleFallback(task);
  const count = titleCounts.get(base) || 0;
  titleCounts.set(base, count + 1);
  if (count < 2) return shortenTitle(base);
  const variants = [
    `Lleva a la práctica: ${base.toLowerCase()}`,
    `Profundiza en: ${base.toLowerCase()}`,
    `Refuerza la idea: ${base.toLowerCase()}`,
    `Cierra la duda: ${base.toLowerCase()}`,
  ];
  return shortenTitle(variants[count - 2] || `${base}: enfoque ${count + 1}`);
}

function humanOpening(task: GrowthTask, focus: VisiblePlanFocus, isLuzIaOffer: boolean): string {
  const blueprint = task.blueprintId || '';
  if (!isLuzIaOffer) {
    if (/PAIN|DIAGNOSIS/.test(blueprint)) return '¿Qué parte de la oferta genera más dudas antes de comprar?';
    if (/COMMON_ERRORS|MYTH_VS_REALITY/.test(blueprint)) return 'Una explicación concreta ayuda a tomar una decisión con más claridad.';
    if (/QA|FAQ/.test(blueprint)) return '¿Qué duda aparece con más frecuencia antes de elegir?';
    if (/SOCIAL_PROOF|TESTIMONIAL/.test(blueprint)) return 'Un caso real ayuda a entender mejor el valor de la oferta.';
    if (/OBJECTION/.test(blueprint)) return 'Es normal tener dudas antes de elegir un producto o servicio.';
    if (/CREDITS|PLAN_COMPARISON|PLAN_PICKER|PLAN_RECOMMENDATION/.test(blueprint)) return 'Comparar opciones concretas facilita la decisión.';
  }
  if (/PAIN|DIAGNOSIS/.test(blueprint)) return '¿Sientes que tus fotos no muestran bien la calidad de tus productos?';
  if (/COMMON_ERRORS/.test(blueprint)) return 'Una mala luz o un fondo desordenado pueden hacer que un buen producto se vea menos claro.';
  if (/MYTH_VS_REALITY/.test(blueprint)) return 'Editar una foto de producto no tiene por qué tomar horas.';
  if (/BEFORE_AFTER|THIS_OR_THAT/.test(blueprint)) return 'Una misma foto puede comunicar algo muy distinto después de ajustar luz, fondo y encuadre.';
  if (/QA|FAQ/.test(blueprint)) return '¿Qué duda tienes sobre cómo preparar mejores fotos de producto?';
  if (/SOCIAL_PROOF|TESTIMONIAL/.test(blueprint)) return 'Un resultado real ayuda a entender mejor qué cambia cuando una imagen está bien preparada.';
  if (/OBJECTION/.test(blueprint)) return 'Es normal tener dudas antes de cambiar la forma en que preparas tu contenido.';
  if (/CREDITS/.test(blueprint)) return 'Los créditos se entienden mejor cuando los relacionas con la cantidad de imágenes que necesitas.';
  if (focus === 'Comparativa de planes') return 'No todas las marcas necesitan el mismo volumen de imágenes.';
  if (/SCREEN_DEMO|DEMO|PRODUCT_IN_USE|PROCESS/.test(blueprint)) return 'Ver el proceso paso a paso ayuda a decidir si encaja con tu forma de trabajar.';
  if (task.platform === 'WhatsApp') return 'Una recomendación breve y personal puede reabrir una conversación pendiente.';
  return 'Una idea clara funciona mejor cuando se acompaña con un ejemplo fácil de reconocer.';
}

function humanValue(task: GrowthTask, focus: VisiblePlanFocus, title: string, isLuzIaOffer: boolean): string {
  const weekLead = {
    1: 'Al inicio del plan',
    2: 'Cuando la audiencia ya reconoce el problema',
    3: 'Antes de presentar una recomendación',
    4: 'En la etapa de decisión',
  }[task.week] || 'En esta etapa del plan';
  const stagePurpose = {
    atraer: 'para descubrir qué necesita mejorar la audiencia',
    generar_deseo: 'para mostrar una posibilidad concreta y fácil de imaginar',
    construir_confianza: 'para responder dudas con información clara',
    convertir: 'para facilitar una decisión sin presionar',
  }[task.funnelRole];
  const formatContext = `${weekLead}, usa el formato ${task.contentType.toLowerCase()} en ${task.platform} ${stagePurpose}.`;
  if (!isLuzIaOffer && focus === 'Oferta principal') return `Explica las diferencias entre las opciones disponibles con ejemplos concretos. ${formatContext}`;
  if (focus === 'Comparativa de planes') return `Compara Explorer, Starter, Pro y Studio según ritmo de publicación, campañas y cantidad de productos. ${formatContext}`;
  if (focus === 'Créditos en general') return `Relaciona cada cantidad de créditos con ejemplos de contenido para que la decisión sea más simple. ${formatContext}`;
  if (focus.startsWith('Plan ')) return `${title} y muestra con claridad para qué ritmo de contenido resulta útil. ${formatContext}`;
  if (/Q&A|FAQ|QA_POST/.test(`${task.contentType} ${task.blueprintId || ''}`)) return `${weekLead}, responde con consejos simples sobre luz, fondo, edición y preparación de contenido.`;
  if (/Encuesta|Test rápido/.test(task.contentType)) return `${weekLead}, usa una pregunta breve para descubrir qué parte del proceso necesita más ayuda.`;
  if (/Carrusel|Comparativa/.test(task.contentType)) return `${weekLead}, ${title.toLowerCase()} usando una idea concreta por placa ${stagePurpose}.`;
  if (/Reel|Video|Demo|TikTok/i.test(`${task.contentType} ${task.platform}`)) return `${weekLead}, ${title.toLowerCase()} con una demostración breve ${stagePurpose}.`;
  return `${weekLead}, ${title.toLowerCase()} con información concreta que la audiencia pueda aplicar ${stagePurpose}.`;
}

export function composeHumanCaption(
  task: GrowthTask,
  planFocus: VisiblePlanFocus,
  context: { title?: string; sequence?: number; isLuzIaOffer?: boolean } = {},
): string {
  const isLuzIaOffer = context.isLuzIaOffer ?? true;
  const title = context.title || TITLE_BY_BLUEPRINT[task.blueprintId || ''] || titleFallback(task);
  const cta = composeVisibleCTA(task, planFocus, isLuzIaOffer);
  const emphasis = [
    'Prioriza un ejemplo cercano',
    'Mantén una sola idea principal',
    'Haz visible la diferencia',
    'Usa palabras fáciles de reconocer',
    'Apóyate en una comparación simple',
    'Muestra el resultado antes del cierre',
    'Responde la duda más frecuente',
    'Relaciona el ejemplo con una situación cotidiana',
    'Mantén el texto breve y directo',
    'Deja claro el siguiente paso',
    'Usa una demostración fácil de seguir',
    'Cierra con una pregunta concreta',
  ][(context.sequence || 0) % 12];
  const value = humanValue(task, planFocus, title, isLuzIaOffer).replace(/[.!?]\s*$/, '');
  return [humanOpening(task, planFocus, isLuzIaOffer), sentence(`${value}; ${emphasis.toLowerCase()}`), sentence(cta)].join(' ');
}

export function composeActionableSteps(task: GrowthTask, cta = composeVisibleCTA(task, detectTaskPlanFocus(task))): VisibleTaskStep[] {
  const type = `${task.contentType} ${task.platform}`.toLowerCase();
  if (task.platform === 'WhatsApp') {
    return [
      { title: 'Personaliza el mensaje', instruction: 'Ajusta la primera frase según la conversación previa y la necesidad de cada contacto.' },
      { title: 'Envía a contactos activos', instruction: 'Comparte el mensaje solo con personas que ya preguntaron o mostraron interés.' },
      { title: 'Responde las dudas', instruction: 'Aclara cantidad de contenido, ritmo de publicación y próximos pasos según cada caso.' },
      { title: 'Registra interesados', instruction: `Anota quién respondió y continúa la conversación con este cierre: ${cta}` },
    ];
  }
  if (task.platform === 'Stories') {
    return [
      { title: 'Diseña la primera story', instruction: 'Escribe una pregunta simple y acompáñala con una imagen fácil de reconocer.' },
      { title: 'Agrega interacción', instruction: /encuesta/i.test(type) ? 'Añade un sticker de encuesta con dos respuestas claras.' : 'Añade un sticker de preguntas para recibir dudas concretas.' },
      { title: 'Publica la secuencia', instruction: 'Publica entre dos y cuatro stories y revisa que la pregunta se entienda sin contexto adicional.' },
      { title: 'Responde a cada persona', instruction: `Revisa las interacciones durante el día y continúa con este cierre: ${cta}` },
    ];
  }
  if (task.platform === 'Facebook' && /q&a|pregunta/.test(type)) {
    return [
      { title: 'Publica la pregunta central', instruction: 'Escribe una pregunta concreta que pueda responderse directamente en comentarios.' },
      { title: 'Añade una imagen simple', instruction: 'Usa una imagen relacionada con la duda para facilitar que la publicación se entienda rápido.' },
      { title: 'Responde durante el día', instruction: 'Contesta cada comentario con una recomendación breve y específica para ese caso.' },
      { title: 'Continúa solo si hay interés', instruction: `Lleva la conversación a mensaje privado únicamente cuando pidan más detalles. ${cta}` },
    ];
  }
  if (/carrusel|comparativa/.test(type)) {
    return [
      { title: 'Define la portada', instruction: 'Escribe una promesa concreta que explique qué aprenderá la persona al deslizar.' },
      { title: 'Crea de tres a cinco placas', instruction: 'Desarrolla una sola idea por placa usando ejemplos breves y texto fácil de leer.' },
      { title: 'Añade una placa final', instruction: `Cierra el carrusel con este llamado a la acción: ${cta}` },
      { title: 'Publica y responde preguntas', instruction: 'Publica el carrusel y responde las preguntas relacionadas con cada ejemplo mostrado.' },
    ];
  }
  if (/reel|video|tiktok|demo/.test(type)) {
    return [
      { title: 'Prepara el ejemplo visual', instruction: 'Reúne una imagen inicial y el resultado final que quieres mostrar en el video.' },
      { title: 'Graba la acción principal', instruction: 'Graba la pantalla o el proceso central en clips cortos y fáciles de comparar.' },
      { title: 'Edita el video', instruction: 'Añade entre dos y tres textos en pantalla para explicar el cambio sin depender del audio.' },
      { title: 'Publica con un cierre claro', instruction: `Publica el video y usa este llamado a la acción al final: ${cta}` },
    ];
  }
  return [
    { title: 'Define la idea principal', instruction: 'Elige un solo mensaje y un ejemplo visual que ayude a entenderlo rápidamente.' },
    { title: 'Prepara la imagen', instruction: 'Crea o selecciona una imagen clara, con espacio suficiente para el texto principal.' },
    { title: 'Escribe el texto final', instruction: `Revisa que el caption explique el ejemplo y termine con este llamado: ${cta}` },
    { title: 'Publica y revisa respuestas', instruction: 'Publica en el horario sugerido y responde las dudas relacionadas con el contenido mostrado.' },
  ];
}

export function polishVisibleHashtags(
  task: GrowthTask,
  focus: VisiblePlanFocus,
  context: { brandName?: string; isLuzIaOffer?: boolean } = {},
): string {
  if (task.platform !== 'Instagram Feed') return '';
  const focusTag = {
    'Plan Explorer': '#PlanExplorer',
    'Plan Starter': '#PlanStarter',
    'Plan Pro': '#PlanPro',
    'Plan Studio': '#PlanStudio',
    'Créditos en general': '#CreditosIA',
  }[focus as 'Plan Explorer' | 'Plan Starter' | 'Plan Pro' | 'Plan Studio' | 'Créditos en general'];
  const isLuzIaOffer = context.isLuzIaOffer ?? true;
  return unique([
    isLuzIaOffer ? '#LuzIAStudio' : brandHashtag(context.brandName || ''),
    isLuzIaOffer ? focusTag || '' : '',
    '#FotosDeProducto',
    '#ContenidoVisual',
    '#MarketingVisual',
    '#ContenidoParaRedes',
    '#TiendaOnline',
    '#Emprendedoras',
  ]).slice(0, 8).join(' ');
}

function buildVisiblePrompt(
  task: GrowthTask,
  products: GrowthProduct[],
  focus: VisiblePlanFocus,
  title: string,
  isLuzIaOffer: boolean,
): string {
  if (task.module === 'none') return '';
  const source = safeVisibleText(task.prompt, task, products, focus, '', isLuzIaOffer);
  if (source.length >= 55) return source;
  return `Crea una pieza para ${task.platform} que ayude a ${title.toLowerCase()}. Usa una composición clara, texto legible y un ejemplo visual fácil de entender.`;
}

function buildShotGuide(
  task: GrowthTask,
  products: GrowthProduct[],
  focus: VisiblePlanFocus,
  isLuzIaOffer: boolean,
): { label: string; items: VisibleShotItem[] } {
  const contentType = task.contentType.toLowerCase();
  const isVideo = /reel|video|tiktok|demo/.test(contentType);
  const isCarousel = /carrusel|comparativa/.test(contentType);
  const isStories = task.platform === 'Stories';
  if (!isVideo && !isCarousel && !isStories) return { label: '', items: [] };
  const prefix = isStories ? 'Story' : isCarousel ? 'Placa' : 'Toma';
  const fallbackItems = isStories
    ? ['Pregunta principal con fondo simple.', 'Ejemplo breve que aporte contexto.', 'Cierre con el llamado a la acción.']
    : isCarousel
      ? ['Portada con una promesa concreta.', 'Ejemplo o explicación principal.', 'Cierre con el llamado a la acción.']
      : ['Presenta el ejemplo inicial.', 'Muestra la acción o cambio principal.', 'Cierra con el resultado y el llamado a la acción.'];
  const source = task.shotGuide.shots.length ? task.shotGuide.shots : fallbackItems.map((instruction, index) => ({ shot: index + 1, duration: '5 a 8 segundos', instruction }));
  return {
    label: isStories ? 'Secuencia de stories' : isCarousel ? 'Guía de placas' : 'Guía de tomas',
    items: source.map(shot => ({
      label: `${prefix} ${shot.shot}`,
      duration: isVideo || isStories ? polishPremiumVisibleCopy(shot.duration) : '',
      instruction: safeVisibleText(
        shot.instruction,
        task,
        products,
        focus,
        fallbackItems[(shot.shot - 1) % fallbackItems.length],
        isLuzIaOffer,
      ),
    })),
  };
}

function roadmapStage(index: number, total: number): string {
  if (total <= 1) return 'Acción';
  const stages = ['Atracción', 'Demostración', 'Confianza', 'Conversión'];
  return stages[Math.min(stages.length - 1, Math.round((index / (total - 1)) * (stages.length - 1)))];
}

export function composeHumanVisibleTask(task: GrowthTask, plannerContext: HumanComposerContext): VisiblePlannerTask {
  const { products, titleCounts, sequence, brandName, isLuzIaOffer } = plannerContext;
  const planFocus = detectTaskPlanFocus(task, isLuzIaOffer);
  const title = buildHumanTaskTitle(task, titleCounts, isLuzIaOffer);
  const cta = composeVisibleCTA(task, planFocus, isLuzIaOffer);
  const shotGuide = buildShotGuide(task, products, planFocus, isLuzIaOffer);
  const goal = safeVisibleText(task.visualConcept, task, products, planFocus, title, isLuzIaOffer);
  return {
    id: task.id,
    week: task.week,
    status: task.status,
    title,
    dateLabel: polishPremiumVisibleCopy(task.dayLabel),
    suggestedTime: task.suggestedTime,
    platform: task.platform,
    contentType: polishPremiumVisibleCopy(task.contentType),
    effortLabel: EFFORT_LABELS[task.estimatedEffort],
    priorityLabel: PRIORITY_LABELS[task.taskPriority],
    goal,
    whyThisMatters: safeVisibleText(
      task.whyItWorks,
      task,
      products,
      planFocus,
      humanValue(task, planFocus, title, isLuzIaOffer),
      isLuzIaOffer,
    ),
    recommendedModuleLabel: MODULE_LABELS[task.module],
    supportModuleLabel: task.supportModule ? MODULE_LABELS[task.supportModule] : undefined,
    requiredAssetsLabel: task.requiredAssets.length
      ? task.requiredAssets.map(asset => safeVisibleText(asset, task, products, planFocus, 'Recurso visual indicado', isLuzIaOffer)).join(', ')
      : 'No necesitas recursos adicionales',
    steps: composeActionableSteps(task, cta),
    caption: composeHumanCaption(task, planFocus, { title, sequence, isLuzIaOffer }),
    hashtags: polishVisibleHashtags(task, planFocus, { brandName, isLuzIaOffer }),
    prompt: buildVisiblePrompt(task, products, planFocus, title, isLuzIaOffer),
    optionalSupportPrompt: task.supportPrompt
      ? safeVisibleText(
        task.supportPrompt,
        task,
        products,
        planFocus,
        `Crea un recurso visual de apoyo para ${title.toLowerCase()}.`,
        isLuzIaOffer,
      )
      : undefined,
    cta,
    practicalTip: task.week === 1 ? 'Prioriza escuchar las respuestas antes de presentar una opción comercial.' : `Usa las respuestas para decidir qué contenido preparar después.`,
    planFocus,
    shotGuideLabel: shotGuide.label,
    shotGuide: shotGuide.items,
    onScreenText: [title, cta],
  };
}

function visibleStrings(output: VisiblePlannerOutput): string[] {
  return [
    output.headline, output.summary, output.strategy, output.strategicTip, output.brandName,
    output.brandCategory, output.brandVoiceGuide, output.mainGoal, output.channelLabel,
    ...output.nicheInsights,
    ...output.commercialFocus.flatMap(product => [product.name, product.price]),
    ...output.roadmap.flatMap(item => [item.title, item.objective, item.stageLabel]),
    ...output.tasks.flatMap(task => [
      task.title, task.dateLabel, task.platform, task.contentType, task.effortLabel, task.priorityLabel,
      task.goal, task.whyThisMatters, task.caption, task.hashtags, task.prompt, task.optionalSupportPrompt || '',
      task.cta, task.practicalTip, task.requiredAssetsLabel, task.recommendedModuleLabel, task.supportModuleLabel || '',
      ...task.steps.flatMap(step => [step.title, step.instruction]),
      ...task.shotGuide.flatMap(item => [item.label, item.duration, item.instruction]),
      ...task.onScreenText,
    ]),
  ].filter(Boolean);
}

function normalizedCaptionBody(caption: string): string {
  const sentences = caption.split(/(?<=[.!?])\s+/).filter(Boolean);
  return sentences.slice(0, -1).join(' ').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

export function findVisibleRepeatedCaptions(tasks: VisiblePlannerTask[]): string[] {
  const counts = new Map<string, number>();
  tasks.forEach(task => {
    const body = normalizedCaptionBody(task.caption);
    if (body) counts.set(body, (counts.get(body) || 0) + 1);
  });
  return Array.from(counts.entries()).filter(([, count]) => count > 1).map(([caption]) => caption);
}

function countSentences(text: string): number {
  return text.split(/(?<=[.!?])\s+/).filter(Boolean).length;
}

function visibleHashtagsClean(task: VisiblePlannerTask): boolean {
  if (task.platform !== 'Instagram Feed') return !task.hashtags;
  const tags = task.hashtags.match(/#[\p{L}\p{N}_]+/gu) || [];
  return tags.length >= 5 && tags.length <= 8 && !BAD_HASHTAG_PATTERN.test(task.hashtags);
}

export function evaluateVisibleOutputQuality(output: VisiblePlannerOutput): VisibleOutputQualityResult {
  const strings = visibleStrings(output);
  const allText = strings.join('\n');
  const visibleRepeatedCaptionsDetected = findVisibleRepeatedCaptions(output.tasks);
  const titleCounts = output.tasks.reduce<Record<string, number>>((acc, task) => {
    acc[task.title] = (acc[task.title] || 0) + 1;
    return acc;
  }, {});
  const checks = {
    brandNameConsistent: !BAD_BRAND_PATTERN.test(allText.replace(/#LuzIAStudio/g, '')),
    noInflatedMarketingPhrases: !PREMIUM_WEAK_PHRASE_PATTERN.test(allText) && !MECHANICAL_COPY_PATTERN.test(allText),
    planFocusAlignedWithCta: output.tasks.every(task => task.week === 1 || task.planFocus === 'Diagnóstico visual' || task.cta.length >= 20),
    captionsPremiumClean: output.tasks.every(task =>
      countSentences(task.caption) >= 2
      && countSentences(task.caption) <= 4
      && !RAW_VISIBLE_SLOT_PATTERN.test(task.caption)
      && !PREMIUM_WEAK_PHRASE_PATTERN.test(task.caption)
      && !MECHANICAL_COPY_PATTERN.test(task.caption)),
    promptsUseful: output.tasks.every(task =>
      task.recommendedModuleLabel === MODULE_LABELS.none || (task.prompt.length >= 45 && !RAW_VISIBLE_SLOT_PATTERN.test(task.prompt))),
    recipesActionable: output.tasks.every(task =>
      task.steps.length === 4
      && task.steps.every(step => step.title.length >= 4 && step.instruction.length >= 25)
      && !task.steps.some(step => /siguiendo el objetivo|mensaje principal se entienda rápido|responde mensajes o comentarios$/i.test(step.instruction))),
    userFacingDebugHidden: !TECHNICAL_TERMS.test(allText),
    platformLanguageNatural: output.tasks.every(task => {
      const text = `${task.goal} ${task.caption} ${task.steps.map(step => step.instruction).join(' ')}`;
      if (task.platform === 'Stories') return !/publica(?:r)? en facebook/i.test(text);
      if (task.platform === 'Facebook') return !/instagram stories|sticker de instagram|publica(?:r)? en instagram/i.test(text);
      return !/\bsticker\b|responde esta story/i.test(text);
    }),
    spanishVisibleCopyClean: !UNACCENTED_PATTERN.test(allText),
    noRawSlotsInVisibleOutput: !RAW_VISIBLE_SLOT_PATTERN.test(allText),
    visibleHashtagsClean: output.tasks.every(visibleHashtagsClean),
    visibleCaptionsUnique: visibleRepeatedCaptionsDetected.length === 0,
    visibleTitlesVaried: Object.values(titleCounts).every(count => count <= 2),
  };
  const issues = Object.entries(checks).filter(([, valid]) => !valid).map(([name]) => name);
  return {
    visibleOutputQualityStatus: issues.length ? 'needs_copy_review' : 'premium_ready',
    checks,
    issues,
    visibleRepeatedCaptionsDetected,
  };
}

export function isStructurePublishableForVisibleOutput(plan: GrowthStrategicPlan): boolean {
  return plan.tasks.length > 0;
}

export function buildVisiblePlannerOutput(
  planOutput: GrowthStrategicPlan,
  _engineMetadata: Record<string, unknown> = {},
  plannerInput?: Partial<GrowthStrategicPlan>,
): VisiblePlannerOutput {
  const products = plannerInput?.products || planOutput.normalizedProducts || planOutput.products;
  const titleCounts = new Map<string, number>();
  const isLuzIaOffer = isLuzIaCommercialOffer(planOutput.brand.name, planOutput.brand.category, products);
  const output: VisiblePlannerOutput = {
    headline: shortenTitle(polishPremiumVisibleCopy(`Plan de ${planOutput.duration} días para ${planOutput.brand.name}`), 72),
    summary: safePlannerText(
      planOutput.planNarrative,
      `Una guía de contenido de ${planOutput.duration} días para comunicar la oferta de ${planOutput.brand.name} con claridad.`,
      isLuzIaOffer,
    ),
    strategy: safePlannerText(
      planOutput.strategyGoal || planOutput.businessDiagnosis,
      `Presentar la oferta de ${planOutput.brand.name} con ejemplos concretos y llamados a la acción claros.`,
      isLuzIaOffer,
    ),
    strategicTip: safePlannerText(
      planOutput.strategicTip,
      'Revisa las respuestas de la audiencia cada semana y ajusta los próximos contenidos según sus dudas.',
      isLuzIaOffer,
    ),
    brandName: polishPremiumVisibleCopy(planOutput.brand.name),
    brandCategory: polishPremiumVisibleCopy(planOutput.brand.category),
    brandVoiceGuide: polishPremiumVisibleCopy(planOutput.brandAnalysis.voiceGuide),
    mainGoal: polishPremiumVisibleCopy(planOutput.mainGoal),
    channelLabel: polishPremiumVisibleCopy(planOutput.brand.mainSalesChannel),
    duration: planOutput.duration,
    nicheInsights: planOutput.nicheInsights.map(insight => safePlannerText(
      insight,
      'La audiencia responde mejor cuando puede reconocer con rapidez el beneficio principal.',
      isLuzIaOffer,
    )),
    commercialFocus: products.map(product => ({
      id: product.id,
      name: polishPremiumVisibleCopy(product.name),
      price: polishPremiumVisibleCopy(product.price),
    })),
    roadmap: planOutput.roadmap.map((item, index): VisibleRoadmapItem => ({
      week: item.week,
      title: safePlannerText(item.title, `Semana ${item.week}`, isLuzIaOffer),
      objective: safePlannerText(item.objective, 'Comunicar una idea principal con ejemplos concretos.', isLuzIaOffer),
      stageLabel: roadmapStage(index, planOutput.roadmap.length),
    })),
    tasks: planOutput.tasks.map((task, sequence) => composeHumanVisibleTask(task, {
      products,
      titleCounts,
      sequence,
      brandName: planOutput.brand.name,
      isLuzIaOffer,
    })),
    quality: null as unknown as VisibleOutputQualityResult,
    visibleRepeatedCaptionsDetected: [],
    canPublishVisibleOutputToUser: false,
  };
  output.quality = evaluateVisibleOutputQuality(output);
  output.visibleRepeatedCaptionsDetected = output.quality.visibleRepeatedCaptionsDetected;
  output.canPublishVisibleOutputToUser = output.quality.visibleOutputQualityStatus === 'premium_ready'
    && output.quality.checks.noRawSlotsInVisibleOutput
    && output.quality.checks.brandNameConsistent
    && output.quality.checks.noInflatedMarketingPhrases
    && output.quality.checks.captionsPremiumClean
    && output.quality.checks.recipesActionable
    && output.quality.visibleRepeatedCaptionsDetected.length === 0
    && output.quality.checks.visibleHashtagsClean;
  return output;
}

export { BRAND_DISPLAY_NAME };
