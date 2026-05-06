import React, { useState } from 'react';
import {
  Images, Loader2, Download, Image,
  BookOpen, ChevronRight, ChevronLeft,
  Copy, Check, Sparkles, Hash,
} from 'lucide-react';
import ModuleTutorial from '../../../components/shared/ModuleTutorial';
import { TUTORIAL_CONFIGS } from '../../../components/shared/tutorialConfigs';
import { generationService, GenerationProgress } from '../services/generationService';
import { PromptDNA } from '../types/promptTypes';
import { downloadAsZip } from '../../../utils/imageUtils';
import { ImageLightbox } from '../../../components/shared/ImageLightbox';
import { geminiService } from '../../../services/geminiService';
import { newSessionId } from '../../../services/imageApiService';
import { useAuth } from '../../auth/AuthContext';

interface PhotodumpModeProps {
  basePrompt: string;
  dna: PromptDNA;
  references: string[];
  copilotPreset?: Record<string, string>;
}

// ── Tipos de narrativa ────────────────────────────────────────
type Narrative = 'day' | 'journey' | 'brand' | 'character' | 'custom';

const NARRATIVES: { id: Narrative; label: string; description: string; icon: string }[] = [
  { id: 'day',       label: 'Un día con el producto', description: 'Mañana → tarde → noche. El producto como compañero del día', icon: '☀️' },
  { id: 'journey',   label: 'Viaje o experiencia',    description: 'Llegada, exploración, momentos, recuerdo final',            icon: '✈️' },
  { id: 'brand',     label: 'Mundo de marca',         description: 'Estética, valores y lifestyle que representa la marca',     icon: '✨' },
  { id: 'character', label: 'El personaje y su mundo', description: 'Quién es, qué hace, cómo vive — historia del influencer',  icon: '🎭' },
  { id: 'custom',    label: 'Historia personalizada',  description: 'Describe tu propia narrativa y la IA la interpreta',       icon: '✍️' },
];

type Protagonist = 'person' | 'product' | 'both';
const PROTAGONISTS: { id: Protagonist; label: string }[] = [
  { id: 'person',  label: 'Persona / Influencer' },
  { id: 'product', label: 'Producto / Objeto' },
  { id: 'both',    label: 'Persona + Producto' },
];

const COUNT_OPTIONS = [3, 4, 5, 6];

type Step = 'brief' | 'generating' | 'results';

// ── Resultado enriquecido ─────────────────────────────────────
interface DumpResult {
  imageUrl: string;
  moment:   string;
  caption:  string;
  hashtags: string;
  prompt:   string;
  order:    number;
}

