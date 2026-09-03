/**
 * modules/photodump/director/generic/genericTypes.ts
 *
 * Tipos del Director Creativo GENÉRICO — sucesor de director/openBank/, que
 * nació pensado 100% para outfit_night_out (los tipos hablaban de "venue",
 * "isMainVenue", el núcleo narrativo estaba hardcodeado a "noche memorable +
 * outfit increíble"). outfit_night_out se retira; outfit_check es la primera
 * receta que necesita el MISMO mecanismo de razonamiento (banco real +
 * Gemini decidiendo/redactando libremente, sin categorías de shot con
 * nombre fijo) para una historia distinta ("elegí este outfit para tal
 * ocasión, y me veía increíble para eso") — la decisión del usuario fue
 * generalizar el director en vez de duplicar todo el mecanismo por receta.
 *
 * Principio de diseño: el director NO sabe nada de ninguna receta en
 * particular. Cada receta declara su propio RecipeDirectorContract (núcleo
 * narrativo, impulsos psicológicos relevantes, reglas de tono, si usa
 * anclaje de lugar compartido) — el director solo lee ese contrato para
 * armar sus prompts, nunca tiene un `if (recipe === 'outfit_night_out')`
 * adentro.
 */

export interface GenericAnalysisItem {
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

export interface GenericBankSnapshot {
  compiledAt: string;
  itemCount: number;
  items: GenericAnalysisItem[];
}

// Candidato comprimido para el panorama amplio — 1 línea de texto por
// candidato en el prompt (ver comentario histórico en openBankTypes.ts,
// mismo diseño, sin cambios: el objetivo es que el director vea la ESCALA
// real del banco, no que razone en detalle sobre cada uno acá).
export interface WideCandidate {
  itemId: string;
  shotType: string; // normalizado, ver genericFilter.ts normalizeShotType()
  companionPresent: boolean;
  subjectsVisible: number;
  briefSummary: string;
}

export type WideCandidatePool = Record<string, WideCandidate[]>;

// Impulsos motivacionales del manifiesto de dirección
// (02_the_psychology_behind_photodump_v2.md, §3 y §16) — universo completo.
// Cada receta declara, en su contrato, cuáles de estos son relevantes para
// SU historia (ver RecipeDirectorContract.relevantDrives) — outfit_night_out
// usaba un subset de 3 (attraction_self_presentation, status_control,
// belonging_social_validation), otra receta puede necesitar otro subset.
export type PsychologicalDrive =
  | 'attraction_self_presentation'
  | 'status_control'
  | 'belonging_social_validation'
  | 'safety_relief'
  | 'ease_energy_saving'
  | 'care_self_regulation'
  | 'competence_mastery';

export interface GenericShotDecision {
  vehicleLabel: string;
  // Eje narrativo — genérico en el tipo (string libre), cada receta define
  // en su contrato qué valores concretos espera (ej. outfit_night_out usaba
  // 'memorable' | 'outfit_increible' | 'ambos'; outfit_check puede usar
  // 'ocasion' | 'outfit_increible' | 'ambos') — el schema real por receta
  // se arma en genericPromptBuilders.ts a partir de contract.narrativeAxes.
  narrativeAxis: string;
  psychologicalDrive: PsychologicalDrive;
  psychologicalReasoning: string;
  chosenCandidateId: string;
  shotReasoning: string;
  keptElements: string[];
  discardedElements: string[];
  // Anclaje de lugar compartido — GENÉRICO (reemplaza needsVenueAnchor/
  // isMainVenue de openBankTypes.ts, que hablaban explícitamente de
  // "venue"). Solo tiene efecto real si contract.usesSharedPlaceAnchor es
  // true (ver RecipeDirectorContract) — recetas sin lugar compartido (ej.
  // un set de 1 sola foto sin continuidad) pueden ignorar estos campos.
  needsPlaceAnchor: boolean;
  continuityNote: string;
  // true si este shot ocurre en el lugar PRINCIPAL de la historia (el que
  // ancla la continuidad visual) — false para cualquier etapa previa/aparte
  // (ej. el auto de camino, la casa antes de salir). Mismo mecanismo que
  // isMainVenue tenía en night_out, generalizado de nombre.
  isMainPlace: boolean;
  accessoryReasoning: string;
  timelineStage: string;
  existenceReason: string;
  companionVisible: boolean;
  footwearVisible: boolean;
  outfitFramingVisible: boolean;
  protagonistVisible: boolean;
}

export interface GenericPlan {
  globalReasoning: string;
  timelineStages: string[];
  shots: GenericShotDecision[];
}

export interface GenericFinalPromptShot {
  shotIndex: number;
  vehicleLabel: string;
  finalPrompt: string;
}

export interface GenericResult {
  plan: GenericPlan;
  finalPrompts: GenericFinalPromptShot[];
}

// Observación real de un lugar ya generado — GENÉRICO (reemplaza
// OpenBankVenueObservation). Mismo mecanismo: en vez de la instrucción
// abstracta "reuse the exact same place" (que el redactor cumplía
// inventando su propia versión), se inyecta una observación real de la
// imagen ya generada.
export interface PlaceObservation {
  observedElements: string;
  isEnclosedSubSpace: boolean;
}

/**
 * Contrato que cada receta declara para poder usar el Director Creativo
 * genérico — es el único lugar donde vive lo que hace a ESA receta
 * distinta de cualquier otra. El director (genericPromptBuilders.ts) arma
 * sus prompts combinando: (a) bloques fijos, iguales para toda receta
 * (anti-alucinación, keptElements/discardedElements, mecánica de selfie/
 * mirror, fidelidad de outfit — ver PHOTODUMP_HARD_RULES_TEXT y el resto
 * del prompt de Redactar) con (b) lo que este contrato declara.
 */
export interface RecipeDirectorContract {
  // Identificador legible de la receta (solo para logs/debug, el director
  // no hace ningún switch sobre esto).
  recipeId: string;

