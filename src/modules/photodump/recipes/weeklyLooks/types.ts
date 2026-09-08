/**
 * recipes/weeklyLooks/types.ts
 *
 * Tipos internos de la receta weeklyLooks — mitad "ropa" de la separación
 * de weeklyFavoritesV2 en dos historias distintas (sep 2026, pedido del
 * usuario: "quiero dejar un favoritos de la semana para ropa y uno para
 * productos"). Esta mitad cuenta UNA sola historia: "esta ropa usé este
 * lapso de tiempo" — cada shot es un look completo distinto, nunca ángulos
 * distintos del mismo look (eso ya lo resuelve outfit_multi_look/
 * outfit_reveal_basic para un solo outfit).
 *
 * Deliberadamente sin roles de producto/joyería/skincare — ver
 * recipes/weeklyProducts/ para esa otra mitad. Cero imports cruzados entre
 * las dos carpetas.
 */

// ── Modo de cámara — elegido por el usuario, fijo para TODO el set ────────
// Confirmado con auditoría real del banco (sep 2026): "fondo fijo" NO
// implica selfie — el banco tiene volumen real y comparable para las dos
// mecánicas (mirror_selfie_phone: 118 fotos con celular visible en mano/
// reflejo; handheld_phone_natural + full_body: 139 fotos sin celular en
// cuadro, cámara de tercero/timer). El usuario elige UNA de las dos al
// armar el set — nunca se mezclan dentro del mismo set (rompería la
// coherencia visual entre shots).
export type CaptureStyle =
  | 'mirror_selfie'    // celular siempre visible en pose/gesto citado del banco
  | 'third_person';    // sin celular en cuadro — alguien más o timer/trípode

// ── Modo de lugar — elegido por el usuario, independiente del CaptureStyle ─
export type PlaceMode =
  | 'same_place'    // un solo lugar para todo el set — generado en el primer
                     // shot (y reusado como referencia) o subido por el usuario
  | 'varied_place';  // cada shot resuelve su propio lugar, coherente por
                      // registro/formalidad del outfit (reusa outfitRegisterClient)

export interface WeeklyLooksConfig {
  captureStyle: CaptureStyle;
  placeMode:    PlaceMode;
}

// ── Manifest — mucho más simple que weeklyFavoritesV2: solo outfits ───────

export interface LookItem {
  id:          string;   // 'look_0', 'look_1', ...
  sourceIndex: number;
  refUrl:      string;
  label:       string;
}

export interface WeeklyLooksManifest {
  items: LookItem[];
}

// ── Ancla ───────────────────────────────────────────────────────────────

export type AnchorMode =
  | 'person_with_explicit_base_outfit'
  | 'person_with_style_matched_outfit'
  | 'person_with_safe_fallback_outfit';

export interface StyleDetectionResult {
  styleIsClear:     boolean;
  styleDescription: string;
  reason:           string;
}

export interface AnchorContract {
  mode:           AnchorMode;
  identityRefUrl?: string;
  bodyRefUrl?:     string;
  styleDetection?: StyleDetectionResult;
}

// ── Pose/escena citada del banco real (nunca Gemini libre) ────────────────

export interface LookPoseCandidate {
  itemId:  string;
  pose:    string;
  gesture: string;
  gaze:    string;
}

// ── Shot Contract ───────────────────────────────────────────────────────

export interface CameraGrammarRef {
  framing:     string;
  angle:       string;
  composition: string;
}

export interface ShotContract {
  shotId:          string;
  lookItem:         LookItem;
  isAnchorShot:      boolean;   // true = primer shot del set (fija el lugar si placeMode === 'same_place')
  cameraGrammar:     CameraGrammarRef;
  poseAttitudeLine?: string;    // citado del banco real, filtrado por captureStyle
  coherentPlaces?:   string;    // solo con placeMode === 'varied_place' — reusa outfitRegisterClient
}

// ── Plan de salida hacia PhotodumpShotDirective ────────────────────────

export interface WeeklyLooksShotPlan {
  shotId:      string;
  lookItemId:   string;
  isAnchorShot: boolean;
}

// ── Debug ───────────────────────────────────────────────────────────────

export interface WeeklyLooksShotDebug {
  shotId:         string;
  lookItem:        string;
  captureStyle:    CaptureStyle;
  placeMode:       PlaceMode;
  poseAttitudeLine: string | undefined;
  promptSummary:   string;
}
