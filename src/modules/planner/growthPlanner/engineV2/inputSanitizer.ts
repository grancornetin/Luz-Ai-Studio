import type { PlannerEngineV2Input } from './types';

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

export function sanitizePlannerText(text: string): { value: string; removed: string[] } {
  const removed: string[] = [];
  const value = WEAK_REPLACEMENTS.reduce((current, [pattern, replacement]) => {
    pattern.lastIndex = 0;
    if (pattern.test(current)) removed.push(pattern.source);
    pattern.lastIndex = 0;
    return current.replace(pattern, replacement);
  }, String(text || '')).replace(/\s{2,}/g, ' ').trim();
  return { value, removed };
}

export function sanitizeBrandInputForPlanner(input: PlannerEngineV2Input): {
  input: PlannerEngineV2Input;
  sanitizedPhrases: string[];
} {
  const sanitizedPhrases: string[] = [];
  const clean = (value: string) => {
    const result = sanitizePlannerText(value);
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
