
import React from 'react';
import { Zap, Loader2 } from 'lucide-react';

interface GenerateControlsProps {
  onGenerate: () => void;
  isGenerating: boolean;
  disabled?: boolean;
}

const GenerateControls: React.FC<GenerateControlsProps> = ({ onGenerate, isGenerating, disabled }) => {
  return (
    <div className="flex items-center gap-4">
      <button
        onClick={onGenerate}
        disabled={isGenerating || disabled}
        className={`flex-1 py-6 rounded-[32px] font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-4 transition-all shadow-2xl active:scale-95 ${isGenerating || disabled ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-brand-600 text-white hover:bg-brand-700 shadow-brand-200'}`}
      >
        {isGenerating ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Sintetizando DNA...</span>
          </>
        ) : (
          <>
            <Zap className="w-5 h-5" />
            <span>Generar Imagen</span>
          </>
        )}
      </button>
    </div>
  );
};

export default GenerateControls;
