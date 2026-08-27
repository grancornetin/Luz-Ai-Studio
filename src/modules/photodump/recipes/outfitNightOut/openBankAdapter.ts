/**
 * recipes/outfitNightOut/openBankAdapter.ts
 *
 * Conecta el plan del Director Creativo en modo "banco abierto"
 * (OpenBankPlan, sin shotId de un enum fijo) a la generación real de
 * imágenes de esta receta — hasta ahora (ver comentario histórico en
 * tryDirector, outfitNightOut/index.ts) open_bank generaba el razonamiento
 * pero SIEMPRE caía al banco estático, porque el pipeline de generación
 * (routeReferences, validateRouting, buildShotPrompt) depende de un
 * ShotContract con shotId fijo que open_bank nunca tuvo.
 *
 * Hallazgo clave (auditoría de esta sesión contra los 11 NightMoment reales +
 * 3 shots fijos): la referencePolicy casi no varía entre shots reales — es
 * prácticamente siempre {identity, body, outfit}, y companion solo se agrega
 * cuando el shot muestra un acompañante real. cameraGrammar (framing/angle/
 * composition) solo se usa hoy como metadata de debug y para armar el bloque
 * HPI — y el HPI YA se desactiva cuando hay directorSceneBlock (ver
 * promptBuilder.ts: "el HPI se omite cuando el director ya redactó su propia
 * pose", evita 2 descripciones de pose contradictorias). Esto significa que
 * NO hace falta que Gemini declare una política de referencias compleja por
 * shot: alcanza con 2 campos nuevos en el plan (companionVisible,
 * footwearVisible, ver openBankTypes.ts) para armar un ShotContract sintético
 * con cameraGrammar neutro, sin romper nada del pipeline existente.
 *
 * Decisión explícita (usuario, sesión 13 ago 2026): a diferencia de
 * categorized (que SIEMPRE tiene mirror_check como shot 1, ancla fija de
 * preparación), open_bank NO fuerza que exista un shot de ancla — coherente
 * con el manifiesto §4bis (no hay secuencia canónica). prepAnchorCache
 * simplemente queda sin usar si ningún shot de este set califica.
 *
 * Continuidad de venue (ver venueAnchorCache en index.ts): usa imagen real
 * como refuerzo visual, no solo el texto que el propio director redacta
 * (needsVenueAnchor/continuityNote) — bug real confirmado con una sesión de
 * prueba (13 ago 2026): el director se saltó needsVenueAnchor en el último
 * shot de un set de 7, y sin imagen de referencia el venue generado terminó
 * siendo un lugar completamente distinto al resto del set.
 */
import type { OpenBankPlan, OpenBankShotDecision, OpenBankFinalPromptShot } from '../../director/openBank/openBankTypes';
import type { ShotContract, OpenBankSyntheticShotId } from './types';

export function openBankShotId(index: number): OpenBankSyntheticShotId {
  return `open_bank_${index}`;
}

/**
 * Arma un ShotContract sintético para un shot del plan open_bank — mismo
 * mecanismo que routeReferences/validateRouting/buildShotDebug ya consumen
 * para shots del modo categorized, sin que esos archivos necesiten saber que
 * este contrato nació de un plan libre en vez de un enum fijo (ninguno de
 * los 3 hace switch sobre shotId, ver auditoría en el comentario de cabecera).
 *
 * cameraGrammar es un valor neutro deliberado: no describe nada real del
 * shot (eso ya vive completo en el finalPrompt redactado por Gemini) — solo
 * existe para no romper el tipo. hpiPoseFamily es siempre null porque el HPI
 * se desactiva de todas formas cuando hay directorSceneBlock (ver
 * promptBuilder.ts), así que declarar una familia real acá no tendría efecto.
 */
