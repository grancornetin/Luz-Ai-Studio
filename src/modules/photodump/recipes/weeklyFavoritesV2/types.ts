/**
 * recipes/weeklyFavoritesV2/types.ts
 *
 * Tipos internos de la receta weeklyFavoritesV2. No se comparten con otras
 * recetas ni se exponen fuera de esta carpeta salvo lo que index.ts decide
 * re-exportar para el Director.
 *
 * Deliberadamente NO reutiliza WeeklyItem / WeeklyItemKind / WeeklyManifest
 * de ../../types.ts — esos tipos son el "god object" que esta receta existe
 * para reemplazar. El único punto de acople con el resto del sistema es
 * PhotodumpRefs (input) y PhotodumpShotDirective.weeklyFavoritesV2Plan (output).
 */

// ── Categorías de item — simplificado respecto a WeeklyItemKind ───────────

export type ItemCategory =
  | 'outfit'
  | 'bag'
  | 'footwear'
  | 'jewelry'
  | 'makeup'
  | 'skincare'
  | 'product_generic';

// Cómo debe comportarse el item en el routing y en los shots — la metadata,
// no la categoría, es lo que determina comportamiento.
export type BehaviorType =
  | 'base_outfit'       // único behaviorType que puede alimentar el Anchor
  | 'outfit_look'        // outfit semanal normal, no hereda a REF0
  | 'bag'
  | 'footwear'
  | 'jewelry'
  | 'makeup_applied'     // maquillaje que se muestra puesto/aplicado
  | 'makeup_swatch'      // color/textura de producto, technical reference
  | 'skincare_product'   // producto de skincare, puede mostrarse solo o en mano
  | 'product_texture';   // referencia técnica de textura/empaque, no de uso

export interface ManifestItem {
  id:                       string;   // 'outfit_0', 'bag_1', 'skincare_0', etc.
  sourceIndex:              number;   // índice dentro de su array de origen en PhotodumpRefs
  refUrl:                   string;
  category:                 ItemCategory;
  behaviorType:              BehaviorType;
  label:                    string;
  supportsCloseup:           boolean;
  replacePolicy:             'fixed' | 'replaceable';
  technicalReferenceOnly:    boolean;  // true = solo usar para fidelidad visual (color/forma), no como instrucción de composición
  includeInOverview:         boolean;
  includeAsIndividualShot:   boolean;
  // Asignación explícita de pairing (por tag @ en el brief o por selección manual del usuario).
  // Un item solo puede aparecer como secondaryItem de otro shot si está listado aquí.
  explicitPairingWith?:      string[];
}

export interface WeeklyManifestV2 {
  items:              ManifestItem[];
  baseOutfitItem?:     ManifestItem;   // el único item elegible como base_outfit, si existe
  itemsByCategory:     Record<ItemCategory, ManifestItem[]>;
}

// ── Anchor ──────────────────────────────────────────────────────────────

export type AnchorMode =
  // El avatar subido ya trae puesto su outfit definitivo (usuario marcó el
  // casillero) — se respeta tal cual, sin generar ni reemplazar nada.
  | 'person_with_explicit_base_outfit'
  // No hay outfit definitivo marcado. Se detectó un estilo claro y consistente
  // en las demás referencias (outfits/accesorios/productos subidos) — se genera
  // un outfit acorde a ese estilo, sin copiar ninguna prenda real de esas
  // referencias.
  | 'person_with_style_matched_outfit'
  // No hay outfit definitivo marcado y no hay señal de estilo suficiente o es
  // contradictoria entre las referencias — se usa un outfit simple y discreto
  // como última opción, para no arriesgar una mezcla rara.
  | 'person_with_safe_fallback_outfit'
  // Sin persona en cuadro — solo escena/mundo. Reservado para cuando no hay
  // ninguna referencia de identidad disponible.
  | 'world_only';

export interface StyleDetectionResult {
  // true si la IA encontró un estilo lo bastante claro y consistente como
  // para generar un outfit acorde con confianza razonable.
  styleIsClear:      boolean;
  // Descripción del estilo detectado, en palabras — usada tanto para decidir
  // como para mostrarse en el diagnóstico. Vacío si styleIsClear es false.
  styleDescription:  string;
  // Motivo en palabras de por qué se considera claro o contradictorio —
  // siempre presente, para el diagnóstico.
  reason:            string;
}

export interface AnchorContract {
  mode:               AnchorMode;
  identityRefUrl?:     string;
  bodyRefUrl?:         string;
  sceneRefUrl?:        string;
  // Presente solo cuando mode === 'person_with_explicit_base_outfit'.
  baseOutfitItem?:     ManifestItem;
  // Presente solo cuando mode === 'person_with_style_matched_outfit' o
  // 'person_with_safe_fallback_outfit' — guarda qué detectó (o no detectó)
  // la IA, para el diagnóstico y para armar el texto de instrucciones.
  styleDetection?:     StyleDetectionResult;
}

