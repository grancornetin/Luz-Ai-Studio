import React, { useEffect, useCallback, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Download, Share2, MoreVertical, Star, MoveHorizontal, ChevronLeft, ChevronRight } from 'lucide-react';
import { downloadImage } from '../../utils/imageUtils';
import { BeforeAfterSlider } from './BeforeAfterSlider';

interface ImageLightboxProps {
  images: string[];
  initialIndex?: number;
  onClose: () => void;
  onDownload?: (imageUrl: string, index: number) => void;
  metadata?: { label?: string; date?: string; credits?: number };
  /** Contenido de la pestaña "Info" del panel deslizable (mobile) / panel lateral (desktop). */
  details?: React.ReactNode;
  /** Compatibilidad con el uso anterior (un solo botón extra). Preferir
   * `secondaryActions` para más de una acción — ambas conviven. */
  extraButton?: {
    label: string;
    onClick: (imageUrl: string, index: number) => void;
    icon?: React.ReactNode;
  };
  /** Botones adicionales (además de Descargar, que siempre está). */
  secondaryActions?: {
    label: string;
    onClick: (imageUrl: string, index: number) => void;
    icon?: React.ReactNode;
  }[];
  /** Etiqueta por imagen (mismo orden que `images`) — ej. ['Objetivo', 'Antes', 'Después'].
   * Alimenta la tira de miniaturas y el comparador antes/después. */
  labels?: string[];
}