export function openBankToShotContract(shot: OpenBankShotDecision, index: number): ShotContract {
  // protagonistVisible=false → detail shot real sin la protagonista en
  // cuadro (comida/trago/vista sin ella, ver VARIEDAD DE TIPO DE FOTO en
  // openBankPromptBuilders.ts) — no tiene sentido enrutar sus referencias de
  // identidad/cuerpo/outfit a una imagen que no debería mostrarla.
  const protagonistVisible = shot.protagonistVisible !== false;
  // BUG REAL corregido (prueba 26, 27 ago 2026): useOutfitRefs era true para
  // CUALQUIER shot con protagonista visible, incluidos close-ups de rostro
  // donde el texto pedía explícitamente un encuadre cercano (ej. "face in
  // the upper central third of the frame") — la referencia de outfit
  // completo (cuerpo entero) igual se mandaba, y el generador de imagen
  // terminó copiando su composición en vez de seguir el encuadre del texto,
  // produciendo un plano de cuerpo entero en 2 selfies distintas de la misma
  // sesión real. outfitFramingVisible (declarado por el director viendo el
  // candidato real) es la señal de si la prenda es identificable en ESTE
  // encuadre puntual — solo entonces vale la pena mandar la referencia de
  // cuerpo entero. Default true (!== false) como red de seguridad ante
  // planes viejos sin el campo, mismo patrón que footwearVisible.
  const outfitFramingVisible = shot.outfitFramingVisible !== false;
  return {
    shotId: openBankShotId(index),
    cameraGrammar: { framing: 'DIRECTOR_DEFINED', angle: 'DIRECTOR_DEFINED', composition: 'DIRECTOR_DEFINED' },
    referencePolicy: {
      useIdentityRef: protagonistVisible,
      useBodyRef: protagonistVisible,
      useOutfitRefs: protagonistVisible && outfitFramingVisible,
      useCompanionRef: protagonistVisible && shot.companionVisible,
    },
    hpiPoseFamily: null,
    footwearVisible: protagonistVisible && shot.footwearVisible,
  };
}

export interface OpenBankDirectives {
  contracts: Map<OpenBankSyntheticShotId, ShotContract>;
  finalPrompts: Map<OpenBankSyntheticShotId, string>;
}

/**
 * Empareja cada shot del plan con su finalPrompt ya redactado (por
 * shotIndex, posición 1-based del shot — no por vehicleLabel) y arma su
 * ShotContract sintético — punto de entrada único que tryDirector() necesita
 * para reemplazar contractForShotId/promptByShotId del modo categorized.
 *
 * BUG REAL corregido (13 ago 2026, confirmado en producción): el vínculo
 * plan↔finalPrompts era por vehicleLabel (texto libre) — Gemini tiene que
 * REESCRIBIR ese texto en una llamada aparte ("Redactar"), y cualquier
 * variación mínima (coma, sinónimo, resumen) rompe el match exacto. En una
 * sesión real de 7 shots, los 7 fallaron (0% de coincidencia, no un caso
 * aislado). shotIndex es un número que Gemini solo necesita leer y copiar
 * del texto del plan ("Shot #3: ..."), no reescribir — mucho más confiable.
 * Un shot sin match NUNCA entra a `contracts` — evita generar una imagen con
 * directorSceneBlock vacío (bug real: sin este filtro, buildShotPrompt caía
 * a sceneBlock='' para el shot huérfano).
 */
export function buildOpenBankDirectives(plan: OpenBankPlan, finalPrompts: OpenBankFinalPromptShot[]): OpenBankDirectives {
  const promptByIndex = new Map(finalPrompts.map(p => [p.shotIndex, p.finalPrompt]));
  const contracts = new Map<OpenBankSyntheticShotId, ShotContract>();
  const prompts = new Map<OpenBankSyntheticShotId, string>();

  plan.shots.forEach((shot, i) => {
    const redacted = promptByIndex.get(i + 1);
    if (!redacted) {
      console.warn(`[open_bank] Shot #${i + 1} "${shot.vehicleLabel}" no tiene finalPrompt emparejado (shotIndex ${i + 1} ausente en la respuesta de Redactar) — se descarta.`);
      return;
    }
    const shotId = openBankShotId(i + 1);
    contracts.set(shotId, openBankToShotContract(shot, i + 1));
    prompts.set(shotId, redacted);
  });

  return { contracts, finalPrompts: prompts };
}
