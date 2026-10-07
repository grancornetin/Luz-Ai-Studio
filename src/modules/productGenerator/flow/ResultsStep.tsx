// Resultado: fotos grandes, guardado automático y qué hacer ahora.
import React, { useRef, useState } from 'react';
import {
  X, Check, Download, Loader2, RefreshCw, AlertTriangle, UserRound, CalendarDays, Palette, Plus, ChevronRight,
} from 'lucide-react';
import { FlowHeading, SecondaryButton } from './ui';

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

interface ResultsStepProps {
  productTitle: string;
  shots: string[];                 // 'error' = falló
  collage: string | null;
  aspectClass: string;
  retryingIndices: number[];
  isRetrying: boolean;
  isZipping: boolean;
  saveState: SaveState;
  onRetrySave: () => void;
  onRetryFailed: () => void;
  onOpen: (url: string) => void;
  onDownload: (url: string, index: number) => void;
  onDownloadAll: () => void;
  onUseWithAvatar: () => void;
  onMakeCampaign: () => void;
  onOtherStyle: () => void;
  onOtherProduct: () => void;
  onClose: () => void;
}

export const ResultsStep: React.FC<ResultsStepProps> = ({
  productTitle, shots, collage, aspectClass, retryingIndices, isRetrying, isZipping, saveState,
  onRetrySave, onRetryFailed, onOpen, onDownload, onDownloadAll,
  onUseWithAvatar, onMakeCampaign, onOtherStyle, onOtherProduct, onClose,
}) => {
  const cards = collage ? [...shots, collage] : shots;
  const okCount = cards.filter((s) => s && s !== 'error').length;
  const failedCount = shots.filter((s) => s === 'error').length;
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  const onScroll = () => {
    const el = scrollerRef.current;
    const first = el?.firstElementChild as HTMLElement | null;
    if (!el || !first) return;
    setActive(Math.round(el.scrollLeft / (first.offsetWidth + 10)));
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 min-h-11">
        <button type="button" onClick={onClose} aria-label="Cerrar" className="-ml-2 w-11 h-11 rounded-full flex items-center justify-center text-slate-700 hover:bg-slate-100 active:scale-95 transition-transform duration-150">
          <X size={20} />
        </button>
        <span className="flex-1 text-[15px] font-bold text-slate-900">Listas</span>
      </div>

      <FlowHeading>
        {okCount === 0 ? 'No pudimos crear tus fotos' : <>Tus fotos de {productTitle || 'tu producto'} están listas</>}
      </FlowHeading>

      {saveState === 'saved' && (
        <span className="self-start inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[12.5px] font-bold text-emerald-700">
          <Check size={14} strokeWidth={3} /> Guardadas en tu catálogo
        </span>
      )}
      {saveState === 'saving' && (
        <span className="self-start inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-[12.5px] font-semibold text-slate-600">
          <Loader2 size={14} className="animate-spin" /> Guardando en tu catálogo
        </span>
      )}
      {saveState === 'error' && (
        <button type="button" onClick={onRetrySave} className="self-start inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1 text-[12.5px] font-bold text-rose-700">
          <AlertTriangle size={14} /> No se pudieron guardar · Reintentar
        </button>
      )}

      {failedCount > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-[14px] bg-amber-50 px-3 py-2.5 text-[13px] text-amber-900">
          <span>
            {failedCount === 1 ? '1 foto no se pudo crear' : `${failedCount} fotos no se pudieron crear`} por un error. Ya te devolvimos sus créditos.
          </span>
          <button
            type="button"
            onClick={onRetryFailed}
            disabled={isRetrying}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-[13px] font-bold text-amber-900 disabled:opacity-60"
          >
            {isRetrying ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Reintentar
          </button>
        </div>
      )}

      <div
        ref={scrollerRef}
        onScroll={onScroll}
        className="-mx-4 px-4 flex gap-2.5 overflow-x-auto snap-x snap-mandatory scrollbar-hide md:mx-0 md:px-0 md:grid md:grid-cols-3 md:gap-3 md:overflow-visible"
      >
        {cards.map((url, i) => {
          const isCollage = !!collage && i === cards.length - 1;
          const retrying = retryingIndices.includes(i);
          const failed = url === 'error' && !retrying;
          return (
            <div key={i} className={`relative shrink-0 w-[82%] md:w-auto snap-center ${aspectClass} rounded-[22px] overflow-hidden bg-slate-200`}>
              {url && url !== 'error' && !retrying && (
                <>
                  <button type="button" onClick={() => onOpen(url)} className="block w-full h-full" aria-label={`Ver foto ${i + 1} en grande`}>
                    <img src={url} alt={`Foto ${i + 1} de ${productTitle}`} className="w-full h-full object-cover" />
                  </button>
                  {isCollage && (
                    <span className="absolute left-2.5 bottom-3.5 rounded-full bg-slate-900/75 px-2.5 py-1 text-xs font-semibold text-white">Collage</span>
                  )}
                  <button
                    type="button"
                    onClick={() => onDownload(url, i)}
                    aria-label={`Descargar foto ${i + 1}`}
                    className="absolute right-2.5 bottom-2.5 w-11 h-11 rounded-full bg-white/95 text-slate-900 shadow-md flex items-center justify-center active:scale-95 transition-transform duration-150"
                  >
                    <Download size={18} />
                  </button>
                </>
              )}
              {retrying && (
                <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm font-semibold text-slate-600">
                  <Loader2 size={22} className="animate-spin" /> Creando de nuevo
                </span>
              )}
              {failed && (
                <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-6 text-center">
                  <AlertTriangle size={22} className="text-slate-400" />
                  <b className="text-sm text-slate-700">No se pudo crear</b>
                  <span className="text-xs text-slate-500">Créditos devueltos</span>
                </span>
              )}
            </div>
          );
        })}
      </div>

      {cards.length > 1 && (
        <div className="flex justify-center gap-1.5 md:hidden" aria-hidden="true">
          {cards.map((_, i) => (
            <span key={i} className={`h-1.5 rounded-full transition-[width,background-color] duration-200 ${i === active ? 'w-[18px] bg-brand-600' : 'w-1.5 bg-slate-300'}`} />
          ))}
        </div>
      )}

      {okCount > 0 && (
        <SecondaryButton onClick={onDownloadAll} disabled={isZipping}>
          {isZipping ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
          {okCount === 1 ? 'Descargar foto' : 'Descargar todas'}
        </SecondaryButton>
      )}

      <p className="mt-1 text-[13px] font-bold text-slate-700">¿Y ahora?</p>
      <div className="flex flex-col gap-2 md:grid md:grid-cols-2">
        {[
          { icon: <UserRound size={20} />, title: 'Ponla en manos de tu avatar', sub: 'Fotos para redes, con una persona', onClick: onUseWithAvatar },
          { icon: <CalendarDays size={20} />, title: 'Arma una campaña de 7 días', sub: 'Fotos, textos y qué publicar cada día', onClick: onMakeCampaign },
          { icon: <Palette size={20} />, title: 'Probar otro estilo', sub: 'Mismo producto, otro look', onClick: onOtherStyle },
          { icon: <Plus size={20} />, title: 'Fotos de otro producto', sub: 'Empieza de nuevo', onClick: onOtherProduct },
        ].map((a) => (
          <button
            key={a.title}
            type="button"
            onClick={a.onClick}
            className="w-full flex items-center gap-3 rounded-[18px] border border-slate-200 bg-white p-3 text-left hover:border-slate-300 active:scale-[0.98] transition-transform duration-150"
          >
            <span className="w-[42px] h-[42px] shrink-0 rounded-[14px] bg-brand-50 text-brand-800 flex items-center justify-center">{a.icon}</span>
            <span className="flex-1 min-w-0">
              <b className="block text-[14.5px] text-slate-900">{a.title}</b>
              <span className="block text-[12.5px] text-slate-500">{a.sub}</span>
            </span>
            <ChevronRight size={18} className="text-slate-400 shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
};
