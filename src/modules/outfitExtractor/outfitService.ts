// modules/outfitExtractor/outfitService.ts
import { OutfitKit, OutfitItem } from "./types";

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
  return data.json || JSON.parse(data.text);
}

async function callImageAPI(
  prompt: string,
  referenceImages?: string[],
  aspectRatio: '1:1' | '3:4' = '3:4',
  model: string = 'gemini-2.5-flash-image'
): Promise<string> {
  const refs = referenceImages?.map(img => ({
    data: img.replace(/^data:image\/\w+;base64,/, ''),
    mimeType: 'image/jpeg'
  })) || [];

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
    const analysis = await callContentAPI('analyzeOutfit', 
      'Extract all clothing items from this outfit image. For each item provide: name, category (main_garment|top|bottom|footwear|bag|accessory), visual_description, ghost_mannequin_prompt, confidence_score, and coordinates (x,y normalized 0-1000). Return JSON array.',
      [image]
    );

    return {
      id: Date.now().toString(),
      originalImage: image,
      items: (analysis.items || []).map((item: any) => ({
        id: Math.random().toString(36).substr(2, 9),
        name: item.name,
        category: item.category,
        description: item.visual_description,
        visualDescription: item.visual_description,
        ghostPrompt: item.ghost_mannequin_prompt,
        confidenceScore: item.confidence_score || 0.95,
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
      [originalImage], // REF0 = imagen original de la persona
      '3:4',
      'gemini-2.5-flash-image' // modelo rápido y económico
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
  }
};