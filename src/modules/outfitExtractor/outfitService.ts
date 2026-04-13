import { geminiService } from "../../services/geminiService";
import { MODELS } from "../../services/creditConfig";
import { OutfitKit, OutfitItem } from "./types";

// ──────────────────────────────────────────
// outfitService — Outfit Kit
//
// extractOutfitKit → geminiService.analyzeOutfit (texto, gratis)
// generateItemRender → Imagen 4 Fast ($0.02) — prendas ghost SIN persona
// generateFinalComposition → Imagen 4 Fast ($0.02) — composición sin persona
// ──────────────────────────────────────────

export const outfitService = {

  async extractOutfitKit(image: string): Promise<OutfitKit> {
    // Análisis con texto — gratis
    const analysis = await geminiService.analyzeOutfit(image);

    const kit: OutfitKit = {
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

    return kit;
  },

  async generateItemRender(item: OutfitItem, originalImage: string): Promise<string> {
    const prompt = `
[ULTRA-TECHNICAL GHOST MANNEQUIN RENDER]
ITEM: ${item.name} (${item.category})
VISUAL DATA: ${item.visualDescription}

STRICT EXECUTION RULES:
1. VOLUME: The garment MUST appear filled with a 3D human shape. It should NOT look flat.
2. ANATOMY: Capture the realistic curvature of shoulders, torso, or limbs as if an invisible person is wearing it.
3. SHADOWS: Include soft internal shadows where the garment meets the "invisible skin" to emphasize depth and thickness of the fabric.
4. TEXTURE: Preserve 1:1 material fidelity from the reference image.
5. BACKGROUND: Pure #FFFFFF white background.
6. NO HUMAN: No skin, no hands, no face, no hair, no visible mannequin parts.
    `;

    // Imagen 4 Fast — prendas ghost no necesitan identidad facial
    // No soporta imágenes de referencia, usamos el prompt descriptivo detallado
    return await geminiService.generateImageFast(prompt, '3:4');
  },

  async generateFinalComposition(kit: OutfitKit): Promise<string> {
    const approvedItems = kit.items.filter(i => !!i.imageUrl && i.selected);
    if (approvedItems.length === 0) throw new Error("No hay elementos seleccionados.");

    // Describir cada prenda en el prompt para la composición final
    const itemDescriptions = approvedItems
      .map((item, i) => `Item ${i + 1}: ${item.name} — ${item.visualDescription}`)
      .join('\n');

    const prompt = `
[PROFESSIONAL OUTFIT KIT CATALOG COMPOSITION]
LAYOUT: Balanced commercial grid of fashion items on pure white background.
ITEMS TO INCLUDE:
${itemDescriptions}

STYLE: All items must show the GHOST MANNEQUIN 3D effect — filled with invisible body shape.
AESTHETIC: High-end e-commerce photography. Seamless pure white background.
CONSISTENCY: Uniform lighting and shadows across all assets.
NO HUMANS, NO MODELS, NO VISIBLE MANNEQUIN.
    `;

    // Imagen 4 Fast — composición de catálogo sin persona
    return await geminiService.generateImageFast(prompt, '1:1');
  }

};