// ── Gemini: construye el arco narrativo ───────────────────────
async function buildNarrativePrompts(
  basePrompt:  string,
  narrative:   Narrative,
  protagonist: Protagonist,
  customStory: string,
  count:       number,
): Promise<{ moment: string; scenePrompt: string; caption: string; hashtags: string }[]> {
  const narrativeLabel = NARRATIVES.find(n => n.id === narrative)?.label ?? narrative;
  const storyContext   = narrative === 'custom' ? customStory : narrativeLabel;

  const protagonistInstruction =
    protagonist === 'person'  ? 'The protagonist is a person. Focus on them, their emotions, and their environment.' :
    protagonist === 'product' ? 'The protagonist is the product/object. Make it the visual star. Show it in different contexts, angles, and uses.' :
                                'Both the person and the product are protagonists. Show their relationship and interaction.';

  const fullPrompt = `You are a visual storyteller and creative director for social media content.

Create ${count} image prompts that tell a coherent visual story as a photodump/carousel set.

NARRATIVE CONTEXT: ${storyContext}
BASE PROMPT / SUBJECT: "${basePrompt}"
PROTAGONIST FOCUS: ${protagonistInstruction}

Your task: generate exactly ${count} scene entries that form a progressive narrative arc.
Arc structure for ${count} images:
- First image: establish the world / opening moment (hook)
- Middle images: development, different angles, emotional beats, textures, details
- Last image: resolution / memorable closing moment

Each entry must have:
1. "moment": a short name for this beat in the story (3-5 words, e.g. "Morning ritual")
2. "scenePrompt": visual direction in English (1-2 sentences). Describe environment, lighting, camera style, mood. Do NOT repeat the subject — only the scene context. Keep it organic, not commercial.
3. "caption": a short, engaging social media caption in Spanish (max 140 chars, conversational tone, can include 1-2 emojis)
4. "hashtags": 4-6 relevant hashtags in Spanish/English as a single string (e.g. "#lifestyle #ootd #moda")

Rules:
- The set must feel like a real person's authentic photodump, not a brand ad
- Vary camera angles: wide establishing, medium, close-up detail, overhead, candid
- Vary lighting: golden hour, soft indoor, dramatic, natural
- Each moment should feel distinct but connected to the same story
- Tone should be warm and personal, not corporate

Output ONLY a valid JSON array, no markdown, no explanation:
[
  {
    "moment": "...",
    "scenePrompt": "...",
    "caption": "...",
    "hashtags": "..."
  }
]`;

  try {
    const raw     = await geminiService.generateText(fullPrompt);
    const cleaned = raw.replace(/```json|```/g, '').trim();
    const match   = cleaned.match(/\[[\s\S]*\]/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.slice(0, count);
      }
    }
  } catch (err) {
    console.warn('[PhotodumpMode] Gemini narrative generation failed, using fallback:', err);
  }

  // Fallback: arco narrativo genérico
  const fallback = [
    { moment: 'Apertura', scenePrompt: 'wide establishing shot, soft morning light, golden hour, warm atmosphere, film grain', caption: 'Así empieza todo...', hashtags: '#lifestyle #morning #aesthetic' },
    { moment: 'El detalle', scenePrompt: 'close-up detail shot, shallow depth of field, soft natural light, intimate framing', caption: 'Los detalles importan.', hashtags: '#detail #photography #organic' },
    { moment: 'El momento', scenePrompt: 'candid mid shot, street level, natural light, photorealistic UGC style', caption: 'Momentos que quedan.', hashtags: '#candid #reallife #moments' },
    { moment: 'La textura', scenePrompt: 'macro texture detail, studio lighting, clean composition, editorial feel', caption: 'Calidad que se siente.', hashtags: '#texture #quality #editorial' },
    { moment: 'El cierre', scenePrompt: 'wide atmospheric shot, dusk lighting, cinematic mood, emotional distance', caption: 'Hasta la próxima.', hashtags: '#sunset #vibes #lifestyle' },
    { moment: 'Overhead', scenePrompt: 'overhead flat lay perspective, bright natural light, clean organized composition', caption: 'Todo en orden.', hashtags: '#flatlay #aesthetic #organized' },
  ];
  return fallback.slice(0, count).map(f => ({
    ...f,
    scenePrompt: `${basePrompt}, ${f.scenePrompt}`,
  }));
}

