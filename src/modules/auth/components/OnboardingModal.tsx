import React, { useState, useRef } from 'react';
import { ArrowRight, X, Zap, Wand2, Users, Image, Sparkles } from 'lucide-react';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail?: string;
}

interface Slide {
  icon: React.ReactNode;
  gradient: string;
  glowColor: string;
  title: string;
  subtitle: string;
  description: string;
  badge: string | null;
  highlight?: { label: string; value: string }[];
}

const SLIDES: Slide[] = [
  {
    icon: <Sparkles className="w-9 h-9 text-white" />,
    gradient: 'from-violet-600 via-fuchsia-600 to-violet-700',
    glowColor: 'rgba(124,58,237,0.4)',
    title: 'Bienvenido a LUZ IA',
    subtitle: 'Tu plataforma de producción publicitaria con IA',
    description: 'Crea contenido profesional, modelos digitales y campañas visuales en minutos — sin fotógrafos, sin equipos, sin límites.',
    badge: null,
    highlight: [
      { label: 'Créditos gratis', value: '20' },
      { label: 'Módulos', value: '6+' },
      { label: 'Tiempo setup', value: '0 min' },
    ],
  },
  {
    icon: <Users className="w-9 h-9 text-white" />,
    gradient: 'from-violet-700 via-purple-600 to-fuchsia-600',
    glowColor: 'rgba(147,51,234,0.4)',
    title: 'Crea tus Modelos',
    subtitle: 'Model DNA — From Photos o From Scratch',
    description: 'Sube fotos de una persona real y extraemos su ADN biométrico digital. O diseña un modelo nuevo desde cero eligiendo cada rasgo visual.',
    badge: 'Crear Identidad',
    highlight: [
      { label: 'From Photos', value: '📷' },
      { label: 'From Scratch', value: '✏️' },
      { label: 'Biblioteca', value: '📚' },
    ],
  },
  {
    icon: <Wand2 className="w-9 h-9 text-white" />,
    gradient: 'from-fuchsia-600 via-pink-600 to-rose-600',
    glowColor: 'rgba(192,38,211,0.4)',
    title: 'Genera Contenido',
    subtitle: 'AI Generator · Content Studio · Scene Clone',
    description: 'AI Generator para imágenes con prompts avanzados. Content Studio para UGC estilo iPhone orgánico. Scene Clone para replicar escenas con tu identidad.',
    badge: 'Generar Contenido',
    highlight: [
      { label: 'AI Generator', value: '⚡' },
      { label: 'Content Studio', value: '📱' },
      { label: 'Scene Clone', value: '🎬' },
    ],
  },
  {
    icon: <Image className="w-9 h-9 text-white" />,
    gradient: 'from-cyan-600 via-sky-600 to-indigo-600',
    glowColor: 'rgba(8,145,178,0.4)',
    title: 'Herramientas Pro',
    subtitle: 'Outfit Kit · Catálogo de Productos',
    description: 'Extrae prendas individuales de cualquier outfit con ghost mannequin automático. Genera fotografía comercial profesional de tus productos sin estudio.',
    badge: 'Herramientas',
    highlight: [
      { label: 'Outfit Kit', value: '👗' },
      { label: 'Catálogo', value: '📦' },
      { label: 'Ghost FX', value: '✨' },
    ],
  },
  {
    icon: <Zap className="w-9 h-9 text-white" />,
    gradient: 'from-amber-500 via-orange-500 to-rose-500',
    glowColor: 'rgba(245,158,11,0.4)',
    title: 'Sistema de Créditos',
    subtitle: 'Simple, transparente, sin sorpresas',
    description: 'Cada generación usa créditos según el módulo. Empiezas con 20 créditos gratis para explorar todo. Cuando los necesites, elige un plan que se adapte a tu flujo.',
    badge: null,
    highlight: [
      { label: 'Free', value: '20 cr' },
      { label: 'Starter', value: '240 cr' },
      { label: 'Pro', value: '600 cr' },
    ],
  },
];

