// ─────────────────────────────────────────────────────────────────
// Piloto joyería · Pantalla 2 "Mi catálogo" — servicio.
//
// Cada PIEZA es un grupo de 1 a 4 fotos del mismo producto desde distintos
// ángulos (camino principal de Fotos de producto, DECISIONES 23 y 26-oct).
//
// Decisión sobre la colección: se usa `users/{uid}/catalog` (NO `products`).
// `products` guarda ProductProfile con imágenes base64 dentro del documento
// y descripciones propias del módulo de productos; no calza con CatalogItem
// (URLs de Storage inmutables, role, photoQuality) y las reglas del piloto ya
// existen solo para `catalog`. Sí se reutiliza: Storage de la app, el mismo
// endpoint de visión (/api/gemini/content) y el patrón de compresión.
//
// Originales: se suben SIN recomprimir si miden ≤ 2048 px de lado largo; si
// miden más se reducen a 2048 px (calidad 0.92). Nunca se sobrescriben: cada
// subida usa una ruta nueva y única.
// ─────────────────────────────────────────────────────────────────

import { collection, deleteDoc, doc, getDocs, orderBy, query, setDoc, updateDoc } from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import { getAuth } from 'firebase/auth';
import { db, storage } from '../../../firebase';
import type { CatalogItem, PhotoQuality, PilotCategory, PilotPriceRange } from '../types';
import { cleanClaims, extractJson } from './identityService';

// ── Tipos propios (campos opcionales; types.ts queda intacto) ───

export type AnalysisSource = 'ai' | 'fallback';

export interface CatalogItemExt extends CatalogItem {
  /** 'ai' si la ficha salió del análisis de las fotos; 'fallback' si fue el respaldo */
  analysisSource?: AnalysisSource;
  /** Precio que sugirió el análisis (el definitivo es priceCLP, que ella edita) */
  suggestedPriceCLP?: number;
}

export interface PieceAnalysis {
  name: string;
  category: PilotCategory;
  material: string;
  color: string;
  suggestedPriceCLP?: number;
  tags: string[];
  quality: PhotoQuality;
  source: AnalysisSource;
}

export interface PieceDraft {
  name: string;
  category: PilotCategory;
  material: string;
  color: string;
  priceCLP?: number;
  tags: string[];
  quality?: PhotoQuality;
  role: NonNullable<CatalogItem['role']>;
  source: AnalysisSource;
  suggestedPriceCLP?: number;
}

export const MAX_PHOTOS_PER_PIECE = 4;
export const ORIGINAL_MAX_SIDE = 2048;
const ANALYSIS_SIDE = 1024;
const MAX_FILE_BYTES = 30 * 1024 * 1024;
const CATEGORIES: PilotCategory[] = ['aros', 'collares', 'anillos', 'pulseras', 'accesorios'];

// ── Utilidades de imagen ────────────────────────────────────────

interface Decoded { bitmap: ImageBitmap; width: number; height: number }

async function decode(file: Blob): Promise<Decoded | null> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
    return { bitmap, width: bitmap.width, height: bitmap.height };
  } catch {
    return null; // p. ej. HEIC en un navegador que no lo lee
  }
}

function toBlob(canvas: HTMLCanvasElement, type: string, q: number): Promise<Blob | null> {
  return new Promise((res) => canvas.toBlob((b) => res(b), type, q));
}

function drawScaled(d: Decoded, maxSide: number): HTMLCanvasElement {
  const scale = Math.min(1, maxSide / Math.max(d.width, d.height));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(d.width * scale));
  c.height = Math.max(1, Math.round(d.height * scale));
  const ctx = c.getContext('2d');
  if (ctx) ctx.drawImage(d.bitmap, 0, 0, c.width, c.height);
  return c;
}

export interface PreparedOriginal { blob: Blob; contentType: string; ext: string; width?: number; height?: number }

