const REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bconversion\b/gi, 'conversión'],
  [/\bfriccion\b/gi, 'fricción'],
  [/\bproduccion\b/gi, 'producción'],
  [/\bcampanas\b/gi, 'campañas'],
  [/\bimagenes\b/gi, 'imágenes'],
  [/\bcuantas\b/gi, 'cuántas'],
  [/\bcreditos\b/gi, 'créditos'],
  [/\bpublicacion\b/gi, 'publicación'],
  [/\bsuscripcion\b/gi, 'suscripción'],
  [/\bEscribenos\b/g, 'Escríbenos'],
  [/\bEnvianos\b/g, 'Envíanos'],
  [/\bmodulo\b/gi, 'módulo'],
  [/\bdiagnostico\b/gi, 'diagnóstico'],
];

export function normalizeSpanishText(text: string): string {
  return REPLACEMENTS.reduce((value, [pattern, replacement]) => value.replace(pattern, replacement), text || '');
}

export function hasSpanishOrthographyIssues(text: string): boolean {
  return REPLACEMENTS.some(([pattern]) => {
    pattern.lastIndex = 0;
    return pattern.test(text || '');
  });
}
