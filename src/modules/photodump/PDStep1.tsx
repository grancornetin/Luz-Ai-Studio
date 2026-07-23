/**
 * PDStep1.tsx — Paso 1 del wizard Photodump Fase 4
 * Selector de receta · Cantidad de imágenes · Destino
 */
import React from 'react';
import {
  Package, Shirt, Sun, ShoppingBag, Clapperboard, Plane, Wand2, Check, Images, Sparkles, Martini,
} from 'lucide-react';
import {
  PhotodumpRecipe, PhotodumpDestino, RECIPE_META, DESTINO_META,
} from './types';

const RECIPE_ICONS: Partial<Record<PhotodumpRecipe, React.ReactNode>> = {
  unboxing:     <Package    size={20} strokeWidth={1.5} />,
  outfit:       <Shirt      size={20} strokeWidth={1.5} />,
  outfit_check: <Shirt      size={20} strokeWidth={1.5} />,
  outfit_haul:  <Shirt      size={20} strokeWidth={1.5} />,
  outfit_week:  <Shirt      size={20} strokeWidth={1.5} />,
  outfit_multi_look: <Images size={20} strokeWidth={1.5} />,
  outfit_reveal_basic: <Sparkles size={20} strokeWidth={1.5} />,
  outfit_night_out: <Martini size={20} strokeWidth={1.5} />,
  day_in_life:  <Sun        size={20} strokeWidth={1.5} />,
  product_haul: <ShoppingBag size={20} strokeWidth={1.5} />,
  bts:          <Clapperboard size={20} strokeWidth={1.5} />,
  travel:       <Plane      size={20} strokeWidth={1.5} />,
  free:         <Wand2      size={20} strokeWidth={1.5} />,
};

interface PDStep1Props {
  recipe:    PhotodumpRecipe;
  destino:   PhotodumpDestino;
  onRecipe:  (r: PhotodumpRecipe) => void;
  onDestino: (d: PhotodumpDestino) => void;
}

const RECIPES = Object.keys(RECIPE_META) as PhotodumpRecipe[];
const REGULAR_RECIPES = RECIPES.filter(r => r !== 'free' && r !== 'outfit');

const PDStep1: React.FC<PDStep1Props> = ({
  recipe, destino, onRecipe, onDestino,
}) => {
  const isFree = recipe === 'free';

  return (
    <div className="fade-in p-4 md:p-8">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-9 items-start">

        {/* ── Columna izquierda ─────────────────────────────── */}
        <div className="md:col-span-7 flex flex-col gap-7">

          <div>
            <div className="text-[10px] font-black text-brand-600 uppercase tracking-[0.18em]">Paso 1 · Tipo de contenido</div>
            <h2 className="t-display text-[28px] md:text-[34px] text-slate-900 mt-2.5 leading-[1.05]">
              ¿Qué historia<br /><span className="text-brand-600 italic normal-case">querés contar?</span>
            </h2>
            <p className="text-sm text-slate-500 mt-2 leading-[1.55]">
              Elige el tipo de historia y la guía se adaptará a lo que necesitas.
            </p>
          </div>

          {/* Recetas */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-[0.12em] mb-3">
              Tipo de contenido
            </label>
            <div className="grid grid-cols-1 gap-2">
              {REGULAR_RECIPES.map(r => {
                const sel = recipe === r;
                const meta = RECIPE_META[r];
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => onRecipe(r)}
                    className={`flex items-center gap-3.5 p-3.5 rounded-2xl border text-left transition-all ${
                      sel
                        ? 'border-2 border-brand-600 bg-brand-50'
                        : 'border border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      sel ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {RECIPE_ICONS[r]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-[13px] font-bold ${sel ? 'text-brand-900' : 'text-slate-800'}`}>
                        {meta.label}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                        {meta.description}
                      </p>
                    </div>
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                      sel ? 'bg-brand-600 text-white' : 'border-2 border-slate-200'
                    }`}>
                      {sel && <Check size={10} strokeWidth={3} />}
                    </div>
                  </button>
                );
              })}

              {/* Separador antes de Modo libre */}
              <div className="flex items-center gap-3 py-1">
                <div className="flex-1 h-px bg-slate-200" />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">o</span>
                <div className="flex-1 h-px bg-slate-200" />
              </div>

              {/* Modo libre */}
              {(() => {
                const sel = recipe === 'free';
                const meta = RECIPE_META['free'];
                return (
                  <button
                    type="button"
                    onClick={() => onRecipe('free')}
                    className={`flex items-center gap-3.5 p-3.5 rounded-2xl border text-left transition-all ${
                      sel
                        ? 'border-2 border-violet-600 bg-violet-50'
                        : 'border border-slate-200 bg-white hover:border-violet-200'
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      sel ? 'bg-violet-600 text-white' : 'bg-violet-50 text-violet-500'
                    }`}>
                      {RECIPE_ICONS['free']}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-[13px] font-bold ${sel ? 'text-violet-900' : 'text-slate-800'}`}>
                        {meta.label}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                        {meta.description}
                      </p>
                    </div>
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                      sel ? 'bg-violet-600 text-white' : 'border-2 border-slate-200'
                    }`}>
                      {sel && <Check size={10} strokeWidth={3} />}
                    </div>
                  </button>
                );
              })()}
            </div>
          </div>

        </div>

        {/* ── Columna derecha: Destino ───────────────────────── */}
        <div className="md:col-span-5 flex flex-col gap-5">
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-[0.12em] mb-3">
              ¿Dónde vas a publicar?
            </label>
            <div className="flex flex-col gap-2.5">
              {(Object.keys(DESTINO_META) as PhotodumpDestino[]).map(d => {
                const meta = DESTINO_META[d];
                const sel  = destino === d;
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => onDestino(d)}
                    className={`flex items-center gap-3.5 p-3.5 rounded-2xl border text-left transition-all ${
                      sel
                        ? 'border-2 border-brand-600 bg-brand-50'
                        : 'border border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <span className="text-xl flex-shrink-0">{meta.icon}</span>
                    <div className="flex-1">
                      <p className={`text-[13px] font-bold ${sel ? 'text-brand-900' : 'text-slate-800'}`}>
                        {meta.label}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">{meta.hint}</p>
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
          {recipe !== 'free' && (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Qué vas a necesitar
              </p>
              <div className="space-y-1.5">
                {(Object.entries(RECIPE_META[recipe].refs) as [string, string][])
                  .filter(([, v]) => v !== 'none')
                  .map(([key, req]) => (
                    <div key={key} className="flex items-center gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                        req === 'required' ? 'bg-brand-500' : 'bg-slate-300'
                      }`} />
                      <span className="text-[11px] text-slate-600 capitalize">{key}</span>
                      <span className={`text-[10px] font-bold ml-auto ${
                        req === 'required' ? 'text-brand-500' : 'text-slate-400'
                      }`}>
                        {req === 'required' ? 'Necesario' : 'Recomendado'}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {recipe === 'free' && (
            <div className="bg-violet-50 border border-violet-100 rounded-2xl p-4">
              <p className="text-[12px] font-bold text-violet-900 mb-1">Modo avanzado</p>
              <p className="text-[11px] text-violet-700 leading-relaxed">
                Cada foto tiene su propia descripción y referencias. Puedes relacionar fotos para mantener la continuidad visual.
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default PDStep1;
