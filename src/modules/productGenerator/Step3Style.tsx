import React from 'react';
import { Check } from 'lucide-react';
import { ImageSlot } from '../../components/shared/ImageSlot';
import type { StylePreset, WizardStyleState } from './wizardTypes';

interface Step3StyleProps {
  state: WizardStyleState;
  onChange: (next: WizardStyleState) => void;
}

interface PresetDef {
  id: StylePreset;
  title: string;
  desc: string;
  bgClass: string;
  imgSrc: string;
}

const PRESETS: PresetDef[] = [
  {
    id: 'minimal',
    title: 'Minimalista',
    desc: 'Fondo limpio, foco total en producto',
    bgClass: 'bg-gradient-to-br from-slate-100 to-slate-300',
    imgSrc: '/examples/minimal.jpg',
  },
  {
    id: 'premium',
    title: 'Premium',
    desc: 'Iluminación dramática, lujo discreto',
    bgClass: 'bg-gradient-to-br from-slate-800 to-slate-900',
    imgSrc: '/examples/premium.jpg',
  },
  {
    id: 'lifestyle',
    title: 'Lifestyle',
    desc: 'En contexto, situaciones reales',
    bgClass: 'bg-gradient-to-br from-amber-400 to-pink-500',
    imgSrc: '/examples/lifestyle.jpg',
  },
  {
    id: 'dark',
    title: 'Oscuro',
    desc: 'Moody, neon, alta saturación',
    bgClass: 'bg-gradient-to-br from-indigo-700 to-slate-900',
    imgSrc: '/examples/dark.jpg',
  },
  {
    id: 'natural',
    title: 'Natural',
    desc: 'Luz cálida, materiales orgánicos',
    bgClass: 'bg-gradient-to-br from-amber-100 to-amber-200',
    imgSrc: '/examples/natural.jpg',
  },
];

export const Step3Style: React.FC<Step3StyleProps> = ({ state, onChange }) => {
  const hasRef = !!state.referenceImg;

  const setRef = (v: string | null) =>
    onChange({ referenceImg: v, preset: v ? null : state.preset });

  const setPreset = (id: StylePreset) => {
    if (hasRef) return;
    onChange({ ...state, preset: id });
  };

  return (
    <div className="fade-in p-4 md:p-8">
      <div className="max-w-[720px] mb-6">
        <div className="text-[10px] font-black text-pink-600 uppercase tracking-[0.18em]">
          Paso 3 · Estilo
        </div>
        <h2 className="t-display text-[28px] md:text-[36px] text-slate-900 mt-2.5 leading-[1.05]">
          Define la <span className="text-pink-600 italic normal-case">dirección estética.</span>
        </h2>
        <p className="text-sm text-slate-500 mt-2 leading-[1.55]">
          Subí una foto que te inspire o elegí un estilo predefinido. <strong>No se pueden combinar</strong> — la referencia siempre gana.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-5">
        {/* ZONA A — Referencia */}
        <div className="md:col-span-5">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-[0.12em] mb-2.5">
            A · Subir referencia
          </div>
          <div className={`relative ${hasRef ? '' : ''}`}>
            <ImageSlot
              value={state.referenceImg}
              onChange={(v) => setRef(v)}
              slotType="style"
              aspectRatio="portrait"
              hint="Tipo Pinterest"
              iconless={false}
            />
            {hasRef && (
              <div className="absolute top-3 left-3 bg-white text-slate-900 text-[9px] font-bold tracking-[0.12em] uppercase px-2.5 py-1.5 rounded shadow-md pointer-events-none">
                ✓ Referencia activa
              </div>
            )}
            {hasRef && (
              <div className="absolute bottom-3 left-3 right-3 bg-white/95 backdrop-blur rounded-xl px-3.5 py-2.5 text-xs text-slate-700 leading-[1.5] pointer-events-none">
                <strong className="text-violet-600">Modo recrear inspiración activo.</strong> Usaremos esta imagen como guía visual.
              </div>
            )}
          </div>
          {!hasRef && (
            <p className="text-[11px] text-slate-400 mt-2.5 leading-[1.5] italic">
              Replicaremos el estilo manteniendo TU producto.
            </p>
          )}
        </div>

        {/* ZONA B — Estilos rápidos */}
        <div
          className={`md:col-span-7 transition-opacity duration-300 ${
            hasRef ? 'opacity-40 pointer-events-none' : 'opacity-100'
          }`}
        >
          <div className="flex justify-between items-baseline mb-2.5">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-[0.12em]">
              B · Estilos rápidos
            </div>
            {hasRef && (
              <div className="text-[11px] text-slate-400 italic">
                Desactivado por referencia
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
            {PRESETS.map((p) => {
              const sel = state.preset === p.id && !hasRef;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPreset(p.id)}
                  className={`bg-white rounded-[14px] overflow-hidden text-left transition-all ${
                    sel
                      ? 'border-2 border-violet-600 shadow-[0_12px_28px_rgba(124,58,237,0.18)]'
                      : 'border border-slate-200 hover:border-slate-300 hover:shadow-sm'
                  }`}
                >
                  <div className={`relative aspect-[4/3] overflow-hidden ${p.bgClass}`}>
                    <img
                      src={p.imgSrc}
                      alt={`Ejemplo ${p.title}`}
                      className="absolute inset-0 w-full h-full object-cover"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = 'none';
                      }}
                    />
                    <div className="absolute top-2 left-2 bg-white/95 backdrop-blur text-slate-900 text-[9px] font-bold tracking-[0.12em] uppercase px-2 py-0.5 rounded">
                      Ejemplo
                    </div>
                    {sel && (
                      <div className="absolute top-2 right-2 w-5.5 h-5.5 rounded-full bg-violet-600 text-white flex items-center justify-center shadow-[0_4px_10px_rgba(124,58,237,0.4)]">
                        <Check size={11} strokeWidth={3} />
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <div className="t-display text-sm text-slate-900 normal-case italic leading-tight">
                      {p.title}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1 leading-[1.45] normal-case">
                      {p.desc}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Step3Style;
