/**
 * recipes/weeklyFavoritesV2/styleDetector.ts
 *
 * Implementación real de StyleDetector (ver anchor.ts): le muestra a la IA
 * todas las referencias de outfit/accesorio/producto subidas y le pide que
 * describa en palabras si hay un estilo general claro (elegante, casual,
 * deportivo, romántico, etc.) o si las referencias son demasiado dispares
 * como para inferir uno con confianza.
 *
 * No le pide que copie ninguna prenda — solo que describa el estilo, que
 * luego se usa como guía para generar un outfit nuevo y genérico acorde.
 */
import { compressImageForUpload } from '../../../../utils/imageUtils';
import { extractImageRef } from '../../../../services/imageApiService';
import type { StyleDetector } from './anchor';
import type { StyleDetectionResult } from './types';

const CONTENT_ENDPOINT = '/api/gemini/content';

async function getAuthHeader(): Promise<Record<string, string>> {
  const { getAuth } = await import('firebase/auth');
  const token = await getAuth().currentUser?.getIdToken().catch(() => null);
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

const STYLE_DETECTION_PROMPT = `You are a fashion stylist reviewing reference images uploaded by a user for a photo session.
Look at all images together as one set. Determine whether they share a clear, consistent overall style
(e.g. "elegant evening, dark tones", "casual streetwear", "romantic pastel", "sporty minimal").

Only answer styleIsClear: true if the images are consistent enough that you could confidently dress
someone in a NEW, GENERIC outfit that matches that same world — without copying any specific garment
from these images. If the images mix clearly different registers (e.g. a designer dress next to
casual sneakers with no unifying thread), answer styleIsClear: false.

Respond ONLY with valid JSON, no markdown:
{"styleIsClear": boolean, "styleDescription": "short phrase in English describing the shared style, empty string if not clear", "reason": "one short sentence in Spanish explaining the decision"}`;

export const geminiStyleDetector: StyleDetector = {
  async detectStyle(referenceUrls: string[]): Promise<StyleDetectionResult> {
    try {
      const compressed = await Promise.all(
        referenceUrls.map(async (url, i) => {
          const small = await compressImageForUpload(url, 512, 0.75).catch(() => url);
          return extractImageRef(small, `styleRef[${i}]`);
        })
      );

      const res = await fetch(CONTENT_ENDPOINT, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', ...(await getAuthHeader()) },
        body: JSON.stringify({
          action:    'analyzeVisualRefs',
          images:    compressed.map(e => e.data),
          mimeTypes: compressed.map(e => e.mimeType),
          prompt:    STYLE_DETECTION_PROMPT,
          model:     'gemini-2.5-flash',
        }),
      });

      if (!res.ok) {
        return { styleIsClear: false, styleDescription: '', reason: 'No se pudo analizar el estilo de las referencias (error de red).' };
      }

      const data = await res.json();
      if (!data.success || !data.json) {
        return { styleIsClear: false, styleDescription: '', reason: 'No se pudo analizar el estilo de las referencias (respuesta inválida).' };
      }

      const parsed = data.json as Partial<StyleDetectionResult>;
      return {
        styleIsClear:     Boolean(parsed.styleIsClear),
        styleDescription: typeof parsed.styleDescription === 'string' ? parsed.styleDescription : '',
        reason:            typeof parsed.reason === 'string' ? parsed.reason : '',
      };
    } catch {
      return { styleIsClear: false, styleDescription: '', reason: 'No se pudo analizar el estilo de las referencias (excepción inesperada).' };
    }
  },
};