// ── Componente principal ──────────────────────────────────────
const PhotodumpMode: React.FC<PhotodumpModeProps> = ({ basePrompt, dna, references, copilotPreset }) => {
  const { user } = useAuth();

  // Brief state — initialize from copilot preset if present
  const [narrative,    setNarrative]    = useState<Narrative>((copilotPreset?.narrative as Narrative) || 'day');
  const [protagonist,  setProtagonist]  = useState<Protagonist>((copilotPreset?.protagonist as Protagonist) || 'person');
  const [customStory,  setCustomStory]  = useState(copilotPreset?.customStory ? decodeURIComponent(copilotPreset.customStory) : '');
  const [count,        setCount]        = useState(copilotPreset?.count ? parseInt(copilotPreset.count) : 4);

  // Flow state
  const [step,         setStep]         = useState<Step>('brief');
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress,     setProgress]     = useState<GenerationProgress | null>(null);
  const [error,        setError]        = useState<string | null>(null);
  const [results,      setResults]      = useState<DumpResult[]>([]);

  // UI
  const [lightboxOpen,  setLightboxOpen]  = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [copiedIdx,     setCopiedIdx]     = useState<number | null>(null);

  const hasReferences = references.length > 0;
  const canGenerate   = basePrompt.trim().length > 0 && !isGenerating &&
    (narrative !== 'custom' || customStory.trim().length > 0);

  const handleGenerate = async () => {
    if (!canGenerate) return;

    setStep('generating');
    setIsGenerating(true);
    setError(null);
    setResults([]);
    setProgress({ total: count, completed: 0, current: 0 });

    try {
      // 1. Gemini construye el arco narrativo
      const scenes = await buildNarrativePrompts(
        basePrompt,
        narrative,
        protagonist,
        customStory,
        count,
      );

      // 2. Construir prompts finales
      const finalPrompts = scenes.map(s => {
        const identity = hasReferences
          ? ', same person same identity same face, consistent character'
          : '';
        return `${basePrompt}, ${s.scenePrompt}${identity}, photorealistic, UGC style`;
      });

      // 3. Generar imágenes
      const images = await generationService.generateBatchFlash(
        finalPrompts,
        references,
        undefined,
        (p) => setProgress(p),
        {
          uid:         user?.uid,
          sessionId:   newSessionId(),
          module:      'prompt_studio',
          moduleLabel: 'AI Generator (Photodump)',
          metadata: { narrative, protagonist, count, basePrompt: basePrompt.slice(0, 100) },
        },
      );

      // 4. Combinar con metadata
      const enriched: DumpResult[] = images.filter(Boolean).map((url, i) => ({
        imageUrl: url,
        moment:   scenes[i]?.moment   ?? `Momento ${i + 1}`,
        caption:  scenes[i]?.caption  ?? '',
        hashtags: scenes[i]?.hashtags ?? '',
        prompt:   finalPrompts[i]     ?? '',
        order:    i + 1,
      }));

      setResults(enriched);
      setStep('results');
    } catch (err: any) {
      setError(err?.message || 'Error generando el photodump.');
      setStep('brief');
    } finally {
      setIsGenerating(false);
      setProgress(null);
    }
  };

  const copyText = (text: string, key: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(key);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const downloadImage = (img: string, index: number) => {
    const link = document.createElement('a');
    link.href = img;
    link.download = `photodump_${index + 1}.png`;
    link.click();
  };

  const downloadAllZip = async () => {
    if (results.length === 0) return;
    await downloadAsZip(results.map(r => r.imageUrl), `photodump_${Date.now()}.zip`, 'dump');
  };

  const reset = () => {
    setStep('brief');
    setResults([]);
    setError(null);
  };

  // ── STEP: BRIEF ───────────────────────────────────────────
  if (step === 'brief') return (
    <div className="space-y-7 animate-in fade-in duration-500">

      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Images className="w-5 h-5 text-violet-400" />
            <h3 className="text-sm font-black text-white uppercase tracking-tighter italic">Photodump Mode</h3>
          </div>
          <ModuleTutorial moduleId="photodumpMode" steps={TUTORIAL_CONFIGS.photodumpMode} label="¿Cómo funciona?" compact />
        </div>
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
          Cuenta una historia visual · IA como director de narrativa
        </p>
      </div>

      {/* Contexto base */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-2">
        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Contexto base</p>
        <p className="text-xs text-slate-400 italic line-clamp-2 leading-relaxed">
          "{basePrompt || 'Escribe un prompt en el compositor primero...'}"
        </p>
        <div className={`flex items-center gap-2 text-[9px] font-black uppercase tracking-widest ${hasReferences ? 'text-emerald-400' : 'text-slate-600'}`}>
          <div className={`w-1.5 h-1.5 rounded-full ${hasReferences ? 'bg-emerald-400' : 'bg-slate-600'}`} />
          {hasReferences
            ? `${references.length} referencia${references.length > 1 ? 's' : ''} activa${references.length > 1 ? 's' : ''} · identidad preservada`
            : 'Sin referencias — sube imágenes para preservar identidad'}
        </div>
      </div>

      {/* Narrativa */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <BookOpen className="w-3.5 h-3.5 text-slate-500" />
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">¿Qué historia cuenta este set?</p>
        </div>
        <div className="grid grid-cols-1 gap-2">
          {NARRATIVES.map(n => (
            <button
              key={n.id}
              onClick={() => setNarrative(n.id)}
              className={`text-left p-3 rounded-xl border transition-all flex items-center gap-3 ${
                narrative === n.id
                  ? 'bg-violet-600/20 border-violet-500/50 text-white'
                  : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/8 hover:text-slate-300'
              }`}
            >
              <span className="text-lg flex-shrink-0">{n.icon}</span>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-tight">{n.label}</p>
                <p className="text-[9px] text-slate-500 mt-0.5 leading-tight">{n.description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Historia personalizada */}
      {narrative === 'custom' && (
        <div className="space-y-2 animate-in fade-in duration-300">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Describe tu historia</p>
          <textarea
            value={customStory}
            onChange={e => setCustomStory(e.target.value)}
            placeholder="Ej: Una chef que muestra su proceso de preparar un plato especial, desde ir al mercado hasta el emplatado final..."
            rows={3}
            className="w-full bg-white/5 border border-white/10 focus:border-violet-500/50 rounded-xl px-4 py-3 text-xs font-medium text-slate-300 placeholder-slate-600 outline-none transition-all resize-none"
          />
        </div>
      )}

      {/* Protagonista */}
      <div className="space-y-2">
        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Protagonista del set</p>
        <div className="flex gap-2">
          {PROTAGONISTS.map(p => (
            <button
              key={p.id}
              onClick={() => setProtagonist(p.id)}
              className={`flex-1 py-3 px-2 rounded-xl text-[10px] font-black uppercase tracking-tight transition-all ${
                protagonist === p.id
                  ? 'bg-violet-600 text-white shadow-lg shadow-violet-900/30'
                  : 'bg-white/5 text-slate-500 border border-white/10 hover:bg-white/10 hover:text-slate-300'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Cantidad */}
      <div className="space-y-2">
        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Imágenes del set</p>
        <div className="flex gap-2">
          {COUNT_OPTIONS.map(n => (
            <button
              key={n}
              onClick={() => setCount(n)}
              className={`flex-1 py-3 rounded-xl text-xs font-black uppercase transition-all ${
                count === n
                  ? 'bg-violet-600 text-white shadow-lg shadow-violet-900/30'
                  : 'bg-white/5 text-slate-500 border border-white/10 hover:bg-white/10 hover:text-slate-300'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-900/20 border border-red-500/20 text-red-400 p-4 rounded-2xl text-[10px] font-bold uppercase tracking-tight">
          {error}
        </div>
      )}

      {/* Generar */}
      <button
        onClick={handleGenerate}
        disabled={!canGenerate}
        className={`w-full py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-all ${
          !canGenerate
            ? 'bg-white/5 text-slate-600 cursor-not-allowed'
            : 'bg-gradient-to-r from-violet-600 to-pink-600 text-white hover:from-violet-500 hover:to-pink-500 shadow-2xl shadow-violet-900/50 hover:scale-[1.01] active:scale-[0.99]'
        }`}
      >
        <Sparkles className="w-4 h-4" />
        Crear historia visual
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );

  // ── STEP: GENERATING ──────────────────────────────────────
  if (step === 'generating') return (
    <div className="space-y-8 animate-in fade-in duration-500 py-8">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 mx-auto bg-violet-600/20 rounded-3xl flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-black text-white uppercase tracking-tight">
            {progress ? `Generando imagen ${progress.completed + 1} de ${progress.total}` : 'IA construyendo la narrativa...'}
          </p>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
            Storyteller trabajando
          </p>
        </div>
      </div>

      {progress && (
        <div className="space-y-2">
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-violet-500 to-pink-500 rounded-full transition-all duration-700"
              style={{ width: `${(progress.completed / progress.total) * 100}%` }}
            />
          </div>
          <div className="flex justify-between">
            <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Progreso</p>
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
              {progress.completed} / {progress.total}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: count }).map((_, i) => {
          const done   = progress ? i < progress.completed : false;
          const active = progress ? i === progress.completed : false;
          return (
            <div
              key={i}
              className={`aspect-[3/4] rounded-2xl border flex items-center justify-center transition-all duration-500 ${
                done   ? 'bg-violet-600/10 border-violet-500/30' :
                active ? 'bg-white/8 border-violet-500/50 animate-pulse' :
                         'bg-white/5 border-white/10'
              }`}
            >
              {done   ? <Check className="w-5 h-5 text-violet-400" /> :
               active ? <Loader2 className="w-5 h-5 text-violet-500 animate-spin" /> :
                        <Image className="w-5 h-5 text-slate-700" />}
            </div>
          );
        })}
      </div>
    </div>
  );

  // ── STEP: RESULTS ─────────────────────────────────────────
  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Images className="w-5 h-5 text-violet-400" />
            <h3 className="text-sm font-black text-white uppercase tracking-tighter italic">
              Historia lista
            </h3>
          </div>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            {results.length} imágenes · {NARRATIVES.find(n => n.id === narrative)?.label}
          </p>
        </div>
        <button
          onClick={reset}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 hover:text-white text-[10px] font-black uppercase tracking-widest transition-all"
        >
          <ChevronLeft className="w-3 h-3" />
          Nueva historia
        </button>
      </div>

      {/* Orden sugerido para carrusel */}
      <div className="bg-violet-600/10 border border-violet-500/20 rounded-2xl p-4">
        <p className="text-[9px] font-black text-violet-400 uppercase tracking-widest mb-1">Orden sugerido para carrusel</p>
        <div className="flex gap-2 flex-wrap mt-2">
          {results.map((r, i) => (
            <div key={i} className="flex items-center gap-1.5 bg-white/5 rounded-lg px-2.5 py-1.5">
              <span className="text-[9px] font-black text-violet-400">{i + 1}</span>
              <span className="text-[9px] text-slate-400 font-medium">{r.moment}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tarjetas de resultado */}
      {results.map((r, i) => (
        <div key={i} className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">

          {/* Imagen */}
          <div
            className="aspect-[3/4] relative cursor-pointer group"
            onClick={() => { setLightboxIndex(i); setLightboxOpen(true); }}
          >
            <img src={r.imageUrl} className="w-full h-full object-cover" alt={r.moment} />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <button
                onClick={e => { e.stopPropagation(); downloadImage(r.imageUrl, i); }}
                className="bg-white/20 backdrop-blur-md text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-1.5 hover:bg-white/30"
              >
                <Download className="w-3.5 h-3.5" />
                Descargar
              </button>
            </div>
            {/* Badges */}
            <div className="absolute top-3 left-3 flex gap-2">
              <div className="bg-black/60 backdrop-blur-md px-2 py-1 rounded-lg">
                <p className="text-[9px] font-black text-violet-400 uppercase">#{i + 1}</p>
              </div>
              <div className="bg-black/60 backdrop-blur-md px-2 py-1 rounded-lg">
                <p className="text-[9px] font-black text-white uppercase">{r.moment}</p>
              </div>
            </div>
          </div>

          {/* Metadata */}
          <div className="p-4 space-y-3">

            {/* Caption */}
            <div className="space-y-1">
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Caption</p>
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs text-white leading-snug flex-1">{r.caption}</p>
                <button
                  onClick={() => copyText(r.caption, i * 10 + 1)}
                  className="flex-shrink-0 w-7 h-7 bg-white/5 hover:bg-white/15 text-slate-500 hover:text-white rounded-lg flex items-center justify-center transition-all"
                >
                  {copiedIdx === i * 10 + 1 ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
            </div>

            {/* Hashtags */}
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <Hash className="w-3 h-3 text-slate-600" />
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Hashtags</p>
              </div>
              <div className="flex items-start justify-between gap-2">
                <p className="text-[10px] text-violet-400 leading-snug flex-1 font-medium">{r.hashtags}</p>
                <button
                  onClick={() => copyText(r.hashtags, i * 10 + 2)}
                  className="flex-shrink-0 w-7 h-7 bg-white/5 hover:bg-white/15 text-slate-500 hover:text-white rounded-lg flex items-center justify-center transition-all"
                >
                  {copiedIdx === i * 10 + 2 ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
            </div>

            {/* Prompt técnico */}
            <details className="group">
              <summary className="text-[9px] font-black text-slate-600 uppercase tracking-widest cursor-pointer hover:text-slate-400 transition-colors list-none flex items-center gap-1">
                <ChevronRight className="w-3 h-3 transition-transform group-open:rotate-90" />
                Ver prompt generado
              </summary>
              <div className="mt-2 bg-black/30 rounded-xl p-3 flex items-start gap-2">
                <p className="text-[10px] text-slate-500 leading-relaxed flex-1 font-mono">{r.prompt}</p>
                <button
                  onClick={() => copyText(r.prompt, i * 10 + 3)}
                  className="flex-shrink-0 w-6 h-6 bg-white/5 hover:bg-white/15 text-slate-600 hover:text-white rounded-lg flex items-center justify-center transition-all"
                >
                  {copiedIdx === i * 10 + 3 ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Copy className="w-2.5 h-2.5" />}
                </button>
              </div>
            </details>
          </div>
        </div>
      ))}

      {/* Descargar todo */}
      <button
        onClick={downloadAllZip}
        className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-gradient-to-r from-violet-600 to-pink-600 text-white text-[10px] font-black uppercase tracking-widest shadow-lg hover:opacity-90 active:scale-[0.98] transition-all"
      >
        <Download className="w-4 h-4" />
        Descargar set completo (ZIP)
      </button>

      {/* Lightbox */}
      {lightboxOpen && results.length > 0 && (
        <ImageLightbox
          images={results.map(r => r.imageUrl)}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxOpen(false)}
          onDownload={(url, idx) => downloadImage(url, idx)}
          metadata={{ label: 'Photodump' }}
        />
      )}
    </div>
  );
};

export default PhotodumpMode;
