/**
 * PDStep1.tsx — Paso 1 del wizard Photodump Fase 4
 * Selector de receta
 *
 * Rediseño (sep 2026, plan de integración del nuevo prototipo — ver
 * "nuevo prototipo/PLAN_INTEGRACION.md"): las cards de receta usan
 * RecipeCard (photodump/components/) — segunda versión del componente,
 * card visual con imagen/gradiente de ejemplo protagonista en vez de una
 * fila angosta con icono, pedido explícito del usuario para que el
 * selector se vea como una card de resultado real. Grid en desktop,
 * carrusel horizontal fullscreen en mobile.
 *
 * v4 — auto-avance + destino removido (sep 2026, pedido directo del
 * usuario: "seria mejor tocar la receta y que automaticamente avance, es
 * un flujo mas intuitivo y agil"). El paso 1 ahora es SOLO elegir receta —
 * tocar una card avanza directo al paso 2 (el auto-avance vive en
 * PhotodumpModule.tsx: onRecipe hace setRecipe + setStep(2)). El selector
 * de destino/formato que vivía acá se sacó por completo: si siguiera
 * visible, auto-avanzar se lo cortaría a mitad de camino al usuario.
 * destino queda con su valor por default ('feed') hasta que la Fase 2 del
 * plan lo reincorpore como control real en el paso 2 — PDStep1 ya no lo
 * recibe ni lo usa.
 *
 * v5 — previews reales (sep 2026): las cards ya no dependen solo del
 * gradiente placeholder. PhotodumpModule.tsx arma `previews` agrupando la
 * biblioteca real del usuario (`sets`, ya cargada al montar el módulo) por
 * receta y pasa las imageUrl más recientes de cada una. RecipeCard hace el
 * resto (usa la imagen real si existe, si no cae al gradiente) — cero
 * cambios de estructura, solo la prop que ya estaba prevista.
 */
import React from 'react';
import {
  Package, Shirt, Sun, ShoppingBag, Clapperboard, Plane, Wand2, Images, Sparkles, Martini,
} from 'lucide-react';
import {
  PhotodumpRecipe, RECIPE_META, RecipeRefConfig,
} from './types';
import { RecipeCard } from './components/RecipeCard';
import { RecipeCardCarouselMobile } from './components/RecipeCardCarouselMobile';

const RECIPE_ICONS: Partial<Record<PhotodumpRecipe, React.ReactNode>> = {
  unboxing:     <Package    size={16} strokeWidth={1.5} />,
  outfit:       <Shirt      size={16} strokeWidth={1.5} />,
  outfit_check: <Shirt      size={16} strokeWidth={1.5} />,
  outfit_haul:  <Shirt      size={16} strokeWidth={1.5} />,
  outfit_week:  <Shirt      size={16} strokeWidth={1.5} />,
  outfit_multi_look: <Images size={16} strokeWidth={1.5} />,
  outfit_reveal_basic: <Sparkles size={16} strokeWidth={1.5} />,
  outfit_night_out: <Martini size={16} strokeWidth={1.5} />,
  day_in_life:  <Sun        size={16} strokeWidth={1.5} />,
  product_haul: <ShoppingBag size={16} strokeWidth={1.5} />,
  bts:          <Clapperboard size={16} strokeWidth={1.5} />,
  travel:       <Plane      size={16} strokeWidth={1.5} />,
  free:         <Wand2      size={16} strokeWidth={1.5} />,
};

// Gradiente placeholder por receta — hasta que existan sets reales
// generados para mostrar (pedido explícito del usuario: "place holders de
// diferentes gradientes de momento, luego generamos y yo te traigo el set
// para cada layout"). Un gradiente distinto por receta para que se puedan
// diferenciar entre sí de un vistazo, incluso sin imagen real todavía.
const RECIPE_GRADIENTS: Partial<Record<PhotodumpRecipe, string>> = {
  unboxing:            'from-amber-200 via-orange-200 to-rose-200',
  outfit:              'from-fuchsia-200 via-pink-200 to-rose-200',
  outfit_check:        'from-violet-200 via-fuchsia-200 to-pink-200',
  outfit_haul:         'from-sky-200 via-cyan-200 to-teal-200',
  outfit_week:         'from-lime-200 via-emerald-200 to-teal-200',
  outfit_multi_look:   'from-indigo-200 via-violet-200 to-fuchsia-200',
  outfit_reveal_basic: 'from-rose-200 via-red-200 to-orange-200',
  outfit_night_out:    'from-slate-500 via-indigo-500 to-violet-600',
  day_in_life:         'from-yellow-200 via-amber-200 to-orange-200',
  product_haul:        'from-teal-200 via-cyan-200 to-sky-200',
  bts:                 'from-slate-300 via-slate-400 to-slate-500',
  travel:              'from-sky-200 via-blue-200 to-indigo-200',
  free:                'from-violet-200 via-purple-200 to-fuchsia-200',
};

