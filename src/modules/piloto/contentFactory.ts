// ─────────────────────────────────────────────────────────────────
// PILOTO — Fábrica de contenido (headless, sin pantalla)
//
// REUTILIZA Fotos de producto: runProductDirector + buildShotPlans +
// buildPromptPayloadsFromDirectorResult (estilo `minimal`) y el único
// camino de imágenes de la app: imageApiService.generateImage.
// Lo nuevo es solo el despachador alrededor: referencias múltiples por pieza,
// control de calidad barato (alarma, no juez), guardado de activos,
// idempotencia, reintentos, tope de simultáneas y pre-generación.
//
// Toda la entrada/salida (red, Storage, Firestore) pasa por `FactoryIO`,
// así la lógica se prueba con simulación sin gastar dinero.
// ─────────────────────────────────────────────────────────────────

import { getAuth } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import { auth, db, storage } from '../../firebase';
import { imageApiService, newSessionId } from '../../services/imageApiService';
import {
  buildPromptPayloadsFromDirectorResult,
  buildShotPlans,
  runProductDirector,
  type ProductDirectorInput,
  type ProductPromptPayload,
  type ProductShotType,
} from '../productGenerator/productDirectorService';
import type { PlanTask } from '../planner/v3/plannerV3Types';
import { estimateImageUSD } from './budget/pricing';
import type { CatalogItem, GeneratedAsset, GenerationStatus, PilotPlanTask, RecipeId } from './types';

// ── Recetas que SÍ se ejecutan (mapa propio mínimo) ──────────────
// Si más adelante existe piloto/recipes.ts, este mapa se reemplaza por el suyo.
// en_el_cuerpo, escala y video NO se ejecutan (no probadas / apagadas).

const RECIPE_SHOTS: Partial<Record<RecipeId, ProductShotType[]>> = {
  catalogo_limpio: ['HERO', 'ANGLE', 'HERO'],
  detalle_macro: ['DETAIL', 'DETAIL', 'HERO'],
  flatlay_regalo: ['TOP', 'TOP', 'TOP'],
  estilo_de_vida: ['CONTEXT', 'CONTEXT', 'CONTEXT'],
  // QA1: recipes.ts las deja activas y el plan las elige; sin esto caían en "usamos tus fotos originales".
  carrusel_educativo: ['HERO', 'DETAIL', 'ANGLE'],
  story_venta: ['HERO', 'HERO'],
};

export const EXECUTABLE_RECIPES = Object.keys(RECIPE_SHOTS) as RecipeId[];
export const isExecutableRecipe = (r?: RecipeId): r is RecipeId => !!r && !!RECIPE_SHOTS[r];

/** Línea extra por receta: refuerza "sin personas" donde el director ya lo prohíbe por defecto. */
const RECIPE_EXTRA: Partial<Record<RecipeId, string>> = {
  catalogo_limpio: 'Clean neutral catalog surface. The piece alone, no people, no hands, no mannequin.',
  detalle_macro: 'Close-up macro of the piece only. Do not invent texture, stones or engraving that the product photos do not show. No people.',
  flatlay_regalo: 'Top-down flat lay. A simple neutral gift-style setting is allowed (paper, linen, ribbon) but never replaces or hides the piece. No people.',
  estilo_de_vida: 'Everyday still-life scene (vanity table, soft window light). No people, no hands, no faces. The piece stays the clear hero.',
  carrusel_educativo: 'Clean photos of the piece from different angles on a neutral surface. No people, no hands. Do not write any text on the image.',
  story_venta: 'Vertical-friendly composition: the piece large and clear on a plain surface with empty space at top and bottom. No people, no hands. Do not write any text on the image.',
};

const VARIATION_NOTES = [
  'Composition A: centered, balanced, generous negative space.',
  'Composition B: a different camera angle and a different neutral surface; same exact piece.',
  'Composition C: an off-center arrangement with soft natural shadow; same exact piece.',
];
const REINFORCE =
  'STRICT RETRY: reproduce the piece exactly as in the PRODUCT_IDENTITY_REF images — same shape, silhouette, proportions, color, finish, number and placement of stones/links, same closures. Do not add, remove or redesign any part. No text, no logos. Do not copy the background of the product photos.';
const BLOCK_RETRY =
  'Use a plain, neutral, commercial composition with a simple surface. Do not recreate any existing artwork, branded item or recognizable photo.';

