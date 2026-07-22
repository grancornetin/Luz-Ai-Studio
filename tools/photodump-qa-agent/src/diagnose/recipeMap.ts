/**
 * Traduce el `recipe` string de PhotodumpDebugData al lugar real del repo
 * donde vive el motor de esa receta. Algunas recetas son un solo archivo,
 * otras son una carpeta con varios módulos (types, contracts, promptBuilder...).
 *
 * Si se agrega una receta nueva y no aparece acá, el locator cae a buscar por
 * nombre en todo `src/modules/photodump/recipes/` (ver repoLocator.ts).
 */
export const RECIPE_SOURCE_MAP: Record<string, string[]> = {
  outfit_multi_look: ["src/modules/photodump/recipes/outfitMultiLook"],
  weekly_favorites_v2: ["src/modules/photodump/recipes/weeklyFavoritesV2"],
  outfit_reveal_basic: ["src/modules/photodump/recipes/outfitRevealBasic"],
  outfit_week: ["src/modules/photodump/recipes/outfitWeek.ts"],
  outfit_haul: ["src/modules/photodump/recipes/outfitHaul.ts"],
  product_haul: ["src/modules/photodump/recipes/productHaul.ts"],
  day_in_life: ["src/modules/photodump/recipes/dayInLife.ts"],
  outfit_check: ["src/modules/photodump/recipes/outfitCheck.ts"],
  unboxing: ["src/modules/photodump/recipes/unboxing.ts"],
};

/** Bloques transversales que cualquier receta puede usar (pose, render, créditos, UI). */
export const SHARED_SOURCE_LOCATIONS = [
  "src/modules/photodump/recipes/shared.ts",
  "src/services/hpiService.ts",
  "src/modules/photodump/photodumpDirectorService.ts",
  "src/modules/photodump/PhotodumpModule.tsx",
  "src/modules/photodump/PDStep2Receta.tsx",
];

/** Palabras clave por criterio, para dirigir el grep dentro de la receta ya localizada. */
export const CRITERION_KEYWORDS: Record<string, string[]> = {
  face: ["identity", "avatarFace", "face"],
  hair_color: ["hair", "identity"],
  hair_type: ["hair", "identity"],
  age: ["identity", "age"],
  identity_consistency: ["identity", "avatarFace", "avatarBody", "fingerprint"],
  hands: ["anatomy", "hands", "extraLimb", "anatomySafety"],
  fingers: ["anatomy", "hands", "extraLimb"],
  arms: ["anatomy", "extraLimb", "pose"],
  legs: ["anatomy", "extraLimb", "pose", "walking"],
  proportions: ["anatomy", "silhouette"],
  silhouette: ["silhouette", "body"],
  posture: ["pose", "poseIntensity", "poseIntent", "PoseBank", "hpi"],
  garments: ["outfit", "garment", "wardrobe", "item"],
  layering: ["layering", "wardrobeIntegration"],
  colors: ["color", "material", "colorMaterialDrift", "fabric"],
  texture: ["texture", "fabric", "material"],
  fit_on_body: ["wardrobeIntegration", "layering", "fit"],
  accessories: ["accessory", "accessories"],
  product_identity: ["product", "primaryItem", "itemFidelity", "visualItemFidelity"],
  product_quantity: ["count", "quantity", "requestedCount", "allocator"],
  product_position: ["position", "routing", "referenceRouter"],
  product_orientation: ["orientation", "angle", "cameraGrammar"],
  furniture: ["scene", "world", "sceneFingerprint"],
  decor: ["scene", "decor", "sceneFingerprint"],
  duplications: ["duplicat", "collage", "REF0"],
  invented_objects: ["invented", "brandedPackaging", "externalBranding"],
  continuity: ["continuity", "sceneFingerprint", "sceneDrift"],
  ugc_style: ["renderProfile", "iphone_camera_roll", "UGC_CASUAL_COMPOSITION"],
  iphone_realism: ["renderProfile", "iphone", "NO_STUDIO_BACKDROP"],
  lighting: ["renderProfile", "lighting"],
  composition: ["composition", "UGC_CASUAL_COMPOSITION", "framing"],
  narrative: ["beat", "storyBeat", "narrativeStage", "promptBuilder"],
};
