// src/services/checkoutService.ts
import { DODO_PRODUCTS, type ProductKey } from '../config/dodoProducts';

const RETURN_URL = `${import.meta.env.VITE_APP_URL || 'https://luz-ia-studio-1.vercel.app'}/checkout/success`;

export { DODO_PRODUCTS };
export type { ProductKey };

export function buildCheckoutUrl(productKey: ProductKey, userId: string): string {
  const productId = DODO_PRODUCTS[productKey];
  const params = new URLSearchParams({
    quantity: '1',
    customer_id: userId,
    return_url: RETURN_URL,
  });
  return `https://checkout.dodopayments.com/buy/${productId}?${params.toString()}`;
}

export const PLAN_TO_PRODUCT: Record<string, ProductKey> = {
  weekly:  'EXPLORER',
  starter: 'STARTER_MONTHLY',
  pro:     'PRO_MONTHLY',
  studio:  'STUDIO_MONTHLY',
};

export const PLAN_TO_PRODUCT_YEARLY: Record<string, ProductKey> = {
  starter: 'STARTER_YEARLY',
  pro:     'PRO_YEARLY',
  studio:  'STUDIO_YEARLY',
};

export const TOPUP_TO_PRODUCT: Record<string, ProductKey> = {
  topup_30:   'TOPUP_30',
  topup_80:   'TOPUP_80',
  topup_200:  'TOPUP_200',
  topup_500:  'TOPUP_500',
  topup_1200: 'TOPUP_1200',
};

export const PRO_TOPUP_TO_PRODUCT: Record<string, ProductKey> = {
  pro_topup_20:  'PRO_TOPUP_20',
  pro_topup_60:  'PRO_TOPUP_60',
  pro_topup_150: 'PRO_TOPUP_150',
  pro_topup_400: 'PRO_TOPUP_400',
};