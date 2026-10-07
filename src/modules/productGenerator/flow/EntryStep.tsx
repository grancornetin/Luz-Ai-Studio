// Pantalla de entrada: qué va a lograr, cuánto demora y cuánto cuesta.
// El botón principal abre directo el selector de fotos del teléfono.
import React from 'react';
import { Camera, Images, Timer, Package, Loader2 } from 'lucide-react';
import { EXAMPLE_IMAGES, STYLE_OPTIONS } from './styleOptions';
import { FlowHeading, PrimaryButton, SecondaryButton, StickyActions } from './ui';

interface EntryStepProps {
  defaultCost: number;
  creditsAvailable: number;
  hasCatalog: boolean;
  isPicking: boolean;
  onUpload: () => void;
  onUseCatalog: () => void;
}

const EXAMPLE_LABELS = ['Natural', 'Premium', 'Oscuro', 'Minimalista'];

export const EntryStep: React.FC<EntryStepProps> = ({
  defaultCost, creditsAvailable, hasCatalog, isPicking, onUpload, onUseCatalog,
}) => (
  <div className="flex flex-col gap-4">
    <div>
      <FlowHeading>Fotos que venden, desde tu celular</FlowHeading>
      <p className="mt-2 text-[15px] text-slate-500 leading-relaxed">
        Sube una foto de tu producto y recibe 4 fotos listas para tu tienda y tus redes.
      </p>
    </div>

    <div className="-mx-4 px-4 flex gap-2.5 overflow-x-auto snap-x snap-mandatory scrollbar-hide md:mx-0 md:px-0 md:grid md:grid-cols-4 md:overflow-visible" aria-label="Ejemplos de fotos">
      {EXAMPLE_IMAGES.map((src, i) => (
        <div key={src} className="relative shrink-0 w-[46%] md:w-auto aspect-[3/4] rounded-[20px] overflow-hidden bg-slate-200 snap-start">
          <img src={src} alt={`Ejemplo estilo ${EXAMPLE_LABELS[i]}`} className="w-full h-full object-cover" loading="lazy" />
          <span className="absolute left-2.5 bottom-2.5 rounded-full bg-white/95 px-2.5 py-0.5 text-xs font-bold text-slate-900">
            {EXAMPLE_LABELS[i] ?? STYLE_OPTIONS[i]?.title}
          </span>
        </div>
      ))}
    </div>

    <div className="grid grid-cols-3 gap-2">
      {[
        { icon: <Camera size={18} />, title: '1 foto tuya',   sub: 'con el celular basta' },
        { icon: <Images size={18} />, title: '4 fotos listas', sub: 'en el estilo que elijas' },
        { icon: <Timer size={18} />,  title: '2 minutos',      sub: 'aprox.' },
      ].map((f) => (
        <div key={f.title} className="rounded-2xl border border-slate-200 bg-white p-2.5 flex flex-col gap-1">
          <span className="text-brand-600">{f.icon}</span>
          <b className="text-[13.5px] leading-tight text-slate-900">{f.title}</b>
          <span className="text-[11.5px] leading-tight text-slate-500">{f.sub}</span>
        </div>
      ))}
    </div>

    <StickyActions>
      <PrimaryButton onClick={onUpload} disabled={isPicking}>
        {isPicking ? <Loader2 size={20} className="animate-spin" /> : <Camera size={20} />}
        {isPicking ? 'Preparando tu foto…' : 'Subir foto de mi producto'}
      </PrimaryButton>
      {hasCatalog && (
        <SecondaryButton onClick={onUseCatalog}>
          <Package size={18} />
          Usar uno de mi catálogo
        </SecondaryButton>
      )}
      <p className="text-center text-[13px] text-slate-500">
        {defaultCost} créditos · <b className="text-slate-900 tabular-nums">tienes {creditsAvailable}</b>
      </p>
    </StickyActions>
  </div>
);
