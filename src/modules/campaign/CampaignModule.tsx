/**
 * CampaignModule.tsx — REDISEÑO
 * Alineado al sistema de diseño de ProductGeneratorModule:
 * - bg-slate-50 + tarjeta blanca principal
 * - WizardStepper + WizardFooter compartidos
 * - Layout 2 col: configuración izq / panel de costo sticky der (paso 4)
 * - Step 5: live grid de thumbnails idéntico a Step5Generating
 * - Step 6: grid asimétrico de resultados con texto copiable
 * - Tab "Crear" / "Biblioteca" en el header
 */
import React, { useState, useEffect } from 'react';
import {
  Megaphone, Download, Zap, Check, Sparkles,
  Library, Trash2, Copy, ChevronRight, RefreshCw,
  Target, Users, LayoutGrid, AlertTriangle, Plus,
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
import { WizardStepper } from '../../components/shared/WizardStepper';
import { WizardFooter } from '../../components/shared/WizardFooter';
import { GenerationProgress as GenProgress, type ProgressStep } from '../../components/shared/GenerationProgress';

// ─── Wizard steps ────────────────────────────────────────────────────────────
type WizardStep = 1 | 2 | 3 | 4 | 5 | 6;

const WIZARD_STEP_DEFS = [
  { id: '1', label: 'Brief' },
  { id: '2', label: 'Campaña' },
  { id: '3', label: 'Cantidad' },
  { id: '4', label: 'Generar' },
  { id: '5', label: 'Resultados' },
];

// ─── Progress steps narrados ─────────────────────────────────────────────────
const CAMPAIGN_PROGRESS_STEPS: ProgressStep[] = [
  { id: 'brief',    label: 'Analizando brief con el director creativo' },
  { id: 'scenes',   label: 'Construyendo guión de escenas' },
  { id: 'generate', label: 'Generando imágenes de campaña' },
  { id: 'copy',     label: 'Redactando captions y titulares' },
  { id: 'done',     label: 'Campaña lista' },
];

// ─── Colores por tipo de campaña ─────────────────────────────────────────────
const TYPE_COLORS: Record<CampaignType, { bg: string; border: string; text: string; activeBg: string; activeBorder: string }> = {
  product:   { bg: 'bg-brand-50',   border: 'border-brand-100',   text: 'text-brand-600',   activeBg: 'bg-brand-50',   activeBorder: 'border-brand-600' },
  brand:     { bg: 'bg-violet-50',  border: 'border-violet-100',  text: 'text-violet-600',  activeBg: 'bg-violet-50',  activeBorder: 'border-violet-600' },
  social:    { bg: 'bg-indigo-50',  border: 'border-indigo-100',  text: 'text-indigo-600',  activeBg: 'bg-indigo-50',  activeBorder: 'border-indigo-600' },
  ecommerce: { bg: 'bg-emerald-50', border: 'border-emerald-100', text: 'text-emerald-600', activeBg: 'bg-emerald-50', activeBorder: 'border-emerald-600' },
};

// ─── UpgradeWall ─────────────────────────────────────────────────────────────
const UpgradeWall: React.FC<{ proCredits: number }> = ({ proCredits }) => {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-8 px-4">
      <div className="w-20 h-20 bg-brand-50 border border-brand-100 rounded-[28px] flex items-center justify-center">
        <Megaphone className="w-10 h-10 text-brand-600" />
      </div>
      <div className="space-y-2 max-w-sm">
        <h2 className="t-display text-3xl text-slate-900">Campaign Generator</h2>
        <p className="t-body leading-relaxed">
          {proCredits === 0
            ? 'Agotaste tus sesiones Campaign de este período. Comprá pro-credits extra o actualizá tu plan.'
            : 'Necesitás pro-credits para usar Campaign Generator. Cada sesión consume 1 pro-credit.'}
        </p>
      </div>
      <div className="bg-slate-50 border border-slate-200 rounded-[28px] p-6 space-y-3 max-w-xs w-full">
        <p className="t-meta">Tus pro-credits</p>
        <p className="t-display text-5xl text-slate-900">{proCredits}</p>
        <p className="t-body-sm">1 pro-credit = 1 sesión Campaign completa</p>
      </div>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <button
          onClick={() => navigate('/buy-credits')}
          className="w-full py-4 bg-brand-600 hover:bg-brand-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg"
        >
          Comprar pro-credits
        </button>
        <button
          onClick={() => navigate('/pricing')}
          className="w-full py-3 bg-white border border-slate-200 hover:border-slate-300 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest transition-all"
        >
          Ver planes
        </button>
      </div>
    </div>
  );
};

