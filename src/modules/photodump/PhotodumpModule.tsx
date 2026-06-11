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
  Plus, Hash, RefreshCw, AlertTriangle,
  Image as ImageIcon,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { downloadAsZip } from '../../utils/imageUtils';
import { ImageLightbox } from '../../components/shared/ImageLightbox';
import { newSessionId } from '../../services/imageApiService';
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

  // ── Costos modo recetas ───────────────────────────────────
  const imageCreditCost = (count + 1) * CREDITS_PER_IMAGE;
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

      setProgressStepIndex(0);
      const plan  = await buildPhotodumpSessionPlan(narrative, protagonist, destino, basePrompt, recipe, refsWithMode, count);
      const shots = plan.shots.slice(0, count);
      setSavedShots(shots);
      setSavedPlan(plan);

      setProgressStepIndex(1);
      const ref0Result = await generatePhotodumpREF0(
        refsWithMode, narrative, protagonist, destino, basePrompt, sessionParams, recipe,
      );
      const ref0Url      = ref0Result.imageUrl;
      const ref0Analysis = ref0Result.ref0Analysis;
      setSavedRef0Url(ref0Url);
      setSavedRef0Analysis(ref0Analysis);
      setPartialImages([ref0Url]);

      // Debug: acumular prompts de cada shot (solo para admins)
      const inferredDest = isAdmin ? inferDestinationFromBrief(basePrompt) : 'none' as const;
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

      setProgressStepIndex(2);
      const shotUrls: string[] = [];
      const failed: number[]   = [];
      const failedErrors: string[] = [];
      for (let i = 0; i < shots.length; i++) {
        // Pausa entre shots para no saturar la API de Gemini (429 a partir del 6° request rápido)
        if (i > 0) await new Promise(r => setTimeout(r, 1500));
        const sh = shots[i];
        try {
          const result: PhotodumpShotResult = await generatePhotodumpShot(
            sh, refsWithMode, ref0Url, ref0Analysis,
            basePrompt, narrative, destino, sessionParams,
            plan.assignedFamilies, plan.sessionFamilies,
            shots.length, protagonist, recipe,
            plan.presentationStyle,
          );
          shotUrls.push(result.imageUrl);
          setPartialImages(prev => [...prev, result.imageUrl]);
          if (isAdmin) {
            // Detección de contradicciones para debug
            const contradictions: string[] = [];
            if (sh.wearState === 'not_wearing_final_outfit' && sh.requiredElements.includes('complete_outfit_readable_head_to_toe'))
              contradictions.push('wearState=not_wearing_final_outfit pero requiredElements pide complete_outfit');
            if (sh.cameraMode === 'mirror_selfie' && sh.forbiddenElements.includes('phone_visible_in_mirror') === false)
              contradictions.push('mirror_selfie sin bloqueo explícito de teléfono visible');
            // sceneRole is derived — no field on sh

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
              sceneRole:        sh.narrativeStage === 'destination' ? 'destination' : sh.narrativeStage === 'prep' ? 'prep_space' : 'neutral',  // derivado de narrativeStage
              shotIntent:       sh.purpose?.slice(0, 120),
              presentationStyle: plan.presentationStyle,
              mustNotWearFinalOutfit: sh.wearState === 'not_wearing_final_outfit',
              mustWearFinalOutfit:    sh.wearState === 'wearing_full_outfit' || sh.wearState === 'ready_to_leave' || sh.wearState === 'destination_arrived',
              mustShowMirror:    sh.cameraMode === 'mirror_selfie',
              destinationInferred: inferredDest,
              destinationExplicitRefProvided: !!(refsWithMode as any).sceneDestinoRef,
              promptLayersApplied: [
                'LOCK_SYSTEM', 'PARADIGM_RULE', 'STORY_MODE', 'BRIEF_CONTEXT',
                sh.wearState  ? 'WEAR_STATE'   : null,
                sh.cameraMode ? 'CAMERA_MODE'  : null,
                sh.hpiAllowed ? 'HPI'          : 'HPI_DISABLED',
                'REF0_ANALYSIS', 'SHOT_IDENTITY', 'VARIATION_SPACE',
              ].filter(Boolean) as string[],
              hpiApplied:      !!sh.hpiAllowed,
              hpiProfileUsed:  sh.hpiScope ?? 'none',
              possibleContradictions: contradictions.length > 0 ? contradictions : undefined,
              status:       'ok',
            });
          }
        } catch (shotErr: any) {
          shotUrls.push('');
          failed.push(i);
          failedErrors.push(shotErr?.message ?? '');
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
            possibleContradictions: [`shot failed: ${shotErr?.message ?? 'unknown'}`],
            status:     'failed',
          });
        }
        setProgress({ total: shots.length, completed: i + 1 });
      }

      // Armar debugData completo para admins
      const debugData: PhotodumpDebugData | undefined = isAdmin ? {
        generatedAt:         new Date().toISOString(),
        recipe,
        basePrompt,
        inferredGender:      inferredGender,
        inferredDestination: inferredDest,
        count,
        plan,
        shots:               debugShots,
      } : undefined;

      setSavedDebugData(debugData);

      setProgressStepIndex(3);
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
      if (ri > 0) await new Promise(r => setTimeout(r, 1500));
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
    const anchorImage = anchorUrl ? [{
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
                        {/* Imagen ancla (REF0) */}
                        {partialImages[0] && (
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
                        {!partialImages[0] && progressStepIndex >= 1 && (
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
                          const shotUrl  = partialImages[i + 1] ?? null;
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
