/**
 * recipes/outfitMultiLook/anchorChain.ts
 *
 * Genera la cadena de N anclas para trip_recap — fondo variable por shot,
 * sin ancla única compartida. Cada look es un lugar distinto del mismo
 * viaje, mostrado con una imagen de referencia real del lugar (@escenaN),
 * no un nombre de texto.
 *
 * Adaptado de dayInLife.ts (generateDayInLifeRef0Chain), pero con una
 * diferencia real: cada eslabón de ESTA cadena necesita citar simultáneamente
 * el eslabón anterior (continuidad de identidad) Y un outfit específico
 * nuevo (el look de ese shot) — dayInLife comparte outfits entre bloques,
 * acá cada lugar lleva su propio look.
 *
 * Regla de negocio (ver manifiesto sección 6ter): el lugar de cada look lo
 * declara el usuario subiendo una foto real en el slot @escenaN — este
 * módulo nunca inventa qué lugar mostrar ni describe uno de memoria.
 * Corrección de diseño (julio 2026): la primera versión pedía escribir el
 * nombre del lugar en un input de texto debajo de cada outfit — confuso
 * visualmente (parecía un slot de imagen vacío) y menos fiel que citar una
 * foto real del lugar como referencia visual directa.
 */
import { imageApiService } from '../../../../services/imageApiService';
import { prepareRefs, getAspectRatio, NEGATIVE_SHORT } from '../shared';
import type { PhotodumpRefs, PhotodumpNarrative, PhotodumpProtagonist, PhotodumpDestino } from '../../types';
import type { LookItem, AnchorChainResult } from './types';
import { IPHONE_CAMERA_ROLL_LINE, UGC_CASUAL_COMPOSITION_BLOCK, NO_WALKING_LINE, AVOID_EDITORIAL_LINE } from './renderProfile';

const anchorChainCache = new Map<string, AnchorChainResult>();

function anchorChainCacheKey(refs: PhotodumpRefs, basePrompt: string): string {
  const urls = [
    refs.avatarRef, refs.bodyRef, refs.outfitRef, ...(refs.outfitRefs ?? []),
    refs.sceneRef, ...(refs.sceneRefs ?? []),
  ].filter(Boolean);
  return `${urls.join('|')}::${basePrompt}`;
}

export function getCachedAnchorChain(refs: PhotodumpRefs, basePrompt: string): AnchorChainResult | undefined {
  return anchorChainCache.get(anchorChainCacheKey(refs, basePrompt));
}

export async function generateAnchorChain(
  looks:         LookItem[],
  refs:          PhotodumpRefs,
  narrative:     PhotodumpNarrative,
  protagonist:   PhotodumpProtagonist,
  destino:       PhotodumpDestino,
  basePrompt:    string,
  sessionParams: { uid?: string; sessionId?: string },
): Promise<AnchorChainResult> {
  const identityRefs = [refs.avatarRef, refs.bodyRef].filter(Boolean) as string[];
  if (identityRefs.length === 0) {
    throw new Error('Se necesita al menos una referencia de identidad o cuerpo para generar los looks de este viaje.');
  }

  // Regla de negocio (ver manifiesto 6ter, contractValidator.ts): el lugar
  // de cada look lo declara el usuario con una foto real, el sistema nunca
  // lo inventa. Un look sin foto de lugar bloquea la generación, en vez de
  // caer silenciosamente en un lugar genérico inventado.
  const looksWithoutPlace = looks.filter(l => !l.placeSceneUrl);
  if (looksWithoutPlace.length > 0) {
    const labels = looksWithoutPlace.map(l => l.label).join(', ');
    throw new Error(`Falta la foto del lugar de: ${labels}. Subí una imagen del lugar en el slot "Escena" (misma posición que el outfit) antes de generar el viaje.`);
  }

  const aspectRatio = getAspectRatio(destino);
  const chain: AnchorChainResult['chain'] = [];
  let previousImageUrl: string | null = null;

  for (const look of looks) {
    const isFirstLook = previousImageUrl === null;
    // Siempre presente acá — validado arriba, antes de empezar el loop.
    const placeSceneUrl = look.placeSceneUrl as string;

    const refsToPass = isFirstLook
      ? [...identityRefs, look.refUrl, placeSceneUrl]
      : [...identityRefs, previousImageUrl as string, look.refUrl, placeSceneUrl];

    const prompt = isFirstLook
      ? `A full-body candid-style photo taken at this exact location, part of a trip recap. This is the opening photo — the exact same person will reappear at different places for the following photos.
SCENE / LOCATION REFERENCE: replicate the environment, architecture, and lighting shown in the location reference image as closely as possible — this is the real place, not a similar-looking substitute.
She is wearing the outfit shown in the reference, fully put on and complete.
${NO_WALKING_LINE}
${UGC_CASUAL_COMPOSITION_BLOCK}
Natural daylight or ambient lighting consistent with the location reference.
${IPHONE_CAMERA_ROLL_LINE}
${AVOID_EDITORIAL_LINE}`
      : `A full-body candid-style photo taken at this exact location, part of the same trip recap. This is the SAME PERSON as the previous photo, now at a DIFFERENT place from this trip — the place changes, the identity does not.
CRITICAL: preserve the exact identity (face, hair, skin tone, body) from the person reference. Do NOT reuse the previous location — this is a new, distinct place.
SCENE / LOCATION REFERENCE: replicate the environment, architecture, and lighting shown in the location reference image as closely as possible — this is the real place, not a similar-looking substitute.
She is now wearing the outfit shown in the reference, fully put on and complete — a different look from the previous photo.
${NO_WALKING_LINE}
${UGC_CASUAL_COMPOSITION_BLOCK}
Natural daylight or ambient lighting consistent with the location reference.
${IPHONE_CAMERA_ROLL_LINE}
${AVOID_EDITORIAL_LINE}`;

    const preparedRefs = await prepareRefs(refsToPass);
    const imageUrl = await imageApiService.generateImage({
      prompt,
      negative:        NEGATIVE_SHORT,
      referenceImages: preparedRefs,
      aspectRatio,
      modelId:         'gemini',
      uid:             sessionParams.uid,
      sessionId:       sessionParams.sessionId,
      module:          'photodump',
      moduleLabel:     'Photodump Mode',
      shotIndex:       chain.length,
      totalShots:      looks.length,
      metadata:        { role: 'MULTI_LOOK_TRIP_RECAP_LINK', narrative, protagonist, lookId: look.id, chainedFromPrevious: !isFirstLook },
    });

    chain.push({ lookId: look.id, placeSceneUrl, imageUrl });
    previousImageUrl = imageUrl;
  }

  const result: AnchorChainResult = { chain };
  anchorChainCache.set(anchorChainCacheKey(refs, basePrompt), result);
  return result;
}
