// src/services/creditConfig.ts
// ─────────────────────────────────────────────────────────────────────────────
// Fuente única de verdad para créditos, modelos, planes, top-ups y helpers.
//
// Regla de precio: 1 crédito = $0.10 USD = $100 CLP
// Costo por imagen según modelo:
//   Nano Banana 2 (Gemini): 2 créditos/imagen
//   Seedream 4.5:           1 crédito/imagen
//   GPT Image 2:            2 créditos/imagen
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
export const MODEL_CREDIT_COST: Record<'gemini' | 'seedream' | 'gptimage', number> = {
  gemini:   2,   // Nano Banana 2 — 2 créditos/imagen
  seedream: 1,   // Seedream 4.5  — 1 crédito/imagen
  gptimage: 2,   // GPT Image 2   — 2 créditos/imagen
};

/** Devuelve el costo en créditos de N imágenes según el modelo activo. */
export function imageCost(images: number, modelId: 'gemini' | 'seedream' | 'gptimage' = 'gemini'): number {
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

// ── PRO-CREDITS (tokens especiales para Campaign y Photodump) ────────────────
// Son una segunda moneda incluida en cada plan.
// No se mezclan con créditos normales — se consumen 1 por sesión generada.
// Las imágenes dentro de la sesión siguen costando créditos normales.

export const PRO_CREDIT_COSTS = {
  CAMPAIGN_SESSION:  1,   // 1 pro-credit por sesión Campaign (más las imágenes en créditos normales)
  PHOTODUMP_SESSION: 1,   // 1 pro-credit por sesión Photodump
} as const;

/** Pro-credits incluidos por plan al renovar. */
export const PLAN_PRO_CREDITS: Record<string, number> = {
  free:    2,     // 2 sesiones de prueba, nunca se renuevan
  weekly:  15,    // 15 sesiones/semana
  starter: 80,    // 80 sesiones/mes
  pro:     200,   // 200 sesiones/mes
  studio:  500,   // 500 sesiones/mes
  admin:   999999,
};

/** Top-up packs especiales de pro-credits. */
export const PRO_CREDIT_TOPUPS = [
  { id: 'pro_topup_20',  proCredits: 20,  priceUSD: 5.99,  priceCLP: 5990  },
  { id: 'pro_topup_60',  proCredits: 60,  priceUSD: 14.99, priceCLP: 14990 },
  { id: 'pro_topup_150', proCredits: 150, priceUSD: 34.99, priceCLP: 34990 },
  { id: 'pro_topup_400', proCredits: 400, priceUSD: 79.99, priceCLP: 79990 },
] as const;

export type ProCreditTopup = typeof PRO_CREDIT_TOPUPS[number];

/** Planes que tienen acceso a Campaign y Photodump. */
export const MODULES_WITH_PRO_ACCESS = ['free', 'weekly', 'starter', 'pro', 'studio', 'admin'] as const;

// ── PLANES ────────────────────────────────────────────────────────────────────

export const PLANS = {
  free: {
    id: 'free',
    label: 'Free',
    credits: 20,
    proCredits: 2,
    priceMonthly: 0,
    priceAnchor: null,
    renews: false,
    color: 'slate',
    approxImages: '~10–20 imágenes',
    description: 'Para explorar la plataforma',
    features: [
      '20 créditos (única vez)',
      '2 sesiones Campaign/Photodump de prueba',
      'Acceso a todos los módulos',
      'Misiones para ganar créditos gratis',
    ],
  },
  weekly: {
    id: 'weekly',
    label: 'Semanal',
    credits: 60,
    proCredits: 15,
    priceMonthly: 4.99,
    priceAnchor: 6.99,
    renews: true,
    color: 'brand',
    approxImages: '~30–60 imágenes/semana',
    description: 'Para uso casual semanal',
    features: [
      '60 créditos/semana',
      '15 sesiones Campaign/Photodump por semana',
      'Acceso a todos los módulos',
      'Revelado de prompts con costo (1 crédito)',
    ],
  },
  starter: {
    id: 'starter',
    label: 'Starter',
    credits: 200,
    proCredits: 80,
    priceMonthly: 14.99,
    priceAnchor: 19.99,
    renews: true,
    color: 'brand',
    approxImages: '~100–200 imágenes/mes',
    description: 'Para creadores independientes',
    features: [
      '200 créditos/mes',
      '80 sesiones Campaign/Photodump/mes',
      'Acceso a todos los módulos',
      'Revelado de prompts con costo (1 crédito)',
      'Soporte por email',
    ],
  },
  pro: {
    id: 'pro',
    label: 'Pro',
    credits: 500,
    proCredits: 200,
    priceMonthly: 39.99,
    priceAnchor: 49.99,
    renews: true,
    color: 'brand',
    approxImages: '~250–500 imágenes/mes',
    description: 'Para agencias y equipos creativos',
    features: [
      '500 créditos/mes',
      '200 sesiones Campaign/Photodump/mes',
      'Revelado de prompts GRATIS',
      'Soporte prioritario',
    ],
  },
  studio: {
    id: 'studio',
    label: 'Studio',
    credits: 1200,
    proCredits: 500,
    priceMonthly: 99.99,
    priceAnchor: 129.99,
    renews: true,
    color: 'violet',
    approxImages: '~600–1200 imágenes/mes',
    description: 'Para producción a escala',
    features: [
      '1200 créditos/mes',
      '500 sesiones Campaign/Photodump/mes',
      'Revelado de prompts GRATIS',
      'Prioridad de generación',
      'Soporte chat dedicado',
    ],
  },
  admin: {
    id: 'admin',
    label: 'Admin',
    credits: 999999,
    proCredits: 999999,
    priceMonthly: 0,
    priceAnchor: null,
    renews: false,
    color: 'rose',
    approxImages: 'Ilimitado',
    description: 'Acceso total',
    features: [
      'Créditos ilimitados',
      'Sesiones Campaign/Photodump ilimitadas',
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
