// src/services/creditConfig.ts
// ─────────────────────────────────────────────────────────────────────────────
// Fuente única de verdad para créditos, modelos, planes, top-ups y helpers.
//
// Regla de precio: 1 crédito = $0.10 USD = $100 CLP
// Costo por imagen según modelo:
//   Nano Banana 2 (Gemini): 2 créditos/imagen
//   Seedream 4.5:           1 crédito/imagen
// ─────────────────────────────────────────────────────────────────────────────

export const MODELS = {
  FLASH: 'gemini-3.1-flash-image-preview',  // único modelo de imagen permitido
  TEXT:  'gemini-2.5-flash',                // análisis y texto (us-central1)
} as const;

export type ModelKey   = keyof typeof MODELS;
export type ModelValue = typeof MODELS[ModelKey];

export const MODEL_LOCATIONS: Record<string, string> = {
  [MODELS.FLASH]: 'global',
  [MODELS.TEXT]:  'us-central1',
};

// ── COSTO POR MODELO ─────────────────────────────────────────────────────────
export const MODEL_CREDIT_COST: Record<'gemini' | 'seedream', number> = {
  gemini:   2,   // Nano Banana 2 — 2 créditos/imagen
  seedream: 1,   // Seedream 4.5  — 1 crédito/imagen
};

/** Devuelve el costo en créditos de N imágenes según el modelo activo. */
export function imageCost(images: number, modelId: 'gemini' | 'seedream' = 'gemini'): number {
  return images * MODEL_CREDIT_COST[modelId];
}

// ── CRÉDITOS POR ACCIÓN ───────────────────────────────────────────────────────
// Los costos de imagen son con Gemini (modelo base).
// Con Seedream estos costos se reducen a la mitad automáticamente.
// Model DNA siempre usa Gemini (identidad facial crítica).

export const CREDIT_COSTS = {
  // Módulos de imagen — costos con Gemini (÷2 con Seedream)
  CLONE_IMAGE:            2,   // 1 imagen
  CREATE_MODEL_CLONE:     8,   // 4 imágenes × 2 cr — siempre Gemini
  CREATE_MODEL_MANUAL:    8,   // 4 imágenes × 2 cr — siempre Gemini
  PROMPT_WITH_PERSON:     2,   // 1 imagen (varía según modelo)
  PROMPT_NO_PERSON:       2,   // 1 imagen (varía según modelo)
  CAMPAIGN_PER_IMAGE:     2,   // 1 imagen por escena (varía según modelo)
  PHOTODUMP_PER_IMAGE:    2,   // 1 imagen por shot (varía según modelo)
  UGC_PER_SHOT:           2,   // 1 imagen por shot (varía según modelo)
  OUTFIT_ANALYSIS:        0,   // texto — gratis
  OUTFIT_PER_GARMENT:     2,   // 1 imagen por prenda (varía según modelo)
  PRODUCT_ANALYSIS:       0,   // texto — gratis
  PRODUCT_GENERATION:     2,   // 1 imagen (varía según modelo)
  VARIATIONS_AI:          0,   // texto — gratis
  // Galería de prompts
  REVEAL_PROMPT:          1,   // revelar prompt completo — precio fijo
} as const;

export type CreditCostKey = keyof typeof CREDIT_COSTS;

// ── PLANES ────────────────────────────────────────────────────────────────────

