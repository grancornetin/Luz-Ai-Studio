/**
 * PhotodumpModule.tsx
 * Diario visual orgánico — Photodump Mode 2.0
 * Diseño alineado con CampaignModule: fondo blanco, WizardStepper, layout dos columnas.
 */
import React, { useState, useEffect } from 'react';
import {
  Images, Download, Check, Sparkles, Library, Trash2, Copy,
  Plus, Hash, BookOpen, RefreshCw, AlertTriangle,
  Image as ImageIcon, ChevronDown,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { downloadAsZip } from '../../utils/imageUtils';
import { ImageLightbox } from '../../components/shared/ImageLightbox';
import { ImageSlot } from '../../components/shared/ImageSlot';
import { newSessionId } from '../../services/imageApiService';
import { photodumpStorage } from './photodumpStorage';
import {
  PhotodumpSet, PhotodumpNarrative, PhotodumpProtagonist, PhotodumpDestino,
  PhotodumpRefs, NARRATIVE_META, PROTAGONIST_META, DESTINO_META, STORY_ARC_META,
} from './types';
import {
  buildPhotodumpSessionPlan,
  generatePhotodumpREF0,
  generatePhotodumpShot,
  generatePhotodumpCaptions,
  getRefsAsArray,
} from './photodumpDirectorService';
import ModuleTutorial from '../../components/shared/ModuleTutorial';
import { TUTORIAL_CONFIGS } from '../../components/shared/tutorialConfigs';
import { WizardStepper } from '../../components/shared/WizardStepper';
import { WizardFooter } from '../../components/shared/WizardFooter';
import { GenerationProgress as GenProgress, type ProgressStep } from '../../components/shared/GenerationProgress';

// ── Wizard steps ──────────────────────────────────────────────
// 1 Brief · 2 Historia · 3 Destino · 4 Generando · 5 Resultados
type WizardStep = 1 | 2 | 3 | 4 | 5;

const WIZARD_STEP_DEFS = [
  { id: '1', label: 'Brief'     },
  { id: '2', label: 'Historia'  },
  { id: '3', label: 'Destino'   },
  { id: '4', label: 'Generar'   },
  { id: '5', label: 'Resultado' },
];

const GENERATION_STEPS: ProgressStep[] = [
  { id: 'plan',     label: 'Armando la estructura narrativa'    },
  { id: 'ref0',     label: 'Generando imagen ancla del set'     },
  { id: 'shots',    label: 'Generando imágenes de la historia'  },
  { id: 'captions', label: 'Escribiendo captions y hashtags'    },
  { id: 'done',     label: 'Historia visual lista'              },
];

const CREDITS_PER_IMAGE = 2;

// ── UpgradeWall ───────────────────────────────────────────────
const UpgradeWall: React.FC<{ proCredits: number }> = ({ proCredits }) => {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-8 px-4">
      <div className="w-20 h-20 bg-brand-50 border border-brand-100 rounded-[28px] flex items-center justify-center">
        <Images className="w-10 h-10 text-brand-600" />
      </div>
      <div className="space-y-2 max-w-sm">
        <h2 className="t-display text-3xl text-slate-900">Photodump Mode</h2>
        <p className="t-body leading-relaxed">
          {proCredits === 0
            ? 'Agotaste tus sesiones Photodump de este período. Comprá pro-credits o actualizá tu plan.'
            : 'Necesitás pro-credits para usar Photodump. Cada sesión consume 1 pro-credit.'}
        </p>
      </div>
      <div className="bg-slate-50 border border-slate-200 rounded-[28px] p-6 space-y-3 max-w-xs w-full">
        <p className="t-meta">Tus pro-credits</p>
        <p className="t-display text-5xl text-slate-900">{proCredits}</p>
        <p className="t-body-sm">1 pro-credit = 1 historia visual</p>
      </div>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <button onClick={() => navigate('/buy-credits')}
          className="w-full py-4 bg-brand-600 hover:bg-brand-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg">
          Comprar pro-credits
        </button>
        <button onClick={() => navigate('/pricing')}
          className="w-full py-3 bg-white border border-slate-200 hover:border-slate-300 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest transition-all">
          Ver planes
        </button>
      </div>
    </div>
  );
};

