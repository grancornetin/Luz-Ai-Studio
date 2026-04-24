// src/components/shared/ModelSelector.tsx
// Selector de modelo de generación de imágenes.

import React from 'react';
import { Zap } from 'lucide-react';
import type { ModelId } from '../../services/imageApiService';

interface ModelSelectorProps {
  value:     ModelId;
  onChange:  (model: ModelId) => void;
  disabled?: boolean;
  className?: string;
}

// Icono de banana en SVG inline (no está en lucide-react)
const BananaIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 13c3.5-2 8-2 11 1" />
    <path d="M4 13C2 10 3 5 8 4c4-1 9 1 10 5" />
    <path d="M15 14c1.5 2 1.5 4-1 6" />
  </svg>
);

const MODELS: {
  id:      ModelId;
  label:   string;
  desc:    string;
  credits: number;
  icon:    React.ReactNode;
  color:   string;
  ring:    string;
}[] = [
  {
    id:      'gemini',
    label:   'Nano Banana 2',
    desc:    'Máxima calidad, referencias de imagen',
    credits: 2,
    icon:    <BananaIcon className="w-4 h-4" />,
    color:   'text-yellow-500',
    ring:    'ring-yellow-400 bg-yellow-50 border-yellow-200',
  },
  {
    id:      'seedream',
    label:   'Seedream 4.5',
    desc:    'Rápido y económico',
    credits: 1,
    icon:    <Zap className="w-4 h-4" />,
    color:   'text-emerald-600',
    ring:    'ring-emerald-500 bg-emerald-50 border-emerald-200',
  },
];

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  value,
  onChange,
  disabled = false,
  className = '',
}) => (
  <div className={`flex gap-2 ${className}`}>
    {MODELS.map(m => {
      const active = value === m.id;
      return (
        <button
          key={m.id}
          type="button"
          disabled={disabled}
          onClick={() => onChange(m.id)}
          className={`flex-1 flex items-center gap-2.5 px-3 py-2.5 rounded-2xl border transition-all text-left ${
            active
              ? `ring-2 ${m.ring} border-transparent`
              : 'border-slate-100 bg-white hover:border-slate-200'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <div className={`flex-shrink-0 ${active ? m.color : 'text-slate-300'}`}>
            {m.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-1">
              <span className={`text-[10px] font-black uppercase tracking-wide ${active ? 'text-slate-800' : 'text-slate-400'}`}>
                {m.label}
              </span>
              <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                active ? `${m.color} bg-white` : 'text-slate-300 bg-slate-50'
              }`}>
                {m.credits} cr.
              </span>
            </div>
            <p className={`text-[9px] font-medium leading-tight mt-0.5 ${active ? 'text-slate-500' : 'text-slate-300'}`}>
              {m.desc}
            </p>
          </div>
        </button>
      );
    })}
  </div>
);

export default ModelSelector;
