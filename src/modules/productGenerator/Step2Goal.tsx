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
  tagline: string;
  desc: string;
  badge?: string;
  // Visual preview
  bgGradient: string;
  accentColor: string;
  mockBg: string;       // fondo simulado en la miniatura
  mockLight: string;    // descripción corta del tipo de luz
  mockMood: string;     // mood/ambiente
  aspectNote: string;   // aspect ratio que produce
  exampleLabel: string; // etiqueta del escenario visual
}

const GOALS: GoalDef[] = [
  {
    id: 'social',
    title: 'Redes sociales',
    tagline: 'Instagram · TikTok · Publicaciones para redes',
    desc: 'Imágenes con personalidad y contexto cotidiano que llaman la atención al navegar.',
    badge: 'Más popular',
    bgGradient: 'from-violet-500 via-pink-500 to-rose-400',
    accentColor: 'violet',
    mockBg: 'Escena real con vida',
    mockLight: 'Luz natural de ventana',
    mockMood: 'Cálido, orgánico, atractivo',
    aspectNote: '4:5 vertical',
    exampleLabel: 'Foto en uso',
  },
  {
    id: 'ecommerce',
    title: 'Tienda online',
    tagline: 'Tienda online · Mercado Libre · Shopify',
    desc: 'Fondo neutro, producto centrado y claro. El comprador ve exactamente lo que recibe.',
    bgGradient: 'from-slate-200 to-slate-400',
    accentColor: 'slate',
    mockBg: 'Fondo blanco / neutro',
    mockLight: 'Luz difusa de estudio',
    mockMood: 'Limpio, comercial, preciso',
    aspectNote: '1:1 cuadrado',
    exampleLabel: 'Estudio limpio',
  },
  {
    id: 'technical_catalog',
    title: 'Catálogo técnico',
    tagline: 'B2B · Mayoristas · PDF de catálogo',
    desc: 'Múltiples ángulos, vistas técnicas y detalles. Para documentación profesional y ventas B2B.',
    bgGradient: 'from-slate-700 to-slate-950',
    accentColor: 'slate',
    mockBg: 'Neutro con mínima distracción',
    mockLight: 'Luz controlada y uniforme',
    mockMood: 'Técnico, documentado, claro',
    aspectNote: '1:1 — múltiples ángulos',
    exampleLabel: 'Vistas técnicas',
  },
  {
    id: 'ads',
    title: 'Publicidad',
    tagline: 'Meta Ads · Google · Campañas pagas',
    desc: 'Composiciones cinemáticas de alto impacto. Listas para campañas que compiten por atención.',
    bgGradient: 'from-amber-400 via-orange-500 to-pink-600',
    accentColor: 'amber',
    mockBg: 'Set de campaña premium',
    mockLight: 'Luz dramática de alto contraste',
    mockMood: 'Dinámico y llamativo',
    aspectNote: '1:1 — alto impacto',
    exampleLabel: 'Campaña premium',
  },
];

const ACCENT_RING: Record<string, string> = {
  violet: 'border-violet-600 shadow-[0_16px_40px_rgba(124,58,237,0.18)]',
  slate:  'border-violet-600 shadow-[0_16px_40px_rgba(124,58,237,0.18)]',
  amber:  'border-violet-600 shadow-[0_16px_40px_rgba(124,58,237,0.18)]',
};

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
          Esto define la composición, el encuadre y el tipo de luz. Cada destino produce un resultado diferente.
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
              className={`relative bg-white rounded-[18px] p-0 text-left overflow-hidden transition-all border-2 ${
                sel
                  ? (ACCENT_RING[g.accentColor] || ACCENT_RING.violet)
                  : 'border-slate-100 shadow-sm hover:border-slate-200 hover:shadow-md'
              }`}
            >
              {/* ── Preview band ───────────────────────────────────── */}
              <div className={`relative h-[130px] md:h-[150px] bg-gradient-to-br ${g.bgGradient} overflow-hidden`}>
                {/* Simulación de escenario: 3 bloques que representan fondo / luz / producto */}
                <div className="absolute inset-0 flex items-end justify-center pb-3 gap-2.5">
                  {/* producto simulado */}
                  <div className="w-[52px] h-[68px] rounded-lg bg-white/25 backdrop-blur-sm border border-white/40 shadow-[0_8px_20px_rgba(0,0,0,0.25)] flex items-center justify-center">
                    <div className="w-6 h-8 rounded-sm bg-white/60" />
                  </div>
                  {/* sombra de contacto */}
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 w-[52px] h-1.5 bg-black/20 rounded-full blur-sm" />
                </div>

                {/* mood label */}
                <div className="absolute top-3 left-3 bg-black/30 backdrop-blur text-white text-[9px] font-bold tracking-[0.1em] uppercase px-2 py-1 rounded-full">
                  {g.exampleLabel}
                </div>

                {/* aspect ratio pill */}
                <div className="absolute top-3 right-3 bg-white/90 text-slate-700 text-[9px] font-bold tracking-[0.08em] uppercase px-2 py-1 rounded-full">
                  {g.aspectNote}
                </div>

                {g.badge && (
                  <div className="absolute bottom-3 left-3 bg-white text-violet-700 text-[9px] font-black tracking-[0.1em] uppercase px-2 py-1 rounded-full shadow">
                    {g.badge}
                  </div>
                )}

                {sel && (
                  <div className="absolute inset-0 bg-violet-600/10 pointer-events-none" />
                )}
              </div>

              {/* ── Body ───────────────────────────────────────────── */}
              <div className="p-4 md:p-5">
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div>
                    <div className="t-display text-[17px] md:text-[19px] text-slate-900 leading-tight normal-case italic">
                      {g.title}
                    </div>
                    <div className="text-[10px] text-slate-400 font-medium mt-0.5 normal-case tracking-[0.04em]">
                      {g.tagline}
                    </div>
                  </div>
                  <div
                    className={`w-5.5 h-5.5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${
                      sel ? 'bg-violet-600 text-white' : 'bg-white border-2 border-slate-200 text-transparent'
                    }`}
                  >
                    {sel && <Check size={11} strokeWidth={3} />}
                  </div>
                </div>

                <div className="text-[12.5px] text-slate-500 leading-[1.5] normal-case mb-3">
                  {g.desc}
                </div>

                {/* Tres píldoras: fondo · luz · mood */}
                <div className="flex flex-wrap gap-1.5">
                  <span className="inline-flex items-center gap-1 bg-slate-50 border border-slate-100 text-slate-500 text-[10px] font-medium px-2 py-0.5 rounded-full normal-case">
                    <span className="text-[8px] opacity-60">▣</span> {g.mockBg}
                  </span>
                  <span className="inline-flex items-center gap-1 bg-slate-50 border border-slate-100 text-slate-500 text-[10px] font-medium px-2 py-0.5 rounded-full normal-case">
                    <span className="text-[8px] opacity-60">◎</span> {g.mockLight}
                  </span>
                  <span className="inline-flex items-center gap-1 bg-slate-50 border border-slate-100 text-slate-500 text-[10px] font-medium px-2 py-0.5 rounded-full normal-case">
                    <span className="text-[8px] opacity-60">◐</span> {g.mockMood}
                  </span>
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
