import React, { useState } from 'react';
import { Check, Download, FileArchive, Plus, RotateCcw, Grid3x3, RefreshCw, AlertTriangle, Sliders } from 'lucide-react';

interface Step6ResultsProps {
  productTitle: string;
  shots: string[];                // 'error' marca fallidas, '' marca en progreso
  collageIndex?: number | null;
  isZipping?: boolean;
  hasFailed?: boolean;
  isRetrying?: boolean;           // true mientras hay reintento en curso (global)
  retryingIndices?: number[];     // índices que están siendo reintentados ahora mismo
  onRetryFailed?: () => void;
  onLightbox: (index: number) => void;
  onDownloadIndividual: (url: string, filename: string) => void;
  onDownloadZip: () => void;
  onSaveToCatalog: () => void;
  onRestart: () => void;
  onBackToConfig?: () => void;
  onBackToStart?: () => void;
  onCreateManualGrid?: (selectedIndices: number[]) => void;
}

export const Step6Results: React.FC<Step6ResultsProps> = ({
  productTitle,
  shots,
  collageIndex,
  isZipping,
  hasFailed,
  isRetrying,
  retryingIndices = [],
  onRetryFailed,
  onLightbox,
  onDownloadIndividual,
  onDownloadZip,
  onSaveToCatalog,
  onRestart,
  onBackToConfig,
  onBackToStart,
  onCreateManualGrid,
}) => {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const total        = shots.length;
  const failedCount  = shots.filter((s) => s === 'error').length;
  const successCount = shots.filter((s) => s && s !== 'error').length;
  const canMakeGrid  = selected.size >= 2;

  const toggleSel = (idx: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const handleCreateGrid = () => {
    if (!canMakeGrid) return;
    if (onCreateManualGrid) {
      onCreateManualGrid(Array.from(selected));
    } else {
      alert('Función de grid manual: próximamente.');
    }
  };

  return (
    <div className="fade-in p-4 md:p-8">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-5">
        <div>
          <div className="flex items-center gap-2.5 mb-2 flex-wrap">
            <div className={`w-7 h-7 rounded-full text-white flex items-center justify-center ${hasFailed ? 'bg-amber-500' : 'bg-emerald-500'}`}>
              {hasFailed ? <AlertTriangle size={14} strokeWidth={2.5} /> : <Check size={14} strokeWidth={3} />}
            </div>
            <span className={`text-[10px] font-black uppercase tracking-[0.18em] ${hasFailed ? 'text-amber-600' : 'text-emerald-600'}`}>
              {hasFailed
                ? `${successCount} ok · ${failedCount} fallida${failedCount !== 1 ? 's' : ''}`
                : `Listo · ${total} ${total === 1 ? 'imagen' : 'imágenes'}`}
            </span>
            {/* Indicador de reintento en curso */}
            {isRetrying && (
              <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-1">
                <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-[9px] font-bold text-amber-600 uppercase tracking-wider">
                  Reintentando {retryingIndices.length > 0 ? retryingIndices.length : failedCount}…
                </span>
              </div>
            )}
          </div>
          <h2 className="t-display text-[28px] md:text-[34px] text-slate-900 leading-[1.05]">
            {productTitle || 'Tu producto'}{' '}
            <span className="text-pink-600 italic normal-case">está listo.</span>
          </h2>
          <p className="text-sm text-slate-500 mt-2 leading-[1.55] max-w-[540px]">
            Toca cualquier imagen para ampliarla. Selecciona varias para crear un collage o descargar lo que elijas.
          </p>
        </div>

        <div className="flex gap-2 w-full md:w-auto flex-wrap">
          {hasFailed && onRetryFailed && (
            <button
              type="button"
              onClick={onRetryFailed}
              disabled={isRetrying}
              className="flex-1 md:flex-none flex items-center justify-center gap-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-xl px-3.5 md:px-4 py-2.5 md:py-3 text-xs font-bold transition-colors disabled:opacity-60"
            >
              {isRetrying
                ? <div className="w-3.5 h-3.5 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
                : <RefreshCw size={14} />}
              Reintentar {failedCount} fallida{failedCount !== 1 ? 's' : ''}
            </button>
          )}
          <button
            type="button"
            onClick={onDownloadZip}
            disabled={isZipping || successCount === 0}
            className="flex-1 md:flex-none flex items-center justify-center gap-1.5 bg-white border border-slate-200 hover:border-slate-300 rounded-xl px-3.5 md:px-4 py-2.5 md:py-3 text-xs font-semibold text-slate-700 transition-colors disabled:opacity-60"
          >
            {isZipping
              ? <div className="w-3.5 h-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
              : <FileArchive size={14} />}
            Pack ZIP
          </button>
          <button
            type="button"
            onClick={onSaveToCatalog}
            disabled={successCount === 0}
            className="flex-1 md:flex-none flex items-center justify-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl px-3.5 md:px-4 py-2.5 md:py-3 text-xs font-semibold transition-colors disabled:opacity-60"
          >
            Guardar en catálogo
          </button>
        </div>
      </div>

      {/* ── Grid de shots ────────────────────────────────────────────────────── */}
      <div className={`grid gap-3 md:gap-3.5 ${total >= 4 ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-2'}`}>
        {shots.map((url, i) => {
          const sel        = selected.has(i);
          const isHero     = total >= 4 && i === 0;
          const isError    = url === 'error';
          const isRetryingThis = retryingIndices.includes(i);
          const isEmpty    = url === '';

          return (
            <div key={i} className={`${isHero ? 'col-span-2 row-span-2' : ''}`}>
              <div
                onClick={() => !isError && !isRetryingThis && !isEmpty && onLightbox(i)}
                style={{ touchAction: 'manipulation' }}
                className={`group relative w-full aspect-[3/4] rounded-2xl overflow-hidden bg-white transition-all duration-200 ${
                  isRetryingThis
                    ? 'border-2 border-amber-400 bg-amber-50 animate-pulse cursor-wait'
                    : isError
                    ? 'cursor-not-allowed border-2 border-rose-200 bg-rose-50'
                    : isEmpty
                    ? 'bg-slate-100 cursor-default'
                    : sel
                    ? 'cursor-pointer shadow-[0_0_0_3px_rgb(124_58_237),0_16px_40px_rgba(124,58,237,0.25)]'
                    : 'cursor-pointer shadow-[0_8px_20px_rgba(15,23,42,0.06)] md:hover:-translate-y-0.5 md:hover:shadow-md'
                }`}
              >
                {/* ── Estado: reintentando ───────────────────────────────── */}
                {isRetryingThis && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 z-10">
                    <div className="w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                    <span className="text-[9px] font-bold text-amber-600 uppercase tracking-wider">
                      Reintentando...
                    </span>
                  </div>
                )}

                {/* ── Estado: error ──────────────────────────────────────── */}
                {isError && !isRetryingThis && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 px-4 text-center">
                    <AlertTriangle className="w-6 h-6 text-rose-400" strokeWidth={1.5} />
                    <p className="text-[10px] text-rose-600 font-bold uppercase tracking-wider leading-tight">
                      Falló
                    </p>
                    {onRetryFailed && !isRetrying && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onRetryFailed(); }}
                        style={{ touchAction: 'manipulation' }}
                        className="mt-1 flex items-center gap-1 bg-white border border-rose-200 hover:border-rose-300 text-rose-600 rounded-lg px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider transition-colors active:scale-95"
                      >
                        <RefreshCw size={9} strokeWidth={2.5} />
                        Reintentar
                      </button>
                    )}
                  </div>
                )}

                {/* ── Estado: vacío / en espera ─────────────────────────── */}
                {isEmpty && !isRetryingThis && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-[10px] text-slate-400 font-semibold">{i + 1}</div>
                  </div>
                )}

                {/* ── Estado: imagen lista ───────────────────────────────── */}
                {url && url !== 'error' && !isRetryingThis && (
                  <img src={url} alt={`Shot ${i + 1}`} className="w-full h-full object-cover" />
                )}

                {/* ── Checkbox de selección ──────────────────────────────── */}
                {url && url !== 'error' && !isRetryingThis && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); toggleSel(i); }}
                    style={{ touchAction: 'manipulation' }}
                    aria-label={sel ? 'Quitar selección' : 'Seleccionar imagen'}
                    className={`absolute top-2.5 left-2.5 z-10 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shadow transition-colors duration-150 ${
                      sel
                        ? 'bg-violet-600 text-white'
                        : 'bg-white/95 text-slate-900 opacity-100 md:opacity-0 md:group-hover:opacity-100'
                    }`}
                  >
                    {sel ? <Check size={14} strokeWidth={3} /> : ''}
                  </button>
                )}

                {/* ── Label top-right ────────────────────────────────────── */}
                {!isRetryingThis && !isError && !isEmpty && (
                  <div className={`absolute top-2.5 right-2.5 text-[9px] font-bold tracking-[0.12em] uppercase px-2 py-1 rounded ${
                    i === collageIndex ? 'bg-pink-600 text-white' : 'bg-white/95 text-slate-900'
                  }`}>
                    {i === collageIndex ? 'Grid final' : i === 0 && total >= 4 ? 'Hero' : `Shot ${i + 1}`}
                  </div>
                )}

                {/* ── Botón de descarga individual ───────────────────────── */}
                {url && url !== 'error' && !isRetryingThis && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDownloadIndividual(
                        url,
                        `${productTitle.replace(/\s+/g, '_') || 'product'}_shot_${i + 1}.png`,
                      );
                    }}
                    style={{ touchAction: 'manipulation' }}
                    aria-label={`Descargar imagen ${i + 1}`}
                    className="absolute bottom-3 right-3 w-10 h-10 rounded-full bg-white text-slate-900 shadow-lg flex items-center justify-center md:hover:scale-110 transition-transform duration-150 opacity-100 md:opacity-0 md:group-hover:opacity-100 active:scale-95"
                  >
                    <Download size={16} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Barra de selección sticky ────────────────────────────────────────── */}
      {selected.size > 0 && (
        <div className="sticky bottom-4 mt-6 z-20 bg-slate-900 text-white rounded-2xl px-4 py-3 md:px-5 md:py-3.5 shadow-2xl flex items-center gap-3.5 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-violet-600 text-white flex items-center justify-center text-sm font-bold">
              {selected.size}
            </div>
            <div>
              <div className="text-[13px] font-semibold">
                {selected.size} {selected.size === 1 ? 'imagen seleccionada' : 'imágenes seleccionadas'}
              </div>
              <div className="text-[11px] opacity-70">
                {canMakeGrid ? 'Listas para crear un collage' : 'Selecciona 1 más para hacer un collage'}
              </div>
            </div>
          </div>
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="bg-transparent border border-white/20 text-white rounded-xl px-3.5 py-2 text-xs font-semibold hover:bg-white/5 transition-colors"
          >
            Limpiar
          </button>
          <button
            type="button"
            disabled={!canMakeGrid}
            onClick={handleCreateGrid}
            className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              canMakeGrid
                ? 'bg-gradient-to-br from-violet-600 to-pink-600 text-white shadow-[0_8px_20px_rgba(124,58,237,0.4)]'
                : 'bg-white/5 text-slate-500 cursor-not-allowed'
            }`}
          >
            <Grid3x3 size={14} />
            Crear collage · 1 cr
          </button>
        </div>
      )}

      {/* ── Footer de acciones ───────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center mt-7 pt-5 border-t border-slate-200 gap-2 md:gap-3.5">
        <div className="flex flex-wrap gap-2">
          {onBackToConfig && (
            <button
              type="button"
              onClick={onBackToConfig}
              style={{ touchAction: 'manipulation' }}
              className="flex items-center gap-1.5 bg-violet-50 hover:bg-violet-100 border border-violet-200 text-violet-700 rounded-xl px-4 py-3 text-[13px] font-bold transition-colors duration-150"
            >
              <Sliders size={14} />
              Ajustar y volver a generar
            </button>
          )}
          {onBackToStart && (
            <button
              type="button"
              onClick={onBackToStart}
              style={{ touchAction: 'manipulation' }}
              className="flex items-center gap-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-4 py-3 text-[13px] font-semibold transition-colors duration-150"
            >
              <RotateCcw size={14} />
              Cambiar fotos del producto
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2 md:justify-end">
          <button
            type="button"
            onClick={onRestart}
            style={{ touchAction: 'manipulation' }}
            className="flex items-center gap-1.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 rounded-xl px-4 py-3 text-[13px] font-semibold transition-colors duration-150"
          >
            <RotateCcw size={14} />
            Empezar de cero
          </button>
          <button
            type="button"
            disabled
            className="flex items-center gap-1.5 bg-white border border-slate-200 text-slate-400 rounded-xl px-4 py-3 text-[13px] font-semibold cursor-not-allowed"
            title="Próximamente"
          >
            <Plus size={14} />
            Agregar a proyecto
          </button>
        </div>
      </div>
    </div>
  );
};

export default Step6Results;