/** Deja la foto lista para guardar como original (sin recomprimir si cabe). */
export async function prepareOriginal(file: File): Promise<PreparedOriginal> {
  if (!file.type.startsWith('image/')) throw new Error('Ese archivo no es una foto.');
  if (file.size > MAX_FILE_BYTES) throw new Error('La foto es muy pesada (máximo 30 MB).');
  const d = await decode(file);
  const keepable = ['image/jpeg', 'image/png', 'image/webp'].includes(file.type);
  if (!d) {
    // No se pudo leer en el navegador: se guarda tal cual, el análisis usará el respaldo.
    return { blob: file, contentType: file.type, ext: (file.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg') };
  }
  const long = Math.max(d.width, d.height);
  if (long <= ORIGINAL_MAX_SIDE && keepable) {
    d.bitmap.close?.();
    return { blob: file, contentType: file.type, ext: file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg', width: d.width, height: d.height };
  }
  const canvas = drawScaled(d, ORIGINAL_MAX_SIDE);
  d.bitmap.close?.();
  const blob = await toBlob(canvas, 'image/jpeg', 0.92);
  if (!blob) return { blob: file, contentType: file.type, ext: 'jpg' };
  return { blob, contentType: 'image/jpeg', ext: 'jpg', width: canvas.width, height: canvas.height };
}

/** Copia liviana (1024 px, base64 sin prefijo) para el análisis. */
async function analysisCopy(file: Blob): Promise<{ data: string; mimeType: string; canvas: HTMLCanvasElement } | null> {
  const d = await decode(file);
  if (!d) return null;
  const canvas = drawScaled(d, ANALYSIS_SIDE);
  d.bitmap.close?.();
  const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
  return { data: dataUrl.split(',')[1] ?? '', mimeType: 'image/jpeg', canvas };
}

/** Revisión local y gratuita: luz y nitidez. Sirve aunque falle el análisis. */
export function localQuality(canvas: HTMLCanvasElement): PhotoQuality {
  const w = 128;
  const h = Math.max(1, Math.round((canvas.height / canvas.width) * w));
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) return { score: 60, tips: [] };
  ctx.drawImage(canvas, 0, 0, w, h);
  const px = ctx.getImageData(0, 0, w, h).data;
  const g = new Float32Array(w * h);
  let sum = 0;
  for (let i = 0; i < w * h; i++) { g[i] = 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2]; sum += g[i]; }
  const mean = sum / (w * h);
  let lap = 0, n = 0;
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x;
    const v = 4 * g[i] - g[i - 1] - g[i + 1] - g[i - w] - g[i + w];
    lap += v * v; n++;
  }
  const sharp = n ? lap / n : 0;
  const tips: string[] = [];
  let score = 85;
  if (mean < 75) { tips.push('Más luz: acércate a una ventana o usa luz de día.'); score -= 25; }
  if (mean > 225) { tips.push('Hay demasiada luz: evita el flash directo para que no se quemen los brillos.'); score -= 15; }
  if (sharp < 12) { tips.push('Se ve algo movida: apoya el celular y toca la pantalla para enfocar la joya.'); score -= 20; }
  return { score: Math.max(20, score), tips };
}

// ── Análisis con visión (respaldo si falla) ─────────────────────

export function fallbackAnalysis(photoCount: number, quality?: PhotoQuality): PieceAnalysis {
  const tips = [...(quality?.tips ?? [])];
  if (photoCount < 2) tips.push('Sube al menos 2 ángulos de la misma pieza: las fotos nuevas salen más parecidas a la real.');
  return {
    name: 'Pieza nueva',
    category: 'accesorios',
    material: '',
    color: '',
    tags: [],
    quality: { score: quality?.score ?? 60, tips },
    source: 'fallback',
  };
}

const PRICE_HINT: Record<PilotPriceRange, string> = {
  bajo: 'entre 5.000 y 15.000 pesos chilenos',
  medio: 'entre 15.000 y 40.000 pesos chilenos',
  alto: 'sobre 40.000 pesos chilenos',
};

export interface AnalysisContext {
  priceRange?: PilotPriceRange;
  /** Material que ella declaró en Mi marca (si lo declaró) */
  declaredMaterial?: string;
}

export function buildAnalysisPrompt(photoCount: number, ctx: AnalysisContext = {}): string {
  return `Eres la asistente de una joyería chilena pequeña. Mira ${photoCount > 1 ? `estas ${photoCount} fotos de la MISMA pieza desde distintos ángulos` : 'esta foto de una pieza'} y ficha el producto.

Reglas:
- Español de Chile, sin emojis, sin jerga técnica.
- "nombre": 2 a 4 palabras, simple y descriptivo (por ejemplo "Aros gota verde"). No inventes marcas ni colecciones.
- "tipo": exactamente uno de: aros, collares, anillos, pulseras, accesorios.
- "material_probable": lo que parece (por ejemplo "plata", "dorado", "acero", "resina", "perla"). NO afirmes "plata 925", "oro" certificado ni "hipoalergénico": no puedes verificarlo en una foto.${ctx.declaredMaterial ? `\n- Ella dice que trabaja con: ${ctx.declaredMaterial}.` : ''}
- "color": el color principal en palabras simples.
- "precio_sugerido_clp": número entero en pesos chilenos${ctx.priceRange ? `, su rango habitual es ${PRICE_HINT[ctx.priceRange]}` : ', razonable para una marca chica'}. Redondea a miles.
- "etiquetas": 3 a 6 palabras que describan la pieza (forma, estilo, ocasión).
- "calidad": "puntaje" de 0 a 100 de qué tan buena es la foto para vender, y "consejos": 0 a 3 consejos cortos y concretos sobre las fotos, tomados de esta lista cuando apliquen: "Más luz", "Fondo desordenado: usa una hoja blanca o una tela lisa", "Acércate más a la joya", "Hay reflejos fuertes: cambia el ángulo de la luz", "Falta un ángulo: agrega una foto de lado".

Devuelve SOLO este JSON, sin markdown:
{"nombre":"","tipo":"aros","material_probable":"","color":"","precio_sugerido_clp":0,"etiquetas":[""],"calidad":{"puntaje":0,"consejos":[""]}}`;
}

