/**
 * RecipeCardCarouselMobile.tsx
 *
 * Carrusel horizontal de RecipeCard, solo para mobile (el caller lo oculta
 * en md+ con className, este componente no sabe de breakpoints). Reemplaza
 * el grid de 2 columnas en pantallas chicas.
 *
 * v2 (sep 2026, feedback real sobre v1 desplegada): las cards antes medían
 * distinto entre sí (el label de 1 línea vs 2 líneas cambiaba la altura
 * total, arreglado en RecipeCard con line-clamp fijo) y el carrusel
 * competía por espacio vertical con el bloque "necesitás" de cada card y
 * con destino/formato debajo — ambos se movieron/ocultaron para este modo
 * (ver PDStep1.tsx: destino+"necesitás" solo se muestran en desktop, en
 * mobile van al paso 2 dentro del flujo normal). Ahora usa
 * variant="fullscreen" de RecipeCard: card alta, casi toda la altura
 * disponible, aprovechando el formato vertical del teléfono en vez de una
 * card chica con mucho blanco alrededor.
 *
 * Scroll-snap nativo (sin librería) + dots que reflejan la card centrada —
 * mismo patrón que va a reusar el carrusel de resultados compartido
 * (ResultCarousel, ver PLAN_INTEGRACION.md sección 2bis) cuando se
 * construya, así que vale la pena que este primer caso quede prolijo.
 */
import React, { useRef, useState, useCallback } from 'react';
import type { PhotodumpRecipe } from '../types';
import { RECIPE_META } from '../types';
import { RecipeCard, type RecipeCardAccent } from './RecipeCard';

interface RecipeCardCarouselMobileProps {
  recipes: PhotodumpRecipe[];
  recipe:  PhotodumpRecipe;
  onRecipe: (r: PhotodumpRecipe) => void;
  icons:    Partial<Record<PhotodumpRecipe, React.ReactNode>>;
  gradients: Partial<Record<PhotodumpRecipe, string>>;
  /** Accent por receta — ej. modo libre usa 'violet' para diferenciarse (información real, no decoración). Default 'brand'. */
  accents?: Partial<Record<PhotodumpRecipe, RecipeCardAccent>>;
  /** Alto de cada card — clase Tailwind, ej. "h-[52vh]". El caller controla esto porque depende de cuánto más contenido va debajo (título, dots, separador). */
  cardHeightClass: string;
}

export const RecipeCardCarouselMobile: React.FC<RecipeCardCarouselMobileProps> = ({
  recipes, recipe, onRecipe, icons, gradients, accents, cardHeightClass,
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(() => Math.max(0, recipes.indexOf(recipe)));

  const handleScroll = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    // Card centrada = la que está más cerca del centro del viewport del track.
    const trackRect = track.getBoundingClientRect();
    const centerX = trackRect.left + trackRect.width / 2;
    let closest = 0;
    let closestDist = Infinity;
    Array.from(track.children).forEach((child, i) => {
      const r = (child as HTMLElement).getBoundingClientRect();
      const dist = Math.abs((r.left + r.width / 2) - centerX);
      if (dist < closestDist) { closestDist = dist; closest = i; }
    });
    setActiveIndex(closest);
  }, []);

  const scrollToIndex = (i: number) => {
    const track = trackRef.current;
    if (!track) return;
    const child = track.children[i] as HTMLElement | undefined;
    if (child) {
      track.scrollTo({ left: child.offsetLeft - (track.clientWidth - child.clientWidth) / 2, behavior: 'smooth' });
    }
  };

  return (
    <div className="md:hidden">
      <div
        ref={trackRef}
        onScroll={handleScroll}
        className={`flex gap-3 overflow-x-auto snap-x snap-mandatory -mx-4 px-4 scrollbar-hide ${cardHeightClass}`}
      >
        {recipes.map((r, i) => {
          const meta = RECIPE_META[r];
          return (
            <div key={r} className="snap-center shrink-0 w-[88%] h-full">
              <RecipeCard
                icon={icons[r]}
                label={meta.label}
                description={meta.description}
                selected={recipe === r}
                onSelect={() => { onRecipe(r); setActiveIndex(i); }}
                placeholderGradient={gradients[r] ?? 'from-slate-200 to-slate-300'}
                accent={accents?.[r] ?? 'brand'}
                variant="fullscreen"
              />
            </div>
          );
        })}
      </div>

      {/* Dots */}
      <div className="flex items-center justify-center gap-1.5 mt-3">
        {recipes.map((r, i) => (
          <button
            key={r}
            type="button"
            aria-label={`Ver ${RECIPE_META[r].label}`}
            onClick={() => scrollToIndex(i)}
            className={`h-1.5 rounded-full transition-all ${
              i === activeIndex ? 'w-5 bg-brand-600' : 'w-1.5 bg-slate-300'
            }`}
          />
        ))}
      </div>
    </div>
  );
};

export default RecipeCardCarouselMobile;
