export const WEAK_COPY_TERMS = [
  'empoderar',
  'brillar',
  'transforma tu negocio',
  'imagenes de revista',
  'imágenes de revista',
  'exito',
  'éxito',
  'infinitas posibilidades',
  'aliado visual',
  'magia',
  'vende mas',
  'vende más',
  'calidad profesional a tu alcance',
  'resultados increibles',
  'resultados increíbles',
  'tu negocio merece',
  'contenido de valor',
  'pasion por lo que haces',
  'pasión por lo que haces',
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
  /\b(comenta|responde|env[ií]anos|escr[ií]benos|guarda|abre|manda|elige|vota|contesta|pregunta|agenda)\b/i;

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