// ── Parámetros de operación ──────────────────────────────────────

export const OPTIONS_TODAY = 3;
export const OPTIONS_AHEAD = 2;
export const MAX_CONCURRENT_IMAGES = 2;
export const MAX_REF_PHOTOS = 4;
/** Alarma, no juez: bajo este puntaje se pide "revisar" y se reintenta una vez. */
export const FIDELITY_ALARM = 70;
/** Entre la alarma y este valor se entrega, pero la pantalla la marca "revisa los detalles". */
export const FIDELITY_REVIEW_BELOW = 85;
const REF_SIDE = 1600;     // el tope real es el cuerpo de la petición (4,5 MB en Vercel)
const CHECK_SIDE = 768;
const MODEL_FOR_COST = 'gemini-3.1-flash-image';

// ── Errores ──────────────────────────────────────────────────────

export type FactoryErrorCode = 'BUDGET_LIMIT' | 'ACCESS' | 'NO_PHOTOS' | 'ABORTED' | 'UNKNOWN';

export class FactoryError extends Error {
  code: FactoryErrorCode;
  /** HTTP del servidor cuando aplica (402 = tope de gasto). */
  status?: number;
  constructor(code: FactoryErrorCode, message: string, status?: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export const BUDGET_MESSAGE =
  'Llegamos al tope de gasto que dejaste para esta etapa. Tus fotos de hoy siguen aquí; mañana se vuelve a abrir.';

type ErrKind = 'BUDGET' | 'ACCESS' | 'BLOCKED' | 'OTHER';

export function classifyError(err: any): ErrKind {
  const text = `${err?.code ?? ''} ${err?.message ?? ''} ${typeof err?.raw === 'string' ? err.raw : ''} ${err?.status ?? ''}`;
  if (/BUDGET_LIMIT/i.test(text) || err?.status === 402 || /\b402\b/.test(text)) return 'BUDGET';
  if (/PRIVATE_MODE|PILOT_MODEL/.test(text) || err?.status === 403) return 'ACCESS';
  if (/recitation|CONTENT_BLOCKED|blocked|safety|prohibited|policy/i.test(text)) return 'BLOCKED';
  return 'OTHER';
}

// ── Entrada/salida inyectable ────────────────────────────────────

export interface LoadedRef {
  /** data URL a resolución de trabajo */
  dataUrl: string;
  /** versión chica para el control de calidad */
  smallDataUrl: string;
  /** url del original (para mostrarlo si hay fallback) */
  srcUrl: string;
  itemId: string;
}

export interface FidelityResult {
  /** null = no se pudo medir (no apta para mostrarse) */
  score: number | null;
  issues: string[];
  /** la imagen muestra personas o manos cuando la receta no las permite */
  hasPerson?: boolean;
}

export interface FactoryIO {
  loadRefs(items: CatalogItem[]): Promise<LoadedRef[]>;
  buildPayloads(input: ProductDirectorInput, shotTypes: ProductShotType[]): Promise<ProductPromptPayload[]>;
  generate(payload: ProductPromptPayload, refs: LoadedRef[], meta: { sessionId: string; shotIndex: number; totalShots: number; taskId: string }): Promise<string>;
  check(refs: LoadedRef[], generatedDataUrl: string, allowPeople: boolean): Promise<FidelityResult>;
  saveGenerated(uid: string, fileName: string, dataUrl: string): Promise<{ url: string; path: string }>;
  saveAssetDoc(uid: string, asset: GeneratedAsset & Record<string, unknown>): Promise<void>;
  patchTask(uid: string, planId: string, taskId: string, patch: Partial<PilotPlanTask>): Promise<void>;
  sleep(ms: number): Promise<void>;
  now(): number;
}

// ── Utilidades ───────────────────────────────────────────────────

export class Limiter {
  private active = 0;
  private waiting: Array<() => void> = [];
  constructor(private readonly max: number) {}
  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.active >= this.max) await new Promise<void>(res => this.waiting.push(res));
    this.active++;
    try { return await fn(); }
    finally {
      this.active--;
      this.waiting.shift()?.();
    }
  }
}

/** Tope de simultáneas global: máx 2 imágenes en vuelo, sin importar cuántas tareas haya. */
const imageLimiter = new Limiter(MAX_CONCURRENT_IMAGES);

