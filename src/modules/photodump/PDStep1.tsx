/**
 * PDStep1.tsx — Paso 1 del wizard Photodump Fase 4
 * Selector de receta · Cantidad de imágenes · Destino
 *
 * Rediseño (sep 2026, plan de integración del nuevo prototipo — ver
 * "nuevo prototipo/PLAN_INTEGRACION.md"): las cards de receta usan
 * RecipeCard (photodump/components/) — segunda versión del componente,
 * card visual con imagen/gradiente de ejemplo protagonista en vez de una
 * fila angosta con icono, pedido explícito del usuario para que el
 * selector se vea como una card de resultado real (ver historial del
 * componente). Grid de 2-3 columnas en vez de lista vertical de una
 * columna. Sin cambiar ninguna lógica de selección ni el contrato de props
 * de este componente respecto al resto de PhotodumpModule.tsx.
 */
import React from 'react';
import {
  Package, Shirt, Sun, ShoppingBag, Clapperboard, Plane, Wand2, Check, Images, Sparkles, Martini,
} from 'lucide-react';
import {
  PhotodumpRecipe, PhotodumpDestino, RECIPE_META, DESTINO_META, RecipeRefConfig,
} from './types';
import { RecipeCard } from './components/RecipeCard';

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
  destino:   PhotodumpDestino;
  onRecipe:  (r: PhotodumpRecipe) => void;
  onDestino: (d: PhotodumpDestino) => void;
}

const RECIPES = Object.keys(RECIPE_META) as PhotodumpRecipe[];
const REGULAR_RECIPES = RECIPES.filter(r => r !== 'free' && r !== 'outfit');

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
  recipe, destino, onRecipe, onDestino,
}) => {
  const isFree = recipe === 'free';

  return (
    <div className="fade-in p-4 md:p-8">

      <div className="mb-7">
        <div className="text-[10px] font-black text-brand-600 uppercase tracking-[0.18em]">Paso 1 · Tipo de contenido</div>
        <h2 className="t-display text-[28px] md:text-[34px] text-slate-900 mt-2.5 leading-[1.05]">
          ¿Qué historia<br /><span className="text-brand-600 italic normal-case">querés contar?</span>
        </h2>
        <p className="text-sm text-slate-500 mt-2 leading-[1.55]">
          Elige el tipo de historia y la guía se adaptará a lo que necesitas.
        </p>
      </div>

      {/* Recetas — grid de cards grandes, imagen de ejemplo protagonista.
          2 columnas en mobile, 3 en desktop (pedido del usuario: "grid de
          2-3 columnas, scroll si hace falta"). */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3.5">
        {REGULAR_RECIPES.map(r => {
          const meta = RECIPE_META[r];
          return (
            <RecipeCard
              key={r}
              icon={RECIPE_ICONS[r]}
              label={meta.label}
              description={meta.description}
              need={requiredSlotsLabel(meta.refs)}
              selected={recipe === r}
              onSelect={() => onRecipe(r)}
              placeholderGradient={RECIPE_GRADIENTS[r] ?? 'from-slate-200 to-slate-300'}
            />
          );
        })}
      </div>

      {/* Separador antes de Modo libre */}
      <div className="flex items-center gap-3 my-5">
        <div className="flex-1 h-px bg-slate-200" />
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">o</span>
        <div className="flex-1 h-px bg-slate-200" />
      </div>

      {/* Modo libre — accent violeta, es información real (camino distinto), no decoración */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3.5">
        <RecipeCard
          icon={RECIPE_ICONS['free']}
          label={RECIPE_META['free'].label}
          description={RECIPE_META['free'].description}
          selected={isFree}
          onSelect={() => onRecipe('free')}
          accent="violet"
          placeholderGradient={RECIPE_GRADIENTS['free']!}
        />
      </div>

      {/* ── Destino de publicación ───────────────────────────────── */}
      <div className="mt-8">
        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-[0.12em] mb-3">
          ¿Dónde vas a publicar?
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {(Object.keys(DESTINO_META) as PhotodumpDestino[]).map(d => {
            const meta = DESTINO_META[d];
            const sel  = destino === d;
            return (
              <button
                key={d}
                type="button"
                onClick={() => onDestino(d)}
                className={`flex items-center gap-3 p-3 rounded-2xl border text-left transition-all ${
                  sel
                    ? 'border-2 border-brand-600 bg-brand-50'
                    : 'border border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <span className="text-lg flex-shrink-0">{meta.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className={`text-[12px] font-bold truncate ${sel ? 'text-brand-900' : 'text-slate-800'}`}>
                    {meta.label}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5 truncate">{meta.hint}</p>
                </div>
                <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                  sel ? 'bg-brand-600 text-white' : 'border-2 border-slate-200'
                }`}>
                  {sel && <Check size={10} strokeWidth={3} />}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tip contextual según receta */}
      {recipe !== 'free' ? (
        <div className="mt-5 bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            Qué vas a necesitar
          </p>
          <div className="flex flex-wrap gap-x-5 gap-y-1.5">
            {(Object.entries(RECIPE_META[recipe].refs) as [string, string][])
              .filter(([, v]) => v !== 'none')
              .map(([key, req]) => (
                <div key={key} className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                    req === 'required' ? 'bg-brand-500' : 'bg-slate-300'
                  }`} />
                  <span className="text-[11px] text-slate-600 capitalize">{key}</span>
                  <span className={`text-[10px] font-bold ${
                    req === 'required' ? 'text-brand-500' : 'text-slate-400'
                  }`}>
                    {req === 'required' ? 'Necesario' : 'Recomendado'}
                  </span>
                </div>
              ))}
          </div>
        </div>
      ) : (
        <div className="mt-5 bg-violet-50 border border-violet-100 rounded-2xl p-4">
          <p className="text-[12px] font-bold text-violet-900 mb-1">Modo avanzado</p>
          <p className="text-[11px] text-violet-700 leading-relaxed">
            Cada foto tiene su propia descripción y referencias. Puedes relacionar fotos para mantener la continuidad visual.
          </p>
        </div>
      )}
    </div>
  );
};

export default PDStep1;
