// src/modules/piloto/budget/pricing.ts
// Tabla de precios configurable del libro de gasto (USD).
//
// VERIFICADO el 2026-10-22 en la pagina oficial de precios de Google Cloud:
//   https://cloud.google.com/vertex-ai/generative-ai/pricing
// (no de memoria; cada precio indica la fila exacta). Si Google cambia los
// precios, se edita SOLO este archivo. Revisar al menos una vez al mes.
//
// Los precios son de lista; el gasto real puede variar un poco (tokens de
// razonamiento, etc.). Por eso cada estimacion lleva un margen de seguridad.

import type { BudgetKind } from './ledgerTypes';

export type PriceUnit = 'image' | 'second' | 'token1k';

/** Margen sobre el precio de lista para no quedarse corto (10 %). */
export const SAFETY_MARGIN = 1.1;

// ── IMAGEN ───────────────────────────────────────────────────────────────────
// Gemini 3.1 Flash Image (Nano Banana 2), region global.
// Verificado 2026-10-22, https://cloud.google.com/vertex-ai/generative-ai/pricing
// Fila "Gemini 3.1 Flash Image": salida de imagen USD 60 / 1M tokens;
// nota al pie: 512px = 747 tokens (USD 0.045), 1K = 1120 tokens (USD 0.067),
// 2K = 1680 tokens (USD 0.101), 4K = 2520 tokens (USD 0.15).
// Entrada: USD 0.50 / 1M tokens; cada imagen de entrada cuenta 1120 tokens
// (= USD 0.00056). Texto de salida/razonamiento: USD 3.00 / 1M tokens.
export type ImageSize = '512' | '1K' | '2K' | '4K';

export const IMAGE_OUTPUT_USD: Record<string, Record<ImageSize, number>> = {
  'gemini-3.1-flash-image': { '512': 0.045, '1K': 0.067, '2K': 0.101, '4K': 0.15 },
  // Gemini 3 Pro Image (Nano Banana Pro), misma pagina, verificado 2026-10-22:
  // 1120 tokens (USD 0.134) para 1K y 2K; 2000 tokens (USD 0.24) para 4K.
  'gemini-3-pro-image-preview': { '512': 0.134, '1K': 0.134, '2K': 0.134, '4K': 0.24 },
};

/** Entrada por imagen de referencia. Flash: 1120 tokens x USD 0.50/M. Pro: 560 tokens x USD 2.00/M. */
export const IMAGE_INPUT_PER_REF_USD: Record<string, number> = {
  'gemini-3.1-flash-image': 0.00056,
  'gemini-3-pro-image-preview': 0.00112,
};

/** Texto de entrada + razonamiento de una generacion de imagen (colchon fijo). */
export const IMAGE_TEXT_OVERHEAD_USD = 0.003;

// ── TEXTO / VISION ───────────────────────────────────────────────────────────
// Gemini 2.5 Flash, verificado 2026-10-22 (misma pagina, tabla "Gemini 2.5"):
//   Entrada (texto, imagen, video): USD 0.30 / 1M tokens
//   Salida (respuesta y razonamiento): USD 2.50 / 1M tokens
// Gemini 2.5 Flash Lite: entrada USD 0.10, salida USD 0.40 / 1M tokens.
export const TEXT_PRICE_PER_1M: Record<string, { input: number; output: number }> = {
  'gemini-2.5-flash': { input: 0.30, output: 2.50 },
  'gemini-2.5-flash-lite': { input: 0.10, output: 0.40 },
};

// ── VIDEO ────────────────────────────────────────────────────────────────────
// Video queda DESHABILITADO hasta que el spike de video confirme modelo y
// costo (CIERRE_MVP/spikes/video-informe.md). Mientras sea 'pendiente',
// checkBudget rechaza todo gasto de tipo 'video'.
// Referencia de la pagina oficial (2026-10-22), seccion Veo: se cobra por
// "1 count" (segundo de video) entre USD 0.03 y 0.60 segun modelo, resolucion
// y audio. NO se usa ningun valor hasta confirmarlo con el spike.
export const VIDEO_PRICE_PER_SECOND_USD: number | 'pendiente' = 'pendiente';

