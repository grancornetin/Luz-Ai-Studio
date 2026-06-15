// ── Photodump Module Types ────────────────────────────────────

// ── Haul Types ────────────────────────────────────────────────

export type HaulItemKind =
  | 'outfit_set'   // look completo (top + bottom + calzado subido como imagen única)
  | 'garment'      // prenda individual (blusa, pantalón, vestido, etc.)
  | 'footwear'     // calzado suelto (botín, sandalia, zapatilla, zapato)
  | 'accessory'    // accesorio genérico (cinturón, sombrero, etc.)
  | 'bag'          // cartera / bolso
  | 'jewelry'      // joyería (aros, collar, pulsera, anillo)
  | 'mixed'        // imagen que combina varios tipos
  | 'unknown';     // no se pudo inferir

export type HaulPileState = 'clean' | 'light_pile' | 'medium_pile' | 'messy_but_believable';

export interface HaulItem {
  id:                          string;       // 'outfit_0', 'outfit_1', 'acc_0', etc.
  sourceIndex:                 number;       // índice original en el array de refs
  refUrl:                      string;       // URL de la referencia
  kind:                        HaulItemKind;
  label:                       string;       // 'Prenda 1', 'Accesorio 2', etc.
  closeupRequested:            boolean;      // el usuario marcó ⭐ de close-up
  tryOnEligible:               boolean;      // puede mostrarse puesto en el cuerpo (full outfit)
  footwearTryOnEligible:       boolean;      // zapatos: se pueden mostrar al nivel del pie
  detailEligible:              boolean;      // puede aparecer como detalle/macro
  canBeIntegratedIntoOutfit:   boolean;      // puede combinarse con otro outfit como complemento
  priority:                    'required' | 'normal' | 'optional';
}

export interface HaulCoveragePlan {
  requiredTryOnItemIds:    string[];  // outfit_sets y garments principales
  requiredCloseupItemIds:  string[];  // accesorios/calzado con closeupRequested
  requiredDetailItemIds:   string[];  // ítems que merecen un detail macro
  optionalItemIds:         string[];  // ítems que entran si hay espacio
  plannedCoverage:         Record<string, number>;  // itemId → shots planificados
  missingCoverage:         string[];  // ids de ítems sin cobertura planificada
}

export interface HaulManifest {
  totalItems:          number;
  outfitItems:         HaulItem[];  // garments + outfit_sets (tryOnEligible)
  footwearItems:       HaulItem[];  // calzado suelto
  accessoryItems:      HaulItem[];  // accessories + bags + jewelry
  closeupItems:        HaulItem[];  // los que tienen closeupRequested = true
  tryOnItems:          HaulItem[];  // todos los tryOnEligible (outfitItems)
  allItems:            HaulItem[];  // lista plana completa (excluye avatarRef/bodyRef)
  requestedCount:      number;      // shots de historia pedidos por el usuario
  maxStoryShots:       number;      // min(requestedCount, 20)
  coveragePlan:        HaulCoveragePlan;
}

export interface HaulProgressState {
  currentItemId?:       string;
  triedItemIds:         string[];
  remainingItemIds:     string[];
  pileState:            HaulPileState;
  triedCount:           number;
  remainingCount:       number;
}

export type PhotodumpDestino   = 'feed' | 'stories' | 'tiktok';
export type PhotodumpNarrative = 'day' | 'journey' | 'brand' | 'character' | 'product_hero' | 'faceless' | 'custom';
export type PhotodumpProtagonist = 'person' | 'product' | 'both';

// ── Recetas Fase 4 ────────────────────────────────────────────
// Cada receta define internamente: protagonista implícito, slots de refs, pool de shots.
export type PhotodumpRecipe =
  | 'unboxing'      // Producto + packaging + escena
  | 'outfit'        // Persona + prendas + escena (legado — reemplazado por los tres modos outfit)
  | 'outfit_check'  // Persona + outfit completo — historia de un look para una ocasión
  | 'outfit_haul'   // Persona + N prendas separadas — se prueban una por una con progresión
  | 'outfit_week'   // Persona + N outfits completos — variedad semanal o temática
  | 'day_in_life'   // Persona + escena + producto
  | 'launch'        // Producto + escena
  | 'bts'           // Producto/workspace + escena, nunca avatar
  | 'travel'        // Persona + escena del lugar + producto
  | 'free';         // Modo libre — editor de escenas individuales

