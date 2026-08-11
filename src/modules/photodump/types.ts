// ── Photodump Module Types ────────────────────────────────────

// ── Haul Types ────────────────────────────────────────────────

// HaulRefKind — valor elegido manualmente por el usuario en el selector de tipo de referencia.
// Tiene más granularidad que HaulItemKind porque el usuario lo ve directamente.
export type HaulRefKind =
  | 'look_completo'     // La imagen muestra un outfit armado para usarse junto
  | 'varios_items'      // La imagen contiene múltiples productos que no forman un solo look
  | 'top'               // Prenda superior individual
  | 'bottom'            // Prenda inferior individual
  | 'vestido'           // Vestido completo
  | 'enterizo'          // Enterizo / jumpsuit / bodysuit / mameluco
  | 'chaqueta'          // Chaqueta / blazer / abrigo / outerwear
  | 'calzado'           // Calzado suelto (zapato, botín, sandalia, zapatilla)
  | 'pantys'            // Pantys / medias / leggings
  | 'bolso'             // Bolso / cartera / tote
  | 'joyeria'           // Joyería genérica (legacy — preferir los tipos desglosados de abajo)
  | 'aros'              // Aros / pendientes
  | 'collar'            // Collar / cadena
  | 'anillo'            // Anillo
  | 'pulsera'           // Pulsera / tobillera
  | 'accesorio'         // Accesorio genérico (legacy — preferir los tipos desglosados de abajo)
  | 'cinturon'          // Cinturón
  | 'panoleta'          // Pañoleta / bufanda / pañuelo
  | 'scrunchie'         // Scrunchie / cintillo / accesorio de pelo
  | 'sombrero'          // Sombrero / gorra
  | 'gafas'             // Gafas / lentes de sol
  | 'maquillaje'        // Maquillaje / labial / color-swatch (usado hoy solo por outfit_week)
  | 'skincare'          // Skincare / sérum / crema / producto de cuidado (usado hoy solo por outfit_week)
  // ── Tipos de producto genérico (receta product_haul) ──
  | 'gadget_tech'       // Gadget / dispositivo tech — se sostiene y usa
  | 'food_drink'        // Comida / bebida — se sostiene o consume
  | 'wellness_item'     // Producto de bienestar / suplemento — se sostiene o exhibe
  | 'producto_generico' // Producto genérico sin categoría específica — se sostiene o exhibe
  // ── Tipo de acompañante (receta day_in_life) ──
  | 'acompanante'       // Persona acompañante subida por el slot producto — activa shots grupales
  | 'auto';             // Sin selección manual — usar heurística automática

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

// Estado del ítem en la progresión del haul — para evitar duplicaciones ilógicas
export type HaulItemState =
  | 'untried'           // aún no se mostró
  | 'currently_worn'    // puesta en el cuerpo en este shot
  | 'being_held'        // sostenida con manos — no puesta
  | 'on_bed'            // dejada sobre la cama (ya probada)
  | 'on_chair'          // colgada o doblada en silla
  | 'on_floor'          // en el suelo
  | 'tried_done'        // ya apareció y se pasó a la siguiente
  | 'featured_closeup'; // protagonizó un closeup dedicado

// Cómo puede aparecer un ítem según su tipo — bloquea transformaciones prohibidas
export type HaulItemAllowedUseMode =
  | 'worn_as_complete_look'    // full_outfit: usado completo en el cuerpo
  | 'worn_as_garment_layer'    // top/bottom/outerwear: pieza individual puesta
  | 'worn_as_dress'            // dress: pieza completa de hombro a dobladillo
  | 'worn_as_onepiece'         // enterizo/jumpsuit
  | 'worn_as_styling_layer'    // hosiery: capa de medias/pantys visible en piernas
  | 'worn_on_feet'             // footwear: en los pies, held, or on surface
  | 'held_or_carried'          // bag: sostenida o en hombro
  | 'worn_as_accessory'        // accessory genérico: puesto o sostenido
  | 'worn_as_jewelry'          // jewelry: macro, en cuerpo, o held
  | 'displayed_as_object';     // cualquier ítem como objeto, no puesto

// Mapa físico del mundo capturado desde REF0 para anclar el espacio de haul
export interface HaulWorldMap {
  // Elementos de arquitectura detectados en REF0
  hasBed:          boolean;
  bedCount:        number;     // cuántas camas (máx 1 en haul normal)
  hasWindow:       boolean;
  hasRack:         boolean;    // rack de ropa
  hasMirror:       boolean;    // espejo de cuerpo entero o de pared
  hasChair:        boolean;
  hasDresser:      boolean;
  hasDesk:         boolean;
  hasOfficeFurniture: boolean; // escritorio de oficina, silla de oficina
  // Elementos de clutter de haul presentes en REF0
  hasShoppingBags: boolean;
  hasCardboardBoxes: boolean;
  // Elementos de escena
  lightSource:     'natural_window' | 'artificial' | 'mixed' | 'unknown';
  lightDirection:  string;
  roomMood:        string;
  // Superficies permitidas para desplegar ropa
  allowedClothingSurfaces: string[];   // e.g. ['bed', 'chair', 'floor']
  // Lista de objetos grandes que SÍ existen en REF0
  allowedLargeFurniture: string[];
  // Lista de objetos prohibidos (no aparecen en REF0)
  forbiddenInventions: string[];
  // Nivel máximo de desorden visual permitido
  maxClutterLevel: 'minimal' | 'light' | 'medium' | 'high';
  // Resumen en texto para inyectar en el prompt
  worldLockSummary: string;
}

// Componentes semánticos internos de un look_completo / full_outfit.
// Derivados del selector manual o inferidos desde el prompt/brief del usuario.
// Permiten al planner y al prompter saber qué piezas debe preservar el modelo.
export interface HaulOutfitComponents {
  hasTop:       boolean;   // top / blusa / camiseta visible
  hasBottom:    boolean;   // pantalón / falda / short visible
  hasDress:     boolean;   // vestido o pieza one-piece que reemplaza top+bottom
  hasOuterwear: boolean;   // chaqueta / blazer / abrigo visible
  hasFootwear:  boolean;   // calzado visible (cualquier tipo)
  hasHosiery:   boolean;   // pantys / medias / leggings visibles bajo otro item
  hasBag:       boolean;   // bolso / cartera visible en el look
  hasJewelry:   boolean;   // joyería visible (aretes, collar, pulsera, anillo)
  hasAccessory: boolean;   // accesorio adicional (cinturón, sombrero, gafas, etc.)
  // Señal de riesgo de integración anatómica: calzado alto + pierna cubierta
  footwearLegCoverageRisk: boolean;
  // Descripción compacta de los componentes para inyectar en el prompt
  componentsSummary: string;
}

export interface HaulItem {
  id:                          string;       // 'outfit_0', 'outfit_1', 'acc_0', etc.
  sourceIndex:                 number;       // índice original en el array de refs
  refUrl:                      string;       // URL de la referencia
  kind:                        HaulItemKind;
  manualKind:                  HaulRefKind;      // valor elegido por el usuario ('auto' = no eligió)
  resolvedKind:                HaulResolvedKind; // kind normalizado para prompt y planner
  promptKindLabel:             string;           // etiqueta en inglés para el prompt
  label:                       string;       // 'Prenda 1', 'Accesorio 2', etc.
  closeupRequested:            boolean;      // el usuario marcó ⭐ de close-up
  tryOnEligible:               boolean;      // puede mostrarse puesto en el cuerpo (full outfit)
  footwearTryOnEligible:       boolean;      // zapatos: se pueden mostrar al nivel del pie
  detailEligible:              boolean;      // puede aparecer como detalle/macro
  canBeIntegratedIntoOutfit:   boolean;      // puede combinarse con otro outfit como complemento
  priority:                    'required' | 'normal' | 'optional';
  // Solo presente para resolvedKind === 'full_outfit' o 'mixed_set'
  // Describe qué piezas componen el look para prompting y validación de fidelidad
  outfitComponents?:           HaulOutfitComponents;
}

