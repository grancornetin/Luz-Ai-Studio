// Listas: fotos grandes, guardado automático y siguiente paso.
import React, { useRef, useState } from 'react';
import {
  AlertTriangle, Check, CalendarDays, Download, Loader2, Palette, Plus, Share, UserRound,
} from 'lucide-react';
import { FlowShell } from '../../../components/shared/flow/FlowShell';
import {
  Footnote, GroupedList, GroupedRow, InlineBanner, LargeTitle, PhotoLayout, PrimaryButton, SectionTitle, TextButton,
} from '../../../components/shared/flow/primitives';

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

interface ResultsStepProps {
  productTitle: string;
  styleLabel: string;
  shots: string[];                 // 'error' = falló
  collage: string | null;
  aspectClass: string;
  retryingIndices: number[];
  isRetrying: boolean;
  isSavingToDevice: boolean;
  saveState: SaveState;
  saveErrorDetail?: string | null;  // solo admin: motivo técnico del fallo
  onRetrySave: () => void;
  onRetryFailed: () => void;
  onOpen: (url: string) => void;
  onDownload: (url: string, index: number) => void;
  onSaveToDevice: () => void;
  onUseWithAvatar: () => void;
  onMakeCampaign: () => void;
  onOtherStyle: () => void;
  onOtherProduct: () => void;
  onDone: () => void;
}

const iconTile = (icon: React.ReactNode) => (
  <span className="my-2.5 flex h-7 w-7 items-center justify-center rounded-[8px] bg-[color:var(--tint)] text-[color:var(--action)]">{icon}</span>
);

