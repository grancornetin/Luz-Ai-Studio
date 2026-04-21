// src/services/creditConfig.ts
// ─────────────────────────────────────────────────────────────────────────────
// Fuente única de verdad para créditos, modelos y planes.
//
// MODELOS PERMITIDOS (verificados 2026-04):
//   PRO   → gemini-3-pro-image-preview      @ global   → imagen, fidelidad alta
//   FLASH → gemini-3.1-flash-image-preview  @ global   → imagen, uso general
//   TEXT  → gemini-2.5-flash                @ us-central1 → análisis/texto únicamente
//
// gemini-2.5-flash-image (FAST) está ELIMINADO:
//   • Solo disponible en us-central1 — incompatible con referencias de identidad
//   • Causa drift de identidad/estilo en generaciones con REFs
//   • Reemplazado por gemini-3.1-flash-image-preview en todos los módulos
// ─────────────────────────────────────────────────────────────────────────────

export const MODELS = {
  PRO:   'gemini-3-pro-image-preview',      // Imagen con fidelidad facial crítica
  FLASH: 'gemini-3.1-flash-image-preview',  // Imagen general (location: global)
  TEXT:  'gemini-2.5-flash',                // Solo análisis y texto (location: us-central1)
} as const;

export type ModelKey   = keyof typeof MODELS;
export type ModelValue = typeof MODELS[ModelKey];

// ── UBICACIONES ───────────────────────────────────────────────────────────────
// Gestionadas server-side en api/gemini/image-worker.ts y api/gemini/content.ts
// Este mapa es solo referencia documental para el frontend.
export const MODEL_LOCATIONS: Record<string, string> = {
  [MODELS.PRO]:   'global',
  [MODELS.FLASH]: 'global',
  [MODELS.TEXT]:  'us-central1',
};

// ── CRÉDITOS POR ACCIÓN ───────────────────────────────────────────────────────
// Base: 1 crédito = $0.05 USD
// Todos los módulos de imagen usan Gemini 3 Flash como base (~$0.067/img = 2 créditos).
// Los flujos con fidelidad facial crítica usan Pro (~$0.134/img = 4 créditos).

export const CREDIT_COSTS = {
  // ── Módulo Clonar Imagen (identidad facial 1:1)
  CLONE_IMAGE:            4,

  // ── Módulo Crear Modelo
  CREATE_MODEL_CLONE:     4,   // clonar desde fotos reales
  CREATE_MODEL_MANUAL:    4,   // identidad desde scratch

  // ── Prompt Studio
  PROMPT_WITH_PERSON:     4,   // slots de persona activos → Pro
  PROMPT_NO_PERSON:       2,   // solo estilo/producto/escena → Flash

  // ── Campaign Generator (por imagen)
  CAMPAIGN_PER_IMAGE:     2,   // Flash — consistencia entre escenas

  // ── Photodump Mode (por imagen)
  PHOTODUMP_PER_IMAGE:    2,   // Flash — antes era 1 (FAST), ahora Gemini 3

  // ── Studio UGC (por shot)
  UGC_PER_SHOT:           4,   // Pro — persona específica

  // ── Outfit Kit
  OUTFIT_ANALYSIS:        0,   // Texto — gratis
  OUTFIT_PER_GARMENT:     2,   // Flash — antes era 1 (FAST), ahora Gemini 3

  // ── Catálogo / Productos
  PRODUCT_ANALYSIS:       0,   // Texto — gratis
  PRODUCT_GENERATION:     2,   // Flash — antes era 1 (FAST), ahora Gemini 3

  // ── Variaciones IA
  VARIATIONS_AI:          0,   // Solo texto — gratis
} as const;

export type CreditCostKey = keyof typeof CREDIT_COSTS;

// ── PLANES ────────────────────────────────────────────────────────────────────

export const PLANS = {
  free: {
    id: 'free',
    label: 'Free',
    credits: 20,
    priceMonthly: 0,
    renews: false,
    color: 'slate',
    approxImages: '~10 imágenes de prueba',
    description: 'Para explorar la plataforma',
    features: [
      '20 créditos (única vez)',
      'Acceso a todos los módulos',
      'Galería comunitaria',
    ],
  },
  starter: {
    id: 'starter',
    label: 'Starter',
    credits: 240,
    priceMonthly: 9.99,
    renews: true,
    color: 'brand',
    approxImages: '~80 imágenes/mes',
    description: 'Para creadores independientes',
    features: [
      '240 créditos/mes',
      'Acceso a todos los módulos',
      'Galería comunitaria',
      'Soporte por email',
    ],
  },
  pro: {
    id: 'pro',
    label: 'Pro',
    credits: 600,
    priceMonthly: 19.99,
    renews: true,
    color: 'brand',
    approxImages: '~200 imágenes/mes',
    description: 'Para agencias y equipos creativos',
    features: [
      '600 créditos/mes',
      'Acceso a todos los módulos',
      'Campaign Generator ilimitado',
      'Photodump Mode ilimitado',
      'Soporte prioritario',
    ],
  },
  studio: {
    id: 'studio',
    label: 'Studio',
    credits: 1500,
    priceMonthly: 39.99,
    renews: true,
    color: 'violet',
    approxImages: '~500 imágenes/mes',
    description: 'Para producción a escala',
    features: [
      '1500 créditos/mes',
      'Todo lo de Pro',
      'Prioridad de generación',
      'Soporte chat dedicado',
    ],
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
    features: ['Créditos ilimitados', 'Panel de administración'],
  },
} as const;

export type PlanKey = keyof typeof PLANS;

// ── HELPERS ───────────────────────────────────────────────────────────────────

// Mantenido por compatibilidad — ambas rutas usan Gemini 3 ahora
export const getModelForPrompt = (_hasPersonReference: boolean): string => MODELS.FLASH;

export const getCampaignCredits  = (n: number): number => n * CREDIT_COSTS.CAMPAIGN_PER_IMAGE;
export const getPhotodumpCredits = (n: number): number => n * CREDIT_COSTS.PHOTODUMP_PER_IMAGE;
export const getOutfitCredits    = (n: number): number => n * CREDIT_COSTS.OUTFIT_PER_GARMENT;
export const getUGCCredits       = (n: number): number => n * CREDIT_COSTS.UGC_PER_SHOT;

export const canAfford = (available: number, plan: string, required: number): boolean => {
  if (plan === 'admin') return true;
  return available >= required;
};

export const PLAN_CREDITS: Record<string, number> = {
  free:    PLANS.free.credits,
  starter: PLANS.starter.credits,
  pro:     PLANS.pro.credits,
  studio:  PLANS.studio.credits,
  admin:   PLANS.admin.credits,
};
