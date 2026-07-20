/**
 * recipes/outfitMultiLook/types.ts
 *
 * Tipos internos de la receta outfit_multi_look. No se comparten con otras
 * recetas salvo lo que index.ts decide re-exportar para el Director.
 *
 * A diferencia de weeklyFavoritesV2 (catálogo de ítems heterogéneos: bolso,
 * calzado, joyería, skincare), el objeto central acá es el LOOK — un outfit
 * completo con, opcionalmente, una era (then_vs_now) o un lugar (trip_recap).
 * No hay "categorías de producto" que clasificar.
 */
import type { MultiLookIntent, MultiLookBackgroundMode } from '../../types';

export type { MultiLookIntent, MultiLookBackgroundMode };

// ── Manifest ────────────────────────────────────────────────────────────

export interface LookItem {
  id:          string;   // 'look_0', 'look_1'...
  sourceIndex: number;    // índice en [outfitRef, ...outfitRefs]
  refUrl:      string;
  label:       string;
  era?:        'before' | 'after';  // solo then_vs_now
  placeLabel?: string;              // solo trip_recap, declarado por el usuario
}

export interface MultiLookManifest {
  intent:         MultiLookIntent;
  backgroundMode: MultiLookBackgroundMode;
  looks:          LookItem[];
}

// ── Anchor (fondo fijo — weekly / then_vs_now / rate_check / curated_ideas) ──

export interface FixedAnchorResult {
  identityRefUrl?: string;
  bodyRefUrl?:     string;
  sceneRefUrl?:    string;
  // Imagen generada que ancla el mundo — se cita en cada shot subsiguiente.
  anchorImageUrl:  string;
}

// ── Anchor chain (fondo variable — trip_recap) ───────────────────────────

export interface AnchorChainLink {
  lookId:    string;
  placeLabel: string;
  imageUrl:  string;
}

export interface AnchorChainResult {
  chain: AnchorChainLink[];
}

// ── Shot Contracts ────────────────────────────────────────────────────────

export type LookPoseIntensity = 'neutral' | 'low_presence' | 'high_impact';

export interface ReferencePolicy {
  useIdentityRef: boolean;
  useBodyRef:     boolean;
  useAnchorRef:   boolean;
  activeLookRef:  string | null;
}

export interface CameraGrammarRef {
  framing:     string;
  angle:       string;
  composition: string;
}

export interface ShotContract {
  shotId:          string;
  look:            LookItem;
  referencePolicy: ReferencePolicy;
  cameraGrammar:   CameraGrammarRef;
  poseIntensity:   LookPoseIntensity;
  // Solo poblado para trip_recap — la imagen de ancla de ESTE eslabón de la cadena.
  chainAnchorUrl?: string;
}

// ── Validación ────────────────────────────────────────────────────────────

export interface ValidationResult {
  passed: boolean;
  errors: string[];
}

// ── Reference Routing ─────────────────────────────────────────────────────

export interface RoutedReferences {
  orderedUrls: string[];
  breakdown: {
    identity?: string;
    body?:     string;
    anchor?:   string;
    look:      string[];
  };
}

// ── Plan de salida hacia PhotodumpShotDirective ──────────────────────────

export interface OutfitMultiLookShotPlan {
  shotId: string;
  lookId: string;
  intent: MultiLookIntent;
}

// ── Debug ─────────────────────────────────────────────────────────────────

export interface OutfitMultiLookShotDebug {
  shotId:             string;
  lookId:             string;
  referencesUsed:     string[];
  poseIntensity:      LookPoseIntensity;
  cameraGrammar:      CameraGrammarRef;
  contractValidation: ValidationResult;
  routingValidation:  ValidationResult;
  promptSummary:      string;
}
