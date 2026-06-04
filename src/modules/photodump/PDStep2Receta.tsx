/**
 * PDStep2Receta.tsx — Paso 2 modo recetas
 * Brief · Referencias dinámicas según la receta elegida
 */
import React, { useState } from 'react';
import { ChevronDown, User, Package, Shirt, Layers, AlertCircle } from 'lucide-react';
import { ImageSlot } from '../../components/shared/ImageSlot';
import {
  PhotodumpRecipe, PhotodumpRefs, PhotodumpOutfitMode,
  RECIPE_META, isRefRequired,
} from './types';

// Colores por slot
const SLOT_STYLE = {
  avatar:   { label: 'text-indigo-600',  border: 'border-indigo-200',  bg: 'bg-indigo-50/40',  dot: 'bg-indigo-500'  },
  outfit:   { label: 'text-purple-600',  border: 'border-purple-200',  bg: 'bg-purple-50/30',  dot: 'bg-purple-500'  },
  producto: { label: 'text-emerald-600', border: 'border-emerald-200', bg: 'bg-emerald-50/30', dot: 'bg-emerald-500' },
  escena:   { label: 'text-blue-600',    border: 'border-blue-200',    bg: 'bg-blue-50/30',    dot: 'bg-blue-500'    },
} as const;

const SLOT_ICON = {
  avatar:   <User    size={13} strokeWidth={2} />,
  outfit:   <Shirt   size={13} strokeWidth={2} />,
  producto: <Package size={13} strokeWidth={2} />,
  escena:   <Layers  size={13} strokeWidth={2} />,
} as const;

const SLOT_LABEL: Record<string, string> = {
  avatar:   'Persona',
  outfit:   'Prendas',
  producto: 'Producto',
  escena:   'Escena',
};

interface PDStep2RecetaProps {
  recipe:      PhotodumpRecipe;
  basePrompt:  string;
  refs:        PhotodumpRefs;
  outfitMode:  PhotodumpOutfitMode;
  onPrompt:    (v: string) => void;
  onRefs:      (r: PhotodumpRefs) => void;
  onOutfitMode:(m: PhotodumpOutfitMode) => void;
}

