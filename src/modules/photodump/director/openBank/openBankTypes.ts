/**
 * modules/photodump/director/openBank/openBankTypes.ts
 *
 * Tipos del modo "banco abierto" — bypass aislado y reversible del Director
 * Creativo (ver plan de sesión). A diferencia del modo actual
 * (director/types.ts, RecipeContract.nightMomentTypes con ids fijos como
 * mirror_check/toast_moment/etc.), acá NO hay una lista de tipos de shot con
 * nombre: el director compone el set libremente, guiado solo por los 2 ejes
 * del manifiesto de dirección (§4bis, "the_psychology_behind_photodump_v2.md")
 * — "la noche fue memorable" + "se veía increíble en el outfit" — y por las
 * reglas duras compartidas (hardRules.ts, reusado tal cual, sin cambios).
 *
 * Cero dependencias de los tipos del modo actual (director/types.ts) más
 * allá de BankAnalysisItem/DirectorReferenceImage, que describen datos de
 * entrada compartidos, no arquitectura de razonamiento.
 */

export interface OpenBankAnalysisItem {
  itemId: string;
  analysis: {
    raw_visual_description?: {
      shot_type?: string;
      subjects_visible?: number;
      subject_pose?: string;
      subject_gesture?: string;
      subject_gaze?: string;
      outfit_visible?: string;
      visible_objects?: string;
      background_setting?: string;
      lighting?: string;
      camera_framing?: string;
    };
    companion_present?: boolean;
    prohibited_commercial_signals?: unknown;
  };
}

export interface OpenBankSnapshot {
  compiledAt: string;
  itemCount: number;
  items: OpenBankAnalysisItem[];
}

// Candidato comprimido para el panorama amplio — 1 línea de texto por
// candidato en el prompt, no los 8 campos completos que usa el modo actual.
// Formato deliberadamente pobre: el objetivo es que el director vea la
// ESCALA real del banco (cientos de candidatos), no que razone en detalle
// sobre cada uno acá — el detalle completo se pide recién para los
// candidatos que el propio director elija profundizar (ver
// WideCandidate.needsDetail en el prompt "Decidir").
export interface WideCandidate {
  itemId: string;
  shotType: string; // normalizado, ver normalizeShotType()
  companionPresent: boolean;
  subjectsVisible: number;
  briefSummary: string; // 1 línea: gesto/pose + fondo, recortado
}

export type WideCandidatePool = Record<string, WideCandidate[]>; // agrupado por shotType normalizado

// Plan del director en modo banco abierto — sin shotId de un enum fijo.
// Cada shot declara su propio "vehículo narrativo" en texto libre (ej.
// "selfie de espejo con outfit completo", "detalle de trago en primer
// plano sin protagonista") en vez de elegir de una lista predefinida.
export interface OpenBankShotDecision {
  vehicleLabel: string; // descripción corta del tipo de foto que el director decidió, en sus propias palabras
  narrativeAxis: 'memorable' | 'outfit_increible' | 'ambos'; // qué eje del manifiesto aporta esta foto
  chosenCandidateId: string;
  shotReasoning: string;
  keptElements: string[];
  discardedElements: string[];
  needsVenueAnchor: boolean;
  continuityNote: string;
  accessoryReasoning: string;
  timelineStage: string;
  existenceReason: string;
}

export interface OpenBankPlan {
  globalReasoning: string;
  timelineStages: string[];
  shots: OpenBankShotDecision[];
}

export interface OpenBankFinalPromptShot {
  vehicleLabel: string;
  finalPrompt: string;
}

export interface OpenBankResult {
  plan: OpenBankPlan;
  finalPrompts: OpenBankFinalPromptShot[];
}