/** Serializa los parches a una misma lista de tareas (leer-modificar-escribir). */
let patchChain: Promise<unknown> = Promise.resolve();
const serialPatch = <T,>(fn: () => Promise<T>): Promise<T> => {
  const next = patchChain.then(fn, fn);
  patchChain = next.catch(() => undefined);
  return next;
};

const inFlight = new Map<string, Promise<TaskResult>>();

export interface TaskResult {
  taskId: string;
  generationStatus: GenerationStatus;
  assets: GeneratedAsset[];
  /** motivo humano cuando algo quedó en original o falló */
  note?: string;
  budgetStopped?: boolean;
}

export interface BrandHint {
  name?: string;
  /** palabras de tono, solo para el ambiente (nunca se escribe el nombre en la imagen) */
  toneKeywords?: string[];
}

const CATEGORY_WORD: Record<string, string> = {
  aros: 'earrings, jewelry',
  collares: 'necklace, jewelry',
  anillos: 'ring, jewelry',
  pulseras: 'bracelet, jewelry',
  accesorios: 'accessory, jewelry',
};

/** Variante = intento de "Dame otra idea". Va dentro del id para no pisar lo anterior. */
export function assetId(taskId: string, variant: number, index: number): string {
  return `${taskId}_v${variant}_${index}`;
}
export function variantOf(assets: GeneratedAsset[] | undefined): number {
  let v = 0;
  for (const a of assets ?? []) {
    const m = /_v(\d+)_\d+$/.exec(a.id);
    if (m) v = Math.max(v, parseInt(m[1], 10));
  }
  return v;
}

/** Elige la pieza y la receta si el plan todavía no las trae (planes anteriores al piloto). */
export function resolveTaskInputs(
  task: PilotPlanTask,
  items: CatalogItem[],
  rotation = 0,
): { recipeId: RecipeId; items: CatalogItem[] } {
  const byId = new Map(items.map(i => [i.id, i]));
  let chosen = (task.catalogItemIds ?? []).map(id => byId.get(id)).filter((x): x is CatalogItem => !!x);
  if (!chosen.length && items.length) {
    const priority = items.filter(i => i.role === 'ancla' || i.role === 'nuevo');
    const pool = priority.length && rotation % 3 === 0 ? priority : items;
    chosen = [pool[rotation % pool.length]];
  }
  const recipeId = task.recipeId ?? EXECUTABLE_RECIPES[rotation % EXECUTABLE_RECIPES.length];
  return { recipeId, items: chosen };
}

function buildInput(
  recipeId: RecipeId,
  items: CatalogItem[],
  refs: LoadedRef[],
  task: PilotPlanTask,
  brand?: BrandHint,
): ProductDirectorInput {
  const first = items[0];
  const title = items.length === 1
    ? `${first.name} (${CATEGORY_WORD[first.category] ?? 'jewelry'})`
    : items.map(i => i.name).join(' + ') + ' (jewelry set)';
  const desc = [
    ...items.map(i => [i.material && `material: ${i.material}`, i.color && `color: ${i.color}`].filter(Boolean).join(', ')),
    task.sceneBrief ? `scene idea: ${task.sceneBrief}` : '',
    brand?.toneKeywords?.length ? `mood words: ${brand.toneKeywords.slice(0, 4).join(', ')}` : '',
    'Never write the brand name or any text on the image.',
    RECIPE_EXTRA[recipeId] ?? '',
  ].filter(Boolean).join('. ');
  return {
    productImages: refs.map(r => r.dataUrl),
    productTitle: title,
    productDescription: desc,
    objective: 'social',
    style: 'minimal',
    mode: 'pack',
    count: 1,
  };
}

function withNotes(payload: ProductPromptPayload, notes: string[]): ProductPromptPayload {
  return { ...payload, prompt: `${payload.prompt}\n\nADDITIONAL DIRECTION:\n${notes.filter(Boolean).join('\n')}` };
}

// ── Producción de una tarea ──────────────────────────────────────

