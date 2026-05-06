/**
 * PhotodumpModule.tsx
 * Módulo independiente de Photodump — storyteller visual orgánico.
 * Biblioteca propia en IndexedDB.
 */
import React, { useState, useEffect } from 'react';
import {
  Images, Loader2, Download, Image, BookOpen,
  ChevronRight, ChevronLeft, Copy, Check, Sparkles,
  Hash, Library, Trash2, ArrowLeft,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { generationService, GenerationProgress } from '../promptLibrary/services/generationService';
import { downloadAsZip } from '../../utils/imageUtils';
import { ImageLightbox } from '../../components/shared/ImageLightbox';
import { newSessionId } from '../../services/imageApiService';
import { buildPhotodumpScenes } from './photodumpService';
import { photodumpStorage } from './photodumpStorage';
import {
  PhotodumpSet, PhotodumpNarrative, PhotodumpProtagonist,
  NARRATIVE_META, PROTAGONIST_META,
} from './types';
import ModuleTutorial from '../../components/shared/ModuleTutorial';
import { TUTORIAL_CONFIGS } from '../../components/shared/tutorialConfigs';

// ── Upgrade wall ──────────────────────────────────────────────
const UpgradeWall: React.FC<{ proCredits: number }> = ({ proCredits }) => {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6 px-4">
      <div className="w-20 h-20 bg-violet-600/10 border border-violet-500/20 rounded-3xl flex items-center justify-center">
        <Images className="w-10 h-10 text-violet-400" />
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter">Photodump Mode</h2>
        <p className="text-slate-400 text-sm max-w-sm leading-relaxed">
          {proCredits === 0
            ? 'Agotaste tus sesiones Photodump de este período. Comprá pro-credits o actualizá tu plan.'
            : 'Necesitás pro-credits para usar Photodump. Cada sesión consume 1 pro-credit.'}
        </p>
      </div>
      <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3 max-w-xs w-full">
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Tus pro-credits</p>
        <p className="text-4xl font-black text-white">{proCredits}</p>
        <p className="text-[11px] text-slate-500">1 pro-credit = 1 sesión Photodump</p>
      </div>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <button onClick={() => navigate('/buy-credits')} className="w-full py-4 bg-violet-600 hover:bg-violet-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-violet-900/30">
          Comprar pro-credits
        </button>
        <button onClick={() => navigate('/pricing')} className="w-full py-3 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/10 rounded-2xl font-black text-xs uppercase tracking-widest transition-all">
          Ver planes
        </button>
      </div>
    </div>
  );
};

type View = 'brief' | 'generating' | 'results' | 'library';

