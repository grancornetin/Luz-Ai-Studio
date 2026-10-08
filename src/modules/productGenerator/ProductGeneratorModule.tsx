// src/modules/productGenerator/ProductGeneratorModule.tsx
// Fotos de producto — flujo corto de la reestructuración por módulos:
//   1 Entrada (qué vas a lograr) → 2 Tu producto → 3 Estilo → 4 Revisa y crea
//   → 5 Creando → 6 Listas (con guardado automático y qué hacer ahora).
// La lógica de generación sigue conectada al productDirectorService:
// — análisis automático (heurística → Gemini si confianza baja)
// — cantidad real (fotos sueltas 1/2/4/6, collage 2/4/9, inspiración 1/2)
// — descuento total al crear + devolución automática por fotos fallidas
import React, { useEffect, useRef, useState } from 'react';
import { Package, Plus } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useCreditGuard } from '../../../hooks/useCreditGuard';
import NoCreditsModal from '../../components/shared/NoCreditsModal';
import { MODEL_CREDIT_COST } from '../../services/creditConfig';
import { useModelSelection } from '../../hooks/useModelSelection';
import { ProductProfile } from '../../types';
import { imageApiService, extractImageRef, newSessionId, type ModelId } from '../../services/imageApiService';
import { useAuth } from '../auth/AuthContext';
import { generationHistoryService } from '../../services/generationHistoryService';
import { getNotification } from '../../services/notificationsService';
import { downloadAsZip, downloadImage } from '../../utils/imageUtils';
import { ImageLightbox } from '../../components/shared/ImageLightbox';
import { useImagePicker } from '../../components/shared/useImagePicker';
import { FlowShell, flowTransition } from '../../components/shared/flow/FlowShell';
import { LargeTitle, PrimaryButton } from '../../components/shared/flow/primitives';

import {
  runProductDirector,
  buildPromptPayloadsFromDirectorResult,
  type ProductDirectorInput,
  type ProductDirectorResult,
  type ProductGridType,
  type ProductObjective,
  type ProductPromptPayload,
  type ProductStyle,
} from './productDirectorService';
import {
  INITIAL_WIZARD_STATE,
  type WizardStep,
  type WizardState,
  type PackCount,
} from './wizardTypes';
import { EntryStep } from './flow/EntryStep';
import { ProductStep } from './flow/ProductStep';
import { StyleStep } from './flow/StyleStep';
import { ReviewStep } from './flow/ReviewStep';
import { GeneratingStep } from './flow/GeneratingStep';
import { ResultsStep, type SaveState } from './flow/ResultsStep';
import { CatalogSheet } from './flow/CatalogSheet';
import { styleTitle } from './flow/styleOptions';

interface ProductPhotographyProps {
  saveProduct: (product: ProductProfile) => void | Promise<void>;
  products: ProductProfile[];
  standalone?: boolean;
}

// Este módulo ofrece solo "Mayor fidelidad" y "Más creativa"; la opción rápida
// global no respeta bien el producto, así que se reemplaza por fidelidad.
type ProductModelId = Exclude<ModelId, 'seedream'>;
const toProductModel = (m: ModelId): ProductModelId => (m === 'seedream' ? 'gemini' : m);

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

function computeCost(wizard: WizardState, modelId: ProductModelId): number {
  const { count, gridCollage } = computeFinalCount(wizard);
  return count * MODEL_CREDIT_COST[modelId] + (gridCollage ? 1 : 0);
}

const PRODUCT_OBJECTIVES: ProductObjective[] = ['social', 'ecommerce', 'technical_catalog', 'ads'];
const PRODUCT_STYLES: ProductStyle[] = ['minimal', 'premium', 'lifestyle', 'dark', 'natural'];
const PRODUCT_GRID_TYPES: ProductGridType[] = ['1x2', '2x2', '3x3'];
const PACK_COUNTS: PackCount[] = [1, 2, 4, 6];

const asProductObjective = (v: unknown): ProductObjective | null =>
  PRODUCT_OBJECTIVES.includes(v as ProductObjective) ? v as ProductObjective : null;
const asProductStyle = (v: unknown): ProductStyle | null =>
  PRODUCT_STYLES.includes(v as ProductStyle) ? v as ProductStyle : null;
const asProductGridType = (v: unknown): ProductGridType | null =>
  PRODUCT_GRID_TYPES.includes(v as ProductGridType) ? v as ProductGridType : null;
