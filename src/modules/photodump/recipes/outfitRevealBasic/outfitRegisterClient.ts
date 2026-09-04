/**
 * recipes/outfitRevealBasic/outfitRegisterClient.ts
 *
 * Puerta de entrada al análisis de REGISTRO/FORMALIDAD del outfit — sep
 * 2026, pregunta real del usuario: "si la referencia del outfit es un
 * vestido tipo met gala, no lo vas a poner en un lugar campestre aunque el
 * lugar tenga un espejo". Esta receta no lee el brief de texto en ningún
 * punto (basePrompt no se usa en recipes/outfitRevealBasic/) — la foto del
 * outfit es la ÚNICA fuente confiable de qué tipo de lugar tiene sentido.
 *
 * Deliberadamente un archivo propio, no una extensión de outfitCheck/
 * poseClient.ts — mismo principio de aislamiento que el resto del proyecto:
 * este análisis es específico de "qué lugares son coherentes con este
 * outfit", no de pose/actitud del banco.
 */
import { getAuth } from 'firebase/auth';

const CONTENT_ENDPOINT = '/api/gemini/content';

// outfitRefUrl normalmente es una URL real de Storage, no un data URI —
// mismo patrón que extractImageParts en director/generic/genericClient.ts
// (privada ahí, replicada acá en vez de exportarla entre módulos distintos).
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
    console.warn('[outfitRevealBasic] extractImageParts: excepción al leer la referencia de outfit', err);
    return null;
  }
}

export type OutfitRegister = 'formal_evening' | 'smart_casual' | 'everyday_casual' | 'athletic_sport' | 'beach_resort';

// Lugares coherentes por registro — cada uno mantiene la premisa original
// del usuario ("lo único que manda es que es mirror selfie"): el lugar
// sigue siendo libre DENTRO de la categoría, nunca un lugar único fijo.
const PLACES_BY_REGISTER: Record<OutfitRegister, string> = {
  formal_evening:   'a hotel hallway or lobby mirror, an elegant bathroom (restaurant, hotel, event venue), a bedroom or dressing area getting ready for a formal event — never a gym, a casual store fitting room, or an outdoor/campestre setting',
  smart_casual:     'a bedroom, a store fitting room, an office bathroom, a nice restaurant or bar bathroom, a hotel hallway — a polished everyday setting, not athletic or beachwear-coded',
  everyday_casual:  'a bedroom, a bathroom, a store fitting room, a hallway, a casual café or shop bathroom — any ordinary real place, athletic or beach settings excluded',
  athletic_sport:   'a gym locker room or mirror, a yoga/pilates studio mirror, a home gym corner, a sports club bathroom — never a formal venue, elegant hotel, or beachwear setting',
  beach_resort:     'a beach house or resort room mirror, a pool house or cabana bathroom, a resort hallway — never a gym, office, or formal evening venue',
};

export function placesForRegister(register: OutfitRegister | null): string {
  if (!register) return 'a bedroom, a bathroom, a store fitting room, a restaurant or bar bathroom, a hotel hallway or lobby, a mall, a gym, or any other real everyday space';
  return PLACES_BY_REGISTER[register];
}

async function getAuthHeader(): Promise<Record<string, string>> {
  const token = await getAuth().currentUser?.getIdToken().catch(() => null);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Analiza la foto de referencia del outfit y devuelve su registro de
 * formalidad/ocasión — nunca lanza; devuelve null si falla (el caller cae a
 * placesForRegister(null), el texto genérico ya validado, sin bloquear la
 * generación por esto).
 */
export async function analyzeOutfitRegister(outfitRefUrl: string): Promise<OutfitRegister | null> {
  const extracted = await extractImageParts(outfitRefUrl);
  if (!extracted) return null;
  try {
    const res = await fetch(CONTENT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await getAuthHeader()) },
      body: JSON.stringify({
        action: 'analyzeOutfitRegister',
        payload: { imageData: extracted.data, mimeType: extracted.mimeType },
      }),
    });
    if (!res.ok) {
      console.warn(`[outfitRevealBasic] analyzeOutfitRegister: el endpoint devolvió ${res.status}`);
      return null;
    }
    const data = await res.json();
    const validRegisters: OutfitRegister[] = ['formal_evening', 'smart_casual', 'everyday_casual', 'athletic_sport', 'beach_resort'];
    return validRegisters.includes(data?.register) ? data.register : null;
  } catch (err) {
    console.warn('[outfitRevealBasic] analyzeOutfitRegister: excepción en la llamada', err);
    return null;
  }
}
