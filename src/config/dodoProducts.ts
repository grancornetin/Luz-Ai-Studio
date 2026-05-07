// src/config/dodoProducts.ts
export const DODO_PRODUCTS = {
  // Plan semanal (Explorer)
  EXPLORER: 'pdt_0Ndkemfv32OrQVYJz61cC',

  // Suscripciones mensuales
  STARTER_MONTHLY: 'pdt_0NdkenhFzJay2DV5p7NjJ',
  PRO_MONTHLY: 'pdt_0Ndkenzh1TDpnBsYYb10X',
  STUDIO_MONTHLY: 'pdt_0Ndkeq69pIogTOkZoiPsU',

  // Suscripciones anuales
  STARTER_YEARLY: 'pdt_0NdkenAaZoxBR9CuacRFE',
  PRO_YEARLY: 'pdt_0Ndkep4Tk7VvkaXGgoeJm',
  STUDIO_YEARLY: 'pdt_0NdkeqknL77gFkeCJtAzR',

  // Top-ups de créditos normales
  TOPUP_30: 'pdt_0NdkerVP1qcaNPz5mEAtL',
  TOPUP_80: 'pdt_0NdkesPrt2T90Vx7Cgyao',
  TOPUP_200: 'pdt_0NdkestYwa7zXpYriJlqD',
  TOPUP_500: 'pdt_0NdkeuBMXieJkr4jjoaVu',
  TOPUP_1200: 'pdt_0NdkeuaAdzWxtjjWcyX4D',

  // Top-ups de pro-credits (Campaign / Photodump)
  PRO_TOPUP_20:  'pdt_0NeL68ULx3cZIAFCLYVCy',
  PRO_TOPUP_60:  'pdt_0NeL6FzjcMfB81pb7U8dx',
  PRO_TOPUP_150: 'pdt_0NeL6NFWLSfTo57RJXzOQ',
  PRO_TOPUP_400: 'pdt_0NeL6U6U7QmzQzczCaCJx',
} as const;

export type ProductKey = keyof typeof DODO_PRODUCTS;