const OnboardingModal: React.FC<OnboardingModalProps> = ({ isOpen, onClose }) => {
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState<'next' | 'prev'>('next');
  const touchStartX = useRef<number>(0);
  const touchEndX   = useRef<number>(0);

  if (!isOpen) return null;

  const slide   = SLIDES[current];
  const isFirst = current === 0;
  const isLast  = current === SLIDES.length - 1;

  const goNext = () => {
    if (isLast) { onClose(); return; }
    setDirection('next');
    setCurrent(p => p + 1);
  };

  const goPrev = () => {
    if (isFirst) return;
    setDirection('prev');
    setCurrent(p => p - 1);
  };

  const goTo = (i: number) => {
    setDirection(i > current ? 'next' : 'prev');
    setCurrent(i);
  };

  const onTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.changedTouches[0].screenX; };
  const onTouchEnd   = (e: React.TouchEvent) => {
    touchEndX.current = e.changedTouches[0].screenX;
    const diff = touchStartX.current - touchEndX.current;
    if (Math.abs(diff) > 50) { if (diff > 0) goNext(); else goPrev(); }
  };

  return (
    <div
      className="fixed inset-0 z-[600] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="relative w-full sm:max-w-lg bg-[#0D0D14] border border-white/[0.08] rounded-t-[32px] sm:rounded-[32px] shadow-2xl shadow-black/80 overflow-hidden animate-slide-up sm:animate-scale-in max-h-[95dvh] flex flex-col"
        onClick={e => e.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div className="flex justify-center pt-3 sm:hidden flex-shrink-0">
          <div className="w-10 h-1 bg-white/10 rounded-full" />
        </div>

        <button onClick={onClose}
          className="absolute top-5 right-5 z-20 w-9 h-9 bg-black/30 hover:bg-black/50 backdrop-blur-sm rounded-xl flex items-center justify-center text-white/50 hover:text-white/80 transition-all touch-target border border-white/10"
          aria-label="Saltar introducción">
          <X size={16} />
        </button>

        <div
          className={`relative flex flex-col items-center justify-center gap-4 px-8 py-10 bg-gradient-to-br ${slide.gradient} flex-shrink-0 min-h-[220px] overflow-hidden`}
          style={{ boxShadow: `0 20px 60px ${slide.glowColor}` }}
        >
          <div className="absolute inset-0 opacity-10"
            style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)', backgroundSize: '30px 30px' }}
          />
          <div className="relative z-10">
            <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-3xl flex items-center justify-center border border-white/20">
              {slide.icon}
            </div>
          </div>
          {slide.badge && (
            <span className="relative z-10 bg-white/20 backdrop-blur-sm text-white text-[9px] font-black uppercase tracking-[0.3em] px-3 py-1.5 rounded-full border border-white/20">
              {slide.badge}
            </span>
          )}
          {slide.highlight && (
            <div className="relative z-10 flex items-center gap-2 flex-wrap justify-center">
              {slide.highlight.map(h => (
                <div key={h.label} className="bg-white/15 backdrop-blur-sm border border-white/20 rounded-xl px-3 py-1.5 text-center">
                  <div className="text-base font-black text-white leading-none">{h.value}</div>
                  <div className="text-[8px] font-bold text-white/70 uppercase tracking-wider mt-0.5">{h.label}</div>
                </div>
              ))}
            </div>
          )}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
            {SLIDES.map((_, i) => (
              <button key={i} onClick={() => goTo(i)}
                className={`rounded-full transition-all duration-300 ${i === current ? 'w-6 h-2 bg-white' : 'w-2 h-2 bg-white/30 hover:bg-white/50'}`}
                aria-label={`Slide ${i + 1}`}
              />
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-5 scrollbar-hide">
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-black text-white/20 uppercase tracking-[0.3em]">{current + 1} de {SLIDES.length}</span>
            <div className="flex-1 h-px bg-white/[0.06]" />
            {current < SLIDES.length - 1 && (
              <span className="text-[9px] font-bold text-white/15 uppercase tracking-wider">Siguiente →</span>
            )}
          </div>

          <div className="space-y-2">
            <h2 className="text-xl sm:text-2xl font-black text-white uppercase italic tracking-tight leading-tight">{slide.title}</h2>
            <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">{slide.subtitle}</p>
          </div>

          <p className="text-sm text-white/45 leading-relaxed font-medium">{slide.description}</p>

          <div className="flex gap-2.5 pt-1">
            {!isFirst && (
              <button onClick={goPrev}
                className="px-5 py-4 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-white/40 hover:text-white/70 rounded-2xl font-black text-xs uppercase tracking-widest transition-all touch-target">
                ←
              </button>
            )}
            <button onClick={goNext}
              className="flex-1 py-4 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:opacity-90 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-violet-900/40 transition-all active:scale-[0.98] flex items-center justify-center gap-2 touch-target"
            >
              {isLast ? (<><Sparkles size={14} />¡Empezar a crear!</>) : (<>Siguiente <ArrowRight size={14} /></>)}
            </button>
          </div>

          {!isLast && (
            <button onClick={onClose} className="w-full text-[9px] font-bold text-white/15 hover:text-white/35 uppercase tracking-[0.3em] transition-colors py-1">
              Saltar introducción
            </button>
          )}
        </div>

        <div className="h-safe-bottom flex-shrink-0 sm:hidden" />
      </div>
    </div>
  );
};

export default OnboardingModal;
