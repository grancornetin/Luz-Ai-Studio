// Paso 1 de 2: la foto principal, el nombre y lo opcional (detalles y ángulos).
import React, { useEffect, useState } from 'react';
import { Check, RefreshCw, Plus, X, Info, Ruler, Lightbulb, SunDim } from 'lucide-react';
import type { WizardProductState } from '../wizardTypes';
import { FieldLabel, FlowTopBar, Hint, PrimaryButton, StickyActions } from './ui';

interface ProductStepProps {
  state: WizardProductState;
  onChange: (next: WizardProductState) => void;
  pickImage: (onPicked: (dataUrl: string) => void) => void;
  onBack: () => void;
  onContinue: () => void;
}

const EXTRA_ANGLES = [
  { idx: 1, label: 'Atrás' },
  { idx: 2, label: 'De lado' },
  { idx: 3, label: 'Detalle' },
];

// Revisión liviana en el teléfono (sin costo): ¿la foto está muy oscura?
function useBrightness(src: string | null): 'ok' | 'dark' | null {
  const [result, setResult] = useState<'ok' | 'dark' | null>(null);
  useEffect(() => {
    setResult(null);
    if (!src) return;
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 24; canvas.height = 24;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, 24, 24);
        const { data } = ctx.getImageData(0, 0, 24, 24);
        let sum = 0;
        for (let i = 0; i < data.length; i += 4) sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
        const mean = sum / (data.length / 4);
        if (!cancelled) setResult(mean < 60 ? 'dark' : 'ok');
      } catch { /* imagen sin permiso de lectura: no mostramos nada */ }
    };
    img.src = src;
    return () => { cancelled = true; };
  }, [src]);
  return result;
}

export const ProductStep: React.FC<ProductStepProps> = ({ state, onChange, pickImage, onBack, onContinue }) => {
  const main = state.slots[0];
  const brightness = useBrightness(main);
  const canContinue = !!main && state.title.trim().length > 0;

  const setSlot = (i: number, v: string | null) => {
    const next = [...state.slots];
    next[i] = v;
    onChange({ ...state, slots: next });
  };

  return (
    <div className="flex flex-col gap-5">
      <FlowTopBar title="Tu producto" onBack={onBack} progress={{ current: 1, total: 2 }} />

      <div className="relative aspect-[4/5] max-h-[52vh] md:max-h-none rounded-3xl overflow-hidden bg-slate-200 mx-auto w-full">
        {main && <img src={main} alt="Foto de tu producto" className="w-full h-full object-cover" />}
        {brightness === 'ok' && (
          <span className="absolute left-2.5 top-2.5 flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
            <Check size={14} strokeWidth={3} /> Se ve bien
          </span>
        )}
        {brightness === 'dark' && (
          <span className="absolute left-2.5 top-2.5 right-24 flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800">
            <SunDim size={14} /> Se ve oscura, con más luz sale mejor
          </span>
        )}
        <button
          type="button"
          onClick={() => pickImage((img) => setSlot(0, img))}
          className="absolute right-2.5 top-2.5 flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-[13px] font-semibold text-slate-900 active:scale-95 transition-transform duration-150"
        >
          <RefreshCw size={14} /> Cambiar
        </button>
      </div>

      <div>
        <FieldLabel htmlFor="pg-name">¿Cómo se llama tu producto?</FieldLabel>
        <input
          id="pg-name"
          type="text"
          value={state.title}
          onChange={(e) => onChange({ ...state, title: e.target.value })}
          placeholder="Ej: Botella térmica verde"
          autoComplete="off"
          autoCapitalize="sentences"
          enterKeyHint="next"
          className="w-full min-h-[52px] rounded-2xl border-[1.5px] border-slate-200 bg-white px-4 text-base font-medium text-slate-900 outline-none focus:border-brand-600 focus:ring-4 focus:ring-brand-50 transition-colors"
        />
        <Hint icon={<Info size={14} />}>Con 2 o 3 palabras basta. Nos ayuda a entender qué es.</Hint>
      </div>

      <div>
        <FieldLabel htmlFor="pg-desc" optional>¿Algo que no se vea en la foto?</FieldLabel>
        <input
          id="pg-desc"
          type="text"
          value={state.desc}
          onChange={(e) => onChange({ ...state, desc: e.target.value })}
          placeholder="Ej: mide 20 cm, es de acero mate"
          autoComplete="off"
          autoCapitalize="sentences"
          className="w-full min-h-[52px] rounded-2xl border-[1.5px] border-slate-200 bg-white px-4 text-base font-medium text-slate-900 outline-none focus:border-brand-600 focus:ring-4 focus:ring-brand-50 transition-colors"
        />
        <Hint icon={<Ruler size={14} />}>Tamaño, material o textura. Así sale del tamaño correcto y con la terminación real.</Hint>
      </div>

      <div>
        <FieldLabel optional>Suma otro ángulo</FieldLabel>
        <div className="grid grid-cols-3 gap-2">
          {EXTRA_ANGLES.map(({ idx, label }) => {
            const img = state.slots[idx];
            return img ? (
              <div key={idx} className="relative aspect-square rounded-2xl overflow-hidden bg-slate-200">
                <img src={img} alt={`Foto ${label}`} className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => setSlot(idx, null)}
                  aria-label={`Quitar foto ${label}`}
                  className="absolute right-1.5 top-1.5 w-8 h-8 rounded-full bg-white/95 text-slate-900 flex items-center justify-center active:scale-95"
                >
                  <X size={15} />
                </button>
                <span className="absolute left-1.5 bottom-1.5 rounded-full bg-white/95 px-2 py-0.5 text-[11px] font-bold text-slate-900">{label}</span>
              </div>
            ) : (
              <button
                key={idx}
                type="button"
                onClick={() => pickImage((v) => setSlot(idx, v))}
                className="aspect-square rounded-2xl border-[1.5px] border-dashed border-slate-300 bg-white text-slate-500 flex flex-col items-center justify-center gap-1 text-xs font-semibold hover:border-slate-400 active:scale-[0.97] transition-transform duration-150"
              >
                <Plus size={18} /> {label}
              </button>
            );
          })}
        </div>
        <Hint icon={<Lightbulb size={14} />}>Más ángulos ayudan a que tu producto salga igualito desde todos lados.</Hint>
      </div>

      <StickyActions>
        <PrimaryButton onClick={onContinue} disabled={!canContinue}>Continuar</PrimaryButton>
      </StickyActions>
    </div>
  );
};
