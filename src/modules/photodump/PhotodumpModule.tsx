/**
 * PhotodumpModule.tsx — Photodump Mode Fase 4
 * Wizard rediseñado: Paso 1 (receta + destino + cantidad) · Paso 2 (brief + refs / editor libre)
 * Modo recetas: 2 pasos → generación batch → resultados
 * Modo libre:   2 pasos → generación por escena individual → resultados
 */
import React, { useState, useEffect, useRef } from 'react';
import { ResultCard } from '../../components/shared/ResultCard';
import { ResultLibraryGrid } from '../../components/shared/ResultLibraryGrid';
import {
  Images, Download, Check, Sparkles, Library, Trash2, Copy,
  Plus, Hash, RefreshCw, AlertTriangle, BookMarked,
  Image as ImageIcon,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { downloadAsZip } from '../../utils/imageUtils';
import { ImageLightbox } from '../../components/shared/ImageLightbox';
import { newSessionId } from '../../services/imageApiService';
import { geminiService } from '../../services/geminiService';
import { photodumpStorage } from './photodumpStorage';
import {
  PhotodumpSet, PhotodumpDestino, PhotodumpRefs, PhotodumpOutfitMode,
  PhotodumpRecipe, FreeScene, PhotodumpDebugData, PhotodumpShotDebug,
  NARRATIVE_META, DESTINO_META, RECIPE_META,
  recipeRefsValid,
} from './types';
import {
  buildPhotodumpSessionPlan,
  generatePhotodumpREF0,
  generatePhotodumpShot,
  generatePhotodumpCaptions,
  generateFreeModeScene,
  getRefsAsArray,
  inferAvatarGender,
  inferDestinationFromBrief,
  detectContradictions,
  parseBriefContext,
  parseOutfitBriefContext,
  inferOutfitComposition,
  buildHaulManifest,
  buildHaulShotPlan,
  buildHaulWorldMap,
  buildHaulStylingGraph,
  getAllowedUseModes,
  computeFinalHaulCoverageFromShots,
  buildWeeklyManifest,
  buildProductHaulManifest,
  buildProductHaulShotPlan,
  type PhotodumpShotResult,
} from './photodumpDirectorService';
import ModuleTutorial from '../../components/shared/ModuleTutorial';
import { TUTORIAL_CONFIGS } from '../../components/shared/tutorialConfigs';
import { WizardStepper } from '../../components/shared/WizardStepper';
import { WizardFooter } from '../../components/shared/WizardFooter';
import { GenerationProgress as GenProgress, type ProgressStep } from '../../components/shared/GenerationProgress';
import PDStep1 from './PDStep1';
import PDStep2Receta from './PDStep2Receta';
import PDLibreEditor, { newFreeScene } from './PDLibreEditor';
import { useModelSelection } from '../../hooks/useModelSelection';
import { useModulePresets } from '../../shared/presets/useModulePresets';
import { presetService } from '../../shared/presets/presetService';
import { photodumpPresetAdapter, type PhotodumpPresetState } from './photodumpPresetAdapter';
import { PresetManagerPanel } from '../../components/presets/PresetManagerPanel';

// ── Wizard steps ──────────────────────────────────────────────
// Modo recetas: 1 Tipo · 2 Brief · 3 Generando · 4 Resultado
// Modo libre:   1 Tipo · 2 Editor · (generación por escena, sin paso global)
type WizardStep = 1 | 2 | 3 | 4;

const WIZARD_STEPS_RECETA = [
  { id: '1', label: 'Tipo'      },
  { id: '2', label: 'Brief'     },
  { id: '3', label: 'Generar'   },
  { id: '4', label: 'Resultado' },
];

const WIZARD_STEPS_LIBRE = [
  { id: '1', label: 'Tipo'   },
  { id: '2', label: 'Editor' },
];

const GENERATION_STEPS: ProgressStep[] = [
  { id: 'analyze',  label: 'Analizando referencias visuales'   },
  { id: 'plan',     label: 'Armando la estructura narrativa'   },
  { id: 'ref0',     label: 'Generando imagen ancla del set'    },
  { id: 'shots',    label: 'Generando imágenes de la historia' },
  { id: 'captions', label: 'Escribiendo captions y hashtags'   },
  { id: 'done',     label: 'Historia visual lista'             },
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
  const { modelId, setModelId } = useModelSelection();

  // ID fijo del set de modo libre activo; se crea al generar la 1ª escena y se limpia en reset
  const libreSetIdRef = useRef<string | null>(null);

  // ── Estado Paso 1 ─────────────────────────────────────────
  const [recipe,   setRecipe]   = useState<PhotodumpRecipe>('day_in_life');
  const [count,    setCount]    = useState(4);
  const [destino,  setDestino]  = useState<PhotodumpDestino>('feed');

  // ── Estado Paso 2 modo recetas ────────────────────────────
  const [basePrompt,  setBasePrompt]  = useState('');
  const [outfitMode,  setOutfitMode]  = useState<PhotodumpOutfitMode>('generate');
  const [refs, setRefs] = useState<PhotodumpRefs>({
    avatarRef: null, bodyRef: null,
    productRef: null, productRefs: [],
    outfitRef: null, outfitRefs: [],
    sceneRef: null, sceneRefs: [],
    sceneText: '', outfitMode: 'generate',
  });

  // ── Estado Paso 2 modo libre ──────────────────────────────
  const [freeScenes, setFreeScenes] = useState<FreeScene[]>([{ ...newFreeScene(0), sceneRefs: [], inheritFrom: 0 }]);
  const [generatingFreeIndex, setGeneratingFreeIndex] = useState<number | null>(null);

  // ── Wizard ────────────────────────────────────────────────
  const [step,      setStep]      = useState<WizardStep>(1);
  const [activeTab, setActiveTab] = useState<'create' | 'library'>('create');

  const isFree = recipe === 'free';
  const wizardSteps = isFree ? WIZARD_STEPS_LIBRE : WIZARD_STEPS_RECETA;

  // ── Generación modo recetas ───────────────────────────────
  const [isGenerating,      setIsGenerating]      = useState(false);
  const [progressStepIndex, setProgressStepIndex] = useState(0);
  const [progress,          setProgress]          = useState<{ total: number; completed: number } | null>(null);
  const [partialImages,     setPartialImages]     = useState<string[]>([]);
  const [error,             setError]             = useState<string | null>(null);
  const [currentSet,        setCurrentSet]        = useState<PhotodumpSet | null>(null);
  const [failedIndexes,     setFailedIndexes]     = useState<number[]>([]);
  const [retryingIndexes,   setRetryingIndexes]   = useState<number[]>([]);
  const [savedPlan,         setSavedPlan]         = useState<any>(null);
  const [savedRef0Url,      setSavedRef0Url]      = useState<string>('');
  const [savedShotUrls,     setSavedShotUrls]     = useState<string[]>([]);
  const [savedShots,        setSavedShots]        = useState<any[]>([]);
  const [savedCaptions,     setSavedCaptions]     = useState<{ caption: string; hashtags: string } | null>(null);
  const [savedRef0Analysis, setSavedRef0Analysis] = useState<any>(null);
  const [savedDebugData,    setSavedDebugData]    = useState<PhotodumpDebugData | undefined>(undefined);
  const [failureHint,       setFailureHint]       = useState<string | null>(null);

  // ── Resultados UI ─────────────────────────────────────────
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // ── Library ───────────────────────────────────────────────
  const [sets,        setSets]        = useState<PhotodumpSet[]>([]);
  const [loadingSets, setLoadingSets] = useState(false);
  const [deletingId,  setDeletingId]  = useState<string | null>(null);

  // ── Lightbox ──────────────────────────────────────────────
  const [lightboxOpen,   setLightboxOpen]   = useState(false);
  const [lightboxIndex,  setLightboxIndex]  = useState(0);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);

  // ── Presets ───────────────────────────────────────────────
  const [showPresets, setShowPresets] = useState(false);
  const currentPresetState: PhotodumpPresetState = {
    recipe, count, destino, basePrompt, outfitMode, refs, modelId,
  };
  const presetManager = useModulePresets(photodumpPresetAdapter, currentPresetState);

  const handleLoadPreset = (partialState: Partial<PhotodumpPresetState>, opts?: { jumpToStep2?: boolean }) => {
    if (partialState.recipe    !== undefined) setRecipe(partialState.recipe);
    if (partialState.count     !== undefined) setCount(partialState.count);
    if (partialState.destino   !== undefined) setDestino(partialState.destino);
    if (partialState.basePrompt !== undefined) setBasePrompt(partialState.basePrompt);
    if (partialState.outfitMode !== undefined) setOutfitMode(partialState.outfitMode);
    if (partialState.refs      !== undefined) setRefs(partialState.refs);
    if (partialState.modelId   !== undefined) setModelId(partialState.modelId as any);
    setShowPresets(false);
    if (opts?.jumpToStep2 !== false) setStep(2); // ir directo al brief con la configuración restaurada
  };

  // Al entrar al módulo, si hay un preset marcado como default, precargarlo
  // automáticamente (sin saltar de paso, para no sorprender al usuario).
  useEffect(() => {
    if (!user?.uid) return;
    (async () => {
      const defaultPreset = await presetService.getDefault(user.uid, photodumpPresetAdapter.moduleId);
      if (!defaultPreset) return;
      const partialState = photodumpPresetAdapter.deserialize(defaultPreset.config, defaultPreset.assets);
      handleLoadPreset(partialState, { jumpToStep2: false });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  // ── Costos modo recetas ───────────────────────────────────
  // El "+1" cubre el REF0/ancla como llamada extra a Gemini — pero en
  // outfit_multi_look el ancla ES la foto del primer look, y en
  // outfit_reveal_basic el ancla ES el shot mirror_check (misma llamada, ver
  // recipes/outfitMultiLook/anchorFixed.ts y recipes/outfitRevealBasic/index.ts),
  // así que en ninguna de las dos hay imagen extra que cobrar: son
  // exactamente `count` generaciones reales.
  const imageCreditCost = (recipe === 'outfit_multi_look' || recipe === 'outfit_reveal_basic')
    ? count * CREDITS_PER_IMAGE
    : (count + 1) * CREDITS_PER_IMAGE;
  const insufficient    = !isAdmin && (credits?.available ?? 0) < imageCreditCost;
  const hasProCredits   = isAdmin || proCredits > 0;
  const creditsAfter    = Math.max(0, (credits?.available ?? 0) - imageCreditCost);

  // ── Validaciones por paso ─────────────────────────────────
  const canStep1 = true; // siempre hay una receta seleccionada
  const canStep2Receta = basePrompt.trim().length >= 5;
  // En modo libre no hay un botón global de generar — cada escena se genera por separado

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

  const openSetFromLibrary = (set: PhotodumpSet) => {
    setCurrentSet(set);
    setStep(4);
    setActiveTab('create');
    window.scrollTo(0, 0);
  };

  const downloadSetZip = async (set: PhotodumpSet) => {
    await downloadAsZip(set.images.map(i => i.imageUrl), `photodump_${set.id.slice(-6)}.zip`, 'dump');
  };

  const emptyRefs: PhotodumpRefs = {
    avatarRef: null, bodyRef: null,
    productRef: null, productRefs: [],
    outfitRef: null, outfitRefs: [],
    sceneRef: null, sceneRefs: [],
    sceneText: '', outfitMode: 'generate',
  };

  const resetCreator = () => {
    setStep(1);
    setBasePrompt(''); setRefs(emptyRefs); setOutfitMode('generate');
    setCount(4); setDestino('feed'); setRecipe('day_in_life');
    setFreeScenes([{ ...newFreeScene(0), sceneRefs: [], inheritFrom: 0 }]);
    setGeneratingFreeIndex(null);
    setCurrentSet(null); setError(null); setProgress(null); setFailureHint(null);
    setProgressStepIndex(0); setIsGenerating(false); setPartialImages([]);
    setFailedIndexes([]); setSavedPlan(null); setSavedRef0Url(''); setSavedRef0Analysis(null); setSavedShotUrls([]); setSavedDebugData(undefined);
    libreSetIdRef.current = null;
  };

  // Guardar set de modo libre en la biblioteca cuando hay al menos 1 escena generada.
  // Reutiliza el mismo ID para que cada nueva escena actualice el set existente en lugar de crear uno nuevo.
  const saveLibreSet = async (scenes: FreeScene[]) => {
    const generated = scenes.filter(s => s.result);
    if (generated.length === 0) return;
    if (!libreSetIdRef.current) libreSetIdRef.current = Date.now().toString();
    const set: PhotodumpSet = {
      id:          libreSetIdRef.current,
      createdAt:   Date.now(),
      basePrompt:  generated.map((s, i) => `E${i + 1}: ${s.prompt}`).join(' | ').slice(0, 120),
      recipe:      'free',
      narrative:   'custom',
      protagonist: 'both',
      customStory: '',
      destino,
      count:       generated.length,
      refs:        { avatarRef: null, productRef: null, outfitRef: null, sceneRef: null, outfitMode: 'generate' },
      freeScenes:  scenes,
      images:      generated.map((s, i) => ({
        imageUrl: s.result!,
        moment:   `Escena ${i + 1}`,
        caption:  s.prompt.slice(0, 100),
        hashtags: '',
        prompt:   s.prompt,
        order:    i + 1,
      })),
    };
    await photodumpStorage.save(set);
    await loadSets();
  };

  // ── Handlers modo libre ───────────────────────────────────
  const updateFreeScene = (index: number, changes: Partial<FreeScene>) => {
    setFreeScenes(prev => prev.map((s, i) => i === index ? { ...s, ...changes } : s));
  };

  const addFreeScene = () => {
    setFreeScenes(prev => {
      const idx = prev.length;
      return [...prev, { ...newFreeScene(idx), sceneRefs: [], inheritFrom: idx - 1 }];
    });
    setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }), 100);
  };

  const removeFreeScene = (index: number) => {
    setFreeScenes(prev => prev.filter((_, i) => i !== index));
  };

  const generateFreeScene = async (index: number) => {
    const scene = freeScenes[index];
    if (!scene) return;

    // Costo: 2 créditos por escena individual (sin pro-credit — no es sesión batch)
    const cost = CREDITS_PER_IMAGE;
    if (!isAdmin && (credits?.available ?? 0) < cost) {
      setError(`Necesitás ${cost} créditos para generar esta escena.`);
      return;
    }
    if (!isAdmin) {
      const ok = await deductCredits(cost);
      if (!ok) { setError('Error al descontar créditos.'); return; }
    }

    setGeneratingFreeIndex(index);
    setError(null);

    try {
      const sessionId = newSessionId();

      // Los refs ya están pre-rellenados en scene.refs por el editor (herencia real)
      // priorResults indexado por posición de escena para resolver @tags tipo B
      const priorResults = freeScenes.map(s => s.result);

      const imageUrl = await generateFreeModeScene({
        scene:         scene,
        sceneIndex:    index,
        destino,
        priorResults,
        allScenes:     freeScenes,
        sessionParams: { uid: user?.uid, sessionId },
        modelId,
      });

      const updatedScenes = freeScenes.map((s, i) => i === index ? { ...s, result: imageUrl } : s);
      updateFreeScene(index, { result: imageUrl });
      await refreshCredits();
      // Guardar automáticamente en biblioteca tras cada escena generada
      await saveLibreSet(updatedScenes);
    } catch (err: any) {
      // Reembolsar si falló
      if (!isAdmin) {
        await deductCredits(-cost).catch(() => {});
        await refreshCredits().catch(() => {});
      }
      setError(`Error generando escena ${index + 1}: ${err?.message ?? 'Intentá de nuevo.'}`);
    } finally {
      setGeneratingFreeIndex(null);
    }
  };

  // ── GENERACIÓN PRINCIPAL modo recetas ─────────────────────
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

    setStep(3);
    setIsGenerating(true);
    setError(null);
    setCurrentSet(null);
    setPartialImages([]);
    setFailedIndexes([]);
    setProgressStepIndex(0);
    setProgress({ total: count, completed: 0 });

    // Derivar narrative y protagonist desde la receta
    const recipeMeta = RECIPE_META[recipe];
    const narrative  = recipeMeta.narrative;
    const protagonist = recipeMeta.protagonist;

    try {
      const sessionId = newSessionId();
      const sessionParams = { uid: user?.uid, sessionId };

      // Inferir género desde el avatar antes de generar — afecta HPI y captions
      const inferredGender = refs.avatarRef
        ? await inferAvatarGender(refs.avatarRef).catch(() => 'female' as const)
        : (refs.gender ?? 'female');
      const refsWithMode = { ...refs, outfitMode, gender: inferredGender };

      // ── Paso 0: análisis visual de referencias (outfit_haul) ──────────────
      // Una sola llamada Gemini multimodal con todas las imágenes juntas.
      // Enriquece el manifest con resolvedKind y outfitComponents reales,
      // no solo inferidos del selector manual.
      setProgressStepIndex(0);
      let visualAnalysis: import('./types').VisualRefsAnalysisResult | undefined;
      if (recipe === 'outfit_haul') {
        const allRefImages = [
          refs.outfitRef,
          ...(refs.outfitRefs ?? []),
          ...(refs.accesorioRefs ?? []),
        ].filter(Boolean) as string[];
        const allRefHints = [
          ...(refs.haulOutfitKinds ?? []),
          ...(refs.haulAccKinds ?? []),
        ];
        if (allRefImages.length > 0) {
          visualAnalysis = await geminiService.analyzeVisualReferences(
            allRefImages,
            allRefHints,
            'fashion haul content generation',
          ).catch(() => undefined);
        }
      }

      // ── Paso 1: plan narrativo ─────────────────────────────────────────────
      setProgressStepIndex(1);
      // Count policy:
      //   outfit_check : máximo 8 visibles, REF0 ocupa 1 slot
      //   outfit_haul  : hasta 20 story shots, REF0 siempre aparte (no ocupa slot)
      //   product_haul : hasta 20 story shots, mismo tratamiento que outfit_haul
      //   otras recetas: count directo
      const visibleCount = recipe === 'outfit_check'
        ? Math.min(count, 8)
        : count;
      const storyShotCount = recipe === 'outfit_check'
        ? Math.max(2, visibleCount - 1)
        : (recipe === 'outfit_haul' || recipe === 'product_haul')
          ? Math.min(count, 20)
          : count;
      const plan  = await buildPhotodumpSessionPlan(narrative, protagonist, destino, basePrompt, recipe, refsWithMode, storyShotCount);
      const shots = plan.shots.slice(0, storyShotCount);
      setSavedShots(shots);
      setSavedPlan(plan);

      setProgressStepIndex(2);
      const ref0Result = await generatePhotodumpREF0(
        refsWithMode, narrative, protagonist, destino, basePrompt, sessionParams, recipe,
      );
      const ref0Url      = ref0Result.imageUrl;
      const ref0Analysis = ref0Result.ref0Analysis;
      setSavedRef0Url(ref0Url);
      setSavedRef0Analysis(ref0Analysis);
      // outfit_multi_look / outfit_reveal_basic: el REF0 ES el primer shot real
      // (mismo shot, fusionado) — no sembrar el preview con él aparte, o el loop
      // de abajo lo vuelve a agregar al hacer push, duplicando la imagen 1 en el
      // panel de progreso (bug real reportado en producción).
      const ref0IsFirstShot = recipe === 'outfit_multi_look' || recipe === 'outfit_reveal_basic';
      setPartialImages(ref0IsFirstShot ? [] : [ref0Url]);

      // Debug: acumular prompts de cada shot (solo para admins)
      const inferredDest = isAdmin ? inferDestinationFromBrief(basePrompt) : 'none' as const;

      // Manifest de haul — se construye siempre para outfit_haul (no solo para admins)
      // para garantizar que generatePhotodumpShot use la clasificación correcta (con visualAnalysis).
      // buildHaulShotPlan popula el ledger (plannedHeroShots, coverageStatus, etc.).
      const haulManifestForGen = (() => {
        if (recipe !== 'outfit_haul') return undefined;
        const m = buildHaulManifest(refsWithMode, storyShotCount, visualAnalysis);
        buildHaulShotPlan(m); // side-effect: escribe ledger y warnings en m.coveragePlan
        return m;
      })();
      // Para debug solo se usa cuando isAdmin — mismo objeto, sin coste extra
      const haulManifestDebug = isAdmin ? haulManifestForGen : undefined;

      // Manifest de product_haul — mismo patrón que haul, sin visualAnalysis (no aplica)
      const productHaulManifestForGen = (() => {
        if (recipe !== 'product_haul') return undefined;
        const m = buildProductHaulManifest(refsWithMode, storyShotCount);
        buildProductHaulShotPlan(m); // side-effect: escribe ledger en m.coveragePlan
        return m;
      })();
      const productHaulManifestDebug = isAdmin ? productHaulManifestForGen : undefined;
      const briefCtxDebug = isAdmin && recipe === 'outfit_check' ? parseOutfitBriefContext(basePrompt) : undefined;
      const outfitCompositionDebug = isAdmin && recipe === 'outfit_check'
        ? inferOutfitComposition(refsWithMode, basePrompt) : undefined;
      const debugShots: PhotodumpShotDebug[] = isAdmin ? [{
        shotIndex:   0,
        role:        'REF0_ANCHOR',
        prompt:      ref0Result.prompt,
        refsCount:   ref0Result.refsCount,
        narrativeStage: 'prep',
        sceneRole:   'prep_space',
        shotIntent:  'Establece identidad, espacio visual y world para el set completo',
        promptLayersApplied: ['LOCK_SYSTEM', 'PARADIGM_RULE', 'STORY_MODE', 'BRIEF_CONTEXT', 'IDENTITY', 'REF0_ANCHOR'],
        destinationInferred: inferredDest,
        destinationExplicitRefProvided: !!(refsWithMode as any).sceneDestinoRef,
        status:      'ok',
      }] : [];

      setProgressStepIndex(3);
      const shotUrls: string[] = [];
      const failed: number[]   = [];
      const failedErrors: string[] = [];
      for (let i = 0; i < shots.length; i++) {
        // Delay escalonado: shots 1-4 esperan 15s, shots 5+ esperan 25s (Gemini rate-limit)
        if (i > 0) await new Promise(r => setTimeout(r, i < 5 ? 15000 : 25000));
        const sh = shots[i];
        try {
          const result: PhotodumpShotResult = await generatePhotodumpShot(
            sh, refsWithMode, ref0Url, ref0Analysis,
            basePrompt, narrative, destino, sessionParams,
            plan.assignedFamilies, plan.sessionFamilies,
            shots.length, protagonist, recipe,
            plan.presentationStyle,
            haulManifestForGen,
          );
          shotUrls.push(result.imageUrl);
          setPartialImages(prev => [...prev, result.imageUrl]);
          if (isAdmin) {
            const hpiSrc    = (result as any).hpiSource as 'disabled' | 'filtered_outfit_hpi' | 'raw_hpi_not_allowed' | undefined;
            const famMode   = (result as any).familyBlockMode as 'disabled' | 'abstract_style_hint' | 'literal_prompt_block' | undefined;
            const contradictions = detectContradictions(
              sh, inferredDest, !!(refsWithMode as any).sceneDestinoRef,
              parseBriefContext(basePrompt).timeSignal,
              recipe, shots.map(s => s.key ?? ''),
              briefCtxDebug, outfitCompositionDebug, hpiSrc, famMode,
            );
            // Validador: términos visuales del destino en prompts de preparación
            if (recipe === 'outfit_check' && sh.narrativeStage !== 'destination') {
              const destTerms = ['opera house','theatre','grand foyer','marble floor','chandelier','velvet curtain','restaurant interior','lobby','office corridor','coworking','club house','palace hallway','street exterior','hotel lobby'];
              const promptLower = (result.prompt ?? '').toLowerCase();
              const found = destTerms.filter(t => promptLower.includes(t));
              if (found.length > 0)
                contradictions.push(`Prep/styled shot contains destination visual terms: ${found.join(', ')}`);
            }
            // Validador: count mismatch (solo en el último shot)
            if (recipe === 'outfit_check' && i === shots.length - 1 && visibleCount !== count) {
              contradictions.push(`requestedCount=${count} capped to visibleCount=${visibleCount} (outfit_check max 8)`);
            }
            // Validadores haul
            if (recipe === 'outfit_haul') {
              const shotKey = sh.key ?? '';
              // Try-on / selection sin ref asignada
              if (shotKey.startsWith('HAUL_TRY_ON') || shotKey.startsWith('HAUL_ADJUSTING') || shotKey === 'HAUL_SELECTION') {
                if ((result.refsCount ?? 0) < 2) {
                  contradictions.push(`${shotKey}: try-on/adjusting/selection shot with only ${result.refsCount} refs (expected ≥2: avatar + item)`);
                }
              }
              // Closeup sin ref de accesorio
              if (shotKey.startsWith('HAUL_ACCESSORY_CLOSEUP')) {
                if ((result.refsCount ?? 0) < 1) {
                  contradictions.push(`${shotKey}: closeup shot with 0 refs — accessory ref missing`);
                }
              }
              // Footwear / bag / jewelry sin ref
              if ((shotKey.startsWith('HAUL_FOOTWEAR_') || shotKey.startsWith('HAUL_BAG_') || shotKey.startsWith('HAUL_JEWELRY_')) && (result.refsCount ?? 0) < 1) {
                contradictions.push(`${shotKey}: product detail shot with 0 refs — item ref missing`);
              }
              // Styled result sin ref
              if (shotKey.startsWith('HAUL_STYLED_') && (result.refsCount ?? 0) < 2) {
                contradictions.push(`${shotKey}: styled result shot with only ${result.refsCount} refs (expected ≥2: avatar + item)`);
              }
              // Recap sin refs
              if (shotKey === 'HAUL_RECAP' && (result.refsCount ?? 0) < 1) {
                contradictions.push(`HAUL_RECAP: recap shot with 0 refs`);
              }
              // Shot sin key haul
              if (shotKey && !shotKey.startsWith('HAUL_') && !shotKey.startsWith('REF0')) {
                contradictions.push(`Non-haul key in haul recipe: ${shotKey}`);
              }
            }

            // Para haul: encontrar el item activo de este shot en el ledger
            let haulPrimaryId: string | undefined;
            let haulManualKindDebug: string | undefined;
            let haulResolvedKindDebug: string | undefined;
            let haulCoverageRole: 'hero' | 'support' | 'context' | undefined;
            if (recipe === 'outfit_haul' && haulManifestDebug) {
              const sk = sh.key ?? '';
              if (sk.startsWith('HAUL_TRY_ON_') || sk.startsWith('HAUL_ADJUSTING_') || sk.startsWith('HAUL_STYLED_')) {
                const idx = parseInt(sk.replace(/^HAUL_(TRY_ON|ADJUSTING|STYLED)_/, ''), 10) - 1;
                const it = haulManifestDebug.outfitItems[idx] ?? haulManifestDebug.tryOnItems[idx];
                haulPrimaryId = it?.id; haulManualKindDebug = it?.manualKind; haulResolvedKindDebug = it?.resolvedKind;
                haulCoverageRole = 'hero';
              } else if (sk === 'HAUL_SELECTION') {
                const it = haulManifestDebug.outfitItems[haulManifestDebug.outfitItems.length - 1];
                haulPrimaryId = it?.id; haulManualKindDebug = it?.manualKind; haulResolvedKindDebug = it?.resolvedKind;
                haulCoverageRole = 'hero';
              } else if (sk.startsWith('HAUL_FOOTWEAR_')) {
                const idx = parseInt(sk.replace('HAUL_FOOTWEAR_', ''), 10) - 1;
                const it = haulManifestDebug.footwearItems[idx];
                haulPrimaryId = it?.id; haulManualKindDebug = it?.manualKind; haulResolvedKindDebug = it?.resolvedKind;
                haulCoverageRole = 'hero';
              } else if (sk.startsWith('HAUL_BAG_')) {
                const idx = parseInt(sk.replace('HAUL_BAG_', ''), 10) - 1;
                const it = haulManifestDebug.accessoryItems.filter(x => x.kind === 'bag')[idx];
                haulPrimaryId = it?.id; haulManualKindDebug = it?.manualKind; haulResolvedKindDebug = it?.resolvedKind;
                haulCoverageRole = 'hero';
              } else if (sk.startsWith('HAUL_JEWELRY_') || sk.startsWith('HAUL_ACCESSORY_CLOSEUP_')) {
                const idx = parseInt(sk.replace(/^HAUL_(JEWELRY|ACCESSORY_CLOSEUP)_/, ''), 10) - 1;
                let it: typeof haulManifestDebug.accessoryItems[0] | undefined;
                if (sk.startsWith('HAUL_JEWELRY_')) {
                  it = haulManifestDebug.accessoryItems.filter(x => x.kind === 'jewelry')[idx];
                } else {
                  // HAUL_ACCESSORY_CLOSEUP_ corresponde a generic accessories (no bag, no jewelry)
                  const genericAccItems = haulManifestDebug.accessoryItems.filter(x => x.kind !== 'bag' && x.kind !== 'jewelry');
                  it = genericAccItems[idx];
                }
                haulPrimaryId = it?.id; haulManualKindDebug = it?.manualKind; haulResolvedKindDebug = it?.resolvedKind;
                haulCoverageRole = 'hero';
              } else if (sk === 'HAUL_OVERVIEW' || sk === 'HAUL_RECAP') {
                haulCoverageRole = 'context';
              } else if (sk.startsWith('HAUL_SETUP_')) {
                // Key encodes outfit item index — resolve to correct item for debug display
                const idx = parseInt(sk.replace('HAUL_SETUP_', ''), 10) - 1;
                const it = haulManifestDebug.outfitItems[idx] ?? haulManifestDebug.tryOnItems[idx];
                haulPrimaryId = it?.id;
                // Show actual manualKind — never show 'auto' if it was manually tagged
                haulManualKindDebug = (it?.manualKind && it.manualKind !== 'auto') ? it.manualKind : (it?.manualKind ?? undefined);
                haulResolvedKindDebug = it?.resolvedKind;
                haulCoverageRole = 'support';
              } else if (sk.startsWith('HAUL_DETAIL_')) {
                haulCoverageRole = 'support';
              }
            }
            const arcRatio = (i + 1) / shots.length;
            debugShots.push({
              shotIndex:    i + 1,
              role:         sh.role,
              beat:         sh.beat,
              key:          sh.key,
              prompt:       result.prompt,
              refsCount:    result.refsCount,
              narrativeStage:   sh.narrativeStage,
              wearState:        sh.wearState,
              cameraMode:       sh.cameraMode,
              subjectPresence:  sh.subjectPresence,
              sceneRole:        sh.narrativeStage === 'destination' ? 'destination' : sh.narrativeStage === 'prep' ? 'prep_space' : 'neutral',
              shotIntent:       sh.purpose?.slice(0, 120),
              presentationStyle: plan.presentationStyle,
              mustNotWearFinalOutfit: sh.wearState === 'not_wearing_final_outfit',
              mustWearFinalOutfit:    sh.wearState === 'wearing_full_outfit' || sh.wearState === 'ready_to_leave' || sh.wearState === 'destination_arrived',
              mustShowMirror:    sh.cameraMode === 'mirror_selfie' || sh.cameraMode === 'mirror_selfie_phone_hidden' || sh.cameraMode === 'mirror_selfie_phone_visible',
              destinationInferred: inferredDest,
              destinationExplicitRefProvided: !!(refsWithMode as any).sceneDestinoRef,
              promptLayersApplied: [
                'LOCK_SYSTEM', 'PARADIGM_RULE', 'STORY_MODE', 'BRIEF_CONTEXT',
                sh.sceneLockPolicy ? `SCENE_LOCK_${sh.sceneLockPolicy.toUpperCase()}` : null,
                sh.continuityMode && sh.continuityMode !== 'free' ? `SCENE_CONTINUITY_${sh.continuityMode.toUpperCase()}` : null,
                sh.poseIntent && sh.key === 'OUTFIT_DESTINATION' ? `POSE_INTENT_${sh.poseIntent.toUpperCase()}` : null,
                sh.wearState  ? 'WEAR_STATE'    : null,
                sh.itemStatePlan ? 'ITEM_STATE_PLAN' : null,
                sh.cameraMode ? 'CAMERA_MODE'   : null,
                sh.phonePolicy ? `PHONE_${sh.phonePolicy.toUpperCase()}` : null,
                sh.hpiAllowed ? 'HPI'           : 'HPI_DISABLED',
                recipe === 'outfit_haul' ? 'HAUL_ITEM_TYPE_BLOCK' : null,
                recipe === 'outfit_haul' ? 'SCENE_FINGERPRINT_LOCK' : null,
                recipe === 'outfit_haul' ? 'PROGRESSIVE_CLUTTER' : null,
                'REF0_ANALYSIS', 'SHOT_IDENTITY', 'VARIATION_SPACE',
              ].filter(Boolean) as string[],
              hpiApplied:       !!sh.hpiAllowed,
              hpiProfileUsed:   sh.hpiScope ?? 'none',
              hpiSource:        hpiSrc,
              familyBlockApplied: !!famMode && famMode !== 'disabled',
              familyBlockMode:  famMode,
              outfitComposition: outfitCompositionDebug,
              itemStatePlan:    sh.itemStatePlan,
              isFinalShot:      sh.isFinalShot,
              isClosingShot:    sh.isClosingShot,
              closingStrategy:  sh.closingStrategy,
              sceneLockPolicy:  sh.sceneLockPolicy,
              phonePolicy:      sh.phonePolicy,
              poseIntent:       sh.poseIntent,
              detailKind:       sh.detailKind,
              continuityMode:   sh.continuityMode,
              environmentAffordances: sh.environmentAffordances,
              closureReason:    sh.closureReason,
              // Haul extended debug
              primaryItemId:           haulPrimaryId,
              primaryItemManualKind:   haulManualKindDebug as any,
              primaryItemResolvedKind: haulResolvedKindDebug as any,
              coverageRole:            haulCoverageRole,
              // actualPrimaryRefRouted: true si el shot es hero Y la ref primaria fue resuelta.
              // false = shot hero sin ref → scheduled_not_routed en el ledger final.
              ...(recipe === 'outfit_haul' && haulCoverageRole === 'hero' ? {
                actualPrimaryRefRouted: !!haulPrimaryId,
                actualPrimaryRefKind:   haulResolvedKindDebug as any,
              } : {}),
              sceneFingerprintApplied: recipe === 'outfit_haul',
              sceneDriftRisk:          recipe === 'outfit_haul'
                ? (arcRatio > 0.8 ? 'medium' : 'low')
                : undefined,
              referenceRouting: recipe === 'outfit_haul' ? (() => {
                // Classify the primary item semantically — not everything is a garmentRef
                const primaryItem = haulPrimaryId
                  ? haulManifestDebug?.allItems.find(it => it.id === haulPrimaryId)
                  : undefined;
                const wearableKindsSet = new Set<string>(['full_outfit', 'top', 'bottom', 'dress', 'onepiece', 'outerwear', 'hosiery', 'mixed_set']);
                const isGarment  = primaryItem ? wearableKindsSet.has(primaryItem.resolvedKind) : false;
                const isFootwear = primaryItem ? primaryItem.resolvedKind === 'footwear' : false;
                const isJewelry  = primaryItem ? primaryItem.resolvedKind === 'jewelry' : false;
                const isAcc      = primaryItem ? (primaryItem.resolvedKind === 'bag' || primaryItem.resolvedKind === 'accessory') : false;
                const hasItem    = !!primaryItem;
                return {
                  avatarRefs:         result.refsCount > 0 ? 1 : 0,
                  ref0Used:           false,
                  garmentRefs:        isGarment ? 1 : 0,
                  footwearRefs:       isFootwear ? 1 : 0,
                  jewelryRefs:        isJewelry ? 1 : 0,
                  accessoryRefs:      isAcc ? 1 : 0,
                  backgroundItemRefs: 0,
                  unrelatedRefsCount: Math.max(0, result.refsCount - (hasItem ? 2 : 1)),
                };
              })() : undefined,
              haulProgressState: recipe === 'outfit_haul' ? {
                currentItem:       haulPrimaryId,
                triedCount:        Math.min(i, (haulManifestDebug?.tryOnItems.length ?? 1)),
                remainingCount:    Math.max(0, (haulManifestDebug?.tryOnItems.length ?? 0) - i),
                pileState:         i === 0 ? 'clean' : i < 3 ? 'light_pile' : i < 6 ? 'medium_pile' : 'messy_but_believable',
                clutterStage:      arcRatio < 0.33 ? 'early' : arcRatio < 0.66 ? 'middle' : 'late',
                itemsAlreadyShown: haulManifestDebug?.outfitItems.slice(0, i).map(x => x.id) ?? [],
                itemsNotYetShown:  haulManifestDebug?.outfitItems.slice(i).map(x => x.id) ?? [],
              } : undefined,
              // Weekly-specific debug (patch post-refactor Fase 10) — refleja los campos
              // condicionales asignados por deriveWeeklyRoutingFields en outfitWeek.ts.
              weeklyRoutingDebug: recipe === 'outfit_week' && sh.weeklyItemPlan ? {
                activeCategory:         sh.weeklyItemPlan.activeCategory,
                behaviorType:           sh.weeklyItemPlan.behaviorType,
                inheritBaseOutfit:      sh.weeklyItemPlan.inheritBaseOutfit,
                replaceBaseOutfit:      sh.weeklyItemPlan.replaceBaseOutfit,
                activeItemReplaces:     sh.weeklyItemPlan.activeItemReplaces,
                useRef0AsBaseStyling:   sh.weeklyItemPlan.useRef0AsBaseStyling,
                useSetShotReference:    sh.weeklyItemPlan.useSetShotReference,
                technicalReferenceOnly: sh.weeklyItemPlan.technicalReferenceOnly,
              } : undefined,
              resolvedRefsForShot: recipe === 'outfit_week' && sh.weeklyItemPlan
                ? [...sh.weeklyItemPlan.primaryItemIds, ...sh.weeklyItemPlan.secondaryItemIds]
                : undefined,
              possibleContradictions: contradictions.length > 0 ? contradictions : undefined,
              status:       'ok',
            });
          }
        } catch (shotErr: any) {
          const errMsg = shotErr?.message ?? '';
          const isContentPolicy = errMsg.toLowerCase().includes('content') ||
            errMsg.toLowerCase().includes('filter') ||
            errMsg.toLowerCase().includes('block') ||
            errMsg.toLowerCase().includes('policy') ||
            errMsg.toLowerCase().includes('prohibited');

          // Retry automático para haul:
          // • content-policy: safe-retry con prompt conservador
          // • timeout/red: backoff retry con el mismo prompt
          let retryResult: PhotodumpShotResult | null = null;
          if (recipe === 'outfit_haul') {
            const isHeroShot = sh.key && (
              sh.key.startsWith('HAUL_TRY_ON_') ||
              sh.key.startsWith('HAUL_FOOTWEAR_') ||
              sh.key.startsWith('HAUL_BAG_') ||
              sh.key.startsWith('HAUL_JEWELRY_') ||
              sh.key.startsWith('HAUL_ACCESSORY_CLOSEUP_') ||
              sh.key.startsWith('HAUL_ADJUSTING_') ||
              sh.key.startsWith('HAUL_STYLED_')
            );
            try {
              if (isContentPolicy) {
                // Content policy: wait 10s, retry with conservative prompt
                await new Promise(r => setTimeout(r, 10000));
                const safeRetryPurpose = isHeroShot
                  ? `Fashion try-on: show the garment/item from the reference clearly visible on the person or held toward the camera. Modest, everyday styling. Natural standing or adjusting pose. Covered, non-revealing. The garment is the focus — show its color, cut, and fabric faithfully. Real bedroom setting, iPhone snapshot quality.`
                  : `Natural haul moment in a real bedroom. Person in modest, everyday clothing. Relaxed, non-posed. Real room, natural light. iPhone snapshot quality.`;
                retryResult = await generatePhotodumpShot(
                  {
                    ...sh,
                    purpose:          safeRetryPurpose,
                    requiredElements: [...(sh.requiredElements ?? []), 'modest_natural_pose', 'garment_clearly_visible'],
                    forbiddenElements: [
                      ...(sh.forbiddenElements ?? []),
                      'revealing_pose', 'sexualized_framing', 'bodycon_language', 'tight_language',
                      'transparent_language', 'sheer_language', 'lingerie_language', 'skin_focus',
                    ],
                  },
                  refsWithMode, ref0Url, ref0Analysis,
                  basePrompt, narrative, destino, sessionParams,
                  plan.assignedFamilies, plan.sessionFamilies,
                  shots.length, protagonist, recipe,
                  plan.presentationStyle,
                  haulManifestForGen,
                );
              } else {
                // Network / timeout: backoff 5s, retry with same prompt
                await new Promise(r => setTimeout(r, 5000));
                retryResult = await generatePhotodumpShot(
                  sh, refsWithMode, ref0Url, ref0Analysis,
                  basePrompt, narrative, destino, sessionParams,
                  plan.assignedFamilies, plan.sessionFamilies,
                  shots.length, protagonist, recipe,
                  plan.presentationStyle,
                  haulManifestForGen,
                );
              }
            } catch {
              // Segundo intento también falló — se trata como fallo definitivo
            }
          }

          if (retryResult) {
            shotUrls.push(retryResult.imageUrl);
            setPartialImages(prev => [...prev, retryResult!.imageUrl]);
            if (isAdmin) debugShots.push({
              shotIndex:  i + 1,
              role:       sh.role,
              beat:       sh.beat,
              key:        sh.key,
              prompt:     retryResult.prompt,
              refsCount:  retryResult.refsCount,
              narrativeStage: sh.narrativeStage,
              wearState:  sh.wearState,
              cameraMode: sh.cameraMode,
              fallbackUsed:    true,
              fallbackShotMode: isContentPolicy ? 'safe_required_item_retry' : 'network_backoff_retry',
              retryCount:      1,
              possibleContradictions: [isContentPolicy
                ? `content-policy retry: original failed (${errMsg.slice(0, 80)}), safe retry succeeded`
                : `network retry: original failed (${errMsg.slice(0, 80)}), backoff retry succeeded`],
              status:     'ok',
            });
          } else {
            shotUrls.push('');
            failed.push(i);
            failedErrors.push(errMsg);
            setPartialImages(prev => [...prev, '']);
            if (isAdmin) debugShots.push({
              shotIndex:  i + 1,
              role:       sh.role,
              beat:       sh.beat,
              key:        sh.key,
              prompt:     '',
              refsCount:  0,
              narrativeStage: sh.narrativeStage,
              wearState:  sh.wearState,
              cameraMode: sh.cameraMode,
              fallbackUsed:       false,
              failedCoverageItemId: sh.key ?? `shot_${i}`,
              failureReason:      errMsg.slice(0, 200),
              retryCount:         recipe === 'outfit_haul' ? 1 : 0,
              possibleContradictions: [`shot failed: ${errMsg.slice(0, 120)}`],
              status:     'failed',
            });
          }
        }
        setProgress({ total: shots.length, completed: i + 1 });
      }

      // Coverage post-generación: calculado con shots REALES (no solo el plan)
      // Construimos mini-view de debugShots que tiene key + status para computeFinalHaulCoverageFromShots
      const finalCoverage = (recipe === 'outfit_haul' && haulManifestDebug && isAdmin)
        ? computeFinalHaulCoverageFromShots(
            haulManifestDebug,
            shots,
            debugShots.map(ds => ({
              key:           ds.key,
              status:        ds.status,
              coverageRole:  ds.coverageRole,
              primaryItemId: ds.primaryItemId,
            })),
          )
        : null;

      // Para mantener backwards compat: también actualizamos el ledger original del manifest
      const haulLedger = finalCoverage?.ledger ?? haulManifestDebug?.coveragePlan.ledger;

      // Armar debugData completo para admins
      const debugData: PhotodumpDebugData | undefined = isAdmin ? {
        generatedAt:         new Date().toISOString(),
        recipe,
        basePrompt,
        inferredGender:      inferredGender,
        inferredDestination: inferredDest,
        count,
        requestedCount:       count,
        visibleImageCount:    recipe === 'outfit_check' ? visibleCount : storyShotCount + 1,
        ref0IncludedInCount:  recipe === 'outfit_check',
        storyShotCount:       storyShotCount,
        generatedImageCount:  shotUrls.filter(Boolean).length,
        failedShotCount:      failed.length,
        recoveredShotCount:   recipe === 'outfit_haul' ? debugShots.filter(ds => ds.fallbackUsed && ds.status === 'ok').length : undefined,
        unrecoveredShotCount: recipe === 'outfit_haul' ? failed.length : undefined,
        fallbackUsed:         recipe === 'outfit_haul' ? debugShots.some(ds => ds.fallbackUsed) : undefined,
        finalVisibleImageCount: recipe === 'outfit_haul' ? (shotUrls.filter(Boolean).length + 1) : undefined,
        briefContext:        briefCtxDebug,
        outfitComposition:   outfitCompositionDebug,
        destinationClass:    briefCtxDebug?.destinationClass,
        prepEnvironmentClass: briefCtxDebug?.prepEnvironmentClass,
        haulManifest:        haulManifestDebug,
        productHaulManifest: productHaulManifestDebug,
        productHaulCoverageLedger: productHaulManifestDebug?.coveragePlan.ledger,
        uncoveredRequiredItems_productHaul: productHaulManifestDebug?.coveragePlan.uncoveredRequiredItems,
        visualRefsAnalysis:  recipe === 'outfit_haul' ? visualAnalysis : undefined,
        // Detectar si el selector manual se perdió en el pipeline
        manualKindLostWarning: (() => {
          if (recipe !== 'outfit_haul' || !haulManifestDebug) return undefined;
          const uiKinds = (refsWithMode as any).haulOutfitKinds as string[] | undefined;
          if (!uiKinds || uiKinds.length === 0) return undefined;
          const lostItems = haulManifestDebug.outfitItems.filter((it, idx) => {
            const uiVal = uiKinds[idx];
            return uiVal && uiVal !== 'auto' && it.manualKind === 'auto';
          });
          return lostItems.length > 0
            ? { detected: true, lostCount: lostItems.length, lostItemIds: lostItems.map(it => it.id) }
            : { detected: false };
        })(),
        // Contexto de uso del outfit (separado de locación de captura)
        haulWearingContext: recipe === 'outfit_haul' ? (() => {
          const ctx = parseOutfitBriefContext(basePrompt);
          return {
            destinationClass:       ctx.destinationClass,
            wearingContextOnly:     ctx.wearingContextOnly,
            wearingContextStyleLabel: ctx.wearingContextStyleLabel,
            captureEnvironment:     ctx.wearingContextOnly === true
              ? 'auto_home_haul_space'
              : ctx.wearingContextOnly === false
              ? ctx.destinationClass
              : 'auto_home_haul_space',
          };
        })() : undefined,
        // Haul ledger — usa coverage post-generación si está disponible
        coverageLedger:      haulLedger,
        uncoveredRequiredItems: finalCoverage?.uncoveredRequiredItems ?? haulManifestDebug?.coveragePlan.uncoveredRequiredItems,
        supportOnlyItems:    finalCoverage?.supportOnlyItems ?? haulManifestDebug?.coveragePlan.supportOnlyItems,
        overexposedItems:    finalCoverage?.overexposedItems ?? haulManifestDebug?.coveragePlan.overexposedItems,
        failedCoverageItems: finalCoverage?.failedCoverageItems ?? failed.map(fi => shots[fi]?.key ?? `shot_${fi}`),
        coverageWarnings:    finalCoverage?.coverageWarnings ?? haulManifestDebug?.coveragePlan.coverageWarnings,
        // Coverage metrics post-generación
        finalCoverageLedger:          finalCoverage?.ledger,
        requiredItemCount:            finalCoverage?.requiredItemCount,
        coveredRequiredItemCount:     finalCoverage?.coveredRequiredItemCount,
        failedRequiredItemCount:      finalCoverage?.failedRequiredItemCount,
        requiredItemCoverageComplete: finalCoverage?.isComplete,
        // Feature flags debug — confirma que las reglas están activas en este run
        scenePropBudgetApplied:                  recipe === 'outfit_haul' || recipe === 'outfit_week',
        externalBrandingForbiddenApplied:         recipe === 'outfit_haul' || recipe === 'outfit_week',
        avatarBaseClothingSuppressedInRef0:        recipe === 'outfit_haul' || recipe === 'outfit_week',
        avatarBaseClothingSuppressedInStoryShots:  recipe === 'outfit_haul' || recipe === 'outfit_week',
        routingWarnings: (() => {
          if (recipe !== 'outfit_haul' || !haulManifestDebug) return undefined;
          const warnings: string[] = [];
          // Detectar ítems en outfitItems que son realmente footwear/jewelry (routing error)
          haulManifestDebug.outfitItems.forEach(it => {
            if (it.resolvedKind === 'footwear' || it.resolvedKind === 'jewelry') {
              warnings.push(`${it.id} (${it.label}) has resolvedKind=${it.resolvedKind} but is in outfitItems — check buildHaulManifest routing`);
            }
          });
          return warnings.length > 0 ? warnings : undefined;
        })(),
        // Run completeness verdict (real — based on actual generated shots, not just plan)
        failedShotIds: failed.map(fi => shots[fi]?.key ?? `shot_${fi}`),
        missingRequiredOutfits: finalCoverage?.uncoveredRequiredItems ?? haulManifestDebug?.coveragePlan.uncoveredRequiredItems,
        blockingIssues: finalCoverage?.blockingIssues ?? (() => {
          if (recipe !== 'outfit_haul') return undefined;
          const issues: string[] = [];
          if (failed.length > 0) issues.push(`${failed.length} shot(s) failed`);
          const uncovered = haulManifestDebug?.coveragePlan.uncoveredRequiredItems ?? [];
          if (uncovered.length > 0) issues.push(`${uncovered.length} required outfit(s) missing hero try-on: ${uncovered.join(', ')}`);
          return issues;
        })(),
        isComplete: recipe === 'outfit_haul'
          ? (finalCoverage ? finalCoverage.isComplete && failed.length === 0 : (() => {
              const uncovered = haulManifestDebug?.coveragePlan.uncoveredRequiredItems ?? [];
              return failed.length === 0 && uncovered.length === 0;
            })())
          : undefined,
        sceneFingerprintSummary: recipe === 'outfit_haul'
          ? `Haul scene fingerprint: REF0-anchored bedroom lock, controlled item movement ${storyShotCount} shots, scenePropBudget active`
          : undefined,
        sceneContinuityWarnings: recipe === 'outfit_haul' && failed.length > 0
          ? [`${failed.length} shot(s) failed — coverage gaps possible`]
          : undefined,
        // Haul World Map — mapa físico del mundo de REF0
        haulWorldMap: recipe === 'outfit_haul' && ref0Analysis
          ? buildHaulWorldMap(ref0Analysis)
          : undefined,
        // Haul Styling Graph — combinaciones semánticas entre ítems
        haulStylingGraph: recipe === 'outfit_haul' && haulManifestDebug
          ? (haulManifestDebug.stylingGraph ?? buildHaulStylingGraph(haulManifestDebug))
          : undefined,
        // Shot Item Plans — qué aparece en cada shot
        haulShotItemPlans: recipe === 'outfit_haul' && shots.length > 0
          ? Object.fromEntries(
              shots.map(s => [s.key, s.haulItemPlan]).filter(([, plan]) => plan != null)
            )
          : undefined,
        // Coverage by item — detalle explícito por ítem
        coverageByItem: (() => {
          if (recipe !== 'outfit_haul' || !haulManifestDebug) return undefined;
          const finalLedger = finalCoverage?.ledger ?? haulManifestDebug.coveragePlan.ledger;
          return haulManifestDebug.allItems.map(it => {
            const l = finalLedger.find(x => x.itemId === it.id);
            const heroShots = (l?.shotIds ?? []).filter(sk => {
              const ds = debugShots.find(d => d.key === sk);
              return ds?.coverageRole === 'hero' && ds?.status === 'ok';
            });
            const integratedShots = (l?.coverageStatus === 'integrated')
              ? (l?.shotIds ?? []).filter(sk => debugShots.find(d => d.key === sk)?.status === 'ok')
              : [];
            const supportShots = (l?.shotIds ?? []).filter(sk => {
              const ds = debugShots.find(d => d.key === sk);
              return ds?.coverageRole === 'support' && ds?.status === 'ok';
            });

            // visualRole: qué papel visual tuvo este ítem en sus shots
            type VisualRole = 'closeup' | 'worn' | 'held' | 'flatlay' | 'integrated_with_outfit' | 'background_only' | 'none';
            let visualRole: VisualRole = 'none';
            const allOkShotKeys = (l?.shotIds ?? []).filter(sk => debugShots.find(d => d.key === sk)?.status === 'ok');
            if (allOkShotKeys.length > 0) {
              const firstKey = allOkShotKeys[0];
              if (l?.coverageStatus === 'integrated') visualRole = 'integrated_with_outfit';
              else if (firstKey.startsWith('HAUL_ACCESSORY_CLOSEUP_') || firstKey.startsWith('HAUL_JEWELRY_') || firstKey.startsWith('HAUL_BAG_') || firstKey.startsWith('HAUL_FOOTWEAR_')) visualRole = 'closeup';
              else if (firstKey.startsWith('HAUL_TRY_ON_') || firstKey.startsWith('HAUL_ADJUSTING_') || firstKey.startsWith('HAUL_STYLED_') || firstKey.startsWith('HAUL_SELECTION')) visualRole = 'worn';
              else if (firstKey === 'HAUL_OVERVIEW' || firstKey === 'HAUL_RECAP') visualRole = 'flatlay';
              else if (l?.coverageStatus === 'support_only') visualRole = 'background_only';
            }

            // requiredCoverage: item is required if marked as required priority
            const requiredCoverage = it.priority === 'required';
            // covered: hero or integrated counts as primary coverage
            const covered = l?.coverageStatus === 'covered' || l?.coverageStatus === 'overexposed' || l?.coverageStatus === 'integrated';
            let coverageReason: string;
            if (covered && l?.coverageStatus === 'integrated') coverageReason = 'Appeared integrated in a compatible styled look — counts as covered';
            else if (covered) coverageReason = `${heroShots.length} hero shot(s) generated with primary ref routed`;
            else if (l?.coverageStatus === 'planned_not_routed') coverageReason = 'Shot generated ok but primary ref never reached the model';
            else if (l?.coverageStatus === 'support_only') coverageReason = 'Only appeared in background/support role — no dedicated hero shot';
            else coverageReason = 'No hero or integrated shot generated';

            let missingReason: string | undefined;
            if (!covered) {
              if (!l || l.coverageStatus === 'uncovered') missingReason = 'Item never appeared — no hero shot planned or generated';
              else if (l.coverageStatus === 'support_only') missingReason = 'Item only appeared in background/support context';
              else if (l.coverageStatus === 'planned_not_routed') missingReason = 'Shot generated but primary ref never reached the model';
            }

            return {
              itemId:             it.id,
              label:              it.label,
              manualKind:         it.manualKind,
              resolvedKind:       it.resolvedKind,
              requiredCoverage,
              coverageStatus:     l?.coverageStatus ?? 'uncovered',
              promptedHeroShots:  l?.actualPromptedHeroShots ?? 0,
              routedHeroRefs:     l?.actualRoutedHeroRefs ?? 0,
              visualRole,
              heroShotIds:        heroShots,
              integratedShotIds:  integratedShots,
              supportShotIds:     supportShots,
              covered,
              coverageReason,
              missingReason,
              allowedUseModes:    getAllowedUseModes(it.resolvedKind),
            };
          });
        })(),
        // Coverage map legado — mantener para compatibilidad
        coverageMap: (() => {
          if (recipe !== 'outfit_haul' || !haulManifestDebug) return undefined;
          const finalLedger = finalCoverage?.ledger ?? haulManifestDebug.coveragePlan.ledger;
          return haulManifestDebug.allItems.map(it => {
            const l = finalLedger.find(x => x.itemId === it.id);
            const warnings: string[] = [];
            if (!l || l.coverageStatus === 'uncovered')      warnings.push('UNCOVERED — item never appeared');
            if (l?.coverageStatus === 'support_only')        warnings.push('SUPPORT_ONLY — appeared only as background');
            if (l?.coverageStatus === 'integrated')          warnings.push('INTEGRATED — appeared in a compatible styled combo');
            if (l?.coverageStatus === 'overexposed')         warnings.push('OVEREXPOSED — too many hero shots');
            if (l?.coverageStatus === 'planned_not_routed')  warnings.push('PLANNED_NOT_ROUTED — shot existed but ref never reached the model');
            return {
              itemId:            it.id,
              manualKind:        it.manualKind,
              resolvedKind:      it.resolvedKind,
              label:             it.label,
              required:          it.priority === 'required',
              allowedUseModes:   getAllowedUseModes(it.resolvedKind),
              routedToShots:     l?.shotIds ?? [],
              coverageCount:     (l?.plannedHeroShots ?? 0) + (l?.plannedIntegratedShots ?? 0) + (l?.plannedSupportShots ?? 0),
              coverageSatisfied: l?.coverageStatus === 'covered' || l?.coverageStatus === 'integrated',
              warnings,
            };
          });
        })(),
        // Resolved refs per shot (nivel de sesión) — nunca se pobló. El equivalente útil
        // real vive por shot en PhotodumpShotDebug.resolvedRefsForShot (patch Fase 10,
        // ver debugShots.push más abajo), que sí se llena para outfit_week.
        resolvedRefsPerShot: undefined,
        // Warnings semánticos del haul
        uncoveredRequiredItemsWarnings: (() => {
          const base = finalCoverage?.uncoveredRequiredItems ?? haulManifestDebug?.coveragePlan.uncoveredRequiredItems ?? [];
          return base.length > 0 ? base.map(id => {
            const item = haulManifestDebug?.allItems.find(it => it.id === id);
            return `UNCOVERED_REQUIRED: ${item?.label ?? id} [${item?.resolvedKind ?? 'unknown'}] — needs at least 1 hero shot`;
          }) : undefined;
        })(),
        overrepresentedItemsWarnings: (() => {
          const base = finalCoverage?.overexposedItems ?? haulManifestDebug?.coveragePlan.overexposedItems ?? [];
          return base.length > 0 ? base.map(id => {
            const item = haulManifestDebug?.allItems.find(it => it.id === id);
            return `OVEREXPOSED: ${item?.label ?? id} — 3+ hero shots while other items may be uncovered`;
          }) : undefined;
        })(),
        missingAccessoryCoverageWarnings: (() => {
          if (!haulManifestDebug) return undefined;
          const finalLedger = finalCoverage?.ledger ?? haulManifestDebug.coveragePlan.ledger;
          const accItems = haulManifestDebug.accessoryItems.filter(it => it.resolvedKind === 'accessory');
          const missing = accItems.filter(it => {
            const l = finalLedger.find(x => x.itemId === it.id);
            return !l || (l.coverageStatus !== 'covered' && l.coverageStatus !== 'integrated');
          });
          return missing.length > 0 ? missing.map(it => `ACCESSORY_NOT_INTEGRATED: ${it.label} — no hero or integrated shot`) : undefined;
        })(),
        missingFootwearCoverageWarnings: (() => {
          if (!haulManifestDebug) return undefined;
          const finalLedger = finalCoverage?.ledger ?? haulManifestDebug.coveragePlan.ledger;
          const fwItems = [...haulManifestDebug.footwearItems, ...haulManifestDebug.accessoryItems.filter(it => it.resolvedKind === 'footwear')];
          const missing = fwItems.filter(it => {
            const l = finalLedger.find(x => x.itemId === it.id);
            return !l || (l.coverageStatus !== 'covered' && l.coverageStatus !== 'integrated');
          });
          return missing.length > 0 ? missing.map(it => `FOOTWEAR_NOT_INTEGRATED: ${it.label} — no hero or integrated shot`) : undefined;
        })(),
        avatarBaseClothingRisk: recipe === 'outfit_haul' || recipe === 'outfit_week',
        avatarBaseClothingLeakRisk: recipe === 'outfit_week'
          ? 'SUPPRESSED — avatar base clothing blocked in REF0 and all story shots via hard rule'
          : undefined,
        avatarBaseClothingUsedAsWeeklyItem: recipe === 'outfit_week' ? false : undefined,
        indexRoutingUsed: recipe === 'outfit_week' || recipe === 'outfit_haul',
        // Weekly manifest debug (solo outfit_week) — construido una sola vez y reutilizado
        ...(recipe === 'outfit_week' ? (() => {
          try {
            const wm = buildWeeklyManifest(refs, count, basePrompt);
            return {
              weeklyManifest:       wm,
              weeklyStructure:      wm.weeklyStructure,
              shotRoles:            wm.shotPlan.map(sp => sp.role),
              redundancyScores:     wm.redundancyDebug,
              accessoryIntegrationUsed: wm.accessoryIntegrationUsed,
              uncoveredRequiredItems_weekly: wm.uncoveredRequiredItems,
              coveredItemIds_weekly: wm.coveredItemIds,
              // Nuevos campos v3
              weeklyCoverageMap:    wm.weeklyCoverageMap,
              weeklyDominanceCheck: wm.weeklyDominanceCheck,
              weeklyAccessoryIntegrationPlan: wm.weeklyAccessoryIntegrationPlan,
              compositionVarietyMap: wm.compositionVarietyMap,
              tooManyGenericFullBodyShots: wm.tooManyGenericFullBodyShots,
              redundantShotNotReplaced:    wm.redundantShotNotReplaced,
              // Nuevos campos v4 — reference tag resolver + avatar clothing policy
              referenceTaggingUsed:            wm.referenceTagResolution?.referenceTaggingUsed ?? false,
              referenceTagResolution:          wm.referenceTagResolution,
              avatarBaseClothingPolicyApplied: wm.avatarBaseClothingPolicyApplied ?? true,
              avatarBaseClothingFingerprint:   wm.avatarBaseClothingFingerprint,
              avatarBaseClothingNegativePromptApplied: true,
            };
          } catch {
            return {
              weeklyManifest: undefined, weeklyStructure: undefined,
              shotRoles: undefined, redundancyScores: undefined,
              accessoryIntegrationUsed: undefined,
              uncoveredRequiredItems_weekly: undefined, coveredItemIds_weekly: undefined,
              weeklyCoverageMap: undefined, weeklyDominanceCheck: undefined,
              weeklyAccessoryIntegrationPlan: undefined, compositionVarietyMap: undefined,
              tooManyGenericFullBodyShots: undefined, redundantShotNotReplaced: undefined,
              referenceTaggingUsed: undefined, referenceTagResolution: undefined,
              avatarBaseClothingPolicyApplied: undefined, avatarBaseClothingFingerprint: undefined,
              avatarBaseClothingNegativePromptApplied: undefined,
            };
          }
        })() : {
          weeklyManifest: undefined, weeklyStructure: undefined,
          shotRoles: undefined, redundancyScores: undefined,
          accessoryIntegrationUsed: undefined,
          uncoveredRequiredItems_weekly: undefined, coveredItemIds_weekly: undefined,
          weeklyCoverageMap: undefined, weeklyDominanceCheck: undefined,
          weeklyAccessoryIntegrationPlan: undefined, compositionVarietyMap: undefined,
          tooManyGenericFullBodyShots: undefined, redundantShotNotReplaced: undefined,
          referenceTaggingUsed: undefined, referenceTagResolution: undefined,
          avatarBaseClothingPolicyApplied: undefined, avatarBaseClothingFingerprint: undefined,
          avatarBaseClothingNegativePromptApplied: undefined,
        }),
        unsafeHpiSuppressed: recipe === 'outfit_week' ? true : undefined,
        hpiProfileUsed: recipe === 'outfit_week' ? 'weekly_safe' : undefined,
        propBudget: recipe === 'outfit_week'
          ? 'max 1–3 neutral unbranded props per scene; no retail branding; no clutter; overview role may show more items'
          : undefined,
        brandRiskDetected: recipe === 'outfit_week'
          ? debugShots.some(ds => (ds.failureReason ?? '').toLowerCase().includes('brand'))
          : undefined,
        // Count recovery — muestra exactamente qué pasó con cada slot
        countRecoveryDebug: (recipe === 'outfit_haul' || recipe === 'outfit_week') ? (() => {
          const recovered = debugShots.filter(ds => ds.fallbackUsed && ds.status === 'ok').length;
          const generated = shotUrls.filter(Boolean).length;
          return {
            requested:  count,
            planned:    shots.length,
            generated,
            failed:     failed.length,
            recovered,
            final:      generated + 1, // +1 = REF0
          };
        })() : undefined,
        // Avatar base clothing risk flags
        avatarBaseClothingUsedAsTryOn: false, // the model cannot confirm this — it's a risk flag
        avatarBaseClothingUsedForAccessoryIntegration: false, // same — risk flag only
        // Accessory coverage map — por accesorio, qué matches se evaluaron y qué shot se asignó
        accessoryCoverageMap: recipe === 'outfit_haul' && haulManifestDebug ? (() => {
          const finalLedger = finalCoverage?.ledger ?? haulManifestDebug.coveragePlan.ledger;
          const rawLog: Record<string, Array<{ outfitId: string; score: number; reason: string; selected: boolean; integrationMode?: string }>>
            = (haulManifestDebug as any)._accessoryCompatibilityLog ?? {};
          const result: Record<string, {
            kind: string;
            manualKind?: string;
            resolvedKind?: string;
            required: boolean;
            closeupRequested: boolean;
            compatibleOutfitMatches: Array<{ outfitId: string; score: number; reason: string; selected: boolean; integrationMode?: string }>;
            promptedHeroShots: string[];
            routedHeroRefs: string[];
            integratedInShots: string[];
            closeupShots: string[];
            flatlayOnlyShots: string[];
            backgroundOnlyShots: string[];
            covered: boolean;
            coverageReason: string;
          }> = {};
          const allAccItems = [
            ...haulManifestDebug.accessoryItems,
            ...haulManifestDebug.footwearItems,
            ...haulManifestDebug.allItems.filter(it => it.resolvedKind === 'jewelry'),
          ];
          const seen = new Set<string>();
          allAccItems.forEach(it => {
            if (seen.has(it.id)) return;
            seen.add(it.id);
            const l = finalLedger.find(x => x.itemId === it.id);
            const matches = rawLog[it.id] ?? [];
            const heroShotIds = (l?.shotIds ?? []).filter(sk => debugShots.find(d => d.key === sk)?.coverageRole === 'hero' && debugShots.find(d => d.key === sk)?.status === 'ok');
            const integratedIds = (l?.coverageStatus === 'integrated') ? (l?.shotIds ?? []).filter(sk => debugShots.find(d => d.key === sk)?.status === 'ok') : [];
            const closeupsIds = heroShotIds.filter(sk => sk.startsWith('HAUL_ACCESSORY_CLOSEUP_') || sk.startsWith('HAUL_JEWELRY_') || sk.startsWith('HAUL_BAG_') || sk.startsWith('HAUL_FOOTWEAR_'));
            const flatlayIds  = (l?.shotIds ?? []).filter(sk => sk === 'HAUL_OVERVIEW' || sk === 'HAUL_RECAP');
            const bgIds       = (l?.shotIds ?? []).filter(sk => debugShots.find(d => d.key === sk)?.coverageRole === 'support');
            const covered = l?.coverageStatus === 'covered' || l?.coverageStatus === 'overexposed' || l?.coverageStatus === 'integrated';
            let coverageReason: string;
            if (l?.coverageStatus === 'integrated') coverageReason = 'Integrated into a compatible styled outfit shot';
            else if (heroShotIds.length > 0) coverageReason = `${heroShotIds.length} hero shot(s) generated`;
            else if (flatlayIds.length > 0) coverageReason = 'Flatlay only — no dedicated hero shot';
            else coverageReason = 'Not covered — no hero or integrated shot';
            result[it.id] = {
              kind:            it.kind ?? it.resolvedKind,
              manualKind:      it.manualKind,
              resolvedKind:    it.resolvedKind,
              required:        it.priority === 'required',
              closeupRequested: it.closeupRequested ?? false,
              compatibleOutfitMatches: matches,
              promptedHeroShots:  heroShotIds,
              routedHeroRefs:     heroShotIds, // same — hero shot = routed if primaryItemId matches
              integratedInShots:  integratedIds,
              closeupShots:       closeupsIds,
              flatlayOnlyShots:   flatlayIds,
              backgroundOnlyShots: bgIds,
              covered,
              coverageReason,
            };
          });
          return Object.keys(result).length > 0 ? result : undefined;
        })() : undefined,
        // Redundant closeup detection — closeups for items already in overview with no integration
        redundantAccessoryCloseups: recipe === 'outfit_haul' && haulManifestDebug ? (() => {
          const finalLedger = finalCoverage?.ledger ?? haulManifestDebug.coveragePlan.ledger;
          const redundant: string[] = [];
          haulManifestDebug.accessoryItems.forEach(it => {
            const l = finalLedger.find(x => x.itemId === it.id);
            if (!l) return;
            const heroShotIds = (l.shotIds ?? []).filter(sk => debugShots.find(d => d.key === sk)?.coverageRole === 'hero' && debugShots.find(d => d.key === sk)?.status === 'ok');
            const isCloseupOnly = heroShotIds.every(sk => sk.startsWith('HAUL_ACCESSORY_CLOSEUP_') || sk.startsWith('HAUL_JEWELRY_'));
            const hasIntegration = l.coverageStatus === 'integrated' || heroShotIds.some(sk => !sk.startsWith('HAUL_ACCESSORY_CLOSEUP_') && !sk.startsWith('HAUL_JEWELRY_'));
            if (isCloseupOnly && !hasIntegration && l.plannedHeroShots > 1) {
              redundant.push(`${it.label} (${it.id}) — ${heroShotIds.length} closeup shot(s), could integrate with compatible outfit`);
            }
          });
          return redundant.length > 0 ? redundant : undefined;
        })() : undefined,
        // Uncovered accessories
        uncoveredAccessories: recipe === 'outfit_haul' && haulManifestDebug ? (() => {
          const finalLedger = finalCoverage?.ledger ?? haulManifestDebug.coveragePlan.ledger;
          const accItems = [...haulManifestDebug.accessoryItems, ...haulManifestDebug.footwearItems];
          return accItems
            .filter(it => {
              const l = finalLedger.find(x => x.itemId === it.id);
              return !l || (l.coverageStatus !== 'covered' && l.coverageStatus !== 'integrated' && l.coverageStatus !== 'overexposed');
            })
            .map(it => it.id);
        })() : undefined,
        // Global Stability Applied (patch v5) — resumen de qué bloques se inyectaron
        globalStabilityApplied: (() => {
          const stabShots = debugShots;
          return {
            sceneFingerprintLockApplied:          recipe !== 'outfit_check',
            avatarBaseClothingSuppressedGlobally: true,
            wardrobePhysicalIntegrationApplied:   true,
            anatomySafetyApplied:                 true,
            visualItemFidelityApplied:            true,
            externalBrandingForbiddenApplied:     true,
            readableTextForbiddenApplied:         true,
            shotsWithSceneLock:          stabShots.filter(s => s.globalStabilityBlocks?.sceneFingerprintLockApplied).length,
            shotsWithAvatarSuppression:  stabShots.filter(s => s.globalStabilityBlocks?.avatarBaseClothingSuppressedGlobally).length,
            shotsWithWardrobePhysics:    stabShots.filter(s => s.globalStabilityBlocks?.wardrobePhysicalIntegrationApplied).length,
            shotsWithAnatomySafety:      stabShots.filter(s => s.globalStabilityBlocks?.anatomySafetyApplied).length,
            shotsWithVisualFidelity:     stabShots.filter(s => s.globalStabilityBlocks?.visualItemFidelityApplied).length,
            sceneViolationWarnings:      [] as string[],
            propBudgetWarnings:          [] as string[],
            briefBindingCompliance:      undefined as any,
            narrativeDiversityPlannerApplied: recipe === 'outfit_week' || recipe === 'outfit_haul',
            overRepeatedPrimaryItems:    [] as string[],
            redundantLastShotReplaced:   false,
            accessoryIntegrationApplied: recipe === 'outfit_week'
              ? stabShots.some(s => s.role?.includes('ACCESSORY_INTEGRATED') || s.role?.includes('ACCESSORY_WORN'))
              : recipe === 'outfit_haul'
                ? stabShots.some(s => s.key?.includes('ACCESSORY') || s.key?.includes('JEWELRY'))
                : false,
            accessoryOnlyMacroRisk: false,
          };
        })(),
        plan,
        shots:               debugShots,
      } : undefined;

      setSavedDebugData(debugData);

      setProgressStepIndex(4);
      const captions = await generatePhotodumpCaptions(basePrompt, narrative, shots, refs.gender ?? 'female');
      setSavedCaptions(captions);
      setSavedShotUrls(shotUrls);

      setProgressStepIndex(4);

      if (failed.length > 0 && shotUrls.filter(Boolean).length === 0) {
        if (!isAdmin) {
          await refundProCredit().catch(() => {});
          await deductCredits(-imageCreditCost).catch(() => {});
          await refreshCredits().catch(() => {});
        }
        const firstErr = failedErrors[0] ?? '';
        const hint = firstErr.toLowerCase().includes('content')
          || firstErr.toLowerCase().includes('filter')
          || firstErr.toLowerCase().includes('block')
          || firstErr.toLowerCase().includes('policy')
          ? '⚠️ La IA bloqueó las imágenes por contenido. Intentá con un brief más neutro o cambiá las referencias.'
          : firstErr.toLowerCase().includes('timeout') || firstErr.toLowerCase().includes('timed out')
          ? '⏱ La generación tardó demasiado. Intentá con menos imágenes o volvé a intentar en unos segundos.'
          : firstErr.toLowerCase().includes('429') || firstErr.toLowerCase().includes('quota') || firstErr.toLowerCase().includes('exhausted')
          ? '🔄 La API está saturada. Esperá unos segundos e intentá de nuevo.'
          : `⚠️ No se pudo generar ninguna imagen. ${firstErr ? `Motivo: ${firstErr.slice(0, 120)}` : 'Intentá de nuevo.'}`;
        setFailureHint(hint);
        setError(hint);
        setStep(2);
        return;
      }

      if (failed.length > 0) {
        setFailedIndexes(failed);
        return;
      }

      await finalizarSet(shotUrls, shots, captions, ref0Url, debugData);
    } catch (err: any) {
      setError(err?.message || 'Error generando el photodump.');
      if (!isAdmin) {
        await refundProCredit().catch(() => {});
        await deductCredits(-imageCreditCost).catch(() => {});
        await refreshCredits().catch(() => {});
      }
      setStep(2);
    } finally {
      setIsGenerating(false);
      setProgress(null);
    }
  };

  // ── Retry ─────────────────────────────────────────────────
  const handleRetryFailed = async () => {
    if (failedIndexes.length === 0 || savedPlan === null) return;
    setIsGenerating(true);
    setError(null);
    setRetryingIndexes(failedIndexes);

    const recipeMeta  = RECIPE_META[recipe];
    const narrative   = recipeMeta.narrative;
    const protagonist = recipeMeta.protagonist;

    const sessionId = newSessionId();
    const sessionParams = { uid: user?.uid, sessionId };
    const refsWithMode  = { ...refs, outfitMode };
    const newUrls = [...savedShotUrls];
    const stillFailed: number[] = [];

    // Reusar el REF0 original para mantener la identidad visual del set.
    // Regenerar uno nuevo produciría una paleta/luz distinta y el shot retried quedaría fuera del set.
    const ref0Url      = savedRef0Url;
    const ref0Analysis = savedRef0Analysis;

    for (let ri = 0; ri < failedIndexes.length; ri++) {
      // En retry siempre usamos 25s: los shots fallidos ya están en la zona de rate-limit
      if (ri > 0) await new Promise(r => setTimeout(r, 25000));
      const i = failedIndexes[ri];
      try {
        const result = await generatePhotodumpShot(
          savedShots[i], refsWithMode, ref0Url, ref0Analysis,
          basePrompt, narrative, destino, sessionParams,
          savedPlan.assignedFamilies, savedPlan.sessionFamilies,
          savedShots.length, protagonist, recipe,
          savedPlan.presentationStyle,
        );
        newUrls[i] = result.imageUrl;
        setPartialImages(prev => { const n = [...prev]; n[i + 1] = result.imageUrl; return n; });
      } catch {
        stillFailed.push(i);
      }
    }

    setSavedShotUrls(newUrls);
    setRetryingIndexes([]);

    if (stillFailed.length > 0) {
      setFailedIndexes(stillFailed);
      setIsGenerating(false);
      return;
    }

    setFailedIndexes([]);
    await finalizarSet(newUrls, savedShots, savedCaptions, undefined, savedDebugData);
    setIsGenerating(false);
  };

  const handleContinuePartial = async () => {
    await finalizarSet(savedShotUrls, savedShots, savedCaptions, undefined, savedDebugData);
  };

  // ── Guardar set y avanzar a resultados ────────────────────
  const finalizarSet = async (shotUrls: string[], shots: any[], captions: { caption: string; hashtags: string } | null, ref0Url?: string, debugData?: PhotodumpDebugData) => {
    const recipeMeta  = RECIPE_META[recipe];
    const anchorUrl   = ref0Url ?? savedRef0Url;
    // outfit_multi_look: el ancla ES shotUrls[0] (el primer look, misma
    // imagen, ver recipes/outfitMultiLook/anchorFixed.ts). outfit_reveal_basic:
    // el ancla ES shotUrls[0] (mirror_check, ver recipes/outfitRevealBasic/index.ts).
    // En ninguna de las dos se agrega aparte, para no duplicarla en el set guardado.
    const anchorImage = (anchorUrl && recipe !== 'outfit_multi_look' && recipe !== 'outfit_reveal_basic') ? [{
      imageUrl: anchorUrl,
      moment:   'Imagen ancla',
      caption:  '',
      hashtags: '',
      prompt:   'Visual anchor — establishes identity, light and color for the set.',
      order:    0,
    }] : [];
    const set: PhotodumpSet = {
      id:          Date.now().toString(),
      createdAt:   Date.now(),
      basePrompt,
      recipe,
      narrative:   recipeMeta.narrative,
      protagonist: recipeMeta.protagonist,
      destino,
      customStory: '',
      count,
      refs: { avatarRef: null, productRef: null, outfitRef: null, sceneRef: null, outfitMode },
      ...(debugData ? { debugData } : {}),
      images: [
        ...anchorImage,
        ...shotUrls.map((url, i) => ({
          imageUrl: url,
          moment:   `Imagen ${i + 1}`,
          // El caption y hashtags van solo en la primera imagen del set (orden 1)
          caption:  i === 0 ? (captions?.caption  ?? '') : '',
          hashtags: i === 0 ? (captions?.hashtags ?? '') : '',
          prompt:   shots[i]?.purpose ?? '',
          order:    i + 1,
        })).filter(img => img.imageUrl),
      ],
    };

    await photodumpStorage.save(set);
    await loadSets();
    setCurrentSet(set);
    setFailedIndexes([]);
    setStep(4);
    await refreshCredits();
  };

  // ─────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────
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
              <button
                onClick={() => { setActiveTab('create'); resetCreator(); window.scrollTo(0, 0); }}
                className={`px-5 md:px-8 py-2 md:py-3 rounded-xl t-meta transition-colors duration-150 ${activeTab === 'create' ? 'bg-brand-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-700'}`}>
                Crear
              </button>
              <button
                onClick={() => { setActiveTab('library'); window.scrollTo(0, 0); }}
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
              steps={wizardSteps}
              current={Math.min(step, wizardSteps.length) as any}
              onJump={(s) => {
                const n = Number(s) as WizardStep;
                if (n < step && !isGenerating) setStep(n);
              }}
            />

            <div className="flex-1 overflow-auto">

              {/* ── PASO 1: TIPO DE CONTENIDO ───────────── */}
              {step === 1 && (
                <PDStep1
                  recipe={recipe}
                  destino={destino}
                  onRecipe={r => { setRecipe(r); }}
                  onDestino={setDestino}
                />
              )}

              {/* ── PASO 2: PRESETS (barra siempre visible) ─ */}
              {step === 2 && !isFree && (
                <div className="px-4 md:px-8 pt-4">
                  <button
                    onClick={() => setShowPresets(o => !o)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl
                               border border-slate-200 hover:border-brand-300 hover:bg-brand-50
                               text-slate-500 hover:text-brand-700 text-xs font-black uppercase
                               tracking-widest transition-all"
                  >
                    <BookMarked className="w-3.5 h-3.5" />
                    {showPresets
                      ? 'Ocultar presets'
                      : presetManager.presets.length > 0
                        ? `Cargar preset (${presetManager.presets.length})`
                        : 'Guardar / cargar preset'}
                  </button>
                  {showPresets && (
                    <div className="mt-3 mb-1">
                      <PresetManagerPanel
                        manager={presetManager}
                        onLoad={handleLoadPreset}
                        suggestedName={photodumpPresetAdapter.defaultName!(currentPresetState)}
                        emptyLabel="No tenés presets de Photodump guardados"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* ── PASO 2: BRIEF + REFS (modo recetas) ─── */}
              {step === 2 && !isFree && failureHint && (
                <div className="mx-4 md:mx-8 mt-4 p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-[12px] text-rose-700 font-medium flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span className="leading-snug">{failureHint}</span>
                  <button onClick={() => setFailureHint(null)} className="ml-auto text-rose-400 hover:text-rose-600 text-lg leading-none flex-shrink-0">×</button>
                </div>
              )}
              {step === 2 && !isFree && (
                <PDStep2Receta
                  recipe={recipe}
                  count={count}
                  basePrompt={basePrompt}
                  refs={refs}
                  outfitMode={outfitMode}
                  onCount={setCount}
                  onPrompt={setBasePrompt}
                  onRefs={setRefs}
                  onOutfitMode={m => { setOutfitMode(m); setRefs(r => ({ ...r, outfitMode: m })); }}
                />
              )}

              {/* ── PASO 2: EDITOR LIBRE ────────────────── */}
              {step === 2 && isFree && (
                <>
                  {error && (
                    <div className="mx-4 md:mx-8 mt-4 p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-[12px] text-rose-700 font-medium flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span>{error}</span>
                      <button onClick={() => setError(null)} className="ml-auto text-rose-400 hover:text-rose-600 text-lg leading-none flex-shrink-0">×</button>
                    </div>
                  )}
                  <PDLibreEditor
                    scenes={freeScenes}
                    generatingIndex={generatingFreeIndex}
                    modelId={modelId}
                    onModelId={setModelId}
                    onUpdateScene={updateFreeScene}
                    onAddScene={addFreeScene}
                    onRemoveScene={removeFreeScene}
                    onGenerateScene={generateFreeScene}
                    onResetAll={resetCreator}
                  />
                </>
              )}

              {/* ── PASO 3: GENERANDO (solo modo recetas) ─ */}
              {step === 3 && !isFree && (
                <div className="fade-in p-4 md:p-8">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-5 md:gap-7 items-start">
                    <div className="md:col-span-5 lg:col-span-4">
                      {isGenerating ? (
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-2 h-2 rounded-full bg-brand-600 animate-pulse" />
                          <span className="text-[10px] font-black text-brand-600 uppercase tracking-[0.18em]">Generando · no cierres esta ventana</span>
                        </div>
                      ) : failedIndexes.length > 0 ? (
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-2 h-2 rounded-full bg-rose-500" />
                          <span className="text-[10px] font-black text-rose-600 uppercase tracking-[0.18em]">
                            {failedIndexes.length} imagen{failedIndexes.length > 1 ? 'es' : ''} no se generó{failedIndexes.length > 1 ? 'n' : ''}
                          </span>
                        </div>
                      ) : null}
                      <h2 className="font-display font-extrabold italic uppercase tracking-tight text-[22px] md:text-[26px] text-slate-900 leading-tight"
                        style={{ fontFamily: 'Syne, Inter, sans-serif', letterSpacing: '-0.025em' }}>
                        {RECIPE_META[recipe].label}
                      </h2>
                      <div className="text-[13px] text-slate-500 mt-1 mb-4 line-clamp-2 italic">
                        "{basePrompt}"
                      </div>
                      {isGenerating && (
                        <div className="bg-white border border-slate-200 rounded-2xl p-4 md:p-[18px]">
                          <GenProgress
                            steps={GENERATION_STEPS}
                            currentStepIndex={progressStepIndex}
                            completedShots={partialImages.map((url, i) => ({ url, index: i }))}
                            totalShots={count}
                          />
                        </div>
                      )}
                      {!isGenerating && failedIndexes.length > 0 && (
                        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 space-y-3">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="text-[12px] font-bold text-rose-800">
                                {failedIndexes.length} imagen{failedIndexes.length > 1 ? 'es no se generaron' : ' no se generó'} correctamente.
                              </p>
                              <p className="text-[11px] text-rose-600 mt-0.5 leading-snug">
                                Podés regenerarlas sin costo adicional.
                              </p>
                            </div>
                          </div>
                          <button type="button" onClick={handleRetryFailed}
                            className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-[12px] font-bold transition-colors flex items-center justify-center gap-2">
                            <RefreshCw size={13} />
                            Regenerar {failedIndexes.length} imagen{failedIndexes.length > 1 ? 'es' : ''}
                          </button>
                          <button type="button" onClick={handleContinuePartial}
                            className="w-full py-2 text-[11px] text-rose-500 hover:text-rose-700 font-semibold transition-colors">
                            Continuar con las {count - failedIndexes.length} que se generaron →
                          </button>
                        </div>
                      )}
                      {error && (
                        <div className="mt-3 p-4 bg-rose-50 border border-rose-200 rounded-2xl text-[12px] text-rose-700 font-medium flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />{error}
                        </div>
                      )}
                    </div>

                    <div className="md:col-span-7 lg:col-span-8">
                      <div className="flex justify-between items-baseline mb-3">
                        <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.14em]">
                          Imágenes del set
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {isGenerating
                            ? `${progress?.completed ?? 0} de ${count} listas`
                            : failedIndexes.length > 0
                            ? `${count - failedIndexes.length} de ${count} generadas`
                            : `${count} de ${count} listas`}
                        </div>
                      </div>
                      <div className={`grid gap-3 ${count <= 4 ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-3'}`}>
                        {/* Imagen ancla (REF0) — outfit_multi_look y outfit_reveal_basic no la
                            muestran aparte: el ancla ES el primer shot real (look 1 / mirror_check),
                            ya visible en su propio slot del grid de abajo (misma imagen, sin
                            generación extra). */}
                        {recipe !== 'outfit_multi_look' && recipe !== 'outfit_reveal_basic' && partialImages[0] && (
                          <div
                            style={{ aspectRatio: DESTINO_META[destino].aspectRatio }}
                            className="relative rounded-2xl overflow-hidden fade-in shadow-md border-2 border-violet-300"
                          >
                            <img src={partialImages[0]} alt="Imagen ancla" className="w-full h-full object-cover" />
                            <div className="absolute top-2 left-2 right-2 flex items-center gap-1 bg-violet-600/90 backdrop-blur-sm px-2 py-1 rounded-full w-fit">
                              <Sparkles size={8} className="text-violet-200 flex-shrink-0" />
                              <span className="text-[8px] font-bold text-white uppercase tracking-wider">Ancla</span>
                            </div>
                          </div>
                        )}
                        {recipe !== 'outfit_multi_look' && recipe !== 'outfit_reveal_basic' && !partialImages[0] && progressStepIndex >= 1 && (
                          <div
                            style={{ aspectRatio: DESTINO_META[destino].aspectRatio }}
                            className="relative rounded-2xl overflow-hidden border-2 border-violet-300 bg-violet-50 animate-pulse"
                          >
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="bg-white/95 rounded-full px-3 py-1 text-[9px] font-bold text-violet-600 tracking-wide uppercase">Generando ancla...</div>
                            </div>
                          </div>
                        )}
                        {Array.from({ length: count }).map((_, i) => {
                          // outfit_multi_look / outfit_reveal_basic: partialImages[0] YA es el
                          // primer shot real (el ancla fusionada, sin generación aparte) — sin
                          // offset. El resto de recetas reserva el índice 0 para el ancla mostrada
                          // en su propio recuadro arriba.
                          const shotIndexInArray = (recipe === 'outfit_multi_look' || recipe === 'outfit_reveal_basic') ? i : i + 1;
                          const shotUrl  = partialImages[shotIndexInArray] ?? null;
                          const imgUrl   = shotUrl ?? '';
                          const done     = !!shotUrl;
                          const isFailed = !isGenerating && failedIndexes.includes(i);
                          const retrying = retryingIndexes.includes(i);
                          const active   = isGenerating && !done && !isFailed && !retrying
                            ? i === (progress?.completed ?? 0) : false;
                          return (
                            <div key={i}
                              style={{ aspectRatio: DESTINO_META[destino].aspectRatio }}
                              className={`relative rounded-2xl overflow-hidden transition-all ${
                                done     ? 'fade-in shadow-md' :
                                retrying ? 'border-2 border-amber-400 bg-amber-50 animate-pulse' :
                                isFailed ? 'border-2 border-rose-300 bg-rose-50' :
                                active   ? 'border-2 border-brand-600 bg-slate-100 animate-pulse' :
                                'bg-slate-100'
                              }`}>
                              {imgUrl && <img src={imgUrl} alt={`Imagen ${i + 1}`} className="w-full h-full object-cover" />}
                              {retrying && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                                  <div className="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                                  <span className="text-[9px] font-bold text-amber-600 uppercase tracking-wider">Reintentando</span>
                                </div>
                              )}
                              {active && !imgUrl && (
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <div className="bg-white/95 rounded-full px-3.5 py-1.5 text-[10px] font-bold text-brand-600 tracking-[0.12em] uppercase">Generando...</div>
                                </div>
                              )}
                              {isFailed && !retrying && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5">
                                  <AlertTriangle className="w-5 h-5 text-rose-400" strokeWidth={1.5} />
                                  <span className="text-[9px] font-bold text-rose-500 uppercase tracking-wider">No generada</span>
                                </div>
                              )}
                              {!done && !active && !isFailed && !retrying && (
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

              {/* ── PASO 4: RESULTADOS ──────────────────── */}
              {step === 4 && currentSet && (
                <div className="fade-in p-4 md:p-6">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-5">
                    <div>
                      <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
                        <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                          <Check size={12} strokeWidth={3} />
                        </div>
                        <span className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.18em]">
                          Historia lista · {currentSet.images.filter(x => x.order > 0).length} imágenes + ancla · {RECIPE_META[currentSet.recipe ?? 'day_in_life']?.label ?? NARRATIVE_META[currentSet.narrative].label}
                        </span>
                      </div>
                      <p className="text-[13px] text-slate-500 italic line-clamp-1">"{currentSet.basePrompt}"</p>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <button type="button" onClick={() => downloadSetZip(currentSet)}
                        className="flex items-center gap-1.5 bg-white border border-slate-200 hover:border-slate-300 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-700 transition-colors">
                        <Download size={13} /> ZIP
                      </button>
                      {isAdmin && currentSet.debugData && (
                        <button
                          type="button"
                          onClick={() => {
                            const blob = new Blob(
                              [JSON.stringify(currentSet.debugData, null, 2)],
                              { type: 'application/json' },
                            );
                            const a = document.createElement('a');
                            a.href = URL.createObjectURL(blob);
                            a.download = `photodump_debug_${currentSet.id.slice(-8)}.json`;
                            a.click();
                            URL.revokeObjectURL(a.href);
                          }}
                          className="flex items-center gap-1.5 bg-amber-50 border border-amber-300 hover:border-amber-400 rounded-xl px-3.5 py-2 text-xs font-semibold text-amber-700 transition-colors"
                          title="Solo visible para admins"
                        >
                          <Download size={13} /> Debug JSON
                        </button>
                      )}
                      <button type="button" onClick={resetCreator}
                        className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors">
                        <Plus size={13} /> Nuevo set
                      </button>
                    </div>
                  </div>

                  {/* Caption del set — uno solo para todo el carrusel */}
                  {(() => {
                    const firstShot = currentSet.images.find(img => img.order === 1);
                    if (!firstShot?.caption) return null;
                    return (
                      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2.5">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Caption del set</p>
                        <p className="text-[13px] text-slate-700 leading-relaxed">{firstShot.caption}</p>
                        {firstShot.hashtags && (
                          <p className="text-[12px] text-violet-500 leading-relaxed">{firstShot.hashtags}</p>
                        )}
                        <div className="flex gap-2 pt-1 border-t border-slate-200">
                          <button type="button"
                            onClick={() => copyText(firstShot.caption + '\n\n' + firstShot.hashtags, 'set-full')}
                            className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-brand-600 transition-colors font-medium">
                            {copiedKey === 'set-full' ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                            {copiedKey === 'set-full' ? 'Copiado' : 'Copiar caption + hashtags'}
                          </button>
                          <button type="button"
                            onClick={() => copyText(firstShot.hashtags, 'set-ht')}
                            className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-violet-600 transition-colors font-medium">
                            {copiedKey === 'set-ht' ? <Check size={11} className="text-emerald-500" /> : <Hash size={11} />}
                            {copiedKey === 'set-ht' ? 'Copiado' : 'Solo hashtags'}
                          </button>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Grid de imágenes */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {currentSet.images.map((img, i) => {
                      const isAnchor = img.order === 0;
                      return (
                      <div key={i}
                        className={`bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer group border ${isAnchor ? 'border-violet-200 hover:border-violet-400' : 'border-slate-200 hover:border-brand-200'}`}
                        onClick={() => openLightbox(currentSet.images.map(x => x.imageUrl), i)}
                      >
                        <div
                          style={{ aspectRatio: DESTINO_META[currentSet.destino ?? 'feed'].aspectRatio }}
                          className="relative bg-slate-100 overflow-hidden"
                        >
                          <img src={img.imageUrl} alt={img.moment}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                          <div className="absolute top-2 left-2 flex gap-1.5">
                            {isAnchor ? (
                              <div className="bg-violet-600/90 backdrop-blur-sm px-2.5 py-1 rounded-full flex items-center gap-1">
                                <Sparkles size={9} className="text-violet-200" />
                                <span className="text-[10px] font-bold text-white">Imagen ancla</span>
                              </div>
                            ) : (
                              <>
                                <div className="bg-white/90 backdrop-blur-sm rounded-full w-6 h-6 flex items-center justify-center">
                                  <span className="text-[10px] font-black text-brand-600">{img.order}</span>
                                </div>
                                <div className="bg-black/50 backdrop-blur-sm px-2.5 py-1 rounded-full">
                                  <span className="text-[10px] font-semibold text-white">{img.moment}</span>
                                </div>
                              </>
                            )}
                          </div>
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3 gap-2">
                            <button type="button"
                              onClick={e => { e.stopPropagation(); const a = document.createElement('a'); a.href = img.imageUrl; a.download = `photodump_${isAnchor ? 'ancla' : img.order}.png`; a.click(); }}
                              className="flex-1 py-1.5 rounded-xl bg-white/90 text-[11px] font-semibold text-slate-800 text-center hover:bg-white transition-colors flex items-center justify-center gap-1">
                              <Download size={11} /> Descargar
                            </button>
                            <div className="flex-1 py-1.5 rounded-xl bg-brand-600 text-[11px] font-semibold text-white text-center flex items-center justify-center gap-1">
                              <ImageIcon size={11} /> Ver →
                            </div>
                          </div>
                        </div>

                        {isAnchor && (
                          <div className="px-3.5 py-2.5">
                            <p className="text-[10px] text-violet-500 font-semibold leading-snug">
                              Ancla visual del set — establece identidad, luz y color para todas las imágenes.
                            </p>
                          </div>
                        )}
                      </div>
                    );
                    })}
                  </div>

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
                      {isAdmin && currentSet.debugData && (
                        <button
                          type="button"
                          onClick={() => {
                            const blob = new Blob(
                              [JSON.stringify(currentSet.debugData, null, 2)],
                              { type: 'application/json' },
                            );
                            const a = document.createElement('a');
                            a.href = URL.createObjectURL(blob);
                            a.download = `photodump_debug_${currentSet.id.slice(-8)}.json`;
                            a.click();
                            URL.revokeObjectURL(a.href);
                          }}
                          className="flex items-center gap-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-700 rounded-xl px-4 py-3 text-[13px] font-semibold transition-colors"
                        >
                          <Download size={14} /> Debug JSON
                        </button>
                      )}
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
            {/* Paso 1 siempre muestra footer */}
            {step === 1 && (
              <WizardFooter
                onContinue={() => setStep(2)}
                continueLabel="Continuar"
                disabled={!canStep1}
              />
            )}
            {/* Paso 2 modo recetas */}
            {step === 2 && !isFree && (
              <WizardFooter
                onBack={() => setStep(1)}
                onContinue={handleGenerate}
                continueLabel={`Crear historia visual · ${count} imágenes`}
                disabled={!canStep2Receta || insufficient}
                costInfo={{ cost: imageCreditCost, label: 'Créditos totales' }}
                loading={isGenerating}
              />
            )}
            {/* Paso 2 modo libre — no hay footer global, la generación es por escena */}
            {step === 2 && isFree && (
              <WizardFooter
                onBack={() => setStep(1)}
                onContinue={() => {}}
                continueLabel="Listo"
                disabled={false}
              />
            )}
          </div>
        )}

        {/* ══════════════ BIBLIOTECA ══════════════ */}
        {activeTab === 'library' && (
          <ResultLibraryGrid
            loading={loadingSets}
            stats={[
              { label: 'Sets',      value: sets.length,                                                          sub: 'guardados'  },
              { label: 'Imágenes',  value: sets.reduce((s, c) => s + (c.images?.length ?? 0), 0),               sub: 'generadas', color: 'text-brand-600' },
            ]}
            searchTexts={sets.map(s => `${RECIPE_META[s.recipe ?? 'day_in_life']?.label ?? NARRATIVE_META[s.narrative]?.label ?? ''} ${s.basePrompt}`)}
            emptyTitle="Biblioteca vacía"
            emptyDescription="Creá tu primer set para verlo aquí"
            emptyCtaLabel="Crear set"
            emptyIcon={<Images className="w-10 h-10 text-slate-300" />}
            onEmpty={() => setActiveTab('create')}
            primaryAction={{ label: 'Crear set', onClick: () => setActiveTab('create'), icon: <Sparkles size={13} /> }}
          >
            {sets.map(set => (
              <ResultCard
                key={set.id}
                images={set.images.map(i => i.imageUrl).filter(Boolean).slice(0, 3)}
                title={`${RECIPE_META[set.recipe ?? 'day_in_life']?.label ?? NARRATIVE_META[set.narrative]?.label ?? 'Photodump'}`}
                subtitle={set.basePrompt}
                date={set.createdAt}
                badge={{ label: '✓ Completado', color: 'green' }}
                pills={[
                  `${set.images.length} momentos`,
                  ...(set.destino ? [DESTINO_META[set.destino]?.label ?? set.destino] : []),
                ]}
                refSlots={[
                  ...(set.refs?.avatarRef   ? [{ label: 'Avatar',   src: set.refs.avatarRef   }] : []),
                  ...(set.refs?.productRef  ? [{ label: 'Producto', src: set.refs.productRef  }] : []),
                  ...(set.refs?.outfitRef   ? [{ label: 'Outfit',   src: set.refs.outfitRef   }] : []),
                  ...(set.refs?.sceneRef    ? [{ label: 'Escena',   src: set.refs.sceneRef    }] : []),
                ]}
                onClick={() => openSetFromLibrary(set)}
                actions={[
                  { label: 'Ver →',  onClick: e => { e.stopPropagation(); openSetFromLibrary(set); }, variant: 'primary'   },
                  { label: '↓ ZIP',  onClick: e => { e.stopPropagation(); downloadSetZip(set); },     variant: 'secondary' },
                  { label: '', icon: <Trash2 size={12} />, onClick: async e => { e.stopPropagation(); setDeletingId(set.id); await photodumpStorage.delete(set.id); await loadSets(); setDeletingId(null); }, variant: 'danger', loading: deletingId === set.id, title: 'Eliminar' },
                ]}
              />
            ))}
          </ResultLibraryGrid>
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