export function parseAnalysis(raw: unknown, photoCount: number, local?: PhotoQuality): PieceAnalysis | null {
  const r = raw as any;
  if (!r || typeof r !== 'object') return null;
  const name = cleanClaims(String(r.nombre ?? '').trim().slice(0, 48), []);
  if (!name) return null;
  const tipo = String(r.tipo ?? '').toLowerCase().trim() as PilotCategory;
  const price = Number(r.precio_sugerido_clp);
  const tips: string[] = (Array.isArray(r.calidad?.consejos) ? r.calidad.consejos : [])
    .map((t: unknown) => String(t ?? '').trim().slice(0, 120)).filter(Boolean).slice(0, 3);
  // Los consejos locales (luz/nitidez) se suman sin repetir ideas
  for (const t of local?.tips ?? []) if (!tips.some((x) => x.slice(0, 6).toLowerCase() === t.slice(0, 6).toLowerCase())) tips.push(t);
  if (photoCount < 2) tips.push('Sube al menos 2 ángulos de la misma pieza: las fotos nuevas salen más parecidas a la real.');
  const aiScore = Number(r.calidad?.puntaje);
  const score = Number.isFinite(aiScore) ? Math.max(0, Math.min(100, Math.round(aiScore))) : local?.score ?? 60;
  return {
    name,
    category: CATEGORIES.includes(tipo) ? tipo : 'accesorios',
    // Un material visto en foto nunca se presenta como certificado
    material: cleanClaims(String(r.material_probable ?? '').replace(/\s*925\b/g, '').trim().slice(0, 40), []),
    color: String(r.color ?? '').trim().slice(0, 30),
    suggestedPriceCLP: Number.isFinite(price) && price >= 1000 && price <= 2_000_000 ? Math.round(price / 1000) * 1000 : undefined,
    tags: (Array.isArray(r.etiquetas) ? r.etiquetas : []).map((t: unknown) => String(t ?? '').trim().toLowerCase().slice(0, 24)).filter(Boolean).slice(0, 6),
    quality: { score, tips },
    source: 'ai',
  };
}

async function callVision(images: Array<{ data: string; mimeType: string }>, prompt: string): Promise<string> {
  const token = await getAuth().currentUser?.getIdToken().catch(() => null);
  const res = await fetch('/api/gemini/content', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({
      action: 'analyzeImageWithText',
      images: images.map((i) => i.data),
      mimeTypes: images.map((i) => i.mimeType),
      prompt,
      model: 'gemini-2.5-flash',
    }),
  });
  if (!res.ok) throw new Error(`Visión: ${res.status}`);
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Visión falló');
  return data.json ? JSON.stringify(data.json) : String(data.text ?? '');
}

/**
 * Analiza las fotos de una pieza. Nunca lanza: si algo falla devuelve el
 * respaldo (ficha vacía editable) con los consejos de luz/nitidez locales.
 * `call` se puede inyectar para pruebas.
 */
export async function analyzePiece(
  files: File[],
  ctx: AnalysisContext = {},
  call: typeof callVision = callVision,
): Promise<PieceAnalysis> {
  let local: PhotoQuality | undefined;
  try {
    const copies = (await Promise.all(files.slice(0, MAX_PHOTOS_PER_PIECE).map(analysisCopy))).filter((c): c is NonNullable<typeof c> => !!c);
    if (copies.length === 0) return fallbackAnalysis(files.length);
    const qualities = copies.map((c) => localQuality(c.canvas));
    const tips = Array.from(new Set(qualities.flatMap((q) => q.tips)));
    local = { score: Math.round(qualities.reduce((a, q) => a + q.score, 0) / qualities.length), tips };
    const images = copies.map(({ data, mimeType }) => ({ data, mimeType }));
    const prompt = buildAnalysisPrompt(files.length, ctx);
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const text = await call(images, attempt ? `${prompt}\n\nIMPORTANTE: responde SOLO el JSON, sin texto adicional.` : prompt);
        const parsed = parseAnalysis(extractJson(text), files.length, local);
        if (parsed) return parsed;
      } catch (e) {
        console.warn('[catalogService] análisis intento', attempt + 1, 'falló:', e);
      }
    }
  } catch (e) {
    console.warn('[catalogService] análisis falló:', e);
  }
  return fallbackAnalysis(files.length, local);
}

