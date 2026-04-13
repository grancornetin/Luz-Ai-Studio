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
  CATEGORY_LABELS
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
  shotUrls: (string | null)[];
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
  
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const [shotCount, setShotCount] = useState(4);

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

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const generateSingleBatchSession = async (
    session: BatchSession,
    useProduct: boolean,
    plan: any,
    approvedRef0: string,
    onProgress: (sessionId: string, shotIndex: number, shotUrl: string) => void
  ): Promise<ContentStudioProSet | null> => {
    try {
      const shotKeys = getShotKeys(shotCount);
      const shots = shotKeys.map((key, idx) => ({
        key,
        name: `Shot ${idx + 1}`,
        promptUsed: '',
        negativeUsed: '',
        status: 'idle' as const,
        attempts: 0,
        errorMsg: null
      }));

      const newSet: ContentStudioProSet = {
        id: session.id,
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
        image0Url: approvedRef0,
        attemptsImage0: 1,
        shots
      };

      for (let i = 0; i < shots.length; i++) {
        if (cancelBatch) return null;
        
        const shot = shots[i] as any;
        const focusRef = useProduct ? productRef : null;
        
        const url = await contentStudioService.generateDerivedShot(
          approvedRef0,
          faceRefs[0],
          focusRef || null,
          FIXED_STYLE,
          focus,
          shot.key,
          productSize,
          plan,
          useProduct
        );

        shot.imageUrl = url;
        shot.status = 'done';
        shot.attempts = 1;

        // Guardar en historial (background)
        generationHistoryService.save({
          imageUrl: url,
          module: 'content_studio_pro',
          moduleLabel: `UGC Pro (${FOCUS_LABELS[focus].split(' / ')[0]} - ${shot.name})`,
          creditsUsed: 0,
          promptText: `Shot ${shot.key} for ${focus}`
        }).catch(console.error);

        onProgress(session.id, i, url);
        await delay(1000);
      }

      await contentStudioStorage.saveSet(newSet);
      await loadSets();
      return newSet;
    } catch (error: any) {
      console.error(`[Batch] Session ${session.index} failed:`, error);
      refundCredits(CREDIT_COSTS.UGC_PER_SHOT);
      return null;
    }
  };
  const startBatchGeneration = async () => {
    if (!validateReferences()) return;
    
    // Deducir créditos para todas las sesiones al inicio
    let deductedCount = 0;
    for (let i = 0; i < batchCount; i++) {
      const ok = await checkAndDeduct(CREDIT_COSTS.UGC_PER_SHOT);
      if (!ok) {
        alert(`No hay suficientes créditos para ${batchCount} sesiones. Se generarán ${deductedCount} sesiones.`);
        break;
      }
      deductedCount++;
    }
    
    if (deductedCount === 0) return;
    
    setCancelBatch(false);
    setErrorStatus(null);
    setLoadingMsg('Preparando sesión base...');
    setStep('batch_generating');

    try {
      const useProduct = (focus === 'OUTFIT' || focus === 'SCENE') ? isProductComplement : true;
      
      const plan = await contentStudioService.buildSessionPlan(
        focus,
        { productRef, outfitRef, sceneRef, sceneText } as any,
        focus === 'PRODUCT' ? productSize : undefined,
        useProduct
      );
      setSessionPlan(plan);

      setLoadingMsg('Generando imagen base (REF0)...');
      const approvedRef0 = await contentStudioService.generateImage0(
        faceRefs[0],
        productRef,
        outfitRef,
        sceneRef,
        sceneText,
        FIXED_STYLE,
        focus,
        focus === 'PRODUCT' ? productSize : undefined,
        useProduct
      );

      // Inicializar sesiones del lote
      const initialSessions: BatchSession[] = [];
      for (let i = 0; i < deductedCount; i++) {
        initialSessions.push({
          id: `${Date.now()}_${i}`,
          index: i + 1,
          status: 'pending',
          currentShotIndex: 0,
          totalShots: shotCount,
          shotUrls: new Array(shotCount).fill(null),
          progress: 0,
          ref0Url: approvedRef0
        });
      }
      setBatchSessions(initialSessions);

      // Función para procesar UNA sesión individual
      const processSingleSession = async (session: BatchSession, sessionIndex: number) => {
        // Actualizar estado a "generando"
        setBatchSessions(prev => prev.map((s, idx) => 
          idx === sessionIndex ? { ...s, status: 'generating_shots', progress: 10 } : s
        ));
        
        const updateProgress = (sessionId: string, shotIndex: number, shotUrl: string) => {
          setBatchSessions(prev => prev.map(s => {
            if (s.id !== sessionId) return s;
            const newShotUrls = [...s.shotUrls];
            newShotUrls[shotIndex] = shotUrl;
            const progress = ((shotIndex + 1) / s.totalShots) * 100;
            return {
              ...s,
              currentShotIndex: shotIndex + 1,
              shotUrls: newShotUrls,
              progress
            };
          }));
        };
        
        const completedSet = await generateSingleBatchSession(session, useProduct, plan, approvedRef0, updateProgress);
        
        if (completedSet && !cancelBatch) {
          setBatchSessions(prev => prev.map(s => 
            s.id === session.id ? { ...s, status: 'completed', progress: 100, set: completedSet } : s
          ));
        } else if (!cancelBatch) {
          setBatchSessions(prev => prev.map(s => 
            s.id === session.id ? { ...s, status: 'failed', error: 'Error en la generación' } : s
          ));
        }
      };

      // 🔥 LO NUEVO: Procesar en GRUPOS DE 2 en paralelo
      for (let i = 0; i < initialSessions.length; i += 2) {
        // Tomar el grupo de 2 (o menos si es el último)
        const group = initialSessions.slice(i, i + 2);
        
        // Actualizar la UI para mostrar qué sesión(es) se están generando
        setBatchCurrentSessionIndex(i);
        
        // Crear un array de promesas para las sesiones del grupo
        const promises = group.map((session, groupIdx) => 
          processSingleSession(session, i + groupIdx)
        );
        
        // Ejecutar TODAS las del grupo en PARALELO
        await Promise.all(promises);
        
        // Pequeña pausa entre grupos para no saturar la API
        if (i + 2 < initialSessions.length) {
          await delay(2000);
        }
      }

      if (!cancelBatch) {
        const completedCount = batchSessions.filter(s => s.status === 'completed').length;
        setLoadingMsg(`Lote completado: ${completedCount} de ${deductedCount} sesiones exitosas`);
        await delay(2000);
      }
      
      setBatchMode(false);
      setStep('library');
      
    } catch (e: any) {
      setErrorStatus(`Error en lote: ${e.message}`);
      setStep('setup');
    }
  };

  const cancelBatchGeneration = () => {
    if (window.confirm('¿Estás seguro? Al detener la generación NO se reembolsarán los créditos de las sesiones en progreso.')) {
      setCancelBatch(true);
      setBatchMode(false);
      setStep('setup');
    }
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
        { productRef, outfitRef, sceneRef, sceneText } as any,
        focus === 'PRODUCT' ? productSize : undefined,
        useProduct
      );
      setSessionPlan(plan);

      setLoadingMsg('Sincronizando identidad y generando Master...');
      const image0 = await contentStudioService.generateImage0(
        faceRefs[0],
        productRef,
        outfitRef,
        sceneRef,
        sceneText,
        FIXED_STYLE,
        focus,
        focus === 'PRODUCT' ? productSize : undefined,
        useProduct
      );

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
        attemptsImage0: 1,
        shots: initialShots
      };

      setCurrentSet(newSet);

      // Guardar Master en historial
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
        
      const image0 = await contentStudioService.generateImage0(
        currentSet.faceRefs[0],
        currentSet.productRef || null,
        currentSet.outfitRef || null,
        currentSet.sceneRef || null,
        currentSet.sceneText || '',
        FIXED_STYLE,
        currentSet.focus,
        currentSet.productSize,
        useProduct
      );

      setCurrentSet({
        ...currentSet,
        image0Url: image0,
        attemptsImage0: currentSet.attemptsImage0 + 1,
        style: FIXED_STYLE as any
      });
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

    const useProduct = (focus === 'OUTFIT' || focus === 'SCENE') ? isProductComplement : true;
    const focusRef = useProduct ? producingSet.productRef : null;

    const updatedShots = [...producingSet.shots];

    for (let i = 0; i < updatedShots.length; i++) {
      const shot = updatedShots[i] as any;
      setLoadingMsg(`Capturando Shot ${i + 1}/${updatedShots.length}...`);

      shot.status = 'generating';
      shot.errorMsg = null;

      setCurrentSet({ ...producingSet, shots: [...updatedShots] });

      try {
        const url = await contentStudioService.generateDerivedShot(
          producingSet.image0Url!,
          producingSet.faceRefs[0],
          focusRef || null,
          FIXED_STYLE,
          focus,
          shot.key,
          producingSet.productSize,
          sessionPlan,
          useProduct
        );

        shot.imageUrl = url;
        shot.status = 'done';
        shot.attempts = 1;
        shot.errorMsg = null;

        // Guardar en historial (background)
        generationHistoryService.save({
          imageUrl: url,
          module: 'content_studio_pro',
          moduleLabel: `UGC Pro (${FOCUS_LABELS[focus].split(' / ')[0]} - ${shot.name})`,
          creditsUsed: 0,
          promptText: `Shot ${shot.key} for ${focus}`
        }).catch(console.error);

      } catch (e: any) {
        shot.status = 'error';
        shot.errorMsg = e?.message || 'Error desconocido';
      }

      setCurrentSet({ ...producingSet, shots: [...updatedShots] });
      await new Promise((r) => setTimeout(r, 1000));
    }

    await contentStudioStorage.saveSet({ ...producingSet, shots: updatedShots });
    await loadSets();
    setStep('library');
    setSelectionMode(false);
    setSelectedSets(new Set());
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
      const url = await contentStudioService.generateDerivedShot(
        targetSet.image0Url,
        targetSet.faceRefs[0],
        focusRef || null,
        FIXED_STYLE,
        targetSet.focus,
        key,
        targetSet.productSize,
        sessionPlan,
        useProduct
      );

      updatedShots[shotIndex] = {
        ...shot,
        imageUrl: url,
        status: 'done',
        attempts: shot.attempts + 1,
        errorMsg: null
      };
    } catch (e: any) {
      updatedShots[shotIndex] = {
        ...shot,
        status: 'error',
        errorMsg: e?.message || 'Error desconocido'
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
      alert('Selecciona al menos una sesión');
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

  const openBatchImage = (session: BatchSession, type: 'ref0' | 'shot', shotIndex?: number) => {
    const images: GalleryImage[] = [];
    
    if (session.ref0Url) {
      images.push({ url: session.ref0Url, type: 'master' });
    }
    
    session.shotUrls.forEach((url, idx) => {
      if (url) {
        images.push({ url, type: 'shot', shotIndex: idx });
      }
    });
    
    let startIndex = 0;
    if (type === 'shot' && shotIndex !== undefined) {
      startIndex = shotIndex + 1;
    }
    
    setGalleryImages(images);
    setCurrentImageIndex(startIndex);
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

  const getStatusIcon = (status: BatchSession['status']) => {
    switch (status) {
      case 'pending': return <i className="fa-regular fa-clock text-slate-400"></i>;
      case 'generating_ref0': return <i className="fa-solid fa-spinner animate-spin text-brand-500"></i>;
      case 'generating_shots': return <i className="fa-solid fa-spinner animate-spin text-brand-500"></i>;
      case 'completed': return <i className="fa-solid fa-circle-check text-green-500"></i>;
      case 'failed': return <i className="fa-solid fa-circle-exclamation text-red-500"></i>;
      default: return null;
    }
  };

  const getStatusText = (status: BatchSession['status'], currentShot?: number, totalShots?: number) => {
    switch (status) {
      case 'pending': return 'Pendiente';
      case 'generating_ref0': return 'Generando REF0...';
      case 'generating_shots': return `Generando shot ${currentShot || 0}/${totalShots || 0}`;
      case 'completed': return 'Completada';
      case 'failed': return 'Fallida';
      default: return '';
    }
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

                {/* Modo múltiple - SOLO PARA ADMINISTRADORES */}
                {isAdmin && (
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider">
                        Modo múltiple (dev)
                      </span>
                      <div className="group relative">
                        <i className="fa-solid fa-circle-info text-slate-400 text-[10px] cursor-help"></i>
                        <div className="absolute bottom-full left-0 mb-2 w-64 p-2 bg-slate-900 text-white text-[9px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                          Herramienta de desarrollo. Genera varias sesiones a la vez para pruebas.
                          Solo visible para administradores.
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setBatchMode(!batchMode)}
                        className={`relative w-10 h-5 rounded-full transition-colors ${batchMode ? 'bg-brand-600' : 'bg-slate-300'}`}
                      >
                        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${batchMode ? 'translate-x-5' : 'translate-x-0.5'}`} />
                      </button>
                      {batchMode && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setBatchCount(Math.max(MIN_BATCH_SIZE, batchCount - 1))}
                            className="w-6 h-6 rounded-full bg-white border border-slate-200 text-slate-600 text-xs font-black"
                          >
                            -
                          </button>
                          <span className="text-sm font-black text-slate-700 w-8 text-center">{batchCount}</span>
                          <button
                            onClick={() => setBatchCount(Math.min(MAX_BATCH_SIZE, batchCount + 1))}
                            className="w-6 h-6 rounded-full bg-white border border-slate-200 text-slate-600 text-xs font-black"
                          >
                            +
                          </button>
                          <span className="text-[8px] text-slate-400 ml-1">sesiones</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <button
                  onClick={batchMode && isAdmin ? startBatchGeneration : startMasterGeneration}
                  className="w-full py-5 md:py-7 bg-brand-600 text-white rounded-[24px] md:rounded-[32px] font-black text-[10px] md:text-xs uppercase tracking-[0.2em] shadow-[0_20px_40px_rgba(247,44,91,0.3)] hover:bg-brand-700 active:scale-95 transition-all"
                >
                  {batchMode && isAdmin ? `Generar ${batchCount} sesiones en masa` : 'Sintetizar Master Anchor (UGC)'}
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

        {/* GENERACIÓN EN MASA - UI DE PROGRESO */}
        {step === 'batch_generating' && (
          <div className="min-h-[600px] bg-slate-900 rounded-[40px] border-8 border-slate-800 shadow-2xl p-6 md:p-10 mx-4 animate-in zoom-in">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-white text-xl md:text-2xl font-black uppercase italic tracking-tighter">
                  Generando lote de {batchSessions.length} sesiones...
                </h2>
                <p className="text-slate-400 text-[10px] mt-1">
                  Sesión {batchCurrentSessionIndex + 1} de {batchSessions.length} en progreso
                </p>
              </div>
              <button
                onClick={cancelBatchGeneration}
                className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-red-500/30 transition-all"
              >
                <i className="fa-solid fa-ban mr-1"></i> Cancelar lote
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {batchSessions.map((session) => (
                <div
                  key={session.id}
                  className={`bg-white/10 backdrop-blur-sm rounded-2xl p-4 border transition-all ${
                    session.status === 'completed' ? 'border-green-500/50' :
                    session.status === 'failed' ? 'border-red-500/50' :
                    session.status === 'generating_shots' ? 'border-brand-500/50' :
                    'border-white/10'
                  }`}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(session.status)}
                      <span className="text-white font-black text-sm">Sesión #{session.index}</span>
                    </div>
                    <span className="text-[8px] text-slate-400">{getStatusText(session.status, session.currentShotIndex, session.totalShots)}</span>
                  </div>

                  {/* REF0 - más grande */}
                  <div
                    className="aspect-[3/4] bg-slate-800 rounded-xl overflow-hidden cursor-pointer mb-3 relative group"
                    onClick={() => session.ref0Url && openBatchImage(session, 'ref0')}
                  >
                    {session.ref0Url ? (
                      <img src={session.ref0Url} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        {session.status === 'generating_ref0' ? (
                          <i className="fa-solid fa-spinner animate-spin text-slate-500 text-3xl"></i>
                        ) : (
                          <i className="fa-solid fa-image text-slate-600 text-3xl"></i>
                        )}
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <i className="fa-solid fa-expand text-white text-2xl"></i>
                    </div>
                    <div className="absolute top-2 left-2">
                      <span className="text-[8px] bg-brand-600 px-2 py-0.5 rounded-full text-white">REF0</span>
                    </div>
                  </div>

                  {/* Shots - grid de miniaturas */}
                  <div className="grid grid-cols-4 gap-1 mb-3">
                    {Array.from({ length: session.totalShots }).map((_, idx) => (
                      <div
                        key={idx}
                        className="aspect-[3/4] bg-slate-800 rounded-lg cursor-pointer overflow-hidden relative group"
                        onClick={() => session.shotUrls[idx] && openBatchImage(session, 'shot', idx)}
                      >
                        {session.shotUrls[idx] ? (
                          <img src={session.shotUrls[idx]!} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            {session.status === 'generating_shots' && session.currentShotIndex === idx + 1 ? (
                              <i className="fa-solid fa-spinner animate-spin text-slate-500 text-sm"></i>
                            ) : (
                              <i className="fa-regular fa-image text-slate-600 text-sm"></i>
                            )}
                          </div>
                        )}
                        <div className="absolute bottom-1 left-1">
                          <span className="text-[6px] bg-black/60 px-1 py-0.5 rounded text-white">S{idx + 1}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Barra de progreso */}
                  <div className="w-full bg-slate-700 rounded-full h-1.5 mb-3">
                    <div
                      className="bg-brand-500 h-1.5 rounded-full transition-all duration-300"
                      style={{ width: `${session.progress}%` }}
                    />
                  </div>

                  {/* Botón de descarga (solo si está completada) */}
                  {session.status === 'completed' && session.set && (
                    <button
                      onClick={() => downloadSingleSet(session.set!)}
                      className="w-full py-2 bg-brand-600 text-white rounded-lg text-[9px] font-black uppercase tracking-wider hover:bg-brand-700 transition-all flex items-center justify-center gap-2"
                    >
                      <i className="fa-solid fa-download"></i> Descargar sesión
                    </button>
                  )}

                  {session.status === 'failed' && (
                    <div className="text-center text-red-400 text-[8px]">{session.error || 'Error en la generación'}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* LOADING NORMAL */}
        {(step === 'generating_master' || step === 'producing') && step !== 'batch_generating' && (
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

        {/* LIBRARY */}
        {step === 'library' && (
          <div className="space-y-8 md:space-y-12 animate-in fade-in duration-700 px-4 md:px-0">
            
            {/* TABS OPTIMIZADOS - ESTILO MÓDULO */}
            <div className="flex justify-center">
              <div className="inline-flex bg-white p-1 rounded-2xl md:rounded-3xl border border-slate-100 shadow-sm">
                {TAB_ORDER.map((tab) => {
                  const count = tab === 'TODAS' ? sets.length : sets.filter(s => s.focus === tab).length;
                  const isActive = activeTab === tab;
                  return (
                    <button
                      key={tab}
                      onClick={() => {
                        setActiveTab(tab);
                        setSelectionMode(false);
                        setSelectedSets(new Set());
                      }}
                      className={`px-4 md:px-8 py-2 md:py-3 rounded-xl md:rounded-2xl text-[9px] md:text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
                        isActive
                          ? 'bg-brand-600 text-white shadow-lg'
                          : 'text-slate-400 hover:text-slate-600'
                      }`}
                    >
                      <span>{tab === 'TODAS' ? 'Todas' : FOCUS_LABELS[tab as Focus].split(' / ')[0]}</span>
                      <span className={`text-[8px] px-2 py-0.5 rounded-full ${isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* CONTROLES DE SELECCIÓN OPTIMIZADOS - ESTILO MÓDULO */}
            {showSelectionTools && (
              <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-50/50 p-4 md:p-6 rounded-[32px] border border-slate-100">
                <div className="flex flex-wrap items-center gap-2 md:gap-3">
                  {!selectionMode ? (
                    <button
                      onClick={() => setSelectionMode(true)}
                      className="px-6 py-3 bg-white border border-slate-200 text-slate-900 rounded-2xl text-[9px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm"
                    >
                      <i className="fa-solid fa-list-check text-brand-600"></i> Gestión múltiple
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 bg-white p-1 rounded-2xl border border-slate-200 shadow-sm">
                      <button
                        onClick={selectAllFiltered}
                        className="px-4 py-2 hover:bg-slate-50 text-slate-900 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-2"
                      >
                        <i className="fa-solid fa-check-double text-brand-600"></i> Todo
                      </button>
                      <button
                        onClick={clearSelection}
                        className="px-4 py-2 hover:bg-slate-50 text-slate-900 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-2"
                      >
                        <i className="fa-solid fa-eraser text-slate-400"></i> Limpiar
                      </button>
                      <div className="w-px h-4 bg-slate-200 mx-1"></div>
                      <button
                        onClick={() => {
                          setSelectionMode(false);
                          setSelectedSets(new Set());
                        }}
                        className="px-4 py-2 bg-red-50 text-red-600 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-red-100 transition-all flex items-center gap-2"
                      >
                        <i className="fa-solid fa-xmark"></i> Cancelar
                      </button>
                    </div>
                  )}
                </div>
                
                {selectedSets.size > 0 && (
                  <button
                    onClick={downloadSelectedSets}
                    className="w-full md:w-auto px-10 py-5 bg-brand-600 text-white rounded-[24px] text-[10px] font-black uppercase tracking-[0.2em] shadow-[0_15px_30px_rgba(247,44,91,0.25)] hover:bg-brand-700 active:scale-95 transition-all flex items-center justify-center gap-3"
                  >
                    <i className="fa-solid fa-cloud-arrow-down text-sm"></i> 
                    Descargar Pack ({selectedSets.size})
                  </button>
                )}
              </div>
            )}

            {filteredSets.length === 0 ? (
              <div className="text-center py-24 bg-slate-50 rounded-[48px] border-2 border-dashed border-slate-200">
                <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <i className="fa-solid fa-folder-open text-slate-300 text-3xl"></i>
                </div>
                <h4 className="text-slate-900 text-lg font-black uppercase italic tracking-tighter">Historial vacío</h4>
                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-2">
                  No hay sesiones en la categoría {activeTab === 'TODAS' ? 'seleccionada' : FOCUS_LABELS[activeTab as Focus].split(' / ')[0]}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-12 md:gap-16">
                {filteredSets.map((set) => (
                  <section
                    key={set.id}
                    className={`relative bg-white p-6 md:p-10 rounded-[32px] md:rounded-[48px] border shadow-xl space-y-8 md:space-y-10 group transition-all hover:shadow-2xl ${
                      selectedSets.has(set.id) ? 'border-brand-600 ring-4 ring-brand-600/10' : 'border-slate-100'
                    }`}
                  >
                    {/* CHECKBOX CUSTOM */}
                    {selectionMode && (
                      <div 
                        className="absolute -top-3 -left-3 z-20 cursor-pointer"
                        onClick={() => toggleSelectSet(set.id)}
                      >
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-xl transition-all ${
                          selectedSets.has(set.id) ? 'bg-brand-600 text-white scale-110' : 'bg-white text-slate-200 border-2 border-slate-100'
                        }`}>
                          <i className={`fa-solid ${selectedSets.has(set.id) ? 'fa-check' : 'fa-square'} text-lg`}></i>
                        </div>
                      </div>
                    )}

                    <div className="flex flex-col md:flex-row justify-between items-center gap-8 border-b border-slate-50 pb-8 md:pb-10">
                      <div className="flex items-center gap-6 md:gap-8">
                        <div
                          className="w-16 h-16 md:w-24 md:h-24 rounded-[24px] md:rounded-[32px] overflow-hidden bg-slate-50 shadow-2xl border-4 border-white cursor-pointer transform group-hover:rotate-3 transition-transform"
                          onClick={() => openGallery(set)}
                        >
                          <img src={set.image0Url!} className="w-full h-full object-cover" />
                        </div>
                        <div>
                          <div className="flex items-center gap-3 mb-2">
                            <span className="text-[8px] md:text-[9px] font-black text-brand-600 uppercase tracking-[0.3em] italic">
                              {FOCUS_LABELS[set.focus].split(' / ')[0]}
                            </span>
                            <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                            <span className="text-[8px] md:text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                              ID: {set.id.slice(-6).toUpperCase()}
                            </span>
                          </div>
                          <h3 className="text-2xl md:text-3xl font-black text-slate-900 uppercase italic tracking-tighter leading-none">
                            Sesión <span className="text-slate-300">UGC</span>
                          </h3>
                          <div className="flex flex-wrap gap-2 mt-4">
                            <span className="px-4 py-1.5 bg-slate-100 text-slate-600 text-[8px] md:text-[9px] font-black uppercase rounded-full tracking-widest border border-slate-200">
                              {set.productCategory && set.productCategory !== 'GENERIC' 
                                ? CATEGORY_LABELS[set.productCategory] 
                                : FOCUS_LABELS[set.focus].split(' / ')[0]}
                            </span>
                            <span className="px-4 py-1.5 bg-slate-900 text-white text-[8px] md:text-[9px] font-black uppercase rounded-full tracking-widest">
                              {set.shots.length} Shots
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-3 w-full md:w-auto">
                        <button
                          onClick={() => downloadSingleSet(set)}
                          className="flex-1 md:flex-none px-8 md:px-10 py-4 md:py-5 bg-white border-2 border-slate-100 rounded-[20px] md:rounded-[28px] text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-3 shadow-sm hover:border-brand-600 hover:text-brand-600 active:scale-95 transition-all group/btn"
                        >
                          <i className="fa-solid fa-file-zipper text-lg group-hover/btn:animate-bounce"></i> Pack
                        </button>
                        <button
                          onClick={() => contentStudioStorage.deleteSet(set.id).then(() => { loadSets(); setSelectedSets(new Set()); })}
                          className="w-14 h-14 md:w-16 md:h-16 bg-red-50 text-red-500 rounded-[20px] md:rounded-[28px] flex items-center justify-center hover:bg-red-500 hover:text-white transition-all shadow-sm"
                        >
                          <i className="fa-solid fa-trash-can text-lg"></i>
                        </button>
                        <button
                          onClick={() => openGallery(set)}
                          className="w-14 h-14 md:w-16 md:h-16 bg-slate-900 text-white rounded-[20px] md:rounded-[28px] flex items-center justify-center hover:bg-brand-600 transition-all shadow-xl"
                        >
                          <i className="fa-solid fa-expand text-lg"></i>
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-6 md:gap-8">
                      <div
                        className="aspect-[3/4] rounded-[24px] md:rounded-[32px] overflow-hidden border-4 md:border-8 border-brand-600 relative group cursor-pointer shadow-2xl transform hover:-translate-y-2 transition-all"
                        onClick={() => openGallery(set)}
                      >
                        <img src={set.image0Url!} className="w-full h-full object-cover" />
                        <div className="absolute top-4 left-4 md:top-6 md:left-6">
                          <span className="px-4 md:px-6 py-2 md:py-2.5 bg-brand-600 text-white text-[8px] md:text-[10px] font-black rounded-full uppercase italic shadow-xl tracking-widest">
                            Master
                          </span>
                        </div>
                        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity backdrop-blur-[2px]">
                          <i className="fa-solid fa-expand text-white text-4xl"></i>
                        </div>
                      </div>

                      {set.shots.map((s, idx) => (
                        <div
                          key={idx}
                          className="aspect-[3/4] bg-slate-50 rounded-[24px] md:rounded-[32px] overflow-hidden relative group cursor-pointer flex flex-col shadow-xl transform hover:-translate-y-2 transition-all"
                          onClick={() => s.imageUrl && openGallery(set)}
                        >
                          <div className="flex-1 relative overflow-hidden">
                            {s.status === 'generating' ? (
                              <div className="flex h-full items-center justify-center bg-slate-900">
                                <div className="flex flex-col items-center gap-4">
                                  <div className="w-10 h-10 border-4 border-white/10 border-t-brand-500 rounded-full animate-spin"></div>
                                  <span className="text-[8px] font-black uppercase text-brand-400 tracking-[0.3em]">
                                    Rendering
                                  </span>
                                </div>
                              </div>
                            ) : s.imageUrl ? (
                              <img src={s.imageUrl} className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110" />
                            ) : (
                              <div className="flex h-full items-center justify-center bg-slate-100 p-6 text-center">
                                <div className="flex flex-col items-center gap-3">
                                  <i className="fa-solid fa-circle-exclamation text-red-400 text-2xl"></i>
                                  <span className="text-[9px] font-black uppercase text-red-500 tracking-widest">Error</span>
                                </div>
                              </div>
                            )}

                            <div className="absolute top-4 left-4 md:top-6 md:left-6">
                              <span className="px-4 py-2 bg-black/60 backdrop-blur-xl text-white text-[8px] md:text-[9px] font-black rounded-full uppercase border border-white/10 italic tracking-widest">
                                Shot {idx + 1}
                              </span>
                            </div>

                            {s.imageUrl && s.status !== 'generating' && (
                              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity backdrop-blur-[2px]">
                                <i className="fa-solid fa-expand text-white text-3xl"></i>
                              </div>
                            )}
                          </div>

                          {s.imageUrl && s.status !== 'generating' && s.attempts < MAX_REGEN_ATTEMPTS && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                regenerateShot(set, s.key);
                              }}
                              className="absolute bottom-6 inset-x-6 py-3 md:py-4 bg-white/95 backdrop-blur-xl text-slate-900 text-[9px] font-black uppercase rounded-2xl md:rounded-3xl border border-slate-200 shadow-2xl opacity-0 group-hover:opacity-100 transition-all hover:bg-white active:scale-95 tracking-widest"
                            >
                              <i className="fa-solid fa-rotate mr-2"></i> Regenerar
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