// src/modules/productGenerator/ProductGeneratorModule.tsx
// Wizard guiado de 6 pasos conectado al productDirectorService:
// — análisis automático inteligente (heurística → Gemini si confianza baja)
// — cantidad real (Pack 1/2/4/6, Grid 1x2/2x2/3x3, Recrear 1/2)
// — collage final automático cuando modo=grid
// — recreate permite humanos solo si la referencia los tiene
// — descuento total al apretar Generar + reembolso por fallos
// — Paso 6 con reintento de fotos fallidas
import React, { useState, useEffect } from 'react';
import { ResultCard } from '../../components/shared/ResultCard';
import { ResultLibraryGrid } from '../../components/shared/ResultLibraryGrid';
import { useSearchParams } from 'react-router-dom';
import ModuleTutorial from '../../components/shared/ModuleTutorial';
import { TUTORIAL_CONFIGS } from '../../components/shared/tutorialConfigs';
import { useCreditGuard } from '../../../hooks/useCreditGuard';
import NoCreditsModal from '../../components/shared/NoCreditsModal';
import { MODEL_CREDIT_COST } from '../../services/creditConfig';
import { ModelSelector } from '../../components/shared/ModelSelector';
import { useModelSelection } from '../../../hooks/useModelSelection';
import { ProductProfile } from '../../types';
import { imageApiService, extractImageRef, newSessionId } from '../../services/imageApiService';
import { useAuth } from '../auth/AuthContext';
import { generationHistoryService } from '../../services/generationHistoryService';
import { getNotification } from '../../services/notificationsService';
import { downloadAsZip } from '../../utils/imageUtils';

import { ImageLightbox } from '../../components/shared/ImageLightbox';
import { type ProgressStep } from '../../components/shared/GenerationProgress';

// Director (nueva lógica)
import {
  runProductDirector,
  buildPromptPayloadsFromDirectorResult,
  type ProductDirectorInput,
  type ProductDirectorResult,
  type ProductPromptPayload,
} from './productDirectorService';

// Wizard pieces
import { WizardStepper } from './WizardStepper';
import { WizardFooter } from './WizardFooter';
import { Step1Product } from './Step1Product';
import { Step2Goal } from './Step2Goal';
import { Step3Style } from './Step3Style';
import { Step4Type } from './Step4Type';
import { Step5Generating } from './Step5Generating';
import { Step6Results } from './Step6Results';
import {
  WIZARD_STEPS,
  INITIAL_WIZARD_STATE,
  type WizardStep,
  type WizardState,
} from './wizardTypes';

// ─── Etapas de progreso narradas ──────────────────────────────────────────────
const PRODUCT_STEPS: ProgressStep[] = [
  { id: 'analyze',  label: 'Analizando producto y materiales' },
  { id: 'plan',     label: 'Definiendo composición y dirección de arte' },
  { id: 'generate', label: 'Generando imágenes' },
  { id: 'collage',  label: 'Componiendo grid final' },
  { id: 'done',     label: 'Set listo' },
];

interface ProductPhotographyProps {
  saveProduct: (product: ProductProfile) => void;
  products: ProductProfile[];
  standalone?: boolean;
}

// Convierte el state del wizard al input del director.
function toDirectorInput(wizard: WizardState): ProductDirectorInput {
  const slots = wizard.product.slots.filter((s): s is string => !!s);
  const hasRef = !!wizard.style.referenceImg;
  return {
    productImages:    slots,
    productTitle:     wizard.product.title.trim(),
    productDescription: wizard.product.desc.trim() || undefined,
    objective:        wizard.goal ?? 'social',
    style:            wizard.style.preset ?? undefined,
    referenceImage:   wizard.style.referenceImg,
    mode:             hasRef ? 'recreate' : wizard.type.mode,
    count:            hasRef ? wizard.type.refCount : (wizard.type.mode === 'pack' ? wizard.type.packCount : undefined),
    gridType:         !hasRef && wizard.type.mode === 'grid' ? wizard.type.gridSize : undefined,
    allowHumanFromReference: hasRef,
  };
}

