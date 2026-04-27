import React from 'react';
import { Zap } from 'lucide-react';

interface CostSummaryProps {
  shots: number;
  quality?: 'baja' | 'media' | 'alta';
  totalCost: number;
  availableCredits: number;
  onGenerate: () => void;
  disabled?: boolean;
  generating?: boolean;
  estimatedMinutes?: number;
}

export const CostSummary: React.FC<CostSummaryProps> = ({
  shots,
  quality = 'alta',
  totalCost,
  availableCredits,
  onGenerate,
  disabled = false,
  generating = false,
  estimatedMinutes,
}) => {
  const enough = availableCredits >= totalCost;
  const creditsAfter = Math.max(0, availableCredits - totalCost);
  const baseCost = shots * 2;
  const qualitySurcharge = totalCost - baseCost;

  return (
    <div className="sticky top-6 space-y-4">
      {/* Dark cost card */}
      <div className="relative bg-slate-900 rounded-[24px] p-6 text-white overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-violet-500/20 blur-2xl pointer-events-none" />

        <p className="text-[10px] font-black text-pink-400 uppercase tracking-widest mb-4 relative">
          Resumen del costo
        </p>

        <div className="space-y-3 mb-4 relative text-sm">
          <div className="flex justify-between">
            <span className="opacity-70">Base · {shots} shots</span>
            <span className="font-bold">{baseCost} cr</span>
          </div>
          {qualitySurcharge !== 0 && (
            <div className="flex justify-between">
              <span className="opacity-70">Calidad {quality}</span>
              <span className={`font-bold ${qualitySurcharge > 0 ? 'text-pink-400' : 'text-emerald-400'}`}>
                {qualitySurcharge > 0 ? '+' : ''}{qualitySurcharge} cr
              </span>
            </div>
          )}
          <div className="h-px bg-white/10 my-1" />
          <div className="flex justify-between items-baseline">
            <span className="opacity-85 text-sm">Total</span>
            <span className="text-3xl font-black tracking-tight">{totalCost} cr</span>
          </div>
        </div>

        <button
          onClick={onGenerate}
          disabled={disabled || generating || !enough}
          className={`relative w-full py-4 rounded-xl text-sm font-black uppercase tracking-widest transition-all active:scale-95 ${
            enough && !disabled && !generating
              ? 'bg-gradient-to-r from-violet-500 to-pink-500 text-white shadow-xl shadow-violet-500/30 hover:shadow-violet-500/50'
              : 'bg-white/10 text-white/40 cursor-not-allowed'
          }`}
        >
          {generating ? 'Generando...' : enough ? `Generar ${shots} shots →` : 'Créditos insuficientes'}
        </button>

        <p className="relative text-center text-[10px] text-white/50 mt-3">
          {enough
            ? `Te quedarán ${creditsAfter} cr · ~${Math.floor(creditsAfter / 2)} imágenes más`
            : `Necesitas ${totalCost - availableCredits} cr más`}
        </p>
      </div>

      {/* ETA card */}
      {estimatedMinutes !== undefined && (
        <div className="bg-white border border-slate-100 rounded-[20px] p-5 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Tiempo estimado</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900 tracking-tight">{estimatedMinutes}m</span>
            <span className="text-xs text-slate-400 font-medium">· puedes seguir trabajando</span>
          </div>
        </div>
      )}

      {/* Transparency note */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-800 leading-relaxed">
        <strong>Sin sorpresas.</strong> El costo se descuenta solo cuando la generación se completa. Reembolso automático si falla.
      </div>
    </div>
  );
};
