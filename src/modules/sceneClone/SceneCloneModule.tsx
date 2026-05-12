import React, { useMemo, useState, useEffect, useRef } from "react";
import {
  cloneImageService,
  type AspectRatio,
  type CameraStyle,
  type CloneImageParams,
} from "../../services/cloneImageService";
import { generationHistoryService } from "../../services/generationHistoryService";
import ModuleTutorial from "../../components/shared/ModuleTutorial";
import { TUTORIAL_CONFIGS } from "../../components/shared/tutorialConfigs";
import { useCreditGuard } from "../../hooks/useCreditGuard";
import NoCreditsModal from "../../components/shared/NoCreditsModal";
import { CREDIT_COSTS } from "../../services/creditConfig";
import { readAndCompressFile, downloadAsZip } from '../../utils/imageUtils';
import { ImageLightbox } from '../../components/shared/ImageLightbox';
import { FloatingActionBar } from '../../components/shared/FloatingActionBar';
import { useScrollFAB } from '../../hooks/useScrollFAB';
import { analyzeScene, DetectedObject } from '../../services/sceneAnalysisService';
import { ImageSlot } from '../../components/shared/ImageSlot';
import UploadDisclaimer from '../../components/shared/UploadDisclaimer';
import { cloneMasterStorage, type CloneMasterSession } from '../cloneMaster/storage';
import { useAuth } from '../../modules/auth/AuthContext';
import { GenerationProgress, type ProgressStep } from '../../components/shared/GenerationProgress';
import { ErrorDisplay, toAppError, type AppError } from '../../components/shared/ErrorDisplay';
import { REFUNDABLE_ERRORS, newSessionId } from '../../services/imageApiService';
import { getNotification } from '../../services/notificationsService';
import { useSearchParams } from 'react-router-dom';
import { WizardStepper } from '../../components/shared/WizardStepper';
import { WizardFooter } from '../../components/shared/WizardFooter';
import { ResultCard } from '../../components/shared/ResultCard';
import { ResultLibraryGrid } from '../../components/shared/ResultLibraryGrid';

type Step = 1 | 2 | 3 | 4;

function readFileAsDataURL(file: File): Promise<string> {
  return readAndCompressFile(file);
}

function isDataUrl(s: string) {
  return /^data:image\/[a-zA-Z0-9.+-]+;base64,/.test((s || "").trim());
}

function normalizeImageInput(input: string | null | undefined): string | null {
  const raw = (input || "").trim();
  if (!raw) return null;
  if (isDataUrl(raw)) return raw;
  return `data:image/png;base64,${raw}`;
}

function toBase64OrThrow(input: string | null | undefined, fieldName: string): string {
  const result = normalizeImageInput(input);
  if (!result) {
    throw new Error(`La referencia "${fieldName}" es obligatoria y no puede estar vacía.`);
  }
  return result;
}


// Recorta un ancla visual centrada en la persona de la imagen target.
// No intenta recortar perfecto — solo crea un contexto de posición/pose
// que ayuda a Gemini a integrar la cara en el lugar correcto.
function cropPersonSlot(input: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        if (!w || !h) { resolve(input); return; }
        // Recorte centrado del 80% del ancho — preserva contexto de escena sin eliminar bordes
        const cropW = Math.round(w * 0.80);
        const sx = Math.round((w - cropW) / 2);
        const canvas = document.createElement('canvas');
        canvas.width = cropW;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(input); return; }
        ctx.drawImage(img, sx, 0, cropW, h, 0, 0, cropW, h);
        resolve(canvas.toDataURL('image/jpeg', 0.90));
      } catch { resolve(input); }
    };
    img.onerror = () => resolve(input);
    img.src = input;
  });
}

// --- COMPONENTS UI PRO ---
const ProHeader: React.FC<{ title: string; subtitle: string; icon: string }> = ({ title, subtitle, icon }) => (
  <div className="flex items-center gap-4 mb-6">
    <div className="w-12 h-12 rounded-2xl bg-brand-50 border border-brand-100 flex items-center justify-center text-brand-600 shadow-sm">
      <i className={`fa-solid ${icon} text-xl`}></i>
    </div>
    <div>
      <h2 className="t-display text-xl text-slate-900">{title}</h2>
      <p className="t-meta mt-1">{subtitle}</p>
    </div>
  </div>
);

const CLONE_WIZARD_STEPS = [
  { id: 'target',    label: 'Foto objetivo' },
  { id: 'identity',  label: 'Tu modelo' },
  { id: 'base',      label: 'Generar' },
  { id: 'outfit',    label: 'Personalizar' },
];

type ProSlotType = 'target' | 'face' | 'body' | 'outfit' | 'generic';

const PRO_SLOT_CONFIGS: Record<ProSlotType, { icon: string; color: string; bg: string; border: string; hint: string }> = {
  target:  { icon: 'fa-bullseye',    color: 'text-brand-400',   bg: 'bg-brand-50/60 hover:bg-brand-50',   border: 'hover:border-brand-300',   hint: 'Foto de la escena a replicar' },
  face:    { icon: 'fa-face-smile',  color: 'text-rose-400',    bg: 'bg-rose-50/60 hover:bg-rose-50',     border: 'hover:border-rose-300',     hint: 'Close-up claro del rostro' },
  body:    { icon: 'fa-person',      color: 'text-violet-400',  bg: 'bg-violet-50/60 hover:bg-violet-50', border: 'hover:border-violet-300',   hint: 'Foto de cuerpo completo' },
  outfit:  { icon: 'fa-shirt',       color: 'text-purple-400',  bg: 'bg-purple-50/60 hover:bg-purple-50', border: 'hover:border-purple-300',   hint: 'Foto del outfit a aplicar' },
  generic: { icon: 'fa-image',       color: 'text-slate-400',   bg: 'bg-slate-50/60 hover:bg-slate-50',   border: 'hover:border-slate-300',    hint: 'Click o arrastra una imagen' },
};