// Calcula cuántas imágenes producirá la generación.
function computeFinalCount(wizard: WizardState): { count: number; gridCollage: boolean } {
  const hasRef = !!wizard.style.referenceImg;
  if (hasRef) return { count: wizard.type.refCount, gridCollage: false };
  if (wizard.type.mode === 'pack') return { count: wizard.type.packCount, gridCollage: false };
  const [r, c] = wizard.type.gridSize.split('x').map((n) => parseInt(n, 10));
  return { count: r * c, gridCollage: true };
}

function computeCost(wizard: WizardState, modelId: 'gemini' | 'seedream' | 'gptimage'): number {
  const { count, gridCollage } = computeFinalCount(wizard);
  return count * MODEL_CREDIT_COST[modelId] + (gridCollage ? 1 : 0);
}

// El director devuelve aspect ratios en su set propio ('1:1' | '3:4' | '4:5' | '9:16').
// imageApiService acepta '1:1' | '3:4' | '4:3' | '9:16' | '16:9'.
// Mapeamos '4:5' → '3:4' (vertical más cercano permitido).
type ImageAspect = '1:1' | '3:4' | '4:3' | '9:16' | '16:9';
function mapAspectRatio(ar: '1:1' | '3:4' | '4:5' | '9:16'): ImageAspect {
  if (ar === '4:5') return '3:4';
  return ar;
}

