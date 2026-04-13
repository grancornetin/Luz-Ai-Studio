import React from 'react';
import { Megaphone, Plus, Trash2, Loader2, Download, Zap, Image } from 'lucide-react';
import { generationService, GenerationProgress } from '../services/generationService';
import { PromptDNA } from '../types/promptTypes';

interface CampaignGeneratorProps {
  basePrompt: string;
  dna: PromptDNA;
  references: string[];
}

const DEFAULT_SCENES = [
  'coffee shop interior, morning light, warm atmosphere',
  'outdoor park, golden hour, natural lighting',
  'luxury hotel lobby, evening ambiance, elegant setting',
];

const MAX_SCENES = 5;
const MIN_SCENES = 2;

const CampaignGenerator: React.FC<CampaignGeneratorProps> = ({
  basePrompt,
  dna,
  references
}) => {

  const [scenes, setScenes]         = React.useState<string[]>(DEFAULT_SCENES);
  const [results, setResults]       = React.useState<string[]>([]);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [progress, setProgress]     = React.useState<GenerationProgress | null>(null);
  const [error, setError]           = React.useState<string | null>(null);

  const addScene = () => {
    if (scenes.length >= MAX_SCENES) return;
    setScenes(prev => [...prev, '']);
  };

  const removeScene = (index: number) => {
    if (scenes.length <= MIN_SCENES) return;
    setScenes(prev => prev.filter((_, i) => i !== index));
  };

  const updateScene = (index: number, value: string) => {
    setScenes(prev => prev.map((s, i) => i === index ? value : s));
  };

  const handleGenerate = async () => {
    if (!basePrompt.trim()) return;

    const validScenes = scenes.filter(s => s.trim().length > 0);
    if (validScenes.length === 0) return;

    setIsGenerating(true);
    setError(null);
    setResults([]);
    setProgress({ total: validScenes.length, completed: 0, current: 0 });

    try {
      // Construir prompts: base + escena para mantener identidad consistente
      const campaignPrompts = validScenes.map(scene =>
        `${basePrompt}, ${scene}, same person same identity same face, consistent character`
      );

      const images = await generationService.generateBatch(
        campaignPrompts,
        references,
        undefined,
        (p) => setProgress(p)
      );

      setResults(images);
    } catch (err: any) {
      setError(err?.message || 'Error generando la campaña.');
    } finally {
      setIsGenerating(false);
      setProgress(null);
    }
  };

  const downloadImage = (img: string, index: number) => {
    const link = document.createElement('a');
    link.href = img;
    link.download = `campaign_${index + 1}.png`;
    link.click();
  };

  const downloadAll = () => {
    results.forEach((img, i) => {
      setTimeout(() => downloadImage(img, i), i * 300);
    });
  };

  const canGenerate = basePrompt.trim().length > 0 &&
                      scenes.some(s => s.trim().length > 0) &&
                      !isGenerating;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">

      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-brand-500" />
            <h3 className="text-sm font-black text-white uppercase tracking-tighter italic">
              Campaign Generator
            </h3>
          </div>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            Mismo sujeto · Múltiples escenas
          </p>
        </div>

        {results.length > 0 && (
          <button
            onClick={downloadAll}
            className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            Descargar todo
          </button>
        )}
      </div>

      {/* BASE PROMPT PREVIEW */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">
          Sujeto base (desde compositor)
        </p>
        <p className="text-xs text-slate-400 italic line-clamp-2 leading-relaxed">
          "{basePrompt || 'Escribe un prompt en el compositor primero...'}"
        </p>
      </div>

      {/* SCENES */}
      <div className="space-y-3">

        <div className="flex items-center justify-between">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            Escenas ({scenes.length}/{MAX_SCENES})
          </p>
          {scenes.length < MAX_SCENES && (
            <button
              onClick={addScene}
              className="flex items-center gap-1.5 text-[9px] font-black text-brand-400 hover:text-brand-300 uppercase tracking-widest transition-colors"
            >
              <Plus className="w-3 h-3" />
              Añadir escena
            </button>
          )}
        </div>

        {scenes.map((scene, index) => (
          <div key={index} className="flex gap-2 items-start">

            <div className="flex-shrink-0 w-6 h-6 mt-3 flex items-center justify-center">
              <span className="text-[9px] font-black text-slate-600 uppercase">{index + 1}</span>
            </div>

            <input
              type="text"
              value={scene}
              onChange={(e) => updateScene(index, e.target.value)}
              placeholder={`Escena ${index + 1}: descripción del ambiente...`}
              className="flex-1 bg-white/5 border border-white/10 focus:border-brand-500/50 rounded-xl px-4 py-3 text-xs font-medium text-slate-300 placeholder-slate-600 outline-none transition-all"
            />

            {scenes.length > MIN_SCENES && (
              <button
                onClick={() => removeScene(index)}
                className="flex-shrink-0 w-9 h-9 mt-1 bg-white/5 hover:bg-rose-500/20 text-slate-600 hover:text-rose-400 rounded-xl flex items-center justify-center transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}

          </div>
        ))}

      </div>

      {/* GENERATE BUTTON */}
      <button
        onClick={handleGenerate}
        disabled={!canGenerate}
        className={`w-full py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-all ${
          !canGenerate
            ? 'bg-white/5 text-slate-600 cursor-not-allowed'
            : 'bg-gradient-to-r from-brand-600 to-violet-600 text-white hover:from-brand-500 hover:to-violet-500 shadow-2xl shadow-brand-900/50 hover:scale-[1.01] active:scale-[0.99]'
        }`}
      >
        {isGenerating ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            {progress
              ? `Generando ${progress.completed + 1} de ${progress.total}...`
              : 'Preparando campaña...'}
          </>
        ) : (
          <>
            <Zap className="w-4 h-4" />
            Generar Campaña ({scenes.filter(s => s.trim()).length} imágenes)
          </>
        )}
      </button>

      {/* PROGRESS BAR */}
      {isGenerating && progress && (
        <div className="space-y-2">
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-brand-500 to-violet-500 rounded-full transition-all duration-500"
              style={{ width: `${(progress.completed / progress.total) * 100}%` }}
            />
          </div>
          <p className="text-center text-[9px] font-black text-slate-500 uppercase tracking-widest">
            {progress.completed} / {progress.total} completadas
          </p>
        </div>
      )}

      {/* ERROR */}
      {error && (
        <div className="bg-red-900/20 border border-red-500/20 text-red-400 p-4 rounded-2xl text-[10px] font-bold uppercase tracking-tight">
          {error}
        </div>
      )}

      {/* RESULTS GRID */}
      {results.length > 0 && (
        <div className="space-y-4">

          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            {results.length} imágenes generadas
          </p>

          <div className="grid grid-cols-2 gap-3">
            {results.map((img, i) => (
              <div key={i} className="group relative aspect-[3/4] rounded-2xl overflow-hidden bg-slate-800">
                <img
                  src={img}
                  className="w-full h-full object-cover"
                  alt={`Campaign ${i + 1}`}
                />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-3">
                  <p className="text-[9px] font-black text-white uppercase tracking-widest">
                    Escena {i + 1}
                  </p>
                  <button
                    onClick={() => downloadImage(img, i)}
                    className="flex items-center gap-1.5 bg-white/20 backdrop-blur-md text-white px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-white/30 transition-colors"
                  >
                    <Download className="w-3 h-3" />
                    Descargar
                  </button>
                </div>
                <div className="absolute top-2 left-2 bg-black/50 text-white text-[8px] font-black px-2 py-1 rounded-lg uppercase">
                  #{i + 1}
                </div>
              </div>
            ))}

            {/* PLACEHOLDER SLOTS while generating */}
            {isGenerating && progress && Array.from({
              length: Math.max(0, progress.total - results.length)
            }).map((_, i) => (
              <div
                key={`placeholder-${i}`}
                className={`aspect-[3/4] rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center ${
                  i === 0 ? 'border-brand-500/50 animate-pulse' : ''
                }`}
              >
                {i === 0
                  ? <Loader2 className="w-6 h-6 text-brand-500 animate-spin" />
                  : <Image className="w-6 h-6 text-slate-700" />
                }
              </div>
            ))}
          </div>

        </div>
      )}

    </div>
  );
};

export default CampaignGenerator;