// ── TOPES ────────────────────────────────────────────────────────────────────
export interface BudgetCaps {
  /** Tope total del piloto (deja ~10 % de colchon bajo los USD 300). */
  totalCapUSD: number;
  /** Tope diario global. */
  dailyCapUSD: number;
  /** Tope semanal por tipo. 0 = tipo deshabilitado. */
  weeklyCapByKind: Record<BudgetKind, number>;
  /** Video: tope por clip y por dia (solo aplica si hay precio de video). */
  videoPerClipCapUSD: number;
  videoDailyCapUSD: number;
  /** Fraccion (0-1) desde la que se marca alerta. */
  alertAt: number;
}

export const DEFAULT_CAPS: BudgetCaps = {
  // Saldo ~USD 290 (proyecto luz-creative-engine-2, vence 29-dic-2026) -> ~10 % de colchon.
  totalCapUSD: 260,
  dailyCapUSD: 4,
  weeklyCapByKind: { image: 17, text: 2, vision: 2, video: 0 },
  videoPerClipCapUSD: 1.5,
  videoDailyCapUSD: 1.5,
  alertAt: 0.8,
};

function num(v: string | undefined, d: number): number {
  if (v === undefined || v === '') return d;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : d;
}

/** Lee topes desde variables de entorno del servidor. Valores invalidos usan el default. */
export function capsFromEnv(env: Record<string, string | undefined>): BudgetCaps {
  const d = DEFAULT_CAPS;
  return {
    totalCapUSD: num(env.PILOT_TOTAL_CAP_USD, d.totalCapUSD),
    dailyCapUSD: num(env.PILOT_DAILY_CAP_USD, d.dailyCapUSD),
    weeklyCapByKind: {
      image:  num(env.PILOT_WEEKLY_IMAGE_CAP_USD,  d.weeklyCapByKind.image),
      text:   num(env.PILOT_WEEKLY_TEXT_CAP_USD,   d.weeklyCapByKind.text),
      vision: num(env.PILOT_WEEKLY_VISION_CAP_USD, d.weeklyCapByKind.vision),
      video:  num(env.PILOT_WEEKLY_VIDEO_CAP_USD,  d.weeklyCapByKind.video),
    },
    videoPerClipCapUSD: num(env.PILOT_VIDEO_CLIP_CAP_USD, d.videoPerClipCapUSD),
    videoDailyCapUSD:   num(env.PILOT_VIDEO_DAILY_CAP_USD, d.videoDailyCapUSD),
    alertAt: d.alertAt,
  };
}

function round6(n: number): number { return Math.round(n * 1e6) / 1e6; }

// ── ESTIMADORES (USD con margen de seguridad) ───────────────────────────────
export function estimateImageUSD(opts: {
  model?: string; size?: ImageSize; refs?: number; count?: number;
}): number {
  const model = opts.model && IMAGE_OUTPUT_USD[opts.model] ? opts.model : 'gemini-3.1-flash-image';
  const out = IMAGE_OUTPUT_USD[model][opts.size ?? '1K'];
  const inp = (IMAGE_INPUT_PER_REF_USD[model] ?? 0.00056) * (opts.refs ?? 0);
  return round6((out + inp + IMAGE_TEXT_OVERHEAD_USD) * (opts.count ?? 1) * SAFETY_MARGIN);
}

export function estimateTextUSD(opts: {
  model?: string; inputTokens: number; outputTokens: number;
}): number {
  const p = TEXT_PRICE_PER_1M[opts.model ?? 'gemini-2.5-flash'] ?? TEXT_PRICE_PER_1M['gemini-2.5-flash'];
  return round6(((opts.inputTokens * p.input + opts.outputTokens * p.output) / 1e6) * SAFETY_MARGIN);
}

/** null si el video esta deshabilitado (precio 'pendiente'). */
export function estimateVideoUSD(seconds: number): number | null {
  if (VIDEO_PRICE_PER_SECOND_USD === 'pendiente') return null;
  return round6(VIDEO_PRICE_PER_SECOND_USD * seconds * SAFETY_MARGIN);
}

export function isVideoEnabled(): boolean {
  return VIDEO_PRICE_PER_SECOND_USD !== 'pendiente';
}
