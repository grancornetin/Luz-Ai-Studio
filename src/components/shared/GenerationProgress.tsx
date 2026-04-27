import React from 'react';
import { CheckCircle, Circle, Loader2 } from 'lucide-react';

// Palette aligned with prototype: emerald = done, pink = active, slate = pending

export interface ProgressStep {
  id: string;
  label: string;
}

export interface CompletedShot {
  url: string;
  index: number;
}

interface GenerationProgressProps {
  steps: ProgressStep[];
  currentStepIndex: number;
  completedShots?: CompletedShot[];
  totalShots?: number;
  etaSeconds?: number;
  autoRetryCount?: number;    // 0 = intento inicial, 1 = primer reintento, etc.
  maxAutoRetries?: number;
}

export const GenerationProgress: React.FC<GenerationProgressProps> = ({
  steps,
  currentStepIndex,
  completedShots = [],
  totalShots = 0,
  etaSeconds = 0,
  autoRetryCount = 0,
  maxAutoRetries = 1,
}) => {
  const safeIndex = Math.min(currentStepIndex, steps.length - 1);
  const percent = steps.length > 0 ? ((safeIndex + 1) / steps.length) * 100 : 0;
  const etaMinutes = Math.floor(etaSeconds / 60);
  const etaRemSecs = etaSeconds % 60;

  const emptySlotsCount = Math.max(0, totalShots - completedShots.length);

  return (
    <div className="space-y-6">
      {/* Barra de progreso */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            Progreso
          </span>
          <span className="text-[10px] font-black text-pink-600 uppercase tracking-widest">
            {Math.round(percent)}%
          </span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-violet-500 to-pink-500 transition-all duration-700 ease-out rounded-full"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      {/* Timeline de pasos con línea vertical */}
      <div className="relative">
        {/* Vertical connector line */}
        <div className="absolute left-[8px] top-2 bottom-2 w-0.5 bg-slate-100 rounded-full" />
        <div className="space-y-3">
          {steps.map((step, idx) => {
            const status =
              idx < safeIndex ? 'completed' : idx === safeIndex ? 'active' : 'pending';
            return (
              <div
                key={step.id}
                className={`flex items-start gap-3 relative transition-opacity duration-300 ${status === 'pending' ? 'opacity-40' : 'opacity-100'}`}
              >
                <div className="mt-0.5 flex-shrink-0 relative z-10">
                  {status === 'completed' && (
                    <div className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center">
                      <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                        <path d="M1.5 4L3 5.5L6.5 2.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  )}
                  {status === 'active' && (
                    <div className="w-4 h-4 rounded-full bg-pink-500 animate-pulse" />
                  )}
                  {status === 'pending' && (
                    <div className="w-4 h-4 rounded-full border-2 border-slate-200 bg-white" />
                  )}
                </div>
                <div>
                  <p className={`text-xs font-bold leading-tight ${status === 'active' ? 'text-slate-800' : 'text-slate-500'}`}>
                    {step.label}
                  </p>
                  {status === 'active' && etaSeconds > 0 && (
                    <p className="text-[10px] text-slate-400 mt-0.5 font-medium">
                      ~{etaMinutes > 0 ? `${etaMinutes}m ` : ''}{etaRemSecs}s restantes
                    </p>
                  )}
                  {status === 'active' && autoRetryCount > 0 && (
                    <p className="text-[10px] text-amber-500 mt-0.5 font-bold animate-pulse">
                      Reintentando ({autoRetryCount}/{maxAutoRetries})...
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Miniaturas de shots completados */}
      {totalShots > 0 && (
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
            Resultados ({completedShots.length}/{totalShots})
          </p>
          <div className="grid grid-cols-3 gap-2">
            {completedShots.map((shot) => (
              <div
                key={shot.index}
                className="aspect-square rounded-xl overflow-hidden bg-slate-100 animate-in zoom-in duration-300 shadow-sm"
              >
                <img
                  src={shot.url}
                  alt={`Shot ${shot.index + 1}`}
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
            {Array.from({ length: emptySlotsCount }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="aspect-square rounded-xl bg-slate-100 animate-pulse"
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
