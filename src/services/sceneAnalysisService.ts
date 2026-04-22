// src/services/sceneAnalysisService.ts
// Análisis de imagen para detectar objetos/productos en la escena target
import { geminiService } from './geminiService';

export interface DetectedObject {
  id: string;
  name: string;          // descripción corta, ej: "bolso negro", "reloj de pulsera"
  originalImageUrl?: string; // no se guarda, solo se usa para referencia
  replacementImage?: string | null; // imagen subida por el usuario para reemplazar
}

/**
 * Analiza una imagen y devuelve una lista de objetos/productos prominentes detectados.
 * Se usa en Scene Clone para permitir reemplazar elementos.
 */
export async function analyzeScene(imageBase64: string): Promise<DetectedObject[]> {
  const prompt = `
You are a product detection system. Analyze this image and identify the MAIN objects/products that a user might want to replace (e.g., bags, watches, shoes, accessories, electronic devices, etc.).
Return ONLY a JSON array of objects with "name" (short descriptive name in Spanish/English, max 4 words). Maximum 4 objects.
If no clear products are visible, return an empty array.
Do not include people, backgrounds, or furniture unless they are the main subject of the image (e.g., a chair that is a product to sell).
Example output: [{"name": "leather handbag"}, {"name": "smart watch"}]
Respond ONLY with valid JSON array, no extra text.
`;

  try {
    const response = await geminiService.analyzeImageWithText(imageBase64, prompt);
    // Intentar parsear JSON
    const cleaned = response.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) {
      return parsed.map((obj, idx) => ({
        id: `product_${idx}_${Date.now()}`,
        name: obj.name || `Producto ${idx + 1}`,
        replacementImage: null,
      }));
    }
  } catch (e) {
    console.warn('[sceneAnalysis] Failed to parse detected objects:', e);
  }
  return [];
}