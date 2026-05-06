import React, { useState } from 'react';
import {
  Megaphone, Loader2, Download, Zap, Image,
  Target, Users, ChevronRight, ChevronLeft,
  Copy, Check, Sparkles, LayoutGrid,
} from 'lucide-react';
import { generationService, GenerationProgress } from '../services/generationService';
import { PromptDNA } from '../types/promptTypes';
import { downloadAsZip } from '../../../utils/imageUtils';
import { ImageLightbox } from '../../../components/shared/ImageLightbox';
import { FloatingActionBar } from '../../../components/shared/FloatingActionBar';
import { useScrollFAB } from '../../../hooks/useScrollFAB';
import { newSessionId } from '../../../services/imageApiService';
import { useAuth } from '../../auth/AuthContext';
import { geminiService } from '../../../services/geminiService';
import ModuleTutorial from '../../../components/shared/ModuleTutorial';
import { TUTORIAL_CONFIGS } from '../../../components/shared/tutorialConfigs';

interface CampaignGeneratorProps {
  basePrompt: string;
  dna: PromptDNA;
  references: string[];
  copilotPreset?: Record<string, string>;
}

// ── Tipos de campaña ──────────────────────────────────────────
type CampaignType = 'product' | 'brand' | 'social' | 'ecommerce';

const CAMPAIGN_TYPES: { id: CampaignType; label: string; description: string; icon: string }[] = [
  { id: 'product',   label: 'Lanzamiento de producto', description: 'Hero shot, detalles, lifestyle y CTA visual',         icon: '🚀' },
  { id: 'brand',     label: 'Posicionamiento de marca', description: 'Identidad visual, valores y presencia aspiracional',  icon: '✨' },
  { id: 'social',    label: 'Contenido para RRSS',      description: 'Carrusel, stories y posts optimizados por plataforma', icon: '📱' },
  { id: 'ecommerce', label: 'E-commerce',               description: 'Fotos de producto, ángulos y contexto de uso',        icon: '🛒' },
];

type Objective = 'sell' | 'awareness' | 'launch' | 'engagement';
const OBJECTIVES: { id: Objective; label: string }[] = [
  { id: 'sell',       label: 'Vender / Convertir' },
  { id: 'awareness',  label: 'Dar a conocer la marca' },
  { id: 'launch',     label: 'Lanzar un producto' },
  { id: 'engagement', label: 'Generar interacción' },
];

type Audience = 'general' | 'young' | 'professional' | 'luxury' | 'family';
const AUDIENCES: { id: Audience; label: string }[] = [
  { id: 'general',      label: 'Público general' },
  { id: 'young',        label: 'Jóvenes 18-30' },
  { id: 'professional', label: 'Profesionales' },
  { id: 'luxury',       label: 'Segmento premium' },
  { id: 'family',       label: 'Familias' },
];

// ── Resultado enriquecido por escena ─────────────────────────
interface SceneResult {
  imageUrl: string;
  sceneName: string;
  prompt: string;
  caption: string;
  adCopy: string;
}

// ── Paso del wizard ───────────────────────────────────────────
type Step = 'brief' | 'generating' | 'results';

