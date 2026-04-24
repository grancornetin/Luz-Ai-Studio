// src/components/shared/GenerateButton.tsx
// Botón de generación con indicador visual de costo en créditos.
// Muestra el ícono ⚡ + costo según el modelo activo globalmente.

import React from 'react';
import { Zap } from 'lucide-react';
import { useModelSelection } from '../../hooks/useModelSelection';
import { MODEL_CREDIT_COST } from '../../services/creditConfig';

interface GenerateButtonProps {
  onClick:       () => void;
  loading?:      boolean;
  disabled?:     boolean;
  label?:        string;
  loadingLabel?: string;
  /** Número de imágenes que genera esta acción (para calcular costo total). */
  imageCount?:   number;
  /** Si true, el costo no varía con el modelo (ej: Model DNA siempre Gemini). */
  fixedModel?:   'gemini' | 'seedream';
  className?:    string;
}

export const GenerateButton: React.FC<GenerateButtonProps> = ({
  onClick,
  loading    = false,
  disabled   = false,
  label      = 'Generar',
  loadingLabel = 'Generando...',
  imageCount = 1,
  fixedModel,
  className  = '',
}) => {
  const { modelId } = useModelSelection();
  const effectiveModel = fixedModel || modelId;
  const creditCost = imageCount * MODEL_CREDIT_COST[effectiveModel];

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`w-full flex items-center justify-center gap-2.5 py-4 bg-brand-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-brand-700 active:scale-95 transition-all shadow-xl shadow-brand-100 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 ${className}`}
    >
      {loading ? (
        <>
          <i className="fa-solid fa-spinner animate-spin" />
          <span>{loadingLabel}</span>
        </>
      ) : (
        <>
          <span>{label}</span>
          <span className="flex items-center gap-1 bg-white/20 rounded-xl px-2 py-0.5">
            <Zap className="w-3 h-3 fill-current" />
            <span className="text-[10px] font-black">{creditCost}</span>
          </span>
        </>
      )}
    </button>
  );
};

export default GenerateButton;