export type HaulResolvedKind =
  | 'full_outfit'    // look_completo
  | 'mixed_set'      // varios_items
  | 'top'
  | 'bottom'
  | 'dress'          // vestido
  | 'onepiece'       // enterizo/jumpsuit/bodysuit
  | 'outerwear'      // chaqueta/abrigo
  | 'footwear'       // calzado
  | 'hosiery'        // pantys/medias
  | 'bag'            // bolso/cartera
  | 'jewelry'        // joyería
  | 'accessory'      // accesorio genérico
  | 'unknown_visual_item'; // auto sin heurística

export type HaulCoverageRole = 'hero' | 'support' | 'context';

// ── Styling Graph — pairing semántico entre ítems del haul ────
export interface HaulStyledCombination {
  id:                   string;
  label:                string;
  itemIds:              string[];
  primaryWearableId?:   string;    // ítem principal puesto en el cuerpo
  topId?:               string;
  bottomId?:            string;
  dressId?:             string;
  onepieceId?:          string;
  outerwearId?:         string;
  footwearId?:          string;
  hosieryId?:           string;
  bagId?:               string;
  jewelryIds?:          string[];
  accessoryIds?:        string[];
  compatibilityScore:   number;    // 0–100
  compatibilityReason:  string;
  risky?:               boolean;   // combinación posible pero potencialmente extraña
}

export interface HaulStylingGraph {
  combinations:     HaulStyledCombination[];
  standaloneItems:  string[];   // ítems sin pairing posible — van como detail/held
  unpairedItems:    string[];   // ítems sin ningún wearable base disponible
  warnings:         string[];
}

// ── Shot Item Plan — qué aparece (y qué NO) en cada shot ──────
export interface HaulShotItemPlan {
  primaryItems:      string[];   // ítems protagonistas del shot
  wornItems:         string[];   // ítems usados en el cuerpo
  heldItems:         string[];   // ítems sostenidos en mano (NOT worn simultaneously)
  surfaceItems:      string[];   // ítems sobre cama/silla/suelo/caja
  backgroundItems:   string[];   // ítems secundarios visibles de fondo
  forbiddenItems:    string[];   // ítems que NO deben aparecer
  supportBaseLook?:  boolean;    // si usa base neutral no-producto
  combinationId?:    string;     // ref a HaulStyledCombination si aplica
  integrationNote?:  string;     // descripción de la integración para el prompt
}

export interface HaulCoverageLedgerItem {
  itemId:                      string;
  manualKind:                  HaulRefKind;
  resolvedKind:                HaulResolvedKind;
  label:                       string;
  required:                    boolean;
  plannedHeroShots:            number;
  plannedIntegratedShots:      number;   // shots donde aparece integrado en combinación
  plannedSupportShots:         number;
  actualPromptedHeroShots:     number;
  actualPromptedSupportShots:  number;
  // Shots hero donde la referencia primaria del item fue realmente routeada al generador.
  actualRoutedHeroRefs?:       number;
  // 'planned_not_routed': el shot existió y no falló, pero la ref primaria no llegó al modelo.
  coverageStatus:              'uncovered' | 'support_only' | 'integrated' | 'covered' | 'overexposed' | 'planned_not_routed';
  shotIds:                     string[];
  // Para look_completo: qué componentes del outfit deben estar presentes para considerar cobertura real
  // 'full' = look completo con todos los componentes principales
  // 'partial' = al menos 1 pieza clave visible (warning)
  // 'none' = item nunca apareció
  fidelityLevel?:              'full' | 'partial' | 'none';
  // Nota de fidelidad para debug — describe si el item apareció con o sin sus componentes clave
  fidelityNote?:               string;
}

export interface HaulCoveragePlan {
  requiredTryOnItemIds:    string[];  // outfit_sets y garments principales
  requiredCloseupItemIds:  string[];  // accesorios/calzado con closeupRequested
  requiredDetailItemIds:   string[];  // ítems que merecen un detail macro
  optionalItemIds:         string[];  // ítems que entran si hay espacio
  plannedCoverage:         Record<string, number>;  // itemId → shots planificados
  missingCoverage:         string[];  // ids de ítems sin cobertura planificada
  // Ledger extendido
  ledger:                  HaulCoverageLedgerItem[];
  uncoveredRequiredItems:  string[];
  supportOnlyItems:        string[];
  overexposedItems:        string[];
  coverageWarnings:        string[];
}

// ── Visual Reference Analysis ─────────────────────────────────
// Resultado del análisis multimodal de una referencia individual.
// Generado por geminiService.analyzeVisualReferences() — una sola llamada
// para todas las imágenes. Reutilizable por cualquier módulo (haul, outfit_check, etc.).
export interface VisualRefAnalysis {
  index:               number;           // posición en el array original de refs
  resolvedKind:        HaulResolvedKind; // tipo detectado visualmente por Gemini
  confidence:          'high' | 'medium' | 'low';
  components:          HaulOutfitComponents;
  visualDescription:   string;           // descripción compacta de lo visible: colores, piezas, materiales
  dominantColors:      string[];         // máximo 3: ['blanco roto', 'negro', 'beige']
  hasPerson:           boolean;          // si hay una persona usando las prendas en la imagen
  isFlatlayOrProduct:  boolean;          // si es flat lay, producto solo o collage
}

export interface VisualRefsAnalysisResult {
  refs:      VisualRefAnalysis[];
  analyzedAt: number;   // timestamp — para saber si el análisis es del run actual
}

export interface HaulBaseStartingLook {
  id:           'base_starting_look';
  label:        string;
  description:  string;
  isHaulItem:   false;
  allowedShots: string[];
  forbiddenShots: string[];
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
  stylingGraph?:       HaulStylingGraph;   // pairing semántico — se rellena post-manifest
  baseStartingLook:    HaulBaseStartingLook;
}

export interface HaulProgressState {
  currentItemId?:       string;
  triedItemIds:         string[];
  remainingItemIds:     string[];
  pileState:            HaulPileState;
  triedCount:           number;
  remainingCount:       number;
}

// ── Product Haul Types (receta product_haul) ──────────────────
// Análogos a los tipos Haul de arriba pero para productos genéricos en vez de
// ropa. Sin styling graph ni scoring de compatibilidad — cada producto es
// independiente, no se combina con otros como una prenda con un outfit.

// Tipo normalizado del ítem para prompt y planner — deriva de HaulRefKind
export type ProductHaulResolvedKind =
  | 'skincare'
  | 'makeup'
  | 'gadget'
  | 'food_drink'
  | 'wellness'
  | 'generic_product'
  | 'unknown_product';

// Cómo interactúa el avatar con el producto — condiciona el shot builder
export type ProductInteractionMode =
  | 'applied_to_face_or_body'  // skincare/makeup: se aplica sobre rostro/cuerpo
  | 'held_and_used'            // gadget/tech: se sostiene y se usa activamente
  | 'held_or_consumed'         // food/drink: se sostiene o se consume
  | 'held_or_displayed';       // wellness/genérico: se sostiene o se exhibe

export interface ProductHaulItem {
  id:                  string;   // 'product_0', 'product_1', 'packaging_0', etc.
  sourceIndex:         number;   // índice original en el array de refs
  refUrl:              string;
  manualKind:          HaulRefKind;              // valor elegido por el usuario ('auto' = no eligió)
  resolvedKind:        ProductHaulResolvedKind;   // kind normalizado para prompt y planner
  interactionMode:     ProductInteractionMode;
  promptKindLabel:     string;   // etiqueta en inglés para el prompt
  label:               string;   // 'Producto 1', 'Producto 2', etc.
  isPackaging:         boolean;  // true = viene del slot empaque, no del slot producto
  priority:            'required' | 'normal' | 'optional';
}

export interface ProductHaulCoverageLedgerItem {
  itemId:                      string;
  manualKind:                  HaulRefKind;
  resolvedKind:                ProductHaulResolvedKind;
  label:                       string;
  required:                    boolean;
  plannedHeroShots:            number;
  plannedSupportShots:         number;
  actualPromptedHeroShots:     number;
  actualPromptedSupportShots:  number;
  coverageStatus:              'uncovered' | 'support_only' | 'covered' | 'overexposed' | 'planned_not_routed';
  shotIds:                     string[];
}

