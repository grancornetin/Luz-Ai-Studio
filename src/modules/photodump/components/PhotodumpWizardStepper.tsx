/**
 * PhotodumpWizardStepper.tsx
 *
 * Stepper propio de Photodump — mismo contrato de props que
 * components/shared/WizardStepper.tsx (steps, current, onJump) para que
 * PhotodumpModule.tsx no cambie cómo lo invoca, pero implementación y estilo
 * 100% independientes. Decisión explícita del usuario (plan de integración
 * del nuevo diseño, sep 2026): "lo del wizard compartido, creemos uno
 * especial para photodump y nos separamos del compartido, mas trabajo pero
 * menos riesgo" — evita que un cambio visual acá afecte a los otros módulos
 * que usan el stepper compartido.
 *
 * Paleta y tipografía: las del resto de la app (brand-*, slate-*,
 * font-display) — el nuevo prototipo de Photodump NO trae paleta/tipografía
 * propia, solo layout e interacción (ver PLAN_INTEGRACION.md, decisión 3).
 *
 * Diferencia visual respecto al WizardStepper compartido: acá TODOS los
 * labels son visibles en desktop (no solo el del paso activo), con una
 * línea conectora continua entre círculos — patrón tomado del prototipo
 * (nuevo prototipo/photodump-flow-prototype/app.js, función stepper()).
 */
import React from 'react';
import { Check } from 'lucide-react';

export interface PhotodumpWizardStepDef {
  id:    string;
  label: string;
}

interface PhotodumpWizardStepperProps {
  steps:   PhotodumpWizardStepDef[];
  current: number;
  onJump?: (step: number) => void;
}

export const PhotodumpWizardStepper: React.FC<PhotodumpWizardStepperProps> = ({
  steps, current, onJump,
}) => {
  const currentIndex = current - 1;
  const pct = ((currentIndex + 1) / steps.length) * 100;

  return (
    <div className="bg-white border-b border-slate-100">
      {/* Mobile — "Paso N de M" + barra de progreso (mismo patrón que el resto de la app) */}
      <div className="md:hidden px-4 pt-3 pb-2">
        <div className="flex justify-between items-baseline mb-2">
          <span className="text-[10px] font-black text-brand-600 uppercase tracking-widest">
            Paso {current} de {steps.length}
          </span>
          <span className="text-[11px] font-semibold text-slate-500">
            {steps[currentIndex]?.label}
          </span>
        </div>
        <div className="h-[3px] bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-brand-600 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Desktop — todos los labels visibles, línea conectora continua */}
      <div className="hidden md:flex items-center gap-2 px-6 py-4">
        {steps.map((s, i) => {
          const done = i < currentIndex;
          const active = i === currentIndex;
          const canJump = i <= currentIndex && !!onJump;

          return (
            <React.Fragment key={s.id}>
              <button
                type="button"
                onClick={() => canJump && onJump?.(i + 1)}
                disabled={!canJump}
                className={`flex items-center gap-2 bg-transparent border-0 transition-all flex-shrink-0 py-1 px-0 ${
                  canJump ? 'cursor-pointer hover:opacity-75' : 'cursor-default'
                }`}
              >
                <div
                  className={`w-[22px] h-[22px] rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 transition-all ${
                    done
                      ? 'bg-brand-600 border border-brand-600 text-white'
                      : active
                      ? 'bg-slate-900 border border-slate-900 text-white'
                      : 'bg-white border border-slate-300 text-slate-400'
                  }`}
                >
                  {done ? <Check size={11} strokeWidth={3} /> : i + 1}
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-[0.08em] whitespace-nowrap ${
                  active ? 'text-slate-900' : done ? 'text-brand-600' : 'text-slate-400'
                }`}>
                  {s.label}
                </span>
              </button>

              {i < steps.length - 1 && (
                <div className="flex-1 h-px bg-slate-200 min-w-[16px]" />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

export default PhotodumpWizardStepper;
