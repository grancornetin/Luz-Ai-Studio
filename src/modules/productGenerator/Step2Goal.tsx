import React, { useRef, useState, useCallback } from 'react';
import { Check, Layout, Sun, Palette } from 'lucide-react';
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
  violet: 'border-brand-600 shadow-[0_16px_40px_rgba(247,44,91,0.18)]',
  slate:  'border-brand-600 shadow-[0_16px_40px_rgba(247,44,91,0.18)]',
  amber:  'border-brand-600 shadow-[0_16px_40px_rgba(247,44,91,0.18)]',
};

export const Step2Goal: React.FC<Step2GoalProps> = ({ goal, onChange }) => {
  // Carrusel mobile: swipe horizontal con scroll-snap + dots — mismo patrón
  // que RecipeCardCarouselMobile de Photodump, para aprovechar la pantalla
  // vertical del teléfono en vez de un grid de cards chicas apiladas.
  const trackRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(() => Math.max(0, GOALS.findIndex(g => g.id === goal)));

  const handleScroll = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
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
    <div className="fade-in p-4 md:p-8 flex flex-col md:block md:min-h-0" style={{ minHeight: 0 }}>
      <div className="max-w-[720px] mb-4 md:mb-6 flex-shrink-0">
        <div className="hidden md:block text-[10px] font-black text-brand-600 uppercase tracking-[0.18em]">
          Paso 2 · Objetivo del contenido
        </div>
        <h2 className="t-display text-[24px] md:text-[36px] text-slate-900 mt-2.5 leading-[1.05]">
          ¿Para qué <span className="text-brand-600 italic normal-case">las vas a usar?</span>
        </h2>
        <p className="text-sm text-slate-500 mt-2 leading-[1.55]">
          <span className="md:hidden">Deslizá para ver cada opción. </span>
          Esto define la composición, el encuadre y el tipo de luz.
        </p>
      </div>

      {/* Mobile: carrusel horizontal de cards grandes */}
      <div className="md:hidden flex-1 min-h-0 flex flex-col">
        <div
          ref={trackRef}
          onScroll={handleScroll}
          className="flex-1 min-h-0 flex gap-3 overflow-x-auto snap-x snap-mandatory -mx-4 px-4 scrollbar-hide"
        >
          {GOALS.map((g) => {
            const sel = goal === g.id;
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => onChange(g.id)}
                className={`snap-center shrink-0 w-[86%] h-full relative rounded-[24px] overflow-hidden text-left transition-all border ${
                  sel ? 'border-2 border-brand-600 shadow-[0_12px_30px_rgba(216,16,73,0.2)]' : 'border-slate-200'
                }`}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${g.bgGradient}`} />
                <div className={`absolute top-3.5 right-3.5 w-7 h-7 rounded-full flex items-center justify-center ${
                  sel ? 'bg-brand-600 text-white' : 'bg-white/80'
                }`}>
                  {sel && <Check size={14} strokeWidth={3} />}
                </div>
                {g.badge && (
                  <div className="absolute top-3.5 left-3.5 bg-white text-brand-700 text-[9px] font-black tracking-[0.1em] uppercase px-2 py-1 rounded-full shadow">
                    {g.badge}
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 p-4 pt-14 bg-gradient-to-t from-black/65 via-black/15 to-transparent">
                  <div className="t-display text-[17px] text-white leading-tight normal-case italic">
                    {g.title}
                  </div>
                  <p className="text-[12px] text-white/85 mt-1 leading-snug">
                    {g.desc}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
        <div className="flex items-center justify-center gap-1.5 mt-3 flex-shrink-0">
          {GOALS.map((g, i) => (
            <button
              key={g.id}
              type="button"
              aria-label={`Ver ${g.title}`}
              onClick={() => scrollToIndex(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === activeIndex ? 'w-5 bg-brand-600' : 'w-1.5 bg-slate-300'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Desktop: grid original de cards con detalle */}
      <div className="hidden md:grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
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
                  <div className="absolute bottom-3 left-3 bg-white text-brand-700 text-[9px] font-black tracking-[0.1em] uppercase px-2 py-1 rounded-full shadow">
                    {g.badge}
                  </div>
                )}

                {sel && (
                  <div className="absolute inset-0 bg-brand-600/10 pointer-events-none" />
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
                      sel ? 'bg-brand-600 text-white' : 'bg-white border-2 border-slate-200 text-transparent'
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
                    <Layout size={9} className="opacity-60" /> {g.mockBg}
                  </span>
                  <span className="inline-flex items-center gap-1 bg-slate-50 border border-slate-100 text-slate-500 text-[10px] font-medium px-2 py-0.5 rounded-full normal-case">
                    <Sun size={9} className="opacity-60" /> {g.mockLight}
                  </span>
                  <span className="inline-flex items-center gap-1 bg-slate-50 border border-slate-100 text-slate-500 text-[10px] font-medium px-2 py-0.5 rounded-full normal-case">
                    <Palette size={9} className="opacity-60" /> {g.mockMood}
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