export interface ProductHaulCoveragePlan {
  requiredFeatureItemIds: string[];  // todos los productos del slot producto
  optionalItemIds:        string[];  // empaque sin cobertura obligatoria propia
  plannedCoverage:        Record<string, number>;  // itemId → shots planificados
  missingCoverage:        string[];
  ledger:                 ProductHaulCoverageLedgerItem[];
  uncoveredRequiredItems: string[];
  supportOnlyItems:       string[];
  overexposedItems:       string[];
  coverageWarnings:       string[];
}

// Qué aparece (y qué NO) en cada shot — mismo rol que HaulShotItemPlan
export interface ProductHaulShotItemPlan {
  primaryItems:      string[];   // ítems protagonistas del shot
  heldItems:         string[];   // ítems sostenidos en mano
  surfaceItems:       string[];  // ítems sobre mesa/superficie
  backgroundItems:   string[];   // ítems secundarios visibles de fondo
  forbiddenItems:    string[];   // ítems que NO deben aparecer
  integrationNote?:  string;     // descripción de la integración para el prompt
}

export interface ProductHaulManifest {
  totalItems:          number;
  featuredItems:       ProductHaulItem[];  // productos del slot producto (todos required)
  packagingItems:      ProductHaulItem[];  // ítems del slot empaque (opcionales)
  allItems:            ProductHaulItem[];  // lista plana completa (excluye avatarRef)
  requestedCount:      number;      // shots de historia pedidos por el usuario
  maxStoryShots:       number;      // min(requestedCount, 20)
  coveragePlan:        ProductHaulCoveragePlan;
}

// ── Day In Life Types (receta day_in_life) ────────────────────
// "Un día en mi vida" — a diferencia de todas las demás recetas, soporta
// MULTI-MUNDO: el brief puede describir varios momentos/lugares del día
// (ej: "gym en la mañana, oficina, cena con amigas"), cada uno con su propia
// escena y su propio REF0 encadenado — no un único mundo físico compartido.

// Rol narrativo de cada shot dentro de un bloque del día — mapea los 4
// ingredientes identificados en referencias reales de photodump: retrato
// protagonista, detalle que ancla el lugar, ambiente sin persona, y momento
// social con acompañante (si hay referencia de acompañante subida).
export type DayBlockShotRole =
  | 'BLOCK_ESTABLISH'   // retrato/selfie protagonista con el outfit/mood del bloque
  | 'BLOCK_DETAIL'      // el objeto/comida/producto que ancla el lugar
  | 'BLOCK_AMBIENCE'    // toma de ambiente/lugar sin la persona
  | 'BLOCK_COMPANION';  // momento social con acompañante — solo si hay companionRef

export interface DayBlock {
  id:          string;      // 'block_0', 'block_1', 'block_2'
  label:       string;      // "Gym", "Oficina", "Cena con amigas"
  timeSignal:  OutfitBriefContext['timeSignal'];
  sceneHint:   string;      // descripción corta para generar la escena de este bloque
  order:       number;
}

export interface DayBlockCoverageLedgerItem {
  blockId:                     string;
  label:                       string;
  required:                    boolean;   // siempre true — todo bloque detectado necesita cobertura
  plannedHeroShots:            number;
  plannedSupportShots:         number;
  actualPromptedHeroShots:     number;
  actualPromptedSupportShots:  number;
  coverageStatus:              'uncovered' | 'support_only' | 'covered' | 'overexposed' | 'planned_not_routed';
  shotIds:                     string[];
}

export interface DayInLifeCoveragePlan {
  requiredBlockIds:       string[];  // todos los bloques detectados — todos required
  plannedCoverage:        Record<string, number>;  // blockId → shots planificados
  missingCoverage:        string[];
  ledger:                 DayBlockCoverageLedgerItem[];
  uncoveredRequiredItems: string[];  // blockIds sin cobertura — nombre compartido con otras recetas para reuso de UI de debug
  supportOnlyItems:       string[];
  overexposedItems:       string[];
  coverageWarnings:       string[];
}

export interface DayInLifeManifest {
  blocks:           DayBlock[];
  companionRefs:    string[];   // refs de acompañante subidas (vía slot producto + tipo 'acompanante')
  sharedOutfitRefs: string[];   // outfit/producto sin bloque asignado — aplican a todos los bloques
  requestedCount:   number;
  maxStoryShots:    number;     // min(requestedCount, 20)
  coveragePlan:     DayInLifeCoveragePlan;
}

