// ── Slot Catalog — Sistema universal de tipos de slots ────────────────────────
//
// Fuente de verdad para todos los módulos que usen slots tipados con tags.
// Cada receta / módulo declara qué tipos necesita y en qué cantidad.
// El sistema de tags, chips, menú desplegable y routing al modelo
// se construyen automáticamente a partir de esta declaración.

// ── Tipos disponibles en el catálogo ──────────────────────────────────────────

export type SlotType =
  | 'persona'      // Identidad del avatar (hasta 4 personas distintas)
  | 'outfit'       // Ropa completa / look
  | 'accesorio'    // Joyería, bolsos, gafas, cinturones
  | 'producto'     // Hero product que se quiere mostrar
  | 'prop'         // Objeto de contexto/acción, no el hero
  | 'textura'      // Color/finish de beauty o skincare
  | 'packaging'    // Caja, frasco, tubo del producto
  | 'escena'       // Fondo, locación, ambiente
  | 'moodboard'    // Inspiración de estilo/atmósfera general
  | 'pose'         // Postura corporal de referencia (no identidad)
  | 'expresion';   // Gesto facial de referencia (no identidad)

// ── Definición completa de cada tipo ──────────────────────────────────────────

export interface SlotTypeDef {
  type:         SlotType;
  tagBase:      string;       // base del tag sin número ("outfit" → "@outfit1")
  label:        string;       // nombre en español para la UI
  labelPlural:  string;
  description:  string;       // qué va en este slot (para el usuario)
  modelHint:    string;       // instrucción para el modelo al inyectar en prompt
  icon:         string;       // nombre del icono Lucide
  color: {
    border:  string;          // clases Tailwind para borde del slot
    bg:      string;          // clases Tailwind para fondo del slot
    badge:   string;          // clases Tailwind para el badge
    chip:    string;          // clases Tailwind para el chip de tag activo
    text:    string;          // clases Tailwind para texto del tag
  };
  maxCount:     number;       // máximo de slots de este tipo permitidos
  isIdentity:   boolean;      // true = el modelo debe preservar la identidad (persona, outfit)
                              // false = el modelo solo copia la forma/pose/color, no la persona
}

