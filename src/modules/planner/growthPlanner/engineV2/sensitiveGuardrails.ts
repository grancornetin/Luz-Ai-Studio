export type SensitiveNiche =
  | 'health'
  | 'supplements'
  | 'invasive_beauty'
  | 'finance'
  | 'legal'
  | 'gambling'
  | 'alcohol'
  | 'cannabis'
  | 'children'
  | 'body_before_after'
  | 'income_claims';

const NICHE_PATTERNS: Array<[SensitiveNiche, RegExp]> = [
  ['health', /\bsalud|m[eé]dico|tratamiento|cura\b/i],
  ['supplements', /\bsuplemento|vitamina|prote[ií]na\b/i],
  ['invasive_beauty', /\bbotox|relleno|cirug[ií]a|invasiv/i],
  ['finance', /\binversi[oó]n|finanzas|rentabilidad|ingresos\b/i],
  ['legal', /\babogado|legal|demanda|contrato\b/i],
  ['gambling', /\bapuesta|casino|bet\b/i],
  ['alcohol', /\balcohol|vino|cerveza|licor\b/i],
  ['cannabis', /\bcannabis|cbd|marihuana\b/i],
  ['children', /\bniñ[oa]s?|menores\b/i],
  ['body_before_after', /\bantes y despu[eé]s corporal|bajar de peso\b/i],
  ['income_claims', /\bganar dinero|ingresos garantizados|rentabilidad garantizada\b/i],
];

const RISK_PATTERNS = [
  /\bcura[rs]?\b/i,
  /\bgarantizad[oa]s?\b/i,
  /\bingresos? asegurados?\b/i,
  /\bresultados? garantizados?\b/i,
  /\bsin riesgo\b/i,
];

export function detectSensitiveNiches(text: string, businessArchetype?: string): SensitiveNiche[] {
  const patterns = businessArchetype === 'saas_subscription'
    ? NICHE_PATTERNS.map(([niche, pattern]): [SensitiveNiche, RegExp] => {
      if (niche === 'finance') return [niche, /\bpr[eé]stamo|inversi[oó]n financiera|rentabilidad garantizada|regulaci[oó]n financiera\b/i];
      if (niche === 'legal') return [niche, /\basesor[ií]a legal|contrato legal|demanda|impuesto|abogado|regulaci[oó]n legal\b/i];
      return [niche, pattern];
    })
    : NICHE_PATTERNS;
  return patterns.filter(([, pattern]) => pattern.test(text)).map(([niche]) => niche);
}

export function validateSensitiveClaims(text: string, businessArchetype?: string): { valid: boolean; warnings: string[] } {
  const niches = detectSensitiveNiches(text, businessArchetype);
  const risky = RISK_PATTERNS.filter(pattern => pattern.test(text));
  return {
    valid: risky.length === 0,
    warnings: [
      ...niches.map(niche => `Nicho sensible detectado: ${niche}.`),
      ...risky.map(pattern => `Claim riesgoso detectado: ${pattern.source}.`),
    ],
  };
}

export const validateSensitiveClaimsV2 = validateSensitiveClaims;
