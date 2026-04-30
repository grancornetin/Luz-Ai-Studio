import React from 'react';
import { Check } from 'lucide-react';
import type { Goal } from './wizardTypes';

interface Step2GoalProps {
  goal: Goal | null;
  onChange: (goal: Goal) => void;
}

interface GoalDef {
  id: Goal;
  title: string;
  desc: string;
  badge?: string;
  bgClass: string;
  icons: string[];
}

const GOALS: GoalDef[] = [
  {
    id: 'social',
    title: 'Redes sociales',
    desc: 'Imágenes con personalidad para Instagram, TikTok, posts orgánicos.',
    badge: 'Más popular',
    bgClass: 'bg-gradient-to-br from-violet-600 to-pink-600',
    icons: ['📱', '✨', '🎯'],
  },
  {
    id: 'ecommerce',
    title: 'Ecommerce',
    desc: 'Fondo neutro, producto centrado, claro tal como es. Listo para tu tienda.',
    bgClass: 'bg-gradient-to-br from-slate-100 to-slate-300',
    icons: ['🛍', '💎', '📦'],
  },
  {
    id: 'technical_catalog',
    title: 'Catálogo técnico',
    desc: 'Múltiples ángulos, fichas, variantes — para B2B, mayoristas o catálogos PDF.',
    bgClass: 'bg-gradient-to-br from-slate-800 to-slate-900',
    icons: ['📐', '⊞', '◰'],
  },
  {
    id: 'ads',
    title: 'Publicidad',
    desc: 'Composiciones cinemáticas, alto contraste, listas para campañas pagas.',
    bgClass: 'bg-gradient-to-br from-amber-500 to-pink-600',
    icons: ['🎬', '💥', '✦'],
  },
];

export const Step2Goal: React.FC<Step2GoalProps> = ({ goal, onChange }) => {
  return (
    <div className="fade-in p-4 md:p-8">
      <div className="max-w-[720px] mb-6">
        <div className="text-[10px] font-black text-pink-600 uppercase tracking-[0.18em]">
          Paso 2 · Objetivo del contenido
        </div>
        <h2 className="t-display text-[28px] md:text-[36px] text-slate-900 mt-2.5 leading-[1.05]">
          ¿Para qué <span className="text-pink-600 italic normal-case">las vas a usar?</span>
        </h2>
        <p className="text-sm text-slate-500 mt-2 leading-[1.55]">
          Esto define la composición, fondo, encuadre y luz. Elegí una sola opción — siempre podés volver.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
        {GOALS.map((g) => {
          const sel = goal === g.id;
          return (
            <button
              key={g.id}
              type="button"
              onClick={() => onChange(g.id)}
              className={`relative bg-white rounded-[18px] p-0 text-left overflow-hidden transition-all border ${
                sel
                  ? 'border-2 border-violet-600 shadow-[0_16px_40px_rgba(124,58,237,0.18)]'
                  : 'border border-slate-200 shadow-sm hover:border-slate-300 hover:shadow-md'
              }`}
            >
              {/* preview band */}
              <div
                className={`relative h-[110px] md:h-[140px] flex items-center justify-center gap-4 ${g.bgClass}`}
              >
                {g.icons.map((p, i) => (
                  <span
                    key={i}
                    className="text-[32px] md:text-[40px] opacity-90"
                    style={{ filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.2))' }}
                  >
                    {p}
                  </span>
                ))}
                {g.badge && (
                  <div className="absolute top-3 right-3 bg-white text-slate-900 text-[9px] font-bold tracking-[0.1em] uppercase px-2 py-1 rounded">
                    {g.badge}
                  </div>
                )}
              </div>
              {/* body */}
              <div className="p-4 md:p-5 flex items-start gap-3.5">
                <div className="flex-1">
                  <div className="t-display text-[18px] md:text-[20px] text-slate-900 leading-tight mb-1.5 normal-case italic">
                    {g.title}
                  </div>
                  <div className="text-[13px] text-slate-500 leading-[1.5] normal-case">
                    {g.desc}
                  </div>
                </div>
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                    sel
                      ? 'bg-violet-600 text-white'
                      : 'bg-white border-2 border-slate-200 text-transparent'
                  }`}
                >
                  {sel && <Check size={13} strokeWidth={3} />}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default Step2Goal;
