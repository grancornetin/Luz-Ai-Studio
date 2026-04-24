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

const BananaIcon: React.FC<{ className?: string }> = () => (
  <span style={{ fontSize: 16, lineHeight: 1 }}>🍌</span>
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
  <div className={`space-y-1.5 ${className}`}>
    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">
      Modelo de IA · activo: <span className="text-slate-700">{MODELS.find(m => m.id === value)?.label}</span>
    </p>
    <div className="flex gap-2">
      {MODELS.map(m => {
        const active = value === m.id;
        return (
          <button
            key={m.id}
            type="button"
            disabled={disabled}
            onClick={() => onChange(m.id)}
            className={`flex-1 flex items-center gap-2.5 px-3 py-3 rounded-2xl border-2 transition-all text-left ${
              active
                ? `${m.ring} shadow-md`
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
                <span className={`text-[9px] font-black px-2 py-0.5 rounded-full flex-shrink-0 ${
                  active ? `${m.color} bg-white border border-current` : 'text-slate-300 bg-slate-50'
                }`}>
                  {m.credits} cr.
                </span>
              </div>
              <p className={`text-[9px] font-medium leading-tight mt-0.5 ${active ? 'text-slate-500' : 'text-slate-300'}`}>
                {m.desc}
              </p>
            </div>
            {active && (
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${m.id === 'gemini' ? 'bg-yellow-400' : 'bg-emerald-400'} animate-pulse`} />
            )}
          </button>
        );
      })}
    </div>
  </div>
);

export default ModelSelector;