export interface ProduceParams {
  uid: string;
  planId: string;
  task: PilotPlanTask;
  items: CatalogItem[];
  brand?: BrandHint;
  /** cuántas opciones dejar listas (3 hoy, 2 para los días siguientes) */
  options?: number;
  /** "Dame otra idea": descarta lo anterior y genera una variante nueva */
  fresh?: boolean;
  io: FactoryIO;
  rotation?: number;
  /** avisos de avance para la pantalla */
  onUpdate?: (taskId: string, patch: Partial<PilotPlanTask>) => void;
  /** se llama al terminar cada imagen (progreso real) */
  onImageDone?: (taskId: string) => void;
  signal?: { aborted: boolean };
}

const isFinalAsset = (a: GeneratedAsset) => a.status === 'ready' || a.status === 'fallback_original';

export function produceTask(p: ProduceParams): Promise<TaskResult> {
  const key = `${p.planId}:${p.task.id}`;
  const running = inFlight.get(key);
  if (running) return running;                       // idempotente en la misma sesión
  const job = runTask(p).finally(() => inFlight.delete(key));
  inFlight.set(key, job);
  return job;
}

async function runTask(p: ProduceParams): Promise<TaskResult> {
  const { uid, planId, task, io } = p;
  const wanted = p.options ?? OPTIONS_TODAY;
  const prior = (task.assets ?? []).filter(isFinalAsset);
  const variant = p.fresh ? variantOf(task.assets) + 1 : variantOf(task.assets);

  // Idempotente: lo ya generado no se regenera.
  const current = p.fresh ? [] : prior.filter(a => a.id.includes(`_v${variant}_`));
  if (!p.fresh && task.generationStatus === 'ready' && current.length >= Math.min(2, wanted)) {
    return { taskId: task.id, generationStatus: 'ready', assets: task.assets ?? [] };
  }

  const { recipeId, items } = resolveTaskInputs(task, p.items, p.rotation ?? 0);
  const done = new Map<number, GeneratedAsset>();
  for (const a of current) {
    const m = /_v\d+_(\d+)$/.exec(a.id);
    if (m) done.set(parseInt(m[1], 10), a);
  }
  const push = (patch: Partial<PilotPlanTask>) => { p.onUpdate?.(task.id, patch); };
  const persist = async (patch: Partial<PilotPlanTask>) => {
    push(patch);
    await io.patchTask(uid, planId, task.id, patch).catch(() => undefined);
  };

  if (!items.length) {
    await persist({ generationStatus: 'failed' });
    return { taskId: task.id, generationStatus: 'failed', assets: [], note: 'Todavía no hay una pieza en tu catálogo para este post.' };
  }

  await persist({ recipeId, catalogItemIds: items.map(i => i.id), generationStatus: 'generating' });

  // Recetas que no se ejecutan: se muestran las fotos originales, sin gastar.
  if (!isExecutableRecipe(recipeId)) {
    const assets = originalsAsAssets(task, recipeId, items, wanted, variant, io.now());
    for (const a of assets) await io.saveAssetDoc(uid, { ...a, planId }).catch(() => undefined);
    const merged = mergeAssets(task.assets, assets, p.fresh);
    await persist({ assets: merged, generationStatus: 'ready' });
    return { taskId: task.id, generationStatus: 'ready', assets: merged, note: 'Este tipo de foto aún no se prepara automático; usamos tus fotos originales.' };
  }

  let refs: LoadedRef[];
  try {
    refs = await io.loadRefs(items);
  } catch (e: any) {
    await persist({ generationStatus: 'failed' });
    throw new FactoryError('NO_PHOTOS', 'No pudimos abrir las fotos de esta pieza. Revisa tu conexión e inténtalo de nuevo.');
  }
  if (!refs.length) {
    await persist({ generationStatus: 'failed' });
    throw new FactoryError('NO_PHOTOS', 'Esta pieza no tiene fotos. Sube al menos una en Mi catálogo.');
  }

  const allowPeople = false; // ninguna receta ejecutable lleva personas
  const sessionId = newSessionId();
  const shotTypes = (RECIPE_SHOTS[recipeId] ?? []).slice(0, wanted);
  const input = buildInput(recipeId, items, refs, task, p.brand);

  let payloads: ProductPromptPayload[];
  try {
    payloads = await io.buildPayloads(input, shotTypes);
  } catch (e: any) {
    const kind = classifyError(e);
    await persist({ generationStatus: 'failed' });
    if (kind === 'BUDGET') throw new FactoryError('BUDGET_LIMIT', BUDGET_MESSAGE, 402);
    throw new FactoryError('UNKNOWN', 'No pudimos preparar las fotos de este post. Inténtalo de nuevo.');
  }

  let budgetStopped = false;
  const results = new Map<number, GeneratedAsset>(done);
  const costOf = () => estimateImageUSD({ model: MODEL_FOR_COST, refs: refs.length });

  const optionJob = async (idx: number) => {
    if (results.has(idx)) return;
    if (budgetStopped || p.signal?.aborted) return;
    const base = payloads[idx];
    const baseNotes = [VARIATION_NOTES[idx % VARIATION_NOTES.length]];
    let spent = 0;
    let accepted: { dataUrl: string; score: number } | null = null;

    for (let attempt = 0; attempt < 2 && !accepted && !budgetStopped; attempt++) {
      const notes = attempt === 0 ? baseNotes : [...baseNotes, REINFORCE];
      let dataUrl: string | null = null;
      let blockedOnce = false;
      for (let g = 0; g < 2 && !dataUrl; g++) {
        try {
          dataUrl = await imageLimiter.run(() => {
            if (p.signal?.aborted) throw new FactoryError('ABORTED', 'Cancelado.');
            spent += costOf();
            return io.generate(withNotes(base, g === 0 ? notes : [...notes, BLOCK_RETRY]), refs, {
              sessionId, shotIndex: idx, totalShots: payloads.length, taskId: task.id,
            });
          });
        } catch (e: any) {
          const kind = classifyError(e);
          if (kind === 'BUDGET') { budgetStopped = true; return; }
          if (kind === 'ACCESS') throw new FactoryError('ACCESS', 'Tu cuenta aún no tiene acceso a preparar fotos.');
          if (e instanceof FactoryError && e.code === 'ABORTED') return;
          // bloqueo del proveedor: un reintento con otra variación; otros errores: una pausa corta y reintento
          if (kind === 'BLOCKED' && !blockedOnce) { blockedOnce = true; continue; }
          if (kind === 'OTHER' && g === 0) { await io.sleep(3000); continue; }
          break;
        }
      }
      if (!dataUrl) continue; // este intento no dio imagen; el siguiente usa el prompt reforzado

      p.onImageDone?.(task.id);
      let verdict: FidelityResult = { score: null, issues: [] };
      for (let c = 0; c < 2 && verdict.score === null; c++) {
        try {
          verdict = await io.check(refs, dataUrl, allowPeople);
        } catch (e: any) {
          if (classifyError(e) === 'BUDGET') { budgetStopped = true; return; }
          await io.sleep(1500);
        }
      }
      const okScore = verdict.score !== null && verdict.score >= FIDELITY_ALARM && !verdict.hasPerson;
      if (okScore) accepted = { dataUrl, score: verdict.score as number };
    }

    const id = assetId(task.id, variant, idx);
    if (accepted) {
      const saved = await io.saveGenerated(uid, `${id}.jpg`, accepted.dataUrl);
      const asset: GeneratedAsset = {
        id, taskId: task.id, recipeId, catalogItemId: items[0].id, kind: 'image', url: saved.url,
        costUSD: round(spent), fidelityScore: Math.round(accepted.score), status: 'ready', createdAt: io.now(),
      };
      await io.saveAssetDoc(uid, { ...asset, planId, path: saved.path }).catch(() => undefined);
      results.set(idx, asset);
    } else if (!budgetStopped) {
      // Falló dos veces: nunca se muestra esa imagen. En su lugar, la foto ORIGINAL.
      const orig = refs[idx % refs.length];
      const asset: GeneratedAsset = {
        id, taskId: task.id, recipeId, catalogItemId: orig.itemId, kind: 'image', url: orig.srcUrl,
        costUSD: round(spent), status: 'fallback_original', createdAt: io.now(),
      };
      await io.saveAssetDoc(uid, { ...asset, planId }).catch(() => undefined);
      results.set(idx, asset);
    }
    // Checkpoint: cada opción terminada queda guardada, así reanuda si se cierra la pestaña.
    const partial = mergeAssets(task.assets, [...results.values()], p.fresh);
    await persist({ assets: partial, generationStatus: 'generating' });
  };

  const settled = await Promise.allSettled(payloads.map((_, i) => optionJob(i)));
  const fatal = settled.find((s): s is PromiseRejectedResult => s.status === 'rejected' && s.reason instanceof FactoryError && s.reason.code === 'ACCESS');
  if (fatal) { await persist({ generationStatus: 'failed' }); throw fatal.reason; }

  const finalAssets = mergeAssets(task.assets, [...results.values()], p.fresh);
  const mine = [...results.values()];
  if (budgetStopped) {
    // Lo que alcanzó a quedar listo se conserva; el resto se retoma cuando se libere el tope.
    await persist({ assets: finalAssets, generationStatus: mine.length >= 2 ? 'ready' : 'failed' });
    throw Object.assign(new FactoryError('BUDGET_LIMIT', BUDGET_MESSAGE, 402), { partial: finalAssets });
  }
  const status: GenerationStatus = mine.length >= 1 ? 'ready' : 'failed';
  await persist({ assets: finalAssets, generationStatus: status });
  const fallbacks = mine.filter(a => a.status === 'fallback_original').length;
  return {
    taskId: task.id, generationStatus: status, assets: finalAssets,
    note: fallbacks ? 'En algunas opciones mostramos tu foto original porque la nueva no salió fiel a la pieza.' : undefined,
  };
}

