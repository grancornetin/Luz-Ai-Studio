import React, { useState } from 'react';
import { Check, Download, FileArchive, Plus, RotateCcw, Grid3x3, RefreshCw, AlertTriangle } from 'lucide-react';

interface Step6ResultsProps {
  productTitle: string;
  shots: string[];                                  // imágenes generadas (placeholder 'error' si falló)
  collageIndex?: number | null;                     // índice de la imagen-collage final (si existe)
  isZipping?: boolean;
  hasFailed?: boolean;                              // true si alguna imagen está marcada como 'error'
  isRetrying?: boolean;                             // true mientras se reintenta
  onRetryFailed?: () => void;                       // reintenta solo las fallidas
  onLightbox: (index: number) => void;
  onDownloadIndividual: (url: string, filename: string) => void;
  onDownloadZip: () => void;
  onSaveToCatalog: () => void;
  onRestart: () => void;
  onCreateManualGrid?: (selectedIndices: number[]) => void; // opcional
}

export const Step6Results: React.FC<Step6ResultsProps> = ({
  productTitle,
  shots,
  collageIndex,
  isZipping,
  hasFailed,
  isRetrying,
  onRetryFailed,
  onLightbox,
  onDownloadIndividual,
  onDownloadZip,
  onSaveToCatalog,
  onRestart,
  onCreateManualGrid,
}) => {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const total = shots.length;
  const canMakeGrid = selected.size >= 2;
  const failedCount = shots.filter((s) => s === 'error').length;
  const successCount = shots.filter((s) => s && s !== 'error').length;

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
      alert(
        'Función de grid manual: próximamente. Quedará una sola imagen combinada en el set.'
      );
    }
  };

  return (
    <div className="fade-in p-4 md:p-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-5">
        <div>
          <div className="flex items-center gap-2.5 mb-2 flex-wrap">
            <div className={`w-7 h-7 rounded-full text-white flex items-center justify-center ${hasFailed ? 'bg-amber-500' : 'bg-emerald-500'}`}>
              {hasFailed ? <AlertTriangle size={14} strokeWidth={2.5} /> : <Check size={14} strokeWidth={3} />}
            </div>
            <span className={`text-[10px] font-black uppercase tracking-[0.18em] ${hasFailed ? 'text-amber-600' : 'text-emerald-600'}`}>
              {hasFailed
                ? `${successCount} ok · ${failedCount} fallidas`
                : `Listo · ${total} ${total === 1 ? 'imagen' : 'imágenes'}`}
            </span>
          </div>
          <h2 className="t-display text-[28px] md:text-[34px] text-slate-900 leading-[1.05]">
            {productTitle || 'Tu producto'}{' '}
            <span className="text-pink-600 italic normal-case">está listo.</span>
          </h2>
          <p className="text-sm text-slate-500 mt-2 leading-[1.55] max-w-[540px]">
            Tocá cualquier imagen para ampliarla. Seleccioná varias para crear un grid manual o descargar lo que elijas.
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
              {isRetrying ? (
                <i className="fa-solid fa-spinner animate-spin" />
              ) : (
                <RefreshCw size={14} />
              )}
              Reintentar {failedCount} fallida{failedCount !== 1 ? 's' : ''}
            </button>
          )}
          <button
            type="button"
            onClick={onDownloadZip}
            disabled={isZipping || successCount === 0}
            className="flex-1 md:flex-none flex items-center justify-center gap-1.5 bg-white border border-slate-200 hover:border-slate-300 rounded-xl px-3.5 md:px-4 py-2.5 md:py-3 text-xs font-semibold text-slate-700 transition-colors disabled:opacity-60"
          >
            {isZipping ? (
              <i className="fa-solid fa-spinner animate-spin" />
            ) : (
              <FileArchive size={14} />
            )}
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

      {/* Grid asimétrico */}
      <div
        className={`grid gap-3 md:gap-3.5 ${
          total >= 4 ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-2'
        }`}
      >
        {shots.map((url, i) => {
          const sel = selected.has(i);
          const isHero = total >= 4 && i === 0;
          const isError = url === 'error';

          return (
            <div
              key={i}
              className={`${isHero ? 'col-span-2 row-span-2' : ''}`}
            >
              <div
                onClick={() => !isError && onLightbox(i)}
                className={`group relative w-full aspect-[3/4] rounded-2xl overflow-hidden bg-white transition-all ${
                  isError ? 'cursor-not-allowed' : 'cursor-pointer hover:-translate-y-0.5'
                } ${
                  sel
                    ? 'shadow-[0_0_0_3px_rgb(124_58_237),0_16px_40px_rgba(124,58,237,0.25)]'
                    : 'shadow-[0_8px_20px_rgba(15,23,42,0.06)] hover:shadow-md'
                }`}
              >
                {isError ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-rose-50">
                    <div className="text-center px-4">
                      <i className="fa-solid fa-triangle-exclamation text-rose-400 text-2xl mb-1" />
                      <p className="text-[10px] text-rose-600 font-bold uppercase tracking-wider">
                        Falló — reintentá
                      </p>
                    </div>
                  </div>
                ) : (
                  <img src={url} alt={`Shot ${i + 1}`} className="w-full h-full object-cover" />
                )}

                {/* checkbox */}
                {!isError && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSel(i);
                    }}
                    className={`absolute top-2.5 left-2.5 z-10 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold shadow transition-all ${
                      sel
                        ? 'bg-violet-600 text-white'
                        : 'bg-white/95 text-slate-900 opacity-0 group-hover:opacity-100 md:opacity-100'
                    }`}
                  >
                    {sel ? <Check size={14} strokeWidth={3} /> : ''}
                  </button>
                )}

                {/* label top-right */}
                <div className={`absolute top-2.5 right-2.5 text-[9px] font-bold tracking-[0.12em] uppercase px-2 py-1 rounded ${
                  i === collageIndex
                    ? 'bg-pink-600 text-white'
                    : 'bg-white/95 text-slate-900'
                }`}>
                  {i === collageIndex
                    ? 'Grid final'
                    : i === 0 && total >= 4
                    ? 'Hero'
                    : `Shot ${i + 1}`}
                </div>

                {/* download */}
                {!isError && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDownloadIndividual(
                        url,
                        `${productTitle.replace(/\s+/g, '_') || 'product'}_shot_${i + 1}.png`
                      );
                    }}
                    className="absolute bottom-3 right-3 w-9 h-9 rounded-full bg-white text-slate-900 shadow-lg flex items-center justify-center hover:scale-110 transition-transform md:opacity-0 md:group-hover:opacity-100"
                  >
                    <Download size={14} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Selection bar (sticky bottom dentro del scroll) */}
      {selected.size > 0 && (
        <div className="sticky bottom-4 mt-6 z-20 bg-slate-900 text-white rounded-2xl px-4 py-3 md:px-5 md:py-3.5 shadow-2xl flex items-center gap-3.5 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-violet-600 text-white flex items-center justify-center text-sm font-bold">
              {selected.size}
            </div>
            <div>
              <div className="text-[13px] font-semibold">
                {selected.size}{' '}
                {selected.size === 1 ? 'imagen seleccionada' : 'imágenes seleccionadas'}
              </div>
              <div className="text-[11px] opacity-70">
                {canMakeGrid
                  ? 'Listas para crear grid manual'
                  : 'Seleccioná 1 más para hacer un grid'}
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
            Crear grid · 1 cr
          </button>
        </div>
      )}

      {/* Footer actions */}
      <div className="flex justify-between items-center mt-7 pt-5 border-t border-slate-200 gap-3.5 flex-wrap">
        <button
          type="button"
          onClick={onRestart}
          className="flex items-center gap-1.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 rounded-xl px-4 py-3 text-[13px] font-semibold transition-colors"
        >
          <RotateCcw size={14} />
          Crear otro producto
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
  );
};

export default Step6Results;