export const SLOT_CATALOG: Record<SlotType, SlotTypeDef> = {

  persona: {
    type:        'persona',
    tagBase:     'persona',
    label:       'Persona',
    labelPlural: 'Personas',
    description: 'Foto de la persona / avatar que aparecerá en las imágenes.',
    modelHint:   'IDENTITY REFERENCE: Preserve the exact appearance, skin tone, and facial features of this person.',
    icon:        'User',
    color: {
      border: 'border-indigo-300',
      bg:     'bg-indigo-50',
      badge:  'bg-indigo-600',
      chip:   'bg-indigo-100 text-indigo-700 ring-indigo-400',
      text:   'text-indigo-600',
    },
    maxCount:   4,
    isIdentity: true,
  },

  outfit: {
    type:        'outfit',
    tagBase:     'outfit',
    label:       'Outfit',
    labelPlural: 'Outfits',
    description: 'Ropa completa o prenda que llevará el avatar.',
    modelHint:   'GARMENT REFERENCE: The avatar must wear exactly this clothing item. Preserve all colors, cuts, patterns, and visible details.',
    icon:        'Shirt',
    color: {
      border: 'border-violet-300',
      bg:     'bg-violet-50',
      badge:  'bg-violet-600',
      chip:   'bg-violet-100 text-violet-700 ring-violet-400',
      text:   'text-violet-600',
    },
    maxCount:   7,
    isIdentity: false,
  },

  accesorio: {
    type:        'accesorio',
    tagBase:     'accesorio',
    label:       'Accesorio',
    labelPlural: 'Accesorios',
    description: 'Joyería, bolso, gafas, cinturón u otro accesorio.',
    modelHint:   'ACCESSORY REFERENCE: Include this accessory visibly in the shot. Preserve its exact shape, material, and color.',
    icon:        'Gem',
    color: {
      border: 'border-pink-300',
      bg:     'bg-pink-50',
      badge:  'bg-pink-600',
      chip:   'bg-pink-100 text-pink-700 ring-pink-400',
      text:   'text-pink-600',
    },
    maxCount:   4,
    isIdentity: false,
  },

  producto: {
    type:        'producto',
    tagBase:     'producto',
    label:       'Producto',
    labelPlural: 'Productos',
    description: 'El producto hero que se quiere mostrar o promocionar.',
    modelHint:   'HERO PRODUCT REFERENCE: This product must be clearly visible and recognizable in the shot. Do not alter its shape, branding, or color.',
    icon:        'ShoppingBag',
    color: {
      border: 'border-emerald-300',
      bg:     'bg-emerald-50',
      badge:  'bg-emerald-600',
      chip:   'bg-emerald-100 text-emerald-700 ring-emerald-400',
      text:   'text-emerald-600',
    },
    maxCount:   4,
    isIdentity: false,
  },

  prop: {
    type:        'prop',
    tagBase:     'prop',
    label:       'Prop',
    labelPlural: 'Props',
    description: 'Objeto de contexto o acción (un café, un libro, flores). No es el producto principal.',
    modelHint:   'PROP / CONTEXT OBJECT: Include this object naturally in the scene as a supporting element. It is NOT the hero — do not make it the focus.',
    icon:        'Coffee',
    color: {
      border: 'border-amber-300',
      bg:     'bg-amber-50',
      badge:  'bg-amber-600',
      chip:   'bg-amber-100 text-amber-700 ring-amber-400',
      text:   'text-amber-600',
    },
    maxCount:   3,
    isIdentity: false,
  },

  textura: {
    type:        'textura',
    tagBase:     'textura',
    label:       'Textura / Color',
    labelPlural: 'Texturas',
    description: 'Muestra el color o finish exacto de un producto beauty/skincare.',
    modelHint:   'TEXTURE / COLOR REFERENCE: Use this image to match the exact color, finish, and texture of the product. A lipstick shown here must appear in that exact shade — never white or generic.',
    icon:        'Palette',
    color: {
      border: 'border-rose-300',
      bg:     'bg-rose-50',
      badge:  'bg-rose-600',
      chip:   'bg-rose-100 text-rose-700 ring-rose-400',
      text:   'text-rose-600',
    },
    maxCount:   2,
    isIdentity: false,
  },

  packaging: {
    type:        'packaging',
    tagBase:     'packaging',
    label:       'Packaging',
    labelPlural: 'Packagings',
    description: 'Caja, frasco, tubo u otro empaque del producto.',
    modelHint:   'PACKAGING REFERENCE: Include this packaging element in the shot. Preserve its exact shape, material, and printed design as closely as possible.',
    icon:        'Package',
    color: {
      border: 'border-orange-300',
      bg:     'bg-orange-50',
      badge:  'bg-orange-600',
      chip:   'bg-orange-100 text-orange-700 ring-orange-400',
      text:   'text-orange-600',
    },
    maxCount:   2,
    isIdentity: false,
  },

  escena: {
    type:        'escena',
    tagBase:     'escena',
    label:       'Escena',
    labelPlural: 'Escenas',
    description: 'Fondo, locación o ambiente donde ocurre la imagen.',
    modelHint:   'SCENE / LOCATION REFERENCE: Replicate the environment, lighting, and mood of this reference. The setting should feel consistent with this image.',
    icon:        'MapPin',
    color: {
      border: 'border-sky-300',
      bg:     'bg-sky-50',
      badge:  'bg-sky-600',
      chip:   'bg-sky-100 text-sky-700 ring-sky-400',
      text:   'text-sky-600',
    },
    maxCount:   3,
    isIdentity: false,
  },

  moodboard: {
    type:        'moodboard',
    tagBase:     'moodboard',
    label:       'Moodboard',
    labelPlural: 'Moodboards',
    description: 'Imagen de inspiración de estilo o atmósfera general.',
    modelHint:   'MOOD / AESTHETIC REFERENCE: Use this image as a general style and atmosphere inspiration. Do not copy specific elements literally — capture the vibe, color palette, and mood.',
    icon:        'Layers',
    color: {
      border: 'border-teal-300',
      bg:     'bg-teal-50',
      badge:  'bg-teal-600',
      chip:   'bg-teal-100 text-teal-700 ring-teal-400',
      text:   'text-teal-600',
    },
    maxCount:   1,
    isIdentity: false,
  },

  pose: {
    type:        'pose',
    tagBase:     'pose',
    label:       'Pose',
    labelPlural: 'Poses',
    description: 'Referencia de postura corporal. El modelo copia la posición, no la persona.',
    modelHint:   'POSE REFERENCE: Replicate the body position, arm placement, and camera angle shown in this reference. DO NOT copy the person\'s identity, face, or clothing — only the pose.',
    icon:        'PersonStanding',
    color: {
      border: 'border-cyan-300',
      bg:     'bg-cyan-50',
      badge:  'bg-cyan-600',
      chip:   'bg-cyan-100 text-cyan-700 ring-cyan-400',
      text:   'text-cyan-600',
    },
    maxCount:   2,
    isIdentity: false,
  },

  expresion: {
    type:        'expresion',
    tagBase:     'expresion',
    label:       'Expresión',
    labelPlural: 'Expresiones',
    description: 'Referencia de gesto facial. El modelo copia la expresión, no la cara.',
    modelHint:   'EXPRESSION REFERENCE: Replicate the facial expression and gesture shown in this reference. DO NOT copy the person\'s identity or facial features — only the expression.',
    icon:        'Smile',
    color: {
      border: 'border-fuchsia-300',
      bg:     'bg-fuchsia-50',
      badge:  'bg-fuchsia-600',
      chip:   'bg-fuchsia-100 text-fuchsia-700 ring-fuchsia-400',
      text:   'text-fuchsia-600',
    },
    maxCount:   2,
    isIdentity: false,
  },

};