const round = (n: number) => Math.round(n * 1e6) / 1e6;

function mergeAssets(existing: GeneratedAsset[] | undefined, fresh: GeneratedAsset[], replaceAll?: boolean): GeneratedAsset[] {
  const byId = new Map<string, GeneratedAsset>();
  // Las variantes anteriores quedan en el documento; la pantalla solo muestra la más nueva.
  for (const a of existing ?? []) byId.set(a.id, a);
  void replaceAll;
  for (const a of fresh) byId.set(a.id, a);
  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
}

/** Los activos de la variante más nueva, en orden. Es lo que muestra la pantalla. */
export function currentAssets(task: PilotPlanTask): GeneratedAsset[] {
  const all = (task.assets ?? []).filter(isFinalAsset);
  const v = variantOf(all);
  return all.filter(a => a.id.includes(`_v${v}_`)).sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
}

function originalsAsAssets(task: PilotPlanTask, recipeId: RecipeId, items: CatalogItem[], wanted: number, variant: number, now: number): GeneratedAsset[] {
  const photos = items.flatMap(i => i.originalPhotos.map(ph => ({ url: ph.url, itemId: i.id })));
  return photos.slice(0, wanted).map((ph, idx) => ({
    id: assetId(task.id, variant, idx), taskId: task.id, recipeId, catalogItemId: ph.itemId, kind: 'image' as const,
    url: ph.url, costUSD: 0, status: 'fallback_original' as const, createdAt: now,
  }));
}