// Qué referencias pide cada receta
export interface RecipeRefConfig {
  avatar:         'required' | 'optional' | 'none';
  outfit:         'required' | 'optional' | 'none';   // prendas del look
  accesorios:     'required' | 'optional' | 'none';   // accesorios con checkbox de close-up
  producto:       'required' | 'optional' | 'none';
  empaque:        'required' | 'optional' | 'none';   // packaging (solo receta unboxing)
  escena:         'required' | 'optional' | 'none';
  escena_prueba:  'required' | 'optional' | 'none';   // outfit_check: lugar de prueba
  escena_destino: 'required' | 'optional' | 'none';   // outfit_check: lugar final
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
    refs:        { avatar: 'optional', outfit: 'none', accesorios: 'none', producto: 'required', empaque: 'optional', escena: 'optional', escena_prueba: 'none', escena_destino: 'none' },
    narrative:   'product_hero',
    protagonist: 'product',
  },
  outfit: {
    label:       'Outfit / Haul de ropa',
    description: 'Lucís la ropa. Necesitás tu foto y al menos una prenda.',
    icon:        'Shirt',
    refs:        { avatar: 'required', outfit: 'required', accesorios: 'none', producto: 'none', empaque: 'none', escena: 'optional', escena_prueba: 'none', escena_destino: 'none' },
    narrative:   'character',
    protagonist: 'person',
  },
  outfit_check: {
    label:       'Outfit Check',
    description: 'Elegiste un outfit para una ocasión. Mostrás el look, el detalle y el destino.',
    icon:        'Shirt',
    refs:        { avatar: 'required', outfit: 'required', accesorios: 'optional', producto: 'none', empaque: 'none', escena: 'none', escena_prueba: 'optional', escena_destino: 'optional' },
    narrative:   'character',
    protagonist: 'person',
  },
  outfit_haul: {
    label:       'Haul de ropa',
    description: 'Te probás las prendas una por una. Cada prenda es un shot distinto.',
    icon:        'ShoppingBag',
    refs:        { avatar: 'required', outfit: 'required', accesorios: 'optional', producto: 'none', empaque: 'none', escena: 'optional', escena_prueba: 'none', escena_destino: 'none' },
    narrative:   'character',
    protagonist: 'person',
  },
  outfit_week: {
    label:       'Outfits de la semana',
    description: 'Mostrás varios outfits completos: tus looks de la semana, del mes o de una ocasión.',
    icon:        'CalendarDays',
    refs:        { avatar: 'required', outfit: 'required', accesorios: 'optional', producto: 'none', empaque: 'none', escena: 'optional', escena_prueba: 'none', escena_destino: 'none' },
    narrative:   'character',
    protagonist: 'person',
  },
  day_in_life: {
    label:       'Un día en mi vida',
    description: 'Vos como protagonista con el producto como compañero del día.',
    icon:        'Sun',
    refs:        { avatar: 'required', outfit: 'optional', accesorios: 'none', producto: 'optional', empaque: 'none', escena: 'optional', escena_prueba: 'none', escena_destino: 'none' },
    narrative:   'day',
    protagonist: 'both',
  },
  launch: {
    label:       'Lanzamiento de producto',
    description: 'El producto en primer plano. Podés agregar tu persona para una presentación más personal.',
    icon:        'Megaphone',
    refs:        { avatar: 'optional', outfit: 'none', accesorios: 'none', producto: 'required', empaque: 'none', escena: 'optional', escena_prueba: 'none', escena_destino: 'none' },
    narrative:   'product_hero',
    protagonist: 'product',
  },
  bts: {
    label:       'Detrás de escena / Faceless',
    description: 'Sin rostro. El proceso, el espacio, las manos trabajando. Podés subir tu foto para mantener piel/manos consistentes.',
    icon:        'Clapperboard',
    refs:        { avatar: 'optional', outfit: 'none', accesorios: 'none', producto: 'required', empaque: 'none', escena: 'optional', escena_prueba: 'none', escena_destino: 'none' },
    narrative:   'faceless',
    protagonist: 'product',
  },
  travel: {
    label:       'Viaje / Experiencia',
    description: 'Vos en un lugar. La escena del lugar es obligatoria.',
    icon:        'Plane',
    refs:        { avatar: 'required', outfit: 'optional', accesorios: 'none', producto: 'optional', empaque: 'none', escena: 'required', escena_prueba: 'none', escena_destino: 'none' },
    narrative:   'journey',
    protagonist: 'both',
  },
  free: {
    label:       'Modo libre',
    description: 'Definís el prompt y las referencias de cada imagen por separado.',
    icon:        'Wand2',
    refs:        { avatar: 'optional', outfit: 'optional', accesorios: 'none', producto: 'optional', empaque: 'none', escena: 'optional', escena_prueba: 'none', escena_destino: 'none' },
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
  avatarRef:      string | null;
  bodyRef?:       string | null;
  productRef:     string | null;
  productRefs?:   (string | null)[];
  packagingRef?:  string | null;          // empaque principal (receta unboxing)
  packagingRefs?: (string | null)[];      // ángulos extra del empaque (hasta 2 extras)
  outfitRef:      string | null;
  outfitRefs?:    (string | null)[];      // prendas adicionales (hasta 5 extras = 6 total en haul/week)
  accesorioRefs?: (string | null)[];      // accesorios con checkbox de close-up (hasta 3)
  accesorioCloseup?: boolean[];           // true = garantizar shot de close-up para ese accesorio
  sceneRef:       string | null;
  sceneRefs?:     (string | null)[];
  scenePruebaRef?: string | null;         // outfit_check: escena de prueba (habitación, espejo, probador)
  sceneDestinoRef?: string | null;        // outfit_check: escena destino (restaurante, evento, calle)
  sceneText?:     string;
  outfitMode?:    PhotodumpOutfitMode;
  gender?:        'female' | 'male' | 'neutral';  // género del avatar para HPI y captions
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

// ── Outfit Check: router semántico de brief ───────────────────────────────────

export type OutfitDestinationClass =
  | 'none'
  | 'opera_theatre'
  | 'formal_event'
  | 'restaurant_dinner'
  | 'country_club_brunch'
  | 'office_meeting'
  | 'business_event'
  | 'beach_day'
  | 'travel_airport'
  | 'urban_social_outing'
  | 'generic_outing';

export type PrepEnvironmentClass =
  | 'real_bedroom'
  | 'tidy_bedroom'
  | 'refined_bedroom'
  | 'upscale_dressing_room'
  | 'hotel_like_room'
  | 'bathroom_mirror'
  | 'fitting_room'
  | 'office_ready_room'
  | 'user_scene_locked';

export interface OutfitBriefContext {
  timeSignal:          'morning' | 'day' | 'afternoon' | 'golden_hour' | 'night' | 'unspecified';
  destinationClass:    OutfitDestinationClass;
  prepEnvironmentClass: PrepEnvironmentClass;
  destinationLabel:    string;   // descripción de destino para el prompt
  prepMood:            string;   // descripción del espacio de prep para el prompt
  destinationMood:     string;   // descripción de atmósfera del destino
  isOccasionBrief:     boolean;
  destinationShotOptions: string[]; // variaciones aceptables para el closing shot
}

// ── Outfit composition: inferida desde brief + refs ──────────────────────────
export type OutfitComposition =
  | 'top_bottom'
  | 'dress'
  | 'suit'
  | 'outerwear_top_bottom'
  | 'unknown';

// ── WearState: estado del outfit sobre el cuerpo en cada shot ─────────────────
// Se calcula por (recipe, shotKey, presentationStyle, arcPosition).
// El prompt assembly usa este valor para inyectar o bloquear reglas de outfit.
export type WearState =
  | 'not_wearing_final_outfit'   // prenda como objeto, no puesta — ARRIVING / flat_lay / hands
  | 'partially_styled'           // vistiéndose, ajustando — transición
  | 'wearing_full_outfit'        // look completo puesto y legible
  | 'ready_to_leave'             // lista/listo, mood de salida — READY
  | 'destination_arrived';       // en el destino final — DESTINATION shot

// ── OutfitItemState: estado de cada pieza concreta del outfit ─────────────────
export type OutfitItemState =
  | 'worn'                    // puesta en el cuerpo
  | 'held'                    // sostenida en mano
  | 'hanging'                 // colgada en perchero/rack
  | 'flat_lay'                // extendida sobre superficie
  | 'on_floor_before_wearing' // en el suelo, antes de ponerse
  | 'not_visible'             // no aparece en este shot
  | 'detail_focus';           // primer plano del objeto

export interface OutfitItemPlan {
  item: 'top' | 'bottom' | 'dress' | 'shoes' | 'bag' | 'jewelry' | 'accessory';
  requiredState: OutfitItemState;
  mustBeVisible: boolean;
  mayBeDuplicated: boolean;
}

// ── CameraMode: perspectiva explícita para evitar mezclas absurdas ─────────────
export type CameraMode =
  | 'hands_presenter_closeup'      // manos sosteniendo objeto hacia cámara
  | 'object_flatlay'               // overhead de objetos sobre superficie
  | 'mirror_selfie_phone_visible'  // selfie de espejo — teléfono visible apuntando al espejo
  | 'mirror_check_no_phone'        // persona revisa look en espejo, sin teléfono
  | 'third_person_mirror_capture'  // cámara externa captura persona + reflejo
  | 'selfie_pov'                   // selfie POV — cara dominante, sin teléfono visible
  | 'third_person'                 // tercero/trípode capturando a la persona
  | 'tripod_capture'               // trípode estático
  | 'detail_macro'                 // macro de detalle — sin cuerpo ni cara
  | 'rack_wide'                    // shot ancho del rack como sujeto
  | 'full_body_room'               // full body en espacio real
  | 'destination_social_pose'      // pose social creíble en destino — no catálogo
  | 'candid_third'                 // tercero captura sin que la persona "pose"
  // legado — no usar en código nuevo
  | 'mirror_selfie'
  | 'mirror_selfie_phone_hidden';

// ── SceneLockPolicy: controla qué tan anclado está el shot al espacio de REF0 ─
export type SceneLockPolicy =
  | 'strict_ref0'          // copia exacta de paredes/piso/muebles de REF0
  | 'prep_space'           // mismo cuarto/área de prueba que REF0
  | 'prep_space_or_surface' // superficie compatible con prep space (para detalles)
  | 'prep_space_or_pre_exit' // cuarto o pasillo de salida inmediata
  | 'destination_allowed'  // el destino final del brief — NO replicar el prep space
  | 'none';                // sin lock de escena

// ── PoseIntent: intención adaptativa de pose — sin reglas por venue ───────────
// Describe QUÉ hace el cuerpo, no DÓNDE está.
export type PoseIntent =
  | 'supported_standing'       // apoyada en algo — pared, columna, barra, marco
  | 'seated_social'            // sentada en contexto real — silla, escalón, borde
  | 'leaning_relaxed'          // inclinada, cuerpo con peso natural
  | 'half_turn_over_shoulder'  // torso de espaldas o tres cuartos, cara mirando atrás
  | 'candid_in_motion'         // caminando, girando, llegando — en movimiento capturado
  | 'mirror_interaction'       // interactuando con un espejo en el destino
  | 'object_interaction'       // manos activas con algo del entorno — taza, mesa, bolso
  | 'soft_environmental'       // integrada al espacio sin pose evidente — persona en lugar
  | 'casual_weight_shift'      // weight shift lateral, asimetría natural, sin pose dura
  | 'seated_candid'            // sentada pero capturada en momento no forzado
  | 'full_body_confident';     // full body solo cuando la actitud lo justifica — último recurso

// ── DetailKind: tipo de detalle para ordenar el arco outfit_check ─────────────
export type DetailKind =
  | 'pre_wear'   // prenda como objeto — antes de estar puesta (flat lay, held, rack)
  | 'worn'       // detalle del outfit ya vestido o accesorio integrado al look
  | 'accessory'; // accesorio en closeup — puede ser pre o post según el set

// ── EnvironmentAffordance: qué ofrece el entorno para una pose orgánica ───────
export type EnvironmentAffordance =
  | 'support'         // elemento para apoyarse — pared, columna, barra, árbol
  | 'seating'         // lugar para sentarse — silla, escalón, banco, borde
  | 'table_surface'   // superficie de mesa — bar, café, restaurante
  | 'mirror'          // espejo disponible en el espacio
  | 'doorway'         // marco de puerta, umbral, entrada
  | 'corridor'        // pasillo, galería, hall
  | 'open_space'      // espacio abierto sin elementos dominantes
  | 'natural_element' // árbol, escalón, pared texturada exterior
  | 'counter_bar';    // barra de bar, mostrador

// ── SceneContinuityMode: nivel de continuidad del prep space ──────────────────
export type SceneContinuityMode =
  | 'ref_locked'      // usuario subió foto de escena — continuidad máxima al REF
  | 'fingerprinted'   // REF0 inventó el espacio — fingerprint extraída y propagada
  | 'soft_match'      // solo preservar familia visual y mood, no muebles exactos
  | 'free';           // sin continuidad activa

// ── Destino inferido desde el brief ───────────────────────────────────────────
export type InferredDestination =
  | 'opera_theatre'
  | 'restaurant_dinner'
  | 'cocktail_gala'
  | 'beach_outdoor'
  | 'travel_transit'
  | 'generic_outing'     // destino sugerido pero no específico
  | 'none';              // no hay destino en el brief

// ── Set completo guardado ──────────────────────────────────────

// Debug payload — rico — se genera y guarda para admins
export interface PhotodumpShotDebug {
  shotIndex:    number;   // 0 = REF0, 1..N = shots narrativos
  role:         string;
  beat?:        string;
  key?:         string;
  prompt:       string;
  refsCount:    number;

  // Auditoría estructural
  narrativeStage?:          string;
  wearState?:               WearState;
  cameraMode?:              CameraMode;
  subjectPresence?:         string;
  sceneRole?:               string;
  shotIntent?:              string;
  presentationStyle?:       string;
  requiredItemsVisible?:    string[];
  optionalItemsVisible?:    string[];
  forbiddenDuplications?:   string[];
  mustNotWearFinalOutfit?:  boolean;
  mustWearFinalOutfit?:     boolean;
  mustIncludePhone?:        boolean;
  mustShowMirror?:          boolean;
  destinationInferred?:     InferredDestination;
  destinationExplicitRefProvided?: boolean;
  promptLayersApplied?:     string[];
  hpiApplied?:              boolean;
  hpiProfileUsed?:          string;
  hpiSource?:               'disabled' | 'filtered_outfit_hpi' | 'raw_hpi_not_allowed';
  familyBlockApplied?:      boolean;
  familyBlockMode?:         'disabled' | 'abstract_style_hint' | 'literal_prompt_block';
  possibleContradictions?:  string[];

  // Campos de cierre, política y composición
  outfitComposition?:       OutfitComposition;
  itemStatePlan?:           OutfitItemPlan[];
  isFinalShot?:             boolean;
  isClosingShot?:           boolean;
  closingStrategy?:         'destination_inferred' | 'destination_uploaded' | 'pre_exit' | 'none';
  sceneLockPolicy?:         SceneLockPolicy;
  phonePolicy?:             'required_visible' | 'allowed_visible' | 'forbidden' | 'not_applicable';

  // Nuevos campos de auditabilidad — pose, detalle, continuidad
  poseIntent?:              PoseIntent;
  detailKind?:              DetailKind;
  continuityMode?:          SceneContinuityMode;
  environmentAffordances?:  EnvironmentAffordance[];
  closureReason?:           string;

  // Haul-specific debug
  haulItemIds?:             string[];
  haulItemKinds?:           string[];
  primaryItemId?:           string;
  accessoryCloseupRequested?: boolean;
  referenceRouting?: {
    avatarRefs:         number;
    ref0Used:           boolean;
    garmentRefs:        number;
    accessoryRefs:      number;
    backgroundItemRefs: number;
  };
  haulProgressState?: {
    currentItem?:   string;
    triedCount:     number;
    remainingCount: number;
    pileState:      HaulPileState;
  };
  retryCount?:              number;
  failureReason?:           string;

  status:       'ok' | 'failed';
}

export interface PhotodumpDebugData {
  generatedAt:  string;
  recipe:       string;
  basePrompt:   string;
  inferredGender: string;
  inferredDestination?: InferredDestination;
  // Campos de conteo claros
  requestedCount:      number;
  visibleImageCount:   number;
  ref0IncludedInCount: boolean;
  storyShotCount:      number;
  generatedImageCount: number;
  failedShotCount:     number;
  // Contexto del brief
  briefContext?:       OutfitBriefContext;
  outfitComposition?:  OutfitComposition;
  destinationClass?:   OutfitDestinationClass;
  prepEnvironmentClass?: PrepEnvironmentClass;
  // Haul manifest (solo outfit_haul)
  haulManifest?:       HaulManifest;
  count:        number;
  plan:         any;
  shots:        PhotodumpShotDebug[];
}

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

  // Debug — solo presente cuando lo generó un admin
  debugData?:  PhotodumpDebugData;
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
  // empaque y accesorios nunca son required — siempre optional o none
  return true;
}

// Devuelve cuántos accesorios tienen checkbox de close-up marcado
export function countCloseupAccessories(refs: PhotodumpRefs): number {
  return (refs.accesorioCloseup ?? []).filter(Boolean).length;
}

// Devuelve todos los outfits cargados (principal + extras) como array plano
export function getAllOutfits(refs: PhotodumpRefs): string[] {
  return [refs.outfitRef, ...(refs.outfitRefs ?? [])].filter(Boolean) as string[];
}

// Devuelve todos los accesorios cargados como array plano
export function getAllAccesorios(refs: PhotodumpRefs): string[] {
  return (refs.accesorioRefs ?? []).filter(Boolean) as string[];
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
