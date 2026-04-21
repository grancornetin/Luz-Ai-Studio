import React, { useState } from 'react';
import { Share2, Download } from 'lucide-react';
import { ImageLightbox } from '../../../components/shared/ImageLightbox';

interface GeneratedImagesProps {
  images: string[];
  onPublish: (imageUrl: string) => void;
}

const GeneratedImages: React.FC<GeneratedImagesProps> = ({ images, onPublish }) => {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  if (images.length === 0) return null;

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  const downloadImage = (img: string, index: number) => {
    const link = document.createElement('a');
    link.href = img;
    link.download = `generated_${index + 1}.png`;
    link.click();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
        Resultados generados ({images.length})
      </h3>

      {/* Grid de thumbnails */}
      <div className="grid grid-cols-2 gap-4">
        {images.map((img, i) => (
          <div
            key={i}
            className="group relative aspect-[3/4] rounded-2xl overflow-hidden bg-slate-800 cursor-pointer border-2 border-transparent hover:border-brand-500 transition-all"
            onClick={() => openLightbox(i)}
          >
            <img src={img} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  downloadImage(img, i);
                }}
                className="p-2 bg-white/20 backdrop-blur-md text-white rounded-full hover:bg-white/30"
              >
                <Download className="w-4 h-4" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onPublish(img);
                }}
                className="p-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-700"
              >
                <Share2 className="w-4 h-4" />
              </button>
            </div>
            <div className="absolute top-2 left-2 bg-black/60 text-white text-[8px] font-black px-2 py-1 rounded-lg uppercase">
              #{i + 1}
            </div>
          </div>
        ))}
      </div>

      {/* Lightbox con botón de publicar */}
      {lightboxOpen && (
        <ImageLightbox
          images={images}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxOpen(false)}
          onDownload={(url, idx) => downloadImage(url, idx)}
          extraButton={{
            label: 'Publicar',
            onClick: (url) => onPublish(url),
            icon: <Share2 className="w-4 h-4" />
          }}
          metadata={{ label: 'Imagen generada' }}
        />
      )}
    </div>
  );
};

export default GeneratedImages;