// ── Helpers del catálogo ───────────────────────────────────────────────────────

/** Devuelve la definición de un tipo de slot */
export function getSlotDef(type: SlotType): SlotTypeDef {
  return SLOT_CATALOG[type];
}

/** Genera el tag para un slot dado su tipo e índice 1-based */
export function buildTag(type: SlotType, index: number): string {
  const base = SLOT_CATALOG[type].tagBase;
  return index === 1 ? `@${base}` : `@${base}${index}`;
}

/** Parsea un tag como "@outfit3" y devuelve { type, index } o null si no reconoce */
export function parseTag(tag: string): { type: SlotType; index: number } | null {
  const raw = tag.startsWith('@') ? tag.slice(1) : tag;
  const lower = raw.toLowerCase();

  // Ordenar por longitud de tagBase descendente para evitar que "prop" matchee "producto"
  const sorted = (Object.values(SLOT_CATALOG) as SlotTypeDef[]).sort(
    (a, b) => b.tagBase.length - a.tagBase.length
  );

  for (const def of sorted) {
    const base = def.tagBase.toLowerCase();
    if (lower === base) return { type: def.type, index: 1 };
    if (lower.startsWith(base)) {
      const suffix = lower.slice(base.length);
      const n = parseInt(suffix, 10);
      if (!isNaN(n) && n >= 1 && suffix === String(n)) {
        return { type: def.type, index: n };
      }
    }
  }
  return null;
}