// ── Componente principal ──────────────────────────────────────
const PhotodumpModule: React.FC = () => {
  const { user, credits, isAdmin, deductCredits, refreshCredits, proCredits, deductProCredit, refundProCredit } = useAuth();

  // Brief
  const [basePrompt,  setBasePrompt]  = useState('');
  const [refs, setRefs] = useState<PhotodumpRefs>({
    avatarRef: null, productRef: null, outfitRef: null, sceneRef: null, sceneText: '',
  });

  // Historia
  const [narrative,   setNarrative]   = useState<PhotodumpNarrative>('day');
  const [protagonist, setProtagonist] = useState<PhotodumpProtagonist>('both');
  const [customStory, setCustomStory] = useState('');
  const [count,       setCount]       = useState(4);

  // Destino
  const [destino,     setDestino]     = useState<PhotodumpDestino>('feed');

  // Wizard
  const [step,      setStep]      = useState<WizardStep>(1);
  const [activeTab, setActiveTab] = useState<'create' | 'library'>('create');

  // Generación
  const [isGenerating,      setIsGenerating]      = useState(false);
  const [progressStepIndex, setProgressStepIndex] = useState(0);
  const [progress,          setProgress]          = useState<{ total: number; completed: number } | null>(null);
  const [partialImages,     setPartialImages]     = useState<string[]>([]);
  const [error,             setError]             = useState<string | null>(null);
  const [currentSet,        setCurrentSet]        = useState<PhotodumpSet | null>(null);

  // Resultados UI
  const [expandedIdx,     setExpandedIdx]     = useState<number | null>(null);
  const [copiedKey,       setCopiedKey]       = useState<string | null>(null);
  const [activeResultTab, setActiveResultTab] = useState<'images' | 'captions' | 'hashtags'>('images');

  // Library
  const [sets,        setSets]        = useState<PhotodumpSet[]>([]);
  const [loadingSets, setLoadingSets] = useState(false);
  const [deletingId,  setDeletingId]  = useState<string | null>(null);

  // Lightbox
  const [lightboxOpen,   setLightboxOpen]   = useState(false);
  const [lightboxIndex,  setLightboxIndex]  = useState(0);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);

  // ── Costos — count shots + 1 REF0 ancla ─────────────────
  const imageCreditCost = (count + 1) * CREDITS_PER_IMAGE;
  const insufficient    = !isAdmin && (credits?.available ?? 0) < imageCreditCost;
  const hasProCredits   = isAdmin || proCredits > 0;
  const creditsAfter    = Math.max(0, (credits?.available ?? 0) - imageCreditCost);

  // ── Validaciones por paso ─────────────────────────────────
  const canStep1 = basePrompt.trim().length >= 5;
  const canStep2 = narrative !== 'custom' || customStory.trim().length >= 10;
  const canStep3 = !insufficient;

  // ── Librería ──────────────────────────────────────────────
  const loadSets = async () => {
    setLoadingSets(true);
    setSets(await photodumpStorage.list());
    setLoadingSets(false);
  };
  useEffect(() => { loadSets(); }, []);

  // ── Helpers UI ────────────────────────────────────────────
  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const openLightbox = (images: string[], idx: number) => {
    setLightboxImages(images); setLightboxIndex(idx); setLightboxOpen(true);
  };

  const downloadSetZip = async (set: PhotodumpSet) => {
    await downloadAsZip(set.images.map(i => i.imageUrl), `photodump_${set.id.slice(-6)}.zip`, 'dump');
  };

  const emptyRefs: PhotodumpRefs = { avatarRef: null, productRef: null, outfitRef: null, sceneRef: null, sceneText: '' };

  const resetCreator = () => {
    setStep(1); setBasePrompt(''); setRefs(emptyRefs); setNarrative('day');
    setProtagonist('both'); setCustomStory(''); setCount(4); setDestino('feed');
    setCurrentSet(null); setError(null); setProgress(null);
    setProgressStepIndex(0); setIsGenerating(false); setPartialImages([]);
    setExpandedIdx(null);
  };

  // ── GENERACIÓN PRINCIPAL ──────────────────────────────────
  const handleGenerate = async () => {
    if (!hasProCredits) return;

    if (!isAdmin) {
      const ok = await deductProCredit();
      if (!ok) { setError('No tenés pro-credits para esta sesión.'); return; }
    }
    if (!isAdmin && (credits?.available ?? 0) < imageCreditCost) {
      if (!isAdmin) await refundProCredit();
      setError(`Necesitás ${imageCreditCost} créditos para generar ${count} imágenes.`);
      return;
    }
    if (!isAdmin) {
      const ok = await deductCredits(imageCreditCost);
      if (!ok) { await refundProCredit(); setError('Error al descontar créditos.'); return; }
    }

    setStep(4);
    setIsGenerating(true);
    setError(null);
    setCurrentSet(null);
    setPartialImages([]);
    setProgressStepIndex(0);
    setProgress({ total: count, completed: 0 });

    try {
      const sessionId = newSessionId();
      const sessionParams = { uid: user?.uid, sessionId };

      // Paso 1: armar plan narrativo (shot directives)
      setProgressStepIndex(0);
      const plan = await buildPhotodumpSessionPlan(narrative, protagonist, destino, basePrompt);
      const shots = plan.shots.slice(0, count);

      // Paso 2: generar imagen ancla REF0
      setProgressStepIndex(1);
      const { imageUrl: ref0Url, ref0Analysis } = await generatePhotodumpREF0(
        refs, narrative, protagonist, destino, basePrompt, sessionParams,
      );
      setPartialImages([ref0Url]);

      // Paso 3: generar shots narrativos en paralelo controlado
      setProgressStepIndex(2);
      const shotUrls: string[] = [];
      for (let i = 0; i < shots.length; i++) {
        const url = await generatePhotodumpShot(
          shots[i], refs, ref0Url, ref0Analysis,
          basePrompt, narrative, destino, sessionParams,
        );
        shotUrls.push(url);
        setPartialImages(prev => [...prev, url]);
        setProgress({ total: shots.length, completed: i + 1 });
      }

      // Paso 4: generar captions y hashtags
      setProgressStepIndex(3);
      const captions = await generatePhotodumpCaptions(basePrompt, narrative, shots);

      setProgressStepIndex(4);

      const set: PhotodumpSet = {
        id:          Date.now().toString(),
        createdAt:   Date.now(),
        basePrompt, narrative, protagonist, destino, customStory, count,
        refs: { avatarRef: null, productRef: null, outfitRef: null, sceneRef: null },
        images: shotUrls.filter(Boolean).map((url, i) => ({
          imageUrl: url,
          moment:   captions[i]?.moment   ?? `Momento ${i + 1}`,
          caption:  captions[i]?.caption  ?? '',
          hashtags: captions[i]?.hashtags ?? '',
          prompt:   shots[i]?.purpose     ?? '',
          order:    i + 1,
        })),
      };

      await photodumpStorage.save(set);
      await loadSets();
      setCurrentSet(set);
      setStep(5);
      await refreshCredits();
    } catch (err: any) {
      setError(err?.message || 'Error generando el photodump.');
      if (!isAdmin) {
        await refundProCredit().catch(() => {});
        await deductCredits(-imageCreditCost).catch(() => {});
        await refreshCredits().catch(() => {});
      }
      setStep(3);
    } finally {
      setIsGenerating(false);
      setProgress(null);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────
  return (
    <>
      <div className="max-w-7xl mx-auto pb-20 animate-in fade-in duration-500">

        {/* ── HEADER ──────────────────────────────────────── */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-5 px-1 mb-6 md:mb-8">
          <div>
            <h1 className="t-display text-3xl text-slate-900">
              Photodump <span className="text-brand-600">Mode</span>
            </h1>
            <div className="flex items-center gap-2 mt-2">
              <p className="text-slate-500 font-medium italic text-xs md:text-sm">
                Diario visual orgánico · Historia → Referencias → Set listo
              </p>
              <ModuleTutorial moduleId="photodumpMode" steps={TUTORIAL_CONFIGS.photodumpMode} />
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 bg-brand-50 border border-brand-100 rounded-2xl px-3 py-2">
              <Sparkles className="w-3.5 h-3.5 text-brand-600" />
              <span className="text-xs font-black text-brand-700">{isAdmin ? '∞' : proCredits}</span>
              <span className="t-meta text-brand-500">sesiones</span>
            </div>
            <div className="flex bg-white p-1 rounded-2xl shadow-sm border border-slate-100 gap-1">
              <button onClick={() => { setActiveTab('create'); resetCreator(); window.scrollTo(0, 0); }}
                className={`px-5 md:px-8 py-2 md:py-3 rounded-xl t-meta transition-colors duration-150 ${activeTab === 'create' ? 'bg-brand-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-700'}`}>
                Crear
              </button>
              <button onClick={() => { setActiveTab('library'); window.scrollTo(0, 0); }}
                className={`px-5 md:px-8 py-2 md:py-3 rounded-xl t-meta transition-colors duration-150 ${activeTab === 'library' ? 'bg-brand-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-700'}`}>
                Biblioteca ({sets.length})
              </button>
            </div>
          </div>
        </header>

        {/* ── SIN PRO-CREDITS ─────────────────────────────── */}
        {!hasProCredits && activeTab === 'create' && (
          <div className="bg-white rounded-[28px] md:rounded-[36px] shadow-sm border border-slate-100 overflow-hidden">
            <UpgradeWall proCredits={proCredits} />
          </div>
        )}

        {/* ══════════════ WIZARD ══════════════ */}
        {hasProCredits && activeTab === 'create' && (
          <div className="bg-white rounded-[28px] md:rounded-[36px] shadow-sm border border-slate-100 overflow-hidden flex flex-col min-h-[640px]">
            <WizardStepper
              steps={WIZARD_STEP_DEFS}
              current={Math.min(step, 5) as any}
              onJump={(s) => { const n = Number(s) as WizardStep; if (n < step && !isGenerating) setStep(n); }}
            />

            <div className="flex-1 overflow-auto">

              {/* ── PASO 1: BRIEF ───────────────────────── */}
              {step === 1 && (
                <div className="fade-in p-4 md:p-8">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-9 items-start">
                    <div className="md:col-span-7 order-2 md:order-1 flex flex-col gap-5">
                      <div>
                        <div className="text-[10px] font-black text-brand-600 uppercase tracking-[0.18em]">Paso 1 · Brief</div>
                        <h2 className="t-display text-[28px] md:text-[34px] text-slate-900 mt-2.5 leading-[1.05]">
                          ¿Qué historia<br /><span className="text-brand-600 italic normal-case">querés contar?</span>
                        </h2>
                        <p className="text-sm text-slate-500 mt-2 leading-[1.55]">
                          Describí el sujeto o contexto central del set. Puede ser tu producto, un lugar, un momento especial, o vos misma.
                        </p>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-[0.12em] mb-2">
                          Contexto base <span className="text-brand-600">*</span>
                        </label>
                        <textarea
                          value={basePrompt}
                          onChange={e => setBasePrompt(e.target.value)}
                          placeholder="Ej: @sofi con su crema hidratante favorita, en su departamento de Buenos Aires..."
                          rows={4} autoComplete="off" autoCapitalize="sentences"
                          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3.5 text-[15px] text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 transition-all resize-none leading-relaxed"
                        />
                        <p className="text-[11px] text-slate-400 mt-1.5">
                          Incluí la persona, el producto, el contexto o lugar. Cuanto más detalle, mejor dirección visual.
                        </p>
                      </div>

                      {/* Referencias del protagonista */}
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-[0.12em] mb-1">
                          Referencias del protagonista{' '}
                          <span className="text-slate-400 font-medium normal-case tracking-normal">(opcional — para mantener identidad consistente)</span>
                        </label>
                        <p className="text-[11px] text-slate-400 mb-3 leading-relaxed">
                          Subí fotos del personaje, producto, outfit o lugar que aparecerán en toda la historia. El director analiza cada referencia y bloquea la identidad en cada imagen generada.
                        </p>
                        <div className="grid grid-cols-4 gap-3">
                          <div className="flex flex-col gap-1.5">
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.12em]">Persona</p>
                            <ImageSlot
                              value={refs.avatarRef}
                              onChange={v => setRefs(r => ({ ...r, avatarRef: v }))}
                              slotType="person"
                              aspectRatio="portrait"
                              hint="Foto del personaje"
                              iconless={false}
                            />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.12em]">Producto</p>
                            <ImageSlot
                              value={refs.productRef}
                              onChange={v => setRefs(r => ({ ...r, productRef: v }))}
                              slotType="product"
                              aspectRatio="portrait"
                              hint="Foto del producto"
                              iconless={false}
                            />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.12em]">Outfit</p>
                            <ImageSlot
                              value={refs.outfitRef}
                              onChange={v => setRefs(r => ({ ...r, outfitRef: v }))}
                              slotType="outfit"
                              aspectRatio="portrait"
                              hint="Foto del outfit"
                              iconless={false}
                            />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.12em]">Escena</p>
                            <ImageSlot
                              value={refs.sceneRef}
                              onChange={v => setRefs(r => ({ ...r, sceneRef: v }))}
                              slotType="scene"
                              aspectRatio="portrait"
                              hint="Foto del lugar"
                              iconless={false}
                            />
                          </div>
                        </div>
                        {refs.sceneRef && (
                          <input
                            type="text"
                            value={refs.sceneText ?? ''}
                            onChange={e => setRefs(r => ({ ...r, sceneText: e.target.value }))}
                            placeholder="Describe el lugar (opcional) — ej: departamento moderno con plantas, Buenos Aires"
                            className="w-full mt-2 bg-white border border-slate-200 rounded-xl px-3 py-2 text-[12px] text-slate-700 outline-none focus:border-brand-400 transition-all"
                          />
                        )}
                      </div>
                    </div>

                    {/* Columna derecha: ejemplos */}
                    <div className="md:col-span-5 order-1 md:order-2">
                      <div className="text-[11px] font-bold text-slate-500 uppercase tracking-[0.12em] mb-3">Ejemplos de briefs</div>
                      <div className="space-y-2.5">
                        {[
                          { tag: 'Skincare',  color: 'text-brand-600',   bg: 'bg-brand-50',   text: '@sofi con su crema hidratante favorita, en su departamento de Buenos Aires. Mañana de domingo relajada.' },
                          { tag: 'Moda',      color: 'text-violet-600',  bg: 'bg-violet-50',  text: 'Outfit del día: jeans wide leg beige y top blanco. Caminando por Palermo, sol de tarde.' },
                          { tag: 'Producto',  color: 'text-emerald-600', bg: 'bg-emerald-50', text: 'Vela aromática de lavanda. Textura, packaging y ambiente de living cálido con luz suave.' },
                          { tag: 'Lugar',     color: 'text-amber-600',   bg: 'bg-amber-50',   text: 'Tarde de café y trabajo en el Starbucks de Providencia. MacBook, café con leche, calma.' },
                        ].map(ex => (
                          <button key={ex.tag} type="button" onClick={() => setBasePrompt(ex.text)}
                            className="w-full text-left bg-white border border-slate-200 hover:border-slate-300 rounded-2xl p-3.5 transition-all hover:shadow-sm group">
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${ex.bg} ${ex.color}`}>{ex.tag}</span>
                              <span className="text-[10px] text-slate-400 group-hover:text-brand-600 transition-colors">Usar este →</span>
                            </div>
                            <p className="text-[12px] text-slate-600 leading-snug">{ex.text}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── PASO 2: HISTORIA ────────────────────── */}
              {step === 2 && (
                <div className="fade-in p-4 md:p-8">
                  <div className="grid grid-cols-1 md:grid-cols-[1fr_320px] gap-6 md:gap-8 items-start">
                    <div className="flex flex-col gap-6">
                      <div>
                        <div className="text-[10px] font-black text-brand-600 uppercase tracking-[0.18em]">Paso 2 · Historia</div>
                        <h2 className="t-display text-[28px] md:text-[34px] text-slate-900 mt-2.5 leading-[1.05]">
                          ¿Qué arco narrativo<br /><span className="text-brand-600 italic normal-case">tiene el set?</span>
                        </h2>
                        <p className="text-sm text-slate-500 mt-2 leading-[1.55]">
                          Elegí la estructura de historia. El director arma el gancho, desarrollo y cierre del carrusel.
                        </p>
                      </div>

                      {/* Narrativa */}
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-[0.12em] mb-3">
                          <BookOpen className="inline w-3.5 h-3.5 mr-1.5 mb-0.5" />Narrativa del set
                        </label>
                        <div className="grid grid-cols-1 gap-2">
                          {(Object.keys(NARRATIVE_META) as PhotodumpNarrative[]).map(n => {
                            const sel = narrative === n;
                            return (
                              <button key={n} type="button" onClick={() => setNarrative(n)}
                                className={`flex items-center gap-3 p-3.5 rounded-2xl border text-left transition-all ${sel ? 'border-2 border-brand-600 bg-brand-50' : 'border border-slate-200 bg-white hover:border-slate-300'}`}>
                                <span className="text-xl flex-shrink-0">{NARRATIVE_META[n].icon}</span>
                                <div className="flex-1 min-w-0">
                                  <p className={`text-[13px] font-bold ${sel ? 'text-brand-900' : 'text-slate-800'}`}>{NARRATIVE_META[n].label}</p>
                                  <p className="text-[11px] text-slate-500 mt-0.5">{NARRATIVE_META[n].description}</p>
                                </div>
                                <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${sel ? 'bg-brand-600 text-white' : 'border-2 border-slate-200'}`}>
                                  {sel && <Check size={10} strokeWidth={3} />}
                                </div>
                              </button>
                            );
                          })}
                        </div>

                        {narrative === 'custom' && (
                          <textarea value={customStory} onChange={e => setCustomStory(e.target.value)}
                            placeholder="Describí tu historia: personajes, situación, arco narrativo..."
                            rows={3}
                            className="w-full mt-3 bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 transition-all resize-none animate-in fade-in" />
                        )}
                      </div>

                      {/* Protagonista */}
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-[0.12em] mb-3">
                          Protagonista del set
                        </label>
                        <div className="flex flex-col gap-2">
                          {(Object.keys(PROTAGONIST_META) as PhotodumpProtagonist[]).map(p => {
                            const sel = protagonist === p;
                            return (
                              <button key={p} type="button" onClick={() => setProtagonist(p)}
                                className={`flex items-center gap-3 p-3.5 rounded-2xl border text-left transition-all ${sel ? 'border-2 border-brand-600 bg-brand-50' : 'border border-slate-200 bg-white hover:border-slate-300'}`}>
                                <div className="flex-1">
                                  <p className={`text-[13px] font-bold ${sel ? 'text-brand-900' : 'text-slate-800'}`}>{PROTAGONIST_META[p].label}</p>
                                  <p className="text-[11px] text-slate-500 mt-0.5">{PROTAGONIST_META[p].description}</p>
                                </div>
                                <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${sel ? 'bg-brand-600 text-white' : 'border-2 border-slate-200'}`}>
                                  {sel && <Check size={10} strokeWidth={3} />}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Cantidad */}
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-[0.12em] mb-3">
                          Cantidad de imágenes
                        </label>
                        <div className="grid grid-cols-4 gap-2">
                          {[3, 4, 5, 6].map(n => (
                            <button key={n} type="button" onClick={() => setCount(n)}
                              className={`py-4 rounded-2xl flex flex-col items-center gap-0.5 transition-all ${count === n ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                              <span className="text-lg font-bold">{n}</span>
                              <span className="text-[9px] opacity-60">imágenes</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Panel Story Arc */}
                    <div className="md:sticky md:top-4">
                      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Así se estructura el set</p>
                        <div className="space-y-2">
                          {Object.entries(STORY_ARC_META).map(([key, meta]) => (
                            <div key={key} className="flex items-start gap-2.5">
                              <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full flex-shrink-0 mt-0.5 ${meta.color}`}>
                                {meta.label}
                              </span>
                              <p className="text-[11px] text-slate-500 leading-snug pt-0.5">{meta.description}</p>
                            </div>
                          ))}
                        </div>
                        <div className="h-px bg-slate-200" />
                        <p className="text-[10px] text-slate-400 leading-relaxed">
                          El director arma el arco automáticamente según la cantidad de imágenes elegida.
                        </p>
                      </div>

                      {narrative !== 'custom' && (
                        <div className="mt-3 bg-white border border-slate-200 rounded-2xl p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-lg">{NARRATIVE_META[narrative].icon}</span>
                            <p className="text-[12px] font-bold text-slate-800">{NARRATIVE_META[narrative].label}</p>
                          </div>
                          <p className="text-[11px] text-slate-500">{NARRATIVE_META[narrative].description}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ── PASO 3: DESTINO + COSTO ─────────────── */}
              {step === 3 && (
                <div className="fade-in p-4 md:p-8">
                  <div className="grid grid-cols-1 md:grid-cols-[1fr_300px] gap-5 md:gap-6 items-start">
                    <div className="flex flex-col gap-6">
                      <div>
                        <div className="text-[10px] font-black text-brand-600 uppercase tracking-[0.18em]">Paso 3 · Destino</div>
                        <h2 className="t-display text-[28px] md:text-[34px] text-slate-900 mt-2.5 leading-[1.05]">
                          ¿Dónde vas a<br /><span className="text-brand-600 italic normal-case">publicar el set?</span>
                        </h2>
                        <p className="text-sm text-slate-500 mt-2 leading-[1.55]">
                          El formato cambia la composición de cada imagen. El director adapta el encuadre al destino elegido.
                        </p>
                      </div>

                      <div className="flex flex-col gap-3">
                        {(Object.keys(DESTINO_META) as PhotodumpDestino[]).map(d => {
                          const meta = DESTINO_META[d];
                          const sel  = destino === d;
                          return (
                            <button key={d} type="button" onClick={() => setDestino(d)}
                              className={`flex items-center gap-4 p-4 rounded-2xl border text-left transition-all ${sel ? 'border-2 border-brand-600 bg-brand-50' : 'border border-slate-200 bg-white hover:border-slate-300'}`}>
                              <span className="text-2xl flex-shrink-0">{meta.icon}</span>
                              <div className="flex-1">
                                <div className={`text-[14px] font-bold ${sel ? 'text-brand-900' : 'text-slate-800'}`}>{meta.label}</div>
                                <div className="text-[11px] text-slate-500 mt-0.5">{meta.hint}</div>
                              </div>
                              <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${sel ? 'bg-brand-600 text-white' : 'border-2 border-slate-200'}`}>
                                {sel && <Check size={10} strokeWidth={3} />}
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      {/* Aviso del flujo */}
                      <div className="rounded-2xl p-4 bg-violet-50 border border-violet-100">
                        <div className="flex items-start gap-3">
                          <Sparkles className="w-4 h-4 text-violet-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-[12px] font-bold text-violet-900 mb-1">Cómo funciona el proceso</p>
                            {(() => {
                              const hasRefs = getRefsAsArray(refs).length > 0;
                              return (
                                <ol className="text-[11px] text-violet-700 leading-[1.6] space-y-1 list-none">
                                  {hasRefs && (
                                    <li><span className="font-bold">1.</span> El director <strong>analiza tus referencias</strong> y extrae los descriptores de identidad del protagonista</li>
                                  )}
                                  <li><span className="font-bold">{hasRefs ? '2' : '1'}.</span> Construye el <strong>arco narrativo en 3 actos</strong> (Gancho → Desarrollo → Cierre)</li>
                                  <li><span className="font-bold">{hasRefs ? '3' : '2'}.</span> Genera las <strong>{count} imágenes</strong> bloqueando la identidad del protagonista en cada una</li>
                                  <li><span className="font-bold">{hasRefs ? '4' : '3'}.</span> Recibís el set completo con captions y hashtags listos para publicar</li>
                                </ol>
                              );
                            })()}
                          </div>
                        </div>
                      </div>

                      {error && (
                        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-[12px] text-rose-700 font-medium flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />{error}
                        </div>
                      )}
                    </div>

                    {/* Panel de costo */}
                    <div className="md:sticky md:top-4">
                      <div className="relative bg-slate-900 text-white rounded-2xl p-5 overflow-hidden">
                        <div className="absolute -top-10 -right-10 w-[140px] h-[140px] rounded-full pointer-events-none"
                          style={{ background: 'rgba(124,58,237,0.3)', filter: 'blur(40px)' }} />
                        <div className="relative">
                          <div className="text-[10px] font-bold text-pink-300 uppercase tracking-[0.14em] mb-3.5">Resumen del costo</div>
                          <div className="flex flex-col gap-2 mb-3.5 text-[13px]">
                            <div className="flex justify-between items-baseline">
                              <span className="opacity-70">1 imagen ancla (REF0)</span>
                              <span className="font-semibold">{CREDITS_PER_IMAGE} cr</span>
                            </div>
                            <div className="flex justify-between items-baseline">
                              <span className="opacity-70">{count} imágenes del set</span>
                              <span className="font-semibold">{count * CREDITS_PER_IMAGE} cr</span>
                            </div>
                            <div className="flex justify-between items-baseline">
                              <span className="opacity-70">Sesión</span>
                              <span className="font-semibold">1 pro-credit</span>
                            </div>
                            <div className="h-px bg-white/10 my-1" />
                            <div className="flex justify-between items-baseline">
                              <span className="opacity-85 text-[13px]">Total créditos</span>
                              <span className="font-display font-extrabold italic text-[36px] tracking-tight leading-none"
                                style={{ fontFamily: 'Syne, Inter, sans-serif' }}>
                                {imageCreditCost}{' '}
                                <span className="text-sm opacity-70 font-semibold not-italic tracking-normal">cr</span>
                              </span>
                            </div>
                          </div>
                          <div className="h-px bg-white/10 mb-3" />
                          <div className={`text-[11px] leading-[1.5] ${insufficient ? 'text-rose-300' : 'opacity-70'}`}>
                            {insufficient
                              ? <><strong>Créditos insuficientes.</strong> Te faltan {imageCreditCost - (credits?.available ?? 0)} cr.</>
                              : <>Te quedarán <strong>{creditsAfter} cr</strong> después.</>}
                          </div>
                        </div>
                      </div>
                      <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2.5 text-[11.5px] text-emerald-900 leading-[1.55] mt-3">
                        <strong>Sin sorpresas.</strong> Solo se descuenta si la generación se completa. Reembolso automático si falla.
                      </div>

                      {/* Resumen del brief */}
                      <div className="mt-3 bg-white border border-slate-200 rounded-2xl p-4 space-y-2">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tu set</p>
                        <div className="flex items-center gap-2">
                          <span className="text-base">{NARRATIVE_META[narrative].icon}</span>
                          <p className="text-[12px] font-bold text-slate-800">{NARRATIVE_META[narrative].label}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-base">{DESTINO_META[destino].icon}</span>
                          <p className="text-[12px] text-slate-600">{DESTINO_META[destino].label}</p>
                        </div>
                        {getRefsAsArray(refs).length > 0 && (
                          <div className="flex items-center gap-2">
                            <ImageIcon className="w-4 h-4 text-slate-400" />
                            <p className="text-[12px] text-slate-600">{getRefsAsArray(refs).length} referencia{getRefsAsArray(refs).length > 1 ? 's' : ''} de identidad</p>
                          </div>
                        )}
                        <p className="text-[11px] text-slate-400 line-clamp-2 mt-1 italic">"{basePrompt}"</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── PASO 4: GENERANDO ───────────────────── */}
              {step === 4 && (
                <div className="fade-in p-4 md:p-8">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-5 md:gap-7 items-start">
                    <div className="md:col-span-5 lg:col-span-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-2 h-2 rounded-full bg-brand-600 animate-pulse" />
                        <span className="text-[10px] font-black text-brand-600 uppercase tracking-[0.18em]">Generando · no cierres esta ventana</span>
                      </div>
                      <h2 className="font-display font-extrabold italic uppercase tracking-tight text-[22px] md:text-[26px] text-slate-900 leading-tight"
                        style={{ fontFamily: 'Syne, Inter, sans-serif', letterSpacing: '-0.025em' }}>
                        {NARRATIVE_META[narrative].label}
                      </h2>
                      <div className="text-[13px] text-slate-500 mt-1 mb-4 line-clamp-2 italic">
                        "{basePrompt}"
                      </div>
                      <div className="bg-white border border-slate-200 rounded-2xl p-4 md:p-[18px]">
                        <GenProgress
                          steps={GENERATION_STEPS}
                          currentStepIndex={progressStepIndex}
                          completedShots={partialImages.map((url, i) => ({ url, index: i }))}
                          totalShots={count}
                        />
                      </div>
                    </div>

                    <div className="md:col-span-7 lg:col-span-8">
                      <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.14em] mb-3">
                        Imágenes del set · {progress?.completed ?? 0} de {count} listas
                      </div>
                      <div className={`grid gap-3 ${count <= 4 ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-3'}`}>
                        {Array.from({ length: count }).map((_, i) => {
                          const imgUrl = partialImages[i] ?? '';
                          const done   = !!imgUrl;
                          const active = !done && progress ? i === progress.completed && isGenerating : false;
                          return (
                            <div key={i}
                              style={{ aspectRatio: DESTINO_META[destino].aspectRatio }}
                              className={`relative rounded-2xl overflow-hidden transition-all ${done ? 'fade-in shadow-md' : active ? 'border-2 border-brand-600 bg-slate-100 animate-pulse' : 'bg-slate-100'}`}>
                              {imgUrl && <img src={imgUrl} alt={`Imagen ${i + 1}`} className="w-full h-full object-cover" />}
                              {active && !imgUrl && (
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <div className="bg-white/95 rounded-full px-3.5 py-1.5 text-[10px] font-bold text-brand-600 tracking-[0.12em] uppercase">Generando...</div>
                                </div>
                              )}
                              {!done && !active && (
                                <div className="absolute top-2 left-2 text-[10px] text-slate-400 font-semibold">{i + 1}</div>
                              )}
                              {done && (
                                <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center shadow">
                                  <Check className="w-3 h-3 text-white" strokeWidth={3} />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── PASO 5: RESULTADOS ──────────────────── */}
              {step === 5 && currentSet && (
                <div className="fade-in p-4 md:p-8">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                    <div>
                      <div className="flex items-center gap-2.5 mb-2 flex-wrap">
                        <div className="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                          <Check size={14} strokeWidth={3} />
                        </div>
                        <span className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.18em]">
                          Historia lista · {currentSet.images.length} imágenes
                        </span>
                      </div>
                      <h2 className="font-display font-extrabold italic uppercase tracking-tight text-[24px] md:text-[30px] text-slate-900 leading-[1.05]"
                        style={{ fontFamily: 'Syne, Inter, sans-serif', letterSpacing: '-0.025em' }}>
                        {NARRATIVE_META[currentSet.narrative].label}
                      </h2>
                      <p className="text-[13px] text-slate-500 mt-1 italic line-clamp-1">"{currentSet.basePrompt}"</p>
                    </div>
                    <div className="flex gap-2 w-full md:w-auto flex-wrap">
                      <button type="button" onClick={() => downloadSetZip(currentSet)}
                        className="flex-1 md:flex-none flex items-center justify-center gap-1.5 bg-white border border-slate-200 hover:border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-700 transition-colors">
                        <Download size={14} /> ZIP
                      </button>
                      <button type="button" onClick={resetCreator}
                        className="flex-1 md:flex-none flex items-center justify-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-colors">
                        <Plus size={14} /> Nuevo set
                      </button>
                    </div>
                  </div>

                  {/* Orden de carrusel */}
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3.5 mb-6 flex gap-3">
                    <span className="text-lg flex-shrink-0">📌</span>
                    <div>
                      <p className="text-[11px] font-bold text-amber-800 uppercase tracking-wider mb-1.5">Orden sugerido para el carrusel</p>
                      <div className="flex flex-wrap gap-2">
                        {currentSet.images.map((img, i) => (
                          <div key={i} className="flex items-center gap-1.5 bg-white border border-amber-200 rounded-lg px-2 py-1">
                            <span className="text-[9px] font-black text-amber-700">{i + 1}</span>
                            <span className="text-[10px] text-slate-600">{img.moment}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Tabs */}
                  <div className="flex gap-1 bg-slate-100 p-1 rounded-2xl mb-6 w-fit">
                    {([
                      { id: 'images'   as const, label: 'Imágenes', icon: <ImageIcon size={12} /> },
                      { id: 'captions' as const, label: 'Captions', icon: <BookOpen  size={12} /> },
                      { id: 'hashtags' as const, label: 'Hashtags', icon: <Hash      size={12} /> },
                    ]).map(t => (
                      <button key={t.id} type="button" onClick={() => setActiveResultTab(t.id)}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-bold transition-all ${activeResultTab === t.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                        {t.icon} {t.label}
                      </button>
                    ))}
                  </div>

                  {/* Tab: Imágenes */}
                  {activeResultTab === 'images' && (
                    <div className="space-y-4">
                      {currentSet.images.map((img, i) => {
                        const isExpanded = expandedIdx === i;
                        return (
                          <div key={i} className="bg-white border border-slate-100 rounded-[24px] overflow-hidden shadow-sm">
                            <button type="button" onClick={() => setExpandedIdx(isExpanded ? null : i)}
                              className="w-full flex items-center gap-4 p-4 md:p-5 text-left hover:bg-slate-50 transition-colors">
                              <div className="w-14 h-14 md:w-16 md:h-16 rounded-xl overflow-hidden flex-shrink-0 bg-slate-100 cursor-pointer"
                                onClick={e => { e.stopPropagation(); openLightbox(currentSet.images.map(x => x.imageUrl), i); }}>
                                <img src={img.imageUrl} alt={img.moment} className="w-full h-full object-cover" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  <span className="text-[10px] font-black text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full uppercase tracking-wider">#{i + 1}</span>
                                  <span className="text-[10px] text-slate-500">{img.moment}</span>
                                </div>
                                <p className="text-[13px] text-slate-700 line-clamp-1">{img.caption}</p>
                              </div>
                              <ChevronDown size={16} className={`text-slate-400 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                            </button>
                            {isExpanded && (
                              <div className="border-t border-slate-100 p-4 md:p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div
                                  style={{ aspectRatio: DESTINO_META[currentSet.destino ?? 'feed'].aspectRatio }}
                                  className="rounded-2xl overflow-hidden cursor-pointer group relative"
                                  onClick={() => openLightbox(currentSet.images.map(x => x.imageUrl), i)}>
                                  <img src={img.imageUrl} alt={img.moment} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                                    <Download className="w-4 h-4 text-white" />
                                  </div>
                                </div>
                                <div className="space-y-4">
                                  <div>
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Caption</p>
                                    <div className="flex items-start justify-between gap-2">
                                      <p className="text-[13px] text-slate-800 flex-1 leading-relaxed">{img.caption}</p>
                                      <button type="button" onClick={() => copyText(img.caption, `cap-${i}`)}
                                        className="w-7 h-7 bg-slate-50 hover:bg-brand-50 text-slate-400 hover:text-brand-600 rounded-lg flex items-center justify-center transition-all flex-shrink-0">
                                        {copiedKey === `cap-${i}` ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                                      </button>
                                    </div>
                                  </div>
                                  <div>
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Hashtags</p>
                                    <div className="flex items-start justify-between gap-2">
                                      <p className="text-[11px] text-violet-700 bg-violet-50 rounded-xl px-3 py-2 flex-1 leading-relaxed">{img.hashtags}</p>
                                      <button type="button" onClick={() => copyText(img.hashtags, `ht-${i}`)}
                                        className="w-7 h-7 bg-slate-50 hover:bg-brand-50 text-slate-400 hover:text-brand-600 rounded-lg flex items-center justify-center transition-all flex-shrink-0">
                                        {copiedKey === `ht-${i}` ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                                      </button>
                                    </div>
                                  </div>
                                  <button type="button"
                                    onClick={() => { const a = document.createElement('a'); a.href = img.imageUrl; a.download = `photodump_${i + 1}.png`; a.click(); }}
                                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold transition-colors">
                                    <Download size={13} /> Descargar imagen
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Tab: Captions */}
                  {activeResultTab === 'captions' && (
                    <div className="space-y-3">
                      {currentSet.images.map((img, i) => (
                        <div key={i} className="bg-white border border-slate-100 rounded-2xl p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <span className="text-[10px] font-black text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full uppercase tracking-wider">
                                #{i + 1} · {img.moment}
                              </span>
                              <p className="text-[13px] text-slate-800 mt-2 leading-relaxed">{img.caption}</p>
                            </div>
                            <button type="button" onClick={() => copyText(img.caption, `cap2-${i}`)}
                              className="w-8 h-8 bg-slate-50 hover:bg-brand-50 text-slate-400 hover:text-brand-600 rounded-xl flex items-center justify-center transition-all flex-shrink-0">
                              {copiedKey === `cap2-${i}` ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>
                      ))}
                      <button type="button"
                        onClick={() => copyText(currentSet.images.map((img, i) => `[${i + 1}] ${img.moment}\n${img.caption}`).join('\n\n'), 'all-captions')}
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold transition-colors">
                        {copiedKey === 'all-captions' ? <><Check size={13} /> Copiados</> : <><Copy size={13} /> Copiar todos los captions</>}
                      </button>
                    </div>
                  )}

                  {/* Tab: Hashtags */}
                  {activeResultTab === 'hashtags' && (
                    <div className="space-y-3">
                      {currentSet.images.map((img, i) => (
                        <div key={i} className="bg-white border border-slate-100 rounded-2xl p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">#{i + 1} · {img.moment}</span>
                              <p className="text-[12px] text-violet-700 mt-2 leading-relaxed">{img.hashtags}</p>
                            </div>
                            <button type="button" onClick={() => copyText(img.hashtags, `ht2-${i}`)}
                              className="w-8 h-8 bg-slate-50 hover:bg-brand-50 text-slate-400 hover:text-brand-600 rounded-xl flex items-center justify-center transition-all flex-shrink-0">
                              {copiedKey === `ht2-${i}` ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>
                      ))}
                      <button type="button"
                        onClick={() => copyText(currentSet.images.map(img => img.hashtags).join(' '), 'all-hashtags')}
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-violet-600 hover:bg-violet-700 text-white text-[11px] font-bold transition-colors">
                        {copiedKey === 'all-hashtags' ? <><Check size={13} /> Copiados</> : <><Hash size={13} /> Copiar todos los hashtags</>}
                      </button>
                    </div>
                  )}

                  {/* Footer */}
                  <div className="flex flex-col md:flex-row md:justify-between md:items-center mt-7 pt-5 border-t border-slate-200 gap-2 md:gap-3.5">
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => { resetCreator(); setStep(1); }}
                        className="flex items-center gap-1.5 bg-violet-50 hover:bg-violet-100 border border-violet-200 text-violet-700 rounded-xl px-4 py-3 text-[13px] font-bold transition-colors">
                        <RefreshCw size={14} /> Ajustar y regenerar
                      </button>
                      <button type="button" onClick={resetCreator}
                        className="flex items-center gap-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-4 py-3 text-[13px] font-semibold transition-colors">
                        <Plus size={14} /> Nuevo set
                      </button>
                    </div>
                    <button type="button" onClick={() => setActiveTab('library')}
                      className="flex items-center gap-1.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-600 rounded-xl px-4 py-3 text-[13px] font-semibold transition-colors">
                      <Library size={14} /> Ver biblioteca
                    </button>
                  </div>
                </div>
              )}

            </div>

            {/* ── WIZARD FOOTER ─────────────────────────── */}
            {(step === 1 || step === 2 || step === 3) && (
              <WizardFooter
                onBack={step > 1 ? () => setStep(s => (s - 1) as WizardStep) : undefined}
                onContinue={() => {
                  if (step === 1 && canStep1) setStep(2);
                  else if (step === 2 && canStep2) setStep(3);
                  else if (step === 3 && canStep3) handleGenerate();
                }}
                continueLabel={step === 3 ? `Crear historia visual · ${count} imágenes` : 'Continuar'}
                disabled={
                  (step === 1 && !canStep1) ||
                  (step === 2 && !canStep2) ||
                  (step === 3 && insufficient)
                }
                costInfo={step === 3 ? { cost: imageCreditCost, label: 'Créditos totales' } : undefined}
                loading={isGenerating}
              />
            )}
          </div>
        )}

        {/* ══════════════ BIBLIOTECA ══════════════ */}
        {activeTab === 'library' && (
          <div className="animate-in fade-in duration-500">
            {loadingSets && (
              <div className="flex items-center justify-center py-20">
                <div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            {!loadingSets && sets.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 md:py-32 text-center bg-white rounded-[40px] md:rounded-[56px] border-2 border-dashed border-slate-200">
                <Images className="w-12 h-12 text-slate-200 mb-5" />
                <p className="t-meta mb-2">Biblioteca vacía</p>
                <p className="t-body-sm mb-6">Creá tu primer set para verlo aquí</p>
                <button type="button" onClick={() => setActiveTab('create')}
                  className="flex items-center gap-2 px-6 py-3 bg-brand-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-md hover:bg-brand-700 transition-colors">
                  <Sparkles size={14} /> Crear set
                </button>
              </div>
            )}
            <div className="space-y-6">
              {sets.map(set => (
                <div key={set.id} className="bg-white border border-slate-100 rounded-[36px] overflow-hidden shadow-sm">
                  <div className="p-5 md:p-6 flex items-center justify-between border-b border-slate-100">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">{NARRATIVE_META[set.narrative]?.icon}</span>
                        <p className="font-display font-bold italic text-[16px] text-slate-900 uppercase truncate"
                          style={{ fontFamily: 'Syne, Inter, sans-serif' }}>
                          {NARRATIVE_META[set.narrative]?.label ?? 'Photodump'}
                        </p>
                      </div>
                      <p className="text-[11px] text-slate-400 truncate">{set.basePrompt}</p>
                      <p className="text-[10px] text-slate-300 mt-0.5">
                        {new Date(set.createdAt).toLocaleDateString('es-CL')} · {set.images.length} imágenes
                        {set.destino && ` · ${DESTINO_META[set.destino]?.label}`}
                      </p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0 ml-4">
                      <button type="button" onClick={() => downloadSetZip(set)}
                        className="w-9 h-9 bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded-xl flex items-center justify-center transition-all">
                        <Download className="w-4 h-4" />
                      </button>
                      <button type="button"
                        onClick={async () => { setDeletingId(set.id); await photodumpStorage.delete(set.id); await loadSets(); setDeletingId(null); }}
                        disabled={deletingId === set.id}
                        className="w-9 h-9 bg-rose-50 hover:bg-rose-100 text-rose-400 hover:text-rose-600 rounded-xl flex items-center justify-center transition-all disabled:opacity-40">
                        {deletingId === set.id
                          ? <div className="w-3.5 h-3.5 border-2 border-rose-400 border-t-transparent rounded-full animate-spin" />
                          : <Trash2 className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 p-3">
                    {set.images.map((img, i) => (
                      <div key={i}
                        style={{ aspectRatio: set.destino ? DESTINO_META[set.destino]?.aspectRatio : '3/4' }}
                        className="rounded-2xl overflow-hidden cursor-pointer group relative"
                        onClick={() => openLightbox(set.images.map(x => x.imageUrl), i)}>
                        <img src={img.imageUrl} alt={img.moment} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="absolute bottom-1 left-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="bg-white/90 rounded-lg px-1.5 py-0.5">
                            <p className="text-[8px] font-black text-slate-900 uppercase truncate">{img.moment}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {lightboxOpen && lightboxImages.length > 0 && (
        <ImageLightbox
          images={lightboxImages}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxOpen(false)}
          onDownload={(url, idx) => { const a = document.createElement('a'); a.href = url; a.download = `photodump_${idx + 1}.png`; a.click(); }}
          metadata={{ label: 'Photodump' }}
        />
      )}
    </>
  );
};

export default PhotodumpModule;
