import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Download, RefreshCw, Send, Share2 } from 'lucide-react';
import { ImageLightbox } from '../../../components/shared/ImageLightbox';
import { AddToProjectButton } from '../../../components/shared/AddToProjectButton';
import { downloadImage } from '../../../utils/imageUtils';

interface GeneratedImagesProps {
  images: string[];
  onPublish: (imageUrl: string) => void;
  onRegenerate?: () => void;
  module?: string;
}

const GeneratedImages: React.FC<GeneratedImagesProps> = ({
  images,
  onPublish,
  onRegenerate,
  module = 'prompt_studio',
}) => {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  if (images.length === 0) return null;

  const handleDownloadImage = (img: string, index: number) => {
    downloadImage(img, `generated_${index + 1}.png`);
  };

  const activeImage = images[lightboxIndex] ?? images[0];
  const hasMultiple = images.length > 1;
  const goPrev = () => setLightboxIndex((idx) => (idx === 0 ? images.length - 1 : idx - 1));
  const goNext = () => setLightboxIndex((idx) => (idx + 1) % images.length);

  return (
    <div className="flex flex-col gap-4 animate-in fade-in duration-500 flex-1">
      {/* Carrusel mobile */}
      <div className="md:hidden flex flex-col gap-3">
        <div
          role="button"
          tabIndex={0}
          className="relative w-full rounded-[28px] overflow-hidden bg-slate-950 border border-white/10 shadow-[0_20px_60px_rgba(15,23,42,0.28)]"
          onClick={() => setLightboxOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setLightboxOpen(true);
            }
          }}
        >
          <div className="w-full min-h-[360px] max-h-[68vh] flex items-center justify-center">
            <img
              src={activeImage}
              alt={`Resultado ${lightboxIndex + 1}`}
              className="w-full h-full max-h-[68vh] object-contain"
            />
          </div>

          <div className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur-sm text-white text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wide">
            {lightboxIndex + 1}/{images.length}
          </div>

          {hasMultiple && (
            <>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); goPrev(); }}
                aria-label="Imagen anterior"
                className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 text-slate-900 shadow-lg flex items-center justify-center active:scale-95"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); goNext(); }}
                aria-label="Imagen siguiente"
                className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 text-slate-900 shadow-lg flex items-center justify-center active:scale-95"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </>
          )}

          <div className="absolute bottom-3 left-3 right-3 bg-slate-900/80 backdrop-blur-sm text-white text-[11px] leading-relaxed px-3 py-2 rounded-2xl">
            1024 x 1024 · IA generada
          </div>
        </div>

        {hasMultiple && (
          <div className="flex justify-center gap-1.5">
            {images.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setLightboxIndex(i)}
                aria-label={`Ver resultado ${i + 1}`}
                className={`h-2 rounded-full transition-all ${i === lightboxIndex ? 'w-6 bg-brand-600' : 'w-2 bg-slate-300'}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Thumbnails grid desktop */}
      <div className={`hidden md:grid gap-3 flex-1 ${images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
        {images.map((img, i) => (
          <div
            key={i}
            className="group relative rounded-[24px] overflow-hidden bg-slate-800 cursor-pointer border border-white/8 hover:border-brand-400/60 transition-all"
            style={{ aspectRatio: images.length === 1 ? 'unset' : '1', minHeight: images.length === 1 ? 320 : undefined }}
            onClick={() => { setLightboxIndex(i); setLightboxOpen(true); }}
          >
            <img src={img} alt={`Resultado ${i + 1}`} className={`w-full h-full ${images.length === 1 ? 'object-contain' : 'object-cover'}`} />

            {/* Overlay hover */}
            <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              <button
                onClick={e => { e.stopPropagation(); handleDownloadImage(img, i); }}
                className="p-2.5 bg-white/15 backdrop-blur-md text-white rounded-full hover:bg-white/25 transition-colors"
                title="Descargar"
              >
                <Download className="w-4 h-4" />
              </button>
              <button
                onClick={e => { e.stopPropagation(); onPublish(img); }}
                className="p-2.5 bg-brand-600 text-white rounded-full hover:bg-brand-700 transition-colors"
                title="Publicar"
              >
                <Share2 className="w-4 h-4" />
              </button>
              <AddToProjectButton imageUrl={img} type="result" module={module} className="p-2.5" />
            </div>

            {/* Badge posición */}
            <div className="absolute top-2.5 left-2.5 bg-slate-900/80 backdrop-blur-sm text-white text-[9px] font-black px-2 py-0.5 rounded-lg uppercase tracking-wide">
              {i + 1}/{images.length}
            </div>

            {/* Metadata (solo primer resultado) */}
            {i === 0 && (
              <div
                className="absolute bottom-2.5 left-2.5 right-2.5 bg-slate-900/80 backdrop-blur-sm text-white text-[10px] leading-relaxed px-3 py-2 rounded-xl overflow-hidden"
                style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}
              >
                {/* Solo visible como referencia visual, no mostramos el prompt completo */}
                1024 × 1024 · IA generada
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Botones de acción */}
      <div className="flex gap-2.5 flex-shrink-0">
        <button
          onClick={() => handleDownloadImage(activeImage, lightboxIndex)}
          className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-[18px] bg-white/6 border border-white/8 text-white text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all"
        >
          <Download className="w-4 h-4" />
          <span className="hidden sm:inline">Descargar</span>
        </button>

        {onRegenerate && (
          <button
            onClick={onRegenerate}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-[18px] bg-white/6 border border-white/8 text-white text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="hidden sm:inline">Regenerar</span>
          </button>
        )}

        <button
          onClick={() => onPublish(activeImage)}
          className="flex-[1.4] flex items-center justify-center gap-2 py-3.5 rounded-[18px] bg-brand-600 text-white text-[10px] font-black uppercase tracking-widest shadow-[0_8px_24px_-8px_rgba(255,116,139,0.6)] hover:bg-brand-700 transition-all"
        >
          <Send className="w-4 h-4" />
          Publicar
        </button>
      </div>

      {/* Lightbox — renderizado via portal para escapar del stacking context del motion.div */}
      {lightboxOpen && createPortal(
        <ImageLightbox
          images={images}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxOpen(false)}
          onDownload={(url, idx) => handleDownloadImage(url, idx)}
          extraButton={{
            label: 'Publicar',
            onClick: (url) => onPublish(url),
            icon: <Share2 className="w-4 h-4" />,
          }}
          metadata={{ label: 'Imagen generada' }}
        />,
        document.body
      )}
    </div>
  );
};

export default GeneratedImages;