// Resultado de un REF0 individual dentro de la cadena multi-bloque
export interface DayInLifeRef0ChainEntry {
  blockId:       string;
  imageUrl:      string;
  ref0Analysis:  any;
  fingerprint:   import('./recipes/shared').SceneFingerprint;
  chainedFromPreviousBlock: boolean;  // true para bloque 1+ — usó el REF0 anterior como referencia
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
  | 'outfit_multi_look' // Persona + N looks completos — semana, antes/ahora, calificar, viaje o ideas curadas
  | 'outfit_reveal_basic' // Persona + 1 outfit (N prendas combinadas) — 3 ángulos fijos: mirror check, POV, close-up
  | 'outfit_night_out' // Persona + 1 outfit de noche — preparación, mirror check y el venue (bar/fiesta/restaurante)
  | 'day_in_life'   // Persona + escena + producto
  | 'product_haul'  // Persona + N productos — se prueban/usan uno por uno, con empaque opcional
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

// ── outfit_multi_look: intenciones ─────────────────────────────
// Una sola receta, 4 historias distintas — solo cambia cantidad de looks,
// jerarquía entre ellos, y si el fondo es fijo o varía por shot.
// (rate_check se eliminó julio 2026: 1 sola foto de espejo no aportaba
// suficiente riqueza visual como intención propia — esa historia ya la
// cubre mejor outfit_reveal_basic, con 3 ángulos deliberados del mismo look.
// Ver manifiesto 11_session_log..., sección 6/6quater actualizadas.)
export type MultiLookIntent = 'weekly' | 'then_vs_now' | 'trip_recap' | 'curated_ideas';

// Derivado de intent, no se pide aparte al usuario:
//   weekly | then_vs_now | curated_ideas → 'fixed_single_anchor'
//   trip_recap                            → 'variable_per_shot'
export type MultiLookBackgroundMode = 'fixed_single_anchor' | 'variable_per_shot';

export interface MultiLookLookItem {
  id:          string;    // 'look_0', 'look_1'...
  sourceIndex: number;    // índice en [outfitRef, ...outfitRefs]
  refUrl:      string;
  label:       string;
  era?:        'before' | 'after';  // solo then_vs_now
  // solo trip_recap — imagen real del lugar (slot @escenaN, asociada por
  // posición al look correspondiente). Nunca texto libre ni inventado: el
  // usuario sube una foto real del lugar (propia o encontrada), el modelo
  // la usa como referencia visual directa — más fiel que describir el
  // nombre de memoria, y consistente con cómo el resto de la app usa @escena.
  placeSceneUrl?: string;
}

// curated_ideas: pool general de calzado/accesorios opcional, con enlace
// many-to-many a looks (un accesorio puede combinar con más de un look).
// El usuario declara el enlace explícitamente con chips en la UI — no hay
// scoring automático de compatibilidad (eso es de outfit_haul, un problema
// distinto: ahí N accesorios sueltos se emparejan solos entre sí).
export interface MultiLookAccessory {
  id:            string;    // 'acc_0', 'acc_1'...
  sourceIndex:   number;    // índice en curatedIdeasAccessoryRefs
  refUrl:        string;
  linkedLookIds: string[];  // ids de MultiLookLookItem con los que combina
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
    label:       'Favoritos de la semana',
    description: 'Mostrás outfits, accesorios, beauty products o favoritos de la semana.',
    icon:        'CalendarDays',
    refs:        { avatar: 'required', outfit: 'optional', accesorios: 'optional', producto: 'optional', empaque: 'optional', escena: 'optional', escena_prueba: 'none', escena_destino: 'none' },
    narrative:   'character',
    protagonist: 'person',
  },
  outfit_multi_look: {
    label:       'Varios looks',
    description: 'Mostrás varios looks en una sola tanda: tu semana, un antes/ahora, ideas para una ocasión, o los outfits de tu viaje.',
    icon:        'Images',
    // accesorios queda en 'none': el pool de calzado/joyas de curated_ideas
    // usa su propio bloque de UI (curatedIdeasAccessoryRefs/-Links, con chips
    // de enlace many-to-many), no el slot genérico accesorioRefs/-Closeup
    // que tiene shape y semántica distintos en outfit_haul/outfit_week.
    refs:        { avatar: 'required', outfit: 'required', accesorios: 'none', producto: 'none', empaque: 'none', escena: 'optional', escena_prueba: 'none', escena_destino: 'none' },
    narrative:   'character',
    protagonist: 'person',
  },
  outfit_reveal_basic: {
    label:       'Muestra un look',
    description: 'Un outfit completo desde 3 ángulos distintos: mirror check, perfil o espalda, y un close-up.',
    icon:        'Sparkles',
    refs:        { avatar: 'required', outfit: 'required', accesorios: 'none', producto: 'none', empaque: 'none', escena: 'optional', escena_prueba: 'none', escena_destino: 'none' },
    narrative:   'character',
    protagonist: 'person',
  },
  outfit_night_out: {
    label:       'Look de noche',
    description: 'El look completo para salir: preparación, mirror check y el venue.',
    icon:        'Martini',
    // producto: 'optional' habilita el slot ya usado por day_in_life para marcar una foto
    // como "Acompañante" (mismo mecanismo, sin campo de UI nuevo).
    refs:        { avatar: 'required', outfit: 'required', accesorios: 'none', producto: 'optional', empaque: 'none', escena: 'optional', escena_prueba: 'none', escena_destino: 'none' },
    narrative:   'character',
    protagonist: 'person',
  },
  day_in_life: {
    label:       'Un día en mi vida',
    description: 'Contá tu día — un momento o varios (mañana, tarde, noche). Cada momento puede tener su propia escena.',
    icon:        'Sun',
    refs:        { avatar: 'required', outfit: 'optional', accesorios: 'none', producto: 'optional', empaque: 'none', escena: 'optional', escena_prueba: 'none', escena_destino: 'none' },
    narrative:   'day',
    protagonist: 'both',
  },
  product_haul: {
    label:       'Haul de productos',
    description: 'Mostrás/probás un set de productos, uno por uno. "Miren lo que me llegó" o "mis esenciales para X".',
    icon:        'ShoppingBag',
    refs:        { avatar: 'required', outfit: 'none', accesorios: 'none', producto: 'required', empaque: 'optional', escena: 'optional', escena_prueba: 'none', escena_destino: 'none' },
    narrative:   'product_hero',
    protagonist: 'both',
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
  // Haul: tipo de referencia elegido manualmente por el usuario por cada slot de outfit/accesorio
  // Índice 0..N corresponde a [outfitRef, outfitRefs[0], outfitRefs[1], ...]
  // Para accesorios: índice 0..M corresponde a accesorioRefs[]
  haulOutfitKinds?:    HaulRefKind[];   // kinds para slots de outfit en haul
  haulAccKinds?:       HaulRefKind[];   // kinds para slots de accesorio en haul
  // outfit_week: tipo de referencia por slot de producto (índice 0..N corresponde a
  // [productRef, productRefs[0], productRefs[1], ...]) — permite distinguir maquillaje/
  // skincare/producto genérico subido por el slot producto en vez del slot outfit/accesorio.
  haulProductKinds?:   HaulRefKind[];
  // weeklyFavoritesV2: casillero junto al slot de cuerpo/avatar — true si el usuario
  // marcó que el avatar subido ya trae puesto su outfit definitivo (no reemplazar,
  // no generar uno nuevo por estilo). Ausente/false = tratar el avatar como neutro.
  avatarHasDefinitiveOutfit?: boolean;
  // day_in_life: acompañante opcional para shots grupales — subido por el slot
  // producto con haulProductKinds[i] === 'acompanante'. Se resuelve en el manifest,
  // no vive como slot propio en RecipeRefConfig (evita tocar el tipo compartido).
  companionRef?: string | null;
  // outfit_multi_look: intención elegida por el usuario, determina el motor de fondo/pose.
  multiLookIntent?: MultiLookIntent;
  // Arrays paralelos indexados igual que haulOutfitKinds: índice 0..N corresponde
  // a [outfitRef, outfitRefs[0], outfitRefs[1], ...]
  multiLookEras?:   ('before' | 'after' | null)[];   // solo then_vs_now
  // trip_recap: el lugar de cada look ahora usa el slot @escenaN (imagen
  // real, sceneRefs) asociado por posición al look correspondiente — ver
  // manifest.ts. No hay campo propio acá, se reusa sceneRefs directamente.
  // curated_ideas: pool de accesorios (calzado/joyas) subido por el slot
  // accesorios — separado de accesorioRefs porque ese campo ya tiene
  // semántica propia en outfit_haul/outfit_week (shape distinto).
  curatedIdeasAccessoryRefs?:  (string | null)[];
  // Paralelo al array de arriba — ids de MultiLookLookItem con los que cada
  // accesorio combina (many-to-many, declarado por el usuario con chips).
  curatedIdeasAccessoryLinks?: (string[] | null)[];
  // outfit_night_out: nivel elegido por el usuario, determina cuántos y
  // cuáles shots se generan (Una foto=1, Corto=3, Completo=5, Extendido=7).
  nightOutLevel?: 'una_foto' | 'corto' | 'completo' | 'extendido';
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
  // Para haul: true cuando la ocasión describe a QUÉ ocasión va la ropa (no dónde se filma el haul).
  // "para la oficina" → wearingContextOnly=true (no contamina locación de captura)
  // "en la oficina" / "grabado en la oficina" → wearingContextOnly=false (puede ser locación real)
  wearingContextOnly?: boolean;
  // Etiqueta corta del contexto de uso — solo estilo, sin referencias de locación física.
  // Ejemplo: "office / workwear inspired" para inyectar en haul sin traer "lobby/cowork"
  wearingContextStyleLabel?: string;
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
  // outfit_night_out: true si este shot vino del Director Creativo (banco
  // real de fotos + razonamiento de Gemini), false si vino del banco
  // estático de respaldo (director no corrió o falló para esta sesión).
  usedDirector?:            boolean;

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
  primaryItemManualKind?:   HaulRefKind;
  primaryItemResolvedKind?: HaulResolvedKind;
  coverageRole?:            HaulCoverageRole;
  // true = shot hero con primaryItemId resuelto correctamente → ref primaria llegó al modelo
  // false = shot hero sin primaryItemId → scheduled_not_routed en ledger final
  actualPrimaryRefRouted?:  boolean;
  actualPrimaryRefKind?:    HaulResolvedKind;
  accessoryCloseupRequested?: boolean;
  // Plan de ítems por shot — qué aparece, qué se sostiene, qué está prohibido
  haulItemPlan?:            HaulShotItemPlan;
  // Validadores de integridad semántica por shot
  itemRoleValidation?: {
    primaryItemAllowedUseModes?: HaulItemAllowedUseMode[];
    singleGarmentConvertedToFullOutfit?: boolean;
    avatarBaseClothingLeakDetected?:     boolean;
    manualKindIgnored?:                  boolean;
    inventedOutfitDetected?:             boolean;
    brandedPackagingRisk?:               boolean;
    heldAndWornConflict?:                boolean;
    indexRoutingUsed?:                   boolean;
  };
  // Estado del haul antes/después de este shot (para detectar duplicaciones ilógicas)
  haulProgressStateBefore?: Record<string, HaulItemState>;
  haulProgressStateAfter?:  Record<string, HaulItemState>;
  referenceRouting?: {
    avatarRefs:         number;
    ref0Used:           boolean;
    garmentRefs:        number;   // wearables only (full_outfit, top, bottom, dress, onepiece, outerwear, hosiery, mixed_set)
    footwearRefs:       number;   // calzado items
    jewelryRefs:        number;   // jewelry items
    accessoryRefs:      number;   // bags + generic accessories
    backgroundItemRefs: number;
    unrelatedRefsCount: number;
  };
  haulProgressState?: {
    currentItem?:        string;
    triedCount:          number;
    remainingCount:      number;
    pileState:           HaulPileState;
    clutterStage:        'early' | 'middle' | 'late';
    itemsAlreadyShown:   string[];
    itemsNotYetShown:    string[];
  };
  sceneFingerprintApplied?: boolean;
  sceneDriftRisk?:          'low' | 'medium' | 'high';
  fallbackUsed?:            boolean;
  fallbackShotMode?:        string;
  failedCoverageItemId?:    string;
  retryCount?:              number;
  failureReason?:           string;

  // Global Stability Debug (patch v5) — uno por shot
  globalStabilityBlocks?: {
    sceneWorldPlanApplied:                boolean;
    sceneFingerprintLockApplied:          boolean;
    avatarBaseClothingSuppressedGlobally: boolean;
    avatarBaseClothingSuppressedInStoryShots: boolean;
    wardrobePhysicalIntegrationApplied:   boolean;
    longFootwearIntegrationChecked:       boolean;
    layeringConsistencyChecked:           boolean;
    anatomySafetyApplied:                 boolean;
    mirrorConsistencyApplied:             boolean;
    visualItemFidelityApplied:            boolean;
    externalBrandingForbiddenApplied:     boolean;
    readableTextForbiddenApplied:         boolean;
    // Riesgos detectados estáticamente
    avatarBaseClothingContaminationRisk:  boolean;
    ref0UsedAsWardrobeSource:             boolean;
    extraLimbRisk:                        boolean;
    mirrorReflectionRisk:                 boolean;
    externalBrandTextRisk:                boolean;
    primaryItemFidelityRisk:              boolean;
    colorMaterialDriftRisk:               boolean;
    wardrobeIntegrationRisk:              boolean;
  };

  // Weekly-specific debug (patch post-refactor Fase 10) — solo outfit_week.
  // Refleja los campos condicionales de WeeklyShotPlan (ver deriveWeeklyRoutingFields
  // en recipes/outfitWeek.ts) para que se pueda auditar por shot: qué item es
  // protagonista, si REF0 aporta o no el outfit base, y qué refs viajaron realmente.
  weeklyRoutingDebug?: {
    activeCategory?:         string;   // WeeklyItemKind del ítem primario
    behaviorType?:           string;
    inheritBaseOutfit?:      boolean;
    replaceBaseOutfit?:      boolean;
    activeItemReplaces?:     'full_outfit' | 'footwear' | 'makeup' | 'none';
    useRef0AsBaseStyling?:   boolean;
    useSetShotReference?:    boolean;
    technicalReferenceOnly?: boolean;
  };
  // URLs exactas (o ids semánticos) que se pasaron al modelo para este shot —
  // permite auditar routing faltante sin tener que reconstruir el prompt completo.
  resolvedRefsForShot?: string[];

  // Product Haul-specific debug — solo product_haul.
  productHaulRoutingDebug?: {
    primaryItemId?:      string;
    resolvedKind?:       ProductHaulResolvedKind;
    interactionMode?:    ProductInteractionMode;
    isPackagingShot?:    boolean;
  };
  productHaulItemPlan?: ProductHaulShotItemPlan;

  // Day In Life-specific debug — solo day_in_life (multi-mundo).
  dayInLifeRoutingDebug?: {
    blockId?:            string;
    blockLabel?:         string;
    role?:                DayBlockShotRole;
    usedCompanionRef?:   boolean;
  };

  status:       'ok' | 'failed';
}

export interface PhotodumpDebugData {
  generatedAt:  string;
  recipe:       string;
  basePrompt:   string;
  inferredGender: string;
  inferredDestination?: InferredDestination;
  // Campos de conteo claros
  requestedCount:       number;
  visibleImageCount:    number;
  ref0IncludedInCount:  boolean;
  storyShotCount:       number;
  generatedImageCount:  number;
  failedShotCount:      number;
  recoveredShotCount?:   number;  // shots fallados que se recuperaron con safe-retry
  unrecoveredShotCount?: number;  // shots que fallaron y no fueron recuperados
  fallbackUsed?:         boolean; // true si algún shot usó safe-retry path
  finalVisibleImageCount?: number; // REF0 + story shots generados con éxito
  // Contexto del brief
  briefContext?:       OutfitBriefContext;
  outfitComposition?:  OutfitComposition;
  destinationClass?:   OutfitDestinationClass;
  prepEnvironmentClass?: PrepEnvironmentClass;
  // Haul manifest (solo outfit_haul)
  haulManifest?:             HaulManifest;
  // Detección de pérdida del selector manual en el pipeline
  manualKindLostWarning?:    { detected: boolean; lostCount?: number; lostItemIds?: string[] };
  // Separación de contexto de uso del outfit vs locación de captura
  haulWearingContext?:       {
    destinationClass:         string;
    wearingContextOnly?:      boolean;
    wearingContextStyleLabel?: string;
    captureEnvironment:       string;
  };
  // Haul coverage ledger global
  coverageLedger?:           HaulCoverageLedgerItem[];
  uncoveredRequiredItems?:   string[];
  supportOnlyItems?:         string[];
  overexposedItems?:         string[];
  failedCoverageItems?:      string[];
  coverageWarnings?:         string[];
  // Run completeness verdict
  isComplete?:                       boolean;
  blockingIssues?:                   string[];
  missingRequiredOutfits?:           string[];
  failedShotIds?:                    string[];
  // Coverage post-generación (calculado con shots reales, no solo el plan)
  finalCoverageLedger?:              HaulCoverageLedgerItem[];
  requiredItemCount?:                number;
  coveredRequiredItemCount?:         number;
  failedRequiredItemCount?:          number;
  requiredItemCoverageComplete?:     boolean;
  // Feature flags debug (confirma que las reglas están activas)
  scenePropBudgetApplied?:           boolean;
  externalBrandingForbiddenApplied?: boolean;
  avatarBaseClothingSuppressedInRef0?: boolean;
  avatarBaseClothingSuppressedInStoryShots?: boolean;
  routingWarnings?:                  string[];
  sceneFingerprintSummary?:          string;
  sceneContinuityWarnings?:          string[];
  // Haul world map — mapa físico del mundo de REF0
  haulWorldMap?:                     HaulWorldMap;
  // Styling graph — combinaciones semánticas entre ítems
  haulStylingGraph?:                 HaulStylingGraph;
  // Shot item plans — qué aparece en cada shot
  haulShotItemPlans?:                Record<string, HaulShotItemPlan>;
  // Coverage by item — detalle de cobertura por ítem
  coverageByItem?: {
    itemId:              string;
    label:               string;
    manualKind:          HaulRefKind;
    resolvedKind:        HaulResolvedKind;
    requiredCoverage:    boolean;
    coverageStatus:      HaulCoverageLedgerItem['coverageStatus'];
    promptedHeroShots:   number;
    routedHeroRefs:      number;
    visualRole:          'closeup' | 'worn' | 'held' | 'flatlay' | 'integrated_with_outfit' | 'background_only' | 'none';
    heroShotIds:         string[];
    integratedShotIds:   string[];
    supportShotIds:      string[];
    covered:             boolean;
    coverageReason:      string;
    missingReason?:      string;
    allowedUseModes:     HaulItemAllowedUseMode[];
  }[];
  // Coverage map detallado por ítem (post-generación) — legacy, mantener para compatibilidad
  coverageMap?: {
    itemId:             string;
    manualKind:         HaulRefKind;
    resolvedKind:       HaulResolvedKind;
    label:              string;
    required:           boolean;
    allowedUseModes:    HaulItemAllowedUseMode[];
    routedToShots:      string[];
    coverageCount:      number;
    coverageSatisfied:  boolean;
    warnings:           string[];
  }[];
  // Resolved refs per shot — qué URLs pasaron al modelo por shot
  resolvedRefsPerShot?:              Record<string, string[]>;
  // Warnings de validación semántica del haul
  uncoveredRequiredItemsWarnings?:   string[];
  overrepresentedItemsWarnings?:     string[];
  missingAccessoryCoverageWarnings?: string[];
  missingFootwearCoverageWarnings?:  string[];
  inventedOutfitWarnings?:           string[];
  brandedPackagingWarnings?:         string[];
  worldViolationsPredicted?:         string[];
  avatarBaseClothingRisk?:           boolean;
  indexRoutingUsed?:                 boolean;
  // Count recovery — desglose exacto de qué pasó con cada slot
  countRecoveryDebug?: {
    requested:  number;
    planned:    number;
    generated:  number;
    failed:     number;
    recovered:  number;
    final:      number;
  };
  // Avatar base clothing risk (detectado por heurística, no confirmado por modelo)
  avatarBaseClothingUsedAsTryOn?:                  boolean;
  avatarBaseClothingUsedForAccessoryIntegration?:  boolean;
  avatarBaseClothingLeakRisk?:                     string;
  avatarBaseClothingUsedAsWeeklyItem?:             boolean;
  // Product Haul manifest (solo product_haul)
  productHaulManifest?:           ProductHaulManifest;
  productHaulCoverageLedger?:     ProductHaulCoverageLedgerItem[];
  uncoveredRequiredItems_productHaul?: string[];
  // Day In Life manifest (solo day_in_life) — multi-mundo
  dayInLifeManifest?:             DayInLifeManifest;
  blocksDetected?:                DayBlock[];
  coverageByBlock?:               DayBlockCoverageLedgerItem[];
  uncoveredRequiredItems_dayInLife?: string[];
  ref0ChainUsed?:                 boolean;
  ref0ChainLength?:               number;
  // Weekly manifest (solo outfit_week)
  weeklyManifest?:                WeeklyManifest;
  weeklyStructure?:               string;
  shotRoles?:                     string[];
  redundancyScores?:              WeeklyRedundancyDebugEntry[];
  accessoryIntegrationUsed?:      boolean;
  uncoveredRequiredItems_weekly?: string[];
  coveredItemIds_weekly?:         string[];
  unsafeHpiSuppressed?:           boolean;
  hpiProfileUsed?:                string;
  propBudget?:                    string;
  brandRiskDetected?:             boolean;
  // Weekly coverage con peso visual
  weeklyCoverageMap?:             Record<string, WeeklyItemCoverage>;
  weeklyDominanceCheck?:          WeeklyDominanceCheck;
  weeklyAccessoryIntegrationPlan?: WeeklyAccessoryIntegrationEntry[];
  compositionVarietyMap?:         WeeklyCompositionVarietyMap;
  tooManyGenericFullBodyShots?:   boolean;
  redundantShotNotReplaced?:      boolean;
  // Reference tag resolution (patch v4)
  referenceTaggingUsed?:          boolean;
  referenceTagResolution?:        ReferenceTagResolutionResult;
  // Avatar base clothing policy (patch v4)
  avatarBaseClothingPolicyApplied?:     boolean;
  avatarBaseClothingFingerprint?:       AvatarBaseClothingFingerprint;
  avatarBaseClothingNegativePromptApplied?: boolean;
  avatarBaseClothingLeakCheck?:         AvatarBaseClothingLeakCheck;
  // Accessory coverage map — detalle por accesorio/joya/calzado
  accessoryCoverageMap?: Record<string, {
    kind:             string;
    manualKind?:      string;
    resolvedKind?:    string;
    required:         boolean;
    closeupRequested: boolean;
    compatibleOutfitMatches: Array<{
      outfitId:        string;
      score:           number;
      reason:          string;
      selected:        boolean;
      integrationMode?: string;
    }>;
    promptedHeroShots:   string[];
    routedHeroRefs:      string[];
    integratedInShots:   string[];
    closeupShots:        string[];
    flatlayOnlyShots:    string[];
    backgroundOnlyShots: string[];
    covered:             boolean;
    coverageReason:      string;
  }>;
  // Redundant closeups — accesorios que solo recibieron closeup aislado cuando podían integrarse
  redundantAccessoryCloseups?: string[];
  // Uncovered accessories — accesorios requeridos sin hero ni integrated shot
  uncoveredAccessories?: string[];
  // Análisis visual de referencias (outfit_haul) — resultado de la llamada Gemini previa
  visualRefsAnalysis?:               VisualRefsAnalysisResult;