const ProUploadCard: React.FC<{
  label: string;
  value: string | null;
  onChange: (v: string | null) => void;
  hint?: string;
  height?: string;
  slotType?: ProSlotType;
}> = ({ label, value, onChange, hint, height = "h-48", slotType = 'generic' }) => {
  const cfg = PRO_SLOT_CONFIGS[slotType];
  return (
    <div className="group relative w-full">
      <div className={`relative w-full ${height} rounded-[24px] border-2 border-dashed border-slate-200 overflow-hidden transition-all ${cfg.bg} ${cfg.border}`}>
        {value ? (
          <>
            <img src={value} alt="Preview" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              <label className="cursor-pointer w-10 h-10 bg-white rounded-full flex items-center justify-center text-slate-900 shadow-lg hover:scale-110 transition-transform">
                <i className="fa-solid fa-rotate-right text-xs"></i>
                <input type="file" className="hidden" accept="image/*" onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f) onChange(await readFileAsDataURL(f));
                }} />
              </label>
              <button onClick={() => onChange(null)} className="w-10 h-10 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform">
                <i className="fa-solid fa-trash text-xs"></i>
              </button>
            </div>
          </>
        ) : (
          <label className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer gap-2 p-3 text-center">
            <div className={`w-10 h-10 bg-white rounded-2xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform`}>
              <i className={`fa-solid ${cfg.icon} ${cfg.color} text-base transition-colors`}></i>
            </div>
            <div className="space-y-0.5">
              <p className="t-meta text-slate-600 leading-tight">{label}</p>
              <p className="text-[9px] font-medium text-slate-400">{hint || cfg.hint}</p>
            </div>
            <input type="file" className="hidden" accept="image/*" onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) onChange(await readFileAsDataURL(f));
            }} />
          </label>
        )}
      </div>
    </div>
  );
};

const ProSelect: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { label: string; value: string }[];
}> = ({ label, value, onChange, options }) => (
  <div className="space-y-2">
    <label className="t-meta ml-1">{label}</label>
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold rounded-2xl px-4 py-3 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 transition-all"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
        <i className="fa-solid fa-chevron-down text-xs"></i>
      </div>
    </div>
  </div>
);

const ProToggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }> = ({ checked, onChange, label, description }) => (
  <div 
    onClick={() => onChange(!checked)}
    className={`p-4 rounded-[24px] border-2 cursor-pointer transition-all ${checked ? 'border-brand-600 bg-brand-50' : 'border-slate-100 bg-white hover:border-slate-200'}`}
  >
    <div className="flex items-center justify-between">
       <div className="flex items-center gap-3">
          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${checked ? 'border-brand-600 bg-brand-600' : 'border-slate-300'}`}>
             {checked && <i className="fa-solid fa-check text-white text-[10px]"></i>}
          </div>
          <div>
             <p className={`t-meta ${checked ? 'text-brand-900' : 'text-slate-600'}`}>{label}</p>
             {description && <p className="text-[9px] font-medium text-slate-400 mt-0.5">{description}</p>}
          </div>
       </div>
    </div>
  </div>
);

// --- MAIN MODULE ---

export default function CloneImageModule() {
  const { credits, user } = useAuth();
  const modelId = 'gemini' as const;
  const [step, setStep] = useState<Step>(1);
  const [maxStep, setMaxStep] = useState<number>(1);

  const [cameraStyle, setCameraStyle] = useState<CameraStyle>("iphone_1x");
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("9:16");

  const [targetImage, setTargetImage] = useState<string | null>(null);
  
  const [face1, setFace1] = useState<string | null>(null);
  const [body1, setBody1] = useState<string | null>(null);

  const [replaceOutfit1, setReplaceOutfit1] = useState(false);
  const [outfit1, setOutfit1] = useState<string | null>(null);

  const [detectedProducts, setDetectedProducts] = useState<DetectedObject[]>([]);
  const [analyzingTarget, setAnalyzingTarget] = useState(false);

  const [baseComposition, setBaseComposition] = useState<string | null>(null);
  const [finalImage, setFinalImage] = useState<string | null>(null);

  // Retomar sesión desde notificación
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const sessionParam = searchParams.get('session');
    if (!sessionParam || !user) return;
    let cancelled = false;
    (async () => {
      const notif = await getNotification(user.uid, sessionParam);
      if (cancelled || !notif) {
        setSearchParams({}, { replace: true });
        return;
      }
      const completed = notif.shots.find(s => s.status === 'completed' && s.imageUrl);
      if (completed?.imageUrl) {
        // Si era el "Final" lo cargamos como finalImage; si no, como base
        if (notif.moduleLabel.includes('Final')) {
          setFinalImage(completed.imageUrl);
        } else {
          setBaseComposition(completed.imageUrl);
        }
        if (notif.metadata?.cameraStyle) setCameraStyle(notif.metadata.cameraStyle);
        if (notif.metadata?.aspectRatio) setAspectRatio(notif.metadata.aspectRatio);
        setStep(4);
      }
      setSearchParams({}, { replace: true });
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<AppError | null>(null);
  const [creditsRefunded, setCreditsRefunded] = useState(false);

  const CLONE_STEPS: ProgressStep[] = [
    { id: 'analyze', label: 'Analizando escena y geometría' },
    { id: 'biolock', label: 'Reconociendo identidad facial' },
    { id: 'synth',   label: 'Sintetizando composición' },
  ];
  const APPLY_STEPS: ProgressStep[] = [
    { id: 'outfit',  label: 'Aplicando nuevo outfit' },
    { id: 'identity', label: 'Ajustando identidad facial' },
    { id: 'finish',  label: 'Finalizando imagen' },
  ];
  const [cloneStepIndex, setCloneStepIndex] = useState(0);
  const [cloneEta, setCloneEta]             = useState(0);
  const cloneEtaRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const cloneStartRef = useRef<number>(0);
  const cloneT1Ref    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cloneT2Ref    = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const [sessions, setSessions]         = useState<CloneMasterSession[]>([]);
  const [showHistory, setShowHistory]   = useState(false);
  const [deletingId, setDeletingId]     = useState<string | null>(null);

  const { isVisible: fabVisibleRaw } = useScrollFAB({ threshold: 100, alwaysVisibleOnMobile: false });
  const fabVisible = !!fabVisibleRaw;

  const CLONE_COST = CREDIT_COSTS.CLONE_IMAGE;
  const baseGenerationCost = CLONE_COST;
  const creditsAfter = Math.max(0, credits.available - baseGenerationCost);

  useEffect(() => {
    cloneMasterStorage.listSessions().then(setSessions).catch(() => {});
  }, []);

  useEffect(() => {
    if (!targetImage) return;
    const timer = setTimeout(() => {
      setAnalyzingTarget(true);
      analyzeScene(targetImage)
        .then(products => { setDetectedProducts(products); })
        .catch(err => console.warn("Error analyzing scene:", err))
        .finally(() => setAnalyzingTarget(false));
    }, 1500);
    return () => clearTimeout(timer);
  }, [targetImage]);

  const updateProductReplacement = (productId: string, imageBase64: string | null) => {
    setDetectedProducts(prev =>
      prev.map(p => p.id === productId ? { ...p, replacementImage: imageBase64 } : p)
    );
  };

  const canGoToIdentity = !!targetImage;
  const canGoToBase = !!face1 && !!body1;
  const canGoToOutfit = !!baseComposition;

  const activeProductOverrides = detectedProducts.filter(p => p.replacementImage);
  const hasOutfit1Change = !!replaceOutfit1 && !!normalizeImageInput(outfit1);
  const hasProductChanges = activeProductOverrides.length > 0;
  const hasFinalChanges = hasOutfit1Change || hasProductChanges;
  const needsOutfit1Image = !!replaceOutfit1 && !normalizeImageInput(outfit1);
  const canApplyFinalChanges = !!baseComposition && hasFinalChanges && !needsOutfit1Image;
  const finalCreditsAfter = Math.max(0, credits.available - CLONE_COST);
  const finalChangeSummary = [
    hasOutfit1Change ? 'Outfit' : null,
    hasProductChanges ? `${activeProductOverrides.length} producto${activeProductOverrides.length === 1 ? '' : 's'}` : null,
  ].filter(Boolean).join(' + ') || 'Sin cambios seleccionados';

  useMemo(() => {
    let m = 1;
    if (canGoToIdentity) m = 2;
    if (canGoToBase)     m = 3;
    if (canGoToOutfit)   m = 4;
    if (m > maxStep) setMaxStep(m);
  }, [canGoToIdentity, canGoToBase, canGoToOutfit, maxStep]);

  function resetDownstream(fromStep: Step) {
    if (fromStep <= 2) {
      setBaseComposition(null);
      setFinalImage(null);
      setMaxStep(Math.min(maxStep, 2));
    }
    if (fromStep === 3) {
      setFinalImage(null);
      setMaxStep(Math.min(maxStep, 3));
    }
  }

  const { checkAndDeduct, showNoCredits, requiredCredits, closeModal, refundCredits } = useCreditGuard();

  async function handleGenerateBase() {
    const ok = await checkAndDeduct(baseGenerationCost);
    if (!ok) return;
    setError(null);
    setCreditsRefunded(false);
    setLoading(true);

    // Iniciar progreso narrado
    setCloneStepIndex(0);
    cloneStartRef.current = Date.now();
    setCloneEta(60);
    if (cloneEtaRef.current) clearInterval(cloneEtaRef.current);
    cloneEtaRef.current = setInterval(() => {
      const elapsed = (Date.now() - cloneStartRef.current) / 1000;
      setCloneEta(Math.max(0, Math.round(60 - elapsed)));
    }, 1000);
    // Avanzar pasos con tiempos estimados
    cloneT1Ref.current = setTimeout(() => setCloneStepIndex(1), 2000);
    cloneT2Ref.current = setTimeout(() => setCloneStepIndex(2), 5000);

    try {
      const safeTarget = toBase64OrThrow(targetImage, "imagen target");
      const safeFace = toBase64OrThrow(face1, "cara del sujeto 1");
      const safeBody = toBase64OrThrow(body1, "cuerpo del sujeto 1");

      // Ancla visual de posición: recorte centrado del target para ayudar a Gemini
      // a colocar la cara en la pose correcta sin "flotarla" sobre el cuerpo.
      const slotAnchor = await cropPersonSlot(safeTarget);

      const payload: CloneImageParams = {
        targetImage: safeTarget,
        faceImage: safeFace,
        bodyImage: safeBody,
        replaceOutfit: false,
        cameraStyle,
        aspectRatio,
        modelId,
        subject1SlotImage: slotAnchor,
        sessionParams: {
          uid: user?.uid,
          sessionId: newSessionId(),
          module: 'scene_clone',
          moduleLabel: 'Clonar escena (Base)',
          shotIndex: 0,
          totalShots: 1,
          metadata: { cameraStyle, aspectRatio, baseGenerationCost },
        },
      };

      const img = await cloneImageService.cloneImage(payload);
      setBaseComposition(img);

      generationHistoryService.save({
        imageUrl: img,
        module: 'scene_clone',
        moduleLabel: 'Scene Clone (Base)',
        creditsUsed: baseGenerationCost,
        promptText: `Clonación de escena base con estilo ${cameraStyle}`
      }).catch(console.error);

      const session: CloneMasterSession = {
        id: Date.now().toString(),
        createdAt: Date.now(),
        targetImage: safeTarget,
        baseComposition: img,
        face1: safeFace,
        body1: safeBody,
        cameraStyle,
        aspectRatio,
      };
      cloneMasterStorage.saveSession(session)
        .then(() => cloneMasterStorage.listSessions().then(setSessions))
        .catch(console.error);

      setStep(4);
    } catch (e: any) {
      const appErr = toAppError(e);
      setError(appErr);
      if (REFUNDABLE_ERRORS.has(appErr.code as any)) {
        const refunded = await refundCredits(baseGenerationCost);
        setCreditsRefunded(refunded);
      }
    } finally {
      // Limpiar timers de progreso
      if (cloneEtaRef.current) { clearInterval(cloneEtaRef.current); cloneEtaRef.current = null; }
      if (cloneT1Ref.current)  { clearTimeout(cloneT1Ref.current);  cloneT1Ref.current  = null; }
      if (cloneT2Ref.current)  { clearTimeout(cloneT2Ref.current);  cloneT2Ref.current  = null; }
      setCloneStepIndex(CLONE_STEPS.length - 1);
      setCloneEta(0);
      setLoading(false);
    }
  }

  async function handleApplyOutfitsAndProducts() {
    if (!baseComposition) return;

    setError(null);
    setCreditsRefunded(false);

    if (needsOutfit1Image) {
      setError(toAppError(new Error('Activaste Cambiar Outfit S1, pero falta subir la imagen del outfit.')));
      return;
    }

    if (!hasFinalChanges) {
      setError(toAppError(new Error('Selecciona al menos un cambio: outfit S1, outfit S2 o reemplazo de producto.')));
      return;
    }

    const ok = await checkAndDeduct(CREDIT_COSTS.CLONE_IMAGE);
    if (!ok) return;

    setLoading(true);

    // Iniciar progreso narrado para step 4
    setCloneStepIndex(0);
    cloneStartRef.current = Date.now();
    setCloneEta(45);
    if (cloneEtaRef.current) clearInterval(cloneEtaRef.current);
    cloneEtaRef.current = setInterval(() => {
      const elapsed = (Date.now() - cloneStartRef.current) / 1000;
      setCloneEta(Math.max(0, Math.round(45 - elapsed)));
    }, 1000);
    cloneT1Ref.current = setTimeout(() => setCloneStepIndex(1), 2000);
    cloneT2Ref.current = setTimeout(() => setCloneStepIndex(2), 5000);

    try {
      const safeTarget = toBase64OrThrow(baseComposition, "composición base");
      const safeFace = toBase64OrThrow(face1, "cara del sujeto 1");
      const safeBody = toBase64OrThrow(body1, "cuerpo del sujeto 1");

      const payload: CloneImageParams = {
        targetImage: safeTarget,
        faceImage: safeFace,
        bodyImage: safeBody,
        replaceOutfit: !!replaceOutfit1,
        outfitOverrideImage: replaceOutfit1 ? normalizeImageInput(outfit1) : null,
        cameraStyle,
        aspectRatio,
        productOverrides: activeProductOverrides,
        modelId,
        sessionParams: {
          uid: user?.uid,
          sessionId: newSessionId(),
          module: 'scene_clone',
          moduleLabel: 'Clonar escena (Final)',
          shotIndex: 0,
          totalShots: 1,
          metadata: { cameraStyle, aspectRatio },
        },
      };

      const img = await cloneImageService.cloneImage(payload);
      setFinalImage(img);

      generationHistoryService.save({
        imageUrl: img,
        module: 'scene_clone',
        moduleLabel: 'Scene Clone (Final)',
        creditsUsed: CREDIT_COSTS.CLONE_IMAGE,
        promptText: `Clonación final con aplicación de outfits y productos`
      }).catch(console.error);

      setSessions(prev => {
        const updated = [...prev];
        if (updated.length > 0) {
          updated[0] = {
            ...updated[0],
            finalImage: img,
            outfit1: replaceOutfit1 ? (normalizeImageInput(outfit1) || undefined) : undefined,
          };
          cloneMasterStorage.saveSession(updated[0]).catch(console.error);
        }
        return updated;
      });
    } catch (e: any) {
      const appErr = toAppError(e);
      setError(appErr);
      if (REFUNDABLE_ERRORS.has(appErr.code as any)) {
        const refunded = await refundCredits(CREDIT_COSTS.CLONE_IMAGE);
        setCreditsRefunded(refunded);
      }
    } finally {
      if (cloneEtaRef.current) { clearInterval(cloneEtaRef.current); cloneEtaRef.current = null; }
      if (cloneT1Ref.current)  { clearTimeout(cloneT1Ref.current);  cloneT1Ref.current  = null; }
      if (cloneT2Ref.current)  { clearTimeout(cloneT2Ref.current);  cloneT2Ref.current  = null; }
      setCloneStepIndex(APPLY_STEPS.length - 1);
      setCloneEta(0);
      setLoading(false);
    }
  }

  const activePreview = step === 1 ? targetImage 
                      : step === 3 ? (loading ? null : (baseComposition || targetImage)) 
                      : step === 4 ? (finalImage || baseComposition) 
                      : null;

  const openLightbox = () => {
    const images: string[] = [];
    if (targetImage) images.push(targetImage);
    if (baseComposition) images.push(baseComposition);
    if (finalImage) images.push(finalImage);
    if (images.length === 0) return;
    
    let startIndex = 0;
   if (activePreview === finalImage) startIndex = images.indexOf(finalImage!);
else if (activePreview === baseComposition) startIndex = images.indexOf(baseComposition!);
else if (activePreview === targetImage) startIndex = images.indexOf(targetImage!);
    
    setLightboxImages(images);
    setLightboxIndex(startIndex >= 0 ? startIndex : 0);
    setLightboxOpen(true);
  };

  const handleDownloadZip = async () => {
    const imagesToZip: string[] = [];
    if (baseComposition) imagesToZip.push(baseComposition);
    if (finalImage) imagesToZip.push(finalImage);
    if (imagesToZip.length === 0) return;
    await downloadAsZip(imagesToZip, `clone_images_${Date.now()}.zip`, 'clone');
  };

  const deleteSession = async (id: string) => {
    setDeletingId(id);
    await cloneMasterStorage.deleteSession(id).catch(console.error);
    setSessions(prev => prev.filter(s => s.id !== id));
    setDeletingId(null);
  };

  const loadSession = (s: CloneMasterSession) => {
    setTargetImage(s.targetImage);
    setFace1(s.face1);
    setBody1(s.body1);
    setOutfit1(s.outfit1 || null);
    setBaseComposition(s.baseComposition);
    setFinalImage(s.finalImage || null);
    setCameraStyle(s.cameraStyle as any);
    setAspectRatio(s.aspectRatio as any);
    setMaxStep(4);
    setStep(4);
    setShowHistory(false);
  };

  const fullReset = () => {
    setStep(1);
    setTargetImage(null);
    setFace1(null);
    setBody1(null);
    setOutfit1(null);
    setBaseComposition(null);
    setFinalImage(null);
    setReplaceOutfit1(false);
    setDetectedProducts([]);
    setError(null);
    setCreditsRefunded(false);
    setMaxStep(1);
  };

  return (
    <>
      <NoCreditsModal isOpen={showNoCredits} onClose={closeModal} required={requiredCredits} available={0} />
      
      <div className="max-w-7xl mx-auto space-y-8 pb-24 animate-in fade-in duration-500">
        
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-4 pt-2">
          <div className="text-center md:text-left">
            <h1 className="t-display text-3xl md:text-4xl text-slate-900">Scene <span className="text-brand-600">Clone</span></h1>
            <div className="flex items-center justify-center md:justify-start gap-2 mt-1">
              <p className="text-slate-500 font-bold uppercase text-[8px] md:text-[10px] tracking-[0.3em] italic">Clonar escenas · Coherencia facial <span className="normal-case font-medium text-slate-400 text-[8px]">(Scene Clone)</span></p>
              <ModuleTutorial moduleId="sceneClone" steps={TUTORIAL_CONFIGS.sceneClone} />
            </div>
          </div>
          <div className="flex bg-white p-1 rounded-2xl md:rounded-3xl border border-slate-100 shadow-sm gap-1">
            {sessions.length > 0 && (
              <button
                onClick={() => setShowHistory(p => !p)}
                className={`px-4 md:px-6 py-2 md:py-3 rounded-xl md:rounded-2xl t-meta transition-all flex items-center gap-2 ${showHistory ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-slate-900'}`}
              >
                <i className="fa-solid fa-clock-rotate-left text-xs"></i>
                <span className="hidden md:inline">Historial</span>
                <span className="w-4 h-4 bg-brand-100 text-brand-700 rounded-full text-[8px] font-black flex items-center justify-center">{sessions.length}</span>
              </button>
            )}
            <button onClick={fullReset} className="px-6 md:px-8 py-2 md:py-3 rounded-xl md:rounded-2xl t-meta text-slate-400 hover:text-slate-900 transition-all">Reset</button>
          </div>
        </header>

        {/* ── Pantalla de generando: ocupa todo el ancho, mismo layout que Product Generator ── */}
        {loading && (step === 3 || step === 4) && (
          <div className="px-4 md:px-0 bg-white rounded-[28px] md:rounded-[36px] shadow-sm border border-slate-100 overflow-hidden">
            <WizardStepper
              steps={CLONE_WIZARD_STEPS}
              current={step}
              onJump={undefined}
            />
            <div className="p-4 md:p-8">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-5 md:gap-7 items-start">
                {/* Izquierda: pasos narrados */}
                <div className="md:col-span-5 lg:col-span-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full bg-pink-500 animate-pulse" />
                    <span className="text-[10px] font-black text-pink-600 uppercase tracking-[0.18em]">
                      Generando · no cierres esta ventana
                    </span>
                  </div>
                  <h2 className="t-display text-[24px] md:text-[28px] text-slate-900 leading-tight">
                    {step === 4 ? 'Aplicando cambios' : 'Clonando escena'}
                  </h2>
                  <div className="text-[13px] text-slate-500 mt-1 mb-4">
                    1 imagen · Scene Clone
                  </div>
                  <div className="bg-white border border-slate-200 rounded-2xl p-4 md:p-[18px]">
                    <GenerationProgress
                      steps={step === 4 ? APPLY_STEPS : CLONE_STEPS}
                      currentStepIndex={cloneStepIndex}
                      etaSeconds={cloneEta}
                    />
                  </div>
                  <div className="mt-3 px-3.5 py-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 leading-[1.5]">
                    💡 Podés cerrar la ventana — te avisamos cuando termine.
                  </div>
                </div>
                {/* Derecha: tarjeta de imagen en vivo */}
                <div className="md:col-span-7 lg:col-span-8">
                  <div className="flex justify-between items-baseline mb-3.5">
                    <div>
                      <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.14em] mb-1">En vivo</div>
                      <h3 className="t-display text-[20px] md:text-[22px] text-slate-900 normal-case italic">
                        0 de 1 listas
                      </h3>
                    </div>
                  </div>
                  <div className="relative aspect-[3/4] max-w-xs rounded-2xl overflow-hidden border-2 border-pink-500 bg-slate-100 animate-pulse">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="bg-white/95 rounded-full px-3.5 py-1.5 text-[10px] font-bold text-pink-600 tracking-[0.12em] uppercase">
                        EN VIVO
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className={`grid grid-cols-1 lg:grid-cols-12 gap-8 px-4 md:px-0 ${loading && (step === 3 || step === 4) ? 'hidden' : ''}`}>

          <div className="lg:col-span-4 space-y-6">
            <section className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden flex flex-col">
              <WizardStepper
                steps={CLONE_WIZARD_STEPS}
                current={step}
                onJump={(s) => { if (s <= maxStep) setStep(s as Step); }}
              />
              <div className="p-6 md:p-8 flex-1 overflow-auto">

              {step === 1 && (
                <div className="space-y-6 animate-in slide-in-from-left-4">
                  <ProHeader title="Target Blueprint" subtitle="La escena a replicar" icon="fa-bullseye" />
                  <ProUploadCard
                    label="Escena Target"
                    value={targetImage}
                    onChange={(v) => { setTargetImage(v); resetDownstream(1); }}
                    hint="Define la pose, iluminación y encuadre a replicar"
                    height="h-64"
                    slotType="target"
                  />
                  
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <ProSelect 
                      label="Formato" 
                      value={aspectRatio} 
                      onChange={(v) => setAspectRatio(v as AspectRatio)}
                      options={[
                        { label: "9:16 (Story)", value: "9:16" },
                        { label: "4:5 (Feed)", value: "4:5" },
                        { label: "1:1 (Cuadrado)", value: "1:1" },
                        { label: "16:9 (Cine)", value: "16:9" },
                      ]} 
                    />
                    <ProSelect 
                      label="Estilo Cámara" 
                      value={cameraStyle} 
                      onChange={(v) => setCameraStyle(v as CameraStyle)}
                      options={[
                        { label: "iPhone 1x", value: "iphone_1x" },
                        { label: "Ultra Wide 0.5x", value: "iphone_05x" },
                        { label: "Selfie Frontal", value: "iphone_selfie" },
                      ]} 
                    />
                  </div>

                  <UploadDisclaimer />
                </div>
              )}

              {step === 2 && (
                <div className="space-y-6 animate-in slide-in-from-left-4">
                  <ProHeader title="Identidades" subtitle="Tu modelo" icon="fa-user" />

                  <div className="space-y-3">
                    <label className="t-meta text-brand-900">Sujeto</label>
                    <div className="grid grid-cols-2 gap-3">
                      <ProUploadCard label="Rostro" value={face1} onChange={(v) => { setFace1(v); resetDownstream(2); }} height="h-36" slotType="face" />
                      <ProUploadCard label="Cuerpo" value={body1} onChange={(v) => { setBody1(v); resetDownstream(2); }} height="h-36" slotType="body" />
                    </div>
                  </div>

                </div>
              )}

              {step === 3 && !loading && (
                <div className="space-y-5 animate-in slide-in-from-left-4">
                  <ProHeader title="Generar Base" subtitle="Fusión de Escena + Identidad" icon="fa-wand-magic-sparkles" />

                  {/* Panel de costo — mismo diseño que Step4Type de Product Generator */}
                  <div className="relative bg-slate-900 text-white rounded-2xl p-5 overflow-hidden">
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
                          <span className="opacity-70">Formato</span>
                          <span className="font-semibold">{aspectRatio}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="opacity-70">Imágenes</span>
                          <span className="font-semibold">1</span>
                        </div>
                        <div className="h-px bg-white/10 my-1.5" />
                        <div className="flex justify-between items-baseline">
                          <span className="opacity-85 text-[13px]">Total</span>
                          <span className="t-display text-[36px] tracking-tight leading-none normal-case not-italic">
                            {baseGenerationCost}{' '}
                            <span className="text-sm opacity-70 font-semibold normal-case">cr</span>
                          </span>
                        </div>
                      </div>
                      <div className="text-[11px] leading-[1.5] opacity-70">
                        Te quedarán {creditsAfter} cr
                      </div>
                    </div>
                  </div>

                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2.5 text-[11.5px] text-emerald-900 leading-[1.55]">
                    <strong>Sin sorpresas.</strong> La base consume {baseGenerationCost} cr.
                  </div>
                </div>
              )}

              {step === 4 && (
                <div className="space-y-6 animate-in slide-in-from-left-4">
                  <ProHeader title="Outfit & Productos" subtitle="Personalización de elementos" icon="fa-shirt" />

                  <div className="relative bg-slate-900 text-white rounded-2xl p-5 overflow-hidden">
                    <div
                      className="absolute -top-10 -right-10 w-[140px] h-[140px] rounded-full pointer-events-none"
                      style={{ background: 'rgba(236,72,153,0.28)', filter: 'blur(40px)' }}
                    />
                    <div className="relative">
                      <div className="text-[10px] font-bold text-pink-300 uppercase tracking-[0.14em] mb-3.5">
                        Imagen final · Consume créditos
                      </div>
                      <div className="flex flex-col gap-2 mb-3.5 text-[13px]">
                        <div className="flex justify-between gap-4">
                          <span className="opacity-70">Cambios</span>
                          <span className="font-semibold text-right">{finalChangeSummary}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="opacity-70">Imágenes</span>
                          <span className="font-semibold">1 imagen final</span>
                        </div>
                        <div className="h-px bg-white/10 my-1.5" />
                        <div className="flex justify-between items-baseline">
                          <span className="opacity-85 text-[13px]">Total</span>
                          <span className="t-display text-[36px] tracking-tight leading-none normal-case not-italic">
                            {CLONE_COST}{' '}
                            <span className="text-sm opacity-70 font-semibold normal-case">cr</span>
                          </span>
                        </div>
                      </div>
                      <div className="text-[11px] leading-[1.5] opacity-70">
                        Te quedarán {finalCreditsAfter} cr
                      </div>
                    </div>
                  </div>

                  <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 text-[11.5px] text-amber-900 leading-[1.55]">
                    <strong>Importante:</strong> aplicar outfits o productos genera una nueva imagen final y consume {CLONE_COST} cr. Si la generación falla por un error reembolsable, se devuelve automáticamente.
                  </div>

                  {!hasFinalChanges && !needsOutfit1Image && (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-[11.5px] text-slate-600 leading-[1.55]">
                      Selecciona al menos un cambio antes de generar: activa un outfit y sube su imagen, o sube un producto de reemplazo.
                    </div>
                  )}

                  {needsOutfit1Image && (
                    <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 text-[11.5px] text-red-700 leading-[1.55]">
                      Falta subir la imagen del outfit.
                    </div>
                  )}

                  <div className="space-y-4">
                    <div className={`p-4 rounded-[24px] border transition-all ${replaceOutfit1 ? 'bg-brand-50 border-brand-200' : 'bg-white border-slate-200'}`}>
                       <div className="flex items-center justify-between mb-4">
                          <label className="t-meta text-slate-700">Cambiar Outfit</label>
                          <input type="checkbox" checked={replaceOutfit1} onChange={(e) => setReplaceOutfit1(e.target.checked)} className="w-5 h-5 accent-brand-600 cursor-pointer" />
                       </div>
                       {replaceOutfit1 && (
                          <ProUploadCard label="Outfit" value={outfit1} onChange={setOutfit1} height="h-36" slotType="outfit" />
                       )}
                    </div>

                    {analyzingTarget && targetImage && (
                      <div className="p-4 bg-slate-50 rounded-2xl text-center text-[10px] text-slate-500">
                        <i className="fa-solid fa-spinner animate-spin mr-2"></i> Analizando productos en la imagen...
                      </div>
                    )}

                    {detectedProducts.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <i className="fa-solid fa-box-open text-brand-500"></i>
                          <label className="t-meta text-slate-700">Productos detectados (opcional)</label>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          {detectedProducts.map((product) => (
                            <div key={product.id} className="border border-slate-200 rounded-xl p-2 bg-white">
                              <p className="text-[9px] font-black uppercase text-slate-600 mb-2 truncate">{product.name}</p>
                              <ImageSlot
                                value={product.replacementImage || null}
                                onChange={(base64) => updateProductReplacement(product.id, base64)}
                                label="Reemplazar"
                                hint="Subir imagen"
                                aspectRatio="square"
                                slotType="product"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                </div>
              )}

              {error && (
                <div className="px-6 pb-4">
                  <ErrorDisplay
                    error={error}
                    creditsRefunded={creditsRefunded}
                    onRetry={step === 3 ? handleGenerateBase : handleApplyOutfitsAndProducts}
                    onDismiss={() => setError(null)}
                  />
                </div>
              )}

              </div>{/* fin del div interno */}

              <WizardFooter
                onBack={step > 1 ? () => setStep((step - 1) as Step) : undefined}
                onContinue={() => {
                  if (step === 1 && canGoToIdentity) setStep(2);
                  else if (step === 2 && canGoToBase) setStep(3);
                  else if (step === 3) handleGenerateBase();
                  else if (step === 4) handleApplyOutfitsAndProducts();
                }}
                continueLabel={
                  step === 3 ? `Generar Base · ${baseGenerationCost} cr` :
                  step === 4 ? `Aplicar Cambios · ${CLONE_COST} cr` :
                  'Continuar'
                }
                disabled={
                  step === 1 ? !canGoToIdentity :
                  step === 2 ? !canGoToBase :
                  step === 3 ? loading :
                  step === 4 ? loading || !canApplyFinalChanges :
                  false
                }
                loading={loading && (step === 3 || step === 4)}
              />
            </section>
          </div>

          <div className="lg:col-span-8">
            <div className="bg-slate-900 rounded-[48px] p-8 md:p-12 min-h-[600px] md:min-h-[800px] flex flex-col shadow-2xl border-8 border-slate-800 relative overflow-hidden">
              
              <div className="flex justify-between items-center mb-8 relative z-10">
                 <div>
                    <h3 className="text-white font-black text-2xl uppercase italic tracking-tighter">Visualizador</h3>
                    <p className="text-brand-400 text-[9px] font-black uppercase tracking-[0.3em]">
                      {step === 1 ? "TARGET INPUT" : step === 3 ? "BASE RESULT" : step === 4 ? "FINAL EDIT" : "CONFIGURANDO"}
                    </p>
                 </div>
                 {activePreview && (
                   <button onClick={openLightbox} className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-all">
                      <i className="fa-solid fa-expand text-xs"></i>
                   </button>
                 )}
              </div>

              <div className="flex-1 relative rounded-[32px] overflow-hidden bg-slate-950/50 flex items-center justify-center border border-white/5 group">
                 {activePreview ? (
                   <div className="relative w-full h-full p-4 md:p-8 cursor-zoom-in" onClick={openLightbox}>
                      <img src={activePreview} className="w-full h-full object-contain drop-shadow-2xl" alt="Preview" />
                      <div className="absolute bottom-8 right-8 flex gap-3 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-4 group-hover:translate-y-0">
                         <a href={activePreview} download={`clone_result_${Date.now()}.png`} className="px-6 py-3 bg-white text-slate-900 rounded-full font-black text-[10px] uppercase tracking-widest shadow-xl hover:scale-105 transition-transform flex items-center gap-2">
                            <i className="fa-solid fa-download"></i> Descargar
                         </a>
                      </div>
                   </div>
                 ) : (
                   <div className="text-center space-y-4 opacity-30">
                      <i className="fa-regular fa-image text-6xl text-white"></i>
                      <p className="text-white text-xs font-bold uppercase tracking-widest">Esperando Input...</p>
                   </div>
                 )}
              </div>

              {step === 4 && baseComposition && finalImage && (
                 <div className="mt-6 flex gap-4 h-24">
                    <div className="w-20 rounded-xl overflow-hidden border border-white/20 cursor-pointer opacity-60 hover:opacity-100 transition-opacity" onClick={() => setFinalImage(null)}>
                       <img src={baseComposition} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 flex items-center">
                       <div className="h-0.5 w-full bg-white/10"></div>
                    </div>
                    <div className="w-20 rounded-xl overflow-hidden border-2 border-accent-500 cursor-pointer shadow-[0_0_15px_rgba(228,241,172,0.3)]">
                       <img src={finalImage} className="w-full h-full object-cover" />
                    </div>
                 </div>
              )}

            </div>
          </div>
        </div>

        {showHistory && (
          <section className="px-4 md:px-0 animate-in fade-in duration-300">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-black text-slate-900 uppercase italic tracking-tighter">Historial</h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tus sesiones guardadas</p>
              </div>
              <button onClick={() => setShowHistory(false)} className="w-8 h-8 bg-slate-100 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors">
                <i className="fa-solid fa-xmark text-xs"></i>
              </button>
            </div>
            <ResultLibraryGrid
              loading={false}
              stats={[
                { label: 'Sesiones', value: sessions.length, sub: 'guardadas' },
                { label: 'Finalizadas', value: sessions.filter(s => !!s.finalImage).length, sub: 'con imagen final', color: 'text-emerald-600' },
              ]}
              searchTexts={sessions.map(s => `clone ${s.id} ${s.cameraStyle ?? ''}`)}
              emptyTitle="Sin sesiones guardadas"
              emptyDescription="Completá una clonación para que aparezca aquí"
            >
              {sessions.map(s => (
                <ResultCard
                  key={s.id}
                  images={[s.targetImage, s.baseComposition, s.finalImage].filter(Boolean) as string[]}
                  title={s.finalImage ? 'Clonación final' : 'Composición base'}
                  subtitle={s.cameraStyle?.replace('iphone_', 'iPhone ') ?? ''}
                  date={s.createdAt}
                  badge={{ label: s.finalImage ? '✓ Final' : 'Base', color: s.finalImage ? 'green' : 'slate' }}
                  pills={[s.aspectRatio ?? '', s.cameraStyle?.replace('iphone_', 'iPhone ') ?? ''].filter(Boolean)}
                  refSlots={[
                    ...(s.face1   ? [{ label: 'Cara',   src: s.face1 }]   : []),
                    ...(s.body1   ? [{ label: 'Cuerpo', src: s.body1 }]   : []),
                    ...(s.outfit1 ? [{ label: 'Outfit', src: s.outfit1 }] : []),
                  ]}
                  accentColor="blue"
                  onClick={() => { const imgs = [s.targetImage, s.baseComposition, s.finalImage].filter(Boolean) as string[]; if (imgs.length) { setLightboxImages(imgs); setLightboxIndex(0); setLightboxOpen(true); }}}
                  actions={[
                    { label: '↺ Recrear', onClick: e => { e.stopPropagation(); loadSession(s); }, variant: 'primary' },
                    { label: '↓', onClick: e => { e.stopPropagation(); const link = document.createElement('a'); link.href = s.finalImage || s.baseComposition; link.download = `clone_${s.id}.png`; link.click(); }, variant: 'secondary', title: 'Descargar' },
                    { label: '', icon: <i className="fa-solid fa-trash text-xs" />, onClick: e => { e.stopPropagation(); deleteSession(s.id); }, variant: 'danger', loading: deletingId === s.id, title: 'Eliminar' },
                  ]}
                />
              ))}
            </ResultLibraryGrid>
          </section>
        )}

        {lightboxOpen && lightboxImages.length > 0 && (
          <ImageLightbox
            images={lightboxImages}
            initialIndex={lightboxIndex}
            onClose={() => setLightboxOpen(false)}
            onDownload={(url, idx) => {
              const link = document.createElement('a');
              link.href = url;
              link.download = `clone_image_${idx + 1}.png`;
              link.click();
            }}
            metadata={{ label: "Clonación de Escena" }}
          />
        )}

        <FloatingActionBar
          isVisible={!!((baseComposition || finalImage) && fabVisible && !loading)}
          primaryAction={{
            label: 'Descargar ZIP',
            icon: <i className="fa-solid fa-file-zipper text-sm"></i>,
            onClick: handleDownloadZip,
          }}
          onClearSelection={fullReset}
          selectedCount={0}
        />

      </div>
    </>
  );
}