const PDStep2Receta: React.FC<PDStep2RecetaProps> = ({
  recipe, basePrompt, refs, outfitMode, onPrompt, onRefs, onOutfitMode,
}) => {
  const [openSlot, setOpenSlot] = useState<string | null>(null);
  const toggle = (key: string) => setOpenSlot(p => p === key ? null : key);

  const meta    = RECIPE_META[recipe];
  const refKeys = (Object.keys(meta.refs) as (keyof typeof meta.refs)[])
    .filter(k => meta.refs[k] !== 'none');

  // ── Helpers para leer/escribir refs por slot key ─────────────
  const getSlotImages = (key: string): (string | null)[] => {
    if (key === 'avatar')   return [refs.avatarRef, refs.bodyRef ?? null].filter((_, i) => i === 0 || refs.bodyRef !== undefined) as (string | null)[];
    if (key === 'outfit')   return [refs.outfitRef, ...(refs.outfitRefs ?? [])];
    if (key === 'producto') return [refs.productRef, ...(refs.productRefs ?? [])];
    if (key === 'escena')   return [refs.sceneRef, ...(refs.sceneRefs ?? [])];
    return [];
  };

  const getSlotMax = (key: string): number => {
    if (key === 'avatar')   return 2;
    if (key === 'outfit')   return 4;
    if (key === 'producto') return 3;
    if (key === 'escena')   return 3;
    return 1;
  };

  const handleSlotChange = (key: string, index: number, value: string | null) => {
    if (key === 'avatar') {
      if (index === 0) onRefs({ ...refs, avatarRef: value });
      else             onRefs({ ...refs, bodyRef: value });
      return;
    }
    if (key === 'outfit') {
      if (index === 0) {
        onRefs({ ...refs, outfitRef: value, outfitMode: value ? 'upload' : 'generate' });
      } else {
        const arr = [...(refs.outfitRefs ?? [null, null, null])];
        arr[index - 1] = value;
        onRefs({ ...refs, outfitRefs: arr });
      }
      return;
    }
    if (key === 'producto') {
      if (index === 0) {
        onRefs({ ...refs, productRef: value });
      } else {
        const arr = [...(refs.productRefs ?? [null, null])];
        arr[index - 1] = value;
        onRefs({ ...refs, productRefs: arr });
      }
      return;
    }
    if (key === 'escena') {
      if (index === 0) {
        onRefs({ ...refs, sceneRef: value });
      } else {
        const arr = [...(refs.sceneRefs ?? [null, null])];
        arr[index - 1] = value;
        onRefs({ ...refs, sceneRefs: arr });
      }
    }
  };

  const getSlotFilled = (key: string): number =>
    getSlotImages(key).filter(Boolean).length;

  const slotSubLabels: Record<string, string[]> = {
    avatar:   ['Cara / identidad', 'Cuerpo (opcional)'],
    outfit:   ['Prenda principal', 'Prenda 2', 'Prenda 3', 'Prenda 4'],
    producto: ['Principal', 'Ángulo 2', 'Ángulo 3'],
    escena:   ['Principal', 'Lugar 2', 'Lugar 3'],
  };

  return (
    <div className="fade-in p-4 md:p-8">
      <div className="grid grid-cols-1 md:grid-cols-[1fr_300px] gap-6 md:gap-8 items-start">

        {/* ── Columna principal ─────────────────────────────── */}
        <div className="flex flex-col gap-6">

          <div>
            <div className="text-[10px] font-black text-brand-600 uppercase tracking-[0.18em]">Paso 2 · Brief</div>
            <h2 className="t-display text-[28px] md:text-[34px] text-slate-900 mt-2.5 leading-[1.05]">
              Contanos la<br /><span className="text-brand-600 italic normal-case">historia del set</span>
            </h2>
            <p className="text-sm text-slate-500 mt-2 leading-[1.55]">
              Describí el sujeto, el contexto o el momento. Las referencias refuerzan la identidad visual.
            </p>
          </div>

          {/* Brief */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-[0.12em] mb-2">
              Contexto base <span className="text-brand-600">*</span>
            </label>
            <textarea
              value={basePrompt}
              onChange={e => onPrompt(e.target.value)}
              placeholder={
                recipe === 'outfit'      ? 'Ej: Haul de otoño, jeans wide leg y sweater oversize en Palermo, tarde soleada...' :
                recipe === 'unboxing'    ? 'Ej: Caja de mi nueva crema de vitamina C, packaging cuidado con papel manteca y tarjeta...' :
                recipe === 'day_in_life' ? 'Ej: Mañana de domingo tranquila en casa, con mi café y mi set de skincare favorito...' :
                recipe === 'launch'      ? 'Ej: Primer lanzamiento de mi vela de jazmín, edición limitada, packaging artesanal...' :
                recipe === 'bts'         ? 'Ej: Preparando los pedidos de la semana, papel de seda rosado y stickers personalizados...' :
                recipe === 'travel'      ? 'Ej: Fin de semana en Montevideo, el puerto, los cafés y la rambla al atardecer...' :
                'Describí el contexto central del set...'
              }
              rows={4}
              autoComplete="off"
              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3.5 text-[15px] text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 transition-all resize-none leading-relaxed"
            />
            <p className="text-[11px] text-slate-400 mt-1.5">
              Cuanto más detalle des, más específico será el resultado visual.
            </p>
          </div>

          {/* Referencias dinámicas */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-[0.12em] mb-2">
              Referencias de identidad
            </label>

            <div className="space-y-2">
              {refKeys.map(key => {
                const required = isRefRequired(recipe, key);
                const style    = SLOT_STYLE[key as keyof typeof SLOT_STYLE];
                const isOpen   = openSlot === key;
                const filled   = getSlotFilled(key);
                const max      = getSlotMax(key);
                const subLabels = slotSubLabels[key] ?? [];
                const slotType = key === 'avatar' ? 'person' : key === 'outfit' ? 'outfit' : key === 'producto' ? 'product' : 'scene';

                return (
                  <div
                    key={key}
                    className={`border rounded-2xl overflow-hidden transition-all ${
                      isOpen
                        ? `${style.border} ${style.bg}`
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    {/* Header acordeón */}
                    <button
                      type="button"
                      onClick={() => toggle(key)}
                      className="w-full flex items-center gap-3 px-3.5 py-2.5 text-left"
                    >
                      <span className={`${style.label} flex-shrink-0`}>
                        {SLOT_ICON[key as keyof typeof SLOT_ICON]}
                      </span>
                      <span className="text-[10px] font-black text-slate-600 uppercase tracking-[0.12em] flex-1">
                        {SLOT_LABEL[key]}
                      </span>

                      {/* Badge con estado */}
                      {filled > 0 && !isOpen && (
                        <span className={`text-[9px] font-bold ${style.label}`}>
                          {filled} foto{filled > 1 ? 's' : ''}
                        </span>
                      )}
                      {filled === 0 && !isOpen && (
                        <span className="text-[9px] text-slate-400 flex items-center gap-1">
                          {required && <AlertCircle size={9} className="text-brand-400" />}
                          {required ? 'Necesario' : 'Recomendado'}
                        </span>
                      )}

                      <ChevronDown
                        size={14}
                        className={`text-slate-400 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`}
                      />
                    </button>

                    {/* Contenido expandido */}
                    {isOpen && (
                      <div className="px-3.5 pb-3.5 space-y-3">
                        <div className={`grid gap-2 ${max <= 2 ? 'grid-cols-2' : 'grid-cols-3 md:grid-cols-4'}`}>
                          {Array.from({ length: max }).map((_, i) => {
                            const images = getSlotImages(key);
                            const isFirst   = i === 0;
                            const isDisabled = i > 0 && !images[0];
                            return (
                              <div key={i} className="flex flex-col gap-1">
                                <p className={`text-[9px] font-bold uppercase tracking-wider ${
                                  isFirst ? style.label : 'text-slate-400'
                                }`}>
                                  {subLabels[i] ?? `Foto ${i + 1}`}
                                </p>
                                <ImageSlot
                                  value={images[i] ?? null}
                                  onChange={v => handleSlotChange(key, i, v)}
                                  slotType={slotType as any}
                                  aspectRatio="square"
                                  disabled={isDisabled}
                                  iconless
                                />
                              </div>
                            );
                          })}
                        </div>

                        {/* Nota de ayuda por slot */}
                        <p className="text-[10px] text-slate-400 leading-snug">
                          {key === 'avatar'   && 'La foto del rostro ancla la identidad facial en todas las imágenes.'}
                          {key === 'outfit'   && 'Subí hasta 4 prendas. Cada una se respeta fielmente en el set.'}
                          {key === 'producto' && 'Subí hasta 3 ángulos del mismo producto para mejor fidelidad.'}
                          {key === 'escena'   && 'La escena principal define la ambientación del set completo.'}
                        </p>

                        <button
                          type="button"
                          onClick={() => toggle(key)}
                          className="w-full text-[10px] text-slate-400 hover:text-slate-600 py-1 transition-colors"
                        >
                          Minimizar ↑
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Panel lateral ─────────────────────────────────── */}
        <div className="md:sticky md:top-4 space-y-3">

          {/* Receta activa */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
              Receta seleccionada
            </p>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-brand-50 rounded-xl flex items-center justify-center text-brand-600">
                {/* icon inline — lo toma de meta */}
                <Package size={15} strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-[13px] font-bold text-slate-800">{meta.label}</p>
                <p className="text-[11px] text-slate-500">{meta.description}</p>
              </div>
            </div>
          </div>

          {/* Checklist de refs */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Referencias del set
            </p>
            {refKeys.map(key => {
              const required = isRefRequired(recipe, key);
              const filled   = getSlotFilled(key);
              const ok       = filled > 0;
              return (
                <div key={key} className="flex items-center gap-2">
                  <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 border ${
                    ok
                      ? 'bg-emerald-500 border-emerald-500 text-white'
                      : required
                        ? 'border-brand-400 bg-white'
                        : 'border-slate-300 bg-white'
                  }`}>
                    {ok && (
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-600 flex-1">{SLOT_LABEL[key]}</span>
                  <span className={`text-[10px] font-bold ${
                    ok ? 'text-emerald-500' : required ? 'text-brand-400' : 'text-slate-400'
                  }`}>
                    {ok ? `${filled} foto${filled > 1 ? 's' : ''}` : required ? 'Necesario' : 'Opcional'}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="bg-violet-50 border border-violet-100 rounded-xl px-3 py-2.5 text-[11px] text-violet-800 leading-[1.55]">
            <strong>Sin referencias</strong> también funciona — el resultado será más genérico pero igualmente válido.
          </div>
        </div>

      </div>
    </div>
  );
};

export default PDStep2Receta;
