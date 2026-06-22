import React, { useEffect, useCallback, useState, useRef } from 'react';
import { X, ChevronLeft, ChevronRight, Download, Share2 } from 'lucide-react';
import { downloadImage } from '../../utils/imageUtils';

interface ImageLightboxProps {
  images: string[];
  initialIndex?: number;
  onClose: () => void;
  onDownload?: (imageUrl: string, index: number) => void;
  metadata?: { label?: string; date?: string; credits?: number };
  details?: React.ReactNode;
  extraButton?: {
    label: string;
    onClick: (imageUrl: string, index: number) => void;
    icon?: React.ReactNode;
  };
}

export const ImageLightbox: React.FC<ImageLightboxProps> = ({
  images,
  initialIndex = 0,
  onClose,
  onDownload,
  metadata,
  details,
  extraButton,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const [dragX, setDragX]     = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const currentImage = images[currentIndex];
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < images.length - 1;

  const goPrev = useCallback(() => {
    if (hasPrev) setCurrentIndex(i => i - 1);
  }, [hasPrev]);

  const goNext = useCallback(() => {
    if (hasNext) setCurrentIndex(i => i + 1);
  }, [hasNext]);

  // Keyboard
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [goPrev, goNext, onClose]);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // Touch handlers con umbral de swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = Math.abs(e.touches[0].clientY - (touchStartY.current ?? 0));
    // Solo arrastrar si el movimiento es más horizontal que vertical
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

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-md flex flex-col"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* ── BARRA SUPERIOR ────────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 pt-4 pb-2 safe-area-top">
        {/* Contador */}
        <div className="text-white/60 text-[11px] font-black uppercase tracking-widest">
          {currentIndex + 1} / {images.length}
          {metadata?.label && <span className="ml-2 text-white/40">· {metadata.label}</span>}
        </div>
        {/* Cerrar */}
        <button
          onClick={onClose}
          className="w-10 h-10 bg-white/10 hover:bg-white/20 active:bg-white/30 rounded-full flex items-center justify-center text-white transition-colors"
        >
          <X size={20} />
        </button>
      </div>

      {/* ── IMAGEN CENTRAL ────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center relative overflow-hidden px-2">
        {/* Flecha prev */}
        {hasPrev && (
          <button
            onClick={goPrev}
            aria-label="Imagen anterior"
            className="absolute left-2 z-10 flex w-11 h-11 bg-white/10 hover:bg-white/20 rounded-full items-center justify-center text-white transition-colors"
          >
            <ChevronLeft size={26} />
          </button>
        )}

        {/* Imagen con drag visual */}
        <div
          className="relative max-w-full max-h-full flex items-center justify-center"
          style={{
            transform: isDragging ? `translateX(${dragX * 0.3}px)` : 'none',
            transition: isDragging ? 'none' : 'transform 0.2s ease',
          }}
          onClick={(e) => {
            // Solo cerrar si el click es directamente en el fondo oscuro, no en la imagen
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <img
            key={currentIndex}
            src={currentImage}
            alt={`Imagen ${currentIndex + 1}`}
            className="max-w-full max-h-[75vh] sm:max-h-[85vh] object-contain rounded-xl shadow-2xl select-none animate-in fade-in duration-200"
            draggable={false}
          />
        </div>

        {/* Flecha next */}
        {hasNext && (
          <button
            onClick={goNext}
            aria-label="Imagen siguiente"
            className="absolute right-2 z-10 flex w-11 h-11 bg-white/10 hover:bg-white/20 rounded-full items-center justify-center text-white transition-colors"
          >
            <ChevronRight size={26} />
          </button>
        )}

        {/* Hint swipe — solo mobile, desaparece al inicio */}
        {images.length > 1 && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-white/25 text-[9px] font-bold uppercase tracking-widest sm:hidden pointer-events-none">
            ← desliza →
          </div>
        )}
      </div>

      {/* ── DOTS ──────────────────────────────────────────── */}
      {images.length > 1 && (
        <div className="flex-shrink-0 flex justify-center gap-1.5 py-2">
          {images.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className={`rounded-full transition-all duration-200 ${
                idx === currentIndex
                  ? 'w-5 h-2 bg-white'
                  : 'w-2 h-2 bg-white/30 hover:bg-white/50'
              }`}
            />
          ))}
        </div>
      )}

      {details && (
        <div className="flex-shrink-0 px-4 pb-2 max-h-[24vh] overflow-y-auto">
          {details}
        </div>
      )}

      {/* ── BARRA INFERIOR DE ACCIONES ────────────────────── */}
      <div className="flex-shrink-0 flex items-center gap-2 px-4 pb-6 pt-2 safe-area-bottom">
        {/* Descarga */}
        <button
          onClick={handleDownload}
          className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-white/10 hover:bg-white/18 active:bg-white/25 border border-white/10 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all"
        >
          <Download size={16} />
          Descargar
        </button>

        {/* Extra (Publicar, etc.) */}
        {extraButton && (
          <button
            onClick={() => extraButton.onClick(currentImage, currentIndex)}
            className="flex-[1.4] flex items-center justify-center gap-2 py-3.5 bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-[0_8px_24px_-8px_rgba(255,116,139,0.5)] transition-all"
          >
            {extraButton.icon ?? <Share2 size={16} />}
            {extraButton.label}
          </button>
        )}
      </div>
    </div>
  );
};