// ── Pre-generación: hoy + 2 días siguientes ──────────────────────

export interface PreGenProgress {
  totalImages: number;
  doneImages: number;
  tasksTotal: number;
  tasksDone: number;
  running: boolean;
  budgetStopped?: boolean;
  error?: string;
}

const toISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Fechas de hoy y los 2 días siguientes (ISO local). */
export function windowDates(from = new Date()): string[] {
  return [0, 1, 2].map(n => { const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + n); return toISO(d); });
}

export function tasksToPreGenerate(tasks: PilotPlanTask[], from = new Date()): PilotPlanTask[] {
  const dates = windowDates(from);
  return tasks
    .filter(t => t.status === 'pending' && dates.includes(t.date))
    .filter(t => !(t.generationStatus === 'ready' && currentAssets(t).length >= 2))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export async function preGenerateWindow(args: {
  uid: string;
  planId: string;
  tasks: PilotPlanTask[];
  items: CatalogItem[];
  brand?: BrandHint;
  io: FactoryIO;
  today?: Date;
  onProgress?: (p: PreGenProgress) => void;
  onUpdate?: (taskId: string, patch: Partial<PilotPlanTask>) => void;
  signal?: { aborted: boolean };
}): Promise<PreGenProgress> {
  const today = args.today ?? new Date();
  const todayISO = toISO(today);
  const queue = tasksToPreGenerate(args.tasks, today);
  const optionsOf = (t: PilotPlanTask) => (t.date === todayISO ? OPTIONS_TODAY : OPTIONS_AHEAD);
  const prog: PreGenProgress = {
    totalImages: queue.reduce((n, t) => n + optionsOf(t), 0),
    doneImages: 0, tasksTotal: queue.length, tasksDone: 0, running: queue.length > 0,
  };
  args.onProgress?.({ ...prog });
  if (!queue.length) return prog;

  // Tareas en serie (hoy primero); dentro de cada tarea las opciones comparten el tope de 2 simultáneas.
  for (const [i, t] of queue.entries()) {
    if (args.signal?.aborted || prog.budgetStopped) break;
    try {
      await produceTask({
        uid: args.uid, planId: args.planId, task: t, items: args.items, brand: args.brand, io: args.io,
        options: optionsOf(t), rotation: i + hashCode(t.id),
        onUpdate: args.onUpdate, signal: args.signal,
        onImageDone: () => { prog.doneImages = Math.min(prog.totalImages, prog.doneImages + 1); args.onProgress?.({ ...prog }); },
      });
    } catch (e: any) {
      if (e instanceof FactoryError && e.code === 'BUDGET_LIMIT') { prog.budgetStopped = true; prog.error = BUDGET_MESSAGE; }
      else if (e instanceof FactoryError) prog.error = e.message;
      else prog.error = 'No pudimos preparar una de tus fotos. Reintenta en un momento.';
    }
    prog.tasksDone = i + 1;
    args.onProgress?.({ ...prog });
  }
  prog.running = false;
  args.onProgress?.({ ...prog });
  return prog;
}

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// ═════════════════════════════════════════════════════════════════
// IO real (navegador + servicios de la app)
// ═════════════════════════════════════════════════════════════════

async function authHeader(): Promise<Record<string, string>> {
  const token = await getAuth().currentUser?.getIdToken().catch(() => null);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(r.error);
    r.readAsDataURL(blob);
  });
}

