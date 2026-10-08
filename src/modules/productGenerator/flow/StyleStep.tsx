// Estilo: un toque elige y avanza. La foto de inspiración va primera
// (lo más común: "quiero algo como esto"); con los 5 estilos quedan 6
// tarjetas en filas parejas.
import React from 'react';
import { Check, ImagePlus } from 'lucide-react';
import type { WizardStyleState } from '../wizardTypes';
import type { ProductStyle } from '../productDirectorService';
import { STYLE_OPTIONS } from './styleOptions';
import { FlowShell } from '../../../components/shared/flow/FlowShell';
import { LargeTitle } from '../../../components/shared/flow/primitives';

interface StyleStepProps {
  state: WizardStyleState;
  pickImage: (onPicked: (dataUrl: string) => void) => void;
  onPickStyle: (style: ProductStyle) => void;
  onPickReference: (dataUrl: string) => void;
  onBack: () => void;
}

const SelectedBadge = () => (
  <span className="photo-reveal absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-[color:var(--brand)] text-white shadow-[0_1px_3px_rgba(0,0,0,0.18)]">
    <Check size={14} strokeWidth={3} />
  </span>
);

const ring = (on: boolean) => (on ? 'ring-2 ring-[color:var(--brand)] ring-offset-2' : '');

export const StyleStep: React.FC<StyleStepProps> = ({ state, pickImage, onPickStyle, onPickReference, onBack }) => {
  const hasRef = !!state.referenceImg;
  return (
    <FlowShell title="Estilo" leading={{ kind: 'back', onPress: onBack }} progress={2 / 3}>
      <LargeTitle>¿Cómo quieres que se vea?</LargeTitle>

      <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-4 md:grid-cols-3">
        <button type="button" onClick={() => pickImage(onPickReference)} aria-pressed={hasRef} className="flow-press text-left">
          <span className={`relative flex aspect-[4/5] items-center justify-center overflow-hidden rounded-[16px] bg-[color:var(--tint)] text-[color:var(--action)] ${ring(hasRef)}`}>
            {hasRef ? (
              <img src={state.referenceImg!} alt="Tu foto de inspiración" className="h-full w-full object-cover" />
            ) : (
              <span className="flex flex-col items-center gap-2 px-4 text-center">
                <ImagePlus size={30} strokeWidth={1.8} />
                <span className="text-[13px] font-semibold leading-[17px] tracking-normal">Subir foto de inspiración</span>
              </span>
            )}
            {hasRef && <SelectedBadge />}
          </span>
          <span className="mt-2 block text-[15px] font-semibold leading-5">Tu inspiración</span>
          <span className="block text-[13px] leading-[18px] tracking-normal text-[color:var(--text-2)]">
            {hasRef ? 'Toca para cambiarla' : 'La más fiel a lo que imaginas'}
          </span>
        </button>

        {STYLE_OPTIONS.map((opt) => {
          const selected = !hasRef && state.preset === opt.id;
          return (
            <button key={opt.id} type="button" onClick={() => onPickStyle(opt.id)} aria-pressed={selected} className="flow-press text-left">
              <span className={`relative block aspect-[4/5] overflow-hidden rounded-[16px] bg-[color:var(--fill)] ${ring(selected)}`}>
                <img src={opt.img} alt="" className="h-full w-full object-cover" loading="lazy" />
                {selected && <SelectedBadge />}
              </span>
              <span className="mt-2 block text-[15px] font-semibold leading-5">{opt.title}</span>
              <span className="block text-[13px] leading-[18px] tracking-normal text-[color:var(--text-2)]">{opt.desc}</span>
            </button>
          );
        })}
      </div>
    </FlowShell>
  );
};
