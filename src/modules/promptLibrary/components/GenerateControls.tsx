import React from 'react';
import { Zap, Loader2 } from 'lucide-react';
import { useModelSelection } from '../../../hooks/useModelSelection';
import { MODEL_CREDIT_COST } from '../../../services/creditConfig';

interface GenerateControlsProps {
  onGenerate:   () => void;
  isGenerating: boolean;
  disabled?:    boolean;
}

const GenerateControls: React.FC<GenerateControlsProps> = ({ onGenerate, isGenerating, disabled }) => {
  const { modelId } = useModelSelection();
  const cost = MODEL_CREDIT_COST[modelId];

  return (
    <div className="flex items-center gap-4">
      <button
        onClick={onGenerate}
        disabled={isGenerating || disabled}
        className={`flex-1 py-6 rounded-[32px] font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-all shadow-2xl active:scale-95 ${
          isGenerating || disabled
            ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
            : 'bg-brand-600 text-white hover:bg-brand-700 shadow-brand-200'
        }`}
      >
        {isGenerating ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Sintetizando DNA...</span>
          </>
        ) : (
          <>
            <span>Generar Imagen</span>
            <span className="flex items-center gap-1 bg-white/20 rounded-xl px-2.5 py-1">
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span className="text-[11px] font-black">{cost}</span>
            </span>
          </>
        )}
      </button>
    </div>
  );
};

export default GenerateControls;