interface PDStep1Props {
  recipe:    PhotodumpRecipe;
  onRecipe:  (r: PhotodumpRecipe) => void;
  /** Imágenes reales de sets ya generados por el usuario, agrupadas por receta — reemplazan el gradiente placeholder cuando existen (PhotodumpModule.tsx las arma desde `sets`, su biblioteca real). */
  previews?: Partial<Record<PhotodumpRecipe, string[]>>;
}

const RECIPES = Object.keys(RECIPE_META) as PhotodumpRecipe[];
const REGULAR_RECIPES = RECIPES.filter(r => r !== 'free' && r !== 'outfit');
// Modo libre va AL FINAL de la misma galería, no en una fila separada
// (sep 2026, feedback real: "pienso que debería estar al final de la lista
// de recetas en la misma galería" — antes tenía separador "o" + bloque
// aparte, forzando una segunda fila de scroll/swipe solo para 1 card).
const ALL_RECIPES = [...REGULAR_RECIPES, 'free' as const];

// Etiqueta corta de "qué necesitás" para la card — mismo dato que ya existe
// en RECIPE_META[r].refs (usado también en el tip contextual de abajo),
// resumido a los slots 'required' en una sola línea (patrón del prototipo:
// "NECESITAS: Tu foto · Look"). No inventa datos nuevos, solo los resume.
const SLOT_LABELS: Record<keyof RecipeRefConfig, string> = {
  avatar:         'Tu foto',
  outfit:         'Look',
  accesorios:     'Accesorios',
  producto:       'Producto',
  empaque:        'Packaging',
  escena:         'Escena',
  escena_prueba:  'Lugar de prueba',
  escena_destino: 'Destino',
};

function requiredSlotsLabel(refs: RecipeRefConfig): string {
  return (Object.entries(refs) as [keyof RecipeRefConfig, string][])
    .filter(([, req]) => req === 'required')
    .map(([key]) => SLOT_LABELS[key])
    .join(' · ');
}

const PDStep1: React.FC<PDStep1Props> = ({
  recipe, onRecipe, previews,
}) => {
  return (
    <div className="fade-in p-3 md:p-6 md:h-auto flex flex-col">

      <div className="mb-3 md:mb-4 flex-shrink-0">
        <div className="text-[9px] md:text-[10px] font-black text-brand-600 uppercase tracking-[0.18em]">Paso 1 · Tipo de contenido</div>
        <h2 className="t-display text-[19px] md:text-[26px] text-slate-900 mt-1 md:mt-1.5 leading-[1.1]">
          ¿Qué historia <span className="text-brand-600 italic normal-case">querés contar?</span>
        </h2>
      </div>

      {/* Recetas — card de resultado real, imagen/gradiente protagonista.
          Modo libre va AL FINAL de esta misma galería, no en fila aparte
          (feedback real: "debería estar al final de la lista de recetas en
          la misma galería"). Mobile: carrusel horizontal fullscreen (1 card
          ocupando casi toda la altura disponible) + dots — aprovecha el
          formato vertical del teléfono en vez de una card chica con blanco
          alrededor. Desktop (md+): grid de 4-5 columnas con cards
          compactas apaisadas — bajado de 3 columnas y de aspect-[4/5] a
          4/3 tras feedback real de scroll vertical excesivo. */}
      <RecipeCardCarouselMobile
        recipes={ALL_RECIPES}
        recipe={recipe}
        onRecipe={onRecipe}
        icons={RECIPE_ICONS}
        gradients={RECIPE_GRADIENTS}
        accents={{ free: 'violet' }}
        previews={previews}
        cardHeightClass="h-[65dvh] min-h-[380px] max-h-[560px]"
      />
      <div className="hidden md:grid grid-cols-4 xl:grid-cols-5 gap-2.5">
        {ALL_RECIPES.map(r => {
          const meta = RECIPE_META[r];
          return (
            <RecipeCard
              key={r}
              icon={RECIPE_ICONS[r]}
              label={meta.label}
              description={meta.description}
              need={r === 'free' ? undefined : requiredSlotsLabel(meta.refs)}
              selected={recipe === r}
              onSelect={() => onRecipe(r)}
              placeholderGradient={RECIPE_GRADIENTS[r] ?? 'from-slate-200 to-slate-300'}
              previewImages={previews?.[r]}
              accent={r === 'free' ? 'violet' : 'brand'}
            />
          );
        })}
      </div>

    </div>
  );
};

export default PDStep1;
