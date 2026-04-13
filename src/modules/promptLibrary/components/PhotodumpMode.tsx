import React from 'react';
import { Images, Loader2, Download, Zap, Image, Shuffle } from 'lucide-react';
import { generationService, GenerationProgress } from '../services/generationService';
import { PromptDNA } from '../types/promptTypes';

interface PhotodumpModeProps {
  basePrompt: string;
  dna: PromptDNA;
  references: string[];
}

type Intensity = 'sutil' | 'media' | 'bold';

const INTENSITY_CONFIG: Record<Intensity, {
  label: string;
  description: string;
  suffixes: string[];
}> = {
  sutil: {
    label: 'Sutil',
    description: 'Cambios mínimos de ángulo y luz',
    suffixes: [
      'slightly different angle',
      'soft variation, same mood',
      'minimal change, consistent style',
      'gentle lighting shift',
      'subtle framing variation',
      'same scene, small adjustment',
    ]
  },
  media: {
    label: 'Media',
    description: 'Variaciones de composición y ambiente',
    suffixes: [
      'different composition, same subject',
      'varied lighting mood',
      'alternative framing and angle',
      'different time of day atmosphere',
      'compositional variation, same style',
      'shifted perspective, consistent identity',
    ]
  },
  bold: {
    label: 'Bold',
    description: 'Cambios creativos de estilo y escena',
    suffixes: [
      'bold artistic reinterpretation, same identity',
      'dramatic lighting change, strong contrast',
      'completely different scene, same subject',
      'experimental color grading, same person',
      'strong mood shift, cinematic style',
      'creative visual storytelling, consistent character',
    ]
  }
};

const COUNT_OPTIONS = [3, 4, 5, 6];

