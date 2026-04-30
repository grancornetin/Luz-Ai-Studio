import React from 'react';
import { GenerationProgress, type ProgressStep } from '../../components/shared/GenerationProgress';

interface Step5GeneratingProps {
  steps: ProgressStep[];
  currentStepIndex: number;
  productTitle: string;
  totalShots: number;
  completedShots: { url: string; index: number }[];
  modeLabel: string; // ej: "Recrear inspiración" o "Pack · Premium"
  processingStatus?: string;
}

export const Step5Generating: React.FC<Step5GeneratingProps> = ({
  steps,
  currentStepIndex,
  productTitle,
  totalShots,
  completedShots,
  modeLabel,
  processingStatus,
}) => {
  const ready = completedShots.length;

  return (
    <div className="fade-in p-4 md:p-8">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 md:gap-7 items-start">
        {/* LEFT: timeline */}
        <div className="md:col-span-5 lg:col-span-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-pink-500 animate-pulse" />
            <span className="text-[10px] font-black text-pink-600 uppercase tracking-[0.18em]">
              Generando · no cierres esta ventana
            </span>
          </div>
          <h2 className="t-display text-[24px] md:text-[28px] text-slate-900 leading-tight">
            {productTitle || 'Tu producto'}
          </h2>
          <div className="text-[13px] text-slate-500 mt-1 mb-4">
            {totalShots} {totalShots === 1 ? 'imagen' : 'imágenes'} · {modeLabel}
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-4 md:p-[18px]">
            <GenerationProgress
              steps={steps}
              currentStepIndex={currentStepIndex}
              completedShots={completedShots}
              totalShots={0}
            />
          </div>

          {processingStatus && (
            <div className="mt-3 px-3.5 py-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 leading-[1.5]">
              {processingStatus}
            </div>
          )}
          <div className="mt-3 px-3.5 py-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 leading-[1.5]">
            💡 Podés cerrar la ventana — te avisamos cuando termine.
          </div>
        </div>

        {/* RIGHT: grid en vivo */}
        <div className="md:col-span-7 lg:col-span-8">
          <div className="flex justify-between items-baseline mb-3.5">
            <div>
              <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.14em] mb-1">
                En vivo
              </div>
              <h3 className="t-display text-[20px] md:text-[22px] text-slate-900 normal-case italic">
                {ready} de {totalShots} listas
              </h3>
            </div>
          </div>

          <div
            className={`grid gap-3 ${
              totalShots <= 2
                ? 'grid-cols-2'
                : totalShots <= 4
                ? 'grid-cols-2 md:grid-cols-3'
                : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
            }`}
          >
            {Array.from({ length: totalShots }).map((_, i) => {
              const shot = completedShots.find((s) => s.index === i);
              const done = !!shot;
              const doing = !done && i === ready && currentStepIndex >= 1;
              return (
                <div
                  key={i}
                  className={`relative aspect-[3/4] rounded-2xl overflow-hidden transition-all ${
                    done
                      ? 'fade-in shadow-md'
                      : doing
                      ? 'border-2 border-pink-500 bg-slate-100 animate-pulse'
                      : 'bg-slate-100'
                  }`}
                >
                  {done && shot ? (
                    <>
                      <img
                        src={shot.url}
                        alt={`Shot ${i + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute top-2 right-2 bg-white/95 text-slate-900 text-[9px] font-bold tracking-[0.1em] uppercase px-1.5 py-0.5 rounded">
                        {i + 1}
                      </div>
                    </>
                  ) : doing ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="bg-white/95 rounded-full px-3.5 py-1.5 text-[10px] font-bold text-pink-600 tracking-[0.12em] uppercase">
                        EN VIVO
                      </div>
                    </div>
                  ) : (
                    <div className="absolute top-2 left-2 text-[10px] text-slate-400 font-semibold">
                      {i + 1}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Step5Generating;
