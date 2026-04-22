/**
 * PhotodumpMode.tsx — FIXED
 * Fix: geminiService.generateText() acepta solo 1 argumento.
 * El system prompt se concatena dentro del prompt único.
 */
import React, { useState } from 'react';
import { Images, Loader2, Download, Shuffle, Image } from 'lucide-react';
import { generationService, GenerationProgress } from '../services/generationService';
import { PromptDNA } from '../types/promptTypes';
import { downloadAsZip } from '../../../utils/imageUtils';
import { ImageLightbox } from '../../../components/shared/ImageLightbox';
import { FloatingActionBar } from '../../../components/shared/FloatingActionBar';
import { useScrollFAB } from '../../../hooks/useScrollFAB';
import { geminiService } from '../../../services/geminiService';

interface PhotodumpModeProps {
  basePrompt: string;
  dna: PromptDNA;
  references: string[];
}

type Intensity = 'sutil' | 'media' | 'bold';

const INTENSITY_CONFIG: Record<Intensity, { label: string; description: string; color: string; instruction: string }> = {
  sutil: {
    label: 'Sutil',
    description: 'Mismo lugar, ángulos y luz distintos',
    color: 'bg-sky-600',
    instruction: 'Create subtle scene variations: same location but different camera angles (eye level, high angle, low angle), different framing (close-up, medium, wide), and slight lighting changes (golden hour, overcast, midday). Keep the same environment and activity.',
  },
  media: {
    label: 'Media',
    description: 'Sub-locaciones y actividades variadas',
    color: 'bg-violet-600',
    instruction: 'Create moderate scene variations: change specific sub-locations within the same context (e.g. if NYC: Times Square, Central Park, Brooklyn Bridge, a diner, subway station). Mix indoor and outdoor. Vary the activity slightly (walking, sitting, eating, looking). Change camera angle significantly.',
  },
  bold: {
    label: 'Bold',
    description: 'Escenas y momentos completamente distintos',
    color: 'bg-rose-600',
    instruction: 'Create bold creative variations: different iconic locations, different times of day (sunrise, midday, night), different activities (exploring, eating local food, candid street moment, selfie). Mix cinematic, candid, and detail shots.',
  },
};

const COUNT_OPTIONS = [3, 4, 5, 6];

async function buildContextualPrompts(
  basePrompt: string,
  count: number,
  intensity: Intensity,
): Promise<string[]> {
  // FIX: geminiService.generateText acepta solo 1 argumento
  // El system prompt va embebido en el único string que se pasa
  const fullPrompt = `You are a UGC photo director. Given a base prompt, generate ${count} unique image prompts for a coherent lifestyle/photodump set.

Rules:
- ${INTENSITY_CONFIG[intensity].instruction}
- Always preserve identity tokens like @persona1, @product1 from the base prompt
- Each prompt is 1-2 sentences, in English
- Output ONLY a JSON array of strings: ["prompt1", "prompt2", ...]
- No markdown, no explanation, just the JSON array

Base prompt: "${basePrompt}"
Generate ${count} prompts now.`;

  try {
    const raw = await geminiService.generateText(fullPrompt);
    const cleaned = raw.replace(/```json|```/g, '').trim();
    // Find JSON array in response
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.slice(0, count).map(p => typeof p === 'string' ? p : String(p));
      }
    }
  } catch (err) {
    console.warn('[PhotodumpMode] Gemini prompt generation failed, using fallback:', err);
  }

  // Fallback: simple scene variations
  const fallbackScenes = [
    'wide establishing shot, natural lighting, photorealistic UGC style',
    'close-up portrait, golden hour light, photorealistic UGC style',
    'candid mid-shot, street level, photorealistic UGC style',
    'detail shot, shallow depth of field, photorealistic UGC style',
    'environmental wide shot, dusk lighting, photorealistic UGC style',
    'overhead perspective, bright midday light, photorealistic UGC style',
  ];
  return fallbackScenes.slice(0, count).map(scene => `${basePrompt}, ${scene}`);
}

