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
  return {
    shotId: openBankShotId(index),
    cameraGrammar: { framing: 'DIRECTOR_DEFINED', angle: 'DIRECTOR_DEFINED', composition: 'DIRECTOR_DEFINED' },
    referencePolicy: {
      useIdentityRef: true,
      useBodyRef: true,
      useOutfitRefs: true,
      useCompanionRef: shot.companionVisible,
    },
    hpiPoseFamily: null,
    footwearVisible: shot.footwearVisible,
  };
}

export interface OpenBankDirectives {
  contracts: Map<OpenBankSyntheticShotId, ShotContract>;
  finalPrompts: Map<OpenBankSyntheticShotId, string>;
}

/**
 * Empareja cada shot del plan con su finalPrompt ya redactado (por
 * vehicleLabel, mismo criterio que ya usa buildOpenBankWritePrompt para
 * devolver los prompts) y arma su ShotContract sintético — punto de entrada
 * único que tryDirector() necesita para reemplazar contractForShotId/
 * promptByShotId del modo categorized.
 *
 * El vínculo plan↔finalPrompts es por texto libre (vehicleLabel), no por un
 * índice estable — Gemini podría redactar el label levemente distinto entre
 * las 2 llamadas (typo, mayúscula). Un shot sin match NUNCA entra a
 * `contracts` — evita generar una imagen con directorSceneBlock vacío
 * (bug real: sin este filtro, buildShotPrompt caía a sceneBlock='' para el
 * shot huérfano, generando una imagen sin ninguna descripción de escena).
 */
export function buildOpenBankDirectives(plan: OpenBankPlan, finalPrompts: OpenBankFinalPromptShot[]): OpenBankDirectives {
  const promptByLabel = new Map(finalPrompts.map(p => [p.vehicleLabel, p.finalPrompt]));
  const contracts = new Map<OpenBankSyntheticShotId, ShotContract>();
  const prompts = new Map<OpenBankSyntheticShotId, string>();

  plan.shots.forEach((shot, i) => {
    const redacted = promptByLabel.get(shot.vehicleLabel);
    if (!redacted) {
      console.warn(`[open_bank] Shot "${shot.vehicleLabel}" no tiene finalPrompt emparejado (vehicleLabel no coincidió entre Decidir y Redactar) — se descarta.`);
      return;
    }
    const shotId = openBankShotId(i + 1);
    contracts.set(shotId, openBankToShotContract(shot, i + 1));
    prompts.set(shotId, redacted);
  });

  return { contracts, finalPrompts: prompts };
}