export const PLANS = {
  free: {
    id: 'free',
    label: 'Free',
    credits: 10,
    priceMonthly: 0,
    priceAnchor: null,
    renews: false,
    color: 'slate',
    approxImages: '~5–10 imágenes',
    description: 'Para explorar la plataforma',
    features: [
      '10 créditos (única vez)',
      'Acceso a todos los módulos',
      'Misiones para ganar créditos gratis',
    ],
  },
  weekly: {
    id: 'weekly',
    label: 'Semanal',
    credits: 60,
    priceMonthly: 4.99,
    priceAnchor: 6.99,
    renews: true,
    color: 'brand',
    approxImages: '~30–60 imágenes/semana',
    description: 'Para uso casual semanal',
    features: [
      '60 créditos/semana',
      'Acceso a todos los módulos',
      'Revelado de prompts con costo (1 crédito)',
    ],
  },
  starter: {
    id: 'starter',
    label: 'Starter',
    credits: 200,
    priceMonthly: 14.99,
    priceAnchor: 19.99,
    renews: true,
    color: 'brand',
    approxImages: '~100–200 imágenes/mes',
    description: 'Para creadores independientes',
    features: [
      '200 créditos/mes',
      'Acceso a todos los módulos',
      'Revelado de prompts con costo (1 crédito)',
      'Soporte por email',
    ],
  },
  pro: {
    id: 'pro',
    label: 'Pro',
    credits: 500,
    priceMonthly: 39.99,
    priceAnchor: 49.99,
    renews: true,
    color: 'brand',
    approxImages: '~250–500 imágenes/mes',
    description: 'Para agencias y equipos creativos',
    features: [
      '500 créditos/mes',
      'Revelado de prompts GRATIS',
      'Campaign Generator ilimitado',
      'Soporte prioritario',
    ],
  },
  studio: {
    id: 'studio',
    label: 'Studio',
    credits: 1200,
    priceMonthly: 99.99,
    priceAnchor: 129.99,
    renews: true,
    color: 'violet',
    approxImages: '~600–1200 imágenes/mes',
    description: 'Para producción a escala',
    features: [
      '1200 créditos/mes',
      'Revelado de prompts GRATIS',
      'Prioridad de generación',
      'Soporte chat dedicado',
    ],
  },
  admin: {
    id: 'admin',
    label: 'Admin',
    credits: 999999,
    priceMonthly: 0,
    priceAnchor: null,
    renews: false,
    color: 'rose',
    approxImages: 'Ilimitado',
    description: 'Acceso total',
    features: [
      'Créditos ilimitados',
      'Revelado de prompts gratis',
      'Panel de administración',
    ],
  },
} as const;

export type PlanKey = keyof typeof PLANS;

// ── TOP-UP PACKAGES ───────────────────────────────────────────────────────────

export const TOP_UP_PACKAGES = [
  { id: 'topup_30',   credits: 30,   priceUSD: 3.29,  priceCLP: 3290  },
  { id: 'topup_80',   credits: 80,   priceUSD: 7.99,  priceCLP: 7990  },
  { id: 'topup_200',  credits: 200,  priceUSD: 18.99, priceCLP: 18990 },
  { id: 'topup_500',  credits: 500,  priceUSD: 45.99, priceCLP: 45990 },
  { id: 'topup_1200', credits: 1200, priceUSD: 99.99, priceCLP: 99990 },
] as const;

export type TopUpPackage = typeof TOP_UP_PACKAGES[number];

// ── HELPERS DE ACCESO ─────────────────────────────────────────────────────────

export const isPromptRevealFree = (planId: string): boolean =>
  ['pro', 'studio', 'admin'].includes(planId);

export const canAfford = (available: number, plan: string, required: number): boolean => {
  if (plan === 'admin') return true;
  return available >= required;
};

// ── HELPERS DE FORMATO ────────────────────────────────────────────────────────

export const formatUSD = (usd: number): string =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(usd);

export const formatCLP = (usd: number): string => {
  const clp = Math.round(usd * 1000);
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(clp);
};

export const formatPrice = (usd: number, currency: 'USD' | 'CLP'): string =>
  currency === 'CLP' ? formatCLP(usd) : formatUSD(usd);

// ── HELPERS DE CÁLCULO ────────────────────────────────────────────────────────

export const getCampaignCredits  = (n: number): number => n * CREDIT_COSTS.CAMPAIGN_PER_IMAGE;
export const getPhotodumpCredits = (n: number): number => n * CREDIT_COSTS.PHOTODUMP_PER_IMAGE;
export const getOutfitCredits    = (n: number): number => n * CREDIT_COSTS.OUTFIT_PER_GARMENT;
export const getUGCCredits       = (n: number): number => n * CREDIT_COSTS.UGC_PER_SHOT;

export const PLAN_CREDITS: Record<string, number> = {
  free:    PLANS.free.credits,
  weekly:  PLANS.weekly.credits,
  starter: PLANS.starter.credits,
  pro:     PLANS.pro.credits,
  studio:  PLANS.studio.credits,
  admin:   PLANS.admin.credits,
};

// Mantenido por compatibilidad — ahora solo usa Flash
export const getModelForPrompt = (_hasPersonReference: boolean): string => MODELS.FLASH;
