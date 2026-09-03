/**
 * recipes/outfitCheck/directorAdapter.ts
 *
 * Convierte el plan del Director Creativo GENÉRICO (GenericShotDecision[],
 * banco real + Gemini razonando libremente) a PhotodumpShotDirective[] — la
 * forma que el resto del pipeline de generación de outfit_check ya sabe
 * consumir (generatePhotodumpShot, refsToPass, sceneLockPolicy, etc.).
 *
 * Camino DELIBERADAMENTE liviano (decisión del usuario, sep 2026): en vez
 * de replicar la arquitectura completa y aislada de outfit_night_out
 * (caches propios, REF0 dedicado — ver recipes/outfitNightOut/index.ts),
 * este adapter enchufa el director DENTRO del flujo genérico que ya existe
 * en photodumpDirectorService.ts. Cada shot sintético trae su
 * directorFinalPrompt ya redactado (ver shared.ts) — generatePhotodumpShot
 * lo usa tal cual, saltándose el ensamblaje normal de purpose/
 * variationSpace, pero sigue pasando por el mecanismo real de refsToPass/
 * sceneLockPolicy de la receta sin cambios.
 */
import type { GenericShotDecision, GenericFinalPromptShot } from '../../director/generic/genericTypes';
import type { PhotodumpShotDirective } from '../shared';

/**
 * shotKey sintético para un shot del director — nunca coincide con los
 * shotKey fijos del arco legado (OUTFIT_ARRIVING, ACCESSORY_CLOSEUP, etc.),
 * así que el resto del pipeline (refsToPass, sceneLockPolicy) que hace
 * `shot.key === 'ALGO_FIJO'` cae siempre a su rama por-default para estos
 * shots — comportamiento correcto: el default YA es "outfit puesto, mismo
 * cuarto/destino según narrativeStage", que es justo lo que corresponde
 * acá.
 */
export function outfitCheckDirectorShotKey(index: number): string {
  return `DIRECTOR_${index}`;
}

/**
 * Empareja el plan (shots decididos) con los prompts ya redactados (por
 * shotIndex, 1-based — mismo mecanismo anti-drift que openBankAdapter.ts:
 * nunca por vehicleLabel de texto libre, que una reescritura mínima entre
 * "Decidir" y "Redactar" puede romper).
 */
export function buildOutfitCheckDirectorDirectives(
  shots: GenericShotDecision[],
  finalPrompts: GenericFinalPromptShot[],
  aspectRatio: string,
): Omit<PhotodumpShotDirective, 'arcPosition'>[] {
  const promptByIndex = new Map(finalPrompts.map(p => [p.shotIndex, p.finalPrompt]));
  const result: Omit<PhotodumpShotDirective, 'arcPosition'>[] = [];

  shots.forEach((shot, i) => {
    const redacted = promptByIndex.get(i + 1);
    if (!redacted) {
      console.warn(`[outfitCheck/director] Shot #${i + 1} "${shot.vehicleLabel}" no tiene finalPrompt emparejado — se descarta.`);
      return;
    }
    result.push({
      key:               outfitCheckDirectorShotKey(i + 1),
      beat:              'candid',
      role:              shot.vehicleLabel,
      purpose:           shot.vehicleLabel,
      requiredElements:  [],
      forbiddenElements: [],
      variationSpace:    [],
      framing:           'DIRECTOR_DEFINED',
      composition:       'DIRECTOR_DEFINED',
      cameraAngle:       'DIRECTOR_DEFINED',
      aspectRatio,
      narrativeStage:    shot.isMainPlace ? 'destination' : 'prep',
      directorFinalPrompt: redacted,
    });
  });

  return result;
}
