import React, { useState, useEffect, useCallback } from 'react';
import ModuleTutorial from '../../components/shared/ModuleTutorial';
import { TUTORIAL_CONFIGS } from '../../components/shared/tutorialConfigs';
import { useCreditGuard } from '../../../hooks/useCreditGuard';
import { useAuth } from '../../modules/auth/AuthContext';
import NoCreditsModal from '../../components/shared/NoCreditsModal';
import { CREDIT_COSTS } from '../../services/creditConfig';
import {
  ContentStudioProSet,
  Focus,
  ProductSize,
  FOCUS_LABELS,
  SIZE_LABELS,
  ShotKey,
  GalleryImage,
  ShotDirective,
  getShotCount,
  getShotKeys,
  getSlotLabel,
  getTooltip,
  isSlotRequired,
  shouldShowComplementCheckbox,
  getFocusDescription,
  ROLE_LABELS,
  COMPOSITION_LABELS,
  CATEGORY_LABELS,
  REF0Analysis,
  ShotStatus
} from './types';
import { contentStudioService } from './service';
import { contentStudioStorage } from './storage';
import { analyzeProductRelevance } from './ugcDirectorService';
import { generationHistoryService } from '../../services/generationHistoryService';
import JSZip from 'jszip';

type Step = 'setup' | 'generating_master' | 'checkpoint' | 'producing' | 'library' | 'batch_generating';
type FilterTab = 'TODAS' | 'AVATAR' | 'PRODUCT' | 'OUTFIT' | 'SCENE';

const MAX_REGEN_ATTEMPTS = 3;
const FIXED_STYLE = 'UGC_PREMIUM' as const;
const TAB_ORDER: FilterTab[] = ['TODAS', 'AVATAR', 'PRODUCT', 'OUTFIT', 'SCENE'];
const MAX_BATCH_SIZE = 5;
const MIN_BATCH_SIZE = 2;

interface BatchSession {
  id: string;
  index: number;
  status: 'pending' | 'generating_ref0' | 'generating_shots' | 'completed' | 'failed';
  error?: string;
  set?: ContentStudioProSet;
  currentShotIndex: number;
  totalShots: number;
  ref0Url?: string;
  ref0Analysis?: REF0Analysis;
  shotUrls: (string | null)[];
  shotStatuses: ShotStatus[];
  progress: number;
}