async function resizeToJpegDataUrl(src: Blob | string, maxSide: number, quality = 0.9): Promise<string> {
  const blob = typeof src === 'string' ? await (await fetch(src)).blob() : src;
  const bmp = await createImageBitmap(blob);
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * scale));
  const h = Math.max(1, Math.round(bmp.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas');
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  return canvas.toDataURL('image/jpeg', quality);
}

async function dataUrlToJpegBlob(dataUrl: string): Promise<Blob> {
  const bmp = await createImageBitmap(await (await fetch(dataUrl)).blob());
  const canvas = document.createElement('canvas');
  canvas.width = bmp.width; canvas.height = bmp.height;
  canvas.getContext('2d')!.drawImage(bmp, 0, 0);
  bmp.close?.();
  return await new Promise<Blob>((res, rej) => canvas.toBlob(b => (b ? res(b) : rej(new Error('jpeg'))), 'image/jpeg', 0.92));
}

const stripPrefix = (dataUrl: string) => {
  const m = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl);
  return m ? { mimeType: m[1], data: m[2] } : { mimeType: 'image/jpeg', data: dataUrl };
};

const CHECK_PROMPT = (n: number, allowPeople: boolean) => `You are a strict-but-fair QA checker for jewelry product photos.
The first ${n} image(s) are REAL photos of the piece (source of truth). The LAST image is a newly generated photo.
Judge ONLY whether the generated photo shows the SAME piece: same shape and silhouette, proportions, color and material look, same kind and visible placement of stones or links, same closures. A pair of earrings must be one matching pair. Flag any added, missing or redesigned part, invented text or logo.
Ignore background, surface, lighting, camera angle and crop. Counting very small stones is unreliable, so only flag clear differences.
${allowPeople ? '' : 'Also report whether the generated photo shows a person, face or hands.'}
Respond ONLY with JSON: {"score": <0-100 integer fidelity>, "issues": [<short strings>], "hasPerson": <boolean>}`;

