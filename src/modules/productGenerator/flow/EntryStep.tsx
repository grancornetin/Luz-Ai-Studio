// Entrada: qué vas a lograr, cuánto demora y cuánto cuesta.
// El botón principal abre directo el selector de fotos del teléfono.
import React from 'react';
import { Camera, Package } from 'lucide-react';
import { FlowShell } from '../../../components/shared/flow/FlowShell';
import { ActionCaption, Footnote, LargeTitle, PrimaryButton, TextButton } from '../../../components/shared/flow/primitives';
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
}

// Los cuatro ejemplos son la promesa: así pueden quedar sus fotos.
const EXAMPLES = ['natural', 'premium', 'dark', 'minimal'].map((id) => STYLE_OPTIONS.find((s) => s.id === id)!);

export const EntryStep: React.FC<EntryStepProps> = ({
  defaultCost, creditsAvailable, hasCatalog, isPicking, onUpload, onUseCatalog, onOpenCatalog, onClose,
}) => (
  <FlowShell
    title="Fotos de producto"
    leading={{ kind: 'close', onPress: onClose }}
    trailing={
      <button
        type="button"
        onClick={onOpenCatalog}
        aria-label="Mi catálogo"
        className="w-11 h-11 flex items-center justify-center rounded-full text-[color:var(--action)] active:opacity-60 transition-opacity duration-100"
      >
        <Package size={22} strokeWidth={2} />
      </button>
    }
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

    <div className="mt-4 grid grid-cols-2 gap-3" aria-label="Ejemplos de fotos">
      {EXAMPLES.map((ex) => (
        <figure key={ex.id} className="relative m-0 aspect-[4/5] overflow-hidden rounded-[16px] bg-[color:var(--fill)]">
          <img src={ex.img} alt={`Ejemplo estilo ${ex.title}`} className="h-full w-full object-cover" loading="lazy" />
          <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-b from-transparent to-black/45 px-3 pb-2.5 pt-8 text-[13px] font-semibold tracking-normal text-white">
            {ex.title}
          </figcaption>
        </figure>
      ))}
    </div>

    <Footnote className="mt-4 text-[15px] leading-5">Con 1 foto tuya · listas en unos 2 minutos</Footnote>
  </FlowShell>
);
