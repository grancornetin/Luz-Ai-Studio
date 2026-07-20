export const WEAK_COPY_TERMS = [
  'empoderar', 'empoderamiento', 'brillar', 'brillo', 'transforma tu negocio',
  'transformar tu negocio', 'imagenes de revista', 'imágenes de revista', 'revista',
  'exito', 'éxito', 'infinitas posibilidades', 'aliado visual', 'solucion definitiva',
  'solución definitiva', 'magia', 'vende mas', 'vende más', 'impulso',
  'llevar tu negocio al siguiente nivel', 'lleva tu negocio al siguiente nivel',
  'calidad profesional a tu alcance', 'resultados increibles', 'resultados increíbles',
  'tu negocio merece', 'contenido de valor', 'pasion por lo que haces',
  'pasión por lo que haces', 'sin esfuerzo',
];

export const RISKY_CLAIM_PATTERNS = [
  /\bcura[rs]?\b/i,
  /\bgarantizad[oa]s?\b/i,
  /\bingresos? asegurados?\b/i,
  /\bresultados? garantizados?\b/i,
  /\bganar dinero seguro\b/i,
  /\bsin riesgo\b/i,
];

export const ACTIONABLE_HOOK_PATTERN =
  /\b(comenta|responde|env[ií]anos|escr[ií]benos|guarda|abre|manda|m[aá]ndanos|elige|vota|contesta|pregunta|agenda|deja|d[eé]janos|revisa)\b/i;

export function findWeakCopyTerms(text: string): string[] {
  const source = text.toLowerCase();
  return WEAK_COPY_TERMS.filter(term => source.includes(term.toLowerCase()));
}

export function findRiskyClaims(text: string): string[] {
  return RISKY_CLAIM_PATTERNS.filter(pattern => pattern.test(text)).map(pattern => pattern.source);
}

export function isActionableHook(text: string): boolean {
  return ACTIONABLE_HOOK_PATTERN.test(text || '');
}

export interface HookValidation {
  valid: boolean;
  hasActionVerb: boolean;
  matchesCtaTarget: boolean;
  hasKeywordIfNeeded: boolean;
  hasClearDestination: boolean;
  errors: string[];
}

export function validateHooksV2(text: string, ctaTarget: string): HookValidation {
  const source = text || '';
  const lower = source.toLowerCase();
  const hasActionVerb = ACTIONABLE_HOOK_PATTERN.test(source);
  const isConversion = /\b(plan|cr[eé]ditos|starter|pro|studio|explorer|precio)\b/i.test(source);
  const needsKeyword = isConversion && /dm|comentario|facebook comentario|responder story|whatsapp/i.test(ctaTarget);
  const hasKeywordIfNeeded = !needsKeyword || /\b[A-ZÁÉÍÓÚÑ]{3,}\b/.test(source) || /pregunta|comentarios/i.test(lower);
  const destinationPatterns: Record<string, RegExp> = {
    'Instagram DM': /\bdm|mensaje\b/i,
    Comentario: /\bcomenta|comentarios\b/i,
    'Facebook comentario': /\bcomenta|comentarios\b/i,
    'DM Facebook': /\bdm|mensaje\b/i,
    WhatsApp: /\bwhatsapp|responde|mensaje\b/i,
    'Responder story': /\bstory|responde\b/i,
    Guardar: /\bguarda\b/i,
    Link: /\blink|enlace|ver planes|revisar planes\b/i,
    'Link en bio': /\blink|enlace|bio\b/i,
  };
  const matchesCtaTarget = destinationPatterns[ctaTarget]?.test(source) ?? hasActionVerb;
  const hasClearDestination = /\bdm|mensaje|coment|story|whatsapp|guarda|link|enlace|bio|pregunta|planes\b/i.test(source);
  const errors = [
    !hasActionVerb ? 'Hook sin verbo de acción.' : '',
    !matchesCtaTarget ? 'Hook no coincide con ctaTarget.' : '',
    !hasKeywordIfNeeded ? 'Hook de conversión sin palabra clave o pregunta clara.' : '',
    !hasClearDestination ? 'Hook sin destino claro.' : '',
  ].filter(Boolean);
  return { valid: errors.length === 0, hasActionVerb, matchesCtaTarget, hasKeywordIfNeeded, hasClearDestination, errors };
}

export function validateWeakPhrasesV2(text: string): string[] {
  return findWeakCopyTerms(text);
}
