// Estilo: un toque elige y avanza. La foto de inspiración va primera
// (lo más común: "quiero algo como esto"); con los 5 estilos quedan 6
// tarjetas en filas parejas (2 columnas en celular, 3 en tableta y computador).
// Computador: las 6 tarjetas llenan el lienzo; el panel muestra tu producto y
// describe el estilo que tienes bajo el mouse.
import React, { useState } from 'react';
import { Check, ImagePlus } from 'lucide-react';
import type { WizardStyleState } from '../wizardTypes';
import type { ProductStyle } from '../productDirectorService';
import { STYLE_OPTIONS } from './styleOptions';
import { PRODUCT_FLOW_STEPS } from './ProductStep';
import { FlowShell } from '../../../components/shared/flow/FlowShell';
import { FitGallery, Footnote, GroupedList, GroupedRow, LargeTitle } from '../../../components/shared/flow/primitives';
import { useFlowLayout } from '../../../components/shared/flow/layout';

interface StyleStepProps {
  state: WizardStyleState;
  pickImage: (onPicked: (dataUrl: string) => void) => void;
  onPickStyle: (style: ProductStyle) => void;
  onPickReference: (dataUrl: string) => void;
  onBack: () => void;
  /** Para el panel del computador. */
  productImg?: string | null;
  productTitle?: string;
}

const SelectedBadge = () => (
  <span className="photo-reveal absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-[color:var(--brand)] text-white shadow-[0_1px_3px_rgba(0,0,0,0.18)]">
    <Check size={14} strokeWidth={3} />
  </span>
);

const ring = (on: boolean) => (on ? 'ring-2 ring-[color:var(--brand)] ring-offset-2' : '');
const REF_HINT = 'La más fiel a lo que imaginas';

export const StyleStep: React.FC<StyleStepProps> = ({ state, pickImage, onPickStyle, onPickReference, onBack, productImg, productTitle }) => {
  const layout = useFlowLayout();
  const wide = layout === 'wide';
  const hasRef = !!state.referenceImg;
  const [hovered, setHovered] = useState<ProductStyle | 'ref' | null>(null);

  // En el lienzo del computador la tarjeta llena su celda: foto flexible + texto.
  const imgBox = wide ? 'min-h-0 flex-1' : 'aspect-[4/5]';
  const cardCls = `flow-press flow-card text-left ${wide ? 'flex h-full w-full flex-col' : ''}`;
  const hover = (id: ProductStyle | 'ref') => (wide ? { onMouseEnter: () => setHovered(id), onMouseLeave: () => setHovered(null) } : {});

  const cards = [
    <button key="ref" type="button" onClick={() => pickImage(onPickReference)} aria-pressed={hasRef} className={cardCls} {...hover('ref')}>
      <span className={`relative flex ${imgBox} items-center justify-center overflow-hidden rounded-[16px] bg-[color:var(--tint)] text-[color:var(--action)] ${ring(hasRef)}`}>
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
      <span className={`block text-[13px] leading-[18px] tracking-normal text-[color:var(--text-2)] ${wide ? 'truncate' : ''}`}>
        {hasRef ? 'Toca para cambiarla' : REF_HINT}
      </span>
    </button>,
    ...STYLE_OPTIONS.map((opt) => {
      const selected = !hasRef && state.preset === opt.id;
      return (
        <button key={opt.id} type="button" onClick={() => onPickStyle(opt.id)} aria-pressed={selected} className={cardCls} {...hover(opt.id)}>
          <span className={`relative block ${imgBox} overflow-hidden rounded-[16px] bg-[color:var(--fill)] ${ring(selected)}`}>
            <img src={opt.img} alt="" className="h-full w-full object-cover" loading="lazy" />
            {selected && <SelectedBadge />}
          </span>
          <span className="mt-2 block text-[15px] font-semibold leading-5">{opt.title}</span>
          <span className={`block text-[13px] leading-[18px] tracking-normal text-[color:var(--text-2)] ${wide ? 'truncate' : ''}`}>{opt.desc}</span>
        </button>
      );
    }),
  ];

  // Lo que describe el panel: lo que está bajo el mouse, si no lo elegido.
  const focus = hovered ?? (hasRef ? 'ref' : state.preset);
  const focusOpt = focus && focus !== 'ref' ? STYLE_OPTIONS.find((s) => s.id === focus) : null;

  return (
    <FlowShell
      title="Estilo"
      leading={{ kind: 'back', onPress: onBack }}
      progress={2 / 3}
      steps={{ labels: PRODUCT_FLOW_STEPS, current: 1 }}
      aside={wide ? <FitGallery ratio={0.7} gap={20} items={cards} /> : undefined}
    >
      <LargeTitle subtitle={wide ? 'Toca un estilo. Puedes cambiarlo después.' : undefined}>¿Cómo quieres que se vea?</LargeTitle>

      {wide ? (
        <>
          {(productImg || productTitle) && (
            <GroupedList className="mt-6">
              <GroupedRow
                inset={12}
                last
                leading={(
                  <span className="my-2 block h-[60px] w-12 overflow-hidden rounded-[8px] bg-white">
                    {productImg && <img src={productImg} alt="" className="h-full w-full object-cover" />}
                  </span>
                )}
                title={productTitle || 'Tu producto'}
                subtitle="Producto"
              />
            </GroupedList>
          )}
          <div className="mt-8 min-h-[72px]" aria-live="polite">
            {focus === 'ref' ? (
              <>
                <p className="text-[17px] font-semibold leading-[22px]">Tu inspiración</p>
                <p className="mt-1 text-[15px] leading-[21px] text-[color:var(--text-2)]">Sube una foto que te guste y la recreamos con tu producto. {REF_HINT}.</p>
              </>
            ) : focusOpt ? (
              <>
                <p className="text-[17px] font-semibold leading-[22px]">{focusOpt.title}</p>
                <p className="mt-1 text-[15px] leading-[21px] text-[color:var(--text-2)]">{focusOpt.desc}</p>
              </>
            ) : (
              <Footnote>Pasa el mouse sobre un estilo para ver de qué se trata.</Footnote>
            )}
          </div>
        </>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-4 md:grid-cols-3">{cards}</div>
      )}
    </FlowShell>
  );
};