// ── Gemini: genera escenas + metadata ────────────────────────
async function buildCampaignScenes(
  basePrompt: string,
  productDescription: string,
  campaignType: CampaignType,
  objective: Objective,
  audience: Audience,
  imageCount: number,
): Promise<{ sceneName: string; scenePrompt: string; caption: string; adCopy: string }[]> {
  const audienceLabel  = AUDIENCES.find(a => a.id === audience)?.label ?? audience;
  const objectiveLabel = OBJECTIVES.find(o => o.id === objective)?.label ?? objective;
  const typeLabel      = CAMPAIGN_TYPES.find(t => t.id === campaignType)?.label ?? campaignType;

  const fullPrompt = `You are a professional creative director and marketing strategist.

A brand needs ${imageCount} campaign images. Generate a structured shot list with creative directions.

BRIEF:
- Base subject / prompt: "${basePrompt}"
- Product / service description: "${productDescription || 'not specified'}"
- Campaign type: ${typeLabel}
- Objective: ${objectiveLabel}
- Target audience: ${audienceLabel}

Your task: generate exactly ${imageCount} scene entries. Each entry must:
1. Have a SHORT scene name (3-5 words max, e.g. "Hero Product Shot")
2. Have a scenePrompt: a visual direction in English (1-2 sentences) describing the environment, mood, lighting, and camera angle. This will be appended to the base subject prompt. Do NOT repeat the subject — only describe the scene context.
3. Have a caption: a short social media caption in Spanish (max 120 chars, include 3-4 relevant hashtags)
4. Have an adCopy: a punchy ad headline in Spanish (max 60 chars, action-oriented)

Rules:
- For "product" type: include hero shot, detail shot, lifestyle context, and CTA moment
- For "brand" type: include aspirational wide shot, emotional close-up, brand lifestyle, community moment
- For "social" type: optimize for carousel — opening hook, value shots, closing CTA
- For "ecommerce" type: clean product angles, texture detail, in-use context, packaging
- Adapt tone and aesthetic to the audience (${audienceLabel})
- Make scenes progressive and coherent, like a real campaign

Output ONLY a valid JSON array, no markdown, no explanation:
[
  {
    "sceneName": "...",
    "scenePrompt": "...",
    "caption": "...",
    "adCopy": "..."
  }
]`;

  try {
    const raw     = await geminiService.generateText(fullPrompt);
    const cleaned = raw.replace(/```json|```/g, '').trim();
    const match   = cleaned.match(/\[[\s\S]*\]/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.slice(0, imageCount);
      }
    }
  } catch (err) {
    console.warn('[CampaignGenerator] Gemini scene generation failed, using fallback:', err);
  }

  // Fallback genérico
  const fallbackScenes = [
    { scene: 'wide establishing shot, golden hour, cinematic mood', name: 'Hero Shot' },
    { scene: 'close-up detail, studio lighting, clean background', name: 'Detalle' },
    { scene: 'lifestyle context, natural light, candid feel', name: 'Lifestyle' },
    { scene: 'product in use, warm ambient light, organic setting', name: 'En uso' },
    { scene: 'overhead flat lay, bright neutral background, editorial style', name: 'Editorial' },
  ];
  return fallbackScenes.slice(0, imageCount).map(f => ({
    sceneName:   f.name,
    scenePrompt: f.scene,
    caption:     `Descúbrelo hoy. #marca #producto #diseño`,
    adCopy:      'Conoce la nueva colección',
  }));
}

