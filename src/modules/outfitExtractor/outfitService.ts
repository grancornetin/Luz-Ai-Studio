// src/modules/outfitExtractor/outfitService.ts
// ─────────────────────────────────────────────────────────────────────────────
// Análisis de outfit (texto → api/gemini/content, gemini-2.5-flash, síncrono)
// Renders de prendas (imágenes → imageApiService, Gemini 3, async).
// ─────────────────────────────────────────────────────────────────────────────

import { OutfitKit, OutfitItem, SavedOutfitItem } from './types';
import { compressImageForUpload } from '../../utils/imageUtils';
import { imageApiService, extractImageRef, type ModelId, type GenerateImageParams } from '../../services/imageApiService';
import { getAuth } from 'firebase/auth';

async function getAuthHeader(): Promise<Record<string, string>> {
  const token = await getAuth().currentUser?.getIdToken().catch(() => null);
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

const CONTENT_API = '/api/gemini/content';

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

type LayerableItem = Pick<OutfitItem, 'name' | 'category' | 'description' | 'visualDescription'>;

function itemLayerRole(item: LayerableItem): string {
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
}

function buildLayeredOutfitPrompt(items: LayerableItem[], title: string): string {
  const itemList = items
    .map((item, index) => {
      const details = item.visualDescription || item.description || 'preserve the exact visible design from its reference';
      return `REF${index}: ${item.name} (${item.category}) — ${itemLayerRole(item)}. ${details}`;
    })
    .join('\n');

  return `[${title}]
Create a perfect ghost mannequin render of the full outfit.
Respect the layers, colors, designs, silhouettes, proportions, materials, and textures of every garment exactly.
Create one single full-outfit reference image, not a flat catalog collage.
Use the provided isolated garment references to assemble the outfit as it would be worn on an invisible full-body mannequin.

ITEMS AND LAYER ROLES:
${itemList}

LAYERING REQUIREMENTS:
- Priority order: faithful outfit structure first, correct layer overlap second, exact fabric/color/texture third, clean studio presentation fourth.
- Preserve how the outfit is layered: base top/body first, skirt or pants aligned at the waist, outerwear/coat/jacket worn over the base layer, footwear aligned below the legs, accessories placed where they would naturally be carried or worn.
- For long coats, trench coats, oversized jackets, or open outerwear: show the outerwear open enough to reveal the inner top and bottom/skirt underneath. The coat must sit behind and over the inner garments, with correct overlap at shoulders, torso, sleeves, sides, and hem.
- Do not simplify layered outfits into separate floating garments. Keep the garments visually connected as one dressed silhouette.
- Do not invent different colors, cuts, lengths, closures, collars, necklines, sleeve shapes, waist height, hem length, boot height, or bag placement.
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
      items:         itemsArray.map((item: any) => ({
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
      })),
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

    const refs   = approvedItems.map(i => i.imageUrl!);
    const prompt = buildLayeredOutfitPrompt(approvedItems, 'LAYERED OUTFIT ASSEMBLY');

    return generateOutfitImage(
      prompt,
      refs.slice(0, 8),
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

    const refs   = items.map(i => i.imageUrl);
    const prompt = buildLayeredOutfitPrompt(items, 'CUSTOM LAYERED OUTFIT ASSEMBLY');

    return generateOutfitImage(
      prompt,
      refs.slice(0, 8),
      '3:4',
      modelId,
      sessionParams,
      'flat lay, grid, collage, separate product thumbnails, unrelated arrangement, visible person, skin, face, hands, legs, mannequin body',
    );
  },
};