export function createDefaultIO(): FactoryIO {
  return {
    async loadRefs(items) {
      const refs: LoadedRef[] = [];
      const per = Math.max(1, Math.floor(MAX_REF_PHOTOS / Math.max(1, items.length)));
      for (const item of items) {
        for (const ph of item.originalPhotos.slice(0, items.length === 1 ? MAX_REF_PHOTOS : per)) {
          if (refs.length >= MAX_REF_PHOTOS + 1) break;
          try {
            const blob = await (await fetch(ph.url)).blob();
            const dataUrl = await resizeToJpegDataUrl(blob, REF_SIDE, 0.9);
            const smallDataUrl = await resizeToJpegDataUrl(blob, CHECK_SIDE, 0.85);
            refs.push({ dataUrl, smallDataUrl, srcUrl: ph.url, itemId: item.id });
          } catch { /* una foto que no abre no frena el resto */ }
        }
      }
      return refs;
    },

    async buildPayloads(input, shotTypes) {
      const direction = await runProductDirector(input);
      const shots = buildShotPlans(shotTypes, direction.analysis);
      const base = buildPromptPayloadsFromDirectorResult(input, { ...direction, shots });
      // QA1: buildShotPlans quita las tomas repetidas (['TOP','TOP','TOP'] -> 1 sola), y la receta pide
      // varias opciones. Se repiten las tomas hasta completar; cada opción lleva su propia variación de composición.
      return base.length ? shotTypes.map((_, i) => base[i % base.length]) : base;
    },

    async generate(payload, refs, meta) {
      const referenceImages = refs.map((r, i) => ({ ...stripPrefix(r.dataUrl), label: `PRODUCT_IDENTITY_REF_${i + 1}` }));
      const aspect = payload.aspectRatio === '4:5' ? '3:4' : payload.aspectRatio;
      return imageApiService.generateImage({
        prompt: payload.prompt,
        negative: payload.negativePrompt,
        referenceImages,
        aspectRatio: aspect,
        module: 'product',
        moduleLabel: 'Foto de producto',
        modelId: 'gemini',
        shotIndex: meta.shotIndex,
        totalShots: meta.totalShots,
        sessionId: meta.sessionId,
        metadata: { piloto: true, taskId: meta.taskId },
      });
    },

    async check(refs, generatedDataUrl, allowPeople) {
      const small = await resizeToJpegDataUrl(generatedDataUrl, CHECK_SIDE, 0.85);
      const originals = refs.slice(0, 3).map(r => stripPrefix(r.smallDataUrl));
      const gen = stripPrefix(small);
      const res = await fetch('/api/gemini/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
        body: JSON.stringify({
          action: 'pilotFidelityCheck',
          images: [...originals, gen].map(i => i.data),
          mimeTypes: [...originals, gen].map(i => i.mimeType),
          prompt: CHECK_PROMPT(originals.length, allowPeople),
          model: 'gemini-2.5-flash',
          generationConfig: { responseMimeType: 'application/json', temperature: 0 },
        }),
      });
      if (res.status === 402) throw new FactoryError('BUDGET_LIMIT', BUDGET_MESSAGE, 402);
      if (!res.ok) throw new Error(`check ${res.status}`);
      const data = await res.json();
      const j = data?.json ?? safeJson(data?.text);
      const score = typeof j?.score === 'number' ? Math.max(0, Math.min(100, j.score)) : null;
      return { score, issues: Array.isArray(j?.issues) ? j.issues.map(String).slice(0, 4) : [], hasPerson: !!j?.hasPerson };
    },

    async saveGenerated(uid, fileName, dataUrl) {
      const path = `users/${uid}/pilotAssets/generated/${fileName}`;
      const blob = await dataUrlToJpegBlob(dataUrl);
      const r = storageRef(storage, path);
      await uploadBytes(r, blob, { contentType: 'image/jpeg' });
      return { url: await getDownloadURL(r), path };
    },

    async saveAssetDoc(uid, asset) {
      await setDoc(doc(db, 'users', uid, 'pilotAssets', asset.id), JSON.parse(JSON.stringify(asset)));
    },

    patchTask(uid, planId, taskId, patch) {
      return serialPatch(async () => {
        const ref = doc(db, 'users', uid, 'contentPlans', planId);
        const snap = await getDoc(ref);
        if (!snap.exists()) return;
        const tasks = (snap.data().tasks ?? []).map((t: PlanTask) => (t.id === taskId ? { ...t, ...patch } : t));
        await updateDoc(ref, { tasks: JSON.parse(JSON.stringify(tasks)), updatedAt: Date.now() });
      });
    },

    sleep: ms => new Promise(r => setTimeout(r, ms)),
    now: () => Date.now(),
  };
}

function safeJson(t: unknown): any {
  try { return JSON.parse(String(t ?? '{}').replace(/```json|```/g, '').trim()); } catch { return null; }
}

/** uid actual, o error claro (la pantalla lo traduce). */
export function requireUid(): string {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new FactoryError('ACCESS', 'Inicia sesión para continuar.');
  return uid;
}
