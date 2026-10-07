// Mientras se crean las fotos: aparecen una a una y se avisa que puede salir.
import React from 'react';
import { Bell } from 'lucide-react';
import { FlowHeading } from './ui';

interface GeneratingStepProps {
  shots: string[];          // '' en curso, 'error' fallida, url lista
  collage?: string | null;
  withCollage: boolean;
  aspectClass: string;
  statusText: string;
}

export const GeneratingStep: React.FC<GeneratingStepProps> = ({ shots, collage, withCollage, aspectClass, statusText }) => {
  const total = shots.length + (withCollage ? 1 : 0);
  const done = shots.filter((s) => s !== '').length + (collage ? 1 : 0);
  const progress = total > 0 ? Math.max(0.06, done / total) : 0.06;
  const slots = withCollage ? [...shots, collage ?? ''] : shots;

  return (
    <div className="flex flex-col gap-4" aria-live="polite">
      <span className="text-[15px] font-bold text-slate-900 min-h-11 flex items-center">Creando tus fotos</span>
      <FlowHeading>{done >= total && total > 0 ? 'Listo' : done === 0 ? 'Estamos fotografiando tu producto' : `Lista ${done} de ${total}`}</FlowHeading>
      <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
        <div
          className="h-full w-full origin-left rounded-full bg-brand-600 transition-transform duration-700 ease-[cubic-bezier(0.23,1,0.32,1)]"
          style={{ transform: `scaleX(${progress})` }}
        />
      </div>
      <p className="text-sm text-slate-500 -mt-1">{statusText}</p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        {slots.map((s, i) => (
          <div key={i} className={`relative ${aspectClass} rounded-[18px] overflow-hidden bg-slate-200`}>
            {s && s !== 'error' && (
              <img src={s} alt={`Foto ${i + 1}`} className="w-full h-full object-cover photo-reveal" />
            )}
            {s === '' && <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent animate-pulse" />}
            {s === 'error' && (
              <span className="absolute inset-0 flex items-center justify-center px-3 text-center text-xs font-semibold text-slate-500">
                No se pudo crear
              </span>
            )}
            {withCollage && i === slots.length - 1 && (
              <span className="absolute left-2 bottom-2 rounded-full bg-slate-900/75 px-2 py-0.5 text-[11px] font-semibold text-white">Collage</span>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2.5 rounded-2xl border border-slate-200 bg-white p-3 text-[13px] text-slate-700">
        <Bell size={20} className="shrink-0 text-brand-600" />
        Puedes salir de la app. Te avisamos cuando estén listas.
      </div>
    </div>
  );
};