  // ── Global Stability Debug (patch v5) — resumen de sesión ────
  globalStabilityApplied?: {
    // Qué bloques se inyectaron en esta sesión
    sceneFingerprintLockApplied:          boolean;
    avatarBaseClothingSuppressedGlobally: boolean;
    wardrobePhysicalIntegrationApplied:   boolean;
    anatomySafetyApplied:                 boolean;
    visualItemFidelityApplied:            boolean;
    externalBrandingForbiddenApplied:     boolean;
    readableTextForbiddenApplied:         boolean;
    // Conteo de shots con cada bloque activo
    shotsWithSceneLock:          number;
    shotsWithAvatarSuppression:  number;
    shotsWithWardrobePhysics:    number;
    shotsWithAnatomySafety:      number;
    shotsWithVisualFidelity:     number;
    // Flags de escena
    sceneViolationWarnings:  string[];
    propBudgetWarnings:      string[];
    // Brief compliance
    briefBindingCompliance?: {
      allMentionedTagsCovered:    boolean;
      allExplicitPairingsCovered: boolean;
      missingTaggedRefs:          string[];
      missingPairings:            string[];
    };
    // Diversidad narrativa
    narrativeDiversityPlannerApplied: boolean;
    overRepeatedPrimaryItems:         string[];
    redundantLastShotReplaced:        boolean;
    // Accesorio integration
    accessoryIntegrationApplied: boolean;
    accessoryOnlyMacroRisk:      boolean;
  };

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
  // outfit_week: outfit es optional — con productos o accesorios alcanza
  if (cfg.outfit === 'required' && !(refs.outfitRef || (refs.outfitRefs ?? []).some(Boolean))) return false;
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

// ── Outfit Week — Weekly Edit / Weekly Favorites ───────────────

// Rol narrativo de cada shot en la secuencia semanal
export type WeeklyShotRole =
  | 'WEEK_ANCHOR'                 // primer shot / base visual del set
  | 'WEEK_OVERVIEW'               // selección semanal sobre cama/rack/superficie
  | 'WEEK_LOOK_HERO'              // look completo — full body
  | 'WEEK_MIRROR_LOOK'            // espejo — alternativa al look hero
  | 'WEEK_STYLING_PROCESS'        // proceso de armado / vestirse / ajustar
  | 'WEEK_ACCESSORY_INTEGRATED'   // accesorio integrado con outfit compatible
  | 'WEEK_ACCESSORY_DETAIL'       // accesorio en detalle / macro
  | 'WEEK_ACCESSORY_WORN'         // accesorio puesto (aros, collar, pulsera)
  | 'WEEK_ACCESSORY_HELD'         // accesorio sostenido frente a cámara
  | 'WEEK_DETAIL'                 // detalle de prenda / textura / cierre / bordado
  | 'WEEK_ON_THE_GO'              // en movimiento — caminando, saliendo
  | 'WEEK_FAVORITE'               // favorito de la semana — objeto o look
  | 'WEEK_CLOSER'                 // cierre del carrusel
  // ── Roles dedicados a producto/skincare/beauty (patch quirúrgico) ──
  // Nunca usar WEEK_ACCESSORY_* para dominantType products/skincare/beauty/tech/makeup —
  // el producto no es un accesorio de outfit, tiene su propia gramática visual.
  | 'WEEK_PRODUCT_OVERVIEW'       // todos los productos juntos — item-only
  | 'WEEK_PRODUCT_HELD'           // producto sostenido frente a cámara
  | 'WEEK_PRODUCT_DETAIL'         // detalle macro de envase/etiqueta/textura
  | 'WEEK_PRODUCT_IN_USE'         // producto siendo aplicado/usado en la rutina
  | 'WEEK_PRODUCT_TEXTURE'        // textura/formula del producto — swatch, gota, crema
  | 'WEEK_PRODUCT_ROUTINE_STEP'   // paso de rutina — varios productos en secuencia
  | 'WEEK_PRODUCT_CLOSER';        // cierre del carrusel — producto favorito

// Tipo de ítem semanal — más granular que HaulItemKind para detectar tipo dominante
export type WeeklyItemKind =
  | 'outfit_set'        // look completo para probar
  | 'garment'           // prenda individual (top, bottom, outerwear)
  | 'top'
  | 'bottom'
  | 'outerwear'
  | 'dress'
  | 'onepiece'
  | 'footwear'          // calzado (unifica shoes/boots)
  | 'shoes'
  | 'boots'
  | 'bag'
  | 'jewelry'
  | 'accessory'
  | 'lipstick'          // labial / color específico
  | 'makeup'            // maquillaje general
  | 'makeup_color'      // color/swatch de maquillaje
  | 'skincare'          // skincare / serum / crema
  | 'beauty_product'    // beauty product genérico
  | 'product'           // producto físico genérico
  | 'tech'              // producto tech
  | 'unknown';

// Tipo dominante detectado en el set — adapta los roles
export type WeeklySetDominantType =
  | 'outfits'       // mayoría son outfits completos / prendas wearables
  | 'accessories'   // mayoría son accesorios / joyería / bolsos
  | 'bags'          // mayoría son bolsos
  | 'footwear'      // mayoría son calzado
  | 'jewelry'       // mayoría son joyería
  | 'beauty'        // mayoría son beauty products (maquillaje, skincare)
  | 'skincare'      // mayoría son productos skincare
  | 'products'      // mayoría son productos físicos genéricos
  | 'tech'          // mayoría son productos tech
  | 'makeup'        // mayoría son productos de maquillaje
  | 'mixed';        // mix variado

export interface WeeklyItemSemanticIntent {
  userLabel?:       string;    // alias del usuario ("look de cena")
  mood?:            string;    // "casual", "arreglado", "cómodo", "vibrante"
  destination?:     string;    // "salir a la tarde", "cena", "día"
  priority?:        'required' | 'normal' | 'optional';
  explicitFromBrief: boolean;
}

export interface WeeklyItem {
  id:                       string;         // 'outfit_0', 'outfit_1', 'acc_0', etc.
  sourceIndex:              number;         // índice en el array de refs
  refUrl:                   string;
  kind:                     WeeklyItemKind;
  label:                    string;
  priority:                 'required' | 'normal' | 'optional';
  tryOnEligible:            boolean;        // puede mostrarse puesto en el cuerpo
  detailEligible:           boolean;        // puede ser detalle / macro
  accessoryEligible:        boolean;        // es accesorio / joyería / bolso
  canBeIntegratedWithOutfit: boolean;       // puede combinarse con otro outfit
  compatibleWith?:          string[];       // ids de ítems compatibles para integración
  // Semantic intent desde el brief (patch v4)
  semanticIntent?:          WeeklyItemSemanticIntent;
  explicitlyTaggedInBrief?: boolean;
  tagsUsed?:                string[];
  coverageRequiredBecauseTagged?: boolean;
}

export interface WeeklyCompatibilityPair {
  accessoryId:  string;
  outfitId:     string;
  score:        number;      // 0–100
  reason:       string;
  integrationMode: 'worn' | 'held' | 'flatlay' | 'detail';
}

export interface WeeklyCoverageEntry {
  itemId:       string;
  kind:         WeeklyItemKind;
  covered:      boolean;
  coveredByShots: string[];
  coverageType: ('worn' | 'laid_flat' | 'held' | 'detail' | 'integrated' | 'background')[];
}

// Cobertura visual con peso — reemplaza el boolean binario
export interface WeeklyItemCoverage {
  itemId:                       string;
  itemKind:                     WeeklyItemKind;
  label:                        string;
  totalAppearances:             number;
  heroAppearances:              number;        // shots donde es primario y protagonista real
  secondaryAppearances:         number;        // shots donde es secundario (integración)
  detailAppearances:            number;        // shots de macro / detail
  integratedAccessoryAppearances: number;      // como accesorio integrado con outfit
  overviewAppearances:          number;        // solo aparece en overview
  visualWeight:                 number;        // 0–100, promedio ponderado de apariciones
  isPrimaryInAnyShot:           boolean;
  isOnlyBackground:             boolean;
  isOnlyInOverview:             boolean;       // nunca hero, nunca detail, nunca integrado
  realCoverage:                 boolean;       // true solo si tiene al menos 1 aparición real no-background
  // Patch quirúrgico Problema 5: por qué realCoverage quedó en false, cuando aplica.
  // 'planned_but_not_routed'  → el shot plan lo asigna, pero su referencia nunca viajó a refsToPass.
  // 'wrong_role_for_category' → el rol asignado no es compatible con el behaviorType del ítem.
  coverageReason?:              'planned_but_not_routed' | 'wrong_role_for_category';
}

// Guardrail de dominancia visual — detecta si un ítem monopoliza la secuencia
export interface WeeklyDominanceCheck {
  dominantItemId?:          string;
  dominantItemLabel?:       string;
  dominantItemVisualWeight: number;
  averageVisualWeight:      number;
  dominanceRatio:           number;         // 0–1, qué fracción del peso tiene el ítem más fuerte
  dominantItemRisk:         boolean;        // true si supera el umbral del 40%
  corrected:                boolean;        // true si se redistribuyó para corregirlo
  correctionActions:        string[];
}

// Plan de integración de accesorios — distribución entre outfits
export interface WeeklyAccessoryIntegrationEntry {
  accessoryId:              string;
  accessoryLabel:           string;
  selectedOutfitId?:        string;
  compatibleOutfitIds:      string[];
  reason:                   string;
  integrationMode:          'worn' | 'held' | 'detail' | 'flatlay' | 'macro';
  avoidedBecauseWouldOverRepeat?: boolean;
  avoidedOutfitId?:         string;
  avoidedReason?:           string;
  fallbackToIsolated:       boolean;
}

// Variedad de composición — previene demasiados full-body idénticos
export interface WeeklyCompositionVarietyMap {
  fullBodyStandingCount:    number;
  mirrorCount:              number;
  flatlayCount:             number;
  detailCount:              number;
  accessoryIntegratedCount: number;
  seatedCount:              number;
  inHandCount:              number;
  tooManyGenericFullBodyShots: boolean;
}

// Debug extendido por shot — incluye redundancia con razón y reemplazo
export interface WeeklyRedundancyDebugEntry {
  shotIndex:            number;
  role:                 WeeklyShotRole;
  score:                number;
  reason:               string;
  replacedBecauseRedundant: boolean;
  replacementRole?:     WeeklyShotRole;
  replacementReason?:   string;
  redundantShotNotReplaced?: boolean;   // warning: score>=8 pero no se reemplazó
}

export interface WeeklyShotPlan {
  role:             WeeklyShotRole;
  primaryItemIds:   string[];   // ítems protagonistas del shot
  secondaryItemIds: string[];   // ítems secundarios / integrados
  backgroundItemIds?: string[]; // ítems de fondo (no protagonistas)
  forbiddenItemIds?:  string[]; // ítems que NO deben aparecer en este shot
  outfitIndex?:     number;     // índice del outfit asignado (para look heroes)
  accessoryId?:     string;     // accesorio asignado (para shots de accesorio)
  integratedWithOutfitId?: string;   // outfit con el que se integra el accesorio
  refsToRoute:      string[];   // URLs exactas a pasar al modelo
  redundancyScore:  number;     // 0–10 (antes 0–100, ahora normalizado a 0–10)
  replacedBecauseRedundant: boolean;
  replacementRole?: WeeklyShotRole;
  replacementReason?: string;
  compositionMode?: string;     // descripción del modo de composición para el prompt
  visualWeightIntent?: string;  // qué ítem debe dominar visualmente
  fallbackUsed?:    boolean;
  fallbackRole?:    WeeklyShotRole;
  retryCount?:      number;
  // Reference tag enrichment (patch v4)
  resolvedTagsUsed?:        string[];           // e.g. ["@outfit3", "@accessory2"]
  semanticIntentFromBrief?: WeeklyItemSemanticIntent;
  tagDrivenPairing?:        boolean;           // true si la integración fue forzada por tags
  avatarBaseClothingForbidden?: boolean;        // true si el fingerprint se inyectó en este shot
  // Visual Reference Contract (patch v5) — pairings del brief para el contrato visual
  explicitPairingsFromBrief?: Array<{
    sourceItemId: string;   // e.g. "acc_0" (el accesorio)
    targetItemId: string;   // e.g. "outfit_2" (el outfit)
    rawText?: string;
  }>;
  // Weekly Favorites — outfit inheritance y routing condicional
  // true = este shot hereda el outfit base de REF0 (no tiene outfit activo propio)
  inheritBaseOutfit?: boolean;
  // true = este shot tiene un outfit activo que reemplaza el look base de REF0
  replaceBaseOutfit?: boolean;
  // Qué componente reemplaza el activo item: full_outfit, footwear, makeup, none
  activeItemReplaces?: 'full_outfit' | 'footwear' | 'makeup' | 'none';
  // true = REF0 puede aportar base styling (outfit base) además de mundo/luz
  useRef0AsBaseStyling?: boolean;
  // true = incluir el set shot como referencia extra para este shot (solo casos específicos)
  useSetShotReference?: boolean;
  // Categoría activa del ítem primario de este shot
  activeCategory?: WeeklyItemKind;
  // Tipo de comportamiento del ítem activo para routing de refs
  behaviorType?: 'outfit' | 'garment' | 'footwear' | 'bag' | 'jewelry' | 'makeup_color' | 'makeup_product' | 'skincare_product' | 'beauty_product' | 'product' | 'unknown';
  // true = la ref del ítem primario es packaging/textura/swatch — usarla solo para fidelidad
  // visual (color, forma de envase, label), no como instrucción de composición del shot
  technicalReferenceOnly?: boolean;
}

export interface WeeklyManifest {
  totalItems:         number;
  dominantType:       WeeklySetDominantType;
  outfitSets:         WeeklyItem[];   // look_completo / dress / onepiece
  standaloneGarments: WeeklyItem[];   // top / bottom / outerwear — no parte de un set
  shoes:              WeeklyItem[];   // shoes / boots
  bags:               WeeklyItem[];
  jewelry:            WeeklyItem[];
  accessories:        WeeklyItem[];   // accesorios genéricos
  makeup:             WeeklyItem[];
  products:           WeeklyItem[];
  allItems:           WeeklyItem[];
  requiredItems:      WeeklyItem[];
  compatibilityPairs: WeeklyCompatibilityPair[];
  coverageMap:        Record<string, WeeklyCoverageEntry>;
  shotPlan:           WeeklyShotPlan[];   // plan de shots con roles y routing explícito
  // Debug de cobertura con peso visual
  weeklyCoverageMap:  Record<string, WeeklyItemCoverage>;
  weeklyDominanceCheck: WeeklyDominanceCheck;
  weeklyAccessoryIntegrationPlan: WeeklyAccessoryIntegrationEntry[];
  compositionVarietyMap: WeeklyCompositionVarietyMap;
  redundancyDebug:    WeeklyRedundancyDebugEntry[];
  tooManyGenericFullBodyShots: boolean;
  redundantShotNotReplaced: boolean;
  // Debug clásico
  uncoveredRequiredItems: string[];
  coveredItemIds:         string[];
  weeklyStructure:        string;    // descripción del arco para debug
  accessoryIntegrationUsed: boolean;
  unsafeHpiSuppressed:      boolean;
  brandRiskDetected:        boolean;
  // Reference tag resolution (patch v4)
  referenceTagResolution?: ReferenceTagResolutionResult;
  // Avatar base clothing policy applied (patch v4)
  avatarBaseClothingPolicyApplied?: boolean;
  avatarBaseClothingFingerprint?:   AvatarBaseClothingFingerprint;
  // Visual Reference Contract debug (patch v5)
  visualSlotBindingUsed:            boolean;
  avatarBaseClothingSuppressedGlobally: boolean;
  ref0UsedAsWardrobeSource:         false;   // always false — enforced by contract
  briefBindingCompliance?: {
    allMentionedTagsCovered:    boolean;
    allExplicitPairingsCovered: boolean;
    missingTaggedRefs:          string[];
    missingPairings:            string[];
  };
  shotPrimaryItemDistribution: Record<string, number>;  // itemId → count de shots donde es primary
  overusedPrimaryItems:        string[];                // ítems con count > (totalShots / totalItems) * 1.5
}

// ── Reference Tag Resolver — Global (patch v4) ────────────────────────────────

export type RefTagSlotType =
  | 'outfit'
  | 'accessory'
  | 'bag'
  | 'shoe'
  | 'makeup'
  | 'product'
  | 'scene'
  | 'avatar'
  | 'body'
  | 'unknown';

export interface ResolvedReferenceTag {
  rawTag:            string;         // "@outfit3"
  normalizedTag:     string;         // "outfit3"
  slotType:          RefTagSlotType;
  slotIndex?:        number;         // 0-based internamente
  humanIndex?:       number;         // 1-based desde el tag (@outfit3 → 3, @outfit → 1)
  resolvedItemId?:   string;         // id del WeeklyItem / HaulItem / etc.
  resolvedRefUrl?:   string;         // URL exacta resuelta
  confidence:        'high' | 'medium' | 'low';
  usedInTextContext: string;         // fragmento del brief donde apareció el tag
  semanticRole?:     string;         // "casual", "dinner", "comfortable", "vibrant"
  semanticDest?:     string;         // "salir a la tarde", "cena", "día"
  warning?:          string;
}

export interface ReferenceTagDuplicateUse {
  rawTag:    string;
  count:     number;
  contexts:  string[];
  warning:   string;
}

export interface ItemSemanticAssignment {
  itemId:              string;
  sourceTag:           string;
  roleFromBrief?:      string;   // "casual", "arreglado", "cómodo", "vibrante"
  destinationFromBrief?: string; // "salir a la tarde", "cena", "día"
  usageInstruction?:   string;
}

export interface ExplicitItemPairing {
  sourceItemId:  string;   // accesorio
  targetItemId:  string;   // outfit con el que se usó
  reason:        string;
  rawText:       string;
}

export interface ReferenceTagResolutionResult {
  tags:                      ResolvedReferenceTag[];
  unresolvedTags:            ResolvedReferenceTag[];
  duplicateTagUses:          ReferenceTagDuplicateUse[];
  itemSemanticAssignments:   ItemSemanticAssignment[];
  explicitPairings:          ExplicitItemPairing[];
  briefWithoutTags?:         string;
  referenceTaggingUsed:      boolean;
  declaredCountDoesNotMatchUniqueTaggedItems?: boolean;
  warnings:                  string[];
}

// ── Avatar Base Clothing Policy — Global (patch v4) ───────────────────────────

export interface AvatarBaseClothingFingerprint {
  topColor:    string;     // e.g. "black"
  topType:     string;     // e.g. "fitted bodysuit / long sleeve top"
  bottomColor: string;     // e.g. "light blue"
  bottomType:  string;     // e.g. "wide leg jeans"
  shoes?:      string;     // e.g. "white sneakers"
  summary:     string;     // texto compacto para inyectar en prompt
}

export interface AvatarBaseClothingLeakCheck {
  checked:            boolean;
  suspiciousShotIds:  string[];
  correctedShotIds:   string[];
  remainingRisk:      'low' | 'medium' | 'high';
}