const ProductPhotography: React.FC<ProductPhotographyProps> = ({
  saveProduct,
  products,
  standalone: _standalone,
}) => {
  const { modelId, setModelId } = useModelSelection();
  const { credits, isAdmin, user } = useAuth();
  const { checkAndDeduct, refundCredits, showNoCredits, requiredCredits, closeModal } = useCreditGuard();

  const [activeTab, setActiveTab] = useState<'create' | 'library'>('create');
  const [step, setStep] = useState<WizardStep>(1);
  const [wizard, setWizard] = useState<WizardState>(INITIAL_WIZARD_STATE);

  const [progressStepIndex, setProgressStepIndex] = useState(0);
  const [processingStatus, setProcessingStatus] = useState('');
  const [generatedShots, setGeneratedShots] = useState<string[]>([]); // 'error' marca fallidos
  const [collageShot, setCollageShot] = useState<string | null>(null);
  const [directorResult, setDirectorResult] = useState<ProductDirectorResult | null>(null);
  const [lastPayloads, setLastPayloads] = useState<ProductPromptPayload[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  // Notificaciones Nivel 3: ID único del set actual, para que el server agrupe
  // todos los shots en una sola notificación que se va actualizando.
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  // ─── Lightbox ───────────────────────────────────────────────────────────────
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxMetadata, setLightboxMetadata] = useState<{ label: string }>({ label: '' });
  const [_selectedProduct, setSelectedProduct] = useState<ProductProfile | null>(null);

  // ─── Retomar sesión desde notificación (?session=xxx) ───────────────────────
  // Cuando el usuario clickea una notificación, llega acá con el sessionId en
  // la URL. Leemos la notificación de Firestore, reconstruimos los shots y
  // saltamos al Paso 6 (resultados).
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const sessionParam = searchParams.get('session');
    if (!sessionParam || !user) return;

    let cancelled = false;
    (async () => {
      const notif = await getNotification(user.uid, sessionParam);
      if (cancelled || !notif) {
        // Limpiar el query param aunque no se haya encontrado la notificación
        setSearchParams({}, { replace: true });
        return;
      }

      // Reconstruir shots ordenados por index — los faltantes quedan como 'error'
      const reconstructed: string[] = new Array(notif.totalShots).fill('error');
      notif.shots.forEach(s => {
        if (s.status === 'completed' && s.imageUrl) {
          reconstructed[s.index] = s.imageUrl;
        }
      });

      setCurrentSessionId(notif.sessionId);
      setGeneratedShots(reconstructed);

      // Reconstruir mínimo del wizard desde la metadata para que Step6 muestre
      // título y stepper con el contexto correcto.
      const md = notif.metadata || {};
      setWizard(prev => ({
        ...prev,
        product: {
          ...prev.product,
          title: md.productTitle || prev.product.title,
          desc:  md.productDescription || prev.product.desc,
        },
        goal:  md.objective || prev.goal,
        style: { ...prev.style, preset: md.stylePreset || prev.style.preset },
        type:  {
          ...prev.type,
          mode: md.mode || prev.type.mode,
          finalCount: md.count || prev.type.finalCount,
        },
      }));

      setStep(6);
      // Limpiar el query param para que un refresh no vuelva a disparar el efecto
      setSearchParams({}, { replace: true });
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  // ─── Onboarding: activa el tour guiado cuando llega desde el wizard de registro ─
  useEffect(() => {
    const tour = localStorage.getItem('onboarding_tour_active');
    if (tour === 'product') {
      localStorage.removeItem('onboarding_tour_active');
      // No generamos automáticamente — el usuario sigue el wizard normal del módulo.
      // El flag onboarding_free_generation se lee en runGeneration para saltarse el cobro.
    }
  }, []);

  // ─── Helpers ────────────────────────────────────────────────────────────────
  const validFiles = (state: WizardState = wizard) =>
    state.product.slots.filter((f): f is string => !!f);

  const buildRefObjects = (state: WizardState) => {
    const productRefs = validFiles(state).map((img, i) => {
      try { return extractImageRef(img, `productRef[${i}]`); }
      catch { return null; }
    }).filter(Boolean) as Array<{ data: string; mimeType: string }>;

    let inspirationRef: { data: string; mimeType: string } | null = null;
    if (state.style.referenceImg) {
      try { inspirationRef = extractImageRef(state.style.referenceImg, 'inspirationRef'); }
      catch { /* no-op */ }
    }
    return inspirationRef ? [...productRefs, inspirationRef] : productRefs;
  };

  // ─── Generación principal: análisis + plan + N imágenes + collage ───────────
  const runGeneration = async (state: WizardState = wizard, free = false) => {
    const files = validFiles(state);
    if (!state.product.title.trim()) {
      alert('Por favor, especifica el nombre del producto.');
      return;
    }
    if (!free && files.length < 2) {
      alert('Sube al menos 2 fotos del producto (frontal y trasera) para que la IA comprenda todas sus caras.');
      return;
    }

    const totalCost = computeCost(state, modelId);
    const { count: finalCount, gridCollage } = computeFinalCount(state);

    if (!free && !isAdmin) {
      const ok = await checkAndDeduct(totalCost);
      if (!ok) return;
    }

    setStep(5);
    setIsGenerating(true);
    setProgressStepIndex(0);
    setProcessingStatus('Escaneando materiales y contexto del producto...');
    setGeneratedShots(new Array(finalCount).fill('') as string[]);
    setCollageShot(null);

    // Nuevo sessionId para que el server agrupe todos los shots de este set
    // en una sola notificación que se va actualizando shot por shot.
    const sessionId = newSessionId();
    setCurrentSessionId(sessionId);
    const sessionMetadata = {
      productTitle: state.product.title.trim(),
      productDescription: state.product.desc.trim() || undefined,
      objective: state.goal,
      stylePreset: state.style.preset,
      mode: state.type.mode,
      count: finalCount,
    };

    let creditsToRefund = 0;
    const shots = new Array<string>(finalCount).fill('');

    try {
      const directorInput = toDirectorInput(state);
      const direction = await runProductDirector(directorInput);
      setDirectorResult(direction);

      setProgressStepIndex(1);
      setProcessingStatus('Definiendo composición y dirección de arte...');

      const allPayloads = buildPromptPayloadsFromDirectorResult(directorInput, direction);
      const payloads = allPayloads.slice(0, finalCount);
      setLastPayloads(payloads);

      const referenceObjects = buildRefObjects(state);

      setProgressStepIndex(2);
      setProcessingStatus(`Generando ${finalCount} ${finalCount === 1 ? 'imagen' : 'imágenes'}...`);

      await Promise.allSettled(
        payloads.map(async (payload, i) => {
          try {
            const img = await imageApiService.generateImage({
              prompt:          payload.prompt,
              negative:        payload.negativePrompt,
              referenceImages: referenceObjects.length > 0 ? referenceObjects : undefined,
              aspectRatio:     mapAspectRatio(payload.aspectRatio),
              module:          'product',
              moduleLabel:     'Foto de producto',
              modelId,
              shotIndex:       i,
              totalShots:      finalCount,
              sessionId,
              metadata:        sessionMetadata,
            });
            shots[i] = img;
            setGeneratedShots([...shots]);

            generationHistoryService.save({
              imageUrl:    img,
              module:      'catalog',
              moduleLabel: `Product Studio (${payload.shotType})`,
              creditsUsed: free ? 0 : MODEL_CREDIT_COST[modelId],
              promptText:  payload.prompt,
            }).catch(console.error);
          } catch (e: any) {
            console.error(`Error generating shot ${i}:`, e);
            shots[i] = 'error';
            creditsToRefund += MODEL_CREDIT_COST[modelId];
            setGeneratedShots([...shots]);
          }
        }),
      );

      if (gridCollage) {
        const validShots = shots.filter((s) => s && s !== 'error');
        if (validShots.length >= 2) {
          setProgressStepIndex(3);
          setProcessingStatus('Componiendo grid final...');
          try {
            const collage = await generateCollage(state, direction, validShots, referenceObjects);
            setCollageShot(collage);
            generationHistoryService.save({
              imageUrl:    collage,
              module:      'catalog',
              moduleLabel: 'Product Studio (Grid Collage)',
              creditsUsed: free ? 0 : 1,
              promptText:  'collage final',
            }).catch(console.error);
          } catch (e: any) {
            console.error('Error generando collage:', e);
            creditsToRefund += 1;
          }
        } else {
          creditsToRefund += 1;
        }
      }

      if (!free && !isAdmin && creditsToRefund > 0) {
        await refundCredits(creditsToRefund);
      }

      setProgressStepIndex(4);
      setProcessingStatus('Producción completada.');
      setStep(6);
    } catch (e: any) {
      console.error('Falla crítica en generación:', e);
      if (!free && !isAdmin) {
        await refundCredits(totalCost);
      }
      alert('Error en la generación: ' + (e?.message || 'desconocido'));
      setStep(1);
      setProcessingStatus('');
    } finally {
      setIsGenerating(false);
    }
  };

  // Genera el collage final pasando las N imágenes generadas como referencias adicionales.
  const generateCollage = async (
    state: WizardState,
    direction: ProductDirectorResult,
    validShots: string[],
    productAndInspirationRefs: Array<{ data: string; mimeType: string }>,
  ): Promise<string> => {
    const [r, c] = state.type.gridSize.split('x').map((n) => parseInt(n, 10));

    const collagePrompt = [
      'Photorealistic composite product photography.',
      `PRODUCT TITLE: ${state.product.title}`,
      `PRODUCT ANCHOR: ${direction.analysis.productAnchor}`,
      '',
      `Compose a single final image arranged as a clean ${r}x${c} grid mosaic of ${r * c} product shots.`,
      'Use the provided generated shots as a strict visual reference for the cells (one shot per cell).',
      'Maintain consistent product identity, lighting family and color tone across all cells.',
      'No borders, soft separation between cells, premium catalog feel.',
      `Background style: ${direction.masterContext.background}`,
      `Lighting style: ${direction.masterContext.lighting}`,
      '',
      'HARD RULES: do not invent product details, preserve original product shape and colors, no human figures unless already present in the source shots.',
    ].join('\n');

    const shotRefs = validShots
      .map((img, i) => {
        try { return extractImageRef(img, `gridCell[${i}]`); }
        catch { return null; }
      })
      .filter(Boolean) as Array<{ data: string; mimeType: string }>;

    return imageApiService.generateImage({
      prompt:          collagePrompt,
      negative:        'extra text, watermark, distorted layout, missing cells, mismatched product, broken geometry',
      referenceImages: [...productAndInspirationRefs, ...shotRefs],
      aspectRatio:     r === c ? '1:1' : '4:3',
      module:          'product',
      moduleLabel:     'Foto de producto (grid)',
      modelId,
      shotIndex:       0,
      totalShots:      1,
      sessionId:       newSessionId(),
    });
  };

  // ─── Reintentar fotos fallidas ──────────────────────────────────────────────
  const retryFailedShots = async () => {
    const failedIndices = generatedShots
      .map((s, i) => (s === 'error' ? i : -1))
      .filter((i) => i >= 0);
    if (failedIndices.length === 0) return;

    const cost = failedIndices.length * MODEL_CREDIT_COST[modelId];
    if (!isAdmin) {
      const ok = await checkAndDeduct(cost);
      if (!ok) return;
    }

    setIsGenerating(true);
    let creditsToRefund = 0;
    const refs = buildRefObjects(wizard);
    const next = [...generatedShots];

    await Promise.allSettled(
      failedIndices.map(async (i) => {
        const payload = lastPayloads[i];
        if (!payload) {
          next[i] = 'error';
          creditsToRefund += MODEL_CREDIT_COST[modelId];
          return;
        }
        try {
          const img = await imageApiService.generateImage({
            prompt:          payload.prompt,
            negative:        payload.negativePrompt,
            referenceImages: refs.length > 0 ? refs : undefined,
            aspectRatio:     mapAspectRatio(payload.aspectRatio),
            module:          'product',
            moduleLabel:     'Foto de producto',
            modelId,
            shotIndex:       i,
            totalShots:      generatedShots.length,
            // Retry: NO uses el sessionId del set original. Si el set ya estaba
            // marcado como `partial`, sumar más shots reabriría la notificación.
            // Generamos una sesión nueva por reintento (cada retry = 1 set chico).
            sessionId:       newSessionId(),
          });
          next[i] = img;
          generationHistoryService.save({
            imageUrl:    img,
            module:      'catalog',
            moduleLabel: `Product Studio (${payload.shotType} retry)`,
            creditsUsed: MODEL_CREDIT_COST[modelId],
            promptText:  payload.prompt,
          }).catch(console.error);
        } catch (e) {
          console.error(`Reintento falló para shot ${i}:`, e);
          next[i] = 'error';
          creditsToRefund += MODEL_CREDIT_COST[modelId];
        }
      }),
    );

    if (!isAdmin && creditsToRefund > 0) {
      await refundCredits(creditsToRefund);
    }

    setGeneratedShots(next);
    setIsGenerating(false);
  };

  // ─── Acciones del Paso 6 ────────────────────────────────────────────────────
  const allFinalShots = (): string[] => {
    const valid = generatedShots.filter((s) => s && s !== 'error');
    return collageShot ? [...valid, collageShot] : valid;
  };

  const handleSaveToCatalog = () => {
    if (!directorResult) return;
    const finalShots = allFinalShots();
    if (finalShots.length === 0) return;
    const files = validFiles();
    const newProduct: ProductProfile = {
      id:                    Date.now().toString(),
      name:                  wizard.product.title,
      category:              directorResult.analysis.category,
      baseImages:            files,
      generatedImages:       finalShots,
      productPrompt:         directorResult.analysis.productAnchor,
      technicalDescription:  directorResult.analysis.technicalDescription,
      commercialDescription: directorResult.analysis.commercialDescription,
      metadata: {
        material: (directorResult.analysis.metadata?.material as string) ?? '',
        color:    (directorResult.analysis.metadata?.color as string) ?? '',
        style:    wizard.style.preset ?? 'minimal',
      },
      createdAt: Date.now(),
    };
    saveProduct(newProduct);
    alert('Producto archivado en el catálogo exitosamente.');
    resetCreator();
    setActiveTab('library');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Descarga robusta: para URLs http(s) hace fetch → blob → objectURL para forzar
  // descarga (evita que iOS Safari/Android Chrome abran la imagen en vez de bajarla).
  // Para data URLs y blob URLs cae al método clásico.
  const handleDownloadIndividual = async (url: string, filename: string) => {
    try {
      if (url.startsWith('http://') || url.startsWith('https://')) {
        const res = await fetch(url, { mode: 'cors' });
        if (!res.ok) throw new Error('fetch failed');
        const blob = await res.blob();
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = objectUrl;
        link.download = filename;
        link.rel = 'noopener';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        // dar tiempo al browser a iniciar la descarga antes de revocar
        setTimeout(() => URL.revokeObjectURL(objectUrl), 4000);
        return;
      }
      // data: o blob: → descarga directa
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.rel = 'noopener';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Descarga directa falló, abriendo en nueva pestaña:', err);
      // Fallback final: abrir en nueva pestaña para que el usuario use "Guardar imagen como..."
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleDownloadZip = async () => {
    const finalShots = allFinalShots();
    if (finalShots.length === 0) return;
    setIsZipping(true);
    try {
      const zipName = `Set_${wizard.product.title.replace(/\s+/g, '_') || 'product'}.zip`;
      const prefix = wizard.product.title.replace(/\s+/g, '_') || 'product';
      await downloadAsZip(finalShots, zipName, prefix);
    } catch {
      alert('Error al comprimir el set.');
    } finally {
      setIsZipping(false);
    }
  };

  const resetCreator = () => {
    setWizard(INITIAL_WIZARD_STATE);
    setStep(1);
    setProgressStepIndex(0);
    setProcessingStatus('');
    setGeneratedShots([]);
    setCollageShot(null);
    setDirectorResult(null);
    setLastPayloads([]);
    setSelectedProduct(null);
  };

  // ─── Volver atrás desde el Paso 6 sin perder el wizard ──────────────────────
  // Vuelve al Paso 4 (configuración de tipo/cantidad). Limpia los resultados
  // anteriores pero preserva: producto, objetivo, estilo y configuración.
  const backToConfig = () => {
    setGeneratedShots([]);
    setCollageShot(null);
    setDirectorResult(null);
    setLastPayloads([]);
    setProcessingStatus('');
    setProgressStepIndex(0);
    setStep(4);
  };

  // Vuelve al Paso 1 conservando el producto pero permitiendo cambiar las fotos.
  const backToStart = () => {
    setGeneratedShots([]);
    setCollageShot(null);
    setDirectorResult(null);
    setLastPayloads([]);
    setProcessingStatus('');
    setProgressStepIndex(0);
    setStep(1);
  };

  // ─── Lightbox helpers ───────────────────────────────────────────────────────
  const openLightbox = (images: string[], initialIndex: number, label: string) => {
    setLightboxImages(images);
    setLightboxIndex(initialIndex);
    setLightboxMetadata({ label });
    setLightboxOpen(true);
  };

  const openProductDetail = (product: ProductProfile) => {
    setSelectedProduct(product);
    openLightbox(product.generatedImages, 0, product.name);
  };

  // ─── Validaciones por paso ──────────────────────────────────────────────────
  const filledSlots = wizard.product.slots.filter(Boolean).length;
  const totalCost = computeCost(wizard, modelId);
  const canContinueByStep: Record<WizardStep, boolean> = {
    1: filledSlots >= 2 && wizard.product.title.trim().length > 0,
    2: !!wizard.goal,
    3: !!wizard.style.referenceImg || !!wizard.style.preset,
    4: isAdmin || credits.available >= totalCost,
    5: false,
    6: false,
  };

  // ─── Footer config ──────────────────────────────────────────────────────────
  const footerCostInfo = step === 4 ? { cost: totalCost, label: 'Costo total' } : undefined;
  const continueLabel = step === 4 ? 'Generar' : 'Continuar';
  const showFooter = step >= 1 && step <= 4 && activeTab === 'create';

  const handleContinue = () => {
    if (step === 4) {
      const isFreeOnboarding = localStorage.getItem('onboarding_free_generation') === 'true';
      if (isFreeOnboarding) localStorage.removeItem('onboarding_free_generation');
      runGeneration(wizard, isFreeOnboarding).catch(console.error);
      return;
    }
    if (step < 6) setStep((step + 1) as WizardStep);
  };

  const handleBack = () => {
    if (step > 1 && !isGenerating) setStep((step - 1) as WizardStep);
  };

  const { count: previewCount, gridCollage: previewCollage } = computeFinalCount(wizard);
  const totalShotsForPreview = previewCount + (previewCollage ? 1 : 0);

  const modeLabel = wizard.style.referenceImg
    ? 'Recrear inspiración'
    : `${wizard.type.mode === 'pack' ? 'Pack' : 'Grid'}${wizard.style.preset ? ' · ' + wizard.style.preset : ''}`;

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <NoCreditsModal
        isOpen={showNoCredits}
        onClose={closeModal}
        required={requiredCredits}
        available={credits.available}
      />

      <div className="max-w-7xl mx-auto pb-20 animate-in fade-in duration-500">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-5 px-1 mb-6 md:mb-8">
          <div>
            <h1 className="t-display text-3xl text-slate-900">Foto de producto</h1>
            <div className="flex items-center gap-2 mt-2">
              <p className="text-slate-500 font-medium italic text-xs md:text-sm">
                Genera contenido comercial en 6 pasos.{' '}
                <span className="normal-case font-normal text-slate-300 text-[9px]">
                  (Product Studio)
                </span>
              </p>
              <ModuleTutorial moduleId="catalog" steps={TUTORIAL_CONFIGS.catalog} />
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <ModelSelector
              value={modelId}
              onChange={setModelId}
              disabled={isGenerating}
            />
            <div
              className={`flex bg-white p-1 rounded-2xl shadow-sm border border-slate-100 transition-opacity duration-150 ${
                isGenerating ? 'opacity-50' : ''
              }`}
            >
            <button
              type="button"
              disabled={isGenerating}
              onClick={() => {
                if (isGenerating) return;
                setActiveTab('create');
                window.scrollTo(0, 0);
                resetCreator();
              }}
              style={{ touchAction: 'manipulation' }}
              className={`px-5 md:px-8 py-2 md:py-3 rounded-xl t-meta transition-colors duration-150 disabled:cursor-not-allowed ${
                activeTab === 'create'
                  ? 'bg-brand-600 text-white shadow-lg'
                  : 'text-slate-400 md:hover:text-slate-700'
              }`}
            >
              Laboratorio
            </button>
            <button
              type="button"
              disabled={isGenerating}
              onClick={() => {
                if (isGenerating) return;
                setActiveTab('library');
                window.scrollTo(0, 0);
              }}
              style={{ touchAction: 'manipulation' }}
              className={`px-5 md:px-8 py-2 md:py-3 rounded-xl t-meta transition-colors duration-150 disabled:cursor-not-allowed ${
                activeTab === 'library'
                  ? 'bg-brand-600 text-white shadow-lg'
                  : 'text-slate-400 md:hover:text-slate-700'
              }`}
            >
              Catálogo ({products.length})
            </button>
          </div>
          </div>
        </header>

        {activeTab === 'create' ? (
          <div className="bg-white rounded-[28px] md:rounded-[36px] shadow-sm border border-slate-100 overflow-hidden flex flex-col min-h-[640px]">
            <WizardStepper
              steps={WIZARD_STEPS}
              current={step}
              onJump={(s) => !isGenerating && setStep(s)}
            />

            <div className="flex-1 overflow-auto">
              {step === 1 && (
                <Step1Product
                  state={wizard.product}
                  onChange={(next) => setWizard((s) => ({ ...s, product: next }))}
                  disabled={isGenerating}
                />
              )}
              {step === 2 && (
                <Step2Goal
                  goal={wizard.goal}
                  onChange={(g) => setWizard((s) => ({ ...s, goal: g }))}
                />
              )}
              {step === 3 && (
                <Step3Style
                  state={wizard.style}
                  onChange={(next) => setWizard((s) => ({ ...s, style: next }))}
                />
              )}
              {step === 4 && (
                <Step4Type
                  type={wizard.type}
                  onChange={(next) => setWizard((s) => ({ ...s, type: next }))}
                  hasReference={!!wizard.style.referenceImg}
                  productTitle={wizard.product.title}
                  creditsAvailable={credits.available}
                  modelId={modelId}
                />
              )}
              {step === 5 && (
                <Step5Generating
                  steps={PRODUCT_STEPS}
                  currentStepIndex={progressStepIndex}
                  productTitle={wizard.product.title}
                  totalShots={totalShotsForPreview}
                  completedShots={[
                    ...generatedShots
                      .map((url, i) => ({ url, index: i }))
                      .filter((s) => s.url && s.url !== 'error'),
                    ...(collageShot ? [{ url: collageShot, index: generatedShots.length }] : []),
                  ]}
                  modeLabel={modeLabel}
                  processingStatus={processingStatus}
                />
              )}
              {step === 6 && (
                <Step6Results
                  productTitle={wizard.product.title}
                  shots={collageShot ? [...generatedShots, collageShot] : generatedShots}
                  collageIndex={collageShot ? generatedShots.length : null}
                  isZipping={isZipping}
                  hasFailed={generatedShots.some((s) => s === 'error')}
                  isRetrying={isGenerating}
                  onRetryFailed={retryFailedShots}
                  onLightbox={(i) => {
                    const all = collageShot ? [...generatedShots, collageShot] : generatedShots;
                    const valid = all.filter((s) => s && s !== 'error');
                    const validIndex = Math.min(i, valid.length - 1);
                    openLightbox(valid, Math.max(0, validIndex), `${wizard.product.title} · Shot ${i + 1}`);
                  }}
                  onDownloadIndividual={handleDownloadIndividual}
                  onDownloadZip={handleDownloadZip}
                  onSaveToCatalog={handleSaveToCatalog}
                  onRestart={resetCreator}
                  onBackToConfig={backToConfig}
                  onBackToStart={backToStart}
                />
              )}
            </div>

            {showFooter && (
              <WizardFooter
                onBack={step > 1 ? handleBack : undefined}
                onContinue={handleContinue}
                continueLabel={continueLabel}
                disabled={!canContinueByStep[step]}
                costInfo={footerCostInfo}
                loading={isGenerating}
              />
            )}
          </div>
        ) : (
          <ResultLibraryGrid
            stats={[
              { label: 'Productos', value: products.length, sub: 'en catálogo' },
              { label: 'Imágenes', value: products.reduce((s, p) => s + (p.generatedImages?.length ?? 0), 0), sub: 'generadas', color: 'text-brand-600' },
            ]}
            searchTexts={products.map(p => `${p.name} ${p.category} ${p.metadata?.material ?? ''}`)}
            emptyTitle="Catálogo vacío"
            emptyDescription="Generá tu primer set de fotos de producto para verlo aquí"
            emptyCtaLabel="Crear producto"
            onEmpty={() => setActiveTab('create')}
          >
            {products.map(product => (
              <ResultCard
                key={product.id}
                images={[...(product.generatedImages ?? []), ...(product.baseImages ?? [])].filter(Boolean).slice(0, 3)}
                title={product.name}
                subtitle={`${product.category}${product.metadata?.material ? ` · ${product.metadata.material}` : ''}`}
                date={product.createdAt}
                badge={{ label: '✓ Guardado', color: 'green' }}
                pills={[product.category, product.metadata?.material, product.metadata?.style].filter(Boolean) as string[]}
                refSlots={(product.baseImages ?? []).slice(0, 2).map((src, i) => ({ label: `Base ${i + 1}`, src }))}
                accentColor="blue"
                onClick={() => openProductDetail(product)}
                actions={[
                  { label: 'Ver detalle', onClick: e => { e.stopPropagation(); openProductDetail(product); }, variant: 'primary' },
                ]}
              />
            ))}
          </ResultLibraryGrid>
        )}

        {lightboxOpen && lightboxImages.length > 0 && (
          <ImageLightbox
            images={lightboxImages}
            initialIndex={lightboxIndex}
            onClose={() => {
              setLightboxOpen(false);
              setSelectedProduct(null);
            }}
            onDownload={(url, idx) => {
              handleDownloadIndividual(
                url,
                `${wizard.product.title.replace(/\s+/g, '_') || 'product'}_image_${idx + 1}.png`,
              );
            }}
            metadata={lightboxMetadata}
          />
        )}
      </div>
    </>
  );
};

export default ProductPhotography;
