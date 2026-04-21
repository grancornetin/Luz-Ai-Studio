// modules/outfitExtractor/outfitService.ts
import { OutfitKit, OutfitItem, SavedOutfitItem } from "./types";
import { compressImageForUpload } from '../../utils/imageUtils';

const API_BASE = '/api/gemini';

async function callContentAPI(action: string, prompt: string, images?: string[]): Promise<any> {
  const payload: any = { action, prompt };
  if (images?.length) {
    payload.images = images.map(img => img.replace(/^data:image\/\w+;base64,/, ''));
    payload.mimeTypes = images.map(() => 'image/jpeg');
  }
  const res = await fetch(`${API_BASE}/content`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Content API error');
  
  // Si ya viene parseado, lo usamos
  if (data.json) return data.json;
  
  // Si no, intentamos parsear data.text limpiando
  if (data.text) {
    const cleanText = data.text.replace(/```json\s*|\s*```/g, '').trim();
    try {
      return JSON.parse(cleanText);
    } catch {
      throw new Error('Invalid JSON response from API');
    }
  }
  throw new Error('No data in response');
}

async function callImageAPI(
  prompt: string,
  referenceImages?: string[],
  aspectRatio: '1:1' | '3:4' = '3:4',
  model: string = 'gemini-2.5-flash-image'
): Promise<string> {
  const compressed = referenceImages
    ? await Promise.all(referenceImages.map(img => compressImageForUpload(img)))
    : [];

  const refs = compressed.map(img => ({
    data: img.replace(/^data:image\/\w+;base64,/, ''),
    mimeType: 'image/jpeg'
  }));

  const res = await fetch(`${API_BASE}/image`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'generateImage',
      prompt,
      referenceImages: refs,
      aspectRatio,
      model
    })
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Image API error');
  return data.image;
}

export const outfitService = {
  async extractOutfitKit(image: string): Promise<OutfitKit> {
    const prompt = `Analyze this outfit image. Identify all visible clothing items.
Return a JSON object with an "items" array. Each item must have:
- name (string)
- category (one of: main_garment, top, bottom, footwear, bag, accessory)
- visual_description (detailed description for rendering)
- ghost_mannequin_prompt (how to render as isolated ghost mannequin)
- confidence_score (number 0-1)
- coordinates: { x: number (0-1000), y: number (0-1000) }

Return ONLY valid JSON, no markdown formatting.`;

    const analysis = await callContentAPI('analyzeOutfit', prompt, [image]);

    // Asegurar que items sea un array
    const itemsArray = Array.isArray(analysis.items) ? analysis.items : [];

    return {
      id: Date.now().toString(),
      originalImage: image,
      items: itemsArray.map((item: any) => ({
        id: Math.random().toString(36).substr(2, 9),
        name: item.name || 'Prenda',
        category: item.category || 'accessory',
        description: item.visual_description || '',
        visualDescription: item.visual_description || '',
        ghostPrompt: item.ghost_mannequin_prompt || '',
        confidenceScore: item.confidence_score || 0.8,
        coordinates: item.coordinates || { x: 500, y: 500 },
        selected: true,
        status: 'pending' as const
      })),
      createdAt: Date.now(),
      inputType: 'REAL_PHOTO'
    };
  },

  async generateItemRender(item: OutfitItem, originalImage: string): Promise<string> {
    const prompt = `[GHOST MANNEQUIN PRODUCT RENDER]
Render the "${item.name}" (${item.category}) from REF0 as a standalone e-commerce product.
Preserve EXACT fabric, color, and details from the reference image.
Create realistic 3D volume (shoulders/torso curve) as if worn by an invisible person.
Pure white background (#FFFFFF). No human skin, face, or mannequin parts.
Studio lighting, soft shadow at base.`;

    return await callImageAPI(
      prompt,
      [originalImage],
      '3:4',
      'gemini-2.5-flash-image'
    );
  },

  async generateFinalComposition(kit: OutfitKit): Promise<string> {
    const approvedItems = kit.items.filter(i => i.selected && i.imageUrl);
    if (approvedItems.length === 0) throw new Error("No hay elementos seleccionados.");

    const refs = approvedItems.map(i => i.imageUrl!);
    const itemList = approvedItems.map(i => `${i.name} (${i.category})`).join(', ');

    const prompt = `[CATALOG COMPOSITION]
Arrange the following isolated ghost mannequin garments on a pure white background in a professional e-commerce catalog layout.
Items: ${itemList}
Consistent lighting, soft shadows, no humans, no mannequins.`;

    return await callImageAPI(prompt, refs.slice(0, 4), '1:1', 'gemini-3.1-flash-image-preview');
  },

  // Nuevo método para combinaciones personalizadas
  async generateCombinationComposition(items: SavedOutfitItem[]): Promise<string> {
    if (items.length === 0) throw new Error("No hay elementos seleccionados.");
    
    const refs = items.map(i => i.imageUrl);
    const itemList = items.map(i => `${i.name} (${i.category})`).join(', ');
    
    const prompt = `[CUSTOM OUTFIT COMPOSITION]
Arrange the following garments on a pure white background in an aesthetically pleasing catalog layout.
Items: ${itemList}
All items must appear as isolated ghost mannequin products with 3D volume.
Consistent lighting, soft shadows, no humans.`;
    
    return await callImageAPI(prompt, refs.slice(0, 4), '1:1', 'gemini-3.1-flash-image-preview');
  }
};