import React from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';

interface WizardFooterProps {
  onBack?: () => void;
  onContinue: () => void;
  continueLabel?: string;
  disabled?: boolean;
  costInfo?: { cost: number; label?: string; proCost?: number; proLabel?: string };
  loading?: boolean;
  /** Llama la atención sobre el botón cuando el paso ya está completo —
   * un pulso suave, no un avance automático. El usuario decide cuándo tocar. */
  pulse?: boolean;
  /** Acción secundaria opcional (ej. "Descargar todo") que convive junto al
   * botón principal — evita que un módulo tenga que sumar una segunda barra
   * flotante aparte cuando ya hay algo generado para descargar. */
  secondaryAction?: { label: string; icon?: React.ReactNode; onClick: () => void };
  /** Para pies dentro de una columna angosta: el botón principal ocupa todo el ancho disponible. */
  block?: boolean;
}

export const WizardFooter: React.FC<WizardFooterProps> = ({
  onBack,
  onContinue,
  continueLabel = 'Continuar',
  disabled = false,
  costInfo,
  loading = false,
  pulse = false,
  secondaryAction,
  block = false,
}) => {
  return (
    <div
      className="sticky bottom-0 z-10 bg-white border-t border-slate-200 px-4 md:px-7 py-3 md:py-3.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-2.5"
      style={{ boxShadow: '0 -8px 24px rgba(15,23,42,0.04)' }}
    >
      {(onBack || secondaryAction) && (
      <div className="flex items-center gap-3 flex-shrink-0">
      {onBack && (
        <>
          <button
            type="button"
            onClick={onBack}
            style={{ touchAction: 'manipulation' }}
            className="hidden md:flex items-center gap-1.5 bg-transparent border-0 text-slate-500 hover:text-slate-700 text-sm font-semibold py-3 px-1 transition-colors duration-150"
          >
            <ArrowLeft size={16} />
            Atrás
          </button>
          <button
            type="button"
            onClick={onBack}
            aria-label="Atrás"
            style={{ touchAction: 'manipulation' }}
            className="md:hidden w-12 h-12 bg-slate-100 active:bg-slate-200 rounded-xl flex items-center justify-center text-slate-700 transition-colors duration-150 flex-shrink-0"
          >
            <ArrowLeft size={18} />
          </button>
        </>
      )}

      {secondaryAction && (
        <button
          type="button"
          onClick={secondaryAction.onClick}
          style={{ touchAction: 'manipulation' }}
          className="flex items-center gap-1.5 bg-slate-100 active:bg-slate-200 text-slate-700 rounded-xl px-3.5 md:px-5 py-3 md:py-3.5 min-h-12 text-sm font-semibold transition-colors duration-150 flex-shrink-0"
        >
          {secondaryAction.icon}
          <span className="hidden sm:inline">{secondaryAction.label}</span>
        </button>
      )}
      </div>
      )}

      <div className="flex flex-1 items-center justify-end gap-3 min-w-[180px]">
      {costInfo && (
        <div className="hidden md:block text-right mr-1 flex-shrink-0">
          <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
            {costInfo.label || 'Costo total'}
          </div>
          <div className="t-display text-[22px] text-slate-900 leading-none mt-0.5">
            {costInfo.cost}{' '}
            <span className="text-xs text-slate-500 font-semibold normal-case">cr</span>
            {costInfo.proCost !== undefined && costInfo.proCost > 0 && (
              <span className="text-xs text-slate-500 font-semibold normal-case">
                {' '}+ {costInfo.proCost} {costInfo.proLabel || 'especial'}
              </span>
            )}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={onContinue}
        disabled={disabled || loading}
        style={{ touchAction: 'manipulation' }}
        className={`
          flex flex-col items-center justify-center gap-0.5 rounded-xl transition-colors duration-150
          px-4 md:px-7 py-3 md:py-3.5 min-h-12 ${secondaryAction || (block && !onBack) ? 'flex-1' : 'min-w-[140px]'} md:flex-1 ${block ? '' : 'md:max-w-[260px]'} md:min-w-[160px]
          text-sm font-semibold
          ${
            disabled || loading
              ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
              : 'bg-gradient-to-br from-brand-400 to-brand-600 text-white shadow-[0_12px_28px_rgba(247,44,91,0.32)] active:scale-[0.97]'
          }
          ${pulse && !disabled && !loading ? 'animate-pulse-cta' : ''}
        `}
      >
        <span className="flex items-center gap-2">
          {loading && <i className="fa-solid fa-spinner animate-spin" />}
          {continueLabel}
          {!loading && <ArrowRight size={16} />}
        </span>
        {costInfo && (
          <span className="md:hidden text-[10px] font-semibold opacity-90">
            {costInfo.cost} cr
            {costInfo.proCost !== undefined && costInfo.proCost > 0 ? ` + ${costInfo.proCost} ${costInfo.proLabel || 'especial'}` : ''}
          </span>
        )}
      </button>
      </div>
    </div>
  );
};

export default WizardFooter;
