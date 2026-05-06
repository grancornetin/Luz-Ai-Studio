// ── Photodump Module Types ────────────────────────────────────

export type PhotodumpNarrative = 'day' | 'journey' | 'brand' | 'character' | 'custom';
export type PhotodumpProtagonist = 'person' | 'product' | 'both';

export interface PhotodumpScene {
  moment:      string;
  scenePrompt: string;
  caption:     string;
  hashtags:    string;
}

export interface PhotodumpImage {
  imageUrl: string;
  moment:   string;
  caption:  string;
  hashtags: string;
  prompt:   string;
  order:    number;
}

export interface PhotodumpSet {
  id:          string;
  createdAt:   number;
  // Brief
  basePrompt:  string;
  narrative:   PhotodumpNarrative;
  protagonist: PhotodumpProtagonist;
  customStory: string;
  count:       number;
  // References (base64)
  references:  string[];
  // Results
  images:      PhotodumpImage[];
}

export const NARRATIVE_META: Record<PhotodumpNarrative, { label: string; description: string; icon: string }> = {
  day:       { label: 'Un día con el producto', description: 'Mañana → tarde → noche. El producto como compañero del día', icon: '☀️' },
  journey:   { label: 'Viaje o experiencia',    description: 'Llegada, exploración, momentos, recuerdo final',            icon: '✈️' },
  brand:     { label: 'Mundo de marca',         description: 'Estética, valores y lifestyle que representa la marca',     icon: '✨' },
  character: { label: 'El personaje y su mundo', description: 'Quién es, qué hace, cómo vive',                           icon: '🎭' },
  custom:    { label: 'Historia personalizada',  description: 'Describe tu propia narrativa',                             icon: '✍️' },
};

export const PROTAGONIST_META: Record<PhotodumpProtagonist, string> = {
  person:  'Persona / Influencer',
  product: 'Producto / Objeto',
  both:    'Persona + Producto',
};
