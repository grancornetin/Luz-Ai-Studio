// src/services/checkoutService.ts
// Genera URLs de checkout de Lemon Squeezy con user_id en custom_data.
// NUNCA expone LEMONSQUEEZY_API_KEY al cliente.

const LS_STORE = 'luz-ia-studio'; // subdominio de tu tienda en LS

// Variant IDs — deben coincidir con las env vars de Vercel.
// Los valores aquí son los IDs reales del brief.
export const LS_VARIANTS = {
  weekly:          '1572761',
  starter_monthly: '1572747',
  starter_yearly:  '1572751',
  pro_monthly:     '1572752',
  pro_yearly:      '1572755',
  studio_monthly:  '1572756',
  studio_yearly:   '1572758',
  topup_30:        '1572814',
  topup_80:        '1572817',
  topup_200:       '1572822',
  topup_500:       '1572824',
  topup_1200:      '1572837',
} as const;

export type VariantKey = keyof typeof LS_VARIANTS;

/**
 * Genera la URL de checkout de Lemon Squeezy.
 * Incluye custom_data[user_id] para que el webhook identifique al usuario.
 */
export function buildCheckoutUrl(variantKey: VariantKey, userId: string): string {
  const variantId = LS_VARIANTS[variantKey];
  const base      = `https://${LS_STORE}.lemonsqueezy.com/checkout/buy/${variantId}`;
  const params    = new URLSearchParams({
    'custom_data[user_id]': userId,
    // Pre-fill email si lo quieres: 'checkout[email]': userEmail,
  });
  return `${base}?${params.toString()}`;
}

/**
 * Mapeo de PlanKey → VariantKey mensual para el botón de suscripción.
 */
export const PLAN_TO_VARIANT: Record<string, VariantKey> = {
  weekly:  'weekly',
  starter: 'starter_monthly',
  pro:     'pro_monthly',
  studio:  'studio_monthly',
};

/**
 * Mapeo de top-up id → VariantKey.
 */
export const TOPUP_TO_VARIANT: Record<string, VariantKey> = {
  topup_30:   'topup_30',
  topup_80:   'topup_80',
  topup_200:  'topup_200',
  topup_500:  'topup_500',
  topup_1200: 'topup_1200',
};
