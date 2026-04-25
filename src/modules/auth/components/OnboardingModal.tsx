import React, { useState } from 'react';
import { ArrowRight, X, Zap, Wand2, Users, Image, Sparkles } from 'lucide-react';

// ──────────────────────────────────────────
// OnboardingModal
// Se muestra una sola vez al primer login.
// El padre controla isOpen / onClose.
// ──────────────────────────────────────────

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SLIDES = [
  {
    icon: <Sparkles className="w-10 h-10 text-white" />,
    bg: 'from-brand-600 to-violet-600',
    title: 'Bienvenido a LUZ IA',
    subtitle: 'Tu plataforma de producción publicitaria con inteligencia artificial',
    description: 'Crea contenido profesional, modelos digitales y campañas visuales en minutos — sin necesidad de fotógrafos ni equipos.',
    badge: null,
  },
  {
    icon: <Users className="w-10 h-10 text-white" />,
    bg: 'from-purple-600 to-brand-600',
    title: 'Crea tus Modelos',
    subtitle: 'Model DNA · From Photos o From Scratch',
    description: 'Sube fotos reales de una persona y extraemos su ADN biométrico digital, o diseña un modelo completamente nuevo desde cero con los parámetros que elijas.',
    badge: 'Crear Identidad',
  },
  {
    icon: <Wand2 className="w-10 h-10 text-white" />,
    bg: 'from-accent-500 to-teal-600',
    title: 'Genera Contenido',
    subtitle: 'AI Generator · Content Studio · Scene Clone',
    description: 'Usa el AI Generator para crear imágenes con prompts avanzados, el Content Studio para contenido tipo iPhone orgánico, o Scene Clone para replicar escenas con tu identidad.',
    badge: 'Generar Contenido',
  },
  {
    icon: <Image className="w-10 h-10 text-white" />,
    bg: 'from-brand-600 to-cyan-500',
    title: 'Herramientas Pro',
    subtitle: 'Outfit Kit · Catálogo',
    description: 'Extrae prendas individuales de cualquier outfit con ghost mannequin automático, o genera fotografía comercial profesional de tus productos.',
    badge: 'Herramientas',
  },
  {
    icon: <Zap className="w-10 h-10 text-white" />,
    bg: 'from-amber-500 to-orange-500',
    title: 'Sistema de Créditos',
    subtitle: 'Simple y transparente',
    description: 'Cada generación usa créditos según el módulo. Empiezas con 20 créditos gratuitos para explorar todo. Cuando los necesites, elige un plan que se adapte a tu flujo de trabajo.',
    badge: null,
    isLast: true,
  },
];

const OnboardingModal: React.FC<OnboardingModalProps> = ({ isOpen, onClose }) => {
  const [currentSlide, setCurrentSlide] = useState(0);

  if (!isOpen) return null;

  const slide = SLIDES[currentSlide];
  const isLast = currentSlide === SLIDES.length - 1;

  const goNext = () => {
    if (isLast) {
      onClose();
    } else {
      setCurrentSlide(prev => prev + 1);
    }
  };

  const goPrev = () => {
    if (currentSlide > 0) setCurrentSlide(prev => prev - 1);
  };

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
      <div className="bg-white w-full max-w-lg rounded-[40px] overflow-hidden shadow-2xl animate-in zoom-in-95 fade-in duration-300 max-h-[90dvh] flex flex-col">
        <div className="overflow-y-auto flex-1">
          {/* SLIDE VISUAL */}
          <div className={`bg-gradient-to-br ${slide.bg} p-10 flex flex-col items-center justify-center gap-4 relative min-h-[220px]`}>

          {/* SKIP */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 bg-white/20 hover:bg-white/30 rounded-xl flex items-center justify-center text-white transition-colors"
          >
            <X size={14} />
          </button>

          {/* ICON */}
          <div className="w-20 h-20 bg-white/20 rounded-[28px] flex items-center justify-center backdrop-blur-sm">
            {slide.icon}
          </div>

          {/* BADGE */}
          {slide.badge && (
            <span className="bg-white/20 text-white text-xs font-black uppercase tracking-widest px-3 py-1.5 rounded-full">
              {slide.badge}
            </span>
          )}

          {/* DOT INDICATOR */}
          <div className="flex gap-1.5 absolute bottom-4">
            {SLIDES.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentSlide(i)}
                className={`rounded-full transition-all duration-300 ${
                  i === currentSlide ? 'w-5 h-2 bg-white' : 'w-2 h-2 bg-white/40'
                }`}
              />
            ))}
          </div>

        </div>

        {/* CONTENT */}
        <div className="p-8 space-y-4">
          <div className="space-y-1">
            <h2 className="text-2xl font-black text-slate-900 uppercase italic tracking-tighter leading-none">
              {slide.title}
            </h2>
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">
              {slide.subtitle}
            </p>
          </div>

          <p className="text-sm text-slate-600 leading-relaxed font-medium">
            {slide.description}
          </p>

          {/* ACTIONS */}
          <div className="flex gap-3 pt-2">
            {currentSlide > 0 && (
              <button
                onClick={goPrev}
                className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest transition-all"
              >
                Atrás
              </button>
            )}
            <button
              onClick={goNext}
              className="flex-1 py-4 bg-brand-600 hover:bg-brand-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-brand-100 flex items-center justify-center gap-2"
            >
              {isLast ? (
                <>
                  <Sparkles className="w-4 h-4" />
                  ¡Empezar a crear!
                </>
              ) : (
                <>
                  Siguiente
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
);
};

export default OnboardingModal;
