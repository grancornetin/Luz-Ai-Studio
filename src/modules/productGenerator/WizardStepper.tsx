import React from 'react';
import { Check } from 'lucide-react';
import type { WizardStepDef, WizardStep } from './wizardTypes';

interface WizardStepperProps {
  steps: WizardStepDef[];
  current: WizardStep;
  onJump?: (step: WizardStep) => void;
}

export const WizardStepper: React.FC<WizardStepperProps> = ({ steps, current, onJump }) => {
  const currentIndex = current - 1;
  const pct = ((currentIndex + 1) / steps.length) * 100;

  return (
    <div className="bg-white border-b border-slate-100">
      {/* Mobile / minimal — solo "Paso N de M" + barra de progreso */}
      <div className="md:hidden px-4 pt-3 pb-2">
        <div className="flex justify-between items-baseline mb-2">
          <span className="text-[10px] font-black text-pink-600 uppercase tracking-widest">
            Paso {current} de {steps.length}
          </span>
          <span className="text-[11px] font-semibold text-slate-500">
            {steps[currentIndex]?.label}
          </span>
        </div>
        <div className="h-[3px] bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-violet-600 to-pink-600 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Desktop — chips conectados con líneas */}
      <div className="hidden md:flex items-center gap-0 px-7 py-4">
        {steps.map((s, i) => {
          const done = i < currentIndex;
          const active = i === currentIndex;
          const canJump = i <= currentIndex && !!onJump;

          return (
            <React.Fragment key={s.id}>
              <button
                type="button"
                onClick={() => canJump && onJump?.(s.id)}
                disabled={!canJump}
                className={`flex items-center gap-2.5 py-1.5 px-1 bg-transparent border-0 transition-all flex-shrink-0 ${
                  canJump ? 'cursor-pointer hover:opacity-80' : 'cursor-default'
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold transition-all flex-shrink-0 ${
                    done
                      ? 'bg-emerald-500 text-white'
                      : active
                      ? 'bg-slate-900 text-white'
                      : 'bg-white border-[1.5px] border-slate-200 text-slate-400'
                  }`}
                >
                  {done ? <Check size={14} strokeWidth={3} /> : s.id}
                </div>
                <span
                  className={`text-xs tracking-tight transition-colors ${
                    active
                      ? 'font-bold text-slate-900'
                      : done
                      ? 'font-semibold text-slate-700'
                      : 'font-semibold text-slate-400'
                  }`}
                >
                  {s.label}
                </span>
              </button>
              {i < steps.length - 1 && (
                <div
                  className={`flex-1 h-[1.5px] mx-3.5 min-w-[20px] transition-colors duration-300 ${
                    done ? 'bg-emerald-500' : 'bg-slate-200'
                  }`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

export default WizardStepper;