/** Extrae todos los tags reconocidos de un texto */
export function extractTagsFromText(text: string): Array<{ tag: string; type: SlotType; index: number }> {
  const matches = text.match(/@[a-záéíóúüñA-ZÁÉÍÓÚÜÑA-Za-z_]+\d*/g) ?? [];
  const result: Array<{ tag: string; type: SlotType; index: number }> = [];
  for (const match of matches) {
    const parsed = parseTag(match);
    if (parsed) result.push({ tag: match.toLowerCase(), ...parsed });
  }
  return result;
}

// ── Declaración de slots por receta / módulo ──────────────────────────────────
//
// Cada módulo declara qué tipos necesita y en qué cantidad.
// Usar esto como fuente de verdad en lugar de RecipeRefConfig cuando
// los slots están conectados al sistema de tags.

export interface RecipeSlotDeclaration {
  type:       SlotType;
  count:      number;                          // cuántos slots de este tipo
  required:   boolean;                         // ¿es obligatorio al menos uno?
  label?:     string;                          // override del label del catálogo
  closeup?:   boolean;                         // ¿tiene checkbox de close-up?
}

export type RecipeSlotMap = RecipeSlotDeclaration[];

export const RECIPE_SLOT_MAPS: Record<string, RecipeSlotMap> = {

  outfit_week: [
    { type: 'persona',   count: 1, required: true  },
    { type: 'outfit',    count: 7, required: true  },
    { type: 'accesorio', count: 3, required: false, closeup: true },
    { type: 'escena',    count: 1, required: false },
  ],

  outfit_haul: [
    { type: 'persona',   count: 1, required: true  },
    { type: 'outfit',    count: 7, required: true  },
    { type: 'accesorio', count: 3, required: false, closeup: true },
    { type: 'escena',    count: 1, required: false },
  ],

  outfit_check: [
    { type: 'persona',   count: 1, required: true  },
    { type: 'outfit',    count: 1, required: true  },
    { type: 'accesorio', count: 3, required: false, closeup: true },
    { type: 'escena',    count: 2, required: false },
  ],

  day_in_life: [
    { type: 'persona',   count: 1, required: true  },
    { type: 'outfit',    count: 3, required: false },
    { type: 'producto',  count: 2, required: false },
    { type: 'prop',      count: 2, required: false },
    { type: 'escena',    count: 3, required: false },
  ],

  launch: [
    { type: 'persona',   count: 1, required: false },
    { type: 'producto',  count: 2, required: true  },
    { type: 'packaging', count: 1, required: false },
    { type: 'textura',   count: 1, required: false },
    { type: 'prop',      count: 1, required: false },
    { type: 'escena',    count: 2, required: false },
  ],

  unboxing: [
    { type: 'persona',   count: 1, required: false },
    { type: 'producto',  count: 3, required: true  },
    { type: 'packaging', count: 2, required: false },
    { type: 'prop',      count: 1, required: false },
    { type: 'escena',    count: 1, required: false },
  ],

  bts: [
    { type: 'persona',   count: 1, required: false },
    { type: 'producto',  count: 2, required: true  },
    { type: 'prop',      count: 2, required: false },
    { type: 'escena',    count: 1, required: false },
  ],

  travel: [
    { type: 'persona',   count: 1, required: true  },
    { type: 'outfit',    count: 3, required: false },
    { type: 'producto',  count: 1, required: false },
    { type: 'prop',      count: 1, required: false },
    { type: 'escena',    count: 3, required: true  },
  ],

  free: [
    { type: 'persona',   count: 4, required: false },
    { type: 'outfit',    count: 4, required: false },
    { type: 'producto',  count: 4, required: false },
    { type: 'escena',    count: 1, required: false },
  ],

};

/** Devuelve todos los tags posibles para una receta dada */
export function getRecipeTagSuggestions(recipeKey: string): string[] {
  const map = RECIPE_SLOT_MAPS[recipeKey];
  if (!map) return [];
  const tags: string[] = [];
  for (const decl of map) {
    for (let i = 1; i <= decl.count; i++) {
      tags.push(buildTag(decl.type, i));
    }
  }
  return tags;
}
