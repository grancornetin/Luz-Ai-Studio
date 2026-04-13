import React, { useState, useEffect } from 'react';
import { X, ChevronRight, ChevronLeft, HelpCircle } from 'lucide-react';

// ──────────────────────────────────────────
// ModuleTutorial
// Componente reutilizable de tutorial interactivo.
// ──────────────────────────────────────────

export interface TutorialStep {
  icon: string;
  color: string;
  title: string;
  description: string;
  tip?: string;
}

interface ModuleTutorialProps {
  moduleId: string;
  steps: TutorialStep[];
  label?: string;
  compact?: boolean;
}

const ModuleTutorial: React.FC<ModuleTutorialProps> = ({
  moduleId,
  steps,
  label = '¿Cómo funciona?',
  compact = false
}) => {
  const [isOpen, setIsOpen]   = useState(false);
  const [current, setCurrent] = useState(0);

  // Abre automáticamente la primera vez
  useEffect(() => {
    const key = `tutorial_seen_${moduleId}`;
    if (!localStorage.getItem(key)) {
      setIsOpen(true);
      localStorage.setItem(key, 'true');
    }
  }, [moduleId]);

  const step    = steps[current];
  const isFirst = current === 0;
  const isLast  = current === steps.length - 1;

  const open  = () => { setCurrent(0); setIsOpen(true); };
  const close = () => setIsOpen(false);
  const next  = () => !isLast && setCurrent(c => c + 1);
  const prev  = () => !isFirst && setCurrent(c => c - 1);

  return (
    <>
      {/* TRIGGER BUTTON */}
      <button
        onClick={open}
        className={`flex items-center gap-1.5 text-slate-400 hover:text-brand-600 transition-colors ${
          compact ? 'text-[9px]' : 'text-[10px]'
        } font-black uppercase tracking-widest`}
      >
        <HelpCircle className={compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
        {label}
      </button>

      {/* MODAL */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={close}
        >
          <div
            className="bg-white w-full max-w-md rounded-[36px] shadow-2xl overflow-hidden animate-in zoom-in-95 fade-in duration-200"
            onClick={e => e.stopPropagation()}
          >
            {/* HEADER CON COLOR */}
            <div className={`${step.color.split(' ')[0]} p-6 flex items-center justify-between relative`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center">
                  <i className={`fa-solid ${step.icon} text-white text-lg`}></i>
                </div>
                <div>
                  <p className="text-[8px] font-black text-white/70 uppercase tracking-widest">
                    Paso {current + 1} de {steps.length}
                  </p>
                  <h3 className="text-base font-black text-white uppercase italic tracking-tight leading-tight">
                    {step.title}
                  </h3>
                </div>
              </div>
              <button
                onClick={close}
                className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-xl flex items-center justify-center text-white transition-colors flex-shrink-0"
              >
                <X size={14} />
              </button>
            </div>

            {/* PROGRESS DOTS MEJORADOS (ESTILO PRO CIRCULAR) */}
            <div className="flex gap-3 justify-center pt-6 px-6">
              {steps.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrent(i)}
                  className="relative flex items-center justify-center w-3 h-3"
                >
                  {/* El punto base */}
                  <div 
                    className={`rounded-full transition-all duration-500 ease-out ${
                      i === current
                        ? 'w-2.5 h-2.5 bg-brand-600 scale-110' 
                        : i < current
                        ? 'w-2 h-2 bg-brand-300'
                        : 'w-2 h-2 bg-slate-200'
                    }`}
                  />
                  
                  {/* Efecto de Pulso Glow solo para el activo */}
                  {i === current && (
                    <span className="absolute inset-0 rounded-full bg-brand-600 animate-ping opacity-20"></span>
                  )}
                </button>
              ))}
            </div>

            {/* CONTENT */}
            <div className="p-6 pt-4 space-y-4">
              <p className="text-sm text-slate-600 leading-relaxed font-medium">
                {step.description}
              </p>

              {step.tip && (
                <div className="bg-accent-50 border border-accent-100 rounded-2xl p-3.5 flex items-start gap-2.5">
                  <i className="fa-solid fa-lightbulb text-accent-500 text-sm mt-0.5 flex-shrink-0"></i>
                  <p className="text-[11px] font-bold text-accent-700 leading-relaxed">{step.tip}</p>
                </div>
              )}

              {/* NAVIGATION */}
              <div className="flex gap-3 pt-1">
                <button
                  onClick={prev}
                  disabled={isFirst}
                  className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed text-slate-600 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all"
                >
                  <ChevronLeft size={14} />
                  Atrás
                </button>

                {isLast ? (
                  <button
                    onClick={close}
                    className="flex-1 py-3.5 bg-brand-600 hover:bg-brand-700 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all shadow-lg shadow-brand-100"
                  >
                    <i className="fa-solid fa-check text-xs"></i>
                    ¡Entendido!
                  </button>
                ) : (
                  <button
                    onClick={next}
                    className="flex-1 py-3.5 bg-brand-600 hover:bg-brand-700 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all shadow-lg shadow-brand-100"
                  >
                    Siguiente
                    <ChevronRight size={14} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ModuleTutorial;