// ── Cobertura ───────────────────────────────────────────────────────────

export type CoverageLevel =
  | 'not_covered'
  | 'overview_only'
  | 'secondary'
  | 'primary'
  | 'primary_plus_detail';

export interface ShotAllocationResult {
  requestedCount:               number;
  minimumShotsForFullCoverage:   number;
  coverageMode:                  'full' | 'partial';
  uncoveredItems:                ManifestItem[];
  reason:                        string;
  shots:                         AllocatedShotSlot[];
  itemCoverageLevel:             Record<string, CoverageLevel>;  // itemId -> nivel
}

export interface AllocatedShotSlot {
  slotId:          string;
  role:            ShotRole;
  activeItem:       ManifestItem | null;
  secondaryItems:   ManifestItem[];
  // true = esta foto es una segunda toma del mismo item (ya tiene una foto
  // principal en otro slot). Se usa para pedirle a la capa de inteligencia
  // un ángulo/momento distinto y evitar que se vea como una copia repetida.
  isAdditionalDetail?: boolean;
}

// ── Shot Contracts ──────────────────────────────────────────────────────

export type ShotRole =
  | 'outfit_hero'
  | 'outfit_integrated'
  | 'bag'
  | 'footwear'
  | 'jewelry'
  | 'makeup_applied'
  | 'skincare_product_only'
  | 'skincare_in_hand'
  | 'product_texture'
  | 'overview'
  | 'mixed';

export interface ReferencePolicy {
  useIdentityRef:      boolean;
  useBodyRef:          boolean;
  useAnchorRef:        boolean;
  useOverviewRef:      boolean;
  activeItemRefs:      string[];
  secondaryItemRefs:   string[];
  technicalRefs:       string[];
}

export type WardrobePolicy =
  | 'wears_active_item'         // la persona lleva puesto el active item
  | 'holds_active_item'         // la persona sostiene/interactúa con el active item
  | 'item_only_no_person'       // solo el item, sin persona en cuadro
  | 'not_applicable';           // overview / mixed sin persona

export interface CameraGrammarRef {
  framing:      string;   // CLOSE_UP | MEDIUM | WIDE | MACRO
  angle:        string;
  composition:  string;
}

export interface ShotContract {
  shotId:            string;
  role:              ShotRole;
  activeItem:         ManifestItem | null;
  secondaryItems:     ManifestItem[];
  referencePolicy:    ReferencePolicy;
  wardrobePolicy:     WardrobePolicy;
  cameraGrammar:      CameraGrammarRef;
  forbiddenItems:     ManifestItem[];
  coverageLevel:      CoverageLevel;
  // true = segunda toma del mismo item (ver AllocatedShotSlot.isAdditionalDetail).
  isAdditionalDetail?: boolean;
  // Solo shots con persona posando (outfit_hero/outfit_integrated, sep
  // 2026): línea de actitud real citada del banco de fotos (openbank) — ver
  // fetchOutfitCheckPoseCandidates en outfitCheck/poseClient.ts. undefined
  // si no hay candidato disponible o el rol no aplica.
  poseAttitudeLine?: string;
}

// ── Validación ──────────────────────────────────────────────────────────

export interface ValidationResult {
  passed:  boolean;
  errors:  string[];
}

// ── Reference Routing ───────────────────────────────────────────────────

export interface RoutedReferences {
  orderedUrls: string[];
  breakdown: {
    identity?:       string;
    body?:           string;
    anchor?:         string;
    overview?:       string;
    activeItem:      string[];
    secondaryItems:  string[];
    technical:       string[];
  };
}

// ── Plan de salida hacia PhotodumpShotDirective ────────────────────────

export interface WeeklyFavoritesV2ShotPlan {
  shotId:          string;
  role:            ShotRole;
  activeItemId:     string | null;
  secondaryItemIds: string[];
  coverageLevel:    CoverageLevel;
}

// ── Debug ───────────────────────────────────────────────────────────────

export interface WeeklyV2ShotDebug {
  shotId:               string;
  role:                 ShotRole;
  activeItem:            string | null;
  referencesUsed:        string[];
  wardrobePolicy:        WardrobePolicy;
  cameraGrammar:         CameraGrammarRef;
  coverageDecision: {
    level:   CoverageLevel;
    reason:  string;
  };
  contractValidation: ValidationResult;
  routingValidation:  ValidationResult;
  promptSummary:      string;
}
