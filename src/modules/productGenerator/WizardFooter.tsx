import React from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';

interface WizardFooterProps {
  onBack?: () => void;
  onContinue: () => void;
  continueLabel: string;
  disabled?: boolean;
  costInfo?: { cost: number; label?: string };
  loading?: boolean;
}

export const WizardFooter: React.FC<WizardFooterProps> = ({
  onBack,
  onContinue,
  continueLabel,
  disabled = false,
  costInfo,
  loading = false,
}) => {
  return (
    <div
      className="sticky bottom-0 z-10 bg-white border-t border-slate-200 px-4 md:px-7 py-3 md:py-3.5 flex items-center gap-3"
      style={{ boxShadow: '0 -8px 24px rgba(15,23,42,0.04)' }}
    >
      {/* Back button */}
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

      <div className="flex-1" />

      {/* Cost info — desktop only */}
      {costInfo && (
        <div className="hidden md:block text-right mr-1">
          <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
            {costInfo.label || 'Costo total'}
          </div>
          <div className="t-display text-[22px] text-slate-900 leading-none mt-0.5">
            {costInfo.cost} <span className="text-xs text-slate-500 font-semibold normal-case">cr</span>
          </div>
        </div>
      )}

      {/* Continue / Generate */}
      <button
        type="button"
        onClick={onContinue}
        disabled={disabled || loading}
        style={{ touchAction: 'manipulation' }}
        className={`
          flex flex-col items-center justify-center gap-0.5 rounded-xl transition-colors duration-150
          px-5 md:px-7 py-3 md:py-3.5 min-h-12 min-w-[140px] md:min-w-[180px]
          text-sm font-semibold
          ${
            disabled || loading
              ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
              : 'bg-gradient-to-br from-violet-600 to-pink-600 text-white shadow-[0_12px_28px_rgba(124,58,237,0.32)] active:scale-[0.98]'
          }
        `}
      >
        <span className="flex items-center gap-2">
          {loading ? (
            <i className="fa-solid fa-spinner animate-spin" />
          ) : null}
          {continueLabel}
          {!loading && <ArrowRight size={16} />}
        </span>
        {/* Mobile cost line */}
        {costInfo && (
          <span className="md:hidden text-[10px] font-semibold opacity-90">
            {costInfo.cost} cr
          </span>
        )}
      </button>
    </div>
  );
};

export default WizardFooter;
