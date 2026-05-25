// ── Photodump Module Types ────────────────────────────────────

export type PhotodumpDestino = 'feed' | 'stories' | 'tiktok';
export type PhotodumpNarrative = 'day' | 'journey' | 'brand' | 'character' | 'product_hero' | 'custom';
export type PhotodumpProtagonist = 'person' | 'product' | 'both';

// Cómo se maneja el outfit en el set
// 'keep'     → usar el outfit visible en la imagen del avatar (no inventar nada)
// 'generate' → la IA elige el outfit más adecuado según el brief, refs y destino
// 'upload'   → el usuario cargó un outfit específico que debe respetarse fielmente
export type PhotodumpOutfitMode = 'keep' | 'generate' | 'upload';

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

// Referencias estructuradas del protagonista (base64 data URIs)
export interface PhotodumpRefs {
  avatarRef:   string | null;  // persona / modelo
  productRef:  string | null;  // producto / objeto
  outfitRef:   string | null;  // outfit / prendas (solo si outfitMode === 'upload')
  sceneRef:    string | null;  // escena / ambiente
  sceneText?:  string;         // descripción textual del lugar
  outfitMode?: PhotodumpOutfitMode; // cómo tratar el outfit
}

export interface PhotodumpSet {
  id:          string;
  createdAt:   number;
  // Brief
  basePrompt:  string;
  narrative:   PhotodumpNarrative;
  protagonist: PhotodumpProtagonist;
  destino:     PhotodumpDestino;
  customStory: string;
  count:       number;
  // Referencias del protagonista
  refs:        PhotodumpRefs;
  // Results
  images:      PhotodumpImage[];
}

// Qué slots mostrar según el protagonista elegido
export const PROTAGONIST_SLOTS: Record<PhotodumpProtagonist, (keyof PhotodumpRefs)[]> = {
  person:  ['avatarRef', 'sceneRef'],
  product: ['productRef', 'outfitRef', 'sceneRef'],
  both:    ['avatarRef', 'productRef', 'outfitRef', 'sceneRef'],
};

// ── Metadata ──────────────────────────────────────────────────

export const NARRATIVE_META: Record<PhotodumpNarrative, { label: string; description: string; icon: string }> = {
  day:          { label: 'Un día con el producto',   description: 'Mañana → tarde → noche. El producto como compañero del día.',   icon: '☀️' },
  journey:      { label: 'Viaje o experiencia',      description: 'Llegada, exploración, momentos, recuerdo final.',               icon: '✈️' },
  brand:        { label: 'Mundo de marca',           description: 'Estética, valores y lifestyle que representa la marca.',        icon: '✨' },
  character:    { label: 'El personaje y su mundo',  description: 'Quién es, qué hace, cómo vive.',                               icon: '🎭' },
  product_hero: { label: 'El producto es el héroe',  description: 'Close-ups, texturas, usos. El producto como protagonista.',    icon: '📦' },
  custom:       { label: 'Historia personalizada',   description: 'Describe tu propia narrativa.',                                icon: '✍️' },
};

export const PROTAGONIST_META: Record<PhotodumpProtagonist, { label: string; description: string }> = {
  person:  { label: 'Persona / Creador', description: 'Foco en emociones, poses y ambiente.' },
  product: { label: 'Producto / Objeto', description: 'El producto como estrella visual.'    },
  both:    { label: 'Persona + Producto', description: 'Relación e interacción entre ambos.' },
};

export const DESTINO_META: Record<PhotodumpDestino, { label: string; icon: string; aspectRatio: string; hint: string }> = {
  feed:    { label: 'Instagram Feed',   icon: '📸', aspectRatio: '4/5',  hint: 'Carrusel vertical · 4:5' },
  stories: { label: 'Instagram Stories', icon: '⭕', aspectRatio: '9/16', hint: 'Pantalla completa vertical · 9:16' },
  tiktok:  { label: 'TikTok',           icon: '🎵', aspectRatio: '9/16', hint: 'Video cover vertical · 9:16' },
};

export const STORY_ARC_META = {
  hook:        { label: 'Gancho',      description: 'Para el scroll — la primera impresión',   color: 'text-brand-600 bg-brand-50' },
  development: { label: 'Desarrollo',  description: 'La historia que engancha y conecta',       color: 'text-violet-700 bg-violet-50' },
  closing:     { label: 'Cierre',      description: 'La imagen que genera acción — save, share', color: 'text-emerald-700 bg-emerald-50' },
};
