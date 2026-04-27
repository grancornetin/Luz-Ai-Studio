// src/components/shared/GenerateButton.tsx
// Botón de generación con indicador visual de costo en créditos y créditos restantes.
// Muestra el ícono ⚡ + costo total + "→ te quedarán X créditos".

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
  /** Costo fijo total (ignora imageCount y modelo). Útil cuando el caller ya calculó el total. */
  fixedCost?:    number;
  /** Créditos que quedarán después de la generación. Si no se pasa, no se muestra el preview. */
  creditsAfter?: number;
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
  fixedCost,
  creditsAfter,
  className  = '',
}) => {
  const { modelId } = useModelSelection();
  const effectiveModel = fixedModel || modelId;
  const creditCost = fixedCost !== undefined
    ? fixedCost
    : imageCount * MODEL_CREDIT_COST[effectiveModel];

  // Si se proporciona creditsAfter, mostramos preview completo; si no, solo el costo.
  const showPreview = typeof creditsAfter === 'number' && !loading;

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`w-full flex flex-col items-center justify-center gap-1.5 py-4 bg-brand-600 text-white rounded-2xl font-black text-xs uppercase tracking-wide hover:bg-brand-700 active:scale-95 transition-all shadow-xl shadow-brand-100 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 ${className}`}
    >
      {loading ? (
        <>
          <i className="fa-solid fa-spinner animate-spin" />
          <span>{loadingLabel}</span>
        </>
      ) : (
        <>
          {/* Línea principal: etiqueta + costo */}
          <div className="flex items-center justify-center gap-2.5">
            <span>{label}</span>
            <span className="flex items-center gap-1 bg-white/20 rounded-xl px-2 py-0.5">
              <Zap className="w-3 h-3 fill-current" />
              <span className="text-[10px] font-black">{creditCost}</span>
            </span>
          </div>

          {/* Línea secundaria: créditos restantes (opcional) */}
          {showPreview && (
            <div className="text-[9px] font-bold text-white/80">
              → te quedarán {creditsAfter} créditos
            </div>
          )}
        </>
      )}
    </button>
  );
};

export default GenerateButton;