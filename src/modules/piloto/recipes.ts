// ─────────────────────────────────────────────────────────────────
// PILOTO JOYERÍA — Recetas de contenido y su mapa al director de
// "Fotos de producto" (src/modules/productGenerator/productDirectorService.ts).
//
// QUÉ ES: el plan (Planner v3) elige UNA receta por tarea. Cada receta
// se ejecuta con tomas (ProductShotType) que ya sabe producir el director
// de Fotos de producto, usando el estilo 'minimal' y la(s) foto(s) real(es)
// de la pieza como referencia. Sin que ella configure nada.
//
// REGLA DE FIDELIDAD: ninguna receta inventa piedras, cierres ni grabados.
// Las recetas con personas (en_el_cuerpo, escala) y video están APAGADAS.
//
// Este archivo es la única fuente de verdad del mapa. El validador del
// plan y el generador de contenido (contentFactory) lo leen de aquí.
// ─────────────────────────────────────────────────────────────────

import type { RecipeId } from './types';
import type { PlanFormat } from '../planner/v3/plannerV3Types';
import type { ProductShotType, ProductStyle } from '../productGenerator/productDirectorService';

export interface RecipeDef {
  id: RecipeId;
  /** Nombre para ella (sin jerga) */
  label: string;
  /** Qué es, en una línea (también la lee el plan) */
  description: string;
  enabled: boolean;
  /** Por qué está apagada (solo si enabled = false) */
  disabledReason?: string;
  /** Tomas del director de Fotos de producto, en orden de prioridad */
  shotTypes: ProductShotType[];
  /** Estilo del director de Fotos de producto */
  style: ProductStyle;
  /** Cuántas imágenes deben salir de la receta (rango) */
  imageCount: { min: number; max: number };
  /** El director debe tratar el contexto como SIN personas */
  noPeople: true;
  /** Formatos del Planner donde la receta tiene sentido */
  formats: PlanFormat[];
  /** La pieza lleva texto encima (palabras de la tarea, no inventadas por la imagen) */
  needsOverlayText: boolean;
  /** Cuántas piezas distintas admite como máximo */
  maxProducts: number;
  /** Qué debe describir el sceneBrief (lo lee el plan) */
  sceneGuide: string;
  /** Escena por defecto cuando el modelo falla (relleno determinista) */
  fallbackScene: string;
}

