import type { BusinessArchetype, PlannerEngineV2Input } from './types';

const WEAK_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bim[aá]genes de revista\b/gi, 'imágenes más claras, cuidadas y listas para publicar'],
  [/\bempoder(?:ar|e|amiento|ándolas?)\b/gi, 'ayudar a tomar mejores decisiones de contenido'],
  [/\btransform(?:ar|a|ación)\s+(?:tus\s+)?fotos\b/gi, 'mejorar la presentación de tus fotos'],
  [/\btransform(?:ar|a|ación)\s+tu negocio\b/gi, 'mejorar la presentación de tu negocio'],
  [/\baliado visual\b/gi, 'herramienta de apoyo para crear contenido visual'],
  [/\btu negocio merece\b/gi, 'tu producto puede verse más claro y profesional'],
  [/\bsin esfuerzo\b/gi, 'con menos pasos manuales'],
  [/\bsoluci[oó]n definitiva\b/gi, 'opción práctica'],
  [/\bllevar (?:tu|el) negocio al siguiente nivel\b/gi, 'mejorar la presentación de marca'],
  [/\bmagia\b/gi, 'proceso claro'],
  [/\bbrill(?:ar|o)\b/gi, 'verse con claridad'],
  [/\bimpulso\b/gi, 'apoyo'],
  [/\binfinitas posibilidades\b/gi, 'distintas opciones de contenido'],
  [/\bvende m[aá]s\b/gi, 'facilita conversaciones de venta'],
  [/\bcalidad profesional a tu alcance\b/gi, 'imágenes cuidadas y listas para publicar'],
  [/\bcontenido de valor\b/gi, 'contenido útil para una decisión concreta'],
  [/\bresultados incre[ií]bles\b/gi, 'resultados claros'],
  [/\b[eé]xito\b/gi, 'objetivo comercial'],
  [/\bwow\b/gi, ''],
];

export function polishByArchetype(text: string, archetype: BusinessArchetype = 'generic_business'): string {
  if (archetype === 'fashion_accessories') {
    return String(text || '')
      .replace(/\bhaz brillar tu negocio\b/gi, 'realza la presentacion de tus productos')
      .replace(/\bsin esfuerzo\b/gi, 'de forma simple')
      .replace(/\bverse con claridad sutil\b/gi, 'brillo sutil');
  }
  return String(text || '');
}

export function sanitizePlannerText(text: string, archetype: BusinessArchetype = 'generic_business'): { value: string; removed: string[] } {
  const removed: string[] = [];
  const replacements = archetype === 'fashion_accessories'
    ? WEAK_REPLACEMENTS.filter(([pattern]) => !/brill/.test(pattern.source) && !/sin esfuerzo/.test(pattern.source))
    : WEAK_REPLACEMENTS;
  const value = polishByArchetype(replacements.reduce((current, [pattern, replacement]) => {
    pattern.lastIndex = 0;
    if (pattern.test(current)) removed.push(pattern.source);
    pattern.lastIndex = 0;
    return current.replace(pattern, replacement);
  }, String(text || '')), archetype).replace(/\s{2,}/g, ' ').trim();
  return { value, removed };
}

export function sanitizeBrandInputForPlanner(input: PlannerEngineV2Input, archetype: BusinessArchetype = 'generic_business'): {
  input: PlannerEngineV2Input;
  sanitizedPhrases: string[];
} {
  const sanitizedPhrases: string[] = [];
  const clean = (value: string) => {
    const result = sanitizePlannerText(value, archetype);
    sanitizedPhrases.push(...result.removed);
    return result.value;
  };
  return {
    input: {
      ...input,
      brand: {
        ...input.brand,
        idealClient: clean(input.brand.idealClient),
        tone: clean(input.brand.tone),
      },
      commercialFocus: clean(input.commercialFocus),
      products: input.products.map(product => ({
        ...product,
        benefit: clean(product.benefit),
        messageKey: product.messageKey ? clean(product.messageKey) : product.messageKey,
      })),
    },
    sanitizedPhrases: Array.from(new Set(sanitizedPhrases)),
  };
}