const ContentStudioProModule: React.FC = () => {
  const [step, setStep] = useState<Step>('setup');
  const [sets, setSets] = useState<ContentStudioProSet[]>([]);
  const [currentSet, setCurrentSet] = useState<ContentStudioProSet | null>(null);
  const [activeTab, setActiveTab] = useState<FilterTab>('TODAS');

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedSets, setSelectedSets] = useState<Set<string>>(new Set());

  // Modo múltiple - solo para administradores
  const { isAdmin } = useAuth();
  const [batchMode, setBatchMode] = useState(false);
  const [batchCount, setBatchCount] = useState(2);
  const [batchSessions, setBatchSessions] = useState<BatchSession[]>([]);
  const [cancelBatch, setCancelBatch] = useState(false);
  const [batchCurrentSessionIndex, setBatchCurrentSessionIndex] = useState(0);

  const [faceRefs, setFaceRefs] = useState<string[]>([]);
  const [productRef, setProductRef] = useState<string | null>(null);
  const [outfitRef, setOutfitRef] = useState<string | null>(null);
  const [sceneRef, setSceneRef] = useState<string | null>(null);
  const [sceneText, setSceneText] = useState('');

  const [focus, setFocus] = useState<Focus>('AVATAR');
  const [productSize, setProductSize] = useState<ProductSize>('MEDIUM');
  
  const [isProductComplement, setIsProductComplement] = useState(false);
  const [showProductWarning, setShowProductWarning] = useState(false);
  const [productWarningMsg, setProductWarningMsg] = useState('');

  const [loadingMsg, setLoadingMsg] = useState('');
  const [errorStatus, setErrorStatus] = useState<string | null>(null);
  const [sessionPlan, setSessionPlan] = useState<any>(null);
  const [ref0Analysis, setRef0Analysis] = useState<REF0Analysis | undefined>(undefined);
  
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const [shotCount, setShotCount] = useState(6);
  
  // Estado para generación con polling - UI dinámica
  const [generatingShots, setGeneratingShots] = useState<{ [key: string]: { status: string; imageUrl?: string; error?: string } }>({});

  const { checkAndDeduct, showNoCredits, requiredCredits, closeModal, refundCredits } = useCreditGuard();

  useEffect(() => {
    loadSets();
  }, []);

  const loadSets = async () => {
    const allSets = await contentStudioStorage.listSets();
    setSets(allSets);
  };

  useEffect(() => {
    const newCount = getShotCount(focus, productSize);
    setShotCount(newCount);
  }, [focus, productSize]);

  useEffect(() => {
    const checkProductRelevance = async () => {
      if ((focus === 'OUTFIT' || focus === 'SCENE') && productRef) {
        const result = await analyzeProductRelevance(productRef, focus, outfitRef, sceneRef, sceneText);
        if (!result.isRelevant && isProductComplement) {
          setShowProductWarning(true);
          setProductWarningMsg(`⚠️ ${result.suggestion} ¿Seguro que quieres incluirlo? Puede afectar el resultado.`);
        } else {
          setShowProductWarning(false);
        }
      }
    };
    checkProductRelevance();
  }, [productRef, outfitRef, sceneRef, sceneText, focus, isProductComplement]);

  const handleFileUpload = (setter: React.Dispatch<React.SetStateAction<any>>, multiple: boolean = false) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        const newFiles = Array.from(e.target.files) as File[];
        newFiles.forEach((file) => {
          const reader = new FileReader();
          reader.onload = () => {
            if (multiple) setter((prev: string[]) => [...prev, reader.result as string].slice(0, 1));
            else setter(reader.result as string);
          };
          reader.readAsDataURL(file);
        });
      }
    };

  const validateReferences = (): boolean => {
    if (faceRefs.length === 0) {
      alert('⚠️ La foto del rostro (ADN) es obligatoria.');
      return false;
    }
    if (focus === 'PRODUCT' && !productRef) {
      alert('⚠️ Enfoque PRODUCTO requiere referencia de producto.');
      return false;
    }
    if (focus === 'OUTFIT' && !outfitRef) {
      alert('⚠️ Enfoque OUTFIT requiere referencia de outfit.');
      return false;
    }
    if (focus === 'SCENE' && !sceneRef) {
      alert('⚠️ Enfoque ESCENA requiere referencia de escena.');
      return false;
    }
    return true;
  };

  const startMasterGeneration = async () => {
    if (!validateReferences()) return;
    
    const ok = await checkAndDeduct(CREDIT_COSTS.UGC_PER_SHOT);
    if (!ok) return;
    
    setStep('generating_master');
    setErrorStatus(null);

    try {
      setLoadingMsg('Analizando referencias y preparando sesión...');
      
      const useProduct = (focus === 'OUTFIT' || focus === 'SCENE') ? isProductComplement : true;
      
      const plan = await contentStudioService.buildSessionPlan(
        focus,
        { productRef, outfitRef, sceneRef, sceneText },
        focus === 'PRODUCT' ? productSize : undefined,
        useProduct
      );
      setSessionPlan(plan);

      setLoadingMsg('Sincronizando identidad y generando Master...');
      
      const { imageUrl: image0, analysis } = await contentStudioService.generateImage0(
        faceRefs[0],
        productRef,
        outfitRef,
        sceneRef,
        sceneText,
        FIXED_STYLE,
        focus,
        focus === 'PRODUCT' ? productSize : undefined,
        useProduct,
        (status, image) => {
          if (status === 'processing') setLoadingMsg('Generando imagen base (puede tomar hasta 2 minutos)...');
          if (status === 'completed') setLoadingMsg('Master generado exitosamente');
        }
      );
      setRef0Analysis(analysis);

      const shotKeys = getShotKeys(shotCount);
      const initialShots = shotKeys.map((key, idx) => ({
        key,
        name: `Shot ${idx + 1}`,
        promptUsed: '',
        negativeUsed: '',
        status: 'idle' as const,
        attempts: 0,
        errorMsg: null
      }));

      const newSet: ContentStudioProSet = {
        id: Date.now().toString(),
        createdAt: Date.now(),
        style: FIXED_STYLE as any,
        focus,
        productSize: focus === 'PRODUCT' ? productSize : undefined,
        productCategory: plan.productCategory,
        faceRefs,
        productRef: useProduct ? productRef : null,
        outfitRef,
        sceneRef,
        sceneText,
        image0Url: image0,
        ref0Analysis: analysis,
        attemptsImage0: 1,
        shots: initialShots
      };

      setCurrentSet(newSet);

      generationHistoryService.save({
        imageUrl: image0,
        module: 'content_studio_pro',
        moduleLabel: `UGC Pro (${FOCUS_LABELS[focus].split(' / ')[0]} - Master)`,
        creditsUsed: CREDIT_COSTS.UGC_PER_SHOT,
        promptText: `Master image for ${focus}`
      }).catch(console.error);

      setStep('checkpoint');
    } catch (e: any) {
      setErrorStatus(`Error: ${e.message}`);
      setStep('setup');
    }
  };

  const regenerateMaster = async () => {
    if (!currentSet) return;
    setStep('generating_master');
    setLoadingMsg(`Refinando Master (Intento ${currentSet.attemptsImage0 + 1}/3)...`);

    try {
      const useProduct = (currentSet.focus === 'OUTFIT' || currentSet.focus === 'SCENE') 
        ? (currentSet.productRef !== null) 
        : true;
        
      const { imageUrl: image0, analysis } = await contentStudioService.generateImage0(
        currentSet.faceRefs[0],
        currentSet.productRef || null,
        currentSet.outfitRef || null,
        currentSet.sceneRef || null,
        currentSet.sceneText || '',
        FIXED_STYLE,
        currentSet.focus,
        currentSet.productSize,
        useProduct,
        (status) => {
          if (status === 'processing') setLoadingMsg('Regenerando Master...');
        }
      );

      setCurrentSet({
        ...currentSet,
        image0Url: image0,
        ref0Analysis: analysis,
        attemptsImage0: currentSet.attemptsImage0 + 1,
        style: FIXED_STYLE as any
      });
      setRef0Analysis(analysis);
      setStep('checkpoint');
    } catch (e: any) {
      setErrorStatus(`Error: ${e.message}`);
      setStep('checkpoint');
    }
  };

  const approveAndProduce = async () => {
    if (!currentSet || !currentSet.image0Url || !currentSet.faceRefs[0]) return;

    const producingSet: ContentStudioProSet = {
      ...currentSet,
      style: FIXED_STYLE as any,
      focus,
      productSize: focus === 'PRODUCT' ? productSize : undefined
    };

    setStep('producing');
    setCurrentSet(producingSet);
    
    // Inicializar estados de generación para UI dinámica
    const initialGenState: { [key: string]: { status: string; imageUrl?: string; error?: string } } = {};
    producingSet.shots.forEach((shot, idx) => {
      initialGenState[shot.key] = { status: 'pending' };
    });
    setGeneratingShots(initialGenState);

    const useProduct = (focus === 'OUTFIT' || focus === 'SCENE') ? isProductComplement : true;
    const focusRef = useProduct ? producingSet.productRef : null;
    const updatedShots = [...producingSet.shots];
    
    // Actualizar UI para un shot específico
    const updateShotStatus = (shotKey: ShotKey, status: string, imageUrl?: string, errorMsg?: string) => {
      setGeneratingShots(prev => ({
        ...prev,
        [shotKey]: { status, imageUrl, error: errorMsg }
      }));
      
      // También actualizar el shot en el set
      const shotIndex = updatedShots.findIndex(s => s.key === shotKey);
      if (shotIndex !== -1) {
        if (status === 'completed' && imageUrl) {
          updatedShots[shotIndex].imageUrl = imageUrl;
          updatedShots[shotIndex].status = 'done';
        } else if (status === 'failed') {
          updatedShots[shotIndex].status = 'error';
          updatedShots[shotIndex].errorMsg = errorMsg;
        } else if (status === 'processing') {
          updatedShots[shotIndex].status = 'generating';
        }
        setCurrentSet({ ...producingSet, shots: [...updatedShots] });
      }
    };

    // Generar todos los shots en paralelo con polling
    const shotPromises = updatedShots.map(async (shot, idx) => {
      updateShotStatus(shot.key, 'processing');
      
      try {
        const url = await contentStudioService.generateDerivedShotAsync(
          producingSet.image0Url!,
          producingSet.faceRefs[0],
          producingSet.outfitRef,
          focusRef,
          producingSet.sceneRef,
          FIXED_STYLE,
          focus,
          shot.key,
          producingSet.productSize,
          sessionPlan,
          useProduct,
          producingSet.ref0Analysis,
          idx, // shot index
          updatedShots.length, // total shots
          (status, imageUrl) => {
            if (status === 'completed' && imageUrl) {
              updateShotStatus(shot.key, 'completed', imageUrl);
            } else if (status === 'failed') {
              updateShotStatus(shot.key, 'failed', undefined, 'Error en generación');
            } else if (status === 'processing') {
              updateShotStatus(shot.key, 'processing');
            }
          }
        );
        
        // Guardar en historial
        generationHistoryService.save({
          imageUrl: url,
          module: 'content_studio_pro',
          moduleLabel: `UGC Pro (${FOCUS_LABELS[focus].split(' / ')[0]} - ${shot.name})`,
          creditsUsed: 0,
          promptText: `Shot ${shot.key} for ${focus}`
        }).catch(console.error);
        
      } catch (e: any) {
        updateShotStatus(shot.key, 'failed', undefined, e?.message || 'Error desconocido');
      }
    });

    // Esperar a que todos los shots terminen
    await Promise.all(shotPromises);
    
    // Guardar sesión completa
    await contentStudioStorage.saveSet({ ...producingSet, shots: updatedShots });
    await loadSets();
    setStep('library');
    setGeneratingShots({});
  };

  const regenerateShot = async (targetSet: ContentStudioProSet, key: ShotKey) => {
    if (!targetSet.image0Url || !targetSet.faceRefs[0]) return;

    const shotIndex = targetSet.shots.findIndex((s) => s.key === key);
    const shot = targetSet.shots[shotIndex];
    if (shot.attempts >= MAX_REGEN_ATTEMPTS) return alert('Límite de reintentos alcanzado.');

    const updatedShots = [...targetSet.shots];
    updatedShots[shotIndex] = { ...shot, status: 'generating', imageUrl: null, errorMsg: null };

    const intermediateSet = { ...targetSet, shots: updatedShots, style: FIXED_STYLE as any };

    if (currentSet?.id === targetSet.id) setCurrentSet(intermediateSet);
    setSets((prev) => prev.map((s) => (s.id === targetSet.id ? intermediateSet : s)));

    const useProduct = (targetSet.focus === 'OUTFIT' || targetSet.focus === 'SCENE') 
      ? (targetSet.productRef !== null) 
      : true;
    const focusRef = useProduct ? targetSet.productRef : null;

    try {
      const url = await contentStudioService.generateDerivedShotAsync(
        targetSet.image0Url,
        targetSet.faceRefs[0],
        targetSet.outfitRef,
        focusRef,
        targetSet.sceneRef,
        FIXED_STYLE,
        targetSet.focus,
        key,
        targetSet.productSize,
        sessionPlan,
        useProduct,
        targetSet.ref0Analysis,
        shotIndex,
        updatedShots.length,
        (status, imageUrl) => {
          if (status === 'completed' && imageUrl) {
            updatedShots[shotIndex] = {
              ...shot,
              imageUrl: url,
              status: 'done',
              attempts: shot.attempts + 1,
              errorMsg: null
            };
          } else if (status === 'failed') {
            updatedShots[shotIndex] = {
              ...shot,
              status: 'error',
              errorMsg: 'Error al regenerar'
            };
          }
          const finalSet = { ...targetSet, shots: updatedShots };
          if (currentSet?.id === targetSet.id) setCurrentSet(finalSet);
          setSets((prev) => prev.map((s) => (s.id === targetSet.id ? finalSet : s)));
        }
      );
    } catch (e: any) {
      updatedShots[shotIndex] = {
        ...shot,
        status: 'error',
        errorMsg: e?.message || 'Error desconocido al regenerar'
      };
    }

    const finalSet = { ...targetSet, shots: updatedShots, style: FIXED_STYLE as any };
    if (currentSet?.id === targetSet.id) setCurrentSet(finalSet);
    setSets((prev) => prev.map((s) => (s.id === targetSet.id ? finalSet : s)));
    await contentStudioStorage.saveSet(finalSet);
  };

  const downloadSingleSet = async (set: ContentStudioProSet) => {
    const zip = new JSZip();
    const folderName = `${set.focus}_${set.id.slice(-8)}`;
    const folder = zip.folder(folderName);
    
    if (set.image0Url) {
      folder?.file('00_Master.png', set.image0Url.split(',')[1], { base64: true });
    }
    set.shots.forEach((s, i) => {
      if (s.imageUrl) {
        folder?.file(`Shot_${i + 1}.png`, s.imageUrl.split(',')[1], { base64: true });
      }
    });
    
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `UGC_${set.focus}_${set.id.slice(-8)}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadSelectedSets = async () => {
    if (selectedSets.size === 0) {
      alert('Selecciona al menos una sesión para descargar');
      return;
    }

    const zip = new JSZip();
    const setsToDownload = sets.filter(s => selectedSets.has(s.id));
    
    for (const set of setsToDownload) {
      const folderName = `${set.focus}_${set.id.slice(-8)}`;
      const folder = zip.folder(folderName);
      
      if (set.image0Url) {
        folder?.file('00_Master.png', set.image0Url.split(',')[1], { base64: true });
      }
      set.shots.forEach((s, i) => {
        if (s.imageUrl) {
          folder?.file(`Shot_${i + 1}.png`, s.imageUrl.split(',')[1], { base64: true });
        }
      });
    }
    
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `UGC_Selected_${selectedSets.size}_Sessions.zip`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleSelectSet = (setId: string) => {
    const newSelected = new Set(selectedSets);
    if (newSelected.has(setId)) {
      newSelected.delete(setId);
    } else {
      newSelected.add(setId);
    }
    setSelectedSets(newSelected);
  };

  const selectAllFiltered = () => {
    const newSelected = new Set(selectedSets);
    filteredSets.forEach(set => newSelected.add(set.id));
    setSelectedSets(newSelected);
  };

  const clearSelection = () => {
    setSelectedSets(new Set());
  };

  const openGallery = (set: ContentStudioProSet) => {
    const images: GalleryImage[] = [];
    
    if (set.image0Url) {
      images.push({ url: set.image0Url, type: 'master' });
    }
    
    set.shots.forEach((shot, idx) => {
      if (shot.imageUrl) {
        images.push({ 
          url: shot.imageUrl, 
          type: 'shot', 
          shotKey: shot.key, 
          shotIndex: idx 
        });
      }
    });
    
    setGalleryImages(images);
    setCurrentImageIndex(0);
    setGalleryOpen(true);
  };

  const navigateGallery = (direction: 'next' | 'prev') => {
    if (direction === 'next') {
      setCurrentImageIndex((prev) => (prev + 1) % galleryImages.length);
    } else {
      setCurrentImageIndex((prev) => (prev - 1 + galleryImages.length) % galleryImages.length);
    }
  };

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && galleryOpen) {
        setGalleryOpen(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [galleryOpen]);

  const downloadCurrentImage = () => {
    if (galleryImages[currentImageIndex]) {
      const a = document.createElement('a');
      a.href = galleryImages[currentImageIndex].url;
      a.download = `UGC_${galleryImages[currentImageIndex].type === 'master' ? 'Master' : `Shot_${currentImageIndex}`}.png`;
      a.click();
    }
  };

  const showComplementCheckbox = (focus === 'OUTFIT' || focus === 'SCENE') && productRef;
  const filteredSets = sets.filter(set => {
    if (activeTab === 'TODAS') return true;
    return set.focus === activeTab;
  });
  const showSelectionTools = filteredSets.length > 0;

  // Renderizar estado de un shot en producción
  const renderShotStatus = (shotKey: ShotKey, idx: number) => {
    const genState = generatingShots[shotKey];
    if (!genState) return null;
    
    const getStatusIcon = () => {
      switch (genState.status) {
        case 'pending': return <i className="fa-regular fa-clock text-slate-400 text-xl"></i>;
        case 'processing': return <i className="fa-solid fa-spinner animate-spin text-brand-500 text-xl"></i>;
        case 'completed': return <i className="fa-solid fa-circle-check text-green-500 text-xl"></i>;
        case 'failed': return <i className="fa-solid fa-circle-exclamation text-red-500 text-xl"></i>;
        default: return null;
      }
    };
    
    const getStatusText = () => {
      switch (genState.status) {
        case 'pending': return 'En cola';
        case 'processing': return 'Generando...';
        case 'completed': return 'Completado';
        case 'failed': return 'Error';
        default: return '';
      }
    };
    
    return (
      <div
        key={idx}
        className="aspect-[3/4] bg-slate-50 rounded-[24px] overflow-hidden relative group cursor-pointer flex flex-col shadow-lg"
        onClick={() => genState.imageUrl && openGallery(currentSet!)}
      >
        <div className="flex-1 relative overflow-hidden bg-slate-100">
          {genState.imageUrl ? (
            <img src={genState.imageUrl} className="w-full h-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center flex-col gap-3">
              {getStatusIcon()}
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                {getStatusText()}
              </span>
              {genState.status === 'failed' && genState.error && (
                <span className="text-[8px] text-red-400 px-2 text-center">{genState.error}</span>
              )}
            </div>
          )}
          <div className="absolute top-4 left-4">
            <span className="px-3 py-1 bg-black/40 backdrop-blur-md text-white text-[8px] font-black rounded-full uppercase border border-white/10 italic">
              Shot {idx + 1}
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <NoCreditsModal isOpen={showNoCredits} onClose={closeModal} required={requiredCredits} available={0} />
      <div className="max-w-7xl mx-auto space-y-6 md:space-y-10 pb-20 animate-in fade-in">
        <header className="flex flex-col md:flex-row items-center justify-between gap-6 px-4">
          <div className="text-center md:text-left">
            <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tighter uppercase italic leading-none">
              UGC <span className="text-brand-600">Studio</span>
            </h1>
            <div className="flex items-center justify-center md:justify-start gap-2 mt-2">
              <p className="text-slate-500 font-bold uppercase text-[8px] md:text-[9px] tracking-[0.4em] italic">
                Sesiones orgánicas • Motor Gemini
              </p>
              <ModuleTutorial moduleId="contentStudio" steps={TUTORIAL_CONFIGS.contentStudio} />
            </div>
          </div>

          <div className="flex bg-white p-1 rounded-2xl md:rounded-3xl border border-slate-100 shadow-sm">
            <button
              onClick={() => {
                setStep('setup');
                setSelectionMode(false);
                setSelectedSets(new Set());
                setBatchMode(false);
              }}
              className={`px-6 md:px-8 py-2 md:py-3 rounded-xl md:rounded-2xl text-[9px] md:text-[10px] font-black uppercase transition-all ${step !== 'library' ? 'bg-brand-600 text-white shadow-lg' : 'text-slate-400'}`}
            >
              Laboratorio
            </button>
            <button
              onClick={() => {
                setStep('library');
                setSelectionMode(false);
                setSelectedSets(new Set());
                setBatchMode(false);
              }}
              className={`px-6 md:px-8 py-2 md:py-3 rounded-xl md:rounded-2xl text-[9px] md:text-[10px] font-black uppercase transition-all ${step === 'library' ? 'bg-brand-600 text-white shadow-lg' : 'text-slate-400'}`}
            >
              Historial ({sets.length})
            </button>
          </div>
        </header>

        {/* SETUP */}
        {step === 'setup' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-10 px-4 md:px-0">
            <div className="lg:col-span-5">
              <section className="bg-white p-6 md:p-10 rounded-[32px] md:rounded-[48px] border border-slate-100 shadow-xl space-y-8 md:space-y-10">
                
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Enfoque de sesión</label>
                    <div className="group relative">
                      <i className="fa-solid fa-circle-info text-slate-300 text-[10px] cursor-help"></i>
                      <div className="absolute bottom-full left-0 mb-2 w-64 p-2 bg-slate-900 text-white text-[10px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                        Elige qué será protagonista de tu sesión.
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 md:gap-4">
                    {Object.entries(FOCUS_LABELS).map(([k, v]) => (
                      <button
                        key={k}
                        onClick={() => setFocus(k as Focus)}
                        className={`p-4 md:p-6 rounded-[20px] md:rounded-[28px] border-2 transition-all flex flex-col items-center gap-2 md:gap-3 ${focus === k ? 'border-brand-600 bg-brand-600 text-white shadow-xl' : 'border-slate-100 bg-white text-slate-400'}`}
                      >
                        <i className={`fa-solid ${
                          k === 'AVATAR' ? 'fa-user-circle' : k === 'PRODUCT' ? 'fa-gem' : k === 'OUTFIT' ? 'fa-shirt' : 'fa-image'
                        } text-xl md:text-2xl`}></i>
                        <span className="text-[8px] md:text-[9px] font-black uppercase tracking-widest leading-none text-center">
                          {FOCUS_LABELS[k as Focus].split(' / ')[0]}
                        </span>
                      </button>
                    ))}
                  </div>
                  <p className="text-[8px] text-slate-500 text-center mt-1">
                    {getFocusDescription(focus)}
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{getSlotLabel('face', focus)}</label>
                      <div className="group relative">
                        <i className="fa-solid fa-circle-info text-slate-300 text-[10px] cursor-help"></i>
                        <div className="absolute bottom-full left-0 mb-2 w-64 p-2 bg-slate-900 text-white text-[10px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                          {getTooltip('face', focus)}
                        </div>
                      </div>
                    </div>
                    <span className="text-[9px] font-black text-red-500 uppercase tracking-tighter">* Obligatorio</span>
                  </div>
                  <div className="aspect-[3/4] w-full max-w-sm mx-auto md:max-w-none">
                    {faceRefs.length > 0 ? (
                      <div className="w-full h-full rounded-[24px] md:rounded-[32px] overflow-hidden border-4 border-brand-600 relative group shadow-2xl">
                        <img src={faceRefs[0]} className="w-full h-full object-cover" />
                        <button
                          onClick={() => setFaceRefs([])}
                          className="absolute inset-0 bg-red-500/80 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                        >
                          <i className="fa-solid fa-trash text-2xl"></i>
                        </button>
                      </div>
                    ) : (
                      <label className="w-full h-full bg-slate-50 border-2 border-dashed border-slate-200 rounded-[24px] md:rounded-[32px] flex flex-col items-center justify-center cursor-pointer hover:bg-slate-100 transition-all">
                        <i className="fa-solid fa-camera text-slate-300 text-3xl md:text-4xl mb-4"></i>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Cargar Rostro</span>
                        <input type="file" hidden onChange={handleFileUpload(setFaceRefs, true)} />
                      </label>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">2. Referencias de Contexto</label>
                  <div className="grid grid-cols-3 gap-2 md:gap-4">
                    <div className="relative">
                      <div className="flex items-center justify-center mb-1 gap-1">
                        <span className="text-[7px] font-bold text-slate-400 uppercase">{getSlotLabel('product', focus)}</span>
                        <div className="group relative">
                          <i className="fa-solid fa-circle-info text-slate-300 text-[8px] cursor-help"></i>
                          <div className="absolute bottom-full left-0 mb-1 w-48 p-1.5 bg-slate-900 text-white text-[8px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                            {getTooltip('product', focus)}
                          </div>
                        </div>
                        {isSlotRequired('product', focus) && <span className="text-[8px] text-red-400 ml-1">*</span>}
                      </div>
                      <label className={`aspect-[3/4] rounded-2xl md:rounded-3xl border-2 flex flex-col items-center justify-center cursor-pointer overflow-hidden transition-all ${productRef ? 'border-brand-600 bg-white shadow-md' : 'border-dashed border-slate-100 bg-slate-50/50'}`}>
                        {productRef ? (
                          <img src={productRef} className="w-full h-full object-cover" />
                        ) : (
                          <>
                            <i className="fa-solid fa-gem text-slate-200 text-xl md:text-2xl mb-2"></i>
                            <span className="text-[7px] md:text-[8px] font-black text-slate-300 uppercase text-center px-1">
                              {getSlotLabel('product', focus)}
                            </span>
                          </>
                        )}
                        <input type="file" hidden onChange={handleFileUpload(setProductRef)} />
                      </label>
                      {showComplementCheckbox && (
                        <div className="mt-2 flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="productComplement"
                            checked={isProductComplement}
                            onChange={(e) => setIsProductComplement(e.target.checked)}
                            className="w-3 h-3 rounded border-slate-300"
                          />
                          <label htmlFor="productComplement" className="text-[8px] text-slate-500">
                            ¿Es complemento del {focus === 'OUTFIT' ? 'outfit' : 'contexto'}?
                          </label>
                        </div>
                      )}
                      {showProductWarning && (
                        <div className="mt-1 text-[8px] text-amber-600 bg-amber-50 p-1 rounded">
                          {productWarningMsg}
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="flex items-center justify-center mb-1 gap-1">
                        <span className="text-[7px] font-bold text-slate-400 uppercase">{getSlotLabel('scene', focus)}</span>
                        <div className="group relative">
                          <i className="fa-solid fa-circle-info text-slate-300 text-[8px] cursor-help"></i>
                          <div className="absolute bottom-full left-0 mb-1 w-48 p-1.5 bg-slate-900 text-white text-[8px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                            {getTooltip('scene', focus)}
                          </div>
                        </div>
                        {isSlotRequired('scene', focus) && <span className="text-[8px] text-red-400 ml-1">*</span>}
                      </div>
                      <label className={`aspect-[3/4] rounded-2xl md:rounded-3xl border-2 flex flex-col items-center justify-center cursor-pointer overflow-hidden transition-all ${sceneRef ? 'border-brand-600 bg-white shadow-md' : 'border-dashed border-slate-100 bg-slate-50/50'}`}>
                        {sceneRef ? (
                          <img src={sceneRef} className="w-full h-full object-cover" />
                        ) : (
                          <>
                            <i className="fa-solid fa-image text-slate-200 text-xl md:text-2xl mb-2"></i>
                            <span className="text-[7px] md:text-[8px] font-black text-slate-300 uppercase text-center px-1">
                              {getSlotLabel('scene', focus)}
                            </span>
                          </>
                        )}
                        <input type="file" hidden onChange={handleFileUpload(setSceneRef)} />
                      </label>
                    </div>

                    <div>
                      <div className="flex items-center justify-center mb-1 gap-1">
                        <span className="text-[7px] font-bold text-slate-400 uppercase">{getSlotLabel('outfit', focus)}</span>
                        <div className="group relative">
                          <i className="fa-solid fa-circle-info text-slate-300 text-[8px] cursor-help"></i>
                          <div className="absolute bottom-full left-0 mb-1 w-48 p-1.5 bg-slate-900 text-white text-[8px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                            {getTooltip('outfit', focus)}
                          </div>
                        </div>
                        {isSlotRequired('outfit', focus) && <span className="text-[8px] text-red-400 ml-1">*</span>}
                      </div>
                      <label className={`aspect-[3/4] rounded-2xl md:rounded-3xl border-2 flex flex-col items-center justify-center cursor-pointer overflow-hidden transition-all ${outfitRef ? 'border-brand-600 bg-white shadow-md' : 'border-dashed border-slate-100 bg-slate-50/50'}`}>
                        {outfitRef ? (
                          <img src={outfitRef} className="w-full h-full object-cover" />
                        ) : (
                          <>
                            <i className="fa-solid fa-shirt text-slate-200 text-xl md:text-2xl mb-2"></i>
                            <span className="text-[7px] md:text-[8px] font-black text-slate-300 uppercase text-center px-1">
                              {getSlotLabel('outfit', focus)}
                            </span>
                          </>
                        )}
                        <input type="file" hidden onChange={handleFileUpload(setOutfitRef)} />
                      </label>
                    </div>
                  </div>
                </div>

                {focus === 'SCENE' && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Descripción adicional (opcional)</label>
                    <textarea
                      value={sceneText}
                      onChange={(e) => setSceneText(e.target.value)}
                      placeholder="Describe el ambiente, el tipo de lugar, qué se puede hacer allí..."
                      className="w-full p-3 rounded-xl border border-slate-200 text-xs"
                      rows={2}
                    />
                  </div>
                )}

                {focus === 'PRODUCT' && (
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tamaño del producto</label>
                    <div className="flex bg-white p-1 rounded-[16px] md:rounded-[20px] border border-slate-200">
                      {Object.entries(SIZE_LABELS).map(([k, v]) => (
                        <button
                          key={k}
                          onClick={() => setProductSize(k as ProductSize)}
                          className={`flex-1 py-3 md:py-4 px-1 md:px-2 rounded-[12px] md:rounded-[16px] text-[7px] md:text-[8px] font-black uppercase tracking-tighter transition-all ${productSize === k ? 'bg-brand-600 text-white shadow-md' : 'text-slate-400'}`}
                        >
                          {v.split(' ')[0]}
                        </button>
                      ))}
                    </div>
                    <p className="text-[8px] text-slate-400 text-center">
                      {productSize === 'SMALL' && '🔍 Producto pequeño → macro close-ups, selfie con producto cerca del rostro'}
                      {productSize === 'MEDIUM' && '📦 Producto mediano → producto en mano, selfie a altura pecho, contexto'}
                      {productSize === 'LARGE' && '🪑 Producto grande → persona junto al producto, tomas amplias'}
                    </p>
                  </div>
                )}

                <button
                  onClick={startMasterGeneration}
                  className="w-full py-5 md:py-7 bg-brand-600 text-white rounded-[24px] md:rounded-[32px] font-black text-[10px] md:text-xs uppercase tracking-[0.2em] shadow-[0_20px_40px_rgba(247,44,91,0.3)] hover:bg-brand-700 active:scale-95 transition-all"
                >
                  Sintetizar Master Anchor (UGC)
                </button>

                {errorStatus && (
                  <div className="p-4 rounded-2xl bg-red-50 border border-red-100 text-red-600 text-xs font-bold">
                    {errorStatus}
                  </div>
                )}
              </section>
            </div>

            <div className="hidden lg:col-span-7 lg:flex flex-col items-center justify-center text-center p-12 bg-slate-900 rounded-[64px] border-8 border-slate-800 shadow-2xl space-y-12">
              <div className="relative">
                <i className="fa-solid fa-dna text-white/5 text-9xl"></i>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-24 h-24 border-t-2 border-brand-500/20 rounded-full animate-spin"></div>
                </div>
              </div>
              <div className="space-y-4">
                <h3 className="text-white text-4xl font-black uppercase italic tracking-tighter">UGC Identity Lock</h3>
                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.4em] max-w-sm mx-auto leading-relaxed">
                  Persistencia facial + coherencia visual estilo smartphone.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* LOADING NORMAL */}
        {(step === 'generating_master') && (
          <div className="min-h-[500px] md:min-h-[600px] flex flex-col items-center justify-center space-y-8 md:space-y-12 bg-slate-900 rounded-[40px] md:rounded-[64px] border-8 border-slate-800 shadow-2xl p-6 md:p-10 text-center animate-in zoom-in mx-4">
            <div className="w-16 h-16 md:w-20 md:h-20 border-4 border-white/5 border-t-brand-500 rounded-full animate-spin shadow-[0_0_30px_rgba(247,44,91,0.3)]"></div>
            <div className="space-y-4">
              <h2 className="text-white text-xl md:text-3xl font-black uppercase italic tracking-tighter leading-none">{loadingMsg}</h2>
              <p className="text-slate-500 text-[8px] md:text-[9px] font-black uppercase tracking-[0.5em] animate-pulse">
                UGC SYSTEM • Gemini ACTIVE
              </p>
            </div>
          </div>
        )}

        {/* PRODUCING - UI CON MINI-GALERÍA Y ESTADOS DINÁMICOS */}
        {step === 'producing' && currentSet && (
          <div className="min-h-[600px] bg-white rounded-[40px] border border-slate-100 shadow-2xl p-6 md:p-10 mx-4 animate-in zoom-in">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl md:text-2xl font-black text-slate-900 uppercase italic tracking-tighter">
                  Generando sesión {focus}...
                </h2>
                <p className="text-slate-400 text-[10px] mt-1">
                  {Object.values(generatingShots).filter(s => s.status === 'completed').length} de {shotCount} shots completados
                </p>
              </div>
              <div className="w-32 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-brand-500 transition-all duration-300"
                  style={{ width: `${(Object.values(generatingShots).filter(s => s.status === 'completed').length / shotCount) * 100}%` }}
                />
              </div>
            </div>

            {/* Master image arriba */}
            <div className="mb-8">
              <div className="aspect-[3/4] max-w-xs mx-auto rounded-[24px] overflow-hidden border-4 border-brand-600 shadow-xl relative">
                <img src={currentSet.image0Url!} className="w-full h-full object-cover" />
                <div className="absolute top-4 left-4">
                  <span className="px-3 py-1 bg-brand-600 text-white text-[8px] font-black rounded-full uppercase">Master</span>
                </div>
              </div>
            </div>

            {/* Grid de shots con estados dinámicos */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {currentSet.shots.map((shot, idx) => renderShotStatus(shot.key, idx))}
            </div>

            <p className="text-center text-[10px] text-slate-400 mt-6 animate-pulse">
              Generando imágenes... El proceso puede tomar hasta 2 minutos por imagen
            </p>
          </div>
        )}

        {/* CHECKPOINT */}
        {step === 'checkpoint' && currentSet && (
          <div className="max-w-7xl mx-auto space-y-6 md:space-y-10 animate-in zoom-in px-4 md:px-0">
            <div className="bg-white p-6 md:p-12 rounded-[32px] md:rounded-[48px] border border-slate-100 shadow-2xl grid grid-cols-1 lg:grid-cols-12 gap-8 md:gap-12">
              <div className="lg:col-span-7 flex flex-col items-center space-y-6">
                <div
                  className="w-full aspect-[3/4] bg-slate-50 rounded-[24px] md:rounded-[40px] overflow-hidden shadow-2xl border-4 md:border-8 border-white relative group cursor-pointer"
                  onClick={() => {
                    setGalleryImages([{ url: currentSet.image0Url!, type: 'master' }]);
                    setCurrentImageIndex(0);
                    setGalleryOpen(true);
                  }}
                >
                  <img src={currentSet.image0Url!} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <i className="fa-solid fa-expand text-white text-3xl md:text-4xl"></i>
                  </div>
                  <div className="absolute top-4 left-4 md:top-6 md:left-6">
                    <span className="px-3 md:px-5 py-1.5 md:py-2 bg-brand-600 text-white text-[8px] md:text-[9px] font-black rounded-full uppercase tracking-widest shadow-xl">
                      Master Anchor (UGC)
                    </span>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-5 flex flex-col space-y-6 md:space-y-10 justify-center">
                <div className="p-6 md:p-10 bg-slate-900 rounded-[24px] md:rounded-[40px] text-white space-y-6 md:space-y-8">
                  <h3 className="text-lg md:text-xl font-black uppercase italic tracking-tighter leading-none border-b border-white/10 pb-4 md:pb-6">
                    Check de identidad (UGC)
                  </h3>
                  <div className="space-y-3 md:space-y-4">
                    <div className="flex items-start gap-3 md:gap-4">
                      <i className="fa-solid fa-circle-check text-brand-400 mt-0.5"></i>
                      <p className="text-[10px] md:text-[11px] font-bold">Rostro consistente vs tu ADN.</p>
                    </div>
                    <div className="flex items-start gap-3 md:gap-4">
                      <i className="fa-solid fa-circle-check text-brand-400 mt-0.5"></i>
                      <p className="text-[10px] md:text-[11px] font-bold">Se ve natural (no "de estudio").</p>
                    </div>
                    {currentSet.productCategory && (
                      <div className="flex items-start gap-3 md:gap-4">
                        <i className="fa-solid fa-tag text-brand-400 mt-0.5"></i>
                        <p className="text-[10px] md:text-[11px] font-bold">Categoría detectada: {currentSet.productCategory}</p>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={regenerateMaster}
                    className="text-brand-400 font-black text-[9px] md:text-[10px] uppercase tracking-widest hover:text-white transition-all italic flex items-center gap-2"
                  >
                    <i className="fa-solid fa-rotate"></i> Regenerar Master ({currentSet.attemptsImage0}/3)
                  </button>
                </div>

                <div className="bg-slate-50 p-6 md:p-10 rounded-[24px] md:rounded-[40px] border border-slate-100 space-y-6 md:space-y-8">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Enfoque de sesión</label>
                      <div className="group relative">
                        <i className="fa-solid fa-circle-info text-slate-300 text-[10px] cursor-help"></i>
                        <div className="absolute bottom-full left-0 mb-2 w-64 p-2 bg-slate-900 text-white text-[10px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                          El enfoque se seleccionó al inicio y no se puede cambiar
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-4 md:p-6 rounded-[20px] md:rounded-[28px] bg-white border border-slate-200 flex items-center gap-3 md:gap-4 shadow-sm">
                      <i className={`fa-solid ${
                        focus === 'AVATAR' ? 'fa-user-circle' : focus === 'PRODUCT' ? 'fa-gem' : focus === 'OUTFIT' ? 'fa-shirt' : 'fa-image'
                      } text-xl md:text-2xl text-brand-600`}></i>
                      <div>
                        <p className="text-[11px] md:text-[13px] font-black text-slate-900 uppercase tracking-wider">
                          {FOCUS_LABELS[focus].split(' / ')[0]}
                        </p>
                        <p className="text-[8px] text-slate-500">
                          {focus === 'PRODUCT' && '🎯 El producto es el héroe de esta sesión'}
                          {focus === 'OUTFIT' && '👔 El outfit es el héroe de esta sesión'}
                          {focus === 'SCENE' && '🏞️ La escena es el héroe de esta sesión'}
                          {focus === 'AVATAR' && '😊 La persona es el héroe de esta sesión'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {focus === 'PRODUCT' && currentSet.productSize && (
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tamaño del producto</label>
                      <div className="text-[11px] font-bold text-slate-700 bg-white p-3 rounded-xl border border-slate-200">
                        {currentSet.productSize === 'SMALL' && '🔍 Pequeño (Joyas, Relojes) → macro close-ups'}
                        {currentSet.productSize === 'MEDIUM' && '📦 Mediano (Bolsos, Zapatos) → producto en mano'}
                        {currentSet.productSize === 'LARGE' && '🪑 Grande (Bicis, Muebles) → persona junto al producto'}
                      </div>
                    </div>
                  )}

                  {(focus === 'OUTFIT' || focus === 'SCENE') && currentSet.productRef && (
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        {focus === 'OUTFIT' ? 'Objeto complementario' : 'Prop / Objeto adicional'}
                      </label>
                      <div className="text-[11px] font-bold text-slate-700 bg-white p-3 rounded-xl border border-slate-200 flex items-center gap-2">
                        <i className="fa-solid fa-check-circle text-green-500 text-xs"></i>
                        <span>Incluido como complemento</span>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={approveAndProduce}
                    className="w-full py-5 md:py-7 bg-brand-600 text-white rounded-[24px] md:rounded-[32px] font-black text-[10px] md:text-xs uppercase tracking-[0.2em] shadow-2xl hover:bg-brand-700 transition-all active:scale-95"
                  >
                    Comenzar producción ({shotCount} Shots)
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* LIBRARY - se mantiene igual */}
        {step === 'library' && (
          <div className="space-y-6 md:space-y-8 animate-in fade-in duration-700 px-4 md:px-0">
            
            {/* Pestañas de filtrado */}
            <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
              {TAB_ORDER.map((tab) => {
                const count = tab === 'TODAS' 
                  ? sets.length 
                  : sets.filter(s => s.focus === tab).length;
                return (
                  <button
                    key={tab}
                    onClick={() => {
                      setActiveTab(tab);
                      setSelectionMode(false);
                      setSelectedSets(new Set());
                    }}
                    className={`px-4 md:px-6 py-2 rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-wider transition-all ${
                      activeTab === tab
                        ? 'bg-brand-600 text-white shadow-md'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    {tab === 'TODAS' ? 'Todas' : FOCUS_LABELS[tab as Focus].split(' / ')[0]}
                    <span className="ml-1 text-[8px] opacity-70">({count})</span>
                  </button>
                );
              })}
            </div>

            {/* Barra de herramientas de selección múltiple */}
            {showSelectionTools && (
              <div className="flex flex-wrap justify-between items-center gap-3 bg-slate-50 p-3 rounded-xl">
                <div className="flex gap-2">
                  {!selectionMode ? (
                    <button
                      onClick={() => setSelectionMode(true)}
                      className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-[9px] font-black uppercase tracking-wider hover:bg-slate-100 transition-all"
                    >
                      <i className="fa-solid fa-check-square mr-1"></i> Seleccionar múltiple
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={selectAllFiltered}
                        className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-[9px] font-black uppercase tracking-wider hover:bg-slate-100 transition-all"
                      >
                        <i className="fa-solid fa-square-check mr-1"></i> Seleccionar todo
                      </button>
                      <button
                        onClick={clearSelection}
                        className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-[9px] font-black uppercase tracking-wider hover:bg-slate-100 transition-all"
                      >
                        <i className="fa-solid fa-square mr-1"></i> Limpiar
                      </button>
                      <button
                        onClick={() => setSelectionMode(false)}
                        className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-[9px] font-black uppercase tracking-wider hover:bg-slate-100 transition-all"
                      >
                        <i className="fa-solid fa-times mr-1"></i> Salir
                      </button>
                    </>
                  )}
                </div>
                
                {selectedSets.size > 0 && (
                  <button
                    onClick={downloadSelectedSets}
                    className="px-4 py-2 bg-brand-600 text-white rounded-lg text-[9px] font-black uppercase tracking-wider hover:bg-brand-700 transition-all flex items-center gap-2"
                  >
                    <i className="fa-solid fa-download"></i> Descargar seleccionadas ({selectedSets.size})
                  </button>
                )}
              </div>
            )}

            {/* Grid de sesiones */}
            {filteredSets.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 rounded-2xl">
                <i className="fa-solid fa-folder-open text-slate-300 text-4xl mb-3"></i>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">
                  No hay sesiones en esta categoría
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-8 md:gap-12">
                {filteredSets.map((set) => (
                  <section
                    key={set.id}
                    className={`bg-white p-6 md:p-10 rounded-[32px] md:rounded-[56px] border shadow-sm space-y-6 md:space-y-10 group transition-all hover:shadow-2xl ${
                      selectedSets.has(set.id) ? 'border-brand-600 ring-2 ring-brand-600/30' : 'border-slate-100'
                    }`}
                  >
                    <div className="flex flex-col md:flex-row justify-between items-center gap-6 md:gap-8 border-b border-slate-50 pb-6 md:pb-8">
                      <div className="flex items-center gap-4 md:gap-6">
                        {selectionMode && (
                          <input
                            type="checkbox"
                            checked={selectedSets.has(set.id)}
                            onChange={() => toggleSelectSet(set.id)}
                            className="w-5 h-5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                          />
                        )}
                        <div
                          className="w-12 h-12 md:w-16 md:h-16 rounded-[16px] md:rounded-[24px] overflow-hidden bg-slate-50 shadow-inner cursor-pointer"
                          onClick={() => openGallery(set)}
                        >
                          <img src={set.image0Url!} className="w-full h-full object-cover" />
                        </div>
                        <div>
                          <h3 className="text-xl md:text-2xl font-black text-slate-900 uppercase italic leading-none">
                            {set.focus === 'PRODUCT' && '📦 '}
                            {set.focus === 'OUTFIT' && '👔 '}
                            {set.focus === 'SCENE' && '🏞️ '}
                            {set.focus === 'AVATAR' && '😊 '}
                            Sesión #{set.id.slice(-4)}
                          </h3>
                          <div className="flex flex-wrap gap-2 mt-2 md:mt-3">
                            <span className="px-3 md:px-4 py-1 md:py-1.5 bg-slate-900 text-white text-[7px] md:text-[9px] font-black uppercase rounded-full tracking-widest">
                              UGC
                            </span>
                            <span className="px-3 md:px-4 py-1 md:py-1.5 bg-brand-600 text-white text-[7px] md:text-[9px] font-black uppercase rounded-full tracking-widest">
                              {FOCUS_LABELS[set.focus].split(' / ')[0]}
                            </span>
                            {set.productCategory && (
                              <span className="px-3 md:px-4 py-1 md:py-1.5 bg-slate-200 text-slate-700 text-[7px] md:text-[9px] font-black uppercase rounded-full">
                                {set.productCategory}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2 w-full md:w-auto">
                        <button
                          onClick={() => downloadSingleSet(set)}
                          className="flex-1 md:flex-none px-6 md:px-10 py-3 md:py-5 bg-white border border-slate-200 rounded-xl md:rounded-2xl text-[9px] md:text-[10px] font-black uppercase flex items-center justify-center gap-2 md:gap-3 shadow-sm hover:bg-slate-50 active:scale-95 transition-all"
                        >
                          <i className="fa-solid fa-file-zipper"></i> Pack
                        </button>
                        <button
                          onClick={() => contentStudioStorage.deleteSet(set.id).then(() => { loadSets(); setSelectedSets(new Set()); })}
                          className="w-12 h-12 md:w-16 md:h-16 bg-red-50 text-red-500 rounded-xl md:rounded-2xl flex items-center justify-center hover:bg-red-500 hover:text-white transition-all"
                        >
                          <i className="fa-solid fa-trash-can"></i>
                        </button>
                        <button
                          onClick={() => openGallery(set)}
                          className="w-12 h-12 md:w-16 md:h-16 bg-slate-100 text-slate-600 rounded-xl md:rounded-2xl flex items-center justify-center hover:bg-brand-600 hover:text-white transition-all"
                        >
                          <i className="fa-solid fa-images"></i>
                        </button>
                      </div>
                    </div>

                    <div className={`grid grid-cols-2 lg:grid-cols-${Math.min(set.shots.length + 1, 5)} gap-4 md:gap-6`}>
                      <div
                        className="aspect-[3/4] rounded-[24px] md:rounded-[40px] overflow-hidden border-2 md:border-4 border-brand-600 relative group cursor-pointer shadow-xl"
                        onClick={() => openGallery(set)}
                      >
                        <img src={set.image0Url!} className="w-full h-full object-cover" />
                        <div className="absolute top-4 left-4 md:top-6 md:left-6">
                          <span className="px-3 md:px-4 py-1 md:py-1.5 bg-brand-600 text-white text-[7px] md:text-[8px] font-black rounded-full uppercase italic shadow-lg">
                            Master
                          </span>
                        </div>
                        <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <i className="fa-solid fa-expand text-white text-2xl md:text-3xl"></i>
                        </div>
                      </div>

                      {set.shots.map((s, idx) => (
                        <div
                          key={idx}
                          className="aspect-[3/4] bg-slate-50 rounded-[24px] md:rounded-[40px] overflow-hidden relative group cursor-pointer flex flex-col shadow-lg"
                          onClick={() => s.imageUrl && openGallery(set)}
                        >
                          <div className="flex-1 relative overflow-hidden">
                            {s.status === 'generating' ? (
                              <div className="flex h-full items-center justify-center text-slate-200 bg-slate-900/10 backdrop-blur-sm">
                                <div className="flex flex-col items-center gap-2 md:gap-3">
                                  <i className="fa-solid fa-spinner animate-spin text-xl md:text-2xl text-brand-500"></i>
                                  <span className="text-[7px] md:text-[8px] font-black uppercase text-brand-400 tracking-widest">
                                    Render...
                                  </span>
                                </div>
                              </div>
                            ) : s.imageUrl ? (
                              <img
                                src={s.imageUrl}
                                className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
                              />
                            ) : (
                              <div className="flex h-full items-center justify-center bg-slate-50 p-3 text-center">
                                <div className="flex flex-col items-center gap-2">
                                  <i className="fa-solid fa-circle-exclamation text-red-400 text-lg"></i>
                                  <span className="text-[10px] font-black uppercase text-red-500">Falló</span>
                                  {s.status === 'error' && s.errorMsg && (
                                    <span className="text-[10px] text-slate-500 leading-snug" title={s.errorMsg}>
                                      {s.errorMsg.length > 60 ? s.errorMsg.slice(0, 60) + '…' : s.errorMsg}
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}

                            <div className="absolute top-4 left-4 md:top-6 md:left-6">
                              <span className="px-3 md:px-4 py-1 md:py-1.5 bg-black/40 backdrop-blur-md text-white text-[7px] md:text-[8px] font-black rounded-full uppercase border border-white/10 italic">
                                Shot {idx + 1}
                              </span>
                            </div>

                            {s.imageUrl && s.status !== 'generating' && (
                              <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                <i className="fa-solid fa-expand text-white text-2xl md:text-3xl"></i>
                              </div>
                            )}
                          </div>

                          {s.imageUrl && s.status !== 'generating' && s.attempts < MAX_REGEN_ATTEMPTS && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                regenerateShot(set, s.key);
                              }}
                              className="absolute bottom-4 md:bottom-6 inset-x-4 md:inset-x-6 py-2 md:py-3 bg-white/90 backdrop-blur-md text-slate-900 text-[8px] md:text-[9px] font-black uppercase rounded-xl md:rounded-2xl border border-slate-200 shadow-xl opacity-0 group-hover:opacity-100 transition-all hover:bg-white active:scale-95"
                            >
                              Regenerar ({s.attempts}/{MAX_REGEN_ATTEMPTS})
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>
        )}

        {/* GALERÍA MODAL */}
        {galleryOpen && galleryImages.length > 0 && (
          <div
            className="fixed inset-0 z-[10000] bg-black/95 backdrop-blur-3xl flex flex-col items-center justify-center p-4 md:p-10 animate-in fade-in"
            onClick={() => setGalleryOpen(false)}
          >
            <div
              className="relative max-w-6xl w-full h-full flex flex-col items-center justify-center gap-4 md:gap-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="absolute top-0 right-0 flex gap-2 z-10">
                <button
                  onClick={downloadCurrentImage}
                  className="w-10 h-10 md:w-12 md:h-12 bg-white/20 backdrop-blur-md text-white rounded-full flex items-center justify-center hover:bg-white/40 transition-all border border-white/20"
                >
                  <i className="fa-solid fa-download text-lg md:text-xl"></i>
                </button>
                <button
                  onClick={() => setGalleryOpen(false)}
                  className="w-10 h-10 md:w-12 md:h-12 bg-white/20 backdrop-blur-md text-white rounded-full flex items-center justify-center hover:bg-white/40 transition-all border border-white/20"
                >
                  <i className="fa-solid fa-xmark text-xl md:text-2xl"></i>
                </button>
              </div>

              <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/50 backdrop-blur-md px-4 py-2 rounded-full text-white text-xs font-mono">
                {currentImageIndex + 1} / {galleryImages.length}
                <span className="ml-2 text-white/60">
                  {galleryImages[currentImageIndex].type === 'master' ? 'Master' : `Shot ${galleryImages[currentImageIndex].shotIndex! + 1}`}
                </span>
              </div>

              <div className="relative max-w-5xl w-full h-full flex items-center justify-center">
                <img
                  src={galleryImages[currentImageIndex].url}
                  className="max-w-full max-h-[85vh] object-contain rounded-[24px] md:rounded-[48px] shadow-2xl border-4 md:border-8 border-white/10"
                  alt="Gallery"
                />
              </div>

              {galleryImages.length > 1 && (
                <>
                  <button
                    onClick={() => navigateGallery('prev')}
                    className="absolute left-4 md:left-8 top-1/2 -translate-y-1/2 w-12 h-12 md:w-16 md:h-16 bg-white/20 backdrop-blur-md text-white rounded-full flex items-center justify-center hover:bg-white/40 transition-all border border-white/20"
                  >
                    <i className="fa-solid fa-chevron-left text-xl md:text-2xl"></i>
                  </button>
                  <button
                    onClick={() => navigateGallery('next')}
                    className="absolute right-4 md:right-8 top-1/2 -translate-y-1/2 w-12 h-12 md:w-16 md:h-16 bg-white/20 backdrop-blur-md text-white rounded-full flex items-center justify-center hover:bg-white/40 transition-all border border-white/20"
                  >
                    <i className="fa-solid fa-chevron-right text-xl md:text-2xl"></i>
                  </button>

                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 bg-black/50 backdrop-blur-md px-4 py-2 rounded-full">
                    {galleryImages.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setCurrentImageIndex(idx)}
                        className={`w-2 h-2 rounded-full transition-all ${idx === currentImageIndex ? 'bg-white w-4' : 'bg-white/40'}`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default ContentStudioProModule;