export const RECIPES: Record<RecipeId, RecipeDef> = {
  catalogo_limpio: {
    id: 'catalogo_limpio',
    label: 'Foto limpia de la pieza',
    description: 'La pieza completa y centrada sobre fondo simple. Es la foto de tienda: sirve para mostrar el producto tal cual es.',
    enabled: true,
    shotTypes: ['HERO'],
    style: 'minimal',
    imageCount: { min: 2, max: 3 },
    noPeople: true,
    formats: ['Foto', 'Carrusel'],
    needsOverlayText: false,
    maxProducts: 1,
    sceneGuide: 'Superficie y color de fondo (neutro y limpio), luz suave, pieza centrada y completa. Nada más en la escena.',
    fallbackScene: 'La pieza completa y centrada sobre un fondo claro y liso, luz suave de ventana, sin otros objetos.',
  },
  detalle_macro: {
    id: 'detalle_macro',
    label: 'Detalle de cerca',
    description: 'Acercamiento a la terminación, el color o el cierre. Responde la duda de calidad antes de comprar.',
    enabled: true,
    shotTypes: ['DETAIL'],
    style: 'minimal',
    imageCount: { min: 2, max: 3 },
    noPeople: true,
    formats: ['Foto', 'Carrusel', 'Story'],
    needsOverlayText: false,
    maxProducts: 1,
    sceneGuide: 'Qué parte de la pieza se ve de cerca (borde, color, cierre, textura real). No agregar detalles que la pieza no tiene.',
    fallbackScene: 'Acercamiento a la parte más bonita de la pieza, fondo liso y claro, enfoque nítido, sin inventar detalles.',
  },
  flatlay_regalo: {
    id: 'flatlay_regalo',
    label: 'Foto desde arriba para regalo',
    description: 'Vista desde arriba, ordenada, pensada para ideas de regalo y combinaciones de piezas.',
    enabled: true,
    shotTypes: ['TOP'],
    style: 'minimal',
    imageCount: { min: 2, max: 3 },
    noPeople: true,
    formats: ['Foto', 'Carrusel'],
    needsOverlayText: false,
    maxProducts: 2,
    sceneGuide: 'Superficie (papel, tela lisa, madera clara), cómo se acomoda la pieza (o las dos piezas) vista desde arriba. Solo elementos neutros de regalo (papel, cinta lisa).',
    fallbackScene: 'Vista desde arriba de la pieza sobre una superficie lisa y clara, con sombra suave y mucho espacio libre alrededor.',
  },
  estilo_de_vida: {
    id: 'estilo_de_vida',
    label: 'La pieza en un ambiente',
    description: 'La pieza en una escena cotidiana (mesa, espejo, bandeja) sin personas.',
    enabled: true,
    shotTypes: ['CONTEXT'],
    style: 'lifestyle',
    imageCount: { min: 2, max: 3 },
    noPeople: true,
    formats: ['Foto', 'Carrusel', 'Story'],
    needsOverlayText: false,
    maxProducts: 1,
    sceneGuide: 'Un ambiente simple y creíble (tocador, mesa de noche, bandeja de cerámica) sin personas ni manos. La pieza sigue siendo lo más importante de la imagen.',
    fallbackScene: 'La pieza sobre una bandeja pequeña en un tocador ordenado, luz natural de ventana, sin personas ni manos.',
  },
  carrusel_educativo: {
    id: 'carrusel_educativo',
    label: 'Carrusel que resuelve una duda',
    description: 'Un carrusel con láminas de texto corto que responde una duda de compra (cuidado, material, regalo), más 2 o 3 fotos reales de la pieza.',
    enabled: true,
    shotTypes: ['HERO', 'DETAIL', 'ANGLE'],
    style: 'minimal',
    imageCount: { min: 2, max: 3 },
    noPeople: true,
    formats: ['Carrusel'],
    needsOverlayText: true,
    maxProducts: 2,
    sceneGuide: 'Escribe las láminas: "Lámina 1: ...", "Lámina 2: ..." con texto corto (máx. 12 palabras cada una), y qué foto va en cada una. La última lámina cierra con el llamado a escribirte o guardar.',
    fallbackScene: 'Lámina 1: título con la duda. Lámina 2: la respuesta en una frase. Lámina 3: foto de la pieza. Lámina 4: cómo escribirte para pedir.',
  },
  story_venta: {
    id: 'story_venta',
    label: 'Story para vender',
    description: 'Una story vertical con la pieza bien visible y un texto corto con el llamado a escribir o comprar.',
    enabled: true,
    shotTypes: ['HERO'],
    style: 'minimal',
    imageCount: { min: 1, max: 2 },
    noPeople: true,
    formats: ['Story'],
    needsOverlayText: true,
    maxProducts: 1,
    sceneGuide: 'Fondo simple, pieza grande y clara, y el texto corto que va encima (máx. 8 palabras) con el llamado a la acción. Deja espacio libre arriba y abajo para el texto.',
    fallbackScene: 'La pieza grande y centrada sobre fondo liso; espacio libre arriba para el título y abajo para el llamado a escribir.',
  },
  // ── Apagadas ────────────────────────────────────────────────────
  en_el_cuerpo: {
    id: 'en_el_cuerpo',
    label: 'La pieza puesta',
    description: 'Mano, cuello u oreja con la pieza puesta.',
    enabled: false,
    disabledReason: 'Fidelidad con personas sin probar con producto real (spike de fidelidad, puerta A). Se enciende cuando pase la prueba.',
    shotTypes: ['CONTEXT'],
    style: 'lifestyle',
    imageCount: { min: 2, max: 3 },
    noPeople: true,
    formats: ['Foto', 'Carrusel'],
    needsOverlayText: false,
    maxProducts: 1,
    sceneGuide: '',
    fallbackScene: '',
  },
  escala: {
    id: 'escala',
    label: 'Tamaño real',
    description: 'La pieza junto a una moneda o regla para mostrar el tamaño.',
    enabled: false,
    disabledReason: 'Escala no resuelta: el director no garantiza proporciones reales entre pieza y objeto de referencia.',
    shotTypes: ['TOP'],
    style: 'minimal',
    imageCount: { min: 1, max: 2 },
    noPeople: true,
    formats: ['Foto', 'Story'],
    needsOverlayText: true,
    maxProducts: 1,
    sceneGuide: '',
    fallbackScene: '',
  },
  video_giro: {
    id: 'video_giro',
    label: 'Video: la pieza girando',
    description: 'Video corto de brillo/giro de la pieza.',
    enabled: false,
    disabledReason: 'Video apagado por interruptor (PilotConfig.videoEnabled) hasta confirmar modelo, cuota y costo.',
    shotTypes: ['HERO'],
    style: 'minimal',
    imageCount: { min: 1, max: 1 },
    noPeople: true,
    formats: ['Video'],
    needsOverlayText: false,
    maxProducts: 1,
    sceneGuide: '',
    fallbackScene: '',
  },
  video_me_lo_puse: {
    id: 'video_me_lo_puse',
    label: 'Video: la pieza puesta',
    description: 'Video corto con la pieza puesta.',
    enabled: false,
    disabledReason: 'Video con personas: apagado (fidelidad y política de etiquetado).',
    shotTypes: ['CONTEXT'],
    style: 'lifestyle',
    imageCount: { min: 1, max: 1 },
    noPeople: true,
    formats: ['Video'],
    needsOverlayText: false,
    maxProducts: 1,
    sceneGuide: '',
    fallbackScene: '',
  },
};

/** Recetas que el plan puede elegir hoy. */
export function enabledRecipeIds(): RecipeId[] {
  return (Object.keys(RECIPES) as RecipeId[]).filter(id => RECIPES[id].enabled);
}

export function isRecipeEnabled(id: string): id is RecipeId {
  return Object.prototype.hasOwnProperty.call(RECIPES, id) && RECIPES[id as RecipeId].enabled;
}

/** Recetas activas que sirven para un formato dado. */
export function recipesForFormat(format: PlanFormat): RecipeId[] {
  return enabledRecipeIds().filter(id => RECIPES[id].formats.includes(format));
}

/** Pedido que contentFactory le hace al director de Fotos de producto para una receta. */
export function recipeToDirectorRequest(id: RecipeId): {
  shotTypes: ProductShotType[];
  style: ProductStyle;
  imageCount: { min: number; max: number };
  allowHumans: false;
} | null {
  const r = RECIPES[id];
  if (!r || !r.enabled) return null;
  return { shotTypes: r.shotTypes, style: r.style, imageCount: r.imageCount, allowHumans: false };
}

/** Texto para el plan: lista de recetas activas con su descripción. */
export function recipesForPrompt(): string {
  return enabledRecipeIds()
    .map(id => {
      const r = RECIPES[id];
      return `- "${id}" (${r.label}): ${r.description} Formatos: ${r.formats.join('/')}. Máx. ${r.maxProducts} pieza(s). El sceneBrief debe describir: ${r.sceneGuide}`;
    })
    .join('\n');
}
