// ── Photodump Module Types ────────────────────────────────────

export type PhotodumpDestino   = 'feed' | 'stories' | 'tiktok';
export type PhotodumpNarrative = 'day' | 'journey' | 'brand' | 'character' | 'product_hero' | 'faceless' | 'custom';
export type PhotodumpProtagonist = 'person' | 'product' | 'both';

// ── Recetas Fase 4 ────────────────────────────────────────────
// Cada receta define internamente: protagonista implícito, slots de refs, pool de shots.
export type PhotodumpRecipe =
  | 'unboxing'      // Producto + packaging + escena
  | 'outfit'        // Persona + prendas + escena
  | 'day_in_life'   // Persona + escena + producto
  | 'launch'        // Producto + escena
  | 'bts'           // Producto/workspace + escena, nunca avatar
  | 'travel'        // Persona + escena del lugar + producto
  | 'free';         // Modo libre — editor de escenas individuales

// Qué referencias pide cada receta
export interface RecipeRefConfig {
  avatar:   'required' | 'optional' | 'none';
  outfit:   'required' | 'optional' | 'none';   // prendas (hasta 4)
  producto: 'required' | 'optional' | 'none';
  escena:   'required' | 'optional' | 'none';
}

export const RECIPE_META: Record<PhotodumpRecipe, {
  label:       string;
  description: string;
  icon:        string;
  refs:        RecipeRefConfig;
  // Qué tipo de narrativa/protagonista mapea internamente (para el service existente)
  narrative:   PhotodumpNarrative;
  protagonist: PhotodumpProtagonist;
}> = {
  unboxing: {
    label:       'Unboxing / Producto',
    description: 'El producto y su packaging como protagonistas. Podés agregar tu persona.',
    icon:        'Package',
    refs:        { avatar: 'optional', outfit: 'none', producto: 'required', escena: 'optional' },
    narrative:   'product_hero',
    protagonist: 'product',
  },
  outfit: {
    label:       'Outfit / Haul de ropa',
    description: 'Lucís la ropa. Necesitás tu foto y al menos una prenda.',
    icon:        'Shirt',
    refs:        { avatar: 'required', outfit: 'required', producto: 'none', escena: 'optional' },
    narrative:   'character',
    protagonist: 'person',
  },
  day_in_life: {
    label:       'Un día en mi vida',
    description: 'Vos como protagonista con el producto como compañero del día.',
    icon:        'Sun',
    refs:        { avatar: 'required', outfit: 'optional', producto: 'optional', escena: 'optional' },
    narrative:   'day',
    protagonist: 'both',
  },
  launch: {
    label:       'Lanzamiento de producto',
    description: 'El producto en primer plano. Podés agregar tu persona para una presentación más personal.',
    icon:        'Megaphone',
    refs:        { avatar: 'optional', outfit: 'none', producto: 'required', escena: 'optional' },
    narrative:   'product_hero',
    protagonist: 'product',
  },
  bts: {
    label:       'Detrás de escena / Faceless',
    description: 'Sin rostro. El proceso, el espacio, las manos trabajando. Podés subir tu foto para mantener piel/manos consistentes.',
    icon:        'Clapperboard',
    refs:        { avatar: 'optional', outfit: 'none', producto: 'required', escena: 'optional' },
    narrative:   'faceless',
    protagonist: 'product',
  },
  travel: {
    label:       'Viaje / Experiencia',
    description: 'Vos en un lugar. La escena del lugar es obligatoria.',
    icon:        'Plane',
    refs:        { avatar: 'required', outfit: 'optional', producto: 'optional', escena: 'required' },
    narrative:   'journey',
    protagonist: 'both',
  },
  free: {
    label:       'Modo libre',
    description: 'Definís el prompt y las referencias de cada imagen por separado.',
    icon:        'Wand2',
    refs:        { avatar: 'optional', outfit: 'optional', producto: 'optional', escena: 'optional' },
    narrative:   'custom',
    protagonist: 'both',
  },
};

// Cómo se maneja el outfit en el set
export type PhotodumpOutfitMode = 'keep' | 'generate' | 'upload';

// ── Tipos de imagen del set ────────────────────────────────────

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

// ── Referencias modo recetas ───────────────────────────────────

export interface PhotodumpRefs {
  avatarRef:    string | null;
  bodyRef?:     string | null;
  productRef:   string | null;
  productRefs?: (string | null)[];
  outfitRef:    string | null;
  outfitRefs?:  (string | null)[];   // prendas adicionales para receta outfit (hasta 3 extras)
  sceneRef:     string | null;
  sceneRefs?:   (string | null)[];
  sceneText?:   string;
  outfitMode?:  PhotodumpOutfitMode;
}

// ── Tipos modo libre ───────────────────────────────────────────

export interface FreeSceneRefs {
  personas: (string | null)[];   // hasta 4 personas, 1 foto c/u — @persona, @persona2, @persona3, @persona4
  outfit:   (string | null)[];   // máx 4
  producto: (string | null)[];   // máx 4
  escena:   (string | null)[];   // máx 1
}

export interface FreeScene {
  id:          number;
  prompt:      string;
  // Relaciones con escenas previas: array de 'escena-1', 'escena-2', etc.
  // Reemplaza el campo relation singular — soporta multi-referencia
  sceneRefs:   string[];
  // Si está activo, esta escena hereda los slots de la escena anterior (pre-rellena y editable)
  inheritRefs: boolean;
  // Índice de la escena de la que hereda (por defecto la anterior, pero editable)
  inheritFrom: number;
  refs:        FreeSceneRefs;
  // URL de la imagen generada para esta escena (null = no generada aún)
  result:      string | null;
}

