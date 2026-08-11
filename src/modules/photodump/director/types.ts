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
  // Eje de diversidad real (manifiesto de dirección, §12 Diversity control):
  // varios shotTypes con ids distintos pueden cumplir la MISMA función
  // psicológica/compositiva (ej. pov_legs, food_detail y ambient_only son
  // los 3 "detalle sin protagonista que insinúa el resto de la experiencia")
  // — el director no debe elegir más de 1 tipo por eje en un mismo set,
  // aunque sus ids sean distintos. Opcional: solo los tipos rotables de
  // banco lo declaran, no los shots fijos (mirror_check, etc.).
  diversityAxis?: string;
  // Psicología del attention_bridge (manifiesto §11): qué objeto/gesto
  // concreto desvía la atención, y qué insinúa sobre el resto de la
  // experiencia que NO se muestra directamente. Se le pasa a Gemini como
  // contexto de POR QUÉ ese shot type existe, no solo QUÉ mostrar.
  attentionBridge?: string;
  // Si true, este tipo de shot solo es válido cuando la energía de la noche
  // (ver energy en buildPhotodumpDecidePrompt) es 'fiesta' — equivalente al
  // mismo campo ya existente en nightMoments.ts (pool estático de
  // respaldo), pero el director no tenía ninguna versión de esta regla:
  // bug real confirmado en producción, "cena en un rooftop" (energía
  // 'elegante') generó un shot de pista de baile con luces de club, sin
  // ninguna razón física de que ahí exista una pista de baile.
  fiestaOnly?: boolean;
}

export interface RecipeContract {
  label: string;
  psychology: string;
  hardRules: string[];
  shotsByLevel: Record<string, { count: number; description: string }>;
  fixedShotTypes: ShotTypeDef[];
  nightMomentTypes: ShotTypeDef[];
  // Regla de no-redundancia por eje (manifiesto §12 Diversity control) — ver
  // diversityAxis en ShotTypeDef. Opcional porque no todas las recetas
  // necesariamente van a declarar este nivel de detalle todavía.
  nightMomentDiversityRule?: string;
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
  // Razonamiento explícito sobre accesorios no-esenciales del outfit (bolso,
  // gafas, bufanda) para ESTE shot puntual: ¿tiene sentido que aparezcan, o
  // la lógica de la acción/encuadre los excluye de forma creíble (bailando,
  // POV mirando hacia abajo, manos ocupadas con comida/bebida)? Evita que
  // desaparezcan/reaparezcan sin motivo entre shots del mismo set — pedido
  // real del usuario tras ver un bolso "flotante" (presente en unos shots,
  // ausente en otros del mismo venue, sin ninguna razón narrativa).
  accessoryReasoning: string;
  // A qué momento de plan.timelineStages pertenece este shot — evita que el
  // set se lea como momentos sueltos sin orden real (bug real: un shot de
  // "yéndose en auto" seguido de otro shot en el mismo venue con más gente).
  timelineStage: string;
  // Filtro del manifiesto de dirección (§6, "esta foto existe porque..."):
  // quién sostiene la cámara y por qué la protagonista publicaría esta foto
  // puntual — evita candidatos técnicamente válidos pero sin razón de
  // captura creíble (ej. foto de espaldas sin rostro que sacaría una amiga,
  // no la propia protagonista).
  existenceReason: string;
}

export interface DirectorPlan {
  globalReasoning: string;
  // 3 a 5 momentos concretos de la noche, en orden cronológico, declarados
  // una vez antes de asignar shots — ver timelineStage en ShotDecision.
  timelineStages: string[];
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

// Referencia visual real del usuario (identidad/cuerpo/outfit/escena/
// acompañante) mandada al director junto al payload de texto — ver
// director/client.ts para el porqué (evitar poses heredadas del banco que
// dependan de estructura física inexistente en el outfit real).
export interface DirectorReferenceImage {
  role: 'identidad/rostro' | 'cuerpo' | 'outfit' | 'escena/venue' | 'acompañante';
  data: string;
  mimeType: string;
}
