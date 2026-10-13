// Entrada: qué vas a lograr, cuánto demora y cuánto cuesta.
// El botón principal abre directo el selector de fotos del teléfono.
// Computador: los ejemplos llenan el lienzo y la bienvenida va centrada a la
// derecha; se puede soltar una foto sobre la ventana o pulsar Enter.
import React from 'react';
import { Camera, Package } from 'lucide-react';
import { FlowShell } from '../../../components/shared/flow/FlowShell';
import { ActionCaption, FitGallery, Footnote, LargeTitle, NavButton, PrimaryButton, TextButton } from '../../../components/shared/flow/primitives';
import { useFlowLayout, usePrecisePointer } from '../../../components/shared/flow/layout';
import ModuleTutorial from '../../../components/shared/ModuleTutorial';
import { TUTORIAL_CONFIGS } from '../../../components/shared/tutorialConfigs';
import { STYLE_OPTIONS } from './styleOptions';

interface EntryStepProps {
  defaultCost: number;
  creditsAvailable: number;
  hasCatalog: boolean;
  isPicking: boolean;
  onUpload: () => void;
  onUseCatalog: () => void;
  onOpenCatalog: () => void;
  onClose: () => void;
  /** Foto soltada sobre la ventana (tableta/computador con mouse). */
  onDropPhoto?: (file: File) => void;
}

// Los cuatro ejemplos son la promesa: así pueden quedar sus fotos.
const EXAMPLES = ['natural', 'premium', 'dark', 'minimal'].map((id) => STYLE_OPTIONS.find((s) => s.id === id)!);

const ExampleCard: React.FC<{ ex: typeof EXAMPLES[number]; fill?: boolean }> = ({ ex, fill }) => (
  <figure className={`relative m-0 overflow-hidden rounded-[16px] bg-[color:var(--fill)] ${fill ? 'h-full w-full' : 'aspect-[4/5]'}`}>
    <img src={ex.img} alt={`Ejemplo estilo ${ex.title}`} className="h-full w-full object-cover" loading="lazy" />
    <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-b from-transparent to-black/45 px-3 pb-2.5 pt-8 text-[13px] font-semibold tracking-normal text-white">
      {ex.title}
    </figcaption>
  </figure>
);

export const EntryStep: React.FC<EntryStepProps> = ({
  defaultCost, creditsAvailable, hasCatalog, isPicking, onUpload, onUseCatalog, onOpenCatalog, onClose, onDropPhoto,
}) => {
  const layout = useFlowLayout();
  const compact = layout === 'compact';
  const wide = layout === 'wide';
  const fine = usePrecisePointer();

  const gallery = (
    <FitGallery ratio={0.8} gap={wide ? 16 : 12} items={EXAMPLES.map((ex) => <ExampleCard key={ex.id} ex={ex} fill />)} />
  );

  return (
    <FlowShell
      title="Fotos de producto"
      leading={{ kind: 'close', onPress: onClose }}
      layout="hero"
      aside={wide ? gallery : undefined}
      onEnter={isPicking ? undefined : onUpload}
      onDropFile={onDropPhoto}
      trailing={<NavButton icon={<Package size={compact ? 22 : 18} strokeWidth={2} />} label="Mi catálogo" onPress={onOpenCatalog} />}
      actions={
        <>
          <PrimaryButton onClick={onUpload} loading={isPicking} icon={<Camera size={20} />}>
            {isPicking ? 'Preparando tu foto…' : 'Subir foto de mi producto'}
          </PrimaryButton>
          {hasCatalog && <TextButton onClick={onUseCatalog} className="flow-kb-hide">Usar uno de mi catálogo</TextButton>}
          <ActionCaption>{defaultCost} créditos · tienes {creditsAvailable}</ActionCaption>
        </>
      }
    >
      <LargeTitle display subtitle="Sube una foto y recibe 4 listas para tu tienda y tus redes.">
        Fotos de producto
      </LargeTitle>
      <ModuleTutorial
        moduleId="catalog"
        steps={TUTORIAL_CONFIGS.catalog}
        autoOpen={false}
        renderTrigger={(open) => (
          <TextButton onClick={open} className="-ml-3 mt-1 text-[15px]">¿Cómo funciona?</TextButton>
        )}
      />

      {compact && (
        <div className="mt-4 grid grid-cols-2 gap-3" aria-label="Ejemplos de fotos">
          {EXAMPLES.map((ex) => <ExampleCard key={ex.id} ex={ex} />)}
        </div>
      )}

      {/* Tableta: los ejemplos ocupan el alto que queda, sin empujar el botón */}
      {layout === 'regular' && (
        <div className="mt-5 flex h-[max(300px,calc(100dvh-520px))] flex-col" aria-label="Ejemplos de fotos">
          {gallery}
        </div>
      )}

      <Footnote className="mt-4 text-[15px] leading-5">Con 1 foto tuya · listas en unos 2 minutos</Footnote>
      {!compact && fine && onDropPhoto && (
        <Footnote className="mt-1.5">También puedes arrastrar la foto a esta ventana.</Footnote>
      )}
    </FlowShell>
  );
};
