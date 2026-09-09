/**
 * recipes/weeklyLooks/directorAdapter.ts
 *
 * Conecta weeklyLooks al Director Creativo GENÉRICO (ver directorContract.ts
 * para el porqué de la migración). Adapter PROPIO de esta receta — no
 * enchufado dentro del pipeline compartido de photodumpDirectorService.ts
 * (decisión explícita, sep 2026: weeklyLooks tiene un motor propio y
 * aislado, como outfitMultiLook/outfitRevealBasic — nunca pasó por
 * generatePhotodumpShot/refsToPass, que no sabe resolver referencias
 * por-look, un outfit distinto por cada shot).
 *
 * Diferencia central respecto a outfitCheck/directorAdapter.ts: acá el
 * texto final SÍ se usa tal cual del Director (directorFinalPrompt), pero
 * las REFERENCIAS de imagen de cada shot las sigue resolviendo esta receta
 * (una por look, nunca las fijas de outfit_check) — el Director nunca ve ni
 * decide outfit, solo pose/gesto/mecánica de cámara/lugar (según placeMode).
 */
import { compressImageForUpload } from '../../../../utils/imageUtils';
import { extractImageData } from '../shared';
import { runGenericDirector, type GenericDirectorReferenceImage } from '../../director/generic/genericClient';
import type { GenericShotDecision } from '../../director/generic/genericTypes';
import type { PhotodumpRefs } from '../../types';
import type { CaptureStyle, PlaceMode, WeeklyLooksManifest } from './types';

export interface WeeklyLooksDirectorShot {
  shotIndex:    number; // 1-based, coincide con el orden del manifest.items
  lookItemId:   string;
  vehicleLabel: string;
  finalPrompt:  string;
  isMainPlace:  boolean; // relevante solo si placeMode === 'same_place'
}

async function buildReferenceImages(refs: PhotodumpRefs, manifest: WeeklyLooksManifest): Promise<GenericDirectorReferenceImage[]> {
  const entries: Array<{ role: string; url: string | null | undefined }> = [
    { role: 'identidad/rostro', url: refs.avatarRef },
    { role: 'cuerpo', url: refs.bodyRef },
    ...manifest.items.map((item, i) => ({ role: `outfit del look ${i + 1}`, url: item.refUrl })),
  ];
  const referenceImages: GenericDirectorReferenceImage[] = [];
  for (const entry of entries) {
    if (!entry.url) continue;
    try {
      const compressed = await compressImageForUpload(entry.url, 768, 0.72);
      const extracted = extractImageData(compressed);
      if (extracted) referenceImages.push({ role: entry.role, data: extracted.data, mimeType: extracted.mimeType });
    } catch {
      // No bloquear el director por una imagen individual que falle en comprimir.
    }
  }
  return referenceImages;
}

/**
 * Corre el Director completo para TODO el set de una vez (un shot por
 * look del manifest, mismo orden) — lanza si algo falla, el caller
 * (weeklyLooks/index.ts) es responsable de capturar y caer al motor de
 * texto fijo, nunca de propagar el error al usuario final.
 */
export async function runWeeklyLooksDirector(
  refs:         PhotodumpRefs,
  manifest:     WeeklyLooksManifest,
  basePrompt:   string,
  captureStyle: CaptureStyle,
  placeMode:    PlaceMode,
): Promise<WeeklyLooksDirectorShot[]> {
  const referenceImages = await buildReferenceImages(refs, manifest);
  const { plan, finalPrompts } = await runGenericDirector(
    basePrompt || 'Varios looks de la semana.',
    'weekly_looks',
    manifest.items.length,
    referenceImages,
    captureStyle,
    placeMode,
  );

  const promptByIndex = new Map(finalPrompts.map(p => [p.shotIndex, p.finalPrompt]));
  const result: WeeklyLooksDirectorShot[] = [];

  plan.shots.forEach((shot: GenericShotDecision, i: number) => {
    const finalPrompt = promptByIndex.get(i + 1);
    const lookItem = manifest.items[i];
    if (!finalPrompt || !lookItem) {
      console.warn(`[weeklyLooks/director] Shot #${i + 1} "${shot.vehicleLabel}" no tiene finalPrompt o look emparejado — se descarta.`);
      return;
    }
    result.push({
      shotIndex:    i + 1,
      lookItemId:   lookItem.id,
      vehicleLabel: shot.vehicleLabel,
      finalPrompt,
      isMainPlace:  shot.isMainPlace,
    });
  });

  if (result.length !== manifest.items.length) {
    throw new Error(`El Director devolvió ${result.length} shots emparejables, se esperaban ${manifest.items.length} (uno por look) — se descarta el plan completo, cae al fallback.`);
  }

  return result;
}
