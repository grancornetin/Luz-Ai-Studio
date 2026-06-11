import type { GrowthProduct, GrowthTask } from '../../growthPlannerTypes';
import type { VisiblePlanFocus } from './types';

export const BRAND_DISPLAY_NAME = 'Luz IA Studio';

export const RAW_VISIBLE_SLOT_PATTERN = /@[a-záéíóúñ_]+\d+/i;
export const PREMIUM_WEAK_PHRASE_PATTERN = /\b(transforma(?:r|ci[oó]n)?|soluci[oó]n(?: ideal| definitiva)?|fotos incre[ií]bles|im[aá]genes impactantes|impacto visual|contenido que vende|fotos que venden|vende(?:r)? m[aá]s|[eé]xito|exitosa?s?|escalar|escala tu negocio|llevar al siguiente nivel|profesional(?:es)? (?:en segundos|al instante)|resultados profesionales al instante|negocio merece|marca merece|feed profesional|feed impecable|sin esfuerzo|magia|brillar|wow|revolucionar|aliad[oa] visual|calidad de revista|im[aá]genes de revista|fotos de revista)\b/i;

const ORTHOGRAPHY_REWRITES: Array<[RegExp, string]> = [
  [/\bsuscripcion\b/gi, 'suscripción'],
  [/\bproduccion\b/gi, 'producción'],
  [/\bcampanas\b/gi, 'campañas'],
  [/\bpublico\b/gi, 'público'],
  [/\binteraccion\b/gi, 'interacción'],
  [/\bdiagnostico\b/gi, 'diagnóstico'],
  [/\bcreditos\b/gi, 'créditos'],
  [/\bimagenes\b/gi, 'imágenes'],
  [/\bedicion\b/gi, 'edición'],
  [/\bpublicacion\b/gi, 'publicación'],
  [/\bconversion\b/gi, 'conversión'],
  [/\bfriccion\b/gi, 'fricción'],
  [/\bmodulo\b/gi, 'módulo'],
  [/\bduracion\b/gi, 'duración'],
  [/\bmetricas\b/gi, 'métricas'],
  [/\bEscribenos\b/g, 'Escríbenos'],
  [/\bEnvianos\b/g, 'Envíanos'],
];

const PREMIUM_REWRITES: Array<[RegExp, string]> = [
  [/\btransforma(?:r|ci[oó]n)?\b/gi, 'mejora'],
  [/\bsoluci[oó]n visual definitiva\b/gi, 'herramienta práctica para crear contenido visual'],
  [/\bsoluci[oó]n definitiva\b/gi, 'opción práctica'],
  [/\bsoluci[oó]n ideal\b/gi, 'opción adecuada'],
  [/\bsoluci[oó]n\b/gi, 'opción práctica'],
  [/\bfotos incre[ií]bles\b/gi, 'imágenes más claras y cuidadas'],
  [/\bim[aá]genes impactantes\b/gi, 'imágenes claras y atractivas'],
  [/\bimpacto visual\b/gi, 'claridad visual'],
  [/\bcontenido que vende\b/gi, 'contenido que muestra mejor el producto'],
  [/\bfotos que venden\b/gi, 'fotos que muestran mejor el producto'],
  [/\bvende(?:r)? m[aá]s\b/gi, 'mejorar la claridad de la oferta'],
  [/\b[eé]xito\b/gi, 'avance'],
  [/\bexitosa?s?\b/gi, 'activas'],
  [/\bescala tu negocio\b/gi, 'sostén un calendario de contenido más activo'],
  [/\bescalar\b/gi, 'sostener un ritmo más activo'],
  [/\bllevar (?:tus fotos|tu negocio|tu marca|tus productos)? ?al siguiente nivel\b/gi, 'mejorar su presentación'],
  [/\bresultados profesionales al instante\b/gi, 'una presentación más cuidada en menos tiempo'],
  [/\bprofesional(?:es)? (?:en segundos|al instante)\b/gi, 'con una presentación más cuidada en menos tiempo'],
  [/\b(?:tu )?negocio merece\b/gi, 'tu producto puede mostrar'],
  [/\b(?:tu )?marca merece\b/gi, 'tu marca puede mostrar'],
  [/\bfeed profesional\b/gi, 'perfil más ordenado y consistente'],
  [/\bfeed impecable\b/gi, 'perfil más ordenado y consistente'],
  [/\bsin esfuerzo\b/gi, 'con menos pasos manuales'],
  [/\bmagia\b/gi, 'proceso'],
  [/\bbrillar\b/gi, 'destacar con claridad'],
  [/\bwow\b/gi, 'atractivo'],
  [/\brevolucionar\b/gi, 'mejorar'],
  [/\baliad[oa] visual\b/gi, 'herramienta de apoyo visual'],
  [/\b(?:calidad|im[aá]genes?|fotos?) de revista\b/gi, 'imágenes más cuidadas y listas para publicar'],
];

