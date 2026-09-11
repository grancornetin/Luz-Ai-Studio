/**
 * seedPreviews.ts — Imágenes semilla por receta (sep 2026)
 *
 * Antes de que un usuario tenga sus propios sets generados, las cards del
 * paso 1 mostraban solo el gradiente placeholder (ver RecipeCard.tsx).
 * Pedido del usuario: "no me gusta que tengan solo gradientes, quiero
 * definir unas de base por defecto, luego se reemplazan con las de los
 * usuarios". Estas imágenes son GLOBALES (mismas para todos los usuarios,
 * curadas por el dueño del producto) — no confundir con `previewsByRecipe`
 * en PhotodumpModule.tsx, que es la biblioteca privada de cada usuario y
 * siempre tiene prioridad sobre esto.
 *
 * Cómo se cargan: una carpeta por receta en assets/recipe-previews/<recipe>/,
 * el usuario pega ahí los archivos (cualquier nombre, .webp/.png/.jpg) y
 * import.meta.glob los levanta automáticamente — no hace falta tocar este
 * archivo ni ningún import a mano cada vez que agrega una imagen nueva.
 * Carpeta vacía = esa receta sigue con gradiente hasta que se agregue algo.
 *
 * Formato: se pidió explícitamente NO tocar el aspect ratio de las cards
 * todavía (queda para cuando se retome el rediseño general, ver
 * PROMPT_REDISENO_SHELL_PWA.md) — estas imágenes se muestran tal cual con
 * el aspect ratio actual de cada variant (4:3 desktop, fullscreen mobile).
 *
 * Las imágenes fuente que trae el usuario se optimizan a webp calidad 82
 * antes de commitear (conversión manual puntual, no hay pipeline
 * automático de compresión en el repo) — PNG de resultado real pesa
 * 1-1.6MB, tras convertir baja a 30-90KB.
 */
import type { PhotodumpRecipe } from './types';

// Vite: import.meta.glob con eager+url devuelve { [path]: urlString }
const modules = import.meta.glob(
  './assets/recipe-previews/*/*.{png,jpg,jpeg,webp}',
  { eager: true, query: '?url', import: 'default' }
) as Record<string, string>;

const MAX_PER_RECIPE = 3;

function buildSeedPreviews(): Partial<Record<PhotodumpRecipe, string[]>> {
  const byRecipe: Partial<Record<PhotodumpRecipe, string[]>> = {};
  const sortedPaths = Object.keys(modules).sort(); // orden estable (alfabético por nombre de archivo)

  for (const path of sortedPaths) {
    // path: "./assets/recipe-previews/<recipe>/<file>.webp"
    const match = path.match(/recipe-previews\/([^/]+)\//);
    if (!match) continue;
    const recipe = match[1] as PhotodumpRecipe;
    const existing = byRecipe[recipe] ?? [];
    if (existing.length >= MAX_PER_RECIPE) continue;
    byRecipe[recipe] = [...existing, modules[path]];
  }

  return byRecipe;
}

export const SEED_PREVIEWS_BY_RECIPE = buildSeedPreviews();
