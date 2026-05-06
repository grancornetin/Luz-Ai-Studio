/**
 * CampaignModule.tsx
 * Módulo independiente de Campaign — director creativo de marketing.
 * Tiene su propia biblioteca de campañas guardadas en IndexedDB.
 */
import React, { useState, useEffect } from 'react';
import {
  Megaphone, Loader2, Download, Zap, Image,
  Target, Users, ChevronRight, ChevronLeft,
  Copy, Check, Sparkles, LayoutGrid, Library,
  Trash2, ArrowLeft,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { generationService, GenerationProgress } from '../promptLibrary/services/generationService';
import { downloadAsZip } from '../../utils/imageUtils';
import { ImageLightbox } from '../../components/shared/ImageLightbox';
import { newSessionId } from '../../services/imageApiService';
import { buildCampaignScenes } from './campaignService';
import { campaignStorage } from './campaignStorage';
import {
  CampaignSet, CampaignType, CampaignObjective, CampaignAudience,
  CAMPAIGN_TYPE_META, CAMPAIGN_OBJECTIVE_META, CAMPAIGN_AUDIENCE_META,
} from './types';
import { PRO_CREDIT_COSTS } from '../../services/creditConfig';
import ModuleTutorial from '../../components/shared/ModuleTutorial';
import { TUTORIAL_CONFIGS } from '../../components/shared/tutorialConfigs';

// ── Upgrade wall ──────────────────────────────────────────────
const UpgradeWall: React.FC<{ proCredits: number }> = ({ proCredits }) => {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6 px-4">
      <div className="w-20 h-20 bg-brand-600/10 border border-brand-500/20 rounded-3xl flex items-center justify-center">
        <Megaphone className="w-10 h-10 text-brand-500" />
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter">Campaign Generator</h2>
        <p className="text-slate-400 text-sm max-w-sm leading-relaxed">
          {proCredits === 0
            ? 'Agotaste tus sesiones Campaign de este período. Comprá pro-credits extra o actualizá tu plan.'
            : 'Necesitás pro-credits para usar Campaign Generator. Cada sesión consume 1 pro-credit.'}
        </p>
      </div>
      <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3 max-w-xs w-full">
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Tus pro-credits</p>
        <p className="text-4xl font-black text-white">{proCredits}</p>
        <p className="text-[11px] text-slate-500">1 pro-credit = 1 sesión Campaign</p>
      </div>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <button
          onClick={() => navigate('/buy-credits')}
          className="w-full py-4 bg-brand-600 hover:bg-brand-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-brand-900/30"
        >
          Comprar pro-credits
        </button>
        <button
          onClick={() => navigate('/pricing')}
          className="w-full py-3 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/10 rounded-2xl font-black text-xs uppercase tracking-widest transition-all"
        >
          Ver planes
        </button>
      </div>
    </div>
  );
};

// ── Tipos de vistas ───────────────────────────────────────────
type View = 'brief' | 'generating' | 'results' | 'library';

