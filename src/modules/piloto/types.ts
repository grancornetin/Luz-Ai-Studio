// ─────────────────────────────────────────────────────────────────
// PILOTO AUTOMÁTICO PARA JOYERÍA — Contratos compartidos
// Fuente: CIERRE_MVP/PLAN_PILOTO_3_DIAS.md (W0).
// Regla: ningún frente cambia este archivo; los cambios pasan por el
// orquestador. La UI, los servicios y Firestore usan SOLO estos tipos.
// ─────────────────────────────────────────────────────────────────

import type { PlanTask } from '../planner/v3/plannerV3Types';

// BudgetKind / BudgetLedger / LedgerEntry viven en ./budget/ledgerTypes.ts
// (los entrega W8; se reexportan aquí al mergear esa rama).

// ── Pantalla 1: respuestas de "Mi marca" ─────────────────────────

export type PilotCategory = 'aros' | 'collares' | 'anillos' | 'pulseras' | 'accesorios';
export type PilotMaterial = 'plata_925' | 'banado' | 'acero' | 'otro' | 'no_se';
export type PilotPriceRange = 'bajo' | 'medio' | 'alto';
export type PilotAudience = 'jovenes' | 'adultas' | 'regalos' | 'no_se';
export type PilotVoice = 'calida' | 'elegante' | 'juvenil';

export interface PilotSeed {
  categories: PilotCategory[];
  material: PilotMaterial;
  /** Texto libre solo si material = 'otro' */
  materialNote?: string;
  priceRange: PilotPriceRange;
  audience: PilotAudience;
  /** ids de estilos de referencia elegidos (hasta 3) */
  referenceStyleIds: string[];
  voice: PilotVoice;
  /** Nombre de marca si ya tiene; vacío = la app propone */
  brandName?: string;
  /** Claims que ELLA confirma (si no los marca, ningún texto los afirma) */
  confirmedClaims: Array<'plata_925' | 'hipoalergenico' | 'garantia' | 'banado_oro'>;
  createdAt: number;
}

// ── Pantalla 2: catálogo ─────────────────────────────────────────

export interface PhotoQuality {
  /** 0-100 */
  score: number;
  /** Consejos humanos: "más luz", "fondo desordenado" */
  tips: string[];
}

export interface CatalogItem {
  id: string;
  name: string;
  category: PilotCategory;
  material: string;
  color: string;
  priceCLP?: number;
  /** URLs de Storage de los originales (inmutables, nunca se sobrescriben) */
  originalPhotos: Array<{ url: string; path: string }>;
  /** Etiquetas que propone el análisis de la foto */
  aiTags: string[];
  photoQuality?: PhotoQuality;
  /** El producto ancla se rota más seguido; "nuevo" se destaca */
  role?: 'ancla' | 'nuevo' | 'normal';
  createdAt: number;
  updatedAt: number;
}

// ── Recetas de contenido y activos generados ─────────────────────
// Las recetas finales las confirman W1 (evidencia) y el spike de
// fidelidad; esta lista inicial puede recortarse, no ampliarse sin
// pasar por el orquestador.

export type RecipeId =
  | 'catalogo_limpio'
  | 'detalle_macro'
  | 'en_el_cuerpo'
  | 'escala'
  | 'flatlay_regalo'
  | 'estilo_de_vida'
  | 'carrusel_educativo'
  | 'story_venta'
  | 'video_giro'
  | 'video_me_lo_puse';

export type AssetKind = 'image' | 'video';

export type AssetStatus =
  | 'pending'
  | 'generating'
  | 'checking'
  | 'ready'
  | 'fallback_original'
  | 'failed';

export interface GeneratedAsset {
  id: string;
  taskId: string;
  recipeId: RecipeId;
  catalogItemId: string;
  kind: AssetKind;
  url: string;
  /** Costo real o estimado en USD (se registra también en el libro de gasto) */
  costUSD: number;
  /** 0-100, comparación con la foto original. Sin puntaje = no apta para mostrarse */
  fidelityScore?: number;
  status: AssetStatus;
  createdAt: number;
}

// ── Extensión de la tarea del Planner ────────────────────────────
// Se aplica con intersección para no cambiar el contrato del Planner
// v3 existente; los campos nuevos son todos opcionales.

export type GenerationStatus = 'idle' | 'queued' | 'generating' | 'ready' | 'failed';

export interface PilotTaskExtension {
  recipeId?: RecipeId;
  catalogItemIds?: string[];
  assets?: GeneratedAsset[];
  generationStatus?: GenerationStatus;
  /** Escena/idea concreta para la receta (brief de generación sin pedirle nada a ella) */
  sceneBrief?: string;
}

export type PilotPlanTask = PlanTask & PilotTaskExtension;

// ── Modo privado ─────────────────────────────────────────────────

export interface PilotConfig {
  /** uids con acceso al modo privado. Lo escribe el servidor/admin. */
  allowedUids: string[];
  videoEnabled: boolean;
}
