// src/modules/outfitExtractor/outfitService.ts
// ─────────────────────────────────────────────────────────────────────────────
// Análisis de outfit (texto → api/gemini/content, gemini-2.5-flash, síncrono)
// Renders de prendas (imágenes → imageApiService, Gemini 3, async).
// ─────────────────────────────────────────────────────────────────────────────

import { OutfitKit, OutfitItem, SavedOutfitItem, OutfitLayerMetadata, OutfitLayerRole } from './types';
import { compressImageForUpload } from '../../utils/imageUtils';
import { imageApiService, extractImageRef, type ModelId, type GenerateImageParams } from '../../services/imageApiService';
import { getAuth } from 'firebase/auth';

async function getAuthHeader(): Promise<Record<string, string>> {
  const token = await getAuth().currentUser?.getIdToken().catch(() => null);
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

const CONTENT_API = '/api/gemini/content';
const MAX_FINAL_REFERENCES = 10;

// ─── Análisis de texto (síncrono, gemini-2.5-flash) ──────────────────────────

async function callContentAPI(action: string, prompt: string, images?: string[]): Promise<any> {
  const payload: any = { action, prompt };
  if (images?.length) {
    payload.images    = images.map(img => img.replace(/^data:image\/\w+;base64,/, ''));
    payload.mimeTypes = images.map(() => 'image/jpeg');
  }
  const res  = await fetch(CONTENT_API, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', ...(await getAuthHeader()) },
    body:    JSON.stringify(payload),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Content API error');

  if (data.json) return data.json;

  if (data.text) {
    const clean = data.text.replace(/```json\s*|\s*```/g, '').trim();
    try { return JSON.parse(clean); } catch { throw new Error('Invalid JSON response from API'); }
  }
  throw new Error('No data in response');
}

// ─── Generación de imágenes (async, Gemini 3) ─────────────────────────────────

async function generateOutfitImage(
  prompt: string,
  referenceImages: string[],
  aspectRatio: '1:1' | '3:4' = '3:4',
  modelId: ModelId = 'gemini',
  sessionParams?: Partial<GenerateImageParams>,
  negativeExtra = '',
): Promise<string> {
  const compressed = await Promise.all(
    referenceImages.map(img => compressImageForUpload(img)),
  );

  const refs = compressed.map((img, i) => {
    try { return extractImageRef(img, `outfitRef[${i}]`); } catch { return null; }
  }).filter(Boolean) as Array<{ data: string; mimeType: string }>;

  return imageApiService.generateImage({
    prompt,
    negative: [
      'human skin, face, mannequin parts, background, text, watermark, shadow on background',
      negativeExtra,
    ].filter(Boolean).join(', '),
    referenceImages: refs.length > 0 ? refs : undefined,
    aspectRatio,
    module: 'outfit',
    moduleLabel: 'Outfit',
    modelId,
    ...sessionParams,
  });
}

function isolationContractForItem(item: OutfitItem): { prompt: string; negative: string } {
  const commonPrompt = `STRICT ISOLATION CONTRACT:
- Render ONLY the target item: "${item.name}".
- Do not include neighboring garments, accessories, body parts, hands, feet, shoes, floor, walls, props, bags, or shadows from the original scene.
- If part of the target item is hidden by another object, reconstruct the missing part naturally using the visible fabric, color, stitching, silhouette, and symmetry.
- The final image must look like a clean product catalog cutout of a single item, centered on pure white.`;

  const commonNegative = 'extra garment, neighboring clothing, hands, arms, legs, feet, skin, floor, wall, room, street, props, bag, purse, jewelry, duplicated item';

  if (item.category === 'bottom') {
    return {
      prompt: `${commonPrompt}
BOTTOM GARMENT RULES:
- Show only the pants/jeans/trousers from waistband to hem.
- The hem must end cleanly as fabric, with no shoes, boots, toes, feet, ankles, soles, or black triangular shoe tips visible.
- Do not continue the pant legs into footwear. Do not place any object under the hem except a subtle studio shadow if needed.
- Preserve waist, pockets, fly, seams, denim wash, leg width, and hem stitching from the reference.`,
      negative: `${commonNegative}, shoes, boots, heels, sneakers, sandals, footwear, toes, feet, ankles, soles, black shoe tips, pointed shoes, shoe caps`,
    };
  }

  if (item.category === 'main_garment') {
    return {
      prompt: `${commonPrompt}
FULL GARMENT RULES:
- Show only the complete target garment.
- No shoes, feet, hands, head, hair, jewelry, bag, body parts, or unrelated clothing.
- Reconstruct hidden edges, closures, hem, silhouette, and fabric folds cleanly.`,
      negative: `${commonNegative}, shoes, boots, footwear, feet, hands, head, hair, jewelry, bag, unrelated clothing`,
    };
  }

  if (item.category === 'top') {
    return {
      prompt: `${commonPrompt}
UPPER GARMENT RULES:
- Show only the target upper garment.
- No pants, skirt, waistband, hands, arms, neck, head, hair, jewelry, bag straps, or skin.
- Reconstruct hidden edges, armholes, collar, hem, and fabric folds cleanly.`,
      negative: `${commonNegative}, pants, jeans, skirt, shorts, waistband, hands, arms, neck, head, hair, necklace, bag strap`,
    };
  }

  if (item.category === 'footwear') {
    return {
      prompt: `${commonPrompt}
FOOTWEAR RULES:
- Show only the footwear as a product pair or single product if only one is visible.
- No pants, legs, socks, feet, floor, or body parts.
- Reconstruct occluded footwear areas cleanly and symmetrically.`,
      negative: `${commonNegative}, pants, jeans, legs, socks, feet, toes, floor`,
    };
  }

  if (item.category === 'bag' || item.category === 'accessory') {
    return {
      prompt: `${commonPrompt}
ACCESSORY RULES:
- Show only the target accessory.
- No hands, arms, body, clothing, straps from unrelated garments, or surrounding objects.
- Reconstruct occluded edges and hardware cleanly.`,
      negative: `${commonNegative}, hands, arms, body, clothing, shirt, pants, unrelated straps`,
    };
  }

  return { prompt: commonPrompt, negative: commonNegative };
}

type LayerableItem = Pick<OutfitItem, 'name' | 'category' | 'description' | 'visualDescription' | 'layerMetadata'>;

const LAYER_ORDER: Record<OutfitLayerRole, number> = {
  one_piece: 10,
  base_upper: 20,
  mid_upper: 30,
  bottom: 40,
  footwear: 50,
  outerwear: 60,
  bag: 70,
  accessory: 80,
};

const LAYER_ROLE_LABELS: Record<OutfitLayerRole, string> = {
  base_upper: 'base upper layer',
  mid_upper: 'middle upper layer',
  outerwear: 'outerwear top layer',
  bottom: 'bottom layer',
  footwear: 'footwear layer',
  bag: 'bag layer',
  accessory: 'accessory layer',
  one_piece: 'one-piece base layer',
};

const allowedLayerRoles: OutfitLayerRole[] = [
  'base_upper',
  'mid_upper',
  'outerwear',
  'bottom',
  'footwear',
  'bag',
  'accessory',
  'one_piece',
];

const normalizeText = (text: string) =>
  text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.map(v => String(v || '').trim()).filter(Boolean)
    : typeof value === 'string' && value.trim()
      ? [value.trim()]
      : [];

const pickAllowed = <T extends string>(value: unknown, allowed: readonly T[], fallback?: T): T | undefined => {
  const normalized = String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_') as T;
  return allowed.includes(normalized) ? normalized : fallback;
};

function inferLayerRole(item: LayerableItem): OutfitLayerRole {
  const text = normalizeText(`${item.name} ${item.description || ''} ${item.visualDescription || ''}`);
  if (item.category === 'footwear') return 'footwear';
  if (item.category === 'bag') return 'bag';
  if (item.category === 'accessory') return 'accessory';
  if (item.category === 'bottom') return 'bottom';
  if (/(coat|abrigo|trench|gabardina|jacket|chaqueta|blazer|parka|outerwear|leather jacket|saco|sobretodo)/.test(text)) {
    return 'outerwear';
  }
  if (/(dress|vestido|jumpsuit|enterito|mono|overall)/.test(text)) return 'one_piece';
  if (/(sweater|sueter|jersey|hoodie|sudadera|cardigan|chaleco|vest)/.test(text)) return 'mid_upper';
  if (item.category === 'top') return 'base_upper';
  return item.category === 'main_garment' ? 'one_piece' : 'accessory';
}

function inferGarmentType(item: LayerableItem): string {
  const text = normalizeText(`${item.name} ${item.description || ''} ${item.visualDescription || ''}`);
  const matches: Array<[RegExp, string]> = [
    [/(trench|gabardina)/, 'trench coat'],
    [/(coat|abrigo|sobretodo)/, 'coat'],
    [/(leather jacket|chaqueta de cuero|biker)/, 'leather jacket'],
    [/(blazer|saco)/, 'blazer'],
    [/(cardigan)/, 'cardigan'],
    [/(sweater|sueter|jersey)/, 'sweater'],
    [/(blouse|blusa)/, 'blouse'],
    [/(shirt|camisa)/, 'shirt'],
    [/(turtleneck|cuello alto|beatle)/, 'turtleneck top'],
    [/(bodysuit|body)/, 'bodysuit'],
    [/(tank|halter|musculosa)/, 'sleeveless top'],
    [/(flare|pata ancha|wide leg|wide-leg)/, 'wide leg pants'],
    [/(skinny|pitillo|ajustado)/, 'skinny pants'],
    [/(jeans|denim|mezclilla)/, 'jeans'],
    [/(skirt|falda)/, 'skirt'],
    [/(shorts|bermuda)/, 'shorts'],
    [/(dress|vestido)/, 'dress'],
    [/(boot|bota)/, 'boots'],
    [/(sneaker|zapatilla|tenis)/, 'sneakers'],
    [/(heel|tacon|stiletto)/, 'heels'],
    [/(bag|bolso|cartera)/, 'bag'],
  ];
  return matches.find(([regex]) => regex.test(text))?.[1] || item.category;
}

function inferBodyZones(role: OutfitLayerRole): string[] {
  if (role === 'base_upper' || role === 'mid_upper') return ['torso', 'shoulders', 'arms'];
  if (role === 'outerwear') return ['shoulders', 'torso', 'arms', 'hips'];
  if (role === 'bottom') return ['waist', 'hips', 'legs'];
  if (role === 'footwear') return ['feet', 'ankles'];
  if (role === 'one_piece') return ['torso', 'waist', 'hips', 'legs'];
  if (role === 'bag') return ['side', 'handheld'];
  return ['visible accessory area'];
}

function inferFit(item: LayerableItem): OutfitLayerMetadata['fit'] {
  const text = normalizeText(`${item.name} ${item.description || ''} ${item.visualDescription || ''}`);
  if (/(skinny|pitillo|bodycon|fitted|ajustad|tight)/.test(text)) return 'tight';
  if (/(oversized|over size|amplio|extra grande)/.test(text)) return 'oversized';
  if (/(wide|pata ancha|ancho|flare|campana)/.test(text)) return 'wide';
  if (/(relaxed|suelto|holgado)/.test(text)) return 'relaxed';
  return 'regular';
}

function inferCoverage(item: LayerableItem): OutfitLayerMetadata['coverage'] {
  const text = normalizeText(`${item.name} ${item.description || ''} ${item.visualDescription || ''}`);
  if (/(cropped|crop|corto a la cintura)/.test(text)) return 'cropped';
  if (/(mini|short|shorts)/.test(text)) return 'thigh';
  if (/(knee|rodilla)/.test(text)) return 'knee';
  if (/(midi|calf|pantorrilla)/.test(text)) return 'calf';
  if (/(ankle|tobillo)/.test(text)) return 'ankle';
  if (/(full length|largo completo|maxi|largo)/.test(text)) return 'full_length';
  if (item.category === 'top') return 'waist';
  if (item.category === 'bottom' || item.category === 'footwear') return 'ankle';
  return 'hip';
}

function inferOpening(item: LayerableItem): OutfitLayerMetadata['opening'] | undefined {
  const text = normalizeText(`${item.name} ${item.description || ''} ${item.visualDescription || ''}`);
  if (/(open|abierto)/.test(text)) return 'open_front';
  if (/(zip|zipper|cierre|cremallera)/.test(text)) return 'zipper';
  if (/(button|boton|abotonad)/.test(text)) return 'buttoned';
  if (/(wrap|cruzado)/.test(text)) return 'wrap';
  if (/(pullover|sueter|sweater|top|blouse|blusa|shirt|camisa|turtleneck|cuello alto)/.test(text)) return 'pullover';
  return undefined;
}

function inferLegShape(item: LayerableItem): OutfitLayerMetadata['legShape'] | undefined {
  if (item.category !== 'bottom') return undefined;
  const text = normalizeText(`${item.name} ${item.description || ''} ${item.visualDescription || ''}`);
  if (/(skinny|pitillo|ajustad)/.test(text)) return 'skinny';
  if (/(flare|campana)/.test(text)) return 'flare';
  if (/(bootcut)/.test(text)) return 'bootcut';
  if (/(wide|pata ancha|pierna ancha|palazzo)/.test(text)) return 'wide';
  if (/(short|bermuda)/.test(text)) return 'short';
  return 'straight';
}

function inferFootwearHeight(item: LayerableItem): OutfitLayerMetadata['footwearHeight'] | undefined {
  if (item.category !== 'footwear') return undefined;
  const text = normalizeText(`${item.name} ${item.description || ''} ${item.visualDescription || ''}`);
  if (/(over knee|sobre la rodilla|mosqueter)/.test(text)) return 'over_knee';
  if (/(knee|rodilla|bota alta)/.test(text)) return 'knee';
  if (/(mid calf|media cana|pantorrilla)/.test(text)) return 'mid_calf';
  if (/(ankle|botin|tobillo)/.test(text)) return 'ankle';
  return 'low';
}

function buildWearingRules(item: LayerableItem, metadata: Omit<OutfitLayerMetadata, 'wearingRules'>): string[] {
  const rules: string[] = [];
  if (metadata.layerRole === 'base_upper') rules.push('Wear as the first visible upper-body layer, under sweaters, blazers, jackets, or coats.');
  if (metadata.layerRole === 'mid_upper') rules.push('Wear over base tops and under outerwear; preserve natural collar, cuff, and hem overlap.');
  if (metadata.layerRole === 'outerwear') rules.push('Wear above all upper layers; keep front open enough to reveal selected inner layers when present.');
  if (metadata.layerRole === 'bottom') {
    rules.push('Align at the waist or hips according to the reference and keep the true leg silhouette.');
    if (metadata.legShape === 'skinny') rules.push('Skinny legs may tuck into boots or allow tall boots to sit visibly over the pant leg.');
    if (metadata.legShape === 'wide' || metadata.legShape === 'flare' || metadata.legShape === 'bootcut') {
      rules.push('Wide, flare, or bootcut hems must fall over footwear; show only the footwear parts that would naturally remain visible.');
    }
  }
  if (metadata.layerRole === 'footwear') rules.push('Place below the selected bottom garment with realistic overlap at the hem.');
  if (metadata.layerRole === 'bag') rules.push('Place naturally at the side, shoulder, or hand-carry position without covering key garment details.');
  if (metadata.layerRole === 'accessory') rules.push('Place only where the accessory is normally worn, scaled correctly against the outfit.');
  if (metadata.layerRole === 'one_piece') rules.push('Use as the primary base silhouette; layer outerwear above it if selected.');
  return rules;
}

function normalizeLayerMetadata(item: LayerableItem, raw?: any): OutfitLayerMetadata {
  const inferredRole = inferLayerRole(item);
  const rawRole = pickAllowed(raw?.layer_role ?? raw?.layerRole, allowedLayerRoles, inferredRole) || inferredRole;
  const metadataBase: Omit<OutfitLayerMetadata, 'wearingRules'> = {
    layerRole: rawRole,
    garmentType: String(raw?.garment_type ?? raw?.garmentType ?? inferGarmentType(item)).trim() || item.category,
    bodyZones: asStringArray(raw?.body_zones ?? raw?.bodyZones),
    fit: pickAllowed(raw?.fit, ['tight', 'regular', 'relaxed', 'oversized', 'wide'], inferFit(item)),
    coverage: pickAllowed(raw?.coverage, ['cropped', 'waist', 'hip', 'thigh', 'knee', 'calf', 'ankle', 'full_length'], inferCoverage(item)),
    opening: pickAllowed(raw?.opening, ['open_front', 'closed_front', 'pullover', 'zipper', 'buttoned', 'wrap'], inferOpening(item)),
    legShape: pickAllowed(raw?.leg_shape ?? raw?.legShape, ['skinny', 'straight', 'wide', 'flare', 'bootcut', 'short'], inferLegShape(item)),
    footwearHeight: pickAllowed(raw?.footwear_height ?? raw?.footwearHeight, ['low', 'ankle', 'mid_calf', 'knee', 'over_knee'], inferFootwearHeight(item)),
  };

  if (metadataBase.bodyZones.length === 0) metadataBase.bodyZones = inferBodyZones(metadataBase.layerRole);

  const rawRules = asStringArray(raw?.wearing_rules ?? raw?.wearingRules);
  const inferredRules = buildWearingRules(item, metadataBase);
  return {
    ...metadataBase,
    wearingRules: [...rawRules, ...inferredRules].filter((rule, index, list) => list.indexOf(rule) === index),
  };
}

function withLayerMetadata<T extends LayerableItem>(item: T): T & { layerMetadata: OutfitLayerMetadata } {
  return {
    ...item,
    layerMetadata: normalizeLayerMetadata(item, item.layerMetadata),
  };
}

function sortLayeredItems<T extends LayerableItem>(items: T[]): Array<T & { layerMetadata: OutfitLayerMetadata }> {
  return items
    .map(item => withLayerMetadata(item))
    .sort((a, b) => {
      const byLayer = LAYER_ORDER[a.layerMetadata.layerRole] - LAYER_ORDER[b.layerMetadata.layerRole];
      return byLayer || a.name.localeCompare(b.name);
    });
}

function itemLayerDetails(item: LayerableItem): string {
  const metadata = withLayerMetadata(item).layerMetadata;
  const parts = [
    `garment type: ${metadata.garmentType}`,
    `fit: ${metadata.fit}`,
    `coverage: ${metadata.coverage}`,
    metadata.opening ? `opening: ${metadata.opening}` : '',
    metadata.legShape ? `leg shape: ${metadata.legShape}` : '',
    metadata.footwearHeight ? `footwear height: ${metadata.footwearHeight}` : '',
    metadata.bodyZones.length ? `body zones: ${metadata.bodyZones.join(', ')}` : '',
  ].filter(Boolean);
  return parts.join('; ');
}

function buildOutfitAssemblyPlan(items: LayerableItem[]): string {
  const orderedItems = sortLayeredItems(items);
  const lines = orderedItems.map((item, index) => {
    const metadata = item.layerMetadata;
    const details = itemLayerDetails(item);
    const rules = metadata.wearingRules.length ? ` Rules: ${metadata.wearingRules.join(' ')}` : '';
    return `${index + 1}. ${LAYER_ROLE_LABELS[metadata.layerRole]}: ${item.name} (${metadata.garmentType}). Details: ${details}.${rules}`;
  });

  const hasBase = orderedItems.some(item => item.layerMetadata.layerRole === 'base_upper');
  const hasMid = orderedItems.some(item => item.layerMetadata.layerRole === 'mid_upper');
  const hasOuter = orderedItems.some(item => item.layerMetadata.layerRole === 'outerwear');
  const bottoms = orderedItems.filter(item => item.layerMetadata.layerRole === 'bottom');
  const footwear = orderedItems.filter(item => item.layerMetadata.layerRole === 'footwear');

  if (hasBase && hasMid) lines.push('Upper-body interaction: middle upper layers must sit over base tops, with only realistic collar, cuff, neckline, or hem visibility.');
  if (hasOuter && (hasBase || hasMid || bottoms.length > 0)) lines.push('Outerwear interaction: outerwear must sit on top of all selected inner garments and stay open enough to reveal the outfit structure underneath.');
  bottoms.forEach(bottom => {
    footwear.forEach(shoe => {
      const shape = bottom.layerMetadata.legShape;
      const bootHeight = shoe.layerMetadata.footwearHeight;
      if (shape === 'skinny' && bootHeight && ['ankle', 'mid_calf', 'knee', 'over_knee'].includes(bootHeight)) {
        lines.push(`Footwear interaction: ${shoe.name} can sit visibly over or around the skinny leg of ${bottom.name}.`);
      } else if (shape === 'wide' || shape === 'flare' || shape === 'bootcut') {
        lines.push(`Footwear interaction: the hem of ${bottom.name} must fall over ${shoe.name}; do not place the boot shaft on top of the wide hem.`);
      } else {
        lines.push(`Footwear interaction: align ${shoe.name} naturally under the hem of ${bottom.name}.`);
      }
    });
  });

  return lines.join('\n');
}

function itemLayerRole(item: LayerableItem): string {
  const metadata = withLayerMetadata(item).layerMetadata;
  return LAYER_ROLE_LABELS[metadata.layerRole];
  /*
  const text = `${item.name} ${item.description || ''} ${item.visualDescription || ''}`.toLowerCase();
  if (item.category === 'footwear') return 'footwear layer';
  if (item.category === 'bottom') return 'bottom layer';
  if (item.category === 'bag' || item.category === 'accessory') return 'accessory layer';
  if (/(coat|abrigo|trench|jacket|chaqueta|blazer|cardigan|parka|outerwear|leather jacket|chaquet[aó]n)/i.test(text)) {
    return 'outerwear layer';
  }
  if (/(turtleneck|cuello alto|bodysuit|body|top|shirt|blouse|camisa|sweater|chaleco|tank|halter)/i.test(text)) {
    return 'base upper layer';
  }
  if (/(dress|vestido|jumpsuit|enterito|mono)/i.test(text)) return 'one-piece base layer';
  return item.category === 'main_garment' ? 'main visible layer' : 'supporting layer';
  */
}

function buildLayeredOutfitPrompt(
  items: LayerableItem[],
  title: string,
  options: { useOriginalLayerGuide?: boolean; excludedItems?: LayerableItem[] } = {},
): string {
  const refOffset = options.useOriginalLayerGuide ? 1 : 0;
  const itemList = items
    .map((item, index) => {
      const details = item.visualDescription || item.description || 'preserve the exact visible design from its reference';
      return `REF${index + refOffset}: ${item.name} (${item.category}) — ${itemLayerRole(item)}. ${details}`;
    })
    .join('\n');
  const excludedList = options.excludedItems?.length
    ? options.excludedItems.map(item => `- ${item.name} (${item.category})`).join('\n')
    : '- None';
  const originalGuide = options.useOriginalLayerGuide
    ? `ORIGINAL IMAGE GUIDE:
- REF0 is the original outfit photo. Use REF0 only to understand the real outfit layering, styling order, proportions, overlap, and how the garments sit together.
- REF0 is NOT permission to include every visible item. The allowed garments are only the item references listed below.
- If an item appears in REF0 but is not listed as an approved item reference, do not include it.`
    : '';
  const assemblyPlan = buildOutfitAssemblyPlan(items);

  return `[${title}]
Create a perfect ghost mannequin render of the full outfit.
Respect the layers, colors, designs, silhouettes, proportions, materials, and textures of every garment exactly.
Create one single full-outfit reference image, not a flat catalog collage.
Use the provided isolated garment references to assemble the outfit as it would be worn on an invisible full-body mannequin.
${originalGuide}

APPROVED ITEMS AND LAYER ROLES:
${itemList}

DO NOT INCLUDE THESE DETECTED ITEMS:
${excludedList}

OUTFIT ASSEMBLY PLAN:
${assemblyPlan}

LAYERING REQUIREMENTS:
- Priority order: faithful outfit structure first, correct layer overlap second, exact fabric/color/texture third, clean studio presentation fourth.
- Preserve how the outfit is layered: base top/body first, skirt or pants aligned at the waist, outerwear/coat/jacket worn over the base layer, footwear aligned below the legs, accessories placed where they would naturally be carried or worn.
- For long coats, trench coats, oversized jackets, or open outerwear: show the outerwear open enough to reveal the inner top and bottom/skirt underneath. The coat must sit behind and over the inner garments, with correct overlap at shoulders, torso, sleeves, sides, and hem.
- Do not simplify layered outfits into separate floating garments. Keep the garments visually connected as one dressed silhouette.
- Do not invent different colors, cuts, lengths, closures, collars, necklines, sleeve shapes, waist height, hem length, boot height, or bag placement.
- Do not add any garment, bag, accessory, shoe, or prop that is not explicitly listed under approved items.
- Do not scatter garments as unrelated product thumbnails. Do not make a grid, collage, floating layout, or separate catalog arrangement.
- The result must communicate one coherent outfit silhouette and the order of layers clearly enough for another image model to understand the styling.
- Use ghost mannequin logic only: no visible person, no skin, no face, no hands, no legs, no mannequin body parts.
- Pure white background, full-length vertical composition, consistent scale, centered, clean studio lighting.
- Preserve material identity and color: leather remains leather, denim remains denim, knit/rib remains knit/rib, boots remain boots.`;
}

// ─── API pública ──────────────────────────────────────────────────────────────

export const outfitService = {

  async analyzeOutfit(image: string): Promise<OutfitKit> {
    const prompt = `You are a fashion analyst. Analyze the outfit in this image and identify each individual garment/accessory.
For each item return:
- name (specific name, e.g. "White linen blazer")
- category (one of: main_garment, top, bottom, footwear, bag, accessory)
- visual_description (detailed description for rendering)
- ghost_mannequin_prompt (how to render as isolated ghost mannequin)
- layer_metadata: {
    layer_role: one of base_upper, mid_upper, outerwear, bottom, footwear, bag, accessory, one_piece,
    garment_type: specific garment type such as blouse, sweater, coat, skinny jeans, flare jeans, knee boots,
    body_zones: string array,
    fit: one of tight, regular, relaxed, oversized, wide,
    coverage: one of cropped, waist, hip, thigh, knee, calf, ankle, full_length,
    opening: one of open_front, closed_front, pullover, zipper, buttoned, wrap,
    leg_shape: one of skinny, straight, wide, flare, bootcut, short when relevant,
    footwear_height: one of low, ankle, mid_calf, knee, over_knee when relevant,
    wearing_rules: short string array explaining how this item layers with others
  }
- confidence_score (number 0-1)
- coordinates: { x: number (0-1000), y: number (0-1000) }

Return ONLY valid JSON, no markdown formatting.`;

    const analysis = await callContentAPI('analyzeOutfit', prompt, [image]);
    // El modelo puede devolver { items: [...] } o directamente un array
    const itemsArray: any[] = Array.isArray(analysis)
      ? analysis
      : Array.isArray(analysis.items)
        ? analysis.items
        : Array.isArray(analysis.garments)
          ? analysis.garments
          : [];
    console.log('[OutfitKit] Items detected:', itemsArray.length);

    return {
      id:            Date.now().toString(),
      originalImage: image,
      items:         itemsArray.map((item: any) => {
        const baseItem = {
          id:               Math.random().toString(36).substr(2, 9),
          name:             item.name || 'Prenda',
          category:         item.category || 'accessory',
          description:      item.visual_description || '',
          visualDescription: item.visual_description || '',
          ghostPrompt:      item.ghost_mannequin_prompt || '',
          confidenceScore:  item.confidence_score || 0.8,
          coordinates:      item.coordinates || { x: 500, y: 500 },
          selected:         true,
          status:           'pending' as const,
        } as OutfitItem;
        return {
          ...baseItem,
          layerMetadata: normalizeLayerMetadata(baseItem, item.layer_metadata || item.layerMetadata),
        };
      }),
      createdAt: Date.now(),
      inputType: 'REAL_PHOTO',
    };
  },

  async generateItemRender(
    item: OutfitItem,
    originalImage: string,
    modelId: ModelId = 'gemini',
    sessionParams?: Partial<GenerateImageParams>,
  ): Promise<string> {
    const isolation = isolationContractForItem(item);
    const visualReference = [
      item.visualDescription ? `Detected visual details: ${item.visualDescription}` : '',
      item.ghostPrompt ? `Original extraction guidance: ${item.ghostPrompt}` : '',
    ].filter(Boolean).join('\n');

    // Gemini interpreta "REF0" posicionalmente; Seedream necesita descripción textual
    const prompt = modelId === 'seedream'
      ? `[GHOST MANNEQUIN PRODUCT RENDER]
Render the "${item.name}" (${item.category}) shown in the reference image as a standalone e-commerce product.
The reference image shows the garment — extract it and render it isolated.
Preserve EXACT fabric, color, and details from the reference image.
Create realistic 3D volume (shoulders/torso curve) as if worn by an invisible person.
Pure white background (#FFFFFF). No human skin, face, or mannequin parts.
Studio lighting, soft shadow at base.
${visualReference}
${isolation.prompt}`
      : `[GHOST MANNEQUIN PRODUCT RENDER]
Render the "${item.name}" (${item.category}) from REF0 as a standalone e-commerce product.
Preserve EXACT fabric, color, and details from the reference image.
Create realistic 3D volume (shoulders/torso curve) as if worn by an invisible person.
Pure white background (#FFFFFF). No human skin, face, or mannequin parts.
Studio lighting, soft shadow at base.
${visualReference}
${isolation.prompt}`;

    return generateOutfitImage(prompt, [originalImage], '3:4', modelId, sessionParams, isolation.negative);
  },

  async generateFinalComposition(
    kit: OutfitKit,
    modelId: ModelId = 'gemini',
    sessionParams?: Partial<GenerateImageParams>,
  ): Promise<string> {
    const approvedItems = kit.items.filter(i => i.selected && i.imageUrl);
    if (approvedItems.length === 0) throw new Error('No hay elementos seleccionados.');

    const promptItems = sortLayeredItems(approvedItems).slice(0, MAX_FINAL_REFERENCES - 1);
    const approvedIds = new Set(promptItems.map(i => i.id));
    const excludedItems = kit.items.filter(i => !approvedIds.has(i.id));
    const refs   = [kit.originalImage, ...promptItems.map(i => i.imageUrl!)];
    const prompt = buildLayeredOutfitPrompt(promptItems, 'LAYERED OUTFIT ASSEMBLY', {
      useOriginalLayerGuide: true,
      excludedItems,
    });

    return generateOutfitImage(
      prompt,
      refs,
      '3:4',
      modelId,
      sessionParams,
      'flat lay, grid, collage, separate product thumbnails, unrelated arrangement, visible person, skin, face, hands, legs, mannequin body',
    );
  },

  async generateCombinationComposition(
    items: SavedOutfitItem[],
    modelId: ModelId = 'gemini',
    sessionParams?: Partial<GenerateImageParams>,
  ): Promise<string> {
    if (items.length === 0) throw new Error('No hay elementos seleccionados.');

    const promptItems = sortLayeredItems(items).slice(0, MAX_FINAL_REFERENCES);
    const refs   = promptItems.map(i => i.imageUrl);
    const prompt = buildLayeredOutfitPrompt(promptItems, 'CUSTOM LAYERED OUTFIT ASSEMBLY');

    return generateOutfitImage(
      prompt,
      refs,
      '3:4',
      modelId,
      sessionParams,
      'flat lay, grid, collage, separate product thumbnails, unrelated arrangement, visible person, skin, face, hands, legs, mannequin body',
    );
  },
};