// ── Set completo guardado ──────────────────────────────────────

export interface PhotodumpSet {
  id:          string;
  createdAt:   number;

  // Brief
  basePrompt:  string;
  destino:     PhotodumpDestino;
  count:       number;

  // Receta (Fase 4) — campos legados opcionales para compatibilidad con sets viejos
  recipe?:     PhotodumpRecipe;
  narrative:   PhotodumpNarrative;
  protagonist: PhotodumpProtagonist;
  customStory: string;

  // Referencias del protagonista
  refs:        PhotodumpRefs;

  // Modo libre: escenas individuales guardadas
  freeScenes?: FreeScene[];

  // Results
  images:      PhotodumpImage[];
}

// ── Helpers de slot ────────────────────────────────────────────

// Devuelve las keys de refs que una receta necesita mostrar
export function getRecipeRefKeys(recipe: PhotodumpRecipe): (keyof RecipeRefConfig)[] {
  const cfg = RECIPE_META[recipe].refs;
  return (Object.keys(cfg) as (keyof RecipeRefConfig)[]).filter(
    k => cfg[k] !== 'none'
  );
}

// Devuelve si una ref es obligatoria para la receta
export function isRefRequired(recipe: PhotodumpRecipe, ref: keyof RecipeRefConfig): boolean {
  return RECIPE_META[recipe].refs[ref] === 'required';
}

// Devuelve si la validación de refs mínimas para una receta está cumplida
export function recipeRefsValid(recipe: PhotodumpRecipe, refs: PhotodumpRefs): boolean {
  const cfg = RECIPE_META[recipe].refs;
  if (cfg.avatar   === 'required' && !refs.avatarRef)   return false;
  if (cfg.producto === 'required' && !refs.productRef)  return false;
  if (cfg.escena   === 'required' && !refs.sceneRef)    return false;
  if (cfg.outfit   === 'required' && !(refs.outfitRef || (refs.outfitRefs ?? []).some(Boolean))) return false;
  return true;
}

// Devuelve si las refs mínimas para una escena libre están cumplidas (solo requiere prompt)
export function freeSceneValid(scene: FreeScene): boolean {
  return scene.prompt.trim().length >= 5;
}

// ── Metadata legada (compatibilidad con código anterior) ───────

export const NARRATIVE_META: Record<PhotodumpNarrative, { label: string; description: string; icon: string }> = {
  day:          { label: 'Un día con el producto',   description: 'Mañana → tarde → noche. El producto como compañero del día.',               icon: '☀️' },
  journey:      { label: 'Viaje o experiencia',      description: 'Llegada, exploración, momentos, recuerdo final.',                           icon: '✈️' },
  brand:        { label: 'Mundo de marca',           description: 'Estética, valores y lifestyle que representa la marca.',                    icon: '✨' },
  character:    { label: 'El personaje y su mundo',  description: 'Quién es, qué hace, cómo vive.',                                           icon: '🎭' },
  product_hero: { label: 'El producto es el héroe',  description: 'Close-ups, texturas, usos. El producto como protagonista.',                icon: '📦' },
  faceless:     { label: 'Contenido faceless',       description: 'Sin rostro visible. BTS, empaque, manos, despachos, espacio de trabajo.',   icon: '🎬' },
  custom:       { label: 'Historia personalizada',   description: 'Describe tu propia narrativa.',                                            icon: '✍️' },
};

export const PROTAGONIST_META: Record<PhotodumpProtagonist, { label: string; description: string }> = {
  person:  { label: 'Persona / Creador',   description: 'Foco en emociones, poses y ambiente.' },
  product: { label: 'Producto / Objeto',   description: 'El producto como estrella visual.'    },
  both:    { label: 'Persona + Producto',  description: 'Relación e interacción entre ambos.'  },
};

export const DESTINO_META: Record<PhotodumpDestino, { label: string; icon: string; aspectRatio: string; hint: string }> = {
  feed:    { label: 'Instagram Feed',    icon: '📸', aspectRatio: '4/5',  hint: 'Carrusel vertical · 4:5'          },
  stories: { label: 'Instagram Stories', icon: '⭕', aspectRatio: '9/16', hint: 'Pantalla completa vertical · 9:16' },
  tiktok:  { label: 'TikTok',            icon: '🎵', aspectRatio: '9/16', hint: 'Video cover vertical · 9:16'       },
};

export const MOMENT_TYPE_META = {
  context:    { label: 'Contexto',    description: 'El ambiente y el mundo donde ocurre todo',        color: 'text-brand-600 bg-brand-50'   },
  detail:     { label: 'Detalle',     description: 'Un fragmento íntimo — textura, objeto, momento',  color: 'text-violet-700 bg-violet-50' },
  emotion:    { label: 'Emoción',     description: 'Una expresión o reacción real y genuina',         color: 'text-rose-700 bg-rose-50'     },
  texture:    { label: 'Textura',     description: 'Material, superficie, profundidad visual',        color: 'text-amber-700 bg-amber-50'   },
  action:     { label: 'Acción',      description: 'Alguien haciendo algo — en movimiento, vivo',     color: 'text-sky-700 bg-sky-50'       },
  atmosphere: { label: 'Atmósfera',   description: 'El mood del momento — luz, espacio, silencio',   color: 'text-teal-700 bg-teal-50'     },
  reveal:     { label: 'Reveal',      description: 'Un ángulo que muestra algo nuevo del set',        color: 'text-indigo-700 bg-indigo-50' },
  candid:     { label: 'Candid',      description: 'Captura espontánea — sin pose, sin artificio',    color: 'text-emerald-700 bg-emerald-50'},
};

export const STORY_ARC_META = MOMENT_TYPE_META;
