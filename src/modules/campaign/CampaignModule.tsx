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
import { buildCampaignPlan, generateAnchorImages, generateCampaignImages } from './campaignService';
import { downloadCampaignPdf, downloadCampaignHtml } from './campaignPdfService';
import { campaignStorage } from './campaignStorage';
import {
  CampaignSet, CampaignChannel, CampaignImageSlot, ImageSlotRole,
  CAMPAIGN_CHANNEL_META, IMAGE_SLOT_META, ANCHOR_IMAGE_COUNT, CREDITS_PER_IMAGE,
} from './types';
import ModuleTutorial from '../../components/shared/ModuleTutorial';
import { TUTORIAL_CONFIGS } from '../../components/shared/tutorialConfigs';
import { WizardStepper } from '../../components/shared/WizardStepper';
import { WizardFooter } from '../../components/shared/WizardFooter';
import { GenerationProgress as GenProgress, type ProgressStep } from '../../components/shared/GenerationProgress';

// ─── Wizard steps ─────────────────────────────────────────────
// 1 Brief · 2 Canales · 3 Cantidad · 4 Generar Ancla · 5 Aprobar Ancla · 6 Generar · 7 Resultados
type WizardStep = 1 | 2 | 3 | 4 | 5 | 6 | 7;

const WIZARD_STEP_DEFS = [
  { id: '1', label: 'Brief' },
  { id: '2', label: 'Canales' },
  { id: '3', label: 'Cantidad' },
  { id: '4', label: 'Estilo' },    // ancla
  { id: '5', label: 'Generar' },
  { id: '6', label: 'Resultados' },
];

const ANCHOR_PROGRESS_STEPS: ProgressStep[] = [
  { id: 'brief',   label: 'Analizando brief y referencias' },
  { id: 'plan',    label: 'Diseñando estrategia de campaña' },
  { id: 'anchor',  label: 'Generando propuestas de estilo visual' },
  { id: 'done',    label: 'Listo para aprobar' },
];