  // El núcleo narrativo dual — reemplaza el texto hardcodeado "ella tuvo
  // una noche memorable, y se veía increíble en el outfit". Se inyecta tal
  // cual en el prompt de Decidir como el ÚNICO criterio narrativo.
  narrativeCore: string;

  // Valores válidos de narrativeAxis para esta receta (2-3 típicamente: los
  // 2 ejes del narrativeCore + su combinación) — arma el enum del schema
  // JSON dinámicamente, ver genericPromptBuilders.ts.
  narrativeAxisValues: [string, string, string]; // [ejeA, ejeB, 'ambos']
  narrativeAxisLabels: Record<string, string>; // texto explicativo por valor, para el prompt

  // Subset de PsychologicalDrive relevante a esta historia — se documentan
  // en el prompt con su propia explicación (ver relevantDrivesText).
  relevantDrives: PsychologicalDrive[];
  relevantDrivesText: string; // bloque de texto ya armado explicando cada drive relevante

  // Reglas de tono/plausibilidad propias de esta receta (ej. la regla de
  // "ropa interior no plausible salvo en preparación" de night_out) — texto
  // libre, se inyecta tal cual en el prompt de Decidir.
  toneRulesText: string;

  // Si esta receta usa anclaje de lugar compartido entre shots (mismo
  // mecanismo que venue en night_out). false para una receta donde cada
  // shot es independiente y nunca necesita continuidad de fondo entre sí.
  usesSharedPlaceAnchor: boolean;
  // Nombre del "lugar" en el vocabulario de esta receta, para que el
  // prompt hable en los términos correctos (ej. "venue" para night_out,
  // "destino" para outfit_check) — solo cosmético, no cambia el mecanismo.
  placeAnchorLabel: string;

  // Reglas duras de continuidad/composición ADICIONALES, propias de esta
  // receta (ej. la regla de auto/trago/baño de night_out) — texto libre,
  // se inyecta después de las reglas duras genéricas. Puede ser cadena
  // vacía si la receta no necesita nada extra.
  extraContinuityRulesText: string;

  // Reglas duras de REDACCIÓN adicionales, propias de esta receta — mismo
  // mecanismo que extraContinuityRulesText pero para el prompt de
  // Redactar (buildGenericWritePrompt) en vez del de Decidir.
  extraWriteRulesText: string;
}
