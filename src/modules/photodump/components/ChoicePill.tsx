/**
 * ChoicePill.tsx
 *
 * Botón de opción tipo pill — patrón que hoy vive repetido e inline en
 * PDStep2Receta.tsx (docenas de <button className="..."> casi idénticos
 * para formato, intents, toggles de weeklyLooks, etc). Centralizado acá
 * como primer paso del rediseño (ver PLAN_INTEGRACION.md, Fase 2).
 *
 * Dos tamaños: 'compact' para grupos de muchas opciones en una fila
 * (formato de publicación, ej. "4:5 / 9:16 / 1:1"), 'card' para opciones
 * con descripción propia (ej. el toggle "¿Ropa o productos?" de
 * weeklyLooks, que hoy es un radio-button de texto simple a la espera de
 * este rediseño).
 */
import React from 'react';
import { Check } from 'lucide-react';

interface ChoicePillProps {
  label:       string;
  /** Solo para variant 'card' — texto de apoyo debajo del label. */
  hint?:       string;
  selected:    boolean;
  onSelect:    () => void;
  variant?:    'compact' | 'card';
}

export const ChoicePill: React.FC<ChoicePillProps> = ({
  label, hint, selected, onSelect, variant = 'compact',
}) => {
  if (variant === 'card') {
    return (
      <button
        type="button"
        onClick={onSelect}
        className={`text-left px-4 py-2.5 rounded-xl border transition-all ${
          selected
            ? 'border-brand-500 bg-brand-50/60 ring-2 ring-brand-100'
            : 'border-slate-200 bg-white hover:border-slate-300'
        }`}
      >
        <div className="flex items-center gap-2">
          <div className="text-sm font-bold text-slate-900">{label}</div>
          {selected && (
            <div className="w-4 h-4 rounded-full bg-brand-600 text-white flex items-center justify-center flex-shrink-0">
              <Check size={9} strokeWidth={3} />
            </div>
          )}
        </div>
        {hint && <div className="text-[11px] text-slate-500 mt-0.5">{hint}</div>}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`border rounded-xl px-3 py-2.5 text-[12px] font-semibold transition-all ${
        selected
          ? 'bg-brand-50 text-brand-700 border-brand-400'
          : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
      }`}
    >
      {label}
    </button>
  );
};

export default ChoicePill;
