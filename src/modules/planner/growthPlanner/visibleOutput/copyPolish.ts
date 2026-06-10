export const BRAND_DISPLAY_NAME = 'Luz IA Studio';

const PHRASE_REWRITES: Array<[RegExp, string]> = [
  [/\bsoluci[oó]n visual definitiva\b/gi, 'opción práctica para crear contenido visual'],
  [/\bla calidad visual que tu marca merece\b/gi, 'una presentación visual más clara para tu marca'],
  [/\btu negocio merece\b/gi, 'tu producto puede mostrar'],
  [/\bllevar (?:tus fotos|tu negocio|tu marca|tus productos) al siguiente nivel\b/gi, 'mejorar su presentación'],
  [/\baliado visual\b/gi, 'herramienta de apoyo visual'],
  [/\bfotos incre[ií]bles\b/gi, 'fotos más claras y cuidadas'],
  [/\bcontenido visual impactante\b/gi, 'contenido visual claro y atractivo'],
  [/\btransforma (?:tus productos|tus fotos|tu negocio)\b/gi, 'mejora su presentación'],
  [/\bresultados profesionales en segundos\b/gi, 'una presentación más cuidada en menos tiempo'],
  [/\bprofesional al instante\b/gi, 'con una presentación más cuidada en menos tiempo'],
  [/\b(?:calidad|im[aá]genes?|fotos?) de revista\b/gi, 'imágenes más cuidadas y listas para publicar'],
  [/\bcontenido que vende\b/gi, 'contenido más claro para mostrar tu producto'],
  [/\bfotos que venden\b/gi, 'fotos que muestran mejor el producto'],
  [/\bcaptura m[aá]s clientes\b/gi, 'abre conversaciones con posibles clientes'],
  [/\baumenta ventas garantizado\b/gi, 'apoya conversaciones comerciales'],
  [/\bsin esfuerzo\b/gi, 'con menos pasos manuales'],
  [/\bsoluci[oó]n perfecta\b/gi, 'opción práctica'],
  [/\bsoluci[oó]n ideal\b/gi, 'opción adecuada'],
  [/\btodo lo que necesitas\b/gi, 'los recursos principales'],
  [/\bsin l[ií]mites\b/gi, 'con opciones flexibles'],
  [/\bfeed impecable\b/gi, 'feed consistente'],
  [/\bimpulso visual\b/gi, 'apoyo visual'],
  [/\bempodera(?:r|miento|ndo|ndolas)?\b/gi, 'ayuda'],
  [/\bmagia\b/gi, 'proceso'],
  [/\bbrillar\b/gi, 'destacar con claridad'],
  [/\b[eé]xito\b/gi, 'avance'],
  [/\bwow\b/gi, 'atractivo'],
];

const ORTHOGRAPHY_REWRITES: Array<[RegExp, string]> = [
  [/\bsuscripciones\b/gi, 'suscripciones'],
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

const SLOT_LABELS: Record<string, string> = {
  '@plan1': 'el plan destacado',
  '@plan2': 'el segundo plan comparado',
  '@resultado1': 'el resultado visual',
  '@app_screen1': 'una captura de la app',
  '@producto1': 'el producto principal',
  '@producto2': 'el segundo producto',
  '@referencia1': 'la imagen de referencia',
};

function normalizeSpacing(text: string): string {
  return text
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function normalizeBrandName(text: string): string {
  return text
    .replace(/\bLuz\s*Ai\s*Studio\b/gi, BRAND_DISPLAY_NAME)
    .replace(/\bLuz\s*AI\s*Studio\b/g, BRAND_DISPLAY_NAME)
    .replace(/\bLuzIA\s*Studio\b/gi, BRAND_DISPLAY_NAME)
    .replace(/\bLuzIA\b/gi, 'Luz IA');
}

export function replaceRawSlotsForCaption(text: string): string {
  return Object.entries(SLOT_LABELS).reduce(
    (result, [slot, label]) => result.replace(new RegExp(slot, 'gi'), label),
    text,
  );
}

export function polishVisibleCopy(text: string, options: { replaceSlots?: boolean } = {}): string {
  if (!text) return '';
  let polished = normalizeBrandName(text);
  for (const [pattern, replacement] of PHRASE_REWRITES) polished = polished.replace(pattern, replacement);
  for (const [pattern, replacement] of ORTHOGRAPHY_REWRITES) polished = polished.replace(pattern, replacement);
  if (options.replaceSlots) polished = replaceRawSlotsForCaption(polished);
  return normalizeSpacing(polished);
}
