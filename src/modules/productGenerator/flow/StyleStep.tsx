// Paso 2 de 2: cómo se va a ver. Primero la foto de inspiración (lo más común:
// "quiero algo como esto"), después los estilos. Un toque elige y avanza.
import React from 'react';
import { Check, ImagePlus } from 'lucide-react';
import type { WizardStyleState } from '../wizardTypes';
import type { ProductStyle } from '../productDirectorService';
import { STYLE_OPTIONS } from './styleOptions';
import { FlowHeading, FlowTopBar } from './ui';

interface StyleStepProps {
  state: WizardStyleState;
  pickImage: (onPicked: (dataUrl: string) => void) => void;
  onPickStyle: (style: ProductStyle) => void;
  onPickReference: (dataUrl: string) => void;
  onBack: () => void;
}

export const StyleStep: React.FC<StyleStepProps> = ({ state, pickImage, onPickStyle, onPickReference, onBack }) => {
  const hasRef = !!state.referenceImg;
  return (
    <div className="flex flex-col gap-4">
      <FlowTopBar title="Estilo" onBack={onBack} progress={{ current: 2, total: 2 }} />
      <FlowHeading>¿Cómo quieres que se vea?</FlowHeading>

      <button
        type="button"
        onClick={() => pickImage(onPickReference)}
        aria-pressed={hasRef}
        className="grid grid-cols-[96px_1fr] gap-3 items-center rounded-[20px] border-2 border-brand-600 bg-brand-50 p-2.5 text-left active:scale-[0.98] transition-transform duration-150"
      >
        <span className="aspect-[3/4] rounded-[14px] bg-white overflow-hidden flex items-center justify-center text-brand-700">
          {hasRef
            ? <img src={state.referenceImg!} alt="Tu foto de inspiración" className="w-full h-full object-cover" />
            : <ImagePlus size={28} />}
        </span>
        <span className="flex flex-col gap-1">
          <span className="self-start rounded-full bg-brand-600 px-2 py-0.5 text-[11px] font-bold text-white">
            {hasRef ? 'Elegida' : 'Recomendado'}
          </span>
          <b className="text-[15.5px] text-slate-900">
            {hasRef ? 'Tu foto de inspiración' : 'Tengo una foto de inspiración'}
          </b>
          <span className="text-[12.5px] leading-snug text-slate-700">
            {hasRef
              ? 'Toca para cambiarla.'
              : 'Una foto de Pinterest o Instagram que te guste. Copiamos su luz, su fondo y su ambiente con tu producto.'}
          </span>
        </span>
      </button>

      <p className="flex items-center gap-2.5 text-[12.5px] font-semibold text-slate-500 before:h-px before:flex-1 before:bg-slate-200 after:h-px after:flex-1 after:bg-slate-200">
        o elige un estilo
      </p>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
        {STYLE_OPTIONS.map((opt) => {
          const selected = !hasRef && state.preset === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onPickStyle(opt.id)}
              aria-pressed={selected}
              className={`rounded-[20px] overflow-hidden bg-white text-left outline outline-2 -outline-offset-2 active:scale-[0.97] transition-[transform,outline-color] duration-150 ${
                selected ? 'outline-brand-600' : 'outline-transparent shadow-[0_1px_0_#e2e8f0]'
              }`}
            >
              <span className="relative block aspect-[5/6] bg-slate-200">
                <img src={opt.img} alt="" className="w-full h-full object-cover" loading="lazy" />
                {selected && (
                  <span className="absolute right-2 top-2 w-[26px] h-[26px] rounded-full bg-brand-600 text-white flex items-center justify-center">
                    <Check size={16} strokeWidth={3} />
                  </span>
                )}
              </span>
              <span className="block px-3 pt-2 pb-3">
                <b className="block text-sm text-slate-900">{opt.title}</b>
                <span className="block text-xs leading-snug text-slate-500">{opt.desc}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