// ── Firestore + Storage ─────────────────────────────────────────

const catalogCol = (uid: string) => collection(db, 'users', uid, 'catalog');
const catalogDoc = (uid: string, id: string) => doc(db, 'users', uid, 'catalog', id);

function uid8(): string {
  const a = new Uint8Array(6);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Quita `undefined` (Firestore no los acepta). */
function clean<T extends object>(o: T): T {
  return JSON.parse(JSON.stringify(o)) as T;
}

async function uploadOriginal(uid: string, itemId: string, file: File): Promise<{ url: string; path: string }> {
  const p = await prepareOriginal(file);
  // Ruta nueva y única en cada subida: un original jamás se sobrescribe.
  const path = `users/${uid}/pilotAssets/originals/${itemId}/${Date.now()}-${uid8()}.${p.ext}`;
  const r = storageRef(storage, path);
  await uploadBytes(r, p.blob, { contentType: p.contentType, customMetadata: { immutable: 'true' } });
  const url = await getDownloadURL(r);
  return { url, path };
}

export const catalogService = {
  async list(uid: string): Promise<CatalogItemExt[]> {
    try {
      const snap = await getDocs(query(catalogCol(uid), orderBy('createdAt', 'desc')));
      return snap.docs.map((d) => ({ ...(d.data() as CatalogItemExt), id: d.id }));
    } catch (e) {
      console.error('[catalogService] list', e);
      throw new Error('No se pudo cargar tu catálogo. Revisa tu conexión.');
    }
  },

  /** Sube las fotos y guarda la pieza. `onProgress(hechas, total)` para la barra. */
  async create(uid: string, draft: PieceDraft, files: File[], onProgress?: (done: number, total: number) => void): Promise<CatalogItemExt> {
    const ref = doc(catalogCol(uid));
    const photos: CatalogItem['originalPhotos'] = [];
    onProgress?.(0, files.length);
    for (let i = 0; i < files.length; i++) {
      photos.push(await uploadOriginal(uid, ref.id, files[i]));
      onProgress?.(i + 1, files.length);
    }
    const now = Date.now();
    const item: CatalogItemExt = {
      id: ref.id,
      name: draft.name.trim() || 'Pieza nueva',
      category: draft.category,
      material: draft.material.trim(),
      color: draft.color.trim(),
      priceCLP: draft.priceCLP,
      originalPhotos: photos,
      aiTags: draft.tags,
      photoQuality: draft.quality,
      role: draft.role,
      analysisSource: draft.source,
      suggestedPriceCLP: draft.suggestedPriceCLP,
      createdAt: now,
      updatedAt: now,
    };
    try {
      await setDoc(ref, clean(item));
    } catch (e) {
      console.error('[catalogService] create', e);
      throw new Error('Las fotos subieron pero no se pudo guardar la pieza. Inténtalo de nuevo.');
    }
    return item;
  },

  /** Agrega otro ángulo a una pieza existente (los anteriores no se tocan). */
  async addAngle(uid: string, item: CatalogItemExt, file: File): Promise<CatalogItemExt> {
    if (item.originalPhotos.length >= MAX_PHOTOS_PER_PIECE) throw new Error('Cada pieza admite hasta 4 fotos.');
    const photo = await uploadOriginal(uid, item.id, file);
    const originalPhotos = [...item.originalPhotos, photo];
    const updatedAt = Date.now();
    await updateDoc(catalogDoc(uid, item.id), { originalPhotos, updatedAt });
    return { ...item, originalPhotos, updatedAt };
  },

  async update(uid: string, item: CatalogItemExt, patch: Partial<Pick<CatalogItemExt, 'name' | 'category' | 'material' | 'color' | 'priceCLP' | 'role'>>): Promise<CatalogItemExt> {
    const next = { ...item, ...patch, updatedAt: Date.now() };
    const body: Record<string, unknown> = { updatedAt: next.updatedAt };
    (Object.keys(patch) as Array<keyof typeof patch>).forEach((k) => { body[k] = patch[k] === undefined ? null : patch[k]; });
    try {
      await updateDoc(catalogDoc(uid, item.id), body);
    } catch (e) {
      console.error('[catalogService] update', e);
      throw new Error('No se pudo guardar el cambio. Inténtalo de nuevo.');
    }
    return next;
  },

  /** Borra la pieza (solo si ella lo pide) y, sin bloquear, sus fotos. */
  async remove(uid: string, item: CatalogItemExt): Promise<void> {
    await deleteDoc(catalogDoc(uid, item.id));
    await Promise.allSettled(item.originalPhotos.map((p) => deleteObject(storageRef(storage, p.path))));
  },
};