const PhotodumpMode: React.FC<PhotodumpModeProps> = ({ basePrompt, dna, references }) => {
  const [count, setCount]         = useState(4);
  const [intensity, setIntensity] = useState<Intensity>('media');
  const [results, setResults]     = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress]   = useState<GenerationProgress | null>(null);
  const [error, setError]         = useState<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const { isVisible: fabVisible } = useScrollFAB({ threshold: 100, alwaysVisibleOnMobile: false });

  const hasReferences = references.length > 0;

  const handleGenerate = async () => {
    if (!basePrompt.trim()) return;
    setIsGenerating(true);
    setError(null);
    setResults([]);
    setProgress({ total: count, completed: 0, current: 0 });

    try {
      const prompts = await buildContextualPrompts(basePrompt, count, intensity);
      const images = await generationService.generateBatchFlash(
        prompts,
        references,
        undefined,
        (p) => setProgress(p),
      );
      setResults(images.filter(Boolean));
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

  const downloadAllZip = async () => {
    if (results.length === 0) return;
    await downloadAsZip(results, `photodump_${Date.now()}.zip`, 'dump');
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
            Genera un set coherente de escenas · IA como director creativo
          </p>
        </div>
      </div>

      {/* BASE PROMPT PREVIEW */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-2">
        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Contexto base</p>
        <p className="text-xs text-slate-400 italic line-clamp-2 leading-relaxed">
          "{basePrompt || 'Escribe un prompt en el compositor primero...'}"
        </p>
        <div className={`flex items-center gap-2 text-[9px] font-black uppercase tracking-widest ${hasReferences ? 'text-emerald-400' : 'text-slate-600'}`}>
          <div className={`w-1.5 h-1.5 rounded-full ${hasReferences ? 'bg-emerald-400' : 'bg-slate-600'}`} />
          {hasReferences
            ? `${references.length} referencia${references.length > 1 ? 's' : ''} activa${references.length > 1 ? 's' : ''} · identidad preservada`
            : 'Sin referencias — sube imágenes en los slots para preservar identidad'}
        </div>
      </div>

      {/* CONTROLS */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Cantidad</p>
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

        <div className="space-y-2">
          <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Variación de escena</p>
          <div className="flex gap-2">
            {(Object.keys(INTENSITY_CONFIG) as Intensity[]).map(level => (
              <button
                key={level}
                onClick={() => setIntensity(level)}
                className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${
                  intensity === level
                    ? `${INTENSITY_CONFIG[level].color} text-white shadow-lg`
                    : 'bg-white/5 text-slate-500 hover:bg-white/10 hover:text-slate-300'
                }`}
              >
                {INTENSITY_CONFIG[level].label}
              </button>
            ))}
          </div>
        </div>
      </div>

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
            {progress ? `${progress.completed} / ${progress.total} generadas...` : 'IA creando contexto...'}
          </>
        ) : (
          <>
            <Shuffle className="w-4 h-4" />
            Generar {count} imágenes del set
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

      {/* RESULTS */}
      {results.length > 0 && (
        <div className="space-y-3">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            {results.length} imágenes · Photodump completo
          </p>
          <div className="columns-2 gap-3 space-y-3">
            {results.map((img, i) => (
              <div
                key={i}
                className="group relative rounded-2xl overflow-hidden bg-slate-800 break-inside-avoid cursor-pointer"
                onClick={() => { setLightboxIndex(i); setLightboxOpen(true); }}
              >
                <img src={img} className="w-full object-cover" alt={`Photodump ${i + 1}`} />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <button
                    onClick={(e) => { e.stopPropagation(); downloadImage(img, i); }}
                    className="bg-white/20 backdrop-blur-md text-white p-2 rounded-xl hover:bg-white/30"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
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

      {/* LIGHTBOX */}
      {lightboxOpen && results.length > 0 && (
        <ImageLightbox
          images={results}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxOpen(false)}
          onDownload={(url, idx) => downloadImage(url, idx)}
          metadata={{ label: 'Photodump' }}
        />
      )}

      {/* FAB */}
      {results.length > 0 && fabVisible && (
        <FloatingActionBar
          isVisible={true}
          primaryAction={{
            label: 'Descargar ZIP',
            icon: <Download className="w-4 h-4" />,
            onClick: downloadAllZip,
          }}
          onClearSelection={() => setResults([])}
          selectedCount={0}
        />
      )}
    </div>
  );
};



export default PhotodumpMode;