export const ImageLightbox: React.FC<ImageLightboxProps> = ({
  images,
  initialIndex = 0,
  onClose,
  onDownload,
  metadata,
  details,
  extraButton,
  secondaryActions,
  labels,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [panelOpen, setPanelOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'actions'>(
    details ? 'info' : 'actions'
  );
  // Modo comparar: reemplaza la imagen central por el slider a pantalla
  // casi completa — no vive dentro del panel, que quedaba chico y
  // compitiendo con la imagen de fondo asomando arriba.
  const [compareMode, setCompareMode] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const currentImage = images[currentIndex];
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < images.length - 1;

  const allActions = [
    ...(secondaryActions || []),
    ...(extraButton ? [extraButton] : []),
  ];
  const hasInfoPanel = !!details;
  const hasActionsPanel = allActions.length > 0;
  // Mobile: el panel deslizable solo tiene sentido si hay algo para mostrar.
  const hasAnyPanel = hasInfoPanel || hasActionsPanel;
  // Desktop: el panel lateral siempre se muestra — ahí viven Descargar/Compartir,
  // que en mobile están siempre visibles como botones flotantes sobre la imagen.
  const showDesktopPanel = true;

  // Slider "antes/después": solo tiene sentido cuando ambas imágenes
  // comparten encuadre — se activa únicamente si el módulo marcó una
  // pareja exacta con esas labels (ej. Clone Image). El resto de las
  // imágenes del set (ej. "Objetivo") queda accesible por la tira de
  // miniaturas normal, no dentro del comparador.
  const beforeIdx = labels?.findIndex(l => l === 'Antes') ?? -1;
  const afterIdx = labels?.findIndex(l => l === 'Después') ?? -1;
  const hasBeforeAfterPair = beforeIdx >= 0 && afterIdx >= 0;

  const goPrev = useCallback(() => {
    if (hasPrev) setCurrentIndex(i => i - 1);
  }, [hasPrev]);

  const goNext = useCallback(() => {
    if (hasNext) setCurrentIndex(i => i + 1);
  }, [hasNext]);

  // Keyboard
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (panelOpen) setPanelOpen(false);
        else if (compareMode) setCompareMode(false);
        else onClose();
      }
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [goPrev, goNext, onClose, panelOpen, compareMode]);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // Touch handlers con umbral de swipe — solo sobre la imagen, no sobre el panel
  const handleTouchStart = (e: React.TouchEvent) => {
    if (panelOpen) return;
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = Math.abs(e.touches[0].clientY - (touchStartY.current ?? 0));
    if (dy < Math.abs(dx)) setDragX(dx);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 50) {
      if (dx > 0) goPrev();
      else goNext();
    }
    setDragX(0);
    setIsDragging(false);
    touchStartX.current = null;
    touchStartY.current = null;
  };

  const handleDownload = () => {
    if (onDownload) {
      onDownload(currentImage, currentIndex);
    } else {
      downloadImage(currentImage, `imagen-${Date.now()}.jpg`);
    }
  };

  const handleShare = async () => {
    try {
      // Las imágenes generadas suelen ser data URLs (base64), no URLs
      // http reales — navigator.share({ url }) las rechaza en silencio en
      // Safari/iOS. Compartir el archivo en sí (vía Web Share Level 2)
      // funciona con ambos casos.
      if (navigator.share) {
        if (currentImage.startsWith('data:') && navigator.canShare) {
          const res = await fetch(currentImage);
          const blob = await res.blob();
          const ext = blob.type.split('/')[1] || 'jpg';
          const file = new File([blob], `imagen.${ext}`, { type: blob.type });
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file], title: metadata?.label || 'Imagen' });
            return;
          }
        }
        if (!currentImage.startsWith('data:')) {
          await navigator.share({ url: currentImage, title: metadata?.label || 'Imagen' });
          return;
        }
      }
      handleDownload();
    } catch {
      // El usuario canceló el share sheet — no es un error a mostrar.
    }
  };

  const label = (i: number) => labels?.[i];

  // Portal a document.body: un layout con overflow/transform en algún
  // ancestro puede convertirlo en el "containing block" de position:fixed,
  // haciendo que el modal no cubra la pantalla real y quede detrás de otros
  // elementos fixed (como la navegación). Montar en <body> lo evita del todo.
  return createPortal(
    <div
      className="fixed inset-0 z-[9999] bg-black flex flex-col lg:flex-row"
      style={{ height: '100dvh' }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* ── COLUMNA DE IMAGEN ──────────────────────────────
          En desktop (lg+) es su propia columna con la imagen a
          pantalla completa, sin botones flotando encima ni recorte.
          En mobile mantiene el layout original (barra + imagen + tira). */}
      <div className="relative flex-1 flex flex-col min-w-0 min-h-0">
        {/* Barra superior — solo mobile, en desktop el cerrar vive sobre la imagen */}
        <div className="lg:hidden flex-shrink-0 flex items-center justify-between px-4 pt-4 pb-2 safe-area-top relative z-[2]">
          <button
            onClick={onClose}
            className="w-9 h-9 bg-white/10 hover:bg-white/20 active:bg-white/30 rounded-full flex items-center justify-center text-white transition-colors"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
          <div className="text-white/60 text-[10.5px] font-black uppercase tracking-widest">
            {currentIndex + 1} / {images.length}
            {label(currentIndex) && <span className="ml-2 text-white/40">· {label(currentIndex)}</span>}
          </div>
          <div className="w-9 h-9" />
        </div>

        {/* Cerrar — solo desktop, flotante sobre la imagen */}
        <button
          onClick={onClose}
          aria-label="Cerrar"
          className="hidden lg:flex absolute top-5 left-5 z-[2] w-9 h-9 bg-white/10 hover:bg-white/20 active:bg-white/30 rounded-full items-center justify-center text-white transition-colors"
        >
          <X size={16} />
        </button>

        {/* Imagen central (o slider de comparación) */}
        <div className="flex-1 min-h-0 min-w-0 flex items-center justify-center relative overflow-hidden px-3 lg:px-10 lg:py-10">
          {compareMode && hasBeforeAfterPair ? (
            <BeforeAfterSlider
              beforeSrc={images[beforeIdx]}
              afterSrc={images[afterIdx]}
              className="h-full max-w-full"
            />
          ) : (
            <div
              className="relative max-w-full max-h-full min-h-0 flex items-center justify-center"
              style={{
                transform: isDragging ? `translateX(${dragX * 0.3}px)` : 'none',
                transition: isDragging ? 'none' : 'transform 0.2s ease',
              }}
              onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
              }}
            >
              <img
                key={currentIndex}
                src={currentImage}
                alt={label(currentIndex) || `Imagen ${currentIndex + 1}`}
                className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl select-none animate-in fade-in duration-200"
                draggable={false}
              />
            </div>
          )}

          {/* Flechas prev/next — solo desktop, mobile usa swipe */}
          {hasPrev && (
            <button
              onClick={goPrev}
              aria-label="Anterior"
              className="hidden lg:flex absolute left-5 top-1/2 -translate-y-1/2 z-[2] w-10 h-10 bg-white/10 hover:bg-white/20 active:scale-95 rounded-full items-center justify-center text-white transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
          )}
          {hasNext && (
            <button
              onClick={goNext}
              aria-label="Siguiente"
              className="hidden lg:flex absolute right-5 top-1/2 -translate-y-1/2 z-[2] w-10 h-10 bg-white/10 hover:bg-white/20 active:scale-95 rounded-full items-center justify-center text-white transition-colors"
            >
              <ChevronRight size={20} />
            </button>
          )}

          {/* Columna de acciones flotantes — solo mobile. En desktop viven en el panel lateral. */}
          <div className="lg:hidden absolute right-4 bottom-4 flex flex-col-reverse gap-2.5 z-[2]">
            {hasAnyPanel && (
              <button
                onClick={() => setPanelOpen(p => !p)}
                aria-label="Más opciones"
                className={`w-10 h-10 rounded-full backdrop-blur-md flex items-center justify-center text-white transition-colors ${
                  panelOpen ? 'bg-gradient-to-br from-brand-400 to-brand-600' : 'bg-white/12 hover:bg-white/20'
                }`}
              >
                <MoreVertical size={17} />
              </button>
            )}
            {hasBeforeAfterPair && (
              <button
                onClick={() => setCompareMode(v => !v)}
                aria-label="Comparar antes y después"
                className={`w-10 h-10 rounded-full backdrop-blur-md flex items-center justify-center text-white transition-colors ${
                  compareMode ? 'bg-gradient-to-br from-brand-400 to-brand-600' : 'bg-white/12 hover:bg-white/20'
                }`}
                title="Comparar"
              >
                <MoveHorizontal size={17} />
              </button>
            )}
            {allActions.map((action, i) => (
              <button
                key={i}
                onClick={() => action.onClick(currentImage, currentIndex)}
                aria-label={action.label}
                className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 backdrop-blur-md flex items-center justify-center text-white transition-transform active:scale-95"
                title={action.label}
              >
                {action.icon || <Star size={16} />}
              </button>
            ))}
            <button
              onClick={handleShare}
              aria-label="Compartir"
              className="w-10 h-10 rounded-full bg-white/12 hover:bg-white/20 backdrop-blur-md flex items-center justify-center text-white transition-colors"
              title="Compartir"
            >
              <Share2 size={16} />
            </button>
            <button
              onClick={handleDownload}
              aria-label="Descargar"
              className="w-10 h-10 rounded-full bg-white/12 hover:bg-white/20 backdrop-blur-md flex items-center justify-center text-white transition-colors"
              title="Descargar"
            >
              <Download size={16} />
            </button>
          </div>

          {/* Tira de miniaturas flotante — solo desktop, sobre la imagen */}
          {images.length > 1 && (
            <div className="hidden lg:flex absolute bottom-16 left-1/2 -translate-x-1/2 z-[2] gap-2 bg-black/30 backdrop-blur-md rounded-2xl p-2">
              {images.map((src, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentIndex(idx)}
                  className={`w-11 h-11 rounded-xl overflow-hidden flex-shrink-0 border-2 transition-all ${
                    idx === currentIndex ? 'border-brand-500 opacity-100' : 'border-transparent opacity-45 hover:opacity-75'
                  }`}
                >
                  <img src={src} alt={label(idx) || `Miniatura ${idx + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}

          {/* Contador — solo desktop, centrado abajo */}
          <div className="hidden lg:block absolute bottom-5 left-1/2 -translate-x-1/2 z-[2] text-white/45 text-[10.5px] font-black uppercase tracking-widest">
            {currentIndex + 1} / {images.length}
            {label(currentIndex) && <span className="ml-2 text-white/30">· {label(currentIndex)}</span>}
          </div>
        </div>

        {/* Tira de miniaturas — solo mobile, franja fija debajo de la imagen */}
        {images.length > 1 && (
          <div
            className="lg:hidden flex-shrink-0 px-4 pt-1 relative z-[2]"
            style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
          >
            <div className="flex gap-2 overflow-x-auto">
              {images.map((src, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentIndex(idx)}
                  className={`w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 border-2 transition-all ${
                    idx === currentIndex ? 'border-brand-500 opacity-100' : 'border-transparent opacity-50'
                  }`}
                >
                  <img src={src} alt={label(idx) || `Miniatura ${idx + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── PANEL LATERAL FIJO — solo desktop ──────────────
          Reemplaza el panel deslizable de abajo: info + acciones
          conviven en una columna fija en vez de flotar sobre la imagen.
          Siempre visible en desktop (a diferencia del panel mobile, que
          solo abre si hay contenido extra) porque acá viven Descargar/
          Compartir, que en mobile están siempre como botones flotantes. */}
      {showDesktopPanel && (
        <div className="hidden lg:flex w-[340px] flex-shrink-0 bg-slate-900 border-l border-white/10 flex-col p-5 overflow-y-auto">
          {metadata?.label && (
            <div className="flex items-center gap-2.5 pb-4 mb-4 border-b border-white/10">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex-shrink-0" />
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="text-white text-[13px] font-bold truncate">{metadata.label}</span>
                {metadata.date && <span className="text-white/40 text-[11px]">{metadata.date}</span>}
              </div>
            </div>
          )}

          {hasInfoPanel && (
            <div className="mb-5">{details}</div>
          )}

          <div className="flex flex-col gap-2 mt-auto pt-4">
            {hasActionsPanel && allActions.map((action, i) => (
              <button
                key={i}
                onClick={() => action.onClick(currentImage, currentIndex)}
                className="flex items-center gap-2.5 w-full px-3.5 py-3 rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 text-white text-[13px] font-bold transition-transform active:scale-[0.98]"
              >
                {action.icon}
                {action.label}
              </button>
            ))}
            <div className="flex gap-2">
              {hasBeforeAfterPair && (
                <button
                  onClick={() => setCompareMode(v => !v)}
                  aria-label="Comparar antes y después"
                  className={`flex-1 flex items-center justify-center py-2.5 rounded-xl border border-white/10 transition-colors ${
                    compareMode ? 'bg-gradient-to-br from-brand-400 to-brand-600 border-transparent' : 'bg-white/[0.06] hover:bg-white/[0.12]'
                  } text-white`}
                  title="Comparar"
                >
                  <MoveHorizontal size={15} />
                </button>
              )}
              <button
                onClick={handleShare}
                aria-label="Compartir"
                className="flex-1 flex items-center justify-center py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-white transition-colors"
                title="Compartir"
              >
                <Share2 size={15} />
              </button>
              <button
                onClick={handleDownload}
                aria-label="Descargar"
                className="flex-1 flex items-center justify-center py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-white transition-colors"
                title="Descargar"
              >
                <Download size={15} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PANEL DESLIZABLE (Info / Acciones) — solo mobile ─── */}
      {hasAnyPanel && (
        <div className="lg:hidden">
          <div
            className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${
              panelOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
            }`}
            style={{ zIndex: 3 }}
            onClick={() => setPanelOpen(false)}
          />
          <div
            className="absolute left-0 right-0 bottom-0 bg-slate-900 rounded-t-[22px] px-4 pt-3.5 pb-6 flex flex-col shadow-2xl transition-transform duration-300"
            style={{
              zIndex: 4,
              maxHeight: '64vh',
              transform: panelOpen ? 'translateY(0)' : 'translateY(100%)',
            }}
          >
            <div className="w-9 h-1 rounded-full bg-white/20 mx-auto mb-3.5 flex-shrink-0" />

            {hasInfoPanel && hasActionsPanel && (
              <div className="flex gap-1 bg-white/[0.06] rounded-xl p-1 mb-3.5 flex-shrink-0">
                <button
                  onClick={() => setActiveTab('info')}
                  className={`flex-1 py-2 rounded-lg text-[11px] font-bold transition-colors ${
                    activeTab === 'info' ? 'bg-white/12 text-white' : 'text-white/45'
                  }`}
                >
                  Info
                </button>
                <button
                  onClick={() => setActiveTab('actions')}
                  className={`flex-1 py-2 rounded-lg text-[11px] font-bold transition-colors ${
                    activeTab === 'actions' ? 'bg-white/12 text-white' : 'text-white/45'
                  }`}
                >
                  Acciones
                </button>
              </div>
            )}

            <div className="overflow-y-auto">
              {activeTab === 'info' && hasInfoPanel && details}

              {activeTab === 'actions' && hasActionsPanel && (
                <div className="grid grid-cols-2 gap-2">
                  {allActions.map((action, i) => (
                    <button
                      key={i}
                      onClick={() => action.onClick(currentImage, currentIndex)}
                      className="flex items-center justify-center gap-2 bg-white/[0.06] rounded-xl px-3 py-3 text-white text-[11px] font-bold"
                    >
                      {action.icon}
                      {action.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
};