const PhotodumpModule: React.FC = () => {
  const { user, credits, isAdmin, deductCredits, refreshCredits, proCredits, deductProCredit, refundProCredit } = useAuth();

  const [basePrompt,   setBasePrompt]   = useState('');
  const [narrative,    setNarrative]    = useState<PhotodumpNarrative>('day');
  const [protagonist,  setProtagonist]  = useState<PhotodumpProtagonist>('person');
  const [customStory,  setCustomStory]  = useState('');
  const [count,        setCount]        = useState(4);

  const [view,         setView]         = useState<View>('brief');
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress,     setProgress]     = useState<GenerationProgress | null>(null);
  const [error,        setError]        = useState<string | null>(null);
  const [currentSet,   setCurrentSet]   = useState<PhotodumpSet | null>(null);
  const [sets,         setSets]         = useState<PhotodumpSet[]>([]);
  const [loadingSets,  setLoadingSets]  = useState(false);

  const [lightboxOpen,   setLightboxOpen]   = useState(false);
  const [lightboxIndex,  setLightboxIndex]  = useState(0);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [copiedIdx,      setCopiedIdx]      = useState<number | null>(null);

  const canGenerate   = basePrompt.trim().length > 0 && !isGenerating &&
    (narrative !== 'custom' || customStory.trim().length > 0);
  const hasProCredits = isAdmin || proCredits > 0;

  const loadSets = async () => {
    setLoadingSets(true);
    setSets(await photodumpStorage.list());
    setLoadingSets(false);
  };

  useEffect(() => { loadSets(); }, []);

  const handleGenerate = async () => {
    if (!canGenerate || !hasProCredits) return;

    if (!isAdmin) {
      const ok = await deductProCredit();
      if (!ok) { setError('No tenés pro-credits suficientes.'); return; }
    }

    const imageCreditCost = count * 2;
    if (!isAdmin && credits.available < imageCreditCost) {
      await refundProCredit();
      setError(`Necesitás ${imageCreditCost} créditos para generar ${count} imágenes.`);
      return;
    }
    if (!isAdmin) {
      const ok = await deductCredits(imageCreditCost);
      if (!ok) { await refundProCredit(); setError('Error al descontar créditos.'); return; }
    }

    setView('generating');
    setIsGenerating(true);
    setError(null);
    setCurrentSet(null);
    setProgress({ total: count, completed: 0, current: 0 });

    try {
      const scenes = await buildPhotodumpScenes(basePrompt, narrative, protagonist, customStory, count);

      const finalPrompts = scenes.map(s =>
        `${basePrompt}, ${s.scenePrompt}, photorealistic, UGC style`,
      );

      const images = await generationService.generateBatchFlash(
        finalPrompts, [], undefined, (p) => setProgress(p),
        { uid: user?.uid, sessionId: newSessionId(), module: 'photodump', moduleLabel: 'Photodump Mode', metadata: { narrative, protagonist, count } },
      );

      const set: PhotodumpSet = {
        id: Date.now().toString(), createdAt: Date.now(),
        basePrompt, narrative, protagonist, customStory, count, references: [],
        images: images.filter(Boolean).map((url, i) => ({
          imageUrl: url,
          moment:   scenes[i]?.moment   ?? `Momento ${i + 1}`,
          caption:  scenes[i]?.caption  ?? '',
          hashtags: scenes[i]?.hashtags ?? '',
          prompt:   finalPrompts[i]     ?? '',
          order:    i + 1,
        })),
      };

      await photodumpStorage.save(set);
      await loadSets();
      setCurrentSet(set);
      setView('results');
      await refreshCredits();
    } catch (err: any) {
      setError(err?.message || 'Error generando el photodump.');
      if (!isAdmin) { await refundProCredit(); await refreshCredits(); }
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
    a.href = url; a.download = `photodump_${idx + 1}.png`; a.click();
  };

  const downloadSetZip = async (set: PhotodumpSet) => {
    await downloadAsZip(set.images.map(i => i.imageUrl), `photodump_${set.id.slice(-6)}.zip`, 'dump');
  };

  const openLightbox = (images: string[], idx: number) => {
    setLightboxImages(images); setLightboxIndex(idx); setLightboxOpen(true);
  };

  const reset = () => { setView('brief'); setCurrentSet(null); setError(null); setProgress(null); };

  // ── Header ────────────────────────────────────────────────────
  const Header = () => (
    <div className="flex items-center justify-between mb-8">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-violet-600/20 border border-violet-500/30 rounded-2xl flex items-center justify-center">
          <Images className="w-5 h-5 text-violet-400" />
        </div>
        <div>
          <h1 className="text-xl font-black text-white uppercase italic tracking-tighter leading-none">Photodump Mode</h1>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">Storyteller visual · Sets orgánicos</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 bg-violet-600/10 border border-violet-500/20 rounded-xl px-3 py-2">
          <Sparkles className="w-3.5 h-3.5 text-violet-400" />
          <span className="text-xs font-black text-violet-300">{isAdmin ? '∞' : proCredits}</span>
          <span className="text-[9px] text-slate-500 font-bold uppercase">sesiones</span>
        </div>
        <button onClick={() => setView('library')} className="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-slate-400 hover:text-white text-[10px] font-black uppercase tracking-widest transition-all">
          <Library className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Sets ({sets.length})</span>
        </button>
        <ModuleTutorial moduleId="photodumpMode" steps={TUTORIAL_CONFIGS.photodumpMode} label="¿Cómo funciona?" compact />
      </div>
    </div>
  );

  if (!hasProCredits && view === 'brief') return (
    <div className="max-w-2xl mx-auto space-y-6 pb-20"><Header /><UpgradeWall proCredits={proCredits} /></div>
  );

  // ── BRIEF ─────────────────────────────────────────────────────
  if (view === 'brief') return (
    <div className="max-w-2xl mx-auto space-y-6 pb-20 animate-in fade-in duration-500">
      <Header />

      {!isAdmin && proCredits <= 3 && (
        <div className="bg-violet-900/20 border border-violet-500/30 rounded-2xl p-4 flex items-center gap-3">
          <Sparkles className="w-5 h-5 text-violet-400 flex-shrink-0" />
          <p className="text-xs text-violet-300 font-medium">Te quedan <strong>{proCredits} sesiones</strong> Photodump este período.</p>
        </div>
      )}

      <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3">
        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Contexto base</p>
        <textarea
          value={basePrompt}
          onChange={e => setBasePrompt(e.target.value)}
          placeholder="Describe el sujeto o contexto general del set. Ej: @persona1 durante una tarde en Buenos Aires, con su crema hidratante..."
          rows={3}
          className="w-full bg-white/5 border border-white/10 focus:border-violet-500/50 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-600 outline-none transition-all resize-none"
        />
      </div>

      {/* Narrativa */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <BookOpen className="w-3.5 h-3.5 text-slate-500" />
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">¿Qué historia cuenta este set?</p>
        </div>
        <div className="grid grid-cols-1 gap-2">
          {(Object.keys(NARRATIVE_META) as PhotodumpNarrative[]).map(n => (
            <button
              key={n}
              onClick={() => setNarrative(n)}
              className={`text-left p-3 rounded-xl border transition-all flex items-center gap-3 ${
                narrative === n ? 'bg-violet-600/20 border-violet-500/50 text-white' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/8'
              }`}
            >
              <span className="text-lg flex-shrink-0">{NARRATIVE_META[n].icon}</span>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-tight">{NARRATIVE_META[n].label}</p>
                <p className="text-[9px] text-slate-500 mt-0.5">{NARRATIVE_META[n].description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {narrative === 'custom' && (
        <textarea
          value={customStory}
          onChange={e => setCustomStory(e.target.value)}
          placeholder="Describe tu historia: personajes, situación, arco narrativo..."
          rows={3}
          className="w-full bg-white/5 border border-white/10 focus:border-violet-500/50 rounded-xl px-4 py-3 text-sm text-slate-300 placeholder-slate-600 outline-none transition-all resize-none animate-in fade-in"
        />
      )}

      {/* Protagonista */}
      <div className="space-y-2">
        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Protagonista del set</p>
        <div className="flex gap-2">
          {(Object.keys(PROTAGONIST_META) as PhotodumpProtagonist[]).map(p => (
            <button key={p} onClick={() => setProtagonist(p)}
              className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-tight transition-all ${
                protagonist === p ? 'bg-violet-600 text-white shadow-lg' : 'bg-white/5 text-slate-500 border border-white/10 hover:bg-white/10'
              }`}
            >
              {PROTAGONIST_META[p]}
            </button>
          ))}
        </div>
      </div>

      {/* Cantidad */}
      <div className="space-y-2">
        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Imágenes del set</p>
        <div className="flex gap-2">
          {[3, 4, 5, 6].map(n => (
            <button key={n} onClick={() => setCount(n)}
              className={`flex-1 py-3 rounded-xl text-xs font-black uppercase transition-all ${
                count === n ? 'bg-violet-600 text-white shadow-lg' : 'bg-white/5 text-slate-500 border border-white/10 hover:bg-white/10'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-slate-500">
          Costo: 1 pro-credit + {count * 2} créditos · Disponibles: {isAdmin ? '∞' : credits.available}
        </p>
      </div>

      {error && <div className="bg-red-900/20 border border-red-500/20 text-red-400 p-4 rounded-2xl text-xs font-bold">{error}</div>}

      <button
        onClick={handleGenerate}
        disabled={!canGenerate || !hasProCredits}
        className={`w-full py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-all ${
          !canGenerate || !hasProCredits
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

  // ── GENERATING ────────────────────────────────────────────────
  if (view === 'generating') return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in duration-500 py-12">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 mx-auto bg-violet-600/20 rounded-3xl flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
        </div>
        <div>
          <p className="text-sm font-black text-white uppercase tracking-tight">
            {progress ? `Generando imagen ${progress.completed + 1} de ${progress.total}` : 'IA construyendo la narrativa...'}
          </p>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Storyteller trabajando</p>
        </div>
      </div>
      {progress && (
        <div className="space-y-2">
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-violet-500 to-pink-500 rounded-full transition-all duration-700" style={{ width: `${(progress.completed / progress.total) * 100}%` }} />
          </div>
          <div className="flex justify-between">
            <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Progreso</p>
            <p className="text-[9px] font-black text-slate-500">{progress.completed} / {progress.total}</p>
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {Array.from({ length: count }).map((_, i) => {
          const done   = progress ? i < progress.completed : false;
          const active = progress ? i === progress.completed : false;
          return (
            <div key={i} className={`aspect-[3/4] rounded-2xl border flex items-center justify-center transition-all ${
              done ? 'bg-violet-600/10 border-violet-500/30' : active ? 'bg-white/8 border-violet-500/50 animate-pulse' : 'bg-white/5 border-white/10'
            }`}>
              {done ? <Check className="w-5 h-5 text-violet-400" /> : active ? <Loader2 className="w-5 h-5 text-violet-500 animate-spin" /> : <Image className="w-5 h-5 text-slate-700" />}
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
          <h2 className="text-xl font-black text-white uppercase italic tracking-tighter">Historia lista</h2>
          <p className="text-[10px] text-slate-500 uppercase tracking-widest">{currentSet.images.length} imágenes · {NARRATIVE_META[currentSet.narrative].label}</p>
        </div>
        <button onClick={reset} className="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
          <ChevronLeft className="w-3 h-3" /> Nuevo set
        </button>
      </div>

      {/* Orden sugerido */}
      <div className="bg-violet-600/10 border border-violet-500/20 rounded-2xl p-4">
        <p className="text-[9px] font-black text-violet-400 uppercase tracking-widest mb-2">Orden sugerido para carrusel</p>
        <div className="flex gap-2 flex-wrap">
          {currentSet.images.map((img, i) => (
            <div key={i} className="flex items-center gap-1.5 bg-white/5 rounded-lg px-2.5 py-1.5">
              <span className="text-[9px] font-black text-violet-400">{i + 1}</span>
              <span className="text-[9px] text-slate-400 font-medium">{img.moment}</span>
            </div>
          ))}
        </div>
      </div>

      {currentSet.images.map((img, i) => (
        <div key={i} className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
          <div className="aspect-[3/4] relative cursor-pointer group" onClick={() => openLightbox(currentSet.images.map(x => x.imageUrl), i)}>
            <img src={img.imageUrl} alt={img.moment} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <button onClick={e => { e.stopPropagation(); downloadImage(img.imageUrl, i); }} className="bg-white/20 backdrop-blur-md text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-1.5 hover:bg-white/30">
                <Download className="w-3.5 h-3.5" /> Descargar
              </button>
            </div>
            <div className="absolute top-3 left-3 flex gap-2">
              <div className="bg-black/60 backdrop-blur-md px-2 py-1 rounded-lg">
                <p className="text-[9px] font-black text-violet-400 uppercase">#{i + 1}</p>
              </div>
              <div className="bg-black/60 backdrop-blur-md px-2 py-1 rounded-lg">
                <p className="text-[9px] font-black text-white uppercase">{img.moment}</p>
              </div>
            </div>
          </div>
          <div className="p-4 space-y-3">
            <div className="space-y-1">
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Caption</p>
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs text-white flex-1">{img.caption}</p>
                <button onClick={() => copyText(img.caption, i * 10 + 1)} className="w-7 h-7 bg-white/5 hover:bg-white/15 text-slate-500 hover:text-white rounded-lg flex items-center justify-center transition-all">
                  {copiedIdx === i * 10 + 1 ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <Hash className="w-3 h-3 text-slate-600" />
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Hashtags</p>
              </div>
              <div className="flex items-start justify-between gap-2">
                <p className="text-[10px] text-violet-400 flex-1">{img.hashtags}</p>
                <button onClick={() => copyText(img.hashtags, i * 10 + 2)} className="w-7 h-7 bg-white/5 hover:bg-white/15 text-slate-500 hover:text-white rounded-lg flex items-center justify-center transition-all">
                  {copiedIdx === i * 10 + 2 ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}

      <button onClick={() => downloadSetZip(currentSet)} className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-gradient-to-r from-violet-600 to-pink-600 text-white text-[10px] font-black uppercase tracking-widest shadow-lg hover:opacity-90 active:scale-[0.98] transition-all">
        <Download className="w-4 h-4" /> Descargar set completo (ZIP)
      </button>

      {lightboxOpen && <ImageLightbox images={lightboxImages} initialIndex={lightboxIndex} onClose={() => setLightboxOpen(false)} onDownload={(url, idx) => downloadImage(url, idx)} metadata={{ label: 'Photodump' }} />}
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
            <h2 className="text-xl font-black text-white uppercase italic tracking-tighter">Mis Photodumps</h2>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest">{sets.length} sets guardados</p>
          </div>
        </div>
        <button onClick={reset} className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5" /> Nuevo set
        </button>
      </div>

      {loadingSets && <p className="text-center text-slate-500 text-sm py-12">Cargando...</p>}

      {!loadingSets && sets.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Images className="w-12 h-12 text-slate-700 mb-4" />
          <p className="text-slate-500 text-sm font-medium">Sin photodumps aún</p>
          <p className="text-slate-600 text-xs mt-1">Creá tu primer set para verlo aquí</p>
        </div>
      )}

      <div className="space-y-6">
        {sets.map(set => (
          <div key={set.id} className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
            <div className="p-4 flex items-center justify-between border-b border-white/10">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">{NARRATIVE_META[set.narrative].icon}</span>
                  <p className="text-sm font-black text-white uppercase italic tracking-tight">{NARRATIVE_META[set.narrative].label}</p>
                </div>
                <p className="text-[10px] text-slate-500 line-clamp-1">{set.basePrompt}</p>
                <p className="text-[9px] text-slate-600 mt-0.5">{new Date(set.createdAt).toLocaleDateString('es-CL')} · {set.images.length} imágenes</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => downloadSetZip(set)} className="w-9 h-9 bg-white/5 hover:bg-white/15 text-slate-400 hover:text-white rounded-xl flex items-center justify-center transition-all">
                  <Download className="w-4 h-4" />
                </button>
                <button onClick={async () => { await photodumpStorage.delete(set.id); await loadSets(); }} className="w-9 h-9 bg-white/5 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded-xl flex items-center justify-center transition-all">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1 p-2">
              {set.images.map((img, i) => (
                <div key={i} className="aspect-[3/4] rounded-xl overflow-hidden cursor-pointer group relative" onClick={() => openLightbox(set.images.map(x => x.imageUrl), i)}>
                  <img src={img.imageUrl} alt={img.moment} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                  <div className="absolute bottom-1 left-1 bg-black/60 px-1.5 py-0.5 rounded-md">
                    <p className="text-[7px] font-black text-white uppercase">{img.moment}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {lightboxOpen && <ImageLightbox images={lightboxImages} initialIndex={lightboxIndex} onClose={() => setLightboxOpen(false)} onDownload={(url, idx) => downloadImage(url, idx)} metadata={{ label: 'Photodump' }} />}
    </div>
  );

  return null;
};

export default PhotodumpModule;
