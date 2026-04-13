// ──────────────────────────────────────────
// creditConfig.ts
// Fuente única de verdad para créditos, modelos y planes.
//
// Estructura de costos:
//   1 crédito = $0.05 USD
//
// 3 niveles de modelo:
//   PRO   → gemini-3-pro-image-preview   → $0.134/img → 4 créditos
//   FLASH → gemini-3.1-flash-image-preview → $0.067/img → 2 créditos
//   FAST  → imagen-4.0-fast-generate-001  → $0.020/img → 1 crédito
//   TEXT  → gemini-2.0-flash (texto)      → ~$0        → 0 créditos
// ──────────────────────────────────────────

// ── MODELOS ──────────────────────────────

export const MODELS = {
  PRO:   'gemini-3-pro-image-preview',       // Identidad facial crítica
  FLASH: 'gemini-3.1-flash-image-preview',   // Generación creativa/persona con ref
  FAST:  'imagen-4.0-fast-generate-001',     // Volumen alto, sin persona
  TEXT:  'gemini-2.0-flash',                 // Análisis y variaciones (texto)
} as const;

export type ModelKey = keyof typeof MODELS;
export type ModelValue = typeof MODELS[ModelKey];

// ── CRÉDITOS POR ACCIÓN ──────────────────

export const CREDIT_COSTS = {
  // ── Módulo Clonar Imagen (Pro — fidelidad 1:1)
  CLONE_IMAGE:            4,

  // ── Módulo Crear Modelo
  CREATE_MODEL_CLONE:     4,   // Pro — clonar desde fotos reales
  CREATE_MODEL_MANUAL:    4,   // Pro — identidad desde scratch

  // ── Prompt Studio
  PROMPT_WITH_PERSON:     4,   // Pro — slots de persona activos
  PROMPT_NO_PERSON:       2,   // Flash — solo estilo/producto/escena

  // ── Campaign Generator (costo por imagen generada)
  CAMPAIGN_PER_IMAGE:     2,   // Flash — consistencia entre escenas

  // ── Photodump Mode (costo por imagen generada)
  PHOTODUMP_PER_IMAGE:    1,   // Imagen4 Fast — variaciones de volumen

  // ── Studio UGC (costo por shot)
  UGC_PER_SHOT:           4,   // Pro — persona específica en UGC

  // ── Outfit Kit
  OUTFIT_ANALYSIS:        0,   // Texto — gratis
  OUTFIT_PER_GARMENT:     1,   // Imagen4 Fast — prendas ghost sin persona

  // ── Catálogo / Productos
  PRODUCT_ANALYSIS:       0,   // Texto — gratis
  PRODUCT_GENERATION:     1,   // Imagen4 Fast — product shot sin persona

  // ── Variaciones IA
  VARIATIONS_AI:          0,   // Solo texto — gratis
} as const;

export type CreditCostKey = keyof typeof CREDIT_COSTS;

// ── PLANES ───────────────────────────────

export const PLANS = {
  free: {
    id: 'free',
    label: 'Free',
    credits: 20,           // Único, no renueva
    priceMonthly: 0,
    renews: false,
    color: 'slate',
    approxImages: '~10 imágenes de prueba',
    description: 'Para explorar la plataforma',
    features: [
      '20 créditos (única vez)',
      'Acceso a todos los módulos',
      'Galería comunitaria',
    ]
  },
  starter: {
    id: 'starter',
    label: 'Starter',
    credits: 240,          // /mes
    priceMonthly: 9.99,
    renews: true,
    color: 'brand',
    approxImages: '~120 imágenes/mes',
    description: 'Para creadores independientes',
    features: [
      '240 créditos/mes',
      'Acceso a todos los módulos',
      'Galería comunitaria',
      'Soporte por email',
    ]
  },
  pro: {
    id: 'pro',
    label: 'Pro',
    credits: 600,          // /mes
    priceMonthly: 19.99,
    renews: true,
    color: 'brand',
    approxImages: '~300 imágenes/mes',
    description: 'Para agencias y equipos creativos',
    features: [
      '600 créditos/mes',
      'Acceso a todos los módulos',
      'Campaign Generator ilimitado',
      'Photodump Mode ilimitado',
      'Soporte prioritario',
    ]
  },
  studio: {
    id: 'studio',
    label: 'Studio',
    credits: 1500,         // /mes
    priceMonthly: 39.99,
    renews: true,
    color: 'violet',
    approxImages: '~750 imágenes/mes',
    description: 'Para producción a escala',
    features: [
      '1500 créditos/mes',
      'Todo lo de Pro',
      'Prioridad de generación',
      'Soporte chat dedicado',
    ]
  },
  admin: {
    id: 'admin',
    label: 'Admin',
    credits: 999999,
    priceMonthly: 0,
    renews: false,
    color: 'rose',
    approxImages: 'Ilimitado',
    description: 'Acceso total',
    features: ['Créditos ilimitados', 'Panel de administración']
  }
} as const;

export type PlanKey = keyof typeof PLANS;

// ── HELPERS ──────────────────────────────

/**
 * Devuelve el modelo correcto según si hay referencias de persona activas.
 * Con persona → Pro (fidelidad facial)
 * Sin persona → Flash (velocidad + calidad suficiente)
 */
export const getModelForPrompt = (hasPersonReference: boolean): string =>
  hasPersonReference ? MODELS.PRO : MODELS.FLASH;

/** Créditos totales para Campaign (N imágenes) */
export const getCampaignCredits = (imageCount: number): number =>
  imageCount * CREDIT_COSTS.CAMPAIGN_PER_IMAGE;

/** Créditos totales para Photodump (N imágenes) */
export const getPhotodumpCredits = (imageCount: number): number =>
  imageCount * CREDIT_COSTS.PHOTODUMP_PER_IMAGE;

/** Créditos totales para Outfit (N prendas) */
export const getOutfitCredits = (garmentCount: number): number =>
  garmentCount * CREDIT_COSTS.OUTFIT_PER_GARMENT;

/** Créditos totales para Studio UGC (N shots) */
export const getUGCCredits = (shotCount: number): number =>
  shotCount * CREDIT_COSTS.UGC_PER_SHOT;

/** Verifica si el usuario puede realizar una acción */
export const canAfford = (
  available: number,
  plan: string,
  required: number
): boolean => {
  if (plan === 'admin') return true;
  return available >= required;
};

/** Créditos disponibles en el plan (para PLAN_CREDITS en userService) */
export const PLAN_CREDITS: Record<string, number> = {
  free:    PLANS.free.credits,
  starter: PLANS.starter.credits,
  pro:     PLANS.pro.credits,
  studio:  PLANS.studio.credits,
  admin:   PLANS.admin.credits,
};
