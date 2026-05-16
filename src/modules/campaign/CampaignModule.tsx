import React, { useState, useEffect, useRef } from 'react';
import {
  Megaphone, Download, Zap, Check, Sparkles,
  Library, Trash2, Copy, ChevronDown, RefreshCw,
  AlertTriangle, Plus, FileText, Calendar, Hash,
  Image as ImageIcon, X, ChevronRight,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { downloadAsZip, readAndCompressFile } from '../../utils/imageUtils';
import { ImageLightbox } from '../../components/shared/ImageLightbox';
import { newSessionId } from '../../services/imageApiService';
import {
  generateAnchorImagesFromBrief,
  analyzeAnchorImage,
  buildCampaignPlanFromAnchor,
  generateCampaignImages,
} from './campaignService';
import { downloadCampaignPdf, downloadCampaignHtml } from './campaignPdfService';
import { campaignStorage } from './campaignStorage';
import {
  CampaignSet, CampaignChannel, CampaignImageSlot, ImageSlotRole,
  CampaignAnchorAnalysis,
  CAMPAIGN_CHANNEL_META, IMAGE_SLOT_META, ANCHOR_IMAGE_COUNT, CREDITS_PER_IMAGE,
} from './types';
import ModuleTutorial from '../../components/shared/ModuleTutorial';
import { TUTORIAL_CONFIGS } from '../../components/shared/tutorialConfigs';
import { WizardStepper } from '../../components/shared/WizardStepper';
import { WizardFooter } from '../../components/shared/WizardFooter';
import { GenerationProgress as GenProgress, type ProgressStep } from '../../components/shared/GenerationProgress';

// ─── Wizard steps ─────────────────────────────────────────────
// 1 Brief · 2 Generar Ancla · 3 Aprobar Ancla · 4 Canales · 5 Cantidad · 6 Generar · 7 Resultados
type WizardStep = 1 | 2 | 3 | 4 | 5 | 6 | 7;

const WIZARD_STEP_DEFS = [
  { id: '1', label: 'Brief' },
  { id: '2', label: 'Estilo' },    // ancla generada desde el brief
  { id: '3', label: 'Canales' },
  { id: '4', label: 'Cantidad' },
  { id: '5', label: 'Generar' },
  { id: '6', label: 'Resultados' },
];

const ANCHOR_PROGRESS_STEPS: ProgressStep[] = [
  { id: 'brief',   label: 'Analizando brief y referencias' },
  { id: 'anchor',  label: 'Generando propuestas de estilo visual' },
  { id: 'done',    label: 'Listo para aprobar' },
];

const CAMPAIGN_PROGRESS_STEPS: ProgressStep[] = [
  { id: 'analyze', label: 'Analizando estilo aprobado' },
  { id: 'plan',    label: 'Diseñando estrategia de campaña' },
  { id: 'generate',label: 'Generando imágenes de campaña' },
  { id: 'done',    label: 'Kit de campaña listo' },
];

const SLOT_ROLES: ImageSlotRole[] = ['product', 'inspiration', 'brand', 'model'];
const MAX_PER_SLOT   = 4;
const MAX_TOTAL_SLOTS = 12;

// ─── UpgradeWall ──────────────────────────────────────────────
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
        <p className="t-body-sm">1 pro-credit = 1 kit de campaña completo</p>
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

// ─── ImageUploadSlot ──────────────────────────────────────────
const ImageUploadSlot: React.FC<{
  role:      ImageSlotRole;
  images:    string[];
  onChange:  (images: string[]) => void;
  totalUsed: number;
}> = ({ role, images, onChange, totalUsed }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const meta     = IMAGE_SLOT_META[role];
  const canAddMore = images.length < MAX_PER_SLOT && totalUsed < MAX_TOTAL_SLOTS;

  const handleFiles = async (files: FileList) => {
    // Cuántos más acepta este slot y el total global
    const canAddToSlot  = MAX_PER_SLOT   - images.length;
    const canAddGlobal  = MAX_TOTAL_SLOTS - totalUsed;
    const canAdd        = Math.min(canAddToSlot, canAddGlobal);
    if (canAdd <= 0) return;

    const validFiles = Array.from(files)
      .filter(f => f.type.startsWith('image/'))
      .slice(0, canAdd);

    if (validFiles.length === 0) return;

    // Procesar todos en paralelo y hacer un solo onChange
    const compressed = await Promise.all(validFiles.map(f => readAndCompressFile(f)));
    onChange([...images, ...compressed]);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.12em] flex items-center gap-1.5">
          <span>{meta.icon}</span> {meta.label}
        </div>
        {images.length > 0 && (
          <span className="text-[9px] font-bold text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded-full">{images.length}</span>
        )}
      </div>
      {images.length > 0 && (
        <div className="grid grid-cols-2 gap-1.5">
          {images.map((src, idx) => (
            <div key={idx} className="relative aspect-square rounded-xl overflow-hidden group">
              <img src={src} alt="" className="w-full h-full object-cover" />
              <button type="button" onClick={() => onChange(images.filter((_, i) => i !== idx))}
                className="absolute top-1 right-1 w-5 h-5 bg-black/70 hover:bg-black/90 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                <X size={8} strokeWidth={3} />
              </button>
            </div>
          ))}
        </div>
      )}
      {canAddMore && (
        <button type="button" onClick={() => inputRef.current?.click()}
          onDrop={e => { e.preventDefault(); if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files); }}
          onDragOver={e => e.preventDefault()}
          className={`rounded-2xl border-2 border-dashed transition-all group flex flex-col items-center justify-center gap-1.5 py-3 ${
            images.length === 0 ? 'border-slate-200 hover:border-brand-400 bg-slate-50 hover:bg-brand-50' : 'border-slate-200 hover:border-brand-300 bg-white hover:bg-brand-50'
          }`}>
          <Plus className="w-4 h-4 text-slate-300 group-hover:text-brand-400 transition-colors" />
          <span className="text-[9px] font-semibold text-slate-400 group-hover:text-brand-500 text-center leading-tight px-2">
            {images.length === 0 ? meta.description : `Agregar más (máx ${MAX_PER_SLOT})`}
          </span>
        </button>
      )}
      <input ref={inputRef} type="file" accept="image/*" multiple className="hidden"
        onChange={e => { if (e.target.files?.length) handleFiles(e.target.files); e.target.value = ''; }} />
    </div>
  );
};

