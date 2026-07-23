// ─────────────────────────────────────────────────────────────────
// PLANNER V3 — Catálogo de herramientas de Luz IA
//
// Este archivo tiene dos trabajos:
// 1. MODULE_ROUTES: a qué ruta de la app navega cada herramienta.
// 2. MODULE_CATALOG_FOR_AI: el texto que Gemini lee para saber qué
//    herramienta recomendar en cada tarea del plan.
//
// Nico puede editar los textos de MODULE_CATALOG_FOR_AI sin miedo:
// son solo texto, no lógica. Si un módulo cambia de nombre o gana
// funciones, actualizar aquí su descripción.
// ─────────────────────────────────────────────────────────────────

import type { ToolModule } from './plannerV3Types';

// ── Rutas de navegación ──────────────────────────────────────────
// Verificadas contra src/App.tsx (julio 2026).

export const MODULE_ROUTES: Record<ToolModule, string> = {
  product: '/productos',
  ugc: '/studio-pro',
  scene: '/clonar',
  outfit: '/outfit-extractor',
  prompt: '/prompt-studio',      // acepta ?prompt=... precargado
  photodump: '/photodump',
  campaign: '/campaign',
  none: '',                      // no navega a ningún módulo
};

export const MODULE_DISPLAY_NAMES: Record<ToolModule, string> = {
  product: 'Fotos de producto',
  ugc: 'Fotos para redes',
  scene: 'Recrear una foto',
  outfit: 'Separar prendas',
  prompt: 'Crear una imagen',
  photodump: 'Historia en fotos',
  campaign: 'Crear una campaña',
  none: 'Sin herramienta (publicación directa)',
};

// ── Catálogo para Gemini ─────────────────────────────────────────
// Este texto se inserta en el prompt de generación del plan.
// Describe cada herramienta COMO SI se lo explicaras a una
// estratega de contenido que va a decidir cuál usar en cada post.

export const MODULE_CATALOG_FOR_AI = `
HERRAMIENTAS DISPONIBLES EN LUZ IA (elige la correcta para cada tarea):

1. "product" — Product Studio
   Qué hace: convierte fotos simples del producto en fotos de catálogo
   profesional: fondo limpio, lifestyle con ambiente, detalle/macro, mockups.
   Cuándo usarla: fotos de catálogo, foto de producto destacado, foto
   lifestyle del producto en contexto, detalle de textura o material.
   Qué sube la usuaria: 1 a 4 fotos de su producto.

2. "ugc" — UGC Studio
   Qué hace: genera contenido estilo "creadora real": unboxing, review,
   producto en mano, contenido que parece hecho por una influencer.
   Cuándo usarla: contenido que debe verse humano y espontáneo,
   testimonios visuales, posts que van a usarse como anuncio.
   Qué sube la usuaria: fotos de su producto.

3. "scene" — Scene Clone
   Qué hace: la usuaria sube una foto de referencia (Pinterest, Instagram)
   y el sistema recrea ese estilo/composición con SU producto o modelo.
   Cuándo usarla: cuando el post necesita una estética específica,
   antes/después de estilo, replicar tendencias visuales.
   Qué sube la usuaria: la foto de referencia + su producto.

4. "outfit" — Outfit Extractor
   Qué hace: de una foto con ropa puesta, extrae cada prenda y genera
   renders individuales de catálogo.
   Cuándo usarla: SOLO para marcas de ropa/moda/accesorios que necesitan
   fotos de catálogo por prenda.
   Qué sube la usuaria: una foto donde se vea el outfit completo.

5. "prompt" — Prompt Studio
   Qué hace: generación libre de imágenes escribiendo la descripción.
   Cuándo usarla: contenido que no calza en los otros módulos: fondos
   para carruseles educativos, imágenes conceptuales, behind the scenes
   simulado, imágenes de ambiente sin producto.
   Nota: el plan debe entregar el prompt COMPLETO listo para pegar.

6. "photodump" — Photodump
   Qué hace: genera series de 3-8 fotos con hilo narrativo (unboxing
   completo, outfit del día, haul, semana de outfits).
   Cuándo usarla: carruseles narrativos de Instagram, contenido orgánico
   que cuenta una historia, días donde conviene publicar una serie.
   Qué sube la usuaria: fotos del producto (y modelo si aplica).

7. "campaign" — Campañas
   Qué hace: genera un kit publicitario completo de 7 días (concepto,
   imágenes coherentes, copys, hashtags).
   Cuándo usarla: SOLO para lanzamientos o promociones grandes. No usar
   para posts sueltos del día a día.

8. "none" — Sin herramienta
   Qué hace: nada que generar. La publicación se hace directo en la red.
   Cuándo usarla: stories de encuesta o pregunta, responder comentarios
   en video, repost de una clienta, foto real del proceso tomada con el
   celular. Estos posts también venden y dan descanso creativo.

REGLAS DE SELECCIÓN:
- Máximo 1 tarea "campaign" por semana, y solo si la meta es lanzar.
- "outfit" solo para categorías de ropa/moda/accesorios.
- Al menos 1 tarea "none" por semana si la frecuencia es 5 o más
  (contenido real y espontáneo mejora la confianza).
- La herramienta debe calzar con el formato: un Reel puede armarse con
  fotos de "photodump" o "ugc"; un carrusel educativo suele ser "prompt"
  o "product"; una story de encuesta es "none".
`;
