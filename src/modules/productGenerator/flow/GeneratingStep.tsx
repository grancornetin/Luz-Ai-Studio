// Creando: las fotos aparecen una a una; se avisa que puede salir.
// Tableta y computador: los espacios de foto se ajustan al alto disponible
// (en computador llenan el lienzo) y el estado va en el panel.
import React from 'react';
import { Bell } from 'lucide-react';
import { FlowShell } from '../../../components/shared/flow/FlowShell';
import { FitGallery, Footnote, LargeTitle, PhotoLayout, ProgressBar, TextButton, useEstimatedProgress } from '../../../components/shared/flow/primitives';
import { useFlowLayout } from '../../../components/shared/flow/layout';

interface GeneratingStepProps {
  shots: string[];          // '' en curso, 'error' fallida, url lista
  collage?: string | null;
  withCollage: boolean;
  aspectClass: string;
  statusText: string;
  running: boolean;
  onExit: () => void;
}

/** Proporción numérica de la clase de aspecto de las tarjetas. */
export const ratioOf = (aspectClass: string) => (aspectClass === 'aspect-square' ? 1 : 0.75);

// onStage: sobre el lienzo gris del computador el espacio vacío va un tono más oscuro.
const Slot: React.FC<{ src: string; aspectClass: string; label?: string; index: number; contain?: boolean; onStage?: boolean }> = ({ src, aspectClass, label, index, contain, onStage }) => (
  <div className={`relative ${aspectClass} overflow-hidden rounded-[16px] ${onStage ? 'bg-[color:var(--fill-pressed)]' : 'bg-[color:var(--fill)]'} ${src === '' ? 'photo-sweep' : ''}`}>
    {src && src !== 'error' && (
      <img src={src} alt={`Foto ${index + 1}`} className={`photo-reveal h-full w-full ${contain ? 'object-contain' : 'object-cover'}`} />
    )}
    {src === 'error' && (
      <span className="absolute inset-0 flex items-center justify-center px-3 text-center text-[13px] font-medium tracking-normal text-[color:var(--text-2)]">
        No se pudo crear
      </span>
    )}
    {label && <span className="absolute bottom-2 left-2 rounded-full bg-black/55 px-2.5 py-1 text-[12px] font-semibold tracking-normal text-white backdrop-blur-md">{label}</span>}
  </div>
);

export const GeneratingStep: React.FC<GeneratingStepProps> = ({ shots, collage, withCollage, aspectClass, statusText, running, onExit }) => {
  const layout = useFlowLayout();
  const total = shots.length + (withCollage ? 1 : 0);
  const done = shots.filter((s) => s !== '').length + (collage ? 1 : 0);
  // Una foto de producto tarda alrededor de un minuto en total.
  const progress = useEstimatedProgress(running, done, total, 60);

  // Tableta y computador: la celda manda el tamaño; el collage se ve entero.
  const fitted = (
    <FitGallery
      ratio={ratioOf(aspectClass)}
      gap={layout === 'wide' ? 16 : 12}
      items={shots.map((s, i) => <Slot key={i} src={s} index={i} aspectClass="h-full w-full" onStage={layout === 'wide'} />)}
      trailing={withCollage ? <Slot src={collage ?? ''} index={shots.length} aspectClass="h-full w-full" label="Collage" contain onStage={layout === 'wide'} /> : undefined}
    />
  );

  return (
    <FlowShell
      title="Creando tus fotos"
      trailing={<TextButton onClick={onExit} className="text-[17px] font-normal">Salir</TextButton>}
      aside={layout === 'wide' ? fitted : undefined}
    >
      <LargeTitle>Creando tus fotos</LargeTitle>
      <p key={statusText} className="photo-reveal mt-1 text-[16px] leading-6 text-[color:var(--text-2)]" aria-live="polite">{statusText}</p>
      <div className="mt-4">
        <ProgressBar value={progress} label="Progreso de tus fotos" />
      </div>

      {layout === 'compact' && (
        <div className="mt-6">
          <PhotoLayout
            items={shots.map((s, i) => <Slot key={i} src={s} index={i} aspectClass={aspectClass} />)}
            trailingWide={withCollage ? <Slot src={collage ?? ''} index={shots.length} aspectClass="aspect-square" label="Collage" /> : undefined}
          />
        </div>
      )}
      {layout === 'regular' && <div className="mt-6 flex h-[max(320px,calc(100dvh-420px))] flex-col">{fitted}</div>}

      <Footnote className={layout === 'wide' ? 'mt-6' : 'mt-5'} icon={<Bell size={15} />}>
        Puedes salir de la app. Te avisamos cuando estén listas.
      </Footnote>
    </FlowShell>
  );
};
