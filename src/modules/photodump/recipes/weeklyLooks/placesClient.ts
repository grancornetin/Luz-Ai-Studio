/**
 * recipes/weeklyLooks/placesClient.ts
 *
 * Puerta de entrada al análisis de LUGARES para el modo varied_place — sep
 * 2026, corrección real pedida por el usuario tras ver el resultado en
 * producción: la lista fija PLACES_BY_REGISTER (heredada de
 * outfitRevealBasic) era genérica y el modelo convergía siempre al mismo
 * lugar "más obvio" de la lista.
 *
 * El usuario pidió pensar la SITUACIÓN real ("vio un reflejo de cómo se
 * veía y tomó una mirror selfie ahí") en vez de una lista cerrada — este
 * cliente le pide a Gemini una lista libre y concreta de 6-8 lugares reales,
 * combinando:
 *   - la foto del outfit (registro/formalidad, como ya hacía
 *     outfitRegisterClient)
 *   - el brief de texto del usuario, cuando está disponible (pedido
 *     explícito: "también usar el brief de texto")
 *   - si captureStyle === 'mirror_selfie', el pedido de pensar en cualquier
 *     superficie reflectante real (ascensor, vidriera, hall, vidrio de
 *     auto), no solo dormitorios/baños.
 *
 * Deliberadamente un cliente propio, no una extensión de
 * outfitRegisterClient.ts — ese sigue sirviendo tal cual a outfitRevealBasic
 * sin cambios de comportamiento.
 */
import { placesForRegister, type OutfitRegister } from '../outfitRevealBasic/outfitRegisterClient';

const CONTENT_ENDPOINT = '/api/gemini/content';

async function extractImageParts(imageUrl: string): Promise<{ data: string; mimeType: string } | null> {
  const directMatch = imageUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/);
  if (directMatch) {
    return { mimeType: directMatch[1], data: directMatch[2] };
  }
  try {
    const res = await fetch(imageUrl);
    if (!res.ok) return null;
    const blob = await res.blob();
    const dataUrl: string = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/);
    if (!match) return null;
    return { mimeType: match[1], data: match[2] };
  } catch (err) {
    console.warn('[weeklyLooks] extractImageParts: excepción al leer la referencia de outfit', err);
    return null;
  }
}

async function getAuthHeader(): Promise<Record<string, string>> {
  const { getAuth } = await import('firebase/auth');
  const token = await getAuth().currentUser?.getIdToken().catch(() => null);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Analiza la foto del outfit + brief de texto y devuelve 6-8 lugares
 * concretos y variados. mirrorNeeded=true empuja a pensar en superficies
 * reflectantes reales cuando captureStyle es mirror_selfie. Nunca lanza —
 * en caso de falla devuelve null, y el caller cae al fallback estático de
 * outfitRegisterClient (placesForRegister con register=null).
 */
export async function analyzeWeeklyLooksPlaces(
  outfitRefUrl: string,
  mirrorNeeded: boolean,
  briefText?:   string,
): Promise<string[] | null> {
  const extracted = await extractImageParts(outfitRefUrl);
  if (!extracted) return null;
  try {
    const res = await fetch(CONTENT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await getAuthHeader()) },
      body: JSON.stringify({
        action: 'analyzeWeeklyLooksPlaces',
        payload: { imageData: extracted.data, mimeType: extracted.mimeType, mirrorNeeded, briefText: briefText || undefined },
      }),
    });
    if (!res.ok) {
      console.warn(`[weeklyLooks] analyzeWeeklyLooksPlaces: el endpoint devolvió ${res.status}`);
      return null;
    }
    const data = await res.json();
    const places = Array.isArray(data?.places) ? data.places.filter((p: unknown) => typeof p === 'string' && p.trim().length > 0) : null;
    return places && places.length > 0 ? places : null;
  } catch (err) {
    console.warn('[weeklyLooks] analyzeWeeklyLooksPlaces: excepción en la llamada', err);
    return null;
  }
}

/** Fallback estático — mismo texto genérico que ya usa outfitRevealBasic,
 * partido en una lista para que assignPlacesToShots pueda rotar entre
 * opciones aunque el análisis real haya fallado. */
export function fallbackPlacesList(): string[] {
  return placesForRegister(null as OutfitRegister | null).split(' — ')[0].split(', ');
}
