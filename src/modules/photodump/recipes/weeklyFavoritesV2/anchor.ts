/**
 * recipes/weeklyFavoritesV2/anchor.ts
 *
 * Decide cómo debe verse la foto ancla (REF0): la primera imagen que fija
 * identidad, cuerpo, luz, cuarto y mood para el resto de la sesión.
 *
 * Regla central: la foto ancla NUNCA hereda automáticamente un outfit de la
 * semana. Solo puede mostrar un outfit puesto en tres casos, en este orden
 * de prioridad:
 *
 *   1. El usuario marcó el casillero "este avatar ya trae su outfit
 *      definitivo" — se respeta tal cual viene, sin generar ni reemplazar.
 *   2. No hay outfit definitivo marcado, pero las demás referencias subidas
 *      (outfits/accesorios/productos) tienen un estilo claro y consistente
 *      — se genera un outfit acorde a ese estilo, sin copiar ninguna prenda
 *      real de esas referencias.
 *   3. No hay outfit definitivo y el estilo detectado no es claro o es
 *      contradictorio — se usa un outfit simple y discreto como último
 *      recurso, para no arriesgar una mezcla rara.
 *
 * Nunca se pide una foto "sin outfit" — eso evita disparar filtros de
 * contenido que interpretarían la ausencia de ropa como desnudez.
 */
import type { PhotodumpRefs } from '../../types';
import type { WeeklyManifestV2, AnchorContract, StyleDetectionResult } from './types';

// Referencia inyectable para poder testear sin llamar a la IA real, y para
// no crear un acople directo con geminiService dentro de este archivo.
export interface StyleDetector {
  detectStyle(referenceUrls: string[]): Promise<StyleDetectionResult>;
}

export async function buildAnchorContract(
  refs:      PhotodumpRefs,
  manifest:   WeeklyManifestV2,
  detector:   StyleDetector,
): Promise<AnchorContract> {
  const identityRefUrl = refs.avatarRef ?? undefined;
  const bodyRefUrl      = refs.bodyRef ?? undefined;
  const sceneRefUrl      = refs.sceneRef ?? undefined;

  // Sin ninguna referencia de identidad disponible: no hay persona que
  // vestir, la foto ancla queda como escena/mundo solamente.
  if (!identityRefUrl && !bodyRefUrl) {
    return { mode: 'world_only', sceneRefUrl };
  }

  // Caso 1 — el usuario marcó el casillero: el avatar ya trae su outfit
  // definitivo puesto. Se respeta tal cual, sin tocar nada.
  if (refs.avatarHasDefinitiveOutfit) {
    return {
      mode: 'person_with_explicit_base_outfit',
      identityRefUrl,
      bodyRefUrl,
      sceneRefUrl,
    };
  }

  // Caso 2/3 — no hay outfit definitivo marcado. Se le pide a la IA que
  // mire las demás referencias subidas (todo lo que no es identidad/cuerpo/
  // escena) y describa si hay un estilo claro.
  const styleReferenceUrls = manifest.items.map(item => item.refUrl);

  if (styleReferenceUrls.length === 0) {
    // No hay ninguna prenda ni producto subido para inferir estilo —
    // directo al outfit seguro, sin gastar una llamada a la IA.
    return {
      mode: 'person_with_safe_fallback_outfit',
      identityRefUrl,
      bodyRefUrl,
      sceneRefUrl,
      styleDetection: {
        styleIsClear:     false,
        styleDescription: '',
        reason:            'No hay outfits, accesorios ni productos subidos para inferir un estilo.',
      },
    };
  }

  const styleDetection = await detector.detectStyle(styleReferenceUrls);

  return {
    mode: styleDetection.styleIsClear
      ? 'person_with_style_matched_outfit'
      : 'person_with_safe_fallback_outfit',
    identityRefUrl,
    bodyRefUrl,
    sceneRefUrl,
    styleDetection,
  };
}
