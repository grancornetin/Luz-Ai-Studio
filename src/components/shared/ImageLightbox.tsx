import React, { useEffect, useCallback, useState } from 'react';
import { X, ChevronLeft, ChevronRight, Download } from 'lucide-react';

interface ImageLightboxProps {
  images: string[];
  initialIndex?: number;
  onClose: () => void;
  onDownload?: (imageUrl: string, index: number) => void;
  metadata?: { label?: string; date?: string; credits?: number };
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
  extraButton,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [touchStart, setTouchStart] = useState<number | null>(null);

  const currentImage = images[currentIndex];
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < images.length - 1;

  const goPrev = useCallback(() => {
    if (hasPrev) setCurrentIndex((i) => i - 1);
  }, [hasPrev]);

  const goNext = useCallback(() => {
    if (hasNext) setCurrentIndex((i) => i + 1);
  }, [hasNext]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goPrev, goNext, onClose]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    const diff = e.changedTouches[0].clientX - touchStart;
    if (Math.abs(diff) > 50) {
      if (diff > 0) goPrev();
      else goNext();
    }
    setTouchStart(null);
  };

  const handleDownload = () => {
    if (onDownload) {
      onDownload(currentImage, currentIndex);
    } else {
      const link = document.createElement('a');
      link.href = currentImage;
      link.download = `image-${Date.now()}.jpg`;
      link.click();
    }
  };

  const handleExtra = () => {
    extraButton?.onClick(currentImage, currentIndex);
  };

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-md flex items-center justify-center"
      onClick={onClose}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
        style={{ minWidth: 44, minHeight: 44 }}
      >
        <X size={24} />
      </button>

      {/* Download button */}
      <button
        onClick={handleDownload}
        className="absolute top-4 right-16 z-10 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
        style={{ minWidth: 44, minHeight: 44 }}
      >
        <Download size={24} />
      </button>

      {/* Extra button (e.g. Publish) */}
      {extraButton && (
        <button
          onClick={handleExtra}
          className="absolute top-4 right-28 z-10 p-2 bg-indigo-600 hover:bg-indigo-700 rounded-full text-white transition-colors flex items-center gap-1.5"
          style={{ minWidth: 44, minHeight: 44 }}
        >
          {extraButton.icon || <span>{extraButton.label}</span>}
        </button>
      )}

      {/* Image container */}
      <div
        className="relative max-w-[90vw] max-h-[90vh] flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={currentImage}
          alt={`Imagen ${currentIndex + 1}`}
          className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
        />

        {images.length > 1 && (
          <>
            {hasPrev && (
              <button
                onClick={goPrev}
                className="absolute left-4 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
                style={{ minWidth: 44, minHeight: 44 }}
              >
                <ChevronLeft size={32} />
              </button>
            )}
            {hasNext && (
              <button
                onClick={goNext}
                className="absolute right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
                style={{ minWidth: 44, minHeight: 44 }}
              >
                <ChevronRight size={32} />
              </button>
            )}
          </>
        )}

        {images.length > 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
            {images.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                className={`w-2 h-2 rounded-full transition-all ${
                  idx === currentIndex ? 'bg-white w-4' : 'bg-white/40 hover:bg-white/60'
                }`}
              />
            ))}
          </div>
        )}

        {metadata && (
          <div className="absolute bottom-4 left-4 bg-black/50 backdrop-blur-sm rounded-lg px-3 py-1.5 text-white text-xs">
            {metadata.label && <span>{metadata.label}</span>}
            {metadata.date && <span className="ml-2 opacity-70">{metadata.date}</span>}
            {metadata.credits && (
              <span className="ml-2 bg-brand-600 px-1.5 py-0.5 rounded">
                {metadata.credits} créditos
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};