const PhotodumpMode: React.FC<PhotodumpModeProps> = ({
  basePrompt,
  dna,
  references
}) => {

  const [count, setCount]           = React.useState(4);
  const [intensity, setIntensity]   = React.useState<Intensity>('media');
  const [results, setResults]       = React.useState<string[]>([]);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [progress, setProgress]     = React.useState<GenerationProgress | null>(null);
  const [error, setError]           = React.useState<string | null>(null);

  const handleGenerate = async () => {
    if (!basePrompt.trim()) return;

    setIsGenerating(true);
    setError(null);
    setResults([]);
    setProgress({ total: count, completed: 0, current: 0 });

    try {
      const config = INTENSITY_CONFIG[intensity];

      // Selecciona N suffixes al azar sin repetir
      const shuffled = [...config.suffixes].sort(() => Math.random() - 0.5);
      const selected = shuffled.slice(0, count);

      const prompts = selected.map(suffix =>
        `${basePrompt}, ${suffix}, same person same identity same face`
      );

      const images = await generationService.generateBatch(
        prompts,
        references,
        undefined,
        (p) => setProgress(p)
      );

      setResults(images);
    } catch (err: any) {
      setError(err?.message || 'Error generando el photodump.');
    } finally {
      setIsGenerating(false);
      setProgress(null);
    }
  };

  const downloadImage = (img: string, index: number) => {
    const link = document.createElement('a');
    link.href = img;
    link.download = `photodump_${index + 1}.png`;
    link.click();
  };

  const downloadAll = () => {
    results.forEach((img, i) => {
      setTimeout(() => downloadImage(img, i), i * 300);
    });
  };

  const canGenerate = basePrompt.trim().length > 0 && !isGenerating;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">

      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Images className="w-5 h-5 text-violet-400" />
            <h3 className="text-sm font-black text-white uppercase tracking-tighter italic">
              Photodump Mode
            </h3>
          </div>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            Generación masiva · Variaciones automáticas
          </p>
        </div>

        {results.length > 0 && (
          <button
            onClick={downloadAll}
            className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            Todo
          </button>
        )}
      </div>

      {/* BASE PROMPT */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Prompt base</p>
        <p className="text-xs text-slate-400 italic line-clamp-2 leading-relaxed">
          "{basePrompt || 'Escribe un prompt en el compositor primero...'}"
        </p>
      </div>

      {/* CONTROLS ROW */}
      <div className="grid grid-cols-2 gap-4">

        {/* COUNT */}
        <div className="space-y-2">
          <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
            Cantidad
          </p>
          <div className="flex gap-2">
            {COUNT_OPTIONS.map(n => (
              <button
                key={n}
                onClick={() => setCount(n)}
                className={`flex-1 py-3 rounded-xl text-xs font-black uppercase transition-all ${
                  count === n
                    ? 'bg-violet-600 text-white shadow-lg shadow-violet-900/50'
                    : 'bg-white/5 text-slate-500 hover:bg-white/10 hover:text-slate-300'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* INTENSITY */}
        <div className="space-y-2">
          <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
            Intensidad
          </p>
          <div className="flex gap-2">
            {(Object.keys(INTENSITY_CONFIG) as Intensity[]).map(level => (
              <button
                key={level}
                onClick={() => setIntensity(level)}
                className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${
                  intensity === level
                    ? level === 'sutil'   ? 'bg-sky-600 text-white shadow-lg'
                    : level === 'media'   ? 'bg-violet-600 text-white shadow-lg'
                    :                       'bg-rose-600 text-white shadow-lg'
                    : 'bg-white/5 text-slate-500 hover:bg-white/10 hover:text-slate-300'
                }`}
              >
                {INTENSITY_CONFIG[level].label}
              </button>
            ))}
          </div>
        </div>

      </div>

      {/* INTENSITY DESCRIPTION */}
      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest -mt-4">
        {INTENSITY_CONFIG[intensity].description}
      </p>

      {/* GENERATE BUTTON */}
      <button
        onClick={handleGenerate}
        disabled={!canGenerate}
        className={`w-full py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-all ${
          !canGenerate
            ? 'bg-white/5 text-slate-600 cursor-not-allowed'
            : 'bg-gradient-to-r from-violet-600 to-pink-600 text-white hover:from-violet-500 hover:to-pink-500 shadow-2xl shadow-violet-900/50 hover:scale-[1.01] active:scale-[0.99]'
        }`}
      >
        {isGenerating ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            {progress
              ? `${progress.completed} / ${progress.total} generadas...`
              : 'Iniciando photodump...'}
          </>
        ) : (
          <>
            <Shuffle className="w-4 h-4" />
            Generar {count} imágenes
          </>
        )}
      </button>

      {/* PROGRESS BAR */}
      {isGenerating && progress && (
        <div className="space-y-2">
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-violet-500 to-pink-500 rounded-full transition-all duration-500"
              style={{ width: `${(progress.completed / progress.total) * 100}%` }}
            />
          </div>
          <p className="text-center text-[9px] font-black text-slate-500 uppercase tracking-widest">
            {progress.completed} de {progress.total} completadas
          </p>
        </div>
      )}

      {/* ERROR */}
      {error && (
        <div className="bg-red-900/20 border border-red-500/20 text-red-400 p-4 rounded-2xl text-[10px] font-bold uppercase tracking-tight">
          {error}
        </div>
      )}

      {/* RESULTS — masonry-style 2-col */}
      {results.length > 0 && (
        <div className="space-y-3">

          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            {results.length} imágenes · Photodump completo
          </p>

          <div className="columns-2 gap-3 space-y-3">
            {results.map((img, i) => (
              <div
                key={i}
                className="group relative rounded-2xl overflow-hidden bg-slate-800 break-inside-avoid"
              >
                <img
                  src={img}
                  className="w-full object-cover"
                  alt={`Photodump ${i + 1}`}
                />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <button
                    onClick={() => downloadImage(img, i)}
                    className="bg-white/20 backdrop-blur-md text-white p-3 rounded-xl hover:bg-white/30 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}

            {/* PLACEHOLDERS */}
            {isGenerating && progress && Array.from({
              length: Math.max(0, progress.total - results.length)
            }).map((_, i) => (
              <div
                key={`ph-${i}`}
                className={`aspect-[3/4] rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center break-inside-avoid ${
                  i === 0 ? 'border-violet-500/50 animate-pulse' : ''
                }`}
              >
                {i === 0
                  ? <Loader2 className="w-5 h-5 text-violet-500 animate-spin" />
                  : <Image className="w-5 h-5 text-slate-700" />
                }
              </div>
            ))}
          </div>

        </div>
      )}

    </div>
  );
};

export default PhotodumpMode;
