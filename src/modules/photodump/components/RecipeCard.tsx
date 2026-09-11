/**
 * RecipeCard.tsx
 *
 * Card de receta para el paso 1 (elegir qué crear) — reemplaza el <button>
 * inline que hoy vive en PDStep1.tsx. Layout tomado del nuevo prototipo
 * (nuevo prototipo/photodump-flow-prototype/): icono en badge redondeado +
 * label + descripción + línea "NECESITAS: ..." — con la paleta/tipografía
 * actuales de la app (brand-*, slate-*), no las del mock (ver
 * PLAN_INTEGRACION.md, decisión 3: paleta/tipografía no negociables).
 *
 * "accent" permite diferenciar el modo libre (violeta) del resto de recetas
 * (brand) sin hardcodear el color acá — es información real (modo libre es
 * un camino distinto, no una receta más), no decoración.
 */
import React from 'react';
import { Check } from 'lucide-react';

export type RecipeCardAccent = 'brand' | 'violet';

const ACCENT_CLASSES: Record<RecipeCardAccent, {
  selectedBorder: string;
  selectedBg:     string;
  hoverBorder:    string;
  iconBgSel:      string;
  iconBg:         string;
  iconTextSel:    string;
  labelSel:       string;
  needLabel:      string;
  radioSel:       string;
}> = {
  brand: {
    selectedBorder: 'border-brand-600',
    selectedBg:     'bg-brand-50',
    hoverBorder:    'hover:border-slate-300',
    iconBgSel:      'bg-brand-600',
    iconBg:         'bg-slate-100',
    iconTextSel:    'text-white',
    labelSel:       'text-brand-900',
    needLabel:      'text-brand-600',
    radioSel:       'bg-brand-600',
  },
  violet: {
    selectedBorder: 'border-violet-600',
    selectedBg:     'bg-violet-50',
    hoverBorder:    'hover:border-violet-200',
    iconBgSel:      'bg-violet-600',
    iconBg:         'bg-violet-50',
    iconTextSel:    'text-white',
    labelSel:       'text-violet-900',
    needLabel:      'text-violet-600',
    radioSel:       'bg-violet-600',
  },
};

interface RecipeCardProps {
  icon:        React.ReactNode;
  label:       string;
  description: string;
  /** Ej. "Tu foto · Look completo" — resumen corto de qué se necesita. Omitir para no mostrar la línea. */
  need?:       string;
  selected:    boolean;
  onSelect:    () => void;
  accent?:     RecipeCardAccent;
}

export const RecipeCard: React.FC<RecipeCardProps> = ({
  icon, label, description, need, selected, onSelect, accent = 'brand',
}) => {
  const c = ACCENT_CLASSES[accent];

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex items-center gap-3.5 p-3.5 rounded-2xl border text-left transition-all ${
        selected
          ? `border-2 ${c.selectedBorder} ${c.selectedBg}`
          : `border border-slate-200 bg-white ${c.hoverBorder}`
      }`}
    >
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
        selected ? `${c.iconBgSel} ${c.iconTextSel}` : `${c.iconBg} text-slate-500`
      }`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-[13px] font-bold ${selected ? c.labelSel : 'text-slate-800'}`}>
          {label}
        </p>
        <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
          {description}
        </p>
        {need && (
          <p className={`text-[10px] font-bold uppercase tracking-[0.06em] mt-1.5 ${c.needLabel}`}>
            Necesitás: {need}
          </p>
        )}
      </div>
      <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
        selected ? `${c.radioSel} text-white` : 'border-2 border-slate-200'
      }`}>
        {selected && <Check size={10} strokeWidth={3} />}
      </div>
    </button>
  );
};

export default RecipeCard;