// ─── Componente principal ─────────────────────────────────────
const CampaignModule: React.FC = () => {
  const { user, credits, isAdmin, deductCredits, refreshCredits, proCredits, deductProCredit, refundProCredit } = useAuth();

  // Brief state
  const [idea,       setIdea]       = useState('');
  const [canales,    setCanales]    = useState<CampaignChannel[]>(['instagram_feed']);
  const [imageCount, setImageCount] = useState(4);
  const [slots,      setSlots]      = useState<Record<ImageSlotRole, string[]>>({
    product: [], inspiration: [], brand: [], model: [],
  });

  // Anchor state
  const [anchorOptions,   setAnchorOptions]   = useState<string[]>([]);
  const [selectedAnchor,  setSelectedAnchor]  = useState<string>('');
  const [anchorAnalysis,  setAnchorAnalysis]  = useState<CampaignAnchorAnalysis | null>(null);
  const [isRegenerating,  setIsRegenerating]  = useState(false);

  // Wizard state
  const [step,      setStep]      = useState<WizardStep>(1);
  const [activeTab, setActiveTab] = useState<'create' | 'library'>('create');

  // Generation state
  const [isGenerating,      setIsGenerating]      = useState(false);
  const [progress,          setProgress]          = useState<{ total: number; completed: number; current: number } | null>(null);
  const [progressStepIndex, setProgressStepIndex] = useState(0);
  const [progressSteps,     setProgressSteps]     = useState<ProgressStep[]>(ANCHOR_PROGRESS_STEPS);
  const [error,             setError]             = useState<string | null>(null);
  const [currentSet,        setCurrentSet]        = useState<CampaignSet | null>(null);
  const [campaignPlan,      setCampaignPlan]      = useState<any>(null);
  const [partialImages,     setPartialImages]     = useState<string[]>([]);
  // Imágenes fallidas al generar campaña (índices de las que no se generaron)
  const [failedIndexes,     setFailedIndexes]     = useState<number[]>([]);
  // Índices que están siendo reintentados actualmente
  const [retryingIndexes,   setRetryingIndexes]   = useState<number[]>([]);

  // Results UI state
  const [expandedPieza, setExpandedPieza] = useState<string | null>(null);
  const [copiedKey,     setCopiedKey]     = useState<string | null>(null);
  const [activeTab2,    setActiveTab2]    = useState<'plan' | 'calendario' | 'hashtags'>('plan');
  const [modalPieza,    setModalPieza]    = useState<number | null>(null);

  // Library state
  const [sets,        setSets]        = useState<CampaignSet[]>([]);
  const [loadingSets, setLoadingSets] = useState(false);
  const [deletingId,  setDeletingId]  = useState<string | null>(null);

  // Download state
  const [downloadingHtml, setDownloadingHtml] = useState(false);
  const [downloadingPdf,  setDownloadingPdf]  = useState(false);
  const [downloadError,   setDownloadError]   = useState<string | null>(null);

  const handleDownloadHtml = async (set: CampaignSet) => {
    setDownloadingHtml(true);
    setDownloadError(null);
    try { await downloadCampaignHtml(set); }
    catch (e: any) { setDownloadError(`Error al generar el archivo interactivo: ${e?.message ?? 'intentá de nuevo'}`); }
    finally { setDownloadingHtml(false); }
  };

  const handleDownloadPdf = async (set: CampaignSet) => {
    setDownloadingPdf(true);
    setDownloadError(null);
    try { await downloadCampaignPdf(set); }
    catch (e: any) { setDownloadError(`Error al generar el PDF: ${e?.message ?? 'intentá de nuevo'}`); }
    finally { setDownloadingPdf(false); }
  };

  // Lightbox state
  const [lightboxOpen,   setLightboxOpen]   = useState(false);
  const [lightboxIndex,  setLightboxIndex]  = useState(0);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);

  // ── Recuperación de sesión ────────────────────────────────
  // Guarda el progreso en localStorage para sobrevivir a recargas/crashes.
  // Solo se guarda cuando hay trabajo real (plan generado o anclas listas).
  const SESSION_KEY = `campaign_session_${user?.uid ?? 'anon'}`;

  const saveSession = (overrides?: Partial<{
    step: WizardStep; idea: string; canales: CampaignChannel[]; imageCount: number;
    slots: Record<ImageSlotRole, string[]>; campaignPlan: any;
    anchorOptions: string[]; selectedAnchor: string;
  }>) => {
    const data = {
      step:          overrides?.step          ?? step,
      idea:          overrides?.idea          ?? idea,
      canales:       overrides?.canales       ?? canales,
      imageCount:    overrides?.imageCount    ?? imageCount,
      slots:         overrides?.slots         ?? slots,
      campaignPlan:  overrides?.campaignPlan  ?? campaignPlan,
      anchorOptions: overrides?.anchorOptions ?? anchorOptions,
      selectedAnchor:overrides?.selectedAnchor ?? selectedAnchor,
      savedAt:       Date.now(),
    };
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(data)); } catch {}
  };

  const clearSession = () => { try { localStorage.removeItem(SESSION_KEY); } catch {} };

  const [sessionRestored, setSessionRestored] = useState(false);
  const [pendingRestore, setPendingRestore] = useState<any>(null);

  // Detectar sesión guardada al montar
  useEffect(() => {
    if (!user?.uid) return;
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      // Solo ofrecer recuperar si hay un plan (trabajo real hecho)
      if (data?.campaignPlan?.piezas && Date.now() - data.savedAt < 24 * 60 * 60 * 1000) {
        setPendingRestore(data);
      }
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  const applyRestore = (data: any) => {
    if (!data) return;
    setIdea(data.idea ?? '');
    setCanales(data.canales ?? ['instagram_feed']);
    setImageCount(data.imageCount ?? 4);
    setSlots(data.slots ?? { product: [], inspiration: [], brand: [], model: [] });
    setCampaignPlan(data.campaignPlan ?? null);
    setAnchorOptions(data.anchorOptions ?? []);
    setSelectedAnchor(data.selectedAnchor ?? '');
    // Volver al paso de aprobación (3) si había al menos 1 ancla válida, si no al paso 1
    const recoveredStep: WizardStep = (data.anchorOptions?.some(Boolean)) ? 3 : 1;
    setStep(recoveredStep);
    setSessionRestored(true);
    setPendingRestore(null);
  };

  const dismissRestore = () => {
    clearSession();
    setPendingRestore(null);
  };

  // Guardar sesión cuando hay anclas o plan
  useEffect(() => {
    if ((anchorOptions.some(Boolean) || campaignPlan) && step >= 3) saveSession();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignPlan, anchorOptions, selectedAnchor, step, anchorAnalysis]);

  // Limpiar sesión cuando la campaña termina o se resetea
  const resetCreatorAndClear = () => {
    clearSession();
    setSessionRestored(false);
    setPendingRestore(null);
  };

  // ── Cálculos de costo ──────────────────────────────────────
  // Los créditos se cobran en 2 momentos:
  //   Paso 1 (ancla): 1 pro-credit + anchorCreditCost (4 cr)
  //   Paso 2 (campaña): imageCreditCost (N×2 cr)
  const hasProCredits    = isAdmin || proCredits > 0;
  const anchorCreditCost = ANCHOR_IMAGE_COUNT * CREDITS_PER_IMAGE;   // 4 cr
  const imageCreditCost  = imageCount * CREDITS_PER_IMAGE;           // N×2 cr
  const totalCreditCost  = anchorCreditCost + imageCreditCost;       // total visible en resumen
  const creditsAfter     = Math.max(0, (credits?.available ?? 0) - totalCreditCost);
  const insufficientForAnchor      = !isAdmin && (credits?.available ?? 0) < anchorCreditCost;
  const insufficientForCampaign    = !isAdmin && (credits?.available ?? 0) < imageCreditCost;
  const insufficientForAnchorRegen = !isAdmin && (credits?.available ?? 0) < anchorCreditCost;
  // Alias para compatibilidad con referencias existentes en el JSX
  const insufficient = insufficientForAnchor;

  const activeSlots: CampaignImageSlot[] = SLOT_ROLES.flatMap(r => slots[r].map(base64 => ({ role: r, base64 })));
  const totalSlotsUsed = SLOT_ROLES.reduce((sum, r) => sum + slots[r].length, 0);

  // ── Validaciones ──────────────────────────────────────────
  const canStep1 = idea.trim().length >= 10;
  const canStep2 = canales.length > 0;
  const canStep3 = !insufficient;

  // ── Helpers ───────────────────────────────────────────────
  const loadSets = async () => {
    setLoadingSets(true);
    const all = await campaignStorage.list();
    setSets(all);
    setLoadingSets(false);
  };
  useEffect(() => { loadSets(); }, []);

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const toggleCanal = (canal: CampaignChannel) =>
    setCanales(prev => prev.includes(canal) ? prev.filter(c => c !== canal) : [...prev, canal]);

  const resetCreator = () => {
    resetCreatorAndClear();
    setStep(1); setIdea(''); setCanales(['instagram_feed']); setImageCount(4);
    setSlots({ product: [], inspiration: [], brand: [], model: [] });
    setAnchorOptions([]); setSelectedAnchor(''); setAnchorAnalysis(null); setCampaignPlan(null);
    setCurrentSet(null); setError(null); setProgress(null);
    setProgressStepIndex(0); setIsGenerating(false); setPartialImages([]);
    setFailedIndexes([]);
    setExpandedPieza(null); setActiveTab2('plan');
  };

  const openLightbox = (images: string[], idx: number) => {
    setLightboxImages(images); setLightboxIndex(idx); setLightboxOpen(true);
  };

  const openSetFromLibrary = (set: CampaignSet) => {
    setCurrentSet(set);
    setCampaignPlan(set.plan);
    setStep(7 as WizardStep);
    setActiveTab('create');
    setActiveTab2('plan');
    setModalPieza(null);
    window.scrollTo(0, 0);
  };

  const downloadSetZip = async (set: CampaignSet) => {
    const validPiezas = set.plan.piezas.filter(p => p.imageUrl && p.imageUrl.length > 10);
    if (validPiezas.length === 0) return;
    const urls    = validPiezas.map(p => p.imageUrl);
    const prefix  = (set.plan.tagline ?? 'campaña').replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ\s]/g, '').trim().slice(0, 30);
    await downloadAsZip(urls, `${prefix}.zip`, `dia`);
  };

  const deleteSet = async (id: string) => {
    setDeletingId(id);
    await campaignStorage.delete(id).catch(console.error);
    await loadSets();
    setDeletingId(null);
  };

  // ── Generar ancla — solo desde el brief (paso 1→2) ────────
  // Cobra: 1 pro-credit + 4 créditos (las 2 anclas)
  // NO cobra los créditos de las imágenes de campaña todavía.
  const handleGenerateAnchor = async () => {
    if (!hasProCredits) return;

    if (!isAdmin) {
      const ok = await deductProCredit();
      if (!ok) { setError('No tenés pro-credits para esta sesión.'); return; }
    }
    if (!isAdmin && (credits?.available ?? 0) < anchorCreditCost) {
      if (!isAdmin) await refundProCredit().catch(() => {});
      setError(`Necesitás ${anchorCreditCost} créditos para generar las propuestas de estilo.`);
      return;
    }
    if (!isAdmin) {
      const ok = await deductCredits(anchorCreditCost);
      if (!ok) {
        await refundProCredit().catch(() => {});
        setError('Error al descontar créditos. Intentá de nuevo.');
        return;
      }
    }

    setStep(2);
    setIsGenerating(true);
    setError(null);
    setProgressSteps(ANCHOR_PROGRESS_STEPS);
    setProgress({ total: ANCHOR_IMAGE_COUNT, completed: 0, current: 0 });
    setProgressStepIndex(0);

    try {
      setProgressStepIndex(1);
      const anchors = await generateAnchorImagesFromBrief(
        idea, activeSlots,
        { uid: user?.uid, sessionId: newSessionId() },
        (done, total, partialUrls) => {
          setProgress({ total, completed: done, current: done - 1 });
          // Guardar con índices preservados (slot 0=UGC, slot 1=Editorial)
          // sin filtrar vacíos para que el grid muestre los slots correctamente
          if (partialUrls) setAnchorOptions(partialUrls);
        },
      );

      setProgressStepIndex(2);

      const validAnchors = anchors.filter(Boolean);
      if (validAnchors.length === 0) {
        throw new Error('No se pudieron generar las propuestas de estilo. Intentá de nuevo.');
      }

      // Guardar el array completo preservando índices (slot 0=UGC, slot 1=Editorial)
      // para que los labels A/B sean correctos aunque una falle
      setAnchorOptions(anchors);
      setSelectedAnchor(validAnchors[0]);
      await refreshCredits();
      setStep(3); // → aprobar ancla
    } catch (err: any) {
      console.error('[Campaign] handleGenerateAnchor error:', err);
      setError(`Error generando las propuestas de estilo: ${err?.message || err}`);
      if (!isAdmin) {
        await refundProCredit().catch(() => {});
        await deductCredits(-anchorCreditCost).catch(() => {});
        await refreshCredits().catch(() => {});
      }
      // Quedarse en step 2 con el error visible + botón de reintentar
      // (no volver a step 1 — el usuario no ve el error ahí)
    } finally {
      setIsGenerating(false);
      setProgress(null);
    }
  };

  // ── Regenerar ancla (cuesta 4 créditos más) ───────────────
  const handleRegenerateAnchor = async () => {
    if (insufficientForAnchorRegen) return;
    if (!isAdmin) {
      const ok = await deductCredits(anchorCreditCost);
      if (!ok) { setError('Error al descontar créditos.'); return; }
    }

    setIsRegenerating(true);
    setError(null);

    try {
      const anchors = await generateAnchorImagesFromBrief(
        idea, activeSlots,
        { uid: user?.uid, sessionId: newSessionId() },
      );
      // Preservar índices: slot 0=UGC, slot 1=Editorial
      setAnchorOptions(anchors);
      const firstValid = anchors.find(Boolean) ?? '';
      setSelectedAnchor(firstValid);
      setAnchorAnalysis(null); // resetear análisis previo
      await refreshCredits();
    } catch (err: any) {
      setError(`Error regenerando: ${err?.message || err}`);
      if (!isAdmin) await deductCredits(-anchorCreditCost).catch(() => {});
    } finally {
      setIsRegenerating(false);
    }
  };

  // ── Generar campaña con ancla aprobada (paso 5→6) ─────────
  // Cobra: N×2 créditos (solo las imágenes de campaña)
  // Analiza el ancla real → construye el plan → genera imágenes
  const handleGenerateCampaign = async (retryIndexes?: number[]) => {
    if (!selectedAnchor) return;

    // Determinar modo visual según qué ancla eligió el usuario
    // anchorOptions[0] = A = UGC, anchorOptions[1] = B = Editorial
    const anchorIndex = anchorOptions.indexOf(selectedAnchor);
    const modoVisual: 'ugc' | 'editorial' = anchorIndex === 1 ? 'editorial' : 'ugc';

    // Solo cobrar créditos de imágenes en el primer intento (no en retry)
    if (!retryIndexes && !isAdmin) {
      if (insufficientForCampaign) {
        setError(`Necesitás ${imageCreditCost} créditos para generar las ${imageCount} imágenes.`);
        return;
      }
      const ok = await deductCredits(imageCreditCost);
      if (!ok) {
        setError('Error al descontar créditos. Intentá de nuevo.');
        return;
      }
    }

    // Actualizar modoVisual en el plan existente si ya había uno (retry)
    if (campaignPlan) {
      campaignPlan.modoVisual = modoVisual;
    }

    setStep(6);
    setIsGenerating(true);
    setError(null);
    setFailedIndexes([]);
    setRetryingIndexes(retryIndexes ?? []);
    if (!retryIndexes) {
      setCurrentSet(null);
      setPartialImages([]);
    }
    setProgressSteps(CAMPAIGN_PROGRESS_STEPS);
    setProgress({ total: retryIndexes ? retryIndexes.length : imageCount, completed: 0, current: 0 });
    setProgressStepIndex(0);

    try {
      let activePlan = campaignPlan;
      let activeAnalysis = anchorAnalysis;

      // Primera generación (no retry): analizar ancla y construir plan
      if (!retryIndexes) {
        // 1. Analizar la imagen ancla real para extraer invariantes concretas
        setProgressStepIndex(0);
        activeAnalysis = await analyzeAnchorImage(selectedAnchor);
        if (activeAnalysis) setAnchorAnalysis(activeAnalysis);

        // 2. Construir el plan con el ancla analizada
        setProgressStepIndex(1);
        activePlan = await buildCampaignPlanFromAnchor(
          idea, canales, imageCount, activeSlots, activeAnalysis, modoVisual,
        );
        setCampaignPlan(activePlan);
        saveSession({ campaignPlan: activePlan });
        console.log('[Campaign] Plan desde ancla construido:', activePlan.concepto);
      }

      if (!activePlan) {
        throw new Error('No se pudo construir el plan de campaña.');
      }

      let images: string[];

      if (retryIndexes) {
        // Regenerar solo piezas fallidas con el plan y análisis existentes
        const piezasToRetry = retryIndexes.map(i => activePlan!.piezas[i]);
        const partialPlan = { ...activePlan!, piezas: piezasToRetry };
        const retried = await generateCampaignImages(
          partialPlan, activeSlots, selectedAnchor,
          { uid: user?.uid, sessionId: newSessionId() },
          (done, total, partialUrls) => {
            setProgress({ total, completed: done, current: done - 1 });
            if (partialUrls) {
              setPartialImages(prev => {
                const next = [...prev];
                retryIndexes.forEach((origIdx, j) => {
                  if (partialUrls[j]) next[origIdx] = partialUrls[j];
                });
                return next;
              });
            }
          },
          activeAnalysis ?? undefined,
        );
        images = [...partialImages];
        retryIndexes.forEach((origIdx, j) => {
          images[origIdx] = retried[j] ?? '';
        });
      } else {
        setProgressStepIndex(2);
        images = await generateCampaignImages(
          activePlan!, activeSlots, selectedAnchor,
          { uid: user?.uid, sessionId: newSessionId() },
          (done, total, partialUrls) => {
            setProgress({ total, completed: done, current: done - 1 });
            if (partialUrls) setPartialImages([...partialUrls]);
            if (done === total) setProgressStepIndex(3);
          },
          activeAnalysis ?? undefined,
        );
      }

      setProgressStepIndex(3);

      const validImages = images.filter(Boolean);
      if (validImages.length === 0) {
        throw new Error('No se generó ninguna imagen. La API puede estar saturada — intentá de nuevo en unos minutos.');
      }

      // Detectar fallos individuales
      const failed = images.map((url, i) => (!url ? i : -1)).filter(i => i !== -1);
      if (failed.length > 0) {
        setFailedIndexes(failed);
        setPartialImages([...images]);
        activePlan!.piezas = activePlan!.piezas.map((p: any, i: number) => ({
          ...p, imageUrl: images[i] ?? p.imageUrl ?? '',
        }));
        setCampaignPlan({ ...activePlan! });
        setIsGenerating(false);
        setProgress(null);
        return;
      }

      activePlan!.piezas = activePlan!.piezas.map((p: any, i: number) => ({
        ...p, imageUrl: images[i] ?? '',
      }));
      setCampaignPlan({ ...activePlan! });

      const set: CampaignSet = {
        id:            Date.now().toString(),
        createdAt:     Date.now(),
        idea, canales, imageCount,
        slots:         activeSlots,
        anchorImage:   selectedAnchor,
        anchorOptions,
        userName:      user?.displayName ?? undefined,
        plan:          activePlan!,
      };

      await campaignStorage.save(set);
      await loadSets();
      clearSession();
      setCurrentSet(set);
      setFailedIndexes([]);
      setRetryingIndexes([]);
      setStep(7);
      await refreshCredits();
    } catch (err: any) {
      console.error('[Campaign] handleGenerateCampaign error:', err);
      setError(`Error generando la campaña: ${err?.message || err}`);
      // Reembolsar créditos de imágenes si falló en el primer intento
      if (!retryIndexes && !isAdmin) {
        await deductCredits(-imageCreditCost).catch(() => {});
        await refreshCredits().catch(() => {});
      }
      setStep(5); // volver a aprobar ancla
    } finally {
      setIsGenerating(false);
      setProgress(null);
      setRetryingIndexes([]);
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
              Campaign <span className="text-brand-600">Generator</span>
            </h1>
            <div className="flex items-center gap-2 mt-2">
              <p className="text-slate-500 font-medium italic text-xs md:text-sm">
                Agencia creativa IA · Brief → Estilo → Imágenes + Copy + Calendario
              </p>
              <ModuleTutorial moduleId="campaignMode" steps={TUTORIAL_CONFIGS.campaignMode} />
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 bg-brand-50 border border-brand-100 rounded-2xl px-3 py-2">
              <Zap className="w-3.5 h-3.5 text-brand-600" />
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

        {/* ── BANNER RECUPERAR SESIÓN ─────────────────────── */}
        {pendingRestore && activeTab === 'create' && (
          <div className="mb-4 bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-4">
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold text-amber-900">Tenés una campaña sin terminar</p>
              <p className="text-[11px] text-amber-700 mt-0.5 truncate">
                "{pendingRestore.idea?.slice(0, 60)}{pendingRestore.idea?.length > 60 ? '…' : ''}"
                {pendingRestore.anchorOptions?.some(Boolean) ? ' · Estilo listo, faltaba configurar y generar' : ' · Brief listo'}
              </p>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button onClick={() => applyRestore(pendingRestore)}
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-[11px] font-black uppercase tracking-wider transition-all">
                Retomar
              </button>
              <button onClick={dismissRestore}
                className="px-3 py-1.5 bg-white border border-amber-200 hover:border-amber-300 text-amber-700 rounded-xl text-[11px] font-bold transition-all">
                Descartar
              </button>
            </div>
          </div>
        )}

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
              current={Math.min(step, 6) as any}
              onJump={(s) => {
                const n = Number(s) as WizardStep;
                if (n < step && !isGenerating) setStep(n);
              }}
            />

            <div className="flex-1 overflow-auto">

              {/* ── PASO 1: BRIEF ────────────────────────── */}
              {step === 1 && (
                <div className="fade-in p-4 md:p-8">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-9 items-start">
                    <div className="md:col-span-7 order-2 md:order-1 flex flex-col gap-5">
                      <div>
                        <div className="text-[10px] font-black text-brand-600 uppercase tracking-[0.18em]">Paso 1 · Brief</div>
                        <h2 className="t-display text-[28px] md:text-[34px] text-slate-900 mt-2.5 leading-[1.05]">
                          ¿Cuál es tu <span className="text-brand-600 italic normal-case">idea de campaña?</span>
                        </h2>
                        <p className="text-sm text-slate-500 mt-2 leading-[1.55]">
                          Contanos qué querés hacer. Puede ser un lanzamiento, una fecha especial, una oferta, dar a conocer tu marca. Cuanto más detalle, mejor campaña.
                        </p>
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-[0.12em] mb-2">
                          Tu idea <span className="text-brand-600">*</span>
                        </label>
                        <textarea value={idea} onChange={e => setIdea(e.target.value)}
                          placeholder="Ej: Quiero lanzar mi nueva crema de noche, es para mujeres de 30 años que cuidan su piel. El precio es $25 y quiero que la gente me escriba al DM para pedirla..."
                          rows={4} autoComplete="off" autoCapitalize="sentences"
                          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3.5 text-[15px] text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 transition-all resize-none leading-relaxed" />
                        <p className="text-[11px] text-slate-400 mt-1.5">
                          Podés mencionar el producto, el precio, la fecha especial, el descuento, o el resultado que querés lograr.
                        </p>
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-[0.12em]">
                            ¿Tenés imágenes para usar?{' '}
                            <span className="text-slate-400 font-medium normal-case tracking-normal">(opcional pero recomendado)</span>
                          </label>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${totalSlotsUsed >= MAX_TOTAL_SLOTS ? 'bg-slate-100 text-slate-500' : totalSlotsUsed > 0 ? 'bg-brand-50 text-brand-600' : 'bg-slate-50 text-slate-400'}`}>
                            {totalSlotsUsed}/{MAX_TOTAL_SLOTS} subidas
                          </span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {SLOT_ROLES.map(role => (
                            <ImageUploadSlot key={role} role={role} images={slots[role]}
                              onChange={imgs => setSlots(prev => ({ ...prev, [role]: imgs }))}
                              totalUsed={totalSlotsUsed} />
                          ))}
                        </div>
                        <p className="text-[11px] text-slate-400 mt-2 leading-[1.5]">
                          Podés subir hasta {MAX_PER_SLOT} imágenes por categoría ({MAX_TOTAL_SLOTS} en total). Seleccioná varias a la vez desde tu galería. La IA elige las mejores referencias automáticamente.
                        </p>
                      </div>
                    </div>
                    <div className="md:col-span-5 order-1 md:order-2">
                      <div className="text-[11px] font-bold text-slate-500 uppercase tracking-[0.12em] mb-3">Ejemplos de ideas</div>
                      <div className="space-y-2.5">
                        {[
                          { tag: 'Lanzamiento', color: 'text-brand-600', bg: 'bg-brand-50', text: 'Lanzar mi nueva crema de noche para mujeres de 30+. Precio $25. Quiero que me escriban al DM para pedir el link de pago.' },
                          { tag: 'Black Friday', color: 'text-violet-600', bg: 'bg-violet-50', text: 'Campaña Black Friday, 40% de descuento en toda mi ropa. Dura 3 días. Quiero que vayan a mi link de bio.' },
                          { tag: 'Dar a conocer', color: 'text-emerald-600', bg: 'bg-emerald-50', text: 'Quiero que más gente conozca mi marca de velas artesanales. Me compran mucho por recomendación pero no tengo alcance.' },
                          { tag: 'Navidad', color: 'text-amber-600', bg: 'bg-amber-50', text: 'Campaña navideña para mi tienda de accesorios. Quiero mostrar mis productos como regalos perfectos.' },
                        ].map(ex => (
                          <button key={ex.tag} type="button" onClick={() => setIdea(ex.text)}
                            className="w-full text-left bg-white border border-slate-200 hover:border-slate-300 rounded-2xl p-3.5 transition-all hover:shadow-sm group">
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${ex.bg} ${ex.color}`}>{ex.tag}</span>
                              <span className="text-[10px] text-slate-400 group-hover:text-brand-600 transition-colors">Usar este ejemplo →</span>
                            </div>
                            <p className="text-[12px] text-slate-600 leading-snug">{ex.text}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── PASO 4: CANALES ──────────────────────── */}
              {step === 4 && (
                <div className="fade-in p-4 md:p-8">
                  <div className="max-w-xl">
                    <div className="text-[10px] font-black text-brand-600 uppercase tracking-[0.18em]">Paso 3 · Canales</div>
                    <h2 className="t-display text-[28px] md:text-[34px] text-slate-900 mt-2.5 leading-[1.05]">
                      ¿Dónde vas a <span className="text-brand-600 italic normal-case">publicar?</span>
                    </h2>
                    <p className="text-sm text-slate-500 mt-2 mb-6 leading-[1.55]">
                      Elegí uno o varios canales. La IA adapta el copy, el formato y las instrucciones a cada uno.
                    </p>
                    <div className="flex flex-col gap-3">
                      {(Object.keys(CAMPAIGN_CHANNEL_META) as CampaignChannel[]).map(canal => {
                        const meta = CAMPAIGN_CHANNEL_META[canal];
                        const sel  = canales.includes(canal);
                        return (
                          <button key={canal} type="button" onClick={() => toggleCanal(canal)}
                            className={`flex items-center gap-4 p-4 rounded-2xl border text-left transition-all ${sel ? 'border-2 border-brand-600 bg-brand-50' : 'border border-slate-200 bg-white hover:border-slate-300'}`}>
                            <span className="text-2xl flex-shrink-0">{meta.icon}</span>
                            <div className="flex-1">
                              <div className={`text-[14px] font-bold ${sel ? 'text-brand-900' : 'text-slate-800'}`}>{meta.label}</div>
                              <div className="text-[11px] text-slate-500 mt-0.5">{meta.copyHint}</div>
                            </div>
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${sel ? 'bg-brand-600 text-white' : 'border-2 border-slate-200'}`}>
                              {sel && <Check size={10} strokeWidth={3} />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    {canales.length === 0 && (
                      <p className="text-[12px] text-rose-500 font-medium mt-3">Seleccioná al menos un canal para continuar.</p>
                    )}
                  </div>
                </div>
              )}

              {/* ── PASO 5: CANTIDAD + COSTO DE IMÁGENES ─── */}
              {step === 5 && (
                <div className="fade-in p-4 md:p-8">
                  <div className="grid grid-cols-1 md:grid-cols-[1fr_300px] gap-5 md:gap-6 items-start">
                    <div>
                      <div className="text-[10px] font-black text-brand-600 uppercase tracking-[0.18em]">Paso 4 · Cantidad</div>
                      <h2 className="t-display text-[28px] md:text-[34px] text-slate-900 mt-2.5 leading-[1.05]">
                        ¿Cuántas imágenes <span className="text-brand-600 italic normal-case">genera la campaña?</span>
                      </h2>
                      <p className="text-sm text-slate-500 mt-2 mb-6 leading-[1.55] max-w-[500px]">
                        Cada imagen es una pieza del plan: tiene su canal, su día, su copy y sus instrucciones de publicación.
                      </p>
                      <div className="bg-white border border-slate-200 rounded-2xl p-4 md:p-5 mb-5">
                        <div className="text-[11px] font-bold text-slate-500 uppercase tracking-[0.12em] mb-4">Imágenes de campaña</div>
                        <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
                          {([1,2,3,4,5,6,7,8] as const).map(n => (
                            <button key={n} type="button" onClick={() => setImageCount(n)}
                              className={`py-4 rounded-2xl flex flex-col items-center gap-0.5 transition-all ${imageCount === n ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                              <span className="text-lg font-bold">{n}</span>
                              <span className="text-[9px] opacity-60">img</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Aviso del flujo */}
                      <div className="rounded-2xl p-4 bg-violet-50 border border-violet-100 mb-4">
                        <div className="flex items-start gap-3">
                          <Sparkles className="w-4 h-4 text-violet-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-[12px] font-bold text-violet-900 mb-1">Cómo funciona el proceso</p>
                            <ol className="text-[11px] text-violet-700 leading-[1.6] space-y-1 list-none">
                              <li><span className="font-bold">1.</span> La IA genera <strong>2 propuestas de estilo visual</strong> para que elijas la que más te gusta</li>
                              <li><span className="font-bold">2.</span> Con el estilo aprobado, genera las <strong>{imageCount} imágenes de tu campaña</strong> con consistencia visual total</li>
                              <li><span className="font-bold">3.</span> Recibís el kit completo: imágenes + copy + calendario + PDF</li>
                            </ol>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-2xl p-4 bg-brand-50 border border-brand-100">
                        <div className="flex items-start gap-3">
                          <Zap className="w-4 h-4 text-brand-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-[12px] font-bold text-brand-900 mb-0.5">1 pro-credit por sesión</p>
                            <p className="text-[11px] text-brand-700 leading-[1.5]">
                              Tenés <strong>{isAdmin ? '∞' : proCredits} sesiones</strong> disponibles.
                            </p>
                          </div>
                        </div>
                      </div>
                      {error && (
                        <div className="mt-3 p-4 bg-rose-50 border border-rose-200 rounded-2xl text-[12px] text-rose-700 font-medium flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />{error}
                        </div>
                      )}
                    </div>

                    {/* Panel de costo de imágenes (anclas ya pagadas) */}
                    <div className="md:sticky md:top-4">
                      <div className="relative bg-slate-900 text-white rounded-2xl p-5 overflow-hidden">
                        <div className="absolute -top-10 -right-10 w-[140px] h-[140px] rounded-full pointer-events-none"
                          style={{ background: 'rgba(124,58,237,0.3)', filter: 'blur(40px)' }} />
                        <div className="relative">
                          <div className="text-[10px] font-bold text-pink-300 uppercase tracking-[0.14em] mb-3.5">Costo de generación</div>
                          <div className="flex flex-col gap-2 mb-3.5 text-[13px]">
                            <div className="flex justify-between items-baseline">
                              <span className="opacity-70 line-through text-[11px]">2 propuestas de estilo</span>
                              <span className="font-semibold text-emerald-400 text-[11px]">✓ pagadas</span>
                            </div>
                            <div className="flex justify-between items-baseline">
                              <span className="opacity-70">{imageCount} imágenes campaña</span>
                              <span className="font-semibold">{imageCreditCost} cr</span>
                            </div>
                            <div className="h-px bg-white/10 my-1" />
                            <div className="flex justify-between items-baseline">
                              <span className="opacity-85 text-[13px]">A pagar ahora</span>
                              <span className="font-display font-extrabold italic text-[36px] tracking-tight leading-none" style={{ fontFamily: 'Syne, Inter, sans-serif' }}>
                                {imageCreditCost}{' '}
                                <span className="text-sm opacity-70 font-semibold not-italic tracking-normal">cr</span>
                              </span>
                            </div>
                          </div>
                          <div className="h-px bg-white/10 mb-3" />
                          <div className={`text-[11px] leading-[1.5] ${insufficientForCampaign ? 'text-rose-300' : 'opacity-70'}`}>
                            {insufficientForCampaign
                              ? <><strong>Créditos insuficientes.</strong> Te faltan {imageCreditCost - (credits?.available ?? 0)} cr.</>
                              : <>Te quedarán <strong>{Math.max(0, (credits?.available ?? 0) - imageCreditCost)} cr</strong> después.</>}
                          </div>
                        </div>
                      </div>
                      <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2.5 text-[11.5px] text-emerald-900 leading-[1.55] mt-3">
                        <strong>Sin sorpresas.</strong> Solo se descuenta si la generación se completa. Reembolso automático si falla.
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── PASO 2: GENERANDO ANCLA ──────────────── */}
              {step === 2 && (
                <div className="fade-in p-4 md:p-8">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-5 md:gap-7 items-start">
                    <div className="md:col-span-5 lg:col-span-4">
                      {!isGenerating && error ? (
                        <>
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-2 h-2 rounded-full bg-rose-500" />
                            <span className="text-[10px] font-black text-rose-600 uppercase tracking-[0.18em]">Error al generar</span>
                          </div>
                          <h2 className="font-display font-extrabold italic uppercase tracking-tight text-[22px] md:text-[26px] text-slate-900 leading-tight"
                            style={{ fontFamily: 'Syne, Inter, sans-serif', letterSpacing: '-0.025em' }}>
                            No se pudo generar
                          </h2>
                          <div className="mt-3 p-4 bg-rose-50 border border-rose-200 rounded-2xl text-[12px] text-rose-700 font-medium flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />{error}
                          </div>
                          <p className="text-[12px] text-slate-500 mt-3 leading-[1.5]">
                            Tus créditos fueron reembolsados automáticamente. Podés reintentar sin costo adicional.
                          </p>
                          <div className="flex gap-2 mt-4">
                            <button onClick={() => { setError(null); handleGenerateAnchor(); }}
                              className="flex-1 bg-brand-600 hover:bg-brand-700 text-white text-[13px] font-bold px-4 py-3 rounded-xl transition-colors">
                              Reintentar
                            </button>
                            <button onClick={() => { setError(null); setStep(1); }}
                              className="px-4 py-3 rounded-xl border border-slate-200 text-[13px] text-slate-600 hover:bg-slate-50 transition-colors">
                              Volver al brief
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-2 h-2 rounded-full bg-brand-600 animate-pulse" />
                            <span className="text-[10px] font-black text-brand-600 uppercase tracking-[0.18em]">Generando · no cierres esta ventana</span>
                          </div>
                          <h2 className="font-display font-extrabold italic uppercase tracking-tight text-[22px] md:text-[26px] text-slate-900 leading-tight"
                            style={{ fontFamily: 'Syne, Inter, sans-serif', letterSpacing: '-0.025em' }}>
                            Generando propuestas de estilo
                          </h2>
                          <div className="text-[13px] text-slate-500 mt-1 mb-4">
                            {campaignPlan?.concepto ?? 'Analizando brief y referencias...'}
                          </div>
                          <div className="bg-white border border-slate-200 rounded-2xl p-4 md:p-[18px]">
                            <GenProgress steps={progressSteps} currentStepIndex={progressStepIndex} completedShots={[]} totalShots={0} />
                          </div>
                          <div className="mt-3 px-3.5 py-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 leading-[1.5]">
                            💡 Podés cerrar la ventana — te avisamos cuando termine.
                          </div>
                        </>
                      )}
                    </div>
                    <div className="md:col-span-7 lg:col-span-8">
                      <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.14em] mb-3">Propuestas de estilo</div>
                      <div className="grid grid-cols-2 gap-4">
                        {[0, 1].map(i => {
                          const done    = progress ? i < progress.completed : false;
                          const active  = progress ? i === progress.completed && isGenerating : false;
                          const imgUrl  = anchorOptions[i] ?? '';
                          return (
                            <div key={i} className={`relative aspect-[3/4] rounded-2xl overflow-hidden transition-all ${done && imgUrl ? 'fade-in shadow-md' : active ? 'border-2 border-brand-600 bg-slate-100 animate-pulse' : 'bg-slate-100'}`}>
                              {/* Imagen real cuando llega */}
                              {imgUrl && (
                                <img src={imgUrl} alt={`Opción ${i === 0 ? 'A' : 'B'}`} className="w-full h-full object-cover" />
                              )}
                              {/* Placeholder animado */}
                              {!imgUrl && active && (
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <div className="bg-white/95 rounded-full px-3.5 py-1.5 text-[10px] font-bold text-brand-600 tracking-[0.12em] uppercase">Generando...</div>
                                </div>
                              )}
                              {/* Label de opción */}
                              <div className="absolute top-3 left-3">
                                <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full ${imgUrl ? 'bg-black/60 text-white' : 'text-slate-400'}`}>
                                  Opción {i === 0 ? 'A' : 'B'}
                                </span>
                              </div>
                              {/* Check cuando está lista */}
                              {done && imgUrl && (
                                <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center shadow">
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

              {/* ── PASO 3: APROBAR ANCLA ────────────────── */}
              {step === 3 && (
                <div className="fade-in p-4 md:p-8">
                  <div className="text-[10px] font-black text-brand-600 uppercase tracking-[0.18em] mb-2">Paso 2 · Elegí el estilo</div>
                  <h2 className="t-display text-[26px] md:text-[32px] text-slate-900 mb-2 leading-[1.05]">
                    ¿Cuál es la estética de <span className="text-brand-600 italic normal-case">tu campaña?</span>
                  </h2>
                  <p className="text-sm text-slate-500 mb-5 leading-[1.55] max-w-[560px]">
                    La imagen que elijas define el estilo visual de toda la campaña. Todas las demás imágenes van a mantener esta misma estética, luz y composición.
                  </p>

                  {error && (
                    <div className="mb-4 p-4 bg-rose-50 border border-rose-200 rounded-2xl text-[12px] text-rose-700 font-medium flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />{error}
                    </div>
                  )}

                  {/* Grid de anclas — preserva índices para labels correctos aunque una falle */}
                  <div className="grid grid-cols-2 gap-3 mb-5 max-w-sm">
                    {anchorOptions.map((url, i) => {
                      if (!url) return null; // omitir slots vacías (ancla que falló)
                      const label     = i === 0 ? 'A' : 'B';
                      const variant   = i === 0 ? '📱 UGC · iPhone orgánico · personas reales' : '📷 Editorial · revista · lookbook premium';
                      const isSelected = selectedAnchor === url;
                      return (
                        <button key={i} type="button" onClick={() => setSelectedAnchor(url)}
                          className={`relative aspect-[3/4] rounded-2xl overflow-hidden border-4 transition-all cursor-pointer group ${isSelected ? 'border-brand-600 shadow-xl' : 'border-transparent hover:border-slate-300'}`}>
                          <img src={url} alt={`Opción ${label}`} className="w-full h-full object-cover" />
                          <div className={`absolute inset-0 transition-opacity ${isSelected ? 'bg-brand-600/10' : 'bg-black/0 group-hover:bg-black/5'}`} />
                          {/* Badge seleccionado */}
                          {isSelected && (
                            <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-brand-600 flex items-center justify-center shadow-lg">
                              <Check className="w-3 h-3 text-white" strokeWidth={3} />
                            </div>
                          )}
                          {/* Label opción */}
                          <div className="absolute top-2 left-2">
                            <span className="bg-black/60 backdrop-blur-md text-white text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full">
                              Opción {label}
                            </span>
                          </div>
                          {/* Footer tipo badge */}
                          <div className="absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-black/70 to-transparent">
                            <p className="text-white text-[10px] font-semibold leading-tight">{variant}</p>
                            {isSelected && <p className="text-brand-300 text-[9px] font-bold uppercase tracking-wider mt-0.5">SELECCIONADA ✓</p>}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Botón principal — avanzar a canales */}
                  <button type="button"
                    onClick={() => selectedAnchor && setStep(4)}
                    disabled={!selectedAnchor}
                    className="w-full mb-3 py-4 bg-brand-600 hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-lg">
                    Usar este estilo · Configurar campaña →
                  </button>

                  {/* Regenerar ancla + hint */}
                  <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-2xl mb-3">
                    <div>
                      <p className="text-[12px] font-bold text-slate-700">¿Ninguna te convence?</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Generá 2 nuevas opciones por <strong>{anchorCreditCost} créditos</strong> adicionales.
                        {insufficientForAnchorRegen && <span className="text-rose-500 ml-1">— Créditos insuficientes.</span>}
                      </p>
                    </div>
                    <button type="button" onClick={handleRegenerateAnchor}
                      disabled={isRegenerating || insufficientForAnchorRegen}
                      className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 rounded-xl text-[12px] font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                      {isRegenerating
                        ? <><div className="w-3.5 h-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" /> Generando...</>
                        : <><RefreshCw size={13} /> Nuevas opciones</>}
                    </button>
                  </div>

                  <div className="px-3.5 py-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 leading-[1.5]">
                    💡 Podés cerrar la ventana — te avisamos cuando termine.
                  </div>
                </div>
              )}

              {/* ── PASO 6: GENERANDO CAMPAÑA ────────────── */}
              {step === 6 && (
                <div className="fade-in p-4 md:p-8">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-5 md:gap-7 items-start">
                    <div className="md:col-span-5 lg:col-span-4">
                      {isGenerating ? (
                        <>
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-2 h-2 rounded-full bg-brand-600 animate-pulse" />
                            <span className="text-[10px] font-black text-brand-600 uppercase tracking-[0.18em]">Generando campaña · no cierres</span>
                          </div>
                        </>
                      ) : failedIndexes.length > 0 ? (
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-2 h-2 rounded-full bg-rose-500" />
                          <span className="text-[10px] font-black text-rose-600 uppercase tracking-[0.18em]">{failedIndexes.length} imagen{failedIndexes.length > 1 ? 'es' : ''} fallida{failedIndexes.length > 1 ? 's' : ''}</span>
                        </div>
                      ) : null}
                      <h2 className="font-display font-extrabold italic uppercase tracking-tight text-[22px] md:text-[26px] text-slate-900 leading-tight"
                        style={{ fontFamily: 'Syne, Inter, sans-serif', letterSpacing: '-0.025em' }}>
                        {campaignPlan?.tagline ?? 'Generando campaña'}
                      </h2>
                      <div className="text-[13px] text-slate-500 mt-1 mb-4">
                        {imageCount} imágenes · {campaignPlan?.concepto ?? 'estilo aprobado como ancla'}
                      </div>
                      {/* Ancla elegida */}
                      {selectedAnchor && (
                        <div className="mb-4 rounded-2xl overflow-hidden border border-brand-200">
                          <div className="bg-brand-50 px-3 py-2 text-[10px] font-bold text-brand-700 uppercase tracking-wider">Estilo ancla</div>
                          <img src={selectedAnchor} alt="Ancla" className="w-full aspect-[3/4] object-cover" />
                        </div>
                      )}
                      {isGenerating && (
                        <div className="bg-white border border-slate-200 rounded-2xl p-4">
                          <GenProgress steps={progressSteps} currentStepIndex={progressStepIndex} completedShots={[]} totalShots={0} />
                        </div>
                      )}
                      {/* Panel de imágenes fallidas con botón de reintentar */}
                      {!isGenerating && failedIndexes.length > 0 && (
                        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 space-y-3">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="text-[12px] font-bold text-rose-800">
                                {failedIndexes.length} imagen{failedIndexes.length > 1 ? 'es no se generaron' : ' no se generó'} correctamente.
                              </p>
                              <p className="text-[11px] text-rose-600 mt-0.5 leading-snug">
                                Podés regenerarlas sin costo adicional — se usarán las mismas referencias y estilo.
                              </p>
                            </div>
                          </div>
                          <button type="button"
                            onClick={() => handleGenerateCampaign(failedIndexes)}
                            className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-[12px] font-bold transition-colors flex items-center justify-center gap-2">
                            <RefreshCw size={13} />
                            Regenerar {failedIndexes.length} imagen{failedIndexes.length > 1 ? 'es' : ''}
                          </button>
                          {/* Opción de continuar igual si quiere */}
                          <button type="button"
                            onClick={() => {
                              // Avanzar igual aunque haya fallidas
                              const images = partialImages;
                              campaignPlan.piezas = campaignPlan.piezas.map((p: any, i: number) => ({
                                ...p, imageUrl: images[i] ?? p.imageUrl ?? '',
                              }));
                              const set: CampaignSet = {
                                id: Date.now().toString(), createdAt: Date.now(),
                                idea, canales, imageCount, slots: activeSlots,
                                anchorImage: selectedAnchor, anchorOptions,
                                userName: user?.displayName ?? undefined, plan: campaignPlan,
                              };
                              campaignStorage.save(set).then(() => loadSets());
                              clearSession(); setCurrentSet(set); setFailedIndexes([]); setStep(7);
                            }}
                            className="w-full py-2 text-[11px] text-rose-500 hover:text-rose-700 font-semibold transition-colors">
                            Continuar igual con las que se generaron →
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="md:col-span-7 lg:col-span-8">
                      <div className="flex justify-between items-baseline mb-3.5">
                        <div>
                          <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.14em] mb-1">En vivo</div>
                          <h3 className="font-display font-extrabold italic text-[20px] md:text-[22px] text-slate-900 normal-case"
                            style={{ fontFamily: 'Syne, Inter, sans-serif' }}>
                            {isGenerating
                              ? `${progress ? progress.completed : 0} de ${imageCount} listas`
                              : failedIndexes.length > 0
                              ? `${imageCount - failedIndexes.length} de ${imageCount} generadas`
                              : `${imageCount} de ${imageCount} listas`}
                          </h3>
                        </div>
                      </div>
                      <div className={`grid gap-3 ${imageCount <= 4 ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-3 md:grid-cols-4'}`}>
                        {Array.from({ length: imageCount }).map((_, i) => {
                          const imgUrl    = partialImages[i] ?? '';
                          const done      = !!imgUrl;
                          const retrying  = !done && isGenerating && retryingIndexes.includes(i);
                          const failed    = failedIndexes.includes(i);
                          const active    = !done && !failed && !retrying && progress ? i === progress.completed && isGenerating : false;
                          return (
                            <div key={i} className={`relative aspect-[3/4] rounded-2xl overflow-hidden transition-all ${
                              done      ? 'fade-in shadow-md' :
                              retrying  ? 'border-2 border-amber-400 bg-amber-50 animate-pulse' :
                              failed    ? 'border-2 border-rose-400 bg-rose-50' :
                              active    ? 'border-2 border-brand-600 bg-slate-100 animate-pulse' :
                              'bg-slate-100'
                            }`}>
                              {/* Imagen real cuando llega */}
                              {imgUrl && (
                                <img src={imgUrl} alt={`Pieza ${i + 1}`} className="w-full h-full object-cover" />
                              )}
                              {/* Loader de reintento */}
                              {retrying && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                                  <div className="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                                  <span className="text-[9px] font-bold text-amber-600 uppercase tracking-wider">Reintentando...</span>
                                </div>
                              )}
                              {/* Indicador activo */}
                              {active && !imgUrl && (
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <div className="bg-white/95 rounded-full px-3.5 py-1.5 text-[10px] font-bold text-brand-600 tracking-[0.12em] uppercase">Generando...</div>
                                </div>
                              )}
                              {/* Indicador de fallo */}
                              {failed && !retrying && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5">
                                  <AlertTriangle className="w-5 h-5 text-rose-400" />
                                  <span className="text-[9px] font-bold text-rose-500 uppercase tracking-wider">Falló</span>
                                </div>
                              )}
                              {/* Número de pieza cuando está esperando */}
                              {!done && !active && !failed && !retrying && (
                                <div className="absolute top-2 left-2 text-[10px] text-slate-400 font-semibold">{i + 1}</div>
                              )}
                              {/* Check cuando está lista */}
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

              {/* ── PASO 7: RESULTADOS ───────────────────── */}
              {step === 7 && currentSet && (() => {
                const plan = currentSet.plan;
                const allImages = plan.piezas.map(p => p.imageUrl).filter(Boolean);
                const modalP = modalPieza !== null ? plan.piezas[modalPieza] : null;
                const modalCm = modalP ? (CAMPAIGN_CHANNEL_META[modalP.canal] ?? { icon: '📢', label: modalP.canal ?? 'Canal' }) : null;

                return (
                  <div className="fade-in">
                    {/* ── Topbar de resultados ── */}
                    <div className="flex items-center gap-3 px-5 py-3.5 border-b border-slate-100 bg-white sticky top-0 z-10">
                      <div className="flex-1 min-w-0">
                        <p className="font-black italic text-[15px] text-slate-900 truncate" style={{ fontFamily: 'Syne, Inter, sans-serif' }}>
                          {plan.tagline}
                        </p>
                        <p className="text-[11px] text-slate-400 truncate">{plan.concepto}</p>
                      </div>
                      <span className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-[10px] font-bold text-emerald-600">
                        <Check size={10} strokeWidth={3} /> Completada
                      </span>
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => downloadSetZip(currentSet)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-[11px] font-semibold text-slate-600 transition-colors">
                          <Download size={12} /> ZIP
                        </button>
                        <button type="button" onClick={() => handleDownloadHtml(currentSet)} disabled={downloadingHtml || downloadingPdf}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-[11px] font-semibold text-slate-600 transition-colors disabled:opacity-50 disabled:cursor-wait">
                          {downloadingHtml ? <div className="w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" /> : <FileText size={12} />}
                          {downloadingHtml ? 'Generando…' : 'HTML'}
                        </button>
                        <button type="button" onClick={() => handleDownloadPdf(currentSet)} disabled={downloadingHtml || downloadingPdf}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-700 text-white rounded-xl text-[11px] font-semibold transition-colors disabled:opacity-50 disabled:cursor-wait">
                          {downloadingPdf ? <div className="w-3 h-3 border-2 border-white/50 border-t-white rounded-full animate-spin" /> : <Download size={12} />}
                          {downloadingPdf ? 'Generando…' : 'PDF'}
                        </button>
                      </div>
                    </div>
                    {downloadError && (
                      <div className="mx-5 mt-3 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
                        <p className="text-[11px] text-rose-700">{downloadError}</p>
                      </div>
                    )}

                    {/* ── Layout dos columnas ── */}
                    <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5 p-5 items-start">

                      {/* Columna principal */}
                      <div>
                        {/* Brief card */}
                        <div className="bg-white border border-slate-200 rounded-2xl mb-5 overflow-hidden shadow-sm">
                          <div className="p-4 border-b border-slate-100">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Promesa de campaña</p>
                            <p className="text-[13px] font-medium text-brand-600 italic">{plan.promesa}</p>
                            <div className="flex flex-wrap gap-1.5 mt-3">
                              {currentSet.canales.map(c => {
                                const cm = CAMPAIGN_CHANNEL_META[c] ?? { icon: '📢', label: c };
                                return <span key={c} className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-100">{cm.icon} {cm.label}</span>;
                              })}
                              {plan.modoVisual && (
                                <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                                  {plan.modoVisual === 'ugc' ? '📱 UGC' : '📷 Editorial'}
                                </span>
                              )}
                            </div>
                          </div>
                          {/* Ancla elegida + imágenes de referencia del brief */}
                          {(currentSet.anchorImage || currentSet.slots.length > 0) && (
                            <div className="p-4 border-b border-slate-100">
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Referencias de campaña</p>
                              <div className="grid grid-cols-4 gap-3">
                                {/* Ancla elegida siempre primera */}
                                {currentSet.anchorImage && (
                                  <div className="flex flex-col gap-1.5">
                                    <p className="text-[9px] font-bold text-brand-600 uppercase tracking-wider">🎯 Ancla visual</p>
                                    <div className="aspect-[3/4] rounded-lg overflow-hidden border-2 border-brand-200 cursor-pointer"
                                      onClick={() => openLightbox([currentSet.anchorImage, ...currentSet.slots.map(s => s.base64).filter(Boolean)], 0)}>
                                      <img src={currentSet.anchorImage} alt="Ancla visual" className="w-full h-full object-cover" />
                                    </div>
                                  </div>
                                )}
                                {(['product','inspiration','brand','model'] as const).map(role => {
                                  const roleSlots = currentSet.slots.filter(s => s.role === role);
                                  if (roleSlots.length === 0) return null;
                                  const labels: Record<string, string> = { product: '📦 Producto', inspiration: '🖼️ Inspiración', brand: '🎨 Marca', model: '👤 Modelo' };
                                  return (
                                    <div key={role} className="flex flex-col gap-1.5">
                                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{labels[role]}</p>
                                      {roleSlots.slice(0,2).map((s, si) => (
                                        <div key={si} className="aspect-square rounded-lg overflow-hidden border border-slate-100">
                                          <img src={s.base64} alt={role} className="w-full h-full object-cover" />
                                        </div>
                                      ))}
                                      {roleSlots.length > 2 && <p className="text-[9px] text-slate-400 text-center">+{roleSlots.length - 2}</p>}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                          {/* Stats */}
                          <div className="grid grid-cols-4 divide-x divide-slate-100">
                            {[
                              { label: 'Piezas', value: plan.piezas.length },
                              { label: 'Días', value: plan.duracionDias },
                              { label: 'Canales', value: currentSet.canales.length },
                            ].map(s => (
                              <div key={s.label} className="py-3 px-4 flex flex-col">
                                <span className="text-[9px] text-slate-400 uppercase tracking-widest">{s.label}</span>
                                <span className="text-[18px] font-black text-slate-900" style={{ fontFamily: 'Syne, Inter, sans-serif' }}>{s.value}</span>
                              </div>
                            ))}
                            <div className="py-3 px-4 flex flex-col">
                              <span className="text-[9px] text-slate-400 uppercase tracking-widest">Resumen</span>
                              <span className="text-[10px] text-slate-500 leading-snug mt-0.5 line-clamp-3">{plan.resumen}</span>
                            </div>
                          </div>
                        </div>

                        {/* Tabs */}
                        <div className="flex border-b border-slate-200 mb-5 gap-0">
                          {([
                            { id: 'plan' as const,      label: '🎨 Piezas',     count: plan.piezas.length },
                            { id: 'calendario' as const, label: '📅 Calendario', count: null },
                            { id: 'hashtags' as const,   label: '# Hashtags',   count: (plan.hashtagsComunidad?.length ?? 0) + (plan.hashtagsNicho?.length ?? 0) + (plan.hashtagsColarga?.length ?? 0) },
                          ]).map(t => (
                            <button key={t.id} type="button" onClick={() => setActiveTab2(t.id)}
                              className={`flex items-center gap-1.5 px-4 py-2.5 text-[12px] font-semibold border-b-2 transition-all ${activeTab2 === t.id ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
                              {t.label}
                              {t.count !== null && <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${activeTab2 === t.id ? 'bg-brand-50 text-brand-600' : 'bg-slate-100 text-slate-400'}`}>{t.count}</span>}
                            </button>
                          ))}
                        </div>

                        {/* Tab: Piezas — grid 2 col */}
                        {activeTab2 === 'plan' && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {plan.piezas.map((pieza, i) => {
                              const cm = CAMPAIGN_CHANNEL_META[pieza.canal] ?? { icon: '📢', label: pieza.canal ?? 'Canal' };
                              return (
                                <div key={pieza.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md hover:-translate-y-0.5 hover:border-brand-200 transition-all cursor-pointer group"
                                  onClick={() => setModalPieza(i)}>
                                  {/* Imagen */}
                                  <div className="relative aspect-square bg-slate-100 overflow-hidden">
                                    {pieza.imageUrl
                                      ? <img src={pieza.imageUrl} alt={pieza.rol} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                                      : <div className="w-full h-full flex items-center justify-center text-slate-300 text-4xl">🖼️</div>}
                                    <div className="absolute top-2 left-2 bg-white/90 backdrop-blur-sm rounded-full px-2.5 py-0.5 text-[10px] font-bold text-slate-600">{pieza.rol}</div>
                                    <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-brand-600 flex items-center justify-center text-[10px] font-black text-white" style={{ fontFamily: 'Syne, Inter, sans-serif' }}>{pieza.dia}</div>
                                    {/* Overlay hover */}
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3 gap-2">
                                      <button type="button" onClick={e => { e.stopPropagation(); pieza.imageUrl && openLightbox(allImages, i); }}
                                        className="flex-1 py-1.5 rounded-xl bg-white/90 text-[11px] font-semibold text-slate-800 text-center hover:bg-white transition-colors">
                                        Ver imagen
                                      </button>
                                      <button type="button" onClick={e => { e.stopPropagation(); setModalPieza(i); }}
                                        className="flex-1 py-1.5 rounded-xl bg-brand-600 text-[11px] font-semibold text-white text-center hover:bg-brand-700 transition-colors">
                                        Ver todo →
                                      </button>
                                    </div>
                                  </div>
                                  {/* Body */}
                                  <div className="p-3.5">
                                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">{cm.icon} {cm.label}</p>
                                    <p className="text-[13px] font-bold text-slate-800 leading-tight mb-2 line-clamp-2">{pieza.titular}</p>
                                    <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-3 mb-3">{pieza.caption}</p>
                                    {/* CTA */}
                                    <div className="bg-brand-50 border border-brand-100 rounded-xl px-3 py-2 flex items-center justify-between gap-2 mb-2">
                                      <p className="text-[11px] text-brand-700 font-medium italic flex-1 truncate">{pieza.cta}</p>
                                      <button type="button" onClick={e => { e.stopPropagation(); copyText(pieza.cta, `cta-${i}`); }}
                                        className="w-6 h-6 bg-white rounded-lg flex items-center justify-center text-brand-500 hover:text-brand-700 transition-colors flex-shrink-0">
                                        {copiedKey === `cta-${i}` ? <Check size={10} /> : <Copy size={10} />}
                                      </button>
                                    </div>
                                    {/* Instrucción */}
                                    <div className="bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                                      <p className="text-[9px] font-black text-amber-600 uppercase tracking-wider mb-0.5">📌 Qué hacer</p>
                                      <p className="text-[10.5px] text-amber-800 leading-snug">{pieza.instruccion}</p>
                                    </div>
                                    {/* Footer pieza */}
                                    <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-100">
                                      <span className="text-[10px] text-slate-400">⏰ {pieza.horaRecomendada}</span>
                                      <button type="button" onClick={e => { e.stopPropagation(); copyText(pieza.caption, `cap-${i}`); }}
                                        className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-brand-600 transition-colors">
                                        {copiedKey === `cap-${i}` ? <Check size={9} className="text-emerald-500" /> : <Copy size={9} />}
                                        {copiedKey === `cap-${i}` ? 'Copiado' : 'Copiar caption'}
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Tab: Calendario */}
                        {activeTab2 === 'calendario' && (
                          <div className="space-y-2">
                            {Array.from({ length: plan.duracionDias }, (_, i) => i + 1).map(dia => {
                              const piezasDelDia = plan.piezas.filter(p => p.dia === dia);
                              const DIAS = ['', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
                              return (
                                <div key={dia} className={`bg-white border rounded-2xl overflow-hidden flex items-stretch gap-0 ${piezasDelDia.length > 0 ? 'border-slate-200 shadow-sm' : 'border-slate-100 opacity-60'}`}>
                                  <div className={`w-14 flex-shrink-0 flex flex-col items-center justify-center py-3 ${piezasDelDia.length > 0 ? 'bg-brand-600' : 'bg-slate-50'}`}>
                                    <span className={`text-[9px] font-bold uppercase tracking-wider ${piezasDelDia.length > 0 ? 'text-white/70' : 'text-slate-400'}`}>{DIAS[dia]}</span>
                                    <span className={`text-[16px] font-black ${piezasDelDia.length > 0 ? 'text-white' : 'text-slate-400'}`} style={{ fontFamily: 'Syne, Inter, sans-serif' }}>{dia}</span>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    {piezasDelDia.length === 0
                                      ? <div className="flex items-center h-full px-4 text-[11px] text-slate-400 italic">Día de descanso</div>
                                      : piezasDelDia.map(p => {
                                          const cm = CAMPAIGN_CHANNEL_META[p.canal] ?? { icon: '📢', label: p.canal ?? 'Canal' };
                                          return (
                                            <div key={p.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors cursor-pointer"
                                              onClick={() => setModalPieza(plan.piezas.indexOf(p))}>
                                              {p.imageUrl && <div className="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0 border border-slate-100"><img src={p.imageUrl} alt="" className="w-full h-full object-cover" /></div>}
                                              <div className="flex-1 min-w-0">
                                                <p className="text-[12px] font-semibold text-slate-800 truncate">{p.titular}</p>
                                                <p className="text-[10px] text-slate-400">{cm.icon} {cm.label} · {p.horaRecomendada}</p>
                                              </div>
                                              <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full flex-shrink-0">{p.rol}</span>
                                            </div>
                                          );
                                        })}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Tab: Hashtags */}
                        {activeTab2 === 'hashtags' && (
                          <div className="space-y-4">
                            {[
                              { title: '🔥 Hashtags de nicho', desc: 'Mayor alcance en tu industria. Usá estos en tus posts principales del Feed.', tags: plan.hashtagsNicho, color: 'bg-brand-50 text-brand-700 border-brand-100' },
                              { title: '🌿 Comunidad', desc: 'Conectan con la comunidad emprendedora latinoamericana.', tags: plan.hashtagsComunidad, color: 'bg-lime-50 text-lime-700 border-lime-200' },
                              { title: '🎯 Cola larga', desc: 'Menos alcance pero más conversión. Audiencia específica con intención de compra.', tags: plan.hashtagsColarga, color: 'bg-slate-100 text-slate-600 border-slate-200' },
                            ].map(group => (
                              <div key={group.title} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                                  <div>
                                    <p className="text-[13px] font-bold text-slate-800">{group.title}</p>
                                    <p className="text-[11px] text-slate-400 mt-0.5">{group.desc}</p>
                                  </div>
                                  <button type="button" onClick={() => copyText(group.tags.join(' '), `ht-${group.title}`)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-brand-50 border border-slate-200 hover:border-brand-200 text-slate-500 hover:text-brand-600 rounded-xl text-[10px] font-bold transition-all flex-shrink-0">
                                    {copiedKey === `ht-${group.title}` ? <Check size={10} /> : <Copy size={10} />} Copiar
                                  </button>
                                </div>
                                <div className="p-4 flex flex-wrap gap-2">
                                  {(group.tags ?? []).map(tag => (
                                    <span key={tag} className={`text-[11px] font-semibold px-3 py-1 rounded-full border cursor-pointer hover:opacity-80 transition-opacity ${group.color}`}
                                      onClick={() => copyText(tag, `tag-${tag}`)}>
                                      {tag.startsWith('#') ? tag : `#${tag}`}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            ))}
                            <div className="bg-lime-50 border border-lime-200 rounded-2xl p-4 flex gap-3">
                              <span className="text-xl flex-shrink-0">💡</span>
                              <div>
                                <p className="text-[12px] font-bold text-lime-800 mb-1">Cómo combinarlos</p>
                                <p className="text-[11px] text-lime-700 leading-relaxed">Combiná 2-3 de nicho + 2-3 de comunidad + 2-3 de cola larga por post. No uses los mismos en todos los posts — rotá para evitar penalizaciones del algoritmo.</p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Footer acciones */}
                        <div className="flex gap-2 mt-6 pt-5 border-t border-slate-100 flex-wrap">
                          <button type="button" onClick={resetCreator}
                            className="flex items-center gap-1.5 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-[12px] font-bold transition-colors">
                            <Plus size={13} /> Nueva campaña
                          </button>
                          <button type="button" onClick={() => setActiveTab('library')}
                            className="flex items-center gap-1.5 px-4 py-2.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-600 rounded-xl text-[12px] font-semibold transition-colors">
                            <Library size={13} /> Ver biblioteca
                          </button>
                        </div>
                      </div>

                      {/* Sidebar derecha */}
                      <div className="flex flex-col gap-4">
                        {/* Descargas */}
                        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                          <div className="px-4 py-3 border-b border-slate-100">
                            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">📥 Descargar kit</p>
                          </div>
                          <div className="p-3 space-y-2">
                            <button type="button" onClick={() => handleDownloadPdf(currentSet)} disabled={downloadingPdf || downloadingHtml}
                              className="w-full flex items-center gap-3 p-3 rounded-xl bg-brand-50 border border-brand-100 hover:bg-brand-100 transition-colors disabled:opacity-50 disabled:cursor-wait">
                              <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center text-base flex-shrink-0">📄</div>
                              <div className="flex-1 text-left">
                                <p className="text-[12px] font-semibold text-slate-800">{downloadingPdf ? 'Generando PDF…' : 'PDF de agencia'}</p>
                                <p className="text-[10px] text-slate-400">Plan, piezas, copy y calendario</p>
                              </div>
                              {downloadingPdf ? <div className="w-4 h-4 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" /> : <ChevronRight size={14} className="text-slate-400" />}
                            </button>
                            <button type="button" onClick={() => downloadSetZip(currentSet)}
                              className="w-full flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200 hover:border-slate-300 transition-colors">
                              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-base flex-shrink-0">🗜️</div>
                              <div className="flex-1 text-left">
                                <p className="text-[12px] font-semibold text-slate-800">ZIP de imágenes</p>
                                <p className="text-[10px] text-slate-400">{plan.piezas.length} imágenes en alta calidad</p>
                              </div>
                              <ChevronRight size={14} className="text-slate-400" />
                            </button>
                            <button type="button" onClick={() => handleDownloadHtml(currentSet)} disabled={downloadingHtml || downloadingPdf}
                              className="w-full flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200 hover:border-slate-300 transition-colors disabled:opacity-50 disabled:cursor-wait">
                              <div className="w-8 h-8 rounded-lg bg-lime-50 flex items-center justify-center text-base flex-shrink-0">☑️</div>
                              <div className="flex-1 text-left">
                                <p className="text-[12px] font-semibold text-slate-800">{downloadingHtml ? 'Generando…' : 'Kit interactivo'}</p>
                                <p className="text-[10px] text-slate-400">HTML con checklist y hashtags</p>
                              </div>
                              {downloadingHtml ? <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" /> : <ChevronRight size={14} className="text-slate-400" />}
                            </button>
                          </div>
                        </div>

                        {/* Mini calendario */}
                        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">📅 Publicación</p>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-50 text-brand-600 border border-brand-100">{plan.duracionDias} días</span>
                          </div>
                          <div className="p-3 space-y-1.5">
                            {plan.piezas.map((p, i) => {
                              const cm = CAMPAIGN_CHANNEL_META[p.canal] ?? { icon: '📢', label: p.canal ?? 'Canal' };
                              return (
                                <div key={p.id} className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-100 hover:border-brand-200 cursor-pointer transition-colors"
                                  onClick={() => setModalPieza(i)}>
                                  <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center text-[11px] font-black text-white flex-shrink-0" style={{ fontFamily: 'Syne, Inter, sans-serif' }}>{p.dia}</div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[11px] font-semibold text-slate-700 truncate">{p.titular}</p>
                                    <p className="text-[9px] text-slate-400">{cm.icon} {cm.label} · {p.horaRecomendada}</p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Mini hashtags */}
                        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider"># Hashtags</p>
                            <button type="button" onClick={() => setActiveTab2('hashtags')}
                              className="text-[10px] text-brand-600 hover:text-brand-700 font-bold transition-colors">Ver todos →</button>
                          </div>
                          <div className="p-3">
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2">De nicho</p>
                            <div className="flex flex-wrap gap-1.5 mb-3">
                              {(plan.hashtagsNicho ?? []).slice(0, 4).map(tag => (
                                <span key={tag} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-100 cursor-pointer hover:opacity-80"
                                  onClick={() => copyText(tag, `ht-mini-${tag}`)}>
                                  {tag.startsWith('#') ? tag : `#${tag}`}
                                </span>
                              ))}
                            </div>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2">Comunidad</p>
                            <div className="flex flex-wrap gap-1.5">
                              {(plan.hashtagsComunidad ?? []).slice(0, 3).map(tag => (
                                <span key={tag} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-lime-50 text-lime-700 border border-lime-200 cursor-pointer hover:opacity-80"
                                  onClick={() => copyText(tag, `ht-mini-${tag}`)}>
                                  {tag.startsWith('#') ? tag : `#${tag}`}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* ── Modal de pieza ── */}
                    {modalPieza !== null && modalP && modalCm && (
                      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                        onClick={() => setModalPieza(null)}>
                        <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl"
                          onClick={e => e.stopPropagation()}>
                          {/* Imagen modal */}
                          <div className="relative aspect-square bg-slate-100 overflow-hidden rounded-t-2xl">
                            {modalP.imageUrl
                              ? <img src={modalP.imageUrl} alt={modalP.rol} className="w-full h-full object-cover" />
                              : <div className="w-full h-full flex items-center justify-center text-6xl">🖼️</div>}
                            <button type="button" onClick={() => setModalPieza(null)}
                              className="absolute top-3 right-3 w-8 h-8 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center text-slate-600 hover:text-slate-900 shadow-sm transition-colors">
                              <X size={14} />
                            </button>
                          </div>
                          {/* Contenido modal */}
                          <div className="p-5">
                            <div className="flex items-center gap-2 mb-3">
                              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-100">{modalCm.icon} {modalCm.label} · Día {modalP.dia}</span>
                              <span className="text-[10px] font-semibold text-slate-400">{modalP.rol}</span>
                            </div>
                            <h3 className="text-[17px] font-black text-slate-900 mb-4 leading-tight" style={{ fontFamily: 'Syne, Inter, sans-serif' }}>{modalP.titular}</h3>

                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Caption completo</p>
                            <div className="flex items-start gap-2 mb-4">
                              <p className="text-[13px] text-slate-600 flex-1 leading-relaxed whitespace-pre-line">{modalP.caption}</p>
                              <button type="button" onClick={() => copyText(modalP.caption, 'modal-cap')}
                                className="w-7 h-7 bg-slate-50 hover:bg-brand-50 rounded-lg flex items-center justify-center text-slate-400 hover:text-brand-600 transition-colors flex-shrink-0">
                                {copiedKey === 'modal-cap' ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                              </button>
                            </div>

                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">CTA recomendado</p>
                            <div className="bg-brand-50 border border-brand-100 rounded-xl px-3.5 py-2.5 flex items-center justify-between gap-2 mb-4">
                              <p className="text-[12px] text-brand-700 font-medium italic flex-1">{modalP.cta}</p>
                              <button type="button" onClick={() => copyText(modalP.cta, 'modal-cta')}
                                className="w-6 h-6 bg-white rounded-lg flex items-center justify-center text-brand-500 hover:text-brand-700 transition-colors">
                                {copiedKey === 'modal-cta' ? <Check size={10} /> : <Copy size={10} />}
                              </button>
                            </div>

                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Publicación recomendada</p>
                            <div className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 mb-4">
                              <p className="text-[12px] text-slate-600 leading-relaxed">{modalP.instruccion}</p>
                            </div>

                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Hashtags</p>
                            <div className="flex flex-wrap gap-1.5 mb-5">
                              {modalP.hashtags.map(tag => (
                                <span key={tag} className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-brand-50 text-brand-700 border border-brand-100 cursor-pointer hover:opacity-80"
                                  onClick={() => copyText(tag, `modal-tag-${tag}`)}>
                                  {tag.startsWith('#') ? tag : `#${tag}`}
                                </span>
                              ))}
                            </div>

                            <div className="flex gap-2">
                              {modalP.imageUrl && (
                                <button type="button" onClick={() => { openLightbox(allImages, modalPieza!); setModalPieza(null); }}
                                  className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-700 rounded-xl text-[12px] font-semibold transition-colors">
                                  <ImageIcon size={13} /> Ver imagen
                                </button>
                              )}
                              <button type="button" onClick={() => copyText(`${modalP.titular}\n\n${modalP.caption}\n\n${modalP.cta}\n\n${modalP.hashtags.join(' ')}`, 'modal-all')}
                                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 bg-white border border-slate-200 hover:border-brand-300 text-slate-700 rounded-xl text-[12px] font-semibold transition-colors">
                                {copiedKey === 'modal-all' ? <><Check size={13} className="text-emerald-500" /> Copiado</> : <><Copy size={13} /> Copiar todo</>}
                              </button>
                              <button type="button" onClick={() => setModalPieza(null)}
                                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-[12px] font-bold transition-colors">
                                <Check size={13} /> Listo
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

            </div>

            {/* ── WIZARD FOOTER — pasos de configuración ── */}
            {(step === 1 || step === 3 || step === 4 || step === 5) && (
              <WizardFooter
                onBack={step > 1 && !isGenerating ? () => {
                  // Navegación hacia atrás con los nuevos pasos
                  if (step === 3) setStep(1);       // aprobar ancla → brief
                  else if (step === 4) setStep(3);  // canales → aprobar ancla
                  else if (step === 5) setStep(4);  // cantidad → canales
                  else setStep(s => (s - 1) as WizardStep);
                } : undefined}
                onContinue={() => {
                  // Paso 1: Brief → generar ancla (cobra pro-credit + 4 cr)
                  if (step === 1 && canStep1) handleGenerateAnchor();
                  // Paso 3: Aprobar ancla → canales
                  else if (step === 3 && selectedAnchor) setStep(4);
                  // Paso 4: Canales → cantidad
                  else if (step === 4 && canales.length > 0) setStep(5);
                  // Paso 5: Cantidad → generar campaña (cobra N×2 cr)
                  else if (step === 5 && !insufficientForCampaign) handleGenerateCampaign();
                }}
                continueLabel={
                  step === 1 ? `Generar propuestas de estilo · ${anchorCreditCost} cr` :
                  step === 3 ? 'Usar este estilo →' :
                  step === 4 ? 'Continuar →' :
                  step === 5 ? `Generar campaña · ${imageCreditCost} cr` :
                  'Continuar'
                }
                disabled={
                  (step === 1 && (!canStep1 || insufficientForAnchor)) ||
                  (step === 3 && !selectedAnchor) ||
                  (step === 4 && canales.length === 0) ||
                  (step === 5 && insufficientForCampaign)
                }
                costInfo={
                  step === 1 ? { cost: anchorCreditCost, label: 'Propuestas de estilo' } :
                  step === 5 ? { cost: imageCreditCost, label: `${imageCount} imágenes` } :
                  undefined
                }
                loading={isGenerating}
              />
            )}
          </div>
        )}

        {/* ══════════════ BIBLIOTECA ══════════════ */}
        {activeTab === 'library' && (
          <div className="animate-in fade-in duration-500 p-5">
            {/* Toolbar */}
            <div className="flex items-center gap-3 mb-5 flex-wrap">
              <div className="flex-1 min-w-[180px]">
                <input type="text" placeholder="Buscar campaña..." className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-white text-[13px] text-slate-700 placeholder-slate-400 outline-none focus:border-brand-400 transition-colors" />
              </div>
              <button type="button" onClick={() => setActiveTab('create')}
                className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-[12px] font-bold transition-colors">
                <Plus size={13} /> Nueva campaña
              </button>
            </div>

            {/* Stats */}
            {sets.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                {[
                  { label: 'Total', value: sets.length, sub: 'campañas', color: 'text-slate-900' },
                  { label: 'Imágenes', value: sets.reduce((s, c) => s + (c.plan?.piezas?.length ?? 0), 0), sub: 'generadas', color: 'text-brand-600' },
                  { label: 'Completadas', value: sets.length, sub: 'guardadas', color: 'text-emerald-600' },
                  { label: 'Días', value: sets.reduce((s, c) => s + (c.plan?.duracionDias ?? 0), 0), sub: 'planificados', color: 'text-slate-900' },
                ].map(s => (
                  <div key={s.label} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">{s.label}</p>
                    <p className={`text-[22px] font-black ${s.color}`} style={{ fontFamily: 'Syne, Inter, sans-serif' }}>{s.value}</p>
                    <p className="text-[11px] text-slate-400">{s.sub}</p>
                  </div>
                ))}
              </div>
            )}

            {loadingSets && (
              <div className="flex items-center justify-center py-20">
                <div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            {!loadingSets && sets.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-center bg-white border-2 border-dashed border-slate-200 rounded-2xl">
                <Megaphone className="w-12 h-12 text-slate-200 mb-4" />
                <p className="text-[14px] font-bold text-slate-500 mb-1">Biblioteca vacía</p>
                <p className="text-[12px] text-slate-400 mb-5">Creá tu primer kit de campaña para guardarlo aquí</p>
                <button type="button" onClick={() => setActiveTab('create')}
                  className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 text-white rounded-xl text-[12px] font-bold hover:bg-brand-700 transition-colors">
                  <Sparkles size={13} /> Crear campaña
                </button>
              </div>
            )}

            {/* Grid de campañas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {sets.map(set => {
                const piezas = set.plan?.piezas ?? [];
                const withImg = piezas.filter(p => p.imageUrl);
                const [img0, img1, img2] = withImg.map(p => p.imageUrl);
                const modo = set.plan?.modoVisual;
                return (
                  <div key={set.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md hover:-translate-y-1 hover:border-brand-200 transition-all cursor-pointer group" onClick={() => openSetFromLibrary(set)}>
                    {/* Strip de color */}
                    <div className="h-1 bg-brand-600" />
                    {/* Mosaico de imágenes */}
                    <div className="grid grid-cols-2 grid-rows-2 h-40 overflow-hidden border-b border-slate-100">
                      <div className="row-span-2 overflow-hidden border-r border-slate-100">
                        {img0 ? <img src={img0} alt="" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                          : <div className="w-full h-full bg-slate-50 flex items-center justify-center text-2xl">🖼️</div>}
                      </div>
                      <div className="overflow-hidden border-b border-slate-100">
                        {img1 ? <img src={img1} alt="" className="w-full h-full object-cover" />
                          : <div className="w-full h-full bg-slate-50 flex items-center justify-center text-lg">🖼️</div>}
                      </div>
                      <div className="overflow-hidden">
                        {img2 ? <img src={img2} alt="" className="w-full h-full object-cover" />
                          : <div className="w-full h-full bg-slate-100 flex items-center justify-center text-sm text-slate-400">+{piezas.length - 2}</div>}
                      </div>
                    </div>
                    {/* Body */}
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">✓ Completada</span>
                        <span className="text-[10px] text-slate-400">{new Date(set.createdAt).toLocaleDateString('es-CL')}</span>
                      </div>
                      <p className="font-black italic text-[14px] text-slate-900 mb-1 leading-tight" style={{ fontFamily: 'Syne, Inter, sans-serif' }}>{set.plan?.tagline ?? 'Campaña'}</p>
                      <p className="text-[11px] text-slate-400 mb-3 line-clamp-2">{set.plan?.concepto ?? set.idea}</p>
                      {/* Refs del brief */}
                      {set.slots.length > 0 && (
                        <div className="mb-3">
                          <p className="text-[9px] text-slate-400 uppercase tracking-wider font-bold mb-1.5">Brief</p>
                          <div className="flex gap-1.5">
                            {(['product','inspiration','brand','model'] as const).map(role => {
                              const s = set.slots.find(sl => sl.role === role);
                              if (!s) return null;
                              return <div key={role} className="w-7 h-7 rounded-lg overflow-hidden border border-slate-100 flex-shrink-0"><img src={s.base64} alt={role} className="w-full h-full object-cover" /></div>;
                            })}
                            {modo && <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 self-center">{modo === 'ugc' ? '📱 UGC' : '📷 Editorial'}</span>}
                          </div>
                        </div>
                      )}
                      {/* Meta pills */}
                      <div className="flex gap-1.5 flex-wrap mb-3">
                        <span className="text-[10px] text-slate-400 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-full">📸 {piezas.length} piezas</span>
                        <span className="text-[10px] text-slate-400 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-full">📅 {set.plan?.duracionDias ?? 7} días</span>
                        <span className="text-[10px] text-slate-400 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-full">{set.canales.length} canales</span>
                      </div>
                      {/* Acciones */}
                      <div className="flex gap-1.5 pt-3 border-t border-slate-100" onClick={e => e.stopPropagation()}>
                        <button type="button" onClick={() => openSetFromLibrary(set)}
                          className="flex-1 py-1.5 rounded-xl text-[11px] font-bold bg-brand-600 text-white hover:bg-brand-700 transition-colors">
                          Ver →
                        </button>
                        <button type="button" onClick={() => handleDownloadPdf(set)} disabled={downloadingPdf || downloadingHtml}
                          className="flex-1 py-1.5 rounded-xl text-[11px] font-semibold bg-slate-50 text-slate-600 border border-slate-200 hover:border-slate-300 transition-colors disabled:opacity-50 disabled:cursor-wait">
                          {downloadingPdf ? '…' : '↓ PDF'}
                        </button>
                        <button type="button" onClick={() => handleDownloadHtml(set)} disabled={downloadingHtml || downloadingPdf}
                          className="flex-1 py-1.5 rounded-xl text-[11px] font-semibold bg-slate-50 text-slate-600 border border-slate-200 hover:border-slate-300 transition-colors disabled:opacity-50 disabled:cursor-wait">
                          {downloadingHtml ? '…' : '☑️'}
                        </button>
                        <button type="button" onClick={() => downloadSetZip(set)}
                          className="flex-1 py-1.5 rounded-xl text-[11px] font-semibold bg-slate-50 text-slate-600 border border-slate-200 hover:border-slate-300 transition-colors">
                          ↓ ZIP
                        </button>
                        <button type="button" onClick={() => deleteSet(set.id)} disabled={deletingId === set.id}
                          className="w-8 flex items-center justify-center rounded-xl bg-rose-50 text-rose-400 hover:text-rose-600 hover:bg-rose-100 border border-rose-100 transition-colors disabled:opacity-40">
                          {deletingId === set.id ? <div className="w-3 h-3 border-2 border-rose-400 border-t-transparent rounded-full animate-spin" /> : <Trash2 size={12} />}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>

      {lightboxOpen && lightboxImages.length > 0 && (
        <ImageLightbox images={lightboxImages} initialIndex={lightboxIndex} onClose={() => setLightboxOpen(false)} />
      )}
    </>
  );
};

export default CampaignModule;