// ── Componente principal ──────────────────────────────────────
const CampaignModule: React.FC = () => {
  const { user, credits, isAdmin, deductCredits, refreshCredits, proCredits, deductProCredit, refundProCredit } = useAuth();

  // Brief state
  const [basePrompt,         setBasePrompt]         = useState('');
  const [productDescription, setProductDescription] = useState('');
  const [campaignType,       setCampaignType]        = useState<CampaignType>('product');
  const [objective,          setObjective]           = useState<CampaignObjective>('sell');
  const [audience,           setAudience]            = useState<CampaignAudience>('general');
  const [imageCount,         setImageCount]          = useState(4);

  // Flow state
  const [view,          setView]          = useState<View>('brief');
  const [isGenerating,  setIsGenerating]  = useState(false);
  const [progress,      setProgress]      = useState<GenerationProgress | null>(null);
  const [error,         setError]         = useState<string | null>(null);
  const [currentSet,    setCurrentSet]    = useState<CampaignSet | null>(null);
  const [sets,          setSets]          = useState<CampaignSet[]>([]);
  const [loadingSets,   setLoadingSets]   = useState(false);

  // UI
  const [lightboxOpen,  setLightboxOpen]  = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [copiedIdx,     setCopiedIdx]     = useState<number | null>(null);

  const canGenerate = basePrompt.trim().length > 0 && !isGenerating;
  const hasProCredits = isAdmin || proCredits > 0;

  const loadSets = async () => {
    setLoadingSets(true);
    const all = await campaignStorage.list();
    setSets(all);
    setLoadingSets(false);
  };

  useEffect(() => { loadSets(); }, []);

  const handleGenerate = async () => {
    if (!canGenerate || !hasProCredits) return;

    // Descontar 1 pro-credit por la sesión
    if (!isAdmin) {
      const ok = await deductProCredit();
      if (!ok) { setError('No tenés pro-credits suficientes para esta sesión.'); return; }
    }

    // Descontar créditos normales por las imágenes
    const imageCreditCost = imageCount * 2;
    if (!isAdmin && credits.available < imageCreditCost) {
      await refundProCredit(); // devolver el pro-credit si no hay créditos
      setError(`Necesitás ${imageCreditCost} créditos para generar ${imageCount} imágenes.`);
      return;
    }
    if (!isAdmin) {
      const ok = await deductCredits(imageCreditCost);
      if (!ok) {
        await refundProCredit();
        setError('Error al descontar créditos. Intentá de nuevo.');
        return;
      }
    }

    setView('generating');
    setIsGenerating(true);
    setError(null);
    setCurrentSet(null);
    setProgress({ total: imageCount, completed: 0, current: 0 });

    try {
      const scenes = await buildCampaignScenes(
        basePrompt, productDescription, campaignType, objective, audience, imageCount,
      );

      const campaignPrompts = scenes.map(s =>
        `${basePrompt}, ${s.scenePrompt}, same person same identity same face, consistent character`,
      );

      const images = await generationService.generateBatch(
        campaignPrompts,
        [],
        undefined,
        (p) => setProgress(p),
        {
          uid: user?.uid, sessionId: newSessionId(),
          module: 'campaign', moduleLabel: 'Campaign Generator',
          metadata: { campaignType, objective, audience, scenes: imageCount },
        },
      );

      const set: CampaignSet = {
        id:                 Date.now().toString(),
        createdAt:          Date.now(),
        basePrompt,
        productDescription,
        campaignType,
        objective,
        audience,
        imageCount,
        references:         [],
        images:             images.map((url, i) => ({
          imageUrl:  url,
          sceneName: scenes[i]?.sceneName  ?? `Escena ${i + 1}`,
          prompt:    campaignPrompts[i]    ?? '',
          caption:   scenes[i]?.caption   ?? '',
          adCopy:    scenes[i]?.adCopy    ?? '',
        })),
      };

      await campaignStorage.save(set);
      await loadSets();
      setCurrentSet(set);
      setView('results');
      await refreshCredits();
    } catch (err: any) {
      setError(err?.message || 'Error generando la campaña.');
      if (!isAdmin) {
        await refundProCredit();
        await deductCredits(-imageCreditCost); // reembolso (negativo = refund en el hook)
        await refreshCredits();
      }
      setView('brief');
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

  const downloadImage = (url: string, idx: number) => {
    const a = document.createElement('a');
    a.href = url; a.download = `campaign_${idx + 1}.png`; a.click();
  };

  const downloadSetZip = async (set: CampaignSet) => {
    await downloadAsZip(set.images.map(i => i.imageUrl), `campaign_${set.id.slice(-6)}.zip`, 'campaign');
  };

  const openLightbox = (images: string[], idx: number) => {
    setLightboxImages(images);
    setLightboxIndex(idx);
    setLightboxOpen(true);
  };

  const reset = () => {
    setView('brief');
    setCurrentSet(null);
    setError(null);
    setProgress(null);
  };

  // ── HEADER común ─────────────────────────────────────────────
  const Header = () => (
    <div className="flex items-center justify-between mb-8">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-brand-600/20 border border-brand-500/30 rounded-2xl flex items-center justify-center">
          <Megaphone className="w-5 h-5 text-brand-400" />
        </div>
        <div>
          <h1 className="text-xl font-black text-white uppercase italic tracking-tighter leading-none">
            Campaign Generator
          </h1>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">
            Director creativo IA · Marketing profesional
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {/* Pro-credits indicator */}
        <div className="flex items-center gap-1.5 bg-brand-600/10 border border-brand-500/20 rounded-xl px-3 py-2">
          <Zap className="w-3.5 h-3.5 text-brand-400" />
          <span className="text-xs font-black text-brand-300">{isAdmin ? '∞' : proCredits}</span>
          <span className="text-[9px] text-slate-500 font-bold uppercase">sesiones</span>
        </div>
        <button
          onClick={() => setView('library')}
          className="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-slate-400 hover:text-white text-[10px] font-black uppercase tracking-widest transition-all"
        >
          <Library className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Biblioteca ({sets.length})</span>
        </button>
        <ModuleTutorial moduleId="campaignMode" steps={TUTORIAL_CONFIGS.campaignMode} label="¿Cómo funciona?" compact />
      </div>
    </div>
  );

  // ── SIN PRO-CREDITS ───────────────────────────────────────────
  if (!hasProCredits && view === 'brief') {
    return (
      <div className="max-w-2xl mx-auto space-y-6 pb-20">
        <Header />
        <UpgradeWall proCredits={proCredits} />
      </div>
    );
  }

  // ── BRIEF ─────────────────────────────────────────────────────
  if (view === 'brief') return (
    <div className="max-w-2xl mx-auto space-y-6 pb-20 animate-in fade-in duration-500">
      <Header />

      {/* Pro-credit warning */}
      {!isAdmin && proCredits <= 3 && (
        <div className="bg-amber-900/20 border border-amber-500/30 rounded-2xl p-4 flex items-center gap-3">
          <Zap className="w-5 h-5 text-amber-400 flex-shrink-0" />
          <p className="text-xs text-amber-300 font-medium">
            Te quedan <strong>{proCredits} sesiones</strong> Campaign este período.
            Cada sesión usa 1 pro-credit + los créditos de las imágenes.
          </p>
        </div>
      )}

      {/* Prompt base */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3">
        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Prompt base del sujeto</p>
        <textarea
          value={basePrompt}
          onChange={e => setBasePrompt(e.target.value)}
          placeholder="Describe el sujeto principal: persona, producto o concepto visual que protagoniza la campaña..."
          rows={3}
          className="w-full bg-white/5 border border-white/10 focus:border-brand-500/50 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-600 outline-none transition-all resize-none"
        />
      </div>

      {/* Descripción del producto */}
      <div className="space-y-2">
        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Producto o servicio (opcional)</p>
        <textarea
          value={productDescription}
          onChange={e => setProductDescription(e.target.value)}
          placeholder="Ej: crema hidratante con ácido hialurónico para piel seca, línea premium..."
          rows={2}
          className="w-full bg-white/5 border border-white/10 focus:border-brand-500/50 rounded-xl px-4 py-3 text-sm text-slate-300 placeholder-slate-600 outline-none transition-all resize-none"
        />
      </div>

      {/* Tipo de campaña */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <LayoutGrid className="w-3.5 h-3.5 text-slate-500" />
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Tipo de campaña</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(CAMPAIGN_TYPE_META) as CampaignType[]).map(t => (
            <button
              key={t}
              onClick={() => setCampaignType(t)}
              className={`text-left p-3 rounded-xl border transition-all ${
                campaignType === t
                  ? 'bg-brand-600/20 border-brand-500/50 text-white'
                  : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/8'
              }`}
            >
              <div className="text-lg mb-1">{CAMPAIGN_TYPE_META[t].icon}</div>
              <p className="text-[10px] font-black uppercase tracking-tight leading-tight">{CAMPAIGN_TYPE_META[t].label}</p>
              <p className="text-[9px] text-slate-500 mt-0.5 leading-tight">{CAMPAIGN_TYPE_META[t].description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Objetivo */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Target className="w-3.5 h-3.5 text-slate-500" />
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Objetivo</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(CAMPAIGN_OBJECTIVE_META) as CampaignObjective[]).map(o => (
            <button
              key={o}
              onClick={() => setObjective(o)}
              className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wide transition-all ${
                objective === o ? 'bg-violet-600 text-white' : 'bg-white/5 text-slate-500 border border-white/10 hover:bg-white/10'
              }`}
            >
              {CAMPAIGN_OBJECTIVE_META[o]}
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
          {(Object.keys(CAMPAIGN_AUDIENCE_META) as CampaignAudience[]).map(a => (
            <button
              key={a}
              onClick={() => setAudience(a)}
              className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wide transition-all ${
                audience === a ? 'bg-sky-600 text-white' : 'bg-white/5 text-slate-500 border border-white/10 hover:bg-white/10'
              }`}
            >
              {CAMPAIGN_AUDIENCE_META[a]}
            </button>
          ))}
        </div>
      </div>

      {/* Cantidad */}
      <div className="space-y-2">
        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Imágenes por campaña</p>
        <div className="flex gap-2">
          {[3, 4, 5].map(n => (
            <button
              key={n}
              onClick={() => setImageCount(n)}
              className={`flex-1 py-3 rounded-xl text-xs font-black uppercase transition-all ${
                imageCount === n ? 'bg-brand-600 text-white shadow-lg' : 'bg-white/5 text-slate-500 border border-white/10 hover:bg-white/10'
              }`}
            >
              {n} imágenes
            </button>
          ))}
        </div>
        <p className="text-[10px] text-slate-500">
          Costo: 1 pro-credit + {imageCount * 2} créditos normales · Disponibles: {isAdmin ? '∞' : credits.available}
        </p>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-500/20 text-red-400 p-4 rounded-2xl text-xs font-bold">{error}</div>
      )}

      <button
        onClick={handleGenerate}
        disabled={!canGenerate || !hasProCredits}
        className={`w-full py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-all ${
          !canGenerate || !hasProCredits
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

  // ── GENERATING ────────────────────────────────────────────────
  if (view === 'generating') return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in duration-500 py-12">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 mx-auto bg-brand-600/20 rounded-3xl flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-brand-400 animate-spin" />
        </div>
        <div>
          <p className="text-sm font-black text-white uppercase tracking-tight">
            {progress ? `Generando imagen ${progress.completed + 1} de ${progress.total}` : 'IA analizando el brief...'}
          </p>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Director creativo trabajando</p>
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
            <p className="text-[9px] font-black text-slate-500">{progress.completed} / {progress.total}</p>
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {Array.from({ length: imageCount }).map((_, i) => {
          const done   = progress ? i < progress.completed : false;
          const active = progress ? i === progress.completed : false;
          return (
            <div key={i} className={`aspect-[3/4] rounded-2xl border flex items-center justify-center transition-all ${
              done ? 'bg-brand-600/10 border-brand-500/30' : active ? 'bg-white/8 border-brand-500/50 animate-pulse' : 'bg-white/5 border-white/10'
            }`}>
              {done ? <Check className="w-5 h-5 text-brand-400" /> : active ? <Loader2 className="w-5 h-5 text-brand-500 animate-spin" /> : <Image className="w-5 h-5 text-slate-700" />}
            </div>
          );
        })}
      </div>
    </div>
  );

  // ── RESULTS ───────────────────────────────────────────────────
  if (view === 'results' && currentSet) return (
    <div className="max-w-2xl mx-auto space-y-6 pb-20 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-white uppercase italic tracking-tighter">Campaña lista</h2>
          <p className="text-[10px] text-slate-500 uppercase tracking-widest">
            {currentSet.images.length} imágenes · {CAMPAIGN_TYPE_META[currentSet.campaignType].label}
          </p>
        </div>
        <button onClick={reset} className="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
          <ChevronLeft className="w-3 h-3" /> Nueva campaña
        </button>
      </div>

      {currentSet.images.map((img, i) => (
        <div key={i} className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
          <div className="aspect-[4/3] relative cursor-pointer group" onClick={() => openLightbox(currentSet.images.map(x => x.imageUrl), i)}>
            <img src={img.imageUrl} alt={img.sceneName} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
              <button onClick={e => { e.stopPropagation(); downloadImage(img.imageUrl, i); }} className="bg-white/20 backdrop-blur-md text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-1.5 hover:bg-white/30">
                <Download className="w-3.5 h-3.5" /> Descargar
              </button>
            </div>
            <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-lg">
              <p className="text-[9px] font-black text-white uppercase">{img.sceneName}</p>
            </div>
          </div>
          <div className="p-4 space-y-3">
            <div className="space-y-1">
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Titular de anuncio</p>
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-bold text-white flex-1">{img.adCopy}</p>
                <button onClick={() => copyText(img.adCopy, i * 10 + 1)} className="w-7 h-7 bg-white/5 hover:bg-white/15 text-slate-500 hover:text-white rounded-lg flex items-center justify-center transition-all">
                  {copiedIdx === i * 10 + 1 ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Caption para RRSS</p>
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs text-slate-400 flex-1">{img.caption}</p>
                <button onClick={() => copyText(img.caption, i * 10 + 2)} className="w-7 h-7 bg-white/5 hover:bg-white/15 text-slate-500 hover:text-white rounded-lg flex items-center justify-center transition-all">
                  {copiedIdx === i * 10 + 2 ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
            </div>
            <details className="group">
              <summary className="text-[9px] font-black text-slate-600 uppercase tracking-widest cursor-pointer hover:text-slate-400 transition-colors list-none flex items-center gap-1">
                <ChevronRight className="w-3 h-3 transition-transform group-open:rotate-90" /> Ver prompt
              </summary>
              <div className="mt-2 bg-black/30 rounded-xl p-3">
                <p className="text-[10px] text-slate-500 font-mono">{img.prompt}</p>
              </div>
            </details>
          </div>
        </div>
      ))}

      <button onClick={() => downloadSetZip(currentSet)} className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-gradient-to-r from-brand-600 to-violet-600 text-white text-[10px] font-black uppercase tracking-widest shadow-lg hover:opacity-90 active:scale-[0.98] transition-all">
        <Download className="w-4 h-4" /> Descargar campaña completa (ZIP)
      </button>

      {lightboxOpen && (
        <ImageLightbox images={lightboxImages} initialIndex={lightboxIndex} onClose={() => setLightboxOpen(false)} onDownload={(url, idx) => downloadImage(url, idx)} metadata={{ label: 'Campaña' }} />
      )}
    </div>
  );

  // ── LIBRARY ───────────────────────────────────────────────────
  if (view === 'library') return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => setView('brief')} className="w-9 h-9 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white rounded-xl flex items-center justify-center transition-all">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-xl font-black text-white uppercase italic tracking-tighter">Mis campañas</h2>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest">{sets.length} campañas guardadas</p>
          </div>
        </div>
        <button onClick={reset} className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5" /> Nueva campaña
        </button>
      </div>

      {loadingSets && <p className="text-center text-slate-500 text-sm py-12">Cargando...</p>}

      {!loadingSets && sets.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Megaphone className="w-12 h-12 text-slate-700 mb-4" />
          <p className="text-slate-500 text-sm font-medium">Sin campañas aún</p>
          <p className="text-slate-600 text-xs mt-1">Creá tu primera campaña para verla aquí</p>
        </div>
      )}

      <div className="space-y-6">
        {sets.map(set => (
          <div key={set.id} className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
            <div className="p-4 flex items-center justify-between border-b border-white/10">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">{CAMPAIGN_TYPE_META[set.campaignType].icon}</span>
                  <p className="text-sm font-black text-white uppercase italic tracking-tight">{CAMPAIGN_TYPE_META[set.campaignType].label}</p>
                </div>
                <p className="text-[10px] text-slate-500 line-clamp-1">{set.basePrompt}</p>
                <p className="text-[9px] text-slate-600 mt-0.5">{new Date(set.createdAt).toLocaleDateString('es-CL')} · {set.images.length} imágenes</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => downloadSetZip(set)} className="w-9 h-9 bg-white/5 hover:bg-white/15 text-slate-400 hover:text-white rounded-xl flex items-center justify-center transition-all">
                  <Download className="w-4 h-4" />
                </button>
                <button onClick={async () => { await campaignStorage.delete(set.id); await loadSets(); }} className="w-9 h-9 bg-white/5 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded-xl flex items-center justify-center transition-all">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-1 p-2">
              {set.images.map((img, i) => (
                <div key={i} className="aspect-[3/4] rounded-xl overflow-hidden cursor-pointer group relative" onClick={() => openLightbox(set.images.map(x => x.imageUrl), i)}>
                  <img src={img.imageUrl} alt={img.sceneName} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {lightboxOpen && (
        <ImageLightbox images={lightboxImages} initialIndex={lightboxIndex} onClose={() => setLightboxOpen(false)} onDownload={(url, idx) => downloadImage(url, idx)} metadata={{ label: 'Campaña' }} />
      )}
    </div>
  );

  return null;
};

export default CampaignModule;