const CAMPAIGN_PROGRESS_STEPS: ProgressStep[] = [
  { id: 'anchor',   label: 'Analizando estilo aprobado' },
  { id: 'generate', label: 'Generando imágenes de campaña' },
  { id: 'copy',     label: 'Redactando copy y calendario' },
  { id: 'done',     label: 'Kit de campaña listo' },
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
  const [anchorOptions,  setAnchorOptions]  = useState<string[]>([]);
  const [selectedAnchor, setSelectedAnchor] = useState<string>('');
  const [isRegenerating, setIsRegenerating] = useState(false);

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

  // Results UI state
  const [expandedPieza, setExpandedPieza] = useState<string | null>(null);
  const [copiedKey,     setCopiedKey]     = useState<string | null>(null);
  const [activeTab2,    setActiveTab2]    = useState<'plan' | 'calendario' | 'hashtags'>('plan');

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
    // Volver al paso de aprobación (5) si había anclas, si no al paso 3
    const recoveredStep: WizardStep = (data.anchorOptions?.length > 0) ? 5 : 3;
    setStep(recoveredStep);
    setSessionRestored(true);
    setPendingRestore(null);
  };

  const dismissRestore = () => {
    clearSession();
    setPendingRestore(null);
  };

  // Guardar sesión cuando hay plan
  useEffect(() => {
    if (campaignPlan && step >= 4) saveSession();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignPlan, anchorOptions, selectedAnchor, step]);

  // Limpiar sesión cuando la campaña termina o se resetea
  const resetCreatorAndClear = () => {
    clearSession();
    setSessionRestored(false);
    setPendingRestore(null);
  };

  // ── Cálculos de costo ──────────────────────────────────────
  const hasProCredits    = isAdmin || proCredits > 0;
  const anchorCreditCost = ANCHOR_IMAGE_COUNT * CREDITS_PER_IMAGE;   // 4 cr
  const imageCreditCost  = imageCount * CREDITS_PER_IMAGE;           // N×2 cr
  const totalCreditCost  = anchorCreditCost + imageCreditCost;       // total
  const creditsAfter     = Math.max(0, (credits?.available ?? 0) - totalCreditCost);
  const insufficient     = !isAdmin && (credits?.available ?? 0) < totalCreditCost;
  const insufficientForAnchorRegen = !isAdmin && (credits?.available ?? 0) < anchorCreditCost;

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
    setAnchorOptions([]); setSelectedAnchor(''); setCampaignPlan(null);
    setCurrentSet(null); setError(null); setProgress(null);
    setProgressStepIndex(0); setIsGenerating(false); setPartialImages([]);
    setExpandedPieza(null); setActiveTab2('plan');
  };

  const openLightbox = (images: string[], idx: number) => {
    setLightboxImages(images); setLightboxIndex(idx); setLightboxOpen(true);
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

  // ── PASO 1: Generar ancla (plan + 2 imágenes de estilo) ───
  const handleGenerateAnchor = async () => {
    if (!hasProCredits) return;

    // Cobrar: 1 pro-credit + créditos totales (ancla + campaña)
    if (!isAdmin) {
      const ok = await deductProCredit();
      if (!ok) { setError('No tenés pro-credits para esta sesión.'); return; }
    }
    if (!isAdmin && (credits?.available ?? 0) < totalCreditCost) {
      if (!isAdmin) await refundProCredit();
      setError(`Necesitás ${totalCreditCost} créditos para esta campaña.`);
      return;
    }
    if (!isAdmin) {
      const ok = await deductCredits(totalCreditCost);
      if (!ok) {
        await refundProCredit();
        setError('Error al descontar créditos. Intentá de nuevo.');
        return;
      }
    }

    setStep(4);
    setIsGenerating(true);
    setError(null);
    setProgressSteps(ANCHOR_PROGRESS_STEPS);
    setProgress({ total: ANCHOR_IMAGE_COUNT, completed: 0, current: 0 });
    setProgressStepIndex(0);

    try {
      // Construir plan estratégico
      setProgressStepIndex(1);
      const plan = await buildCampaignPlan(idea, canales, imageCount, activeSlots);
      setCampaignPlan(plan);
      console.log('[Campaign] Plan construido:', plan.concepto);

      // Generar 2 imágenes ancla
      setProgressStepIndex(2);
      const anchors = await generateAnchorImages(
        plan, activeSlots,
        { uid: user?.uid, sessionId: newSessionId() },
        (done, total, partialUrls) => {
          setProgress({ total, completed: done, current: done - 1 });
          // Actualizar anchorOptions con URLs parciales a medida que llegan
          if (partialUrls) setAnchorOptions(partialUrls.filter(Boolean));
        },
      );

      setProgressStepIndex(3);

      const validAnchors = anchors.filter(Boolean);
      if (validAnchors.length === 0) {
        throw new Error('No se pudieron generar las propuestas de estilo. Intentá de nuevo.');
      }

      setAnchorOptions(validAnchors);
      setSelectedAnchor(validAnchors[0]);
      await refreshCredits();

      // Ir al paso de aprobación
      setStep(5);
    } catch (err: any) {
      console.error('[Campaign] handleGenerateAnchor error:', err);
      setError(`Error generando las propuestas de estilo: ${err?.message || err}`);
      if (!isAdmin) {
        await refundProCredit().catch(() => {});
        await deductCredits(-totalCreditCost).catch(() => {});
        await refreshCredits().catch(() => {});
      }
      setStep(3);
    } finally {
      setIsGenerating(false);
      setProgress(null);
    }
  };

  // ── PASO 2: Regenerar ancla (cuesta 4 créditos más) ───────
  const handleRegenerateAnchor = async () => {
    if (insufficientForAnchorRegen) return;
    if (!isAdmin) {
      const ok = await deductCredits(anchorCreditCost);
      if (!ok) { setError('Error al descontar créditos.'); return; }
    }

    setIsRegenerating(true);
    setError(null);

    try {
      const anchors = await generateAnchorImages(
        campaignPlan, activeSlots,
        { uid: user?.uid, sessionId: newSessionId() },
      );
      setAnchorOptions(anchors.filter(Boolean));
      setSelectedAnchor(anchors[0] ?? '');
      await refreshCredits();
    } catch (err: any) {
      setError(`Error regenerando: ${err?.message || err}`);
      if (!isAdmin) await deductCredits(-anchorCreditCost).catch(() => {});
    } finally {
      setIsRegenerating(false);
    }
  };

  // ── PASO 3: Generar campaña con ancla aprobada ────────────
  const handleGenerateCampaign = async () => {
    if (!selectedAnchor || !campaignPlan) return;

    // Determinar el modo según qué ancla eligió la usuaria
    // anchorOptions[0] = A = UGC, anchorOptions[1] = B = Editorial
    const anchorIndex = anchorOptions.indexOf(selectedAnchor);
    campaignPlan.modoVisual = anchorIndex === 1 ? 'editorial' : 'ugc';

    setStep(6);
    setIsGenerating(true);
    setError(null);
    setCurrentSet(null);
    setPartialImages([]);
    setProgressSteps(CAMPAIGN_PROGRESS_STEPS);
    setProgress({ total: imageCount, completed: 0, current: 0 });
    setProgressStepIndex(0);

    try {
      setProgressStepIndex(1);
      const images = await generateCampaignImages(
        campaignPlan, activeSlots, selectedAnchor,
        { uid: user?.uid, sessionId: newSessionId() },
        (done, total, partialUrls) => {
          setProgress({ total, completed: done, current: done - 1 });
          if (partialUrls) setPartialImages([...partialUrls]);
          if (done === total) setProgressStepIndex(2);
        },
      );

      setProgressStepIndex(3);

      const validImages = images.filter(Boolean);
      if (validImages.length === 0) {
        throw new Error('No se generó ninguna imagen. La API puede estar saturada — intentá de nuevo en unos minutos.');
      }

      // Inyectar URLs en el plan
      campaignPlan.piezas = campaignPlan.piezas.map((p: any, i: number) => ({
        ...p, imageUrl: images[i] ?? '',
      }));

      const set: CampaignSet = {
        id:            Date.now().toString(),
        createdAt:     Date.now(),
        idea, canales, imageCount,
        slots:         activeSlots,
        anchorImage:   selectedAnchor,
        anchorOptions,
        userName:      user?.displayName ?? undefined,
        plan:          campaignPlan,
      };

      await campaignStorage.save(set);
      await loadSets();
      clearSession();
      setCurrentSet(set);
      setStep(7);
      await refreshCredits();
    } catch (err: any) {
      console.error('[Campaign] handleGenerateCampaign error:', err);
      setError(`Error generando la campaña: ${err?.message || err}`);
      setStep(5); // volver a la aprobación del ancla
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
                {pendingRestore.anchorOptions?.length > 0 ? ' · Ancla lista, faltaba generar las imágenes' : ' · Plan listo, faltaba aprobar el estilo'}
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

              {/* ── PASO 2: CANALES ──────────────────────── */}
              {step === 2 && (
                <div className="fade-in p-4 md:p-8">
                  <div className="max-w-xl">
                    <div className="text-[10px] font-black text-brand-600 uppercase tracking-[0.18em]">Paso 2 · Canales</div>
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

              {/* ── PASO 3: CANTIDAD + COSTO COMPLETO ────── */}
              {step === 3 && (
                <div className="fade-in p-4 md:p-8">
                  <div className="grid grid-cols-1 md:grid-cols-[1fr_300px] gap-5 md:gap-6 items-start">
                    <div>
                      <div className="text-[10px] font-black text-brand-600 uppercase tracking-[0.18em]">Paso 3 · Cantidad</div>
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

                    {/* Panel de costo completo */}
                    <div className="md:sticky md:top-4">
                      <div className="relative bg-slate-900 text-white rounded-2xl p-5 overflow-hidden">
                        <div className="absolute -top-10 -right-10 w-[140px] h-[140px] rounded-full pointer-events-none"
                          style={{ background: 'rgba(124,58,237,0.3)', filter: 'blur(40px)' }} />
                        <div className="relative">
                          <div className="text-[10px] font-bold text-pink-300 uppercase tracking-[0.14em] mb-3.5">Resumen del costo</div>
                          <div className="flex flex-col gap-2 mb-3.5 text-[13px]">
                            <div className="flex justify-between items-baseline">
                              <span className="opacity-70">2 propuestas de estilo</span>
                              <span className="font-semibold">{anchorCreditCost} cr</span>
                            </div>
                            <div className="flex justify-between items-baseline">
                              <span className="opacity-70">{imageCount} imágenes campaña</span>
                              <span className="font-semibold">{imageCreditCost} cr</span>
                            </div>
                            <div className="flex justify-between items-baseline">
                              <span className="opacity-70">Sesión</span>
                              <span className="font-semibold">1 pro-credit</span>
                            </div>
                            <div className="h-px bg-white/10 my-1" />
                            <div className="flex justify-between items-baseline">
                              <span className="opacity-85 text-[13px]">Total créditos</span>
                              <span className="font-display font-extrabold italic text-[36px] tracking-tight leading-none" style={{ fontFamily: 'Syne, Inter, sans-serif' }}>
                                {totalCreditCost}{' '}
                                <span className="text-sm opacity-70 font-semibold not-italic tracking-normal">cr</span>
                              </span>
                            </div>
                          </div>
                          <div className="h-px bg-white/10 mb-3" />
                          <div className="text-[11px] opacity-60 leading-[1.5] mb-2">Si regenerás el estilo: +{anchorCreditCost} cr extra</div>
                          <div className={`text-[11px] leading-[1.5] ${insufficient ? 'text-rose-300' : 'opacity-70'}`}>
                            {insufficient
                              ? <><strong>Créditos insuficientes.</strong> Te faltan {totalCreditCost - (credits?.available ?? 0)} cr.</>
                              : <>Te quedarán <strong>{creditsAfter} cr</strong> después.</>}
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

              {/* ── PASO 4: GENERANDO ANCLA ──────────────── */}
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
                        {campaignPlan?.tagline ?? 'Preparando tu campaña'}
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

              {/* ── PASO 5: APROBAR ANCLA ────────────────── */}
              {step === 5 && (
                <div className="fade-in p-4 md:p-8">
                  <div className="text-[10px] font-black text-brand-600 uppercase tracking-[0.18em] mb-2">Paso 4 · Elegí el estilo</div>
                  <h2 className="t-display text-[26px] md:text-[32px] text-slate-900 mb-2 leading-[1.05]">
                    ¿Cuál es la estética de <span className="text-brand-600 italic normal-case">tu campaña?</span>
                  </h2>
                  <p className="text-sm text-slate-500 mb-6 leading-[1.55] max-w-[560px]">
                    La imagen que elijas define el estilo visual de toda la campaña. Todas las demás imágenes van a mantener esta misma estética, luz y composición.
                  </p>

                  {error && (
                    <div className="mb-4 p-4 bg-rose-50 border border-rose-200 rounded-2xl text-[12px] text-rose-700 font-medium flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />{error}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4 mb-6">
                    {anchorOptions.map((url, i) => {
                      const label   = i === 0 ? 'A' : 'B';
                      const variant = i === 0 ? '📱 UGC · iPhone orgánico · personas reales' : '📷 Editorial · revista · lookbook premium';
                      const isSelected = selectedAnchor === url;
                      return (
                        <button key={i} type="button" onClick={() => setSelectedAnchor(url)}
                          className={`relative rounded-[20px] overflow-hidden border-4 transition-all cursor-pointer group ${isSelected ? 'border-brand-600 shadow-xl' : 'border-transparent hover:border-slate-200'}`}
                          style={{ maxHeight: 420 }}>
                          {/* Imagen */}
                          <div className="relative h-full">
                            <img src={url} alt={`Opción ${label}`} className="w-full h-full object-cover" style={{ maxHeight: 420 }} />
                            <div className={`absolute inset-0 transition-opacity ${isSelected ? 'bg-brand-600/10' : 'bg-black/0 group-hover:bg-black/5'}`} />
                          </div>
                          {/* Badge seleccionado */}
                          {isSelected && (
                            <div className="absolute top-4 right-4 w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center shadow-lg">
                              <Check className="w-4 h-4 text-white" strokeWidth={3} />
                            </div>
                          )}
                          {/* Label */}
                          <div className="absolute top-4 left-4">
                            <span className="bg-black/60 backdrop-blur-md text-white text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-full">
                              Opción {label}
                            </span>
                          </div>
                          {/* Footer */}
                          <div className={`absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black/70 to-transparent`}>
                            <p className="text-white text-[12px] font-semibold">{variant}</p>
                            {isSelected && <p className="text-brand-300 text-[10px] font-bold uppercase tracking-wider mt-0.5">Seleccionada ✓</p>}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Regenerar */}
                  <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-2xl">
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
                </div>
              )}

              {/* ── PASO 6: GENERANDO CAMPAÑA ────────────── */}
              {step === 6 && (
                <div className="fade-in p-4 md:p-8">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-5 md:gap-7 items-start">
                    <div className="md:col-span-5 lg:col-span-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-2 h-2 rounded-full bg-brand-600 animate-pulse" />
                        <span className="text-[10px] font-black text-brand-600 uppercase tracking-[0.18em]">Generando campaña · no cierres</span>
                      </div>
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
                      <div className="bg-white border border-slate-200 rounded-2xl p-4">
                        <GenProgress steps={progressSteps} currentStepIndex={progressStepIndex} completedShots={[]} totalShots={0} />
                      </div>
                    </div>
                    <div className="md:col-span-7 lg:col-span-8">
                      <div className="flex justify-between items-baseline mb-3.5">
                        <div>
                          <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.14em] mb-1">En vivo</div>
                          <h3 className="font-display font-extrabold italic text-[20px] md:text-[22px] text-slate-900 normal-case"
                            style={{ fontFamily: 'Syne, Inter, sans-serif' }}>
                            {progress ? progress.completed : 0} de {imageCount} listas
                          </h3>
                        </div>
                      </div>
                      <div className={`grid gap-3 ${imageCount <= 4 ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-3 md:grid-cols-4'}`}>
                        {Array.from({ length: imageCount }).map((_, i) => {
                          const imgUrl = partialImages[i] ?? '';
                          const done   = !!imgUrl;
                          const active = !done && progress ? i === progress.completed && isGenerating : false;
                          return (
                            <div key={i} className={`relative aspect-[3/4] rounded-2xl overflow-hidden transition-all ${done ? 'fade-in shadow-md' : active ? 'border-2 border-brand-600 bg-slate-100 animate-pulse' : 'bg-slate-100'}`}>
                              {/* Imagen real cuando llega */}
                              {imgUrl && (
                                <img src={imgUrl} alt={`Pieza ${i + 1}`} className="w-full h-full object-cover" />
                              )}
                              {/* Indicador activo */}
                              {active && !imgUrl && (
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <div className="bg-white/95 rounded-full px-3.5 py-1.5 text-[10px] font-bold text-brand-600 tracking-[0.12em] uppercase">Generando...</div>
                                </div>
                              )}
                              {/* Número de pieza cuando está esperando */}
                              {!done && !active && (
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
              {step === 7 && currentSet && (
                <div className="fade-in p-4 md:p-8">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                    <div>
                      <div className="flex items-center gap-2.5 mb-2 flex-wrap">
                        <div className="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                          <Check size={14} strokeWidth={3} />
                        </div>
                        <span className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.18em]">
                          Kit de campaña listo · {currentSet.plan.piezas.length} piezas
                        </span>
                      </div>
                      <h2 className="font-display font-extrabold italic uppercase tracking-tight text-[24px] md:text-[30px] text-slate-900 leading-[1.05]"
                        style={{ fontFamily: 'Syne, Inter, sans-serif', letterSpacing: '-0.025em' }}>
                        {currentSet.plan.tagline}
                      </h2>
                      <p className="text-[13px] text-slate-500 mt-1 italic">"{currentSet.plan.concepto}"</p>
                    </div>
                    <div className="flex gap-2 w-full md:w-auto flex-wrap">
                      <button type="button" onClick={() => downloadSetZip(currentSet)}
                        className="flex-1 md:flex-none flex items-center justify-center gap-1.5 bg-white border border-slate-200 hover:border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-700 transition-colors">
                        <Download size={14} /> ZIP
                      </button>
                      <button type="button" onClick={() => handleDownloadHtml(currentSet)}
                        disabled={downloadingHtml || downloadingPdf}
                        className="flex-1 md:flex-none flex items-center justify-center gap-1.5 bg-white border border-slate-200 hover:border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-700 transition-colors disabled:opacity-60 disabled:cursor-wait"
                        title="Descargá una versión interactiva del kit — abrila desde tu PC para marcar el progreso, copiar textos y exportar PDF">
                        {downloadingHtml
                          ? <><div className="w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" /> Generando...</>
                          : <><FileText size={14} /> Versión interactiva</>}
                      </button>
                      <button type="button" onClick={() => handleDownloadPdf(currentSet)}
                        disabled={downloadingHtml || downloadingPdf}
                        className="flex-1 md:flex-none flex items-center justify-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-colors disabled:opacity-60 disabled:cursor-wait">
                        {downloadingPdf
                          ? <><div className="w-3 h-3 border-2 border-white/50 border-t-white rounded-full animate-spin" /> Generando PDF...</>
                          : <><Download size={14} /> PDF</>}
                      </button>
                      <button type="button" onClick={resetCreator}
                        className="flex-1 md:flex-none flex items-center justify-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-colors">
                        <Plus size={14} /> Nueva campaña
                      </button>
                    </div>
                    {downloadError && (
                      <div className="mt-2 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
                        <p className="text-[11px] text-rose-700">{downloadError}</p>
                      </div>
                    )}
                  </div>

                  {/* Resumen ejecutivo */}
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3.5 mb-6 flex gap-3">
                    <span className="text-lg flex-shrink-0">📌</span>
                    <div>
                      <p className="text-[11px] font-bold text-amber-800 uppercase tracking-wider mb-1">Qué hacer con este kit</p>
                      <p className="text-[13px] text-amber-900 leading-relaxed">{currentSet.plan.resumen}</p>
                    </div>
                  </div>

                  {/* Tabs */}
                  <div className="flex gap-1 bg-slate-100 p-1 rounded-2xl mb-6 w-fit">
                    {([
                      { id: 'plan' as const,       label: 'Piezas',     icon: <ImageIcon size={12} /> },
                      { id: 'calendario' as const,  label: 'Calendario', icon: <Calendar size={12} /> },
                      { id: 'hashtags' as const,    label: 'Hashtags',   icon: <Hash size={12} /> },
                    ]).map(t => (
                      <button key={t.id} type="button" onClick={() => setActiveTab2(t.id)}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-bold transition-all ${activeTab2 === t.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                        {t.icon} {t.label}
                      </button>
                    ))}
                  </div>

                  {/* Tab: Piezas */}
                  {activeTab2 === 'plan' && (
                    <div className="space-y-4">
                      {currentSet.plan.piezas.map((pieza, i) => {
                        const canalMeta  = CAMPAIGN_CHANNEL_META[pieza.canal] ?? { icon: '📢', label: pieza.canal ?? 'Canal', copyHint: '' };
                        const isExpanded = expandedPieza === pieza.id;
                        return (
                          <div key={pieza.id} className="bg-white border border-slate-100 rounded-[24px] overflow-hidden shadow-sm">
                            <button type="button" onClick={() => setExpandedPieza(isExpanded ? null : pieza.id)}
                              className="w-full flex items-center gap-4 p-4 md:p-5 text-left hover:bg-slate-50 transition-colors">
                              <div className="w-14 h-14 md:w-16 md:h-16 rounded-xl overflow-hidden flex-shrink-0 bg-slate-100">
                                {pieza.imageUrl && (
                                  <img src={pieza.imageUrl} alt={pieza.rol} className="w-full h-full object-cover"
                                    onClick={e => { e.stopPropagation(); openLightbox(currentSet.plan.piezas.map(p => p.imageUrl).filter(Boolean), i); }} />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  <span className="text-[10px] font-black text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full uppercase tracking-wider">Día {pieza.dia}</span>
                                  <span className="text-[10px] font-semibold text-slate-500">{canalMeta.icon} {canalMeta.label}</span>
                                  <span className="text-[10px] text-slate-400">· {pieza.rol}</span>
                                </div>
                                <p className="text-[14px] font-bold text-slate-800 truncate">{pieza.titular}</p>
                                <p className="text-[11px] text-slate-500 mt-0.5">⏰ {pieza.horaRecomendada}</p>
                              </div>
                              <ChevronDown size={16} className={`text-slate-400 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                            </button>
                            {isExpanded && (
                              <div className="border-t border-slate-100 p-4 md:p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
                                {pieza.imageUrl && (
                                  <div className="aspect-[4/3] rounded-2xl overflow-hidden cursor-pointer group relative"
                                    onClick={() => openLightbox(currentSet.plan.piezas.map(p => p.imageUrl).filter(Boolean), i)}>
                                    <img src={pieza.imageUrl} alt={pieza.rol} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                                  </div>
                                )}
                                <div className="space-y-4">
                                  <div>
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Titular</p>
                                    <div className="flex items-start justify-between gap-2">
                                      <p className="text-[14px] font-bold text-slate-800 flex-1">{pieza.titular}</p>
                                      <button type="button" onClick={() => copyText(pieza.titular, `tit-${i}`)}
                                        className="w-7 h-7 bg-slate-50 hover:bg-brand-50 text-slate-400 hover:text-brand-600 rounded-lg flex items-center justify-center transition-all flex-shrink-0">
                                        {copiedKey === `tit-${i}` ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                                      </button>
                                    </div>
                                  </div>
                                  <div>
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Caption completo</p>
                                    <div className="flex items-start justify-between gap-2">
                                      <p className="text-[12px] text-slate-600 flex-1 leading-relaxed">{pieza.caption}</p>
                                      <button type="button" onClick={() => copyText(pieza.caption, `cap-${i}`)}
                                        className="w-7 h-7 bg-slate-50 hover:bg-brand-50 text-slate-400 hover:text-brand-600 rounded-lg flex items-center justify-center transition-all flex-shrink-0">
                                        {copiedKey === `cap-${i}` ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                                      </button>
                                    </div>
                                  </div>
                                  <div>
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">CTA</p>
                                    <div className="flex items-center justify-between gap-2">
                                      <p className="text-[12px] font-bold text-brand-600">{pieza.cta}</p>
                                      <button type="button" onClick={() => copyText(pieza.cta, `cta-${i}`)}
                                        className="w-7 h-7 bg-slate-50 hover:bg-brand-50 text-slate-400 hover:text-brand-600 rounded-lg flex items-center justify-center transition-all flex-shrink-0">
                                        {copiedKey === `cta-${i}` ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                                      </button>
                                    </div>
                                  </div>
                                  <div>
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Hashtags</p>
                                    <div className="flex flex-wrap gap-1.5">
                                      {pieza.hashtags.map(h => (
                                        <span key={h} className="text-[10px] font-semibold text-violet-700 bg-violet-50 px-2 py-0.5 rounded-full">{h}</span>
                                      ))}
                                    </div>
                                  </div>
                                  <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                                    <p className="text-[9px] font-black text-amber-700 uppercase tracking-widest mb-1">📌 Qué hacer</p>
                                    <p className="text-[11.5px] text-amber-900 leading-relaxed">{pieza.instruccion}</p>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Tab: Calendario */}
                  {activeTab2 === 'calendario' && (
                    <div className="space-y-2">
                      {Array.from({ length: currentSet.plan.duracionDias }, (_, i) => i + 1).map(dia => {
                        const piezasDelDia = currentSet.plan.piezas.filter(p => p.dia === dia);
                        return (
                          <div key={dia} className="bg-white border border-slate-100 rounded-2xl overflow-hidden">
                            <div className={`px-5 py-3 flex items-center justify-between ${dia === 1 ? 'bg-brand-600' : 'bg-slate-50'}`}>
                              <span className={`text-[12px] font-black uppercase tracking-wider ${dia === 1 ? 'text-white' : 'text-slate-700'}`}>Día {dia}</span>
                              {piezasDelDia.length === 0 && <span className={`text-[10px] ${dia === 1 ? 'text-white/70' : 'text-slate-400'}`}>Día de descanso</span>}
                            </div>
                            {piezasDelDia.map(p => {
                              const cm = CAMPAIGN_CHANNEL_META[p.canal] ?? { icon: '📢', label: p.canal ?? 'Canal', copyHint: '' };
                              return (
                                <div key={p.id} className="flex items-center gap-4 px-5 py-3 border-t border-slate-50">
                                  {p.imageUrl && <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0"><img src={p.imageUrl} alt="" className="w-full h-full object-cover" /></div>}
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[12px] font-bold text-slate-800 truncate">{p.titular}</p>
                                    <p className="text-[10px] text-slate-500">{cm.icon} {cm.label} · {p.horaRecomendada}</p>
                                  </div>
                                  <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-2 py-1 rounded-full flex-shrink-0">{p.rol}</span>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Tab: Hashtags */}
                  {activeTab2 === 'hashtags' && (
                    <div className="space-y-5">
                      {[
                        { title: 'Comunidad', desc: 'Alta visibilidad. Usá 2-3 en cada post para construir presencia a largo plazo.', tags: currentSet.plan.hashtagsComunidad, color: 'bg-brand-50 text-brand-700' },
                        { title: 'Nicho', desc: 'Conectan con personas que ya buscan lo que vendés. Incluí todos en cada post.', tags: currentSet.plan.hashtagsNicho, color: 'bg-violet-50 text-violet-700' },
                        { title: 'Cola larga', desc: 'Menos alcance pero más intención de compra. Son tus mejores aliados para vender.', tags: currentSet.plan.hashtagsColarga, color: 'bg-emerald-50 text-emerald-700' },
                      ].map(group => (
                        <div key={group.title} className="bg-white border border-slate-100 rounded-2xl p-5">
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <div>
                              <p className="text-[13px] font-bold text-slate-800">{group.title}</p>
                              <p className="text-[11px] text-slate-500 mt-0.5">{group.desc}</p>
                            </div>
                            <button type="button" onClick={() => copyText(group.tags.join(' '), `ht-${group.title}`)}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-brand-50 text-slate-500 hover:text-brand-600 rounded-xl text-[10px] font-bold transition-all flex-shrink-0">
                              {copiedKey === `ht-${group.title}` ? <Check size={10} /> : <Copy size={10} />} Copiar todos
                            </button>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {group.tags.map(tag => (
                              <span key={tag} className={`text-[11px] font-semibold px-3 py-1 rounded-full ${group.color}`}>
                                {tag.startsWith('#') ? tag : `#${tag}`}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Footer */}
                  <div className="flex flex-col md:flex-row md:justify-between md:items-center mt-7 pt-5 border-t border-slate-200 gap-2 md:gap-3.5">
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => { resetCreator(); setStep(2); }}
                        className="flex items-center gap-1.5 bg-violet-50 hover:bg-violet-100 border border-violet-200 text-violet-700 rounded-xl px-4 py-3 text-[13px] font-bold transition-colors">
                        <RefreshCw size={14} /> Ajustar y regenerar
                      </button>
                      <button type="button" onClick={resetCreator}
                        className="flex items-center gap-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-4 py-3 text-[13px] font-semibold transition-colors">
                        <Plus size={14} /> Nueva campaña
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
            {(step === 1 || step === 2 || step === 3 || step === 5) && (
              <WizardFooter
                onBack={step > 1 ? () => setStep(s => (s - 1) as WizardStep) : undefined}
                onContinue={() => {
                  if (step === 1 && canStep1) setStep(2);
                  else if (step === 2 && canStep2) setStep(3);
                  else if (step === 3 && canStep3) handleGenerateAnchor();
                  else if (step === 5 && selectedAnchor) handleGenerateCampaign();
                }}
                continueLabel={
                  step === 3 ? 'Generar propuestas de estilo' :
                  step === 5 ? `Generar campaña completa · ${imageCount} imágenes` :
                  'Continuar'
                }
                disabled={
                  (step === 1 && !canStep1) ||
                  (step === 2 && !canStep2) ||
                  (step === 3 && insufficient) ||
                  (step === 5 && !selectedAnchor)
                }
                costInfo={
                  step === 3 ? { cost: totalCreditCost, label: 'Créditos totales' } :
                  step === 5 ? { cost: 0, label: 'Sin costo adicional' } :
                  undefined
                }
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
                <p className="t-body-sm mb-6">Creá tu primer kit de campaña para guardarlo aquí</p>
                <button type="button" onClick={() => setActiveTab('create')}
                  className="flex items-center gap-2 px-6 py-3 bg-brand-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-md hover:bg-brand-700 transition-colors">
                  <Sparkles size={14} /> Crear campaña
                </button>
              </div>
            )}
            <div className="space-y-6">
              {sets.map(set => (
                <div key={set.id} className="bg-white border border-slate-100 rounded-[36px] overflow-hidden shadow-sm">
                  <div className="p-5 md:p-6 flex items-center justify-between border-b border-slate-100">
                    <div className="min-w-0">
                      <p className="font-display font-bold italic text-[16px] text-slate-900 uppercase truncate" style={{ fontFamily: 'Syne, Inter, sans-serif' }}>
                        {set.plan?.tagline ?? 'Campaña'}
                      </p>
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">{set.idea}</p>
                      <p className="text-[10px] text-slate-300 mt-0.5">
                        {new Date(set.createdAt).toLocaleDateString('es-CL')} · {set.plan?.piezas?.length ?? 0} piezas
                      </p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0 ml-4">
                      <button type="button" onClick={() => handleDownloadHtml(set)} disabled={downloadingHtml || downloadingPdf}
                        className="w-9 h-9 bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded-xl flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-wait" title="Versión interactiva">
                        {downloadingHtml ? <div className="w-3.5 h-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" /> : <FileText className="w-4 h-4" />}
                      </button>
                      <button type="button" onClick={() => handleDownloadPdf(set)} disabled={downloadingHtml || downloadingPdf}
                        className="w-9 h-9 bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded-xl flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-wait" title="Descargar PDF">
                        {downloadingPdf ? <div className="w-3.5 h-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" /> : <Download className="w-4 h-4" />}
                      </button>
                      <button type="button" onClick={() => downloadSetZip(set)}
                        className="w-9 h-9 bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded-xl flex items-center justify-center transition-all" title="Descargar ZIP">
                        <Download className="w-4 h-4" />
                      </button>
                      <button type="button" onClick={() => deleteSet(set.id)} disabled={deletingId === set.id}
                        className="w-9 h-9 bg-rose-50 hover:bg-rose-100 text-rose-400 hover:text-rose-600 rounded-xl flex items-center justify-center transition-all disabled:opacity-40">
                        {deletingId === set.id ? <div className="w-3.5 h-3.5 border-2 border-rose-400 border-t-transparent rounded-full animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 p-3">
                    {set.plan?.piezas?.map((pieza, i) => pieza.imageUrl ? (
                      <div key={i} className="aspect-[3/4] rounded-2xl overflow-hidden cursor-pointer group relative"
                        onClick={() => openLightbox(set.plan.piezas.map(p => p.imageUrl).filter(Boolean), i)}>
                        <img src={pieza.imageUrl} alt={pieza.rol} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="absolute bottom-2 left-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="bg-white/90 rounded-lg px-2 py-1">
                            <p className="text-[9px] font-black text-slate-900 uppercase truncate">{pieza.rol}</p>
                          </div>
                        </div>
                      </div>
                    ) : null)}
                  </div>
                </div>
              ))}
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