function normalizeSpacing(text: string): string {
  return text
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function normalizeBrandName(text: string): string {
  const hashtagToken = '__LUZ_IA_STUDIO_HASHTAG__';
  const brandToken = '__LUZ_IA_STUDIO_BRAND__';
  return text
    .replace(/#LuzIAStudio/gi, hashtagToken)
    .replace(/\bLuz\s*(?:Ai|AI|IA)\s*Studio\b/gi, brandToken)
    .replace(/\bLuzIA\s*Studio\b/gi, brandToken)
    .replace(/\bLuz\s*(?:Ai|AI|IA)\b/gi, brandToken)
    .replace(/\bLuzIA\b/gi, brandToken)
    .replace(new RegExp(brandToken, 'g'), BRAND_DISPLAY_NAME)
    .replace(new RegExp(hashtagToken, 'g'), '#LuzIAStudio');
}

function focusPlanName(focus: VisiblePlanFocus): string {
  return focus.startsWith('Plan ') ? focus : 'el plan destacado';
}

export function replaceSlotsForVisibleCopy(
  text: string,
  task?: GrowthTask,
  products: GrowthProduct[] = [],
  planFocus: VisiblePlanFocus = 'App en general',
): string {
  if (!text) return '';
  const planByIndex = ['Plan Explorer', 'Plan Starter', 'Plan Pro', 'Plan Studio'];
  const productByIndex = products.map(product => product.name);
  return text.replace(/@([a-záéíóúñ_]+)(\d+)/gi, (_match, rawName: string, rawIndex: string) => {
    const name = rawName.toLowerCase();
    const index = Math.max(0, Number(rawIndex) - 1);
    if (name === 'plan') return planFocus.startsWith('Plan ') ? focusPlanName(planFocus) : planByIndex[index] || 'el plan destacado';
    if (name === 'resultado') return 'un ejemplo de imagen final';
    if (name === 'app_screen') return 'una captura de la app';
    if (name === 'comparativa') return 'una comparativa de planes';
    if (name === 'testimonio') return 'un testimonio real';
    if (name === 'producto') return productByIndex[index] || task?.requiredAssets[index] || 'el producto destacado';
    if (name === 'referencia') return 'una imagen de referencia';
    return 'el recurso visual indicado';
  });
}

export function polishPremiumVisibleCopy(
  text: string,
  options: { task?: GrowthTask; products?: GrowthProduct[]; planFocus?: VisiblePlanFocus; replaceSlots?: boolean } = {},
): string {
  if (!text) return '';
  let polished = normalizeBrandName(text);
  if (options.replaceSlots !== false) {
    polished = replaceSlotsForVisibleCopy(polished, options.task, options.products, options.planFocus);
  }
  for (const [pattern, replacement] of PREMIUM_REWRITES) polished = polished.replace(pattern, replacement);
  for (const [pattern, replacement] of ORTHOGRAPHY_REWRITES) polished = polished.replace(pattern, replacement);
  return normalizeSpacing(polished);
}

export const polishVisibleCopy = polishPremiumVisibleCopy;
