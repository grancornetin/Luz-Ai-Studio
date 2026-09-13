import React, { useEffect, useCallback, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Download, Share2, MoreVertical, Star, MoveHorizontal } from 'lucide-react';
import { downloadImage } from '../../utils/imageUtils';
import { BeforeAfterSlider } from './BeforeAfterSlider';

interface ImageLightboxProps {
  images: string[];
  initialIndex?: number;
  onClose: () => void;
  onDownload?: (imageUrl: string, index: number) => void;
  metadata?: { label?: string; date?: string; credits?: number };
  /** Contenido de la pestaña "Info" del panel deslizable — mismo uso que antes. */
  details?: React.ReactNode;
  /** Compatibilidad con el uso anterior (un solo botón extra). Preferir
   * `secondaryActions` para más de una acción — ambas conviven. */
  extraButton?: {
    label: string;
    onClick: (imageUrl: string, index: number) => void;
    icon?: React.ReactNode;
  };
  /** Botones adicionales en la columna de acciones flotantes (además de
   * Descargar, que siempre está). Se muestran en el orden dado. */
  secondaryActions?: {
    label: string;
    onClick: (imageUrl: string, index: number) => void;
    icon?: React.ReactNode;
  }[];
  /** Etiqueta por imagen (mismo orden que `images`) — ej. ['Objetivo', 'Antes', 'Después'].
   * Alimenta la tira de miniaturas y la pestaña "Comparar" del panel. */
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
  const hasAnyPanel = hasInfoPanel || hasActionsPanel;

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
      className="fixed inset-0 z-[9999] bg-black flex flex-col"
      style={{ height: '100dvh' }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* ── BARRA SUPERIOR ────────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 pt-4 pb-2 safe-area-top relative z-[2]">
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

      {/* ── IMAGEN CENTRAL (o slider de comparación) ──────── */}
      <div className="flex-1 flex items-center justify-center relative overflow-hidden px-3">
        {compareMode && hasBeforeAfterPair ? (
          <BeforeAfterSlider
            beforeSrc={images[beforeIdx]}
            afterSrc={images[afterIdx]}
            className="h-full max-w-full"
          />
        ) : (
          <div
            className="relative max-w-full max-h-full flex items-center justify-center"
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

        {/* Columna de acciones flotantes */}
        <div className="absolute right-4 bottom-4 flex flex-col-reverse gap-2.5 z-[2]">
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
      </div>

      {/* ── TIRA DE MINIATURAS ────────────────────────────── */}
      {images.length > 1 && (
        <div
          className="flex-shrink-0 px-4 pt-1 relative z-[2]"
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

      {/* ── PANEL DESLIZABLE (Info / Acciones) ────────────── */}
      {hasAnyPanel && (
        <>
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
        </>
      )}
    </div>,
    document.body
  );
};