const asPackCount = (v: unknown): PackCount | null =>
  PACK_COUNTS.includes(v as PackCount) ? v as PackCount : null;

// El director devuelve '1:1' | '3:4' | '4:5' | '9:16'; la API de imágenes
// acepta '1:1' | '3:4' | '4:3' | '9:16' | '16:9'. '4:5' → '3:4'.
type ImageAspect = '1:1' | '3:4' | '4:3' | '9:16' | '16:9';
function mapAspectRatio(ar: '1:1' | '3:4' | '4:5' | '9:16'): ImageAspect {
  if (ar === '4:5') return '3:4';
  return ar;
}

// Proporción de las tarjetas = proporción real de la foto, para no recortar.
const aspectClassFor = (goal: ProductObjective | null) => (goal === 'social' || !goal ? 'aspect-[3/4]' : 'aspect-square');

const ProductPhotography: React.FC<ProductPhotographyProps> = ({
  saveProduct,
  products,
  standalone: _standalone,
}) => {
  const navigate = useNavigate();
  const { modelId: globalModelId, setModelId } = useModelSelection();
  const modelId = toProductModel(globalModelId);
  const { credits, isAdmin, user } = useAuth();
  const { checkAndDeduct, refundCredits, showNoCredits, requiredCredits, closeModal } = useCreditGuard();
  const picker = useImagePicker();

  const [activeTab, setActiveTab] = useState<'create' | 'library'>('create');
  // El paso vive en la URL (?paso=N) para que el botón atrás del navegador
  // retroceda un paso en vez de sacar a la usuaria del módulo.
  const [searchParams, setSearchParams] = useSearchParams();
  const stepFromUrl = Number(searchParams.get('paso'));
  const step: WizardStep = (stepFromUrl >= 1 && stepFromUrl <= 6 ? stepFromUrl : 1) as WizardStep;
  // Cada paso es una entrada del historial (el gesto de volver de Safari
  // retrocede un paso) y entra deslizándose: adelante desde la derecha.
  const setStep = (next: WizardStep, options?: { replace?: boolean; animate?: boolean }) => {
    const apply = () => {
      setSearchParams(prev => {
        const p = new URLSearchParams(prev);
        p.set('paso', String(next));
        return p;
      }, { replace: options?.replace ?? false });
      window.scrollTo({ top: 0 });
    };
    if (options?.animate === false || options?.replace) apply();
    else flowTransition(next >= step ? 'forward' : 'back', apply);
  };
  const [wizard, setWizard] = useState<WizardState>(INITIAL_WIZARD_STATE);

  const [processingStatus, setProcessingStatus] = useState('');
  const [generatedShots, setGeneratedShots] = useState<string[]>([]); // 'error' marca fallidos
  const [collageShot, setCollageShot] = useState<string | null>(null);
  const [directorResult, setDirectorResult] = useState<ProductDirectorResult | null>(null);
  const [lastPayloads, setLastPayloads] = useState<ProductPromptPayload[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [retryingIndices, setRetryingIndices] = useState<number[]>([]);
  const [genError, setGenError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [saveErrorDetail, setSaveErrorDetail] = useState<string | null>(null);
  const savedProductIdRef = useRef<string | null>(null);
  const [showCatalog, setShowCatalog] = useState(false);

  // ─── Lightbox ───────────────────────────────────────────────────────────────
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxMetadata, setLightboxMetadata] = useState<{ label: string }>({ label: '' });
  const [selectedProduct, setSelectedProduct] = useState<ProductProfile | null>(null);

  // ─── Retomar sesión desde notificación (?session=xxx) ───────────────────────
  // Al tocar un aviso llega con el sessionId en la URL: reconstruimos las fotos
  // desde Firestore y saltamos a "Listas".
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

      // Las faltantes quedan como 'error'
      const reconstructed: string[] = new Array(notif.totalShots).fill('error');
      notif.shots.forEach(s => {
        if (s.status === 'completed' && s.imageUrl) reconstructed[s.index] = s.imageUrl;
      });
      setGeneratedShots(reconstructed);

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
        type:  { ...prev.type, mode: md.mode || prev.type.mode, finalCount: md.count || prev.type.finalCount },
      }));

      // Saltar a "Listas" y limpiar ?session= en la misma escritura.
      setSearchParams({ paso: '6' }, { replace: true });
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  // ─── Onboarding: activa el tour guiado cuando llega desde el registro ───────
  useEffect(() => {
    if (localStorage.getItem('onboarding_tour_active') === 'product') {
      localStorage.removeItem('onboarding_tour_active');
      // El flag onboarding_free_generation se lee al crear para saltarse el cobro.
    }
  }, []);

  // ─── Helpers ────────────────────────────────────────────────────────────────
  const validFiles = (state: WizardState = wizard) =>
    state.product.slots.filter((f): f is string => !!f);

  type LabeledImageRef = { data: string; mimeType: string; label?: string };

  const buildRefObjects = (state: WizardState): LabeledImageRef[] => {
    const productRefs = validFiles(state).map((img, i) => {
      try {
        return { ...extractImageRef(img, `productRef[${i}]`), label: `PRODUCT_IDENTITY_REF_${i + 1}` };
      } catch { return null; }
    }).filter(Boolean) as LabeledImageRef[];

    let inspirationRef: LabeledImageRef | null = null;
    if (state.style.referenceImg) {
      try {
        inspirationRef = { ...extractImageRef(state.style.referenceImg, 'inspirationRef'), label: 'INSPIRATION_SCENE_REF' };
      } catch { /* no-op */ }
    }
    return inspirationRef ? [inspirationRef, ...productRefs] : productRefs;
  };

  // ─── Guardado automático en el catálogo ─────────────────────────────────────
  // Se guarda al terminar y se vuelve a guardar (mismo id) si se reintentan
  // fotos, para que el catálogo siempre tenga el set completo.
  const autoSave = async (
    state: WizardState,
    direction: ProductDirectorResult | null,
    shots: string[],
    collage: string | null,
  ) => {
    const finalShots = [...shots.filter((s) => s && s !== 'error'), ...(collage ? [collage] : [])];
    if (!direction || finalShots.length === 0) return;
    const files = validFiles(state);
    const id = savedProductIdRef.current ?? Date.now().toString();
    savedProductIdRef.current = id;
    const product: ProductProfile = {
      id,
      name:                  state.product.title,
      category:              direction.analysis.category,
      baseImages:            files,
      generatedImages:       finalShots,
      productPrompt:         direction.analysis.productAnchor,
      technicalDescription:  direction.analysis.technicalDescription,
      commercialDescription: direction.analysis.commercialDescription,
      metadata: {
        material: (direction.analysis.metadata?.material as string) ?? '',
        color:    (direction.analysis.metadata?.color as string) ?? '',
        style:    state.style.preset ?? 'minimal',
      },
      inspirationImage: state.style.referenceImg,
      generationConfig: {
        productTitle: state.product.title,
        productDescription: state.product.desc,
        objective: state.goal,
        stylePreset: state.style.preset,
        mode: state.style.referenceImg ? 'recreate' : state.type.mode,
        count: state.style.referenceImg
          ? state.type.refCount
          : state.type.mode === 'pack' ? state.type.packCount : state.type.gridSize,
        modelId,
      },
      referenceSummary: { productImages: files, inspirationImage: state.style.referenceImg },
      createdAt: Date.now(),
    };
    setSaveState('saving');
    try {
      await Promise.resolve(saveProduct(product));
      setSaveState('saved');
    } catch (e) {
      console.error('No se pudo guardar en el catálogo:', e);
      setSaveErrorDetail(e instanceof Error ? e.message : String(e));
      setSaveState('error');
    }
  };

  // ─── Generación principal: análisis + plan + N imágenes + collage ───────────
  const runGeneration = async (state: WizardState = wizard, free = false) => {
    if (!state.product.title.trim() || validFiles(state).length < 1) {
      setGenError('Falta la foto o el nombre de tu producto.');
      setStep(2);
      return;
    }
    setGenError(null);

    const totalCost = computeCost(state, modelId);
    const { count: finalCount, gridCollage } = computeFinalCount(state);

    if (!free && !isAdmin) {
      const ok = await checkAndDeduct(totalCost);
      if (!ok) return;
    }

    savedProductIdRef.current = null;
    setSaveState('idle');
    setStep(5);
    setIsGenerating(true);
    setProcessingStatus('Mirando los materiales y la forma de tu producto…');
    setGeneratedShots(new Array(finalCount).fill('') as string[]);
    setCollageShot(null);

    // Un sessionId por set: el server agrupa las fotos en un solo aviso.
    const sessionId = newSessionId();
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
    let collage: string | null = null;

    try {
      const directorInput = toDirectorInput(state);
      const direction = await runProductDirector(directorInput);
      setDirectorResult(direction);

      setProcessingStatus('Preparando la luz y la composición…');
      const payloads = buildPromptPayloadsFromDirectorResult(directorInput, direction).slice(0, finalCount);
      setLastPayloads(payloads);
      const referenceObjects = buildRefObjects(state);

      setProcessingStatus(finalCount === 1 ? 'Creando tu foto…' : `Creando tus ${finalCount} fotos…`);

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
              moduleLabel: 'Fotos de producto',
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
          setProcessingStatus('Armando tu collage…');
          try {
            collage = await generateCollage(state, direction, validShots, referenceObjects);
            setCollageShot(collage);
            generationHistoryService.save({
              imageUrl:    collage,
              module:      'catalog',
              moduleLabel: 'Fotos de producto (collage)',
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

      setProcessingStatus('Listo.');
      setStep(6);
      autoSave(state, direction, shots, collage).catch(console.error);
    } catch (e: any) {
      console.error('Falla crítica en generación:', e);
      if (!free && !isAdmin) await refundCredits(totalCost);
      setGenError('No pudimos crear tus fotos por un error. Ya te devolvimos los créditos. Intenta de nuevo en un momento.');
      setGeneratedShots([]);
      setProcessingStatus('');
      setStep(4);
    } finally {
      setIsGenerating(false);
    }
  };

  // Convierte una URL pública o data URL a { data, mimeType } para la API.
  // Las imágenes generadas llegan como URLs HTTPS y la API solo acepta inlineData.
  const urlToRef = async (url: string, label: string): Promise<{ data: string; mimeType: string } | null> => {
    try {
      if (url.startsWith('data:')) return extractImageRef(url, label);
      const res = await fetch(url, { mode: 'cors' });
      if (!res.ok) throw new Error(`fetch ${res.status}`);
      const blob = await res.blob();
      const mimeType = blob.type || 'image/jpeg';
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload  = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      return { data: base64, mimeType };
    } catch (e) {
      console.warn(`[generateCollage] No se pudo convertir ${label}:`, e);
      return null;
    }
  };

  // Genera el collage final pasando las N imágenes generadas como referencias.
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

    const shotRefs = (
      await Promise.all(validShots.map((img, i) => urlToRef(img, `gridCell[${i}]`)))
    ).filter(Boolean) as Array<{ data: string; mimeType: string }>;

    return imageApiService.generateImage({
      prompt:          collagePrompt,
      negative:        'extra text, watermark, distorted layout, missing cells, mismatched product, broken geometry',
      referenceImages: [...productAndInspirationRefs, ...shotRefs],
      aspectRatio:     r === c ? '1:1' : '4:3',
      module:          'product',
      moduleLabel:     'Foto de producto (collage)',
      modelId,
      shotIndex:       0,
      totalShots:      1,
      sessionId:       newSessionId(),
    });
  };

  // ─── Reintentar fotos fallidas ──────────────────────────────────────────────
  const retryFailedShots = async () => {
    const failedIndices = generatedShots.map((s, i) => (s === 'error' ? i : -1)).filter((i) => i >= 0);
    if (failedIndices.length === 0) return;

    const cost = failedIndices.length * MODEL_CREDIT_COST[modelId];
    if (!isAdmin) {
      const ok = await checkAndDeduct(cost);
      if (!ok) return;
    }

    setIsGenerating(true);
    setRetryingIndices(failedIndices);
    let creditsToRefund = 0;
    const refs = buildRefObjects(wizard);
    const next = [...generatedShots];

    await Promise.allSettled(
      failedIndices.map(async (i) => {
        const payload = lastPayloads[i];
        if (!payload) {
          next[i] = 'error';
          creditsToRefund += MODEL_CREDIT_COST[modelId];
          setRetryingIndices((prev) => prev.filter((idx) => idx !== i));
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
            sessionId:       newSessionId(),
          });
          next[i] = img;
          setRetryingIndices((prev) => prev.filter((idx) => idx !== i));
          setGeneratedShots([...next]);
          generationHistoryService.save({
            imageUrl:    img,
            module:      'catalog',
            moduleLabel: 'Fotos de producto',
            creditsUsed: MODEL_CREDIT_COST[modelId],
            promptText:  payload.prompt,
          }).catch(console.error);
        } catch (e) {
          console.error(`Reintento falló para shot ${i}:`, e);
          next[i] = 'error';
          creditsToRefund += MODEL_CREDIT_COST[modelId];
          setRetryingIndices((prev) => prev.filter((idx) => idx !== i));
          setGeneratedShots([...next]);
        }
      }),
    );

    if (!isAdmin && creditsToRefund > 0) await refundCredits(creditsToRefund);

    setRetryingIndices([]);
    setGeneratedShots([...next]);
    setIsGenerating(false);
    autoSave(wizard, directorResult, next, collageShot).catch(console.error);
  };

  // ─── Acciones de "Listas" ───────────────────────────────────────────────────
  const fileBase = () => wizard.product.title.replace(/\s+/g, '_') || 'producto';

  // "Guardar en mi celular": en iPhone abre la hoja de compartir del sistema
  // (Guardar imágenes → Fotos). Si el navegador no lo permite, descarga.
  const handleSaveToDevice = async () => {
    const finalShots = [...generatedShots.filter((s) => s && s !== 'error'), ...(collageShot ? [collageShot] : [])];
    if (finalShots.length === 0) return;
    setIsZipping(true);
    try {
      const files = await Promise.all(finalShots.map(async (url, i) => {
        const blob = await (await fetch(url)).blob();
        const ext = blob.type.includes('png') ? 'png' : 'jpg';
        return new File([blob], `${fileBase()}_${i + 1}.${ext}`, { type: blob.type || 'image/jpeg' });
      }));
      if (navigator.canShare?.({ files })) {
        await navigator.share({ files, title: wizard.product.title });
        return;
      }
      throw new Error('share-unavailable');
    } catch (e: any) {
      if (e?.name === 'AbortError') return; // la usuaria cerró la hoja de compartir
      try {
        if (finalShots.length === 1) await downloadImage(finalShots[0], `${fileBase()}_1.png`);
        else await downloadAsZip(finalShots, `Fotos_${fileBase()}.zip`, fileBase());
      } catch (err) {
        console.error('No pudimos preparar la descarga:', err);
      }
    } finally {
      setIsZipping(false);
    }
  };

  const clearResults = () => {
    setGeneratedShots([]);
    setCollageShot(null);
    setDirectorResult(null);
    setLastPayloads([]);
    setRetryingIndices([]);
    setProcessingStatus('');
    setSaveState('idle');
    savedProductIdRef.current = null;
  };

  const resetCreator = () => {
    clearResults();
    setWizard(INITIAL_WIZARD_STATE);
    setGenError(null);
    setSelectedProduct(null);
    setStep(1);
  };

  // ─── Partir desde un producto del catálogo ──────────────────────────────────
  const prefillFromProduct = (product: ProductProfile) => {
    const config = product.generationConfig ?? {};
    const productRefs = (product.referenceSummary?.productImages ?? product.baseImages ?? []).filter(Boolean).slice(0, 4);
    const inspiration = product.referenceSummary?.inspirationImage ?? product.inspirationImage ?? null;
    const slots = [...productRefs, null, null, null, null].slice(0, 4) as (string | null)[];
    const nextType = { ...INITIAL_WIZARD_STATE.type };
    const refCount = config.count === 1 || config.count === 2 ? config.count : null;
    const gridType = asProductGridType(config.count);
    const packCount = asPackCount(config.count);

    if (inspiration) nextType.refCount = refCount ?? nextType.refCount;
    else if (config.mode === 'grid' && gridType) { nextType.mode = 'grid'; nextType.gridSize = gridType; }
    else if (config.mode === 'pack' && packCount) { nextType.mode = 'pack'; nextType.packCount = packCount; }

    clearResults();
    setGenError(null);
    setWizard({
      product: {
        title: config.productTitle ?? product.name ?? '',
        desc: config.productDescription ?? '',
        slots,
      },
      goal: asProductObjective(config.objective) ?? 'social',
      style: {
        referenceImg: inspiration,
        preset: inspiration ? null : asProductStyle(config.stylePreset ?? product.metadata?.style),
      },
      type: nextType,
    });
    setShowCatalog(false);
    setLightboxOpen(false);
    setSelectedProduct(null);
    setActiveTab('create');
    setStep(3);
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

  const renderSelectedProductDetails = () => {
    if (!selectedProduct) return null;
    return (
      <div className="rounded-2xl bg-white/10 border border-white/10 p-3 text-white">
        <p className="text-sm font-bold leading-tight">{selectedProduct.name}</p>
        <p className="text-xs text-white/70 mt-0.5">
          {selectedProduct.generatedImages?.length ?? 0} fotos · {styleTitle(asProductStyle(selectedProduct.generationConfig?.stylePreset ?? selectedProduct.metadata?.style))}
        </p>
        <button
          type="button"
          onClick={() => prefillFromProduct(selectedProduct)}
          className="mt-3 w-full rounded-xl bg-white text-slate-900 px-3 py-2.5 text-sm font-bold hover:bg-white/90 transition-colors"
        >
          Crear más fotos de este producto
        </button>
      </div>
    );
  };

  // ─── Pasos alcanzables ──────────────────────────────────────────────────────
  // Si el paso de la URL no se puede mostrar con lo que hay en memoria (recarga,
  // link compartido), vuelve al inicio. No aplica al retomar desde un aviso.
  const hasMain = !!wizard.product.slots[0];
  const hasName = wizard.product.title.trim().length > 0;
  const hasStyle = !!wizard.style.referenceImg || !!wizard.style.preset;
  useEffect(() => {
    if (searchParams.get('session')) return;
    const reachable =
      step === 1 ? true :
      step === 2 ? hasMain :
      step === 3 ? hasMain && hasName :
      step === 4 ? hasMain && hasName && hasStyle :
      (generatedShots.length > 0 || isGenerating);
    if (!reachable) setStep(1, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // ─── Acciones del flujo ─────────────────────────────────────────────────────
  const handleCreate = () => {
    const isFreeOnboarding = localStorage.getItem('onboarding_free_generation') === 'true';
    if (isFreeOnboarding) localStorage.removeItem('onboarding_free_generation');
    runGeneration(wizard, isFreeOnboarding).catch(console.error);
  };

  const pickMainPhoto = () =>
    picker.open((img) => {
      setWizard((s) => {
        const slots = [...s.product.slots];
        slots[0] = img;
        return { ...s, product: { ...s.product, slots } };
      });
      setStep(2);
    });

  const pickStyle = (style: ProductStyle) => {
    setWizard((s) => ({ ...s, style: { referenceImg: null, preset: style } }));
    // Pequeña pausa para que se vea la selección antes de avanzar.
    window.setTimeout(() => setStep(4), 220);
  };

  const pickReference = (img: string) => {
    setWizard((s) => ({ ...s, style: { referenceImg: img, preset: null } }));
    setStep(4);
  };

  const finalCount = computeFinalCount(wizard);
  const totalCost = computeCost(wizard, modelId);
  const defaultCost = computeCost(INITIAL_WIZARD_STATE, modelId);
  const aspectClass = aspectClassFor(wizard.goal);

  // ─── Render ─────────────────────────────────────────────────────────────────
  const exitModule = () => navigate('/dashboard');
  const styleLabel = wizard.style.referenceImg ? 'Tu inspiración' : styleTitle(wizard.style.preset);

  return (
    <>
      <NoCreditsModal isOpen={showNoCredits} onClose={closeModal} required={requiredCredits} available={credits.available} />
      {picker.element}

      {activeTab === 'create' ? (
        <>
          {step === 1 && (
            <EntryStep
              defaultCost={defaultCost}
              creditsAvailable={credits.available}
              hasCatalog={products.length > 0}
              isPicking={picker.isLoading}
              onUpload={pickMainPhoto}
              onUseCatalog={() => setShowCatalog(true)}
              onOpenCatalog={() => { setActiveTab('library'); window.scrollTo({ top: 0 }); }}
              onClose={exitModule}
            />
          )}
          {step === 2 && (
            <ProductStep
              state={wizard.product}
              onChange={(next) => setWizard((s) => ({ ...s, product: next }))}
              pickImage={picker.open}
              onBack={() => setStep(1)}
              onContinue={() => setStep(3)}
            />
          )}
          {step === 3 && (
            <StyleStep
              state={wizard.style}
              pickImage={picker.open}
              onPickStyle={pickStyle}
              onPickReference={pickReference}
              onBack={() => setStep(2)}
            />
          )}
          {step === 4 && (
            <ReviewStep
              wizard={wizard}
              finalCount={finalCount.count}
              cost={totalCost}
              creditsAvailable={credits.available}
              isAdmin={isAdmin}
              modelId={modelId}
              onModelChange={setModelId}
              onChange={setWizard}
              onEditProduct={() => setStep(2)}
              onEditStyle={() => setStep(3)}
              onBack={() => setStep(3)}
              onCreate={handleCreate}
              error={genError}
              disabled={isGenerating}
            />
          )}
          {step === 5 && (
            <GeneratingStep
              shots={generatedShots}
              collage={collageShot}
              withCollage={finalCount.gridCollage}
              aspectClass={aspectClass}
              statusText={processingStatus}
              running={isGenerating}
              onExit={exitModule}
            />
          )}
          {step === 6 && (
            <ResultsStep
              productTitle={wizard.product.title}
              styleLabel={styleLabel}
              shots={generatedShots}
              collage={collageShot}
              aspectClass={aspectClass}
              retryingIndices={retryingIndices}
              isRetrying={isGenerating}
              isSavingToDevice={isZipping}
              saveState={saveState}
              saveErrorDetail={isAdmin ? saveErrorDetail : null}
              onRetrySave={() => autoSave(wizard, directorResult, generatedShots, collageShot)}
              onRetryFailed={retryFailedShots}
              onOpen={(url) => {
                const valid = [...generatedShots, ...(collageShot ? [collageShot] : [])].filter((s) => s && s !== 'error');
                openLightbox(valid, Math.max(0, valid.indexOf(url)), wizard.product.title);
              }}
              onDownload={(url, i) => downloadImage(url, `${fileBase()}_${i + 1}.png`)}
              onSaveToDevice={handleSaveToDevice}
              onUseWithAvatar={() => navigate('/studio-pro')}
              onMakeCampaign={() => navigate('/campaign')}
              onOtherStyle={() => { clearResults(); setStep(3); }}
              onOtherProduct={resetCreator}
              onDone={resetCreator}
            />
          )}
        </>
      ) : (
        <FlowShell
          title="Mi catálogo"
          wide
          leading={{ kind: 'back', onPress: () => { setActiveTab('create'); window.scrollTo({ top: 0 }); } }}
          actions={
            <PrimaryButton onClick={() => { setActiveTab('create'); resetCreator(); }} icon={<Plus size={20} />}>
              Crear fotos de un producto
            </PrimaryButton>
          }
        >
          <LargeTitle subtitle={products.length > 0 ? `${products.length} ${products.length === 1 ? 'producto' : 'productos'}` : undefined}>
            Mi catálogo
          </LargeTitle>
          {products.length === 0 ? (
            <div className="mt-10 flex flex-col items-center text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-[16px] bg-[color:var(--tint)] text-[color:var(--action)]">
                <Package size={26} />
              </span>
              <p className="mt-4 text-[17px] font-semibold">Todavía no hay productos</p>
              <p className="mt-1 max-w-[30ch] text-[15px] leading-5 text-[color:var(--text-2)]">Crea las fotos de tu primer producto y quedarán guardadas aquí.</p>
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-5 md:grid-cols-4">
              {products.map((product) => {
                const cover = (product.generatedImages ?? []).find(Boolean);
                const n = product.generatedImages?.length ?? 0;
                return (
                  <button key={product.id} type="button" onClick={() => openProductDetail(product)} className="flow-press text-left">
                    <span className="block aspect-[4/5] overflow-hidden rounded-[16px] bg-[color:var(--fill)]">
                      {cover && <img src={cover} alt="" className="h-full w-full object-cover" loading="lazy" />}
                    </span>
                    <span className="mt-2 block truncate text-[15px] font-semibold">{product.name}</span>
                    <span className="block text-[13px] tracking-normal text-[color:var(--text-2)]">
                      {n} {n === 1 ? 'foto' : 'fotos'} · {styleTitle(asProductStyle(product.generationConfig?.stylePreset ?? product.metadata?.style))}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </FlowShell>
      )}

      <CatalogSheet open={showCatalog} products={products} onPick={prefillFromProduct} onClose={() => setShowCatalog(false)} />

      {lightboxOpen && lightboxImages.length > 0 && (
        <ImageLightbox
          images={lightboxImages}
          initialIndex={lightboxIndex}
          onClose={() => { setLightboxOpen(false); setSelectedProduct(null); }}
          onDownload={(url, idx) => {
            downloadImage(url, `${(selectedProduct?.name || wizard.product.title || 'producto').replace(/\s+/g, '_')}_${idx + 1}.png`);
          }}
          metadata={lightboxMetadata}
          details={renderSelectedProductDetails()}
        />
      )}
    </>
  );
};

export default ProductPhotography;
