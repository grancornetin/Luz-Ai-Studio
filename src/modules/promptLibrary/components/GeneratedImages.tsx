import React from 'react';
import { Download, Share2, RefreshCw } from 'lucide-react';

interface GeneratedImagesProps {
  images: string[];
  onPublish: (imageUrl: string) => void;
}

const GeneratedImages: React.FC<GeneratedImagesProps> = ({ images, onPublish }) => {
  const [activeIndex, setActiveIndex] = React.useState(0);

  if (images.length === 0) return null;

  const activeImage = images[activeIndex];

  const downloadImage = (img: string) => {
    const link = document.createElement('a');
    link.href = img;
    link.download = 'generated.png';
    link.click();
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">

      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
        Generated Results
      </h3>

      {/* MAIN IMAGE */}
      <div className="group relative rounded-[40px] overflow-hidden bg-slate-100 shadow-xl aspect-[3/4]">

        <img
          src={activeImage}
          className="w-full h-full object-cover"
          alt="Generated result"
        />

        {/* ACTIONS */}
        <div className="absolute inset-0 bg-black/60 opacity-0 md:group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-4 p-6 hidden md:flex">

          <button
            onClick={() => onPublish(activeImage)}
            className="w-full py-4 bg-white text-indigo-600 rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:scale-105 transition-transform"
          >
            <Share2 className="w-4 h-4" />
            Publish Prompt
          </button>

          <div className="flex gap-3 w-full">

            <button
              onClick={() => downloadImage(activeImage)}
              className="flex-1 py-3 bg-white/20 backdrop-blur-md text-white rounded-xl flex items-center justify-center hover:bg-white/30 transition-colors"
            >
              <Download className="w-4 h-4" />
            </button>

            <button
              className="flex-1 py-3 bg-white/20 backdrop-blur-md text-white rounded-xl flex items-center justify-center hover:bg-white/30 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

          </div>

        </div>

      </div>

      {/* MOBILE ACTIONS */}
      <div className="flex md:hidden flex-col gap-3">
        <button
          onClick={() => onPublish(activeImage)}
          className="w-full py-4 bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-3 shadow-lg shadow-indigo-200 active:scale-[0.98] transition-all"
        >
          <Share2 className="w-4 h-4" />
          Publicar en Galería
        </button>

        <div className="flex gap-3">
          <button
            onClick={() => downloadImage(activeImage)}
            className="flex-1 py-4 bg-white border border-slate-100 text-slate-600 rounded-2xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest active:bg-slate-50 transition-all"
          >
            <Download className="w-4 h-4" />
            Bajar
          </button>

          <button
            className="flex-1 py-4 bg-white border border-slate-100 text-slate-600 rounded-2xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest active:bg-slate-50 transition-all"
          >
            <RefreshCw className="w-4 h-4" />
            Variar
          </button>
        </div>
      </div>


      {/* THUMBNAILS */}
      <div className="grid grid-cols-4 gap-3">

        {images.map((img, i) => (
          <button
            key={i}
            onClick={() => setActiveIndex(i)}
            className={`aspect-square rounded-2xl overflow-hidden border-2 transition-all ${
              activeIndex === i
                ? 'border-indigo-500 scale-105'
                : 'border-transparent opacity-70 hover:opacity-100'
            }`}
          >
            <img
              src={img}
              className="w-full h-full object-cover"
              alt={`thumb-${i}`}
            />
          </button>
        ))}

      </div>

    </div>
  );
};

export default GeneratedImages;