export const ResultsStep: React.FC<ResultsStepProps> = ({
  productTitle, styleLabel, shots, collage, aspectClass, retryingIndices, isRetrying, isSavingToDevice,
  saveState, saveErrorDetail, onRetrySave, onRetryFailed, onOpen, onDownload, onSaveToDevice,
  onUseWithAvatar, onMakeCampaign, onOtherStyle, onOtherProduct, onDone,
}) => {
  const okShots = shots.filter((s) => s && s !== 'error');
  const okCount = okShots.length + (collage ? 1 : 0);
  const failedCount = shots.filter((s) => s === 'error').length;
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [showDetail, setShowDetail] = useState(false);
  const cards = collage ? [...shots, collage] : shots;

  const onScroll = () => {
    const el = scrollerRef.current;
    const first = el?.firstElementChild as HTMLElement | null;
    if (!el || !first) return;
    setActive(Math.round(el.scrollLeft / (first.offsetWidth + 12)));
  };

  const renderCard = (url: string, i: number, aspect = aspectClass) => {
    const isCollage = !!collage && i === cards.length - 1;
    const retrying = retryingIndices.includes(i);
    const failed = url === 'error' && !retrying;
    return (
      <div className={`relative ${aspect} overflow-hidden rounded-[16px] bg-[color:var(--fill)] ${retrying ? 'photo-sweep' : ''}`}>
        {url && url !== 'error' && !retrying && (
          <>
            <button type="button" onClick={() => onOpen(url)} className="block h-full w-full" aria-label={`Ver foto ${i + 1} en grande`}>
              <img src={url} alt={`Foto ${i + 1} de ${productTitle}`} className="photo-reveal h-full w-full object-cover" style={{ animationDelay: `${i * 60}ms` }} />
            </button>
            {isCollage && (
              <span className="absolute bottom-3 left-3 rounded-full bg-black/55 px-2.5 py-1 text-[12px] font-semibold tracking-normal text-white backdrop-blur-md">Collage</span>
            )}
            <button
              type="button"
              onClick={() => onDownload(url, i)}
              aria-label={`Descargar foto ${i + 1}`}
              className="flow-press absolute bottom-2.5 right-2.5 flex h-10 w-10 items-center justify-center rounded-full bg-white/80 text-[color:var(--text)] shadow-[0_1px_3px_rgba(0,0,0,0.18)] backdrop-blur-xl"
            >
              <Download size={18} strokeWidth={2.2} />
            </button>
          </>
        )}
        {failed && (
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-6 text-center">
            <AlertTriangle size={22} className="text-[color:var(--placeholder)]" />
            <span className="text-[15px] font-semibold">No se pudo crear</span>
            <span className="text-[13px] tracking-normal text-[color:var(--text-2)]">Créditos devueltos</span>
          </span>
        )}
      </div>
    );
  };

  const count = okCount === 1 ? '1 foto' : `${okCount} fotos`;

  return (
    <FlowShell
      title="Listas"
      wide
      trailing={<TextButton onClick={onDone} className="text-[17px]">Listo</TextButton>}
      actions={okCount > 0 ? (
        <PrimaryButton onClick={onSaveToDevice} loading={isSavingToDevice} icon={<Share size={20} />}>
          Guardar en mi celular
        </PrimaryButton>
      ) : undefined}
    >
      <LargeTitle subtitle={[productTitle, styleLabel, count].filter(Boolean).join(' · ')}>
        {okCount === 0 ? 'No pudimos crear tus fotos' : okCount === 1 ? 'Tu foto está lista' : 'Tus fotos están listas'}
      </LargeTitle>

      <div className="mt-4">
        {cards.length >= 2 ? (
          <>
            {/* Celular: carrusel, la siguiente foto asoma 28px. Escritorio: grilla. */}
            <div
              ref={scrollerRef}
              onScroll={onScroll}
              className="flow-carousel -mx-4 min-[428px]:-mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 min-[428px]:px-5 md:hidden"
            >
              {cards.map((url, i) => (
                <div key={i} className="shrink-0 snap-start" style={{ width: 'calc(100vw - 32px - 28px)' }}>
                  {renderCard(url, i, collage && i === cards.length - 1 ? 'aspect-square' : aspectClass)}
                </div>
              ))}
              <span aria-hidden className="w-1 shrink-0" />
            </div>
            <div className="mt-3 flex justify-center gap-1.5 md:hidden" aria-hidden>
              {cards.map((_, i) => (
                <span key={i} className={`h-1.5 rounded-full transition-[width,background-color] duration-200 ${i === active ? 'w-[18px] bg-[color:var(--brand)]' : 'w-1.5 bg-[#D1D1D6]'}`} />
              ))}
            </div>
            <div className="hidden md:block">
              <PhotoLayout
                items={shots.map((url, i) => <React.Fragment key={i}>{renderCard(url, i)}</React.Fragment>)}
                trailingWide={collage ? renderCard(collage, cards.length - 1, 'aspect-square') : undefined}
              />
            </div>
          </>
        ) : cards.length === 1 ? (
          <div className="mx-auto w-full max-w-[min(520px,calc(62dvh*0.75))]">{renderCard(cards[0], 0)}</div>
        ) : null}
      </div>

      <div className="mt-3 min-h-[18px]">
        {saveState === 'saved' && (
          <Footnote icon={<Check size={15} strokeWidth={2.6} className="text-[color:var(--ok-fg)]" />}>{okCount === 1 ? 'Guardada' : 'Guardadas'} en Mi catálogo</Footnote>
        )}
        {saveState === 'saving' && (
          <Footnote icon={<Loader2 size={15} className="animate-spin" />}>Guardando en Mi catálogo…</Footnote>
        )}
      </div>

      {saveState === 'error' && (
        <div className="mt-2">
          <InlineBanner tone="warn" icon={<AlertTriangle size={20} />} action={{ label: 'Reintentar', onPress: onRetrySave }}>
            No pudimos guardarlas en tu catálogo. Tus fotos siguen aquí.
          </InlineBanner>
          {saveErrorDetail && (
            <button type="button" onClick={() => setShowDetail((v) => !v)} className="mt-1 text-[13px] tracking-normal text-[color:var(--text-2)] underline-offset-2 hover:underline">
              {showDetail ? saveErrorDetail : 'Detalle (solo admin)'}
            </button>
          )}
        </div>
      )}

      {failedCount > 0 && (
        <div className="mt-3">
          <InlineBanner
            tone="warn"
            icon={<AlertTriangle size={20} />}
            action={{ label: 'Reintentar', onPress: onRetryFailed, loading: isRetrying }}
          >
            {failedCount === 1 ? '1 foto no se pudo crear' : `${failedCount} fotos no se pudieron crear`} por un error. Ya te devolvimos sus créditos.
          </InlineBanner>
        </div>
      )}

      <SectionTitle>Siguiente paso</SectionTitle>
      <GroupedList>
        <GroupedRow inset={12} leading={iconTile(<UserRound size={17} />)} title="Ponla en manos de tu avatar" subtitle="Fotos para redes, con una persona" chevron onPress={onUseWithAvatar} />
        <GroupedRow inset={12} leading={iconTile(<CalendarDays size={17} />)} title="Arma una campaña de 7 días" subtitle="Fotos, textos y qué publicar cada día" chevron onPress={onMakeCampaign} />
        <GroupedRow inset={12} leading={iconTile(<Palette size={17} />)} title="Probar otro estilo" subtitle="Mismo producto, otro look" chevron onPress={onOtherStyle} />
        <GroupedRow inset={12} leading={iconTile(<Plus size={17} />)} title="Fotos de otro producto" chevron onPress={onOtherProduct} last />
      </GroupedList>
    </FlowShell>
  );
};