// ── Componente principal ──────────────────────────────────────
const CampaignGenerator: React.FC<CampaignGeneratorProps> = ({ basePrompt, dna, references, copilotPreset }) => {
  const { user } = useAuth();

  // Brief state — initialize from copilot preset if present
  const [campaignType,        setCampaignType]        = useState<CampaignType>((copilotPreset?.campaignType as CampaignType) || 'product');
  const [objective,           setObjective]           = useState<Objective>((copilotPreset?.objective as Objective) || 'sell');
  const [audience,            setAudience]            = useState<Audience>((copilotPreset?.audience as Audience) || 'general');
  const [productDescription,  setProductDescription]  = useState(copilotPreset?.productDescription ? decodeURIComponent(copilotPreset.productDescription) : '');
  const [imageCount,          setImageCount]          = useState(copilotPreset?.imageCount ? parseInt(copilotPreset.imageCount) : 3);

  // Flow state
  const [step,        setStep]        = useState<Step>('brief');
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress,    setProgress]    = useState<GenerationProgress | null>(null);
  const [error,       setError]       = useState<string | null>(null);
  const [results,     setResults]     = useState<SceneResult[]>([]);

  // UI state
  const [lightboxOpen,  setLightboxOpen]  = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [copiedIdx,     setCopiedIdx]     = useState<number | null>(null);
  const { isVisible: fabVisible } = useScrollFAB({ threshold: 100, alwaysVisibleOnMobile: false });

  const canGenerate = basePrompt.trim().length > 0 && !isGenerating;

  const handleGenerate = async () => {
    if (!canGenerate) return;

    setStep('generating');
    setIsGenerating(true);
    setError(null);
    setResults([]);
    setProgress({ total: imageCount, completed: 0, current: 0 });

    try {
      // 1. Gemini construye las escenas con toda la estrategia
      const scenes = await buildCampaignScenes(
        basePrompt,
        productDescription,
        campaignType,
        objective,
        audience,
        imageCount,
      );

      // 2. Construir prompts finales: sujeto base + dirección de escena
      const campaignPrompts = scenes.map(s =>
        `${basePrompt}, ${s.scenePrompt}, same person same identity same face, consistent character`,
      );

      // 3. Generar imágenes
      const images = await generationService.generateBatch(
        campaignPrompts,
        references,
        undefined,
        (p) => setProgress(p),
        {
          uid:         user?.uid,
          sessionId:   newSessionId(),
          module:      'prompt_studio',
          moduleLabel: 'AI Generator (Campaign)',
          metadata: {
            campaignType,
            objective,
            audience,
            scenes: imageCount,
            basePrompt: basePrompt.slice(0, 100),
          },
        },
      );

      // 4. Combinar imágenes con metadata
      const enriched: SceneResult[] = images.map((url, i) => ({
        imageUrl:  url,
        sceneName: scenes[i]?.sceneName  ?? `Escena ${i + 1}`,
        prompt:    campaignPrompts[i]    ?? '',
        caption:   scenes[i]?.caption   ?? '',
        adCopy:    scenes[i]?.adCopy    ?? '',
      }));

      setResults(enriched);
      setStep('results');
    } catch (err: any) {
      setError(err?.message || 'Error generando la campaña.');
      setStep('brief');
    } finally {
      setIsGenerating(false);
      setProgress(null);
    }
  };

  const copyText = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const downloadImage = (img: string, index: number) => {
    const link = document.createElement('a');
    link.href = img;
    link.download = `campaign_${index + 1}.png`;
    link.click();
  };

  const downloadAllZip = async () => {
    if (results.length === 0) return;
    await downloadAsZip(results.map(r => r.imageUrl), `campaign_${Date.now()}.zip`, 'campaign');
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
            <Megaphone className="w-5 h-5 text-brand-500" />
            <h3 className="text-sm font-black text-white uppercase tracking-tighter italic">Campaign Generator</h3>
          </div>
          <ModuleTutorial moduleId="campaignMode" steps={TUTORIAL_CONFIGS.campaignMode} label="¿Cómo funciona?" compact />
        </div>
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
          Define tu campaña · IA actúa como director creativo
        </p>
      </div>

      {/* Sujeto base */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Sujeto base</p>
        <p className="text-xs text-slate-400 italic line-clamp-2 leading-relaxed">
          "{basePrompt || 'Escribe un prompt en el compositor primero...'}"
        </p>
      </div>

      {/* Descripción del producto */}
      <div className="space-y-2">
        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
          ¿Qué producto o servicio estás promocionando?
        </p>
        <textarea
          value={productDescription}
          onChange={e => setProductDescription(e.target.value)}
          placeholder="Ej: crema hidratante con ácido hialurónico para piel seca, rango premium..."
          rows={2}
          className="w-full bg-white/5 border border-white/10 focus:border-brand-500/50 rounded-xl px-4 py-3 text-xs font-medium text-slate-300 placeholder-slate-600 outline-none transition-all resize-none"
        />
      </div>

      {/* Tipo de campaña */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <LayoutGrid className="w-3.5 h-3.5 text-slate-500" />
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Tipo de campaña</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {CAMPAIGN_TYPES.map(t => (
            <button
              key={t.id}
              onClick={() => setCampaignType(t.id)}
              className={`text-left p-3 rounded-xl border transition-all ${
                campaignType === t.id
                  ? 'bg-brand-600/20 border-brand-500/50 text-white'
                  : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/8 hover:text-slate-300'
              }`}
            >
              <div className="text-base mb-1">{t.icon}</div>
              <p className="text-[10px] font-black uppercase tracking-tight leading-tight">{t.label}</p>
              <p className="text-[9px] text-slate-500 mt-0.5 leading-tight">{t.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Objetivo */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Target className="w-3.5 h-3.5 text-slate-500" />
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Objetivo principal</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {OBJECTIVES.map(o => (
            <button
              key={o.id}
              onClick={() => setObjective(o.id)}
              className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wide transition-all ${
                objective === o.id
                  ? 'bg-violet-600 text-white shadow-lg shadow-violet-900/30'
                  : 'bg-white/5 text-slate-500 border border-white/10 hover:bg-white/10 hover:text-slate-300'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* Audiencia */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Users className="w-3.5 h-3.5 text-slate-500" />
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Audiencia objetivo</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {AUDIENCES.map(a => (
            <button
              key={a.id}
              onClick={() => setAudience(a.id)}
              className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wide transition-all ${
                audience === a.id
                  ? 'bg-sky-600 text-white shadow-lg shadow-sky-900/30'
                  : 'bg-white/5 text-slate-500 border border-white/10 hover:bg-white/10 hover:text-slate-300'
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>

      {/* Cantidad de imágenes */}
      <div className="space-y-2">
        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
          Número de imágenes
        </p>
        <div className="flex gap-2">
          {[3, 4, 5].map(n => (
            <button
              key={n}
              onClick={() => setImageCount(n)}
              className={`flex-1 py-3 rounded-xl text-xs font-black uppercase transition-all ${
                imageCount === n
                  ? 'bg-brand-600 text-white shadow-lg shadow-brand-900/30'
                  : 'bg-white/5 text-slate-500 border border-white/10 hover:bg-white/10 hover:text-slate-300'
              }`}
            >
              {n} imágenes
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
            : 'bg-gradient-to-r from-brand-600 to-violet-600 text-white hover:from-brand-500 hover:to-violet-500 shadow-2xl shadow-brand-900/50 hover:scale-[1.01] active:scale-[0.99]'
        }`}
      >
        <Sparkles className="w-4 h-4" />
        Crear campaña con IA
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );

  // ── STEP: GENERATING ──────────────────────────────────────
  if (step === 'generating') return (
    <div className="space-y-8 animate-in fade-in duration-500 py-8">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 mx-auto bg-brand-600/20 rounded-3xl flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-brand-400 animate-spin" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-black text-white uppercase tracking-tight">
            {progress ? `Generando imagen ${progress.completed + 1} de ${progress.total}` : 'IA analizando el brief...'}
          </p>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
            Director creativo trabajando
          </p>
        </div>
      </div>

      {progress && (
        <div className="space-y-2">
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-brand-500 to-violet-500 rounded-full transition-all duration-700"
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

      {/* Placeholders de imágenes */}
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: imageCount }).map((_, i) => {
          const done = progress ? i < progress.completed : false;
          const active = progress ? i === progress.completed : false;
          return (
            <div
              key={i}
              className={`aspect-[3/4] rounded-2xl border flex items-center justify-center transition-all duration-500 ${
                done   ? 'bg-brand-600/10 border-brand-500/30' :
                active ? 'bg-white/8 border-brand-500/50 animate-pulse' :
                         'bg-white/5 border-white/10'
              }`}
            >
              {done   ? <Check className="w-5 h-5 text-brand-400" /> :
               active ? <Loader2 className="w-5 h-5 text-brand-500 animate-spin" /> :
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

      {/* Header resultados */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-brand-500" />
            <h3 className="text-sm font-black text-white uppercase tracking-tighter italic">
              Campaña lista
            </h3>
          </div>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            {results.length} imágenes · {CAMPAIGN_TYPES.find(t => t.id === campaignType)?.label}
          </p>
        </div>
        <button
          onClick={reset}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 hover:text-white text-[10px] font-black uppercase tracking-widest transition-all"
        >
          <ChevronLeft className="w-3 h-3" />
          Nueva campaña
        </button>
      </div>

      {/* Tarjetas de resultado — una por escena */}
      {results.map((r, i) => (
        <div key={i} className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">

          {/* Imagen */}
          <div
            className="aspect-[4/3] relative cursor-pointer group"
            onClick={() => { setLightboxIndex(i); setLightboxOpen(true); }}
          >
            <img src={r.imageUrl} className="w-full h-full object-cover" alt={r.sceneName} />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
              <button
                onClick={e => { e.stopPropagation(); downloadImage(r.imageUrl, i); }}
                className="bg-white/20 backdrop-blur-md text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-1.5 hover:bg-white/30"
              >
                <Download className="w-3.5 h-3.5" />
                Descargar
              </button>
            </div>
            <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-lg">
              <p className="text-[9px] font-black text-white uppercase tracking-widest">{r.sceneName}</p>
            </div>
          </div>

          {/* Metadata */}
          <div className="p-4 space-y-3">

            {/* Ad copy */}
            <div className="space-y-1">
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Titular de anuncio</p>
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-bold text-white leading-snug flex-1">{r.adCopy}</p>
                <button
                  onClick={() => copyText(r.adCopy, i * 10 + 1)}
                  className="flex-shrink-0 w-7 h-7 bg-white/5 hover:bg-white/15 text-slate-500 hover:text-white rounded-lg flex items-center justify-center transition-all"
                >
                  {copiedIdx === i * 10 + 1 ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
            </div>

            {/* Caption */}
            <div className="space-y-1">
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Caption para RRSS</p>
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs text-slate-400 leading-snug flex-1">{r.caption}</p>
                <button
                  onClick={() => copyText(r.caption, i * 10 + 2)}
                  className="flex-shrink-0 w-7 h-7 bg-white/5 hover:bg-white/15 text-slate-500 hover:text-white rounded-lg flex items-center justify-center transition-all"
                >
                  {copiedIdx === i * 10 + 2 ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
            </div>

            {/* Prompt técnico (colapsable) */}
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
        className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-gradient-to-r from-brand-600 to-violet-600 text-white text-[10px] font-black uppercase tracking-widest shadow-lg hover:opacity-90 active:scale-[0.98] transition-all"
      >
        <Download className="w-4 h-4" />
        Descargar campaña completa (ZIP)
      </button>

      {/* Lightbox */}
      {lightboxOpen && results.length > 0 && (
        <ImageLightbox
          images={results.map(r => r.imageUrl)}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxOpen(false)}
          onDownload={(url, idx) => downloadImage(url, idx)}
          metadata={{ label: 'Campaña' }}
        />
      )}

      {/* FAB */}
      {fabVisible && (
        <FloatingActionBar
          isVisible={true}
          primaryAction={{
            label: 'Descargar ZIP',
            icon: <Download className="w-4 h-4" />,
            onClick: downloadAllZip,
          }}
          onClearSelection={reset}
          selectedCount={0}
        />
      )}
    </div>
  );
};

export default CampaignGenerator;