// ─── Componente principal ─────────────────────────────────────────────────────
const CampaignModule: React.FC = () => {
  const { user, credits, isAdmin, deductCredits, refreshCredits, proCredits, deductProCredit, refundProCredit } = useAuth();

  // ── State: brief
  const [basePrompt,         setBasePrompt]         = useState('');
  const [productDescription, setProductDescription] = useState('');
  const [campaignType,       setCampaignType]        = useState<CampaignType>('product');
  const [objective,          setObjective]           = useState<CampaignObjective>('sell');
  const [audience,           setAudience]            = useState<CampaignAudience>('general');
  const [imageCount,         setImageCount]          = useState(4);

  // ── State: wizard
  const [step,         setStep]         = useState<WizardStep>(1);
  const [activeTab,    setActiveTab]    = useState<'create' | 'library'>('create');

  // ── State: generation
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress,     setProgress]     = useState<GenerationProgress | null>(null);
  const [progressStepIndex, setProgressStepIndex] = useState(0);
  const [error,        setError]        = useState<string | null>(null);
  const [currentSet,   setCurrentSet]   = useState<CampaignSet | null>(null);

  // ── State: library
  const [sets,        setSets]        = useState<CampaignSet[]>([]);
  const [loadingSets, setLoadingSets] = useState(false);
  const [deletingId,  setDeletingId]  = useState<string | null>(null);

  // ── State: UI
  const [lightboxOpen,   setLightboxOpen]   = useState(false);
  const [lightboxIndex,  setLightboxIndex]  = useState(0);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [copiedKey,      setCopiedKey]      = useState<string | null>(null);

  const hasProCredits  = isAdmin || proCredits > 0;
  const imageCreditCost = imageCount * 2;
  const totalCost       = imageCreditCost; // créditos normales (el pro-credit se cobra aparte)
  const creditsAfter    = Math.max(0, (credits?.available ?? 0) - totalCost);
  const insufficient    = !isAdmin && (credits?.available ?? 0) < totalCost;

  // ── Validaciones por paso
  const canStep1 = basePrompt.trim().length >= 3;
  const canStep2 = true; // tipo/obj/audiencia ya tienen defaults
  const canStep3 = !insufficient;

  // ── Load sets
  const loadSets = async () => {
    setLoadingSets(true);
    const all = await campaignStorage.list();
    setSets(all);
    setLoadingSets(false);
  };
  useEffect(() => { loadSets(); }, []);

  // ── Copy text
  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // ── Download helpers
  const downloadImage = (url: string, idx: number) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = `campaign_${idx + 1}.png`;
    a.click();
  };

  const downloadSetZip = async (set: CampaignSet) => {
    await downloadAsZip(
      set.images.map(i => i.imageUrl),
      `campaign_${set.id.slice(-6)}.zip`,
      'campaign',
    );
  };

  // ── Lightbox
  const openLightbox = (images: string[], idx: number) => {
    setLightboxImages(images);
    setLightboxIndex(idx);
    setLightboxOpen(true);
  };

  // ── Reset
  const resetCreator = () => {
    setStep(1);
    setCurrentSet(null);
    setError(null);
    setProgress(null);
    setProgressStepIndex(0);
    setIsGenerating(false);
  };

  // ── Generate
  const handleGenerate = async () => {
    if (!hasProCredits) return;

    if (!isAdmin) {
      const ok = await deductProCredit();
      if (!ok) { setError('No tenés pro-credits para esta sesión.'); return; }
    }

    if (!isAdmin && (credits?.available ?? 0) < imageCreditCost) {
      if (!isAdmin) await refundProCredit();
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

    setStep(4);
    setIsGenerating(true);
    setError(null);
    setCurrentSet(null);
    setProgress({ total: imageCount, completed: 0, current: 0 });
    setProgressStepIndex(0);

    try {
      // Paso 1: construir escenas
      setProgressStepIndex(1);
      const scenes = await buildCampaignScenes(
        basePrompt, productDescription, campaignType, objective, audience, imageCount,
      );

      // Paso 2: armar prompts
      setProgressStepIndex(2);
      const campaignPrompts = scenes.map(s =>
        `${basePrompt}, ${s.scenePrompt}, same person same identity same face, consistent character`,
      );

      // Paso 3: generar imágenes
      const images = await generationService.generateBatch(
        campaignPrompts,
        [],
        undefined,
        (p) => {
          setProgress(p);
          if (p.completed === p.total) setProgressStepIndex(3);
        },
        {
          uid: user?.uid,
          sessionId: newSessionId(),
          module: 'campaign',
          moduleLabel: 'Campaign Generator',
          metadata: { campaignType, objective, audience, scenes: imageCount },
        },
      );

      // Paso 4: captions listos (vienen de buildCampaignScenes)
      setProgressStepIndex(4);

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
        images: images.map((url, i) => ({
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
      setStep(5);
      await refreshCredits();
    } catch (err: any) {
      setError(err?.message || 'Error generando la campaña.');
      if (!isAdmin) {
        await refundProCredit();
        await deductCredits(-imageCreditCost);
        await refreshCredits();
      }
      setStep(3);
    } finally {
      setIsGenerating(false);
      setProgress(null);
    }
  };

  // ── Delete from library
  const deleteSet = async (id: string) => {
    setDeletingId(id);
    await campaignStorage.delete(id).catch(console.error);
    await loadSets();
    setDeletingId(null);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="max-w-7xl mx-auto pb-20 animate-in fade-in duration-500">

        {/* ── HEADER ────────────────────────────────────────────── */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-5 px-1 mb-6 md:mb-8">
          <div>
            <h1 className="t-display text-3xl text-slate-900">
              Campaign <span className="text-brand-600">Generator</span>
            </h1>
            <div className="flex items-center gap-2 mt-2">
              <p className="text-slate-500 font-medium italic text-xs md:text-sm">
                Director creativo IA · Brief → Escenas → Imágenes + Copy
              </p>
              <ModuleTutorial moduleId="campaignMode" steps={TUTORIAL_CONFIGS.campaignMode} />
            </div>
          </div>

          {/* Tabs + indicadores */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Pro-credits indicator */}
            <div className="flex items-center gap-1.5 bg-brand-50 border border-brand-100 rounded-2xl px-3 py-2">
              <Zap className="w-3.5 h-3.5 text-brand-600" />
              <span className="text-xs font-black text-brand-700">{isAdmin ? '∞' : proCredits}</span>
              <span className="t-meta text-brand-500">sesiones</span>
            </div>

            {/* Tab switcher */}
            <div className="flex bg-white p-1 rounded-2xl shadow-sm border border-slate-100 gap-1">
              <button
                onClick={() => { setActiveTab('create'); resetCreator(); window.scrollTo(0, 0); }}
                className={`px-5 md:px-8 py-2 md:py-3 rounded-xl t-meta transition-colors duration-150 ${
                  activeTab === 'create'
                    ? 'bg-brand-600 text-white shadow-lg'
                    : 'text-slate-400 hover:text-slate-700'
                }`}
              >
                Crear
              </button>
              <button
                onClick={() => { setActiveTab('library'); window.scrollTo(0, 0); }}
                className={`px-5 md:px-8 py-2 md:py-3 rounded-xl t-meta transition-colors duration-150 ${
                  activeTab === 'library'
                    ? 'bg-brand-600 text-white shadow-lg'
                    : 'text-slate-400 hover:text-slate-700'
                }`}
              >
                Biblioteca ({sets.length})
              </button>
            </div>
          </div>
        </header>

        {/* ── SIN PRO-CREDITS ───────────────────────────────────── */}
        {!hasProCredits && activeTab === 'create' && (
          <div className="bg-white rounded-[28px] md:rounded-[36px] shadow-sm border border-slate-100 overflow-hidden">
            <UpgradeWall proCredits={proCredits} />
          </div>
        )}

        {/* ══════════════ WIZARD (CREAR) ══════════════ */}
        {hasProCredits && activeTab === 'create' && (
          <div className="bg-white rounded-[28px] md:rounded-[36px] shadow-sm border border-slate-100 overflow-hidden flex flex-col min-h-[640px]">
            <WizardStepper
              steps={WIZARD_STEP_DEFS}
              current={step}
              onJump={(s) => {
                const n = Number(s) as WizardStep;
                if (n < step && !isGenerating) setStep(n);
              }}
            />

            <div className="flex-1 overflow-auto">

              {/* ── PASO 1: BRIEF ──────────────────────────────── */}
              {step === 1 && (
                <div className="fade-in p-4 md:p-8">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-9 items-start">

                    {/* LEFT — copy + form */}
                    <div className="md:col-span-6 order-2 md:order-1">
                      <div className="text-[10px] font-black text-brand-600 uppercase tracking-[0.18em]">
                        Paso 1 · Brief
                      </div>
                      <h2 className="t-display text-[28px] md:text-[34px] text-slate-900 mt-2.5 leading-[1.05]">
                        ¿Sobre qué es{' '}
                        <span className="text-brand-600 italic normal-case">la campaña?</span>
                      </h2>
                      <p className="text-sm text-slate-500 mt-2 leading-[1.55] max-w-[520px]">
                        Describí el sujeto principal que protagoniza la campaña. Puede ser una persona, un producto o un concepto visual. Cuanto más específico, mejor resultado.
                      </p>

                      <div className="mt-6 flex flex-col gap-4">
                        {/* Prompt base */}
                        <div>
                          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-[0.12em] mb-2">
                            Sujeto principal <span className="text-brand-600">*</span>
                          </label>
                          <textarea
                            value={basePrompt}
                            onChange={e => setBasePrompt(e.target.value)}
                            placeholder="Ej: Sofía, mujer latina 28 años, pelo oscuro, ropa casual moderna, luz natural"
                            rows={3}
                            autoComplete="off"
                            autoCapitalize="sentences"
                            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3.5 text-[15px] text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 transition-all resize-none leading-relaxed"
                          />
                          <p className="text-[11px] text-slate-400 mt-1.5">
                            Describe la persona, producto o concepto visual del protagonista de tu campaña.
                          </p>
                        </div>

                        {/* Producto */}
                        <div>
                          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-[0.12em] mb-2">
                            Producto o servicio{' '}
                            <span className="text-slate-400 font-medium normal-case tracking-normal">(opcional pero recomendado)</span>
                          </label>
                          <textarea
                            value={productDescription}
                            onChange={e => setProductDescription(e.target.value)}
                            placeholder="Ej: Crema hidratante con ácido hialurónico, frasco 50ml, línea premium, envase blanco con tapa dorada..."
                            rows={2}
                            autoComplete="off"
                            autoCapitalize="sentences"
                            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 transition-all resize-y leading-relaxed"
                          />
                        </div>
                      </div>
                    </div>

                    {/* RIGHT — orientación + tips */}
                    <div className="md:col-span-6 order-1 md:order-2">
                      <div className="text-[11px] font-bold text-slate-500 uppercase tracking-[0.12em] mb-3">
                        Guía de brief
                      </div>

                      {/* Ejemplos de buenos briefs */}
                      <div className="space-y-3">
                        {[
                          {
                            tag: 'Moda',
                            color: 'text-violet-600',
                            bg: 'bg-violet-50',
                            prompt: 'Mujer 25 años, pelo corto, outfits de verano, piel bronceada',
                            product: 'Línea de ropa casual femenina con estampados florales',
                          },
                          {
                            tag: 'Cosmética',
                            color: 'text-brand-600',
                            bg: 'bg-brand-50',
                            prompt: 'Mujer latina 30 años, piel clara, manos y rostro visibles',
                            product: 'Sérum antienvejecimiento con vitamina C, frasco 30ml, premium',
                          },
                          {
                            tag: 'E-commerce',
                            color: 'text-emerald-600',
                            bg: 'bg-emerald-50',
                            prompt: 'Producto sobre superficie de mármol, iluminación de estudio',
                            product: 'Bolso mini de cuero sintético negro, asas metálicas doradas',
                          },
                        ].map(ex => (
                          <button
                            key={ex.tag}
                            type="button"
                            onClick={() => {
                              setBasePrompt(ex.prompt);
                              setProductDescription(ex.product);
                            }}
                            className="w-full text-left bg-white border border-slate-200 hover:border-slate-300 rounded-2xl p-4 transition-all hover:shadow-sm group"
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${ex.bg} ${ex.color}`}>
                                {ex.tag}
                              </span>
                              <span className="text-[10px] text-slate-400 group-hover:text-brand-600 transition-colors">
                                Usar este ejemplo →
                              </span>
                            </div>
                            <p className="text-[12px] font-semibold text-slate-700 leading-snug">{ex.prompt}</p>
                            <p className="text-[11px] text-slate-400 mt-1 leading-snug">{ex.product}</p>
                          </button>
                        ))}
                      </div>

                      <div className="mt-4 px-3.5 py-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 leading-[1.5]">
                        💡 Podés tocar cualquier ejemplo para cargarlo y modificarlo. Son puntos de partida, no recetas.
                      </div>
                    </div>

                  </div>
                </div>
              )}

              {/* ── PASO 2: TIPO DE CAMPAÑA + OBJETIVO + AUDIENCIA ─ */}
              {step === 2 && (
                <div className="fade-in p-4 md:p-8">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-9 items-start">

                    <div className="md:col-span-7">
                      <div className="text-[10px] font-black text-brand-600 uppercase tracking-[0.18em]">
                        Paso 2 · Tipo de campaña
                      </div>
                      <h2 className="t-display text-[28px] md:text-[34px] text-slate-900 mt-2.5 leading-[1.05]">
                        ¿Qué tipo de{' '}
                        <span className="text-brand-600 italic normal-case">contenido generamos?</span>
                      </h2>
                      <p className="text-sm text-slate-500 mt-2 leading-[1.55] max-w-[520px]">
                        Esto define la secuencia de escenas, el encuadre y el mood. La IA construirá el guión
                        adaptado a cada tipo.
                      </p>

                      {/* Tipo de campaña */}
                      <div className="mt-6 mb-5">
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-[0.12em] mb-3">
                          <LayoutGrid className="inline w-3.5 h-3.5 mr-1.5" />
                          Tipo de campaña
                        </label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {(Object.keys(CAMPAIGN_TYPE_META) as CampaignType[]).map(t => {
                            const sel = campaignType === t;
                            const col = TYPE_COLORS[t];
                            return (
                              <button
                                key={t}
                                type="button"
                                onClick={() => setCampaignType(t)}
                                className={`relative bg-white rounded-[18px] p-0 text-left overflow-hidden transition-all border ${
                                  sel
                                    ? `border-2 ${col.activeBorder} shadow-[0_16px_40px_rgba(0,0,0,0.10)]`
                                    : 'border border-slate-200 hover:border-slate-300 hover:shadow-sm'
                                }`}
                              >
                                {/* Preview band */}
                                <div className={`h-[80px] flex items-center justify-center text-4xl ${col.bg}`}>
                                  {CAMPAIGN_TYPE_META[t].icon}
                                </div>
                                {/* Body */}
                                <div className="p-3.5 flex items-start gap-3">
                                  <div className="flex-1">
                                    <div className="t-display text-[15px] text-slate-900 normal-case italic leading-tight mb-1">
                                      {CAMPAIGN_TYPE_META[t].label}
                                    </div>
                                    <div className="text-[12px] text-slate-500 leading-snug normal-case">
                                      {CAMPAIGN_TYPE_META[t].description}
                                    </div>
                                  </div>
                                  <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all mt-0.5 ${
                                    sel ? `${col.activeBg.replace('50','600').replace('bg-','bg-')} text-white border-0` : 'bg-white border-2 border-slate-200'
                                  }`}
                                  style={sel ? { background: col.activeBorder.replace('border-','').replace('-600','') === 'brand' ? '#F72C5B' : undefined } : undefined}
                                  >
                                    {sel && <Check size={11} strokeWidth={3} />}
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* RIGHT: objetivo + audiencia */}
                    <div className="md:col-span-5 space-y-5">
                      {/* Objetivo */}
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-[0.12em] mb-3">
                          <Target className="inline w-3.5 h-3.5 mr-1.5" />
                          Objetivo de la campaña
                        </label>
                        <div className="grid grid-cols-1 gap-2">
                          {(Object.keys(CAMPAIGN_OBJECTIVE_META) as CampaignObjective[]).map(o => {
                            const sel = objective === o;
                            const ICONS: Record<CampaignObjective, string> = {
                              sell: '💰', awareness: '✨', launch: '🚀', engagement: '❤️',
                            };
                            return (
                              <button
                                key={o}
                                type="button"
                                onClick={() => setObjective(o)}
                                className={`flex items-center gap-3 p-3.5 rounded-2xl border text-left transition-all ${
                                  sel
                                    ? 'border-2 border-violet-600 bg-violet-50'
                                    : 'border border-slate-200 bg-white hover:border-slate-300'
                                }`}
                              >
                                <span className="text-lg flex-shrink-0">{ICONS[o]}</span>
                                <div className="flex-1">
                                  <div className={`text-[13px] font-bold ${sel ? 'text-violet-900' : 'text-slate-700'}`}>
                                    {CAMPAIGN_OBJECTIVE_META[o]}
                                  </div>
                                </div>
                                <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                                  sel ? 'bg-violet-600 text-white' : 'border-2 border-slate-200'
                                }`}>
                                  {sel && <Check size={10} strokeWidth={3} />}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Audiencia */}
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-[0.12em] mb-3">
                          <Users className="inline w-3.5 h-3.5 mr-1.5" />
                          Audiencia objetivo
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {(Object.keys(CAMPAIGN_AUDIENCE_META) as CampaignAudience[]).map(a => (
                            <button
                              key={a}
                              type="button"
                              onClick={() => setAudience(a)}
                              className={`px-3.5 py-2.5 rounded-2xl text-[11px] font-bold transition-all ${
                                audience === a
                                  ? 'bg-slate-900 text-white'
                                  : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'
                              }`}
                            >
                              {CAMPAIGN_AUDIENCE_META[a]}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── PASO 3: CANTIDAD + COSTO ───────────────────── */}
              {step === 3 && (
                <div className="fade-in p-4 md:p-8">
                  <div className="grid grid-cols-1 md:grid-cols-[1fr_320px] gap-5 md:gap-6 items-start">

                    {/* LEFT: config */}
                    <div>
                      <div className="text-[10px] font-black text-brand-600 uppercase tracking-[0.18em]">
                        Paso 3 · Cantidad
                      </div>
                      <h2 className="t-display text-[28px] md:text-[34px] text-slate-900 mt-2.5 leading-[1.05]">
                        ¿Cuántas imágenes{' '}
                        <span className="text-brand-600 italic normal-case">genera la campaña?</span>
                      </h2>
                      <p className="text-sm text-slate-500 mt-2 leading-[1.55] max-w-[540px]">
                        La IA planifica una secuencia narrativa coherente. Cada imagen es una escena distinta con
                        su propio encuadre, dirección y copy de anuncio.
                      </p>

                      {/* Cantidad */}
                      <div className="mt-6 mb-6 bg-white border border-slate-200 rounded-2xl p-4 md:p-[18px]">
                        <div className="text-[11px] font-bold text-slate-500 uppercase tracking-[0.12em] mb-3">
                          Imágenes de campaña
                        </div>
                        <div className="flex gap-2.5">
                          {([3, 4, 5] as const).map(n => (
                            <button
                              key={n}
                              type="button"
                              onClick={() => setImageCount(n)}
                              className={`flex-1 py-5 rounded-2xl flex flex-col items-center gap-0.5 transition-all ${
                                imageCount === n
                                  ? 'bg-slate-900 text-white'
                                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                              }`}
                            >
                              <span className="text-xl font-bold">{n}</span>
                              <span className="text-[10px] font-medium opacity-65">imágenes</span>
                            </button>
                          ))}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-3 leading-[1.5]">
                          Incluye: imágenes generadas + captions de RRSS + titulares de anuncio. Todo listo para publicar.
                        </p>
                      </div>

                      {/* Pro-credit notice */}
                      <div className="rounded-2xl p-4 bg-brand-50 border border-brand-100">
                        <div className="flex items-start gap-3">
                          <Zap className="w-4 h-4 text-brand-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-[12px] font-bold text-brand-900 mb-0.5">1 pro-credit por sesión</p>
                            <p className="text-[11px] text-brand-700 leading-[1.5]">
                              Cada campaña consume 1 pro-credit + {imageCreditCost} créditos para las imágenes.
                              Tenés <strong>{isAdmin ? '∞' : proCredits} sesiones</strong> disponibles.
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Warning de créditos bajos */}
                      {!isAdmin && proCredits <= 3 && proCredits > 0 && (
                        <div className="mt-3 rounded-2xl p-4 bg-amber-50 border border-amber-200 flex items-center gap-3">
                          <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                          <p className="text-[12px] text-amber-800 font-medium">
                            Te quedan <strong>{proCredits} sesiones</strong> Campaign este período.
                          </p>
                        </div>
                      )}

                      {/* Error */}
                      {error && (
                        <div className="mt-3 p-4 bg-rose-50 border border-rose-200 rounded-2xl text-[12px] text-rose-700 font-medium flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                          {error}
                        </div>
                      )}
                    </div>

                    {/* RIGHT: cost panel (sticky) */}
                    <div className="md:sticky md:top-4">
                      {/* Cost panel — idéntico a Step4Type de ProductGenerator */}
                      <div className="relative bg-slate-900 text-white rounded-2xl p-5 md:p-5.5 overflow-hidden">
                        <div
                          className="absolute -top-10 -right-10 w-[140px] h-[140px] rounded-full pointer-events-none"
                          style={{ background: 'rgba(124,58,237,0.3)', filter: 'blur(40px)' }}
                        />
                        <div className="relative">
                          <div className="text-[10px] font-bold text-pink-300 uppercase tracking-[0.14em] mb-3.5">
                            Resumen del costo
                          </div>

                          <div className="flex flex-col gap-2 mb-3.5 text-[13px]">
                            <div className="flex justify-between">
                              <span className="opacity-70">Tipo</span>
                              <span className="font-semibold">{CAMPAIGN_TYPE_META[campaignType].label.split(' ')[0]}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="opacity-70">Objetivo</span>
                              <span className="font-semibold">{CAMPAIGN_OBJECTIVE_META[objective].split(' / ')[0]}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="opacity-70">Imágenes</span>
                              <span className="font-semibold">{imageCount}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="opacity-70">Sesión</span>
                              <span className="font-semibold">1 pro-credit</span>
                            </div>
                            <div className="h-px bg-white/10 my-1.5" />
                            <div className="flex justify-between items-baseline">
                              <span className="opacity-85 text-[13px]">Créditos</span>
                              <span
                                className="font-display font-extrabold italic text-[36px] tracking-tight leading-none"
                                style={{ fontFamily: 'Syne, Inter, sans-serif' }}
                              >
                                {totalCost}{' '}
                                <span className="text-sm opacity-70 font-semibold not-italic tracking-normal">cr</span>
                              </span>
                            </div>
                          </div>

                          <div className={`text-[11px] leading-[1.5] ${insufficient ? 'text-rose-300' : 'opacity-70'}`}>
                            {insufficient
                              ? <><strong>Créditos insuficientes.</strong> Te faltan {totalCost - (credits?.available ?? 0)} cr.</>
                              : <>Te quedarán {creditsAfter} cr después de esta campaña.</>
                            }
                          </div>
                        </div>
                      </div>

                      {/* Safety note */}
                      <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2.5 text-[11.5px] text-emerald-900 leading-[1.55] mt-3">
                        <strong>Sin sorpresas.</strong> Solo se descuenta si la generación se completa. Reembolso automático si falla.
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── PASO 4: GENERANDO ───────────────────────────── */}
              {step === 4 && (
                <div className="fade-in p-4 md:p-8">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-5 md:gap-7 items-start">

                    {/* LEFT: progress narrado */}
                    <div className="md:col-span-5 lg:col-span-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-2 h-2 rounded-full bg-brand-600 animate-pulse" />
                        <span className="text-[10px] font-black text-brand-600 uppercase tracking-[0.18em]">
                          Generando · no cierres esta ventana
                        </span>
                      </div>
                      <h2
                        className="font-display font-extrabold italic uppercase tracking-tight text-[24px] md:text-[28px] text-slate-900 leading-tight"
                        style={{ fontFamily: 'Syne, Inter, sans-serif', letterSpacing: '-0.025em' }}
                      >
                        {basePrompt.length > 40 ? basePrompt.slice(0, 40) + '...' : basePrompt}
                      </h2>
                      <div className="text-[13px] text-slate-500 mt-1 mb-4">
                        {imageCount} {imageCount === 1 ? 'imagen' : 'imágenes'} · {CAMPAIGN_TYPE_META[campaignType].label}
                      </div>

                      <div className="bg-white border border-slate-200 rounded-2xl p-4 md:p-[18px]">
                        <GenProgress
                          steps={CAMPAIGN_PROGRESS_STEPS}
                          currentStepIndex={progressStepIndex}
                          completedShots={[]}
                          totalShots={0}
                        />
                      </div>

                      <div className="mt-3 px-3.5 py-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 leading-[1.5]">
                        💡 Podés cerrar la ventana — te avisamos cuando termine.
                      </div>
                    </div>

                    {/* RIGHT: live grid */}
                    <div className="md:col-span-7 lg:col-span-8">
                      <div className="flex justify-between items-baseline mb-3.5">
                        <div>
                          <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.14em] mb-1">
                            En vivo
                          </div>
                          <h3
                            className="font-display font-extrabold italic text-[20px] md:text-[22px] text-slate-900 normal-case"
                            style={{ fontFamily: 'Syne, Inter, sans-serif' }}
                          >
                            {progress ? progress.completed : 0} de {imageCount} listas
                          </h3>
                        </div>
                      </div>

                      <div className={`grid gap-3 ${
                        imageCount <= 3
                          ? 'grid-cols-3'
                          : imageCount <= 4
                          ? 'grid-cols-2 md:grid-cols-4'
                          : 'grid-cols-3 md:grid-cols-5'
                      }`}>
                        {Array.from({ length: imageCount }).map((_, i) => {
                          const done   = progress ? i < progress.completed : false;
                          const active = progress ? i === progress.completed && isGenerating : false;
                          return (
                            <div
                              key={i}
                              className={`relative aspect-[3/4] rounded-2xl overflow-hidden transition-all ${
                                done
                                  ? 'fade-in shadow-md'
                                  : active
                                  ? 'border-2 border-brand-600 bg-slate-100 animate-pulse'
                                  : 'bg-slate-100'
                              }`}
                            >
                              {active && (
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <div className="bg-white/95 rounded-full px-3.5 py-1.5 text-[10px] font-bold text-brand-600 tracking-[0.12em] uppercase">
                                    EN VIVO
                                  </div>
                                </div>
                              )}
                              {done && (
                                <div className="absolute inset-0 bg-gradient-to-br from-brand-50 to-violet-50 flex items-center justify-center">
                                  <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center">
                                    <Check className="w-4 h-4 text-white" strokeWidth={3} />
                                  </div>
                                </div>
                              )}
                              {!done && !active && (
                                <div className="absolute top-2 left-2 text-[10px] text-slate-400 font-semibold">
                                  {i + 1}
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

              {/* ── PASO 5: RESULTADOS ──────────────────────────── */}
              {step === 5 && currentSet && (
                <div className="fade-in p-4 md:p-8">

                  {/* Resultado header */}
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                    <div>
                      <div className="flex items-center gap-2.5 mb-2 flex-wrap">
                        <div className="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                          <Check size={14} strokeWidth={3} />
                        </div>
                        <span className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.18em]">
                          Campaña lista · {currentSet.images.length} imágenes
                        </span>
                      </div>
                      <h2
                        className="font-display font-extrabold italic uppercase tracking-tight text-[28px] md:text-[34px] text-slate-900 leading-[1.05]"
                        style={{ fontFamily: 'Syne, Inter, sans-serif', letterSpacing: '-0.025em' }}
                      >
                        Tu campaña está{' '}
                        <span className="text-brand-600 italic normal-case">lista.</span>
                      </h2>
                    </div>

                    <div className="flex gap-2 w-full md:w-auto flex-wrap">
                      <button
                        type="button"
                        onClick={() => downloadSetZip(currentSet)}
                        className="flex-1 md:flex-none flex items-center justify-center gap-1.5 bg-white border border-slate-200 hover:border-slate-300 rounded-xl px-3.5 md:px-4 py-2.5 md:py-3 text-xs font-semibold text-slate-700 transition-colors"
                      >
                        <Download size={14} />
                        Descargar ZIP
                      </button>
                      <button
                        type="button"
                        onClick={resetCreator}
                        className="flex-1 md:flex-none flex items-center justify-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl px-3.5 md:px-4 py-2.5 md:py-3 text-xs font-semibold transition-colors"
                      >
                        <Plus size={14} />
                        Nueva campaña
                      </button>
                    </div>
                  </div>

                  {/* Grid de imágenes + copy */}
                  <div className={`grid gap-4 ${
                    currentSet.images.length >= 4
                      ? 'grid-cols-1 md:grid-cols-2'
                      : 'grid-cols-1 md:grid-cols-3'
                  }`}>
                    {currentSet.images.map((img, i) => (
                      <div
                        key={i}
                        className="bg-white border border-slate-100 rounded-[28px] overflow-hidden shadow-sm"
                      >
                        {/* Imagen */}
                        <div
                          className="relative aspect-[4/3] cursor-pointer group"
                          onClick={() => openLightbox(currentSet.images.map(x => x.imageUrl), i)}
                        >
                          <img
                            src={img.imageUrl}
                            alt={img.sceneName}
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                          />
                          {/* Hover overlay */}
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                            <button
                              type="button"
                              onClick={e => { e.stopPropagation(); downloadImage(img.imageUrl, i); }}
                              className="bg-white/20 backdrop-blur-md text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-1.5 hover:bg-white/30"
                            >
                              <Download className="w-3.5 h-3.5" /> Descargar
                            </button>
                          </div>
                          {/* Scene label */}
                          <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-lg">
                            <p className="text-[9px] font-black text-white uppercase tracking-wider">{img.sceneName}</p>
                          </div>
                          {/* Scene number */}
                          <div className="absolute top-3 right-3 bg-white/90 text-slate-900 px-2 py-1 rounded-lg">
                            <p className="text-[9px] font-black uppercase tracking-wider">
                              {i === 0 && currentSet.images.length >= 3 ? 'Hero' : `Shot ${i + 1}`}
                            </p>
                          </div>
                        </div>

                        {/* Copy section */}
                        <div className="p-4 md:p-5 space-y-3.5">
                          {/* Titular */}
                          <div className="space-y-1.5">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                              Titular de anuncio
                            </p>
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-[13px] font-bold text-slate-800 flex-1 leading-snug">{img.adCopy}</p>
                              <button
                                type="button"
                                onClick={() => copyText(img.adCopy, `ad-${i}`)}
                                className="w-7 h-7 bg-slate-50 hover:bg-brand-50 text-slate-400 hover:text-brand-600 rounded-lg flex items-center justify-center transition-all flex-shrink-0"
                                title="Copiar titular"
                              >
                                {copiedKey === `ad-${i}`
                                  ? <Check className="w-3 h-3 text-emerald-500" />
                                  : <Copy className="w-3 h-3" />
                                }
                              </button>
                            </div>
                          </div>

                          {/* Divisor */}
                          <div className="h-px bg-slate-100" />

                          {/* Caption */}
                          <div className="space-y-1.5">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                              Caption para RRSS
                            </p>
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-[12px] text-slate-500 flex-1 leading-relaxed">{img.caption}</p>
                              <button
                                type="button"
                                onClick={() => copyText(img.caption, `cap-${i}`)}
                                className="w-7 h-7 bg-slate-50 hover:bg-brand-50 text-slate-400 hover:text-brand-600 rounded-lg flex items-center justify-center transition-all flex-shrink-0"
                                title="Copiar caption"
                              >
                                {copiedKey === `cap-${i}`
                                  ? <Check className="w-3 h-3 text-emerald-500" />
                                  : <Copy className="w-3 h-3" />
                                }
                              </button>
                            </div>
                          </div>

                          {/* Prompt (colapsable) */}
                          <details className="group">
                            <summary className="text-[9px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:text-slate-600 transition-colors list-none flex items-center gap-1.5">
                              <ChevronRight className="w-3 h-3 transition-transform group-open:rotate-90" />
                              Ver prompt
                            </summary>
                            <div className="mt-2 bg-slate-50 rounded-xl p-3">
                              <p className="text-[10px] text-slate-400 font-mono leading-relaxed">{img.prompt}</p>
                            </div>
                          </details>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Footer actions */}
                  <div className="flex flex-col md:flex-row md:justify-between md:items-center mt-7 pt-5 border-t border-slate-200 gap-2 md:gap-3.5">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => { resetCreator(); setStep(2); }}
                        className="flex items-center gap-1.5 bg-violet-50 hover:bg-violet-100 border border-violet-200 text-violet-700 rounded-xl px-4 py-3 text-[13px] font-bold transition-colors"
                      >
                        <RefreshCw size={14} />
                        Ajustar y regenerar
                      </button>
                      <button
                        type="button"
                        onClick={resetCreator}
                        className="flex items-center gap-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-4 py-3 text-[13px] font-semibold transition-colors"
                      >
                        <Plus size={14} />
                        Nueva campaña
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('library')}
                      className="flex items-center gap-1.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-600 rounded-xl px-4 py-3 text-[13px] font-semibold transition-colors"
                    >
                      <Library size={14} />
                      Ver biblioteca
                    </button>
                  </div>
                </div>
              )}

            </div>

            {/* ── WIZARD FOOTER ───────────────────────────────── */}
            {step < 4 && (
              <WizardFooter
                onBack={step > 1 ? () => setStep(s => (s - 1) as WizardStep) : undefined}
                onContinue={() => {
                  if (step === 1 && canStep1) setStep(2);
                  else if (step === 2 && canStep2) setStep(3);
                  else if (step === 3 && canStep3) handleGenerate();
                }}
                continueLabel={step === 3 ? 'Crear campaña con IA' : 'Continuar'}
                disabled={
                  (step === 1 && !canStep1) ||
                  (step === 3 && insufficient)
                }
                costInfo={step === 3 ? { cost: totalCost, label: 'Créditos totales' } : undefined}
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
                <Megaphone className="w-12 h-12 text-slate-200 mb-5" />
                <p className="t-meta mb-2">Biblioteca vacía</p>
                <p className="t-body-sm mb-6">Creá tu primera campaña para guardarla aquí</p>
                <button
                  type="button"
                  onClick={() => setActiveTab('create')}
                  className="flex items-center gap-2 px-6 py-3 bg-brand-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-md hover:bg-brand-700 transition-colors"
                >
                  <Sparkles size={14} /> Crear campaña
                </button>
              </div>
            )}

            <div className="space-y-6">
              {sets.map(set => (
                <div
                  key={set.id}
                  className="bg-white border border-slate-100 rounded-[36px] overflow-hidden shadow-sm"
                >
                  {/* Set header */}
                  <div className="p-5 md:p-6 flex items-center justify-between border-b border-slate-100">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="text-2xl flex-shrink-0">{CAMPAIGN_TYPE_META[set.campaignType].icon}</div>
                      <div className="min-w-0">
                        <p
                          className="font-display font-bold italic text-[16px] text-slate-900 uppercase truncate"
                          style={{ fontFamily: 'Syne, Inter, sans-serif', letterSpacing: '-0.01em' }}
                        >
                          {CAMPAIGN_TYPE_META[set.campaignType].label}
                        </p>
                        <p className="text-[11px] text-slate-400 truncate mt-0.5">{set.basePrompt}</p>
                        <p className="text-[10px] text-slate-300 mt-0.5">
                          {new Date(set.createdAt).toLocaleDateString('es-CL')} · {set.images.length} imágenes
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0 ml-4">
                      <button
                        type="button"
                        onClick={() => downloadSetZip(set)}
                        className="w-9 h-9 bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded-xl flex items-center justify-center transition-all"
                        title="Descargar ZIP"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteSet(set.id)}
                        disabled={deletingId === set.id}
                        className="w-9 h-9 bg-rose-50 hover:bg-rose-100 text-rose-400 hover:text-rose-600 rounded-xl flex items-center justify-center transition-all disabled:opacity-40"
                        title="Eliminar"
                      >
                        {deletingId === set.id
                          ? <div className="w-3.5 h-3.5 border-2 border-rose-400 border-t-transparent rounded-full animate-spin" />
                          : <Trash2 className="w-4 h-4" />
                        }
                      </button>
                    </div>
                  </div>

                  {/* Image grid */}
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 p-3">
                    {set.images.map((img, i) => (
                      <div
                        key={i}
                        className="aspect-[3/4] rounded-2xl overflow-hidden cursor-pointer group relative"
                        onClick={() => openLightbox(set.images.map(x => x.imageUrl), i)}
                      >
                        <img
                          src={img.imageUrl}
                          alt={img.sceneName}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="absolute bottom-2 left-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="bg-white/90 rounded-lg px-2 py-1">
                            <p className="text-[9px] font-black text-slate-900 uppercase truncate">{img.sceneName}</p>
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

      {/* ── LIGHTBOX ─────────────────────────────────────────────── */}
      {lightboxOpen && lightboxImages.length > 0 && (
        <ImageLightbox
          images={lightboxImages}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxOpen(false)}
          onDownload={(url, idx) => downloadImage(url, idx)}
          metadata={{ label: 'Campaign Generator' }}
        />
      )}
    </>
  );
};

export default CampaignModule;