// ── Campaign Module Types ─────────────────────────────────────

export type CampaignType = 'product' | 'brand' | 'social' | 'ecommerce';
export type CampaignObjective = 'sell' | 'awareness' | 'launch' | 'engagement';
export type CampaignAudience = 'general' | 'young' | 'professional' | 'luxury' | 'family';

export interface CampaignScene {
  sceneName:   string;
  scenePrompt: string;
  caption:     string;
  adCopy:      string;
}

export interface CampaignImage {
  imageUrl:  string;
  sceneName: string;
  prompt:    string;
  caption:   string;
  adCopy:    string;
}

export interface CampaignSet {
  id:                 string;
  createdAt:          number;
  // Brief
  basePrompt:         string;
  productDescription: string;
  campaignType:       CampaignType;
  objective:          CampaignObjective;
  audience:           CampaignAudience;
  imageCount:         number;
  // References (base64)
  references:         string[];
  // Results
  images:             CampaignImage[];
}

export const CAMPAIGN_TYPE_META: Record<CampaignType, { label: string; description: string; icon: string }> = {
  product:   { label: 'Lanzamiento de producto', description: 'Hero shot, detalles, lifestyle y CTA visual',          icon: '🚀' },
  brand:     { label: 'Posicionamiento de marca', description: 'Identidad visual, valores y presencia aspiracional',   icon: '✨' },
  social:    { label: 'Contenido para RRSS',      description: 'Carrusel, stories y posts optimizados',               icon: '📱' },
  ecommerce: { label: 'E-commerce',               description: 'Fotos de producto, ángulos y contexto de uso',        icon: '🛒' },
};

export const CAMPAIGN_OBJECTIVE_META: Record<CampaignObjective, string> = {
  sell:       'Vender / Convertir',
  awareness:  'Dar a conocer la marca',
  launch:     'Lanzar un producto',
  engagement: 'Generar interacción',
};

export const CAMPAIGN_AUDIENCE_META: Record<CampaignAudience, string> = {
  general:      'Público general',
  young:        'Jóvenes 18-30',
  professional: 'Profesionales',
  luxury:       'Segmento premium',
  family:       'Familias',
};
