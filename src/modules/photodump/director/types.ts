/**
 * modules/photodump/director/types.ts
 *
 * Tipos del Director Creativo (arquitectura A-K del usuario, ver plan
 * "Director Creativo de Photodump"). Portado desde scripts/photodump-director/
 * (prototipo standalone en JS, validado con generaciones reales en
 * Higgsfield) a TypeScript dentro de src/, para conectarlo a producción.
 *
 * Diferencia clave con el prototipo: acá corre client-side (photodumpDirectorService.ts
 * se importa desde PhotodumpModule.tsx), así que nunca usa credenciales
 * directas de Vertex AI — todas las llamadas a Gemini pasan por
 * /api/gemini/content (mismo endpoint que ya usa geminiService.ts).
 */

export interface BankAnalysisItem {
  itemId: string;
  analysis: {
    raw_visual_description?: {
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
    interpreted_signals?: Array<{
      signal?: string;
      category?: string;
      reusable_primitive?: string;
      uses?: Array<{ recipe?: string; role?: string; fit?: number; condition?: string }>;
    }>;
    search_tags?: {
      setting?: string[];
      time_of_day_guess?: string;
      narrative_beat_fit?: string[];
    };
    prohibited_commercial_signals?: unknown;
  };
}

export interface BankSnapshot {
  compiledAt: string;
  itemCount: number;
  items: BankAnalysisItem[];
}

export interface ShotTypeDef {
  id: string;
  description: string;
  lightingRule?: string;
}

export interface RecipeContract {
  label: string;
  psychology: string;
  hardRules: string[];
  shotsByLevel: Record<string, { count: number; description: string }>;
  fixedShotTypes: ShotTypeDef[];
  nightMomentTypes: ShotTypeDef[];
}

export interface CandidateSummary {
  itemId: string;
  relevanceScore: number;
  pose?: string;
  gesture?: string;
  gaze?: string;
  outfit?: string;
  objects?: string;
  background?: string;
  lighting?: string;
  cameraFraming?: string;
  companionPresent?: boolean;
  signals: Array<{ signal?: string; category?: string; reusablePrimitive?: string; conditions: string[] }>;
}

export type ShotPools = Record<string, CandidateSummary[]>;

export interface CandidateDecision {
  itemId: string;
  score: number;
  keptElements: string[];
  discardedElements: string[];
}

export interface ShotDecision {
  shotId: string;
  candidatesConsidered: CandidateDecision[];
  chosenCandidateId: string;
  shotReasoning: string;
  needsVenueAnchor: boolean;
  continuityNote: string;
}

export interface DirectorPlan {
  globalReasoning: string;
  shots: ShotDecision[];
}

export interface FinalPromptShot {
  shotId: string;
  finalPrompt: string;
}

export interface DirectorResult {
  plan: DirectorPlan;
  finalPrompts: FinalPromptShot[];
}
